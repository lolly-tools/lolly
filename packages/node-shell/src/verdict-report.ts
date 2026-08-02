// SPDX-License-Identifier: MPL-2.0
/**
 * The human PRESENTATION of a C2PA verdict, shared by every Node surface that
 * renders one for a person: `lolly validate` (ANSI stdout), the TUI Profile
 * verify panel (Ink tones), and the MCP `verify_file` tool (plain text).
 *
 * The engine owns the LADDER (`resolveVerdict`, engine/src/c2pa-verdict.ts) and
 * `verdict-slugs.ts` owns the machine SLUG + headline wording. This owns the rest
 * of what all three surfaces used to hand-copy:
 *
 *   • cleanControlChars — the ONE security scrub. Every claim/signer string is
 *     attacker-controlled bytes from the file being checked; stripping control
 *     characters (incl. ESC) before printing is what stops a crafted manifest from
 *     injecting ANSI/terminal sequences into the very tool meant to be trustworthy
 *     about that file. It was written out three times; if one copy learned to strip
 *     a new separator the other two kept the hole. It lives here now.
 *   • verdictFacts — the 11-row claim facts table (Title … Manifest), already
 *     scrubbed and already filtered to the truthy rows, in one fixed key order.
 *   • verdictChecks — the per-check list, scrubbed, with a semantic `mark` each
 *     surface paints its own way (ANSI colour / Ink tone / plain glyph).
 *   • verdictHeadline — glyph + name + detail + tone for the top line, resolving
 *     the two terminal quirks the CLI and TUI share: `partsMadeWithLolly` elevated
 *     to a headline (opt-in via `elevateParts`, kept a flag by the engine and by
 *     the MCP surface), and 'trusted'/'valid' both reading "Credential intact"
 *     with no separate "Verified" hero. The wording is `verdict-slugs.ts`'s, so
 *     the terminal line and the machine headline can never drift.
 *
 * Every string returned is DATA, never a painted/Ink fragment: the shared piece
 * is the scrubbed content and the semantic tone, each shell owning its own skin.
 */

import type { C2paReport, C2paVerdict } from '@lolly/engine';
import { VERDICT_SLUGS } from './verdict-slugs.ts';

/**
 * Strip control characters (C0, DEL, and the C1 block that carries ANSI's 8-bit
 * forms) from an attacker-controlled string before it is printed. THE scrub —
 * one definition, so a hardening patch here reaches the CLI, the TUI and MCP at
 * once instead of one of the three.
 */
export function cleanControlChars(v: unknown): string {
  return String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}

/** Semantic tone for a rendered verdict line; each surface maps it to its palette. */
export type VerdictTone = 'good' | 'warn' | 'bad' | 'dim';

/** The top verdict line, split so a colour surface can paint the name and dim the tail. */
export interface VerdictHeadline {
  /** Leading glyph: ✦ ◆ ~ ! ✕ ○ ✓ */
  glyph: string;
  /** The short verdict name, e.g. "Made with Lolly" (painted in the tone colour). */
  name: string;
  /** The explanatory tail after " — ", or '' when there is none (painted dim). */
  detail: string;
  tone: VerdictTone;
}

const PARTS_HEADLINE =
  'Parts made with Lolly — the intact provenance chain records Lolly steps, but the file as it stands was produced by another tool';

/** Split a slug headline "Name — detail" into its painted name and dim tail. */
function splitHeadline(headline: string): { name: string; detail: string } {
  const i = headline.indexOf(' — ');
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
    // 'valid' and 'trusted' — the file matches what was signed; no separate "Verified".
    default: return { glyph: '✓', ...splitHeadline(slug.headline), tone: 'good' };
  }
}

/**
 * The claim facts table: the same 11 rows in the same key order all three surfaces
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
      && `${id.email || s.commonName}${id.issuer ? ` — verified by ${id.issuer}` : ''}`],
    ['Tool', env.tool],
    ['Produced by', report.author && `${report.author.name}${report.author.email ? ` <${report.author.email}>` : ''}`],
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
