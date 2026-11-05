// SPDX-License-Identifier: MPL-2.0
/**
 * The human-readable presentation of a C2PA verdict, shared by every Node surface
 * that renders one for a person: `lolly validate` (ANSI stdout), the TUI Profile
 * verify panel (Ink tones), and the MCP `verify_file` tool (plain text).
 *
 * The engine owns the ladder (`resolveVerdict`, engine/src/c2pa-verdict.ts) and
 * `verdict-slugs.ts` owns the machine slug and headline wording. This module owns
 * the rest of what all three surfaces used to hand-copy:
 *
 *   • cleanControlChars - the one security scrub. Every claim/signer string is
 *     attacker-controlled bytes from the file being checked. Stripping control
 *     characters (incl. ESC) before printing stops a crafted manifest from
 *     injecting ANSI/terminal sequences into the very tool meant to be trustworthy
 *     about that file. It was written out three times before; if one copy learned
 *     to strip a new separator, the other two kept the hole. It lives here now.
 *   • verdictFacts - the 11-row claim facts table (Title … Manifest), already
 *     scrubbed and already filtered to the truthy rows, in one fixed key order.
 *   • verdictChecks - the per-check list, scrubbed, with a semantic `mark` each
 *     surface paints its own way (ANSI colour / Ink tone / plain glyph).
 *   • verdictIntent - what the file says it was asked to do, with any recorded prompt
 *     labelled as data and quoted, so it cannot pass for this tool's own words.
 *   • verdictHeadline - glyph + name + detail + tone for the top line. It resolves
 *     two terminal quirks the CLI and TUI share: `partsMadeWithLolly` elevated to
 *     a headline (opt-in via `elevateParts`, kept a flag by the engine and by the
 *     MCP surface), and 'trusted'/'valid' both reading "Credential intact" with no
 *     separate "Verified" hero. The wording is `verdict-slugs.ts`'s, so the
 *     terminal line and the machine headline can never drift.
 *
 * Every string returned is data, never a painted/Ink fragment: the shared piece
 * is the scrubbed content and the semantic tone, each shell owning its own skin.
 */

import type { C2paReport, C2paVerdict } from '@lolly/engine';
import { rightsReportFromC2pa } from '@lolly/engine';
import { VERDICT_SLUGS } from './verdict-slugs.ts';

/**
 * Strip control characters (C0, DEL, and the C1 block that carries ANSI's 8-bit
 * forms) from an attacker-controlled string before it is printed. The one scrub:
 * one definition, so a hardening patch here reaches the CLI, the TUI and MCP at
 * once instead of one of the three.
 */
export function cleanControlChars(v: unknown): string {
  return String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}

/** What a credential records about the intent behind a file. Scrubbed, and data throughout. */
export interface VerdictIntent {
  facts: Array<[label: string, value: string]>;
  /** The recorded words as one quoted line, escapes showing, or null when the file holds none. */
  prompt: string | null;
  /** The label that goes with `prompt`. */
  promptNote: string | null;
}

/**
 * The intent record for a person to read, or null when the file holds none. Free text
 * reads as a fingerprint. Recorded prompt words stay inside quotes with their escapes
 * showing, so a line break or a sentence in them cannot look like this tool talking.
 */
export function verdictIntent(report: C2paReport): VerdictIntent | null {
  const r = report.intent;
  if (!r) return null;
  const raw: Array<[string, string | undefined]> = [
    ['Purpose', r.purpose], ['Surface', r.surface], ['Tool', r.tool], ['Language', r.language],
    ['Rules', r.rulesVersion], ['Digest', r.intentDigest],
    ['Occasion', r.occasion && 'text, fingerprinted'], ['Audience', r.audience && 'text, fingerprinted'], ['Region', r.region && 'text, fingerprinted'],
    ['Prompt', r.promptFingerprint && 'text, fingerprinted'],
  ];
  return {
    facts: raw.filter((row): row is [string, string] => !!row[1]).map(([k, v]) => [k, cleanControlChars(v)]),
    prompt: r.prompt === undefined ? null : cleanControlChars(JSON.stringify(r.prompt)),
    promptNote: r.promptNote ?? null,
  };
}

