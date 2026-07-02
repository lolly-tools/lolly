/**
 * Pose Geeko — static articulation hook.
 *
 * There is NO animation. Every moving part of the Geeko (pupil, eyelid, head,
 * legs, tail) is posed by a single baked SVG ATTRIBUTE computed here:
 *   • pupil  → transform="translate(dx dy)"      (eye look)
 *   • eyelid → stroke-width="w"                   (blink; 0 = open)
 *   • head / legs / tail / body → transform="rotate(deg cx cy)"
 *
 * Baking as attributes (never CSS) is deliberate: the same value renders
 * identically down every export path — verbatim in SVG, read by the PDF DOM
 * walker, and rasterised for CMYK-TIFF / JPG. The rotate pivots below are the
 * artwork's own user-space joints, measured with getBBox on each pose.
 *
 * Each pose is a different illustration with its own coordinate system, so the
 * config is keyed by pose value. Sliders that don't apply to a pose are hidden
 * by `showIf` in the manifest and simply produce empty attributes here.
 */

// ── per-pose articulation config ────────────────────────────────────────────
// pupil.max{X,Y}: pupil travel in user units at slider ±100 (kept inside the eye)
// pupil.flipX:    pose art is internally mirrored (scale(-1)) — flip look direction
// eyelidMax:      stroke-width that fully shuts the eye at blink 100
// *.pivot:        rotate centre in the group's own user space (from getBBox)
// *.mirror:       group sits under a scale(-1); negate so +slider reads the same way
var POSES = {
  curious: {                                    // gc-* — climbing; eye + blink + lean
    pupil: { maxX: 16, maxY: 13, flipX: false },
    eyelidMax: 40,
    body:  { pivot: [1077, 602], factor: 0.35 },  // head slider gently leans the body
  },
  dangling: {                                   // dg-* — full body: eye, blink, head, 2 legs
    pupil: { maxX: 52, maxY: 46, flipX: true },
    eyelidMax: 150,
    head:     { pivot: [1033, 1955], mirror: true },
    legBack:  { pivot: [1210, 1517], mirror: true },
    legFront: { pivot: [1226, 1722], mirror: true },
  },
  sitting: {                                    // gp-* — tail + head + eye
    pupil: { maxX: 9, maxY: 7, flipX: false },
    eyelidMax: 26,
    head: { pivot: [227, 198] },
    tail: { pivot: [300, 235] },
  },
  laying: {                                     // gl-* — head + eye
    pupil: { maxX: 16, maxY: 13, flipX: false },
    eyelidMax: 42,
    head: { pivot: [671, 313] },
  },
};

// Scene backgrounds (mirror the CSS themes) — remembered for beforeExport.
var THEME_BG = { dark: '#0c322c', light: '#f0f7f4', pine: '#165c3c' };
var _bg = THEME_BG.dark;

function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function round(x) { return Math.round(x * 100) / 100; }
function rot(deg, piv) { return deg ? 'rotate(' + round(deg) + ' ' + piv[0] + ' ' + piv[1] + ')' : ''; }

function compute(model) {
  var v = inputsFrom(model);
  var pose = v.pose || 'curious';
  var cfg = POSES[pose] || POSES.curious;
  _bg = THEME_BG[v.bg] || THEME_BG.dark;

  var out = { pupilT: '', eyelidW: 0, headT: '', bodyT: '', legFrontT: '', legBackT: '', tailT: '' };

  // Eyes — pupil translate (slider ±100 → ±max user units, kept inside the eye)
  var p = cfg.pupil;
  var dx = (clamp(num(v.eyeX, 0), -100, 100) / 100) * p.maxX * (p.flipX ? -1 : 1);
  var dy = (clamp(num(v.eyeY, 0), -100, 100) / 100) * p.maxY;
  if (dx || dy) out.pupilT = 'translate(' + round(dx) + ' ' + round(dy) + ')';

  // Blink — eyelid stroke-width (0 open → eyelidMax shut)
  out.eyelidW = round((clamp(num(v.blink, 0), 0, 100) / 100) * cfg.eyelidMax);

  // Head tilt (curious has no head group → leans the whole body instead)
  var ht = clamp(num(v.headTilt, 0), -30, 30);
  if (cfg.head) out.headT = rot(ht * (cfg.head.mirror ? -1 : 1), cfg.head.pivot);
  if (cfg.body) out.bodyT = rot(ht * (cfg.body.factor || 1), cfg.body.pivot);

  // Legs (dangling only — hidden elsewhere by showIf)
  if (cfg.legFront) out.legFrontT = rot(clamp(num(v.legFront, 0), -45, 45) * (cfg.legFront.mirror ? -1 : 1), cfg.legFront.pivot);
  if (cfg.legBack)  out.legBackT  = rot(clamp(num(v.legBack, 0), -45, 45) * (cfg.legBack.mirror ? -1 : 1), cfg.legBack.pivot);

  // Tail (sitting only)
  if (cfg.tail) out.tailT = rot(clamp(num(v.tail, 0), -40, 40), cfg.tail.pivot);

  return out;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

function beforeExport(ctx) {
  // JPG & CMYK-TIFF have no alpha: fill any letterboxing with the scene colour so
  // there are no transparent/black margins. SVG & PDF carry the scene's own rect.
  if (ctx.format === 'jpg' || ctx.format === 'jpeg' || ctx.format === 'cmyk-tiff') {
    ctx.opts.background = _bg;
  }
}
