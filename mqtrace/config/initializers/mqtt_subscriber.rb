# config/initializers/mqtt_subscriber.rb
#
# Rails initializers run ONCE when the application boots, before the first request.
# This initializer starts the MqttSubscriberService in a background thread.
#
# WHY AN INITIALIZER?
# Rails loads all files in config/initializers/ automatically at startup.
# This is the correct place for "do this at boot time" logic.
# Java/Spring Boot equivalent: a class implementing ApplicationRunner or
# CommandLineRunner, annotated with @Component — it runs after the
# Spring context is fully initialized.
#
# WHY NOT A SIDEKIQ JOB OR ACTIVE JOB?
# Those are designed for discrete tasks with a start and end.
# The MQTT subscriber runs FOREVER — it's a long-lived background process,
# not a task. A Thread is the simplest fit here.
# In production with multiple Puma workers (processes), each process would
# start its own subscriber thread — acceptable for a demo, but in production
# you'd want a dedicated process (e.g. a separate Sidekiq worker or container).
#
# IMPORTANT: We skip this in test environment to avoid real MQTT connections
# during the test suite. Tests that need MQTT behavior should stub/mock it.

unless Rails.env.test?
  # Start the subscriber in a background Thread so it doesn't block Puma.
  # Thread.new creates a new OS-level thread within the same Ruby process.
  # The thread runs MqttSubscriberService#start, which loops forever.
  Thread.new do
    # Short sleep to let Rails finish booting completely before the subscriber
    # starts making database calls. Without this, the AR connection pool
    # may not be fully initialized yet.
    sleep 2

    Rails.logger.info "[MQTrace] Starting MQTT subscriber thread..."

    # Instantiate and start the service.
    # The service handles its own reconnection logic internally.
    MqttSubscriberService.new.start

  # This rescue is a last-resort safety net. MqttSubscriberService already
  # handles exceptions internally — this catches anything that escapes,
  # preventing a silent thread crash that would stop all MQTT processing.
  rescue => e
    Rails.logger.error "[MQTrace] MQTT subscriber thread crashed: #{e.class}: #{e.message}"
    Rails.logger.error e.backtrace.first(10).join("\n")
  end
end
