"""
Routing Service
===============
Geocodes two locations via Nominatim then fetches up to 3 alternative
routes from the OSRM public demo server.

Each route is returned with:
  - GeoJSON geometry
  - distance_miles / duration_hours
  - checkpoints every CHECKPOINT_INTERVAL_MILES along the polyline,
    each with (lat, lon, distance_from_start, eta_iso)
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

CHECKPOINT_INTERVALS = {10: 10, 25: 25, 50: 50}  # miles
DEFAULT_INTERVAL = 25
METERS_PER_MILE = 1609.344
AVG_TRUCK_SPEED_MPH = 55.0
NOMINATIM_DELAY = 1.1  # seconds between geocode calls (Nominatim ToS)


# ── Geocoding ─────────────────────────────────────────────────────────────────


def geocode(address: str) -> dict:
    """
    Returns {"lat": float, "lon": float, "display_name": str}
    Raises ValueError on failure.
    """
    headers = {
        "User-Agent": getattr(settings, "NOMINATIM_USER_AGENT", "SpotterApp/1.0")
    }
    params = {"q": address, "format": "json", "limit": 1}

    try:
        resp = requests.get(
            settings.NOMINATIM_URL, params=params, headers=headers, timeout=10
        )
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as exc:
        raise ValueError(f"Geocoding failed for '{address}': {exc}") from exc

    if not results:
        raise ValueError(f"Could not geocode: '{address}'")

    r = results[0]
    return {
        "lat": float(r["lat"]),
        "lon": float(r["lon"]),
        "display_name": r.get("display_name", address),
    }


# ── Geometry helpers ──────────────────────────────────────────────────────────


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8  # Earth radius in miles
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
    coords = geometry.get("coordinates", [])
    return [(c[1], c[0]) for c in coords]  # GeoJSON is [lon, lat]


def _sample_checkpoints(
    coords: List[Tuple[float, float]],
    interval_miles: float,
    departure_dt: datetime,
    total_miles: float,
) -> List[dict]:
    """
    Walk the polyline and emit a checkpoint dict every `interval_miles`.
    Each checkpoint gets an estimated arrival time based on avg truck speed.
    """
    if not coords or total_miles <= 0:
        return []

    checkpoints = []
    cum_dist = 0.0
    next_target = interval_miles  # first checkpoint

    # Always include the origin
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
            # Interpolate the exact checkpoint position
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

    # Always include the destination
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


def _make_checkpoint(
    dist_from_start: float,
    lat: float,
    lon: float,
    departure_dt: datetime,
    eta: datetime,
    total_miles: float,
) -> dict:
    return {
        "distance_from_start_miles": round(dist_from_start, 2),
        "distance_to_end_miles": round(total_miles - dist_from_start, 2),
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "eta_iso": eta.isoformat(),
        "hours_from_departure": round((eta - departure_dt).total_seconds() / 3600, 3),
    }


# ── OSRM routing ──────────────────────────────────────────────────────────────


def _fetch_osrm_routes(
    origin_coords: dict,
    dest_coords: dict,
    alternatives: int = 3,
) -> List[dict]:
    """Call OSRM and return up to `alternatives` raw route objects."""
    coord_str = (
        f"{origin_coords['lon']},{origin_coords['lat']};"
        f"{dest_coords['lon']},{dest_coords['lat']}"
    )
    url = f"{settings.OSRM_URL}/{coord_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "alternatives": "true",
        "steps": "false",
    }
    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        raise ValueError(f"OSRM routing failed: {exc}") from exc

    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError(f"OSRM error: {data.get('message', 'no routes returned')}")

    return data["routes"][:alternatives]


# ── Public API ────────────────────────────────────────────────────────────────


def get_routes(
    origin: str,
    destination: str,
    departure_dt: datetime,
    checkpoint_interval: int = DEFAULT_INTERVAL,
) -> dict:
    """
    Geocode origin/destination, fetch up to 3 OSRM routes, build checkpoints.

    Returns:
        {
          "origin":      {"lat", "lon", "display_name"},
          "destination": {"lat", "lon", "display_name"},
          "routes": [
            {
              "route_id":       int (1-3),
              "distance_miles": float,
              "duration_hours": float,
              "geometry":       GeoJSON LineString,
              "checkpoints":    [ {distance_from_start_miles, lat, lon, eta_iso, ...} ],
            }
          ]
        }
    """
    origin_geo = geocode(origin)
    time.sleep(NOMINATIM_DELAY)
    dest_geo = geocode(destination)

    raw_routes = _fetch_osrm_routes(origin_geo, dest_geo)

    interval = (
        checkpoint_interval if checkpoint_interval in (10, 25, 50) else DEFAULT_INTERVAL
    )

    routes = []
    for idx, raw in enumerate(raw_routes):
        dist_m = raw["distance"]
        dur_s = raw["duration"]
        dist_mi = dist_m / METERS_PER_MILE
        dur_h = dur_s / 3600
        geometry = raw["geometry"]
        coords = _decode_geojson_coords(geometry)
        checkpoints = _sample_checkpoints(coords, interval, departure_dt, dist_mi)

        routes.append(
            {
                "route_id": idx + 1,
                "distance_miles": round(dist_mi, 2),
                "duration_hours": round(dur_h, 3),
                "geometry": geometry,
                "checkpoints": checkpoints,
            }
        )

    return {
        "origin": origin_geo,
        "destination": dest_geo,
        "routes": routes,
    }
