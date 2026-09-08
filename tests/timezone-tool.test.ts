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
  it('starts with empty content and no duplicate dimensions or font controls', async () => {
    const runtime = await createRuntime(tool, baseHost());
    const state = JSON.parse(runtime.getHydratedText('{{{_state}}}'));
    const svg = runtime.getHydratedString('{{{_artwork}}}');
    assert.equal(state.places.length, 0);
    for (const key of ['heading', 'eyebrow', 'annotation', 'footer', 'referenceZone'])
      assert.equal(state.inputs[key], '');
    assert.doesNotMatch(svg, /data-section=|<text|Add a place|ONE WORLD/);
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
