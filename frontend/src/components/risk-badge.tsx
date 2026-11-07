import type { RiskLevel } from "@/lib";
import { RISK_BG } from "@/lib/risk";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
	level: RiskLevel;
	className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
				RISK_BG[level],
				className,
			)}
		>
			{level}
		</span>
	);
}
