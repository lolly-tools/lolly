// SPDX-License-Identifier: MPL-2.0
/**
 * One finding shape for every Design checker (plan 291, W1).
 *
 * Five checkers answer about a Design document in five shapes: the structure
 * check (`DesignFindingV1`), the mounted audit in the web app, the brand check
 * (`BrandFinding`), the pack's house rules and Verify (`ForensicFinding`). Each
 * mapper here turns one of them into a `CheckFindingV1` with a stable dotted code,
 * a severity, the layer it is about and the English message the app shows.
 *
 * The English builders (`mountedFindingMessage`, `brandFindingMessage`) are the
 * app's source strings, ported from `shells/web/src/views/design-audit-copy.ts`
 * and `brand-check-rows.ts` so the CLI and MCP show the same words. The web keeps
 * translating them at presentation time; `tests/check-messages.test.ts` holds the
 * two copies to the same text.
 *
 * Severity: structure keeps its own; the mounted audit keeps its own (`warn` or
 * `info`); a brand value to review is `warn` and one that could not be compared
 * is `info`; a required house rule broken is `error` and an advisory one `warn`;
 * a Verify clue is `warn` (`error` under `strict`, decision D1) and a clue the
 * context explains is `info`.
 *
 * Pure: no DOM, no clock, no network.
 */
import type {
  CheckBoxV1,
  CheckFindingV1,
  CheckFixV1,
} from '@lolly-tools/core/check-v1';
import type { DesignFindingV1 } from '@lolly-tools/core';
import type { BrandFinding } from './brand-check.ts';
import type { ForensicBox, ForensicFinding, ForensicLocation, ForensicReport } from './forensic/types.ts';
import { designForensicPages, type DesignForensicOptions, type DesignForensicRef } from './forensic/design.ts';
import { forensicReport } from './forensic/report.ts';

type Row = Record<string, unknown>;
type Evidence = NonNullable<CheckFindingV1['evidence']>;

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

// ─── layer lookup ────────────────────────────────────────────────────────────

/** A layer's place: its row index (for the JSON pointer), its artboard and its artboard-local box. */
export interface DesignLayerPlace {
  index: number;
  artboardId?: string;
  box: CheckBoxV1;
}

/**
 * Index a Design `boxes` value by layer id. The first row with an id wins, as the
 * structure check treats a later duplicate as the fault. Boxes are local to the
 * row's artboard when it has one.
 */
export function designLayerLookup(boxes: unknown): Map<string, DesignLayerPlace> {
  const out = new Map<string, DesignLayerPlace>();
  if (!Array.isArray(boxes)) return out;
  const frames = new Map<string, { x: number; y: number }>();
  for (const row of boxes)
    if (record(row) && row.kind === 'frame' && typeof row.id === 'string' && !frames.has(row.id))
      frames.set(row.id, { x: finite(row.x), y: finite(row.y) });
  boxes.forEach((row, index) => {
    if (!record(row) || typeof row.id !== 'string' || !row.id || out.has(row.id)) return;
    const frameId = row.kind === 'frame' ? row.id : typeof row.frame === 'string' ? row.frame : '';
    const origin = frames.get(frameId);
    out.set(row.id, {
      index,
      ...(origin ? { artboardId: frameId } : {}),
      box: {
        x: finite(row.x) - (origin?.x ?? 0),
        y: finite(row.y) - (origin?.y ?? 0),
        // A negative size is the structure check's finding (design.layer.dimension-invalid);
        // here it is clamped, as designForensicPages does, so every box fits the report schema.
        width: Math.max(0, finite(row.w)),
        height: Math.max(0, finite(row.h)),
      },
    });
  });
  return out;
}

const placeOf = (lookup: Map<string, DesignLayerPlace> | undefined, layerId: string | undefined) =>
  layerId ? lookup?.get(layerId) : undefined;

/** A code part from free text: lower case, letters, digits and dashes. */
function codePart(value: string): string {
  const part = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return /^[a-z0-9]/.test(part) ? part : `x-${part || 'unknown'}`;
}

// ─── English messages, the same text the app shows ──────────────────────────

/** The mounted audit's finding, in the shape the web app's `auditMountedDesign` returns. */
export interface MountedDesignFindingInput {
  id: string;
  severity: 'warn' | 'info' | 'error';
  path: string;
  evidence: { name: string; reason?: string; ratio?: string; minimum?: string; family?: string };
  message: string;
  layerId: string;
}

