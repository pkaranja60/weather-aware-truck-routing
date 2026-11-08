import { cn } from "@/lib/utils";
import { RISK_BG } from "../services/risk.calculation";
import type { RiskLevel } from "../types";

interface RiskBadgeProps {
  className?: string;
  level: RiskLevel;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
        RISK_BG[level],
        className
      )}
    >
      {level}
    </span>
  );
}
