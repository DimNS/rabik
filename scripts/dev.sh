#!/usr/bin/env bash
set -euo pipefail

bun build --watch src/index.ts --target=browser --outdir=dist --sourcemap & bunx serve .