/** The English text the app shows for a mounted-audit finding (design-audit-copy.ts). */
export function mountedFindingMessage(finding: MountedDesignFindingInput): string {
  const { name, reason, ratio, minimum, family } = finding.evidence;
  switch (finding.id) {
    case 'design.text.overflow':
      return `Text in “${name}” is clipped at the current size.`;
    case 'design.text.contrast-review':
      return reason === 'complex-background'
        ? `Check “${name}” visually: its image or gradient background has no single contrast ratio.`
        : `Check “${name}” visually: its rendered colours could not be reduced to one contrast ratio.`;
    case 'design.text.contrast-low':
      // Measured over the rendered picture under the text by the render family (plan 291 M4).
      if (reason === 'sampled-background')
        return `“${name}” has about ${ratio ?? ''}:1 contrast with the picture under it; this text needs at least ${minimum ?? ''}:1.`;
      return `“${name}” has ${ratio ?? ''}:1 contrast; this text needs at least ${minimum ?? ''}:1.`;
    case 'design.font.unembeddable':
      return `Font coverage could not be verified for “${name}” in ${family ?? ''}. Add or choose a font that covers this text before exporting; a system fallback can change on another device.`;
    default:
      return finding.message;
  }
}

/** The field words the brand rows use (brand-check-rows.ts). */
const BRAND_FIELD_WORDS: Readonly<Record<string, string>> = {
  bg: 'fill',
  fg: 'text colour',
  stroke: 'stroke',
  font: 'font',
  image: 'image',
};

/** The English text the app shows for a brand finding (brand-check-rows.ts findingText). */
export function brandFindingMessage(finding: BrandFinding): string {
  const field = BRAND_FIELD_WORDS[finding.field ?? ''] ?? 'value';
  const name = finding.label;
  if (finding.kind === 'reference' && finding.field === 'image')
    return `“${name}”: the icon theme or photo treatment in ${finding.value ?? ''} is not declared in this design system.`;
  if (finding.kind === 'reference')
    return `“${name}”: ${finding.value ?? ''} does not resolve to a colour in this design system.`;
  if (finding.kind === 'coverage') return 'No readable composition was available for brand checks.';
  if (finding.status === 'unknown')
    return `“${name}”: the ${field} could not be compared with the selected design system.`;
  if (finding.kind === 'asset')
    return `“${name}”: this image is outside the design system’s declared asset IDs. It may be intentional.`;
  return `“${name}”: ${field} ${finding.value ?? ''} is outside this design system. Suggested: ${finding.suggestion ?? ''}.`;
}

/** The English text for a Verify finding: its label, then its detail, as the Verify panel shows them. */
export function forensicFindingMessage(finding: Pick<ForensicFinding, 'label' | 'detail'>): string {
  return finding.detail && finding.detail !== finding.label ? `${finding.label}: ${finding.detail}` : finding.label;
}

// ─── mappers ─────────────────────────────────────────────────────────────────

/** Structure: the code is the checker's own id, already stable and dotted. */
export function checkFindingFromDesign(finding: DesignFindingV1): CheckFindingV1 {
  return {
    code: finding.id,
    family: 'structure',
    severity: finding.severity,
    message: finding.message,
    path: finding.path,
    ...(finding.layerId ? { layerId: finding.layerId } : {}),
    ...(finding.artboardId ? { artboardId: finding.artboardId } : {}),
    origin: { checker: 'design-v1', id: finding.id },
  };
}

/** Render: the mounted audit. A contrast the audit could not reduce to one ratio needs a visual check. */
export function checkFindingFromMounted(
  finding: MountedDesignFindingInput,
  lookup?: Map<string, DesignLayerPlace>
): CheckFindingV1 {
  const place = placeOf(lookup, finding.layerId);
  const evidence: Record<string, string> = {};
  for (const [key, value] of Object.entries(finding.evidence))
    if (typeof value === 'string') evidence[key] = value;
  return {
    code: finding.id,
    family: 'render',
    severity: finding.severity,
    message: mountedFindingMessage(finding),
    ...(finding.id === 'design.text.contrast-review' ? { needs: 'visual-check' as const } : {}),
    path: finding.path,
    layerId: finding.layerId,
    ...(place?.artboardId ? { artboardId: place.artboardId } : {}),
    ...(place ? { box: place.box } : {}),
    evidence,
    origin: { checker: 'mounted-audit', id: finding.id },
  };
}

