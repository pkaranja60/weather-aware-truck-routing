import type { PlanRouteRequest, RouteQuery } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function create(payload: PlanRouteRequest): Promise<RouteQuery> {
  const response = await fetch(`${API_BASE}/routes/plan/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  if (!response.ok) {
    const message = body.error ?? body.errors ?? "Failed to plan route.";
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  return body as RouteQuery;
}

async function getById(queryId: string): Promise<RouteQuery> {
  const response = await fetch(
    `${API_BASE}/routes/${encodeURIComponent(queryId)}/`
  );

  if (!response.ok) {
    throw new Error("Route query not found.");
  }

  const body = await response.json();
  return body as RouteQuery;
}

export const routesService = {
  create,
  getById,
};
