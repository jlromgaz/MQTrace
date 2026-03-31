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

function HistoryTable() {
  // State variables:
  // events        → the array of event objects from the API
  // loading       → true while the API request is in flight
  // error         → holds the error message string if the request fails
  // selectedScreen → the currently selected filter value
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScreen, setSelectedScreen] = useState("All");

  // useEffect with [selectedScreen] as dependency:
  // Runs on mount AND every time selectedScreen changes.
  // This is the React way of saying "re-fetch when the filter changes".
  // Java equivalent: calling the service method whenever a @SelectOneMenu
  // valueChangeListener fires, or a @ObservesAsync event arrives.
  useEffect(() => {
    // setLoading(true) shows the loading state immediately when the filter changes.
    setLoading(true);
    setError(null);

    // Build query params: if "All" is selected, send no screen_id filter.
    const params = selectedScreen !== "All" ? { screen_id: selectedScreen } : {};

    getEvents(params)
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        // err.message is the axios error message (e.g. "Network Error" if Rails is down)
        setError(`Failed to load events: ${err.message}`);
        setLoading(false);
      });
  }, [selectedScreen]); // Re-run this effect whenever selectedScreen changes.

  // Auto-refresh: re-fetch every 30 seconds to pick up new events.
  // This is separate from the filter effect — it always runs regardless of filter.
  useEffect(() => {
    // setInterval schedules a function to run repeatedly.
    // Java equivalent: @Scheduled(fixedDelay = 30000)
    const interval = setInterval(() => {
      const params = selectedScreen !== "All" ? { screen_id: selectedScreen } : {};
      getEvents(params)
        .then((data) => setEvents(data))
        .catch(() => {}); // Silently ignore refresh errors — don't disrupt the UI.
    }, 30000);

    // Cleanup: clear the interval when the component unmounts.
    // Without this, the interval would keep firing even after the component is gone.
    return () => clearInterval(interval);
  }, [selectedScreen]);

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
        {/* Filter dropdown — "controlled component" pattern.
            value={selectedScreen} ties the <select> to React state.
            onChange updates state, which triggers a re-render AND the useEffect above.
            Java equivalent: a bound <h:selectOneMenu> in JSF. */}
        <select
          className="screen-filter"
          value={selectedScreen}
          onChange={(e) => setSelectedScreen(e.target.value)}
        >
          {SCREENS.map((screen) => (
            <option key={screen} value={screen}>{screen}</option>
          ))}
        </select>
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
