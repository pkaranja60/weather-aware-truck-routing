import type { Route } from "../types";
import { RouteCardItem } from "./route-card-item";

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
    <div className="space-y-3">
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
