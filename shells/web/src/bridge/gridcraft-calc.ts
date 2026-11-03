// SPDX-License-Identifier: MPL-2.0
import type { CalcAPI } from '@lolly-tools/core/host-v1';
import { createCalcAPI, createCalcEngine, xlsxRecalculator, type CalcEngine } from '../../../../engine/src/calc.ts';
import type { XlsxRecalculator } from '../../../../engine/src/xlsx-import.ts';
import { compileGridcraftCalc, createGridcraftCalcRunner } from '@lolly-tools/node-shell/gridcraft-calc';

let pending: Promise<CalcEngine> | undefined;
/**
 * Fetch and start the formula module the first time a formula needs working out. The clock
 * and seed of a fresh evaluation come from here, never from the module, which imports nothing.
 */
export function loadCalcEngine(): Promise<CalcEngine> {
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/gridcraft-calc/gridcraft-calc.wasm', import.meta.url));
    if (!response.ok) throw new Error('The formula module could not be loaded.');
    const module = await compileGridcraftCalc(new Uint8Array(await response.arrayBuffer()));
    return createCalcEngine(createGridcraftCalcRunner(module), () => ({ now: Date.now(), seed: crypto.getRandomValues(new Uint32Array(1))[0]! }));
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}

/** `host.calc` for the web shell; the module loads on first use. */
export function createWebCalcAPI(): CalcAPI {
  return {
    evaluate: async request => createCalcAPI(await loadCalcEngine()).evaluate(request),
    table: async (table, options) => createCalcAPI(await loadCalcEngine()).table(table, options),
    functions: async () => createCalcAPI(await loadCalcEngine()).functions(),
  };
}

/**
 * The `readXlsx` options that work out the formulas a file saved no result for, or nothing when
 * the module cannot be loaded. Every other formula keeps the value its author saw.
 */
export async function xlsxRecalcOptions(): Promise<{ recalc?: XlsxRecalculator; recalcWhen?: 'missing' }> {
  const recalc = await xlsxRecalc();
  return recalc ? { recalc, recalcWhen: 'missing' } : {};
}

/**
 * The recalculator for `readXlsx({ recalc })`, or undefined when the module cannot be
 * loaded: the import then shows each formula's saved result, as it did before.
 */
export async function xlsxRecalc(): Promise<XlsxRecalculator | undefined> {
  try { return xlsxRecalculator(await loadCalcEngine()); } catch { return undefined; }
}
