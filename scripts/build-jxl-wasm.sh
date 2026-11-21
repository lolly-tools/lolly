#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
# Portable, single-thread libjxl. Scratch toolchain only; no global installation.
set -euo pipefail
JXL_COMMIT=5a7da83447212fe4900fc29ce97430b881caa67e
EMSDK_COMMIT=c0bb220cb6e6f4e0fabb6f6db9efd53390ef5e56
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${1:-/tmp/lolly-jxl-build}"
OUT="$ROOT/packages/node-shell/wasm/jxl"
mkdir -p "$WORK" "$OUT/vendor"
if [ ! -d "$WORK/emsdk" ]; then git clone --depth 1 --branch 4.0.23 https://github.com/emscripten-core/emsdk.git "$WORK/emsdk"; fi
test "$(git -C "$WORK/emsdk" rev-parse HEAD)" = "$EMSDK_COMMIT"
"$WORK/emsdk/emsdk" install 4.0.23
"$WORK/emsdk/emsdk" activate 4.0.23
source "$WORK/emsdk/emsdk_env.sh"
if [ ! -d "$WORK/libjxl" ]; then git clone --depth 1 --branch v0.13.0 https://github.com/libjxl/libjxl.git "$WORK/libjxl"; fi
test "$(git -C "$WORK/libjxl" rev-parse HEAD)" = "$JXL_COMMIT"
git -C "$WORK/libjxl" submodule update --init --depth 1 third_party/brotli third_party/highway third_party/skcms
emcmake cmake -S "$ROOT/scripts/jxl" -B "$WORK/build" -G Ninja \
  -DLIBJXL_SOURCE="$WORK/libjxl" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS=-DHWY_COMPILE_ONLY_SCALAR -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTING=OFF -DJPEGXL_ENABLE_TOOLS=OFF -DJPEGXL_ENABLE_EXAMPLES=OFF \
  -DJPEGXL_ENABLE_BENCHMARK=OFF -DJPEGXL_ENABLE_JNI=OFF -DJPEGXL_ENABLE_SJPEG=OFF \
  -DJPEGXL_ENABLE_OPENEXR=OFF -DJPEGXL_ENABLE_DOXYGEN=OFF -DJPEGXL_ENABLE_MANPAGES=OFF \
  -DJPEGXL_ENABLE_WASM_THREADS=OFF -DJPEGXL_ENABLE_SKCMS=ON -DJPEGXL_ENABLE_TCMALLOC=OFF \
  -DJPEGXL_BUNDLE_LIBPNG=OFF
cmake --build "$WORK/build" --target lolly-jxl -j4
cp "$WORK/build/lolly-jxl.mjs" "$OUT/vendor/"
cp "$WORK/build/lolly-jxl.wasm" "$OUT/"
cp "$WORK/libjxl/LICENSE" "$OUT/LICENSE.libjxl"
cp "$WORK/libjxl/PATENTS" "$OUT/PATENTS.libjxl"
for dep in brotli highway skcms; do cp "$WORK/libjxl/third_party/$dep/LICENSE" "$OUT/LICENSE.$dep"; done
cp "$WORK/emsdk/upstream/emscripten/LICENSE" "$OUT/LICENSE.emscripten"
shasum -a 256 "$OUT/vendor/lolly-jxl.mjs" "$OUT/lolly-jxl.wasm"

cd "$ROOT"
node scripts/build-jxl-worker.ts