/**
 * Brand: `checkBrandDesign`. Its ids embed the layer id, so the code is
 * `brand.<kind>.<status>` and the layer goes in `layerId`; the raw id stays in
 * the origin. A value to review is `warn`; anything not compared is `info`.
 */
export function checkFindingFromBrand(
  finding: BrandFinding,
  lookup?: Map<string, DesignLayerPlace>
): CheckFindingV1 {
  const place = placeOf(lookup, finding.layerId);
  const review = finding.status === 'review';
  const evidence: Record<string, string> = { name: finding.label };
  if (finding.field) evidence.field = finding.field;
  if (finding.value !== undefined) evidence.value = finding.value;
  const fix: CheckFixV1 | undefined = finding.fix
    ? { layerId: finding.fix.layerId, field: finding.fix.field, before: finding.fix.before ?? null, after: finding.fix.after }
    : undefined;
  return {
    code: `brand.${codePart(finding.kind)}.${codePart(finding.status)}`,
    family: 'brand',
    severity: review ? 'warn' : 'info',
    message: brandFindingMessage(finding),
    needs: review ? 'review' : 'unknown',
    ...(place ? { path: finding.field ? `/boxes/${place.index}/${finding.field}` : `/boxes/${place.index}` } : finding.kind === 'coverage' ? { path: '/boxes' } : {}),
    ...(finding.layerId ? { layerId: finding.layerId } : {}),
    ...(place?.artboardId ? { artboardId: place.artboardId } : {}),
    ...(place ? { box: place.box } : {}),
    evidence,
    ...(finding.suggestion ? { suggestion: finding.suggestion } : {}),
    ...(fix ? { fix } : {}),
    origin: { checker: 'brand-check', id: finding.id },
  };
}

/** A house-rule finding, in the shape `checkDesignHouseRules` (engine/src/design-house-rules.ts) reports. */
export interface HouseRuleFindingInput {
  ruleId: string;
  kind: string;
  layerId: string;
  artboardId?: string;
  field?: string;
  value?: string;
  expected?: string;
  message: string;
  requirement: 'required' | 'advisory';
}

/**
 * Brand: a house rule. The code is `brand.rule.<kind>`, so the vocabulary stays
 * the same from pack to pack; the pack's own rule id is in the origin and the
 * evidence. A required rule broken is `error`, an advisory one `warn`.
 */
export function checkFindingFromHouseRule(
  finding: HouseRuleFindingInput,
  lookup?: Map<string, DesignLayerPlace>
): CheckFindingV1 {
  const place = placeOf(lookup, finding.layerId);
  const artboardId = finding.artboardId ?? place?.artboardId;
  const evidence: Record<string, string> = { rule: finding.ruleId, requirement: finding.requirement };
  if (finding.field) evidence.field = finding.field;
  if (finding.value !== undefined) evidence.value = finding.value;
  if (finding.expected !== undefined) evidence.expected = finding.expected;
  return {
    code: `brand.rule.${codePart(finding.kind)}`,
    family: 'brand',
    severity: finding.requirement === 'required' ? 'error' : 'warn',
    message: finding.message,
    needs: 'review',
    ...(place ? { path: finding.field ? `/boxes/${place.index}/${finding.field}` : `/boxes/${place.index}` } : {}),
    layerId: finding.layerId,
    ...(artboardId ? { artboardId } : {}),
    ...(place ? { box: place.box } : {}),
    evidence,
    ...(finding.expected ? { suggestion: finding.expected } : {}),
    origin: { checker: 'house-rules', id: finding.ruleId },
  };
}

/** A rule id the house-rule checker could not evaluate: said out loud, never a pass. */
export function checkFindingFromUnknownHouseRule(ruleId: string): CheckFindingV1 {
  return {
    code: 'brand.rule.unknown',
    family: 'brand',
    severity: 'info',
    message: `The house rule “${ruleId}” has no checker in this build, so it was not checked.`,
    needs: 'unknown',
    evidence: { rule: ruleId },
    origin: { checker: 'house-rules', id: ruleId },
  };
}

/** Every finding of one `checkDesignHouseRules` run, plus an `info` finding per rule it could not evaluate. */
export function checkFindingsFromHouseRules(
  result: { findings: readonly HouseRuleFindingInput[]; unknown: readonly string[] },
  lookup?: Map<string, DesignLayerPlace>
): CheckFindingV1[] {
  return [
    ...result.findings.map((f) => checkFindingFromHouseRule(f, lookup)),
    ...result.unknown.map(checkFindingFromUnknownHouseRule),
  ];
}

