import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ForecastSlider } from "../components/forecast-slider";
import { RiskBadge } from "../components/risk-badge";
import { RouteMap } from "../components/route-map";
import { RouteSummaryCards } from "../components/route-summary-cards";
import { useRouteQuery } from "../hooks/use-route-query";
import type { Route } from "../types";

interface ResultsPageProps {
  onNavigateHome: () => void;
  queryId: string;
}

const RISK_MAP_LEGEND = [
  { label: "Low", color: "#22c55e" },
  { label: "Moderate", color: "#eab308" },
  { label: "High", color: "#f97316" },
  { label: "Severe", color: "#ef4444" },
  { label: "No Travel", color: "#7f1d1d" },
] as const;

export function ResultsPage({ queryId, onNavigateHome }: ResultsPageProps) {
  const { data, loading, error } = useRouteQuery(queryId);
  const [selectedRoute, setSelectedRoute] = useState(1);
  const [forecastHour, setForecastHour] = useState(0);

  useEffect(() => {
    if (data?.recommended_route_id) {
      setSelectedRoute(data.recommended_route_id);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-sm text-slate-500">Loading route data…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="space-y-3 text-center">
          <p className="text-red-600">{error ?? "No data found."}</p>
          <Button onClick={onNavigateHome} variant="outline">
            Back to planner
          </Button>
        </div>
      </div>
    );
  }

  const activeRoute =
    data.routes.find((r: Route) => r.route_id === selectedRoute) ??
    data.routes[0];

  const recommendedRoute =
    data.routes.find((r: Route) => r.route_id === data.recommended_route_id) ??
    data.routes[0];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
            onClick={onNavigateHome}
            type="button"
          >
            ← Back
          </button>
          <div className="hidden sm:block">
            <p className="text-sm leading-tight font-semibold text-slate-800">
              {data.origin} → {data.destination}
            </p>
            <p className="text-xs text-slate-500">
              {new Date(data.departure_datetime).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {data.load_weight_lbs > 0 &&
                ` · ${data.load_weight_lbs.toLocaleString()} lbs`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="hidden text-slate-500 sm:inline">
              Recommended:
            </span>
            <span className="font-medium">
              Route {data.recommended_route_id}
            </span>
            {recommendedRoute ? (
              <RiskBadge level={recommendedRoute.overall_risk_level} />
            ) : null}
          </div>

          {activeRoute && activeRoute.route_id !== data.recommended_route_id ? (
            <div className="flex items-center gap-1.5 border-l pl-3 text-slate-500">
              <span className="hidden sm:inline">Viewing:</span>
              <span className="font-medium text-slate-700">
                Route {activeRoute.route_id}
              </span>
              <RiskBadge level={activeRoute.overall_risk_level} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-72 flex-none flex-col overflow-hidden border-r bg-white">
          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 px-1 text-xs font-medium tracking-wider text-slate-500 uppercase">
              Route Options
            </p>
            <RouteSummaryCards
              onSelect={setSelectedRoute}
              routes={data.routes}
              selectedRoute={selectedRoute}
            />
          </div>

          {activeRoute && activeRoute.forecast_48h.length > 0 ? (
            <div className="border-t p-3">
              <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">
                48h Forecast
              </p>
              <ForecastSlider
                forecast={activeRoute.forecast_48h}
                hour={forecastHour}
                onHourChange={setForecastHour}
              />
            </div>
          ) : null}
        </aside>

        <main className="relative flex-1">
          <RouteMap
            forecastHour={forecastHour}
            query={data}
            selectedRoute={selectedRoute}
          />

          <div className="absolute right-4 bottom-4 z-1000 space-y-1.5 rounded-lg bg-white/90 p-3 text-xs shadow-lg backdrop-blur-sm">
            <p className="mb-1 font-semibold text-slate-700">Risk Level</p>
            {RISK_MAP_LEGEND.map(({ label, color }) => (
              <div
                className="flex items-center gap-2 text-slate-600"
                key={label}
              >
                <span
                  className="h-3 w-3 flex-none rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
