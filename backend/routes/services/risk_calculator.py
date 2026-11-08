"""
Risk Calculator
===============
Converts raw weather readings into a 5-level risk label for each checkpoint.

Risk levels (ordered low → high):
    Low | Moderate | High | Severe | No Travel

Thresholds per hazard
─────────────────────
Wind (mph):
    Low       < 25
    Moderate  25 – 34
    High      35 – 44
    Severe    45 – 54
    No Travel ≥ 55

Rain (in/hr):
    Low       < 0.10
    Moderate  0.10 – 0.25
    High      0.25 – 0.50
    Severe    0.50 – 1.00
    No Travel > 1.00

Snow (in/hr):
    Low       < 0.50
    Moderate  0.50 – 1.00
    High      1.00 – 2.00
    Severe    2.00 – 3.00
    No Travel > 3.00

Overall risk = MAX(wind_risk, rain_risk, snow_risk)

Load-weight adjustments (applied AFTER base risk)
──────────────────────────────────────────────────
  wind 45-54 mph  AND  load > 30,000 lb  →  No Travel
  wind 35-44 mph  AND  load > 40,000 lb  →  Severe   (if current level is High)
"""

from __future__ import annotations

LEVELS = ["Low", "Moderate", "High", "Severe", "No Travel"]


def _level_index(level: str) -> int:
    try:
        return LEVELS.index(level)
    except ValueError:
        return 0


def _max_level(*levels: str) -> str:
    return LEVELS[max(_level_index(l) for l in levels)]


# ── per-hazard risk ────────────────────────────────────────────────────────────


def wind_risk(wind_mph: float) -> str:
    if wind_mph >= 55:
        return "No Travel"
    if wind_mph >= 45:
        return "Severe"
    if wind_mph >= 35:
        return "High"
    if wind_mph >= 25:
        return "Moderate"
    return "Low"


def rain_risk(precip_in_hr: float) -> str:
    if precip_in_hr > 1.00:
        return "No Travel"
    if precip_in_hr >= 0.50:
        return "Severe"
    if precip_in_hr >= 0.25:
        return "High"
    if precip_in_hr >= 0.10:
        return "Moderate"
    return "Low"


def snow_risk(snow_in_hr: float) -> str:
    if snow_in_hr > 3.00:
        return "No Travel"
    if snow_in_hr >= 2.00:
        return "Severe"
    if snow_in_hr >= 1.00:
        return "High"
    if snow_in_hr >= 0.50:
        return "Moderate"
    return "Low"


# ── combined risk ──────────────────────────────────────────────────────────────


def calculate_risk(
    wind_mph: float,
    precip_in_hr: float,
    snow_in_hr: float,
    load_weight_lbs: float = 0.0,
) -> dict:
    """
    Returns:
        {
          "wind_risk":    str,
          "rain_risk":    str,
          "snow_risk":    str,
          "overall_risk": str,   # max of the three, after load adjustment
        }
    """
    wr = wind_risk(wind_mph)
    rr = rain_risk(precip_in_hr)
    sr = snow_risk(snow_in_hr)

    overall = _max_level(wr, rr, sr)

    # Load-weight adjustments on overall (wind-driven)
    if load_weight_lbs > 0:
        # 45-54 mph wind + > 30 000 lb → No Travel
        if 45 <= wind_mph < 55 and load_weight_lbs > 30_000:
            overall = "No Travel"
        # 35-44 mph wind + > 40 000 lb → at least Severe
        elif 35 <= wind_mph < 45 and load_weight_lbs > 40_000:
            if _level_index(overall) < _level_index("Severe"):
                overall = "Severe"

    return {
        "wind_risk": wr,
        "rain_risk": rr,
        "snow_risk": sr,
        "overall_risk": overall,
    }


def enrich_checkpoints_with_risk(
    checkpoints: list[dict],
    load_weight_lbs: float = 0.0,
) -> list[dict]:
    """
    Adds risk fields to each checkpoint dict (must already have
    wind_speed_mph, precipitation_in_hr, snowfall_in_hr).
    """
    for cp in checkpoints:
        risk = calculate_risk(
            wind_mph=cp.get("wind_speed_mph", 0.0),
            precip_in_hr=cp.get("precipitation_in_hr", 0.0),
            snow_in_hr=cp.get("snowfall_in_hr", 0.0),
            load_weight_lbs=load_weight_lbs,
        )
        cp["wind_risk"] = risk["wind_risk"]
        cp["rain_risk"] = risk["rain_risk"]
        cp["snow_risk"] = risk["snow_risk"]
        cp["risk_level"] = risk["overall_risk"]
    return checkpoints


def route_overall_risk(checkpoints: list[dict]) -> str:
    """
    Returns the worst risk_level across all checkpoints on a route.
    Treats missing risk_level as Low.
    """
    if not checkpoints:
        return "Low"
    return _max_level(*(cp.get("risk_level", "Low") for cp in checkpoints))


def pick_recommended_route(routes: list[dict]) -> int:
    """
    Given a list of route dicts, return the route_id of the recommended route:
      1. Fewest Severe miles / checkpoints
      2. Fewest High miles / checkpoints
      3. Lowest average risk score
      4. Shortest travel time (duration_hours)
    """

    def sort_key(r: dict):
        cps = r.get("checkpoints", [])
        severe_count = sum(1 for cp in cps if cp.get("risk_level") == "Severe")
        high_count = sum(1 for cp in cps if cp.get("risk_level") == "High")
        avg_risk = (
            sum(_level_index(cp.get("risk_level", "Low")) for cp in cps) / len(cps)
            if cps
            else 0.0
        )
        return (severe_count, high_count, avg_risk, r.get("duration_hours", 0.0))

    best = min(routes, key=sort_key)
    return best["route_id"]