export interface ForensicMapOptions {
  /** Box refs from `designForensicPages`, to lead each location back to its layers. */
  refs?: WeakMap<ForensicBox, DesignForensicRef>;
  /** The artboard id of each page id, for locations whose box has no ref. */
  pageArtboards?: ReadonlyMap<string, string>;
  /** Decision D1: a Verify clue counts as an error. */
  strict?: boolean;
}

/**
 * Verify: one check finding per observation. `forensicReport` groups findings by
 * family, so a grouped finding is opened back up into the observations it holds,
 * each with its own layers. A clue the context explains is `info`.
 */
export function checkFindingsFromForensic(
  finding: ForensicFinding,
  opts: ForensicMapOptions = {}
): CheckFindingV1[] {
  const observations = finding.observations?.length
    ? finding.observations
    : [{ method: finding.method, confidence: finding.confidence, measurements: finding.measurements, locations: finding.locations }];
  const excluded = finding.contribution === 'context-excluded';
  const code = `verify.${codePart(finding.rule)}`;
  return observations.map((observation, index): CheckFindingV1 => {
    const located = observation.locations.find((l: ForensicLocation) => l.box) ?? observation.locations[0];
    const layerIds: string[] = [];
    let artboardId: string | undefined;
    for (const location of observation.locations) {
      const ref = location.box ? opts.refs?.get(location.box) : undefined;
      if (ref) {
        for (const id of ref.layerIds) if (!layerIds.includes(id)) layerIds.push(id);
        artboardId ??= ref.artboardId;
      }
      artboardId ??= opts.pageArtboards?.get(location.page) || undefined;
    }
    const evidence: Record<string, string | number | boolean | null> = {
      ...observation.measurements,
      method: observation.method,
      confidence: observation.confidence,
      contribution: finding.contribution,
    };
    if (layerIds.length > 1) evidence.layers = layerIds.join(',');
    const box = located?.box;
    return {
      code,
      family: 'verify',
      severity: excluded ? 'info' : opts.strict ? 'error' : 'warn',
      // A grouped finding keeps the first observation's detail; the others say only what they are.
      message: index === 0 ? forensicFindingMessage(finding) : `${finding.label}: the same pattern again${located ? ` on page ${located.page}` : ''}.`,
      ...(excluded ? {} : { needs: 'review' as const }),
      ...(layerIds[0] ? { layerId: layerIds[0] } : {}),
      ...(artboardId ? { artboardId } : {}),
      ...(located ? { page: located.page } : {}),
      ...(box ? { box: { x: box.x, y: box.y, width: box.width, height: box.height } } : {}),
      evidence: evidence as Evidence,
      ...(finding.alternatives[0] ? { suggestion: finding.alternatives[0] } : {}),
      origin: {
        checker: 'forensic',
        id: finding.rule,
        method: observation.method,
        confidence: observation.confidence,
        contribution: finding.contribution,
      },
    };
  });
}

export interface DesignVerifyOptions extends DesignForensicOptions {
  /** The input bytes the report is bound to. Default: the UTF-8 JSON of `boxes`. */
  bytes?: Uint8Array;
  strict?: boolean;
}

export interface DesignVerifyResult {
  findings: CheckFindingV1[];
  report: ForensicReport;
  /** False when a page could not be read whole (a composed story, a page cap): the family is then partial. */
  complete: boolean;
  coverage: ForensicReport['coverage'];
}

/**
 * Verify a Design document by its source geometry: build the pages, run the
 * forensic rules through `forensicReport` and map every observation back to its
 * layers. No OCR, no classifier, no pixels.
 */
export async function verifyDesignDocument(boxes: unknown, opts: DesignVerifyOptions = {}): Promise<DesignVerifyResult> {
  const built = designForensicPages(boxes, opts);
  const bytes = opts.bytes ?? new TextEncoder().encode(JSON.stringify(boxes ?? null));
  const report = await forensicReport(bytes, built.pages, built.coverage, [], [], [], 'unknown');
  const pageArtboards = new Map(built.pages.map((p, i) => [p.id, built.artboardIds[i] ?? '']));
  const findings = report.findings.flatMap((f) =>
    checkFindingsFromForensic(f, { refs: built.refs, pageArtboards, strict: opts.strict })
  );
  return {
    findings,
    report,
    complete: report.coverage.every((c) => c.state === 'completed'),
    coverage: report.coverage,
  };
}
