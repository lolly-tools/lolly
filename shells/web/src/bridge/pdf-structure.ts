// SPDX-License-Identifier: MPL-2.0
/**
 * PDF structural inspection - what a document CARRIES and what it DOES, as
 * opposed to what it says about itself (attachments, scripts, outward actions,
 * filled form values, annotations, hidden layers).
 *
 * The implementation MOVED to packages/node-shell/src/pdf-structure.ts (plans/202
 * WP1.1). It is pure pdf-lib object-graph work with no DOM in it, and ./pdf.ts -
 * which the terminal shells run - reaches it by a lazy sibling import, so it
 * had to follow pdf.ts into the package both sides can import.
 *
 * This file stays as a stable re-export, so views/valid.ts, views/pdf-import.ts
 * and pdf-redact-core.test.ts keep working unchanged.
 */

export { scanPdfStructure } from '../../../../packages/node-shell/src/pdf-structure.ts';
