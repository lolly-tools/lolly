// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's answer as six findings, in one fixed order (plan 374).
 *
 * A file check reads many things: a Content Credential, embedded metadata, pixel
 * marks, the words in the file. This module turns those reads into the six
 * questions a reader asks, so the web view, the CLI, the TUI and MCP give the
 * same answer in the same order:
 *
 *   credential   is it signed, and is it intact
 *   made-with    what made it
 *   ai           was AI involved
 *   licence      under what terms
 *   personal     does it say where or who
 *   hidden       is anything in the file that cannot be seen
 *
 * Every slot is always returned. A slot with nothing found says so, because an
 * absence a reader can see is different from a check that never ran.
 *
 * Pure: no clock, no network, no DOM. The input lists only the fields read here, so the engine's
 * own report and a shell's mirror of it both fit. Wording is English with
 * `{name}` placeholders; a shell translates `word` and `detail` and fills `vars`.
 * A finding never upgrades its evidence: what a file states stays "stated", and
 * only a credential whose hash comparison ran and passed is "signed".
 */
import type { FileMetadata, MetaField } from './file-metadata.ts';
import { appendedIsExpected } from './file-metadata.ts';
import { softwareOrigins } from './software-origin.ts';
import type { SoftwareRole } from './software-origin.ts';
import { licenceDisplayName, normaliseLicence } from './rights-profiles.ts';

export const VERIFY_FINDING_IDS = ['credential', 'made-with', 'ai', 'licence', 'personal', 'hidden'] as const;
export type VerifyFindingId = typeof VERIFY_FINDING_IDS[number];

/**
 * How strong the evidence is. `signed`: a credential whose bytes compare equal.
 * `unverified`: a credential is there but did not verify in full. `stated`:
 * editable metadata. `hint`: a marker or packaging match. `estimated`: analysis
 * run on this device. `none`: nothing to weigh.
 */
export type VerifyStrength = 'signed' | 'unverified' | 'stated' | 'hint' | 'estimated' | 'none';
export type VerifyTone = 'good' | 'info' | 'warn' | 'bad' | 'quiet';

export interface VerifyEvidence {
  /** What the value is, e.g. "Camera" or "Licence". */
  label: string;
  /** The value as recorded, bounded. */
  value: string;
  /** The field or container the value came from. */
  source: string;
  strength: VerifyStrength;
}

export interface VerifyFinding {
  id: VerifyFindingId;
  /** A stable code for the slot's state, for tests and for a shell's own styling. */
  state: string;
  tone: VerifyTone;
  strength: VerifyStrength;
  /** A few words for the slot. English, may hold `{name}` placeholders. */
  word: string;
  /** One sentence. English, may hold `{name}` placeholders. */
  detail: string;
  vars: Record<string, string | number>;
  /** Products, makers or licences this finding names, most important first. */
  names: string[];
  evidence: VerifyEvidence[];
}

export interface VerifySoftware {
  name: string;
  role: SoftwareRole | 'device' | 'signer' | 'ai' | 'scheme';
  strength: VerifyStrength;
  evidence: VerifyEvidence[];
}

export interface VerifyRights {
  /** The licence's display name when it is a known one, else the statement as recorded. */
  name: string;
  /** The normalised licence id, when the statement is a known licence. */
  id: string | null;
  /** A link recorded with the statement, when one was. */
  url?: string;
  evidence: VerifyEvidence[];
}

/** The parts of a C2PA report this module reads. Loosely typed so a shell's mirror fits. */
export interface VerifyFindingsReport {
  found: boolean;
  state: 'valid' | 'invalid' | 'none';
  trusted: boolean;
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  partsMadeWithLolly: boolean;
  delivered?: boolean;
  checks: ReadonlyArray<{ code: string; ok: boolean }>;
  claim?: {
    generatorInfo?: { name?: unknown; version?: unknown } | null;
    claimGenerator?: unknown;
    actions?: ReadonlyArray<{ softwareAgent?: unknown }>;
  } | null;
  environment?: Record<string, unknown> | null;
  rights?: string;
  licence?: { url?: string; usageTerms?: string; attributionName?: string; credit?: string } | null;
  signer?: { commonName?: string; organization?: string; selfSigned?: boolean } | null;
  aiGenerated?: { kind: string; sourceType?: string } | null;
  aiDisclosure?: unknown;
  aiDisclosures?: readonly unknown[];
  history?: ReadonlyArray<{ softwareAgent?: unknown; generator?: unknown; digitalSourceType?: unknown }>;
  ingredients?: ReadonlyArray<{ title?: string; rights?: { license?: string; licenseUrl?: string; creator?: string } }>;
}

