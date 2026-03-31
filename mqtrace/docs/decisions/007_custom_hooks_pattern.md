# ADR 007 — Custom Hooks Pattern for ActionCable

## Status
Accepted

## Context

The ActionCable WebSocket connection needs to be:
1. Created once when the app mounts
2. Maintained for the lifetime of the component that uses it
3. Cleaned up properly when the component unmounts
4. Reusable if multiple components needed the same connection

## Decision

Encapsulate the ActionCable connection logic in a custom React hook:
`usePlaybackFeed.js`

## What is a Custom Hook

A custom hook is a JavaScript function whose name starts with `use`
and that can call other React hooks internally (useState, useEffect, etc.).

It is NOT a special React API — it is simply a convention that allows
extracting stateful logic from components into reusable functions.

### Comparison with Java (for context)

In Java/Spring Boot, you would extract reusable logic into a `@Service`
or a utility class. A custom hook is the React equivalent — a reusable
piece of logic that any component can use, but it can also hold state
and react to lifecycle events.

The difference: a Java service is a singleton managed by the IoC container.
A custom hook creates a new instance of its logic for each component
that calls it. If two components call `usePlaybackFeed()`, they each
get their own WebSocket connection and their own events array.

## Implementation Design

```javascript
// src/hooks/usePlaybackFeed.js

function usePlaybackFeed() {
    // State: the array of received events
    // (useState — triggers re-render when new events arrive)
    const [events, setEvents] = useState([]);

    // State: connection status for the UI indicator
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // 1. Create ActionCable consumer (WebSocket connection to Rails)
        const cable = createConsumer('ws://localhost:3000/cable');

        // 2. Subscribe to the PlaybackChannel
        const subscription = cable.subscriptions.create(
            { channel: 'PlaybackChannel' },
            {
                connected: () => setConnected(true),
                disconnected: () => setConnected(false),
                received: (data) => {
                    // 3. When a new event arrives, prepend it to the array
                    // (functional update form ensures we always have latest state)
                    setEvents(prev => [data, ...prev].slice(0, 50));
                    // Keep max 50 events in memory to avoid growing unboundedly
                }
            }
        );

        // 4. Cleanup function — called when component unmounts
        // This is CRITICAL: without cleanup, the WebSocket connection
        // stays open even after the component is gone (memory leak)
        return () => {
            subscription.unsubscribe();
            cable.disconnect();
        };

    }, []); // Empty dependency array = run this effect only on mount/unmount
            // Equivalent to componentDidMount + componentWillUnmount in class components

    // 5. Return the data the component needs
    return { events, connected };
}
```

## Why useEffect for the Connection

`useEffect` with an empty dependency array `[]` runs:
- Once after the component first renders (mount)
- The cleanup function runs when the component unmounts

This maps directly to the lifecycle of a WebSocket connection:
open it when the component appears, close it when the component disappears.

Without the cleanup return function, the WebSocket would remain open
after the component unmounts — a classic memory leak.

### Comparison with Java (for context)

In Java, this lifecycle management is handled by:
- `@PostConstruct` — runs after dependency injection (equivalent to mount)
- `@PreDestroy` — runs before the bean is destroyed (equivalent to unmount)
- Or `AutoCloseable` with try-with-resources

React's useEffect cleanup is the equivalent pattern for the frontend.

## The Functional Update Pattern

```javascript
// WRONG — captures stale state
setEvents([newEvent, ...events]);

// CORRECT — always uses the latest state
setEvents(prev => [newEvent, ...prev].slice(0, 50));
```

When state updates happen inside a callback (like the WebSocket `received`
handler), the closure captures the value of `events` at the time the
callback was created — which may be stale after multiple updates.

The functional form `setEvents(prev => ...)` always receives the latest
state as `prev`, avoiding stale closure bugs. This is a common React pitfall.

## Consequences

- ActionCable connection logic is completely isolated in one file
- Components that need live events just call `usePlaybackFeed()`
- Connection cleanup is guaranteed — no memory leaks
- The hook is testable in isolation
- If the WebSocket URL changes, only the hook needs updating
