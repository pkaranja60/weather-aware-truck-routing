import "leaflet/dist/leaflet.css";
import { Fragment } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import { ROUTE_COLOR } from "../services/risk.calculation";
import type { RouteQuery } from "../types";
import { RouteMapCheckpoints } from "./route-map-checkpoints";
import { RouteMapHeatSegments } from "./route-map-heat-segments";

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

      {query.routes.map((route, idx) => {
        const isSelected = route.route_id === selectedRoute;
        const positions = route.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number]
        );

        return (
          <Fragment key={route.route_id}>
            {isSelected ? (
              <RouteMapHeatSegments
                checkpoints={route.checkpoints}
                forecast48h={route.forecast_48h}
                forecastHour={forecastHour}
              />
            ) : null}

            {isSelected ? (
              <Polyline
                pathOptions={{
                  color: ROUTE_COLOR[idx] ?? "#3b82f6",
                  opacity: 0.18,
                  weight: 16,
                }}
                positions={positions}
              />
            ) : null}

            <Polyline
              pathOptions={{
                color: ROUTE_COLOR[idx] ?? "#3b82f6",
                dashArray: isSelected ? undefined : "10 6",
                opacity: isSelected ? 1 : 0.35,
                weight: isSelected ? 5 : 2.5,
              }}
              positions={positions}
            />

            {isSelected ? (
              <RouteMapCheckpoints
                checkpoints={route.checkpoints}
                forecast48h={route.forecast_48h}
                forecastHour={forecastHour}
              />
            ) : null}
          </Fragment>
        );
      })}

      <CircleMarker
        center={[query.origin_lat, query.origin_lon]}
        pathOptions={{
          color: "#1e3a8a",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 3,
        }}
        radius={10}
      >
        <Tooltip direction="top" offset={[0, -12]} permanent>
          <span className="text-xs font-semibold">Origin</span>
        </Tooltip>
      </CircleMarker>

      <CircleMarker
        center={[query.destination_lat, query.destination_lon]}
        pathOptions={{
          color: "#14532d",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 3,
        }}
        radius={10}
      >
        <Tooltip direction="top" offset={[0, -12]} permanent>
          <span className="text-xs font-semibold">Destination</span>
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
