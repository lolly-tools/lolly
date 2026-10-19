// SPDX-License-Identifier: MPL-2.0
/**
 * The brand standards page, shells/web/public/brand/index.html, served at /brand.
 * The page is hand-written HTML, so these tests hold it to the files it quotes:
 * the Opal swatches and the colourways to Lolly Demo's design system, each printed
 * contrast ratio to the colours beside it, every picture and face to a file that
 * ships, the copied marks to their originals and the kangaroo to the app's drawing.
 * They also keep the page self-contained (no third-party script, style or picture)
 * and check that every nginx config still serves a directory's index.html, which
 * is how /brand reaches the page with no route of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { kangarooArt } from '../shells/web/src/components/kangaroo-art.ts';
import { colourwayAxis } from '../engine/src/colourway.ts';
import { createTokenSet } from '../engine/src/tokens.ts';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');
const PAGE = read('shells/web/public/brand/index.html');
const TOKENS = JSON.parse(read('brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'));
const BRAND: Record<string, { $value: string }> = TOKENS.base.color.brand;
/** Interface shades of Liquorice for raised and panel surfaces, not palette colours. */
const INTERFACE_SHADES = new Set(['liquorice-raised', 'liquorice-panel']);
const SURFACE = { light: '#ffffff', dark: '#09141a' } as const;

const between = (from: string, to: string): string => {
  const start = PAGE.indexOf(from);
  const end = PAGE.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `the page has a section from ${from} to ${to}`);
  return PAGE.slice(start, end);
};

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('every Opal swatch on the page carries its design-system value, and none is missing', () => {
  const opal = between('id="opal"', 'id="colourways"');
  const swatches = [...opal.matchAll(/<div class="sw" data-token="([a-z-]+)"><i[^>]*style="--c:(#[0-9a-f]{6})"><\/i><b>([^<]+)<\/b><code>([^<]+)<\/code><\/div>/g)];
  assert.ok(swatches.length > 20, 'the Opal section lists its swatches');
  const seen = new Set<string>();
  for (const [, token = '', hex = '', , code = ''] of swatches) {
    const value = BRAND[token]?.$value;
    assert.ok(value, `color.brand.${token} exists in Lolly Demo`);
    assert.equal(hex, value.toLowerCase(), `${token} is painted with its token value`);
    if (token !== 'daylight') assert.equal(code, hex, `${token} prints the value it paints`);
    seen.add(token);
  }
  const missing = Object.keys(BRAND).filter(name => !name.startsWith('$') && !INTERFACE_SHADES.has(name) && !seen.has(name));
  assert.deepEqual(missing, [], 'every Opal colour appears on the page');
});

const ROLES = ['primary', 'on-primary', 'secondary'] as const;
type Role = (typeof ROLES)[number];
interface Swatch { token: string; hex: string }
interface Look { lead: string; on: string; roles: Record<Role, Swatch>; ratio: string }
interface Card { id: string; light: Look; dark: Look }

function cards(): Card[] {
  const section = between('id="colourways"', 'id="crossland"');
  return [...section.matchAll(/<article class="card cw" data-colourway-card="([a-z-]+)"[\s\S]*?<\/article>/g)].map(([html, id = '']) => {
    const looks = new Map<string, Look>();
    for (const [, mode = '', lead = '', on = '', body = '', ratio = ''] of html.matchAll(/<div class="cw-look cw-(light|dark)" style="--l:(#[0-9a-f]{6});--o:(#[0-9a-f]{6})">([\s\S]*?)<p class="cw-ratio">([\s\S]*?)<\/p><\/div>/g)) {
      const found = new Map<string, Swatch>();
      for (const [, role = '', token = '', hex = ''] of body.matchAll(/<dd data-role="([a-z-]+)" data-token="([a-z-]+)"><i style="--c:(#[0-9a-f]{6})"><\/i>/g)) found.set(role, { token, hex });
      const pick = (role: Role): Swatch => {
        const swatch = found.get(role);
        assert.ok(swatch, `${id} ${mode} states its ${role}`);
        return swatch;
      };
      looks.set(mode, {
        lead, on,
        roles: { primary: pick('primary'), 'on-primary': pick('on-primary'), secondary: pick('secondary') },
        ratio: ratio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });
    }
    const light = looks.get('light'), dark = looks.get('dark');
    assert.ok(light && dark, `${id} shows a light look and a dark look`);
    return { id, light, dark };
  });
}

