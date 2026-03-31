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

import "./App.css";
import usePlaybackFeed from "./hooks/usePlaybackFeed";
import LiveFeed from "./components/LiveFeed";
import HistoryTable from "./components/HistoryTable";
import StatsChart from "./components/StatsChart";
import DebugPanel from "./components/DebugPanel";

function App() {
  // usePlaybackFeed is called here so events can be passed to StatsChart.
  // The hook opens a WebSocket connection and returns live events.
  // "connected" is also used for the global header status indicator.
  const { events, connected } = usePlaybackFeed();

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">MQTrace</h1>
          <span className="app-subtitle">Playback Monitoring Dashboard</span>
        </div>
        <div className="header-right">
          {/* Global WebSocket status — driven by the hook above */}
          <span className={`header-status ${connected ? "status-connected" : "status-disconnected"}`}>
            {connected ? "● Live" : "○ Offline"}
          </span>
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────── */}
      <main className="app-main">

        {/* Top row: Live Feed (left) + Stats Chart (right) */}
        <div className="top-row">
          {/* LiveFeed manages its own WebSocket subscription internally */}
          <LiveFeed />

          {/* StatsChart receives events as a prop — no separate API call needed.
              In React, passing data from parent to child via props is called
              "prop drilling". For two levels deep it's fine; deeper hierarchies
              would use React Context. */}
          <StatsChart events={events} />
        </div>

        {/* Bottom row: full-width history table */}
        <div className="bottom-row">
          <HistoryTable />
        </div>

        {/* Debug panel — collapsible, at the bottom of the page.
            Receives the live events array so it can compute metrics
            (throughput, latency) without opening a second WebSocket. */}
        <DebugPanel events={events} />

      </main>
    </div>
  );
}

export default App;
