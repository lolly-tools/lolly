// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free core of PDF redaction (host.pdf.redact) - everything that can be
 * asserted in node. pdf-redact.ts owns the canvas work (render page SVG, burn
 * bars, encode JPEG) and calls in here for the maths and for the rebuild.
 *
 * The implementation MOVED to packages/node-shell/src/pdf-redact-core.ts: the
 * terminal shells grew their own canvas half (resvg + @napi-rs/canvas), and the
 * two halves must burn bars at exactly the same pixels, so the maths and the
 * pdf-lib rebuild belong in the package both can import. A shell must not reach
 * across a submodule boundary to typecheck - the same rule pptx.ts follows.
 *
 * This file stays as a stable re-export so every web import site (and
 * tests/redact.test.ts) keeps working unchanged.
 */

export {
  REDACT_DPI_DEFAULT, REDACT_DPI_MIN, REDACT_DPI_MAX, BAR_INFLATE_PX,
  PAGES_MAX_DEFAULT, REDACT_INK_FALLBACK,
  clampDpi, clampMaxPages, collectPages,
  barToPixels, normaliseInk, inflateForRadius, stampLayout,
  grayscaleInPlace, buildImagePdf,
} from '../../../../packages/node-shell/src/pdf-redact-core.ts';

export type { PixelRect, RoundedPixelRect, RedactedPageImage } from '../../../../packages/node-shell/src/pdf-redact-core.ts';
