# app/services/mqtt_subscriber_service.rb
#
# MqttSubscriberService is a plain Ruby service object — not a controller, model,
# or job. It runs in a dedicated background thread started at Rails boot.
#
# WHAT IT DOES:
#   1. Connects to the MQTT broker (Mosquitto or HiveMQ)
#   2. Subscribes to the topic "screens/+/playback" (all screens, playback events)
#   3. For each message received:
#      a. Parses the JSON payload
#      b. Creates a PlaybackEvent record in PostgreSQL
#      c. Broadcasts the event to all connected React clients via ActionCable
#   4. If the connection drops, retries with exponential backoff
#
# WHY A SERVICE OBJECT?
#   Rails doesn't have a built-in "background service" concept like Spring's
#   @Service + ApplicationRunner. Plain Ruby service objects in app/services/
#   are the Rails convention for encapsulating business logic that doesn't
#   belong in a model or controller.
#   Rails autoloads everything in app/ — so this class is available everywhere.
#
# WHY A BACKGROUND THREAD?
#   MQTT client.get blocks — it loops forever waiting for messages.
#   We need this to run alongside Puma (the web server) without blocking HTTP requests.
#   A Ruby Thread is the simplest solution for this use case.
#   (In production at scale, you'd use Sidekiq or a separate process instead.)
#
# Java/Spring Boot equivalent:
#   @Service + implements ApplicationRunner (runs on startup) +
#   @Async or a dedicated thread pool for the blocking MQTT loop +
#   Eclipse Paho MqttClient for the broker connection.

require "mqtt"

class MqttSubscriberService

  # Maximum seconds to wait between reconnection attempts.
  # Prevents hammering the broker if it's down for an extended period.
  MAX_RETRY_INTERVAL = 30

  def initialize
    # Read broker config from environment variables.
    # ENV.fetch raises a KeyError if the variable is missing AND no default is given.
    # Here we provide defaults so the app works without a .env file for basic testing.
    # Java equivalent: @Value("${mqtt.host:localhost}")
    @host    = ENV.fetch("MQTT_HOST", "localhost")
    @port    = ENV.fetch("MQTT_PORT", "1883").to_i
    @topic   = ENV.fetch("MQTT_TOPIC", "screens/+/playback")

    # @running is an instance variable flag used to gracefully stop the loop.
    # Set to false to stop the subscriber (e.g. in tests or on shutdown).
    @running = true
  end

  # start() is the main entry point — called from the initializer in a Thread.
  # It runs an infinite loop with automatic reconnection on failure.
  def start
    retry_count = 0

    while @running
      begin
        connect_and_listen
        # If connect_and_listen returns normally (shouldn't happen — it loops forever),
        # reset the retry counter.
        retry_count = 0

      rescue MQTT::Exception, Errno::ECONNREFUSED, Errno::ETIMEDOUT => e
        wait_time = [2**retry_count, MAX_RETRY_INTERVAL].min
        broadcast_syslog(:error, "[MQTrace] MQTT connection lost: #{e.message}. Retrying in #{wait_time}s...")
        sleep wait_time
        retry_count += 1
      rescue => e
        broadcast_syslog(:error, "[MQTrace] Unexpected error in MQTT subscriber: #{e.class}: #{e.message}")
        broadcast_syslog(:error, e.backtrace.first(5).join("\n"))
        sleep 5
      end
    end
  end

  # stop() allows graceful shutdown — sets the flag so the loop exits after
  # the current reconnect attempt.
  def stop
    @running = false
  end

  private

  # connect_and_listen opens a persistent MQTT connection and blocks forever,
  # processing messages as they arrive.
  # When the connection drops, this method raises an exception which the
  # outer start() loop catches and handles.
  def connect_and_listen
    broadcast_syslog(:info, "[MQTrace] Connecting to MQTT broker at #{@host}:#{@port}...")
    client = MQTT::Client.connect(host: @host, port: @port)
    broadcast_syslog(:info, "[MQTrace] Connected. Subscribing to topic: #{@topic}")
    client.subscribe(@topic => 1)
    broadcast_syslog(:info, "[MQTrace] Listening for playback events...")

    # client.get blocks and yields for each incoming message.
    # This is an infinite loop — it only exits when the connection drops.
    # Java equivalent: mqttClient.setCallback(new MqttCallback() { messageArrived(...) })
    client.get do |topic, message|
      process_message(topic, message)
    end
  end

  # process_message handles a single MQTT message.
  # It is called in the background thread for every message received.
  #
  # THREAD SAFETY NOTE:
  # ActiveRecord's connection pool is thread-safe. Rails manages a pool of
  # database connections and assigns one to each thread as needed.
  # No manual connection handling is required here.
  def process_message(topic, message)
    # Parse the JSON payload from the screen simulator.
    # JSON.parse returns a Hash with STRING keys by default.
    # Access with payload['screen_id'], NOT payload[:screen_id].
    # Java equivalent: objectMapper.readValue(message, PlaybackEventPayload.class)
    payload = JSON.parse(message)

    # Create! raises ActiveRecord::RecordInvalid if validations fail.
    # This is intentional — bad data should be loudly logged, not silently swallowed.
    # Java equivalent: entityManager.persist(event) inside a transaction
    event = PlaybackEvent.create!(
      screen_id:     payload["screen_id"],
      asset_name:    payload["asset_name"],
      started_at:    payload["started_at"],
      duration_secs: payload["duration_secs"]
    )

    # Broadcast the persisted event to all React clients connected via WebSocket.
    # "playback_events" must match stream_from "playback_events" in PlaybackChannel.
    # as_json converts the ActiveRecord object to a plain Ruby Hash (then to JSON).
    # Java equivalent: simpMessagingTemplate.convertAndSend("/topic/playback-events", event)
    ActionCable.server.broadcast("playback_events", event.as_json)
    broadcast_syslog(:info, "[MQTrace] Saved and broadcast: #{event.screen_id} played #{event.asset_name} (#{event.duration_secs}s)")

  rescue JSON::ParserError => e
    broadcast_syslog(:error, "[MQTrace] Invalid JSON on topic #{topic}: #{e.message} | Raw: #{message}")
  rescue ActiveRecord::RecordInvalid => e
    broadcast_syslog(:error, "[MQTrace] Validation failed for message on #{topic}: #{e.message}")
  end

  def broadcast_syslog(level, msg)
    Rails.logger.send(level, msg)
    ActionCable.server.broadcast("system_logs", {
      timestamp: Time.current.iso8601,
      level: level,
      message: msg
    }) rescue nil
  end

end
