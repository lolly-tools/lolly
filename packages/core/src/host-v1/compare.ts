// SPDX-License-Identifier: MPL-2.0
/** Local comparison of supplied snapshots. Source resolution belongs to the shell. */
export interface ComparisonIdentity {
  readonly id: string;
  readonly kind: 'text' | 'file' | 'state' | 'revision' | 'asset';
  readonly label: string;
  readonly revision?: string;
}
export interface ComparisonSource {
  readonly identity: ComparisonIdentity;
  readonly content: { readonly kind: 'text'; readonly text: string } | { readonly kind: 'structure'; readonly value: unknown }
    /** Raw YAML is read as ordinary data within the comparison job. Refusals never imply equality. */
    | { readonly kind: 'yaml'; readonly text: string }
    | { readonly kind: 'table'; readonly tables: readonly ComparisonTable[] }
    | { readonly kind: 'document'; readonly units: readonly ComparisonDocumentUnit[] };
  /** Exact retained bytes only. Never substitute a current asset for an old version. */
  readonly bytes?: Uint8Array;
  readonly fidelity?: { readonly level: 'complete' | 'partial' | 'unavailable'; readonly limitations: readonly string[] };
}
export type ComparisonCell = string | number | boolean | null;
/** Column labels and cached cell values, without formula execution or formatting. */
export interface ComparisonTable {
  readonly name: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly ComparisonCell[])[];
}
/** Extracted reading units. A provider supplies an ID only when the format retains one. */
export interface ComparisonDocumentUnit {
  readonly id?: string;
  readonly text: string;
  readonly label?: string;
  readonly location?: Pick<ComparisonLocation, 'page' | 'slide' | 'block'>;
}
export interface ComparisonOptions {
  mode?: 'text' | 'structure' | 'table' | 'document';
  granularity?: 'line' | 'word';
  whitespace?: 'exact' | 'ignore';
  ignoreCase?: boolean;
  /** Ordered arrays by default; stable IDs must be explicitly selected. */
  arrayAlignment?: 'position' | 'id';
  /** An exact, unique column label on both sides. Omission compares rows by position. */
  tableRowKey?: string;
  /** Text uses unique exact-content anchors and explains positional fallback. */
  documentAlignment?: 'position' | 'id' | 'text';
  ignoreRootMetadata?: boolean;
  maxChanges?: number;
  maxWork?: number;
}
export interface ComparisonRequest {
  version: 1;
  before: ComparisonSource;
  after: ComparisonSource;
  options?: ComparisonOptions;
}
export interface ComparisonLocation {
  path: Array<string | number>;
  line?: number;
  offset?: number;
  table?: string;
  row?: number;
  column?: string;
  page?: number;
  slide?: number;
  block?: number;
}
export interface ComparisonChange {
  kind: 'added' | 'removed' | 'changed' | 'moved';
  before?: ComparisonLocation;
  after?: ComparisonLocation;
  beforeValue?: string;
  afterValue?: string;
  valueTruncated?: boolean;
}
export interface ComparisonResult {
  version: 1;
  before: ComparisonIdentity;
  after: ComparisonIdentity;
  mode: 'text' | 'structure' | 'table' | 'document';
  options: ComparisonOptions;
  equality: 'identical-bytes' | 'equivalent-content' | 'different' | 'undetermined';
  byteEquality: 'equal' | 'different' | 'unknown';
  appearance: 'not-compared';
  completeness: 'complete' | 'partial';
  alignment: 'line' | 'word' | 'object-keys-ordered-arrays' | 'stable-id'
    | 'table-key' | 'table-position' | 'document-id' | 'document-text' | 'document-position';
  summary: { added: number; removed: number; changed: number; moved: number; total: number };
  changes: ComparisonChange[];
  detailsTruncated: boolean;
  limitations: string[];
}
/** Optional additive v1.189. Content is neither persisted nor logged by this API. */
export interface CompareAPI {
  run(request: ComparisonRequest, options?: { signal?: AbortSignal }): Promise<ComparisonResult>;
  /** Optional additive v1.190. Shells supply decoded, immutable preview pages. */
  visual?(request: VisualComparisonRequest, options?: { signal?: AbortSignal }): Promise<VisualComparisonResult>;
}

export interface VisualComparisonPage {
  readonly page: number;
  /** Display geometry after orientation, in the declared units. */
  readonly width: number;
  readonly height: number;
  readonly unit: 'px' | 'pt';
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly rgba: Uint8ClampedArray;
}
export interface VisualComparisonSource {
  readonly identity: ComparisonIdentity;
  readonly pages: readonly VisualComparisonPage[];
  readonly totalPages: number;
  readonly bytes?: Uint8Array;
  readonly fidelity?: ComparisonSource['fidelity'];
}
export interface VisualComparisonOptions {
  /** Native: top-left, common scale. Fit: stretch each page to the common frame. */
  alignment?: 'native' | 'fit';
  /** Maximum ignored channel difference, 0–255, after compositing on white. */
  threshold?: number;
}
export interface VisualComparisonRequest {
  version: 1;
  before: VisualComparisonSource;
  after: VisualComparisonSource;
  options?: VisualComparisonOptions;
}
export interface VisualPageDifference {
  page: number;
  kind: 'added' | 'removed' | 'changed' | 'unchanged' | 'unavailable';
  width: number;
  height: number;
  /** Pixels per source display unit; fit alignment uses independent source scales. */
  scale: number;
  sizeChanged: boolean;
  changedPixels: number;
  sampledPixels: number;
  bounds?: { x: number; y: number; width: number; height: number };
  /** One byte per sampled pixel: 255 changed, 0 unchanged. No source colours. */
  mask: Uint8Array;
}
export interface VisualComparisonResult {
  version: 1;
  before: ComparisonIdentity;
  after: ComparisonIdentity;
  mode: 'visual';
  options: Required<VisualComparisonOptions>;
  byteEquality: 'equal' | 'different' | 'unknown';
  appearance: 'same-rendered-pixels' | 'different' | 'undetermined';
  completeness: 'complete' | 'partial';
  summary: { added: number; removed: number; changed: number; unchanged: number; unavailable: number; total: number };
  pages: VisualPageDifference[];
  limitations: string[];
}