test('each colourway look is painted with the Opal colours its labels state', () => {
  const all = cards();
  assert.deepEqual(all.map(c => c.id), ['spearmint', 'morning', 'spring', 'beach', 'afternoon', 'midnight']);
  for (const card of all) {
    for (const mode of ['light', 'dark'] as const) {
      const look = card[mode];
      for (const role of ROLES) {
        const { token, hex } = look.roles[role];
        const value = BRAND[token]?.$value;
        assert.ok(value, `${card.id} ${mode} ${role}: color.brand.${token} exists`);
        assert.equal(hex, value.toLowerCase(), `${card.id} ${mode} ${role} swatch shows ${token}`);
      }
      assert.equal(look.lead, look.roles.primary.hex, `${card.id} ${mode}: the sample button fills with the lead`);
      assert.equal(look.on, look.roles['on-primary'].hex, `${card.id} ${mode}: the sample button's words use the colour on the lead`);
    }
  }
});

test('every printed contrast ratio is the measured one, and every look clears WCAG 2.2', () => {
  for (const card of cards()) {
    for (const mode of ['light', 'dark'] as const) {
      const { roles, ratio } = card[mode];
      const text = contrast(roles['on-primary'].hex, roles.primary.hex);
      const lead = contrast(roles.primary.hex, SURFACE[mode]);
      const partner = contrast(roles.secondary.hex, SURFACE[mode]);
      assert.equal(ratio, `text ${text.toFixed(1)} lead ${lead.toFixed(1)} partner ${partner.toFixed(1)}`, `${card.id} ${mode} prints its own measurements`);
      assert.ok(text >= 4.5, `${card.id} ${mode}: words on the lead reach 4.5:1 (${text.toFixed(2)})`);
      assert.ok(lead >= 3, `${card.id} ${mode}: the lead reaches 3:1 on the page (${lead.toFixed(2)})`);
      assert.ok(partner >= 3, `${card.id} ${mode}: the partner reaches 3:1 on the page (${partner.toFixed(2)})`);
    }
  }
});

