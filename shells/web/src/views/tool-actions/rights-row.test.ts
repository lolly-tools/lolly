// SPDX-License-Identifier: MPL-2.0
/**
 * The export panel's rights row - views/tool-actions/rights-row.ts (plan 253).
 *
 * Every evaluation here is the REAL one: the shared fixtures under
 * tests/fixtures/rights carry works, uses and a context, and this suite runs them
 * through `evaluateCreativeUses` rather than hand-writing an evaluation object.
 * A row state that cannot be produced by the evaluator is a row state that cannot
 * happen, and the credit lines the card shows are the exact ones the plan built.
 *
 * Four promises: each state in the plan's vocabulary renders, a ShareAlike
 * decision made in the card reaches the runtime and settles the row, the Download
 * button is never touched while an action is outstanding, and a credential that
 * did not survive the write shows a retry instead of passing a raw file off as a
 * finished delivery.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-actions/rights-row.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { evaluateCreativeUses } from '../../../../../engine/src/rights-evaluate.ts';
import type { RightsEvaluationInputV1 } from '../../../../../engine/src/rights-evaluate.ts';
import type { AttributionReceiptV1, RightsDecisionV1, RightsEvaluationV1 } from '@lolly-tools/core/rights-v1';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLDetailsElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { mountRightsRow, paintRightsRow, rightsRowHtml, rightsView } = await import('./rights-row.ts');
import type { RightsRowRuntime } from './rights-row.ts';

const FIXTURES = new URL('../../../../../tests/fixtures/rights/', import.meta.url);

/** One shared fixture, evaluated by the engine exactly as the runtime evaluates it. */
function evaluate(name: string, over: Partial<RightsEvaluationInputV1> = {}): RightsEvaluationV1 {
  const fixture = JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8')) as { input: RightsEvaluationInputV1 };
  return evaluateCreativeUses({ ...fixture.input, ...over });
}

/** A receipt the host measured for this exact evaluation. */
function receipt(evaluation: RightsEvaluationV1, over: Partial<AttributionReceiptV1> = {}): AttributionReceiptV1 {
  const expected = evaluation.plan.required.map((notice) => notice.work);
  return {
    fingerprint: evaluation.fingerprint,
    outputHash: `sha256:${'1'.repeat(64)}`,
    state: 'readback-confirmed',
    expected,
    observed: expected,
    checks: [],
    remaining: [],
    credits: '',
    ...over,
  };
}

/** The panel as the export bar paints it: the download button plus the rights card. */
function panel(): HTMLElement {
  document.body.innerHTML = `<div id="tool-actions">
      <button type="button" data-action="download">Download</button>
      ${rightsRowHtml()}
    </div>`;
  return document.querySelector<HTMLElement>('#tool-actions')!;
}

function headline(root: ParentNode): string {
  return root.querySelector<HTMLElement>('[data-rights-headline]')?.textContent ?? '';
}

function cardLines(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>('.export-rights-card-line')].map((el) => el.textContent ?? '');
}

function buttonLabels(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-rights-action]')].map((el) => el.textContent ?? '');
}

interface FakeRuntime extends RightsRowRuntime {
  decisions: RightsDecisionV1[];
  receipt: AttributionReceiptV1 | null;
  emojiChanged(): void;
}

function fakeRuntime(read: () => RightsEvaluationV1): FakeRuntime {
  const listeners = new Set<() => void>();
  const decisions: RightsDecisionV1[] = [];
  return {
    decisions,
    receipt: null,
    rights: () => read(),
    setRightsDecision(decision) { decisions.push(decision); },
    get lastReceipt() { return this.receipt; },
    onEmojiChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emojiChanged() { for (const fn of [...listeners]) fn(); },
  } as FakeRuntime;
}

// ─── The states, one per fixture ─────────────────────────────────────────────

test('a render with no recorded work shows nothing at all', () => {
  const view = rightsView({ ...evaluate('by-unchanged-placed'), uses: [] }, null);
  assert.equal(view.show, false);
  const root = panel();
  paintRightsRow(root, view);
  assert.equal(root.querySelector<HTMLElement>('[data-rights-section]')?.hidden, true);
});

