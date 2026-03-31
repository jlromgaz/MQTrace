# PlaybackChannel is an ActionCable channel — the Rails WebSocket abstraction.
#
# HOW ACTIONCABLE WORKS (vs Java/Spring Boot):
#
# In Spring Boot, you might use @MessageMapping and SimpMessagingTemplate.
# In Rails, ActionCable provides:
#   - A "channel" class (this file) — defines what happens on connect/disconnect
#   - A named "stream" — a pub/sub topic that clients subscribe to
#   - A broadcaster — any part of Rails can push data to all stream subscribers
#
# Flow:
#   1. React connects to ws://localhost:3000/cable (WebSocket upgrade)
#   2. React calls cable.subscriptions.create({ channel: 'PlaybackChannel' })
#   3. Rails calls subscribed() on this class
#   4. subscribed() calls stream_from "playback_events"
#   5. Now when MqttSubscriberService calls:
#        ActionCable.server.broadcast("playback_events", data)
#      ALL connected React clients receive the data instantly.
#
# The stream name "playback_events" is just a string key — it must match
# exactly in both stream_from and broadcast calls.
#
# Java/Spring Boot equivalent:
#   @SubscribeMapping("/topic/playback-events")
#   + SimpMessagingTemplate.convertAndSend("/topic/playback-events", data)

class PlaybackChannel < ApplicationCable::Channel

  # subscribed() is called when a client successfully establishes a WebSocket
  # subscription to this channel.
  #
  # stream_from registers this connection to receive all future broadcasts
  # sent to the "playback_events" named stream.
  #
  # Multiple React clients can subscribe simultaneously — each gets every broadcast.
  # This is the pub/sub pattern: one publisher (MQTT subscriber), many consumers (React tabs).
  def subscribed
    stream_from "playback_events"
    Rails.logger.info "[MQTrace] Client subscribed to PlaybackChannel"
  end

  # unsubscribed() is called when the client disconnects (closes the browser tab,
  # navigates away, or loses the network connection).
  # ActionCable automatically stops the stream — no manual cleanup needed.
  def unsubscribed
    Rails.logger.info "[MQTrace] Client unsubscribed from PlaybackChannel"
  end

end
