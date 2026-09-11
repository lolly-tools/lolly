// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX capability (host.pptx) - on-device deck inspect + surgical rebrand.
 *
 * The implementation MOVED to packages/node-shell/src/pptx.ts: it is DOM-free by
 * construction (engine primitives + fflate, with the XML parser injected - the
 * native DOMParser here, a jsdom one in the terminal shells), and the CLI builds
 * host.pptx from it too. The CLI used to reach across a submodule boundary into
 * this directory, so it could not typecheck without shells/web checked out. This
 * file stays as a stable re-export so every web import site keeps working
 * unchanged; the engine + fflate imports over there are still lazy, so nothing
 * new lands on the web shell's boot path.
 */

export {
  PPTX_MIME, looksLikePptxFile, inflatePptx, createPptxAPI,
} from '../../../../packages/node-shell/src/pptx.ts';
