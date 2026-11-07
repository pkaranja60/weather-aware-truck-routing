import uuid
from django.db import models


class RouteQuery(models.Model):
    """
    One user request: origin → destination with departure time + load weight.
    Parent of all Route objects returned for that request.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    origin = models.CharField(max_length=300)
    destination = models.CharField(max_length=300)
    origin_display = models.CharField(max_length=500, blank=True)
    destination_display = models.CharField(max_length=500, blank=True)
    origin_lat = models.FloatField(null=True, blank=True)
    origin_lon = models.FloatField(null=True, blank=True)
    destination_lat = models.FloatField(null=True, blank=True)
    destination_lon = models.FloatField(null=True, blank=True)
    departure_datetime = models.DateTimeField()
    load_weight_lbs = models.FloatField(default=0.0)
    recommended_route_id = models.IntegerField(null=True, blank=True)  # 1, 2, or 3
    checkpoint_interval = models.IntegerField(default=25)  # miles
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.origin} → {self.destination} ({self.departure_datetime:%Y-%m-%d})"
        )


class Route(models.Model):
    """
    One OSRM route alternative (up to 3 per RouteQuery).
    Stores geometry and the computed worst-case risk level.
    """

    RISK_CHOICES = [
        ("Low", "Low"),
        ("Moderate", "Moderate"),
        ("High", "High"),
        ("Severe", "Severe"),
        ("No Travel", "No Travel"),
    ]

    query = models.ForeignKey(
        RouteQuery, on_delete=models.CASCADE, related_name="routes"
    )
    route_id = models.IntegerField()  # 1 / 2 / 3
    distance_miles = models.FloatField()
    duration_hours = models.FloatField()
    geometry = models.JSONField()  # GeoJSON LineString
    overall_risk_level = models.CharField(
        max_length=20, choices=RISK_CHOICES, default="Low"
    )
    is_recommended = models.BooleanField(default=False)
    # 0-48hr forecast slices for the route's origin (used by slider)
    forecast_48h = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = [("query", "route_id")]
        ordering = ["route_id"]

    def __str__(self):
        return f"Route {self.route_id} – {self.distance_miles:.0f} mi – {self.overall_risk_level}"


class Checkpoint(models.Model):
    """
    A sampled point along a Route with its weather reading and risk level.
    """

    RISK_CHOICES = Route.RISK_CHOICES

    route = models.ForeignKey(
        Route, on_delete=models.CASCADE, related_name="checkpoints"
    )
    index = models.IntegerField()
    distance_from_start_miles = models.FloatField()
    distance_to_end_miles = models.FloatField()
    lat = models.FloatField()
    lon = models.FloatField()
    eta_iso = models.CharField(max_length=50)
    hours_from_departure = models.FloatField()

    # Weather at ETA
    wind_speed_mph = models.FloatField(default=0.0)
    precipitation_in_hr = models.FloatField(default=0.0)
    snowfall_in_hr = models.FloatField(default=0.0)
    weathercode = models.IntegerField(default=0)

    # Risk
    wind_risk = models.CharField(max_length=20, choices=RISK_CHOICES, default="Low")
    rain_risk = models.CharField(max_length=20, choices=RISK_CHOICES, default="Low")
    snow_risk = models.CharField(max_length=20, choices=RISK_CHOICES, default="Low")
    risk_level = models.CharField(max_length=20, choices=RISK_CHOICES, default="Low")

    class Meta:
        ordering = ["route", "index"]

    def __str__(self):
        return f"Checkpoint {self.index} @ {self.distance_from_start_miles:.0f} mi – {self.risk_level}"
