import type { PlanRouteRequest } from "../types";

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