export interface VerifyFindingsInput {
  report: VerifyFindingsReport;
  meta?: FileMetadata | undefined;
  /** These exact bytes match an export this device made. */
  madeHere?: boolean;
  /** The Lolly Imprint was read from the pixels. */
  imprint?: boolean;
  seal?: { found: boolean; valid: boolean } | undefined;
  /** Third-party marks a pixel scan read, by scheme name ("Adobe TrustMark"). */
  marks?: readonly string[];
  /**
   * The text analysis, when it ran. `band` is the analysis's own band word,
   * `signals` and `artifacts` count its rows, `invisible` counts hidden-character
   * findings. Absent when no text was analysed.
   */
  text?: { band: string; signals: number; artifacts: number; invisible: number; fromPixels?: boolean; family?: string } | undefined;
}

const HASH_FAIL = new Set(['assertion.dataHash.mismatch', 'assertion.bmffHash.mismatch']);
const HASH_PASS = new Set(['assertion.dataHash.match', 'assertion.bmffHash.match']);
const AI_SOURCE = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;
const SYNTHID_MAKERS = /google|gemini|imagen|veo|nano.?banana/i;
const META_MAKERS = /meta\s?ai|imagined?\s+with\s+ai|\bemu\b/i;
const RIGHTS_LABEL = /^(?:Rights|Copyright|Licence|License|Usage terms|Rights statement)$|(?:^|:)license$|:(?:rights|UsageTerms|WebStatement)$/i;
const CC_URL = /^https?:\/\/(?:www\.)?creativecommons\.org\/(?:licenses\/(by(?:-nc)?(?:-sa|-nd)?)\/(\d+\.\d+)|publicdomain\/(zero|mark)\/(1\.0))\/(?:deed(?:\.[\w-]+)?|legalcode(?:\.[\w-]+)?)?\/?$/i;

const bounded = (s: string): string => s.slice(0, 2048).replace(/\p{Cc}/gu, ' ').trim();
const text = (v: unknown): string => (typeof v === 'string' ? bounded(v) : '');

/** A hash comparison ran and failed: the only evidence that the bytes changed. */
export function verifyHashFailed(report: VerifyFindingsReport): boolean {
  return report.checks.some((c) => !c.ok && HASH_FAIL.has(c.code));
}

function credentialStrength(report: VerifyFindingsReport): VerifyStrength {
  if (!report.found) return 'none';
  const compared = report.checks.some((c) => HASH_FAIL.has(c.code) || HASH_PASS.has(c.code));
  return report.state === 'valid' && compared && !verifyHashFailed(report) ? 'signed' : 'unverified';
}

function generatorName(report: VerifyFindingsReport): string {
  const gi = report.claim?.generatorInfo;
  const name = text(gi?.name);
  if (name) return `${name}${text(gi?.version) ? ` ${text(gi?.version)}` : ''}`;
  return text(report.claim?.claimGenerator);
}

const RANK: Record<VerifyStrength, number> = { signed: 5, unverified: 4, stated: 3, estimated: 2, hint: 1, none: 0 };
const strongest = (evidence: readonly VerifyEvidence[]): VerifyStrength =>
  evidence.reduce<VerifyStrength>((best, e) => (RANK[e.strength] > RANK[best] ? e.strength : best), 'none');

/**
 * Every product, device and signer the file mentions, each with its evidence.
 * A credential never vouches for unrelated EXIF, XMP or comments, so a name
 * that appears in both keeps both rows and their separate strengths.
 */
