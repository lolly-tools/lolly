/* global onInit, onInput, exportFile */
/**
 * Rebrand a Deck - hooks.
 *
 * A transform utility (deck in → re-themed deck out). The OOXML surgery lives
 * in the shell behind `host.pptx` (the engine's pptx primitives) - the hook
 * sandbox has no zip/XML library and no `import`, so it just orchestrates: ask
 * the host to inspect the picked deck (slide count, read theme, the literal
 * colours and typefaces on slides), seed the editable colour/font mapping rows
 * from the brand-aware suggestions, and hand the user's final plan to
 * `host.pptx.rebrand` for the download.
 *
 * The same inspect job backs both the live review card (onInit/onInput) and
 * the download's theme plan (exportFile): a one-entry promise cache keyed on
 * file identity means the read runs once. The review is bounded by a short
 * inner budget so a huge deck can't trip the runtime's 2s onInput timeout -
 * if it doesn't finish in time the card shows "reading…" and the job stays
 * cached for the next pass and the download.
 *
 * The mapping rows seed ONCE per file and are never reseeded (the posterize
 * palette guard): every later onInput re-delivers the cached inspect result,
 * so an unconditional patch would wipe the user's row edits on the very next
 * keystroke.
 */

// One in-flight (or settled) inspect job, keyed on file identity, so the review
// and the download share a single read instead of parsing the deck twice.
var _job = { key: '', promise: null };
// The file key whose inspect result last seeded the mapping rows. Rows for a
// seeded key belong to the user - they are never patched again (see compute).
var _seededKey = null;
// How long the live review waits for the inspect before falling back to
// "reading…" (kept well under the runtime's 2s onInput timeout).
var REVIEW_BUDGET_MS = 1200;

var PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function inputsFrom(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}

// "PK\x03\x04" zip magic - a .pptx is a zip package. The manifest `accept` is a
// UX hint only, so the bytes are validated here.
function isPptx(bytes) {
  return Boolean(bytes && bytes.length > 3 &&
    bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04);
}

