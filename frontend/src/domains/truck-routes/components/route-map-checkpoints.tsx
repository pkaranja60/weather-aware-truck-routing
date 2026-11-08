import { Fragment } from "react";
import { CircleMarker, Tooltip } from "react-leaflet";
import {
  getCheckpointDisplayWeather,
  RISK_COLOR,
  RISK_RADIUS,
} from "../services/risk.calculation";
import type { Checkpoint, ForecastSlice } from "../types";

interface RouteMapCheckpointsProps {
  checkpoints: Checkpoint[];
  forecast48h: ForecastSlice[];
  forecastHour: number;
}

export function RouteMapCheckpoints({
  checkpoints,
  forecast48h,
  forecastHour,
}: RouteMapCheckpointsProps) {
  return (
    <>
      {checkpoints.map((cp) => {
        const wx = getCheckpointDisplayWeather(cp, forecast48h, forecastHour);
        const riskLevel = wx.risk_level;
        const radius = RISK_RADIUS[riskLevel] ?? 6;
        const needsGlow = riskLevel === "Severe" || riskLevel === "No Travel";

        return (
          <Fragment key={cp.index}>
            {needsGlow ? (
              <CircleMarker
                center={[cp.lat, cp.lon]}
                pathOptions={{
                  color: RISK_COLOR[riskLevel],
                  fillColor: RISK_COLOR[riskLevel],
                  fillOpacity: 0.2,
                  weight: 0,
                }}
                radius={radius + 6}
              />
            ) : null}

            <CircleMarker
              center={[cp.lat, cp.lon]}
              pathOptions={{
                color: "#fff",
                fillColor: RISK_COLOR[riskLevel],
                fillOpacity: 0.95,
                weight: 2,
              }}
              radius={radius}
            >
              <Tooltip>
                <div className="space-y-1 text-xs" style={{ minWidth: 160 }}>
                  <p className="border-b pb-1 font-semibold">
                    Mile {cp.distance_from_start_miles.toFixed(0)}
                  </p>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Overall</span>
                    <strong style={{ color: RISK_COLOR[riskLevel] }}>
                      {riskLevel}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Wind</span>
                    <span>
                      {wx.wind_speed_mph.toFixed(1)} mph
                      <span className="ml-1 opacity-60">({wx.wind_risk})</span>
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Rain</span>
                    <span>
                      {wx.precipitation_in_hr.toFixed(3)} in/hr
                      <span className="ml-1 opacity-60">({wx.rain_risk})</span>
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Snow</span>
                    <span>
                      {wx.snowfall_in_hr.toFixed(3)} in/hr
                      <span className="ml-1 opacity-60">({wx.snow_risk})</span>
                    </span>
                  </div>
                  <p className="pt-0.5 text-gray-400">
                    ETA{" "}
                    {new Date(cp.eta_iso).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
}