export function verifySoftware(report: VerifyFindingsReport, meta?: FileMetadata): VerifySoftware[] {
  const out: VerifySoftware[] = [];
  const cred = credentialStrength(report);
  const add = (name: string, role: VerifySoftware['role'], evidence: VerifyEvidence) => {
    // "c2patool 0.26" and "c2patool" are one product; the fuller name is kept.
    const key = (n: string) => n.replace(/\s+v?\d[\w.()-]*$/, '').toLowerCase();
    const hit = out.find((a) => key(a.name) === key(name) && (a.role === 'device') === (role === 'device'));
    if (hit) {
      if (name.length > hit.name.length) hit.name = name;
      if (role === 'authoring' || (role === 'export' && hit.role === 'history')) hit.role = role;
      if (!hit.evidence.some((e) => e.source === evidence.source && e.value === evidence.value)) hit.evidence.push(evidence);
      hit.strength = strongest(hit.evidence);
    } else if (out.length < 40) out.push({ name, role, strength: evidence.strength, evidence: [evidence] });
  };
  const fromCredential = (raw: unknown, source: string, role: SoftwareRole) => {
    let value = raw;
    if (value && typeof value === 'object' && 'name' in value) {
      const o = value as { name?: unknown; version?: unknown };
      value = `${text(o.name)}${text(o.version) ? ` ${text(o.version)}` : ''}`;
    }
    const v = text(value);
    if (!v) return;
    const known = softwareOrigins([{ label: 'Software', value: v, group: 'software' }])[0];
    if (known) add(known.name, role === 'authoring' ? known.role : role, { label: 'Software', value: v, source, strength: cred });
  };

  for (const field of (meta?.fields ?? []).slice(0, 256)) {
    if (field.group === 'device' && /^(Camera|Device|Model)$/.test(field.label) && field.value.trim()) {
      add(bounded(field.value), 'device', { label: field.label, value: bounded(field.value), source: field.source ?? `${meta?.format ?? ''} ${field.label}`.trim(), strength: 'stated' });
    }
  }
  if (report.found) {
    fromCredential(generatorName(report), 'C2PA claim generator', report.delivered ? 'export' : 'authoring');
    for (const action of (report.claim?.actions ?? []).slice(0, 32)) fromCredential(action.softwareAgent, 'C2PA action softwareAgent', 'history');
    for (const step of (report.history ?? []).slice(0, 32)) fromCredential(step.softwareAgent || step.generator, 'C2PA history', 'history');
    const signer = text(report.signer?.organization) || text(report.signer?.commonName);
    if (signer && !report.signer?.selfSigned) add(signer, 'signer', { label: 'Signer', value: signer, source: 'C2PA signing certificate', strength: report.trusted ? cred : 'unverified' });
  }
  for (const app of softwareOrigins(meta?.fields ?? [])) {
    for (const e of app.evidence) add(app.name, app.role, { label: 'Software', value: bounded(e.value), source: e.source, strength: e.kind === 'hint' ? 'hint' : 'stated' });
  }
  const order: Record<VerifySoftware['role'], number> = { authoring: 0, device: 1, export: 2, ai: 3, history: 4, signer: 5, scheme: 6, system: 7 };
  return out.sort((a, b) => order[a.role] - order[b.role]);
}

/**
 * Every licence or rights statement the file carries about itself. Two
 * statements that name the same known licence fold into one entry with both
 * sources; two that differ stay two entries.
 */
