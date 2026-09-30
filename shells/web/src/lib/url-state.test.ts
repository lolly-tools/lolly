// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRouteParams, routeParams } from './url-state.ts';

test('a section change preserves unrelated state and explicit empty sections', () => {
  const original = 'https://lolly.tools/#/a?q=logo&type=vector&asset=logo';
  const next = mergeRouteParams(original, { section: '' });
  assert.deepEqual([...routeParams(next)], [['q', 'logo'], ['type', 'vector'], ['asset', 'logo'], ['section', '']]);
});

test('path and hash routes merge and remove workspace keys without losing packed content', () => {
  for (const base of ['https://lolly.tools/design?z=content&_sel=shape', 'https://lolly.tools/#/tool/design?z=content&_sel=shape']) {
    const next = mergeRouteParams(base, { _ui: 'workspace', _sel: null, full: '' });
    assert.deepEqual([...routeParams(next)], [['z', 'content'], ['_ui', 'workspace'], ['full', '']]);
  }
});
