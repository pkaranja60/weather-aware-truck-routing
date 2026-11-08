# Weather-Aware Truck Routing — Frontend Application

The frontend client is built with React 19, TypeScript (strict mode), Vite 8, Tailwind CSS v4, Base UI, and TanStack Router. It adheres strictly to the Universal Code Formatting & Architecture Standard (UCFAS) Domain-First architecture.

---

## Architecture: Domain-First Design

Code is organized by business capability under `src/domains/truck-routes/` rather than by technical file type. Each domain exposes a single public entry point (`index.ts`).

```
frontend/src/
├── app.tsx                         # TanStack Router tree definition & RootLayout
├── main.tsx                        # React application bootstrap & Inter font import
├── components/ui/                  # Headless Base UI + Vega primitive components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── select.tsx
│   └── slider.tsx
└── domains/
    └── truck-routes/               # Commercial Truck Routes Domain
        ├── index.ts                # Single public gateway entry point
        ├── components/             # Domain-specific UI components
        │   ├── forecast-slider.tsx # 48-hour timeline scrubber with weather icons
        │   ├── risk-badge.tsx      # Standardized hazard level badge
        │   ├── route-form.tsx      # Origin/Destination form with loader state
        │   ├── route-map.tsx       # Leaflet map with colored risk polylines
        │   └── route-summary-cards.tsx # 2-column comparative route metrics
        ├── hooks/                  # Domain custom hooks
        │   └── use-route-query.ts  # Route query fetching & polling hook
        ├── services/               # Explicit service containers
        │   ├── risk.calculation.ts # Client risk helpers & color mapping
        │   └── routes.service.ts   # routesService.create and routesService.getById
        ├── tests/                  # Domain unit tests
        │   └── routes.service.test.ts # Vitest API and validation test suite
        ├── types/                  # Strict TypeScript domain interfaces
        │   └── index.ts            # Route, Checkpoint, Weather, RiskLevel types
        ├── validation/             # System boundary validation
        │   └── route-plan.validation.ts # Input sanitization & range verification
        └── views/                  # Domain full-page views
            ├── home-page.tsx       # Route planning form view
            └── results-page.tsx    # Interactive map, summary & slider dashboard
```

---

## Key Features

- **Route Planning Form**: Validates city/state input, departure schedule, gross cargo weight (lbs), and checkpoint frequency (10, 25, or 50 miles) with animated submit loaders.
- **Dynamic Leaflet Map**: Renders full GeoJSON geometries for alternative routes with color-coded risk paths (Green = Low, Yellow = Moderate, Orange = High, Red = Severe, Black = No Travel) and interactive checkpoint markers.
- **Comparative Route Cards**: Side-by-side or stacked 2-column cards detailing distance, estimated driving duration, checkpoint quantity, and aggregated risk counts.
- **48-Hour Forecast Timeline**: Interactive slider enabling dispatchers to scrub across a 48-hour horizon to preview changing atmospheric conditions.

---

## Tech Stack & Tooling

| Tool | Purpose |
|---|---|
| **React 19** | User interface framework |
| **Vite 8** | Modern build tool and development server |
| **Tailwind CSS v4** | Utility-first styling with `@tailwindcss/vite` |
| **Base UI + shadcn/ui** | Accessible headless UI primitives (Vega style) |
| **TanStack Router** | Type-safe, declarative client-side routing |
| **Leaflet & React-Leaflet** | Interactive mapping and route geometry rendering |
| **Ultracite (Biome 2.6)** | Strict code formatting and linting standard |
| **Oxlint** | High-performance AST linting |
| **Vitest** | Fast unit and integration testing runner |

---

## Development & Build Commands

```bash
# Install dependencies
bun install

# Start development server (http://localhost:5173)
bun run dev

# Run Ultracite (Biome) format & lint check
bun run check

# Automatically fix Ultracite code style & formatting issues
bun run fix

# Run Oxlint static analysis
bun run lint

# Run Vitest test suite
bunx vitest run

# Typecheck and create production build
bun run build

# Preview production build locally
bun run preview
```

---

## Environment Configuration

Configure the backend API URL in `.env`:

```env
VITE_API_URL=http://localhost:8000/api
```
