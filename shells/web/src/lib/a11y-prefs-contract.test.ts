// SPDX-License-Identifier: MPL-2.0
/**
 * Accessibility-preference DRIFT GUARDS - static reads of the places the feature
 * is spelled out a second time, where a well-meaning edit can silently break an
 * invariant that no runtime unit test can see:
 *
 *   1. the gated CSS (parts/base.css, tokens.css, parts/a11y.css) - must stay
 *      attribute-gated on <html> (dormant by default) and must keep the render
 *      canvas and the offscreen export stages out of every gated rule;
 *   2. the `--a11y-fs` type multiplier - ~950 chrome `font-size` declarations, plus
 *      the chrome icon sizes that ride the same factor (an icon that did not grow
 *      with its label left the icon-only controls unreachable by the preference),
 *      are written `calc(<len> * var(--a11y-fs))`, and their additivity rests on
 *      the unconditional default being exactly 1 and on not one of them living
 *      inside a rule that paints the user's render. No human can re-check a
 *      thousand declarations, so the scan below does it per-declaration;
 *   3. index.html's pre-paint FOUC script - a hand-inlined copy of what
 *      lib/a11y-prefs.ts writes, so it cannot import the module and cannot be
 *      kept honest by anything except a test like this one. This repo has been
 *      bitten by two-copies drift before (see the schema drift guard);
 *   4. app.css's layer declaration - the high-contrast token overrides only win
 *      because tokens.css is imported UNLAYERED; layering it would silently
 *      neuter the preference.
 *
 * Deliberately structural: no colour value and no multiplier NUMBER is asserted
 * (those are design choices, tunable in one edit, and pinning them would make
 * this test a chore). What is asserted is the shape that keeps the feature
 * additive - plus, for the multiplier, that the default is 1, because a default
 * of anything else changes type for users who set no preference at all.
 *
 * Run directly:  node --test shells/web/src/lib/a11y-prefs-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { A11Y_STORE_KEY } from './a11y-prefs.ts';

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // this file lives at src/lib/
const WEB_DIR = dirname(SRC_DIR);

/** The pref ↔ attribute ↔ value ↔ dataset-property table, as the feature defines it. */
const PREFS = [
  { key: 'reduceMotion', attr: 'data-a11y-motion', value: 'reduce', dataset: 'a11yMotion', sheet: 'styles/parts/base.css' },
  { key: 'highContrast', attr: 'data-a11y-contrast', value: 'high', dataset: 'a11yContrast', sheet: 'styles/tokens.css' },
  { key: 'largeText', attr: 'data-a11y-text', value: 'large', dataset: 'a11yText', sheet: 'styles/parts/a11y.css' },
  { key: 'hidePreviews', attr: 'data-a11y-previews', value: 'hidden', dataset: 'a11yPreviews', sheet: 'styles/parts/gallery.css' },
] as const;

/** The type multiplier every chrome font-size is written through. */
const FS_VAR = '--a11y-fs';
const FS_USE = /var\(\s*--a11y-fs\s*\)/;

/**
 * The sacred surfaces: the live render canvas and the OFFSCREEN stages that
 * exports and nested renders are rasterised from (pro/render-export.ts's
 * `pro-export-canvas` also serves /pro batch rows, every `compose` child render,
 * featured-row renders and the boot personalize previews; views/multi-edit.ts
 * owns `.me-canvas`/`.me-scale`). A preference may not change one pixel inside
 * any of them - export geometry is shared with the CLI render path.
 */
const PROTECTED = [
  '.tool-canvas', '#tool-canvas', '#tool-canvas-outer', '#tool-content',
  '.pro-export-canvas', '.me-canvas', '.me-scale',
] as const;

// ── Reading ──────────────────────────────────────────────────────────────────

function read(rel: string): string {
  return readFileSync(join(SRC_DIR, rel), 'utf8');
}

