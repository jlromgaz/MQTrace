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
import { usePlayback } from "../context/PlaybackContext";
import "./AnalyticsPanel.css";

// computeLocalMetrics: derives screen filter options from the visible event window.
function computeLocalMetrics(events) {
  const screenOptions = [...new Set(events.map((e) => e.screen_id))].sort();
  return { screenOptions };
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
  const { totalCount, msgsPerMin, aggregates } = usePlayback();
  const { mostPlayedVideo, mostActiveScreen, avgDuration } = aggregates;

  // screenOptions from the visible window is fine — only used for dropdown
  const { screenOptions } = useMemo(() => computeLocalMetrics(events), [events]);

  return (
    <div className="analytics-panel">
      {/* ── Row 1: KPI Cards ─────────────────────────────────────── */}
      <div className="kpi-grid">
        <KpiCard icon="📡" label="Total MQTT Messages" value={totalCount.toLocaleString()} accent="blue" />
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
