// SPDX-License-Identifier: MPL-2.0
/**
 * The landing page's claim guards (plans/117 §6, doctrine in plans/116 §3 + §5).
 *
 * These run against the SOURCE files - `docs/site.md`, `docs/site/*.json`,
 * `docs/build.ts`, `docs/faq.md`, `docs/trust.md` - and never against the built
 * HTML under `shells/web/public/info/`. That is deliberate: the built site is a
 * committed artifact, so a stale build would let a regression pass here and ship
 * anyway. Judge the thing an author edits.
 *
 * Four rules, each with the reason it exists:
 *
 *  1. SAY OFFLINE ONCE. The offline / nothing-leaves claim is the strongest thing
 *     this project says, and repeating it in nine places turns it into wallpaper.
 *     It lives in exactly two places - the hero's decode line and block 3 - with
 *     the IT tab's one professional-register bullet as the single allowlisted
 *     exception (that audience needs the claim in its own tab, at depth).
 *  2. NO COMPETITOR NAMES outside the FAQ. Naming a competitor on the door picks
 *     a fight the trust brand pays for and dates the page; block 4 describes the
 *     ERA instead and lets the reader supply the name. The FAQ may name them,
 *     conversationally, at the bottom of the disclosure arc.
 *  3. THE SCEPTIC PARAGRAPH IS ONE PARAGRAPH. It has three homes (landing block
 *     7, faq.md, trust.md) and no second wording - a "we built this for
 *     ourselves" answer that drifts between pages is exactly the kind of thing a
 *     sceptic notices.
 *  4. BANNED WORDS. The landing reader includes school-teachers and parents
 *     making birthday invites. The precise vocabulary (deterministic,
 *     reproducible, provenance …) is not softened - it is MOVED, to the tier-2
 *     pages where it carries the search weight and earns its precision.
 *
 * WHAT THIS TEST DELIBERATELY DOES NOT JUDGE, so nobody reads a pass as more
 * than it is:
 *  - "render/rendering as a user-facing verb" and "assets where files works" are
 *    on the plan's banned list and are NOT mechanically checkable (the same word
 *    is correct in a builder sentence and wrong in a neighbour one). Applied by
 *    hand in the rebuild; not enforced here.
 *  - The audience tabs (site.md's middle sections) are exempt from the
 *    banned-word rule and NOT from the offline rule. They are the page's one
 *    professional-register surface - block 6 keeps them that way on purpose -
 *    so "deterministic" in the Operations tab is the audience's own vocabulary,
 *    while an offline claim there is still a second telling of block 3's story.
 *
 * Run directly: node --test tests/docs-claims.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf-8');

const siteMd = read('docs/site.md');
const buildTs = read('docs/build.ts');
const faqMd = read('docs/faq.md');
const trustMd = read('docs/trust.md');

// site.md splits on \n---\n: [0] is the hero subtitle, the middle sections are the
// audience tabs, the last is the platform/tools tail. Same parse buildLandingContent
// does, so the test reasons about the same three surfaces the page renders.
const siteSections = siteMd.split(/\n---\n/);
const heroSection = siteSections[0]!;
const audienceSections = siteSections.slice(1, -1);
const tailSection = siteSections[siteSections.length - 1]!;

// The landing site JSONs. formats.json / formats-catalog.json / import.json are
// absent BY DESIGN: plan 117 block 9 moved both of those bands off the landing onto
// their own pages, so they are tier-2 sources now and the landing's register rules
// no longer apply to them (the landing keeps a one-line teaser, which lives in
// build.ts and IS scanned).
const LANDING_JSON = [
  'about-items.json', 'assure.json', 'audience-chrome.json', 'everywhere.json',
  'hero-chrome.json', 'pathways.json', 'platform-chrome.json', 'qol.json',
  'social-proof.json', 'whats-a-tool.json', 'why.json',
];
const LANDING_SITE_MD = ['about.md', 'opensource.md'];
const MOVED_OFF_LANDING = ['formats.json', 'formats-catalog.json', 'import.json'];

// ── the build.ts landing region + its marked exceptions ──────────────────────

/**
 * The source between the two region markers - the landing's composition. Matched
 * on the marker's rule glyphs, not on the words alone: the opening comment
 * mentions "LANDING COPY REGION END" in prose, and a bare word search would end
 * the region three lines after it began.
 */
