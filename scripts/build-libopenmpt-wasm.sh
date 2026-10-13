#!/usr/bin/env bash
# Reproducibly build the vendored libopenmpt WebAssembly decoder used for .mod / tracker
# playback (shells/web/src/lib/mod-render.ts) and for baking module music into video
# exports. Emits a single self-contained ES module:
#
#     shells/web/src/vendor/libopenmpt/libopenmpt.mjs   (~1.5 MB, wasm embedded base64)
#
# LICENSE - this build is intentionally 100% permissive, no copyleft:
#   * libopenmpt itself is BSD-3-Clause.
#   * It is built with its DEFAULT internal codecs - minimp3 (CC0), stb_vorbis (PD/MIT),
#     miniz (MIT). The LGPL libmpg123 / libvorbis path is OPT-IN only, behind ALLOW_LGPL=1
#     in libopenmpt's Makefile. We NEVER pass ALLOW_LGPL=1, so libmpg123 is never linked.
#   * The Emscripten runtime glue is MIT.
# Do not add ALLOW_LGPL=1 or --use-port=mpg123/vorbis without a licensing review.
#
# Requirements: git, python3, make, curl, ~2 GB disk. Installs its own pinned emsdk into
# a scratch dir; nothing is installed system-wide. Safe to re-run.
#
# Usage:  scripts/build-libopenmpt-wasm.sh [workdir]
set -euo pipefail

LIBOPENMPT_VERSION="0.8.7"           # pinned; see https://lib.openmpt.org/files/libopenmpt/src/
EMSDK_VERSION="6.0.2"
EMSDK_COMMIT="ca38f487f28b7c3c16f8f70cd0e012099ac4b7e2"
SOURCE_SHA256="8a6c0a70b034740f6cdd7b53de65181c3bca82183d084a53ed7fd678ba1a38ab"
SR_NOTE="decode samplerate is chosen at runtime by the worker, not baked in"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="${REPO_ROOT}/shells/web/src/vendor/libopenmpt"
WORKDIR="${1:-${TMPDIR:-/tmp}/lolly-libopenmpt-build}"
SRC_TARBALL="libopenmpt-${LIBOPENMPT_VERSION}+release.makefile.tar.gz"
SRC_URL="https://lib.openmpt.org/files/libopenmpt/src/${SRC_TARBALL}"

# The C API we drive from the worker (mod-worker.ts). Keep in sync with that file.
EXPORTS="_openmpt_module_create_from_memory2,_openmpt_module_read_float_stereo,_openmpt_module_get_duration_seconds,_openmpt_module_set_repeat_count,_openmpt_module_destroy,_malloc,_free"
RUNTIME_METHODS="cwrap,HEAPU8,HEAPF32"

echo "==> workdir: ${WORKDIR}"
mkdir -p "${WORKDIR}"
cd "${WORKDIR}"

# 1. Emscripten SDK (self-contained, pinned) ---------------------------------------
if [ ! -d emsdk ]; then
  git clone --no-checkout https://github.com/emscripten-core/emsdk.git
  git -C emsdk checkout --detach "${EMSDK_COMMIT}"
fi
if [ "$(git -C emsdk rev-parse HEAD)" != "${EMSDK_COMMIT}" ] || ! git -C emsdk diff --quiet; then
  echo "The cached SDK differs from the reviewed source. Use a fresh build directory." >&2
  exit 1
fi
( cd emsdk && ./emsdk install "${EMSCRIPTEN_VERSION:-${EMSDK_VERSION}}" && ./emsdk activate "${EMSCRIPTEN_VERSION:-${EMSDK_VERSION}}" )
# shellcheck disable=SC1091
source emsdk/emsdk_env.sh
echo "==> $(emcc --version | head -1)"

# 2. libopenmpt source (pinned makefile-flavour release tarball) --------------------
curl -fSL -o "${SRC_TARBALL}" "${SRC_URL}"
python3 - "${SRC_TARBALL}" "${SOURCE_SHA256}" <<'PY'
import hashlib, pathlib, sys
if hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest() != sys.argv[2]:
    raise SystemExit('The source archive differs from the reviewed bytes.')
PY
LIBOPENMPT_SOURCE_DIR="$(mktemp -d "${WORKDIR}/libopenmpt-src.XXXXXX")"
trap 'rm -rf "${LIBOPENMPT_SOURCE_DIR}"' EXIT
tar xf "${SRC_TARBALL}" -C "${LIBOPENMPT_SOURCE_DIR}"
cd "${LIBOPENMPT_SOURCE_DIR}/libopenmpt-${LIBOPENMPT_VERSION}+release"

# 3. Static library - DEFAULT codecs (permissive). No ALLOW_LGPL, no ports. ---------
#    Skip examples / openmpt123 / test / shared-lib to keep the build lean.
make CONFIG=emscripten EMSCRIPTEN_TARGET=wasm \
     STATIC_LIB=1 SHARED_LIB=0 EXAMPLES=0 OPENMPT123=0 TEST=0 \
     -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)"

# 4. Link into a self-contained ES module (wasm embedded via SINGLE_FILE) -----------
#    MODULARIZE + EXPORT_ES6  → import a createLibopenmpt() factory from a module worker.
#    ENVIRONMENT=web,worker + FILESYSTEM=0 → no node `fs` code to trip up the bundler.
#    DISABLE_EXCEPTION_CATCHING=0 → libopenmpt uses C++ exceptions internally.
#    Fixed INITIAL_MEMORY + ALLOW_MEMORY_GROWTH=0 is DELIBERATE and load-bearing:
#    a growable heap is a *resizable* ArrayBuffer, and Chrome refuses
#    crypto.getRandomValues() on a view into one - which libopenmpt hits while
#    seeding a module, throwing "ArrayBufferView value must not be resizable" at
#    decode time. A fixed 256 MB heap sidesteps it (>8× our 30 MB upload cap).
#    Do not re-enable ALLOW_MEMORY_GROWTH. ${SR_NOTE}.
mkdir -p "${VENDOR_DIR}"
emcc bin/libopenmpt.a -Oz -flto \
  -sWASM=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createLibopenmpt \
  -sENVIRONMENT=web,worker -sINITIAL_MEMORY=268435456 -sALLOW_MEMORY_GROWTH=0 \
  -sSINGLE_FILE=1 -sDISABLE_EXCEPTION_CATCHING=0 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS="${EXPORTS}" \
  -sEXPORTED_RUNTIME_METHODS="${RUNTIME_METHODS}" \
  -o "${VENDOR_DIR}/libopenmpt.mjs"

# 5. Vendor the licences alongside the artifact ------------------------------------
cp LICENSE "${VENDOR_DIR}/LICENSE.libopenmpt.txt"
cp include/minimp3/LICENSE "${VENDOR_DIR}/LICENSE.minimp3.txt"

echo "==> done: ${VENDOR_DIR}/libopenmpt.mjs ($(du -h "${VENDOR_DIR}/libopenmpt.mjs" | cut -f1))"
echo "==> libopenmpt ${LIBOPENMPT_VERSION}, emscripten $(emcc --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
