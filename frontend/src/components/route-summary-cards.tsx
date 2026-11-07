import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTE_COLOR, formatHours } from "@/lib/risk";
import type { Route } from "@/lib";
import { cn } from "@/lib/utils";
import { RiskBadge } from "./risk-badge";

interface RouteSummaryCardsProps {
	routes: Route[];
	selectedRoute: number;
	onSelect: (routeId: number) => void;
}

export function RouteSummaryCards({
	routes,
	selectedRoute,
	onSelect,
}: RouteSummaryCardsProps) {
	return (
		<div className="space-y-3">
			{routes.map((route, idx) => (
				<Card
					key={route.route_id}
					onClick={() => onSelect(route.route_id)}
					className={cn(
						"cursor-pointer transition-all border-2",
						selectedRoute === route.route_id
							? "border-blue-500 shadow-md"
							: "border-transparent hover:border-gray-200",
					)}
				>
					<CardHeader className="pb-2 pt-3 px-4">
						<div className="flex items-center justify-between">
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<span
									className="inline-block w-3 h-3 rounded-full"
									style={{ backgroundColor: ROUTE_COLOR[idx] }}
								/>
								Route {route.route_id}
								{route.is_recommended && (
									<span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
										Recommended
									</span>
								)}
							</CardTitle>
							<RiskBadge level={route.overall_risk_level} />
						</div>
					</CardHeader>

					<CardContent className="px-4 pb-3">
						<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
							<span>Distance</span>
							<span className="text-foreground font-medium text-right">
								{route.distance_miles.toFixed(0)} mi
							</span>
							<span>Est. drive time</span>
							<span className="text-foreground font-medium text-right">
								{formatHours(route.duration_hours)}
							</span>
							<span>Checkpoints</span>
							<span className="text-foreground font-medium text-right">
								{route.checkpoints.length}
							</span>
						</div>

						{/* Mini risk breakdown */}
						<div className="mt-3 flex gap-1 flex-wrap">
							{(
								["Low", "Moderate", "High", "Severe", "No Travel"] as const
							).map((level) => {
								const count = route.checkpoints.filter(
									(c) => c.risk_level === level,
								).length;
								if (count === 0) return null;
								return (
									<span key={level} className="text-xs text-muted-foreground">
										<RiskBadge level={level} className="mr-0.5" />
										{count}
									</span>
								);
							})}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
