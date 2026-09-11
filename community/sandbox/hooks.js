/* global host */
/**
 * Run Web Code hooks.
 *
 * ONE job: before the shell captures the export, re-render the live preview at the
 * CHOSEN export dimensions - so a viewport-driven pen (a WebGL canvas sized to
 * window.innerWidth, a 100vh layout, …) exports at the export size rather than the
 * small on-screen preview size. Nobody on a small screen should be capped to a small
 * export of their running code.
 *
 * The runtime AWAITS beforeExport before it rasterises, which is the seam we need.
 * The actual work lives in the template's IIFE (it owns the preview iframe + the
 * export-mirror snapshot); this hook runs in the same realm, finds the tool root, and
 * drives the bridges it exposes: `__rwcFlush` lands any pending pane commits so the
 * synced model matches exactly what we export (keeping a collaborator's model in step
 * with the exported snapshot), then `__rwcExportRender` re-renders the mirror at the
 * chosen size. Gallery THUMBNAILS (opts.thumbnail) skip only the resize - a small tile
 * doesn't need it, and skipping it keeps saving flicker-free.
 */
async function beforeExport(ctx) {
  try {
    var opts = (ctx && ctx.opts) || {};
    if (typeof document === 'undefined') return; // non-DOM shell (CLI) - nothing to re-render
    var root = document.querySelector('[data-rwc]');
    if (!root) return;
    if (typeof root.__rwcFlush === 'function') { try { root.__rwcFlush(); } catch (_) { /* ignore */ } }
    if (opts.thumbnail) return;                 // gallery tile - leave the preview-size snapshot
    if (typeof root.__rwcExportRender !== 'function') return;
    var w = parseFloat(opts.width), h = parseFloat(opts.height);
    await root.__rwcExportRender(w > 0 ? w : 0, h > 0 ? h : 0);
  } catch (e) {
    // Never block the export: on any failure fall back to the last preview-size snapshot.
  }
}
