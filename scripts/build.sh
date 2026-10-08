#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
bun build src/index.ts --target=browser --outdir=dist

cp -r public dist/public
rm -rf dist/public/assets/raw

sed 's|./dist/index.js|./index.js|' index.html > dist/index.html
cp favicon.ico dist/favicon.ico
