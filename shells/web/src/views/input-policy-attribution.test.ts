// SPDX-License-Identifier: MPL-2.0
/**
 * Explainable input locks (C7): the fine print naming WHICH policy governs a
 * sidebar control.
 *
 * A governed control that says only "locked" makes the first question anyone
 * asks ("why?") unanswerable from the screen, so the sidebar prints the policy's
 * own name under the label. The half of this that matters most is the negative:
 * a shell with no control plane, or an instance that names no policy, must render
 * the row it always did, to the byte. Both directions are pinned here.
 *
 * A scan + evaluated expressions, for the same reason compact-option-grid.test.ts
 * does it: tool-inputs.ts cannot be imported outside Vite (it resolves siblings
 * with `.js` specifiers and pulls flatpickr). The two decisions are pure, so this
 * lifts them from the real source and runs the truth table against them.
 *
 * Run directly:  node --test shells/web/src/views/input-policy-attribution.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(import.meta.dirname, 'tool-inputs.ts'), 'utf8');

type Pol = { mode: string; by?: string; reason?: string } | undefined;

/** The real body of policyAttribution, with t() injected as an English identity. */
const attrBody = SRC.match(
  /export function policyAttribution\(policy: InputPolicy \| undefined, managed: boolean\): string \{([\s\S]*?)\n\}/,
)?.[1];
assert.ok(attrBody, 'policyAttribution is one liftable function body');
const tStub = (src: string, params?: Record<string, string>): string =>
  src.replace(/\{(\w+)\}/g, (_m, k: string) => params?.[k] ?? `{${k}}`);
const attribution = new Function('t', 'policy', 'managed', attrBody!.replace(/: string/g, '')) as (
  t: typeof tStub, policy: Pol, managed: boolean,
) => string;
const attr = (policy: Pol, managed = true): string => attribution(tStub, policy, managed);

/** The real notice-slot construction, with escape() injected. */
const noticeBody = SRC.match(/(const noticeText = \[[\s\S]*?const notice = noticeText[\s\S]*?: '';)/)?.[1];
assert.ok(noticeBody, 'the notice slot is one liftable expression pair');
const buildNotice = new Function('input', 'policyNote', 'escape', `${noticeBody}\nreturn notice;`) as (
  input: { id: string; notice?: string }, policyNote: string, escape: (s: string) => string,
) => string;
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const notice = (input: { id: string; notice?: string }, policyNote = ''): string =>
  buildNotice(input, policyNote, esc);

test('a governed control names the policy that governs it', () => {
  assert.equal(attr({ mode: 'locked', by: 'Brand guardrails' }), 'Set by Brand guardrails');
  assert.equal(
    attr({ mode: 'locked', by: 'Brand guardrails', reason: 'One mark per campaign' }),
    'Set by Brand guardrails: One mark per campaign',
    'the author\'s reason rides the same line when they wrote one',
  );
  // A narrowed select is governed too - its options were chosen for the person,
  // and that is exactly as worth explaining as a lock.
  assert.equal(attr({ mode: 'choice', by: 'Brand guardrails' }), 'Set by Brand guardrails');
});

test('nothing to attribute means nothing is rendered', () => {
  assert.equal(attr(undefined), '', 'no policy at all - the plain-Lolly path');
  assert.equal(attr({ mode: 'locked' }), '', 'governed by an instance that names no policy');
  assert.equal(attr({ mode: 'locked', by: 'X' }, false), '', 'an ungoverned control attributes nothing');
  // Hidden is hidden: those rows never reach the renderer, and the helper refuses
  // to explain one even if a caller hands it over.
  assert.equal(attr({ mode: 'hidden', by: 'X' }), '');
  // A reason without a source names nobody, so it says nothing rather than
  // printing a bare sentence with no author.
  assert.equal(attr({ mode: 'locked', reason: 'Because' }), '');
});

test('the attribution is HTML-safe without a second escape', () => {
  // t() escapes its params (i18n.ts), which is why the caller does NOT escape()
  // this fragment. The identity stub here cannot prove that, so pin the contract
  // the other way: the source must interpolate through t(), never a raw template.
  assert.match(attrBody!, /t\('Set by \{policy\}'/);
  assert.match(attrBody!, /t\('Set by \{policy\}: \{reason\}'/);
  assert.doesNotMatch(attrBody!, /\$\{policy\.by\}/, 'never interpolated into markup by hand');
});

test('with no attribution the notice slot is byte-identical to before', () => {
  assert.equal(notice({ id: 'bg' }), '', 'no authored notice, no policy - no markup at all');
  assert.equal(
    notice({ id: 'bg', notice: 'Sent to the printer' }),
    '<span class="input-notice" id="inotice-bg" aria-hidden="true">Sent to the printer</span>',
    'an authored notice alone renders exactly the markup it always did',
  );
  assert.equal(
    notice({ id: 'b&g', notice: '<b>hi</b>' }),
    '<span class="input-notice" id="inotice-b&amp;g" aria-hidden="true">&lt;b&gt;hi&lt;/b&gt;</span>',
    'the authored notice and the id are still escaped',
  );
});

test('an attribution fills the same fine-print slot, beside an authored notice', () => {
  assert.equal(
    notice({ id: 'bg' }, 'Set by Brand guardrails'),
    '<span class="input-notice" id="inotice-bg" aria-hidden="true">Set by Brand guardrails</span>',
  );
  assert.equal(
    notice({ id: 'bg', notice: 'Sent to the printer' }, 'Set by Brand guardrails'),
    '<span class="input-notice" id="inotice-bg" aria-hidden="true">Sent to the printer Set by Brand guardrails</span>',
    'both share one span, so linkHelpDescriptions still has a single describedby target',
  );
});

test('the attribution reaches a screen reader on a locked (inert) control', () => {
  // The fine print is aria-hidden and the locked control is `inert`, so its
  // describedby never reaches assistive tech. Without this the answer to "why is
  // this locked?" would be sighted-only, which is the one audience least able to
  // go hunting for it.
  const line = SRC.match(/const chipLabel = .*/)?.[0];
  assert.ok(line, 'the lock chip composes one accessible name');
  assert.match(line!, /policyNote/, 'the attribution rides the chip name');
  assert.match(SRC, /aria-label="\$\{chipLabel\}"/, 'and the chip actually uses it');
  const buildLabel = new Function('pol', 'policyNote', 'escape', `${line}\nreturn chipLabel;`) as (
    pol: Pol & { note?: string } | undefined, policyNote: string, escape: (s: string) => string,
  ) => string;
  assert.equal(
    buildLabel({ mode: 'locked', note: 'Managed by Acme' }, 'Set by Brand guardrails', esc),
    'Managed by Acme. Set by Brand guardrails',
  );
  assert.equal(
    buildLabel({ mode: 'locked', note: 'Managed by Acme' }, '', esc),
    'Managed by Acme',
    'with nothing to attribute the chip keeps the name it always had',
  );
});

test('an attribution pins the label static, the same way an authored notice does', () => {
  // The notice sits between label and field, which the floating-label offset math
  // cannot account for. A policy line uses that same slot, so it has to make the
  // same decision - missing this is a label painted over the control.
  const expression = SRC.match(/const isStaticLabel\s*=[\s\S]*?Boolean\(policyNote\);/)?.[0];
  assert.ok(expression, 'isStaticLabel includes the complete expression');
  assert.match(expression!, /Boolean\(policyNote\)/);
});
