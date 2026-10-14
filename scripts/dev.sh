#!/usr/bin/env bash
set -euo pipefail

export APP_VERSION="${APP_VERSION:-dev}"
bun build --watch src/index.ts --target=browser --outdir=dist --sourcemap --env="APP_VERSION*" & bun build --watch tools/level-preview.ts --target=browser --outdir=tools --sourcemap & bunx serve .
