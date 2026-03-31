# ADR 003 — Ruby on Rails in API Mode

## Status
Accepted

## Context

Ruby on Rails can be used in two modes:
1. Full stack — includes the view layer (ERB templates, asset pipeline, etc.)
2. API mode — strips out view-related middleware, returns JSON only

MQTrace needs a backend that serves JSON to a React frontend.

## Decision

Use Rails in API mode: `rails new mqtrace --api`

## Rationale

### No server-side rendering needed
The frontend is a React application — it handles all rendering.
Rails only needs to serve JSON responses and manage WebSocket connections.
The view layer (ERB templates, helpers, asset pipeline) would add weight
with zero benefit.

### API mode is leaner and faster
Rails API mode removes approximately 15 middleware layers that are
irrelevant for a JSON API:
- Cookie handling (we use JWT or no auth in this demo)
- Flash messages
- Session management
- Browser-specific middleware

The result is a lighter, faster Rails app.

### Separation of concerns
Keeping the backend (Rails) and frontend (React/Vite) as separate projects
with a clean API boundary is the modern standard for building web applications.
It allows each to be deployed, scaled, and developed independently.

### Comparison with Spring Boot (for context)
Rails API mode is equivalent to a Spring Boot application annotated with
`@RestController` throughout — no Thymeleaf, no server-side templates,
just JSON in and JSON out. The philosophy is the same.

## Rails Conventions to Be Aware Of

### Convention over Configuration
Rails assumes a standard project structure. If you follow the conventions,
you write almost no configuration. For example:
- A model named `PlaybackEvent` automatically maps to table `playback_events`
- A controller named `PlaybackEventsController` automatically handles
  routes under `/playback_events`
- Files go in specific folders — Rails finds them automatically (autoloading)

This is equivalent to Spring Boot's `@ComponentScan` and auto-configuration,
but more aggressive — Rails assumes MORE by default.

### Generators
Rails provides generators that create files with the correct names,
in the correct locations, with boilerplate code already in place.
Use them — they enforce conventions automatically:
```bash
rails generate model PlaybackEvent screen_id:string asset_name:string
rails generate controller api/v1/playback_events
rails generate channel Playback
```

### Namespacing the API
All controllers live under `api/v1/` namespace.
This is a Rails convention for versioned APIs.
It maps to URLs like `/api/v1/playback_events`.
In the future, a breaking change would go in `api/v2/` without
affecting existing clients.

## Consequences

- ActionCable (WebSockets) must be explicitly re-enabled in API mode
  (it is disabled by default) — see ADR 004
- CORS must be configured explicitly — the frontend runs on a different port
- No session/cookie middleware — this is fine for a stateless JSON API
