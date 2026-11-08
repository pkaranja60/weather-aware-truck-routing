"""
Geocoding Service
Provides multi-tiered geocoding resolution:
1. In-memory TTL cache
2. OpenStreetMap Nominatim (primary)
3. Komoot Photon API (secondary fallback on 429 / datacenter IP block)
4. Static freight hub dictionary (offline safety net)
"""

from __future__ import annotations

import logging
import threading
import time
from typing import TypedDict

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 86400  # 24 hours
USER_AGENT = "WeatherAwareTruckRouting/1.0"
PHOTON_URL = "https://photon.komoot.io/api/"

KNOWN_HUBS: dict[str, tuple[float, float, str]] = {
    "london": (51.5074, -0.1278, "London, England, United Kingdom"),
    "copenhagen": (55.6761, 12.5683, "Copenhagen, Denmark"),
    "chicago": (41.8781, -87.6298, "Chicago, IL, United States"),
    "denver": (39.7392, -104.9903, "Denver, CO, United States"),
    "new york": (40.7128, -74.0060, "New York, NY, United States"),
    "los angeles": (34.0522, -118.2437, "Los Angeles, CA, United States"),
    "berlin": (52.5200, 13.4050, "Berlin, Germany"),
    "paris": (48.8566, 2.3522, "Paris, France"),
    "amsterdam": (52.3676, 4.9041, "Amsterdam, Netherlands"),
    "hamburg": (53.5511, 9.9937, "Hamburg, Germany"),
    "rotterdam": (51.9244, 4.4777, "Rotterdam, Netherlands"),
}


class GeocodeResult(TypedDict):
    lat: float
    lon: float
    display_name: str


_cache: dict[str, tuple[float, GeocodeResult]] = {}
_cache_lock = threading.Lock()


def _get_from_cache(norm_address: str) -> GeocodeResult | None:
    with _cache_lock:
        entry = _cache.get(norm_address)
    if not entry:
        return None
    stored_at, result = entry
    if time.monotonic() - stored_at > CACHE_TTL_SECONDS:
        with _cache_lock:
            _cache.pop(norm_address, None)
        return None
    return result


def _set_cache(norm_address: str, result: GeocodeResult) -> None:
    with _cache_lock:
        _cache[norm_address] = (time.monotonic(), result)


def _query_nominatim(address: str) -> GeocodeResult | None:
    headers = {"User-Agent": getattr(settings, "NOMINATIM_USER_AGENT", USER_AGENT)}
    params = {"q": address, "format": "json", "limit": 1}
    resp = requests.get(
        settings.NOMINATIM_URL, params=params, headers=headers, timeout=5
    )
    if resp.status_code == 429:
        logger.warning("Nominatim rate limit (429) for '%s'", address)
        return None
    resp.raise_for_status()
    results = resp.json()
    if not results:
        return None
    top = results[0]
    return {
        "lat": float(top["lat"]),
        "lon": float(top["lon"]),
        "display_name": top.get("display_name", address),
    }


def _query_photon(address: str) -> GeocodeResult | None:
    headers = {"User-Agent": USER_AGENT}
    params = {"q": address, "limit": 1}
    resp = requests.get(PHOTON_URL, params=params, headers=headers, timeout=5)
    resp.raise_for_status()
    data = resp.json()
    features = data.get("features", [])
    if not features:
        return None
    feat = features[0]
    coords = feat.get("geometry", {}).get("coordinates", [])
    if len(coords) < 2:
        return None
    props = feat.get("properties", {})
    name = props.get("name", address)
    country = props.get("country", "")
    display = f"{name}, {country}" if country else name
    return {
        "lat": float(coords[1]),
        "lon": float(coords[0]),
        "display_name": display,
    }


def _match_known_hub(norm_address: str) -> GeocodeResult | None:
    for hub, (lat, lon, display) in KNOWN_HUBS.items():
        if hub in norm_address:
            return {"lat": lat, "lon": lon, "display_name": display}
    return None


def geocode(address: str) -> GeocodeResult:
    """
    Geocode an address string with caching, primary provider, and fallbacks.
    Raises ValueError if all resolution attempts fail.
    """
    clean_address = address.strip()
    norm = clean_address.lower()

    cached = _get_from_cache(norm)
    if cached:
        return cached

    # 1. Try Nominatim (Primary)
    try:
        res = _query_nominatim(clean_address)
        if res:
            _set_cache(norm, res)
            return res
    except Exception as exc:
        logger.info("Nominatim geocoding failed for '%s': %s", clean_address, exc)

    # 2. Try Photon API (Fallback)
    try:
        res = _query_photon(clean_address)
        if res:
            logger.info("Resolved '%s' via Photon fallback", clean_address)
            _set_cache(norm, res)
            return res
    except Exception as exc:
        logger.warning("Photon fallback failed for '%s': %s", clean_address, exc)

    # 3. Known freight hub fallback
    hub_res = _match_known_hub(norm)
    if hub_res:
        logger.info("Resolved '%s' via known hub catalog", clean_address)
        _set_cache(norm, hub_res)
        return hub_res

    raise ValueError(
        f"Could not locate '{address}'. Please specify city and country/state."
    )