test('credit prepared: a placed CC BY work says the credits WILL be included, with no card', () => {
  const view = rightsView(evaluate('by-unchanged-placed'), null);
  assert.equal(view.show, true);
  assert.equal(view.tone, 'quiet');
  assert.equal(view.headline, 'Source credits will be included.');
  assert.deepEqual(view.cards, []);
  const root = panel();
  paintRightsRow(root, view);
  assert.equal(root.querySelector<HTMLElement>('[data-rights-section]')?.hidden, false);
  assert.equal(headline(root), 'Source credits will be included.');
  // The exact credit a recipient needs is there to copy, folded away by default.
  const credit = root.querySelector<HTMLDetailsElement>('[data-rights-credit]')!;
  assert.equal(credit.hidden, false);
  assert.equal(credit.open, false);
  assert.match(root.querySelector<HTMLElement>('[data-rights-credit-text]')!.textContent!, /CC BY 4\.0/);
});

test('delivery checked: only a matching confirmed receipt turns the line to the past tense', () => {
  const evaluation = evaluate('by-unchanged-placed');
  assert.equal(rightsView(evaluation, receipt(evaluation)).headline, "Credits included in this file's metadata.");
  // A receipt measured against other inputs describes another file, so the row
  // goes back to promising rather than speaking for bytes nobody exported.
  const stale = receipt(evaluation, { fingerprint: 'sha256:stale' });
  assert.equal(rightsView(evaluation, stale).headline, 'Source credits will be included.');
  // Written, but not read back: still not a confirmed delivery.
  const written = receipt(evaluation, { state: 'written' });
  assert.equal(rightsView(evaluation, written).headline, 'Source credits will be included.');
});

test('companion included: a package route names the package', () => {
  const view = rightsView(evaluate('package-route'), null);
  assert.equal(view.headline, 'Credits and credentials are in the download package.');
});

test('recipient action remains: a clipboard route asks for the credit in the post, credit open beside it', () => {
  const view = rightsView(evaluate('clipboard-delivery-missing'), null);
  assert.equal(view.tone, 'action');
  assert.deepEqual(cardLinesOf(view), ['Add this credit to the post description.']);
  assert.equal(view.creditsOpen, true);
  const root = panel();
  paintRightsRow(root, view);
  assert.equal(root.querySelector<HTMLDetailsElement>('[data-rights-credit]')!.open, true);
  assert.ok(buttonLabels(root).includes('Copy credit'));
});

test('SA card scope: modifications a producer recorded as sentences read as one line, no stop before a comma', () => {
  const evaluation = evaluate('by-sa-recoloured-shared', {
    details: {
      'example/harbour-illustration': {
        modifications: ['Canonicalized SVG syntax and inline presentation styles.', 'Recoloured every paint with emoji-treatment-v1 in snap mode.'],
      },
    },
  });
  const view = rightsView(evaluation, null, { keepOriginal: true, replaceWork: true });
  assert.equal(
    view.cards[0]!.scope,
    'Harbour Illustration. What changed: Canonicalized SVG syntax and inline presentation styles, Recoloured every paint with emoji-treatment-v1 in snap mode.',
  );
});

test('SA decision needed: the card names the work and what changed, and offers the four ways out', () => {
  const view = rightsView(evaluate('by-sa-recoloured-shared'), null, { keepOriginal: true, replaceWork: true });
  assert.equal(view.headline, 'Source credits will be included.');
  assert.deepEqual(cardLinesOf(view), ['If you share this adaptation, it needs a compatible licence.']);
  const card = view.cards[0]!;
  assert.equal(card.scope, 'Harbour Illustration. What changed: recoloured');
  // One button per licence on the CC compatible list, each under its own
  // readable name, then the ways out that are not a licence choice.
  assert.deepEqual(card.actions.map((a) => a.label), [
    'Share the adaptation under CC BY-SA 4.0',
    'Share the adaptation under Free Art License 1.3',
    'Share the adaptation under GNU General Public License v3 or later',
    'Keep the original colours',
    'Use a different set',
    'Record separate permission',
  ]);
  // A remedy this mount cannot carry out is not drawn as a button that does nothing.
  const bare = rightsView(evaluate('by-sa-recoloured-shared'), null);
  assert.deepEqual(bare.cards[0]!.actions.map((a) => a.kind), ['output-licence', 'output-licence', 'output-licence', 'separate-permission']);
});

test('a private adaptation asks for nothing: ShareAlike is not an error by itself', () => {
  const view = rightsView(evaluate('by-sa-recoloured-private'), null);
  assert.equal(view.tone, 'quiet');
  assert.deepEqual(view.cards, []);
  assert.equal(view.headline, 'Source credits will be included.');
});