function landingRegion(): string {
  const start = buildTs.indexOf('═══ LANDING COPY REGION START');
  const end = buildTs.indexOf('═══ LANDING COPY REGION END');
  assert.ok(start > 0 && end > start, 'docs/build.ts must carry both LANDING COPY REGION markers');
  return buildTs.slice(start, end);
}

/**
 * The region with the named CLAIMS-ALLOW blocks cut out. A block opens with
 * `// CLAIMS-ALLOW: <name>` and closes with `// CLAIMS-ALLOW END`; anything
 * between is excused from the rule that names it. An UNNAMED exception therefore
 * fails - which is the point: the allowlist is written down beside the copy.
 */
function withoutAllow(src: string, ...names: string[]): string {
  let out = src;
  for (const name of names) {
    const open = new RegExp(`^[ \\t]*// CLAIMS-ALLOW: ${name}\\b`, 'm');
    // Loop, so a name used twice is fully removed rather than only its first use.
    for (;;) {
      const m = open.exec(out);
      if (!m) break;
      const closeIdx = out.indexOf('CLAIMS-ALLOW END', m.index);
      assert.ok(closeIdx > 0, `CLAIMS-ALLOW: ${name} has no CLAIMS-ALLOW END`);
      const lineEnd = out.indexOf('\n', closeIdx);
      out = out.slice(0, m.index) + out.slice(lineEnd < 0 ? out.length : lineEnd);
    }
  }
  return out;
}

/**
 * Drop comments so a rule is judged on COPY, not on the prose explaining it - a
 * doc comment that says "block 3 owns 'on your own device'" must not read as a
 * second telling. Only whole-line `//` comments and `/* *​/` blocks go: a trailing
 * comment after code would take a URL's tail with it.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter(l => !/^\s*\/\//.test(l))
    .join('\n');
}

/** Every `t('…')` / `t("…")` literal in a chunk of build.ts - the copy it ships. */
function tLiterals(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) out.push(m[1]!.replace(/\\'/g, "'"));
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]!.replace(/\\"/g, '"'));
  return out;
}

/** Every string value in a site JSON, flattened - the copy the landing renders. */
function jsonStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) jsonStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) jsonStrings(v, out);
  return out;
}

// ── 1. say offline once ──────────────────────────────────────────────────────

/**
 * The offline-claim phrase list (plan 117 §6). Written as regexes rather than
 * substrings so "on your device" and "on your own device" are one rule, and so a
 * hyphenated "on-device" cannot slip past the spaced form.
 */
const OFFLINE_PHRASES: Array<[string, RegExp]> = [
  ['works offline',   /works?\s+(fully\s+)?offline/i],
  ['fully offline',   /(fully|entirely|completely)\s+offline/i],
  ['nothing leaves',  /nothing\s+(you\s+\w+\s+)?(ever\s+)?leaves/i],
  ['never leaves',    /never\s+leaves/i],
  ['no upload',       /(no|nothing is|never)\s+upload(ed|s)?\b/i],
  ['on your device',  /on\s+(your|the)\s+(own\s+)?(device|machine|computer)/i],
  ['on-device',       /\bon-device\b/i],
];

function offend(text: string): string[] {
  return OFFLINE_PHRASES.filter(([, re]) => re.test(text)).map(([label]) => label);
}

test('say offline once: the hero decodes the claim and block 3 states it', () => {
  const heroLines = heroSection.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  assert.ok(heroLines.length >= 4, 'the hero subtitle should still be four lines');
  // Line 1 is the decode of "Content Sovereignty" and is the ONLY offline mention
  // allowed above the fold.
  assert.match(heroLines[0]!, /on your own device/,
    'the hero\'s first line is the plain decode of the H1 and must keep "on your own device"');
  for (const line of heroLines.slice(1)) {
    assert.deepEqual(offend(line), [], `hero line repeats the offline claim: ${line}`);
  }

  // Block 3 must actually make the claim - a purge that purged everything would
  // pass every other assertion in this file.
  const block3 = buildTs.slice(
    buildTs.indexOf('// CLAIMS-ALLOW: offline-statement'),
    buildTs.indexOf('// CLAIMS-ALLOW END', buildTs.indexOf('// CLAIMS-ALLOW: offline-statement')),
  );
  assert.match(block3, /Nothing you make ever leaves your device/);
  assert.match(block3, /Turn the Wi-Fi off and everything still works/);
  assert.match(block3, /Freedom is sweet/);
});

