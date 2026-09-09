// SPDX-License-Identifier: MPL-2.0
/**
 * The collab surface's i18n contract - the guarantee the six STRINGS maps used to give
 * on their own, restated now that they are catalog KEYS rather than the copy itself.
 *
 * Each module already pins its own two halves (`collab-ceremony.test.ts`,
 * `beam-toast.test.ts`, `join-route.test.ts`): every string the DOM shows comes out of
 * that module's map, and the map is the only place copy lives in its source. Those two
 * were enough while the map WAS the rendered text. They are not enough now: a value can
 * be in the map, render verbatim, and still be a string no translator ever sees - which
 * is exactly what `collab-pill.ts` and `collab-focus.ts` were before this wave, with
 * their copy in inline `tRaw('…')` literals that scripts/translate.ts cannot scan.
 *
 * So this file closes the loop, in four parts:
 *
 *  1. TRACEABILITY. Every value in every collab STRINGS map is a key in all 26 shipped
 *     `locales/collab/<lang>.json` catalogs. Rendered ⊆ map (per module) plus map ≡
 *     catalog (here) is the end-to-end "every rendered string traces to a key".
 *  2. TRANSLATION ACTUALLY HAPPENS. Every `STRINGS` reference in those modules' source
 *     sits inside a `t()`/`tRaw()` call. A map of keys is worthless if a render site
 *     reads one straight out of it - that renders English forever, in every language,
 *     with nothing failing. This is the part no runtime assertion can reach, because in
 *     English a missed call site and a correct one produce identical output.
 *  3. FALLBACK. A language whose catalog is missing renders English - not a blank, not a
 *     raw key - through the real i18n runtime and a real mounted component.
 *  4. THE BOOT CARVE-OUT. The eight strings that render on ordinary chrome with the flag
 *     off stay in the `spa` corpus: the three dynamic Feature-flags-row strings are
 *     listed in extra-keys.spa.json, and the Share rows stay literal `t('…')` calls.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/collab-i18n.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const COLLAB_LOCALES = join(HERE, 'locales', 'collab');
const EXTRA_KEYS = join(HERE, '..', '..', '..', 'scripts', 'i18n', 'extra-keys.spa.json');

// ── jsdom, before any module import (these are DOM modules) ───────────────────

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/app' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
(globalThis as { location?: Location }).location = dom.window.location as unknown as Location;
(globalThis as { Element?: typeof Element }).Element = dom.window.Element as unknown as typeof Element;
(globalThis as { localStorage?: Storage }).localStorage = dom.window.localStorage;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  setTimeout(() => cb(0), 0);
  return 0;
}) as unknown as typeof requestAnimationFrame;

const ceremony = await import('./components/collab-ceremony.ts');
const joinRoute = await import('./collab/join-route.ts');
const beamToast = await import('./components/beam-toast.ts');
const beamPack = await import('./lib/beam-pack.ts');
const pill = await import('./components/collab-pill.ts');
const focus = await import('./components/collab-focus.ts');
const workOpener = await import('./org/collab-work-opener.ts');
const beamSink = await import('./lib/beam-sink.ts');
const { setActiveLang, loadNamespace, tRaw, currentLang } = await import('./i18n.ts');

/**
 * The eight modules whose copy is the `collab` namespace, and the path each one's map is
 * sliced from by scripts/translate.ts's corpus. Kept in the same order as
 * COLLAB_SOURCES there, so a diff of the catalogs reads screen by screen.
 */
const MODULES: ReadonlyArray<{ rel: string; strings: unknown }> = [
  { rel: 'components/collab-ceremony.ts', strings: ceremony.STRINGS },
  { rel: 'collab/join-route.ts', strings: joinRoute.STRINGS },
  { rel: 'components/beam-toast.ts', strings: beamToast.STRINGS },
  { rel: 'lib/beam-pack.ts', strings: beamPack.STRINGS },
  { rel: 'lib/beam-sink.ts', strings: beamSink.STRINGS },
  { rel: 'components/collab-pill.ts', strings: pill.STRINGS },
  { rel: 'components/collab-focus.ts', strings: focus.STRINGS },
  { rel: 'org/collab-work-opener.ts', strings: workOpener.STRINGS },
];

