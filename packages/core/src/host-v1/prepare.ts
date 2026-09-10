// SPDX-License-Identifier: MPL-2.0
/** Local preparation contracts. Inspection and maps contain private values;
 * only PreparationReport is suitable for routine history or diagnostic output. */
export interface PreparationSource {
  /** Opaque, non-sensitive identity within this job; included in reports. */
  id: string;
  name: string;
  bytes: Uint8Array;
  mime?: string;
  revision?: string;
}
export interface PreparationRule {
  id: string;
  label: string;
  kind: 'literal' | 'field';
  value: string;
}
export interface PreparationRecipe {
  version: 1;
  categories: string[];
  /** Custom field names only. Literal private values/maps never enter recipes. */
  fields: string[];
}
export interface PreparationScope {
  id: string;
  sourceId: string;
  /** Private local filename/member path. Excluded from summary reports. */
  path: string;
  format: string;
  status: 'inspected' | 'partial' | 'uninspected';
  limitations: string[];
}
export interface PreparationFinding {
  id: string;
  scopeId: string;
  groupId: string;
  rule: string;
  category: string;
  label: string;
  uncertain: boolean;
  /** Private source location and value. Never log or automatically persist. */
  location: string;
  value: string;
  line: number;
}
export interface PreparationGroup {
  id: string;
  value: string;
  replacement: string;
  category: string;
  count: number;
}
export interface PreparationInspection {
  version: 1;
  sources: { id: string; sha256: string; size: number; revision?: string }[];
  scopes: PreparationScope[];
  findings: PreparationFinding[];
  groups: PreparationGroup[];
  rules: PreparationRule[];
}
export interface PreparationChoice {
  groupId: string;
  replacement: string;
  /** Omit to replace all occurrences; otherwise apply only these finding ids. */
  findings?: string[];
}
export interface PreparationReport {
  version: 1;
  operation: 'prepare-for-sharing';
  execution: 'device';
  sources: { id: string; sha256: string; size: number }[];
  outputs: { id: string; sha256: string; size: number; changed: boolean }[];
  scopes: { id: string; status: PreparationScope['status']; format: string; findings: number; replaced: number; remaining: number; limitations: string[] }[];
  replaced: number;
  remaining: number;
  limitations: string[];
  stages?: { sourceId: string; operation: 'strip-hidden-data' | 'redact' | 'replace-values'; status: 'completed' | 'failed'; inputSha256: string; outputSha256: string; before?: number; after?: number; limitations: string[] }[];
}
export interface PreparationResult {
  outputs: PreparationSource[];
  report: PreparationReport;
  /** Private reinspection for local review, excluded from report exports. */
  inspection: PreparationInspection;
}
export interface PrepareAPI {
  inspect(sources: PreparationSource[], rules?: PreparationRule[]): Promise<PreparationInspection>;
  apply(sources: PreparationSource[], inspection: PreparationInspection, choices: PreparationChoice[], removeScopes?: string[]): Promise<PreparationResult>;
}
