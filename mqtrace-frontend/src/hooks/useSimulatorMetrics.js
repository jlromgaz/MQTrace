// src/hooks/useSimulatorMetrics.js
//
// Computes real-time performance metrics from the live WebSocket event stream.
//
// WHAT LATENCY ACTUALLY MEASURES:
//   latency_ms = Date.now() (browser) - new Date(event.started_at) (simulator)
//
//   This is NOT network latency. It is the full pipeline delay:
//     Simulator sets started_at
//       → MQTT publish to broker
//       → MqttSubscriberService receives message
//       → ActiveRecord INSERT + COMMIT to PostgreSQL
//       → ActionCable.server.broadcast()
//       → WebSocket frame delivered to browser
//       → React state update + hook execution
//
//   On localhost this is typically 20–150ms under normal load.
//
// WHY LATENCY CAN BE LOWER UNDER HIGH LOAD (counterintuitive):
//   Under stress, Rails and PostgreSQL are in "warm" state — connection pool
//   is active, query planner has cached plans, ActionCable has open connections.
//   Under idle conditions each event may hit a "cold path" causing small delays.
//
// TIMESTAMP PRECISION IS CRITICAL:
//   The simulator must use iso8601(3) (millisecond precision).
//   iso8601 without argument rounds to the second — up to 999ms of error,
//   which completely dominates the measurement. Both the internal SimulatorService
//   and the external screen_simulator.rb now use iso8601(3).
//
// METRICS RETURNED:
//   totalReceived    — total WebSocket events received since page load
//   eventsPerSec     — rolling 5-second rate, updated every second
//   avgLatencyMs     — rolling average of last 20 valid latency samples
//   minLatencyMs     — minimum latency seen this session (best-case pipeline)
//   peakEventsPerSec — highest rate seen this session

import { useState, useEffect, useRef } from "react";

const LATENCY_WINDOW       = 20;
const THROUGHPUT_WINDOW_MS = 5000;
// Ignore latencies outside this range — they indicate stale DB events or
// system clock skew, not real pipeline measurements.
const MIN_PLAUSIBLE_MS = 0;
const MAX_PLAUSIBLE_MS = 10_000;

function useSimulatorMetrics(events) {
  const [totalReceived,     setTotalReceived]     = useState(0);
  const [eventsPerSec,      setEventsPerSec]      = useState(0);
  const [avgLatencyMs,      setAvgLatencyMs]      = useState(null);
  const [minLatencyMs,      setMinLatencyMs]      = useState(null);
  const [peakEventsPerSec,  setPeakEventsPerSec]  = useState(0);

  // lastSeenIdRef: tracks the ID of the newest event already processed.
  // Comparing IDs (not array length) correctly handles the capped-array case:
  // once events.length reaches MAX_EVENTS (50) it stays at 50, but event IDs
  // keep increasing, so we can still detect new arrivals.
  const lastSeenIdRef = useRef(null);
  const timestampsRef = useRef([]);
  const latenciesRef  = useRef([]);
  const minRef        = useRef(null);  // session minimum latency

  // Effect 1 — detect new events by comparing the latest event's ID.
  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[0]; // newest-first array
    if (latestEvent.id === lastSeenIdRef.current) return;

    // Find how many events are new since the last render.
    const lastSeenIndex = events.findIndex(e => e.id === lastSeenIdRef.current);
    const newEvents = lastSeenIndex === -1 ? [latestEvent] : events.slice(0, lastSeenIndex);

    lastSeenIdRef.current = latestEvent.id;

    const now = Date.now();

    newEvents.forEach(event => {
      timestampsRef.current.push(now);

      if (event.started_at) {
        const publishedAt = new Date(event.started_at).getTime();
        const latency = now - publishedAt;

        if (latency >= MIN_PLAUSIBLE_MS && latency <= MAX_PLAUSIBLE_MS) {
          latenciesRef.current.push(latency);
          if (latenciesRef.current.length > LATENCY_WINDOW) {
            latenciesRef.current.shift();
          }
          // Track session minimum
          if (minRef.current === null || latency < minRef.current) {
            minRef.current = latency;
            setMinLatencyMs(latency);
          }
        }
      }
    });

    setTotalReceived(prev => prev + newEvents.length);
  }, [events]);

  // Effect 2 — recompute throughput and average latency every second.
  useEffect(() => {
    const interval = setInterval(() => {
      const now    = Date.now();
      const cutoff = now - THROUGHPUT_WINDOW_MS;

      timestampsRef.current = timestampsRef.current.filter(t => t >= cutoff);

      const rate = parseFloat(
        (timestampsRef.current.length / (THROUGHPUT_WINDOW_MS / 1000)).toFixed(1)
      );
      setEventsPerSec(rate);
      setPeakEventsPerSec(prev => Math.max(prev, rate));

      if (latenciesRef.current.length > 0) {
        const sum = latenciesRef.current.reduce((a, b) => a + b, 0);
        setAvgLatencyMs(Math.round(sum / latenciesRef.current.length));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { totalReceived, eventsPerSec, avgLatencyMs, minLatencyMs, peakEventsPerSec };
}

export default useSimulatorMetrics;
