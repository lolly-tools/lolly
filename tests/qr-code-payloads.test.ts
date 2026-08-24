// SPDX-License-Identifier: MPL-2.0
/**
 * QR Code Generator (community/qr-code) - payload-type contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine, then reads the `qrPayload` extra - the exact string the
 * encoder was handed. A QR code is only as good as its payload: a scanner
 * either recognises the wire format or it shows the user a wall of text, and
 * nothing about the rendered modules reveals which happened. So these pin the
 * bytes per kind, including the escaping rules the formats mandate.
 *
 * The url payload is the tool's original behaviour and is composed by other
 * tools (event-name-badge passes `url`), so one case checks the default render
 * is untouched by the new inputs existing.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/qr-code-payloads.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// qr-code ships in the PUBLIC community pack. Load from the SOURCE pack, not the
// gitignored tools/ profile view, so the suite is profile-independent: skip only
// when community/ isn't checked out (a clone without submodules); with it
// present, a missing tool dir means a rename/delete and must FAIL loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'qr-code', 'tool.json')),
    'community/qr-code/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('qr-code', fetchFile);

const CRLF = '\r\n';

/** Mount the tool with these input values and read what it encoded. */
async function mount(values: Record<string, any>) {
  const rt = await createRuntime(tool, baseHost(), values);
  return {
    rt,
    // getHydratedText skips HTML escaping, so a payload's own quotes and
    // ampersands come back as the encoder saw them.
    payload: rt.getHydratedText('{{qrPayload}}'),
    kind: rt.getHydratedText('{{qrKind}}'),
    error: rt.getHydratedText('{{qrError}}'),
    // The canvas's accessible summary, hydrated from the same extras.
    label: rt.getHydratedText(tool.manifest.a11yLabel).trim(),
    hookErrors: rt.hookErrors,
    svg: rt.getHydrated() as string,
  };
}

test('url: the default payload is unchanged by the new inputs existing', { skip: SKIP }, async () => {
  const plain = await mount({ url: 'https://lolly.tools/gallery' });
  // Same url, every other payload kind's fields filled in - none of it may reach
  // the encoder while payload is 'url'.
  const loaded = await mount({
    url: 'https://lolly.tools/gallery',
    payload: 'url',
    text: 'ignore me',
    firstname: 'Ana',
    lastname: 'Kovac',
    ssid: 'Studio Guest',
    wifiKey: 'welcome-2026',
    eventName: 'Open Studio',
    lat: 12.5,
    lng: -3.25,
  });

  // Opening the tool with nothing set still encodes the manifest's default URL:
  // the new `payload` select defaults to the kind the tool always had.
  const bare = await mount({});
  assert.equal(bare.kind, 'url');
  assert.equal(bare.payload, 'https://lolly.tools');
  assert.equal(bare.error, '');

  assert.equal(plain.kind, 'url');
  assert.equal(plain.payload, 'https://lolly.tools/gallery');
  assert.equal(loaded.payload, plain.payload);
  assert.equal(loaded.svg, plain.svg, 'a url QR must render byte-identically regardless of the other payload fields');
  assert.equal(plain.error, '');
});

test('text: the payload is the text, trimmed', { skip: SKIP }, async () => {
  const { payload, kind, error } = await mount({ payload: 'text', text: '  Kiln 3 fires Tuesday at 7am.  ' });
  assert.equal(kind, 'text');
  assert.equal(payload, 'Kiln 3 fires Tuesday at 7am.');
  assert.equal(error, '');
});

test('vcard: vCard 3.0 with CRLF lines and RFC 6350 escaping', { skip: SKIP }, async () => {
  const { payload } = await mount({
    payload: 'vcard',
    firstname: 'Ana',
    lastname: 'Kovac',
    company: 'North\\wind',          // a literal backslash in the value
    jobTitle: 'Head, Design; Ops',   // comma and semicolon
    phone: '+61 400 000 000',
    email: 'ana@example.com',
    url: 'https://example.com/ana',
  });

  assert.equal(payload, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Kovac;Ana;;;',
    'FN:Ana Kovac',
    'ORG:North\\\\wind',
    'TITLE:Head\\, Design\\; Ops',
    'TEL;TYPE=CELL:+61 400 000 000',
    'EMAIL:ana@example.com',
    'URL:https://example.com/ana',
    'END:VCARD',
  ].join(CRLF));

  // N's own component separators stay unescaped; only the values are escaped.
  assert.ok(payload.includes(CRLF + 'N:Kovac;Ana;;;' + CRLF));
});