test('information missing: an unrecorded licence never reads as nothing to do', () => {
  const view = rightsView(evaluate('unknown-licence'), null);
  assert.equal(view.headline, 'Source licence not recorded.');
  assert.deepEqual(cardLinesOf(view), ['Source licence not recorded.']);
});

test('recorded and not interpreted is not the same sentence as not recorded', () => {
  // A licence the catalog DID record, whose conditions these rules do not read
  // yet, must not be announced as absent: that is a false statement about the
  // catalog entry, and the catalog sheet says the honest thing for the same
  // asset. The evaluator's own sentence names what was recorded.
  const ref = rightsView(evaluate('licenseref-not-proprietary'), null);
  assert.equal(ref.headline, 'This licence is recorded and not yet interpreted: LicenseRef-acme-internal.');
  assert.deepEqual(cardLinesOf(ref), ['This licence is recorded and not yet interpreted: LicenseRef-acme-internal.']);

  const nc = rightsView(evaluate('nc-recognised-not-reviewed'), null);
  assert.equal(nc.headline, 'Conditions recorded, not yet interpreted: Attribution, NonCommercial.');

  const both = rightsView(evaluate('and-expression'), null);
  assert.match(both.headline, /^This source states cumulative terms, which are recorded and not yet interpreted together: /);
});

test('conflicting evidence: two declarations disagree', () => {
  const view = rightsView(evaluate('grant-conflict'), null);
  assert.deepEqual(cardLinesOf(view), ['Two licence declarations disagree.']);
});

test('no attribution condition: the CC0 dedication is named, not generalised', () => {
  const view = rightsView(evaluate('cc0-courtesy'), null);
  assert.equal(view.headline, 'No required credit under the recorded CC0 dedication.');
  assert.deepEqual(view.cards, []);
  // A runtime font use asks nothing of the text it set, and reports that without
  // borrowing a dedication's name.
  assert.equal(rightsView(evaluate('ofl-font-runtime'), null).headline, 'No credit is required for this use of the recorded sources.');
});

test('delivery failed: a promised credential that is not in the file shows a retry, never a silent raw file', () => {
  const evaluation = evaluate('by-unchanged-placed');
  const missed = receipt(evaluation, {
    state: 'written',
    observed: [],
    remaining: [{ code: 'credential.ingredient-missing', summary: 'The delivered file does not carry this source.', remedies: [] }],
  });
  const view = rightsView(evaluation, missed, { retry: true });
  assert.equal(view.headline, 'The credits are not in the file that was delivered.');
  assert.equal(view.cards[0]!.code, 'credential.delivery-failed');
  assert.equal(view.cards[0]!.scope, '0 of 1 recorded sources were found in the file.');
  assert.deepEqual(view.cards[0]!.actions.map((a) => a.label), ['Export again', 'Copy credit']);
  // The credit is open beside the failure, because carrying it by hand is now the
  // only route left for this file.
  assert.equal(view.creditsOpen, true);
});

// ─── The mounted row ─────────────────────────────────────────────────────────

test('the SA card records a decision through the runtime and the row moves to prepared', () => {
  const root = panel();
  let decided: RightsDecisionV1[] = [];
  const runtime = fakeRuntime(() => evaluateCreativeUses(withDecisions(fixtureInput('by-sa-recoloured-shared'), decided)));
  runtime.setRightsDecision = (decision) => { decided = [...decided, decision]; runtime.decisions.push(decision); };
  const row = mountRightsRow(mountOpts(root, runtime));
  assert.deepEqual(cardLines(root), ['If you share this adaptation, it needs a compatible licence.']);

  const share = [...root.querySelectorAll<HTMLElement>('[data-rights-action]')].find((b) => b.textContent === 'Share the adaptation under CC BY-SA 4.0')!;
  share.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  assert.equal(runtime.decisions.length, 1);
  assert.equal(runtime.decisions[0]!.kind, 'output-licence');
  assert.equal(runtime.decisions[0]!.licence, 'CC-BY-SA-4.0');
  assert.equal(runtime.decisions[0]!.work, 'example/harbour-illustration');
  assert.ok(runtime.decisions[0]!.fingerprint, 'the decision is pinned to the evaluation it answered');
  assert.deepEqual(cardLines(root), []);
  assert.equal(headline(root), 'Source credits will be included.');
  row.destroy();
});

