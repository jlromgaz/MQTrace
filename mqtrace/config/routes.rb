# config/routes.rb — the routing table for the entire Rails application.
#
# Java/Spring Boot equivalent: the combination of @RequestMapping, @GetMapping,
# @PostMapping annotations across all controllers. In Rails, ALL routes are
# declared centrally in this one file, which makes the API surface immediately visible.
#
# Run `rails routes` in the terminal to see all generated routes with their
# HTTP methods, URL patterns, controller#action mappings, and named path helpers.

Rails.application.routes.draw do

  # Versioned REST API namespace.
  # namespace :api creates a URL prefix /api AND expects controllers in app/controllers/api/
  # namespace :v1 further nests to /api/v1 AND expects controllers in app/controllers/api/v1/
  #
  # Java/Spring Boot equivalent:
  #   @RequestMapping("/api/v1") on the controller class, combined with
  #   a package structure like com.example.controllers.api.v1
  namespace :api do
    namespace :v1 do
      # resources generates RESTful routes. `only:` limits which ones are created.
      # With only: [:index, :show], this generates:
      #   GET /api/v1/playback_events          → playback_events#index
      #   GET /api/v1/playback_events/:id      → playback_events#show
      #
      # Java/Spring Boot equivalent of the full resources would be:
      #   @GetMapping, @PostMapping, @PutMapping, @DeleteMapping all on one controller.
      # Using `only:` is like explicitly annotating only the methods you implement.
      resources :playback_events, only: [:index, :show]

      # Simulator control endpoints — used by the React debug panel.
      # These are not RESTful resources (no model behind them), so we use
      # explicit named routes instead of `resources`.
      # Java/Spring Boot equivalent: @RestController with @PostMapping methods.
      namespace :simulator do
        get  :status
        post :start
        post :stop
        post :burst
      end
    end
  end

  # Mount ActionCable WebSocket server at /cable.
  # ActionCable is Rails' built-in WebSocket framework.
  # "Mounting" means the Rack middleware stack will route WebSocket upgrade
  # requests at /cable to the ActionCable server.
  #
  # The React frontend connects to: ws://localhost:3000/cable
  # Java/Spring Boot equivalent: @EnableWebSocket + WebSocketConfigurer.registerWebSocketHandlers("/cable")
  mount ActionCable.server => "/cable"

  # Health check endpoint — used by load balancers and monitoring tools.
  # Returns HTTP 200 if Rails boots successfully, 500 if there's an error.
  get "up" => "rails/health#show", as: :rails_health_check

end
