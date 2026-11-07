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
  fetchWorkspaceValues, isWorkspaceTemplateRef, listWorkspaceTemplates, readTemplateOrigin, startableFor,
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
