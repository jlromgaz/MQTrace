# simulator/screen_simulator.rb
#
# This is a STANDALONE Ruby script — NOT part of the Rails application.
# It simulates digital signage screens publishing playback events via MQTT.
#
# Run with:
#   ruby simulator/screen_simulator.rb
#
# Prerequisites:
#   gem install mqtt   (or run from within the mqtrace/ directory after bundle install)
#
# WHAT IT SIMULATES:
#   Three screens (screen-01, screen-02, screen-03) randomly play assets
#   from a fixed pool and publish a JSON event to the MQTT broker every
#   2-5 seconds. This mimics real screens reporting what they played.
#
# In a real deployment, this script would be replaced by actual software
# running on Android/Fire TV/Raspberry Pi screens.
#
# Java equivalent: a standalone Spring Boot CommandLineRunner or a simple
# main() class using Eclipse Paho MQTT client.

require "mqtt"
require "json"
require "time"

# ─── Configuration ────────────────────────────────────────────────────────────

SCREENS = ["screen-01", "screen-02", "screen-03"].freeze

ASSETS = [
  "promo_summer.mp4",
  "brand_video.mp4",
  "menu_board.mp4",
  "welcome_loop.mp4",
  "product_highlight.mp4"
].freeze

# Read broker settings from environment, falling back to local Mosquitto defaults.
# To use HiveMQ: set MQTT_HOST=broker.hivemq.com before running.
MQTT_HOST = ENV.fetch("MQTT_HOST", "localhost")
MQTT_PORT = ENV.fetch("MQTT_PORT", "1883").to_i

# ─── Connect ──────────────────────────────────────────────────────────────────

puts "[Simulator] MQTrace Screen Simulator starting..."
puts "[Simulator] Broker: #{MQTT_HOST}:#{MQTT_PORT}"
puts "[Simulator] Simulating #{SCREENS.length} screens: #{SCREENS.join(', ')}"
puts "[Simulator] Press Ctrl+C to stop."
puts ""

begin
  # Open a persistent connection to the broker.
  # All screens share this one connection — in a real deployment each screen
  # would have its own connection from its own device.
  client = MQTT::Client.connect(host: MQTT_HOST, port: MQTT_PORT)
  puts "[Simulator] Connected to broker."
rescue Errno::ECONNREFUSED => e
  puts "[Simulator] ERROR: Cannot connect to MQTT broker at #{MQTT_HOST}:#{MQTT_PORT}"
  puts "[Simulator] Make sure Mosquitto is running: Start-Service mosquitto"
  puts "[Simulator] Or set MQTT_HOST=broker.hivemq.com to use the public HiveMQ broker."
  exit 1
end

# ─── Simulation loop ──────────────────────────────────────────────────────────

# Trap Ctrl+C for a clean shutdown message instead of a stack trace.
trap("INT") do
  puts "\n[Simulator] Stopping. Goodbye."
  client.disconnect
  exit 0
end

loop do
  # Pick a random screen and asset on each iteration.
  # Array#sample returns a random element — Ruby stdlib, no import needed.
  screen_id  = SCREENS.sample
  asset_name = ASSETS.sample
  duration   = rand(15..60)  # seconds

  # Build the JSON payload.
  # Time.now.utc.iso8601 → "2024-03-29T10:30:00Z" (UTC, ISO 8601 format)
  # Rails will parse this back to a Ruby Time / PostgreSQL TIMESTAMP WITH TIME ZONE.
  payload = {
    screen_id:     screen_id,
    asset_name:    asset_name,
    started_at:    Time.now.utc.iso8601(3),  # millisecond precision — essential for accurate latency measurement
    duration_secs: duration
  }.to_json

  # Topic format: screens/{screen_id}/playback
  # This matches the wildcard subscription: screens/+/playback
  topic = "screens/#{screen_id}/playback"

  # Publish with QoS 1 (at least once delivery).
  # retain: false — don't store the last message for new subscribers.
  # Each playback event is ephemeral and time-specific.
  client.publish(topic, payload, retain: false, qos: 1)

  puts "[Simulator] #{Time.now.strftime('%H:%M:%S')} | #{screen_id} | #{asset_name} | #{duration}s → #{topic}"

  # Wait a random interval before the next event.
  # Real screens would publish once per asset play — typically every 15-60 seconds.
  # We use 2-5 seconds here to generate visible activity in the dashboard.
  sleep rand(2.0..5.0)
end
