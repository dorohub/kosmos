#!/bin/zsh
# KOSMOS per Doppelklick starten: baut die optimierte Version, öffnet sie im Browser
# und macht sie im WLAN fürs Handy erreichbar.
cd "$(dirname "$0")" || exit 1

echo "🚀 KOSMOS wird gestartet …"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js fehlt. Bitte von https://nodejs.org installieren und erneut starten."
  read -k1 "?Taste drücken zum Schließen …"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 Installiere Abhängigkeiten (einmalig) …"
  npm install || { read -k1 "?Fehler – Taste drücken …"; exit 1; }
fi

echo "🛠  Baue optimierte Version …"
npm run build --silent || { read -k1 "?Fehler beim Bauen – Taste drücken …"; exit 1; }

PORT=4173
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

if lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "KOSMOS läuft bereits – öffne Browser."
  open "http://localhost:$PORT/"
  [ -n "$IP" ] && echo "📱 Am Handy (gleiches WLAN): http://$IP:$PORT/"
  read -k1 "?Taste drücken zum Schließen …"
  exit 0
fi

echo ""
echo "✅ KOSMOS läuft!"
echo "   💻 Am Mac:    http://localhost:$PORT/"
if [ -n "$IP" ]; then
  echo "   📱 Am Handy:  http://$IP:$PORT/   (Handy muss im selben WLAN sein)"
fi
echo ""
echo "   Fragt macOS, ob „node“ eingehende Verbindungen erlauben darf: auf „Erlauben“ klicken."
echo "   Zum Beenden dieses Fenster schließen oder Ctrl+C drücken."
echo ""
(sleep 1.5 && open "http://localhost:$PORT/") &
npx vite preview --host --port $PORT --strictPort
