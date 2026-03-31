require 'mqtt'
require 'json'
require 'securerandom'
require 'time'
require 'thread'

HOST = ENV.fetch('MQTT_HOST', 'localhost')
PORT = ENV.fetch('MQTT_PORT', '1883').to_i
TOTAL_MESSAGES = 5000
CONCURRENCY = 10
MESSAGES_PER_THREAD = TOTAL_MESSAGES / CONCURRENCY

puts "🚀 [QA TESTER] Initiating MQTT Stress Test..."
puts "Target: #{HOST}:#{PORT}"
puts "Load: #{TOTAL_MESSAGES} messages across #{CONCURRENCY} threads."

start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
threads = []
errors = 0
mutex = Mutex.new

CONCURRENCY.times do |i|
  threads << Thread.new do
    begin
      client = MQTT::Client.connect(host: HOST, port: PORT)
      
      MESSAGES_PER_THREAD.times do |j|
        screen_id = format('screen_stress_%03d', rand(1..50))
        topic = "screens/#{screen_id}/playback"
        payload = {
          screen_id: screen_id,
          asset_name: "stress_test_video_#{j}.mp4",
          started_at: Time.now.utc.iso8601,
          duration_secs: rand(5..30)
        }.to_json

        client.publish(topic, payload, false, 1) # QoS 1
      end
      
      client.disconnect
    rescue => e
      mutex.synchronize { errors += 1 }
      puts "Thread Error: #{e.message}"
    end
  end
end

threads.each(&:join)

end_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
elapsed = end_time - start_time
throughput = TOTAL_MESSAGES / elapsed

puts "============================================="
puts "📊 [QA TESTER] STRESS TEST RESULTS"
puts "Elapsed Time: #{elapsed.round(2)}s"
puts "Throughput:   #{throughput.round(2)} msgs/sec"
puts "Errors:       #{errors}"
puts "============================================="

if errors > 0
  puts "💥 FLAW DETECTED: Network bottlenecks or dropped connections."
  exit 1
else
  puts "✅ PASS: System absorbed the burst."
  exit 0
end
