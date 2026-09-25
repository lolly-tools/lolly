// SPDX-License-Identifier: MPL-2.0
/**
 * Shared helper for the rebrand fixtures (plan 274 section 9).
 *
 * Two corpora, and they are not the same thing. The synthetic fixtures under
 * `tests/fixtures/rebrand/` are committed, small and built by
 * `scripts/build-rebrand-fixtures.ts`, so every test that reads them runs on
 * every machine. The private corpus is the maintainer's own decks, which never
 * enter the repo: a test reaches it through `privateCorpus()` and skips by name
 * when it is absent, and a skipped private-corpus case is unexercised coverage,
 * never a pass.
 *
 * The labels sidecar beside each synthetic fixture is the hand-authored ground
 * truth: for every object the builder wrote, where it came from, what class a
 * census should reach, how faithfully it can be carried, and whether a default
 * plan is allowed to remove it.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ColorUseV1,
  FidelityV1,
  ObjectClassV1,
  SourceObjectKindV1,
  SourceOriginV1,
} from '../../packages/core/src/rebrand-v1.ts';

/** `tests/fixtures/rebrand/`, absolute. */
export const REBRAND_FIXTURE_DIR = fileURLToPath(new URL('../fixtures/rebrand/', import.meta.url));

/** The synthetic fixtures, by the name the builder writes. */
export const SYNTHETIC_FIXTURES = ['simple.pptx', 'adversarial.pptx', 'palette.pptx', 'flattened.pdf'] as const;
export type SyntheticFixtureName = (typeof SYNTHETIC_FIXTURES)[number];

/** Absolute path of one synthetic fixture. */
export function fixturePath(name: SyntheticFixtureName): string {
  return path.join(REBRAND_FIXTURE_DIR, name);
}

/** Absolute path of one fixture's labels sidecar. */
export function labelsPath(name: SyntheticFixtureName): string {
  return path.join(REBRAND_FIXTURE_DIR, `${name.replace(/\.(pptx|pdf)$/, '')}.labels.json`);
}

/** Bytes of one synthetic fixture. */
export function readFixture(name: SyntheticFixtureName): Uint8Array {
  return new Uint8Array(readFileSync(fixturePath(name)));
}

// ─── the labels sidecar ──────────────────────────────────────────────────────

/** One authored object and what a correct reading of it looks like. */
export interface FixtureObjectLabelV1 {
  /** `<slide part base name>.<p:cNvPr id>` for pptx, `<page id>.<object name>` for pdf. */
  id: string;
  /** The name this fixture gives the object, so a failing assertion reads plainly. */
  authored: string;
  /** The OOXML shape name, when the object came from a pptx part. */
  name?: string;
  origin: SourceOriginV1;
  kind: SourceObjectKindV1;
  class: ObjectClassV1;
  /** The contract's own fidelity record, so a label can state a fallback's source and ref. */
  fidelity: FidelityV1;
  /** Expected box in reference px at 96 dpi, composed through group transforms. */
  boxPx?: { x: number; y: number; w: number; h: number };
  /**
   * Group ancestry, outermost first, as the ENGINE READER reports it: each entry is
   * the group's `p:cNvPr` id, which is the identifier space `readPptx` emits, so a
   * label and a reading compare directly. `groupNames` carries the readable name.
   */
  groupPath?: string[];
  /** The same ancestry by authored shape name, for a failing assertion that reads plainly. */
  groupNames?: string[];
  /** True when a default plan must not remove this object. */
  mustKeep?: boolean;
  /** Which half of an `mc:AlternateContent` pair this object is. */
  alternateContent?: 'choice' | 'fallback';
  /**
   * The id of the other half of an `mc:AlternateContent` pair. A correct reading
   * surfaces ONE object for the pair, so only one half carries `mustKeep`.
   */
  pairedWith?: string;
  /** The text the object states, when a test needs the expectation as data rather than prose. */
  text?: string;
  note?: string;
}

export interface FixtureSlideLabelV1 {
  id: string;
  index: number;
  widthPx: number;
  heightPx: number;
  /** True when the whole page is one picture of a rendered slide. */
  flattened: boolean;
  objects: FixtureObjectLabelV1[];
}

/**
 * One colour use the fixture states on purpose, for the colour census. The fields
 * follow `ColorUseV1`, because the two facts palette.pptx exists to prove are
 * theme-slot provenance and the chart distinction set whose members must stay apart.
 */
