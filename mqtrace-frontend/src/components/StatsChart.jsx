// src/components/StatsChart.jsx
//
// StatsChart renders a bar chart showing total playback count per screen.
// It receives the live events array as a prop from App.jsx, so it updates
// in real time as new WebSocket events arrive — no separate API call needed.
//
// DATA FLOW:
//   App.jsx (holds live events from usePlaybackFeed)
//     → passes events as prop → StatsChart → aggregates → Recharts BarChart
//
// REACT CONCEPTS USED:
//   - Props: data passed from parent (App.jsx) to child (this component)
//   - useMemo: caches the aggregation computation, only recalculates when events change
//   - Recharts: declarative charting library — describe the chart as JSX, not imperative code
//
// WHY RECEIVE EVENTS AS PROP INSTEAD OF FETCHING AGAIN?
// App.jsx already has the live events array from usePlaybackFeed.
// Passing it as a prop avoids a duplicate API call and keeps the chart
// in sync with the live feed with zero latency.
// Java equivalent: a shared service bean that both a REST endpoint and a
// WebSocket handler read from — single source of truth.

import { useMemo } from "react";
import { usePlayback } from "../context/PlaybackContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Colors matching the LiveFeed component's screen color palette.
const SCREEN_COLORS = {
  "screen-01": "#4f8ef7",
  "screen-02": "#2ecc71",
  "screen-03": "#e67e22",
};
const DEFAULT_COLOR = "#9b59b6";

// StatsChart reads screenCounts from the shared PlaybackContext accumulator.
// This accumulator is never truncated by MAX_EVENTS, so the chart correctly
// reflects ALL historical messages, not just the last 200 in the visible window.
// selectedScreen filters the chart to a single screen if set.
function StatsChart({ selectedScreen = "" }) {
  const { aggregates, totalCount } = usePlayback();

  const chartData = useMemo(() => {
    const counts = aggregates.screenCounts || {};
    const entries = selectedScreen
      ? Object.entries(counts).filter(([screen]) => screen === selectedScreen)
      : Object.entries(counts);
    return entries
      .map(([screen, count]) => ({ screen, count }))
      .sort((a, b) => a.screen.localeCompare(b.screen));
  }, [aggregates.screenCounts, selectedScreen]);

  return (
    <div className="panel stats-chart-panel">
      <div className="panel-header">
        <h2>Playbacks per Screen</h2>
        <span className="event-count">{totalCount.toLocaleString()} total</span>
      </div>

      {chartData.length === 0 ? (
        <p className="empty-state">No data yet — waiting for events...</p>
      ) : (
        // ResponsiveContainer makes the chart fill its parent container width.
        // Without it, Recharts requires explicit pixel dimensions.
        <ResponsiveContainer width="100%" height={220}>
          {/* BarChart is the root chart component from Recharts.
              data={chartData} binds our aggregated array to the chart.
              margin adds padding around the chart area. */}
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {/* CartesianGrid renders the background grid lines. */}
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />

            {/* XAxis reads the "screen" field from each data object for labels. */}
            <XAxis dataKey="screen" tick={{ fill: "#aaa", fontSize: 12 }} />

            {/* YAxis auto-scales to the max count value.
                allowDecimals={false} ensures integer tick marks. */}
            <YAxis allowDecimals={false} tick={{ fill: "#aaa", fontSize: 12 }} />

            {/* Tooltip shows count on hover. */}
            <Tooltip
              contentStyle={{ backgroundColor: "#1e1e2e", border: "1px solid #333", borderRadius: "6px" }}
              labelStyle={{ color: "#fff" }}
              itemStyle={{ color: "#aaa" }}
            />

            {/* Bar renders the actual bars. dataKey="count" reads the count field. */}
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {/* Cell allows per-bar coloring — one Cell per data item. */}
              {chartData.map((entry) => (
                <Cell
                  key={entry.screen}
                  fill={SCREEN_COLORS[entry.screen] || DEFAULT_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default StatsChart;
