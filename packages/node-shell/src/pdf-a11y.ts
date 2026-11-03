// SPDX-License-Identifier: MPL-2.0
/**
 * Shared WASM transport for the PDF accessibility check, used by the browser, Node and CLI shells.
 *
 * The module reads a PDF and returns the 32 rule results. It never writes a PDF. The engine does not
 * load it: `verifyExport` takes a reader and the shells supply one built here.
 */
import type {
  PdfAccessibilityFinding, PdfAccessibilityReport, PdfAccessibilityRuleResult, PdfAccessibilityStatus,
} from '@lolly-tools/core/host-v1';

/** The module's own input cap. */
export const PDF_A11Y_MAX_BYTES = 256 * 1024 * 1024;
const MAX_RESULT = 20 * 1024 * 1024;
const OP_CHECK = 1;
const OP_REDACT = 2;
const STATUSES = new Set<string>(['passed', 'failed', 'manual', 'skipped']);

/** Why a file was not checked. */
export type PdfAccessibilityErrorCode = 'not-pdf' | 'encrypted' | 'damaged' | 'too-large';

export class PdfAccessibilityError extends Error {
  readonly code: PdfAccessibilityErrorCode;
  constructor(code: PdfAccessibilityErrorCode, message: string) {
    super(message);
    this.name = 'PdfAccessibilityError';
    this.code = code;
  }
}

interface A11yExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  pdf_a11y_alloc(length: number): number;
  pdf_a11y_free(pointer: number): void;
  pdf_a11y_run(pointer: number, length: number, operation: number): number;
  pdf_a11y_result_ptr(): number;
  pdf_a11y_result_len(): number;
}
function isApi(e: WebAssembly.Exports): e is A11yExports {
  return e.memory instanceof WebAssembly.Memory
    && ['pdf_a11y_alloc', 'pdf_a11y_free', 'pdf_a11y_run', 'pdf_a11y_result_ptr', 'pdf_a11y_result_len'].every(k => typeof e[k] === 'function');
}

/** A box to remove content under, in PDF points from the top-left of the page's MediaBox. */
export interface PdfKeepTextBar { page: number; x: number; y: number; w: number; h: number }

export interface PdfKeepTextRequest {
  bars: PdfKeepTextBar[];
  /** Box colour as three numbers from 0 to 1. */
  fill?: [number, number, number];
  /** Text drawn on each box. Standard-font characters only. */
  label?: string;
  labelColor?: [number, number, number];
  /** Also remove metadata, attachments and other applications' private data. */
  sanitize?: boolean;
}

/** What the module removed. The counts are the module's own; Lolly checks the result separately. */
export interface PdfKeepTextSummary {
  v: 1;
  marks: number;
  pages: number;
  glyphs: number;
  images_removed: number;
  images_cleared: number;
  paths_removed: number;
  paths_clipped: number;
  forms_rewritten: number;
  forms_removed: number;
  annotations: number;
  fields: number;
  tags: number;
  xfa_removed: boolean;
  sanitized: [string, number][];
}

export type PdfKeepTextErrorCode = 'not-pdf' | 'encrypted' | 'damaged' | 'too-large' | 'refused' | 'bad-request';

/** The module could not remove the content, or would not claim to have. Nothing was changed. */
export class PdfKeepTextError extends Error {
  readonly code: PdfKeepTextErrorCode;
  constructor(code: PdfKeepTextErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PdfKeepTextError';
    this.code = code;
  }
}

