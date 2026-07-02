/**
 * Animated Ad (digi-ad) — hooks.
 *
 * Each scene (a Lolly "blocks" item) is one absolutely-positioned, full-frame
 * layer. The scenes share ONE timeline: a later scene animates IN over the one
 * before it (a cover transition — no blank gaps), and the last scene rests as the
 * end card. The hook generates the per-scene @keyframes + the animation bindings
 * as a <style> string ({{{animCss}}}) that lives INSIDE the template (so the
 * self-contained HTML export captures it and the exported banner animates).
 *
 * Why it's built this way (verified against the engine + export bridge):
 *  - All CSS must live in the template's own <style> / this animCss, never
 *    styles.css: scopeCss() corrupts multi-step @keyframes, and the HTML export
 *    only captures <style> elements inside the canvas node.
 *  - blocks sub-fields can't be booleans, and there's no radio-across-blocks, so
 *    "pause here" is a single top-level `focusScene` number instead.
 *  - Pause/edit is a class-gated FREEZE (.dg-frozen) baked declaratively via
 *    {{rootClass}} (survives the per-keystroke innerHTML rebuild). beforeExport
 *    toggles it: play (restart at t=0) for gif/webm/mp4/html, freeze the poster
 *    for png/svg/pdf.
 *  - Assets are inlined as data URLs so logos/images survive the HTML export
 *    (blob: URLs are session-scoped and would break in a standalone file).
 *
 * No client-side JS ships in the canvas — the animation is pure CSS, so it is
 * identical across the live preview, frame-by-frame video/gif capture, and the
 * script-stripped static-HTML export.
 */

var TRANS = 0.6;        // scene entrance length (seconds, at speed 1)
var MAX_SCENES = 12;    // soft cap — each scene is a layer + a keyframe block
var GIF_CAP = 16;       // seconds; renderGif/renderApng have no frame ceiling, so bound it
var VIDEO_CAP = 24;     // seconds; renderVideo caps at 600 frames (~25s @24fps)

// Resolved-asset → data-URL cache (so a slider drag doesn't re-fetch/encode).
var _dataUrlCache = {};
// Resolved logo AssetRefs, by asset id.
var _logoRefs = {};
// Shared with beforeExport (which only receives format/opts/node).
var _totalDuration = 6;
var _savedClass = null;
var _reducedCss = ''; // reduced-motion fallback, injected into the HTML export only
var _animated = true; // last-known "Animate" state, for beforeExport
var _loop = 'loop';   // last-known loop mode, for the GIF loop-count

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

// WCAG-ish luminance of a #hex, to pick a contrasting ink + logo polarity.
function relLum(hex) {
  var s = str(hex).replace('#', '');
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : (s + '000000').slice(0, 6);
  function lin(i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
function isDark(hex) { return relLum(hex) < 0.5; }
function idealInk(hex) { return isDark(hex) ? '#ffffff' : '#0c322c'; }

// Fetch an asset URL and inline it as a data URL (cached). Returns '' on failure
// (headless shells, cross-origin) so the slot is simply omitted.
async function inlineAsset(url) {
  if (!url) return '';
  if (_dataUrlCache[url]) return _dataUrlCache[url];
  if (typeof fetch === 'undefined' || typeof FileReader === 'undefined') return '';
  try {
    var resp = await fetch(url);
    var blob = await resp.blob();
    var data = await new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error('read failed')); };
      fr.readAsDataURL(blob);
    });
    _dataUrlCache[url] = data;
    return data;
  } catch (e) {
    if (host.log) host.log('warn', 'digi-ad: could not inline asset', { error: String(e) });
    return '';
  }
}

// The SUSE mark for a scene: orientation × tone, polarity flipped for the bg.
function logoIdFor(scene, bg) {
  var orient = scene.logo === 'stacked' ? 'vert' : 'hor';
  var polarity = isDark(bg) ? 'neg' : 'pos';
  if (scene.logoColor === 'green') return 'suse/logo/' + orient + '-' + polarity + '-green';
  return 'suse/logo/' + orient + '-' + polarity + '-' + (isDark(bg) ? 'white' : 'black');
}
async function resolveLogo(scene, bg) {
  var id = logoIdFor(scene, bg);
  try {
    if (!_logoRefs[id]) _logoRefs[id] = await host.assets.get(id);
    return await inlineAsset(_logoRefs[id] && _logoRefs[id].url);
  } catch (e) {
    if (host.log) host.log('warn', 'digi-ad: logo unavailable', { id: id });
    return '';
  }
}

var FOCUS_POS = { center: 'center', top: 'center top', bottom: 'center bottom', left: 'left center', right: 'right center' };