/** Every string leaf of a map, in source order (ceremony's `fail` screens nest once). */
function leaves(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) leaves(v, out);
  return out;
}

const ALL_KEYS = [...new Set(MODULES.flatMap((m) => leaves(m.strings)))];

const catalogs = readdirSync(COLLAB_LOCALES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ lang: f.replace(/\.json$/, ''), path: join(COLLAB_LOCALES, f) }));

// ── 1. Traceability: map value ⇒ catalog key ─────────────────────────────────

test('sanity: every collab STRINGS map was found and is non-empty', () => {
  for (const m of MODULES) {
    assert.ok(leaves(m.strings).length > 0, `${m.rel} exports an empty STRINGS map - this file would pass vacuously`);
  }
  assert.ok(ALL_KEYS.length > 150, `only ${ALL_KEYS.length} collab keys - a map moved or was renamed`);
});

test('the collab namespace has a catalog for every non-English locale', () => {
  // engine/src/lang.ts's LANGS minus 'en'. A namespace whose directory is short a file
  // is not merely untranslated: Rollup's dynamic-import-vars transform resolves
  // i18n.ts's `./locales/collab/${lang}.json` against what exists at build time.
  assert.equal(catalogs.length, 26, `${catalogs.length} collab catalogs, expected 26`);
});

test('every string the collab surface can render is a key in all 26 catalogs', () => {
  const missing: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    for (const key of ALL_KEYS) {
      if (!Object.hasOwn(cat, key)) missing.push(`${lang}: ${JSON.stringify(key.slice(0, 60))}`);
    }
  }
  assert.deepEqual(
    missing.slice(0, 20),
    [],
    `${missing.length} collab string(s) have no catalog entry - regenerate with\n`
    + '  pnpm run translate --corpus collab --export-pending   (then --import)\n'
    + missing.slice(0, 20).join('\n'),
  );
});

test('no catalog carries a key the modules no longer render', () => {
  // The other direction, so a deleted string cannot sit in 26 files being paid for by
  // every reader of the diff - and so a TYPO in a map shows up as an orphan here rather
  // than as one silently-English line in production.
  const known = new Set(ALL_KEYS);
  const orphans: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    for (const key of Object.keys(cat)) if (!known.has(key)) orphans.push(`${lang}: ${JSON.stringify(key.slice(0, 60))}`);
  }
  assert.deepEqual(orphans.slice(0, 20), [], `${orphans.length} orphaned catalog key(s):\n${orphans.slice(0, 20).join('\n')}`);
});

test('no catalog entry is empty - a half-filled translation must never render blank', () => {
  const blanks: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    for (const [key, value] of Object.entries(cat)) {
      if (typeof value !== 'string' || value.trim() === '') blanks.push(`${lang}: ${JSON.stringify(key.slice(0, 50))}`);
    }
  }
  assert.deepEqual(blanks.slice(0, 20), [], blanks.join('\n'));
});

/**
 * How much of a catalog is still its own English source, counted over the values a
 * translator was actually meant to change.
 *
 * Factored out because both echo guards below are the same measurement at two
 * thresholds, and because a check whose only input is 26 known-good files cannot show
 * that it still FAILS on a bad one. `the echo guards fail a wholly-English catalog`
 * feeds this the synthetic catalogs the real directory will never contain, so flipping
 * a comparison or widening a sample here stops being a change that every green run
 * keeps looking green through.
 */
function echoStats(
  cat: Record<string, string>,
  gradeable: (en: string) => boolean,
): { graded: number; echoed: number } {
  const graded = Object.entries(cat).filter(([en]) => gradeable(en));
  return { graded: graded.length, echoed: graded.filter(([en, tr]) => tr === en).length };
}

/** The first guard's sample: long enough that a real translation cannot match it. */
const SUBSTANTIAL = (en: string): boolean => en.length >= 25 && /\s/.test(en);

