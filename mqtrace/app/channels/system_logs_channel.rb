class SystemLogsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "system_logs"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