test('vcard: an empty field emits no line at all', { skip: SKIP }, async () => {
  const { payload } = await mount({
    payload: 'vcard',
    firstname: 'Ana',
    lastname: '',
    email: 'ana@example.com',
    url: '',
  });

  assert.equal(payload, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;Ana;;;',
    'FN:Ana',
    'EMAIL:ana@example.com',
    'END:VCARD',
  ].join(CRLF));
  for (const tag of ['ORG:', 'TITLE:', 'TEL', 'URL:']) {
    assert.ok(!payload.includes(tag), `expected no ${tag} line, got:\n${payload}`);
  }
});

test('vcard: no name means nothing to save, so the code shows the hint', { skip: SKIP }, async () => {
  const { payload, error, svg } = await mount({ payload: 'vcard', company: 'Northwind', url: '' });
  assert.equal(payload, '');
  assert.match(error, /name/i);
  assert.ok(svg.includes('QR code unavailable'));
});

test('vcard: a full card renders even at the highest error correction', { skip: SKIP }, async () => {
  // This used to pin a ~195-byte ceiling at ecl H (and is why the vcard
  // template's "Business card" preset sits at Q). That ceiling was never the
  // spec's: the originally vendored RS block table had a truncated v15-H row and
  // a 16-row duplication, so high versions refused or mis-laid-out content.
  // v2.3.0 repaired the table from canonical qrcode-generator data - a full
  // card at H is well within version 15's real 220-byte capacity.
  const { payload, error, svg } = await mount({
    payload: 'vcard',
    firstname: 'Ana',
    lastname: 'Kovac',
    company: 'Northwind Studio',
    jobTitle: 'Creative Director',
    phone: '+61 400 000 000',
    email: 'ana@example.com',
    url: 'https://example.com/ana',
    ecl: 'H',
  });
  assert.ok(payload.length > 190, `expected a long card, got ${payload.length} bytes`);
  assert.equal(error, '');
  assert.ok(svg.includes('<svg'));
  assert.ok(!svg.includes('QR code unavailable'));
});

test('content past the real version-40 capacity still reports the ceiling', { skip: SKIP }, async () => {
  // The genuine spec limit at ecl H is 1273 bytes (version 40). Past it, the
  // tool must say so rather than render a placeholder no one can explain.
  const { error, svg } = await mount({ payload: 'text', text: 'x'.repeat(1400), ecl: 'H' });
  assert.match(error, /too long/i);
  assert.ok(svg.includes('QR code unavailable'));
});

test('wifi: WIFI: URI with its own separators escaped inside values', { skip: SKIP }, async () => {
  const { payload, kind } = await mount({
    payload: 'wifi',
    ssid: 'Guest;Net, 5G',
    wifiKey: 'welcome-2026',
    wifiSecurity: 'WPA',
  });
  assert.equal(kind, 'wifi');
  assert.equal(payload, 'WIFI:T:WPA;S:Guest\\;Net\\, 5G;P:welcome-2026;;');
});

test('wifi: an open network carries no password, a hidden one carries H', { skip: SKIP }, async () => {
  const open = await mount({ payload: 'wifi', ssid: 'Cafe', wifiKey: 'typed-then-abandoned', wifiSecurity: 'nopass' });
  assert.equal(open.payload, 'WIFI:T:nopass;S:Cafe;;');

  const hidden = await mount({ payload: 'wifi', ssid: 'Back Room', wifiKey: 'hunter2', wifiHidden: true });
  assert.equal(hidden.payload, 'WIFI:T:WPA;S:Back Room;P:hunter2;H:true;;');

  const shown = await mount({ payload: 'wifi', ssid: 'Back Room', wifiKey: 'hunter2', wifiHidden: false });
  assert.equal(shown.payload, 'WIFI:T:WPA;S:Back Room;P:hunter2;;');
});