test('no collab catalog is a wholesale English echo of its own keys', () => {
  // Presence and non-emptiness were never enough. `no.json` shipped 174 of 174 values
  // identical to their keys - a file the pipeline writes for an untranslated language
  // (writeCatalogFromCache's "English fallback, never ship broken output") - and every
  // check above passed against it, because an echo IS present and IS non-empty.
  //
  // Same shape and same threshold as locales.test.ts's boot-catalog guard, which cannot
  // see this directory: its readdirSync of locales/ never descends into locales/collab/.
  // Short values legitimately echo - "Live", "Total", "Host", "Name" are loanwords in
  // several of these languages - so only substantial strings count.
  const problems: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    const { graded, echoed } = echoStats(cat, SUBSTANTIAL);
    if (graded >= 50 && echoed > graded * 0.25) {
      problems.push(`${lang}: ${echoed}/${graded} long strings are identical to English - this catalog was never translated`);
    }
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

/**
 * Strings a real translation may leave byte-identical to its English source, each with
 * the reason it is not evidence of anything. This list exists so the ratio below counts
 * only values a translator was actually meant to change - it is NOT a blessing, and a
 * string on it is still translated when a language has a word for it.
 *
 * Nothing here is added because a catalog happened to echo it. Add a line only for a
 * source that is a loanword or a proper noun across the shipped set.
 */
const IDENTICAL_OK: ReadonlySet<string> = new Set([
  'Live',           // the loanword for a live broadcast in cs/de/es/it/nl/no/pt/sv
  'Total',          // same spelling in de/es/fr/nl/pt/ro/sv
  'Host',           // the networking sense; borrowed unchanged in de/nl/no/sv/tr
  'Observer',       // ditto in de/nl/ro
  'Collaboration',  // fr/en homograph, and the ro/nl spelling is within a letter of it
  'Name',           // de/nl spell it identically
  'Invitee',        // fr loanword, unchanged in en
  'Invitee {n}',    // the same word plus a number
  'Lolly',          // glossary.neverTranslate - a product name
  'OK',             // universal
  'QR',             // universal
  'beta',           // universal
]);

/** The second guard's sample: everything the allowlist does not excuse. */
const GRADEABLE = (en: string): boolean => !IDENTICAL_OK.has(en);

test('no collab catalog is an English echo end to end', () => {
  // The BACKSTOP for the guard above, and the reason it is a second test rather than a
  // loosened first one. That guard samples only SUBSTANTIAL strings (>= 25 characters
  // with a space) and only fires once a catalog has at least fifty of them, which is
  // the right shape for spotting a half-finished wave in a big catalog and the wrong
  // shape for a small one: a namespace of eighty short labels can be 100% English and
  // never present fifty samples, so the check never runs and the catalog ships.
  //
  // This one has NO sample floor, on purpose. "There were not many strings" is exactly
  // the excuse the floor above encodes, and a catalog that is entirely its own keys is
  // the pipeline's untranslated-fallback output whether it holds 190 strings or 9. The
  // allowlist is the pressure valve instead: a short catalog of genuine loanwords stays
  // green by NAMING them, which is a line in a diff, rather than by being too small to
  // check.
  //
  // The threshold is deliberately loose (>90%) because this is a floor, not a quality
  // bar - it answers "was this file ever translated at all", and the guard above is
  // what answers "was this wave finished".
  const problems: string[] = [];
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    const { graded, echoed } = echoStats(cat, GRADEABLE);
    if (!graded) continue;
    // The allowlist excuses individual strings; it must never become an exemption for
    // the catalog. If it ever grades less than most of a file, this guard has been
    // hollowed out from the side rather than by moving its threshold, and the number
    // below stops meaning anything.
    assert.ok(
      graded >= Object.keys(cat).length * 0.9,
      `${lang}: IDENTICAL_OK excuses ${Object.keys(cat).length - graded} of ${Object.keys(cat).length} strings - `
      + 'the allowlist is meant to name a handful of loanwords, not to shrink the sample',
    );
    if (echoed > graded * 0.9) {
      problems.push(
        `${lang}: ${echoed}/${graded} values are byte-identical to their English key `
        + '- this catalog is the pipeline\'s English fallback, not a translation',
      );
    }
  }
  assert.deepEqual(
    problems,
    [],
    '\nA catalog of English is worse than a missing one: every guard in this file passes '
    + 'against it (the keys are all present, nothing is blank, every placeholder survives) '
    + 'and it renders English in a language that has a catalog on disk.\n'
    + `${problems.join('\n')}\n`,
  );
});

test('the echo guards fail a wholly-English catalog and clear a translated one', () => {
  // Both guards above read the same 26 files, all of which pass - so on a green run
  // neither one demonstrates that it can still fail. That is precisely how the defect
  // they exist for got in: the ORIGINAL completeness check was keys-only, passed
  // against a Norwegian catalog that was 174/174 English, and its green tick was
  // indistinguishable from a green tick over a real translation.
  //
  // These two synthetic catalogs are the missing half. The first is exactly what the
  // pipeline writes for a language it has no cache entries for; the second is what a
  // finished wave looks like. A `>` flipped, a sample widened, or a threshold nudged
  // past 1 fails HERE, on a fixture, instead of going unnoticed until a locale ships
  // English.
  const keys = [...ALL_KEYS];
  assert.ok(keys.length >= 100, 'the fixtures below need a realistically sized corpus');

  const untranslated = Object.fromEntries(keys.map((k) => [k, k]));
  const translated = Object.fromEntries(keys.map((k) => [k, IDENTICAL_OK.has(k) ? k : `«${k}»`]));

  const eSub = echoStats(untranslated, SUBSTANTIAL);
  assert.ok(eSub.graded >= 50, `only ${eSub.graded} substantial strings - the first guard would not even run`);
  assert.ok(eSub.echoed > eSub.graded * 0.25, 'the substantial-sample guard no longer fires on an all-English catalog');

  const eAll = echoStats(untranslated, GRADEABLE);
  assert.ok(eAll.echoed > eAll.graded * 0.9, 'the end-to-end guard no longer fires on an all-English catalog');

  // And the other direction, so neither guard can be "strengthened" into flagging real
  // translations - a check that cries wolf gets its threshold raised, not its bug fixed.
  const tSub = echoStats(translated, SUBSTANTIAL);
  assert.ok(!(tSub.graded >= 50 && tSub.echoed > tSub.graded * 0.25), 'the substantial-sample guard flags a translated catalog');
  const tAll = echoStats(translated, GRADEABLE);
  assert.equal(tAll.echoed, 0, 'a translated catalog still reads as echoed - the comparison is wrong');
});

test('every placeholder survives into every collab translation', () => {
  // locales.test.ts runs this over the boot catalogs; the namespace ones are a separate
  // directory it does not glob, and a dropped {peer}/{tool} here is the same bug.
  const PLACEHOLDER = /\{[a-zA-Z][\w.-]*\}/g;
  const problems: string[] = [];
  let checked = 0;
  for (const { lang, path } of catalogs) {
    const cat = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    for (const [en, tr] of Object.entries(cat)) {
      if (typeof tr !== 'string' || !tr) continue;
      const want = (en.match(PLACEHOLDER) ?? []).slice().sort();
      const got = (tr.match(PLACEHOLDER) ?? []).slice().sort();
      if (!want.length && !got.length) continue;
      checked++;
      if (want.join(' ') !== got.join(' ')) {
        problems.push(`${lang}: ${JSON.stringify(en.slice(0, 50))} expected ${want.join(' ') || '(none)'}, got ${got.join(' ') || '(none)'}`);
      }
    }
  }
  assert.ok(checked >= 26, `only ${checked} placeholder-bearing collab strings seen - the scan is not finding them`);
  assert.deepEqual(problems.slice(0, 20), [], problems.join('\n'));
});

// ── 2. Every STRINGS reference is translated at its site ─────────────────────

/** Blank out comments and string/template literals so a scan sees only code. */
function codeOnly(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && src[i + 1] === '*') {
      out += '  '; i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += ' '; i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += ' '; i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Is the `STRINGS` token at `idx` an argument of a `t(` / `tRaw(` call?
 *
 * Walks backwards to the paren that encloses it and reads the identifier in front of
 * that paren, so a ternary (`tRaw(a ? STRINGS.x : STRINGS.y)`), a nested call
 * (`tRaw(STRINGS[KEYS[k]])`) and a multi-line argument list all resolve correctly.
 * Stops at a statement boundary so a bare reference is reported rather than credited to
 * some unrelated call further up the file.
 */
function insideTranslateCall(code: string, idx: number): boolean {
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const c = code[i]!;
    if (c === ')' || c === ']' || c === '}') { depth++; continue; }
    if (c === '(') {
      if (depth > 0) { depth--; continue; }
      const before = code.slice(Math.max(0, i - 12), i);
      return /(?:^|[^\w$.])t(?:Raw)?$/.test(before.trimEnd());
    }
    if (c === '[' || c === '{') { if (depth > 0) { depth--; continue; } return false; }
    if (c === ';' && depth === 0) return false;
  }
  return false;
}

/**
 * References that are legitimately NOT inside a translate call, each with its reason.
 * Keyed by module, valued by the exact source snippet, so widening this list is a
 * deliberate line in a diff rather than a loosened regex.
 */
const UNTRANSLATED_OK: Record<string, readonly string[]> = {
  // The OBJECT holding one end-cause's three keys. All three are translated on the next
  // three lines, in failureCopy - see that function's comment.
  'components/collab-ceremony.ts': ['STRINGS.fail[cause]', 'STRINGS.fail;'],
};

test('every STRINGS reference in the collab modules is inside a t()/tRaw() call', () => {
  const bare: string[] = [];
  let checked = 0;
  for (const { rel } of MODULES) {
    const src = readFileSync(join(HERE, rel), 'utf8');
    const start = src.indexOf('export const STRINGS');
    assert.ok(start > 0, `${rel}: STRINGS moved or was renamed - this guard would pass vacuously`);
    // Blank the map itself: its keys are declarations, not references.
    const mapEnd = src.indexOf('\n};', start) >= 0 ? src.indexOf('\n};', start) : src.indexOf('\n} as const;', start);
    assert.ok(mapEnd > start, `${rel}: the STRINGS map no longer ends at column 0`);
    const code = codeOnly(src.slice(0, start) + ' '.repeat(mapEnd - start) + src.slice(mapEnd));

    const allowed = UNTRANSLATED_OK[rel] ?? [];
    for (const m of code.matchAll(/(?<![\w$.])STRINGS(?![\w$])/g)) {
      const idx = m.index;
      // `keyof typeof STRINGS` and friends are TYPE positions, not renders.
      if (/typeof\s+$/.test(code.slice(Math.max(0, idx - 10), idx))) continue;
      const snippet = code.slice(idx, idx + 40).split('\n')[0]!.trim();
      if (allowed.some((ok) => snippet.startsWith(ok))) continue;
      checked++;
      if (!insideTranslateCall(code, idx)) {
        const line = src.slice(0, idx).split('\n').length;
        bare.push(`${rel}:${line}  ${snippet}`);
      }
    }
  }
  assert.ok(checked > 100, `only ${checked} STRINGS references scanned - the walk has rotted`);
  assert.deepEqual(
    bare,
    [],
    'a STRINGS value read without t()/tRaw() renders English in every language, forever, '
    + 'with nothing failing. Wrap it, or hold the KEY NAME in a table and translate at the '
    + `render site (see beam-toast.ts's REASON_KEYS):\n${bare.join('\n')}`,
  );
});

/**
 * A STRINGS map that is NOT a corpus source, and the reason it is allowed to stay that
 * way. Anything not listed here and not in MODULES is a map of user copy no translator
 * will ever see - which is exactly how `org/collab-work-opener.ts` shipped 16 English
 * sentences past a green wave: it was written to the same "one map, one wave" convention
 * as the six converted modules, and simply never got added to COLLAB_SOURCES.
 */
const NOT_A_CORPUS_SOURCE: Record<string, string> = {
  // Two values, `Host` and `Invitee`, which collab-ceremony.ts already declares - so the
  // COPY is translated and sits in all 26 catalogs; this map is a second reference to the
  // same two keys for a nameless peer. Its read at beam-session.ts:537 is not yet wrapped,
  // so those two words still paint English; the file belongs to another in-flight wave and
  // is not this one's to edit. Adding it to COLLAB_SOURCES would also orphan nothing and
  // add nothing - the keys are already there - so this is a call-site fix, not a corpus one.
  'collab/beam-session.ts': 'duplicate of two ceremony keys; call site owned by another wave',
};

test('every STRINGS map in the web shell is a corpus source or a documented exception', () => {
  // The completeness half of part 2. The per-module guards prove that what a module
  // renders comes out of its own map, and the catalog guards prove that every map in
  // MODULES is translated - but neither can see a map that was never wired to either.
  const roots = [HERE];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      if (!/^export\s+const\s+STRINGS\b/m.test(readFileSync(abs, 'utf8'))) continue;
      found.push(abs.slice(HERE.length + 1).split(sep).join('/'));
    }
  };
  for (const root of roots) walk(root);

  assert.ok(found.length >= MODULES.length, `only ${found.length} STRINGS maps found - the walk has rotted`);
  const known = new Set([...MODULES.map((m) => m.rel), ...Object.keys(NOT_A_CORPUS_SOURCE)]);
  const unaccounted = found.filter((rel) => !known.has(rel));
  assert.deepEqual(
    unaccounted,
    [],
    'a STRINGS map of user copy is neither a translation corpus source nor a documented '
    + 'exception, so it renders English in all 26 languages with nothing failing. Add it to '
    + "scripts/translate.ts's COLLAB_SOURCES and to MODULES above, or list it in "
    + `NOT_A_CORPUS_SOURCE with the reason:\n${unaccounted.join('\n')}`,
  );
  // And the other direction: an exception that no longer exists is a stale excuse.
  const stale = Object.keys(NOT_A_CORPUS_SOURCE).filter((rel) => !found.includes(rel));
  assert.deepEqual(stale, [], `NOT_A_CORPUS_SOURCE names a file with no STRINGS map:\n${stale.join('\n')}`);
});