/** What a credential records about an approval. Scrubbed, and data throughout. */
export interface VerdictApproval {
  /** False when the file holds a record but its credential does not verify. */
  intact: boolean;
  facts: Array<[label: string, value: string]>;
  note: string;
}

/** The approval record for a person to read, or null when the file holds none. */
export function verdictApproval(report: C2paReport): VerdictApproval | null {
  const r = report.approval;
  if (!r) return null;
  const intact = report.state === 'valid';
  // "Changed" rests on a failed hash comparison and nothing else. A lapsed certificate
  // leaves the bytes exactly as signed, so it must not read as a change.
  const fails = report.checks.filter(chk => !chk.ok && chk.code !== 'signingCredential.untrusted');
  const changed = fails.some(chk => chk.code === 'assertion.dataHash.mismatch' || chk.code === 'assertion.bmffHash.mismatch');
  const lapsed = fails.length === 1 && fails[0]!.code === 'signingCredential.expired';
  return {
    intact,
    facts: [
      ['Request', cleanControlChars(r.approvalId)],
      ['Decided', cleanControlChars(r.decidedAt)],
      ['Reviewed', cleanControlChars(r.reviewedSha256)],
      ['This file', intact ? 'unchanged since the signer recorded this approval'
        : changed ? 'does not match the signed record'
        : lapsed ? 'still matches its credential'
        : 'could not be confirmed'],
    ],
    note: intact ? 'A record the signer made, not a review of the work.'
      : changed ? 'This file changed after the approval was recorded, or the record itself was altered.'
      : lapsed ? 'The signing certificate has lapsed, so this approval can no longer be confirmed.'
      : 'This approval record did not pass its checks, so it cannot be relied on.',
  };
}

/** Semantic tone for a rendered verdict line; each surface maps it to its palette. */
export type VerdictTone = 'good' | 'warn' | 'bad' | 'dim';

/** The top verdict line, split so a colour surface can paint the name and dim the tail. */
export interface VerdictHeadline {
  /** Leading glyph: ✦ ◆ ~ ! ✕ ○ ✓ */
  glyph: string;
  /** The short verdict name, e.g. "Made with Lolly" (painted in the tone colour). */
  name: string;
  /** The explanatory tail after " - ", or '' when there is none (painted dim). */
  detail: string;
  tone: VerdictTone;
}

const PARTS_HEADLINE =
  'Parts made with Lolly - the intact provenance chain records Lolly steps, but the file as it stands was produced by another tool';

/** Split a slug headline "Name - detail" into its painted name and dim tail. */
function splitHeadline(headline: string): { name: string; detail: string } {
  const i = headline.indexOf(' - ');
  return i === -1 ? { name: headline, detail: '' } : { name: headline.slice(0, i), detail: headline.slice(i + 3) };
}

/**
 * The verdict's top line as glyph + name + detail + tone. Branch order matches the
 * CLI/TUI it replaces exactly: the three Lolly-positive states, then the opt-in
 * parts elevation, then the remaining states. `elevateParts` is true for the two
 * terminal shells and absent for MCP (which keeps parts a flag, per verdict-slugs).
 */
export function verdictHeadline(v: C2paVerdict, opts: { elevateParts?: boolean } = {}): VerdictHeadline {
  const slug = VERDICT_SLUGS[v.state];
  switch (v.state) {
    case 'lolly': return { glyph: '✦', ...splitHeadline(slug.headline), tone: 'good' };
    case 'delivered': return { glyph: '◆', ...splitHeadline(slug.headline), tone: 'good' };
    case 'likelyLolly': return { glyph: '~', ...splitHeadline(slug.headline), tone: 'warn' };
  }
  if (opts.elevateParts && v.partsMadeWithLolly) {
    return { glyph: '~', ...splitHeadline(PARTS_HEADLINE), tone: 'warn' };
  }
  switch (v.state) {
    case 'expired': return { glyph: '!', ...splitHeadline(slug.headline), tone: 'warn' };
    case 'invalid': return { glyph: '✕', ...splitHeadline(slug.headline), tone: 'bad' };
    case 'none': return { glyph: '○', ...splitHeadline(slug.headline), tone: 'dim' };
    // 'valid' and 'trusted' - the file matches what was signed; no separate "Verified".
    default: return { glyph: '✓', ...splitHeadline(slug.headline), tone: 'good' };
  }
}

