import { useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDriveHours, ROUTE_COLOR } from "../services/risk.calculation";
import type { RiskLevel, Route } from "../types";
import { RiskBadge } from "./risk-badge";

const ALL_RISK_LEVELS: readonly RiskLevel[] = [
	"Low",
	"Moderate",
	"High",
	"Severe",
	"No Travel",
];

interface RouteCardItemProps {
	idx: number;
	isSelected: boolean;
	onSelect: (routeId: number) => void;
	route: Route;
}

function RouteCardItem({
	route,
	idx,
	isSelected,
	onSelect,
}: RouteCardItemProps) {
	const handleClick = useCallback(() => {
		onSelect(route.route_id);
	}, [onSelect, route.route_id]);

	const nonZeroRisks = ALL_RISK_LEVELS.map((level) => ({
		level,
		count: route.checkpoints.filter((c) => c.risk_level === level).length,
	})).filter((item) => item.count > 0);

	return (
		<Card
			className={cn(
				"cursor-pointer border-2 p-3 transition-all",
				isSelected
					? "border-blue-500 bg-blue-50/20 shadow-md"
					: "border-transparent bg-white hover:border-gray-200",
			)}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<span
						className="inline-block h-2.5 w-2.5 flex-none rounded-full"
						style={{ backgroundColor: ROUTE_COLOR[idx] ?? "#3b82f6" }}
					/>
					<span className="text-sm font-semibold text-slate-800">
						Route {route.route_id}
					</span>
					{route.is_recommended ? (
						<span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
							Recommended
						</span>
					) : null}
				</div>
				<RiskBadge level={route.overall_risk_level} />
			</div>

			<div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2.5 text-xs">
				<div>
					<p className="text-muted-foreground">Distance</p>
					<p className="text-foreground mt-0.5 text-sm font-semibold">
						{route.distance_miles.toFixed(0)} mi
					</p>
				</div>
				<div>
					<p className="text-muted-foreground">Est. Drive Time</p>
					<p className="text-foreground mt-0.5 text-sm font-semibold">
						{formatDriveHours(route.duration_hours)}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground">Checkpoints</p>
					<p className="text-foreground mt-0.5 text-sm font-semibold">
						{route.checkpoints.length}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground">Checkpoint Risk</p>
					<div className="mt-0.5 flex flex-wrap items-center gap-1.5">
						{nonZeroRisks.map(({ level, count }) => (
							<span
								className="inline-flex items-center gap-1 text-xs"
								key={level}
							>
								<RiskBadge
									className="px-1.5 py-0.5 text-[10px]"
									level={level}
								/>
								{/* <span className="text-foreground font-medium">{count}</span> */}
							</span>
						))}
					</div>
				</div>
			</div>
		</Card>
	);
}

interface RouteSummaryCardsProps {
	onSelect: (routeId: number) => void;
	routes: Route[];
	selectedRoute: number;
}

export function RouteSummaryCards({
	routes,
	selectedRoute,
	onSelect,
}: RouteSummaryCardsProps) {
	return (
		<div className="space-y-2">
			{routes.map((route, idx) => (
				<RouteCardItem
					idx={idx}
					isSelected={selectedRoute === route.route_id}
					key={route.route_id}
					onSelect={onSelect}
					route={route}
				/>
			))}
		</div>
	);
}
