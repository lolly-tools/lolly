/**
 * Lottie Ad (lottie-digi-ad) — hooks.
 *
 * digi-ad's scene model, with a Lottie motion asset per scene instead of a
 * static image: each scene is one absolutely-positioned, full-frame layer, the
 * scenes share ONE CSS timeline (a later scene animates IN over the one before
 * it — cover model, no blank gaps), and the last scene rests as the end card.
 * The hook generates the per-scene @keyframes + animation bindings as a <style>
 * string ({{{animCss}}}) that lives INSIDE the template.
 *
 * The Lottie animations themselves are NOT driven from here: the template
 * emits an empty <div data-lottie-src="…"> per scene and the shell mounts a
 * player on it. The CSS timeline only choreographs the scene layers.
 *
 * Why it's built this way (mirrors digi-ad, verified against the engine):
 *  - All CSS lives in the template's own <style> / this animCss, never
 *    styles.css: scopeCss() corrupts multi-step @keyframes, and frame-by-frame
 *    capture must see the full styling on the canvas node itself.
 *  - "Animate off" is a class-gated FREEZE (.lda-frozen) baked declaratively
 *    via {{rootClass}} (survives the per-keystroke innerHTML rebuild). The
 *    freeze hides the scene stacking, but mounted Lottie players keep playing
 *    inside the resting scene — a png export simply captures whatever frame
 *    they are on, which is acceptable for a still poster.
 *  - beforeExport toggles it: restart at t=0 for gif/webm/mp4/apng, freeze the
 *    poster for png. afterExport restores the pre-export class.
 */

var TRANS = 0.6;        // scene entrance length (seconds, at speed 1)
var MAX_SCENES = 12;    // soft cap — each scene is a layer + a keyframe block
var GIF_CAP = 16;       // seconds; renderGif/apng have no frame ceiling, so bound it
var VIDEO_CAP = 24;     // seconds; renderVideo caps at 600 frames (~25s @24fps)

// Shared with beforeExport (which only receives format/opts/node).
var _totalDuration = 6;
var _savedClass = null;
var _animated = true; // last-known "Animate" state, for beforeExport
var _loop = 'loop';   // last-known loop mode, for the GIF/APNG loop-count

// ── helpers ──────────────────────────────────────────────────────────────────

