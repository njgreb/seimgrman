#!/usr/bin/env bash
# Renders strategy-guide.html to a one-page PDF with headless Chrome.
# Chrome writes the file and then declines to exit, so we wait for the write and stop it ourselves.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME (set CHROME=...)" >&2; exit 1; }

# The mugshots are 5x nearest-neighbour upscales of the game's own 96px portraits, so the pixels stay
# square in print. Refreshed here when Pillow is around; the committed copies are used otherwise.
if python3 -c "import PIL" 2>/dev/null; then
  python3 - <<'UPSCALE'
from PIL import Image
for b in ['sync', 'ticket', 'roadmap', 'oncall', 'cto']:
    im = Image.open(f'../public/assets/bosses/{b}/portrait16.png').convert('RGBA')
    im.resize((im.width * 5, im.height * 5), Image.NEAREST).save(f'art/{b}.png')
UPSCALE
fi

OUT="$PWD/strategy-guide.pdf"
PROFILE="$(mktemp -d)"
rm -f "$OUT"

"$CHROME" --headless=new --disable-gpu --no-first-run --no-default-browser-check \
  --no-pdf-header-footer --virtual-time-budget=5000 \
  --user-data-dir="$PROFILE" --print-to-pdf="$OUT" \
  "file://$PWD/strategy-guide.html" >/dev/null 2>&1 &
CHROME_PID=$!

for _ in $(seq 1 30); do
  [ -s "$OUT" ] && sleep 1 && break
  sleep 1
done
kill "$CHROME_PID" 2>/dev/null || true
wait "$CHROME_PID" 2>/dev/null || true
rm -rf "$PROFILE"

[ -s "$OUT" ] || { echo "render failed: no PDF written" >&2; exit 1; }
PAGES=$(python3 -c "import re,sys; d=open('$OUT','rb').read(); print(len(re.findall(rb'/Type\s*/Page[^s]', d)))")
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes, $PAGES page(s))"
[ "$PAGES" = "1" ] || echo "WARNING: expected 1 page, got $PAGES" >&2
