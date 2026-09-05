// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import type { MaintainabilityBaseline } from '../scripts/check-maintainability-budget.ts';
import { compare } from '../scripts/check-maintainability-budget.ts';

function baseline(lines = 2_100): MaintainabilityBaseline {
  return {
    version: 1,
    scope: 'shells/web/src',
    exclusions: [],
    modules: {
      'shells/web/src/views/hot.ts': {
        lines,
        largestFunctionLines: 200,
        importFanIn: 2,
        importFanOut: 3,
        typeEscapes: 4,
      },
    },
    cycles: [],
  };
}

test('hotspots cannot grow and improvements require ratcheting the baseline', () => {
  const grown = baseline(2_101);
  assert.match(compare(baseline(), grown, new Set()).errors.join('\n'), /hotspot grew/);

  const reduced = baseline(2_099);
  assert.match(compare(baseline(), reduced, new Set()).errors.join('\n'), /budget improved/);

  const belowReportingThreshold = baseline();
  delete belowReportingThreshold.modules['shells/web/src/views/hot.ts'];
  assert.match(
    compare(baseline(), belowReportingThreshold, new Set()).errors.join('\n'),
    /budget entry disappeared/,
  );
});

test('changed hotspot functions and type escapes cannot grow', () => {
  const current = baseline();
  current.modules['shells/web/src/views/hot.ts']!.largestFunctionLines = 201;
  current.modules['shells/web/src/views/hot.ts']!.typeEscapes = 5;
  const result = compare(baseline(), current, new Set(['shells/web/src/views/hot.ts']));
  assert.match(result.errors.join('\n'), /largest function grew/);
  assert.match(result.errors.join('\n'), /type-escape markers grew/);
});

test('new hard-limit modules and new cycles fail', () => {
  const current = baseline();
  current.modules['shells/web/src/views/new.ts'] = {
    lines: 2_501,
    largestFunctionLines: 20,
    importFanIn: 0,
    importFanOut: 0,
    typeEscapes: 0,
  };
  current.cycles = [['shells/web/src/a.ts', 'shells/web/src/b.ts']];
  const result = compare(baseline(), current, new Set());
  assert.match(result.errors.join('\n'), /new production module/);
  assert.match(result.errors.join('\n'), /new dependency cycle/);
});
