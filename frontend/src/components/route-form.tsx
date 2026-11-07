import { useState } from "react";
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
import { planRoute } from "@/lib/api";

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

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const result = await planRoute({
				origin,
				destination,
				departure_datetime: new Date(departure).toISOString(),
				load_weight_lbs: parseFloat(weight) || 0,
				checkpoint_interval: parseInt(interval) as 10 | 25 | 50,
			});
			onSuccess(result.id);
		} catch (err: any) {
			setError(err.message ?? "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="space-y-1.5">
				<Label htmlFor="origin">Origin</Label>
				<Input
					id="origin"
					placeholder="e.g. Chicago, IL"
					value={origin}
					onChange={(e) => setOrigin(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="destination">Destination</Label>
				<Input
					id="destination"
					placeholder="e.g. Columbus, OH"
					value={destination}
					onChange={(e) => setDestination(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="departure">Departure Date & Time</Label>
				<Input
					id="departure"
					type="datetime-local"
					value={departure}
					onChange={(e) => setDeparture(e.target.value)}
					required
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="weight">Load Weight (lbs)</Label>
				<Input
					id="weight"
					type="number"
					placeholder="e.g. 35000"
					min={0}
					value={weight}
					onChange={(e) => setWeight(e.target.value)}
				/>
			</div>

			<div className="space-y-1.5">
				<Label>Checkpoint Interval</Label>
				<Select value={interval} onValueChange={(v) => setInterval(v as any)}>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="10">Every 10 miles</SelectItem>
						<SelectItem value="25">Every 25 miles</SelectItem>
						<SelectItem value="50">Every 50 miles</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{error && (
				<p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
					{error}
				</p>
			)}

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Planning route…" : "Plan Route"}
			</Button>

			{loading && (
				<p className="text-xs text-muted-foreground text-center">
					Fetching routes and weather data — this takes ~15 seconds
				</p>
			)}
		</form>
	);
}
