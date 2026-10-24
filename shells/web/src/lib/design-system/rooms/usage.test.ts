// SPDX-License-Identifier: MPL-2.0
/**
 * The Usage room's rule cards: a Design house rule (plan 291 W3) is checked by Design's
 * export checks and by `lolly check`, so its card says so, while a kind no checker knows
 * keeps the "Unchecked" badge.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/rooms/usage.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="room"></div></body></html>', { url: 'http://localhost/#/start' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

const { mountUsageRoom } = await import('./usage.ts');
type UsageHost = Parameters<typeof mountUsageRoom>[1]['host'];

const rule = (id: string, kind: string, roleIds: string[] = []) => ({
  id, label: `${id} label`, kind, roleIds, parameters: {}, scope: { tools: ['design'] },
  requirement: 'required', origin: { kind: 'manual', author: 'test' }, review: { state: 'draft' },
});

const DOC = {
  color: { ink: { $type: 'color', $value: '#112233' } },
  $extensions: {
    'com.suse.lolly': {
      brandSystem: {
        schemaVersion: 1, id: 'test', label: 'Test', roles: [], bindings: [],
        rules: [rule('headline-weight', 'text-weight'), rule('logo-surface', 'logo-surface'), rule('future', 'clear-space')],
      },
    },
  },
};

const host = {
  tokens: {
    raw: async () => DOC,
    snapshot: async () => ({ document: DOC }),
    active: async () => ({ label: 'Test brand' }),
  },
} as unknown as UsageHost;

test('a house rule reads as checked in Design, an unknown kind as unchecked', async () => {
  const el = document.getElementById('room')!;
  mountUsageRoom(el, { host, readonly: true });
  for (let i = 0; i < 20 && !el.querySelector('.usage-rule'); i++) await new Promise((r) => setTimeout(r, 5));
  const cards = [...el.querySelectorAll<HTMLElement>('.usage-rule')];
  assert.equal(cards.length, 3, el.textContent ?? '');
  const card = (label: string) => cards.find((c) => c.querySelector('h3')?.textContent === label)!;

  const weight = card('headline-weight label');
  assert.ok(weight.querySelector('[data-checker="design"]'), 'the house rule carries the Design checker badge');
  assert.doesNotMatch(weight.textContent ?? '', /Unchecked|no checker/);
  assert.match(weight.textContent ?? '', /lolly check/);
  assert.match(weight.textContent ?? '', /Draft/);
  // A house rule with no role shows its kind in words, not the raw kind id.
  assert.match(card('logo-surface label').querySelector('.usage-rule-copy p')?.textContent ?? '', /Logo per surface/);

  const future = card('future label');
  assert.equal(future.querySelector('[data-checker]'), null);
  assert.match(future.textContent ?? '', /Unchecked/);
  assert.match(future.textContent ?? '', /no checker/);
});

test('the Brand mode list offers the looks only, because a colourway is another axis (plans/319)', async () => {
  const { deriveBrandTokens } = await import('@lolly/engine');
  const { addLead } = await import('../leads.ts');
  const added = addLead(deriveBrandTokens({ primary: '#0c322c', name: 'Test' }), { colour: '#e05a2b', name: 'Persimmon', canonical: { name: 'Pine' } });
  assert.ok(added.ok, added.ok ? '' : added.reasons.join(' '));
  const own = (added.doc.$extensions ?? {}) as Record<string, Record<string, unknown>>;
  const doc = { ...added.doc, $extensions: { ...own, 'com.suse.lolly': { ...(own['com.suse.lolly'] ?? {}), ...DOC.$extensions['com.suse.lolly'] } } };
  const leadHost = {
    tokens: { raw: async () => doc, snapshot: async () => ({ document: doc }), active: async () => ({ label: 'Test brand' }) },
  } as unknown as UsageHost;
  const el = document.createElement('div');
  document.body.append(el);
  mountUsageRoom(el, { host: leadHost, readonly: true });
  for (let i = 0; i < 40 && !el.querySelector('[data-mode]'); i++) await new Promise((r) => setTimeout(r, 5));
  const options = [...el.querySelectorAll<HTMLOptionElement>('[data-mode] option')].map(o => o.value);
  assert.deepEqual(options, ['', 'light', 'dark'], 'Pine and Persimmon are not modes');
  el.remove();
});

test('the Brand mode menu names the mode the empty value renders', async () => {
  const { defaultModeName } = await import('./usage.ts');
  const { readFileSync } = await import('node:fs');
  const read = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
  const demo = read('../../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
  const starter = read('../../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');
  assert.equal(defaultModeName(demo), 'light');
  assert.equal(defaultModeName(starter), 'light');
  // A document whose stored selection is dark renders dark with no theme asked
  // for, so the default is named dark, not after the first theme in the list.
  const groups = (demo.$themes as Array<{ group?: string; id?: string; name?: string; kind?: string }>);
  const modeGroup = groups.find(theme => theme.name === 'dark')?.group ?? '';
  const darkId = groups.find(theme => theme.name === 'dark')?.id ?? 'dark';
  const storedDark = { ...demo, $metadata: { ...(demo.$metadata as object ?? {}), activeThemeSelection: { [modeGroup]: darkId } } };
  assert.equal(defaultModeName(storedDark), 'dark');
  assert.equal(defaultModeName({ color: { ink: { $type: 'color', $value: '#112233' } } }), '', 'no themes, no name: the menu says Default');
});

test('"Checked in Design" stays true: the export panel runs the house rules through creation feedback', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
  // The Design export audit loads the creation feedback rows when the panel opens...
  assert.match(read('../../../views/tool-actions/preflight.ts'), /import\('\.\.\/\.\.\/lib\/creation-feedback\.ts'\)[\s\S]*creationFeedbackRows\(await readCreationFeedback\(/);
  // ...which read the engine report...
  assert.match(read('../../creation-feedback.ts'), /creationFeedback\(boxes, undefined, doc \?\? null, opts\)/);
  // ...and that report checks the design system's house rules layer by layer.
  assert.match(read('../../../../../../engine/src/creation-feedback.ts'), /checkDesignHouseRules\(boxes, designRules, doc,/);
});
