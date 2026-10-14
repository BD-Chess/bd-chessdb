#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Rebuild the unmodified, pinned Reckless engine in a cloud/Linux environment.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RECKLESS_BUILD_WORK="${1:?Usage: build.sh NEW_WORK_DIRECTORY OUTPUT_DIRECTORY}"
RECKLESS_BUILD_OUTPUT="${2:?Usage: build.sh NEW_WORK_DIRECTORY OUTPUT_DIRECTORY}"
RECKLESS_COMMIT="a6fa482c7d46fb81831573f10be396f20a5efdb5"
RECKLESS_NETWORK_HASH="7f587dfb1fe5d74d53909328afa6fd51650c8c7f45907602db7fbb1e52948c61"
if [[ -e "${RECKLESS_BUILD_WORK}" ]]; then
  echo "Work directory already exists; choose a new directory." >&2
  exit 1
fi
if [[ "$(wasm-bindgen --version)" != "wasm-bindgen 0.2.123" ]]; then
  echo "Install wasm-bindgen-cli 0.2.123 before rebuilding." >&2
  exit 1
fi
rustup target add --toolchain 1.93.0 wasm32-unknown-unknown
git clone --filter=blob:none --no-checkout https://github.com/codedeliveryservice/Reckless.git "${RECKLESS_BUILD_WORK}"
git -C "${RECKLESS_BUILD_WORK}" checkout --detach "${RECKLESS_COMMIT}"
mkdir -p "${RECKLESS_BUILD_WORK}/networks" "${RECKLESS_BUILD_OUTPUT}"
curl --fail --location --silent --show-error \
  https://github.com/codedeliveryservice/RecklessNetworks/releases/download/networks/v60-7f587dfb.nnue \
  -o "${RECKLESS_BUILD_WORK}/networks/v60-7f587dfb.nnue"
printf '%s  %s\n' "${RECKLESS_NETWORK_HASH}" "${RECKLESS_BUILD_WORK}/networks/v60-7f587dfb.nnue" | sha256sum --check -
(
  cd "${RECKLESS_BUILD_WORK}"
  RUSTFLAGS="-C target-feature=+simd128" cargo +1.93.0 build --locked --lib \
    --target wasm32-unknown-unknown --release --no-default-features
  wasm-bindgen target/wasm32-unknown-unknown/release/reckless.wasm \
    --target web --out-dir "${RECKLESS_BUILD_OUTPUT}"
)
split -b 20m -d -a 1 "${RECKLESS_BUILD_OUTPUT}/reckless_bg.wasm" "${RECKLESS_BUILD_OUTPUT}/reckless_bg.wasm.part"
sha256sum "${RECKLESS_BUILD_OUTPUT}/reckless_bg.wasm" > "${RECKLESS_BUILD_OUTPUT}/combined-wasm.sha256"
rm "${RECKLESS_BUILD_OUTPUT}/reckless_bg.wasm"
cp "${SCRIPT_DIR}/reckless-engine.js" "${SCRIPT_DIR}/reckless-worker.js" \
  "${SCRIPT_DIR}/adapter.mjs" "${SCRIPT_DIR}/package.json" "${SCRIPT_DIR}/LICENSE" \
  "${SCRIPT_DIR}/SOURCE.md" "${RECKLESS_BUILD_OUTPUT}/"
echo "Built actual Reckless ${RECKLESS_COMMIT}; no server inference or SharedArrayBuffer."
