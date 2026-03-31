# app/services/simulator_service.rb
#
# SimulatorService is a thread-based MQTT publisher that replicates the
# functionality of simulator/screen_simulator.rb, but runs INSIDE the Rails
# process and is controllable at runtime via the SimulatorController REST API.
#
# WHY INSIDE RAILS?
# The external Ruby script has no API surface — you can't change its parameters
# without restarting it. By running the simulator as a service inside Rails we
# can start, stop, and reconfigure it via HTTP calls from the React debug panel.
#
# THREAD SAFETY:
# @running, @interval_ms, and @screen_count are read/written from both the
# simulation thread and the controller thread (HTTP request).
# We use a Mutex to protect these shared variables — equivalent to
# synchronized blocks in Java or ReentrantLock.
#
# Java/Spring Boot equivalent:
#   @Service implementing Runnable, submitted to a ThreadPoolTaskExecutor,
#   with @Async methods to update configuration at runtime.

require "mqtt"

class SimulatorService

  ASSETS = %w[
    promo_summer.mp4
    brand_video.mp4
    menu_board.mp4
    welcome_loop.mp4
    product_highlight.mp4
    sale_announcement.mp4
    event_promo.mp4
  ].freeze

  # Default configuration
  DEFAULT_INTERVAL_MS = 2000
  DEFAULT_SCREEN_COUNT = 3
  MIN_INTERVAL_MS      = 100   # 10 events/sec max per safety — don't spam the broker
  MAX_SCREEN_COUNT     = 10

  def initialize
    @mutex        = Mutex.new  # Protects shared state between threads
    @running      = false
    @interval_ms  = DEFAULT_INTERVAL_MS
    @screen_count = DEFAULT_SCREEN_COUNT
    @thread       = nil

    @host = ENV.fetch("MQTT_HOST", "localhost")
    @port = ENV.fetch("MQTT_PORT", "1883").to_i
  end

  # ── Public API (called from SimulatorController) ─────────────────────────

  # start() launches the simulation thread if not already running.
  # options hash: { interval_ms: Integer, screen_count: Integer }
  def start(options = {})
    @mutex.synchronize do
      apply_options(options)
      return if @running  # Already running — just apply new config

      @running = true
      @thread  = Thread.new { simulation_loop }
      Rails.logger.info "[Simulator] Started — interval: #{@interval_ms}ms, screens: #{@screen_count}"
    end
  end

  # stop() signals the simulation thread to exit on its next sleep cycle.
  def stop
    @mutex.synchronize do
      @running = false
      Rails.logger.info "[Simulator] Stopped."
    end
  end

  # configure() updates parameters without stopping the simulation.
  def configure(options = {})
    @mutex.synchronize { apply_options(options) }
    Rails.logger.info "[Simulator] Reconfigured — interval: #{@interval_ms}ms, screens: #{@screen_count}"
  end

  # burst() fires `count` events immediately, regardless of the normal interval.
  # Runs in the calling thread (HTTP request thread) — intentionally blocking
  # for the duration so the response confirms all events were sent.
  def burst(count: 20)
    published = 0
    connect_once do |client|
      count.times do
        publish_event(client)
        published += 1
      end
    end
    Rails.logger.info "[Simulator] Burst: #{published} events fired."
    published
  end

  # status() returns the current state as a plain hash for JSON serialization.
  def status
    @mutex.synchronize do
      {
        running:      @running,
        interval_ms:  @interval_ms,
        screen_count: @screen_count,
        events_per_sec: @interval_ms > 0 ? (1000.0 / @interval_ms).round(2) : 0
      }
    end
  end

  # running? is used by the initializer to check state.
  def running?
    @mutex.synchronize { @running }
  end

  private

  # simulation_loop is the body of the background thread.
  # It connects to the broker, then publishes one event per interval until stopped.
  def simulation_loop
    retry_count = 0

    while @mutex.synchronize { @running }
      begin
        MQTT::Client.connect(host: @host, port: @port) do |client|
          Rails.logger.info "[Simulator] MQTT connected for simulation."
          retry_count = 0

          # Inner loop: publish while running, re-check interval each iteration
          while @mutex.synchronize { @running }
            publish_event(client)
            # Read the current interval inside the mutex to pick up live changes
            sleep_ms = @mutex.synchronize { @interval_ms }
            sleep(sleep_ms / 1000.0)
          end
        end

      rescue MQTT::Exception, Errno::ECONNREFUSED => e
        wait = [2**retry_count, 30].min
        Rails.logger.error "[Simulator] MQTT error: #{e.message}. Retry in #{wait}s"
        sleep wait
        retry_count += 1
      rescue => e
        Rails.logger.error "[Simulator] Unexpected error: #{e.class}: #{e.message}"
        sleep 5
      end
    end

    Rails.logger.info "[Simulator] Thread exiting."
  end

  # publish_event sends one randomly generated playback event to the broker.
  # screen_count is read inside the mutex to pick up live config changes.
  def publish_event(client)
    screen_count = @mutex.synchronize { @screen_count }
    screen_id  = "screen-#{format('%02d', rand(1..screen_count))}"
    asset_name = ASSETS.sample
    duration   = rand(10..90)

    payload = {
      screen_id:     screen_id,
      asset_name:    asset_name,
      started_at:    Time.now.utc.iso8601(3),  # millisecond precision for latency calc
      duration_secs: duration
    }.to_json

    topic = "screens/#{screen_id}/playback"
    client.publish(topic, payload, retain: false, qos: 1)
  end

  # connect_once opens a single-use connection for burst mode.
  def connect_once
    client = MQTT::Client.connect(host: @host, port: @port)
    yield client
  ensure
    client&.disconnect
  end

  # apply_options updates @interval_ms and @screen_count with clamping.
  # Must be called inside @mutex.synchronize.
  def apply_options(options)
    if options[:interval_ms]
      @interval_ms = options[:interval_ms].to_i.clamp(MIN_INTERVAL_MS, 60_000)
    end
    if options[:screen_count]
      @screen_count = options[:screen_count].to_i.clamp(1, MAX_SCREEN_COUNT)
    end
  end

end
