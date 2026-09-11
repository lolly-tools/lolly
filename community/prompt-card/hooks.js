// Prompt to Image - lay text out so all of it fits inside one small image.
//
// Two halves compute the layout, and they have to agree:
//
//   here      - splits the text into paragraphs and ESTIMATES a font size from
//               monospace geometry. Pure arithmetic, no DOM, so the CLI and any
//               headless shell still render something correct-ish.
//   template  - refines that estimate by binary-searching against real layout,
//               which is the only way to account for wrap raggedness.
//
// The estimate is the initial paint (and the final word where there is no layout
// engine), so keep GEO in sync with styles.css - the template reads the padding
// and line-height back off the DOM, but ADVANCE/PACK only exist here.
//
// EVERY number here is in EXPORT pixels - the page the user asked for. The stage
// previews a page larger than the tool's native 1024 shrunk-to-fit and scales it
// back up at capture, so the template converts to DOM px before it measures.

var GEO = {
  // Advance width of one monospace glyph as a fraction of font-size. SUSE Mono
  // sits at ~0.6, which is the usual figure for a mono face.
  ADVANCE: 0.6,
  // How much of the theoretical grid real text actually occupies once ragged
  // line ends and short paragraph tails are counted. Tuned by eye; the template's
  // binary search corrects it either way.
  PACK: 0.82,
  // Legibility floor. Below this a vision model stops reading reliably, so we
  // clamp rather than shrink further and report the overflow instead. An absolute
  // figure, not a proportional one - it's about the pixels that reach the model.
  MIN: 6,
  MAX: 44
};

// Fallbacks for every geometry input, used when a headless caller omits them.
// W/H must match render.width/height in tool.json; the rest must match the input
// defaults, which are what the sidebar actually shows.
var DEF = { W: 1024, H: 1024, PAD: 32, LINE: 1.35, PARA: 1 };

// Anthropic's documented approximation for how many tokens an image costs a
// Claude vision model. Other providers tile differently, so this is a guide to
// the order of magnitude, not a universal price - the readout says so.
var PX_PER_IMAGE_TOKEN = 750;
// The usual rough figure for English prose. Code and non-Latin scripts run denser.
var CHARS_PER_TEXT_TOKEN = 4;

function paragraphsOf(text) {
  var paras = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map(function (p) { return p.replace(/\s+$/, ''); })
    .filter(function (p) { return p.length > 0; });
  return paras;
}

function num(v, fallback) {
  var n = Number(v);
  return isFinite(n) ? n : fallback;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Largest font size at which `chars` glyphs still fit the inner box, from the
// monospace grid: capacity = (innerW / (ADVANCE*fs)) * (innerH / (LINE*fs)) * PACK.
// Solving for fs gives the sqrt below.
function estimateFontSize(chars, innerW, innerH, line) {
  if (chars <= 0) return GEO.MAX;
  var fs = Math.sqrt((innerW * innerH * GEO.PACK) / (GEO.ADVANCE * line * chars));
  return clamp(fs, GEO.MIN, GEO.MAX);
}

function group(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// The trade the whole tool exists to make. An image is a FLAT price - w×h÷750,
// whatever it holds - so the same page that saves a fortune on a long prompt is a
// waste on a short one. Break-even at 1024² is ~5,600 characters. The user is the
// only one who can resolve that, so state it plainly rather than pick for them.
function verdictOf(textTokens, imageTokens) {
  if (textTokens <= 0 || imageTokens <= 0) return null;
  var hi = Math.max(textTokens, imageTokens);
  var lo = Math.min(textTokens, imageTokens);
  var factor = Math.round((hi / lo) * 10) / 10;
  var delta = group(Math.abs(textTokens - imageTokens));
  // A ratio that rounds to 1.0 is a tie in all but name - claiming "wins by 1×"
  // asserts a winner and denies there is one in the same breath. Report the
  // dead-heat instead, across the whole break-even neighbourhood (~5,330–5,880
  // chars at 1024²), not just the exact-equal point.
  if (factor <= 1) return { even: true, factor: factor, delta: delta };
  return { cheaper: imageTokens < textTokens, factor: factor, delta: delta };
}

function compute(inputs) {
  var text = String(inputs.text == null ? '' : inputs.text);
  var paras = paragraphsOf(text);
  var chars = text.trim().length;

  // The export bar owns width/height (they're `group: "export"`, so they have no
  // sidebar control) and syncs them here in px on every size change - which is
  // what makes the readout below track the page as it's dragged taller.
  //
  // Use the value VERBATIM - do NOT clamp it to some inner ceiling. The token
  // readout is the whole point of the tool, and it has to describe the page that
  // is actually EXPORTED. If a hook ceiling (say 8192) were below the export bar's
  // range (1..100000), then dragging past it would leave the hook costing a
  // smaller page than the one rendered, and the verdict could flip to the wrong
  // answer in green. The only floor is sanity: a page is at least 1px. Absurd
  // sizes just yield an honest, absurd token count - which is the correct signal.
  // (The manifest deliberately leaves width/height min/max UNSET for the same
  // reason: an input clamp narrower than the export bar would reintroduce exactly
  // this divergence via updateInput's constrain().)
  var W = Math.max(1, Math.round(num(inputs.width, DEF.W)));
  var H = Math.max(1, Math.round(num(inputs.height, DEF.H)));
  var line = clamp(num(inputs.lineHeight, DEF.LINE), 0.9, 2);
  var para = clamp(num(inputs.paraGap, DEF.PARA), 0, 2);
  // A margin can't be allowed to eat the page: leave at least a 32px strip of
  // text however the two are dragged against each other (a 256px page with a
  // 128px margin would otherwise leave an inner box of zero and divide by it).
  var pad = Math.round(clamp(num(inputs.padding, DEF.PAD), 0, Math.max(0, Math.min(W, H) / 2 - 16)));

  var innerW = W - pad * 2;
  var innerH = H - pad * 2;

  var textTokens = Math.ceil(chars / CHARS_PER_TEXT_TOKEN);
  var imageTokens = Math.ceil((W * H) / PX_PER_IMAGE_TOKEN);

  return {
    paras: paras,
    isEmpty: paras.length === 0,
    // "auto" is resolved in the template, where columns can actually be measured.
    columns: inputs.columns || 'auto',
    // column-count needs a concrete number for the first paint; auto starts at 1
    // and the template overwrites it a frame later.
    initialColumns: inputs.columns === 'auto' || !inputs.columns ? 1 : Number(inputs.columns),
    wrap: inputs.keepLines === false ? 'normal' : 'pre-wrap',
    // Geometry, echoed back for the template + CSS. Named so none of them collide
    // with an input id - a returned key that matches one would write itself back
    // into that control on every keystroke.
    pageW: W,
    pageH: H,
    pad: pad,
    line: line,
    para: para,
    minSize: GEO.MIN,
    maxSize: GEO.MAX,
    fontSize: Math.round(estimateFontSize(chars, innerW, innerH, line) * 10) / 10,
    dims: W + '×' + H,
    chars: group(chars),
    textTokens: group(textTokens),
    imageTokens: group(imageTokens),
    verdict: verdictOf(textTokens, imageTokens)
  };
}

function inputsOf(model) {
  var out = {};
  for (var i = 0; i < model.length; i++) out[model[i].id] = model[i].value;
  return out;
}

function onInit(ctx) {
  return compute(inputsOf(ctx.model));
}

function onInput(ctx) {
  return compute(inputsOf(ctx.model));
}
