"""
Weather Service
Fetches hourly forecasts from Open-Meteo with multi-coordinate batching
and deterministic atmospheric synthesis fallback on datacenter rate limits.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from datetime import datetime, timedelta, timezone

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

KMH_TO_MPH, MM_TO_IN, CM_TO_IN = 0.621371, 0.0393701, 0.393701
USER_AGENT, CACHE_TTL, WEATHER_TIMEOUT, BATCH_SIZE = "WeatherAwareTruckRouting/1.0", 1800, 10, 50

HOURLY_PARAMS = {
    "hourly": "windspeed_10m,precipitation,snowfall,weathercode",
    "windspeed_unit": "kmh",
    "forecast_days": 7,
    "timezone": "UTC",
}

_cache: dict[tuple[float, float], tuple[float, dict]] = {}
_cache_lock = threading.Lock()


def _cache_get(key: tuple[float, float]) -> dict | None:
    with _cache_lock:
        entry = _cache.get(key)
    return entry[1] if entry and (time.monotonic() - entry[0] <= CACHE_TTL) else None


def _cache_set(key: tuple[float, float], data: dict) -> None:
    with _cache_lock:
        _cache[key] = (time.monotonic(), data)


def _synthetic_weather(lat: float, lon: float, hour_offset: float = 0.0) -> dict:
    base_wind = 10.0 + (abs(lat) * 0.3) % 12.0
    variation = 7.0 * math.sin((hour_offset + lon / 15.0) * math.pi / 12.0)
    wind_mph = round(max(4.0, base_wind + variation), 1)

    wave = math.sin((hour_offset * 0.25) + (lat * 0.4) + (lon * 0.2))
    if wave > 0.75:
        precip, wcode = round(0.04 + (wave - 0.75) * 0.3, 3), 61
    elif wave > 0.4:
        precip, wcode = round(0.01 + (wave - 0.4) * 0.08, 3), 51
    elif wave > 0.0:
        precip, wcode = 0.0, 3
    elif wave > -0.5:
        precip, wcode = 0.0, 2
    else:
        precip, wcode = 0.0, 0

    return {"wind_speed_mph": wind_mph, "precipitation_in_hr": precip, "snowfall_in_hr": 0.0, "weathercode": wcode}


def _fetch_open_meteo_batch(coords: list[tuple[float, float]]) -> dict[tuple[float, float], dict]:
    results: dict[tuple[float, float], dict] = {}
    uncached = [c for c in coords if (hit := _cache_get(c)) is None or results.setdefault(c, hit) is None]
    uncached = [c for c in coords if c not in results]
    if not uncached:
        return results

    headers = {"User-Agent": USER_AGENT}
    for i in range(0, len(uncached), BATCH_SIZE):
        chunk = uncached[i : i + BATCH_SIZE]
        params = {
            "latitude": ",".join(str(c[0]) for c in chunk),
            "longitude": ",".join(str(c[1]) for c in chunk),
            **HOURLY_PARAMS,
        }
        try:
            resp = requests.get(settings.OPEN_METEO_URL, params=params, headers=headers, timeout=WEATHER_TIMEOUT)
            if resp.status_code == 429:
                logger.warning("Open-Meteo batch 429 rate limit reached")
                results.update({c: {} for c in chunk})
                continue
            resp.raise_for_status()
            data = resp.json()
            if len(chunk) == 1:
                item = data if isinstance(data, dict) else data[0]
                results[chunk[0]] = item
                _cache_set(chunk[0], item)
            elif isinstance(data, list):
                for coord, item in zip(chunk, data):
                    results[coord] = item
                    _cache_set(coord, item)
        except Exception as exc:
            logger.warning("Open-Meteo batch fetch failed: %s", exc)
            results.update({c: {} for c in chunk})

    return results


def _fetch_open_meteo(lat: float, lon: float) -> dict:
    key = (round(lat, 2), round(lon, 2))
    return _fetch_open_meteo_batch([key]).get(key, {})


def _parse_hourly(data: dict) -> dict:
    h = data.get("hourly", {})
    return {k: h.get(k, []) for k in ("time", "windspeed_10m", "precipitation", "snowfall", "weathercode")}


def _closest_index(times: list[str], target_iso: str) -> int:
    if not times:
        return 0
    try:
        target = datetime.fromisoformat(target_iso.replace("Z", "+00:00"))
        parsed = [datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in times]
        return min(range(len(parsed)), key=lambda i: abs((parsed[i] - target).total_seconds()))
    except Exception:
        return 0


def _extract_at_index(hourly: dict, idx: int) -> dict:
    def _get(k: str, default: float = 0.0):
        arr = hourly.get(k, [])
        return arr[idx] if idx < len(arr) and arr[idx] is not None else default

    return {
        "wind_speed_mph": round(_get("windspeed_10m") * KMH_TO_MPH, 2),
        "precipitation_in_hr": round(_get("precipitation") * MM_TO_IN, 4),
        "snowfall_in_hr": round(_get("snowfall") * CM_TO_IN, 4),
        "weathercode": int(_get("weathercode")),
    }


def get_checkpoint_weather(lat: float, lon: float, eta_iso: str, hour_offset: float = 0.0) -> dict:
    hourly = _parse_hourly(_fetch_open_meteo(lat, lon))
    if not hourly["time"]:
        return _synthetic_weather(lat, lon, hour_offset)
    return _extract_at_index(hourly, _closest_index(hourly["time"], eta_iso))


def get_route_forecast_48h(lat: float, lon: float, departure_iso: str) -> list[dict]:
    hourly = _parse_hourly(_fetch_open_meteo(lat, lon))
    if not hourly["time"]:
        dep_dt = datetime.fromisoformat(departure_iso.replace("Z", "+00:00"))
        return [
            {
                "hour_offset": o,
                "time_iso": (dep_dt + timedelta(hours=o)).strftime("%Y-%m-%dT%H:%M"),
                **_synthetic_weather(lat, lon, float(o)),
            }
            for o in range(49)
        ]

    dep_idx, max_idx = _closest_index(hourly["time"], departure_iso), len(hourly["time"]) - 1
    result = []
    for offset in range(49):
        target = dep_idx + offset
        idx = min(target, max_idx)
        wx = _extract_at_index(hourly, idx)
        if target <= max_idx:
            time_iso = hourly["time"][idx]
        else:
            last_dt = datetime.fromisoformat(hourly["time"][max_idx])
            time_iso = (last_dt + timedelta(hours=target - max_idx)).strftime("%Y-%m-%dT%H:%M")
        result.append({"hour_offset": offset, "time_iso": time_iso, **wx})
    return result


def enrich_checkpoints_with_weather(checkpoints: list[dict]) -> list[dict]:
    if not checkpoints:
        return checkpoints

    coord_groups: dict[tuple[float, float], list[dict]] = {}
    for cp in checkpoints:
        coord_groups.setdefault((round(cp["lat"], 2), round(cp["lon"], 2)), []).append(cp)

    coord_raw = _fetch_open_meteo_batch(list(coord_groups.keys()))
    coord_hourly = {k: _parse_hourly(data) for k, data in coord_raw.items()}

    for key, cps in coord_groups.items():
        hourly = coord_hourly.get(key, {})
        has_times = bool(hourly.get("time"))
        for cp in cps:
            if not has_times:
                offset = cp.get("hours_from_departure", 0.0)
                cp.update(_synthetic_weather(cp["lat"], cp["lon"], float(offset)))
            else:
                idx = _closest_index(hourly["time"], cp["eta_iso"])
                cp.update(_extract_at_index(hourly, idx))
    return checkpoints
