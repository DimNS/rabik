#!/usr/bin/env bash
set -euo pipefail

bun build --watch src/index.ts --target=browser --outdir=dist --sourcemap & bun build --watch tools/level-preview.ts --target=browser --outdir=tools --sourcemap & bunx serve .
