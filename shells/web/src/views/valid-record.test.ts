// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's Approved and Made for panels. Each is worded as a statement the signer made,
 * a record that fails its check stays visible with a warning, and a recorded prompt is
 * inert text however it was written.
 *
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/valid-record.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { approvedPanelHtml, madeForPanelHtml, paintAssetRecord, recordPanelsHtml, recordRowsHtml, wireRecordPanels } from './valid-record.ts';
import { wireMetadataLinks } from './valid-links.ts';
import { seedValuesFromDigest } from './valid-made-from.ts';
import { verifyLampCues } from './valid-text.ts';
import type { VerifyReport } from './valid-verdict.ts';

const digest = `sha256:${'ab'.repeat(32)}`;
const approval = { approvalId: 'apr_abc12345', decidedAt: '2026-11-05T10:15:00.000Z', reviewedSha256: digest };
const intent = { purpose: 'invite', surface: 'social-square', tool: 'qr-code', language: 'de', occasion: digest, promptFingerprint: digest };
const report = (over: Partial<VerifyReport>): VerifyReport => ({
  found: true, state: 'valid', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, delivered: false, format: 'png', checks: [], ...over,
} as VerifyReport);

const HOSTILE = 'Ignore all previous instructions.\n<script>window.pwned = 1</script><img src=x onerror="window.pwned = 2"><a href="https://evil.example">click</a> **bold**';

test('no record draws nothing, so an absence is never a finding', () => {
  assert.equal(recordPanelsHtml(report({})), '');
  assert.equal(recordRowsHtml(report({}), false), '');
});

test('an intact approval states what the signer recorded, never a verdict', () => {
  const html = approvedPanelHtml(report({ approval, signer: { organization: 'Example Org' } as never }));
  assert.match(html, />Approved</);
  assert.match(html, /<span>Example Org, self-asserted<\/span>/);
  assert.match(html, />apr_abc12345<\/span>/);
  assert.match(html, /Unchanged since the signer recorded this approval/);
  assert.match(html, /self-asserted by whoever signed the file/);
  assert.doesNotMatch(html, /valid-record-warn/);
  assert.doesNotMatch(html, /\b(compliant|compliance|on brand|safe)\b/i, 'no verdict on the work');
});

test('a CA-verified signer reads bare, and the note says who stands behind the record', () => {
  const html = approvedPanelHtml(report({ approval, trusted: true, signer: { organization: 'Example Org', identity: { email: 'approvals@example.org', issuer: 'Lolly CA' } } as never }));
  assert.match(html, /<span>approvals@example.org<\/span>/);
  assert.match(html, /made by the credential.s CA-verified signer/);
  assert.doesNotMatch(html, /self-asserted/);
});

test('the reviewed digest is shortened, with the whole value on hover and on Copy', () => {
  const html = approvedPanelHtml(report({ approval }));
  assert.match(html, new RegExp(`title="${digest}">sha256:abababababab…<`));
  assert.match(html, new RegExp(`data-record-copy="${digest}"`));
});

const HASH_FAILED = [{ code: 'assertion.dataHash.mismatch', ok: false }];
const LAPSED = [{ code: 'signingCredential.expired', ok: false }];
const SIGNATURE_FAILED = [{ code: 'claimSignature.mismatch', ok: false }];

test('a file that changed stays on the page, with a warning and no Approved', () => {
  const html = approvedPanelHtml(report({ state: 'invalid', approval, checks: HASH_FAILED as never }));
  assert.match(html, /role="alert"/);
  assert.match(html, /guide-warn/);
  assert.match(html, /changed after the approval was recorded, or the record itself was altered/);
  assert.match(html, />Approval record</);
  assert.doesNotMatch(html, />Approved</);
  assert.match(html, /Does not match the signed record/);
  assert.doesNotMatch(html, /Unchanged since/);
  assert.doesNotMatch(approvedPanelHtml(report({ state: 'invalid', approval, signer: { organization: 'Example Org' } as never })), /<span>Example Org<\/span>/, 'a name the check cannot back never reads bare');
});