/** Comments blanked (newlines preserved, so reported line numbers stay true). */
function decomment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkCss(p, out);
    else if (entry.name.endsWith('.css')) out.push(p);
  }
  return out;
}

const ALL_CSS = walkCss(SRC_DIR).map((p) => ({
  rel: relative(SRC_DIR, p).split(sep).join('/'),
  text: decomment(readFileSync(p, 'utf8')),
}));

interface Rule { selector: string; body: string; at: string[]; line: number }

/**
 * Flat rule list: every innermost `selector { … }`, with the at-rule preludes it
 * sits inside. Enough of a parser for structural assertions - the sheets here
 * are hand-written and shallow (no CSS nesting in this codebase).
 */
function rules(css: string): Rule[] {
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
      if (head.startsWith('@')) {
        at.push(head);
        i++;
        continue;
      }
      // Declaration block: consume to the matching close (no nesting expected).
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
      out.push({ selector: head.replace(/\s+/g, ' '), body, at: [...at], line });
      i++;
      continue;
    }
    if (ch === '}') { at.pop(); prelude = ''; i++; continue; }
    prelude += ch;
    i++;
  }
  return out;
}

/** Every rule in every sheet, once. */
const ALL_RULES = ALL_CSS.flatMap(({ rel, text }) => rules(text).map((r) => ({ ...r, rel })));

/** Declared properties in a block body (`prop: value` pairs, custom props included). */
function decls(body: string): Array<[string, string]> {
  return body.split(';').flatMap((chunk) => {
    const m = /^\s*([-\w]+)\s*:\s*([\s\S]*)$/.exec(chunk);
    return m ? [[m[1]!, m[2]!.trim()] as [string, string]] : [];
  });
}

/** Split a selector list on TOP-LEVEL commas only (a `:not(a, b)` is one arm). */
function arms(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of selector) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((a) => a.trim()).filter(Boolean);
}

/**
 * Drop every `:not(…)` (parens balanced, so `:not(:where(a, b))` goes whole).
 * A protected name inside a :not() is an EXEMPTION - it keeps the canvas OUT of
 * the rule - whereas the same name in the remaining part TARGETS the canvas, so
 * the two must never be confused.
 */
function stripNot(selector: string): string {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    if (selector.startsWith(':not(', i)) {
      let depth = 0;
      let j = i + 4;
      for (; j < selector.length; j++) {
        if (selector[j] === '(') depth++;
        else if (selector[j] === ')') { depth--; if (depth === 0) break; }
      }
      i = j + 1;
      continue;
    }
    out += selector[i];
    i++;
  }
  return out;
}

/** Which protected surface a selector fragment names, if any (whole token only). */
function protectedIn(fragment: string): string | undefined {
  return PROTECTED.find((name) => new RegExp(`${name.replace(/[.#]/g, '\\$&')}(?![-\\w])`).test(fragment));
}

/** Is this rule inside the a11y feature - gated on the selector or by an at-rule? */
function isA11yGated(rule: Rule): boolean {
  return rule.selector.includes('data-a11y') || rule.at.some((a) => a.includes('data-a11y'));
}

test('sanity: the sheets under guard were actually found', () => {
  assert.ok(ALL_CSS.length > 20, `only ${ALL_CSS.length} stylesheets found under ${SRC_DIR}`);
  assert.ok(ALL_RULES.length > 1000, `only ${ALL_RULES.length} rules parsed - the rule scanner has stopped seeing the sheets`);
  for (const { sheet } of PREFS) assert.ok(read(sheet).length > 100, `${sheet} looks empty`);
});

// ── (a) Everything a11y is attribute-gated ───────────────────────────────────

