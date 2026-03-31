// src/hooks/usePlaybackFeed.js
//
// Custom React hook that manages the ActionCable WebSocket connection and
// delivers a live stream of playback events to any component that calls it.
//
// WHAT IS A CUSTOM HOOK?
// A custom hook is a plain JavaScript function whose name starts with "use".
// It can call built-in hooks (useState, useEffect, etc.) and encapsulates
// stateful logic so multiple components can share it without code duplication.
//
// WHY A CUSTOM HOOK FOR THIS?
// The WebSocket connection lifecycle (open, receive, close/cleanup) is
// "side effect" logic — it interacts with something outside React's render
// cycle. Placing this in a hook keeps components clean and declarative:
// a component just calls usePlaybackFeed() and gets events back, without
// knowing anything about ActionCable internals.
//
// Java/Spring Boot equivalent: there is no direct equivalent. The closest
// analogy is a @Service bean that holds a WebSocket session and exposes
// an observable/reactive stream. Here the hook IS the service, scoped
// to the component's lifetime instead of the Spring container's lifetime.
//
// USAGE:
//   const { events, connected } = usePlaybackFeed();

import { useState, useEffect } from "react";
import { createConsumer } from "@rails/actioncable";

// The Rails ActionCable WebSocket endpoint.
// Must match the mount point in config/routes.rb: mount ActionCable.server => "/cable"
const CABLE_URL = "ws://localhost:3000/cable";

// Maximum number of events to keep in memory.
// Prevents the array from growing unbounded if the dashboard runs for hours.
const MAX_EVENTS = 50;

function usePlaybackFeed() {
  // useState declares reactive state variables.
  // When setEvents or setConnected is called, React re-renders components
  // that use this hook — similar to notifyAll() triggering a UI update.
  //
  // Java/Spring Boot + React equivalent mental model:
  //   events     → a live List<PlaybackEvent> that auto-refreshes the UI when updated
  //   connected  → a boolean flag for the WebSocket connection status
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  // useEffect runs AFTER the component mounts (renders for the first time).
  // The empty dependency array [] means "run once on mount, clean up on unmount".
  // This is where we set up the WebSocket connection.
  //
  // Java lifecycle equivalent:
  //   setup code   → @PostConstruct
  //   cleanup code → @PreDestroy
  useEffect(() => {
    // createConsumer opens a persistent WebSocket connection to the Rails server.
    // Under the hood it uses the browser's native WebSocket API.
    const cable = createConsumer(CABLE_URL);

    // cable.subscriptions.create subscribes to a specific ActionCable channel.
    // { channel: "PlaybackChannel" } must match the class name in Rails:
    //   class PlaybackChannel < ApplicationCable::Channel
    const subscription = cable.subscriptions.create(
      { channel: "PlaybackChannel" },
      {
        // connected() is called when the WebSocket handshake succeeds.
        connected() {
          console.log("[MQTrace] ActionCable connected to PlaybackChannel");
          setConnected(true);
        },

        // disconnected() is called when the connection drops (network issue,
        // server restart, browser tab backgrounded, etc.).
        // ActionCable will automatically attempt to reconnect.
        disconnected() {
          console.log("[MQTrace] ActionCable disconnected");
          setConnected(false);
        },

        // received(data) is called every time Rails broadcasts to "playback_events".
        // data is the JSON object sent by ActionCable.server.broadcast(..., event.as_json)
        received(data) {
          // IMPORTANT: use the functional form of setState — setEvents(prev => ...)
          // NOT setEvents([data, ...events])
          //
          // WHY? This callback is a closure created once when the subscription is set up.
          // If we capture `events` directly, it would always reference the INITIAL empty
          // array (stale closure). The functional form receives the CURRENT state as `prev`,
          // so it always prepends to the actual latest array.
          //
          // Java equivalent: there's no direct analogy — this is specific to React's
          // async state batching model.
          setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
        },
      }
    );

    // Cleanup function — React calls this when the component unmounts.
    // Without this, the WebSocket subscription and connection would leak,
    // accumulating connections every time the component re-mounts.
    // Java @PreDestroy equivalent.
    return () => {
      console.log("[MQTrace] Cleaning up ActionCable subscription");
      subscription.unsubscribe();
      cable.disconnect();
    };
  }, []); // Empty array: run this effect exactly once, on mount.

  // Return the state values to the calling component.
  // Destructured by the caller as: const { events, connected } = usePlaybackFeed();
  return { events, connected };
}

export default usePlaybackFeed;
