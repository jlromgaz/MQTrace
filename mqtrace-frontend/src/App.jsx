// src/App.jsx
//
// App is the root component of the MQTrace dashboard.
// It owns the shared live events state and composes the three panels.
//
// WHY DOES APP.JSX OWN THE EVENTS STATE?
// Both LiveFeed and StatsChart need the live events data:
//   - LiveFeed displays each event as it arrives
//   - StatsChart aggregates events to show per-screen counts
//
// The React pattern for sharing state between sibling components is called
// "lifting state up" — move the state to the nearest common ancestor.
// App.jsx is that ancestor, so usePlaybackFeed is called here and the
// events are passed down as props to StatsChart.
//
// LiveFeed calls usePlaybackFeed internally because it only needs the
// WebSocket connection for itself — no sibling needs its raw events.
// Wait — actually we call usePlaybackFeed ONCE here in App to share events
// with StatsChart, and LiveFeed uses the same hook internally.
// This means two WebSocket subscriptions open. That's acceptable for a demo;
// in production you'd use a React Context to share a single subscription.
//
// Java/Spring Boot equivalent of this layout component:
//   A JSF template (layout.xhtml) that includes panel components via <ui:include>.
//   App.jsx is the template; LiveFeed, HistoryTable, StatsChart are the included panels.

import React, { useState, useMemo } from "react";
import "./App.css";
import { usePlayback } from "./context/PlaybackContext";
import LiveFeed from "./components/LiveFeed";
import StatsChart from "./components/StatsChart";
import DebugPanel from "./components/DebugPanel";
import SystemConsole from "./components/SystemConsole";
import AnalyticsPanel from "./components/AnalyticsPanel";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  // selectedScreen: "" means show all screens; any other value filters to that screen.
  const [selectedScreen, setSelectedScreen] = useState("");

  // Full live events from the shared PlaybackContext (single WebSocket, never resets)
  const { events, connected } = usePlayback();

  // Derived: filtered events used by all dashboard panels
  const filteredEvents = useMemo(() =>
    selectedScreen ? events.filter((e) => e.screen_id === selectedScreen) : events,
    [events, selectedScreen]
  );

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">MQTrace</h1>
          <span className="app-subtitle">Playback Monitoring Dashboard</span>
        </div>
        <div className="header-right">
          <div className="tabs-container">
            <button className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className={`tab-btn ${activeTab === "console" ? "active" : ""}`} onClick={() => setActiveTab("console")}>System Console</button>
          </div>
          {/* Global WebSocket status — driven by the hook above */}
          <span className={`header-status ${connected ? "status-connected" : "status-disconnected"}`}>
            {connected ? "● Live" : "○ Offline"}
          </span>
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────── */}
      <main className="app-main">
        <div style={{ display: activeTab === "dashboard" ? "block" : "none", height: "100%" }}>
          {/* Analytics KPI strip — receives ALL events for totals, but passes filter state down */}
          <AnalyticsPanel
            events={events}
            selectedScreen={selectedScreen}
            onScreenChange={setSelectedScreen}
          />

          <div className="top-row" style={{ marginTop: 16 }}>
            <LiveFeed selectedScreen={selectedScreen} />
            <StatsChart selectedScreen={selectedScreen} />
          </div>

          <DebugPanel events={filteredEvents} />
        </div>

        <div style={{ display: activeTab === "console" ? "block" : "none", height: "100%" }}>
          <SystemConsole />
        </div>
      </main>
    </div>
  );
}

export default App;