export function verifyRights(report: VerifyFindingsReport, meta?: FileMetadata): VerifyRights[] {
  const out: VerifyRights[] = [];
  const cred = credentialStrength(report);
  const add = (raw: string | undefined, source: string, strength: VerifyStrength, label = 'Licence') => {
    const value = text(raw);
    if (!value) return;
    const cc = CC_URL.exec(value);
    const declaration = cc ? (cc[1] ? `CC-${cc[1].toUpperCase()}-${cc[2]}` : cc[3] === 'zero' ? 'CC0-1.0' : 'CC-PDDC') : value;
    const normal = normaliseLicence(declaration);
    const name = normal.id ? licenceDisplayName(normal.id) : value;
    const evidence: VerifyEvidence = { label, value, source, strength };
    const url = /^https?:\/\//i.test(value) ? value : undefined;
    const hit = out.find((r) => (normal.id ? r.id === normal.id : r.name === name));
    if (hit) {
      if (!hit.evidence.some((e) => e.source === source && e.value === value)) hit.evidence.push(evidence);
      if (url && !hit.url) hit.url = url;
    } else if (out.length < 16) out.push({ name, id: normal.id ?? null, ...(url ? { url } : {}), evidence: [evidence] });
  };
  if (report.found) {
    add(report.licence?.url, 'C2PA licence terms', cred);
    add(report.rights, 'C2PA rights declaration', cred, 'Rights');
    add(report.licence?.usageTerms, 'C2PA usage terms', cred, 'Usage terms');
  }
  for (const field of (meta?.fields ?? []).slice(0, 256)) {
    if (RIGHTS_LABEL.test(field.label)) add(field.value, field.source ?? `${meta?.format ?? ''} ${field.label}`.trim(), 'stated', field.label);
  }
  return out;
}

function finding(id: VerifyFindingId, state: string, tone: VerifyTone, strength: VerifyStrength, word: string, detail: string,
  extra: { vars?: Record<string, string | number>; names?: string[]; evidence?: VerifyEvidence[] } = {}): VerifyFinding {
  return { id, state, tone, strength, word, detail, vars: extra.vars ?? {}, names: extra.names ?? [], evidence: extra.evidence ?? [] };
}

function credentialFinding(input: VerifyFindingsInput): VerifyFinding {
  const { report } = input;
  const signer = text(report.signer?.organization) || text(report.signer?.commonName);
  const names = signer && !report.signer?.selfSigned ? [signer] : [];
  if (!report.found) {
    if (input.madeHere) return finding('credential', 'made-here', 'good', 'signed', 'Made on this device', 'These bytes match an export this device made.');
    if (input.seal?.found && input.seal.valid) return finding('credential', 'seal', 'good', 'signed', 'SEAL signature verifies', 'No Content Credential, but a SEAL signature verifies these bytes.');
    if (input.imprint) return finding('credential', 'imprint', 'info', 'hint', 'Lolly Imprint found', 'No Content Credential. The Lolly Imprint was read from the pixels, which is a hint and not a signature.');
    return finding('credential', 'none', 'quiet', 'none', 'Not signed', 'This file carries no Content Credential. That says nothing about the file either way.');
  }
  if (verifyHashFailed(report)) {
    return finding('credential', 'changed', 'bad', 'unverified', 'Changed since signing', 'A Content Credential is here, and the file no longer matches what it signed.', { names });
  }
  if (report.state === 'valid') {
    return report.trusted || report.madeWithLolly
      ? finding('credential', 'intact', 'good', 'signed', 'Signed and unchanged', signer && !report.signer?.selfSigned ? 'Signed by {signer}, and unchanged since.' : 'Signed on a device, and unchanged since.', { names, vars: { signer } })
      : finding('credential', 'intact-unknown-signer', 'info', 'signed', 'Unchanged, signer not recognised', 'The file is unchanged since it was signed. The signer is not one this app recognises.', { names });
  }
  const fails = report.checks.filter((c) => !c.ok && c.code !== 'signingCredential.untrusted');
  if (fails.length === 1 && fails[0]!.code === 'signingCredential.expired') {
    return finding('credential', 'expired', 'warn', 'unverified', 'Signer certificate expired', 'The credential checks out, and the certificate that signed it has since expired.', { names });
  }
  return finding('credential', 'problem', 'warn', 'unverified', 'Does not check out', 'A Content Credential is here but does not verify in full. The checks below say what failed.', { names });
}

