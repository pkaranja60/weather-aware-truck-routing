"""
Weather Service
===============
Fetches hourly weather forecasts from Open-Meteo (free, no API key).

Rate-limit safety (critical on shared hosting like Render):
  - MAX_WORKERS = 2         — 2 concurrent threads max (reduce burst)
  - _fetch_lock + 300ms gap — global serializer; never fires 2 requests
                              closer than 300ms apart → ~3 req/sec ceiling
  - FAIL-FAST on 429        — returns {} immediately, no retry; workers die
                              if retries stack up past Gunicorn's 30s timeout
  - 1 retry on network err  — transient TCP resets still get a second chance
  - Per-request dedup       — coord_groups: round(lat,2) ≈ 1 km grid so the
                              3 route alternatives sharing a corridor only
                              fire once per unique grid cell per request
  - Cross-request cache     — 30-min TTL keyed on round(lat,2)/round(lon,2);
                              successive requests (multiple users, page
                              refreshes) skip Open-Meteo entirely → 0 API calls

Worst-case timing (20 unique cells, all 429 — no cache):
  20 × 300ms = 6s   → well inside Gunicorn 30s worker timeout

Variables fetched per location:
  windspeed_10m   km/h  → mph
  precipitation   mm/hr → in/hr
  snowfall        cm/hr → in/hr
  weathercode     WMO code
"""

from __future__ import annotations

import logging
import threading
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
    "forecast_days": 7,  # 7 days covers departures planned up to a week out
    "timezone": "UTC",
}

# ── Concurrency / retry / cache settings ─────────────────────────────────────

MAX_WORKERS = 2  # 2 threads max — reduces burst on shared IPs
WEATHER_TIMEOUT = 8  # seconds per request (tight — fail fast)
REQUEST_GAP = 0.30  # min seconds between consecutive API calls

# Retry only on network errors (connection reset, DNS, etc.) — NOT on 429.
# Retrying 429 is what killed the Gunicorn worker: 20 coords × 7s retries = 140s.
NET_RETRY_WAIT = 0.5  # one retry, 500ms, for transient TCP errors

CACHE_TTL = 1800  # 30-minute response cache
# Key: (round(lat,2), round(lon,2)) — matches the coord-group snapping below
# Value: (timestamp_stored, raw_json_dict)
_cache: dict[tuple[float, float], tuple[float, dict]] = {}
_cache_lock = threading.Lock()

# Serialises actual HTTP calls so bursts stay ≤ 1/REQUEST_GAP req/sec globally
_fetch_lock = threading.Lock()
_last_fetch_ts = 0.0  # monotonic time of the last outbound request


# ── Cache helpers ─────────────────────────────────────────────────────────────


def _cache_key(lat: float, lon: float) -> tuple[float, float]:
    return (round(lat, 2), round(lon, 2))


def _cache_get(lat: float, lon: float) -> dict | None:
    key = _cache_key(lat, lon)
    with _cache_lock:
        entry = _cache.get(key)
    if entry is None:
        return None
    stored_at, data = entry
    if time.monotonic() - stored_at > CACHE_TTL:
        with _cache_lock:
            _cache.pop(key, None)
        return None
    return data


def _cache_set(lat: float, lon: float, data: dict) -> None:
    key = _cache_key(lat, lon)
    with _cache_lock:
        _cache[key] = (time.monotonic(), data)


# ── Low-level fetch ───────────────────────────────────────────────────────────