/**
 * The claim facts table: the same 13 rows in the same key order all three surfaces
 * built by hand, already scrubbed and already filtered to the truthy rows. The
 * caller pads/paints the label and prints `${label} ${value}`.
 */
export function verdictFacts(report: C2paReport): Array<[label: string, value: string]> {
  const c = report.claim;
  if (!c) return [];
  const s: Partial<NonNullable<C2paReport['signer']>> = report.signer ?? {};
  const env: Record<string, string | number | boolean> = report.environment ?? {};
  const signedAt = c.actions?.find(a => a.when)?.when;
  const generator = c.generatorInfo?.name
    ? `${c.generatorInfo.name}${c.generatorInfo.version ? ' ' + c.generatorInfo.version : ''}`
    : c.claimGenerator;
  const id = report.signer?.identity;
  const raw: Array<[string, unknown]> = [
    ['Title', c.title],
    ['Identity', report.trusted && id
      && `${id.email || s.commonName}${id.issuer ? ` - verified by ${id.issuer}` : ''}`],
    ['Tool', env.tool],
    ['Produced by', report.author && `${report.author.name}${report.author.email ? ` <${report.author.email}>` : ''}`],
    ['Contact', report.author?.url],
    ['Rights / licence', report.rights],
    [report.delivered ? 'Delivered by' : 'Made with', generator],
    ['Signed', signedAt],
    ['Where', [env.surface, env.engine, env.os].filter(Boolean).join(' · ')],
    ['Signer', s.commonName],
    ['Issuer', s.organization && `${s.organization}${s.selfSigned ? ' (self-signed)' : ''}`],
    ['Algorithm', s.alg],
    ['Manifest', c.manifestLabel],
  ];
  const out: Array<[string, string]> = [];
  for (const [k, v] of raw) if (v) out.push([k, cleanControlChars(v)]);
  return out;
}

/** One per-check row: a semantic mark plus the scrubbed code + explanation. */
export interface VerdictCheck {
  /** ok = passed, info = the (benign) untrusted-signer note, bad = a failed check. */
  mark: 'ok' | 'info' | 'bad';
  code: string;
  explanation: string;
}

/** The verifier's checks as scrubbed rows with a semantic mark, in report order. */
export function verdictChecks(report: C2paReport): VerdictCheck[] {
  return report.checks.map(chk => ({
    mark: chk.ok ? 'ok' : chk.code === 'signingCredential.untrusted' ? 'info' : 'bad',
    code: cleanControlChars(chk.code),
    explanation: cleanControlChars(chk.explanation),
  }));
}

/** One recorded creative source, scrubbed, as every Node surface prints it. */
export interface VerdictSource {
  title: string;
  creator: string;
  licence: string;
  /** 'signed by the source' or 'recorded by the exporter'. Never the same sentence. */
  asserted: string;
  /** The credit line the engine assembled, ready to paste. */
  credit: string;
}

/** The Sources section: the computed summary, one row per source, and the stated limits. */
export interface VerdictSources {
  summary: string;
  sources: VerdictSource[];
  /** What this reading did not establish. Never trimmed away to make a tidy report. */
  limits: string[];
}

/**
 * What a file records about the creative work inside it (plan 253, section 9.2),
 * scrubbed like every other row here because each string is bytes from the file
 * under inspection. Null when nothing was recorded, so a surface prints no
 * heading rather than an empty one.
 *
 * The wording is the engine's own, from `rightsReportFromC2pa`, so this terminal
 * output, the web Verify panel and the MCP result cannot say different things
 * about the same bytes. A source that carries no credential of its own reads as
 * recorded by the exporter, which is a different claim from a signature.
 */
export function verdictSources(report: C2paReport): VerdictSources | null {
  if (!report.ingredients?.length) return null;
  const rights = rightsReportFromC2pa(report);
  return {
    summary: cleanControlChars(rights.summary),
    sources: rights.recorded.map(source => ({
      title: cleanControlChars(source.title ?? 'Untitled source'),
      creator: cleanControlChars(source.creator ?? ''),
      licence: cleanControlChars(source.licence ?? ''),
      asserted: source.assertedBy === 'source' ? 'signed by the source' : 'recorded by the exporter',
      credit: cleanControlChars(source.credit),
    })),
    limits: rights.carried.limits.map(cleanControlChars),
  };
}
