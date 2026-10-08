// SPDX-License-Identifier: MPL-2.0
import { lazyModule } from '../lib/lazy-module.ts';
import type { fontCoversText as checkCoverage } from './font-coverage.ts';

const loadCoverage = lazyModule(() => import('./font-coverage.ts'));

/** Load the checker once, then resolve each run against the current font registry. */
export const fontCoversText: typeof checkCoverage = async (...args) =>
  (await loadCoverage()).fontCoversText(...args);
