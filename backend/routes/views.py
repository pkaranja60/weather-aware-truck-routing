import logging

from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework import status

from .models import RouteQuery, Route, Checkpoint
from .serializers import (
    RoutePlanRequestSerializer,
    RouteQuerySerializer,
    RouteQueryListSerializer,
)
from .services.routing import get_routes
from .services.weather import enrich_checkpoints_with_weather, get_route_forecast_48h
from .services.risk_calculator import (
    enrich_checkpoints_with_risk,
    route_overall_risk,
    pick_recommended_route,
)

logger = logging.getLogger(__name__)


# ── DB persistence ─────────────────────────────────────────────────────────────


def _save_query(
    validated_data: dict, routing_result: dict, routes_with_risk: list
) -> RouteQuery:
    """
    Persist RouteQuery + Route + Checkpoint rows.
    Returns the saved RouteQuery.
    """
    origin_geo = routing_result["origin"]
    dest_geo = routing_result["destination"]
    rec_id = pick_recommended_route(routes_with_risk)

    query = RouteQuery.objects.create(
        origin=validated_data["origin"],
        destination=validated_data["destination"],
        origin_display=origin_geo.get("display_name", ""),
        destination_display=dest_geo.get("display_name", ""),
        origin_lat=origin_geo["lat"],
        origin_lon=origin_geo["lon"],
        destination_lat=dest_geo["lat"],
        destination_lon=dest_geo["lon"],
        departure_datetime=validated_data["departure_datetime"],
        load_weight_lbs=validated_data.get("load_weight_lbs", 0.0),
        checkpoint_interval=validated_data.get("checkpoint_interval", 25),
        recommended_route_id=rec_id,
    )

    for r in routes_with_risk:
        # 0-48hr forecast for this route's origin point
        forecast = get_route_forecast_48h(
            origin_geo["lat"],
            origin_geo["lon"],
            validated_data["departure_datetime"].isoformat(),
        )

        route_obj = Route.objects.create(
            query=query,
            route_id=r["route_id"],
            distance_miles=r["distance_miles"],
            duration_hours=r["duration_hours"],
            geometry=r["geometry"],
            overall_risk_level=r["overall_risk_level"],
            is_recommended=(r["route_id"] == rec_id),
            forecast_48h=forecast,
        )

        cp_objs = []
        for idx, cp in enumerate(r["checkpoints"]):
            cp_objs.append(
                Checkpoint(
                    route=route_obj,
                    index=idx,
                    distance_from_start_miles=cp["distance_from_start_miles"],
                    distance_to_end_miles=cp["distance_to_end_miles"],
                    lat=cp["lat"],
                    lon=cp["lon"],
                    eta_iso=cp["eta_iso"],
                    hours_from_departure=cp["hours_from_departure"],
                    wind_speed_mph=cp.get("wind_speed_mph", 0.0),
                    precipitation_in_hr=cp.get("precipitation_in_hr", 0.0),
                    snowfall_in_hr=cp.get("snowfall_in_hr", 0.0),
                    weathercode=cp.get("weathercode", 0),
                    wind_risk=cp.get("wind_risk", "Low"),
                    rain_risk=cp.get("rain_risk", "Low"),
                    snow_risk=cp.get("snow_risk", "Low"),
                    risk_level=cp.get("risk_level", "Low"),
                )
            )
        Checkpoint.objects.bulk_create(cp_objs)

    return query


# ── Views ──────────────────────────────────────────────────────────────────────


@api_view(["POST"])
def plan_routes_view(request: Request) -> Response:
    """
    POST /api/routes/plan/

    Body:
        origin              : str
        destination         : str
        departure_datetime  : ISO 8601
        load_weight_lbs     : float  (optional, default 0)
        checkpoint_interval : 10|25|50  (optional, default 25)

    Returns up to 3 route alternatives with weather + risk per checkpoint.
    """
    serializer = RoutePlanRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"success": False, "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = serializer.validated_data

    # 1. Geocode + build routes with checkpoints
    try:
        routing_result = get_routes(
            origin=data["origin"],
            destination=data["destination"],
            departure_dt=data["departure_datetime"],
            checkpoint_interval=data.get("checkpoint_interval", 25),
        )
    except ValueError as exc:
        logger.warning("Routing failed: %s", exc)
        return Response(
            {"success": False, "error": str(exc)},
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    load_lbs = data.get("load_weight_lbs", 0.0)

    # 2. Enrich every route's checkpoints with weather + risk
    for route in routing_result["routes"]:
        enrich_checkpoints_with_weather(route["checkpoints"])
        enrich_checkpoints_with_risk(route["checkpoints"], load_weight_lbs=load_lbs)
        route["overall_risk_level"] = route_overall_risk(route["checkpoints"])

    # 3. Persist to DB
    try:
        query_obj = _save_query(data, routing_result, routing_result["routes"])
    except Exception as exc:
        logger.exception("DB save error")
        return Response(
            {"success": False, "error": f"Failed to save query: {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # 4. Reload from DB and return full serialized response
    query_obj_full = RouteQuery.objects.prefetch_related("routes__checkpoints").get(
        id=query_obj.id
    )

    return Response(
        {"success": True, **RouteQuerySerializer(query_obj_full).data},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def get_query_view(request: Request, query_id: str) -> Response:
    """
    GET /api/routes/<query_id>/
    Retrieve a saved route query with all routes and checkpoints.
    """
    try:
        query = RouteQuery.objects.prefetch_related("routes__checkpoints").get(
            id=query_id
        )
    except RouteQuery.DoesNotExist:
        return Response(
            {"success": False, "error": "Query not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({"success": True, **RouteQuerySerializer(query).data})


@api_view(["GET"])
def list_queries_view(request: Request) -> Response:
    """
    GET /api/routes/
    List recent route queries (most recent first, limit 20).
    """
    queries = RouteQuery.objects.all()[:20]
    return Response(
        {
            "success": True,
            "queries": RouteQueryListSerializer(queries, many=True).data,
        }
    )


@api_view(["GET"])
def health_check(request: Request) -> Response:
    return Response({"status": "ok", "service": "Route Planner API"})
