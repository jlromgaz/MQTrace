# ADR 008 — MQTT as API Gateway Replacement for Device Telemetry

## Status
Accepted

## Context

In AWS-based architectures, devices (screens) reporting events to a backend
typically go through API Gateway — AWS's managed HTTP endpoint service.

API Gateway pricing (as of 2024):
- REST API: $3.50 per million API calls
- HTTP API: $1.00 per million API calls
- WebSocket API: $1.00 per million messages + $0.25 per million connection minutes

For a digital signage network with 10,000 screens, each reporting a playback
event every 30 seconds on average:

```
Events per second:   10,000 screens ÷ 30s = ~333 events/second
Events per day:      333 × 86,400 = ~28,800,000 events/day
Events per month:    ~864,000,000 events/month

API Gateway cost (HTTP API):
  864,000,000 × $1.00 / 1,000,000 = $864/month
  — just for API Gateway, before compute and storage costs
```

At larger scale (50,000 screens), this exceeds $4,000/month in API Gateway
costs alone, before any other infrastructure.

## Decision

Use MQTT as the primary protocol for screen-to-backend communication,
eliminating API Gateway entirely for device telemetry.

## How MQTT Eliminates API Gateway

### HTTP + API Gateway model (current / to be replaced)

```
Screen
  |
  | HTTP POST /events (one request per event)
  | Every request: TLS handshake + HTTP headers + API Gateway routing
  v
AWS API Gateway
  | Per-request billing
  | Routing overhead
  v
Backend (Lambda or ECS)
```

Every single event generates a billable API Gateway request.
With millions of events per day, costs scale linearly.

### MQTT model (MQTrace approach)

```
Screen
  |
  | ONE persistent TCP connection (stays open all day)
  | Tiny MQTT packets — no HTTP headers, no TLS per message
  v
MQTT Broker (AWS IoT Core, HiveMQ Cloud, or self-hosted Mosquitto on EC2)
  | No per-message billing at the broker level (fixed infrastructure cost)
  | Messages routed directly to subscribers
  v
Backend (Rails subscriber — persistent connection to broker)
```

The screen opens ONE connection per day. All events flow through that
connection as tiny packets (~100 bytes each vs ~1KB+ HTTP request).
No API Gateway involved — no per-request billing.

## Cost Comparison

### Scenario: 10,000 screens, 1 event per 30 seconds

```
                    HTTP + API Gateway    MQTT
─────────────────────────────────────────────────────
Protocol overhead   ~1KB per request     ~100 bytes per message
Connections         1 per event          1 per screen per day
API Gateway cost    ~$864/month          $0 (no API Gateway)
Broker cost         N/A                  ~$50-200/month (managed)
                                         or ~$20/month (self-hosted EC2)
Net saving          —                    ~$650-850/month at this scale
```

At 50,000 screens the saving exceeds $4,000/month.

## AWS IoT Core — The Production MQTT Broker

For production on AWS, the natural MQTT broker is **AWS IoT Core**:
- Fully managed MQTT broker
- Scales to millions of concurrent device connections
- Pricing: $1.00 per million messages (significantly cheaper than API Gateway)
- Native integration with other AWS services (Lambda, DynamoDB, Kinesis)
- Built-in device authentication and authorization (X.509 certificates)

MQTrace uses Mosquitto (local) or HiveMQ (public) for simplicity,
but the architecture maps directly to AWS IoT Core in production:

```
MQTrace (development)         Production (AWS)
─────────────────────────────────────────────
Mosquitto / HiveMQ       →    AWS IoT Core
Rails MQTT subscriber    →    IoT Core Rule → Lambda / ECS
PostgreSQL               →    DynamoDB
ActionCable              →    API Gateway WebSocket API (frontend only)
```

Note: API Gateway WebSocket API can still be used for the
**frontend dashboard** (browser → backend) — the saving is specifically
for the high-volume **screen → backend** direction where per-message
billing at API Gateway scale becomes expensive.

## Additional Benefits Beyond Cost

**1. Reduced latency**
MQTT messages over a persistent connection have ~1-5ms latency.
HTTP requests through API Gateway add ~20-100ms of overhead
(DNS resolution, TLS handshake, routing).

**2. Offline resilience**
MQTT QoS 1 handles temporary connectivity loss gracefully.
The broker retries delivery. With HTTP, a lost connection means
a lost event unless the screen implements retry logic.

**3. Bandwidth efficiency**
An MQTT publish packet for our payload is approximately 100-150 bytes.
An equivalent HTTP POST with headers is 800-1200 bytes.
At scale, this reduces bandwidth costs significantly.

**4. Simpler screen software**
The screen opens one connection on startup and publishes events.
No need to manage HTTP connection pools, handle HTTP errors,
or implement retry/backoff logic for each request.

## Tradeoffs

**MQTT adds infrastructure complexity:**
- Requires a running MQTT broker (vs API Gateway which is fully managed with zero setup)
- Broker high availability must be managed
- Authentication requires MQTT-specific setup (vs API Gateway's IAM integration)

**MQTT is not suitable for all use cases:**
- The React frontend still uses HTTP (REST API) and WebSockets (ActionCable)
- MQTT is specifically optimal for the high-frequency device → backend direction
- Complex request/response patterns are more natural in HTTP

## Summary

MQTT eliminates API Gateway costs for the highest-volume traffic pattern
in a digital signage system: screen telemetry. The cost saving is
substantial at scale, latency improves, and the protocol is
better suited to device communication than HTTP.

MQTrace demonstrates this architecture concretely:
screens publish via MQTT → broker → Rails subscriber persists and broadcasts.
No API Gateway in the critical path.
