import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { calculateForecastRisk } from "../services/risk.calculation";
import type { ForecastSlice } from "../types";
import { RiskBadge } from "./risk-badge";

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

  const risk = calculateForecastRisk(
    slice.wind_speed_mph,
    slice.precipitation_in_hr,
    slice.snowfall_in_hr
  );

  return (
    <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Forecast Preview</p>
        <span className="text-muted-foreground text-xs">
          {new Date(`${slice.time_iso}Z`).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <Slider
        className="w-full"
        max={Math.max(0, forecast.length - 1)}
        min={0}
        onValueChange={handleValueChange}
        step={1}
        value={[hour]}
      />

      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>Now</span>
        <span>+{hour}h from departure</span>
        <span>+48h</span>
      </div>

      <div className="grid grid-cols-4 gap-3 pt-1">
        <Stat label="Risk">
          <RiskBadge level={risk} />
        </Stat>
        <Stat label="Wind">{slice.wind_speed_mph.toFixed(1)} mph</Stat>
        <Stat label="Rain">{slice.precipitation_in_hr.toFixed(3)} in/hr</Stat>
        <Stat label="Snow">{slice.snowfall_in_hr.toFixed(3)} in/hr</Stat>
      </div>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}
