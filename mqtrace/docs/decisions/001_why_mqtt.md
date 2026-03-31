# ADR 001 — Why MQTT Instead of HTTP

## Status
Accepted

## Context

MQTrace needs a protocol for screens to report playback events to the backend.
The two most obvious options are HTTP (REST) and MQTT.

In a real digital signage network, thousands of screens report events continuously —
every time an asset finishes playing, an event is generated. This can be dozens
of events per screen per hour, across thousands of screens simultaneously.

## Decision

Use MQTT as the messaging protocol between screens and the backend.

## Rationale

### MQTT advantages for this use case

**1. Designed for constrained devices and high-frequency messaging**
MQTT (Message Queuing Telemetry Transport) was originally designed for IoT devices
with limited bandwidth and processing power. Digital signage screens — especially
those running on Android or Fire TV Stick hardware — benefit from a lightweight
protocol that doesn't require a full HTTP stack.

**2. Persistent connection vs. per-request connection**
With HTTP, every event requires:
- Opening a TCP connection
- TLS handshake (if HTTPS)
- Sending the HTTP request with headers
- Waiting for response
- Closing the connection

With MQTT, the screen opens ONE persistent TCP connection to the broker and
keeps it open. Publishing an event is just a tiny packet. For thousands of
events per day per screen, this is a significant overhead reduction.

**3. Broker-based fan-out**
The MQTT broker acts as the central hub. Multiple subscribers can receive
the same event without the producer (screen) knowing or caring.
In HTTP, the screen would need to know the backend URL and call it directly —
tight coupling.

**4. Offline resilience with QoS levels**
MQTT's QoS 1 (at least once) guarantees that messages are delivered even
if the broker temporarily loses connection with the subscriber (backend).
The broker retains the message and delivers it when the connection is restored.

**5. Direct relevance to the API Gateway cost reduction problem**
In AWS-based architectures, every HTTP call through API Gateway has a cost.
With thousands of screens making dozens of HTTP calls per hour, this adds up.
MQTT uses a single persistent connection per screen — no API Gateway calls,
no per-request billing. This is the core motivation that makes MQTT
architecturally interesting for production digital signage at scale.

## Alternatives Considered

### HTTP REST (rejected)
- Simple to implement
- But: per-request overhead, tight coupling screen→backend, no built-in fan-out
- Does not solve the API Gateway billing problem

### WebSockets from screen to backend (rejected)
- Persistent connection — good
- But: WebSockets are designed for bidirectional browser-server communication,
  not for IoT/device-to-server messaging
- No broker, no fan-out, no QoS guarantees
- More complex to implement on embedded/mobile device clients

### Apache Kafka (rejected for this project scope)
- Kafka would be the production choice for massive scale
- But: requires a cluster (ZooKeeper or KRaft), significant infrastructure
- Overkill for a demo project
- MQTT + a broker is the lightweight equivalent for this use case

## Consequences

- Requires a running MQTT broker (Mosquitto locally or HiveMQ publicly)
- Adds the `mqtt` Ruby gem to the backend
- The backend runs a persistent subscriber in a background thread
- Screens (simulated here) use MQTT publish, not HTTP POST
