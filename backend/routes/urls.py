from django.urls import path
from . import views

urlpatterns = [
    path("routes/plan/", views.plan_routes_view, name="routes-plan"),
    path("routes/<str:query_id>/", views.get_query_view, name="routes-detail"),
    path("routes/", views.list_queries_view, name="routes-list"),
    path("health/", views.health_check, name="health"),
]
