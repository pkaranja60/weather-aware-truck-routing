import { Polyline } from "react-leaflet";
import {
  getCheckpointRisk,
  maxRisk,
  RISK_COLOR,
} from "../services/risk.calculation";
import type { Checkpoint, ForecastSlice } from "../types";

interface RouteMapHeatSegmentsProps {
  checkpoints: Checkpoint[];
  forecast48h: ForecastSlice[];
  forecastHour: number;
}

export function RouteMapHeatSegments({
  checkpoints,
  forecast48h,
  forecastHour,
}: RouteMapHeatSegmentsProps) {
  return (
    <>
      {checkpoints.map((cp, i) => {
        if (i === 0) {
          return null;
        }
        const prev = checkpoints[i - 1];
        if (!prev) {
          return null;
        }

        const cpRisk = getCheckpointRisk(cp, forecast48h, forecastHour);
        const prevRisk = getCheckpointRisk(prev, forecast48h, forecastHour);
        const segRisk = maxRisk(prevRisk, cpRisk);

        return (
          <Polyline
            key={`heat-${cp.index}`}
            pathOptions={{
              color: RISK_COLOR[segRisk],
              lineCap: "round",
              lineJoin: "round",
              opacity: 0.3,
              weight: 16,
            }}
            positions={[
              [prev.lat, prev.lon],
              [cp.lat, cp.lon],
            ]}
          />
        );
      })}
    </>
  );
}