// "%PDF" magic. A PDF is the single most likely wrong pick here - it's what a
// deck gets exported AS - and it earns its own message, because "not a deck"
// doesn't explain why a PDF can never be rebranded: the export flattened the
// colours and typefaces into page content, and re-saving it would not change a
// pixel. Same for the deck-shaped case below.
function isPdf(bytes) {
  return Boolean(bytes && bytes.length > 3 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
}

function fmtBytes(n) {
  if (!isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB'], i = -1, v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + u[i];
}

function outName(name) {
  var base = String(name || 'deck').replace(/\.pptx$/i, '');
  return base + '-rebranded.pptx';
}

function jobKey(file) {
  // Include the object URL (unique per pick) so two different decks that happen
  // to share a name AND byte-size can't collide on the cached result.
  return (file.url || '') + '|' + file.name + '|' + file.size;
}

// Brand swatches for the inspect's nearest-colour suggestions - the active
// brand's colour tokens, when the shell provides them. No tokens → empty, and
// the inspect still reports what the deck carries (just without suggestions).
async function brandSwatches(host) {
  if (!host.tokens || typeof host.tokens.colors !== 'function') return [];
  var out = [];
  try {
    var list = await host.tokens.colors({ theme: 'light' });
    (list || []).forEach(function (s) {
      if (s && s.value) out.push({ hex: s.value, name: s.name, role: s.path });
    });
  } catch (e) { /* broken tokens doc → no suggestions */ }
  return out;
}

// The brand's font slots live at the `font.<slot>` token paths (DTCG
// fontFamily - a family string or a stack array; the first plain family wins).
// Nothing resolvable → undefined, so the inspect offers no font suggestions.
var FONT_SLOTS = ['brand', 'serif', 'mono'];

function firstFamily(v) {
  var fam = Array.isArray(v) ? v[0] : v;
  if (typeof fam !== 'string') return null;
  fam = fam.trim().replace(/^['"]+|['"]+$/g, '').trim();
  return fam || null;
}

async function brandFonts(host) {
  if (!host.tokens || typeof host.tokens.resolve !== 'function') return undefined;
  var out = {};
  var found = false;
  for (var i = 0; i < FONT_SLOTS.length; i++) {
    var fam = null;
    try { fam = firstFamily(await host.tokens.resolve('{font.' + FONT_SLOTS[i] + '}')); }
    catch (e) { /* slot not declared */ }
    if (fam) { out[FONT_SLOTS[i]] = fam; found = true; }
  }
  return found ? out : undefined;
}

// Return the shared inspect promise for this file key, starting it if needed.
// A failed job is dropped so a later attempt re-runs rather than reusing the
// rejection (inspect itself never throws - this guards the token reads).
function jobFor(host, file, key) {
  if (_job.key === key && _job.promise) return _job.promise;
  var p = Promise.resolve().then(async function () {
    var opts = { swatches: await brandSwatches(host) };
    var fonts = await brandFonts(host);
    if (fonts) opts.fonts = fonts;
    return host.pptx.inspect(file.bytes, opts);
  });
  _job = { key: key, promise: p };
  p.catch(function () { if (_job.key === key) _job = { key: '', promise: null }; });
  return p;
}

// Resolve `promise` if it settles within `ms`, otherwise resolve null (the job
// keeps running in the shell and stays cached for a later pass / the download).
function withBudget(promise, ms) {
  return new Promise(function (resolve) {
    var settled = false;
    var t = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, ms);
    promise.then(
      function (v) { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      function () { if (!settled) { settled = true; clearTimeout(t); resolve(null); } }
    );
  });
}

// The before/after strip pairs the deck's read theme with the brand suggestion
// - the 12 clrScheme colour slots (fonts ride the mapping list instead).
var THEME_SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];

function themeRows(res) {
  var sug = res.themeSuggestion;
  if (!sug) return [];
  var rows = [];
  THEME_SLOTS.forEach(function (slot) {
    var from = res.theme && res.theme.colors ? res.theme.colors[slot] : null;
    if (from && sug[slot]) rows.push({ slot: slot, from: from, to: sug[slot] });
  });
  return rows;
}

function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

// Is anything on the slides actually rebrandable? Returns the sentence to show
// when the answer is no, or '' when the deck has live content to work on.
//
// `content` (engine 1.79) is the direct signal - a node-kind tally per deck. An
// older shell omits it, so there is a fallback: no literal colour anywhere AND
// no typeface beyond the two the theme itself declares means the slides carry
// nothing a colour/font map could reach. The fallback is deliberately weaker
// (a fully theme-linked deck rebrands beautifully and looks the same from
// here), so it only warns about mapped values, not about the whole render.
function flattenedNote(res) {
  var c = res.content;
  if (c) {
    var live = (c.texts || 0) + (c.shapes || 0) + (c.tables || 0) + (c.unknown || 0);
    if ((c.pictures || 0) > 0 && live === 0) {
      return 'Every slide in this deck is a flat picture - there is no live text, ' +
        'shape or table on them. Rebranding cannot change a pixel of it: colours ' +
        'and typefaces baked into an image are part of the image. This is what a ' +
        'deck exported to PDF, or rebuilt from page images, looks like. Go back to ' +
        'the editable original and rebrand that.';
    }
    if (live === 0 && (c.pictures || 0) === 0) {
      return 'These slides are empty - there is nothing on them to rebrand. Only the ' +
        'deck\'s theme would be rewritten, and the download would look identical.';
    }
    return '';
  }
  // Older shell: no tally. Fall back to "nothing for the maps to bite on".
  var themeFaces = {};
  if (res.theme) {
    if (res.theme.majorFont) themeFaces[res.theme.majorFont.toLowerCase()] = true;
    if (res.theme.minorFont) themeFaces[res.theme.minorFont.toLowerCase()] = true;
  }
  var slideFonts = 0;
  res.fonts.forEach(function (f) { if (!themeFaces[String(f.family).toLowerCase()]) slideFonts++; });
  if (res.colors.length === 0 && slideFonts === 0) {
    return 'No hardcoded colour or typeface was found on these slides. If they are flat ' +
      'pictures - a deck exported to PDF, or rebuilt from page images - the download ' +
      'will look identical to what you uploaded, because colours baked into an image ' +
      'cannot be swapped. If the deck is theme-linked instead, the brand theme below ' +
      'still does the whole job.';
  }
  return '';
}

async function compute(ctx) {
  var inputs = inputsFrom(ctx.model);
  var host = ctx.host;
  var f = inputs.source;

  // Display-only extras - `useTheme`/`dropFonts` reflect from the input values
  // directly (a hook key matching an input id writes back to the model). The
  // two mapping inputs are the deliberate exception: compute patches them by
  // id exactly once per file (the seed below), never after.
  var base = {
    hasFile: false, unsupported: false, isPdfFile: false, pptxUnavailable: false,
    fileName: '', fileSize: '',
    pending: false, ready: false, done: false,
    slideCount: 0, colorCount: 0, fontCount: 0, reviewCount: 0,
    summaryText: '', reviewText: '',
    themeRows: [], hasTheme: false,
    flattened: false, flattenedText: '',
  };

  if (!f || !f.bytes) return base;
  base.hasFile = true;
  base.fileName = f.name || 'deck.pptx';
  base.fileSize = fmtBytes(f.size);

  if (!isPptx(f.bytes)) {
    base.unsupported = true;
    base.isPdfFile = isPdf(f.bytes);
    return base;
  }

  if (!host || !host.pptx || typeof host.pptx.inspect !== 'function') {
    base.pptxUnavailable = true; // older shell: no pptx capability
    return base;
  }
  base.ready = true;

  var key = jobKey(f);
  var res;
  try {
    res = await withBudget(jobFor(host, f, key), REVIEW_BUDGET_MS);
  } catch (e) {
    res = null;
  }

  // Known limitation (consistent with compress-pdf): a job that finishes just
  // after the budget stays "pending" until the next input event re-runs
  // compute - a hook can't push a late patch into the model.
  if (!res) { base.pending = true; return base; }
  if (!res.ok) {
    // zip magic, but not a readable deck (a .docx, a renamed zip, a corrupt file)
    base.ready = false;
    base.unsupported = true;
    return base;
  }

  base.done = true;
  base.slideCount = res.slideCount;
  base.colorCount = res.colors.length;
  base.fontCount = res.fonts.length;
  res.colors.forEach(function (c) { if (c.review) base.reviewCount++; });
  base.summaryText = plural(res.slideCount, 'slide') + ' · ' +
    plural(base.colorCount, 'hardcoded colour') + ' · ' +
    plural(base.fontCount, 'typeface');
  base.reviewText = base.reviewCount > 0
    ? plural(base.reviewCount, 'colour') + ' worth a look - the nearest brand match is a perceptual stretch.'
    : '';
  base.themeRows = themeRows(res);
  base.hasTheme = base.themeRows.length > 0;

  // A deck the rebrand cannot visibly touch - slides that are nothing but
  // pictures (a PDF or exported images dropped onto blank slides). The theme
  // swap still rewrites the theme part, but no slide references it and there is
  // no live text or shape fill to remap, so the download would come back
  // looking exactly like the input. Say it before the click, not after.
  var flat = flattenedNote(res);
  if (flat) { base.flattened = true; base.flattenedText = flat; }

  // Seed the editable mapping rows from the FIRST result for this file - and
  // only then. A key already seeded means the rows are the user's (edits,
  // removals); re-patching them here would wipe that work on every input. A
  // fresh mount that restored rows for this same file (a saved session) is
  // seeded-by-inheritance: mark the key, keep the rows.
  if (_seededKey !== key) {
    var rows = Array.isArray(inputs.colorMap) ? inputs.colorMap : [];
    if (rows.length === 0 || _seededKey !== null) {
      base.colorMap = res.colors.map(function (c) {
        return { from: c.hex, to: c.suggested || c.hex };
      });
      base.fontMap = [];
      res.fonts.forEach(function (fo) {
        if (fo.suggested && fo.suggested !== fo.family) {
          base.fontMap.push({ from: fo.family, to: fo.suggested });
        }
      });
    }
    _seededKey = key;
  }
  return base;
}

function onInit(ctx) { return compute(ctx); }
function onInput(ctx) { return compute(ctx); }

// Mapping rows → the plan's plain from→to record. Identity rows - seeded
// suggestions the user left pointing at the same value - are dropped, so a
// no-op row never churns slide parts. Null when nothing maps.
function mapOf(rows) {
  if (!Array.isArray(rows)) return null;
  var out = null;
  rows.forEach(function (r) {
    var from = r && typeof r.from === 'string' ? r.from.trim() : '';
    var to = r && typeof r.to === 'string' ? r.to.trim() : '';
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) return;
    if (!out) out = {};
    out[from] = to;
  });
  return out;
}

async function exportFile(ctx) {
  var inputs = inputsFrom(ctx.model);
  var host = ctx.host;
  var f = inputs.source;
  if (!f || !f.bytes) throw new Error('Pick a PowerPoint file first.');
  if (!host || !host.pptx || typeof host.pptx.rebrand !== 'function') {
    throw new Error('PowerPoint rebranding isn\'t available in this app.');
  }

  // Rows never seeded for this file key = the download raced the review (the
  // inspect hadn't landed when the user hit Download). The inspect result then
  // stands in for the seed below, or the plan would silently ship theme-only.
  var key = jobKey(f);
  var unseeded = _seededKey !== key;

  var res = null;
  if (inputs.useTheme !== false || unseeded) {
    // The inspect is cached from the review in the common path. It backs the
    // theme plan (no brand tokens → no suggestion → no theme patch) and the
    // unseeded-row fallback; the colour/font maps below always apply.
    res = await jobFor(host, f, key);
  }

  var plan = {};
  if (inputs.useTheme !== false && res && res.ok && res.themeSuggestion) {
    plan.theme = res.themeSuggestion;
  }

  var colorRows = inputs.colorMap;
  var fontRows = inputs.fontMap;
  if (unseeded && res && res.ok) {
    var rows = Array.isArray(colorRows) ? colorRows : [];
    // Mirror the seed rule (incl. seeded-by-inheritance: restored rows for an
    // unmarked key are the user's): derive exactly the rows the seeder would
    // have written, so a racy download equals the seeded default. Identity
    // rows fall out in mapOf, same as the seeded path.
    if (rows.length === 0 || _seededKey !== null) {
      colorRows = res.colors.map(function (c) {
        return { from: c.hex, to: c.suggested || c.hex };
      });
      fontRows = [];
      res.fonts.forEach(function (fo) {
        if (fo.suggested && fo.suggested !== fo.family) {
          fontRows.push({ from: fo.family, to: fo.suggested });
        }
      });
    }
  }
  var colors = mapOf(colorRows);
  if (colors) plan.colorMap = colors;
  var fonts = mapOf(fontRows);
  if (fonts) plan.fontMap = fonts;
  plan.dropEmbeddedFonts = Boolean(inputs.dropFonts);

  var out = await host.pptx.rebrand(f.bytes, plan);
  return { bytes: out.bytes, mime: PPTX_MIME, filename: outName(f.name) };
}