test('"changed" is said only after a failed hash comparison', () => {
  const lapsed = approvedPanelHtml(report({ state: 'invalid', approval, checks: LAPSED as never }));
  assert.match(lapsed, /certificate has lapsed/);
  assert.match(lapsed, /Still matches its credential/);
  assert.doesNotMatch(lapsed, /changed after/);
  const signature = approvedPanelHtml(report({ state: 'invalid', approval, checks: SIGNATURE_FAILED as never }));
  assert.match(signature, /did not pass its checks/);
  assert.doesNotMatch(signature, /changed after/);
  assert.doesNotMatch(signature, /Does not match the signed record/);
});

test('a tampered intent is withheld by the reader, so nothing draws for it', () => {
  assert.equal(madeForPanelHtml(report({ state: 'invalid' })), '');
});

test('Made for reads in words, with free text as a fingerprint', () => {
  const html = madeForPanelHtml(report({ intent }));
  assert.match(html, /<span>Invite<\/span>/);
  assert.match(html, /<span>Social, square<\/span>/);
  assert.match(html, /<span>qr-code<\/span>/);
  assert.match(html, /<dt>Occasion<\/dt><dd><span class="valid-input-fingerprint"[^>]*>Text, fingerprinted/);
  assert.match(html, /<dt>Prompt<\/dt><dd><span class="valid-input-fingerprint"[^>]*>Text, fingerprinted/);
  assert.doesNotMatch(html, /valid-record-prompt"/, 'no quoted block without recorded words');
});

test('the signer line leads the panel, and one note at most follows the quote', () => {
  const html = madeForPanelHtml(report({ intent: { ...intent, promptFingerprint: undefined, prompt: 'A square invitation.' } }));
  assert.ok(html.indexOf('What the signer recorded') < html.indexOf('<dl'), 'the lead line comes before the rows');
  assert.equal((html.slice(html.indexOf('data-record-prompt')).match(/valid-input-note/g) ?? []).length, 1);
});

test('the fingerprint note says what is true of the rows on screen', () => {
  const allFingerprints = madeForPanelHtml(report({ intent }));
  assert.match(allFingerprints, /Typed text is recorded only as a fingerprint, so the words themselves are not in the file/);
  const promptInFile = madeForPanelHtml(report({ intent: { purpose: 'invite', surface: 'story', tool: 'x', occasion: digest, audience: digest, prompt: 'Spring meetup' } }));
  assert.match(promptInFile, /Occasion and audience are recorded only as fingerprints\./);
  assert.doesNotMatch(promptInFile, /words themselves are not in the file/, 'false beside a prompt shown word for word');
  const oneField = madeForPanelHtml(report({ intent: { purpose: 'invite', surface: 'story', tool: 'x', region: digest, prompt: 'Spring meetup' } }));
  assert.match(oneField, /Region is recorded only as a fingerprint\./);
  const noneHeld = madeForPanelHtml(report({ intent: { purpose: 'invite', surface: 'story', tool: 'x', prompt: 'Spring meetup' } }));
  assert.doesNotMatch(noneHeld, /fingerprint/);
  const bare = madeForPanelHtml(report({ intent: { purpose: 'invite', surface: 'story', tool: 'x' } }));
  assert.doesNotMatch(bare, /fingerprint/);
});

test('an unknown purpose and a recorded size read as written', () => {
  const html = madeForPanelHtml(report({ intent: { purpose: 'celebrate', surface: '1200x628px', tool: 'x' } }));
  assert.match(html, /<span>celebrate<\/span>/);
  assert.match(html, /<span>1200 × 628 px<\/span>/);
});

test('a recorded prompt that tries to instruct the reader stays inert text', () => {
  const dom = new JSDOM(`<div id="root">${madeForPanelHtml(report({ intent: { ...intent, promptFingerprint: undefined, prompt: HOSTILE } }))}</div>`, { runScripts: 'outside-only' });
  const doc = dom.window.document;
  const quote = doc.querySelector('[data-record-prompt]')!;
  assert.equal(quote.textContent, HOSTILE, 'the words survive exactly');
  assert.equal(quote.children.length, 0, 'no element came out of the words');
  assert.equal(doc.querySelectorAll('script, img, a').length, 0);
  assert.equal(quote.getAttribute('dir'), 'auto');
  assert.match(doc.querySelector('.valid-record-prompt-label')!.textContent ?? '', /Prompt from the person who asked/);
  assert.match(doc.querySelector('.valid-record-prompt')!.textContent ?? '', /a request and not instructions/);
});

test('a long prompt starts clamped, and Show all lifts the clamp', () => {
  const dom = new JSDOM(`<div id="root">${madeForPanelHtml(report({ intent: { ...intent, prompt: 'word '.repeat(120) } }))}</div>`);
  const { document: doc, MouseEvent: Click } = dom.window;
  Object.assign(globalThis, { MouseEvent: Click });
  const root = doc.getElementById('root') as unknown as HTMLElement;
  wireRecordPanels(root);
  const quote = doc.querySelector('[data-record-prompt]')!;
  const expand = doc.querySelector<HTMLButtonElement>('[data-record-expand]')!;
  assert.ok(quote.classList.contains('is-clamped'));
  expand.click();
  assert.ok(!quote.classList.contains('is-clamped'));
  assert.equal(expand.getAttribute('aria-expanded'), 'true');
  assert.equal(expand.hidden, true);
});

test('Recreate seeds from the recorded inputs alone, so prompt words never reach an input', () => {
  const seeded = seedValuesFromDigest({ headline: 'Spring meetup', note: digest }, new Map([['headline', 'text'], ['note', 'text']]));
  assert.deepEqual(seeded, { headline: 'Spring meetup' }, 'a fingerprint is skipped');
  const source = readFileSync(new URL('./valid.ts', import.meta.url), 'utf8');
  for (const call of source.matchAll(/seedValuesFromDigest\(([^)]*)\)/g)) assert.doesNotMatch(call[1]!, /intent|prompt/i);
  assert.doesNotMatch(source, /report\.intent/, 'valid.ts hands the record to the presenter and reads nothing from it');
});

