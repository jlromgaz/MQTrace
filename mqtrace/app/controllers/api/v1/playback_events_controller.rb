# PlaybackEventsController handles REST API requests for playback event data.
#
# Namespace: Api::V1
# This double-namespace (Api then V1) keeps the routes versioned from day one.
# URL prefix: /api/v1/playback_events
#
# Java/Spring Boot equivalent:
#   @RestController
#   @RequestMapping("/api/v1/playback-events")
#   public class PlaybackEventsController { ... }
#
# In Rails API mode, ApplicationController already includes:
#   - ActionController::API (a slimmed-down controller without view helpers)
#   - JSON rendering support
# It does NOT include sessions, cookies, or flash — we don't need those.

class Api::V1::PlaybackEventsController < ApplicationController

  # GET /api/v1/playback_events
  # GET /api/v1/playback_events?screen_id=screen-01
  #
  # Returns a JSON array of playback events, newest first, capped at 100 records.
  # Supports optional filtering by screen_id query parameter.
  #
  # Java/Spring Boot equivalent:
  #   @GetMapping
  #   public List<PlaybackEvent> index(@RequestParam(required=false) String screenId) { ... }
  def index
    # Start with all records — ActiveRecord::Relation is lazy, like a JPA Criteria query.
    # Nothing hits the database until we actually use the result.
    events = PlaybackEvent.all

    # Conditionally add a WHERE clause if screen_id param is present.
    # params is a Hash-like object containing query string params and route params.
    # .present? returns true if the value is non-nil and non-empty.
    # Java equivalent: if (screenId != null && !screenId.isBlank()) { ... }
    if params[:screen_id].present?
      events = events.where(screen_id: params[:screen_id])
    end

    # Chain ORDER and LIMIT — these are appended to the SQL query, not loaded into memory.
    # Java/JPA equivalent: .orderBy(cb.desc(root.get("startedAt"))).setMaxResults(100)
    events = events.order(started_at: :desc).limit(100)

    # render json: serializes the ActiveRecord result to JSON and sends it with HTTP 200.
    # Rails infers Content-Type: application/json automatically.
    # Java equivalent: return ResponseEntity.ok(events);
    render json: events
  end

  # GET /api/v1/playback_events/:id
  #
  # Returns a single playback event by primary key.
  # Responds with 404 JSON if the record doesn't exist.
  #
  # Java/Spring Boot equivalent:
  #   @GetMapping("/{id}")
  #   public ResponseEntity<PlaybackEvent> show(@PathVariable Long id) { ... }
  def show
    # find() raises ActiveRecord::RecordNotFound if the record doesn't exist.
    # find_by() would return nil instead — use find() when absence is an error.
    # Java equivalent: repository.findById(id).orElseThrow(EntityNotFoundException::new)
    event = PlaybackEvent.find(params[:id])
    render json: event

  rescue ActiveRecord::RecordNotFound
    # Return a structured JSON error with HTTP 404.
    # :not_found is a Rails symbol alias for HTTP status 404.
    # Rails knows all standard HTTP status symbols — see ActionDispatch::Http::STATUS_CODES.
    render json: { error: "Playback event not found" }, status: :not_found
  end

end
