#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
# ponytail: версия из тега, локально — describe/коммит, иначе dev
export APP_VERSION="${APP_VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo dev)}"
bun build src/index.ts --target=browser --outdir=dist --env="APP_VERSION*"

cp -r public dist/public
rm -rf dist/public/assets/raw

sed 's|./dist/index.js|./index.js|' index.html > dist/index.html
cp favicon.ico dist/favicon.ico
bun scripts/gen-sw.ts
cp manifest.webmanifest dist/manifest.webmanifest
cp sw.js dist/sw.js
cp -r icons dist/icons
