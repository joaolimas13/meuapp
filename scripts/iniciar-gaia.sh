#!/usr/bin/env bash
# Inicia o GAIA e abre o navegador em tela cheia (modo quiosque). Para Linux.
# Uso: ./scripts/iniciar-gaia.sh        (depois de rodar "npm run install:all" e "npm run build" uma vez)
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-8787}"
URL="http://127.0.0.1:${PORT}"

# 1) Sobe o backend se ainda não estiver rodando.
if ! curl -fs "${URL}/api/health" >/dev/null 2>&1; then
  (cd backend && nohup npm start >> ../gaia.log 2>&1 &)
  for _ in $(seq 1 30); do
    curl -fs "${URL}/api/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi

# 2) Escolhe o navegador que existir.
for b in chromium chromium-browser google-chrome google-chrome-stable microsoft-edge; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER_BIN="$b"; break; fi
done
if [ -z "${BROWSER_BIN:-}" ]; then echo "Nenhum Chrome/Chromium/Edge encontrado. Abra ${URL} e aperte F11."; exit 1; fi

# 3) Tela cheia sem barras. --autoplay-policy deixa a voz do GAIA falar sem precisar de clique.
exec "$BROWSER_BIN" --kiosk --noerrdialogs --disable-infobars --no-first-run \
  --autoplay-policy=no-user-gesture-required --user-data-dir="$HOME/.gaia-browser" "${URL}"
