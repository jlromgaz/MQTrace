// src/components/DebugPanel.jsx
//
// DebugPanel is a collapsible developer tool for controlling and observing
// the MQTrace simulation in real time.
//
// SECTIONS:
//   1. Metrics bar  — live events/sec, total received, avg latency, peak rate
//   2. Simulator controls — start/stop toggle, interval slider, screen count
//   3. Burst button — fires N events immediately for spike testing
//
// PROPS:
//   events — live event array from App.jsx (usePlaybackFeed)
//
// NOTE ON "STOP":
//   Stop only halts the INTERNAL SimulatorService running inside Rails.
//   If you also ran the external `screen_simulator.rb` Ruby script in a
//   terminal, that process is independent — you must stop it with Ctrl+C
//   in that terminal. The panel detects this situation (events arriving
//   while internal simulator is stopped) and shows a warning.

import { useState, useEffect, useCallback, useRef } from "react";
import useSimulatorMetrics from "../hooks/useSimulatorMetrics";
import {
  getSimulatorStatus,
  startSimulator,
  stopSimulator,
  burstSimulator,
} from "../services/api";

const STATUS_POLL_INTERVAL = 3000;

function DebugPanel({ events }) {
  const [isOpen, setIsOpen] = useState(true);

  const [serverStatus, setServerStatus] = useState({
    running: false,
    interval_ms: 2000,
    screen_count: 3,
    events_per_sec: 0,
  });

  const [intervalMs,  setIntervalMs]  = useState(2000);
  const [screenCount, setScreenCount] = useState(3);
  const [burstCount,  setBurstCount]  = useState(20);

  // isDragging prevents the status poll from overwriting slider values
  // while the user is actively dragging a slider handle.
  const isDraggingRef = useRef(false);

  const [isBursting,  setIsBursting]  = useState(false);
  const [burstResult, setBurstResult] = useState(null);
  const [apiError,    setApiError]    = useState(null);

  const { totalReceived, eventsPerSec, avgLatencyMs, minLatencyMs, peakEventsPerSec } =
    useSimulatorMetrics(events);

  // Detect if an external script is sending events while internal sim is stopped.
  // If events/sec > 0 but the internal simulator is not running, the external
  // screen_simulator.rb script must be active.
  const externalScriptActive = eventsPerSec > 0 && !serverStatus.running;

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getSimulatorStatus();
      setServerStatus(status);
      // Only sync sliders if the user is not currently dragging them
      if (!isDraggingRef.current) {
        setIntervalMs(status.interval_ms);
        setScreenCount(status.screen_count);
      }
      setApiError(null);
    } catch {
      setApiError("Cannot reach Rails server — is it running?");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const poll = setInterval(fetchStatus, STATUS_POLL_INTERVAL);
    return () => clearInterval(poll);
  }, [fetchStatus]);

  const handleToggle = async () => {
    try {
      setApiError(null);
      if (serverStatus.running) {
        await stopSimulator();
      } else {
        await startSimulator({ interval_ms: intervalMs, screen_count: screenCount });
      }
      await fetchStatus();
    } catch (e) {
      setApiError(`API error: ${e.message}`);
    }
  };

  const handleApplyConfig = async () => {
    try {
      setApiError(null);
      await startSimulator({ interval_ms: intervalMs, screen_count: screenCount });
      await fetchStatus();
    } catch (e) {
      setApiError(`API error: ${e.message}`);
    }
  };

  const handleBurst = async () => {
    setIsBursting(true);
    setBurstResult(null);
    try {
      const result = await burstSimulator(burstCount);
      setBurstResult(`✓ Fired ${result.fired} events`);
    } catch (e) {
      setBurstResult(`✗ ${e.message}`);
    } finally {
      setIsBursting(false);
      setTimeout(() => setBurstResult(null), 3000);
    }
  };

  const configuredRate = intervalMs > 0
    ? (1000 / intervalMs).toFixed(1)
    : "∞";

  return (
    <div className="debug-panel">
      {/* ── Header / toggle ───────────────────────────────────────────── */}
      <button className="debug-toggle" onClick={() => setIsOpen(o => !o)}>
        <span className="debug-label">⚙ Debug</span>
        <span className={`debug-running-dot ${serverStatus.running ? "dot-running" : externalScriptActive ? "dot-external" : "dot-idle"}`}>
          {serverStatus.running
            ? "● Internal simulator running"
            : externalScriptActive
              ? "◐ External script active"
              : "○ Simulator idle"}
        </span>
        <span className="debug-chevron">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="debug-body">

          {/* ── Error banner ────────────────────────────────────────── */}
          {apiError && <div className="debug-error">{apiError}</div>}

          {/* ── External script warning ──────────────────────────────── */}
          {externalScriptActive && (
            <div className="debug-warning">
              ⚠ Events are arriving from the external <code>screen_simulator.rb</code> script.
              The Stop button only controls the internal simulator — to stop the external script,
              press <strong>Ctrl+C</strong> in its terminal.
            </div>
          )}

          {/* ── Metrics row ─────────────────────────────────────────── */}
          <div className="metrics-row">
            <MetricCard label="Received (session)" value={totalReceived} />
            <MetricCard
              label="Events / sec (live)"
              value={eventsPerSec.toFixed(1)}
              highlight={eventsPerSec > 5}
            />
            <MetricCard
              label="Peak / sec"
              value={peakEventsPerSec.toFixed(1)}
            />
            <MetricCard
              label="Avg latency"
              value={avgLatencyMs !== null ? `${avgLatencyMs} ms` : "—"}
              highlight={avgLatencyMs !== null && avgLatencyMs > 500}
              tooltip="End-to-end: publish → MQTT broker → Rails DB write → ActionCable broadcast → WebSocket → React render. Requires ms-precision timestamps (iso8601(3))."
            />
            <MetricCard
              label="Min latency (session)"
              value={minLatencyMs !== null ? `${minLatencyMs} ms` : "—"}
            />
            <MetricCard
              label="Configured rate"
              value={`${configuredRate} ev/s`}
            />
          </div>

          {/* ── Controls row ────────────────────────────────────────── */}
          <div className="controls-row">

            {/* Start / Stop */}
            <div className="control-group">
              <button
                className={`sim-button ${serverStatus.running ? "btn-stop" : "btn-start"}`}
                onClick={handleToggle}
              >
                {serverStatus.running ? "⏹ Stop" : "▶ Start"}
              </button>
            </div>

            {/* Interval slider */}
            <div className="control-group">
              <label className="control-label">
                Interval: <strong>{intervalMs} ms</strong>
                <span className="control-hint"> ({configuredRate} ev/s)</span>
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={intervalMs}
                onChange={e => setIntervalMs(Number(e.target.value))}
                onMouseDown={() => { isDraggingRef.current = true; }}
                onMouseUp={()   => { isDraggingRef.current = false; }}
                onTouchStart={() => { isDraggingRef.current = true; }}
                onTouchEnd={()   => { isDraggingRef.current = false; }}
                className="slider"
              />
              <div className="slider-labels">
                <span>100ms (fast)</span>
                <span>5000ms (slow)</span>
              </div>
            </div>

            {/* Screen count slider */}
            <div className="control-group">
              <label className="control-label">
                Screens: <strong>{screenCount}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={screenCount}
                onChange={e => setScreenCount(Number(e.target.value))}
                onMouseDown={() => { isDraggingRef.current = true; }}
                onMouseUp={()   => { isDraggingRef.current = false; }}
                onTouchStart={() => { isDraggingRef.current = true; }}
                onTouchEnd={()   => { isDraggingRef.current = false; }}
                className="slider"
              />
              <div className="slider-labels">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Apply config button — reconfigures without stopping */}
            {serverStatus.running && (
              <div className="control-group">
                <button className="sim-button btn-apply" onClick={handleApplyConfig}>
                  ↺ Apply config
                </button>
              </div>
            )}

            {/* Burst */}
            <div className="control-group burst-group">
              <label className="control-label">Burst</label>
              <div className="burst-row">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={burstCount}
                  onChange={e => setBurstCount(Number(e.target.value))}
                  className="burst-input"
                />
                <button
                  className="sim-button btn-burst"
                  onClick={handleBurst}
                  disabled={isBursting}
                >
                  {isBursting ? "Firing…" : `⚡ Burst ${burstCount}`}
                </button>
              </div>
              {burstResult && <span className="burst-result">{burstResult}</span>}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// tooltip is shown as a native HTML title attribute on the label.
// Hovering the label shows the explanation without cluttering the UI.
function MetricCard({ label, value, highlight = false, tooltip }) {
  return (
    <div className="metric-card">
      <span className="metric-label" title={tooltip}>{label}{tooltip && " ⓘ"}</span>
      <span className={`metric-value ${highlight ? "metric-highlight" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default DebugPanel;