// Entrance transform + easing per resolved transition type.
function entrance(kind) {
  switch (kind) {
    case 'slide': return { from: 'translateY(7%)', ease: 'ease-out' };
    case 'zoom':  return { from: 'scale(1.06)',    ease: 'ease-out' };
    case 'pop':   return { from: 'scale(0.84)',    ease: 'cubic-bezier(.34,1.56,.64,1)' };
    case 'none':  return { from: 'none',           ease: 'steps(1,start)' };
    default:      return { from: 'none',           ease: 'ease-out' }; // fade
  }
}

// ── the work ─────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = toInputs(model);
  var animated = inputs.animated !== false;
  var motion = str(inputs.motion) || 'fade';
  var speed = clamp(num(inputs.speed, 1), 0.5, 2);
  var loop = str(inputs.loop) || 'loop';
  var focusScene = Math.round(num(inputs.focusScene, 0));
  _animated = animated;
  _loop = loop;

  var all = Array.isArray(inputs.scenes) ? inputs.scenes : [];
  var scenes = all.slice(0, MAX_SCENES);
  if (all.length > MAX_SCENES && host.log) {
    host.log('warn', 'digi-ad: scene count capped', { max: MAX_SCENES, requested: all.length });
  }
  var n = scenes.length;
  if (!n) {
    _totalDuration = 1;
    return { scenesOut: [], animCss: '', rootClass: 'digiad', durSec: 1, sceneCount: 0 };
  }

  // Timeline: scene i enters at startS[i] over inS[i], then holds. Cover model —
  // it stays visible (covered by later scenes) so there are no blank gaps.
  var inS = [], holdS = [], startS = [], acc = 0;
  for (var i = 0; i < n; i++) {
    inS[i] = (i === 0) ? 0 : TRANS;
    holdS[i] = clamp(num(scenes[i].hold, 1.6), 0.3, 6);
    startS[i] = acc;
    acc += inS[i] + holdS[i];
  }
  var R = acc || 1;                 // raw total (speed 1)
  var T = f4(R / speed);            // wall-clock seconds
  _totalDuration = T;

  var lastIdx = n - 1;
  var focusIdx = (focusScene > 0) ? clamp(focusScene - 1, 0, lastIdx) : lastIdx;
  var frozen = !animated || (focusScene > 0);
  var iter = loop === 'once' ? '1' : (loop === 'play3' ? '3' : 'infinite');

  // Build per-scene render data + the keyframe/animation CSS together.
  var scenesOut = [];
  var keyframes = [];
  var bindings = ['.digiad .dg-scene--0{opacity:1}']; // scene 0 is the static base layer

  for (var k = 0; k < n; k++) {
    var sc = scenes[k] || {};
    var bg = colour(sc.bgColor, '#0c322c');
    var fg = colour(sc.fgColor, idealInk(bg));

    var imgUrl = '';
    if (sc.image && typeof sc.image === 'object' && sc.image.url) {
      imgUrl = await inlineAsset(sc.image.url);
    }
    var logoUrl = '';
    if (sc.kind === 'logo' || sc.kind === 'end') {
      logoUrl = await resolveLogo(sc, bg);
    }

    var headline = (sc.kind === 'title' || sc.kind === 'end') ? str(sc.headline) : '';
    var subheadline = (sc.kind === 'title') ? str(sc.subheadline) : '';
    var body = (sc.kind === 'text') ? str(sc.body) : '';
    var cta = (sc.kind === 'cta' || sc.kind === 'end') ? str(sc.cta) : '';
    var ctaStyle = str(sc.ctaStyle) || 'pill';
    var hasText = !!(headline || subheadline || body || cta);

    var styleParts = ['--bg:' + bg, '--fg:' + fg, 'background-color:' + bg, 'color:' + fg];
    if (imgUrl) {
      styleParts.push('background-image:url(' + imgUrl + ')');
      styleParts.push('background-position:' + (FOCUS_POS[sc.imageFocus] || 'center'));
    }
    // Text over a photo needs a contrast scrim, toned to the chosen ink polarity.
    var scrim = (imgUrl && hasText) ? (isDark(fg) ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)') : '';
    if (scrim) styleParts.push('--scrim:' + scrim);

    scenesOut.push({
      idx: k,
      kind: str(sc.kind) || 'title',
      style: styleParts.join(';'),
      scrim: !!scrim,
      headline: headline,
      subheadline: subheadline,
      body: body,
      cta: cta,
      ctaStyle: ctaStyle,
      logoUrl: logoUrl,
      hasInner: !!(headline || subheadline || body || cta || logoUrl),
    });

    // Scene 0 is static (always-on base); scenes 1+ animate in.
    if (k === 0) continue;
    var trans = str(sc.transition);
    if (!trans || trans === 'inherit') trans = motion;
    var e = entrance(trans);
    var pStart = f4(startS[k] / R * 100);
    var pIn = f4((startS[k] + inS[k]) / R * 100);
    keyframes.push(
      '@keyframes dgK' + k + '{' +
        '0%{opacity:0;transform:' + e.from + '}' +
        pStart + '%{opacity:0;transform:' + e.from + ';animation-timing-function:' + e.ease + '}' +
        pIn + '%{opacity:1;transform:none}' +
        '100%{opacity:1;transform:none}}'
    );
    bindings.push('.digiad .dg-scene--' + k + '{animation:dgK' + k + ' ' + T + 's ' + iter + ' both linear}');
  }

  // Freeze (edit a scene / hold the still) — overrides the animation entirely.
  var freeze =
    '.digiad.dg-frozen .dg-scene{animation:none!important;opacity:0!important;transform:none!important}' +
    '.digiad.dg-frozen .dg-scene--' + focusIdx + '{opacity:1!important}';

  // Exported ads are shown to people who didn't choose motion — make the
  // self-contained HTML reduced-motion-safe (rests on the end card). This is kept
  // OUT of the live DOM (injected into the HTML export only by beforeExport) so the
  // preview and the gif/video capture always animate regardless of the author's own
  // motion preference — matching the platform's canvas exemption from the global reset.
  _reducedCss =
    '@media (prefers-reduced-motion:reduce){' +
      '.digiad .dg-scene{animation:none!important;opacity:0!important;transform:none!important}' +
      '.digiad .dg-scene--' + lastIdx + '{opacity:1!important}}';

  var animCss = keyframes.join('') + bindings.join('') + freeze;

  return {
    scenesOut: scenesOut,
    animCss: animCss,
    rootClass: frozen ? 'digiad dg-frozen' : 'digiad',
    durSec: T,
    sceneCount: n,
  };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// gif/apng/webm/mp4/html must PLAY; png/svg/pdf freeze on the poster scene.
