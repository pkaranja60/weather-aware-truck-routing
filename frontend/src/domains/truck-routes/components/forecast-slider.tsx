import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import {
  calculateForecastRisk as forecastRisk,
  RISK_COLOR,
} from "../services/risk.calculation";
import type { ForecastSlice, RiskLevel } from "../types";
import { RiskBadge } from "./risk-badge";

function wxDescription(code: number): string {
  if (code === 0) {
    return "Clear sky";
  }
  if (code <= 3) {
    return "Partly cloudy";
  }
  if (code <= 9) {
    return "Foggy";
  }
  if (code <= 19) {
    return "Drizzle";
  }
  if (code <= 29) {
    return "Rain";
  }
  if (code <= 39) {
    return "Dust/sand";
  }
  if (code <= 49) {
    return "Fog";
  }
  if (code <= 59) {
    return "Drizzle";
  }
  if (code <= 69) {
    return "Rain";
  }
  if (code <= 79) {
    return "Snow";
  }
  if (code <= 84) {
    return "Rain showers";
  }
  if (code <= 94) {
    return "Snow showers";
  }
  if (code <= 99) {
    return "Thunderstorm";
  }
  return "Unknown";
}

interface ForecastSliderProps {
  forecast: ForecastSlice[];
  hour: number;
  onHourChange: (h: number) => void;
}

export function ForecastSlider({
  forecast,
  hour,
  onHourChange,
}: ForecastSliderProps) {
  const handleValueChange = useCallback(
    (val: number | readonly number[]) => {
      const nextValue = Array.isArray(val) ? val[0] : val;
      if (typeof nextValue === "number") {
        onHourChange(nextValue);
      }
    },
    [onHourChange]
  );

  const slice = forecast.find((f) => f.hour_offset === hour) ?? forecast[0];

  if (!slice) {
    return null;
  }

  const risk = forecastRisk(
    slice.wind_speed_mph,
    slice.precipitation_in_hr,
    slice.snowfall_in_hr
  );

  const timeLabel = new Date(`${slice.time_iso}Z`).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isSingleSlice = forecast.length <= 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-700">
            {hour === 0 ? "Departure conditions" : `+${hour}h from departure`}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{timeLabel}</p>
        </div>
        <RiskBadge level={risk} />
      </div>

      <div className="space-y-1.5">
        <Slider
          className="w-full"
          disabled={isSingleSlice}
          max={Math.max(1, forecast.length - 1)}
          min={0}
          onValueChange={handleValueChange}
          step={1}
          value={[hour]}
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Now</span>
          <span>+24h</span>
          <span>+48h</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatBox
          label="Wind"
          risk={forecastRisk(slice.wind_speed_mph, 0, 0)}
          unit="mph"
          value={slice.wind_speed_mph.toFixed(1)}
        />
        <StatBox
          label="Rain"
          risk={forecastRisk(0, slice.precipitation_in_hr, 0)}
          unit="in/hr"
          value={slice.precipitation_in_hr.toFixed(3)}
        />
        <StatBox
          label="Snow"
          risk={forecastRisk(0, 0, slice.snowfall_in_hr)}
          unit="in/hr"
          value={slice.snowfall_in_hr.toFixed(3)}
        />
      </div>

      <p className="text-center text-xs text-slate-500">
        {wxDescription(slice.weathercode)}
      </p>

      <p className="text-[10px] leading-tight text-slate-400">
        {isSingleSlice
          ? "Hourly projection reaches the limit of the available meteorological model."
          : "Checkpoint colors update with this slider — each point accounts for its travel time."}
      </p>
    </div>
  );
}

function StatBox({
  label,
  value,
  unit,
  risk,
}: {
  label: string;
  value: string;
  unit: string;
  risk: RiskLevel;
}) {
  const color = risk === "Low" ? "#64748b" : RISK_COLOR[risk];

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2 text-center">
      <p className="mb-1 text-[10px] text-slate-400">{label}</p>
      <p className="text-sm leading-none font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">{unit}</p>
    </div>
  );
}
