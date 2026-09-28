// SPDX-License-Identifier: MPL-2.0
/**
 * Cross-sheet overrides in the tool view must not depend on which CSS chunk loads first.
 *
 * Every lazy view sheet wraps itself in `@layer views` (styles/app.css declares the
 * order once), so two rules from two different view sheets with the same selector
 * are decided by SOURCE ORDER alone, and between two files source order means the
 * order the browser happens to insert their <link> tags. The dev server inserts
 * them in import order. A production build does not: views/tool.ts imports
 * tool.css before tool-chrome.css, yet the build put tool-chrome.css in a shared
 * chunk (export-format-picker-*.css) that the tool route loads BEFORE tool.css.
 * The phone layout lived in tool-chrome.css as `@media (max-width: 640px)
 * { .tool-layout { display: block } ... }`, restating tool.css's desktop rules at
 * the same specificity, so on lolly.tools at 390px the desktop rules won: a
 * zero-width stage, a 40px canvas and no Export|Save button. The dev server
 * looked right the whole time.
 *
 * What this pins, from source text only:
 *   1. No two view sheets that views/tool.ts imports restate the same selector
 *      with a DIFFERENT value for the same property under contexts that can both
 *      apply. Such a pair has no stable winner. Keep an override in the same file
 *      as the rule it overrides, or give it a more specific selector.
 *   2. The phone overrides of the tool layout sit in tool.css itself, after the
 *      base rule each one restyles.
 *
 * Limits: the scan compares identical selector text. Two different selectors of
 * equal specificity that match the same element are not detected, and the
 * browser-side result (the stage size at 390px) is checked by hand against a
 * production build, not here.
 *
 * Run directly:
 *   node --test shells/web/src/styles/tool-layout-order.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const SRC = join(import.meta.dirname, '..');

/** Comments blanked with newlines kept, so line numbers stay true. */
function decomment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

interface Rule { file: string; selector: string; body: string; at: string[]; line: number; index: number }

/** Every innermost `selector { ... }` with the at-rule preludes that wrap the rule. */
function rules(file: string): Rule[] {
  const css = decomment(readFileSync(join(SRC, file), 'utf8'));
  const out: Rule[] = [];
  const at: string[] = [];
  let prelude = '';
  let line = 1;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      if (head.startsWith('@')) { at.push(head.replace(/\s+/g, ' ')); i++; continue; }
      const start = line;
      let depth = 1;
      let body = '';
      i++;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) break; }
        if (css[i] === '\n') line++;
        body += css[i];
        i++;
      }
      out.push({ file, selector: head.replace(/\s+/g, ' '), body, at: [...at], line: start, index: out.length });
      i++;
      continue;
    }
    if (ch === '}') { at.pop(); prelude = ''; i++; continue; }
    prelude += ch;
    i++;
  }
  return out;
}

/** Top-level selector arms; a comma inside `:is(a, b)` or `[x="a,b"]` stays in its arm. */
function arms(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of selector) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((a) => a.trim()).filter(Boolean);
}

/** Declared properties: name to { value, important }. */
function decls(body: string): Map<string, { value: string; important: boolean }> {
  const map = new Map<string, { value: string; important: boolean }>();
  for (const chunk of body.split(';')) {
    const m = /^\s*([-\w]+)\s*:\s*([\s\S]*)$/.exec(chunk);
    if (!m) continue;
    const raw = m[2]!.replace(/\s+/g, ' ').trim();
    const important = /!\s*important$/i.test(raw);
    map.set(m[1]!, { value: raw.replace(/\s*!\s*important$/i, ''), important });
  }
  return map;
}

/** The conditions a rule depends on, with the cascade layer taken out. */
function conditions(rule: Rule): string {
  return rule.at.filter((a) => !a.startsWith('@layer')).join(' & ');
}

