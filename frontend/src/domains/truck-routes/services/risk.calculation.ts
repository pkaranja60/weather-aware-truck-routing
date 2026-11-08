import type { Checkpoint, ForecastSlice, RiskLevel } from "../types";

export const RISK_LEVELS: readonly RiskLevel[] = [
  "Low",
  "Moderate",
  "High",
  "Severe",
  "No Travel",
];

export const RISK_COLOR: Record<RiskLevel, string> = {
  Low: "#22c55e",
  Moderate: "#eab308",
  High: "#f97316",
  Severe: "#ef4444",
  "No Travel": "#7f1d1d",
};

export const RISK_BG: Record<RiskLevel, string> = {
  Low: "bg-green-500",
  Moderate: "bg-yellow-500",
  High: "bg-orange-500",
  Severe: "bg-red-500",
  "No Travel": "bg-red-950",
};

export const RISK_TEXT: Record<RiskLevel, string> = {
  Low: "text-green-700",
  Moderate: "text-yellow-700",
  High: "text-orange-700",
  Severe: "text-red-700",
  "No Travel": "text-red-950",
};

export const RISK_RADIUS: Record<RiskLevel, number> = {
  Low: 6,
  Moderate: 8,
  High: 11,
  Severe: 14,
  "No Travel": 17,
};

export const ROUTE_COLOR = ["#3b82f6", "#8b5cf6", "#06b6d4"];

export function calculateForecastRisk(
  windMph: number,
  precipIn: number,
  snowIn: number
): RiskLevel {
  if (windMph >= 55 || precipIn > 1.0 || snowIn > 3.0) {
    return "No Travel";
  }
  if (windMph >= 45 || precipIn >= 0.5 || snowIn >= 2.0) {
    return "Severe";
  }
  if (windMph >= 35 || precipIn >= 0.25 || snowIn >= 1.0) {
    return "High";
  }
  if (windMph >= 25 || precipIn >= 0.1 || snowIn >= 0.5) {
    return "Moderate";
  }
  return "Low";
}

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const ia = Math.max(RISK_LEVELS.indexOf(a), 0);
  const ib = Math.max(RISK_LEVELS.indexOf(b), 0);
  return RISK_LEVELS[Math.max(ia, ib)] ?? "Low";
}

export function countHazardRisk(
  checkpoints: Checkpoint[],
  field: "wind_risk" | "rain_risk" | "snow_risk"
): Record<RiskLevel, number> {
  const counts = {} as Record<RiskLevel, number>;
  for (const level of RISK_LEVELS) {
    counts[level] = 0;
  }
  for (const cp of checkpoints) {
    const level = cp[field];
    if (level in counts) {
      counts[level] += 1;
    }
  }
  return counts;
}

export function getWorstHazardRisk(
  checkpoints: Checkpoint[],
  field: "wind_risk" | "rain_risk" | "snow_risk"
): RiskLevel {
  const counts = countHazardRisk(checkpoints, field);
  for (let i = RISK_LEVELS.length - 1; i >= 0; i -= 1) {
    const lvl = RISK_LEVELS[i];
    if (lvl && counts[lvl] > 0) {
      return lvl;
    }
  }
  return "Low";
}

export interface CheckpointWeatherDisplay {
  precipitation_in_hr: number;
  rain_risk: RiskLevel;
  risk_level: RiskLevel;
  snow_risk: RiskLevel;
  snowfall_in_hr: number;
  wind_risk: RiskLevel;
  wind_speed_mph: number;
}

export function getCheckpointDisplayWeather(
  cp: Checkpoint,
  forecast48h: ForecastSlice[],
  forecastHour: number
): CheckpointWeatherDisplay {
  if (forecastHour === 0 || forecast48h.length === 0) {
    return {
      wind_speed_mph: cp.wind_speed_mph,
      precipitation_in_hr: cp.precipitation_in_hr,
      snowfall_in_hr: cp.snowfall_in_hr,
      wind_risk: cp.wind_risk,
      rain_risk: cp.rain_risk,
      snow_risk: cp.snow_risk,
      risk_level: cp.risk_level,
    };
  }

  const targetOffset = Math.round(forecastHour + cp.hours_from_departure);
  const slice =
    forecast48h.find((f: ForecastSlice) => f.hour_offset === targetOffset) ??
    forecast48h.at(-1);

  if (!slice) {
    return {
      wind_speed_mph: cp.wind_speed_mph,
      precipitation_in_hr: cp.precipitation_in_hr,
      snowfall_in_hr: cp.snowfall_in_hr,
      wind_risk: cp.wind_risk,
      rain_risk: cp.rain_risk,
      snow_risk: cp.snow_risk,
      risk_level: cp.risk_level,
    };
  }

  const wr = calculateForecastRisk(slice.wind_speed_mph, 0, 0);
  const rr = calculateForecastRisk(0, slice.precipitation_in_hr, 0);
  const sr = calculateForecastRisk(0, 0, slice.snowfall_in_hr);
  const overall = calculateForecastRisk(
    slice.wind_speed_mph,
    slice.precipitation_in_hr,
    slice.snowfall_in_hr
  );

  return {
    wind_speed_mph: slice.wind_speed_mph,
    precipitation_in_hr: slice.precipitation_in_hr,
    snowfall_in_hr: slice.snowfall_in_hr,
    wind_risk: wr,
    rain_risk: rr,
    snow_risk: sr,
    risk_level: overall,
  };
}

export function getCheckpointRisk(
  cp: Checkpoint,
  forecast48h: ForecastSlice[],
  forecastHour: number
): RiskLevel {
  return getCheckpointDisplayWeather(cp, forecast48h, forecastHour).risk_level;
}

export function formatDriveHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0) {
    return `${minutes}m`;
  }

  return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
}
