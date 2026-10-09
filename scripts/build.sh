#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
bun build src/index.ts --target=browser --outdir=dist

cp -r public dist/public
rm -rf dist/public/assets/raw

sed 's|./dist/index.js|./index.js|' index.html > dist/index.html
cp favicon.ico dist/favicon.ico
bun scripts/gen-sw.ts
cp manifest.webmanifest dist/manifest.webmanifest
cp sw.js dist/sw.js
cp -r icons dist/icons
