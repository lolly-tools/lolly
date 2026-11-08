// SPDX-License-Identifier: MPL-2.0
/**
 * Fallback font slots in a tool's own font stacks (fallback-slots.ts): where the slot goes,
 * where it does not, and that only the CSSOM changes, never a <style> element's text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { toolDirs, toolFile } from '@lolly-tools/node-shell/content-roots';
import { addFallbackSlots, slotFamilies } from './fallback-slots.ts';

const SLOT = ' var(--lolly-fallback-families,)';

test('a slot goes after the fonts a stack names and before the system and generic ones', () => {
  const cases: Array<[string, string]> = [
    ['"SUSE", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', `"SUSE"${SLOT}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`],
    ['SUSE,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', `SUSE${SLOT},-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`],
    ['"SUSE Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', `"SUSE Mono"${SLOT}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`],
    ["'Outfit', 'SUSE', sans-serif", `'Outfit', 'SUSE'${SLOT}, sans-serif`],
    ['Brand Face', `Brand Face${SLOT}`],
    ['"a,b", serif', `"a,b"${SLOT}, serif`],
  ];
  for (const [value, slotted] of cases) assert.equal(slotFamilies(value), slotted, value);
});

test('no slot where a stack names no font of its own first, uses a variable or is a keyword', () => {
  for (const value of ['system-ui, sans-serif', 'Helvetica, Arial, sans-serif', 'var(--font-brand)', 'var(--ui-type-ui-family, system-ui, sans-serif)', 'inherit', 'unset', '']) {
    assert.equal(slotFamilies(value), value, value);
  }
  const once = slotFamilies('SUSE, sans-serif');
  assert.equal(slotFamilies(once), once, 'a second pass adds none');
});

/** A rule with a declaration block, as the CSSOM gives one. */
function rule(props: Record<string, string>, extra: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(props));
  const priority = new Map<string, string>();
  return {
    selectorText: '.x',
    ...extra,
    style: {
      getPropertyValue: (p: string) => values.get(p) ?? '',
      getPropertyPriority: (p: string) => priority.get(p) ?? '',
      setProperty: (p: string, v: string, pr = '') => { values.set(p, v); priority.set(p, pr); },
    },
    values,
    priority,
  };
}

test('every style rule gets a slot, nested and grouped ones too, and an @font-face does not', () => {
  const plain = rule({ 'font-family': '"SUSE", system-ui, sans-serif' });
  const important = rule({ 'font-family': 'SUSE' });
  important.priority.set('font-family', 'important');
  const nested = rule({ 'font-family': 'Face, serif' });
  const parent = rule({ color: 'red' }, { cssRules: [nested] });
  const media = { cssRules: [important] };
  const face = { style: rule({ 'font-family': 'SUSE' }).style };
  const brand = rule({ 'font-family': 'var(--font-brand)' });
  const sheet = { cssRules: [plain, parent, media, face, brand] } as unknown as CSSStyleSheet;
  assert.equal(addFallbackSlots(sheet), 3);
  assert.equal(plain.values.get('font-family'), `"SUSE"${SLOT}, system-ui, sans-serif`);
  assert.equal(important.values.get('font-family'), `SUSE${SLOT}`);
  assert.equal(important.priority.get('font-family'), 'important', 'the priority stays');
  assert.equal(nested.values.get('font-family'), `Face${SLOT}, serif`);
  assert.equal(face.style.getPropertyValue('font-family'), 'SUSE', 'an @font-face names one face');
  assert.equal(brand.values.get('font-family'), 'var(--font-brand)');
  assert.equal(addFallbackSlots(sheet), 0, 'a second pass adds none');
  assert.equal(addFallbackSlots(null), 0);
  assert.equal(addFallbackSlots({ get cssRules(): CSSRuleList { throw new Error('cross-origin'); } } as unknown as CSSStyleSheet), 0);
});

test('a <style> element keeps its text, so exports that copy the text are unchanged', () => {
  const dom = new JSDOM('<!doctype html><style>.t{font-family:"SUSE", system-ui, sans-serif}</style>');
  const el = dom.window.document.querySelector('style')!;
  const text = el.textContent;
  addFallbackSlots(el.sheet as unknown as CSSStyleSheet);
  assert.equal(el.textContent, text);
  assert.equal(el.cloneNode(true).textContent, text);
  dom.window.close();
});

test('the shipped tools whose own stacks get a slot', () => {
  const slotted: string[] = [];
  for (const id of toolDirs().keys()) {
    const sheets: string[] = [];
    const stylesPath = toolFile(id, 'styles.css');
    if (stylesPath) sheets.push(readFileSync(stylesPath, 'utf8'));
    const templatePath = toolFile(id, 'template.html');
    if (templatePath) for (const m of readFileSync(templatePath, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) sheets.push(m[1]!);
    const families = sheets.flatMap((css) => [...css.matchAll(/(?:^|[;{\s])font-family\s*:\s*([^;}]+)/g)].map((m) => m[1]!.replace(/\s*!important\s*$/, '')));
    if (families.some((f) => slotFamilies(f) !== f)) slotted.push(id);
  }
  // These tools once named SUSE or SUSE Mono first, so their pages needed the slot. They now
  // set their words in the design system's fonts (var(--font-brand), var(--font-mono)),
  // which carry the fallback fonts already.
  for (const id of ['frame', 'org-chart', 'prompt-card', 'record']) assert.ok(!slotted.includes(id), id);
  // A utility's own controls, which never reach an export, still name a font first: those
  // stacks get the slot.
  for (const id of ['compress-pdf', 'convert-image']) assert.ok(slotted.includes(id), id);
});