var ANIMATED_FORMATS = { gif: 1, apng: 1, webm: 1, mp4: 1, html: 1 };

async function beforeExport(ctx) {
  var root = ctx.node && ctx.node.querySelector && ctx.node.querySelector('.digiad');
  if (!root) return;
  _savedClass = root.className;
  var fmt = ctx.format;
  // Play only for animated formats AND when "Animate" is on — otherwise every
  // format (incl. gif/webm/mp4/html) exports the held still, honouring the toggle.
  var play = !!ANIMATED_FORMATS[fmt] && _animated;

  if (play) {
    // Deterministic restart at t=0: freeze (animation:none) → reflow → unfreeze →
    // reflow re-arms the named animations from the start so the clip opens cleanly.
    root.classList.add('dg-frozen'); void root.offsetWidth;
    root.classList.remove('dg-frozen'); void root.offsetWidth;
    ctx.opts.wait = 0;
    // The timeline IS the clip length — but keep frames under the bridge's 600-frame
    // ceiling, which is fps-aware (the export bar's 60fps option flows in via opts.fps).
    var fps = (ctx.opts.fps > 0) ? ctx.opts.fps : 24;
    var cap = (fmt === 'gif' || fmt === 'apng') ? GIF_CAP : Math.min(VIDEO_CAP, Math.floor(595 / fps));
    ctx.opts.duration = Math.min(_totalDuration, cap);
    // Loop count (gifenc repeat semantics: -1 once, 0 forever, N times; the APNG
    // path maps the same values onto acTL num_plays) so "Play once / 3 times" is
    // honoured in the exported clip, not just the HTML.
    if (fmt === 'gif' || fmt === 'apng') ctx.opts.repeat = _loop === 'loop' ? 0 : (_loop === 'once' ? -1 : 3);
  } else {
    // Static poster / "Animate" off — hold the focus (or end-card) scene.
    root.classList.add('dg-frozen');
  }

  // The standalone HTML banner is self-contained and shown to third parties, so
  // bake in BOTH the reduced-motion fallback and the brand @font-face as a data
  // URL (the live DOM / raster paths already have the font from the app + baked
  // pixels). renderStaticHtml captures every <style> inside the node; afterExport
  // removes this one again.
  if (fmt === 'html') {
    var css = _reducedCss;
    try {
      var fontUrl = await inlineAsset('/catalog/fonts/webfonts/SUSE[wght].woff2');
      if (fontUrl) {
        css += '@font-face{font-family:"SUSE";src:url(' + fontUrl +
          ') format("woff2-variations");font-weight:100 900;font-style:normal;font-display:swap}';
      }
    } catch (e) { /* font embed is best-effort; system stack is the fallback */ }
    if (css) {
      var s = document.createElement('style');
      s.setAttribute('data-dg-rm', '');
      s.textContent = css;
      root.appendChild(s);
    }
  }
}

function afterExport(ctx) {
  var root = ctx.node && ctx.node.querySelector && ctx.node.querySelector('.digiad');
  if (root) {
    var rm = root.querySelector('style[data-dg-rm]');
    if (rm) rm.remove();
    if (_savedClass != null) root.className = _savedClass;
  }
  _savedClass = null;
}
