# Weather-Aware Truck Routing — Backend Service

The backend is built with Django 4.2 and Django REST Framework (DRF). It provides geocoding, turn-by-turn route generation with alternative options, temporal weather interpolation, dynamic freight risk scoring, and SQLite persistence.

---

## Architecture & Service Layer

The application logic is decoupled into dedicated service containers under `routes/services/`:

```
backend/
├── config/                   # Django settings, WSGI/ASGI, root URLs
│   ├── settings.py           # App configuration, CORS, third-party API base URLs
│   └── urls.py               # Root API router mounting /api/
├── routes/
│   ├── models.py             # RouteQuery, Route, Checkpoint schema definitions
│   ├── serializers.py        # DRF request & response serializers
│   ├── views.py              # API view endpoints & transaction handling
│   ├── urls.py               # /api/routes/ routing endpoints
│   └── services/
│       ├── routing.py        # Nominatim geocoding & OSRM routing engine
│       ├── weather.py        # Open-Meteo forecast fetching & checkpoint enrichment
│       └── risk_calculator.py# Dynamic freight risk scoring & route recommendation
├── manage.py
└── requirements.txt
```

### Core Services

#### 1. Routing Engine (`services/routing.py`)
- **Geocoding**: Translates human-readable location strings (e.g., `"Los Angeles, CA"`) into latitude/longitude coordinates via Nominatim with required custom User-Agent headers.
- **Path Calculation**: Calls the OSRM Driving API (`http://router.project-osrm.org/route/v1/driving`) requesting `alternatives=true`, `steps=true`, and `geometries=geojson`.
- **Checkpoint Interpolation**: Splits the continuous route polyline into discrete checkpoints every `N` miles (10, 25, or 50 miles) and calculates cumulative estimated arrival times based on segment speed limits and traffic estimates.

#### 2. Weather Engine (`services/weather.py`)
- **Temporal Alignment**: Queries Open-Meteo hourly forecasts for each checkpoint coordinate at its specific estimated arrival timestamp.
- **Metrics Collected**: Surface temperature (°C/°F), precipitation rate (mm/h), snowfall (cm), wind speed (mph), wind gusts (mph), visibility (meters), and WMO weather condition codes.
- **48-Hour Forecast Horizon**: Pulls 48-hour hourly weather data at the origin node to support timeline scrubbing in the client interface.

#### 3. Freight Risk Calculator (`services/risk_calculator.py`)
- **Crosswind & Weight Risk**: Evaluates wind speed and gust hazards. Adjusts danger thresholds dynamically based on truck trailer weight (e.g., unladen or light trailers are subject to rollover risk at lower wind speeds).
- **Freezing Precipitation**: Detects freezing rain, black ice, and heavy snow when precipitation co-occurs with near-freezing or sub-zero road temperatures.
- **Visibility Degradation**: Scores fog, blizzard, and heavy rain conditions where visibility drops below commercial safety thresholds.
- **Categorization**: Produces individual checkpoint risk levels (`Low`, `Moderate`, `High`, `Severe`, `No Travel`) and computes an overall route risk score.

---

## REST API Specification

### 1. Plan Routes

- **Endpoint**: `POST /api/routes/plan/`
- **Request Body**:

```json
{
  "origin": "Los Angeles, CA",
  "destination": "Oakland, CA",
  "departure_datetime": "2026-11-08T08:00:00Z",
  "load_weight_lbs": 35000,
  "checkpoint_interval": 25
}
```

- **Validation Rules**:
  - `origin` & `destination`: Required non-empty strings.
  - `departure_datetime`: Required valid ISO 8601 datetime.
  - `load_weight_lbs`: Optional float (>= 0).
  - `checkpoint_interval`: Optional integer (restricted to `10`, `25`, or `50`). Defaults to `25`.
- **Response**: `201 Created` returning the serialized `RouteQuery` object including all alternative routes, checkpoints, weather data, and recommended route ID.

### 2. Retrieve Query Detail

- **Endpoint**: `GET /api/routes/{query_id}/`
- **Parameters**: `query_id` (UUID string)
- **Response**: `200 OK` returning full route details, geometry coordinates, checkpoints, and 48-hour forecast timeline.

### 3. List Recent Queries

- **Endpoint**: `GET /api/routes/`
- **Response**: `200 OK` returning an array of recent route queries with summary metadata (origin, destination, departure time, overall risk level).

### 4. Health Check

- **Endpoint**: `GET /api/health/`
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "service": "weather-aware-truck-routing"
}
```

---

## Local Setup & Development

### 1. Environment Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv

# Activate environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Run Development Server

```bash
python manage.py runserver 0.0.0.0:8000
```

---

## Configuration Reference

Optional environment overrides in `backend/.env`:

```env
SECRET_KEY=your-production-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
NOMINATIM_USER_AGENT=SpotterRouteApp/1.0
```
