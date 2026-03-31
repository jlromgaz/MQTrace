// src/components/AnalyticsPanel.jsx
//
// AnalyticsPanel shows a row of KPI cards computed from the live events stream.
// It also renders the Screen Filter dropdown, which is controlled from App.jsx
// via the onScreenChange / selectedScreen props so all sibling panels respond.
//
// METRICS:
//   1. Total MQTT Messages  — running count of all events in the session
//   2. Most Played Video    — asset_name with highest repeat count
//   3. Most Active Screen   — screen_id with highest event count
//   4. Avg Playback Duration— mean of duration_secs across all events
//   5. Messages / min       — events received in the last 60 seconds
//   6. Screen Filter        — global dropdown (lifted state in App.jsx)

import { useMemo } from "react";
import "./AnalyticsPanel.css";

// ----------------------------------------------------------------------------
// Helper: compute all 6 metrics from the events array
// useMemo in the parent will ensure this is only re-run when events changes.
// ----------------------------------------------------------------------------
function computeMetrics(events) {
  const total = events.length;

  if (total === 0) {
    return {
      total: 0,
      mostPlayedVideo: "—",
      mostActiveScreen: "—",
      avgDuration: "—",
      msgsPerMin: 0,
      screenOptions: [],
    };
  }

  // Count per asset_name
  const assetCounts = events.reduce((acc, e) => {
    acc[e.asset_name] = (acc[e.asset_name] || 0) + 1;
    return acc;
  }, {});
  const mostPlayedVideo = Object.entries(assetCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Count per screen_id
  const screenCounts = events.reduce((acc, e) => {
    acc[e.screen_id] = (acc[e.screen_id] || 0) + 1;
    return acc;
  }, {});
  const mostActiveScreen = Object.entries(screenCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Average duration
  const totalDuration = events.reduce((acc, e) => acc + (Number(e.duration_secs) || 0), 0);
  const avgDuration = (totalDuration / total).toFixed(1) + "s";

  // Messages in the last 60 seconds
  const oneMinAgo = Date.now() - 60_000;
  const msgsPerMin = events.filter((e) => {
    const ts = e.created_at || e.started_at;
    return ts && new Date(ts).getTime() > oneMinAgo;
  }).length;

  // Unique screen IDs for the filter dropdown
  const screenOptions = [...new Set(events.map((e) => e.screen_id))].sort();

  return { total, mostPlayedVideo, mostActiveScreen, avgDuration, msgsPerMin, screenOptions };
}

// ----------------------------------------------------------------------------
// KPI Card — a single metric card with icon, label, and value
// ----------------------------------------------------------------------------
function KpiCard({ icon, label, value, accent }) {
  return (
    <div className={`kpi-card ${accent ? `kpi-accent-${accent}` : ""}`}>
      <span className="kpi-icon">{icon}</span>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">{value}</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// AnalyticsPanel
// Props:
//   events         — full (unfiltered) live events array from App.jsx
//   selectedScreen — currently selected screen filter ("" = all)
//   onScreenChange — callback to lift the filter state up to App.jsx
// ----------------------------------------------------------------------------
function AnalyticsPanel({ events, selectedScreen, onScreenChange }) {
  const { total, mostPlayedVideo, mostActiveScreen, avgDuration, msgsPerMin, screenOptions } =
    useMemo(() => computeMetrics(events), [events]);

  return (
    <div className="analytics-panel">
      {/* ── Row 1: KPI Cards ─────────────────────────────────────── */}
      <div className="kpi-grid">
        <KpiCard icon="📡" label="Total MQTT Messages" value={total.toLocaleString()} accent="blue" />
        <KpiCard icon="🎬" label="Most Played Video"   value={mostPlayedVideo}          accent="purple" />
        <KpiCard icon="📺" label="Most Active Screen"  value={mostActiveScreen}         accent="green" />
        <KpiCard icon="⏱"  label="Avg Playback Duration" value={avgDuration}            accent="orange" />
        <KpiCard icon="📶" label="Messages / min"      value={msgsPerMin.toLocaleString()} accent="teal" />

        {/* ── Screen Filter card ─────────────────────────────────── */}
        <div className="kpi-card kpi-filter-card">
          <span className="kpi-icon">🔍</span>
          <div className="kpi-body">
            <span className="kpi-label">Filter by Screen</span>
            <select
              id="screen-filter-select"
              className="kpi-select"
              value={selectedScreen}
              onChange={(e) => onScreenChange(e.target.value)}
            >
              <option value="">All Screens</option>
              {screenOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPanel;
