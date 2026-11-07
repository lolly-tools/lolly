// SPDX-License-Identifier: MPL-2.0
/**
 * views/gallery-welcome.ts - a person a connected workspace published templates to
 * (a partner, say) is not shown "Make it yours": the home shelf of those templates is
 * their welcome (plans/82 M2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasPublishedTemplates } from './gallery-welcome.ts';

const template = (id: string, meta: Record<string, unknown>) => ({ id, type: 'template', url: `/catalog/${id}/json`, meta } as never);

test('a startable workspace template is a welcome of its own', () => {
  assert.equal(hasPublishedTemplates([template('inst/abc123', { toolId: 'pricing-table', name: 'Price sheet' })]), true);
});

test('nothing published, a retired template or another kind of asset leaves the welcome as it was', () => {
  assert.equal(hasPublishedTemplates(undefined), false);
  assert.equal(hasPublishedTemplates([]), false);
  assert.equal(hasPublishedTemplates([template('inst/old000', { toolId: 'pricing-table', retired: true })]), false);
  assert.equal(hasPublishedTemplates([{ id: 'lolly/tokens/brand', type: 'tokens' } as never]), false);
  assert.equal(hasPublishedTemplates([template('poster', { toolId: 'pricing-table' })]), false, 'a tool\'s own template is not a workspace one');
});

test('a Share with rules file the workspace published counts as well (plans/82 M3)', () => {
  const rules = (id: string, meta: Record<string, unknown>) => ({ id, type: 'rules-tool', meta } as never);
  assert.equal(hasPublishedTemplates([rules('inst/rules01', { toolId: 'partner-data-sheet' })]), true);
  assert.equal(hasPublishedTemplates([rules('inst/rules02', { toolId: 'partner-data-sheet', retired: true })]), false);
  assert.equal(hasPublishedTemplates([rules('design', { toolId: 'partner-data-sheet' })]), false, 'only a workspace one');
});

test('a person the workspace names a company with details for is not shown "Make it yours" (plans/82 M3)', async () => {
  const { hasCompany } = await import('./gallery-welcome.ts');
  const { setWorkspaceCompany } = await import('../lib/workspace-templates.ts');
  setWorkspaceCompany(null);
  assert.equal(hasCompany(), false, 'no company: the welcome decides as before');
  setWorkspaceCompany({ id: 'nw', name: 'Northwind IT', revision: 0, logos: {} });
  assert.equal(hasCompany(), false, 'a company with no details yet keeps the welcome as before');
  setWorkspaceCompany({ id: 'nw', name: 'Northwind IT', revision: 3, logos: { light: 'inst/l' } });
  assert.equal(hasCompany(), true);
  setWorkspaceCompany(null);
});

/** A first visit on the shipped design system with nothing synced yet: the cold case. */
const coldHost = () => ({
  tokens: { isLocked: async () => false, activeRecord: async () => ({ source: { kind: 'shipped' }, label: 'Lolly' }) },
  assets: { query: async () => [], _findMetaByType: async () => undefined },
}) as never;

test('a company that arrives after the gallery mounts still keeps the welcome away (plans/82 M3)', async () => {
  const { galleryNeedsWelcome } = await import('./gallery-welcome.ts');
  const wt = await import('../lib/workspace-templates.ts');
  wt._resetWorkspaceCompanyForTests();
  const decision = galleryNeedsWelcome(coldHost(), () => true);
  await new Promise((resolve) => setTimeout(resolve, 20));
  wt.setWorkspaceCompany({ id: 'nw', name: 'Northwind IT', revision: 3, logos: { light: 'inst/l' } });
  wt.settleWorkspaceCompany(true);
  assert.equal(await decision, false, 'the shelf, led by the company card, is the welcome');
  wt._resetWorkspaceCompanyForTests();
});

test('with no workspace the first visit still gets its welcome once the probe answers', async () => {
  const { galleryNeedsWelcome } = await import('./gallery-welcome.ts');
  const wt = await import('../lib/workspace-templates.ts');
  wt._resetWorkspaceCompanyForTests();
  const decision = galleryNeedsWelcome(coldHost(), () => true);
  wt.settleWorkspaceCompany(false);
  assert.equal(await decision, true);
  wt._resetWorkspaceCompanyForTests();
});

test('the wait for the company is bounded', async () => {
  const wt = await import('../lib/workspace-templates.ts');
  wt._resetWorkspaceCompanyForTests();
  assert.equal(wt.WORKSPACE_COMPANY_WAIT_MS, 3000);
  const started = Date.now();
  await wt.workspaceCompanySettled(30);
  assert.ok(Date.now() - started < 1000, 'resolves on its own when no answer comes');
  wt.settleWorkspaceCompany();
  await wt.workspaceCompanySettled();
  wt._resetWorkspaceCompanyForTests();
});