function madeWithFinding(input: VerifyFindingsInput, software: VerifySoftware[]): VerifyFinding {
  const { report } = input;
  const makers = software.filter((s) => s.role !== 'signer' && s.role !== 'system');
  const evidence = makers.flatMap((s) => s.evidence).slice(0, 24);
  const names = makers.map((s) => s.name);
  const env = report.environment ?? {};
  const tool = text(env.tool);
  const lollyFirst = (list: string[]): string[] => ['Lolly', ...list.filter((n) => !/\blolly\b/i.test(n))];
  if (report.madeWithLolly || input.madeHere) {
    return finding('made-with', 'lolly', 'good', input.madeHere && !report.found ? 'signed' : credentialStrength(report), 'Lolly',
      tool ? 'Made with Lolly, in {tool}.' : 'Made with Lolly.', { names: lollyFirst(names), vars: { tool }, evidence });
  }
  if (report.likelyMadeWithLolly) {
    return finding('made-with', 'lolly-likely', 'info', 'unverified', 'Likely Lolly',
      'The credential records a Lolly export, and the file has changed since.', { names: lollyFirst(names), vars: { tool }, evidence });
  }
  if (report.partsMadeWithLolly) {
    return finding('made-with', 'lolly-parts', 'info', credentialStrength(report), '{first}, with parts from Lolly',
      'Another tool produced this file. Its history records steps made with Lolly.', { names: [...names.filter((n) => !/\blolly\b/i.test(n)), 'Lolly'], vars: { first: names[0] ?? 'Another tool' }, evidence });
  }
  if (!names.length && input.imprint) {
    return finding('made-with', 'lolly-imprint', 'info', 'hint', 'Lolly, by its Imprint', 'The Lolly Imprint was read from the pixels.', { names: ['Lolly'] });
  }
  if (!names.length) return finding('made-with', 'unknown', 'quiet', 'none', 'Not identified', 'Nothing in the file names the software or device that made it.');
  const first = makers[0]!;
  return finding('made-with', 'identified', 'info', first.strength, names.length > 1 ? '{first} and {more} more' : '{first}',
    first.strength === 'signed' ? 'The credential records {first}.' : 'The file says it came from {first}. Metadata can be edited.',
    { names, vars: { first: first.name, more: names.length - 1 }, evidence });
}