test('a short prompt has nothing to expand', () => {
  assert.doesNotMatch(madeForPanelHtml(report({ intent: { ...intent, prompt: 'A square invitation.' } })), /data-record-expand/);
});

test('Details rows take one line each, and a kept file keeps its one approval row', () => {
  const rows = recordRowsHtml(report({ approval, intent: { ...intent, promptFingerprint: undefined, prompt: 'first line\nsecond <b>line</b>' } }), false);
  assert.match(rows, /data-meta="approval"/);
  assert.match(rows, /data-meta="purpose"/);
  assert.match(rows, /data-meta="prompt"/);
  assert.match(rows, /data-record-reveal="prompt">first line second &lt;b&gt;line&lt;\/b&gt;</);
  assert.doesNotMatch(recordRowsHtml(report({ approval }), true), /data-meta="approval"/, 'no second approval row');
});

function sheet(extraRows = ''): { doc: Document; root: HTMLElement } {
  const dom = new JSDOM(`<div id="sheet"><div class="cat-inspector-title-row"><h2 class="cat-details-name">card.png</h2></div>
    <dl data-meta-list>${extraRows}<div data-meta="id"><dt>ID</dt><dd>x</dd></div></dl>
    <details id="fold"><summary>Origins</summary><div id="panels"></div></details></div>`);
  const doc = dom.window.document;
  return { doc: doc as unknown as Document, root: doc.getElementById('sheet') as unknown as HTMLElement };
}

test('Assets: the rows sit ahead of the id, and a kept file keeps its one approval row', () => {
  const fresh = sheet();
  paintAssetRecord(fresh.root, report({ approval, intent }));
  const keys = [...fresh.doc.querySelectorAll('[data-meta-list] > [data-meta]')].map((node) => node.getAttribute('data-meta'));
  assert.deepEqual(keys, ['approval', 'purpose', 'prompt', 'id']);
  const kept = sheet('<div data-meta="approval"><dt>Approval</dt><dd>Approved Nov 5, 2026</dd></div>');
  paintAssetRecord(kept.root, report({ approval }));
  assert.equal(kept.doc.querySelectorAll('[data-meta="approval"]').length, 1);
  assert.match(kept.doc.querySelector('[data-meta="approval"] dd')!.textContent ?? '', /Approved Nov 5, 2026/);
});

