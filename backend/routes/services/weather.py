"""
Weather Service
Fetches hourly weather forecasts from Open-Meteo with parallel snapped-coordinate deduplication.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

KMH_TO_MPH = 0.621371
MM_TO_IN = 0.0393701
CM_TO_IN = 0.393701

HOURLY_PARAMS = {
    "hourly": "windspeed_10m,precipitation,snowfall,weathercode",
    "windspeed_unit": "kmh",
    "forecast_days": 7,
    "timezone": "UTC",
}

MAX_WORKERS = 4
WEATHER_TIMEOUT = 10


# ── Helpers ───────────────────────────────────────────────────────────────────


def _fetch_open_meteo(lat: float, lon: float) -> dict:
    params = {"latitude": lat, "longitude": lon, **HOURLY_PARAMS}
    for attempt in range(2):
        try:
            resp = requests.get(
                settings.OPEN_METEO_URL,
                params=params,
                timeout=WEATHER_TIMEOUT,
            )
            if resp.status_code == 429 and attempt == 0:
                time.sleep(1.2)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            if attempt == 0:
                time.sleep(0.5)
                continue
            logger.warning("Open-Meteo fetch failed for (%s, %s): %s", lat, lon, exc)
            return {}
    return {}


def _parse_hourly(data: dict) -> dict:
    h = data.get("hourly", {})
    return {
        "time": h.get("time", []),
        "windspeed_10m": h.get("windspeed_10m", []),
        "precipitation": h.get("precipitation", []),
        "snowfall": h.get("snowfall", []),
        "weathercode": h.get("weathercode", []),
    }


def _closest_index(times: list[str], target_iso: str) -> int:
    if not times:
        return 0
    try:
        target = datetime.fromisoformat(target_iso.replace("Z", "+00:00"))
        parsed = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]
        diffs = [abs((p - target).total_seconds()) for p in parsed]
        return diffs.index(min(diffs))
    except Exception:
        return 0


def _zero_weather() -> dict:
    return {
        "wind_speed_mph": 0.0,
        "precipitation_in_hr": 0.0,
        "snowfall_in_hr": 0.0,
        "weathercode": 0,
    }


def _extract_at_index(hourly: dict, idx: int) -> dict:
    def _get(key: float, default=0.0):
        arr = hourly.get(key, [])
        val = arr[idx] if idx < len(arr) else None
        return val if val is not None else default

    wind_kmh = _get("windspeed_10m")
    precip_mm = _get("precipitation")
    snow_cm = _get("snowfall")
    wcode = int(_get("weathercode", 0))

    return {
        "wind_speed_mph": round(wind_kmh * KMH_TO_MPH, 2),
        "precipitation_in_hr": round(precip_mm * MM_TO_IN, 4),
        "snowfall_in_hr": round(snow_cm * CM_TO_IN, 4),
        "weathercode": wcode,
    }


# ── Public API ────────────────────────────────────────────────────────────────


def get_checkpoint_weather(lat: float, lon: float, eta_iso: str) -> dict:
    """Fetch weather at (lat, lon) for the hour closest to eta_iso."""
    data = _fetch_open_meteo(lat, lon)
    hourly = _parse_hourly(data)
    if not hourly["time"]:
        return _zero_weather()
    idx = _closest_index(hourly["time"], eta_iso)
    return _extract_at_index(hourly, idx)


def get_route_forecast_48h(lat: float, lon: float, departure_iso: str) -> list[dict]:
    """
    Fetch 0-48hr hourly forecast for the route origin.
    Used by the frontend slider.
    """
    data = _fetch_open_meteo(lat, lon)
    hourly = _parse_hourly(data)
    if not hourly["time"]:
        return []

    dep_idx = _closest_index(hourly["time"], departure_iso)
    result = []
    max_idx = len(hourly["time"]) - 1
    for offset in range(49):
        target_idx = dep_idx + offset
        idx = min(target_idx, max_idx)
        wx = _extract_at_index(hourly, idx)

        if target_idx <= max_idx:
            time_iso = hourly["time"][idx]
        else:
            last_dt = datetime.fromisoformat(hourly["time"][max_idx])
            extrapolated_dt = last_dt + timedelta(hours=(target_idx - max_idx))
            time_iso = extrapolated_dt.strftime("%Y-%m-%dT%H:%M")

        result.append(
            {
                "hour_offset": offset,
                "time_iso": time_iso,
                **wx,
            }
        )
    return result


def enrich_checkpoints_with_weather(checkpoints: list[dict]) -> list[dict]:
    """
    Deduplicate by snapped coordinates, fetch in parallel, and enrich checkpoints.
    """
    if not checkpoints:
        return checkpoints

    coord_groups: dict[tuple[float, float], list[dict]] = {}
    for cp in checkpoints:
        key = (round(cp["lat"], 2), round(cp["lon"], 2))
        coord_groups.setdefault(key, []).append(cp)

    def _fetch_coord(key: tuple[float, float]) -> tuple[tuple[float, float], dict]:
        data = _fetch_open_meteo(key[0], key[1])
        return key, _parse_hourly(data)

    coord_data: dict[tuple[float, float], dict] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(_fetch_coord, k) for k in coord_groups]
        for future in as_completed(futures):
            try:
                key, hourly = future.result()
                coord_data[key] = hourly
            except Exception as exc:
                logger.warning("Coord weather fetch failed: %s", exc)

    for key, cps in coord_groups.items():
        hourly = coord_data.get(key, {})
        has_times = bool(hourly.get("time"))
        for cp in cps:
            if not has_times:
                cp.update(_zero_weather())
            else:
                idx = _closest_index(hourly["time"], cp["eta_iso"])
                cp.update(_extract_at_index(hourly, idx))

    return checkpoints
