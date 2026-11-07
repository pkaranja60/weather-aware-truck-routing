import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { RouteMap } from '@/components/RouteMap'
import { RouteSummaryCards } from '@/components/RouteSummaryCards'
import { ForecastSlider } from '@/components/ForecastSlider'
import { RiskBadge } from '@/components/RiskBadge'
import { getQuery } from '@/lib/api'
import type { RouteQuery } from '@/types'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/results/$queryId')({
  component: ResultsPage,
})

function ResultsPage() {
  const { queryId }  = Route.useParams()
  const navigate     = useNavigate()

  const [data, setData]           = useState<RouteQuery | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selectedRoute, setSelectedRoute] = useState(1)
  const [forecastHour, setForecastHour]   = useState(0)

  useEffect(() => {
    getQuery(queryId)
      .then(q => {
        setData(q)
        setSelectedRoute(q.recommended_route_id ?? 1)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [queryId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-slate-500 text-sm">Loading route data…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-600">{error || 'No data found'}</p>
          <Button variant="outline" onClick={() => navigate({ to: '/' })}>
            Back to planner
          </Button>
        </div>
      </div>
    )
  }

  const activeRoute = data.routes.find(r => r.route_id === selectedRoute) ?? data.routes[0]

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/' })}
            className="text-slate-500 hover:text-slate-800 text-sm"
          >
            ← Back
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {data.origin} → {data.destination}
            </p>
            <p className="text-xs text-slate-500">
              {new Date(data.departure_datetime).toLocaleString([], {
                dateStyle: 'medium', timeStyle: 'short',
              })}
              {data.load_weight_lbs > 0 && ` · ${data.load_weight_lbs.toLocaleString()} lbs`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500 hidden sm:inline">Recommended:</span>
          <span className="font-medium">Route {data.recommended_route_id}</span>
          {activeRoute && <RiskBadge level={activeRoute.overall_risk_level} />}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 flex-none bg-white border-r flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-1">
              Route Options
            </p>
            <RouteSummaryCards
              routes={data.routes}
              selectedRoute={selectedRoute}
              onSelect={setSelectedRoute}
            />
          </div>

          {/* Forecast slider in sidebar bottom */}
          {activeRoute.forecast_48h.length > 0 && (
            <div className="border-t p-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                48h Forecast
              </p>
              <ForecastSlider
                forecast={activeRoute.forecast_48h}
                hour={forecastHour}
                onHourChange={setForecastHour}
              />
            </div>
          )}
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          <RouteMap
            query={data}
            selectedRoute={selectedRoute}
            forecastHour={forecastHour}
          />

          {/* Map legend overlay */}
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs space-y-1.5 z-[1000]">
            <p className="font-semibold text-slate-700 mb-1">Risk Level</p>
            {[
              { label: 'Low',       color: '#22c55e' },
              { label: 'Moderate',  color: '#eab308' },
              { label: 'High',      color: '#f97316' },
              { label: 'Severe',    color: '#ef4444' },
              { label: 'No Travel', color: '#7f1d1d' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2 text-slate-600">
                <span
                  className="w-3 h-3 rounded-full flex-none"
                  style={{ backgroundColor: color }}
                />
                {label}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}