#!/bin/sh
# OfficeHub auf dem Büro-Mac (z. B. Mac mini) dauerhaft bereitstellen.
# Einmalig auf dem Mac ausführen:
#   curl -fsSL https://raw.githubusercontent.com/christophgerhardt-del/office-hub/main/install-macmini.sh | sh
# Danach läuft die App bei jeder Anmeldung automatisch unter http://<Name-des-Macs>.local:8742
# und holt sich stündlich die neueste Version von GitHub.
set -e
DIR="$HOME/office-hub"
PLIST="$HOME/Library/LaunchAgents/eu.officehub.local.plist"

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull -q --ff-only || true
else
  git clone -q https://github.com/christophgerhardt-del/office-hub.git "$DIR"
fi

cat > "$DIR/serve.sh" <<'EOF'
#!/bin/sh
cd "$HOME/office-hub"
# Alle 60 Minuten aktualisieren (im Hintergrund), Server im Vordergrund
( while true; do sleep 3600; git pull -q --ff-only >/dev/null 2>&1 || true; done ) &
exec /usr/bin/python3 -m http.server 8742 --bind 0.0.0.0
EOF
chmod +x "$DIR/serve.sh"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>eu.officehub.local</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$DIR/serve.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/officehub.log</string>
  <key>StandardErrorPath</key><string>/tmp/officehub.log</string>
</dict></plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

NAME=$(scutil --get LocalHostName 2>/dev/null || hostname -s)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<IP>")
sleep 1
if curl -s -o /dev/null "http://127.0.0.1:8742/index.html"; then
  echo ""
  echo "✅ OfficeHub läuft lokal:"
  echo "   http://$NAME.local:8742   oder   http://$IP:8742"
  echo "   (startet automatisch bei jeder Anmeldung, aktualisiert sich stündlich)"
else
  echo "⚠️  Server antwortet noch nicht – Log: /tmp/officehub.log"
fi
