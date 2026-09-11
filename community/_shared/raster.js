/**
 * Shared hook helpers - raster capability probe + image decoding.
 *
 * CANONICAL SOURCE for the `canRaster` and `loadImage` regions below. Tool
 * hooks.js ship as self-contained data (no imports), so each consumer carries
 * a byte-for-byte copy of each region between `lolly:shared` marker comments.
 * Edit the regions HERE, then run `npm run sync:shared` to rewrite every
 * consumer; `npm run validate:catalog` fails if any consumer drifts.
 *
 * Both regions delegate to the `host.raster` bridge API (engine v1.105,
 * plans/86-worker-isolation-hooks.md section 6.1) instead of probing the DOM directly.
 * `host` is in lexical scope in every hooks.js (the whole file is one
 * `new Function('host', ...)` body), so these keep their signatures - 0-arg
 * `canRaster()`, 1-URL-arg `loadImage(url)` - and NO consumer call site changes.
 * Asking the host rather than the realm is what keeps them correct once hooks
 * move into a Worker, where `document`/`Image` are absent even though rastering
 * (OffscreenCanvas) works. A shell without `host.raster` (the headless CLI) makes
 * canRaster() false and loadImage() reject - the same degraded path the old
 * `typeof document === 'undefined'` guard produced.
 */

// === lolly:shared canRaster - canonical source; edit here and run npm run sync:shared ===
function canRaster() {
  return !!(host.raster && host.raster.canRaster());
}
// === /lolly:shared canRaster ===

// === lolly:shared loadImage - canonical source; edit here and run npm run sync:shared ===
function loadImage(url) {
  if (!host.raster) return Promise.reject(new Error('no raster'));
  return host.raster.decode(url);
}
// === /lolly:shared loadImage ===

// === lolly:shared rasterCanvas - canonical source; edit here and run npm run sync:shared ===
// A realm-appropriate 2D drawing surface for an onFrame kernel: a document
// <canvas> on the main thread (keeps the existing toDataURL fast path
// byte-identical), an OffscreenCanvas inside a Worker (no document there, but
// OffscreenCanvas works). getContext('2d')/getImageData/putImageData/drawImage
// are identical on both, so a kernel that draws through this is realm-agnostic.
function rasterCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}
// === /lolly:shared rasterCanvas ===

// === lolly:shared canvasToUrl - canonical source; edit here and run npm run sync:shared ===
// Encode a rasterCanvas() surface to a `data:` URL. Always returns a Promise so
// callers `await` it uniformly. Main thread: canvas.toDataURL is synchronous
// (unchanged shipping behaviour), wrapped resolved. Worker: OffscreenCanvas has
// no toDataURL, so convertToBlob → bytes → base64 (btoa exists in a Worker;
// FileReader.readAsDataURL is not relied on). Chunked fromCharCode avoids the
// call-stack overflow a whole-array apply() hits on a large JPEG.
function canvasToUrl(canvas, type, quality) {
  if (typeof canvas.toDataURL === 'function') {
    return Promise.resolve(canvas.toDataURL(type, quality));
  }
  return canvas.convertToBlob({ type: type, quality: quality })
    .then(function (blob) { return blob.arrayBuffer(); })
    .then(function (buf) {
      var bytes = new Uint8Array(buf), bin = '', CH = 0x8000;
      for (var i = 0; i < bytes.length; i += CH) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      }
      return 'data:' + (type || 'image/jpeg') + ';base64,' + btoa(bin);
    });
}
// === /lolly:shared canvasToUrl ===