// ── 3. Fallback: a missing catalog renders English ───────────────────────────

test('a language with no collab catalog renders English, never a raw key or a blank', async () => {
  // Arabic is a real target (and RTL). Under node the locale chunk cannot be imported
  // (JSON needs an import attribute), so both the boot catalog and the namespace fail to
  // load - which is precisely the situation of "not translated yet", exercised against the
  // real runtime rather than a stub.
  await setActiveLang('ar', { persist: false });
  assert.equal(currentLang(), 'ar');
  await loadNamespace('collab'); // must not throw, must not reject

  for (const key of ALL_KEYS) {
    const rendered = tRaw(key);
    assert.equal(rendered, key, `${JSON.stringify(key.slice(0, 40))} did not fall back to its English source`);
    assert.notEqual(rendered.trim(), '', 'a fallback must never be blank');
  }

  // Placeholders still fill from the English source, so a fallback is a whole sentence.
  assert.equal(tRaw(ceremony.STRINGS.connectedBody, { peer: 'Priya' }), 'You are working with Priya.');
  assert.equal(tRaw(pill.STRINGS.joined, { name: "O'Brien" }), "O'Brien joined");
  assert.ok(!tRaw(ceremony.STRINGS.countdown, { time: '9:30' }).includes('{'), 'no unfilled placeholder survives');
});