test('wifi: an empty network name renders the hint, not a blank code', { skip: SKIP }, async () => {
  const { payload, error, svg } = await mount({ payload: 'wifi', wifiKey: 'welcome-2026' });
  assert.equal(payload, '');
  assert.notEqual(error, '');
  assert.match(error, /network name/i);
  assert.ok(svg.includes('QR code unavailable'));
});

test('event: a VEVENT with local iCal stamps and escaped text', { skip: SKIP }, async () => {
  const { payload, kind } = await mount({
    payload: 'event',
    eventName: 'Open Studio',
    eventStart: '2026-09-15T18:00',
    eventEnd: '2026-09-15T20:30',
    eventLocation: 'Rundle St; Adelaide',
    eventDetails: 'Doors at six.\nTalks at seven.',
  });
  assert.equal(kind, 'event');
  // PRODID and VERSION are both mandatory in a VCALENDAR (RFC 5545 3.6), and a
  // calendar app is entitled to reject one that omits them.
  assert.equal(payload, [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lolly//QR//EN',
    'BEGIN:VEVENT',
    'SUMMARY:Open Studio',
    'DTSTART:20260915T180000',
    'DTEND:20260915T203000',
    'LOCATION:Rundle St\\; Adelaide',
    'DESCRIPTION:Doors at six.\\nTalks at seven.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join(CRLF));
});

test('event: an unset end time emits no DTEND, an unset name shows the hint', { skip: SKIP }, async () => {
  const open = await mount({ payload: 'event', eventName: 'Kiln firing', eventStart: '2026-09-15T07:00' });
  assert.ok(!open.payload.includes('DTEND'), open.payload);
  assert.ok(!open.payload.includes('LOCATION'), open.payload);
  assert.ok(open.payload.includes('DTSTART:20260915T070000'));

  const nameless = await mount({ payload: 'event', eventStart: '2026-09-15T07:00' });
  assert.equal(nameless.payload, '');
  assert.match(nameless.error, /event name/i);
  assert.ok(nameless.svg.includes('QR code unavailable'));
});

test('event: with no start time there is nothing to put in a calendar', { skip: SKIP }, async () => {
  // DTSTART is mandatory. Emitting a VEVENT without one produces a code that
  // scans and then fails to import, which is worse than no code at all.
  const { payload, error, svg } = await mount({ payload: 'event', eventName: 'Open Studio' });
  assert.equal(payload, '');
  assert.match(error, /start time/i);
  assert.ok(svg.includes('QR code unavailable'));
});

test('geo: a bare geo URI, negative coordinates included', { skip: SKIP }, async () => {
  const { payload, kind, error } = await mount({ payload: 'geo', lat: -34.928, lng: 138.6 });
  assert.equal(kind, 'geo');
  assert.equal(payload, 'geo:-34.928,138.6');
  assert.equal(error, '');

  // The default 0,0 is still a valid pin, so it never falls back to the hint.
  const nullIsland = await mount({ payload: 'geo' });
  assert.equal(nullIsland.payload, 'geo:0,0');
  assert.equal(nullIsland.error, '');
});

test('geo: a coordinate that is not a real place refuses to encode', { skip: SKIP }, async () => {
  // A number input carries whatever the transport handed it: `?lat=abc` coerces
  // to NaN (engine/src/url-mode.ts), and a batch column can hand over a string.
  // Rounding that down to 0 would print a valid pin in the wrong hemisphere.
  for (const values of [
    { lat: 'somewhere' },
    { lat: Number.NaN, lng: 12 },
    { lat: 91 },
    { lng: -181 },
  ]) {
    const got = await mount({ payload: 'geo', lat: 0, lng: 0, ...values });
    assert.equal(got.payload, '', `expected no payload for ${JSON.stringify(values)}`);
    assert.match(got.error, /latitude/i);
    assert.ok(got.svg.includes('QR code unavailable'));
    assert.ok(!got.svg.includes('NaN'), 'NaN must never reach the rendered code');
  }
});

test('the accessible label says something for every kind, working or not', { skip: SKIP }, async () => {
  // manifest.a11yLabel is "QR code holding {{default qrSummary ...}}", and the
  // `default` helper only fires on null/undefined - an empty summary would leave
  // a screen reader with a sentence that stops mid-air.
  const cases = [
    [{ url: 'https://lolly.tools' }, /lolly\.tools/],
    [{ payload: 'text', text: 'Kiln 3 fires Tuesday' }, /Kiln 3/],
    [{ payload: 'vcard', firstname: 'Ana', lastname: 'Kovac' }, /Ana Kovac/],
    [{ payload: 'wifi', ssid: 'Studio Guest' }, /Studio Guest/],
    [{ payload: 'event', eventName: 'Open Studio', eventStart: '2026-09-15T18:00' }, /Open Studio/],
    [{ payload: 'geo', lat: -34.928, lng: 138.6 }, /-34\.928/],
    [{ payload: 'wifi' }, /nothing yet/],            // nothing filled in
    [{ payload: 'geo', lat: 'junk' }, /nothing yet/], // refused coordinate
  ] as const;

  for (const [values, expected] of cases) {
    const { label } = await mount(values as Record<string, any>);
    assert.match(label, expected);
    assert.doesNotMatch(label, /holding\s*$/, `label trails off: "${label}"`);
  }
});

test('every template seed and preset overlay hydrates into a real code', { skip: SKIP }, async () => {
  const dir = join(COMMUNITY, 'qr-code', 'templates');
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 5, 'the payload templates should be on disk');

  const names = new Map<string, string>();
  for (const file of files) {
    const t = JSON.parse(await readFile(join(dir, file), 'utf8'));
    assert.equal(t.id, file.replace(/\.json$/, ''), `${file}: id must equal the basename`);
    // Two tiles with one name in the chooser is a coin toss for the user.
    assert.ok(!names.has(t.name), `${file}: template name "${t.name}" is already used by ${names.get(t.name)}`);
    names.set(t.name, file);

    const seeds: Array<[string, Record<string, any>]> = [[t.id, t.values]];
    for (const p of t.presets ?? []) seeds.push([`${t.id}/${p.id}`, { ...t.values, ...p.values }]);

    for (const [label, values] of seeds) {
      const got = await mount(values);
      assert.deepEqual(got.hookErrors, [], `${label}: hooks errored`);
      assert.equal(got.error, '', `${label}: ${got.error}`);
      assert.ok(got.payload.length > 0, `${label}: encoded nothing`);
      assert.ok(got.svg.includes('<svg'), `${label}: no SVG`);
      assert.ok(!got.svg.includes('QR code unavailable'), `${label}: rendered the placeholder`);
    }
  }
});

test('every example hydrates into a real code', { skip: SKIP }, async () => {
  for (const ex of tool.manifest.examples ?? []) {
    const got = await mount(ex.values);
    assert.deepEqual(got.hookErrors, [], `${ex.label}: hooks errored`);
    assert.equal(got.error, '', `${ex.label}: ${got.error}`);
    assert.ok(got.svg.includes('<svg'), `${ex.label}: no SVG`);
  }
});

test('the memo key covers the new inputs, so every kind field re-renders', { skip: SKIP }, async () => {
  // compute() caches on JSON.stringify(args). A per-input key list would have to
  // be extended for each payload kind; this pins that a field the old tool never
  // had still busts the cache.
  const { rt, payload } = await mount({ payload: 'wifi', ssid: 'Studio Guest', wifiKey: 'welcome-2026' });
  assert.equal(payload, 'WIFI:T:WPA;S:Studio Guest;P:welcome-2026;;');

  await rt.setInput('ssid', 'Back Room');
  assert.equal(rt.getHydratedText('{{qrPayload}}'), 'WIFI:T:WPA;S:Back Room;P:welcome-2026;;');

  await rt.setInput('payload', 'text');
  assert.equal(rt.getHydratedText('{{qrKind}}'), 'text');
  await rt.setInput('text', 'Kiln 3 fires Tuesday');
  assert.equal(rt.getHydratedText('{{qrPayload}}'), 'Kiln 3 fires Tuesday');
});
