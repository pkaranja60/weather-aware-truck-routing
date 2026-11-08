# Spotter AI — 5-Minute Loom Video Walkthrough Guide
> **Target Duration**: 4:20 – 4:30 *(Safe from Loom 5:00 hard limit)*  
> **Live App**: [https://weather-aware-routing-two.vercel.app/](https://weather-aware-routing-two.vercel.app/)  
> **GitHub**: [https://github.com/pkaranja60/weather-aware-truck-routing](https://github.com/pkaranja60/weather-aware-truck-routing)

---

## Pre-Recording Setup (Do this before pressing Record)
1. **Browser Tab 1**: Open [`https://weather-aware-routing-two.vercel.app/`](https://weather-aware-routing-two.vercel.app/) (at the initial Form).
2. **Browser Tab 2**: Open your GitHub repo or VS Code showing the project folder tree.
3. **Screen**: Record full screen or browser window at 1080p.

---

## Unified Cue-Card & Script

| Timestamp | Visual Action (What to Show & Click) | Speaking Script (What to Say) |
|---|---|---|
| **0:00 – 0:45** | **Show Tab 1: Form**<br>• Type `London, England`<br>• Type `Copenhagen, Denmark`<br>• Pick tomorrow's date<br>• Enter `50,000` lbs<br>• Select `25` miles<br>• Click **"Plan Route"** | *"Hi! Welcome to Spotter AI, a weather-aware routing platform for commercial freight. Standard GPS apps only optimize for distance and traffic, ignoring severe atmospheric hazards that cause truck rollovers and jackknifes.<br><br>In our planner form, I’ve entered London to Copenhagen with a heavy 50,000-lb load and 25-mile checkpoints. Clicking 'Plan Route' queries our Django backend, which geocodes both points, calls OSRM to generate three highway alternatives, and samples weather forecasts along each leg at the truck's exact estimated arrival time."* |
| **0:45 – 1:45** | **Show Results Page + Quick Tab 2 Flash**<br>• Results load smoothly<br>• Flash Tab 2 (VS Code / GitHub) for 10s<br>• Return to Results Page | *"Our architecture is a decoupled monorepo: Django REST with PostgreSQL on Render, and React 19 / Vite on Vercel. Code is strictly Domain-First under `src/domains/truck-routes/`, adhering to a 200-line file limit with zero Biome lint errors.<br><br>During deployment on Render, we overcame a major real-world challenge: Render's shared AWS datacenter IP triggered Open-Meteo's 429 rate-limit blocks. We solved this with three resiliency layers:<br>1. Native multi-coordinate batching, consolidating 40 calls into 1 single HTTP request.<br>2. Komoot Photon geocode fallback when Nominatim throttles.<br>3. Deterministic atmospheric synthesis, ensuring the 48-hour timeline and heatmap never freeze."* |
| **1:45 – 2:45** | **Show Left Sidebar Cards**<br>• Hover over Route 1, 2, 3<br>• Point to **Hazard Breakdown**<br>• Point to Progress Bar (`32 Low · 4 Moderate`) | *"Each checkpoint is evaluated against strict safety thresholds:<br>• Wind: Low under 25 mph, Moderate 25–34, High 35–44, Severe 45–54, and No Travel above 55 mph.<br>• Rain: Low under 0.10 in/hr, Moderate 0.10–0.25, High up to 0.50, Severe up to 1.00, and No Travel above 1.00.<br>• Snow: Low under 0.5 in/hr up to No Travel above 3.0.<br><br>Crucially, our backend applies freight load overrides: wind above 55 mph bans travel; wind over 45 mph with cargo over 30,000 lbs bans travel; and wind over 35 mph with cargo over 40,000 lbs escalates to Severe. Because our trailer is 50,000 lbs, crosswind risks are aggressively escalated to prevent rollover accidents."* |
| **2:45 – 3:45** | **Show Map + 48H Slider**<br>• Click Route 2 (purple line activates)<br>• Click Route 1 (blue line activates)<br>• Hover over a checkpoint dot on map<br>• Drag bottom-left **48H FORECAST** slider: `Now` $\rightarrow$ `+12h` $\rightarrow$ `+24h` | *"On our Leaflet map, all three route corridors are displayed simultaneously. Checkpoints feature color-coded risk markers and glow rings for severe hazards. Hovering over any checkpoint shows its arrival ETA, exact wind speed, and rain rate.<br><br>In the bottom left is our 48-Hour Forecast Slider, acting as a departure time simulator. As I drag the slider forward in time, checkpoints along the corridor dynamically recalculate their safety levels, accounting for the truck's highway driving delay. This allows dispatchers to simulate departure windows and find the exact hour when storms clear and the entire corridor turns green."* |
| **3:45 – 4:25** | **Show ★ Best Badge & Header**<br>• Point to blue **★ Best** badge on Route 1<br>• Point to top-right header badges (`Recommended: Route 1` vs `Viewing`) | *"Finally, our recommendation engine selects the optimal route using a strict 4-tier hierarchy:<br>1. Fewest Severe checkpoints.<br>2. Fewest High checkpoints.<br>3. Fewest Moderate checkpoints.<br>4. Shortest travel time.<br><br>Notice Route 1 is marked '★ Best'. Because hazard exposure is tied across alternatives, Route 1 wins on travel time at 15 hours and 5 minutes, saving over 3.5 hours compared to the 18-hour detour on Route 2.<br><br>Thank you for reviewing Spotter AI!"* |

---

## 5-Point Rubric Quick Check
- [x] **40% Backend & Routing**: 3 OSRM routes, checkpoint weather sampling, load-weight overrides.
- [x] **40% UI & Map**: Simultaneous routes, checkpoint markers & glow rings, hover tooltip, 48h slider.
- [x] **15% Code Quality**: Domain-First modularity ($\le 200$ lines), strict TypeScript, zero lint errors, 5/5 Vitest.
- [x] **5% Documentation**: Walkthrough guide (`LOOM_WALKTHROUGH_GUIDE.md`), `README.md`, hosted live links.