export interface FixtureColorLabelV1 {
  hex: string;
  role: ColorUseV1['role'];
  objectIds: string[];
  /** The theme slot the source named, when it used a scheme reference rather than a literal. */
  scheme?: string;
  /** For a series use: the chart object id whose series must stay distinguishable. */
  distinctionSet?: string;
  /** The slide the use sits on, for a use with no object of its own such as a ground. */
  slideId?: string;
  note?: string;
}

export interface RebrandFixtureLabelsV1 {
  fixture: string;
  version: number;
  builder: string;
  objectIdForm: string;
  slides: FixtureSlideLabelV1[];
  /** Objects a slide inherits from its master or layout. */
  inherited: FixtureObjectLabelV1[];
  /** Ids of every object a default plan must not remove. */
  mustKeep: string[];
  /**
   * Ids the labeller was not sure of (the private corpus labels carry them). A
   * score leaves them out, so a guess in the labels never counts as a hit or a miss.
   */
  unsure?: string[];
  colors?: FixtureColorLabelV1[];
}

/** Read and parse one fixture's labels sidecar. */
export function readLabels(name: SyntheticFixtureName): RebrandFixtureLabelsV1 {
  return JSON.parse(readFileSync(labelsPath(name), 'utf8')) as RebrandFixtureLabelsV1;
}

/** Every labelled object of one fixture, slides first, then inherited furniture. */
export function allLabelledObjects(labels: RebrandFixtureLabelsV1): FixtureObjectLabelV1[] {
  return [...labels.slides.flatMap((slide) => slide.objects), ...labels.inherited];
}

// ─── the private corpus ──────────────────────────────────────────────────────

export interface PrivateCorpusV1 {
  /** The directory `LOLLY_REBRAND_FIXTURES` names. */
  root: string;
  /** Decks and pdfs at the root of that directory, sorted by name. */
  files: string[];
  /** Decks and pdfs under its `slides-to-test/` directory, sorted by name. */
  slidesToTest: string[];
}

const CORPUS_EXTENSIONS = new Set(['.pptx', '.pdf']);

function corpusFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('~$') && !name.startsWith('.'))
    .filter((name) => CORPUS_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .filter((name) => statSync(path.join(dir, name)).isFile())
    .sort()
    .map((name) => path.join(dir, name));
}

/**
 * The maintainer's own decks, when `LOLLY_REBRAND_FIXTURES` names a directory
 * that is on this machine. Null otherwise, which is the normal case: these files
 * never enter the repo, so a test that needs them skips by name.
 */
export function privateCorpus(): PrivateCorpusV1 | null {
  const raw = (process.env.LOLLY_REBRAND_FIXTURES ?? '').trim();
  if (!raw) return null;
  const root = path.resolve(raw.startsWith('~/') ? path.join(process.env.HOME ?? '', raw.slice(2)) : raw);
  if (!existsSync(root) || !statSync(root).isDirectory()) return null;
  return { root, files: corpusFiles(root), slidesToTest: corpusFiles(path.join(root, 'slides-to-test')) };
}

/**
 * The hand-labelled censuses of the private decks, kept beside them in
 * `<corpus>/labels/<deck name without extension>.labels.json` (plan 274 section
 * 9) and never in the tree. Each file has the synthetic labels' shape; its
 * object ids are the ids `sourceDeckFromPptx` mints, so a census row joins its
 * label by id rather than by box. Empty when the corpus or its labels are absent.
 */
export function privateLabels(): Array<{ deck: string; labels: RebrandFixtureLabelsV1 }> {
  const corpus = privateCorpus();
  if (!corpus) return [];
  const dir = path.join(corpus.root, 'labels');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  const decks = [...corpus.files, ...corpus.slidesToTest];
  const out: Array<{ deck: string; labels: RebrandFixtureLabelsV1 }> = [];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.labels.json')).sort()) {
    const base = name.slice(0, -'.labels.json'.length);
    const deck = decks.find((file) => path.basename(file).replace(/\.(pptx|pdf)$/i, '') === base);
    if (!deck) continue;
    out.push({ deck, labels: JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as RebrandFixtureLabelsV1 });
  }
  return out;
}

/**
 * The skip reason for a private-corpus case, or null when the corpus is here.
 * The wording is part of the skip identity in `tests/expected-skips.json`, so
 * changing it means updating that baseline in the same edit.
 */
export function skipReason(): string | null {
  return privateCorpus() ? null : 'the private rebrand deck fixture corpus is not on this machine (set LOLLY_REBRAND_FIXTURES)';
}
