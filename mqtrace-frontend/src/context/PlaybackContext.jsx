// src/context/PlaybackContext.jsx
//
// Provides a SINGLE shared ActionCable subscription for playback events.
//
// FIXES APPLIED (QA Tester report):
//   BUG #1: Added `totalCount` — a counter that increments forever and is never
//           truncated by MAX_EVENTS, so "Total MQTT Messages" shows the true total.
//   BUG #2: Batch-flush via requestAnimationFrame — incoming messages are queued
//           in a ref buffer and flushed to state in a single batched setState()
//           once per animation frame. This prevents 1000 individual renders during
//           a burst, keeping the UI responsive regardless of throughput.
//   BUG #3: `aggregates` (mostPlayed, mostActive, avgDuration) are computed from
//           rolling accumulators that survive the MAX_EVENTS sliding window.

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { createConsumer } from "@rails/actioncable";

const CABLE_URL = "ws://localhost:3000/cable";

// Maximum events to keep in the visible sliding window (LiveFeed, etc.)
// We keep a separate totalCount that is never capped.
const MAX_EVENTS = 200;

const PlaybackContext = createContext({
  events: [],
  connected: false,
  totalCount: 0,
  aggregates: { mostPlayedVideo: "—", mostActiveScreen: "—", avgDuration: "—" },
});

export function PlaybackProvider({ children }) {
  const [events, setEvents]         = useState([]);
  const [connected, setConnected]   = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Rolling aggregation accumulators — survive the MAX_EVENTS window.
  // Stored in refs so they can be mutated without triggering extra renders.
  const assetCountsRef   = useRef({});
  const screenCountsRef  = useRef({});
  const totalDurationRef = useRef(0);
  const [aggregates, setAggregates] = useState({
    mostPlayedVideo: "—",
    mostActiveScreen: "—",
    avgDuration: "—",
  });

  // Incoming message buffer — filled synchronously by the WebSocket callback.
  // Drained asynchronously by the RAF flush loop.
  const queueRef      = useRef([]);
  const rafRef        = useRef(null);
  const totalAddedRef = useRef(0); // shadow of totalCount, avoids stale closures

  // Flush the queue into React state once per animation frame (~16ms).
  // This batches arbitrarily many messages into a single setState call,
  // preventing render storms during high-throughput bursts.
  const flushQueue = useCallback(() => {
    rafRef.current = null;
    const batch = queueRef.current.splice(0); // drain atomically
    if (batch.length === 0) return;

    totalAddedRef.current += batch.length;

    // Update rolling aggregators with every message in the batch
    batch.forEach((e) => {
      assetCountsRef.current[e.asset_name]  = (assetCountsRef.current[e.asset_name]  || 0) + 1;
      screenCountsRef.current[e.screen_id]  = (screenCountsRef.current[e.screen_id]  || 0) + 1;
      totalDurationRef.current += Number(e.duration_secs) || 0;
    });

    const total = totalAddedRef.current;
    const mostPlayedVideo  = Object.entries(assetCountsRef.current).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const mostActiveScreen = Object.entries(screenCountsRef.current).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const avgDuration      = (totalDurationRef.current / total).toFixed(1) + "s";

    // Single batched state update — one render per frame regardless of burst size
    setEvents((prev) => [...batch, ...prev].slice(0, MAX_EVENTS));
    setTotalCount(total);
    setAggregates({ mostPlayedVideo, mostActiveScreen, avgDuration });
  }, []);

  useEffect(() => {
    const cable = createConsumer(CABLE_URL);

    const subscription = cable.subscriptions.create(
      { channel: "PlaybackChannel" },
      {
        connected()    { setConnected(true); },
        disconnected() { setConnected(false); },
        received(data) {
          // Push to buffer — NEVER touch React state directly from here.
          // This is the key difference: we decouple the WebSocket callback
          // from the React render cycle entirely.
          queueRef.current.push(data);
          // Schedule a flush if one isn't already pending this frame.
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(flushQueue);
          }
        },
      }
    );

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      subscription.unsubscribe();
      cable.disconnect();
    };
  }, [flushQueue]);

  return (
    <PlaybackContext.Provider value={{ events, connected, totalCount, aggregates }}>
      {children}
    </PlaybackContext.Provider>
  );
}

// Convenience hook — replaces usePlaybackFeed() everywhere
export function usePlayback() {
  return useContext(PlaybackContext);
}