test('every data-a11y reference in every stylesheet is a gated attribute selector', () => {
  const allowed = new Set(PREFS.map((p) => `[${p.attr}="${p.value}"]`));
  for (const { rel, text } of ALL_CSS) {
    for (const m of text.matchAll(/\[?data-a11y[^\s,{)]*/g)) {
      // The full attribute-selector form, re-read from the source position.
      const full = /^\[data-a11y-[a-z]+="[a-z]+"\]$/.test(m[0]) ? m[0] : /\[data-a11y-[a-z]+="[a-z]+"\]/.exec(text.slice(m.index)) ?.[0];
      assert.ok(
        full && allowed.has(full),
        `${rel}: "${m[0]}" is not one of the three gated forms ${[...allowed].join(' ')} - a presence-only ` +
        `[data-a11y-text] or a typo'd value silently changes who the rule applies to`,
      );
    }
    assert.equal(
      /:not\([^)]*data-a11y/.test(text), false,
      `${rel}: a :not([data-a11y…]) inversion applies the a11y styling to documents with NO preference set - ` +
      'the feature must be dormant by default',
    );
  }
});

test('each pref is gated in its documented sheet, and every gated rule names an attribute', () => {
  for (const { key, attr, value, sheet } of PREFS) {
    const text = decomment(read(sheet));
    assert.ok(
      text.includes(`[${attr}="${value}"]`),
      `${sheet} carries no [${attr}="${value}"] rule - lib/a11y-prefs.ts documents it as the home of ${key}`,
    );
    for (const rule of rules(text)) {
      const inAtGate = rule.at.some((a) => a.includes(attr));
      if (!rule.selector.includes('data-a11y') && !inAtGate) continue;
      assert.ok(
        rule.selector.includes(`[${attr}="${value}"]`) || rule.selector.includes('data-a11y') || inAtGate,
        `${sheet}:${rule.line}: "${rule.selector}" - a11y rules must carry the gate on the selector itself`,
      );
    }
  }
});

test('every gated block in the three a11y sheets hangs off <html>, arm by arm', () => {
  // brand-vars.ts appends an UNLAYERED <style> at (0,1,0) - `html[data-a11y-…]`
  // is (0,1,1) and wins, a bare `[data-a11y-…]` ties and loses on source order.
  // It is also the only form that cannot match a document with no preference:
  // an arm that drops the attribute (a stray comma while editing a selector
  // list) leaks the whole block to everyone.
  let checked = 0;
  for (const { sheet } of PREFS) {
    const text = decomment(read(sheet));
    for (const rule of rules(text)) {
      if (!isA11yGated(rule)) continue;
      for (const arm of arms(rule.selector)) {
        checked++;
        assert.match(
          arm, /^(html|:root)\[data-a11y-[a-z]+="[a-z]+"\]/,
          `${sheet}:${rule.line}: "${arm}" must lead with html[data-a11y-…="…"] - an ungated arm applies the ` +
          'preference to users who never asked for it, and a bare attribute selector loses to brand-vars.ts',
        );
      }
    }
  }
  assert.ok(checked > 10, `only ${checked} gated selector arms scanned - the gate scan has stopped matching`);
});

// ── (b) The render canvas and the export stages stay sacred ──────────────────

test('both reduce-motion blocks (OS media query AND the app attribute) exempt the SAME surfaces', () => {
  const base = decomment(read('styles/parts/base.css'));
  const broad = rules(base).filter((r) =>
    (r.at.some((a) => a.includes('prefers-reduced-motion')) || r.selector.includes('data-a11y-motion')) &&
    /(^|\s)\*|:not\(/.test(r.selector));
  assert.ok(broad.length >= 2, `expected the OS block and the attribute block to both carry a broad rule, found ${broad.length}`);

  /** The exempted selector set of one broad rule, order-insensitive. */
  const exemptSet = (rule: Rule): string[] => {
    const inNot = [...rule.selector.matchAll(/:not\(([^)]*)\)/g)].flatMap((m) => arms(m[1]!));
    return [...new Set(inNot.map((s) => s.replace(/\s+/g, ' ').trim()))].sort();
  };
  const osRules = broad.filter((r) => r.at.some((a) => a.includes('prefers-reduced-motion')));
  const attrRules = broad.filter((r) => r.selector.includes('data-a11y-motion'));
  assert.ok(osRules.length > 0 && attrRules.length > 0, 'expected broad rules in BOTH the OS block and the attribute block');

  // The two blocks are the same rules gated two ways; a surface exempted from one
  // and not the other means the same render freezes or animates depending only on
  // WHERE the user set the preference.
  const osSet = exemptSet(osRules[0]!);
  const attrSet = exemptSet(attrRules[0]!);
  assert.deepEqual(attrSet, osSet,
    `styles/parts/base.css: the OS @media block (:${osRules[0]!.line}) and the attribute block (:${attrRules[0]!.line}) ` +
    'exempt different surfaces - they are the same rules gated two ways and must not drift');

  // Every broad rule in either block (the ::before/::after restatements included)
  // must exempt the render canvas AND the offscreen export stages.
  for (const rule of broad) {
    const exempt = exemptSet(rule).join(' ');
    for (const surface of PROTECTED) {
      if (surface === '#tool-canvas' || surface === '#tool-canvas-outer') continue; // covered by .tool-canvas
      assert.ok(
        new RegExp(`${surface.replace(/[.#]/g, '\\$&')}(?![-\\w])`).test(exempt),
        `styles/parts/base.css:${rule.line}: "${rule.selector}" freezes animation without exempting ${surface} - ` +
        'a calmed chrome must never reach into the user\'s render, and an offscreen export stage that stops ' +
        'animating exports the wrong frame',
      );
    }
  }
});

/**
 * The ONE reason a gated rule may name a protected surface outside a `:not()`:
 * putting a value BACK to what it is with the preference off.
 *
 * parts/base.css's `body { color: hsl(var(--foreground)) }` is inherited by tool
 * markup (most templates set no colour, several draw with `currentColor`), so
 * when high contrast re-points --foreground the canvas and every offscreen export
 * stage inherit the new ink - changing exported pixels, and baking into session
 * thumbnails and preview renders whose cache keys carry no preference component.
 * The fix is a restore rule at the canvas boundary, which necessarily targets the
 * canvas. It is safe for exactly one reason: every value it sets comes from a
 * `--*-canvas` base token that no gated block ever re-points.
 *
 * So the allowance is narrow by construction rather than by good intentions: the
 * properties are enumerated, and every value must resolve through a base token.
 * A restore rule that set anything else - a size, a different token, a literal - 
 * fails, which is the point.
 */
const RESTORE_PROPS = new Set(['--foreground', 'color']);
const RESTORE_VALUE = /^(?:var\(\s*--[-\w]+-canvas\s*\)|hsl\(\s*var\(\s*--[-\w]+-canvas\s*\)\s*\))$/;

function isBaseRestore(rule: Rule): boolean {
  const d = decls(rule.body);
  return d.length > 0 && d.every(([prop, value]) => RESTORE_PROPS.has(prop) && RESTORE_VALUE.test(value));
}

test('no a11y-gated rule TARGETS the render canvas or an export stage', () => {
  // A protected name may appear in a gated selector only inside a :not() - i.e.
  // as an exemption keeping the surface out - or in a base-restore rule (above).
  // Nothing else about a preference may reach in: exports must be byte-identical
  // with the preference on, because the render path is shared with the CLI.
  let exemptions = 0;
  let restores = 0;
  for (const rule of ALL_RULES) {
    if (!isA11yGated(rule)) continue;
    if (protectedIn(stripNot(rule.selector)) && isBaseRestore(rule)) { restores++; continue; }
    for (const arm of arms(rule.selector)) {
      if (protectedIn(arm)) exemptions++;                    // named somewhere in this arm
      const hit = protectedIn(stripNot(arm));
      assert.equal(
        hit, undefined,
        `${rule.rel}:${rule.line}: "${arm}" targets ${hit} - an accessibility preference must not restyle the ` +
        'render canvas or an offscreen export stage (export geometry is shared with the CLI render path). If this ' +
        'rule exists to put an inherited value BACK to its preference-off value, every declaration in it must ' +
        `set one of [${[...RESTORE_PROPS].join(', ')}] from a --*-canvas base token`,
      );
    }
  }
  // The restore rule must EXIST: without it, high contrast leaks its ink into
  // every render through the inherited body colour.
  assert.equal(restores, 1, `expected exactly 1 base-restore rule at the canvas boundary, found ${restores} - ` +
    'high contrast re-points --foreground, which parts/base.css\'s body colour inherits straight into the canvas ' +
    'and the offscreen export stages');
  // Non-vacuity: base.css's two motion blocks and a11y.css's focus-ring block all
  // name the protected surfaces inside :not(), so a scan that sees none has lost
  // its grip on the selectors rather than proving anything.
  assert.ok(exemptions >= 3, `only ${exemptions} gated selector arms mention a protected surface at all - the ` +
    'exemptions that keep the canvas out have gone missing, or this scan stopped seeing them');
});

// ── (c) Large text: one multiplier, defaulting to 1 ──────────────────────────

test('largeText is a --a11y-fs multiplier: one gated override, one unconditional default of 1', () => {
  const gate = `[${PREFS[2].attr}="${PREFS[2].value}"]`;
  const sites = ALL_RULES.flatMap((r) => decls(r.body)
    .filter(([prop]) => prop === FS_VAR)
    .map(([, value]) => ({ value, gated: r.selector.includes(gate), where: `${r.rel}:${r.line}`, selector: r.selector, at: r.at })));

  const gated = sites.filter((s) => s.gated);
  const defaults = sites.filter((s) => !s.gated);

  assert.equal(gated.length, 1,
    `expected exactly ONE ${FS_VAR} override under ${gate} (documented home: ${PREFS[2].sheet}), found ` +
    `${gated.length} (${gated.map((s) => s.where).join(', ')}) - two factors in two sheets is how the chrome ends ` +
    'up scaling by different amounts in different views');
  assert.ok(gated[0]!.where.startsWith(PREFS[2].sheet), `the ${gate} override moved to ${gated[0]!.where}; ` +
    `lib/a11y-prefs.ts documents ${PREFS[2].sheet} as the home of largeText`);
  // The iOS Dynamic Type ratio (main.ts initMobilePlatformFit, written INLINE as
  // --a11y-os-fs) composes into the multiplier here: with the pref on, the larger
  // of the ratio and the pref factor wins. The probe must NOT write --a11y-fs
  // itself - an inline value on <html> outranks this attribute rule and freezes
  // the toggle - so the exact composed form is pinned, factor and all.
  assert.match(gated[0]!.value, /^max\(var\(--a11y-os-fs, 1\), [0-9]*\.?[0-9]+\)$/,
    `${FS_VAR} under ${gate} must be max(var(--a11y-os-fs, 1), <factor>) so the OS ratio and the pref compose, got "${gated[0]!.value}"`);

  // The default is asserted; the ON factor is not. The factor is a design choice
  // (tunable in one edit), but a default other than 1 changes type for every
  // user who set NO preference, which is the additivity guarantee itself.
  assert.equal(defaults.length, 1,
    `expected exactly ONE unconditional ${FS_VAR} default, found ${defaults.length} ` +
    `(${defaults.map((s) => s.where).join(', ')}) - ~950 font-size calc()s resolve against it, so a second ` +
    'declaration decides the whole chrome type scale by cascade accident');
  const def = defaults[0]!;
  assert.equal(def.value, 'var(--a11y-os-fs, 1)',
    `the unconditional ${FS_VAR} default is "${def.value}" (${def.where}) - it must be var(--a11y-os-fs, 1), ` +
    'which resolves to 1 for every user who set no preference on a device with no Dynamic Type probe (the ' +
    'additivity guarantee), while letting the probed OS ratio scale the chrome on its own');
  // The additivity guarantee needs --a11y-os-fs itself to default to 1,
  // unconditionally, in the same declaration block.
  const osDefaults = ALL_RULES.flatMap((r) => decls(r.body)
    .filter(([prop]) => prop === '--a11y-os-fs')
    .map(([, value]) => ({ value, selector: r.selector, at: r.at, where: `${r.rel}:${r.line}` })));
  assert.equal(osDefaults.length, 1,
    `expected exactly ONE --a11y-os-fs declaration in CSS (main.ts writes the probed value inline), found ` +
    `${osDefaults.length} (${osDefaults.map((s) => s.where).join(', ')})`);
  assert.equal(osDefaults[0]!.value, '1', `the --a11y-os-fs CSS default must be 1, got "${osDefaults[0]!.value}"`);
  assert.match(osDefaults[0]!.selector, /^(:root|html)$/, `--a11y-os-fs default must be unconditional, declared on "${osDefaults[0]!.selector}"`);
  assert.deepEqual(osDefaults[0]!.at, [], `--a11y-os-fs default sits inside ${osDefaults[0]!.at.join(' / ')} - it must be unconditional`);
  assert.notEqual(gated[0]!.value, def.value,
    `the ${gate} override restates the default (${def.value}) - largeText would be a no-op`);
  // Ownership moved between parts/a11y.css and styles/tokens.css during this
  // work; either is fine, an unattributed root rule in a third sheet is not.
  assert.ok(
    def.where.startsWith('styles/parts/a11y.css') || def.where.startsWith('styles/tokens.css'),
    `the ${FS_VAR} default lives at ${def.where} - it belongs beside the feature (styles/parts/a11y.css) or ` +
    'with the other design tokens (styles/tokens.css), where the next reader will look for it',
  );
  assert.match(def.selector, /^(:root|html)$/,
    `the ${FS_VAR} default is declared on "${def.selector}" - it must be unconditional (:root or html) so no ` +
    'document can inherit an undefined var and drop every font-size to its inherited value');
  assert.deepEqual(def.at, [],
    `the ${FS_VAR} default sits inside ${def.at.join(' / ')} - a conditional default leaves the var undefined ` +
    'wherever the condition is false');
});

/**
 * The properties the multiplier is allowed to leave through - GLYPH SIZE and
 * nothing else.
 *
 * Type: font-size / line-height. Icons: an icon is a glyph too, so chrome svg,
 * caret and checkbox marks ride the SAME factor (there is deliberately no second
 * token - see the note in styles/parts/a11y.css), and an icon's size is written
 * on its box (width/height, min-* so a flex row can't shrink it back, flex-basis)
 * or on its paint (background-size / mask-size for CSS-mask marks, stroke-width).
 * Custom properties are allowed because that is where geometry which must follow
 * the type is scaled ONCE, at its declaration (styles/tokens.css, lib/jelly.ts).
 *
 * Everything else is absent on purpose: padding, margin, gap, inset, border-width,
 * translate, z-index. The mechanism turning back into a whole-UI zoom would look
 * exactly like one of those appearing here, one declaration at a time.
 */
const SCALABLE_PROPS = new Set([
  'font-size', 'line-height',
  'width', 'height', 'min-width', 'min-height', 'flex-basis',
  'background-size', 'mask-size', '-webkit-mask-size', 'stroke-width',
]);

test('the --a11y-fs multiplier only ever scales a glyph size or a token declaration', () => {
  let scaled = 0;
  for (const rule of ALL_RULES) {
    for (const [prop, value] of decls(rule.body)) {
      if (!FS_USE.test(value)) continue;
      scaled++;
      assert.ok(prop.startsWith('--') || SCALABLE_PROPS.has(prop),
        `${rule.rel}:${rule.line}: "${rule.selector}" scales ${prop} by var(${FS_VAR}) - the multiplier sizes TYPE ` +
        `and ICONS only (${[...SCALABLE_PROPS].join(', ')}, or a custom property); geometry that has to follow the ` +
        'type is scaled where its token is declared (styles/tokens.css), never restated at a use site');
    }
  }
  assert.ok(scaled > 100, `only ${scaled} declarations read var(${FS_VAR}) - the chrome-wide codemod is missing, ` +
    'or this scan is no longer finding it, in which case every guard below it is vacuous');
});

test('ADDITIVITY: no rule that touches the render canvas or an export stage reads var(--a11y-fs)', () => {
  // The guard that carries the whole rewrite - every scaled font-size AND every
  // icon size now written through the same factor. Invariant B says a
  // preference may not change one pixel of an on-canvas render or of any
  // exported PNG/SVG/PDF/video, and the export stages are rasterised offscreen
  // from these same sheets - so the multiplier must not appear in any rule whose
  // selector list mentions a protected surface, gated or not. (Chrome that sits
  // NEXT TO the canvas is free to scale; this is about rules reaching inside.)
  let protectedBlocks = 0;
  let scaledTotal = 0;
  for (const rule of ALL_RULES) {
    const uses = decls(rule.body).filter(([, value]) => FS_USE.test(value));
    scaledTotal += uses.length;
    // Every arm, :not() contents stripped: a surface named inside :not() is
    // excluded from the rule and cannot be affected by it.
    const hit = arms(rule.selector).map((a) => protectedIn(stripNot(a))).find(Boolean);
    if (!hit) continue;
    protectedBlocks++;
    assert.equal(uses.length, 0,
      `${rule.rel}:${rule.line}: "${rule.selector}" targets ${hit} AND scales ${uses.map(([p]) => p).join(', ')} ` +
      `by var(${FS_VAR}) - the preference would change the user's render and every export taken from it, and the ` +
      'export geometry is shared with the CLI render path');
  }
  // Both halves of the scan must have found something, or a refactor could make
  // this test pass by matching nothing at all.
  assert.ok(protectedBlocks >= 3,
    `only ${protectedBlocks} rules targeting a protected surface were found across ${ALL_RULES.length} rules - ` +
    'the selector scan has stopped recognising the canvas/export stages, so this guard proves nothing');
  assert.ok(scaledTotal > 100,
    `only ${scaledTotal} declarations read var(${FS_VAR}) - with no scaled declarations left to check, this guard ` +
    'is vacuous');
});

test('the torn-out zoom mechanism cannot creep back: no gated rule declares `zoom`', () => {
  // largeText used to be `html[data-a11y-text="large"] { zoom: 1.25 }` with a
  // hand-maintained counter-zoom on every offscreen stage. It was replaced
  // because root zoom desynchronises getBoundingClientRect() from inline `left:
  // Npx` (Chrome M128+ standardized zoom, 23 positioning files here), and
  // because the counter-zoom list was incomplete, so exports came out 1.25×.
  // Scoped to GATED rules on purpose: pro/index.ts's interface scale is a real,
  // wanted `zoom` - written from JS as an inline style, never from CSS.
  let gatedRules = 0;
  for (const rule of ALL_RULES) {
    if (!isA11yGated(rule)) continue;
    gatedRules++;
    for (const [prop] of decls(rule.body)) {
      assert.notEqual(prop, 'zoom',
        `${rule.rel}:${rule.line}: "${rule.selector}" declares zoom - the a11y prefs scale type through ` +
        `var(${FS_VAR}), never by zooming a subtree (see the WHY NOT zoom note in styles/parts/a11y.css)`);
    }
  }
  assert.ok(gatedRules > 5, `only ${gatedRules} a11y-gated rules found - this scan is not looking at the feature`);
  // Nor may a custom property smuggle the factor in as a scale to be undone.
  for (const rule of ALL_RULES) {
    for (const [prop] of decls(rule.body)) {
      assert.equal(/^--a11y-.*(zoom|scale)/.test(prop), false,
        `${rule.rel}:${rule.line}: ${prop} reintroduces a scale factor that something else has to counter-scale - ` +
        'the multiplier exists precisely so nothing needs undoing');
    }
  }
});

// ── (c′) High contrast: unlayered tokens, out-specifying the brand block ─────

test('tokens.css stays UNLAYERED, so the high-contrast overrides can win', () => {
  const app = decomment(readFileSync(join(SRC_DIR, 'styles/app.css'), 'utf8'));
  const imp = /@import\s+'\.\/tokens\.css'([^;]*);/.exec(app);
  assert.ok(imp, "app.css no longer imports './tokens.css' - the guard below needs updating with it");
  assert.equal(imp[1]!.includes('layer('), false,
    'tokens.css was moved into a cascade layer: brand-vars.ts appends an UNLAYERED <style> at runtime, and ' +
    'unlayered declarations beat every layer - layering tokens.css silently neuters the high-contrast preference');
});

test('every high-contrast rule out-specifies the runtime brand block (html + attribute, not :root)', () => {
  const text = decomment(read(PREFS[1].sheet));
  const gate = `[${PREFS[1].attr}="${PREFS[1].value}"]`;
  const gated = rules(text).filter((r) => r.selector.includes(gate));
  assert.ok(gated.length > 0, `${PREFS[1].sheet} carries no ${gate} rule`);
  for (const rule of gated) {
    for (const sel of arms(rule.selector)) {
      if (!sel.includes(gate)) continue;
      // brand-vars.ts's applyChromeAccent writes ':root, [data-theme="light"]' etc.
      // at specificity (0,1,0); an element+attribute selector is (0,1,1) and wins.
      assert.match(sel, /^(html|:root)\[data-a11y-contrast="high"\]/,
        `${PREFS[1].sheet}:${rule.line}: "${sel}" must lead with html[data-a11y-contrast="high"] (or :root[…]) - a bare ` +
        ':root/[data-a11y-contrast] selector ties with the runtime brand-theme block and loses on source order');
    }
  }
});

// ── The FOUC mirror: two copies, pinned to each other ────────────────────────

test('index.html\'s pre-paint script reads the SAME localStorage key the module writes', () => {
  const html = readFileSync(join(WEB_DIR, 'index.html'), 'utf8');
  assert.ok(html.includes(`'${A11Y_STORE_KEY}'`) || html.includes(`"${A11Y_STORE_KEY}"`),
    `index.html's inline script does not read ${A11Y_STORE_KEY} - the mirror the module writes would never be ` +
    'applied before paint, and high contrast / large text would flash the regular look on every load');
});

test('index.html sets the same three attribute/value pairs as the module, each behind its own truthy check', () => {
  const html = readFileSync(join(WEB_DIR, 'index.html'), 'utf8');
  const mod = readFileSync(join(SRC_DIR, 'lib/a11y-prefs.ts'), 'utf8');
  for (const { key, dataset, value } of PREFS) {
    assert.match(html, new RegExp(`${dataset}\\s*=\\s*['"]${value}['"]`),
      `index.html never sets dataset.${dataset} = '${value}'`);
    assert.match(html, new RegExp(`if\\s*\\([^)]*\\.${key}\\s*\\)[^;]*${dataset}`),
      `index.html must set ${dataset} only when ${key} is on - an unconditional write would apply the ` +
      'preference to users who never asked for it');
    // The module side of the same pair, so a rename has to touch both copies.
    assert.ok(mod.includes(`'${dataset}'`) && mod.includes(`'${value}'`) && mod.includes(`'${key}'`),
      `lib/a11y-prefs.ts no longer maps ${key} → ${dataset}="${value}"; index.html still does`);
  }
});
