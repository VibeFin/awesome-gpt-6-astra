#!/usr/bin/env bash
# Build (when needed) and serve the website's static output in the foreground.
#
# Writes $OPENCODE_WEB_DIR/deployment-output.json with the built directory,
# installs dependencies, rebuilds when sources are newer than the last build,
# then serves website/dist/client on PORT (default 3000) in the foreground.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_ROOT="$PWD"
APP_DIR="$PROJECT_ROOT/website"
DIST_DIR="$APP_DIR/dist/client"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
export PORT

if /usr/bin/time -p test ! -x "$APP_DIR/node_modules/.bin/vite"; then
  /usr/bin/time -p npm --prefix "$APP_DIR" install --no-audit --no-fund
fi

needs_build=0
if /usr/bin/time -p test ! -f "$DIST_DIR/index.html"; then
  needs_build=1
elif [ -n "$(/usr/bin/time -p find "$APP_DIR/src" "$APP_DIR/public" "$APP_DIR/api" "$APP_DIR/server" "$APP_DIR/shared" "$APP_DIR/scripts" "$APP_DIR/worker" "$APP_DIR/index.html" "$APP_DIR/package.json" "$APP_DIR/package-lock.json" "$APP_DIR/vite.config.mjs" -newer "$DIST_DIR/index.html" -print -quit 2>/dev/null)" ]; then
  needs_build=1
fi
if /usr/bin/time -p test "$needs_build" -eq 1; then
  /usr/bin/time -p npm --prefix "$APP_DIR" run build
fi
/usr/bin/time -p test -f "$DIST_DIR/index.html"
/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p env "DEPLOY_PROJECT=$PROJECT_ROOT" "DEPLOY_DIR=$DIST_DIR" "DEPLOY_OUT=$WEB_DIR/deployment-output.json" node -e 'const fs=require("node:fs");fs.writeFileSync(process.env.DEPLOY_OUT,JSON.stringify({project:process.env.DEPLOY_PROJECT,directory:process.env.DEPLOY_DIR}));console.log("Wrote "+process.env.DEPLOY_OUT);'
/usr/bin/time -p node "$APP_DIR/scripts/serve-static.mjs"
