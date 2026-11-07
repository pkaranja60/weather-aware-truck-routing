from django.contrib import admin
from .models import RouteQuery, Route, Checkpoint


class RouteInline(admin.TabularInline):
    model = Route
    extra = 0
    fields = (
        "route_id",
        "distance_miles",
        "duration_hours",
        "overall_risk_level",
        "is_recommended",
    )
    readonly_fields = fields


class CheckpointInline(admin.TabularInline):
    model = Checkpoint
    extra = 0
    fields = (
        "index",
        "distance_from_start_miles",
        "lat",
        "lon",
        "risk_level",
        "wind_speed_mph",
    )
    readonly_fields = fields


@admin.register(RouteQuery)
class RouteQueryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "origin",
        "destination",
        "departure_datetime",
        "load_weight_lbs",
        "recommended_route_id",
        "created_at",
    )
    list_filter = ("recommended_route_id",)
    search_fields = ("origin", "destination")
    readonly_fields = ("id", "created_at")
    inlines = [RouteInline]


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = (
        "query",
        "route_id",
        "distance_miles",
        "overall_risk_level",
        "is_recommended",
    )
    list_filter = ("overall_risk_level", "is_recommended")
    inlines = [CheckpointInline]


@admin.register(Checkpoint)
class CheckpointAdmin(admin.ModelAdmin):
    list_display = (
        "route",
        "index",
        "distance_from_start_miles",
        "risk_level",
        "wind_speed_mph",
        "precipitation_in_hr",
    )
    list_filter = ("risk_level",)