test('the bar dots and the page styles wear the same colourways as the cards', () => {
  const dots = [...PAGE.matchAll(/<button class="cw-dot"[^>]*data-cw="([a-z-]+)"[^>]*style="--d1:(#[0-9a-f]{6});--d2:(#[0-9a-f]{6})"/g)];
  const all = cards();
  assert.deepEqual(dots.map(d => d[1]), all.map(c => c.id), 'one dot per colourway, in card order');
  for (const card of all) {
    const dot = dots.find(d => d[1] === card.id)!;
    assert.deepEqual([dot[2], dot[3]], [card.light.lead, card.dark.lead], `${card.id}'s dot shows its two leads`);
    const block = card.id === 'spearmint'
      ? PAGE.match(/:root\{\s*(--cw-lead-l[\s\S]*?--cw-tint-d:[^;]+;)/)?.[1]
      : PAGE.match(new RegExp(`html\\[data-colourway="${card.id}"\\]\\{([\\s\\S]*?)\\}`))?.[1];
    assert.ok(block, `${card.id} has page styles`);
    const slot = (name: string): string | undefined => block!.match(new RegExp(`--cw-${name}:(#[0-9a-f]{6})`))?.[1];
    for (const [mode, suffix] of [['light', 'l'], ['dark', 'd']] as const) {
      assert.equal(slot(`lead-${suffix}`), card[mode].roles.primary.hex, `${card.id} page lead (${mode})`);
      assert.equal(slot(`on-${suffix}`), card[mode].roles['on-primary'].hex, `${card.id} page colour on the lead (${mode})`);
      assert.equal(slot(`partner-${suffix}`), card[mode].roles.secondary.hex, `${card.id} page partner (${mode})`);
    }
  }
});

test('the colourway cards match the colourways Lolly Demo carries', t => {
  const axis = colourwayAxis(TOKENS);
  if (!axis) { t.skip('Lolly Demo has no colourway group yet'); return; }
  const all = cards();
  assert.deepEqual(axis.options.map(o => o.id), all.map(c => c.id), 'the same colourways, canonical first');
  assert.equal(axis.options.find(o => o.canonical)?.id, 'spearmint', 'Spearmint is the canonical colourway');
  for (const card of all) {
    for (const mode of ['light', 'dark'] as const) {
      const set = createTokenSet(TOKENS, { selection: { '': mode, [axis.group]: card.id } });
      for (const role of ROLES) {
        const value = String(set.resolve(`color.semantic.${role}`)).toLowerCase();
        assert.equal(value, card[mode].roles[role].hex, `${card.id} ${mode} ${role} resolves to the colour the page shows`);
      }
    }
  }
});

test('every picture, face and link on the page points at a file that ships', () => {
  const refs = new Set<string>();
  for (const [, url] of PAGE.matchAll(/(?:src|href)="(\/[^"#]*)"/g)) if (url) refs.add(url);
  for (const [, url] of PAGE.matchAll(/url\('(\/[^']+)'\)/g)) if (url) refs.add(url);
  const unresolved: string[] = [];
  for (const ref of refs) {
    const path = ref.split('?')[0] ?? ref;
    if (path === '/' || path === '/info/') continue;
    const tool = path.match(/^\/t\/([a-z0-9-]+)$/);
    const shot = path.match(/^\/info\/shots\/(.+)$/);
    const doc = path.match(/^\/info\/(?:start|create|build|operate|trust)\/([a-z0-9-]+)\.html$/);
    const file = tool ? `community/${tool[1]}/tool.json`
      : shot ? `docs/shots/${shot[1]}`
        : doc ? `docs/${doc[1]}.md`
          : `shells/web/public${path}`;
    if (!existsSync(resolve(ROOT, file))) unresolved.push(`${ref} -> ${file}`);
  }
  assert.ok(refs.size > 20, 'the page refers to its files');
  assert.deepEqual(unresolved, [], 'every local reference resolves to a file in the tree');
});

test('the marks beside the page are byte-for-byte copies of the originals', () => {
  const same = (copy: string, original: string): void => {
    assert.ok(readFileSync(resolve(ROOT, copy)).equals(readFileSync(resolve(ROOT, original))), `${copy} is identical to ${original}`);
  };
  same('shells/web/public/brand/mono.svg', 'brands/lolly-demo/catalog/assets/lolly/logo/mono.svg');
  same('shells/web/public/brand/mono-reverse.svg', 'brands/lolly-demo/catalog/assets/lolly/logo/mono-reverse.svg');
  same('shells/web/public/brand/founded-by.svg', 'founded-by.svg');
  for (const form of ['horizontal', 'horizontal-reverse', 'horizontal-on-brand']) {
    same(`shells/web/public/brand/${form}.svg`, `brands/lolly-demo/catalog/assets/lolly/logo/${form}.svg`);
  }
  same('shells/web/public/icon-primary.svg', 'brands/lolly-demo/catalog/assets/lolly/logo/primary.svg');
  same('shells/web/public/icon-reverse.svg', 'brands/lolly-demo/catalog/assets/lolly/logo/reverse.svg');
});

test('the page loads nothing from another site', () => {
  assert.doesNotMatch(PAGE, /<script[^>]+src=/i, 'no external script');
  assert.doesNotMatch(PAGE, /<link[^>]+rel="stylesheet"/i, 'no stylesheet link');
  assert.doesNotMatch(PAGE, /(?:src|srcset|poster)="(?:https?:)?\/\//i, 'no third-party picture or media');
  assert.doesNotMatch(PAGE, /url\(\s*['"]?(?:https?:)?\/\//i, 'no third-party file in the styles');
  const links = [...PAGE.matchAll(/<link [^>]*href="([^"]+)"/g)].map(m => m[1] ?? '');
  assert.deepEqual(links.filter(h => /^(?:https?:)?\/\//.test(h)), ['https://lolly.tools/brand'], 'the only absolute link element is the canonical address');
});

test('the kangaroo is the drawing the Unsaved edits dialog uses', () => {
  const inline = PAGE.match(/<svg class="kg"[\s\S]*?<\/svg>/)?.[0];
  assert.ok(inline, 'the page carries the kangaroo');
  const ids = (svg: string): string => svg.replace(/kg\d+_/g, 'kg_');
  assert.equal(ids(inline!), ids(kangarooArt()));
});

test('the swirl is the catalog swirl with its three rings and no stale credential', () => {
  const swirl = PAGE.match(/<span class="swirl">([\s\S]*?)<\/span>/)?.[1] ?? '';
  for (const ring of ['lolly-outer', 'lolly-mid', 'lolly-inner']) assert.match(swirl, new RegExp(`class="${ring}"`), `the swirl keeps ${ring}`);
  assert.doesNotMatch(swirl, /c2pa/i, 'an edited inline copy carries no credential that would no longer verify');
  assert.doesNotMatch(swirl, /id="ls-/, 'ids are renamed so they cannot collide with the catalog file');
});

test('every nginx config serves a directory index, which is how /brand reaches the page', () => {
  for (const conf of ['deploy/helm/profiles/sovereign/files/public.nginx.conf', 'deploy/docker/public.nginx.conf', 'deploy/docker/nginx.conf', 'shells/web/rpm/lolly-web.nginx.conf']) {
    assert.match(read(conf), /location \/ \{\s*try_files \$uri \$uri\.html \$uri\/index\.html \/index\.html;/, `${conf} falls back to $uri/index.html`);
  }
});
