/* global onInit, onInput */

// screencap - pure data in, patch out. No engine import, no DOM, no network.
//
// The captured shot is stored intact and NEVER resampled. `crop` is four numbers
// (percent of the shot). The template renders the shot inside an overflow:hidden
// window using PERCENTAGE CSS offsets, so the crop is a clip, not a scale - the
// shell control pushes the crop's native pixel size to the export bar and the
// export draw stays an identity blit. See the window-math note below for why the
// geometry is percentages, not absolute px.

function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }

function geom(inputs) {
  var c = inputs.crop || {};
  var w = Math.min(100, Math.max(0.01, num(c.w, 100)));
  var h = Math.min(100, Math.max(0.01, num(c.h, 100)));
  // Clamp defensively: a stale crop left over from a larger previous shot must
  // never produce an out-of-bounds window (the shell control also resets crop on
  // a new shot - this is the second line of defence).
  var x = Math.min(100 - w, Math.max(0, num(c.x, 0)));
  var y = Math.min(100 - h, Math.max(0, num(c.y, 0)));

  var shot = inputs.shot || null;
  var nw = num(shot && shot.width, 0);
  var nh = num(shot && shot.height, 0);
  var sized = nw > 0 && nh > 0;

  return {
    hasShot: !!(shot && shot.url),
    sized: sized,
    // Window math. The window is 100%x100% of the canvas and represents the crop
    // region. The image is scaled so (w% of the shot) fills the window:
    //   imgW% = 100 / (w/100) = 10000/w      imgLeft% = -(x/w) * 100
    // Percentages are previewScale-invariant: refreshCanvasPreview sizes the canvas
    // to round(barPx * previewScale), so an ABSOLUTE-px image would be CUT whenever
    // previewScale < 1. A percentage rides previewScale down and rasterStyle's
    // renderScale (= 1/previewScale) puts it back exactly.
    imgW:    sized ? 10000 / w : 100,
    imgH:    sized ? 10000 / h : 100,
    imgLeft: sized ? -100 * x / w : 0,
    imgTop:  sized ? -100 * y / h : 0,
    // A dimensionless shot can't be cropped honestly - show it whole, uncropped.
    imgFit:  sized ? 'fill' : 'contain',
    cropPxW: sized ? Math.max(1, Math.round(w / 100 * nw)) : 0,
    cropPxH: sized ? Math.max(1, Math.round(h / 100 * nh)) : 0,
    natW: nw, natH: nh
  };
}

// The runtime calls hooks with a context ({ model, host }), not a flat inputs map -
// flatten the model to { id: value } the way the filter-* tools do.
function inputsOf(ctx) {
  var model = (ctx && ctx.model) || [];
  return Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
}

function onInit(ctx) { return geom(inputsOf(ctx)); }
function onInput(ctx) { return geom(inputsOf(ctx)); }
