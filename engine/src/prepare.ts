// SPDX-License-Identifier: MPL-2.0
/** Source-bound inspection, consistent replacement and content-free preparation reports. */
import type { PrepareAPI, PreparationSource, PreparationRule, PreparationChoice, PreparationFinding, PreparationInspection, PreparationGroup, PreparationResult, PreparationReport, PreparationRecipe } from '@lolly-tools/core/host-v1';
import { openPreparationDocument, preparationDocuments, PREPARE_MAX_TOTAL, PREPARE_MAX_BYTES, type PreparationDocument, type PreparationUnit } from './prepare-document.ts';
import { inspectPrivateText, replacePrivateSpans, validatePreparationRules, PREPARE_MAX_FINDINGS, type PrivateSpan } from './prepare-text.ts';

export interface PreparationProgress { completed: number; total: number; phase: 'input' | 'output' }
export interface PreparationOptions { signal?: AbortSignal; progress?: (value: PreparationProgress) => void }
interface Scan {
  inspection: PreparationInspection;
  roots: PreparationDocument[];
  spans: Map<string, { unit: PreparationUnit; span: PrivateSpan }>;
}
const GENERAL_LIMITS = ['File and archive member names are not inspected.', 'Pattern suggestions can miss confidential information and can be wrong. Review the result.', 'No online credential validation or external reference lookup was performed.'];
export async function preparationDigest(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)), b => b.toString(16).padStart(2, '0')).join('');
}
function validateSources(sources: PreparationSource[]): void {
  if (!Array.isArray(sources) || !sources.length || sources.length > 100) throw new Error('Choose between 1 and 100 files.');
  const ids = new Set<string>();
  let total = 0;
  for (const s of sources) {
    if (!s || typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(s.id) || ids.has(s.id) || typeof s.name !== 'string' || s.name.length > 1024 || !(s.bytes instanceof Uint8Array)) throw new Error('Invalid preparation source.');
    if (s.bytes.length > PREPARE_MAX_BYTES) throw new Error('Each source must be at most 32 MiB.');
    ids.add(s.id); total += s.bytes.length;
  }
  if (total > PREPARE_MAX_TOTAL) throw new Error('A preparation job supports at most 64 MiB of input.');
}
async function scan(sources: PreparationSource[], rules: PreparationRule[], options: PreparationOptions = {}): Promise<Scan> {
  validateSources(sources); sources = sources.map(s => ({ ...s, bytes: Uint8Array.from(s.bytes) })); rules = validatePreparationRules(rules);
  const inspection: PreparationInspection = { version: 1, sources: [], scopes: [], findings: [], groups: [], rules };
  const roots: PreparationDocument[] = [];
  const spans = new Map<string, { unit: PreparationUnit; span: PrivateSpan }>();
  const groups = new Map<string, PreparationGroup>();
  const budget = { scopes: 0, expanded: 0, units: 0 };
  for (const [index, source] of sources.entries()) {
    options.signal?.throwIfAborted();
    const digest = await preparationDigest(source.bytes);
    inspection.sources.push({ id: source.id, sha256: digest, size: source.bytes.length, ...(source.revision ? { revision: source.revision } : {}) });
    const root = openPreparationDocument(source.bytes, source.name, source.id, source.id, rules, budget);
    roots.push(root);
    for (const doc of preparationDocuments([root])) {
      inspection.scopes.push(doc.scope);
      for (const unit of doc.units) {
        if (inspection.findings.length >= PREPARE_MAX_FINDINGS) { doc.scope.status = 'partial'; doc.scope.limitations.push('The 2,000-finding limit was reached.'); break; }
        const found = inspectPrivateText(unit.text, rules, unit.field);
        if (found.truncated) { doc.scope.status = 'partial'; doc.scope.limitations.push('The finding limit was reached.'); }
        for (const span of found.spans) {
          if (inspection.findings.length >= PREPARE_MAX_FINDINGS) { doc.scope.status = 'partial'; break; }
          let group = groups.get(span.value);
          if (!group) {
            group = { id: `g${groups.size}`, value: span.value, replacement: `[${span.category.toUpperCase()}_${groups.size + 1}]`, category: span.category, count: 0 };
            groups.set(span.value, group);
          }
          group.count++;
          const finding: PreparationFinding = { id: `f${inspection.findings.length}`, scopeId: unit.scopeId, groupId: group.id, rule: span.rule, category: span.category, label: span.label, uncertain: span.uncertain, location: unit.location, value: span.value, line: unit.line + unit.text.slice(0, span.start).split('\n').length - 1 };
          inspection.findings.push(finding); spans.set(finding.id, { unit, span });
        }
      }
    }
    options.progress?.({ completed: index + 1, total: sources.length, phase: 'input' });
    // Between files the host can service cancellation and release temporary work.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  options.signal?.throwIfAborted();
  inspection.groups = [...groups.values()];
  inspection.scopes.forEach(scope => { scope.limitations = [...new Set(scope.limitations)]; });
  return { inspection, roots, spans };
}

export async function inspectPreparation(sources: PreparationSource[], rules: PreparationRule[] = [], options?: PreparationOptions): Promise<PreparationInspection> {
  return (await scan(sources, rules, options)).inspection;
}

/** Member indexes shift after removals. Follow the original tree's sibling
 * removals, rather than matching private path strings (which can be ambiguous). */
function outputScopeId(id: string, remove: Set<string>): string | undefined {
  const [source, ...steps] = id.split(':m');
  let original = source!, output = source!;
  for (const step of steps) {
    const index = Number(step), prefix = `${original}:m`;
    const skipped = [...remove].filter(r => r.startsWith(prefix) && /^\d+$/.test(r.slice(prefix.length)) && Number(r.slice(prefix.length)) < index).length;
    original += `:m${index}`;
    if (remove.has(original)) return undefined;
    output += `:m${index - skipped}`;
  }
  return output;
}

export async function applyPreparation(sources: PreparationSource[], inspection: PreparationInspection, choices: PreparationChoice[], removeScopes: string[] = [], options: PreparationOptions = {}): Promise<PreparationResult> {
  validateSources(sources); sources = sources.map(s => ({ ...s, bytes: Uint8Array.from(s.bytes) }));
  if (inspection?.version !== 1) throw new Error('Unsupported preparation inspection.');
  const fresh = await scan(sources, inspection.rules, options);
  if (JSON.stringify(fresh.inspection.sources) !== JSON.stringify(inspection.sources)
    || JSON.stringify(fresh.inspection.findings) !== JSON.stringify(inspection.findings)) throw new Error('The source or inspection changed. Inspect again before applying choices.');
  if (!Array.isArray(choices) || choices.length > PREPARE_MAX_FINDINGS || !Array.isArray(removeScopes) || removeScopes.length > 300) throw new Error('Too many preparation choices.');
  const chosen = new Map<string, PreparationChoice>();
  for (const choice of choices) {
    if (!fresh.inspection.groups.some(g => g.id === choice.groupId) || chosen.has(choice.groupId) || typeof choice.replacement !== 'string' || choice.replacement.length > 4096) throw new Error('Invalid replacement choice.');
    if (choice.findings && (!Array.isArray(choice.findings) || choice.findings.some(id => !fresh.inspection.findings.some(f => f.id === id && f.groupId === choice.groupId)))) throw new Error('A selected occurrence no longer belongs to this group.');
    chosen.set(choice.groupId, choice);
  }
  const remove = new Set(removeScopes);
  for (const id of remove) if (!fresh.inspection.scopes.some(s => s.id === id && s.id !== s.sourceId)) throw new Error('Only listed archive members can be removed.');
  const byUnit = new Map<string, { unit: PreparationUnit; edits: { span: PrivateSpan; replacement: string }[] }>();
  const replaced = new Map<string, number>();
  for (const finding of fresh.inspection.findings) {
    const choice = chosen.get(finding.groupId);
    if (choice?.replacement === finding.value) continue;
    if (!choice || choice.findings && !choice.findings.includes(finding.id)) continue;
    const entry = fresh.spans.get(finding.id)!;
    const group = byUnit.get(entry.unit.id) ?? { unit: entry.unit, edits: [] };
    group.edits.push({ span: entry.span, replacement: choice.replacement }); byUnit.set(entry.unit.id, group);
    replaced.set(finding.scopeId, (replaced.get(finding.scopeId) ?? 0) + 1);
  }
  const values = new Map([...byUnit].map(([id, { unit, edits }]) => [id, replacePrivateSpans(unit.text, edits)]));
  const outputs: PreparationSource[] = [], failed = new Set<string>();
  for (const [index, root] of fresh.roots.entries()) {
    options.signal?.throwIfAborted();
    const source = sources[index]!;
    try {
      const bytes = root.write(values, remove);
      if (bytes.length > PREPARE_MAX_BYTES) throw new Error('The result would exceed the size limit.');
      outputs.push({ ...source, bytes: bytes.slice() });
    } catch { failed.add(source.id); outputs.push({ ...source, bytes: source.bytes.slice() }); }
  }
  const after = await inspectPreparation(outputs, inspection.rules, { ...options, progress: p => options.progress?.({ ...p, phase: 'output' }) });
  const report: PreparationReport = {
    version: 1, operation: 'prepare-for-sharing', execution: 'device',
    sources: fresh.inspection.sources.map(({ id, sha256, size }) => ({ id, sha256, size })),
    outputs: after.sources.map(s => ({ id: s.id, sha256: s.sha256, size: s.size, changed: s.sha256 !== fresh.inspection.sources.find(x => x.id === s.id)?.sha256 })),
    scopes: fresh.inspection.scopes.map(scope => {
      const failedSource = failed.has(scope.sourceId);
      const currentId = failedSource ? scope.id : outputScopeId(scope.id, remove);
      const current = currentId === undefined ? undefined : after.scopes.find(s => s.id === currentId);
      const deleted = !failedSource && [...remove].some(id => scope.id === id || scope.id.startsWith(`${id}:`));
      return { id: scope.id, status: current?.status ?? scope.status, format: scope.format,
        findings: inspection.findings.filter(f => f.scopeId === scope.id).length,
        replaced: failedSource ? 0 : deleted ? inspection.findings.filter(f => f.scopeId === scope.id).length : replaced.get(scope.id) ?? 0,
        remaining: current ? after.findings.filter(f => f.scopeId === current.id).length : 0,
        limitations: failedSource ? ['Selected changes could not be applied to this file. The original was retained; adjust the choices or retry.'] : deleted ? ['Member removed by your choice.'] : current?.limitations ?? scope.limitations };
    }),
    replaced: 0, remaining: after.findings.length, limitations: GENERAL_LIMITS,
    ...(failed.size ? { stages: [...failed].map(sourceId => ({ sourceId, operation: 'replace-values' as const, status: 'failed' as const, inputSha256: fresh.inspection.sources.find(s => s.id === sourceId)!.sha256, outputSha256: after.sources.find(s => s.id === sourceId)!.sha256, limitations: ['Selected changes failed. Original retained.'] })) } : {}),
  };
  report.replaced = report.scopes.reduce((n, s) => n + s.replaced, 0);
  return { outputs, report, inspection: after };
}

export function createPrepareAPI(): PrepareAPI {
  return { inspect: inspectPreparation, apply: applyPreparation };
}
/** Serialize a recipe through an allowlist; never spread an inspection/map. */
export function preparationRecipe(categories: string[], rules: PreparationRule[] = []): PreparationRecipe {
  if (categories.length > 100 || categories.some(c => !/^[a-z-]{1,32}$/.test(c))) throw new Error('Invalid recipe categories.');
  return { version: 1, categories: [...new Set(categories)], fields: [...new Set(validatePreparationRules(rules).filter(r => r.kind === 'field').map(r => r.value))] };
}
export function readPreparationRecipe(value: unknown): PreparationRecipe {
  if (!value || typeof value !== 'object') throw new Error('Invalid preparation recipe.');
  const recipe = value as PreparationRecipe;
  if (recipe.version !== 1 || !Array.isArray(recipe.categories) || !Array.isArray(recipe.fields) || recipe.fields.length > 100) throw new Error('Unsupported preparation recipe.');
  return preparationRecipe(recipe.categories, recipe.fields.map((value, i) => ({ id: `field-${i}`, kind: 'field', label: 'Custom field', value })));
}
