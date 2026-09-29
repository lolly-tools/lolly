// SPDX-License-Identifier: MPL-2.0
import type { CompiledFrameV1, DesignBoxRowV1 } from '../../packages/core/src/rebrand-v1.ts';

export interface SlideBrief {
  id: string;
  title: string;
  request: string;
  blocks: Array<{ id: string; heading: string; text: string }>;
  image?: { id: string; description: string };
}

export interface Fixture {
  brief: SlideBrief;
  acceptable: string[];
}

export interface Candidate {
  id: string;
  name: string;
  description: string;
  ruleScore: number;
  ruleReasons: string[];
  overflow: string[];
  bindings: Record<string, string[]>;
  frame: DesignBoxRowV1;
  compiled: CompiledFrameV1;
}

export const METHODS = ['rules', 'embed', 'choice', 'json'] as const;
export type Method = (typeof METHODS)[number];
export const METHOD_NAMES: Record<Method, string> = {
  rules: 'Layout rules', embed: 'MiniLM similarity', choice: 'SmolLM choice', json: 'SmolLM JSON',
};

export interface Ranking {
  ids: string[];
  valid: boolean;
  raw: string;
  error?: string;
  scores?: number[];
}

export interface ExperimentResult extends Ranking {
  fixtureId: string;
  method: Method;
  candidateIds: string[];
  inputKey: string;
  backend: string;
  loadMs: number;
  inferenceMs: number;
  inputTokens?: number;
  outputTokens?: number;
  top1: boolean | null;
  top3: boolean | null;
  candidateRecall: boolean | null;
  fallback: boolean;
}

export type Progress = (message: string) => void;
export interface Ranker {
  rank(brief: SlideBrief, candidates: Candidate[], method: Method): Promise<ExperimentResult>;
  dispose(): Promise<void>;
}
