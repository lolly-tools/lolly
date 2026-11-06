// SPDX-License-Identifier: MPL-2.0
/**
 * Rules a gallery cover keeps under every brand, read off the community templates.
 * A brand's on-primary can be a dark colour, so a dark twin that takes its ink from
 * there goes dark on dark. Each theme-tagged look needs a twin for the other theme,
 * or that look drops out of the strip on one of them.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const COMMUNITY = resolve(import.meta.dirname, '../community');
interface Template { id: string; galleryTheme?: 'light' | 'dark'; values?: unknown }

function templatesOf(tool: string): Template[] {
  const dir = join(COMMUNITY, tool, 'templates');
  return readdirSync(dir).filter(name => name.endsWith('.json')).map(name => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Template);
}

const tools = readdirSync(COMMUNITY, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  .filter(tool => readdirSync(join(COMMUNITY, tool)).includes('templates'));

test('a dark twin takes its light ink from the surface token, never from on-primary', () => {
  for (const tool of tools) {
    for (const template of templatesOf(tool)) {
      if (template.galleryTheme !== 'dark') continue;
      assert.doesNotMatch(JSON.stringify(template.values), /on-primary/, `${tool}/${template.id}`);
    }
  }
});

test('Chart and Snippet keep a dark twin for each look that vanishes on a dark tile', () => {
  const twins = (tool: string): Map<string, Template> => new Map(templatesOf(tool).map(template => [template.id, template]));
  const chart = twins('chart');
  for (const id of ['brand-bars', 'brand-bars-areas', 'brand-bars-donut']) {
    assert.equal(chart.get(id)?.galleryTheme, 'light', id);
    assert.equal(chart.get(`${id}-dark`)?.galleryTheme, 'dark', `${id}-dark`);
  }
  const snippet = twins('snippet');
  for (const id of ['autocomplete', 'dark-code']) {
    assert.equal(snippet.get(id)?.galleryTheme, 'light', id);
    assert.equal(snippet.get(`${id}-brand`)?.galleryTheme, 'dark', `${id}-brand`);
  }
});

test('Record draws its cover from a template in the design system\'s own colours', () => {
  const manifest = JSON.parse(readFileSync(join(COMMUNITY, 'record/tool.json'), 'utf8')) as { galleryArt?: string; render: { formats: string[] } };
  assert.equal(manifest.galleryArt, 'render');
  assert.ok(!manifest.render.formats.includes('png'), 'its export list stays video and captions');
  const [template] = templatesOf('record');
  const colours = JSON.stringify(template?.values).match(/"(?:bg|fg)":"[^"]+"/g) ?? [];
  assert.ok(colours.length > 0);
  for (const colour of colours) assert.match(colour, /var\(--brand-/, 'a block field reads a brand variable, because the runtime does not resolve a token inside one');
});
