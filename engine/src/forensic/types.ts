// SPDX-License-Identifier: MPL-2.0
/** Located observations and explicit coverage for a forensic assessment. */
export const FORENSIC_VERSION = 'forensic-ai/1';
export interface ForensicBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ForensicLine {
  text: string;
  box: ForensicBox;
  size?: number;
  confidence: number;
  index?: number;
}
export interface ForensicShape {
  box: ForensicBox;
  radius: number;
  fill: string;
  accent?: { edge: 'left' | 'top' | 'right' | 'bottom'; width: number; colour: string };
}
export interface ForensicPage {
  id: string;
  width: number;
  height: number;
  text: string;
  source: 'digital' | 'ocr';
  complete: boolean;
  lines: ForensicLine[];
  shapes: ForensicShape[];
  layoutMethod?: 'source-geometry' | 'decoded-pixels';
  docKind?: 'prose' | 'markdown' | 'code';
}
export interface ForensicLocation {
  page: string;
  box?: ForensicBox;
  span?: { index: number; length: number };
}
export interface ForensicFinding {
  id: string;
  rule: string;
  family: string;
  version: string;
  modality: 'text' | 'layout';
  label: string;
  detail: string;
  method: 'original-text' | 'source-geometry' | 'decoded-pixels' | 'ocr' | 'local-classifier';
  confidence: number;
  confidenceBasis: 'heuristic' | 'observed';
  contribution: 'weak-clue' | 'specific-artifact' | 'context-excluded';
  alternatives: string[];
  locations: ForensicLocation[];
  measurements: Record<string, string | number | boolean>;
  observations?: {
    method: string;
    confidence: number;
    measurements: Record<string, string | number | boolean>;
    locations: ForensicLocation[];
  }[];
}
export interface ForensicCoverage {
  collector: string;
  page?: string;
  state:
    | 'completed'
    | 'partial'
    | 'skipped'
    | 'unsupported'
    | 'unavailable'
    | 'failed'
    | 'cancelled';
  reason: string;
  ranges?: { index: number; length: number }[];
  version: string;
}
export interface ForensicModelWindow {
  index: number;
  length: number;
  tokens: number;
  rawScore: number;
}
export interface ForensicModelObservation {
  page: string;
  model: string;
  version: string;
  windows: ForensicModelWindow[];
  complete: boolean;
  rawMean: number;
  threshold: number;
}
export interface ForensicOrigin {
  kind: 'generated' | 'composite' | 'container-hint';
  source: 'credential' | 'metadata' | 'container-signature';
  integrity: 'verified' | 'unverified' | 'unsigned';
  scope: 'document';
}
export type ForensicFormat =
  | 'text'
  | 'markdown'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'svg'
  | 'pdf'
  | 'pptx'
  | 'docx'
  | 'unknown';
export interface ForensicReport {
  format: ForensicFormat;
  origins: ForensicOrigin[];
  profile: 'lolly/forensic-ai-v1';
  version: string;
  artifactSha256: string;
  reportSha256: string;
  pages: ForensicPage[];
  findings: ForensicFinding[];
  coverage: ForensicCoverage[];
  models: ForensicModelObservation[];
  evidence: { score: number; band: 'none' | 'weak' | 'notable' | 'strong'; families: number };
  likelihood:
    | { state: 'unavailable'; reason: string }
    | { state: 'calibrated'; probability: number; calibration: string; population: string };
  limitations: string[];
}
export interface ForensicAnnotation {
  reportSha256: string;
  finding: string;
  kind: 'brand-requirement' | 'quoted-example' | 'misdetected';
  note: string;
}
