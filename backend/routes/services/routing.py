"""
Routing Service
===============
Geocodes two locations via Nominatim then builds exactly 3 route alternatives.

Route generation strategy:
  1. Ask OSRM for alternatives — the public server often returns only 1.
  2. For any missing routes, generate alternatives by routing through an
     offset midpoint (north, south, east) to force a different corridor.

Each route is returned with:
  - GeoJSON geometry
  - distance_miles / duration_hours
  - checkpoints every 10/25/50 miles with ETA timestamps
"""

from __future__ import annotations

import time
import math
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL = 25
METERS_PER_MILE = 1609.344
AVG_TRUCK_SPEED_MPH = 55.0
NOMINATIM_DELAY = 1.1  # seconds between geocode calls (ToS)
NUM_ROUTES = 3


# ── Geocoding ─────────────────────────────────────────────────────────────────


def geocode(address: str) -> dict:
    """
    Returns {"lat", "lon", "display_name"}.
    Raises ValueError on failure.
    """
    headers = {
        "User-Agent": getattr(settings, "NOMINATIM_USER_AGENT", "SpotterApp/1.0")
    }
    params = {
        "q": address,
        "format": "json",
        "limit": 1,
    }
    try:
        resp = requests.get(
            settings.NOMINATIM_URL, params=params, headers=headers, timeout=10
        )
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as exc:
        raise ValueError(f"Geocoding failed for '{address}': {exc}") from exc

    if not results:
        raise ValueError(
            f"Could not find '{address}'. "
            "Try including the state or country, e.g. 'Los Angeles, CA' or 'Chicago, IL, USA'."
        )

    r = results[0]
    return {
        "lat": float(r["lat"]),
        "lon": float(r["lon"]),
        "display_name": r.get("display_name", address),
    }


# ── Geometry helpers ──────────────────────────────────────────────────────────


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _decode_geojson_coords(geometry: dict) -> List[Tuple[float, float]]:
    """Return list of (lat, lon) from a GeoJSON LineString."""
    return [(c[1], c[0]) for c in geometry.get("coordinates", [])]


def _sample_checkpoints(
    coords: List[Tuple[float, float]],
    interval_miles: float,
    departure_dt: datetime,
    total_miles: float,
) -> List[dict]:
    if not coords or total_miles <= 0:
        return []

    checkpoints = []
    cum_dist = 0.0
    next_target = interval_miles

    checkpoints.append(
        _make_checkpoint(
            0, coords[0][0], coords[0][1], departure_dt, departure_dt, total_miles
        )
    )

    for i in range(1, len(coords)):
        lat1, lon1 = coords[i - 1]
        lat2, lon2 = coords[i]
        seg_dist = _haversine_miles(lat1, lon1, lat2, lon2)

        while cum_dist + seg_dist >= next_target:
            frac = (next_target - cum_dist) / seg_dist if seg_dist > 0 else 0
            c_lat = lat1 + frac * (lat2 - lat1)
            c_lon = lon1 + frac * (lon2 - lon1)
            eta = departure_dt + timedelta(hours=next_target / AVG_TRUCK_SPEED_MPH)
            checkpoints.append(
                _make_checkpoint(
                    next_target, c_lat, c_lon, departure_dt, eta, total_miles
                )
            )
            next_target += interval_miles

        cum_dist += seg_dist

    eta_dest = departure_dt + timedelta(hours=total_miles / AVG_TRUCK_SPEED_MPH)
    checkpoints.append(
        _make_checkpoint(
            total_miles,
            coords[-1][0],
            coords[-1][1],
            departure_dt,
            eta_dest,
            total_miles,
        )
    )

    return checkpoints


def _make_checkpoint(dist_from_start, lat, lon, departure_dt, eta, total_miles):
    return {
        "distance_from_start_miles": round(dist_from_start, 2),
        "distance_to_end_miles": round(total_miles - dist_from_start, 2),
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "eta_iso": eta.isoformat(),
        "hours_from_departure": round((eta - departure_dt).total_seconds() / 3600, 3),
    }


# ── OSRM helpers ──────────────────────────────────────────────────────────────


