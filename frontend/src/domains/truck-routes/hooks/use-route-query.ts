import { useEffect, useState } from "react";
import { routesService } from "../services/routes.service";
import type { RouteQuery } from "../types";

interface UseRouteQueryResult {
  data: RouteQuery | null;
  error: string | null;
  loading: boolean;
}

export function useRouteQuery(queryId: string): UseRouteQueryResult {
  const [data, setData] = useState<RouteQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    routesService
      .getById(queryId)
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message || "Failed to load route data.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [queryId]);

  return { data, loading, error };
}
