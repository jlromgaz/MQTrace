# app/controllers/api/v1/simulator_controller.rb
#
# SimulatorController exposes a REST API for the React debug panel to control
# the built-in SimulatorService: start, stop, reconfigure, burst, and status.
#
# All actions operate on the global SIMULATOR singleton registered in
# config/initializers/simulator.rb. This is the Rails equivalent of a
# Spring @Autowired singleton service bean.
#
# Routes (defined in config/routes.rb):
#   GET  /api/v1/simulator/status  → status
#   POST /api/v1/simulator/start   → start
#   POST /api/v1/simulator/stop    → stop
#   POST /api/v1/simulator/burst   → burst

class Api::V1::SimulatorController < ApplicationController

  # GET /api/v1/simulator/status
  # Returns current simulator state (running, interval, screen count).
  def status
    render json: SIMULATOR.status
  end

  # POST /api/v1/simulator/start
  # Body: { "interval_ms": 500, "screen_count": 5 }
  # Starts the simulator (or reconfigures it if already running).
  def start
    SIMULATOR.start(
      interval_ms:  params[:interval_ms],
      screen_count: params[:screen_count]
    )
    render json: SIMULATOR.status
  end

  # POST /api/v1/simulator/stop
  # Stops the simulation thread.
  def stop
    SIMULATOR.stop
    render json: SIMULATOR.status
  end

  # POST /api/v1/simulator/burst
  # Body: { "count": 20 }
  # Fires `count` events immediately. Useful for load spikes.
  # Default count is 20 if not provided.
  def burst
    count     = (params[:count] || 20).to_i.clamp(1, 200)
    published = SIMULATOR.burst(count: count)
    render json: { status: "ok", fired: published }
  rescue MQTT::Exception, Errno::ECONNREFUSED => e
    render json: { error: "MQTT broker unreachable: #{e.message}" }, status: :service_unavailable
  end

end
