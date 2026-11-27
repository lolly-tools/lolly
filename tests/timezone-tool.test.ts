// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parseDelimited } from '../engine/src/batch.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const root = join(import.meta.dirname, '../community');
const tool = await loadTool('timezone', (p) => readFile(join(root, p), 'utf8'));
const base = {
  timeMode: 'fixed',
  eventTime: '2026-03-29T10:00',
  referenceZone: 'Europe/London',
  renderer: 'vector',
};
async function run(values: Record<string, unknown> = {}, host = baseHost()) {
  const runtime = await createRuntime(tool, host, { ...base, ...values });
  const data = JSON.parse(runtime.getHydratedText('{{{_data.json}}}'));
  return { runtime, data, svg: runtime.getHydratedString('{{{_artwork}}}') };
}
describe('Timezone tool', () => {
  it('marks early, late and night hours only when asked, in colour and in words', async () => {
    // 07:00 in London: 08:00 in Nuremberg, 23:00 the day before in San Francisco,
    // 17:00 in Noosa.
    const rows = { locations: [{ place: 'London, GB' }, { place: 'Nuremberg, DE' }, { place: 'San Francisco, US' }, { place: 'Noosa, AU' }], eventTime: '2026-06-10T07:00' };
    const plain = await run(rows);
    assert.deepEqual(plain.data.locations.map((p: any) => p.hourQuality), ['edge', 'ok', 'night', 'ok']);
    assert.doesNotMatch(plain.svg, /#f59e0b|#ef4444|· early|· night/, 'nothing is marked unless the document asks');
    const marked = await run({ ...rows, showHourQuality: true });
    assert.match(marked.svg, /#f59e0b/, 'the early hour is amber');
    assert.match(marked.svg, /#ef4444/, 'the night hour is red');
    assert.match(marked.svg, /· early/);
    assert.match(marked.svg, /· night/);
  });
  it('reads a bare name as the large city of that name, and still asks when two are close', async () => {
    const { data } = await run({ locations: [{ place: 'London' }, { place: 'San Francisco' }, { place: 'Springfield' }] });
    assert.deepEqual(data.locations.slice(0, 2).map((p: any) => [p.timezone, p.error]), [['Europe/London', null], ['America/Los_Angeles', null]]);
    assert.match(data.locations[2].error, /several timezones/);
  });
  it('takes a city as the reference clock, as Meeting Planner took its host city', async () => {
    const city = await run({ referenceZone: 'Nuremberg', locations: [{ place: 'London, GB' }], eventTime: '2026-06-10T10:00' });
    const zone = await run({ referenceZone: 'Europe/Berlin', locations: [{ place: 'London, GB' }], eventTime: '2026-06-10T10:00' });
    assert.equal(city.data.referenceTimezone, 'Europe/Berlin');
    assert.equal(city.data.instant, zone.data.instant);
    assert.equal(city.data.error, null);
    const unknown = await run({ referenceZone: 'Nowhereville', locations: [{ place: 'London, GB' }] });
    assert.ok(unknown.data.error, 'a clock that is neither a city nor a zone is still reported');
  });
  it('starts with six editable city examples and no duplicate dimensions or font controls', async () => {
    const runtime = await createRuntime(tool, baseHost());
    const state = JSON.parse(runtime.getHydratedText('{{{_state}}}'));
    const svg = runtime.getHydratedString('{{{_artwork}}}');
    assert.deepEqual(state.places.map((p: any) => p.label), ['London', 'Nuremberg', 'Prague', 'Sofia', 'San Francisco', 'Noosa']);
    assert.deepEqual(state.places.map((p: any) => p.timezone), ['Europe/London', 'Europe/Berlin', 'Europe/Prague', 'Europe/Sofia', 'America/Los_Angeles', 'Australia/Brisbane']);
    assert.ok(state.places.every((p: any) => !p.error));
    assert.equal(runtime.getModel().find(i => i.id === 'locations')?.control, 'table');
    for (const key of ['heading', 'eyebrow', 'annotation', 'footer', 'referenceZone'])
      assert.equal(state.inputs[key], '');
    assert.doesNotMatch(svg, /data-section="heading"|Add a place|ONE WORLD/);
    assert.match(svg, /class="tz-vector-map"/);
    for (const id of ['width', 'height', 'fontFamily', 'displayFont'])
      assert.equal(
        runtime.getModel().some((i) => i.id === id),
        false
      );
  });
  it('ignores empty rows and collapses sections again when content is removed', async () => {
    const { runtime } = await run({
      heading: 'Hello',
      annotation: 'Details',
      footer: 'Join us',
      locations: [{ place: 'Europe/London' }, {}, { label: '  ', color: '#ff0000', spread: true }],
    });
    let svg = runtime.getHydratedString('{{{_artwork}}}');
    assert.match(svg, /data-section="heading"/);
    assert.match(svg, /data-section="locations"/);
    assert.doesNotMatch(svg, /data-section="place-annotation"/);
    assert.equal(JSON.parse(runtime.getHydratedText('{{{_data.json}}}')).locations.length, 1);
    for (const [id, value] of Object.entries({
      heading: ' ',
      annotation: '',
      footer: '',
      referenceZone: '',
      timeMode: 'now',
      locations: [],
    }))
      await runtime.setInput(id, value);
    svg = runtime.getHydratedString('{{{_artwork}}}');
    assert.doesNotMatch(svg, /data-section=|<text/);
    assert.doesNotMatch(runtime.getHydratedText('{{{_data.markdown}}}'), /# |\| Label/);
  });
  it('offers complete starting templates without overriding brand fonts or export size', async () => {
    for (const id of [
      'global-webinar',
      'infrastructure-atlas',
      'around-the-world',
      'unfold-the-world',
    ]) {
      const template = JSON.parse(
        await readFile(join(root, 'timezone/templates', id + '.json'), 'utf8')
      );
      assert.equal(template.id, id);
      assert.ok(template.values.locations.length > 0);
      assert.ok(template.values.heading);
      for (const key of ['width', 'height', 'fontFamily', 'displayFont'])
        assert.equal(key in template.values, false);
      const { data, svg } = await run(template.values);
      assert.equal(data.error, null);
      assert.match(svg, /data-section="locations"/);
    }
  });
  it('map-only composition retains tour locations and data while removing surrounding artwork', async () => {
    const { runtime, data, svg } = await run({
      composition: 'map',
      heading: 'Live tour',
      eyebrow: 'Series',
      annotation: 'Details',
      footer: 'Join us',
      motion: 'tour',
      locations: [{ place: 'Europe/London', label: 'Studio', annotation: 'Host', spread: true }],
    });
    assert.doesNotMatch(svg, /data-section=/);
    assert.match(svg, /<svg x="0" y="0" width="1440" height="1080"/);
    assert.match(svg, /OpenStreetMap contributors/);
    assert.equal(data.title, 'Live tour');
    assert.equal(data.locations[0].label, 'Studio');
    assert.equal(data.locations[0].annotation, 'Host');
    await runtime.setInput('composition', 'artwork');
    const restored = runtime.getHydratedString('{{{_artwork}}}');
    assert.match(restored, /data-section="heading"/);
    assert.match(restored, /data-section="locations"/);
    assert.match(restored, /data-section="footer"/);
  });
  it('provides a clean map animation template with no mandatory details', async () => {
    const template = JSON.parse(
      await readFile(join(root, 'timezone/templates/map-animation.json'), 'utf8')
    );
    const { data, svg } = await run(template.values);
    assert.equal(template.values.composition, 'map');
    assert.equal(template.values.motion, 'orbit');
    assert.equal(template.values.mapFit, 'width');
    assert.equal(data.locations.length, 0);
    assert.equal(data.title, '');
    assert.doesNotMatch(svg, /data-section=/);
  });
  it('uses now by default rather than tomorrow or a browser-local wall time', async () => {
    const start = Date.now(),
      { data } = await run({ timeMode: 'now' });
    assert.ok(+new Date(data.instant) >= start);
    assert.ok(+new Date(data.instant) <= Date.now());
  });
  it('resolves the scheduled instant with DST and fractional offsets', async () => {
    const { data } = await run({
      locations: [
        { place: 'Asia/Kathmandu', label: 'Nepal' },
        { place: 'America/New_York', label: 'NY' },
      ],
    });
    assert.equal(data.instant, '2026-03-29T09:00:00.000Z');
    assert.equal(data.locations[0].offsetMinutes, 345);
    assert.equal(data.locations[0].localTime, '14:45');
    assert.equal(data.locations[1].offsetMinutes, -240);
  });
  it('reports a skipped spring hour and distinguishes both autumn occurrences', async () => {
    const missing = await run({ eventTime: '2026-03-29T01:30' });
    assert.match(missing.data.error, /does not exist/);
    assert.equal(missing.data.instant, null);
    const early = await run({ eventTime: '2026-10-25T01:30', ambiguity: 'earlier' }),
      late = await run({ eventTime: '2026-10-25T01:30', ambiguity: 'later' });
    assert.equal(+new Date(late.data.instant) - +new Date(early.data.instant), 3600000);
  });
  it('keeps date-line differences and arbitrary labels / annotations in structured output', async () => {
    const { data } = await run({
      eventTime: '2026-09-07T12:00',
      referenceZone: 'UTC',
      locations: [
        { label: 'DC, "east"', place: 'Pacific/Kiritimati', annotation: 'APAC\nPrimary' },
        { label: 'West', place: 'Pacific/Honolulu' },
      ],
    });
    assert.equal(data.locations[0].dayOffset, 1);
    assert.equal(data.locations[1].dayOffset, 0);
    assert.equal(data.locations[0].label, 'DC, "east"');
    assert.equal(data.locations[0].annotation, 'APAC\nPrimary');
  });
  it('supports offline city lookup, explicit coordinates and invalid-place feedback', async () => {
    const { data } = await run({
      locations: [
        { place: 'London, GB' },
        { place: 'Rack A', timezone: 'Etc/UTC', longitude: '0', latitude: '0' },
        { place: 'Not a real place' },
        { place: 'Europe/London', latitude: '100', longitude: '1' },
      ],
    });
    assert.equal(data.locations[0].timezone, 'Europe/London');
    assert.equal(data.locations[1].longitude, 0);
    assert.match(data.locations[2].error, /Place not found/);
    assert.match(data.locations[3].error, /Coordinates/);
  });
  it('resolves example spellings and country names, derives labels and reads legacy region flags', async () => {
    const { data } = await run({ locations: [
      { place: 'Noosa, Australia', spread: 'true' },
      { place: 'Nuremberg, Germany' },
      { place: 'Prague, CZ', label: 'Studio' },
    ] });
    assert.equal(data.locations[0].label, 'Noosa');
    assert.equal(data.locations[0].timezone, 'Australia/Brisbane');
    assert.equal(data.locations[0].spread, true);
    assert.equal(data.locations[1].timezone, 'Europe/Berlin');
    assert.equal(data.locations[2].label, 'Studio');
  });
  it('keeps every row within the selected artwork size for a long roster', async () => {
    const { data, svg } = await run({
      locations: Array.from({ length: 45 }, (_, i) => ({
        label: 'Datacentre ' + i,
        place: 'Europe/London',
      })),
    });
    assert.equal(data.locations.length, 45);
    assert.match(svg, /Datacentre 44/);
    assert.match(svg, /viewBox="0 0 1440 1080"/);
    assert.doesNotMatch(svg, /NaN|Infinity/);
  });
  it('uses only active brand fonts, including when an old link has font overrides', async () => {
    const tokens: any = {
      resolve: async (p: string) =>
        ({
          '{font.brand}': 'Brand Sans',
          '{font.display}': 'Brand Display',
          '{color.semantic.primary}': '#00b080',
        })[p],
      colors: async () => [],
    };
    const { svg, data } = await run(
      {
        accent: '',
        theme: 'paper',
        heading: 'Brand headline',
        locations: [{ place: 'Europe/London' }],
        fontFamily: 'Wrong Sans',
        displayFont: 'Wrong Display',
      },
      baseHost({ tokens })
    );
    assert.match(svg, /font-family="Brand Sans"/);
    assert.match(svg, /font-family="Brand Display"/);
    assert.equal(data.locations[0].color, '#00b080');
    assert.doesNotMatch(svg, /Wrong Sans|Wrong Display/);
  });
  it('escapes artwork and script JSON, and emits readable CSV/Markdown/calendar data', async () => {
    const malicious = '</script><img src=x onerror=alert(1)>',
      { runtime, svg } = await run({
        heading: malicious,
        locations: [{ label: 'Ops, "one"', place: 'Europe/London', annotation: 'First\nSecond' }],
      });
    assert.doesNotMatch(svg, /<img/);
    assert.doesNotMatch(runtime.getHydratedString('{{{_state}}}'), /<\/script>/);
    assert.match(runtime.getHydratedText('{{{_data.csv}}}'), /"Ops, ""one"""/);
    assert.match(runtime.getHydratedText('{{{_data.markdown}}}'), /Europe\/London/);
    const csv = parseDelimited(runtime.getHydratedText('{{{_data.csv}}}'));
    assert.equal(csv[0]!.length, csv[1]!.length);
    assert.equal(csv[1]![3], '');
    const ics = runtime.getHydratedText('{{{_data.ics}}}');
    assert.match(ics, /DTSTART:20260329T090000Z/);
    assert.match(ics, /DTEND:20260329T100000Z/);
    for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  });
  it('renders actual paths without a browser and all projections are finite', async () => {
    for (const projection of [
      'globe',
      'equalEarth',
      'naturalEarth',
      'equirectangular',
      'mercator',
    ]) {
      const { svg } = await run({
        projection,
        view: '170,-45,30,1',
        locations: [{ place: 'Asia/Kolkata', spread: true }],
      });
      assert.match(svg, /<path d="M/);
      assert.doesNotMatch(svg, /NaN|Infinity|<image/);
    }
  });
  it('deals the times table in once for the reveal, and marks nothing for any other motion', async () => {
    const rows = { locations: [{ place: 'London, GB' }, { place: 'Nuremberg, DE' }, { place: 'Noosa, AU' }] };
    const still = await run(rows);
    assert.doesNotMatch(still.svg, /data-svg-motion/, 'a still carries no motion marks');
    assert.equal(still.runtime.getHydratedString('{{tzClipMs}}'), '0');
    const tour = await run({ ...rows, motion: 'tour' });
    assert.doesNotMatch(tour.svg, /data-svg-motion/, 'a loop carries none either');

    const tokens = { resolve: async (ref: string) => ({ '{motion.duration.medium}': { value: 300, unit: 'ms' }, '{motion.curve.emphasised}': [0.1, 0.8, 0.2, 1] } as Record<string, unknown>)[ref] ?? null, colors: async () => [] };
    const reveal = await run({ ...rows, motion: 'reveal' }, baseHost({ tokens }));
    const marks = [...reveal.svg.matchAll(/data-svg-motion="([^"]+)"/g)].map((m) => m[1]);
    // Three rows 120 ms apart, each time half a unit behind its row, the reference clock with the last.
    assert.deepEqual(marks, [
      'tz-settle 300ms cubic-bezier(0.1,0.8,0.2,1) 390ms',
      'tz-deal 300ms cubic-bezier(0.1,0.8,0.2,1) 0ms', 'tz-settle 300ms cubic-bezier(0.1,0.8,0.2,1) 150ms',
      'tz-deal 300ms cubic-bezier(0.1,0.8,0.2,1) 120ms', 'tz-settle 300ms cubic-bezier(0.1,0.8,0.2,1) 270ms',
      'tz-deal 300ms cubic-bezier(0.1,0.8,0.2,1) 240ms', 'tz-settle 300ms cubic-bezier(0.1,0.8,0.2,1) 390ms',
    ]);
    // The last part arrives at 690 ms and the picture then holds for two seconds.
    assert.equal(reveal.runtime.getHydratedString('{{tzClipMs}}'), '2690');
    assert.match(tool.template, /data-clip-ms="\{\{tzClipMs\}\}"/, 'the stage says how long the reveal lasts');

    const plain = await run({ ...rows, motion: 'reveal' });
    assert.match(plain.svg, /tz-deal 400ms cubic-bezier\(0\.05,0\.7,0\.1,1\) 0ms/, 'built-in timing where the system has none');

    const many = await run({ motion: 'reveal', locations: Array.from({ length: 13 }, (_, i) => ({ place: 'UTC', label: `Row ${i}` })) });
    const last = Math.max(...[...many.svg.matchAll(/data-svg-motion="tz-deal \d+ms \S+ (\d+)ms"/g)].map((m) => +m[1]!));
    assert.equal(last, 600, 'a long table still deals in within about a second');
  });
  it('deals the pins in when there is no table, and stays a still with no place at all', async () => {
    const pins = await run({ motion: 'reveal', composition: 'map', locations: [{ place: 'London, GB' }, { place: 'Nuremberg, DE' }] });
    assert.doesNotMatch(pins.svg, /data-section="locations"/);
    assert.equal([...pins.svg.matchAll(/data-svg-motion="tz-deal /g)].length, 2, 'one entrance for each pin');
    assert.equal([...pins.svg.matchAll(/data-svg-motion="tz-settle /g)].length, 2, 'and one for each time label');
    assert.notEqual(pins.runtime.getHydratedString('{{tzClipMs}}'), '0');
    const hidden = await run({ motion: 'reveal', composition: 'map', showLabels: false, locations: [{ place: 'London, GB' }] });
    assert.equal([...hidden.svg.matchAll(/data-svg-motion="/g)].length, 1, 'a pin with no label has only its own entrance');
    const empty = await run({ motion: 'reveal', locations: [] });
    assert.doesNotMatch(empty.svg, /data-svg-motion/);
    assert.equal(empty.runtime.getHydratedString('{{tzClipMs}}'), '0', 'nothing to deal in, so no clip');
  });
  it('keeps the design system theme on its accent ground, with readable ink and warning colours that read', async () => {
    const light: Record<string, string> = {
      '{color.semantic.primary}': '#033633', '{color.semantic.surface}': '#fbfdf7', '{color.semantic.text}': '#0b1f1d',
      '{color.role.alert-ink}': '#a3381f', '{color.role.alert-tint}': '#f2a03d',
    };
    const hostOf = (map: Record<string, string>) => baseHost({ tokens: { resolve: async (ref: string) => map[ref] ?? null, colors: async () => [] } });
    const rows = { locations: [{ place: 'London, GB' }, { place: 'San Francisco, US' }], eventTime: '2026-06-10T07:00', showHourQuality: true };
    const ground = (svg: string) => /<rect width="1440" height="1080" fill="(#[0-9a-f]{6})"\/>/.exec(svg)?.[1];
    const lum = (c: string) => [1, 3, 5].reduce((n, i, k) => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return n + (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][k]!; }, 0);
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

    // The ground is the accent mixed as the theme always mixed, whatever the surface token is.
    const brand = await run({ ...rows, theme: 'brand' }, hostOf(light));
    const plain = await run({ ...rows, theme: 'brand', showHourQuality: false }, hostOf({ '{color.semantic.primary}': '#033633' }));
    const bg = ground(brand.svg)!;
    assert.equal(bg, ground(plain.svg));
    assert.notEqual(bg, '#fbfdf7');
    assert.match(brand.svg, /fill="#f3f4ee"/, 'a dark text token gives way to the light ink on this ground');
    // On this ground the warning fill is under 3:1, so both marks stay the fixed pair.
    assert.match(brand.svg, /#ef4444/);
    assert.match(brand.svg, /#f59e0b/);
    assert.doesNotMatch(brand.svg, /#a3381f|#f2a03d/);

    // Where both alert roles read at 3:1 as given, they are the marks.
    const both = await run({ ...rows, theme: 'brand' }, hostOf({ ...light, '{color.role.alert-ink}': '#ffd9cf', '{color.role.alert-tint}': '#ffe7a8' }));
    assert.equal(ground(both.svg), bg);
    for (const c of ['#ffd9cf', '#ffe7a8']) {
      assert.ok(ratio(c, bg) >= 3, `${c} on ${bg}`);
      assert.match(both.svg, new RegExp(c));
    }
    assert.doesNotMatch(both.svg, /#ef4444|#f59e0b/);
    // One role alone is not a pair.
    const one = await run({ ...rows, theme: 'brand' }, hostOf({ ...light, '{color.role.alert-ink}': '#ffd9cf' }));
    assert.match(one.svg, /#ef4444/);
    assert.doesNotMatch(one.svg, /#ffd9cf/);

    // A light background override gets dark ink, and a text token that reads is used.
    const pale = await run({ ...rows, theme: 'brand', background: '#f4e9d8' }, hostOf(light));
    assert.match(pale.svg, /fill="#0b1f1d"/);
    assert.doesNotMatch(pale.svg, /fill="#f3f4ee"/);
    assert.match(pale.svg, /#ef4444/, 'the fill fails on this ground too, so the pair stays fixed');
    const paleNoText = await run({ ...rows, theme: 'brand', background: '#f4e9d8' }, hostOf({ '{color.semantic.primary}': '#033633' }));
    assert.match(paleNoText.svg, /fill="#132629"/);

    // The other themes read none of these tokens.
    for (const theme of ['midnight', 'paper', 'minimal']) {
      const withTokens = await run({ ...rows, theme }, hostOf(light));
      const without = await run({ ...rows, theme }, hostOf({ '{color.semantic.primary}': '#033633' }));
      assert.equal(withTokens.svg, without.svg, theme);
      assert.match(withTokens.svg, /#ef4444/, theme);
    }
  });
  it('exports computed data through the real engine export entry point', async () => {
    const captured: any[] = [];
    const host = baseHost({
      export: {
        render: async (_node: any, _format: string, opts: any) => {
          captured.push(opts);
          return new Blob([opts.dataText]);
        },
      },
    });
    const { runtime } = await run({}, host);
    await runtime.export({}, 'json');
    assert.equal(JSON.parse(captured[0].dataText).instant, '2026-03-29T09:00:00.000Z');
    await runtime.setInput('eventTime', '2026-03-29T01:30');
    await assert.rejects(() => runtime.export({}, 'ics'), /does not exist/);
  });
});
