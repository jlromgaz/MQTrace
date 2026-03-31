# config/initializers/simulator.rb
#
# Registers a single global SimulatorService instance as the constant SIMULATOR.
# This makes it accessible from the controller as SIMULATOR.start(...) etc.
#
# WHY A CONSTANT INSTEAD OF A CLASS VARIABLE?
# Ruby constants are globally accessible and communicate intent clearly:
# "there is exactly one of these". A class variable (@@instance) would be
# scoped to the class and less visible.
#
# WHY NOT DEPENDENCY INJECTION?
# Rails doesn't have an IoC container like Spring. For singleton services,
# the idiomatic approach is a constant or a module-level variable.
# This is equivalent to a @Bean in Spring that returns a shared instance:
#   @Bean
#   public SimulatorService simulatorService() { return new SimulatorService(); }
#
# The simulator starts STOPPED — the React debug panel starts it on demand.
# This is different from MqttSubscriberService which starts automatically on boot.

unless Rails.env.test?
  # Explicitly require the service file because initializers run before
  # Rails autoload is fully active. Without this, SimulatorService would be
  # an uninitialized constant at boot time.
  require Rails.root.join("app/services/simulator_service")

  # Instantiate but do NOT start — the debug panel controls start/stop.
  SIMULATOR = SimulatorService.new
  Rails.logger.info "[Simulator] SimulatorService registered (idle). Use the debug panel to start."
end
