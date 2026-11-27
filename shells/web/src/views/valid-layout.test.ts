// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERIFY_FINDING_IDS, verifyFindings } from '@lolly/engine';
import { SECTION, reportBodyHtml, sectionHtml, type ReportParts } from './valid-layout.ts';
import { aiRowHtml } from './valid-rows.ts';

const findings = verifyFindings({ report: { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, checks: [] } });
const parts: ReportParts = { stage: '<i data-part="stage"></i>', depth: '<i data-part="depth"></i>', file: '<i data-part="file"></i>', licence: '<i data-part="licence"></i>', madeWith: '<i data-part="made"></i>', aiDeclared: { origin: undefined, makerHint: '', audio: false, verified: false }, ai: '<i data-part="ai"></i>', personal: '<i data-part="personal"></i>', credential: '<i data-part="credential"></i>', hidden: '<i data-part="hidden"></i>', marks: '<i data-part="marks"></i>', checks: { fileIndex: 0, scannable: false, rescan: false }, receipt: '<i data-part="receipt"></i>' };
const located = verifyFindings({ report: { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, checks: [] }, meta: { format: 'JPEG', fields: [{ label: 'Serial number', value: 'SN-0042', group: 'device', sensitive: true, source: 'EXIF BodySerialNumber' }, { label: 'Creator', value: 'Jo Example', group: 'authorship', sensitive: true, source: 'XMP dc:creator' }], ai: { kind: 'generated', credit: 'Adobe Firefly' } } as never });

test('every finding has a title, an icon and an explanation for the help tip', () => {
  for (const id of VERIFY_FINDING_IDS) {
    assert.ok(SECTION[id].title && SECTION[id].icon, id);
    assert.ok(SECTION[id].tip.length > 40, `${id} needs an explanation`);
  }
});

test('a section is a head with a help tip, then the detail', () => {
  const html = sectionHtml(findings.find((f) => f.id === 'credential')!, '<p>detail</p>');
  assert.match(html, /class="vs help-tip-host is-quiet" data-finding-section="credential"/);
  assert.match(html, /<h3 class="vs-head">.*<span>Credential<\/span><button type="button" class="help-tip-btn"/s);
  assert.match(html, /class="help-tip-pop"[^>]* hidden>A Content Credential is a signed record/);
  // An absence has no evidence to lead with, so its sentence is the answer.
  assert.match(html, /<p class="vs-lede">This file carries no Content Credential\./);
  assert.match(html, /<div class="vs-body"><p>detail<\/p><\/div>/);
  assert.doesNotMatch(html, /vf-slot-strength/, 'nothing found has no strength to state');
  // Nothing to detail: the sentence still stands, so "nothing found" is a visible answer.
  const empty = sectionHtml(findings.find((f) => f.id === 'hidden')!, '  ');
  assert.match(empty, /vs-lede/);
  assert.doesNotMatch(empty, /vs-body/);
});

test('a section with evidence leads with the evidence; the answer slot is the one statement of its strength', () => {
  const ai = located.find((f) => f.id === 'ai')!;
  const html = sectionHtml(ai, '<p>row</p>');
  assert.doesNotMatch(html, /vs-lede/, 'the answer row already gives the finding in words');
  assert.doesNotMatch(html, /Stated in the file/, 'the slot above already states the strength, so the head does not');
  assert.match(html, /<\/button><\/h3>/);
  // With no body the sentence is all there is, so the sentence stays.
  assert.match(sectionHtml(ai, ''), /<p class="vs-lede">The file’s metadata declares AI-generated content/);
  // A finding whose section draws no evidence of its own keeps its sentence.
  const imprint = verifyFindings({ report: { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, checks: [] }, imprint: true }).find((f) => f.id === 'credential')!;
  assert.match(sectionHtml(imprint, '<p>metadata</p>'), /<p class="vs-lede">No Content Credential\. The Lolly Imprint was read from the pixels/);
});