def _osrm_request(coord_str: str) -> List[dict]:
    """
    Call OSRM with a coordinate string and return raw route objects.
    coord_str format: "lon1,lat1;lon2,lat2" or with extra waypoints.
    """
    url = f"{settings.OSRM_URL}/{coord_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "alternatives": "true",
        "steps": "false",
    }
    resp = requests.get(url, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError(f"OSRM returned no routes: {data.get('message', '')}")

    return data["routes"]


def _build_route_dict(
    raw: dict, route_id: int, departure_dt: datetime, interval: int
) -> dict:
    dist_mi = raw["distance"] / METERS_PER_MILE
    dur_h = raw["duration"] / 3600
    geometry = raw["geometry"]
    coords = _decode_geojson_coords(geometry)
    checkpoints = _sample_checkpoints(coords, interval, departure_dt, dist_mi)

    return {
        "route_id": route_id,
        "distance_miles": round(dist_mi, 2),
        "duration_hours": round(dur_h, 3),
        "geometry": geometry,
        "checkpoints": checkpoints,
    }


# ── Three-route generation ────────────────────────────────────────────────────


def _direct_coord_str(o: dict, d: dict) -> str:
    return f"{o['lon']},{o['lat']};{d['lon']},{d['lat']}"


def _waypoint_coord_str(o: dict, d: dict, lat_off: float, lon_off: float) -> str:
    """
    Force an alternative route by routing through a midpoint offset by
    (lat_off, lon_off) degrees from the straight midpoint.
    """
    mid_lat = (o["lat"] + d["lat"]) / 2 + lat_off
    mid_lon = (o["lon"] + d["lon"]) / 2 + lon_off
    return f"{o['lon']},{o['lat']};{mid_lon},{mid_lat};{d['lon']},{d['lat']}"


def _fetch_three_routes(
    origin: dict, dest: dict, departure_dt: datetime, interval: int
) -> List[dict]:
    """
    Return exactly up to 3 route dicts. Strategy:
      1. Direct OSRM call with alternatives=true  → may give 1–3
      2. Fill missing slots with waypoint-detour routes
    """
    routes: List[dict] = []
    seen_distances: set = set()

    def _add_from_raw(raw_list: List[dict]) -> None:
        for raw in raw_list:
            if len(routes) >= NUM_ROUTES:
                break
            dist_key = round(raw["distance"] / METERS_PER_MILE)
            if dist_key in seen_distances:
                continue  # skip near-duplicate
            seen_distances.add(dist_key)
            routes.append(
                _build_route_dict(raw, len(routes) + 1, departure_dt, interval)
            )

    # 1 — direct call
    try:
        raw_direct = _osrm_request(_direct_coord_str(origin, dest))
        _add_from_raw(raw_direct)
    except Exception as exc:
        raise ValueError(f"OSRM routing failed: {exc}") from exc

    if not routes:
        raise ValueError("OSRM returned no usable routes.")

    # 2 — waypoint detours to fill up to 3 routes
    # Scale offsets by ~15% of the larger span
    lat_span = abs(dest["lat"] - origin["lat"])
    lon_span = abs(dest["lon"] - origin["lon"])
    offset = max(lat_span, lon_span, 0.5) * 0.18  # at least 0.09 deg

    detour_offsets = [
        (offset, 0),  # north detour
        (-offset, 0),  # south detour
        (0, offset),  # east detour
        (0, -offset),  # west detour
        (offset, offset),  # northeast
    ]

    for lat_off, lon_off in detour_offsets:
        if len(routes) >= NUM_ROUTES:
            break
        try:
            raw_alt = _osrm_request(_waypoint_coord_str(origin, dest, lat_off, lon_off))
            _add_from_raw(raw_alt)
        except Exception as exc:
            logger.debug(
                "Waypoint route failed (offset %.2f, %.2f): %s", lat_off, lon_off, exc
            )

    # Re-number sequentially
    for i, r in enumerate(routes):
        r["route_id"] = i + 1

    return routes


# ── Public API ────────────────────────────────────────────────────────────────


def get_routes(
    origin: str,
    destination: str,
    departure_dt: datetime,
    checkpoint_interval: int = DEFAULT_INTERVAL,
) -> dict:
    """
    Geocode → fetch up to 3 OSRM routes → sample checkpoints.

    Returns:
        {
          "origin":      {"lat", "lon", "display_name"},
          "destination": {"lat", "lon", "display_name"},
          "routes": [ {route_id, distance_miles, duration_hours,
                       geometry, checkpoints} ]
        }
    """
    origin_geo = geocode(origin)
    time.sleep(NOMINATIM_DELAY)
    dest_geo = geocode(destination)

    interval = (
        checkpoint_interval if checkpoint_interval in (10, 25, 50) else DEFAULT_INTERVAL
    )

    routes = _fetch_three_routes(origin_geo, dest_geo, departure_dt, interval)

    return {
        "origin": origin_geo,
        "destination": dest_geo,
        "routes": routes,
    }
