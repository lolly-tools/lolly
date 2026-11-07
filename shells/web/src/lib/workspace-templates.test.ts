// SPDX-License-Identifier: MPL-2.0
/**
 * lib/workspace-templates.ts - templates a connected workspace publishes, read from its
 * catalog - and how the template ref, the Start chooser's tiles and the sidebar's
 * template layer use them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { AssetRef } from '@lolly-tools/core/host-v1';
import {
  fetchWorkspaceValues, isTemplatesOnlyTool, isWorkspaceTemplateRef, listWorkspaceTemplates, readTemplateOrigin, startableFor,
  workspaceTemplateOf, workspaceVariants, type WorkspaceTemplate,
} from './workspace-templates.ts';
import { formatTemplateRef, parseTemplateRef, resolveTemplateSeed } from './template-ref.ts';
import { _clearInputPoliciesForTests, clearTemplateInputs, getInputPolicy, setTemplateInputs, setToolInputPolicies } from './input-policy.ts';

const ref = (id: string, meta: Record<string, unknown>, type = 'template'): AssetRef =>
  ({ source: 'library', id, type, format: 'json', url: `/catalog/${id}/json`, meta } as unknown as AssetRef);

const sheet = ref('inst/abc123', { toolId: 'pricing-table', name: 'Partner price sheet', version: 3, editable: ['data'] });
const retired = ref('inst/old000', { toolId: 'pricing-table', name: 'Old sheet', version: 1, retired: true, replacedBy: 'inst/abc123' });
const otherTool = ref('inst/qr0001', { toolId: 'qr-code', name: 'Partner QR' });

function host(refs: AssetRef[]) {
  return {
    assets: {
      query: async () => refs,
      get: async (id: string) => { const r = refs.find((x) => x.id === id); if (!r) throw new Error('missing'); return r; },
    },
    profile: { get: async () => ({}), set: async () => undefined },
  };
}

test('a catalog entry reads as a workspace template only when it is one', () => {
  assert.deepEqual(workspaceTemplateOf(sheet), {
    id: 'inst/abc123', name: 'Partner price sheet', toolId: 'pricing-table', version: 3, editable: ['data'], url: '/catalog/inst/abc123/json',
  });
  assert.equal(workspaceTemplateOf(ref('inst/x1', { toolId: 'pricing-table' }, 'raster')), null, 'a picture is not a template');
  assert.equal(workspaceTemplateOf(ref('lolly/logo', { toolId: 'pricing-table' })), null, 'only instance templates');
  assert.equal(workspaceTemplateOf(ref('inst/x2', {})), null, 'a template names its tool');
  assert.equal(workspaceTemplateOf(retired)?.retired, true);
  assert.ok(isWorkspaceTemplateRef('inst/abc_1-2'));
  for (const bad of ['inst/', 'inst/../x', 'design:poster', 'user:abc', 42]) assert.equal(isWorkspaceTemplateRef(bad), false, String(bad));
});

test('a tool is offered its own templates, never a retired one, and a plain build has none', async () => {
  const list = await listWorkspaceTemplates(host([retired, otherTool, sheet]));
  assert.deepEqual(list.map((t) => t.name), ['Old sheet', 'Partner price sheet', 'Partner QR'], 'retired ones too, by name');
  assert.deepEqual(startableFor(list, 'pricing-table').map((t) => t.id), ['inst/abc123']);
  assert.deepEqual(await listWorkspaceTemplates({ assets: { query: async () => { throw new Error('no catalog'); }, get: async () => { throw new Error('x'); } } }), []);
});

test('values are read from the template\'s JSON, and a template for another tool is refused', async () => {
  const tpl = workspaceTemplateOf(sheet)!;
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
  assert.deepEqual(await fetchWorkspaceValues(tpl, ok({ toolId: 'pricing-table', values: { heading: 'SLES' } })), { heading: 'SLES' });
  assert.equal(await fetchWorkspaceValues(tpl, ok({ toolId: 'qr-code', values: {} })), null);
  assert.equal(await fetchWorkspaceValues(tpl, (async () => new Response('', { status: 404 })) as unknown as typeof fetch), null);
  const tiles = await workspaceVariants([tpl], 'From SUSE', ok({ toolId: 'pricing-table', values: { heading: 'SLES' } }));
  assert.deepEqual(tiles, [{ id: 'inst/abc123', name: 'Partner price sheet', category: 'From SUSE', values: { heading: 'SLES' }, ref: 'inst/abc123', own: false, published: true }]);
  const lined = await workspaceVariants([tpl], 'From SUSE', ok({ toolId: 'pricing-table', values: {} }), (t) => `From SUSE · Version ${t.version}`);
  assert.equal(lined[0]?.description, 'From SUSE · Version 3', 'a tile with no description of its own says where it is from');
  assert.equal(workspaceTemplateOf(ref('inst/kept01', { toolId: 'pricing-table', fixedTheme: true }))?.fixedTheme, true);
  assert.deepEqual(readTemplateOrigin({ ref: 'inst/kept01', version: 1, fixedTheme: true }), { ref: 'inst/kept01', version: 1, fixedTheme: true });
});

test('the template ref names a workspace template by its catalog id and resolves it with its rules', async () => {
  assert.deepEqual(parseTemplateRef('inst/abc123'), { kind: 'workspace', id: 'inst/abc123' });
  assert.equal(formatTemplateRef({ kind: 'workspace', id: 'inst/abc123' }), 'inst/abc123');
  const fetchWorkspace = async (t: WorkspaceTemplate) => (t.id === 'inst/abc123' ? { heading: 'SLES' } : null);
  const found = await resolveTemplateSeed(host([sheet, retired]) as never, 'inst/abc123', { toolId: 'pricing-table', fetchWorkspace });
  assert.deepEqual(found, { ref: { kind: 'workspace', id: 'inst/abc123' }, toolId: 'pricing-table', name: 'Partner price sheet', values: { heading: 'SLES' }, workspace: { version: 3, editable: ['data'] } });
  assert.equal(await resolveTemplateSeed(host([sheet]) as never, 'inst/abc123', { toolId: 'qr-code', fetchWorkspace }), null, 'another tool');
  assert.equal(await resolveTemplateSeed(host([retired]) as never, 'inst/old000', { toolId: 'pricing-table', fetchWorkspace }), null, 'never a new start from a retired one');
  assert.equal(await resolveTemplateSeed(host([]) as never, 'inst/gone00', { fetchWorkspace }), null, 'gone from the catalog');
});

test('a document keeps where it came from, and junk reads as nothing', () => {
  assert.deepEqual(readTemplateOrigin({ ref: 'inst/abc123', version: 3, editable: ['data'] }), { ref: 'inst/abc123', version: 3, editable: ['data'] });
  assert.deepEqual(readTemplateOrigin({ ref: 'inst/abc123', version: 2 }), { ref: 'inst/abc123', version: 2 });
  for (const junk of [null, 'inst/abc123', { ref: 'poster', version: 1 }, { ref: 'inst/abc123' }]) assert.equal(readTemplateOrigin(junk), null);
});

test('the template layer offers only what the template leaves open, hidden with no note', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('pricing-table', { data: { mode: 'locked', value: 'x' } });
  setTemplateInputs('pricing-table', ['data']);
  assert.deepEqual(getInputPolicy('pricing-table', 'heading'), { mode: 'hidden' });
  assert.equal(getInputPolicy('pricing-table', 'heading')?.note, undefined, 'no fine print');
  assert.equal(getInputPolicy('pricing-table', 'data')?.mode, 'locked', 'an organisation rule still holds on what the template leaves open');
  assert.equal(getInputPolicy('qr-code', 'heading'), undefined, 'one tool only');
  clearTemplateInputs('pricing-table');
  assert.equal(getInputPolicy('pricing-table', 'heading'), undefined);
  setTemplateInputs('pricing-table', ['data']);
  setTemplateInputs('pricing-table', null);
  assert.equal(getInputPolicy('pricing-table', 'heading'), undefined, 'null lifts the layer');
  _clearInputPoliciesForTests();
});

test('a new version keeps what the person may change and brings in the rest', async () => {
  const { newVersionPatch } = await import('../views/tool-template-notices.ts');
  assert.deepEqual(newVersionPatch({ heading: 'SP1', data: 'theirs?', __label: 'x', stray: 1 }, ['heading', 'data', 'cta'], ['data']), { heading: 'SP1' });
});

test('a tool the workspace set to templates only says so in its index entry, and nothing else does', () => {
  assert.equal(isTemplatesOnlyTool({ id: 'pricing-table', listed: false, templatesOnly: true }), true);
  for (const entry of [undefined, null, { id: 'pricing-table' }, { id: 'pricing-table', listed: false }, { templatesOnly: 'yes' }]) {
    assert.equal(isTemplatesOnlyTool(entry), false, JSON.stringify(entry));
  }
});

test('the home shelf keeps a template whose tool is unlisted for templates only', async () => {
  const { publishedItems } = await import('../views/published-shelf.ts');
  const tpl = workspaceTemplateOf(sheet)!;
  const items = publishedItems([tpl], [{ id: 'pricing-table', name: 'Pricing', listed: false, templatesOnly: true } as never]);
  assert.deepEqual(items.map((i) => i.key), ['inst/abc123'], 'out of the gallery, still on the shelf');
});

// ── The person's company (plans/82 M3) ─────────────────────────────────────

test('a template entry carries the bindings it names, and nothing that is not a company field', async () => {
  const { workspaceTemplateOf } = await import('./workspace-templates.ts');
  const tpl = workspaceTemplateOf({ source: 'library', id: 'inst/abc', type: 'template', url: '/catalog/inst/abc/json',
    meta: { toolId: 'price-card', version: 2, bindings: { logo: 'logo', details: 'contact', bogus: 'colour', n: 3 } } } as never);
  assert.deepEqual(tpl?.bindings, { logo: 'logo', details: 'contact' });
  const none = workspaceTemplateOf({ source: 'library', id: 'inst/abd', type: 'template', url: '/x', meta: { toolId: 'price-card' } } as never);
  assert.equal(none?.bindings, undefined);
});

test('company values: the logo follows the mode, the contact line reads as the workspace writes it', async () => {
  const { companyValuesFor, companyFieldValue, modeOfSelection, setWorkspaceCompany } = await import('./workspace-templates.ts');
  const company = { id: 'nw', name: 'Northwind IT', logos: { light: 'inst/l', dark: 'inst/d' }, contact: { name: 'Rita Ortiz', email: 'rita@n.example', phone: '+49 30 1' }, currency: 'EUR' };
  assert.equal(modeOfSelection({ '': 'dark' }), 'dark');
  assert.equal(modeOfSelection(undefined), 'light');
  assert.equal(companyFieldValue('contact', company, 'light'), 'Rita Ortiz, rita@n.example, +49 30 1');
  assert.equal(companyFieldValue('logo', { ...company, logos: { light: 'inst/l' } }, 'dark'), 'inst/l', 'the other surface\'s logo before none');
  assert.deepEqual(companyValuesFor({ logo: 'logo', price: 'currency', note: 'taxNote' }, 'dark', company), { logo: 'inst/d', price: 'EUR' });
  setWorkspaceCompany(null);
  assert.deepEqual(companyValuesFor({ logo: 'logo' }, 'light'), {}, 'no company, no values');
  setWorkspaceCompany(company);
  assert.deepEqual(companyValuesFor({ logo: 'logo' }, 'light'), { logo: 'inst/l' });
  setWorkspaceCompany(null);
});

// ── The person's copies on the home shelf (plans/82 M6) ────────────────────

test('a shelf card finds the newest copy made from it, and a template copy behind the catalog says so', async () => {
  const { copiesOf, sessionsToRead, SHELF_COPY_READS } = await import('./workspace-templates.ts');
  const entries = [
    { key: 'inst/abc123', toolId: 'pricing-table', template: true, version: 3 },
    { key: 'inst/rules01', toolId: 'partner-data-sheet', template: false },
    { key: 'inst/none00', toolId: 'pricing-table', template: true, version: 1 },
  ];
  const saved = [
    { slot: 'p1', toolId: 'pricing-table', updatedAt: '2026-10-01T10:00:00Z', origin: { ref: 'inst/abc123', version: 3 } },
    { slot: 'p2', toolId: 'pricing-table', updatedAt: '2026-11-03T10:00:00Z', origin: { ref: 'inst/abc123', version: 2 } },
    { slot: 'p3', toolId: 'pricing-table', updatedAt: '2026-11-05T10:00:00Z', origin: null },
    { slot: 'd1', toolId: 'partner-data-sheet', updatedAt: '2026-11-02T10:00:00Z' },
    { slot: 'q1', toolId: 'qr-code', updatedAt: '2026-11-06T10:00:00Z' },
  ];
  const copies = copiesOf(entries, saved);
  assert.deepEqual(copies.get('inst/abc123'), { slot: 'p2', toolId: 'pricing-table', updatedAt: '2026-11-03T10:00:00Z', behind: true }, 'the newest copy of that template, made from version 2 of 3');
  assert.deepEqual(copies.get('inst/rules01'), { slot: 'd1', toolId: 'partner-data-sheet', updatedAt: '2026-11-02T10:00:00Z', behind: false }, 'a rules tool copy follows the tool');
  assert.equal(copies.has('inst/none00'), false, 'a document of the same tool made from nothing is not its copy');
  // Only the template tools' newest sessions are read, at most SHELF_COPY_READS of them.
  const many = Array.from({ length: 30 }, (_, i) => ({ slot: `s${i}`, toolId: 'pricing-table', updatedAt: `2026-11-${String(i % 28 + 1).padStart(2, '0')}T00:00:00Z` }));
  const read = sessionsToRead(entries, [...many, { slot: 'd1', toolId: 'partner-data-sheet', updatedAt: '2026-12-01T00:00:00Z' }]);
  assert.equal(SHELF_COPY_READS, 20);
  assert.equal(read.length, 20);
  assert.ok(read.every((s) => s.toolId === 'pricing-table'), 'a rules tool is never read');
  assert.equal(read[0]!.updatedAt, '2026-11-28T00:00:00Z', 'newest first');
});

test('one published thing is one card: a rules tool is on the shelf and its card markup holds one link', async () => {
  const { onShelf, publishedItems, publishedShelfHtml, shelfSearchText } = await import('../views/published-shelf.ts');
  assert.equal(onShelf({ templateId: 'inst/rules01' }), true);
  assert.equal(onShelf({ templateId: 'inst/rules01', listed: false }), false);
  assert.equal(onShelf({ listed: true }), false);
  const tools = [
    { id: 'pricing-table', name: 'Pricing' },
    { id: 'partner-data-sheet', name: 'Partner data <sheet>', templateId: 'inst/rules01', version: '1.0.2' },
  ];
  const items = publishedItems([workspaceTemplateOf(sheet)!], tools);
  assert.deepEqual(items.map((i) => [i.key, i.templateVersion]), [['inst/rules01', undefined], ['inst/abc123', 3]]);
  assert.equal(shelfSearchText(items[1]!), 'Partner price sheet Pricing');
  const html = publishedShelfHtml(items, 'Work & Co');
  assert.equal((html.match(/<a /g) ?? []).length, 2, 'one link per card: Use');
  assert.doesNotMatch(html, /<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /, 'no link inside a link');
  assert.match(html, /data-search="Partner data &lt;sheet&gt;"/);
  assert.doesNotMatch(html, /<sheet>/, 'names are escaped');
});

test('a New version tap runs the notice\'s own Use new version, once, and takes the notice down', async () => {
  const { mountTemplateNotices, requestNewVersion } = await import('../views/tool-template-notices.ts');
  const { notificationEntries, _resetNotificationsForTests } = await import('./notifications.ts');
  const now = { ...workspaceTemplateOf(sheet)!, version: 3, editable: ['data'] };
  const run = (patches: unknown[], updated: unknown[]) => mountTemplateNotices({
    host: {}, toolId: 'pricing-table', origin: { ref: 'inst/abc123', version: 2, editable: ['data'] }, now,
    runtime: { getModel: () => [{ id: 'heading', value: 'v2' }, { id: 'data', value: 'mine' }], applyPatch: async (p) => { patches.push(p); }, resolveRefs: async () => undefined },
    updated: (o) => { updated.push(o); }, open: () => undefined,
    fetchValues: async () => ({ heading: 'v3', data: 'theirs' }),
  });
  // Without a tap the notice waits in the list, as before.
  _resetNotificationsForTests();
  const quiet: unknown[] = [];
  const offQuiet = run(quiet, []);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(quiet, []);
  assert.ok(notificationEntries().some((n) => n.id === 'template-version:inst/abc123:3'));
  offQuiet();
  // A tap on the card: the copy that opens takes the new version and keeps her data.
  requestNewVersion('inst/abc123');
  const patches: unknown[] = [], updated: unknown[] = [];
  run(patches, updated);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(patches, [{ heading: 'v3' }], 'only what the template fixes moves');
  assert.deepEqual(updated, [{ ref: 'inst/abc123', version: 3, editable: ['data'] }]);
  assert.equal(notificationEntries().some((n) => n.id === 'template-version:inst/abc123:3'), false, 'the notice is done');
  // The request is spent, and one for another template or older than a minute does nothing.
  const again: unknown[] = [];
  run(again, []);
  requestNewVersion('inst/other0');
  run(again, []);
  requestNewVersion('inst/abc123', Date.now() - 61_000);
  run(again, []);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(again, []);
  _resetNotificationsForTests();
});
