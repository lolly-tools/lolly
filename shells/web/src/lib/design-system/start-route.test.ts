// SPDX-License-Identifier: MPL-2.0
/**
 * start-route.ts - the #/start deep-link table.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/start-route.test.ts"
 *
 * The back-compatibility half is the point: every `?tab=` link ever generated
 * (the dashboard's "Manage fonts", the docs, bookmarks) must keep opening the
 * room it named, and `?import=0` must keep meaning "leave it shut". Those are
 * promises to links that already exist, so they are pinned case by case rather
 * than left to the structure of the implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStartRoute, isStartArea, START_AREAS, START_ROOMS, DEFAULT_AREA, START_SOURCES } from './start-route.ts';

test('nothing asked for lands on Overview with nothing open', () => {
  const r = resolveStartRoute('');
  assert.equal(r.area, 'overview');
  assert.equal(r.wheel, false);
  assert.equal(r.importOpen, false);
  assert.equal(DEFAULT_AREA, 'overview');
});

test('every room is addressable by ?area=', () => {
  for (const area of START_AREAS) {
    assert.equal(resolveStartRoute(`area=${area}`).area, area, `?area=${area}`);
  }
});

test('LEGACY: ?tab= opens the same rooms', () => {
  for (const area of START_AREAS) {
    assert.equal(resolveStartRoute(`tab=${area}`).area, area, `?tab=${area}`);
  }
});

test('LEGACY: #/start?tab=type - the dashboard "Manage fonts" link', () => {
  assert.deepEqual(resolveStartRoute('tab=type'), { area: 'type', wheel: false, importOpen: false, focus: null, source: null, seed: null, group: null });
});

test('LEGACY: #/start?tab=color&wheel opens the colour room with the chart flag', () => {
  assert.deepEqual(resolveStartRoute('tab=color&wheel'), { area: 'color', wheel: true, importOpen: false, focus: null, source: null, seed: null, group: null });
});

test('LEGACY: ?wheel is presence, not value - ?wheel=0 has always meant open', () => {
  assert.equal(resolveStartRoute('area=color&wheel=0').wheel, true);
  assert.equal(resolveStartRoute('area=color').wheel, false);
});

test('LEGACY: #/start?import opens the source modal, ?import=0 leaves it shut', () => {
  assert.equal(resolveStartRoute('import').importOpen, true);
  assert.equal(resolveStartRoute('import=1').importOpen, true);
  assert.equal(resolveStartRoute('import=').importOpen, true);
  assert.equal(resolveStartRoute('import=0').importOpen, false);
});

test('?import carries its own area - it does not force one', () => {
  assert.equal(resolveStartRoute('import').area, 'overview');
  assert.equal(resolveStartRoute('area=logos&import').area, 'logos');
});

test('?area= wins over ?tab= when both are given and both resolve', () => {
  assert.equal(resolveStartRoute('area=type&tab=color').area, 'type');
});

test('an unrecognised ?area= falls through to ?tab= rather than dead-ending', () => {
  assert.equal(resolveStartRoute('area=typo&tab=type').area, 'type');
});

test('an unrecognised room name resolves to Overview', () => {
  assert.equal(resolveStartRoute('area=nope').area, 'overview');
  assert.equal(resolveStartRoute('tab=nope').area, 'overview');
  assert.equal(resolveStartRoute('area=nope&tab=alsonope').area, 'overview');
});

test('room names are exact - a cased or padded value is not a room', () => {
  assert.equal(resolveStartRoute('area=COLOR').area, 'overview');
  assert.equal(resolveStartRoute('area=%20color').area, 'overview');
});

test('an inherited object key is never mistaken for a room', () => {
  for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(resolveStartRoute(`area=${key}`).area, 'overview', `?area=${key}`);
    assert.equal(isStartArea(key), false, key);
  }
});

test('a leading ? is tolerated (a caller passing the raw search string)', () => {
  assert.deepEqual(resolveStartRoute('?area=color&wheel'), { area: 'color', wheel: true, importOpen: false, focus: null, source: null, seed: null, group: null });
});

test('unknown params are ignored, not fatal', () => {
  assert.deepEqual(
    resolveStartRoute('area=tokens&utm_source=x&swatch=jungle-500'),
    { area: 'tokens', wheel: false, importOpen: false, focus: null, source: null, seed: null, group: null },
  );
});

test('isStartArea guards null and empty', () => {
  assert.equal(isStartArea(null), false);
  assert.equal(isStartArea(undefined), false);
  assert.equal(isStartArea(''), false);
  assert.equal(isStartArea('overview'), true);
});

test('?focus= opens a named wing of the colour room (plan 97 SS5)', () => {
  for (const f of ['generate', 'curves', 'contrast', 'print', 'chart']) {
    assert.equal(resolveStartRoute(`area=color&focus=${f}`).focus, f, `?focus=${f}`);
  }
});

// The Overview's empty-state doors (plan 182 section 3a). Not wings: they open
// the control that makes the FIRST decision in each room, and a link carries the
// same pair the door does.
test('?focus=pick and ?focus=stage carry the first decisions', () => {
  assert.equal(resolveStartRoute('area=color&focus=pick').focus, 'pick');
  assert.equal(resolveStartRoute('area=type&focus=stage').focus, 'stage');
  // Resolution is not routing: the word survives whichever room it arrives with,
  // and the view decides what (if anything) it opens there.
  assert.equal(resolveStartRoute('area=logos&focus=pick').area, 'logos');
});

test('an unrecognised ?focus= is null, never a passthrough', () => {
  assert.equal(resolveStartRoute('area=color&focus=nope').focus, null);
  assert.equal(resolveStartRoute('area=color&focus=CURVES').focus, null);
  assert.equal(resolveStartRoute('area=color').focus, null);
  for (const key of ['constructor', '__proto__', 'toString']) {
    assert.equal(resolveStartRoute(`area=color&focus=${key}`).focus, null, `?focus=${key}`);
  }
});

test('?source= names the source the picker opens on, and implies the picker (plan 97 SS8)', () => {
  for (const src of ['file', 'image', 'font']) {
    const r = resolveStartRoute(`source=${src}`);
    assert.equal(r.source, src, `?source=${src}`);
    assert.equal(r.importOpen, true, `?source=${src} opens the picker`);
  }
});

test('?source=pdf and ?source=url resolve now and open the plain picker (M5/M6 give them tiles)', () => {
  for (const src of ['pdf', 'url']) {
    const r = resolveStartRoute(`source=${src}`);
    assert.equal(r.source, src, `?source=${src}`);
    assert.equal(r.importOpen, true, `?source=${src}`);
  }
  // Every declared source resolves - the table and the constant cannot drift.
  for (const src of START_SOURCES) assert.equal(resolveStartRoute(`source=${src}`).source, src, src);
});

test('an unknown ?source= is null and opens NOTHING - it falls through like an unknown ?area=', () => {
  const r = resolveStartRoute('source=zzz');
  assert.equal(r.source, null);
  assert.equal(r.importOpen, false);
  assert.equal(resolveStartRoute('source=FILE').source, null); // exact, never cased
  assert.equal(resolveStartRoute('source=%20file').source, null);
  for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(resolveStartRoute(`source=${key}`).source, null, `?source=${key}`);
    assert.equal(resolveStartRoute(`source=${key}`).importOpen, false, `?source=${key}`);
  }
});

test('LEGACY: ?import=0 still wins over a named source', () => {
  const r = resolveStartRoute('import=0&source=file');
  assert.equal(r.importOpen, false);
  assert.equal(r.source, 'file'); // resolved, just not opened - the view reads both
});

test('?import alone opens the picker with no source named', () => {
  const r = resolveStartRoute('import');
  assert.equal(r.importOpen, true);
  assert.equal(r.source, null);
});

test('?source rides a room param and does not move the room', () => {
  const r = resolveStartRoute('area=logos&source=image');
  assert.equal(r.area, 'logos');
  assert.equal(r.source, 'image');
  assert.equal(r.importOpen, true);
});

test('#/start?area=versions opens the Versions panel (plan 97 SS5 / SS6a)', () => {
  assert.deepEqual(
    resolveStartRoute('area=versions'),
    { area: 'versions', wheel: false, importOpen: false, focus: null, source: null, seed: null, group: null },
  );
  // The kept alias reaches it too: one resolution table, no second rule.
  assert.equal(resolveStartRoute('tab=versions').area, 'versions');
  assert.equal(isStartArea('versions'), true);
});

test('the rail rooms are the areas minus the foot-pinned panels', () => {
  // START_ROOMS is what the sidebar renders; START_AREAS is what a link may ask
  // for. Every room is an area, and `versions` is the one area that is not a
  // room - if either half drifts, this says which way.
  for (const room of START_ROOMS) assert.ok((START_AREAS as readonly string[]).includes(room), room);
  assert.deepEqual(
    (START_AREAS as readonly string[]).filter(a => !(START_ROOMS as readonly string[]).includes(a)),
    ['versions'],
  );
});

test('?focus rides any room param form and coexists with ?wheel', () => {
  assert.equal(resolveStartRoute('tab=color&focus=generate').focus, 'generate');
  const both = resolveStartRoute('area=color&wheel&focus=curves');
  assert.equal(both.wheel, true);
  assert.equal(both.focus, 'curves');
});

test('the Versions entry is a LATCH, so ?area=versions is not a one-way door', async () => {
  // Not a route fact, but the other half of the same promise: the panel's own
  // empty state says "add colours first, then come back", and selectRoom
  // replaceStates the URL, so Back cannot recover it either. Hiding the entry the
  // moment another room opens leaves retyping the link as the only way home.
  //
  // A source guard rather than a mount: views/start.ts has no DOM test yet (plan
  // 97 section 16 lists one as still owed) and standing the whole studio up for three
  // lines of state would be the wrong trade. Replace this the day that test lands.
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../views/start.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('const syncVersionsEntry'), src.indexOf('let openVersions'));
  assert.match(fn, /activeArea === 'versions'\)\s*versionsOffered = true/,
    'arriving at the panel has to latch the entry on');
  assert.match(fn, /versionsBtn\.hidden = !versionsOffered/,
    'and visibility reads the latch alone, not the current area');
  // The late answer used to be hasPublishableSystem's, which is also true for a
  // system that merely EXISTS - one colour into a blank brand was enough, which
  // is what plans/137 B2 took off the first-run face. It is the published-version
  // index now; the ||= is the part that matters here either way.
  assert.match(src, /versionsOffered \|\|= index\.versions\.length > 0/,
    'the late index answer must not take a deep-linked entry away again');
});

test('B2: only a PUBLISHED version puts Versions in the rail, and the first publish stays reachable', async () => {
  // Same source-guard trade as the latch test above, for the same reason.
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../views/start.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /hasPublishableSystem\(/,
    'a system that merely exists is not a published version - the rail entry must not read that');
  assert.match(src, /readIndex\(versionsCtx\)/,
    'the rail entry reads the published-version ledger');
  // Removing the rail entry would strand a furnished system with no way to make
  // its FIRST version, so the quiet export-group entry is the other half of B2
  // and is gated on exactly those two facts.
  assert.match(src, /versionsLink\.hidden = versionsOffered \|\| !worthExporting/,
    'the quiet entry shows for a system worth exporting that has never published, and only then');
  assert.match(src, /data-ds-versions-link/, 'and it is rendered in the rail foot');
});

test('B1: the export actions wait for the system to hold something', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../views/start.ts', import.meta.url), 'utf8');
  // The Overview room's own predicate, not a second copy of it: readOverview
  // answers false for a missing tokens asset and for the starter placeholder,
  // and the string 'lolly/tokens/brand' must never be spelled out here.
  assert.match(src, /readOverview\(/, 'furnished is the Overview room’s answer');
  assert.ok(!src.includes('lolly/tokens/brand'),
    'the starter id stays in rooms/overview.ts - two copies would drift');
  // Both exports start hidden and are revealed by the one query.
  assert.match(src, /data-start-export data-start-furnished[^>]*hidden>/,
    'the pack export waits for furnish');
  assert.match(src, /data-start-export-tokens data-start-furnished hidden>/,
    'and so does the plain tokens document');
  assert.match(src, /querySelectorAll<HTMLElement>\('\[data-start-furnished\]'\)/,
    'one query reveals them, so a third action needs no new wiring');
  // The bar itself (plans/163 F4): `furnished` is already true one colour in, so
  // it is the room's harder answer that these three wait for.
  assert.match(src, /if \(!model\.worthExporting\) return;/,
    'the export actions wait for a system worth exporting, not merely one that exists');
  assert.match(src, /if \(model\.furnished && importBtn\) importBtn\.hidden = false;/,
    'and the "Add from…" hero waits for the Overview room’s own doors to go (F2)');
  // Called from the two paths the studio already refreshes on, so furnishing
  // mid-session does not need a reload: every room change, and every committed
  // edit (before onChange's hidden-Overview early return).
  const selectRoom = src.slice(src.indexOf('const selectRoom ='), src.indexOf('railEl.addEventListener'));
  assert.match(selectRoom, /refreshFurnished\(\);/,
    'selectRoom re-reads, which is also the install path (install() ends in selectRoom)');
  const onChange = src.slice(src.indexOf('onChange: () => {'), src.indexOf('overview?.refresh();'));
  assert.match(onChange, /refreshFurnished\(\);[\s\S]*if \(overviewPanel\.hidden\) return;/,
    'a commit made in another room still reveals the actions');
});

test('B3: the source picker has a visible way out, and its file tile says it in plain words', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../views/start.ts', import.meta.url), 'utf8');
  assert.match(src, /class="start-import-close" data-ds-src-close/,
    'the dialog carries a close control, not just Escape and a backdrop tap');
  assert.match(src, /\[data-ds-src-close\]'\)\) \{[\s\S]{0,80}closeImport\(\)/,
    'and the delegate the picker already has routes it');
  assert.match(src, /t\('A \.lolly file, tokens JSON, a Penpot project or an SVG\.'\)/,
    'the file tile leads with the preferred .lolly format in plain words');
  assert.ok(!src.includes('DTCG or Tokens Studio JSON, a Penpot project'),
    'the format-jargon note is gone from the tile');
});

test('Profile file entry opens the file stage and its controls survive modal reparenting', async () => {
  const { readFile } = await import('node:fs/promises');
  const [start, card] = await Promise.all([
    readFile(new URL('../../views/start.ts', import.meta.url), 'utf8'),
    readFile(new URL('./design-systems-card.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(card, /#\/start\?source=file&rename=1/,
    'Profile hands a file request directly to the file stage, where .lolly is visible');
  assert.match(start, /const importFile = importPanel\.querySelector<[^>]+>\('\.start-import-file'\)!/,
    'the file input is found from the stable panel after the dialog reparents it');
  assert.match(start, /const dropEl = importPanel\.querySelector<[^>]+>\('\[data-start-import-drop\]'\)!/,
    'the drop target is found from the same stable panel');
  assert.doesNotMatch(start, /viewEl\.querySelector<[^>]+>\('\.start-import-file'\)!/,
    'a routed-open dialog must not make the view-root lookup null again');
});

test('B4: one Home in the studio - the FAB stands down when the pill already is one', async () => {
  // The pill's own attribute is the signal, in the exact form back-pill.ts writes
  // it, so the studio never re-derives (and never disagrees with) the rule. If
  // that emission changes shape, this fails here rather than quietly leaving two
  // house glyphs in the back row.
  const { readFile } = await import('node:fs/promises');
  const pill = await readFile(new URL('../../components/back-pill.ts', import.meta.url), 'utf8');
  const src = await readFile(new URL('../../views/start.ts', import.meta.url), 'utf8');
  assert.match(pill, /' data-back-home'/, 'the attribute is emitted with a leading space');
  assert.match(pill, /data-back-pill="\$\{mode\}"\$\{atHome\}>/, 'and immediately before the tag close');
  assert.match(src, /backPill\.includes\(' data-back-home>'\)/,
    'which is the form the studio asks for');
  assert.match(src, /const homeFab = pillIsHome \? '' : homeFabHtml\(\)/,
    'and both render sites take the same one value');
});

test('?seed carries a hex colour into the generate wing, and only a hex (audit 167 F-A12)', () => {
  // The added-chip's "Generate your palette from this colour" mints this link -
  // the seed must survive the route resolve so the generator opens primed with
  // THE colour, not the starter primary.
  const r = resolveStartRoute('area=color&focus=generate&seed=%23E8503A');
  assert.equal(r.area, 'color');
  assert.equal(r.focus, 'generate');
  assert.equal(r.seed, '#E8503A');
  // 8-digit hex (alpha) resolves too; anything unparseable degrades to null
  // silently rather than handing the generator a value it would misread.
  assert.equal(resolveStartRoute('seed=%23E8503A80').seed, '#E8503A80');
  assert.equal(resolveStartRoute('seed=coral').seed, null);
  assert.equal(resolveStartRoute('seed=oklch(70%25 .15 157)').seed, null);
  assert.equal(resolveStartRoute('area=color').seed, null);
});

test('?group names one inherited colour group to reveal, and refuses anything else', () => {
  // The Tokens room's "Open" beside the starter neutrals is the only minter,
  // and this is the one link that draws a starter tile at all (plan 182 section 12).
  assert.equal(resolveStartRoute('area=color&group=neutral').group, 'neutral');
  assert.equal(resolveStartRoute('area=color&group=Neutral%20%C2%B7%20Light').group, 'Neutral · Light');
  assert.equal(resolveStartRoute('area=color').group, null);
  assert.equal(resolveStartRoute('area=color&group=').group, null);
  // A group HEADING, not a selector or a path - anything that could be read as
  // markup, a query or a traversal is simply not one.
  assert.equal(resolveStartRoute('area=color&group=%3Cscript%3E').group, null);
  assert.equal(resolveStartRoute('area=color&group=..%2F..%2Fetc').group, null);
  assert.equal(resolveStartRoute(`area=color&group=${'n'.repeat(61)}`).group, null);
});
