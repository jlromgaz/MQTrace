// src/context/PlaybackContext.jsx
//
// Provides a SINGLE shared ActionCable subscription for playback events.
// All components consume from this context instead of opening their own WebSocket.
//
// WHY CONTEXT?
// Previously, LiveFeed and App.jsx each called usePlaybackFeed() independently,
// creating two separate WebSocket connections with two separate event arrays.
// When LiveFeed's events array started from [], it appeared to "reset" visually.
// A shared Context ensures one connection, one history, zero resets.

import { createContext, useContext, useState, useEffect } from "react";
import { createConsumer } from "@rails/actioncable";

const CABLE_URL = "ws://localhost:3000/cable";
const MAX_EVENTS = 200; // Keep more history since state is now truly persistent

const PlaybackContext = createContext({ events: [], connected: false });

export function PlaybackProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const cable = createConsumer(CABLE_URL);

    const subscription = cable.subscriptions.create(
      { channel: "PlaybackChannel" },
      {
        connected()  { setConnected(true); },
        disconnected() { setConnected(false); },
        received(data) {
          setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
        },
      }
    );

    return () => {
      subscription.unsubscribe();
      cable.disconnect();
    };
  }, []); // Single mount — never re-runs, never resets.

  return (
    <PlaybackContext.Provider value={{ events, connected }}>
      {children}
    </PlaybackContext.Provider>
  );
}

// Convenience hook — replaces usePlaybackFeed() everywhere
export function usePlayback() {
  return useContext(PlaybackContext);
}
