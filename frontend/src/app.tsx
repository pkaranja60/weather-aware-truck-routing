import {
  createRootRoute,
  createRoute,
  createRouter,
  getRouteApi,
  Outlet,
  RouterProvider,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { HomePage, ResultsPage } from "@/domains/truck-routes";

function NotFoundView() {
  const navigate = useNavigate();

  const handleReturnHome = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Page Not Found</h1>
      <p className="mb-4 text-sm text-slate-500">
        The route you are looking for does not exist.
      </p>
      <button
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        onClick={handleReturnHome}
        type="button"
      >
        Return to Planner
      </button>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundView,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: function IndexView() {
    const navigate = useNavigate();

    const handlePlanSuccess = useCallback(
      (queryId: string) => {
        navigate({ to: "/results/$queryId", params: { queryId } });
      },
      [navigate]
    );

    return <HomePage onPlanSuccess={handlePlanSuccess} />;
  },
});

const resultsRouteApi = getRouteApi("/results/$queryId");

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/results/$queryId",
  component: function ResultsView() {
    const { queryId } = resultsRouteApi.useParams();
    const navigate = useNavigate();

    const handleNavigateHome = useCallback(() => {
      navigate({ to: "/" });
    }, [navigate]);

    return (
      <ResultsPage onNavigateHome={handleNavigateHome} queryId={queryId} />
    );
  },
});

const routeTree = rootRoute.addChildren([indexRoute, resultsRoute]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
