import { RouteForm } from "../components/route-form";

interface HomePageProps {
  onPlanSuccess: (queryId: string) => void;
}

const RISK_LEGEND_ITEMS = [
  { label: "Low", color: "bg-green-500" },
  { label: "Moderate", color: "bg-yellow-500" },
  { label: "High", color: "bg-orange-500" },
  { label: "Severe", color: "bg-red-500" },
  { label: "No Travel", color: "bg-red-950" },
] as const;

export function HomePage({ onPlanSuccess }: HomePageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            {/* <span aria-label="Highway" className="text-3xl" role="img">
              🛣️
            </span> */}
            <h1 className="text-3xl font-bold text-white">
              Weather Aware Truck Routing
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Weather-risk route planning for truck drivers
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="mb-5 text-lg font-semibold text-slate-800">
            Plan your route
          </h2>
          <RouteForm onSuccess={onPlanSuccess} />
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {RISK_LEGEND_ITEMS.map(({ label, color }) => (
            <div
              className="flex items-center gap-1.5 text-xs text-slate-300"
              key={label}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              {label}
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
