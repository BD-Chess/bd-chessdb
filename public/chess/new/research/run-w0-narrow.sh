#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Install package-lock dependencies here, or supply an isolated NODE_PATH.
node --test --test-reporter=tap \
  lab-storage.test.cjs study-core.test.cjs study-ui.test.cjs study-w0.test.cjs \
  deep-ui.test.cjs evidence.test.cjs sim-store.test.cjs sim-runner.test.cjs sim-completion.test.cjs \
  analysis-source.test.cjs source-context-integration.test.cjs \
  study-load-integration.test.cjs workspace-clock.test.cjs dcc-move-click.test.cjs \
  lab-integration.test.cjs top-five.test.cjs eval-bar.test.cjs