test("a separate permission is recorded as the person's own statement", () => {
  const root = panel();
  let notes: RightsDecisionV1[] = [];
  const runtime = fakeRuntime(() => evaluateCreativeUses(withDecisions(fixtureInput('by-sa-recoloured-shared'), notes)));
  runtime.setRightsDecision = (decision) => { notes = [...notes, decision]; runtime.decisions.push(decision); };
  const row = mountRightsRow(mountOpts(root, runtime));

  click(root, 'Record separate permission');
  const field = root.querySelector<HTMLElement>('[data-rights-permission]')!;
  assert.equal(field.hidden, false);
  root.querySelector<HTMLInputElement>('[data-rights-note]')!.value = 'Written permission from the artist, 2026-09-01';
  root.querySelector<HTMLElement>('[data-rights-note-save]')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  assert.equal(runtime.decisions.at(-1)!.kind, 'separate-permission');
  assert.equal(runtime.decisions.at(-1)!.note, 'Written permission from the artist, 2026-09-01');
  assert.deepEqual(cardLines(root), []);
  row.destroy();
});

test('the download stays available while an action is outstanding', () => {
  const root = panel();
  const runtime = fakeRuntime(() => evaluate('by-sa-recoloured-shared'));
  const row = mountRightsRow(mountOpts(root, runtime));
  const download = root.querySelector<HTMLButtonElement>('[data-action="download"]')!;
  assert.equal(download.disabled, false);
  assert.equal(download.hasAttribute('aria-disabled'), false);
  assert.deepEqual(cardLines(root), ['If you share this adaptation, it needs a compatible licence.']);
  row.destroy();
});

test('assistive tech hears one line per new issue, not one per recalculation', () => {
  const root = panel();
  const said: string[] = [];
  const runtime = fakeRuntime(() => evaluate('by-sa-recoloured-shared'));
  const row = mountRightsRow({ ...mountOpts(root, runtime), announce: (m) => said.push(m) });
  assert.deepEqual(said, ['If you share this adaptation, it needs a compatible licence.']);
  row.refresh();
  row.refresh();
  runtime.emojiChanged();
  assert.deepEqual(said, ['If you share this adaptation, it needs a compatible licence.'], 'a repaint is not news');
  row.destroy();
});

test('the failed delivery retries by running the same export again', () => {
  const root = panel();
  const evaluation = evaluate('by-unchanged-placed');
  const runtime = fakeRuntime(() => evaluation);
  runtime.receipt = receipt(evaluation, {
    state: 'written',
    observed: [],
    remaining: [{ code: 'credential.ingredient-missing', summary: 'missing', remedies: [] }],
  });
  let retried = 0;
  const row = mountRightsRow({ ...mountOpts(root, runtime), retry: () => { retried += 1; } });
  click(root, 'Export again');
  assert.equal(retried, 1);
  row.destroy();
});

test('Copy credit hands over the exact credit the plan built', async () => {
  const root = panel();
  const runtime = fakeRuntime(() => evaluate('clipboard-delivery-missing'));
  const copied: string[] = [];
  const row = mountRightsRow({ ...mountOpts(root, runtime), copy: (text) => { copied.push(text); } });
  root.querySelector<HTMLElement>('[data-action="rights-copy"]')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await Promise.resolve();
  assert.equal(copied.length, 1);
  assert.match(copied[0]!, /CC BY 4\.0/);
  row.destroy();
});

// ─── helpers that need the fixtures ──────────────────────────────────────────

function fixtureInput(name: string): RightsEvaluationInputV1 {
  return (JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURES), 'utf8')) as { input: RightsEvaluationInputV1 }).input;
}

function withDecisions(input: RightsEvaluationInputV1, decisions: RightsDecisionV1[]): RightsEvaluationInputV1 {
  return { ...input, decisions };
}

function cardLinesOf(view: { cards: { line: string }[] }): string[] {
  return view.cards.map((card) => card.line);
}

function click(root: ParentNode, label: string): void {
  const button = [...root.querySelectorAll<HTMLElement>('[data-rights-action]')].find((b) => b.textContent === label);
  if (!button) throw new Error(`no button labelled ${label}`);
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}

function mountOpts(root: HTMLElement, runtime: RightsRowRuntime): Parameters<typeof mountRightsRow>[0] {
  return {
    root,
    runtime,
    delivery: () => ({ format: 'png', canCarryCredential: true }),
    announce: () => {},
    copy: () => {},
    keepOriginal: () => {},
    replaceWork: () => {},
    now: () => '2026-09-13T00:00:00.000Z',
  };
}
