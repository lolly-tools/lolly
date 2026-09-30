// SPDX-License-Identifier: MPL-2.0
import { sha256Hex } from '../bytes.ts';
import { motionProductionChecks, compareProductionMotion } from './motion.ts';
import { compareProductionPixels } from './compare.ts';
import { parseProductionSpec, productionDigest } from './contract.ts';
import type { ProductionCheck, ProductionCollector, ProductionSpec, ProductionFacts, ProductionReport } from './types.ts';

/** Every declared requirement gets a result, including absent collectors. */
export function evaluateProductionFacts(contract: ProductionSpec, facts: ProductionFacts): ProductionCheck[] {
  const checks: ProductionCheck[] = [];
  const add = (id: string, actual: string | number | boolean | undefined, expected: string | number | boolean, method: ProductionCheck['method'], location = 'artifact'): void => {
    const pass = actual === undefined ? undefined : typeof actual === 'number' && typeof expected === 'number'
      ? Number.isFinite(actual) && Math.abs(actual - expected) <= Number.EPSILON * 8 * Math.max(1, Math.abs(expected)) : actual === expected;
    checks.push({ id, state: pass === undefined ? 'undetermined' : pass ? 'pass' : 'fail', method, location,
      reason: actual === undefined ? 'fact-unavailable' : 'exact-requirement', waivable: false,
      ...(actual === undefined ? {} : { actual: typeof actual === 'boolean' ? String(actual) : actual }), expected: typeof expected === 'boolean' ? String(expected) : expected });
  };
  add('format', facts.format, contract.format, 'artifact-parser');
  add('readability', facts.readable, true, contract.profile === 'lolly/production-motion-v1' ? 'decoded-media' : 'artifact-parser');
  add('width', facts.width, contract.width, 'artifact-parser'); add('height', facts.height, contract.height, 'artifact-parser');
  if (contract.profile === 'lolly/production-still-v1') {
    add('pages', facts.pages, contract.pages, 'artifact-parser');
    if (contract.alpha !== 'any') add('alpha', facts.opaque, contract.alpha === 'opaque', 'decoded-pixels');
  } else checks.push(...motionProductionChecks(contract, facts));
  if (contract.sourceSha256) add('source', facts.sourceSha256, contract.sourceSha256, 'resolved-structure');
  if (contract.contextSha256) add('context', facts.contextSha256, contract.contextSha256, 'resolved-structure');
  for (const r of contract.requirements) {
    const map = r.kind === 'text' ? facts.text : r.kind === 'link' ? facts.links : r.kind === 'node' ? facts.nodes : r.kind === 'input' ? facts.inputs : facts.resources;
    const value = map && Object.hasOwn(map, r.location) ? map[r.location] : undefined;
    add(`requirement.${r.id}`, value, r.expected, r.kind === 'resource' ? 'resolved-resource' : r.kind === 'input' ? 'resolved-structure' : 'artifact-parser', r.location);
  }
  return checks;
}

export async function inspectProduction(bytes: Uint8Array, input: unknown, collect: ProductionCollector, options: {
  reference?: Uint8Array; signal?: AbortSignal; resolved?: Pick<ProductionFacts, 'sourceSha256' | 'contextSha256' | 'resources' | 'inputs' | 'records'>;
} = {}): Promise<ProductionReport> {
  const contract = parseProductionSpec(input), { signal } = options;
  signal?.throwIfAborted();
  const bounded = bytes.length <= 32 * 1024 * 1024;
  let facts: ProductionFacts = { limitations: ['artifact-byte-budget-exceeded'] };
  if (bounded) {
    try { facts = await collect(bytes, contract, signal); }
    catch { signal?.throwIfAborted(); facts = { limitations: ['collector-failed'] }; }
  }
  signal?.throwIfAborted();
  facts = { ...facts, ...options.resolved };
  const checks = evaluateProductionFacts(contract, facts);
  const limitations = [...facts.limitations, 'measurements-do-not-grant-delivery-authority'];
  const comparison = contract.profile === 'lolly/production-motion-v1' ? contract.motion.comparison : contract.comparison;
  if (comparison) {
    let reference: ProductionFacts | undefined;
    if (options.reference && options.reference.length <= 32 * 1024 * 1024 && await sha256Hex(options.reference) === comparison.referenceSha256) {
      try { reference = await collect(options.reference, contract, signal); }
      catch { signal?.throwIfAborted(); limitations.push('reference-collector-failed'); }
    } else limitations.push('reference-missing-or-digest-mismatch');
    checks.push(...(contract.profile === 'lolly/production-motion-v1' ? compareProductionMotion(reference, facts, contract, signal) : compareProductionPixels(reference?.pixels, facts.pixels, comparison, signal)));
  }
  const body = {
    profile: contract.profile, detector: 'lolly-production/1' as const, artifactSha256: await sha256Hex(bytes), contractSha256: await productionDigest(contract),
    sourceSha256: facts.sourceSha256 ?? null, contextSha256: facts.contextSha256 ?? null,
    checks, limitations: [...new Set(limitations)].sort(), ...(facts.records ? { records: facts.records } : {}),
  };
  return { ...body, reportSha256: await productionDigest(body) };
}