def _fetch_open_meteo(lat: float, lon: float) -> dict:
    """
    Fetch raw JSON from Open-Meteo, using the cache when available.

    429 handling: return {} immediately — no retry.
    Retrying 429 on a shared Render IP is fatal: 20 coords × 7s backoff = 140s,
    which kills the Gunicorn worker.  The 30-min cache means the NEXT request
    for the same location is free, so the app self-heals within one retry.

    Network error handling: one retry after 500ms for transient TCP errors.
    """
    global _last_fetch_ts

    cached = _cache_get(lat, lon)
    if cached is not None:
        return cached

    params = {"latitude": lat, "longitude": lon, **HOURLY_PARAMS}

    # ── Enforce minimum gap between outbound HTTP calls ──────────────────────
    # The lock + sleep keeps all threads (across MAX_WORKERS) from firing
    # requests closer than REQUEST_GAP seconds apart.  Cache hits skip this
    # block entirely, so the limiter only applies to actual API calls.
    with _fetch_lock:
        now = time.monotonic()
        elapsed = now - _last_fetch_ts
        if elapsed < REQUEST_GAP:
            time.sleep(REQUEST_GAP - elapsed)
        _last_fetch_ts = time.monotonic()

    for attempt in range(2):  # attempt 0 = first try; attempt 1 = one retry
        try:
            resp = requests.get(
                settings.OPEN_METEO_URL,
                params=params,
                timeout=WEATHER_TIMEOUT,
            )

            if resp.status_code == 429:
                # FAIL FAST — do NOT retry; blocking here causes worker timeout
                logger.warning(
                    "Open-Meteo 429 for (%.2f, %.2f) — returning zero weather "
                    "(cached routes will be unaffected on next request)",
                    lat,
                    lon,
                )
                return {}

            resp.raise_for_status()
            data = resp.json()
            _cache_set(lat, lon, data)
            return data

        except requests.RequestException as exc:
            if attempt == 0:
                # One retry for transient network errors (TCP reset, DNS, etc.)
                logger.warning(
                    "Open-Meteo network error for (%.2f, %.2f): %s — retrying in %.1fs",
                    lat,
                    lon,
                    exc,
                    NET_RETRY_WAIT,
                )
                time.sleep(NET_RETRY_WAIT)
                continue
            logger.warning(
                "Open-Meteo fetch failed for (%.2f, %.2f): %s",
                lat,
                lon,
                exc,
            )
            return {}

    return {}


# ── Parsing helpers ───────────────────────────────────────────────────────────


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
    def _get(key: str, default: float = 0.0):
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
    Fetch 0–48 hr hourly forecast for the route origin.
    Used by the frontend slider. Extrapolates past the forecast window
    by repeating the last available values with synthetic timestamps.
    """
    data = _fetch_open_meteo(lat, lon)
    hourly = _parse_hourly(data)

    if not hourly["time"]:
        dep_clean = departure_iso.replace("Z", "+00:00")
        dep_dt = datetime.fromisoformat(dep_clean)
        return [
            {
                "hour_offset": offset,
                "time_iso": (dep_dt + timedelta(hours=offset)).strftime(
                    "%Y-%m-%dT%H:%M"
                ),
                **_zero_weather(),
            }
            for offset in range(49)
        ]

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
            # Extrapolate timestamps beyond forecast window
            last_dt = datetime.fromisoformat(hourly["time"][max_idx])
            extrapolated_dt = last_dt + timedelta(hours=(target_idx - max_idx))
            time_iso = extrapolated_dt.strftime("%Y-%m-%dT%H:%M")

        result.append({"hour_offset": offset, "time_iso": time_iso, **wx})

    return result


def enrich_checkpoints_with_weather(checkpoints: list[dict]) -> list[dict]:
    """
    Deduplicate checkpoints by snapped coordinates, fetch in parallel,
    then apply weather to every checkpoint.

    Snapping to round(lat,2) / round(lon,2) (~1 km grid) means the three
    route alternatives sharing a corridor only fire once per grid cell,
    cutting API calls by up to 3×.  The cross-request cache (_fetch_open_meteo)
    further eliminates redundant fetches across successive plan_routes calls.
    """
    if not checkpoints:
        return checkpoints

    # Group checkpoints by snapped coordinate key
    coord_groups: dict[tuple[float, float], list[dict]] = {}
    for cp in checkpoints:
        key = (round(cp["lat"], 2), round(cp["lon"], 2))
        coord_groups.setdefault(key, []).append(cp)

    def _fetch_coord(key: tuple[float, float]) -> tuple[tuple[float, float], dict]:
        data = _fetch_open_meteo(key[0], key[1])
        return key, _parse_hourly(data)

    # Parallel fetch — only unique grid cells
    coord_data: dict[tuple[float, float], dict] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(_fetch_coord, k) for k in coord_groups]
        for future in as_completed(futures):
            try:
                key, hourly = future.result()
                coord_data[key] = hourly
            except Exception as exc:
                logger.warning("Coord weather fetch failed: %s", exc)

    # Apply hourly data to every checkpoint in each group
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
