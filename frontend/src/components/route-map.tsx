import "leaflet/dist/leaflet.css";
import {
	CircleMarker,
	MapContainer,
	Polyline,
	TileLayer,
	Tooltip,
} from "react-leaflet";
import type { ForecastSlice, RouteQuery } from "@/lib";
import { forecastRisk, RISK_COLOR, ROUTE_COLOR } from "@/lib/risk";

interface RouteMapProps {
	query: RouteQuery;
	selectedRoute: number; // route_id 1|2|3
	forecastHour: number; // 0-48 from slider
}

export function RouteMap({
	query,
	selectedRoute,
	forecastHour,
}: RouteMapProps) {
	// Centre map on the origin
	const center: [number, number] = [query.origin_lat, query.origin_lon];

	return (
		<MapContainer
			center={center}
			zoom={7}
			className="h-full w-full rounded-lg"
			scrollWheelZoom
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>

			{query.routes.map((route, idx) => {
				const isSelected = route.route_id === selectedRoute;
				// GeoJSON coords are [lon, lat] — Leaflet wants [lat, lon]
				const positions = route.geometry.coordinates.map(
					([lon, lat]) => [lat, lon] as [number, number],
				);

				return (
					<Polyline
						key={route.route_id}
						positions={positions}
						pathOptions={{
							color: ROUTE_COLOR[idx] ?? "#3b82f6",
							weight: isSelected ? 6 : 3,
							opacity: isSelected ? 1 : 0.4,
						}}
					/>
				);
			})}

			{/* Checkpoints for selected route — colored by forecast-hour risk */}
			{query.routes
				.find((r) => r.route_id === selectedRoute)
				?.checkpoints.map((cp) => {
					// If slider is at hour 0, use stored risk; otherwise use forecast weather
					const forecast: ForecastSlice | undefined = query.routes
						.find((r) => r.route_id === selectedRoute)
						?.forecast_48h.find((f) => f.hour_offset === forecastHour);

					const riskLevel =
						forecastHour === 0 || !forecast
							? cp.risk_level
							: forecastRisk(
									forecast.wind_speed_mph,
									forecast.precipitation_in_hr,
									forecast.snowfall_in_hr,
								);

					return (
						<CircleMarker
							key={cp.index}
							center={[cp.lat, cp.lon]}
							radius={6}
							pathOptions={{
								color: "#fff",
								weight: 1.5,
								fillColor: RISK_COLOR[riskLevel],
								fillOpacity: 0.9,
							}}
						>
							<Tooltip>
								<div className="text-xs space-y-0.5">
									<p className="font-semibold">
										{cp.distance_from_start_miles.toFixed(0)} mi
									</p>
									<p>
										Risk: <strong>{riskLevel}</strong>
									</p>
									<p>Wind: {cp.wind_speed_mph.toFixed(1)} mph</p>
									<p>Rain: {cp.precipitation_in_hr.toFixed(3)} in/hr</p>
									<p>Snow: {cp.snowfall_in_hr.toFixed(3)} in/hr</p>
									<p className="text-gray-500">
										ETA: {new Date(cp.eta_iso).toLocaleTimeString()}
									</p>
								</div>
							</Tooltip>
						</CircleMarker>
					);
				})}

			{/* Origin marker */}
			<CircleMarker
				center={[query.origin_lat, query.origin_lon]}
				radius={8}
				pathOptions={{
					color: "#1d4ed8",
					fillColor: "#3b82f6",
					fillOpacity: 1,
					weight: 2,
				}}
			>
				<Tooltip permanent direction="top">
					Origin
				</Tooltip>
			</CircleMarker>

			{/* Destination marker */}
			<CircleMarker
				center={[query.destination_lat, query.destination_lon]}
				radius={8}
				pathOptions={{
					color: "#166534",
					fillColor: "#22c55e",
					fillOpacity: 1,
					weight: 2,
				}}
			>
				<Tooltip permanent direction="top">
					Destination
				</Tooltip>
			</CircleMarker>
		</MapContainer>
	);
}
