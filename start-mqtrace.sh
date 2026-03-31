#!/usr/bin/env bash
set -e

echo ""
echo -e "\e[36m  MQTrace — Starting stack... \e[0m"
echo ""

# ── Step 1: Verify Dependencies ───────────────────────────────────────────
echo -e "\e[33m  [0/3] Checking Dependencies...\e[0m"

if ! command -v ruby &> /dev/null; then
    echo -e "\e[31m  ⚠  Ruby is not installed or not in PATH.\e[0m"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "\e[31m  ⚠  Node.js is not installed or not in PATH.\e[0m"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "\e[31m  ⚠  npm is not installed or not in PATH.\e[0m"
    exit 1
fi

echo -e "\e[32m  ✓ Dependencies found: $(ruby -v | awk '{print $1" "$2}'), Node $(node -v)\e[0m"

# ── Step 2: Check Mosquitto ────────────────────────────────────────────────
echo -e "\e[33m  [1/3] Checking Mosquitto MQTT broker...\e[0m"
if command -v systemctl &> /dev/null; then
    if ! systemctl is-active --quiet mosquitto; then
        echo -e "\e[33m  → Starting Mosquitto via systemctl (might ask for sudo)...\e[0m"
        sudo systemctl start mosquitto || echo -e "\e[31m  ⚠  Could not start Mosquitto automatically. Ensure it is running or configure HiveMQ.\e[0m"
    else
        echo -e "\e[32m  ✓ Mosquitto running.\e[0m"
    fi
elif command -v brew &> /dev/null; then
    brew services start mosquitto || true
else
    echo -e "\e[33m  ℹ  Please ensure Mosquitto is running manually.\e[0m"
fi

# ── Step 3: Check PostgreSQL ───────────────────────────────────────────────
echo -e "\e[33m  [2/3] Checking PostgreSQL...\e[0m"
if command -v systemctl &> /dev/null; then
    sudo systemctl start postgresql || true
fi

# ── Step 4: Launch ─────────────────────────────────────────────────────────
echo -e "\e[33m  [3/3] Launching Rails + Vite...\e[0m"
echo ""
echo -e "\e[90m  ┌─────────────────────────────────────────┐\e[0m"
echo -e "\e[90m  │  Rails API  →  http://localhost:3000    │\e[0m"
echo -e "\e[90m  │  Dashboard  →  http://localhost:5173    │\e[0m"
echo -e "\e[90m  │  WebSocket  →  ws://localhost:3000/cable│\e[0m"
echo -e "\e[90m  └─────────────────────────────────────────┘\e[0m"
echo ""

cd mqtrace-frontend
npm run dev:full