test('Assets: a failed approval warns under the name, outside every fold', () => {
  const { doc, root } = sheet();
  paintAssetRecord(root, report({ state: 'invalid', approval, checks: HASH_FAILED as never }));
  const warn = doc.querySelector('.valid-record-warn')!;
  assert.equal(warn.getAttribute('role'), 'alert');
  assert.equal(warn.previousElementSibling?.className, 'cat-inspector-title-row', 'below the title row, not squeezed inside');
  assert.equal(warn.closest('details'), null);
  const row = doc.querySelector('[data-meta="approval"] dd')!;
  assert.match(row.textContent ?? '', /Does not match the approved file/);
  assert.ok(row.querySelector('.cat-record-failed'), 'not styled as a passing link');
  const clean = sheet();
  paintAssetRecord(clean.root, report({ approval }));
  assert.equal(clean.doc.querySelector('.valid-record-warn'), null);
});

test('Assets: a kept file that fails agrees with its warning, and keeps Open request', () => {
  const kept = sheet('<div data-meta="approval"><dt>Approval</dt><dd>Approved Nov 5, 2026 <button type="button" data-act="open-approval">Open request</button></dd></div>');
  paintAssetRecord(kept.root, report({ state: 'invalid', approval, checks: HASH_FAILED as never }));
  assert.equal(kept.doc.querySelectorAll('[data-meta="approval"]').length, 1);
  const row = kept.doc.querySelector('[data-meta="approval"] dd')!;
  assert.doesNotMatch(row.textContent ?? '', /Approved Nov 5/);
  assert.match(row.textContent ?? '', /Does not match the approved file/);
  assert.equal(row.querySelector('.cat-record-failed')?.textContent, 'Does not match the approved file');
  assert.equal(row.querySelector('[data-act="open-approval"]')?.textContent, 'Open request');
  assert.ok(kept.doc.querySelector('.valid-record-warn'));

  const lapsed = sheet('<div data-meta="approval"><dt>Approval</dt><dd>Approved Nov 5, 2026</dd></div>');
  paintAssetRecord(lapsed.root, report({ state: 'invalid', approval, checks: LAPSED as never }));
  assert.match(lapsed.doc.querySelector('[data-meta="approval"] dd')!.textContent ?? '', /Certificate lapsed/);

  const noRecordInFile = sheet('<div data-meta="approval"><dt>Approval</dt><dd>Approved Nov 5, 2026</dd></div>');
  paintAssetRecord(noRecordInFile.root, report({ state: 'invalid', checks: HASH_FAILED as never }));
  assert.match(noRecordInFile.doc.querySelector('[data-meta="approval"] dd')!.textContent ?? '', /Does not match the approved file/, 'the credential failed even with no approval in it');
});

test('Assets: the prompt row opens the panel it names, with the whole prompt showing', () => {
  const { doc, root } = sheet();
  const live = report({ intent: { ...intent, promptFingerprint: undefined, prompt: 'word '.repeat(120) } });
  doc.getElementById('panels')!.innerHTML = madeForPanelHtml(live);
  paintAssetRecord(root, live);
  const figure = doc.querySelector<HTMLElement>('[data-record-panel="prompt"]')!;
  let scrolled = 0;
  figure.scrollIntoView = () => { scrolled++; };
  const view = doc.defaultView!;
  Object.assign(globalThis, { getComputedStyle: view.getComputedStyle.bind(view) });
  const fold = doc.getElementById('fold') as HTMLDetailsElement;
  assert.equal(fold.open, false);
  doc.querySelector<HTMLElement>('[data-record-reveal="prompt"]')!.click();
  assert.equal(fold.open, true);
  assert.equal(scrolled, 1);
  assert.ok(!doc.querySelector('[data-record-prompt]')!.classList.contains('is-clamped'));
  assert.equal(doc.activeElement, figure);
});

test('an approval lamp only when a record exists, and it warns when the record fails', () => {
  assert.ok(!verifyLampCues({ report: report({}) as never }).some((cue) => cue.id === 'approval'));
  const good = verifyLampCues({ report: report({ approval }) as never }).find((cue) => cue.id === 'approval');
  assert.equal(good?.state, 'fact');
  const bad = verifyLampCues({ report: report({ state: 'invalid', approval }) as never }).find((cue) => cue.id === 'approval');
  assert.equal(bad?.state, 'warn');
});

const PAGE = 'https://acme.example/brand/acme/';

