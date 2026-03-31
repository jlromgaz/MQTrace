#!/usr/bin/env ruby

# mqtrace/bin/setup_db.rb
# Handles autonomous database initialization for MQTrace.

# Force English output for tools (Rails, PostgreSQL client, etc)
ENV['LANG'] = 'en_US.UTF-8'
ENV['LC_ALL'] = 'C'

def log(msg, color = :cyan)
  colors = { cyan: "\e[36m", green: "\e[32m", yellow: "\e[33m", red: "\e[31m", gray: "\e[90m", reset: "\e[0m" }
  # Fallback for environments that don't support ANSI colors
  if ENV['TERM'] == 'dumb' || Gem.win_platform?
    puts "  [DB SETUP] #{msg}"
  else
    puts "#{colors[color]}  [DB SETUP] #{msg}#{colors[:reset]}"
  end
end

Dir.chdir(File.expand_path('..', __dir__)) do
  log "Step 1/2: Ensuring gems are installed..."
  # Check if gems are satisfied, if not run bundle install
  if !system("bundle check", out: File::NULL, err: File::NULL)
    log "Running 'bundle install' (this may take a minute)...", :yellow
    unless system("bundle install")
      log "Failed to install gems. Please check your internet connection and Ruby environment.", :red
      exit 1
    end
  end
  log "[OK] Gems are ready.", :green

  log "Step 2/2: Preparing database (rails db:prepare)..."
  # db:prepare is idempotent: it runs db:create + db:migrate
  # It will fail if the 'admin' role doesn't exist.
  if system("bundle exec rails db:prepare")
    log "[OK] Database is ready.", :green
    exit 0
  else
    log "[!] 'rails db:prepare' failed. Attempting to create missing PostgreSQL role 'mqtrace'...", :yellow
    
    # Step 3 (Recovery): Best-effort attempt to create or update the 'mqtrace' role.
    # We use an idempotent PL/pgSQL block to create the role if missing, or update password if it exists.
    # This ensures 'mqtrace:mqtrace' matches the user's requirements.
    create_role_sql = <<~SQL.gsub("\n", " ").strip
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'mqtrace') THEN
          CREATE ROLE mqtrace WITH LOGIN PASSWORD 'mqtrace' SUPERUSER;
        ELSE
          ALTER ROLE mqtrace WITH PASSWORD 'mqtrace' SUPERUSER;
        END IF;
      END
      $$;
    SQL

    success = if Gem.win_platform?
      # Windows: Try psql as postgres.
      system("psql -U postgres -c \"#{create_role_sql}\"")
    else
      # Linux/macOS: Try sudo -u postgres psql
      system("sudo -u postgres psql -c \"#{create_role_sql}\"")
    end

    if success
      log "[OK] Role 'mqtrace' created successfully.", :green
      log "Retrying database preparation...", :cyan
      if system("bundle exec rails db:prepare")
        log "[OK] Database is ready.", :green
        exit 0
      else
        log "[!] Database preparation failed even after creating the role.", :red
        exit 1
      end
    else
      log "[!] Could not create 'mqtrace' role automatically.", :red
      log "Please ensure PostgreSQL is running and you have created the 'mqtrace' role:", :gray
      log "  psql -U postgres -c \"CREATE ROLE mqtrace WITH LOGIN PASSWORD 'mqtrace' SUPERUSER;\"", :gray
      exit 1
    end
  end
end
