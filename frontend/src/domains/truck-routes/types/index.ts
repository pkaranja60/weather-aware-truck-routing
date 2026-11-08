export type RiskLevel = "Low" | "Moderate" | "High" | "Severe" | "No Travel";

export interface ForecastSlice {
  hour_offset: number;
  precipitation_in_hr: number;
  snowfall_in_hr: number;
  time_iso: string;
  weathercode: number;
  wind_speed_mph: number;
}

export interface Checkpoint {
  distance_from_start_miles: number;
  distance_to_end_miles: number;
  eta_iso: string;
  hours_from_departure: number;
  index: number;
  lat: number;
  lon: number;
  precipitation_in_hr: number;
  rain_risk: RiskLevel;
  risk_level: RiskLevel;
  snow_risk: RiskLevel;
  snowfall_in_hr: number;
  weathercode: number;
  wind_risk: RiskLevel;
  wind_speed_mph: number;
}

export interface RouteGeometry {
  coordinates: [number, number][]; // [lon, lat]
  type: "LineString";
}

export interface Route {
  checkpoints: Checkpoint[];
  distance_miles: number;
  duration_hours: number;
  forecast_48h: ForecastSlice[];
  geometry: RouteGeometry;
  is_recommended: boolean;
  overall_risk_level: RiskLevel;
  route_id: number;
}

export interface RouteQuery {
  checkpoint_interval: number;
  created_at: string;
  departure_datetime: string;
  destination: string;
  destination_display: string;
  destination_lat: number;
  destination_lon: number;
  id: string;
  load_weight_lbs: number;
  origin: string;
  origin_display: string;
  origin_lat: number;
  origin_lon: number;
  recommended_route_id: number;
  routes: Route[];
}

export interface PlanRouteRequest {
  checkpoint_interval: 10 | 25 | 50;
  departure_datetime: string;
  destination: string;
  load_weight_lbs: number;
  origin: string;
}
