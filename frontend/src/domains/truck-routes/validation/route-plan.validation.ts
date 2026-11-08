import type { PlanRouteRequest } from "../types";

export function toLocalInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function validateRoutePlanRequest(
  input: Partial<PlanRouteRequest>
): string | null {
  if (!input.origin || input.origin.trim().length === 0) {
    return "Origin location is required.";
  }

  if (!input.destination || input.destination.trim().length === 0) {
    return "Destination location is required.";
  }

  if (
    !input.departure_datetime ||
    Number.isNaN(Date.parse(input.departure_datetime))
  ) {
    return "A valid departure date and time is required.";
  }

  const depMs = Date.parse(input.departure_datetime);
  const nowMs = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  if (depMs < nowMs - twoHoursMs) {
    return "Departure time cannot be in the past.";
  }

  if (depMs > nowMs + fourteenDaysMs) {
    return "Departure time must be within 14 days (weather forecast limit).";
  }

  if (input.load_weight_lbs !== undefined && input.load_weight_lbs < 0) {
    return "Load weight cannot be negative.";
  }

  const validIntervals = [10, 25, 50];
  if (
    input.checkpoint_interval &&
    !validIntervals.includes(input.checkpoint_interval)
  ) {
    return "Checkpoint interval must be 10, 25, or 50 miles.";
  }

  return null;
}