function aiFinding(input: VerifyFindingsInput): VerifyFinding {
  const { report, meta } = input;
  const cred = credentialStrength(report);
  const evidence: VerifyEvidence[] = [];
  const makers: string[] = [];
  const maker = (raw: unknown) => { const v = text(raw); if (v && !makers.includes(v)) makers.push(v); };

  const declaredByCredential = !!report.aiGenerated || !!report.aiDisclosure || (report.aiDisclosures?.length ?? 0) > 0;
  if (declaredByCredential) {
    evidence.push({ label: 'AI declaration', value: report.aiGenerated?.kind === 'composite' ? 'Includes AI-generated content' : 'AI-generated content', source: 'Content Credential', strength: cred });
    maker(generatorName(report));
    for (const step of report.history ?? []) if (AI_SOURCE.test(text(step.digitalSourceType))) maker(step.softwareAgent || step.generator);
  }
  if (meta?.ai) {
    evidence.push({ label: 'AI declaration', value: meta.ai.kind === 'composite' ? 'Includes AI-generated content' : 'AI-generated content', source: 'IPTC digital source type', strength: 'stated' });
    maker(meta.ai.credit);
  }
  const fingerprint = meta?.producer?.signature === 'ai-download' ? meta.producer : undefined;
  if (fingerprint) {
    evidence.push({ label: 'Packaging', value: bounded(fingerprint.markers.join(' · ')), source: 'Container structure', strength: 'hint' });
    maker(fingerprint.vendor);
  }
  for (const mark of input.marks ?? []) evidence.push({ label: 'Watermark', value: bounded(mark), source: 'Pixel scan on this device', strength: 'estimated' });
  const declared = declaredByCredential || !!meta?.ai;
  if (declared || fingerprint) {
    const hay = makers.join(' ');
    if (SYNTHID_MAKERS.test(hay)) evidence.push({ label: 'Watermark', value: 'SynthID likely', source: 'The named maker marks all of its AI output', strength: 'hint' });
    else if (META_MAKERS.test(hay)) evidence.push({ label: 'Watermark', value: 'Meta AI watermark likely', source: 'The named maker marks all of its AI output', strength: 'hint' });
  }
  const t = input.text;
  const textFound = !!t && (t.band !== 'none' || t.artifacts > 0);
  if (t && textFound) {
    evidence.push({ label: 'Text signals', value: `${t.signals}`, source: t.fromPixels ? 'Text read from the image on this device' : 'Text analysis on this device', strength: 'estimated' });
    if (t.family) maker(t.family);
  }
  const extra = { names: makers, evidence };
  const vars = { maker: makers[0] ?? '', n: t?.signals ?? 0 };

  if (declaredByCredential && cred === 'signed') {
    return finding('ai', 'declared-signed', 'info', 'signed', 'AI, declared and signed', makers.length ? 'The signed credential declares AI-generated content, made with {maker}.' : 'The signed credential declares AI-generated content.', { ...extra, vars });
  }
  if (declaredByCredential) {
    return finding('ai', 'declared-unverified', 'info', 'unverified', 'AI, declared', 'A credential declares AI-generated content. The credential did not verify in full.', { ...extra, vars });
  }
  if (meta?.ai) {
    return finding('ai', 'declared-metadata', 'info', 'stated', 'AI, declared in metadata', makers.length ? 'The file’s metadata declares AI-generated content, credited to {maker}.' : 'The file’s metadata declares AI-generated content.', { ...extra, vars });
  }
  if (input.marks?.length) {
    return finding('ai', 'watermark', 'info', 'estimated', 'Watermark found', 'A pixel scan on this device read {mark}.', { ...extra, vars: { ...vars, mark: bounded(input.marks[0]!) } });
  }
  if (fingerprint) {
    return finding('ai', 'fingerprint', 'info', 'hint', 'Likely AI', 'The file is packaged the way {maker} delivers AI output. Nothing in it declares AI.', { ...extra, vars });
  }
  if (t && textFound) {
    return finding('ai', 'text-signals', 'warn', 'estimated', t.artifacts ? 'AI traces in the text' : 'AI signals in the text',
      t.artifacts ? 'The text holds {n} signals, some of them left behind by an AI tool.' : 'The text holds {n} style signals often seen in AI writing. Style alone does not show who wrote it.', { ...extra, vars });
  }
  if (t) {
    return finding('ai', 'nothing-found', 'quiet', 'estimated', 'Nothing found', 'No AI declaration, no known AI packaging and no AI signals in the text.', extra);
  }
  return finding('ai', 'nothing-declared', 'quiet', 'none', 'Nothing declared', 'No AI declaration and no known AI packaging. No text was analysed.', extra);
}

function licenceFinding(input: VerifyFindingsInput, rights: VerifyRights[]): VerifyFinding {
  const evidence = rights.flatMap((r) => r.evidence);
  const sources = (input.report.ingredients ?? []).map((i) => text(i.rights?.license)).filter(Boolean);
  const sourceNames = [...new Set(sources.map((s) => { const n = normaliseLicence(s); return n.id ? licenceDisplayName(n.id) : s; }))];
  const known = rights.filter((r) => r.id);
  if (!rights.length) {
    return sourceNames.length
      ? finding('licence', 'sources-only', 'info', credentialStrength(input.report), 'Sources: {first}', 'The file states no licence of its own. Its recorded sources carry {n}.', { names: sourceNames, vars: { first: sourceNames[0]!, n: sourceNames.join(', ') } })
      : finding('licence', 'none', 'quiet', 'none', 'None recorded', 'No licence is recorded. That does not mean free to use.');
  }
  const strength = strongest(evidence);
  if (known.length > 1) {
    return finding('licence', 'conflict', 'warn', strength, 'Two statements disagree', 'The file names {a} in one place and {b} in another.',
      { names: rights.map((r) => r.name), vars: { a: known[0]!.name, b: known[1]!.name }, evidence });
  }
  const lead = known[0] ?? rights[0]!;
  const short = lead.name.length > 64 ? `${lead.name.slice(0, 61)}…` : lead.name;
  return finding('licence', lead.id ? 'licence' : 'statement', 'info', strength, '{name}',
    lead.id ? 'Declared terms: {name}. Permission to reuse is not verified.' : 'A rights statement is recorded. Permission to reuse is not verified.',
    { names: [lead.name, ...rights.filter((r) => r !== lead).map((r) => r.name), ...sourceNames], vars: { name: short }, evidence });
}

