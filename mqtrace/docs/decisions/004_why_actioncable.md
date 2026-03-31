# ADR 004 — ActionCable for Real-Time Push to Frontend

## Status
Accepted

## Context

When the backend receives a new playback event via MQTT, the React
dashboard needs to display it immediately — without the user refreshing.

There are several approaches to push data from server to client in real time.

## Decision

Use ActionCable — Rails' built-in WebSocket framework — to push new
playback events to the React frontend as they arrive.

## Rationale

### WebSockets vs Polling

**HTTP Polling (rejected):**
The frontend could call `GET /api/v1/playback_events` every few seconds
and check for new events. Simple to implement, but:
- Wastes resources on every request even when there are no new events
- Introduces latency (up to the polling interval)
- Does not scale with thousands of connected clients

**Server-Sent Events / SSE (considered):**
SSE is a one-way push protocol (server → client) over HTTP.
Simpler than WebSockets for unidirectional data.
Rejected because Rails' native support is limited in API mode,
and ActionCable (WebSockets) is already part of Rails with better tooling.

**WebSockets with ActionCable (accepted):**
- Persistent bidirectional connection (we use server→client direction)
- Native to Rails — no extra dependencies beyond the gem
- Clean channel abstraction: subscribe to a named channel, receive broadcasts
- Client library (`@rails/actioncable`) available as npm package
- Scales well with Redis as the pub/sub adapter (for multi-process/multi-server)

### ActionCable in API Mode

ActionCable is disabled in Rails API mode by default because
it requires some middleware that API mode strips out.
Re-enabling it requires explicit steps (documented in the setup guide):
1. Add `gem 'actioncable'` if not already present
2. Mount the server in routes: `mount ActionCable.server => '/cable'`
3. Configure `config/cable.yml`

This is a known Rails API mode gotcha — documenting it explicitly
saves significant debugging time.

### The MQTT → ActionCable Bridge

The key flow is:
```
MQTT message arrives
        ↓
MqttSubscriberService (background thread)
        ↓
Creates PlaybackEvent in PostgreSQL
        ↓
ActionCable.server.broadcast("playback_events", event.as_json)
        ↓
All subscribed React clients receive the event instantly
```

This decouples the MQTT layer from the WebSocket layer cleanly.
The service does not know or care about WebSockets — it just persists
the event and broadcasts. ActionCable handles the rest.

### Comparison with Spring Boot (for context)

In a Spring Boot application, the equivalent would be:
- STOMP over WebSockets (Spring WebSocket + SockJS)
- Or Spring WebFlux with Server-Sent Events

ActionCable is Rails' opinionated solution — less flexible than
Spring WebSocket but requires far less configuration.

## Consequences

- ActionCable must be manually re-enabled in API mode
- The frontend must install `@rails/actioncable` npm package
- For development, the `async` adapter in `cable.yml` is sufficient
- For production, `redis` adapter is required (Rails broadcasts
  across multiple processes via Redis pub/sub)
- CORS configuration must explicitly allow WebSocket upgrade headers
