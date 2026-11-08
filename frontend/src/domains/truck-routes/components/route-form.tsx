import { Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { routesService } from "../services/routes.service";
import { validateRoutePlanRequest } from "../validation/route-plan.validation";

interface RouteFormProps {
  onSuccess: (queryId: string) => void;
}

export function RouteForm({ onSuccess }: RouteFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [weight, setWeight] = useState("");
  const [interval, setInterval] = useState<"10" | "25" | "50">("25");

  const handleOriginChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setOrigin(e.target.value),
    []
  );
  const handleDestinationChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDestination(e.target.value),
    []
  );
  const handleDepartureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDeparture(e.target.value),
    []
  );
  const handleWeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWeight(e.target.value),
    []
  );
  const handleIntervalChange = useCallback((val: "10" | "25" | "50" | null) => {
    if (val === "10" || val === "25" || val === "50") {
      setInterval(val);
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      const parsedInterval = Number.parseInt(interval, 10) as 10 | 25 | 50;
      const parsedWeight = Number.parseFloat(weight) || 0;
      const departureIso = departure ? new Date(departure).toISOString() : "";

      const validationError = validateRoutePlanRequest({
        origin,
        destination,
        departure_datetime: departureIso,
        load_weight_lbs: parsedWeight,
        checkpoint_interval: parsedInterval,
      });

      if (validationError) {
        setError(validationError);
        return;
      }

      setLoading(true);
      try {
        const result = await routesService.create({
          origin,
          destination,
          departure_datetime: departureIso,
          load_weight_lbs: parsedWeight,
          checkpoint_interval: parsedInterval,
        });
        onSuccess(result.id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to plan route.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [origin, destination, departure, weight, interval, onSuccess]
  );

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="origin">Origin</Label>
        <Input
          id="origin"
          onChange={handleOriginChange}
          placeholder="e.g. Los Angeles, CA"
          required
          value={origin}
        />
        <p className="text-muted-foreground text-xs">
          Include city and state for best results
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="destination">Destination</Label>
        <Input
          id="destination"
          onChange={handleDestinationChange}
          placeholder="e.g. Oakland, CA"
          required
          value={destination}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="departure">Departure Date & Time</Label>
        <Input
          id="departure"
          onChange={handleDepartureChange}
          required
          type="datetime-local"
          value={departure}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="weight">Load Weight (lbs)</Label>
        <Input
          id="weight"
          min={0}
          onChange={handleWeightChange}
          placeholder="e.g. 35000"
          type="number"
          value={weight}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="interval-select">Checkpoint Interval</Label>
        <Select onValueChange={handleIntervalChange} value={interval}>
          <SelectTrigger id="interval-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">Every 10 miles</SelectItem>
            <SelectItem value="25">Every 25 miles</SelectItem>
            <SelectItem value="50">Every 50 miles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={loading} type="submit">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Planning route…</span>
          </>
        ) : (
          "Plan Route"
        )}
      </Button>

      {loading ? (
        <p className="text-muted-foreground text-center text-xs">
          Fetching routes and weather data — this takes ~15 seconds
        </p>
      ) : null}
    </form>
  );
}
