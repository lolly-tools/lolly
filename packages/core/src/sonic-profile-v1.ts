// SPDX-License-Identifier: MPL-2.0
/** Brand-owned sound intent and exact, adapter-specific musical starting points. */
export interface SonicNarrationV1 {
  voice: string;
  speed: number;
  bedVolume: number;
  duck: number;
  guidance: string;
  pronunciations: Array<{ written: string; spoken: string }>;
}

export interface SonicContextV1 {
  id: string;
  label: string;
  purpose: string;
  guidance: string;
  /** The adapter owns these settings. Other readers preserve them without interpreting them. */
  music: { adapter: string; parameters: string };
  narration: SonicNarrationV1;
  signature: { guidance: string; resource?: { type: 'asset'; id: string } };
  examples: Array<{ label: string; note: string; resource: { type: 'asset'; id: string } }>;
  /** Unsupported required capabilities prevent resolution; prose remains guidance. */
  requirements: Array<{
    id: string;
    kind: string;
    label: string;
    requirement: 'required' | 'advisory';
  }>;
}

export interface SonicProfileV1 {
  schemaVersion: 1;
  id: string;
  revision: number;
  label: string;
  /** Ownership follows the containing design system when copied or packaged. */
  owner: 'containing-design-system';
  identity: { character: string; anchors: string; avoid: string };
  defaultContext: string;
  contexts: SonicContextV1[];
  review: { state: 'draft' } | { state: 'reviewed'; reviewer: string; at: string; notes: string };
}

export interface SonicFindingV1 {
  code: string;
  message: string;
  severity: 'error' | 'notice';
}

/** A retained selection. This record does not certify recognition, rights or brand compliance. */
export interface SonicRecipeV1 {
  schemaVersion: 1;
  profile: SonicProfileV1;
  profileSha256: string;
  contextId: string;
  selection: 'document' | 'campaign' | 'default';
  seed: number;
  music: { adapter: string; version: string; parameters: string };
  findings: SonicFindingV1[];
}
