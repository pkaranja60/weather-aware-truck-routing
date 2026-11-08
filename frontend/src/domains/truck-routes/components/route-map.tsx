import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import {
  calculateForecastRisk,
  RISK_COLOR,
  ROUTE_COLOR,
} from "../services/risk.calculation";
import type {
  Checkpoint,
  ForecastSlice,
  RiskLevel,
  Route,
  RouteQuery,
} from "../types";

interface RouteMapProps {
  forecastHour: number;
  query: RouteQuery;
  selectedRoute: number;
}

export function RouteMap({
  query,
  selectedRoute,
  forecastHour,
}: RouteMapProps) {
  const center: [number, number] = [query.origin_lat, query.origin_lon];
  const activeRoute = query.routes.find(
    (r: Route) => r.route_id === selectedRoute
  );

  return (
    <MapContainer
      center={center}
      className="h-full w-full rounded-lg"
      scrollWheelZoom
      zoom={7}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {query.routes.map((route: Route, idx: number) => {
        const isSelected = route.route_id === selectedRoute;
        const positions = route.geometry.coordinates.map(
          ([lon, lat]: [number, number]): [number, number] => [lat, lon]
        );

        return (
          <Polyline
            key={route.route_id}
            pathOptions={{
              color: ROUTE_COLOR[idx] ?? "#3b82f6",
              weight: isSelected ? 6 : 3,
              opacity: isSelected ? 1 : 0.4,
            }}
            positions={positions}
          />
        );
      })}

      {activeRoute?.checkpoints.map((cp: Checkpoint) => {
        const forecast: ForecastSlice | undefined =
          activeRoute.forecast_48h.find(
            (f: ForecastSlice) => f.hour_offset === forecastHour
          );

        const riskLevel: RiskLevel =
          forecastHour === 0 || !forecast
            ? cp.risk_level
            : calculateForecastRisk(
                forecast.wind_speed_mph,
                forecast.precipitation_in_hr,
                forecast.snowfall_in_hr
              );

        return (
          <CircleMarker
            center={[cp.lat, cp.lon]}
            key={cp.index}
            pathOptions={{
              color: "#fff",
              weight: 1.5,
              fillColor: RISK_COLOR[riskLevel],
              fillOpacity: 0.9,
            }}
            radius={6}
          >
            <Tooltip>
              <div className="space-y-0.5 text-xs">
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

      <CircleMarker
        center={[query.origin_lat, query.origin_lon]}
        pathOptions={{
          color: "#1d4ed8",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 2,
        }}
        radius={8}
      >
        <Tooltip direction="top" permanent>
          Origin
        </Tooltip>
      </CircleMarker>

      <CircleMarker
        center={[query.destination_lat, query.destination_lon]}
        pathOptions={{
          color: "#166534",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 2,
        }}
        radius={8}
      >
        <Tooltip direction="top" permanent>
          Destination
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
