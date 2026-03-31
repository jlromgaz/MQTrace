# MQTrace

Welcome to the **MQTrace** workspace! This is a full-stack real-time analytics application split into two primary components:

- `mqtrace/`: Ruby on Rails 8 API backend orchestrating PostgreSQL, ActionCable, and MQTT messaging.
- `mqtrace-frontend/`: React + Vite frontend dashboard for real-time visualization. (React Native mobile migration in progress).

## 🛠️ System Prerequisites (Dependencies)
To run this project natively, your machine must have the following core dependencies installed and exposed in your global system `PATH`:

### 1. Core Languages
- **Ruby (v3.2+)**: Required to run the Rails 8 API backend.
- **Node.js (v18+) & NPM**: Required to run the Vite React dashboard.

### 2. Infrastructure Services
- **PostgreSQL (v14+)**: The primary relational database for persisting PlaybackEvents.
- **Mosquitto**: The MQTT broker that handles the high-throughput publish/subscribe messaging queue.

> **How to install these quickly:**
> - **Windows (via Winget):** `winget install RubyInstallerTeam.RubyWithDevKit; winget install OpenJS.NodeJS; winget install PostgreSQL.PostgreSQL; winget install EclipseFoundation.Mosquitto`
> - **Ubuntu/Debian:** `sudo apt update && sudo apt install ruby-full nodejs npm postgresql mosquitto`
> - **macOS (via Homebrew):** `brew install ruby node postgresql mosquitto`

## 🚀 Quick Start (Running the Stack)

This repository relies on **OS-Aware Boot Scripts**. Since MQTrace coordinates several layers (a Vite frontend, a Rails API backend, a PostgreSQL database, and an MQTT broker), we provide a unified boot sequence to orchestrate them.

**Why do we have dual scripts?**
To respect cross-platform environments, we follow the Open Source industry standard: Windows developers get a native PowerShell orchestrator, while Linux and macOS developers rely on a native POSIX Bash script. Both scripts act dynamically—meaning no physical paths are hardcoded—and perform the following strictly ordered sequence:

1. **Intelligent Dependency Checks:** Safely inspects your system PATH to ensure `ruby` and `node` are available before attempting to boot.
2. **Ghost PID Cleanup:** Defensively deletes any stale `mqtrace/tmp/pids/server.pid` files left behind by a previous `Ctrl+C` interrupt. This guarantees Rails will never hang quietly or throw `Address already in use` connection errors.
3. **Infrastructure Layer:** Commands your native OS (`Start-Service` on Windows or `systemctl` / `brew services` on Unix) to boot Mosquitto and PostgreSQL.
4. **Concurrent Launch:** Boots the Rails API and the Vite front-end GUI safely together using relative commands (`bundle exec rails server`).

### 🪟 Windows
Open PowerShell in the root directory and execute:
```powershell
.\Start-MQTrace.ps1
```

### 🐧 Linux & macOS
Open your terminal in the root directory and execute:
```bash
./start-mqtrace.sh
```

### Endpoints Map
- **Frontend Dashboard**: `http://localhost:5173`
- **Rails API**: `http://localhost:3000`
- **ActionCable WS**: `ws://localhost:3000/cable`

## Troubleshooting
If you cannot install Mosquitto locally, you can fallback to the public HiveMQ broker by creating a `.env` file in the `mqtrace` directory:
```
MQTT_HOST=broker.hivemq.com
```
