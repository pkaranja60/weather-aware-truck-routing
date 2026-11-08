"""
Weather Service
===============
Fetches hourly weather forecasts from Open-Meteo (free, no API key).

All checkpoint weather calls are made in PARALLEL using ThreadPoolExecutor
so 37 checkpoints take ~3 seconds instead of ~37 × 15 seconds.

Variables fetched per location:
  windspeed_10m   km/h  → mph
  precipitation   mm/hr → in/hr
  snowfall        cm/hr → in/hr
  weathercode     WMO code
"""

from __future__ import annotations

import logging
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
    "forecast_days": 16,
    "timezone": "UTC",
}

# Max parallel weather requests — keeps Open-Meteo happy
MAX_WORKERS = 8
# Per-request timeout — shorter to fail fast rather than block forever
WEATHER_TIMEOUT = 10


# ── Helpers ───────────────────────────────────────────────────────────────────


def _fetch_open_meteo(lat: float, lon: float) -> dict:
    params = {"latitude": lat, "longitude": lon, **HOURLY_PARAMS}
    try:
        resp = requests.get(
            settings.OPEN_METEO_URL,
            params=params,
            timeout=WEATHER_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.warning("Open-Meteo fetch failed for (%s, %s): %s", lat, lon, exc)
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
    Fetch weather for every checkpoint IN PARALLEL.
    Falls back to zero-weather on any timeout/error so the route still returns.
    """
    if not checkpoints:
        return checkpoints

    def _fetch_one(idx: int, cp: dict) -> tuple[int, dict]:
        wx = get_checkpoint_weather(cp["lat"], cp["lon"], cp["eta_iso"])
        return idx, wx

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(_fetch_one, i, cp): i for i, cp in enumerate(checkpoints)
        }
        for future in as_completed(futures):
            try:
                idx, wx = future.result()
                checkpoints[idx].update(wx)
            except Exception as exc:
                i = futures[future]
                logger.warning("Weather fetch failed for checkpoint %d: %s", i, exc)
                checkpoints[i].update(_zero_weather())

    return checkpoints
