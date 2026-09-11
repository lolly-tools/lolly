// SPDX-License-Identifier: MPL-2.0
// Build-time stub for html2canvas (199 KB / 46 KB gz + its dompurify copy).
// jspdf lazy-imports html2canvas ONLY inside its `.html()` / `addHTML()` method,
// which lolly never calls (grep bridge/export.ts → 0 hits). Aliasing the package
// to this empty module (see vite.config.js resolve.alias) keeps it out of the
// bundle entirely. If jspdf's `.html()` were ever wired up, this default no-op
// would need replacing with the real dependency.
export default function html2canvasStub() {
  throw new Error('html2canvas is stubbed out in this build (jspdf .html() is unused)');
}
