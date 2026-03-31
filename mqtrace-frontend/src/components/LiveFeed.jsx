// src/components/LiveFeed.jsx
//
// LiveFeed displays a real-time scrolling list of playback events received
// via WebSocket (ActionCable). Each new event appears at the top of the list.
//
// DATA FLOW:
//   MQTT Broker → Rails MqttSubscriberService → ActionCable broadcast
//   → usePlaybackFeed hook (WebSocket) → this component → rendered list
//
// REACT CONCEPTS USED:
//   - Custom hook (usePlaybackFeed) for WebSocket state management
//   - Conditional rendering for connection status and empty state
//   - List rendering with .map() and key prop
//   - useMemo for color mapping (avoids recomputing on every render)
//
// Java/Spring Boot equivalent: a Spring WebSocket @MessageMapping endpoint
// + a React component subscribed to a SockJS/STOMP topic. The hook replaces
// the SockJS client setup code you'd normally put in a useEffect directly.

import { useMemo } from "react";
import { usePlayback } from "../context/PlaybackContext";

// Color palette for the three screens.
// Each screen gets a distinct left-border color for quick visual identification.
// useMemo ensures this object is created once, not on every render.
const SCREEN_COLORS = {
  "screen-01": "#4f8ef7", // blue
  "screen-02": "#2ecc71", // green
  "screen-03": "#e67e22", // orange
};

// Fallback color for any screen not in the map above.
const DEFAULT_COLOR = "#9b59b6"; // purple

// Helper: format an ISO timestamp to a readable HH:MM:SS string.
// Receiving "2026-03-31T10:38:37.000Z" → "10:38:37"
function formatTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

// selectedScreen prop: when set, only events for that screen are shown.
function LiveFeed({ selectedScreen = "" }) {
  // Read from the shared context — same data as App.jsx and StatsChart.
  // No separate WebSocket, no separate state, no possibility of reset.
  const { events: allEvents, connected } = usePlayback();

  // Apply the global screen filter — empty string means "show all"
  const events = selectedScreen
    ? allEvents.filter((e) => e.screen_id === selectedScreen)
    : allEvents;

  // useMemo caches this computation — only recalculates when `events` changes.
  // Without useMemo, React would re-run this on EVERY render, even unrelated ones.
  // Java equivalent: a @Cacheable method or a lazy-initialized field.
  const screenColorMap = useMemo(() => SCREEN_COLORS, []);

  return (
    <div className="panel live-feed-panel">
      {/* Panel header with connection status indicator */}
      <div className="panel-header">
        <h2>Live Feed</h2>
        {/* Conditional rendering — JSX equivalent of: if (connected) { ... } else { ... } */}
        <span className={`status-badge ${connected ? "status-connected" : "status-disconnected"}`}>
          {connected ? "● Connected" : "○ Disconnected"}
        </span>
      </div>

      {/* Event list — empty state handling */}
      {events.length === 0 ? (
        // Shown when no events have arrived yet.
        // In React, () ? <A/> : <B/> is the ternary conditional render pattern.
        <p className="empty-state">
          {connected
            ? "Waiting for playback events..."
            : "Connecting to live feed..."}
        </p>
      ) : (
        // events.map() transforms each event object into a JSX element.
        // key={event.id} is REQUIRED for lists in React — it lets React efficiently
        // track which items changed/were added/removed (like a database primary key
        // for the virtual DOM diff algorithm).
        <ul className="event-list">
          {events.map((event) => {
            const color = screenColorMap[event.screen_id] || DEFAULT_COLOR;
            return (
              <li
                key={event.id}
                className="event-item"
                style={{ borderLeftColor: color }}
              >
                <div className="event-header">
                  {/* Screen ID badge — colored to match the border */}
                  <span className="screen-badge" style={{ backgroundColor: color }}>
                    {event.screen_id}
                  </span>
                  <span className="event-time">{formatTime(event.started_at)}</span>
                </div>
                <div className="event-body">
                  <span className="asset-name">{event.asset_name}</span>
                  <span className="duration">{event.duration_secs}s</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default LiveFeed;