/** Validate complete coverage and bindings independently of any summary verdict. */
export async function productionProblems(report: ProductionReport, bytes: Uint8Array, input: unknown): Promise<string[]> {
  const contract = parseProductionSpec(input), problems: string[] = [];
  if (!report || report.profile !== contract.profile || report.detector !== 'lolly-production/1') return ['unsupported-production-report'];
  const { reportSha256, ...body } = report;
  if (await productionDigest(body) !== reportSha256) problems.push('report-digest-mismatch');
  if (report.artifactSha256 !== await sha256Hex(bytes)) problems.push('artifact-digest-mismatch');
  if (report.contractSha256 !== await productionDigest(contract)) problems.push('contract-digest-mismatch');
  const expected = evaluateProductionFacts(contract, { limitations: [] });
  if (contract.profile === 'lolly/production-motion-v1') expected.push(...compareProductionMotion(undefined, { limitations: [] }, contract));
  else if (contract.comparison) expected.push(...compareProductionPixels(undefined, undefined, contract.comparison));
  if (!Array.isArray(report.checks) || report.checks.length !== expected.length) return [...problems, 'check-coverage-incomplete'];
  if (report.checks.some(c => !c || typeof c.id !== 'string')) return [...problems, 'check-coverage-malformed'];
  for (const [id, wanted, observed] of [['source', contract.sourceSha256, report.sourceSha256], ['context', contract.contextSha256, report.contextSha256]] as const) {
    if (wanted && (report.checks.find(c => c.id === id)?.actual ?? null) !== observed) problems.push(`${id}-observation-binding-mismatch`);
  }
  for (const check of expected) {
    const rows = report.checks.filter(c => c.id === check.id);
    if (rows.length !== 1 || rows[0]!.method !== check.method || rows[0]!.location !== check.location || rows[0]!.waivable !== check.waivable || rows[0]!.tolerance !== check.tolerance || rows[0]!.operator !== check.operator) problems.push(`${check.id}:coverage`);
    else {
      const row = rows[0]!;
      let expectedValue = check.expected, comparison: 'exact' | 'max' | 'min' = check.operator ?? 'exact';
      if (check.id === 'appearance.whole') { expectedValue = contract.comparison!.maxChangedFraction; comparison = 'max'; }
      else if (check.id.startsWith('appearance.')) {
        const region = contract.comparison!.regions.find(r => check.id === `appearance.${r.id}.ssim` || check.id === `appearance.${r.id}.ink`)!;
        comparison = check.id.endsWith('.ssim') ? 'min' : 'max'; expectedValue = comparison === 'min' ? region.minSsim : region.maxInkDelta;
      }
      if (row.state === 'pass') {
        const actual = row.actual;
        const matches = typeof expectedValue === 'number' ? typeof actual === 'number' && Number.isFinite(actual)
          && (comparison === 'max' ? actual <= expectedValue : comparison === 'min' ? actual >= expectedValue : Math.abs(actual - expectedValue) <= (check.tolerance ?? Number.EPSILON * 8 * Math.max(1, Math.abs(expectedValue))))
          : actual === expectedValue;
        if (row.expected !== expectedValue || !matches) problems.push(`${check.id}:measurement-mismatch`);
      } else problems.push(`${check.id}:${row.state}`);
    }
  }
  return problems;
}
export class ProductionVerificationError extends Error {
  readonly code = 'PRODUCTION_VERIFICATION_FAILED';
  readonly report: ProductionReport;
  constructor(report: ProductionReport, problems: string[]) {
    super(`Production checks did not complete: ${problems.join(', ')}.`); this.report = report;
  }
}
export async function requireProduction(report: ProductionReport, bytes: Uint8Array, contract: unknown): Promise<void> {
  const problems = await productionProblems(report, bytes, contract);
  if (problems.length) throw new ProductionVerificationError(report, problems);
}
