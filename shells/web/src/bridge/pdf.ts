// SPDX-License-Identifier: MPL-2.0
/**
 * PDF capability (host.pdf) - metadata inspection + removal + compression,
 * backed by pdf-lib.
 *
 * The implementation MOVED to packages/node-shell/src/pdf.ts (plans/202 WP1.1).
 * Nothing in it needs a browser: analyze and strip are pure pdf-lib, and the
 * compress pass feature-detects a canvas and falls back to the structural
 * re-save when there is none. `shells/cli` has imported this factory since it
 * gained host.pdf, so the implementation belongs in the package both shells can
 * import - a shell must not reach across a submodule boundary to typecheck,
 * the rule pdf-redact-core.ts and pptx.ts already follow.
 *
 * This file stays as a stable re-export, so pdf-redact.ts, raster.ts, the
 * bridge index and tests/{compress-pdf,file-input,redact}.test.ts keep working
 * unchanged.
 */

export {
  PDF_LOAD_OPTS,
  analyzePdf, stripPdf, compressPdf, organizePdf, stampPdf, lockPdf, parsePdfPageExpression,
  hasImageCodec, makeCanvas, canvasToJpeg,
  createPdfAPI,
} from '../../../../packages/node-shell/src/pdf.ts';

export type { Canvas2D } from '../../../../packages/node-shell/src/pdf.ts';