test('a real component mounted in an untranslated language paints English', async () => {
  await setActiveLang('ar', { persist: false });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const handle = beamToast.mountBeamToast(host, {
    subscribe: (fn) => { emit = fn; return () => {}; },
    accept: () => {}, decline: () => {}, cancel: () => {},
  });
  emit({
    t: 'offer-received',
    offer: { beamId: 'b1', role: 'receiver', kind: 'assets', name: 'Berlin pack', itemCount: 2, totalBytes: 2048, peerName: 'Priya' },
  });
  // One turn, so the namespace load's own microtask (which resolves to nothing here)
  // has been and gone before the DOM is read.
  await Promise.resolve();
  const text = host.textContent ?? '';
  assert.ok(text.includes('Berlin pack'), text);
  assert.ok(text.includes(beamToast.STRINGS.accept), 'the Accept button fell back to English');
  assert.ok(text.includes(beamToast.STRINGS.decline), 'the Decline button fell back to English');
  assert.ok(text.includes('From Priya'), `the peer line fell back to English: ${text}`);
  handle.dispose();
  host.remove();
  await setActiveLang('en', { persist: false });
});

let emit: (event: import('./components/beam-toast.ts').BeamToastEvent) => void = () => {};

// ── 4. The eight boot strings stay in the spa corpus ─────────────────────────