export interface PdfA11yKernel {
  /** Check a PDF. Throws `PdfAccessibilityError` when the file cannot be read. */
  check(bytes: Uint8Array): PdfAccessibilityReport;
  /** Remove the content under boxes and keep the rest of the page. Throws `PdfKeepTextError`. */
  redact(bytes: Uint8Array, request: PdfKeepTextRequest): { bytes: Uint8Array; summary: PdfKeepTextSummary };
  /** True once the module trapped. Its memory cannot be trusted again, so a loader starts a new one. */
  readonly retired: boolean;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function readFinding(raw: unknown): PdfAccessibilityFinding {
  if (!isObject(raw) || typeof raw.message !== 'string' || typeof raw.pattern !== 'string') throw new Error('malformed finding');
  const values = Array.isArray(raw.values)
    ? raw.values.filter((v): v is [string, string] => Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string').map(([k, v]) => [k, v] as [string, string])
    : [];
  const out: PdfAccessibilityFinding = { message: raw.message, pattern: raw.pattern, values };
  // The module counts pages from 0. Everything Lolly shows counts from 1.
  if (typeof raw.page === 'number' && Number.isInteger(raw.page) && raw.page >= 0) out.page = raw.page + 1;
  if (Array.isArray(raw.object) && raw.object.length === 2 && raw.object.every(n => Number.isInteger(n))) out.object = [raw.object[0], raw.object[1]];
  if (Array.isArray(raw.bbox) && raw.bbox.length === 4 && raw.bbox.every(n => typeof n === 'number' && Number.isFinite(n))) {
    out.bbox = [raw.bbox[0], raw.bbox[1], raw.bbox[2], raw.bbox[3]];
  }
  return out;
}

/** Validate the module's JSON. A report that does not parse is treated as a damaged read, never as a pass. */
export function parsePdfAccessibilityReport(json: string): PdfAccessibilityReport {
  const raw: unknown = JSON.parse(json);
  if (!isObject(raw) || raw.v !== 1 || typeof raw.pages !== 'number' || !Array.isArray(raw.rules)) throw new Error('malformed report');
  const rules: PdfAccessibilityRuleResult[] = raw.rules.map((r: unknown) => {
    if (!isObject(r) || typeof r.id !== 'string' || typeof r.category !== 'string' || typeof r.status !== 'string' || !STATUSES.has(r.status)) {
      throw new Error('malformed rule');
    }
    return {
      id: r.id, category: r.category, manual: r.manual === true, applies: r.applies === true,
      status: r.status as PdfAccessibilityStatus,
      findings: Array.isArray(r.findings) ? r.findings.map(readFinding) : [],
    };
  });
  return { v: 1, pages: raw.pages, rules };
}

const REFUSAL = /^(not-pdf|encrypted|damaged): ?(.*)$/s;
const KEEP_TEXT_REFUSAL = /^(not-pdf|encrypted|damaged|refused|bad-request): ?(.*)$/s;

export async function createPdfA11yKernel(wasm: Uint8Array): Promise<PdfA11yKernel> {
  const { instance } = await WebAssembly.instantiate(wasm as Uint8Array<ArrayBuffer>, {});
  if (!isApi(instance.exports)) throw new Error('The PDF accessibility module ABI is incompatible.');
  const api = instance.exports;
  let retired = false;

  function check(bytes: Uint8Array): PdfAccessibilityReport {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new PdfAccessibilityError('not-pdf', 'The file is empty, so it was not checked.');
    if (bytes.length > PDF_A11Y_MAX_BYTES) throw new PdfAccessibilityError('too-large', 'The PDF is larger than 256 MB, so it was not checked.');
    const pointer = api.pdf_a11y_alloc(bytes.length);
    if (!pointer) throw new PdfAccessibilityError('too-large', 'The PDF is too large for the accessibility check to hold in memory, so it was not checked.');
    try {
      new Uint8Array(api.memory.buffer, pointer, bytes.length).set(bytes);
      const status = api.pdf_a11y_run(pointer, bytes.length, OP_CHECK);
      const length = api.pdf_a11y_result_len(), at = api.pdf_a11y_result_ptr();
      if (length > MAX_RESULT || at + length > api.memory.buffer.byteLength) throw new PdfAccessibilityError('damaged', 'The accessibility check returned an oversized answer, so the file was not checked.');
      const text = new TextDecoder().decode(new Uint8Array(api.memory.buffer, at, length).slice());
      if (status !== 0) {
        const m = REFUSAL.exec(text);
        throw new PdfAccessibilityError((m?.[1] as PdfAccessibilityErrorCode | undefined) ?? 'damaged', m?.[2] || 'The PDF could not be read, so it was not checked.');
      }
      try { return parsePdfAccessibilityReport(text); } catch {
        throw new PdfAccessibilityError('damaged', 'The accessibility check returned an answer Lolly could not read, so the file was not checked.');
      }
    } finally { api.pdf_a11y_free(pointer); }
  }
  function redact(bytes: Uint8Array, request: PdfKeepTextRequest): { bytes: Uint8Array; summary: PdfKeepTextSummary } {
    if (retired) throw new PdfKeepTextError('refused', 'The module stopped on an earlier file and must be started again.');
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new PdfKeepTextError('not-pdf', 'The file is empty.');
    const header = new TextEncoder().encode(JSON.stringify(request));
    const total = 4 + header.length + bytes.length;
    if (total > PDF_A11Y_MAX_BYTES) throw new PdfKeepTextError('too-large', 'The PDF is larger than 256 MB.');
    const pointer = api.pdf_a11y_alloc(total);
    if (!pointer) throw new PdfKeepTextError('too-large', 'The PDF is too large to hold in memory for this.');
    try {
      const view = new Uint8Array(api.memory.buffer, pointer, total);
      new DataView(api.memory.buffer, pointer, 4).setUint32(0, header.length, true);
      view.set(header, 4);
      view.set(bytes, 4 + header.length);
      let status: number;
      try { status = api.pdf_a11y_run(pointer, total, OP_REDACT); } catch (error) {
        retired = true;
        throw new PdfKeepTextError('refused', 'The PDF could not be processed safely.', { cause: error });
      }
      const length = api.pdf_a11y_result_len(), at = api.pdf_a11y_result_ptr();
      if (length > PDF_A11Y_MAX_BYTES || at + length > api.memory.buffer.byteLength) throw new PdfKeepTextError('damaged', 'The result was larger than expected.');
      const out = new Uint8Array(api.memory.buffer, at, length).slice();
      if (status !== 0) {
        const m = KEEP_TEXT_REFUSAL.exec(new TextDecoder().decode(out));
        throw new PdfKeepTextError((m?.[1] as PdfKeepTextErrorCode | undefined) ?? 'damaged', m?.[2] || 'The PDF could not be processed.');
      }
      if (out.length < 4) throw new PdfKeepTextError('damaged', 'The result was cut short.');
      const headLength = new DataView(out.buffer, out.byteOffset, 4).getUint32(0, true);
      if (4 + headLength > out.length) throw new PdfKeepTextError('damaged', 'The result was cut short.');
      let summary: PdfKeepTextSummary;
      try { summary = JSON.parse(new TextDecoder().decode(out.subarray(4, 4 + headLength))) as PdfKeepTextSummary; } catch {
        throw new PdfKeepTextError('damaged', 'The result summary could not be read.');
      }
      if (!isObject(summary) || summary.v !== 1) throw new PdfKeepTextError('damaged', 'The result summary could not be read.');
      return { bytes: out.slice(4 + headLength), summary };
    } finally { api.pdf_a11y_free(pointer); }
  }
  return { check, redact, get retired() { return retired; } };
}
