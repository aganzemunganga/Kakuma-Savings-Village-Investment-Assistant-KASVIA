#!/bin/bash
cd "$(dirname "$0")/../app"
echo "============================================"
echo "  KASVIA - Kakuma Savings and Village"
echo "  Investment Assistant"
echo "============================================"
echo
if command -v python3 &>/dev/null; then PY=python3; elif command -v python &>/dev/null; then PY=python; else PY=""; fi

if [ -n "$PY" ]; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
  echo "On THIS computer, open:   http://localhost:8080"
  [ -n "$IP" ] && echo "On PHONES on the SAME WiFi/hotspot, open:  http://$IP:8080"
  echo
  echo "Keep this window open while using KASVIA. Press Ctrl+C to stop the server."
  echo
  ( sleep 1 && (open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null) ) &
  $PY -m http.server 8080
else
  echo "Python was not found on this computer."
  echo "Option 1: Install Python (usually pre-installed on Mac), then run this file again."
  echo "Option 2: Just open app/index.html to open KASVIA directly in your browser"
  echo "          (works fully offline, but phones on other devices cannot connect to it)."
fi
