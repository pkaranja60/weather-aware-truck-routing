import type { RiskLevel } from ".";

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

export const ROUTE_COLOR = ["#3b82f6", "#8b5cf6", "#06b6d4"]; // blue, purple, cyan

/** Recompute a rough risk level from raw weather values (for slider preview) */
export function forecastRisk(
	windMph: number,
	precipIn: number,
	snowIn: number,
): RiskLevel {
	if (windMph >= 55 || precipIn >= 1.0 || snowIn >= 4.0) return "No Travel";
	if (windMph >= 45 || precipIn >= 0.5 || snowIn >= 2.0) return "Severe";
	if (windMph >= 35 || precipIn >= 0.3 || snowIn >= 1.0) return "High";
	if (windMph >= 25 || precipIn >= 0.1 || snowIn >= 0.5) return "Moderate";
	return "Low";
}

export function formatHours(h: number): string {
	const hrs = Math.floor(h);
	const mins = Math.round((h - hrs) * 60);
	if (hrs === 0) return `${mins}m`;
	return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
