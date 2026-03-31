# ADR 005 — MQTT to WebSocket Bridge Design

## Status
Accepted

## Context

The system has two different real-time protocols:
- MQTT: used by screens (devices) to report events to the backend
- WebSocket (ActionCable): used by the frontend to receive events from the backend

These need to be bridged inside the Rails backend.

## Decision

Bridge MQTT to WebSocket inside `MqttSubscriberService` using a
background thread that runs for the lifetime of the Rails process.

## Design

```
[Background Thread — MqttSubscriberService]
    |
    | 1. Connect to MQTT broker
    | 2. Subscribe to screens/+/playback (QoS 1)
    | 3. On message received:
    |       a. Parse JSON payload
    |       b. Validate required fields
    |       c. Create PlaybackEvent record in PostgreSQL
    |       d. If save successful:
    |              ActionCable.server.broadcast(
    |                "playback_events",
    |                event.as_json
    |              )
    |       e. If save fails: log error, do NOT broadcast
```

## Why a Background Thread

Rails is a request-response framework. It does not have a built-in
mechanism for running persistent background processes (unlike Vert.x
in Java, which is event-loop based).

A background thread (`Thread.new`) started in a Rails initializer
runs in the same process as Rails, shares the database connection pool,
and has access to all Rails models and services.

This is acceptable for a development/demo project. In production,
the recommended approach would be to run the MQTT subscriber as a
separate process (a Rails "runner" script or a separate service).

### Why not Sidekiq or ActiveJob?

Sidekiq and ActiveJob are for processing discrete units of work
(jobs) asynchronously. The MQTT subscriber is a persistent listener,
not a job. It must maintain a continuous connection to the broker.

A background thread is the appropriate primitive for this pattern.

### Thread Safety

ActionCable.server.broadcast is thread-safe — Rails guarantees this.
The ActiveRecord connection pool handles concurrent database access
from multiple threads. The MQTT client itself is single-threaded
(one thread per connection), which is the correct usage pattern.

## Error Handling in the Bridge

```ruby
begin
  # Parse and validate
  # Save to database
  # Broadcast via ActionCable
rescue JSON::ParserError => e
  # Log malformed payload — do not crash the thread
rescue ActiveRecord::RecordInvalid => e
  # Log validation failure — do not crash the thread
rescue MQTT::Exception => e
  # Log MQTT error
  # Attempt reconnection with exponential backoff
  # Do not crash the thread
end
```

The background thread must NEVER crash silently. Every exception
must be caught, logged, and handled. If the thread crashes,
the MQTT subscriber stops working and no new events are received.

## Reconnection Logic

If the MQTT connection drops (network issue, broker restart):
```
retry_count = 0
loop:
    try to connect
    if connected: reset retry_count, start listening
    if failed:
        wait 2^retry_count seconds (exponential backoff)
        increment retry_count
        max wait: 30 seconds
        try again
```

This prevents hammering the broker with reconnection attempts
while ensuring the service recovers automatically.

## Comparison with Java/Spring Boot (for context)

In a Spring Boot application, this pattern would be implemented with:
- A `@KafkaListener` for event consumption (if using Kafka)
- Or a managed bean implementing `MqttCallback` with Spring Integration MQTT
- Spring manages the lifecycle, thread pool, and error handling

In Rails, we manage this manually because Rails is not inherently
event-driven. The pattern works but requires more explicit lifecycle management.

## Consequences

- The MQTT subscriber starts automatically when Rails boots (via initializer)
- Exceptions in the subscriber thread are caught and logged — never propagated
- Lost events (if the thread crashes) must be replayed from the simulator
- In production, this would be moved to a separate process for isolation
