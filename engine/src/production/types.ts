// SPDX-License-Identifier: MPL-2.0
/** Scoped still-output contracts. These do not replace the document model. */
export type ProductionState = 'pass' | 'fail' | 'undetermined';
export type ProductionFormat = 'svg' | 'png' | 'jpg' | 'pdf';
export type ProductionSpec = ProductionContract | ProductionMotionContract;
export interface ProductionMotionContract extends Omit<ProductionContract, 'profile' | 'format' | 'pages' | 'alpha' | 'comparison'> {
  profile: 'lolly/production-motion-v1';
  format: 'mp4' | 'webm';
  pages?: never; alpha?: never; comparison?: never;
  motion: {
    seconds: number; secondsTolerance: number; fps: number; fpsTolerance: number;
    frameCount: number; timestampTolerance: number; audio: boolean; audioSecondsTolerance?: number;
    loudness?: { min: number; max: number }; truePeakMax?: number;
    comparison?: ProductionComparison & { times: number[] };
  };
}
export interface ProductionMotionFacts {
  seconds?: number; fps?: number; frameCount?: number; timestampError?: number;
  audio?: boolean; audioSeconds?: number; audioTimestampError?: number; loudness?: number | null; truePeak?: number | null;
  samples?: { time: number; timestamp: number; pixels: ProductionPixels }[];
}
export interface ProductionPixels { width: number; height: number; rgba: Uint8Array | Uint8ClampedArray }
export interface ProductionRegion {
  id: string; x: number; y: number; width: number; height: number;
  minSsim: number; maxInkDelta: number;
}
export interface ProductionComparison {
  referenceSha256: string;
  channelTolerance: number;
  maxChangedFraction: number;
  regions: ProductionRegion[];
}
export interface ProductionRequirement {
  id: string;
  kind: 'text' | 'link' | 'resource' | 'node' | 'input';
  /** Stable SVG element id for text, links and node identity; asset id for a resource. */
  location: string;
  expected: string;
}
export interface ProductionContract {
  profile: 'lolly/production-still-v1';
  id: string;
  revision: string;
  format: ProductionFormat;
  width: number;
  height: number;
  pages: number;
  alpha: 'any' | 'opaque' | 'transparent';
  /** Optional exact source/environment snapshots, never inferred from output bytes. */
  sourceSha256?: string;
  contextSha256?: string;
  requirements: ProductionRequirement[];
  comparison?: ProductionComparison;
}
export interface ProductionCheck {
  id: string;
  state: ProductionState;
  method: 'artifact-parser' | 'decoded-pixels' | 'decoded-media' | 'resolved-resource' | 'resolved-structure';
  location: string;
  reason: string;
  actual?: string | number;
  tolerance?: number;
  operator?: 'max' | 'min';
  expected?: string | number;
  /** Only authored appearance bands can be excepted by a local authority. */
  waivable: boolean;
}
export interface ProductionFacts {
  format?: ProductionFormat | 'mp4' | 'webm';
  motion?: ProductionMotionFacts;
  readable?: boolean;
  width?: number;
  height?: number;
  pages?: number;
  opaque?: boolean;
  /** Missing keys are unknown; a present empty string is an observed empty value. */
  text?: Record<string, string>;
  links?: Record<string, string>;
  nodes?: Record<string, string>;
  resources?: Record<string, string>;
  /** Canonical JSON digests of observed runtime values, never inferred from pixels. */
  inputs?: Record<string, string>;
  sourceSha256?: string;
  contextSha256?: string;
  pixels?: ProductionPixels;
  limitations: string[];
  /** Preserve specialised reports without translating away their details. */
  records?: Record<string, unknown>;
}
export interface ProductionReport {
  profile: ProductionSpec['profile'];
  detector: 'lolly-production/1';
  artifactSha256: string;
  contractSha256: string;
  sourceSha256: string | null;
  contextSha256: string | null;
  checks: ProductionCheck[];
  limitations: string[];
  records?: Record<string, unknown>;
  reportSha256: string;
}
export type ProductionCollector = (bytes: Uint8Array, contract: ProductionSpec, signal?: AbortSignal) => Promise<ProductionFacts>;
export interface ProductionEditPolicy { protected: string[]; permitted: Record<string, unknown[]>; maxAttempts: number }
export interface ProductionRepairPlan extends ProductionEditPolicy { when: { findingId: string; input: string }[] }
