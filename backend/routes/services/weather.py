"""
Weather Service
===============
Fetches hourly weather forecasts from Open-Meteo (free, no API key).

For each checkpoint we request:
  - windspeed_10m          (km/h  → converted to mph)
  - precipitation           (mm/hr → converted to in/hr)
  - snowfall                (cm/hr → converted to in/hr)
  - weathercode

We also fetch the full 0-48hr forecast for the route origin so the
frontend slider can animate risk across time.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

KMH_TO_MPH = 0.621371
MM_TO_IN = 0.0393701  # mm → inches
CM_TO_IN = 0.393701  # cm → inches

FORECAST_VARS = "windspeed_10m,precipitation,snowfall,weathercode"
HOURLY_PARAMS = {
    "hourly": FORECAST_VARS,
    "windspeed_unit": "kmh",
    "forecast_days": 3,  # gives 72 hrs, we slice to 0-48
    "timezone": "UTC",
}


# ── helpers ───────────────────────────────────────────────────────────────────


def _fetch_open_meteo(lat: float, lon: float, extra: dict | None = None) -> dict:
    params = {"latitude": lat, "longitude": lon, **HOURLY_PARAMS}
    if extra:
        params.update(extra)
    try:
        resp = requests.get(
            settings.OPEN_METEO_URL,
            params=params,
            timeout=15,
            verify=settings.CA_BUNDLE if hasattr(settings, "CA_BUNDLE") else True,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.warning("Open-Meteo fetch failed for (%s, %s): %s", lat, lon, exc)
        return {}


def _parse_hourly(data: dict) -> dict[str, list]:
    """Return {time, windspeed_10m, precipitation, snowfall, weathercode} arrays."""
    h = data.get("hourly", {})
    return {
        "time": h.get("time", []),
        "windspeed_10m": h.get("windspeed_10m", []),
        "precipitation": h.get("precipitation", []),
        "snowfall": h.get("snowfall", []),
        "weathercode": h.get("weathercode", []),
    }


def _closest_hour_index(times: list[str], target_iso: str) -> int:
    """Return the index in `times` whose hour is closest to `target_iso`."""
    if not times:
        return 0
    try:
        target = datetime.fromisoformat(target_iso.replace("Z", "+00:00"))
        # Open-Meteo times look like "2026-11-07T14:00" (no tz → assume UTC)
        parsed = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]
        diffs = [abs((p - target).total_seconds()) for p in parsed]
        return diffs.index(min(diffs))
    except Exception:
        return 0


# ── public API ────────────────────────────────────────────────────────────────


def get_checkpoint_weather(lat: float, lon: float, eta_iso: str) -> dict:
    """
    Fetch weather at (lat, lon) for the hour closest to eta_iso.

    Returns:
        {
          "wind_speed_mph":       float,
          "precipitation_in_hr":  float,
          "snowfall_in_hr":       float,
          "weathercode":          int,
        }
    """
    data = _fetch_open_meteo(lat, lon)
    hourly = _parse_hourly(data)

    if not hourly["time"]:
        return {
            "wind_speed_mph": 0.0,
            "precipitation_in_hr": 0.0,
            "snowfall_in_hr": 0.0,
            "weathercode": 0,
        }

    idx = _closest_hour_index(hourly["time"], eta_iso)

    wind_kmh = (
        (hourly["windspeed_10m"][idx] or 0.0)
        if idx < len(hourly["windspeed_10m"])
        else 0.0
    )
    precip_mm = (
        (hourly["precipitation"][idx] or 0.0)
        if idx < len(hourly["precipitation"])
        else 0.0
    )
    snow_cm = (hourly["snowfall"][idx] or 0.0) if idx < len(hourly["snowfall"]) else 0.0
    wcode = (hourly["weathercode"][idx] or 0) if idx < len(hourly["weathercode"]) else 0

    return {
        "wind_speed_mph": round(wind_kmh * KMH_TO_MPH, 2),
        "precipitation_in_hr": round(precip_mm * MM_TO_IN, 4),
        "snowfall_in_hr": round(snow_cm * CM_TO_IN, 4),
        "weathercode": int(wcode),
    }


def get_route_forecast_48h(lat: float, lon: float, departure_iso: str) -> list[dict]:
    """
    Fetch the 0-48hr forecast for a single (lat, lon) point (route origin).
    Used by the frontend slider.

    Returns list of up to 49 hourly dicts:
        [{hour_offset, time_iso, wind_speed_mph, precipitation_in_hr, snowfall_in_hr, weathercode}]
    """
    data = _fetch_open_meteo(lat, lon)
    hourly = _parse_hourly(data)

    if not hourly["time"]:
        return []

    # Find departure index
    dep_idx = _closest_hour_index(hourly["time"], departure_iso)

    result = []
    for offset in range(49):
        idx = dep_idx + offset
        if idx >= len(hourly["time"]):
            break
        wind_kmh = hourly["windspeed_10m"][idx] or 0.0
        precip_mm = hourly["precipitation"][idx] or 0.0
        snow_cm = hourly["snowfall"][idx] or 0.0
        wcode = hourly["weathercode"][idx] or 0

        result.append(
            {
                "hour_offset": offset,
                "time_iso": hourly["time"][idx],
                "wind_speed_mph": round(wind_kmh * KMH_TO_MPH, 2),
                "precipitation_in_hr": round(precip_mm * MM_TO_IN, 4),
                "snowfall_in_hr": round(snow_cm * CM_TO_IN, 4),
                "weathercode": int(wcode),
            }
        )

    return result


def enrich_checkpoints_with_weather(checkpoints: list[dict]) -> list[dict]:
    """
    For each checkpoint dict (must have lat, lon, eta_iso), fetch weather
    and merge it in-place. Returns the enriched list.
    """
    for cp in checkpoints:
        wx = get_checkpoint_weather(cp["lat"], cp["lon"], cp["eta_iso"])
        cp.update(wx)
    return checkpoints
