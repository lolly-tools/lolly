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
