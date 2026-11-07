import type { PlanRouteRequest, RouteQuery } from ".";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export async function planRoute(data: PlanRouteRequest): Promise<RouteQuery> {
	const res = await fetch(`${API_BASE}/routes/plan/`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	const json = await res.json();
	if (!res.ok)
		throw new Error(json.error ?? json.errors ?? "Failed to plan route");
	return json;
}

export async function getQuery(queryId: string): Promise<RouteQuery> {
	const res = await fetch(`${API_BASE}/routes/${queryId}/`);
	if (!res.ok) throw new Error("Route query not found");
	return res.json();
}
