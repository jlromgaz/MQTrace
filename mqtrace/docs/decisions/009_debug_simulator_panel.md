# ADR 009 — Debug Simulator Control Panel

## Status
Accepted

## Context

During development and stress testing, the simulator runs as an external Ruby script
with fixed parameters (3 screens, 2-5 second interval). This makes it impossible to:
- Adjust frequency without restarting the script
- Run burst/load tests from the dashboard itself
- Observe system behaviour metrics (throughput, latency) in real time
- Demonstrate the system under different load conditions

## Decision

Add two things:

### 1. SimulatorControlService (Rails backend)
A new Rails service that replicates the screen simulator internally, controllable
via a REST API. This runs inside the Rails process (like MqttSubscriberService)
in its own thread, and can be started/stopped/reconfigured at runtime via API calls.

Why inside Rails instead of the external script?
- The external script has no API surface — you can't talk to it
- Running simulation from Rails means one less process to manage during testing
- The external script still exists as an alternative (useful for production-like testing)

### 2. Debug Panel (React frontend)
A collapsible debug panel added to the dashboard with:
- Start / Stop simulation toggle
- Interval slider: 100ms → 5000ms (events per second equivalent shown)
- Active screens: 1 to 10 (dynamically named screen-01 through screen-10)
- Burst mode button: fires 20 events immediately regardless of interval
- Live metrics:
  - Events received (WebSocket counter, resets on page load)
  - Events/second (rolling 5-second window)
  - Estimated latency (time between started_at in payload and received_at in browser)
  - Total events in database (from REST API)

## API Design

### POST /api/v1/simulator/start
Body:
```json
{
  "interval_ms": 500,
  "screen_count": 5
}
```
Response: `{ "status": "started", "interval_ms": 500, "screen_count": 5 }`

### POST /api/v1/simulator/stop
Response: `{ "status": "stopped" }`

### POST /api/v1/simulator/burst
Body: `{ "count": 20 }`
Response: `{ "status": "ok", "fired": 20 }`

### GET /api/v1/simulator/status
Response: `{ "running": true, "interval_ms": 500, "screen_count": 5 }`

## Implementation Plan

### Backend
1. `app/services/simulator_service.rb` — thread-based simulator, same pattern as
   MqttSubscriberService but publishes instead of subscribes
2. `app/controllers/api/v1/simulator_controller.rb` — thin REST controller
3. `config/routes.rb` — add simulator routes under api/v1
4. `config/initializers/simulator.rb` — registers service instance (singleton)
   so the controller can reference it

### Frontend
1. `src/components/DebugPanel.jsx` — the control panel component
2. `src/hooks/useSimulatorMetrics.js` — custom hook tracking events/sec and latency
3. `src/services/api.js` — add simulator API calls
4. `src/App.jsx` — add DebugPanel to layout (collapsible, bottom of page)

## Metrics Implementation

Latency is estimated as:
  latency_ms = Date.now() - new Date(event.started_at).getTime()

This is not true network latency — it includes:
  - MQTT publish time
  - Rails processing time (DB write + ActionCable broadcast)
  - WebSocket delivery time
  - React render time

It IS a useful end-to-end "time from event creation to screen rendering" metric.

Events/second is computed as a rolling window:
  Keep a timestamp array of the last N received events.
  Filter to those within the last 5 seconds.
  events_per_sec = count / 5.0

## Alternatives Considered

**Control the external script via signals (SIGUSR1, etc.)**
Rejected — cross-process signal handling on Windows is unreliable.

**WebSocket control channel from React to simulator**
Rejected — adds complexity; REST API is simpler and sufficient.

**Separate simulator microservice**
Rejected — overkill for a dev/demo tool.

## Consequences

- The simulator is now dual-mode: external script (production-like) OR
  internal API-controlled (development/testing)
- The debug panel is clearly separated visually (collapsible, labelled "Debug")
  so it doesn't clutter the main dashboard
- Metrics in the panel give quantitative feedback for stress testing
