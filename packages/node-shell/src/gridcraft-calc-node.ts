// SPDX-License-Identifier: MPL-2.0
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCalcAPI, createCalcEngine, xlsxRecalculator, type CalcEngine } from '../../../engine/src/calc.ts';
import type { XlsxRecalculator } from '../../../engine/src/xlsx-import.ts';
import type { CalcAPI } from '@lolly-tools/core/host-v1';
import { compileGridcraftCalc, createGridcraftCalcRunner } from './gridcraft-calc.ts';
import { repoRoot } from './repo-root.ts';

let pending: Promise<CalcEngine> | undefined;
/** Load the formula module once per process. The clock and seed are read when a call asks for a fresh evaluation. */
export function loadCalcEngine(): Promise<CalcEngine> {
  pending ??= readFile(new URL('../wasm/gridcraft-calc/gridcraft-calc.wasm', import.meta.url))
    .catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return readFile(join(repoRoot(), 'packages/node-shell/wasm/gridcraft-calc/gridcraft-calc.wasm'));
    })
    .then(bytes => compileGridcraftCalc(new Uint8Array(bytes)))
    .then(module => createCalcEngine(createGridcraftCalcRunner(module), () => ({ now: Date.now(), seed: randomInt(2 ** 32) })))
    .catch(error => { pending = undefined; throw error; });
  return pending;
}

/** `host.calc` for the Node shells (CLI, TUI, MCP): the committed WASM read off disk, loaded on first use. */
export function createNodeCalcAPI(): CalcAPI {
  return {
    evaluate: async request => createCalcAPI(await loadCalcEngine()).evaluate(request),
    table: async (table, options) => createCalcAPI(await loadCalcEngine()).table(table, options),
    functions: async () => createCalcAPI(await loadCalcEngine()).functions(),
  };
}

/**
 * The recalculator for `readXlsx({ recalc })`, or undefined when the module cannot be
 * loaded (a packaged install without it): the import then shows saved results.
 */
export async function xlsxRecalc(): Promise<XlsxRecalculator | undefined> {
  try { return xlsxRecalculator(await loadCalcEngine()); } catch { return undefined; }
}
