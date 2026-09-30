// SPDX-License-Identifier: MPL-2.0
import { productionDigest, productionJson } from './contract.ts';
import type { ProductionSpec, ProductionReport, ProductionEditPolicy, ProductionRepairPlan } from './types.ts';
import { productionProblems } from './report.ts';
export interface ProductionPatch {
  sourceSha256: string;
  reportSha256: string;
  findingSha256: string;
  findingId: string;
  input: string;
  before: unknown;
  after: unknown;
}
export type { ProductionEditPolicy, ProductionRepairPlan } from './types.ts';

/** A repair changes one declared input, never arbitrary source or policy. */
export async function applyProductionPatch(inputs: Record<string, unknown>, report: ProductionReport, patch: ProductionPatch, policy: ProductionEditPolicy): Promise<Record<string, unknown>> {
  const { reportSha256, ...body } = report;
  if (reportSha256 !== await productionDigest(body) || patch.reportSha256 !== reportSha256) throw new Error('Repair report is stale.');
  if (patch.sourceSha256 !== await productionDigest(inputs)) throw new Error('Repair source is stale.');
  const findings = report.checks.filter(c => c.id === patch.findingId && c.state === 'fail');
  if (findings.length !== 1 || patch.findingSha256 !== await productionDigest(findings[0])) throw new Error('Repair finding is stale or unresolved.');
  if (['__proto__', 'constructor', 'prototype'].includes(patch.input) || policy.protected.includes(patch.input) || !Object.hasOwn(inputs, patch.input)
    || !Object.hasOwn(policy.permitted, patch.input)) throw new Error('Repair input is protected or undeclared.');
  if (productionJson(inputs[patch.input]) !== productionJson(patch.before)) throw new Error('Repair precondition changed.');
  if (!policy.permitted[patch.input]!.some(value => productionJson(value) === productionJson(patch.after))) throw new Error('Repair value is not permitted.');
  return JSON.parse(productionJson({ ...inputs, [patch.input]: patch.after })) as Record<string, unknown>;
}

/** Inject the existing renderer/patch proposer; retain every attempted result. */
export async function runProductionRepairs<T extends { report: ProductionReport; bytes: Uint8Array; contract: ProductionSpec }>(inputs: Record<string, unknown>, policy: ProductionEditPolicy, operations: {
  render(inputs: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
  propose(inputs: Record<string, unknown>, report: ProductionReport): Promise<ProductionPatch | null>;
}, signal?: AbortSignal): Promise<{ inputs: Record<string, unknown>; attempts: T[]; stopped: 'verified' | 'unresolved' | 'no-progress' | 'attempt-limit' | 'regression' | 'protected-input' }> {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 0 || policy.maxAttempts > 8) throw new Error('Repair attempts must be between zero and eight.');
  let current = JSON.parse(productionJson(inputs)) as Record<string, unknown>;
  let renderedInputs = current;
  const attempts: T[] = [], seen = new Set<string>();
  let prior = Infinity, contractSha256: string | undefined;
  let passed = new Set<string>();
  for (let index = 0; ; index++) {
    signal?.throwIfAborted();
    const digest = await productionDigest(current);
    if (seen.has(digest)) return { inputs: renderedInputs, attempts, stopped: 'no-progress' }; seen.add(digest);
    const result = await operations.render(current, signal); signal?.throwIfAborted(); attempts.push(result); renderedInputs = current;
    const { reportSha256, ...body } = result.report;
    if (!result.report.checks.length || reportSha256 !== await productionDigest(body)) throw new Error('Repair renderer returned an invalid report.');
    if (contractSha256 && contractSha256 !== result.report.contractSha256) throw new Error('Repair cannot change its production contract.');
    contractSha256 = result.report.contractSha256;
    const problems = await productionProblems(result.report, result.bytes, result.contract);
    if (problems.some(p => !result.report.checks.some(c => p === `${c.id}:${c.state}`))) throw new Error('Repair renderer returned incomplete or stale evidence.');
    if (result.report.checks.some(c => passed.has(c.id) && c.state !== 'pass')) return { inputs: current, attempts, stopped: 'regression' };
    passed = new Set(result.report.checks.filter(c => c.state === 'pass').map(c => c.id));
    const unresolved = problems.length;
    if (!unresolved) return { inputs: current, attempts, stopped: 'verified' };
    if (unresolved >= prior) return { inputs: current, attempts, stopped: 'no-progress' }; prior = unresolved;
    if (index >= policy.maxAttempts) return { inputs: current, attempts, stopped: 'attempt-limit' };
    const patch = await operations.propose(current, result.report); signal?.throwIfAborted();
    if (!patch) return { inputs: current, attempts, stopped: 'unresolved' };
    if (result.contract.requirements.some(r => r.kind === 'input' && r.location === patch.input)) return { inputs: current, attempts, stopped: 'protected-input' };
    current = await applyProductionPatch(current, result.report, patch, policy);
  }
}