test('the AI declaration is a row of the AI section with its maker, and repeats the slot strength only at Evidence depth', () => {
  const html = reportBodyHtml(located, { ...parts, aiDeclared: { origin: { kind: 'generated', via: 'metadata', credit: 'Adobe Firefly' }, makerHint: '', audio: false, verified: false } });
  const section = html.slice(html.indexOf('data-finding-section="ai"'), html.indexOf('data-finding-section="personal"'));
  assert.match(section, /class="vs-ai" role="alert" data-ai-via="metadata"/);
  assert.match(section, /<strong>AI-generated content<\/strong><span class="vendor-chip" data-vendor-role="ai" data-strength="stated">/);
  assert.equal(section.match(/Stated in the file/g)?.length, 1, 'once, on the maker');
  assert.match(section, /<span class="vf-slot-strength is-stated vf-same">Stated in the file<\/span>/, 'and that one shows at Evidence depth only');
  assert.doesNotMatch(html, /valid-ai-flag/, 'no filled card inside the report');
  // A row whose own strength differs from the head still states its strength.
  assert.match(aiRowHtml({ origin: { kind: 'generated', via: 'credential' }, makerHint: 'Adobe Firefly', audio: false, verified: false }, 'stated'), /<span class="vf-slot-strength is-unverified">Credential, not verified/);
});

test('personal details are listed once: a value another section shows is not repeated', () => {
  const html = reportBodyHtml(located, { ...parts, licence: '<dd>Jo Example</dd>' });
  const section = html.slice(html.indexOf('data-finding-section="personal"'), html.indexOf('data-finding-section="hidden"'));
  assert.match(section, /<dt>Serial number<\/dt><dd>SN-0042<\/dd><dd class="vs-source">EXIF BodySerialNumber<span class="vf-slot-strength is-stated vf-same">Stated in the file<\/span><\/dd>/);
  assert.doesNotMatch(section, /Jo Example/, 'the creator is in Licence');
  assert.match(reportBodyHtml(located, parts), /<dt>Creator<\/dt><dd>Jo Example<\/dd>/, 'and is listed here when no licence shows the creator');
});

test('the checks a reader starts are rows in Hidden content; the watermark scan waits to be offered', () => {
  const html = reportBodyHtml(findings, { ...parts, checks: { fileIndex: 2, scannable: true, rescan: true } });
  const section = html.slice(html.indexOf('data-finding-section="hidden"'));
  assert.match(section, /class="vs-action" data-deepscan-banner>\s*<button type="button" class="btn" data-deep-scan-enable>/);
  assert.match(section, /data-imprint-rescan-block="2">\s*<button type="button" class="btn" data-imprint-rescan="2">/);
  assert.match(section, /Nothing is uploaded\./);
  assert.doesNotMatch(reportBodyHtml(findings, parts), /data-deep-scan-enable|data-imprint-rescan/, 'a file whose pixels cannot be read offers neither');
  const css = readFileSync(new URL('../styles/parts/valid-layout.css', import.meta.url), 'utf8');
  assert.match(css, /\.vs-action\[data-deepscan-banner\] \{ display: none; \}/);
  assert.match(css, /\.valid-result:not\(\[data-vf-depth="evidence"\]\) \.vf-same \{ display: none; \}/, 'a strength that matches the slot shows at Evidence depth only');
  assert.match(css, /\[data-deepscan-offer="offer"\] \.vs-action\[data-deepscan-banner\]/);
});

test('the body is the depth switch, then two columns: what is in the file, then where the file came from', () => {
  const html = reportBodyHtml(findings, parts);
  const [asset, origin] = html.split('vf-col-origin');
  const order = (text: string) => [...text.matchAll(/data-part="(\w+)"|data-finding-section="([\w-]+)"/g)].map((m) => m[1] ?? `section:${m[2]}`);
  assert.deepEqual(order(asset!), ['depth', 'stage', 'section:ai', 'ai', 'section:personal', 'personal', 'section:hidden', 'hidden', 'marks']);
  assert.deepEqual(order(origin!), ['file', 'licence', 'section:made-with', 'made', 'section:credential', 'credential', 'receipt']);
});

test('a slot in the answer row leads to its section and shows the finding on the asset', () => {
  const source = readFileSync(new URL('./valid-findings.ts', import.meta.url), 'utf8');
  assert.match(source, /showOnStage\(result, id\)/);
  assert.match(source, /\[data-finding-section="\$\{id\}"\]/);
  assert.doesNotMatch(source, /vf-detail-pane/, 'the answer row no longer opens a second copy of the evidence');
});
