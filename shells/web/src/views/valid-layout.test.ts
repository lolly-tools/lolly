// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERIFY_FINDING_IDS, verifyFindings } from '@lolly/engine';
import { SECTION, reportBodyHtml, sectionHtml, type ReportParts } from './valid-layout.ts';

const findings = verifyFindings({ report: { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, checks: [] } });
const parts: ReportParts = { stage: '<i data-part="stage"></i>', depth: '<i data-part="depth"></i>', licence: '<i data-part="licence"></i>', madeWith: '<i data-part="made"></i>', ai: '<i data-part="ai"></i>', personal: '<i data-part="personal"></i>', credential: '<i data-part="credential"></i>', hidden: '<i data-part="hidden"></i>', marks: '<i data-part="marks"></i>', receipt: '<i data-part="receipt"></i>' };

test('every finding has a title, an icon and an explanation for the help tip', () => {
  for (const id of VERIFY_FINDING_IDS) {
    assert.ok(SECTION[id].title && SECTION[id].icon, id);
    assert.ok(SECTION[id].tip.length > 40, `${id} needs an explanation`);
  }
});

test('a section is a head with a help tip, the finding in one sentence, then the detail', () => {
  const html = sectionHtml(findings.find((f) => f.id === 'credential')!, '<p>detail</p>');
  assert.match(html, /class="vs help-tip-host is-quiet" data-finding-section="credential"/);
  assert.match(html, /<h3 class="vs-head">.*<span>Credential<\/span><button type="button" class="help-tip-btn"/s);
  assert.match(html, /class="help-tip-pop"[^>]* hidden>A Content Credential is a signed record/);
  assert.match(html, /<p class="vs-lede">This file carries no Content Credential\./);
  assert.match(html, /<div class="vs-body"><p>detail<\/p><\/div>/);
  // Nothing to detail: the sentence still stands, so "nothing found" is a visible answer.
  const empty = sectionHtml(findings.find((f) => f.id === 'hidden')!, '  ');
  assert.match(empty, /vs-lede/);
  assert.doesNotMatch(empty, /vs-body/);
});

test('the body is two columns: what is in the file, then where the file came from', () => {
  const html = reportBodyHtml(findings, parts);
  const [asset, origin] = html.split('vf-col-origin');
  const order = (text: string) => [...text.matchAll(/data-part="(\w+)"|data-finding-section="([\w-]+)"/g)].map((m) => m[1] ?? `section:${m[2]}`);
  assert.deepEqual(order(asset!), ['stage', 'section:ai', 'ai', 'section:personal', 'personal', 'section:hidden', 'hidden', 'marks']);
  assert.deepEqual(order(origin!), ['depth', 'licence', 'section:made-with', 'made', 'section:credential', 'credential', 'receipt']);
});

test('a slot in the answer row leads to its section and shows the finding on the asset', () => {
  const source = readFileSync(new URL('./valid-findings.ts', import.meta.url), 'utf8');
  assert.match(source, /showOnStage\(result, id\)/);
  assert.match(source, /\[data-finding-section="\$\{id\}"\]/);
  assert.doesNotMatch(source, /vf-detail-pane/, 'the answer row no longer opens a second copy of the evidence');
});