test('the Feature-flags row copy is listed for the spa corpus, not the lazy namespace', async () => {
  // t(f.label) / t(f.pill) / t(f.info) are DYNAMIC call sites, so extractSpaKeys cannot
  // see them - extra-keys.spa.json is the hand-list that covers exactly that case (the
  // Print-preflight row's three strings are the precedent right above these).
  const { PRIVATE_COLLAB_FLAG } = await import('./feature-flags.ts');
  const extra = JSON.parse(readFileSync(EXTRA_KEYS, 'utf8')) as string[];
  for (const value of [PRIVATE_COLLAB_FLAG.label, PRIVATE_COLLAB_FLAG.pill, PRIVATE_COLLAB_FLAG.info]) {
    assert.ok(value, 'the private-collab flag row lost one of its three strings');
    assert.ok(extra.includes(value!), `extra-keys.spa.json is missing ${JSON.stringify(value!.slice(0, 40))}`);
  }
  // And they are NOT in the lazy namespace: a string on ordinary chrome must not wait
  // for a namespace the flag-off majority never loads.
  const known = new Set(ALL_KEYS);
  assert.ok(!known.has(PRIVATE_COLLAB_FLAG.info!), 'the flag info sentence leaked into the collab namespace');
});

test('the session-tile badge copy is listed for the spa corpus', () => {
  // `lib/collab-tile-state.ts` paints a Projects tile synchronously, so its four strings
  // are boot copy rather than namespace copy (that file's own Copy header states why).
  // Boot copy has to reach the `spa` corpus somehow, and these cannot reach it the free
  // way: `extractSpaKeys` matches a quote after `t(` EXACTLY, so a `tRaw('…')` literal
  // is invisible to it - the badge's two count forms were already in all 26 catalogs by
  // hand while being absent from the corpus, which means the next `--corpus spa` run
  // would have written catalogs without them and the aria-label would have gone back to
  // English in 26 languages with nothing failing.
  //
  // extra-keys.spa.json is the hand-list for precisely that case, and this pins the
  // listing to the strings the module actually renders.
  const extra = JSON.parse(readFileSync(EXTRA_KEYS, 'utf8')) as string[];
  const src = readFileSync(join(HERE, 'lib/collab-tile-state.ts'), 'utf8');
  const literals = [...src.matchAll(/(?<![\w$.])tRaw\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]!);
  assert.ok(literals.length >= 4, `only ${literals.length} literal tRaw() sources in collab-tile-state.ts - the badge copy moved`);
  const unlisted = literals.filter((s) => !extra.includes(s));
  assert.deepEqual(
    unlisted,
    [],
    'a tRaw() literal in collab-tile-state.ts that extractSpaKeys cannot see and '
    + `extra-keys.spa.json does not list - it will be dropped by the next spa run:\n${unlisted.join('\n')}`,
  );
  // And NOT in the lazy namespace: a tile paints with no await to load one from.
  const known = new Set(ALL_KEYS);
  for (const s of literals) assert.ok(!known.has(s), `${JSON.stringify(s)} leaked into the collab namespace`);
});

test('the two Share-dialog rows stay literal t() call sites', () => {
  // These render whenever the Share dialog opens, so they belong to the boot catalog - 
  // and a literal `t('…')` is what makes them free: extractSpaKeys picks them up with no
  // hand-list at all. Pinned as source, because the rows are gated behind an opener that
  // nothing registers in a test build, so no DOM assertion can reach them.
  for (const rel of ['lib/collab-share-private.ts', 'org/collab-share.ts']) {
    const src = readFileSync(join(HERE, rel), 'utf8');
    const literals = [...src.matchAll(/(?<![\w$.])t\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]!);
    assert.ok(literals.includes('Start a collab'), `${rel}: the button label is no longer a literal t() call`);
    assert.ok(literals.includes('Starting a collab'), `${rel}: the announcement is no longer a literal t() call`);
    assert.ok(literals.some((s) => s.endsWith('collab')), `${rel}: the heading is no longer a literal t() call`);
    assert.ok(literals.some((s) => s.length > 40), `${rel}: the note sentence is no longer a literal t() call`);
  }
});
