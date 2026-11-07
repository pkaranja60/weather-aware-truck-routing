import { Slider } from "@/components/ui/slider";
import { forecastRisk } from "@/lib/risk";
import type { ForecastSlice } from "@/lib";
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
	const slice = forecast.find((f) => f.hour_offset === hour) ?? forecast[0];

	if (!slice) return null;

	const risk = forecastRisk(
		slice.wind_speed_mph,
		slice.precipitation_in_hr,
		slice.snowfall_in_hr,
	);

	return (
		<div className="space-y-3 p-4 bg-muted/40 rounded-lg border">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium">Forecast Preview</p>
				<span className="text-xs text-muted-foreground">
					{new Date(slice.time_iso + "Z").toLocaleString([], {
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			</div>

			<Slider
				min={0}
				max={Math.max(0, forecast.length - 1)}
				step={1}
				value={[hour]}
				onValueChange={([v]) => onHourChange(v)}
				className="w-full"
			/>

			<div className="flex items-center justify-between text-xs text-muted-foreground">
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
			<p className="text-xs text-muted-foreground mb-1">{label}</p>
			<p className="text-sm font-medium">{children}</p>
		</div>
	);
}