/** The view-layer sheets views/tool.ts imports, as paths under src/. */
function toolViewSheets(): string[] {
  const source = readFileSync(join(SRC, 'views/tool.ts'), 'utf8');
  const sheets = [...source.matchAll(/^import '\.\.\/(styles\/[^']+\.css)';/gm)].map((m) => m[1]!);
  return sheets.filter((sheet) => /@layer views\s*\{/.test(readFileSync(join(SRC, sheet), 'utf8')));
}

test('views/tool.ts still imports the sheets this guard reads', () => {
  const sheets = toolViewSheets();
  for (const sheet of ['styles/parts/tool.css', 'styles/parts/tool-chrome.css']) {
    assert.ok(sheets.includes(sheet), `views/tool.ts no longer imports ${sheet} as a views-layer sheet, so the order checks below would pass without reading that sheet. Update this test to follow the sheet.`);
  }
});

test('no two tool-view sheets override each other by load order', () => {
  const sheets = toolViewSheets();
  const byArm = new Map<string, Array<{ rule: Rule; arm: string }>>();
  for (const sheet of sheets) {
    for (const rule of rules(sheet)) {
      if (rule.at.some((a) => a.startsWith('@keyframes'))) continue;
      for (const arm of arms(rule.selector)) {
        const list = byArm.get(arm) ?? [];
        list.push({ rule, arm });
        byArm.set(arm, list);
      }
    }
  }
  const clashes: string[] = [];
  for (const [arm, sites] of byArm) {
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        const a = sites[i]!.rule;
        const b = sites[j]!.rule;
        if (a.file === b.file) continue;
        const ca = conditions(a);
        const cb = conditions(b);
        if (ca && cb && ca !== cb) continue;
        const da = decls(a.body);
        const db = decls(b.body);
        const props = [...da.keys()].filter((p) => {
          const x = da.get(p)!;
          const y = db.get(p);
          return y !== undefined && x.important === y.important && x.value !== y.value;
        });
        if (props.length) {
          clashes.push(`  ${arm} { ${props.join(', ')} }\n    ${a.file}:${a.line}${ca ? ` inside ${ca}` : ''}\n    ${b.file}:${b.line}${cb ? ` inside ${cb}` : ''}`);
        }
      }
    }
  }
  assert.deepEqual(clashes, [],
    `These rules restate a selector from another tool-view sheet with a different value, in the same cascade layer and at the same specificity, so the winner is whichever chunk the browser loads LAST. The dev server and the production build load them in different orders (the ≤640px layout once broke in production this way). Move the override into the same file as the rule it overrides, after it, or give it a more specific selector:\n${clashes.join('\n')}`);
});

test('the phone overrides of the tool layout follow their base rules in tool.css', () => {
  const file = 'styles/parts/tool.css';
  const all = rules(file);
  const isPhone = (r: Rule) => r.at.some((a) => /^@media\b.*\(max-width:\s*640px\)/.test(a));
  const overrides: Array<{ selector: string; prop: string; value: RegExp }> = [
    { selector: '.tool-layout', prop: 'display', value: /^block$/ },
    { selector: '.sidebar', prop: 'position', value: /^fixed$/ },
    { selector: '.tool-stage', prop: 'position', value: /^fixed$/ },
    { selector: '.sheet-grip', prop: 'display', value: /^flex$/ },
    { selector: '.render-pill', prop: 'display', value: /^inline-flex$/ },
    { selector: '.export-overlay', prop: 'display', value: /^block$/ },
  ];
  for (const { selector, prop, value } of overrides) {
    const base = all.find((r) => conditions(r) === '' && arms(r.selector).includes(selector) && decls(r.body).has(prop));
    const phone = all.find((r) => isPhone(r) && arms(r.selector).includes(selector) && decls(r.body).has(prop));
    assert.ok(base, `${file}: no unconditional "${selector} { ${prop} }" rule - the base rule this check pairs with has moved, so update the table here`);
    assert.ok(phone, `${file}: no @media (max-width: 640px) "${selector} { ${prop} }" rule. The phone layout belongs in tool.css, after the base rules it overrides: in any other sheet its equal-specificity rules win or lose on chunk load order, and production loads tool-chrome.css first`);
    assert.match(decls(phone.body).get(prop)!.value, value, `${file}:${phone.line}: the phone rule for ${selector} sets ${prop} to something new; check the ≤640px layout at 390px in a production build before changing this expectation`);
    assert.ok(phone.index > base.index,
      `${file}:${phone.line}: the phone rule for ${selector} comes BEFORE its base rule at line ${base.line}. They share a layer and a specificity, so the later one wins and the phone layout would lose on every screen size`);
  }
});