test('a recorded brand page shows the host and the signer\'s words, and stays inert until clicked', () => {
  const dom = new JSDOM(`<div id="root">${recordPanelsHtml(report({ approval, intent, brandPage: PAGE }))}</div>`);
  const doc = dom.window.document;
  const panels = [...doc.querySelectorAll('[data-record-panel]')].map((el) => el.getAttribute('data-record-panel'));
  assert.deepEqual(panels, ['approval', 'intent', 'brandPage'], 'Approved, Made for, then the page');
  const panel = doc.querySelector('[data-record-panel="brandPage"]')!;
  assert.match(panel.querySelector('h3')!.textContent ?? '', /Brand page/);
  assert.match(panel.textContent ?? '', /The signer recorded this address\. It does not show that the page belongs to anyone\./);
  assert.match(panel.textContent ?? '', /\/brand\/acme\//);
  const links = panel.querySelectorAll('a');
  assert.equal(links.length, 1);
  const link = links[0]!;
  assert.match(link.textContent ?? '', /^acme\.example/);
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('data-metadata-url'), PAGE);
  assert.equal(panel.querySelector('img, iframe, object, embed, link, script'), null, 'nothing loads the page');
});

test('a click on the recorded page opens the warning first, and nothing goes to the page', () => {
  const dom = new JSDOM(`<!doctype html><body><div id="root">${recordPanelsHtml(report({ brandPage: PAGE }))}</div></body>`, { pretendToBeVisual: true });
  const { document: doc, MouseEvent: Click, HTMLElement: El } = dom.window;
  Object.assign(globalThis, { document: doc, window: dom.window, HTMLElement: El, Element: dom.window.Element, MouseEvent: Click });
  dom.window.HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true; };
  const root = doc.getElementById('root') as unknown as HTMLElement;
  wireMetadataLinks(root);
  wireMetadataLinks(root);
  const event = new Click('click', { bubbles: true, cancelable: true });
  doc.querySelector('[data-record-panel="brandPage"] a')!.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true, 'the link itself does not navigate');
  assert.equal(doc.querySelectorAll('.valid-link-dialog').length, 1, 'one warning, however often the root was wired');
  assert.match(doc.querySelector('.valid-link-dialog')!.textContent ?? '', /Its destination and safety have not been verified\./);
  assert.equal(doc.querySelector('.valid-link-destination')!.textContent, PAGE);
});

test('a dropped address is said out loud, and the value is nowhere on the page', () => {
  const unverified = recordPanelsHtml(report({ state: 'invalid', brandPageDropped: 'credential' }));
  assert.match(unverified, /its credential did not verify, so the address is left out here/);
  assert.doesNotMatch(unverified, /<a\b/);
  const refused = recordPanelsHtml(report({ brandPageDropped: 'address' }));
  assert.match(refused, /not a plain https address/);
  assert.doesNotMatch(refused, /<a\b/);
  assert.equal(recordRowsHtml(report({ brandPageDropped: 'credential' }), false), '', 'Details has no row to show');
});

test('a value that is not an address draws nothing, whoever hands the report over', () => {
  for (const bad of ['javascript:alert(1)', 'http://acme.example/', 'https://user:pass@acme.example/']) {
    assert.equal(recordPanelsHtml(report({ brandPage: bad })), '');
    assert.equal(recordRowsHtml(report({ brandPage: bad }), false), '');
  }
});

test('the asset inspector gives the page a Details row, and its click goes through the same warning', () => {
  const dom = new JSDOM(`<!doctype html><body><div id="sheet"><dl data-meta-list><div data-meta="id"><dt>Id</dt><dd>x</dd></div></dl></div></body>`, { pretendToBeVisual: true });
  const { document: doc, MouseEvent: Click, HTMLElement: El } = dom.window;
  Object.assign(globalThis, { document: doc, window: dom.window, HTMLElement: El, Element: dom.window.Element, MouseEvent: Click });
  dom.window.HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true; };
  const sheet = doc.getElementById('sheet') as unknown as HTMLElement;
  paintAssetRecord(sheet, report({ brandPage: PAGE }));
  const row = doc.querySelector('[data-meta="brandPage"]')!;
  assert.match(row.querySelector('dt')!.textContent ?? '', /Brand page/);
  assert.match(row.querySelector('dd')!.textContent ?? '', /^acme\.example/);
  const event = new Click('click', { bubbles: true, cancelable: true });
  row.querySelector('a')!.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(doc.querySelectorAll('.valid-link-dialog').length, 1);
});
