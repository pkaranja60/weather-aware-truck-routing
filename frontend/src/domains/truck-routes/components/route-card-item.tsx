import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatDriveHours as formatHours,
  getWorstHazardRisk,
  RISK_COLOR,
  RISK_LEVELS,
  ROUTE_COLOR,
} from "../services/risk.calculation";
import type { Route } from "../types";
import { RiskBadge } from "./risk-badge";

interface HazardCellProps {
  checkpoints: Route["checkpoints"];
  field: "wind_risk" | "rain_risk" | "snow_risk";
  label: string;
}

function HazardCell({ label, checkpoints, field }: HazardCellProps) {
  const worst = getWorstHazardRisk(checkpoints, field);
  const color = worst === "Low" ? "#94a3b8" : RISK_COLOR[worst];

  return (
    <div className="rounded bg-slate-50 px-1 py-1.5">
      <p className="mb-0.5 text-slate-400">{label}</p>
      <p className="font-semibold" style={{ color }}>
        {worst}
      </p>
    </div>
  );
}

export interface RouteCardItemProps {
  idx: number;
  isSelected: boolean;
  onSelect: (routeId: number) => void;
  route: Route;
}

export function RouteCardItem({
  route,
  idx,
  isSelected,
  onSelect,
}: RouteCardItemProps) {
  const handleClick = useCallback(() => {
    onSelect(route.route_id);
  }, [onSelect, route.route_id]);

  const severeOrWorse = route.checkpoints.filter(
    (c) => c.risk_level === "Severe" || c.risk_level === "No Travel"
  ).length;

  const highOrWorse = route.checkpoints.filter((c) =>
    ["High", "Severe", "No Travel"].includes(c.risk_level)
  ).length;

  return (
    <Card
      className={cn(
        "cursor-pointer border-2 transition-all",
        isSelected
          ? "border-blue-500 bg-blue-50/30 shadow-md"
          : "border-transparent hover:border-slate-200"
      )}
      onClick={handleClick}
    >
      <CardHeader className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <span
              className="inline-block h-1.5 w-4 rounded-full"
              style={{ backgroundColor: ROUTE_COLOR[idx] ?? "#3b82f6" }}
            />
            Route {route.route_id}
            {route.is_recommended ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                ★ Best
              </span>
            ) : null}
          </CardTitle>
          <RiskBadge level={route.overall_risk_level} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-3">
        <div className="text-muted-foreground grid grid-cols-3 gap-x-2 text-xs">
          <div>
            <p className="text-foreground text-sm font-medium">
              {route.distance_miles.toFixed(0)} mi
            </p>
            <p>distance</p>
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">
              {formatHours(route.duration_hours)}
            </p>
            <p>est. time</p>
          </div>
          <div>
            <p className="text-foreground text-sm font-medium">
              {route.checkpoints.length}
            </p>
            <p>checkpoints</p>
          </div>
        </div>

        <div className="border-t pt-2">
          <p className="mb-1.5 text-[10px] tracking-wide text-slate-400 uppercase">
            Hazard breakdown
          </p>
          <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
            <HazardCell
              checkpoints={route.checkpoints}
              field="wind_risk"
              label="Wind"
            />
            <HazardCell
              checkpoints={route.checkpoints}
              field="rain_risk"
              label="Rain"
            />
            <HazardCell
              checkpoints={route.checkpoints}
              field="snow_risk"
              label="Snow"
            />
          </div>
        </div>

        {route.checkpoints.length > 0 ? (
          <div>
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {RISK_LEVELS.map((level) => {
                const count = route.checkpoints.filter(
                  (c) => c.risk_level === level
                ).length;
                if (count === 0) {
                  return null;
                }
                const pct = (count / route.checkpoints.length) * 100;
                return (
                  <div
                    key={level}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: RISK_COLOR[level],
                    }}
                    title={`${level}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {RISK_LEVELS.map((level) => {
                const count = route.checkpoints.filter(
                  (c) => c.risk_level === level
                ).length;
                if (count === 0) {
                  return null;
                }
                return (
                  <span
                    className="text-muted-foreground flex items-center gap-1 text-[10px]"
                    key={level}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: RISK_COLOR[level] }}
                    />
                    {count} {level}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {highOrWorse > 0 ? (
          <p className="text-[10px] font-medium text-orange-600">
            ⚠ {highOrWorse} checkpoint{highOrWorse > 1 ? "s" : ""} at High risk
            or above
            {severeOrWorse > 0
              ? `, including ${severeOrWorse} Severe/No Travel`
              : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
