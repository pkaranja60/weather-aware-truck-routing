import { describe, expect, it } from "vitest";
import {
  calculateForecastRisk,
  formatDriveHours,
} from "../services/risk.calculation";
import { validateRoutePlanRequest } from "../validation/route-plan.validation";

describe("risk calculation", () => {
  it("computes severe or no travel conditions accurately", () => {
    expect(calculateForecastRisk(60, 0, 0)).toBe("No Travel");
    expect(calculateForecastRisk(48, 0, 0)).toBe("Severe");
    expect(calculateForecastRisk(10, 0, 0)).toBe("Low");
  });

  it("formats driving hours into human readable strings", () => {
    expect(formatDriveHours(0.5)).toBe("30m");
    expect(formatDriveHours(3)).toBe("3h");
    expect(formatDriveHours(3.25)).toBe("3h 15m");
  });
});

describe("route plan validation", () => {
  it("rejects missing origin or destination", () => {
    expect(
      validateRoutePlanRequest({ origin: "", destination: "NYC" })
    ).toBeTruthy();
    expect(
      validateRoutePlanRequest({ origin: "Chicago", destination: "" })
    ).toBeTruthy();
  });

  it("accepts valid request input", () => {
    expect(
      validateRoutePlanRequest({
        origin: "Chicago, IL",
        destination: "Columbus, OH",
        departure_datetime: new Date().toISOString(),
        load_weight_lbs: 20_000,
        checkpoint_interval: 25,
      })
    ).toBeNull();
  });
});