test('say offline once: no second telling in the landing sources', () => {
  // build.ts: the landing region, minus the two marked carriers (block 3 IS the
  // claim; the sceptic paragraph is FINAL copy that happens to contain the phrase).
  const region = stripComments(withoutAllow(landingRegion(), 'offline-statement', 'sceptic-paragraph'));
  assert.deepEqual(offend(region), [], 'docs/build.ts landing region repeats the offline claim');

  // site.md's hero is covered above; the tail and the audience tabs go here.
  assert.deepEqual(offend(tailSection), [], 'site.md tail (the platform box) repeats the offline claim');

  // The IT tab keeps ONE bullet - the professional-register version, with the
  // privacy-policy pointer. Pinned by its opening words so the allowlist cannot
  // quietly widen to the whole tab.
  const IT_BULLET = '- **Data stays on the device.**';
  const itTab = audienceSections.find(s => s.includes(IT_BULLET));
  assert.ok(itTab, `the IT tab must still carry the allowlisted bullet "${IT_BULLET}"`);
  for (const section of audienceSections) {
    const lines = section.split('\n').filter(l => !l.startsWith(IT_BULLET));
    const heading = section.split('\n').find(l => l.startsWith('## ')) ?? '?';
    assert.deepEqual(offend(lines.join('\n')), [], `audience tab ${heading} repeats the offline claim`);
  }

  // The landing content files.
  for (const name of LANDING_JSON) {
    const strings = jsonStrings(JSON.parse(read(`docs/site/${name}`))).join('\n');
    assert.deepEqual(offend(strings), [], `docs/site/${name} repeats the offline claim`);
  }
  for (const name of LANDING_SITE_MD) {
    assert.deepEqual(offend(read(`docs/site/${name}`)), [], `docs/site/${name} repeats the offline claim`);
  }

  // The FAQ renders inside the landing, so it is landing source too - minus the
  // sceptic paragraph, which is FINAL copy pinned identical in three homes.
  const faqWithoutSceptic = faqMd.split('\n').filter(l => !l.startsWith(SCEPTIC_PARAGRAPH.slice(0, 40))).join('\n');
  assert.deepEqual(offend(faqWithoutSceptic), [], 'docs/faq.md repeats the offline claim');
});

