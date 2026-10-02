#!/bin/bash
# Re-take the reference screenshots of the navy design with headless Chrome.
#
#   bash design/navy/capture.sh            # all pages
#   bash design/navy/capture.sh eo-detail  # only names containing "eo-detail"
#
# Needs the app running (client on :9000, server on :9001). Each page is loaded at the
# given window size and captured once its data has had time to arrive. Headless Chrome
# does not exit on its own against the Vite dev server, so it is stopped after the file
# is written.
#
# "full" pages are captured in a very tall window and then trimmed to their content
# (needs python3 with Pillow; without it the image is left untrimmed). A tall window is
# used instead of a #sec- link plus scrolling because headless captures of a scrolled
# page come out blank at the top.

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="http://localhost:9000"
OUT="$(cd "$(dirname "$0")" && pwd)/screenshots"
PROFILE="${TMPDIR:-/tmp}/govgraph-navy-capture"
ONLY="$1"
mkdir -p "$OUT"

trim() { # crop the empty navy area below the last line of content
  python3 - "$1" <<'EOF' 2>/dev/null
import sys
from PIL import Image, ImageChops
path = sys.argv[1]
im = Image.open(path).convert("RGB")
background = Image.new("RGB", im.size, im.getpixel((2, im.height - 2)))
box = ImageChops.difference(im, background).getbbox()
if box:
    im.crop((0, 0, im.width, min(im.height, box[3] + 80))).save(path)
EOF
}

shot() { # name, path, width, height, [full]
  case "$1" in *"$ONLY"*) ;; *) return ;; esac
  local file="$OUT/$1.png"
  rm -f "$file"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" \
    --window-size="$3,$4" --virtual-time-budget=25000 --screenshot="$file" "$BASE$2" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 240); do [ -s "$file" ] && break; sleep 1; done
  sleep 1
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  pkill -f "$PROFILE" 2>/dev/null
  [ -s "$file" ] || { echo "FAIL  $1"; return; }
  [ "$5" = "full" ] && trim "$file"
  echo "ok    $1"
}

# Presidents and executive orders
shot 01-presidents                 "/"                                                   1440 1100
shot 02-president-profile          "/barack-obama"                                       1440 1100
shot 03-eo-list-president          "/barack-obama/executive-orders"                      1440 4000 full
shot 04-eo-list-all                "/executive-orders"                                   1440 4000 full
shot 05-eo-detail-collapsed        "/barack-obama/executive-orders/eo/13636"             1440 1100
shot 06-eo-detail-full-text        "/barack-obama/executive-orders/eo/13636#sec-1"       1440 14000 full
shot 07-eo-detail-quoted-text      "/barack-obama/executive-orders/eo/13764#sec-1"       1440 30000 full
shot 08-eo-full-text-page          "/barack-obama/executive-orders/eo/13636/text"        1440 14000 full

# Other sections
# 09-timeline: the page loads every Supreme Court case for the period and does not finish in
# headless Chrome; 09-timeline.jpg was taken by hand in a normal window.
shot 10-supreme-court              "/supreme-court"                                      1440 4000 full
shot 11-natural-court              "/supreme-court/roberts-8"                            1440 4000 full
# 12-case-detail: the case page currently crashes (see README), so there is nothing to capture.
shot 13-congress                   "/congress"                                           1440 4000 full
shot 14-congress-session           "/congress/118"                                       1440 5000 full
shot 15-bill-detail                "/congress/118/hjres/124"                             1440 5000 full
shot 16-corpus                     "/corpus"                                             1440 1500
shot 17-case-graph                 "/case-graph"                                         1440 1100
shot 18-sources                    "/sources"                                            1440 5000 full
shot 19-tags                       "/tags"                                               1440 1000

# Narrow window (headless Chrome will not lay out narrower than 500px)
shot 20-narrow-eo-list             "/barack-obama/executive-orders"                      500 8000 full
shot 21-narrow-eo-detail-full-text "/barack-obama/executive-orders/eo/13636#sec-1"       500 24000 full
