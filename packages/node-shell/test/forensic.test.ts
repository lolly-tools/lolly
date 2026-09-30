// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { inspectForensicBytes } from '../src/forensic.ts';
import { passiveForensicSvg } from '../src/forensic-svg.ts';
import { forensicLayoutFindings } from '@lolly/engine';
import { forensicDesignCases, forensicDesignSvg } from '../../../tests/fixtures/forensic-design.ts';
const dom = new JSDOM('');
const parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'image/svg+xml');
const serialize = (e: Element) => new dom.window.XMLSerializer().serializeToString(e);
test('passive SVG blocks execution and resources before rendering, records lost features', () => {
  const svg = passiveForensicSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200"><script>alert(1)</script><image href="https://example.com/private.png"/><foreignObject/><style>@import url(https://example.com/a.css)</style><rect width="20" height="20" onclick="alert(2)"/></svg>',
    parse,
    serialize
  );
  assert.equal(svg.partial, true);
  assert.doesNotMatch(svg.svg, /example.com|alert|script|foreignObject|onclick|@import/);
  assert.throws(() => passiveForensicSvg('<!DOCTYPE svg><svg/>', parse, serialize));
});
for (const fixture of forensicDesignCases)
  test(`native and flattened pattern localization: ${fixture.id}`, async () => {
    const svg = forensicDesignSvg(fixture),
      admitted = passiveForensicSvg(svg, parse, serialize);
    const lines = forensicLayoutFindings({
      id: '1',
      width: 500,
      height: 320,
      text: admitted.lines.map((l) => l.text).join('\n'),
      source: 'digital',
      complete: true,
      lines: admitted.lines,
      shapes: admitted.shapes,
    });
    if (fixture.expectedEyebrow)
      assert.equal(
        lines.find((f) => f.family === 'eyebrow-heading')!.rule,
        fixture.expectedEyebrow
      );
    const native = await inspectForensicBytes(new TextEncoder().encode(svg), `${fixture.id}.svg`, {
      classifier: false,
    });
    const png = await sharp(Buffer.from(svg)).png().toBuffer(),
      flattened = await inspectForensicBytes(new Uint8Array(png), `${fixture.id}.png`, {
        classifier: false,
      });
    for (const report of [native, flattened]) {
      assert.equal(
        report.findings.find((f) => f.family === 'fingernail-card')?.locations.length ?? 0,
        fixture.expectedCards
      );
      if (fixture.expectedCards) {
        const b = report.findings.find((f) => f.family === 'fingernail-card')!.locations[0]!.box!;
        assert.ok(Math.abs(b.x - 40) < 3);
        assert.ok(Math.abs(b.width - 320) < 3);
      }
      assert.equal(report.likelihood.state, 'unavailable');
    }
  });

test('slide-style text spans retain size hierarchy; hidden and displaced text is not fabricated', () => {
  const result = passiveForensicSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><text x="30" y="50"><tspan font-size="14">Growth strategy</tspan></text><text x="30" y="80"><tspan font-size="30">Our growth strategy</tspan></text><text display="none" x="30" y="130">Hidden</text><text x="30" y="150"><tspan x="200" y="250">Moved</tspan></text></svg>',
    parse,
    serialize
  );
  assert.deepEqual(
    result.lines.map((l) => Math.round(l.size!)),
    [14, 30]
  );
  assert.equal(result.partial, true);
  assert.equal(result.lines.length, 2);
});
