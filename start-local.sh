#!/bin/sh
# OfficeHub lokal im Büro-WLAN bereitstellen (für direkte Shelly-Steuerung per IP).
# Auf einem Rechner starten, der im Büro-Netz dauerhaft läuft (Mac, NAS, Raspberry Pi):
#   sh start-local.sh
# Danach im Büro-WLAN aufrufen: http://<IP-dieses-Rechners>:8741
cd "$(dirname "$0")"
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
echo "OfficeHub lokal: http://${IP:-<IP>}:8741  (Strg+C beendet)"
exec python3 -m http.server 8741 --bind 0.0.0.0
