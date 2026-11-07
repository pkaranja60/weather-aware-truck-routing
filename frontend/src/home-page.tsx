import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RouteForm } from '@/components/RouteForm'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()

  function handleSuccess(queryId: string) {
    navigate({ to: '/results/$queryId', params: { queryId } })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🛣️</span>
            <h1 className="text-3xl font-bold text-white">Spotter AI</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Weather-risk route planning for truck drivers
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="text-lg font-semibold mb-5 text-slate-800">Plan your route</h2>
          <RouteForm onSuccess={handleSuccess} />
        </div>

        {/* Risk legend */}
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          {[
            { label: 'Low',       color: 'bg-green-500' },
            { label: 'Moderate',  color: 'bg-yellow-500' },
            { label: 'High',      color: 'bg-orange-500' },
            { label: 'Severe',    color: 'bg-red-500' },
            { label: 'No Travel', color: 'bg-red-950' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}