test('say offline once: the moved bands are no longer landing sources', () => {
  // If one of these came BACK onto the landing, its (tier-2 register) copy would
  // silently stop being checked by the rule above. The landing must reach them
  // through a teaser link instead.
  for (const name of MOVED_OFF_LANDING) {
    assert.ok(existsSync(resolve(repoRoot, 'docs/site', name)), `docs/site/${name} should still exist`);
  }
  // Each band is composed ONCE and hosted by its own page. Checked as wiring
  // rather than as rendered output: if a band came back inline on the landing,
  // its tier-2 copy would quietly start shipping under landing rules again.
  const region = landingRegion();
  assert.equal(region.split("loadSiteJson('import.json'").length - 1, 1,
    'import.json may be read in exactly one place: importBand()');
  assert.match(buildTs, /slug: 'formats',[\s\S]{0,400}render: renderFormatsPage/,
    'the formats page must be registered with its renderer');
  assert.match(buildTs, /slug: 'design-import',[\s\S]{0,500}render: renderDesignImportPage/,
    'the design-import page must be registered with its renderer');
  assert.match(buildTs, /function renderDesignImportPage[\s\S]{0,300}importBand\(/,
    'the design-import page must host the import band itself');
  assert.match(buildTs, /function renderFormatsPage[\s\S]{0,400}formatsSection\(/,
    'the formats page must host the three-zone table itself');
  // …and the landing keeps only the teaser links to them.
  assert.match(region, /href: localeHref\(lang, 'formats'\)/);
  assert.match(region, /href: localeHref\(lang, 'design-import'\)/);
});

// ── 2. no competitor names outside the FAQ ───────────────────────────────────

// Named on a compare page, in a FAQ answer, and nowhere else on the door.
const COMPETITORS = ['Canva', 'Adobe', 'Photoshop', 'Brandfolder', 'Bynder', 'Frontify'];
// Figma / Penpot / Illustrator / InDesign are a separate case and NOT banned
// outright: on this page they appear as the names of FILES a reader already owns
// ("bring Figma, Penpot, Illustrator, InDesign or any SVG"), which is interop
// vocabulary, not a competitive claim. They are allowed only inside the marked
// app-names region, so the exception cannot spread into a comparison sentence.
const APP_NAMES = ['Figma', 'Penpot', 'Illustrator', 'InDesign'];

test('no competitor names in the landing sources', () => {
  const sources: Array<[string, string]> = [
    ['docs/site.md (hero)', heroSection],
    ['docs/site.md (tail)', tailSection],
    ...audienceSections.map((s, i) => [`docs/site.md (tab ${i + 1})`, s] as [string, string]),
    ['docs/build.ts (landing region)', stripComments(landingRegion())],
    ...LANDING_JSON.map(n => [`docs/site/${n}`, jsonStrings(JSON.parse(read(`docs/site/${n}`))).join('\n')] as [string, string]),
    ...LANDING_SITE_MD.map(n => [`docs/site/${n}`, read(`docs/site/${n}`)] as [string, string]),
  ];
  for (const [label, text] of sources) {
    for (const name of COMPETITORS) {
      assert.ok(!new RegExp(`\\b${name}\\b`, 'i').test(text), `${label} names a competitor: ${name}`);
    }
  }
});

test('design-app names appear only where a file is being brought IN', () => {
  const region = stripComments(withoutAllow(landingRegion(), 'app-names'));
  for (const name of APP_NAMES) {
    assert.ok(!new RegExp(`\\b${name}\\b`).test(region),
      `${name} appears in landing copy outside the marked interop teaser`);
  }
  // …and the teaser itself still says it, so the reader with a drawer full of
  // .fig files knows this page is for them.
  assert.match(landingRegion(), /bring Figma, Penpot, Illustrator, InDesign or any SVG/);
});

// ── 3. the sceptic paragraph, one wording, three homes ───────────────────────

const SCEPTIC_PARAGRAPH = '**We built Lolly for ourselves.** SUSE needed thousands of on-brand files, each with its name sealed inside, made without handing anything to outside services. So we built a tool that does all of it on the device, and released it as open source, like everything else we make. We keep maintaining it because we use it every day. **There is no obligation:** everything here works with or without us.';

test('the sceptic paragraph is byte-identical in all three homes', () => {
  const homes: Array<[string, string]> = [
    ['docs/build.ts (landing block 7)', buildTs],
    ['docs/faq.md', faqMd],
    ['docs/trust.md', trustMd],
  ];
  for (const [label, src] of homes) {
    const hits = src.split(SCEPTIC_PARAGRAPH).length - 1;
    assert.equal(hits, 1, `${label} must carry the sceptic paragraph exactly once, verbatim (found ${hits})`);
  }
  // On the landing it is block 7's own paragraph, and nowhere else in the page's
  // composition - the assure band's old copy of it retired when the block landed.
  const region = landingRegion();
  assert.equal(region.split('We built Lolly for ourselves').length - 1, 1,
    'the landing composes the sceptic paragraph once, in block 7');
  assert.ok(!/assure-why-free/.test(buildTs),
    'the assure band no longer carries the why-free paragraph (it moved to block 7)');
});

// ── 4. banned words on the landing ───────────────────────────────────────────

/**
 * The rulebook list (plan 117 §1), minus the two entries no regex can judge (see
 * the header). Each entry is [label, regex]. "sovereignty" is allowed in exactly
 * one place - the hero H1 - which is why hero-chrome.json's `statement` is
 * checked separately below rather than scanned here.
 */
const BANNED_WORDS: Array<[string, RegExp]> = [
  ['deterministic', /\bdeterminis(tic|m)\b/i],
  ['reproducible',  /\breproducib(le|ility)\b/i],
  ['provenance',    /\bprovenance\b/i],
  ['sovereignty',   /\bsovereign(ty)?\b/i],
  ['permutations',  /\bpermutations?\b/i],
  ['structural',    /\bstructural(ly)?\b/i],
  ['ideate',        /\bideat(e|ion)\b/i],
  ['workflow',      /\bworkflows?\b/i],
  ['seamless',      /\bseamless(ly)?\b/i],
  ['leverage',      /\bleverag(e|ing)\b/i],
  ['export quality',/\bexport quality\b/i],
];

function banned(text: string): string[] {
  return BANNED_WORDS.filter(([, re]) => re.test(text)).map(([label]) => label);
}

test('banned words stay off the landing', () => {
  // The hero, and the copy the landing composes in build.ts (its t() literals -
  // code identifiers and comments are not copy).
  assert.deepEqual(banned(heroSection), [], 'the hero subtitle carries a banned word');
  for (const copy of tLiterals(landingRegion())) {
    assert.deepEqual(banned(copy), [], `landing copy carries a banned word: ${copy}`);
  }
  // The landing content files, minus the one deliberate exception.
  for (const name of LANDING_JSON) {
    const data = JSON.parse(read(`docs/site/${name}`));
    for (const s of jsonStrings(data)) {
      if (name === 'hero-chrome.json' && s === data.statement) continue; // the H1, see below
      assert.deepEqual(banned(s), [], `docs/site/${name} carries a banned word: ${s}`);
    }
  }
  for (const name of LANDING_SITE_MD) {
    assert.deepEqual(banned(read(`docs/site/${name}`)), [], `docs/site/${name} carries a banned word`);
  }
});

test('"Content Sovereignty" is the page\'s one esoteric term, and it is the H1', () => {
  const hero = JSON.parse(read('docs/site/hero-chrome.json'));
  assert.equal(hero.statement, 'Content Sovereignty',
    'the hero statement is FINAL copy - it is the single deliberate-curiosity claim the door makes');
});

// ── 5. block 2's worked examples ─────────────────────────────────────────────

/**
 * The three tools the landing hands a first-time reader. Pinned here because the
 * block's promise is that a click works with nothing set up and nothing sent
 * anywhere - so the set may only change with this test.
 *
 * NOTE on the plan's "∈ SW-precached" wording: there is no per-tool precache list
 * to be a member of. `shells/web/public/sw.js` serves /tools/ NETWORK-FIRST with a
 * cache fallback, and the only pinned bucket is the one a user fills themselves
 * ("available offline"). So the property that actually exists - and the one the
 * claim rests on - is ZERO EGRESS: a community tool (present on every profile)
 * that declares no capabilities and whose hooks reach no network. That is what is
 * asserted.
 */
const BLOCK2_TOOLS = ['qr-code', 'wordmark', 'filter'];

test('block 2 seeds tools that exist on every profile and touch no network', () => {
  const region = landingRegion();
  const pinned = [...region.matchAll(/tool: '([a-z0-9-]+)'/g)].map(m => m[1]!);
  assert.deepEqual(pinned, BLOCK2_TOOLS,
    'the landing example tools changed - update BLOCK2_TOOLS and re-check the properties below');

  for (const id of BLOCK2_TOOLS) {
    const dir = resolve(repoRoot, 'community', id);
    assert.ok(existsSync(dir), `${id} must be a COMMUNITY tool, so it exists on every profile`);
    const manifest = JSON.parse(readFileSync(resolve(dir, 'tool.json'), 'utf-8'));
    assert.ok(!manifest.capabilities?.length,
      `${id} declares capabilities (${JSON.stringify(manifest.capabilities)}) - block 2 needs a tool that just works`);
    for (const file of readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const src = readFileSync(resolve(dir, file), 'utf-8');
      assert.ok(!/\bfetch\s*\(|XMLHttpRequest|host\.net\b|EventSource|WebSocket/.test(src),
        `${id}/${file} reaches the network - block 2's cards must work with the Wi-Fi off`);
    }
  }
});

// ── 6. banned overclaims across the docs (the honesty glass-jaw, plan 116 §5) ─

/**
 * Absolute claims the honesty doctrine forbids anywhere in the docs, because no
 * mechanism backs them. Content Credentials are tamper-EVIDENT, not tamper-proof,
 * and they are strippable. The network claim is "nothing you make leaves unless
 * you asked", never "nothing is transmitted". Precise, true statements about a
 * specific mechanism (a signature that cannot be forged, a channel a human
 * verifies) are deliberately NOT here: a regex cannot tell those from an
 * overclaim, so this list holds only phrasings that are false in every context.
 */
const BANNED_OVERCLAIMS: Array<[string, RegExp]> = [
  ['tamper-proof', /tamper[-\s]?proof/i],
  ['nobody can pass … off', /nobody can pass\b/i],
  ['nothing is transmitted', /nothing is transmitted/i],
  ['no data ever leaves', /no data ever leaves/i],
  ['cannot be intercepted', /cannot be intercepted/i],
];

test('no banned overclaims anywhere in the docs sources', () => {
  const docsDir = resolve(repoRoot, 'docs');
  const files = readdirSync(docsDir).filter(f => f.endsWith('.md')).map(f => `docs/${f}`);
  files.push('README.md');
  const failures: string[] = [];
  for (const rel of files) {
    read(rel).split('\n').forEach((line, i) => {
      for (const [label, re] of BANNED_OVERCLAIMS) {
        if (re.test(line)) failures.push(`${rel}:${i + 1} overclaims "${label}": ${line.trim().slice(0, 80)}`);
      }
    });
  }
  // The landing copy composed in build.ts (its t() literals) too.
  for (const copy of tLiterals(landingRegion())) {
    for (const [label, re] of BANNED_OVERCLAIMS) {
      if (re.test(copy)) failures.push(`docs/build.ts landing overclaims "${label}": ${copy}`);
    }
  }
  assert.deepEqual(failures, [], 'a banned overclaim reached the docs - Content Credentials are tamper-EVIDENT and strippable, and the network claim is consent-gated, never absolute');
});

// ── 7. the consent ledger agrees with the CSP allowlist (plan 116 §5) ─────────

/**
 * The privacy.md network table is the consent ledger. Its fixed hosts must equal
 * the app's Content-Security-Policy connect-src / media-src allowlist exactly. A
 * host in one but not the other means the ledger drifted from the code, and the
 * ledger is a claim readers rely on. The two
 * user-chosen crossings - a URL you capture and a remote instance you name - have
 * no fixed host, so they appear in neither set. The CSP is pinned identical in
 * three files by tests/security-headers.test.ts; this reads the canonical nginx
 * copy, and only its connect-src / media-src lines, so an unrelated URL in a
 * comment cannot leak in.
 */
function cspHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const line of read('deploy/docker/nginx.conf').split('\n')) {
    if (!/connect-src|media-src/.test(line)) continue;
    for (const m of line.matchAll(/https:\/\/([a-z0-9.*-]+)/gi)) hosts.add(m[1]!.toLowerCase());
  }
  return hosts;
}

function ledgerHosts(): Set<string> {
  const privacy = read('docs/privacy.md');
  const start = privacy.indexOf('| What | What actually leaves your device');
  assert.ok(start > 0, 'privacy.md must carry the consent-ledger table');
  const rest = privacy.slice(start);
  const end = rest.indexOf('\n\n');
  const table = end > 0 ? rest.slice(0, end) : rest;
  const hosts = new Set<string>();
  for (const m of table.matchAll(/`([a-z0-9*-]+(?:\.[a-z0-9*-]+)+)`/gi)) {
    const tok = m[1]!.toLowerCase();
    if (/\.(com|org|net|tools|io|dev)$/.test(tok)) hosts.add(tok); // a host, not `.icc`
  }
  return hosts;
}

test('the consent ledger and the CSP allowlist name the same fixed hosts', () => {
  const ledger = ledgerHosts();
  const csp = cspHosts();
  const onlyLedger = [...ledger].filter(h => !csp.has(h)).sort();
  const onlyCsp = [...csp].filter(h => !ledger.has(h)).sort();
  assert.deepEqual(onlyLedger, [], `the consent ledger names a host the CSP does not allow: ${onlyLedger.join(', ')}`);
  assert.deepEqual(onlyCsp, [], `the CSP allows a host the consent ledger does not disclose: ${onlyCsp.join(', ')}`);
  assert.ok(ledger.size >= 6, `the ledger should list the fixed optional hosts (found ${ledger.size})`);
});
