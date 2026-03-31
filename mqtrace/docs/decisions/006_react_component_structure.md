# ADR 006 — React Component Structure

## Status
Accepted

## Context

The React frontend needs to display three types of information:
1. A live feed of incoming playback events (real-time)
2. A historical table of all events (REST API)
3. A chart showing stats per screen

Decisions about component structure, state management, and data flow
affect maintainability and readability.

## Decision

Use a flat component hierarchy with a single top-level state owner (App.jsx),
passing data down to child components via props.

## Component Breakdown

```
App.jsx                          ← owns top-level state, fetches initial data
├── LiveFeed.jsx                 ← receives live events via usePlaybackFeed hook
├── StatsChart.jsx               ← receives events array as prop, computes stats
└── HistoryTable.jsx             ← fetches its own data via REST API
```

### App.jsx responsibilities
- Renders the overall layout (two columns + table)
- Passes data to StatsChart for aggregation
- Renders connection status from usePlaybackFeed

### LiveFeed.jsx
- Uses the `usePlaybackFeed` custom hook (see ADR 007)
- Renders an auto-scrolling list of events
- Color-codes rows by screen_id for visual distinction
- Shows the last 50 events maximum (older events are dropped from state)
- Does NOT fetch from API — only receives live WebSocket events

### StatsChart.jsx
- Receives the `events` array as a prop (from App via LiveFeed)
- Groups events by screen_id and counts total playbacks
- Renders a Recharts BarChart
- Updates automatically when the events array changes (React re-render)
- Uses `useMemo` to avoid recomputing stats on every render

### HistoryTable.jsx
- Has its own local state for the events list and loading/error status
- Fetches from `GET /api/v1/playback_events` on mount (useEffect)
- Supports filter by screen_id (dropdown)
- Refreshes every 30 seconds (useEffect with setInterval)
- Is intentionally independent from LiveFeed — shows persisted data,
  not just in-memory WebSocket data

## Why Not a State Management Library (Redux, Zustand)?

For a project of this size, a state management library adds complexity
without meaningful benefit. The component tree is shallow (2 levels max)
and props drilling is minimal.

If the project grew to 20+ components with shared state, introducing
Zustand (lightweight) or Redux Toolkit would be appropriate.

## Comparison with Java/Spring Boot (for context)

In a Spring Boot application with Thymeleaf, the "component" is the
HTML template rendered server-side. State lives on the server.

In React, state lives on the client. Components are functions that
receive data (props) and return UI. When data changes, React
automatically re-renders only the affected components — the Observer
pattern applied to UI rendering.

## Styling Decision

Use inline styles and a minimal CSS file — no CSS framework.
Rationale: keeps focus on the JavaScript/React logic, not styling.
The project's purpose is to demonstrate architectural understanding,
not UI design skills.

## Consequences

- App.jsx is the single source of truth for the live events array
- HistoryTable is self-contained and independently testable
- StatsChart is a pure display component (receives data, renders chart)
- No state management library required
- Component files stay small and focused (under 100 lines each)