function toInputs(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function str(v) { return (typeof v === 'string') ? v : (v == null ? '' : String(v)); }

// Colour is the ONE user value that lands in the raw {{{style}}} attribute (and
// in the distributable HTML export), so it must be sanitised here — a crafted
// shared URL could otherwise set a "colour" that breaks out of the attribute or
// injects CSS. Only hex / rgb(a) / hsl(a) / a few keywords are let through.
var COLOUR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/;
var COLOUR_WORDS = { transparent: 1, black: 1, white: 1, currentcolor: 1 };
function colour(v, fallback) {
  var s = str(v).trim();
  if (!s) return fallback;
  return (COLOUR_RE.test(s) || COLOUR_WORDS[s.toLowerCase()]) ? s : fallback;
}
function f4(x) { return Math.round(x * 10000) / 10000; }

// WCAG-ish luminance of a #hex, to pick a contrasting ink.
function relLum(hex) {
  var s = str(hex).replace('#', '');
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  function lin(i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
function isDark(hex) { return relLum(hex) < 0.5; }
function idealInk(hex) { return isDark(hex) ? '#ffffff' : '#0c322c'; }

var ANIM_SIZES = { small: 1, medium: 1, large: 1, full: 1 };

// Entrance transform + easing per resolved transition type.
function entrance(kind) {
  switch (kind) {
    case 'slide': return { from: 'translateY(7%)', ease: 'ease-out' };
    case 'zoom':  return { from: 'scale(1.06)',    ease: 'ease-out' };
    case 'none':  return { from: 'none',           ease: 'steps(1,start)' };
    default:      return { from: 'none',           ease: 'ease-out' }; // fade
  }
}

// ── the work ─────────────────────────────────────────────────────────────────

function compute(model) {
  var inputs = toInputs(model);
  var animated = inputs.animated !== false;
  var motion = str(inputs.motion) || 'fade';
  var speed = clamp(num(inputs.speed, 1), 0.5, 2);
  var loop = str(inputs.loop) || 'loop';
  _animated = animated;
  _loop = loop;

  var all = Array.isArray(inputs.scenes) ? inputs.scenes : [];
  var scenes = all.slice(0, MAX_SCENES);
  if (all.length > MAX_SCENES && host.log) {
    host.log('warn', 'lottie-digi-ad: scene count capped', { max: MAX_SCENES, requested: all.length });
  }
  var n = scenes.length;
  if (!n) {
    _totalDuration = 1;
    return { scenesOut: [], animCss: '', rootClass: 'lda', sceneCount: 0 };
  }

  // Timeline: scene i enters at startS[i] over inS[i], then holds. Cover model —
  // it stays visible (covered by later scenes) so there are no blank gaps.
  var inS = [], holdS = [], startS = [], acc = 0;
  for (var i = 0; i < n; i++) {
    inS[i] = (i === 0) ? 0 : TRANS;
    holdS[i] = clamp(num(scenes[i].hold, 2.5), 0.5, 8);
    startS[i] = acc;
    acc += inS[i] + holdS[i];
  }
  var R = acc || 1;                 // raw total (speed 1)
  var T = f4(R / speed);            // wall-clock seconds
  _totalDuration = T;

  var lastIdx = n - 1;
  var iter = loop === 'once' ? '1' : (loop === 'play3' ? '3' : 'infinite');

  // Build per-scene render data + the keyframe/animation CSS together.
  var scenesOut = [];
  var keyframes = [];
  var bindings = ['.lda .lda-scene--0{opacity:1}']; // scene 0 is the static base layer

  for (var k = 0; k < n; k++) {
    var sc = scenes[k] || {};
    var bg = colour(sc.bgColor, '#0c322c');
    var fg = colour(sc.fgColor, idealInk(bg));

    // Blocks asset sub-fields arrive as resolved AssetRef objects; the ref's
    // url is what the shell's player mounter fetches the Lottie JSON from.
    var animUrl = (sc.anim && typeof sc.anim === 'object' && sc.anim.url) ? str(sc.anim.url) : '';
    var animSize = ANIM_SIZES[str(sc.animSize)] ? str(sc.animSize) : 'large';

    var headline = str(sc.headline);
    var caption = str(sc.caption);

    scenesOut.push({
      idx: k,
      style: ['--bg:' + bg, '--fg:' + fg, 'background-color:' + bg, 'color:' + fg].join(';'),
      animUrl: animUrl,
      hasAnim: !!animUrl,
      animSize: animSize,
      headline: headline,
      caption: caption,
      hasInner: !!(animUrl || headline || caption),
    });

    // Scene 0 is static (always-on base); scenes 1+ animate in.
    if (k === 0) continue;
    var trans = str(sc.transition);
    if (!trans || trans === 'inherit') trans = motion;
    var e = entrance(trans);
    var pStart = f4(startS[k] / R * 100);
    var pIn = f4((startS[k] + inS[k]) / R * 100);
    keyframes.push(
      '@keyframes ldaK' + k + '{' +
        '0%{opacity:0;transform:' + e.from + '}' +
        pStart + '%{opacity:0;transform:' + e.from + ';animation-timing-function:' + e.ease + '}' +
        pIn + '%{opacity:1;transform:none}' +
        '100%{opacity:1;transform:none}}'
    );
    bindings.push('.lda .lda-scene--' + k + '{animation:ldaK' + k + ' ' + T + 's ' + iter + ' both linear}');
  }

  // Freeze ("Animate" off / png poster) — rests on the end card. This only
  // stops the SCENE timeline; a mounted Lottie player inside the resting scene
  // keeps playing (see header comment).
  var freeze =
    '.lda.lda-frozen .lda-scene{animation:none!important;opacity:0!important;transform:none!important}' +
    '.lda.lda-frozen .lda-scene--' + lastIdx + '{opacity:1!important}';

  return {
    scenesOut: scenesOut,
    animCss: keyframes.join('') + bindings.join('') + freeze,
    rootClass: animated ? 'lda' : 'lda lda-frozen',
    sceneCount: n,
  };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// gif/webm/mp4/apng must PLAY; png freezes on the end card.
var ANIMATED_FORMATS = { gif: 1, webm: 1, mp4: 1, apng: 1 };

function beforeExport(ctx) {
  var root = ctx.node && ctx.node.querySelector && ctx.node.querySelector('.lda');
  if (!root) return;
  _savedClass = root.className;
  var fmt = ctx.format;
  // Play only for animated formats AND when "Animate" is on — otherwise every
  // format (incl. gif/webm/mp4/apng) exports the held still, honouring the toggle.
  var play = !!ANIMATED_FORMATS[fmt] && _animated;

  if (play) {
    // Deterministic restart at t=0: freeze (animation:none) → reflow → unfreeze →
    // reflow re-arms the named animations from the start so the clip opens cleanly.
    root.classList.add('lda-frozen'); void root.offsetWidth;
    root.classList.remove('lda-frozen'); void root.offsetWidth;
    ctx.opts.wait = 0;
    // The timeline IS the clip length — but keep frames under the bridge's 600-frame
    // ceiling, which is fps-aware (the export bar's 60fps option flows in via opts.fps).
    var fps = (ctx.opts.fps > 0) ? ctx.opts.fps : 24;
    var cap = (fmt === 'gif' || fmt === 'apng') ? GIF_CAP : Math.min(VIDEO_CAP, Math.floor(595 / fps));
    ctx.opts.duration = Math.min(_totalDuration, cap);
    // Loop count (encoder repeat: -1 once, 0 forever, N times) so "Play once /
    // 3 times" is honoured in the exported GIF/APNG, not just the live preview.
    if (fmt === 'gif' || fmt === 'apng') ctx.opts.repeat = _loop === 'loop' ? 0 : (_loop === 'once' ? -1 : 3);
  } else {
    // Static poster / "Animate" off — hold the end card.
    root.classList.add('lda-frozen');
  }
}

function afterExport(ctx) {
  var root = ctx.node && ctx.node.querySelector && ctx.node.querySelector('.lda');
  if (root && _savedClass != null) root.className = _savedClass;
  _savedClass = null;
}
