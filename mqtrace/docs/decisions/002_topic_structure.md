# ADR 002 — MQTT Topic Structure

## Status
Accepted

## Context

MQTT organizes messages into topics — hierarchical strings that act as
routing keys. The topic structure determines how easily the system
can filter, route, and extend the messaging in the future.

## Decision

Use the following topic structure:

```
screens/{screen_id}/playback
```

Example topics:
```
screens/screen-01/playback
screens/screen-02/playback
screens/screen-03/playback
```

The backend subscribes using a wildcard:
```
screens/+/playback
```

The `+` wildcard matches exactly one level — so it matches any screen_id
but not deeper paths.

## Rationale

### Hierarchical structure allows easy extension

Starting with `screens/` as the root namespace means we can add more
event types in the future without changing the subscriber logic:

```
screens/{screen_id}/playback     ← current
screens/{screen_id}/heartbeat    ← future: device health check
screens/{screen_id}/error        ← future: error reporting
screens/{screen_id}/status       ← future: online/offline status
```

The backend can subscribe to specific event types or to all events
from a screen (`screens/screen-01/#` using the multi-level wildcard `#`).

### screen_id embedded in the topic

Embedding the screen_id in the topic (not just in the payload) allows
the MQTT broker itself to route messages per screen without parsing the payload.
This is useful if in the future different subscribers handle different screens
(e.g., one service per region).

### QoS Level 1 — At Least Once

**QoS 0 (fire and forget):** rejected — we cannot afford to lose playback events.
The playback record must be complete for audit and reporting purposes.

**QoS 1 (at least once):** accepted — the broker retries delivery until
the subscriber acknowledges. The subscriber must handle duplicate messages
gracefully (idempotent processing). We handle this by checking for
duplicate events before inserting.

**QoS 2 (exactly once):** rejected — adds a 4-step handshake for every message.
The overhead is not justified when idempotent processing at QoS 1 achieves
the same practical result with less overhead.

## Payload Structure

```json
{
  "screen_id": "screen-01",
  "asset_name": "promo_summer.mp4",
  "started_at": "2024-03-29T10:30:00Z",
  "duration_secs": 30
}
```

All fields are mandatory. The backend validates presence of all fields
before persisting.

## Alternatives Considered

### Flat topic: `playback/{screen_id}` (rejected)
Less extensible — adding new event types would require a new root namespace.

### Single topic for all events: `mqtrace/events` (rejected)
No routing granularity at the broker level.
Subscriber must parse all messages to filter by type.

## Consequences

- The backend subscribes to `screens/+/playback`
- The simulator publishes to `screens/{screen_id}/playback`
- Payload must always include screen_id (even though it's in the topic)
  for convenience when processing the message without parsing the topic string
