// src/components/HistoryTable.jsx
//
// HistoryTable fetches persisted playback events from the Rails REST API
// and displays them in a filterable, auto-refreshing table.
//
// DATA FLOW:
//   Rails REST API (GET /api/v1/playback_events) → axios → this component → table
//
// REACT CONCEPTS USED:
//   - useState for events, loading, error, and filter state
//   - useEffect for data fetching on mount and on filter change
//   - Dependency array in useEffect to re-fetch when selectedScreen changes
//   - Controlled component pattern for the filter <select>
//
// Java/Spring Boot equivalent: a JSF/Thymeleaf table that calls a
// @GetMapping endpoint on load and on filter change. Here the "controller"
// logic lives inside the component via hooks.

import { useState, useEffect } from "react";
import { getEvents } from "../services/api";

// Known screens for the filter dropdown.
// In a production app this list could be fetched from an API endpoint.
const SCREENS = ["All", "screen-01", "screen-02", "screen-03"];

// Helper: format ISO datetime to a readable local string.
function formatDateTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-GB", { hour12: false });
}

// selectedScreen is now controlled by App.jsx via the AnalyticsPanel global filter.
function HistoryTable({ selectedScreen = "" }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Convert the global filter value ("") to the API param format
  const screenParam = selectedScreen || null;

  // useEffect with [selectedScreen] as dependency:
  // Runs on mount AND every time selectedScreen changes.
  // This is the React way of saying "re-fetch when the filter changes".
  // Java equivalent: calling the service method whenever a @SelectOneMenu
  // valueChangeListener fires, or a @ObservesAsync event arrives.
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = screenParam ? { screen_id: screenParam } : {};
    getEvents(params)
      .then((data) => { setEvents(data); setLoading(false); })
      .catch((err) => { setError(`Failed to load events: ${err.message}`); setLoading(false); });
  }, [screenParam]);

  useEffect(() => {
    const interval = setInterval(() => {
      const params = screenParam ? { screen_id: screenParam } : {};
      getEvents(params).then((data) => setEvents(data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [screenParam]);

  // Render loading state.
  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header"><h2>History</h2></div>
        <p className="empty-state">Loading events...</p>
      </div>
    );
  }

  // Render error state.
  if (error) {
    return (
      <div className="panel">
        <div className="panel-header"><h2>History</h2></div>
        <p className="error-state">{error}</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>History</h2>
        {selectedScreen && (
          <span className="event-count">Filtered: {selectedScreen}</span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="empty-state">No events found.</p>
      ) : (
        <div className="table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Screen</th>
                <th>Asset</th>
                <th>Started At</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><span className="screen-tag">{event.screen_id}</span></td>
                  <td>{event.asset_name}</td>
                  <td>{formatDateTime(event.started_at)}</td>
                  <td>{event.duration_secs}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="refresh-note">Auto-refreshes every 30 seconds</p>
    </div>
  );
}

export default HistoryTable;