export interface ProductionAcceptance {
  reportSha256: string; artifactSha256: string; contractSha256: string;
  authority: { kind: 'local-person' | 'work-approval'; id: string; decisionRef: string };
  exceptions: { findingId: string; findingSha256: string; reason: string }[];
}
/** Authority is supplied by the shell's authenticated decision boundary, never by a detector. */
export async function acceptProduction(report: ProductionReport, bytes: Uint8Array, contract: ProductionSpec, authority: ProductionAcceptance['authority'], exceptions: ProductionAcceptance['exceptions'] = [], authorize?: (authority: ProductionAcceptance['authority'], report: ProductionReport) => Promise<boolean>): Promise<ProductionAcceptance> {
  const { reportSha256, ...body } = report;
  if (reportSha256 !== await productionDigest(body) || !report.checks.length) throw new Error('Acceptance requires an intact report.');
  if (authority.kind === 'work-approval' && (!authorize || !await authorize(authority, report))) throw new Error('A governed decision requires an authorized Work approval.');
  if (!['local-person', 'work-approval'].includes(authority.kind) || !authority.id.trim() || !authority.decisionRef.trim()) throw new Error('Acceptance requires an identified authority and decision.');
  const problems = await productionProblems(report, bytes, contract);
  if (problems.some(p => !report.checks.some(c => p === `${c.id}:${c.state}`))) throw new Error('Acceptance requires current complete coverage.');
  const pending = report.checks.filter(c => c.state !== 'pass');
  if (exceptions.length !== pending.length || new Set(exceptions.map(e => e.findingId)).size !== exceptions.length) throw new Error('Acceptance exception coverage does not match.');
  for (const check of pending) {
    const exception = exceptions.find(e => e.findingId === check.id);
    if (!check.waivable || check.state !== 'fail' || !exception?.reason.trim() || exception.findingSha256 !== await productionDigest(check)) throw new Error(`Cannot except ${check.id}.`);
  }
  return { reportSha256, artifactSha256: report.artifactSha256, contractSha256: report.contractSha256, authority: { ...authority }, exceptions: exceptions.map(e => ({ ...e })) };
}

/** A finite sequence of authored alternatives; no free-form rewrite operation. */
export function parseProductionRepair(value: unknown): ProductionRepairPlan {
  if (productionJson(value).length > 128 * 1024 || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid production repair plan.');
  const p = value as ProductionRepairPlan;
  if (Object.keys(p).some(k => !['protected', 'permitted', 'maxAttempts', 'when'].includes(k)) || !Number.isInteger(p.maxAttempts) || p.maxAttempts < 0 || p.maxAttempts > 8
    || !Array.isArray(p.protected) || p.protected.length > 256 || p.protected.some(k => typeof k !== 'string' || !k.length)
    || !p.permitted || typeof p.permitted !== 'object' || Array.isArray(p.permitted) || Object.keys(p.permitted).length > 32
    || Object.entries(p.permitted).some(([key, values]) => ['__proto__', 'constructor', 'prototype'].includes(key) || p.protected.includes(key) || !Array.isArray(values) || values.length < 1 || values.length > 8)
    || !Array.isArray(p.when) || p.when.length > 32 || p.when.some(r => !r || typeof r !== 'object' || Object.keys(r).some(k => !['findingId', 'input'].includes(k)) || typeof r.findingId !== 'string' || typeof r.input !== 'string' || !Object.hasOwn(p.permitted, r.input))) throw new Error('Invalid production repair plan.');
  return JSON.parse(productionJson(p)) as ProductionRepairPlan;
}
export async function proposeProductionPatch(inputs: Record<string, unknown>, report: ProductionReport, plan: ProductionRepairPlan): Promise<ProductionPatch | null> {
  for (const trigger of plan.when) {
    const check = report.checks.find(c => c.id === trigger.findingId && c.state === 'fail');
    if (!check || !Object.hasOwn(inputs, trigger.input)) continue;
    const values = plan.permitted[trigger.input]!;
    const index = values.findIndex(v => productionJson(v) === productionJson(inputs[trigger.input]));
    const after = values[index + 1];
    if (index + 1 >= values.length) continue;
    return { sourceSha256: await productionDigest(inputs), reportSha256: report.reportSha256, findingSha256: await productionDigest(check), findingId: check.id, input: trigger.input, before: inputs[trigger.input], after };
  }
  return null;
}
/** A saved local decision must still identify these bytes, rules and findings. */
export async function verifyProductionAcceptance(record: ProductionAcceptance, report: ProductionReport, bytes: Uint8Array, contract: ProductionSpec): Promise<void> {
  if (record.authority.kind !== 'local-person') throw new Error('Governed decisions require the Work authority adapter.');
  const expected = await acceptProduction(report, bytes, contract, record.authority, record.exceptions);
  if (productionJson(expected) !== productionJson(record)) throw new Error('Acceptance is stale.');
}
