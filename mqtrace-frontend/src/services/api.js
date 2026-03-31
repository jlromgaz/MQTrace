// src/services/api.js
//
// This module creates a pre-configured axios HTTP client for talking to the
// Rails REST API. All components import from here instead of using fetch()
// directly, which means the base URL is defined in one place only.
//
// Java/Spring Boot equivalent: a @Service class that wraps RestTemplate or
// WebClient with a pre-configured base URL and default headers.
//
// WHY AXIOS INSTEAD OF FETCH?
// axios automatically:
//   - Parses JSON response bodies (no .json() call needed)
//   - Throws errors for HTTP 4xx/5xx responses (fetch does not)
//   - Supports request/response interceptors for auth headers, logging, etc.
// For this project the difference is small, but axios is the React community
// standard for REST API calls.

import axios from "axios";

// Create a configured axios instance.
// Every function in this file uses this instance, so changing the base URL
// here affects all API calls in the app.
const apiClient = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// getEvents(params) — fetches a list of playback events.
//
// params is an optional object of query string parameters.
// Example: getEvents({ screen_id: "screen-01" })
// Generates: GET /api/v1/playback_events?screen_id=screen-01
//
// Returns a Promise that resolves to the array of event objects.
// Java equivalent: restTemplate.getForObject("/api/v1/playback_events?...", List.class)
export async function getEvents(params = {}) {
  const response = await apiClient.get("/playback_events", { params });
  // axios wraps the parsed JSON body in response.data
  return response.data;
}

// getEventById(id) — fetches a single event by primary key.
// Returns a Promise resolving to a single event object.
export async function getEventById(id) {
  const response = await apiClient.get(`/playback_events/${id}`);
  return response.data;
}

// ── Simulator control API ────────────────────────────────────────────────────
// These functions call the SimulatorController endpoints in Rails.
// They are used exclusively by the DebugPanel component.

// getSimulatorStatus() — returns current simulator state.
export async function getSimulatorStatus() {
  const response = await apiClient.get("/simulator/status");
  return response.data;
}

// startSimulator(config) — starts the simulator with given config.
// config: { interval_ms: Number, screen_count: Number }
export async function startSimulator(config = {}) {
  const response = await apiClient.post("/simulator/start", config);
  return response.data;
}

// stopSimulator() — stops the simulation thread.
export async function stopSimulator() {
  const response = await apiClient.post("/simulator/stop");
  return response.data;
}

// burstSimulator(count) — fires `count` events immediately.
export async function burstSimulator(count = 20) {
  const response = await apiClient.post("/simulator/burst", { count });
  return response.data;
}

export default apiClient;
