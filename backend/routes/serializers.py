from rest_framework import serializers
from .models import RouteQuery, Route, Checkpoint


class RoutePlanRequestSerializer(serializers.Serializer):
    """Validates the POST body for /api/routes/plan/"""

    origin = serializers.CharField(max_length=300)
    destination = serializers.CharField(max_length=300)
    departure_datetime = serializers.DateTimeField()
    load_weight_lbs = serializers.FloatField(min_value=0.0, default=0.0)
    checkpoint_interval = serializers.ChoiceField(choices=[10, 25, 50], default=25)

    def validate(self, attrs):
        if attrs["origin"].strip().lower() == attrs["destination"].strip().lower():
            raise serializers.ValidationError(
                "Origin and destination cannot be the same."
            )
        return attrs


class CheckpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = Checkpoint
        fields = [
            "index",
            "distance_from_start_miles",
            "distance_to_end_miles",
            "lat",
            "lon",
            "eta_iso",
            "hours_from_departure",
            "wind_speed_mph",
            "precipitation_in_hr",
            "snowfall_in_hr",
            "weathercode",
            "wind_risk",
            "rain_risk",
            "snow_risk",
            "risk_level",
        ]


class RouteSerializer(serializers.ModelSerializer):
    checkpoints = CheckpointSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = [
            "route_id",
            "distance_miles",
            "duration_hours",
            "geometry",
            "overall_risk_level",
            "is_recommended",
            "forecast_48h",
            "checkpoints",
        ]


class RouteQuerySerializer(serializers.ModelSerializer):
    routes = RouteSerializer(many=True, read_only=True)

    class Meta:
        model = RouteQuery
        fields = [
            "id",
            "origin",
            "destination",
            "origin_display",
            "destination_display",
            "origin_lat",
            "origin_lon",
            "destination_lat",
            "destination_lon",
            "departure_datetime",
            "load_weight_lbs",
            "checkpoint_interval",
            "recommended_route_id",
            "created_at",
            "routes",
        ]


class RouteQueryListSerializer(serializers.ModelSerializer):
    """Lightweight list view — no nested routes."""

    class Meta:
        model = RouteQuery
        fields = [
            "id",
            "origin",
            "destination",
            "departure_datetime",
            "load_weight_lbs",
            "recommended_route_id",
            "created_at",
        ]
