# config/initializers/cors.rb — Cross-Origin Resource Sharing configuration.
#
# WHY CORS IS NEEDED:
# Browsers enforce the Same-Origin Policy: JavaScript running on one origin
# (e.g. http://localhost:5173 — the React Vite dev server) cannot make HTTP
# requests to a different origin (e.g. http://localhost:3000 — the Rails API)
# unless the server explicitly allows it via CORS headers.
#
# This file configures the rack-cors middleware to add the necessary
# Access-Control-Allow-Origin and related headers to Rails responses.
#
# Java/Spring Boot equivalent:
#   @Configuration
#   public class CorsConfig implements WebMvcConfigurer {
#     @Override
#     public void addCorsMappings(CorsRegistry registry) {
#       registry.addMapping("/**")
#         .allowedOrigins("http://localhost:5173")
#         .allowedMethods("GET", "POST", ...);
#     }
#   }
#
# NOTE: insert_before 0 places the CORS middleware at the VERY FRONT of the
# Rack middleware stack. This ensures CORS headers are added even for requests
# that fail in later middleware (e.g., authentication failures still get CORS headers,
# so the browser can read the error response).

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # origins: the list of allowed requesting origins.
    # In development, the React Vite dev server runs on port 5173 by default.
    # Change this if you change Vite's port in vite.config.js.
    # In production, replace with your actual frontend domain.
    origins "http://localhost:5173"

    # resource: which paths on the Rails server are accessible cross-origin.
    # '*' means all paths — appropriate for an API server.
    resource "*",
      headers: :any,   # Allow any request headers (e.g. Content-Type, Authorization)
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      # expose: makes these response headers readable by the browser JavaScript.
      # By default, only a few "safe" headers are accessible to JS.
      expose: ["Authorization"]
  end
end
