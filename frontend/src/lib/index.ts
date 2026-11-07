export type RiskLevel = "Low" | "Moderate" | "High" | "Severe" | "No Travel";

export interface ForecastSlice {
	hour_offset: number;
	time_iso: string;
	wind_speed_mph: number;
	precipitation_in_hr: number;
	snowfall_in_hr: number;
	weathercode: number;
}

export interface Checkpoint {
	index: number;
	distance_from_start_miles: number;
	distance_to_end_miles: number;
	lat: number;
	lon: number;
	eta_iso: string;
	hours_from_departure: number;
	wind_speed_mph: number;
	precipitation_in_hr: number;
	snowfall_in_hr: number;
	weathercode: number;
	wind_risk: RiskLevel;
	rain_risk: RiskLevel;
	snow_risk: RiskLevel;
	risk_level: RiskLevel;
}

export interface Route {
	route_id: number;
	distance_miles: number;
	duration_hours: number;
	geometry: {
		type: "LineString";
		coordinates: [number, number][]; // [lon, lat]
	};
	overall_risk_level: RiskLevel;
	is_recommended: boolean;
	forecast_48h: ForecastSlice[];
	checkpoints: Checkpoint[];
}

export interface RouteQuery {
	id: string;
	origin: string;
	destination: string;
	origin_display: string;
	destination_display: string;
	origin_lat: number;
	origin_lon: number;
	destination_lat: number;
	destination_lon: number;
	departure_datetime: string;
	load_weight_lbs: number;
	checkpoint_interval: number;
	recommended_route_id: number;
	created_at: string;
	routes: Route[];
}

export interface PlanRouteRequest {
	origin: string;
	destination: string;
	departure_datetime: string;
	load_weight_lbs: number;
	checkpoint_interval: 10 | 25 | 50;
}