const PERSONAL_GROUPS = new Set(['location', 'device', 'authorship', 'capture']);
const isPersonal = (f: MetaField): boolean => !!f.sensitive && PERSONAL_GROUPS.has(f.group);

function personalFinding(input: VerifyFindingsInput): VerifyFinding {
  const { meta } = input;
  const fields = (meta?.fields ?? []).filter(isPersonal).slice(0, 24);
  const evidence = fields.map<VerifyEvidence>((f) => ({ label: f.label, value: bounded(f.value), source: f.source ?? `${meta?.format ?? ''} ${f.label}`.trim(), strength: 'stated' }));
  if (meta?.gps) {
    const place = fields.find((f) => f.group === 'location' && /location|place|city/i.test(f.label))?.value;
    const where = place ? bounded(place) : `${meta.gps.lat.toFixed(4)}, ${meta.gps.lon.toFixed(4)}`;
    return finding('personal', 'location', 'warn', 'stated', 'Location recorded', 'The file records where it was made: {where}.', { vars: { where }, names: [where], evidence });
  }
  if (fields.length) {
    const labels = [...new Set(fields.map((f) => f.label))];
    return finding('personal', 'identifying', 'info', 'stated', labels.length > 1 ? '{first} and {more} more' : '{first}',
      'The file records details that can identify a person or a device.', { vars: { first: labels[0]!, more: labels.length - 1 }, names: labels, evidence });
  }
  if (!meta) return finding('personal', 'not-read', 'quiet', 'none', 'Not read', 'This file type’s metadata could not be read.');
  return finding('personal', 'none', 'quiet', 'none', 'None found', 'No location, name or device serial is recorded in the metadata.');
}

function hiddenFinding(input: VerifyFindingsInput): VerifyFinding {
  const { meta } = input;
  const evidence: VerifyEvidence[] = [];
  const words: string[] = [];
  if (meta?.appended && !appendedIsExpected(meta.appended)) {
    words.push('Data after the end of the file');
    evidence.push({ label: 'Appended data', value: 'Bytes follow the end of the container', source: 'File structure', strength: 'estimated' });
  }
  if (meta?.lsb?.suspicious) {
    words.push('Likely data hidden in the pixels');
    evidence.push({ label: 'Pixel analysis', value: 'The lowest bits of the pixels look written to', source: 'Pixel analysis on this device', strength: 'estimated' });
  }
  for (const f of meta?.fields ?? []) {
    if (f.group === 'structure' && f.sensitive && /hidden/i.test(f.label)) {
      words.push('Hidden text');
      evidence.push({ label: f.label, value: bounded(f.value), source: f.source ?? 'Page content', strength: 'estimated' });
    }
  }
  if (input.text?.invisible) {
    words.push('Invisible characters');
    evidence.push({ label: 'Invisible characters', value: `${input.text.invisible}`, source: 'Text analysis on this device', strength: 'estimated' });
  }
  if (words.length) {
    return finding('hidden', 'found', 'warn', 'estimated', words.length > 1 ? '{first} and {more} more' : '{first}',
      'The file holds content that does not show when it is viewed.', { vars: { first: words[0]!, more: words.length - 1 }, names: words, evidence });
  }
  if (!meta && !input.text) return finding('hidden', 'not-read', 'quiet', 'none', 'Not read', 'This file type’s structure could not be read.');
  return finding('hidden', 'none', 'quiet', 'none', 'None found', 'No appended data, hidden text or hidden pixel data was found.');
}

/** The six findings, always all six, always in {@link VERIFY_FINDING_IDS} order. */
export function verifyFindings(input: VerifyFindingsInput): VerifyFinding[] {
  const software = verifySoftware(input.report, input.meta);
  const rights = verifyRights(input.report, input.meta);
  return [
    credentialFinding(input),
    madeWithFinding(input, software),
    aiFinding(input),
    licenceFinding(input, rights),
    personalFinding(input),
    hiddenFinding(input),
  ];
}

/** Fill a finding's `{name}` placeholders. A shell that translates does that first. */
export function fillFindingText(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}
