# MQTrace

Welcome to the **MQTrace** workspace! This is a full-stack real-time analytics application split into two primary components:

- `mqtrace/`: Ruby on Rails 8 API backend orchestrating PostgreSQL, ActionCable, and MQTT messaging.
- `mqtrace-frontend/`: React + Vite frontend dashboard for real-time visualization. (React Native mobile migration in progress).

## Prerequisites
To run this project, you must have the following installed on your system and available in your global `PATH`:
- **Ruby** (v3.2+)
- **Node.js** (v18+) & **NPM**
- **PostgreSQL**
- **Mosquitto** (MQTT Broker)

## 🚀 Quick Start (Running the Stack)

This repository includes OS-aware boot scripts that orchestrate the database checks, MQTT instances, and boot both Rails and the Frontend concurrently.

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
