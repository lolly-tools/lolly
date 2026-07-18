// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA verdict resolution — the single source of truth for (a) the check-code
 * vocabulary verifyC2pa emits, (b) the flags→verdict ladder every surface
 * renders, and (c) trust-anchor assembly.
 *
 * Before this module each surface re-derived the verdict privately: the web
 * /valid view (shells/web/src/views/valid.ts resolveState/stateTone), the CLI
 * (`lolly validate`, shells/cli/src/validate.ts) and the MCP `lolly_verify`
 * tool (services/mcp/src/tools.ts) each had their own headline ladder and
 * their own expired-only check, and each assembled trust anchors by hand.
 * The three ladders had genuinely drifted (see resolveVerdict's notes on the
 * partsMadeWithLolly and 'trusted' tiers); this module makes the shared
 * semantics one function and the remaining divergence explicit at each
 * call site. Surfaces keep rendering their own words — resolveVerdict returns
 * a semantic state + the flags that drove it, never display strings.
 */

import type { C2paCheck, C2paReport, C2paSignerIdentity } from './c2pa-verify.ts';
import { c2paTrustAnchors, LOLLY_CA_ROOT_PEM } from './c2pa-trust.ts';
import { pemToDer } from './x509.ts';

/**
 * The check codes verifyC2pa emits — the C2PA validation-status vocabulary
 * (deliberately shared with c2patool / verify.contentauthenticity.org), plus
 * `credential.unreadable` for a store that cannot be parsed at all.
 *
 * These strings are a CONTRACT: the web /valid scorecard, the CLI/MCP report
 * renderers and the contract tests all match on them literally, and they ride
 * in every saved JSON report. Never change a value; add new codes instead.
 * (tests/c2pa-verdict.test.ts pins each value byte-for-byte.)
 */
export const C2PA_CHECK = {
  /** The manifest store exists but cannot be parsed (malformed JUMBF/CBOR). */
  credentialUnreadable: 'credential.unreadable',
  /** A claim-referenced assertion hashed to the payload actually in the store. */
  assertionHashedUriMatch: 'assertion.hashedURI.match',
  /** A claim-referenced assertion's hash does not match (or the ref is malformed). */
  assertionHashedUriMismatch: 'assertion.hashedURI.mismatch',
  /** The claim references an assertion the store does not contain. */
  assertionMissing: 'assertion.missing',
  /** The COSE claim signature verified under the x5chain leaf key. */
  claimSignatureValidated: 'claimSignature.validated',
  /** The COSE claim signature failed (or could not be) verified. */
  claimSignatureMismatch: 'claimSignature.mismatch',
  /** The signing certificate is inside its validity window right now. */
  claimSignatureInsideValidity: 'claimSignature.insideValidity',
  /** The signing certificate is expired (or not yet valid). */
  signingCredentialExpired: 'signingCredential.expired',
  /** The signing chain verified to a caller-pinned trust anchor (identity granted). */
  signingCredentialTrusted: 'signingCredential.trusted',
  /**
   * No pinned anchor vouches for the chain — the DESIGNED default posture for
   * ephemeral on-device keys, not damage. Always excluded from the state
   * verdict (see isExpiredOnly/resolveVerdict below and verifyC2pa itself).
   */
  signingCredentialUntrusted: 'signingCredential.untrusted',
  /** The hard binding (c2pa.hash.data) matches the file bytes. */
  assertionDataHashMatch: 'assertion.dataHash.match',
  /** The hard binding does not match — the file changed after signing (or none present). */
  assertionDataHashMismatch: 'assertion.dataHash.mismatch',
  /** The BMFF (mp4/webm-family) hard binding matches. */
  assertionBmffHashMatch: 'assertion.bmffHash.match',
  /** The BMFF hard binding does not match / could not be checked. */
  assertionBmffHashMismatch: 'assertion.bmffHash.mismatch',
} as const;

export type C2paCheckCode = (typeof C2PA_CHECK)[keyof typeof C2PA_CHECK];

/**
 * The minimal report surface the verdict is a pure function of. C2paReport
 * satisfies it structurally, and so do the surfaces' locally-mirrored report
 * types (e.g. the web view's VerifyReport), so adopting resolveVerdict never
 * forces a type migration.
 */
export interface C2paVerdictInput {
  state: 'valid' | 'invalid' | 'none';
  trusted: boolean;
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  partsMadeWithLolly: boolean;
  delivered: boolean;
  checks: C2paCheck[];
  signer?: { identity?: C2paSignerIdentity };
}

/** The resolved semantic state — one of the web /valid view's hero states.
 *  'trusted' = CA-verified identity on an otherwise plain-valid credential;
 *  'likelyLolly'/'expired' are the two softened invalid cases; the last three
 *  are the raw report states passed through. */
export type C2paVerdictState =
  | 'lolly'        // intact + records a Lolly creation — the flat "Made with Lolly"
  | 'delivered'    // intact + CA-verified + a published (not created) action
  | 'trusted'      // intact + the chain verified to a pinned anchor, cert still valid
  | 'likelyLolly'  // ONLY the hard binding failed and the claim records a Lolly creation
  | 'expired'      // ONLY the cert validity window failed — bytes still match
  | 'valid'        // intact, unanchored (integrity, not identity)
  | 'invalid'      // broken beyond the softened cases above
  | 'none';        // no credential found

/** Traffic-light tone for badges/exit-style summaries (the web's stateTone). */
export type C2paVerdictTone = 'good' | 'warn' | 'bad' | 'none';

export interface C2paVerdict {
  state: C2paVerdictState;
  tone: C2paVerdictTone;
  /** report.trusted re-gated on state 'valid' (defence in depth — see resolveVerdict). */
  trusted: boolean;
  /** The ONLY failure (beyond the designed untrusted marker) is the cert validity window. */
  expiredOnly: boolean;
  // The raw report flags the ladder read — surfaced so a caller can see WHICH
  // flag drove the state (and so surfaces with a deliberate extra tier — the
  // CLI's parts headline — can layer it without re-deriving anything).
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  partsMadeWithLolly: boolean;
  delivered: boolean;
  /** The CA-verified signer identity, when the chain reached a pinned anchor
   *  (also set anchored-but-expired — identity proven, signing time not). */
  identity: C2paSignerIdentity | null;
}

/**
 * True when the ONLY failure — beyond the always-excluded
 * `signingCredential.untrusted` marker, which is the designed posture of an
 * ephemeral on-device key, never damage — is the certificate validity window.
 * The bytes still match exactly what was signed, so surfaces render this as
 * "expired", never as "modified after signing" (which would be false).
 *
 * Byte-identical semantics to the web /valid view's isExpiredOnly
 * (shells/web/src/views/valid.ts) and the ladders the CLI + MCP previously
 * inlined.
 */
export function isExpiredOnly(report: Pick<C2paVerdictInput, 'checks'>): boolean {
  const fails = report.checks.filter((c) => !c.ok && c.code !== C2PA_CHECK.signingCredentialUntrusted);
  return fails.length === 1 && fails[0]!.code === C2PA_CHECK.signingCredentialExpired;
}

/**
 * Resolve a verify report's flags into the ONE semantic verdict every surface
 * renders. Exactly the web /valid view's resolveState + stateTone semantics
 * (shells/web/src/views/valid.ts) — the reference ladder, replicated branch
 * for branch:
 *
 *  1. `madeWithLolly` wins outright — the question users actually ask. The
 *     engine only sets it on an intact credential (state 'valid'), so it can
 *     never paper over a broken file.
 *  2. `trusted && delivered` — CA-verified "official asset, delivered not
 *     created" (a c2pa.published action). Checked before plain trusted so the
 *     honest "delivered by, not made by" journey outranks the generic one.
 *  3. `trusted` — intact + the signing chain verified to a pinned anchor and
 *     the cert is still inside its window. `trusted` here is report.trusted
 *     RE-GATED on state === 'valid': defence in depth inherited from the web
 *     view — the engine only sets report.trusted on an intact file, but the
 *     resolver never trusts that invariant blind, so a (hypothetically)
 *     trusted-but-broken report still resolves to its failure state. This is
 *     a re-derivation of the engine invariant, not new logic.
 *  4. state 'invalid' + `likelyMadeWithLolly` — only the hard binding failed;
 *     the claim's own content (signature + every hashed-URI assertion) is
 *     verified and records a Lolly creation. The common re-save case; a
 *     softened 'warn', not a flat 'broken'. (The engine only sets the flag on
 *     invalid reports; the state gate is the same defence in depth as #3.)
 *  5. state 'invalid' + expired-only — bytes intact, cert lapsed. Softened to
 *     'expired'/'warn' because "modified after signing" would be a lie.
 *  6. Otherwise the raw report state passes through ('valid'/'invalid'/'none';
 *     anything unexpected degrades to 'none', as the web view's
 *     `STATE_COPY[report.state] ?? STATE_COPY.none` fallback does).
 *
 * `partsMadeWithLolly` (an intact chain recording Lolly steps under another
 * tool's active manifest) is deliberately NOT a rung: in the reference web
 * ladder it never drives the hero state (it surfaces as a scorecard pip
 * only), so a parts file resolves to 'valid' — or 'trusted' when anchored.
 * KNOWN SURFACE DIVERGENCE, preserved as-is and flagged in
 * plans/maintainability-2026-07-18.md: the CLI elevates the parts flag to its
 * headline (after likely, before expired — so its trusted+parts cell reads
 * "Parts made with Lolly" where the web reads "Verified"), while MCP has no
 * parts headline at all. Both keep their behaviour by layering the returned
 * `partsMadeWithLolly` flag (or ignoring it) over `state`.
 *
 * Pure and display-free: returns the semantic state, its tone, and the flags
 * that drove it. Each surface maps those to its own words.
 */
export function resolveVerdict(report: C2paVerdictInput): C2paVerdict {
  const expiredOnly = isExpiredOnly(report);
  // Defence in depth (branch #3 above): never let trusted outrank a broken file.
  const trusted = report.trusted && report.state === 'valid';
  const state: C2paVerdictState =
    report.madeWithLolly ? 'lolly'
      : trusted && report.delivered ? 'delivered'
        : trusted ? 'trusted'
          : report.state === 'invalid' && report.likelyMadeWithLolly ? 'likelyLolly'
            : report.state === 'invalid' && expiredOnly ? 'expired'
              : report.state === 'valid' || report.state === 'invalid' || report.state === 'none' ? report.state
                : 'none';
  // The web stateTone mapping: broken = bad; the two softened cases = warn;
  // no credential = none; every intact shade (valid/lolly/trusted/delivered) = good.
  const tone: C2paVerdictTone =
    state === 'invalid' ? 'bad'
      : state === 'expired' || state === 'likelyLolly' ? 'warn'
        : state === 'none' ? 'none'
          : 'good';
  return {
    state,
    tone,
    trusted,
    expiredOnly,
    madeWithLolly: report.madeWithLolly,
    likelyMadeWithLolly: report.likelyMadeWithLolly,
    partsMadeWithLolly: report.partsMadeWithLolly,
    delivered: report.delivered,
    identity: report.signer?.identity ?? null,
  };
}

/**
 * Assemble the trust-anchor set a surface passes to
 * `verifyC2pa(bytes, { trustAnchors })` — the one place the three surfaces'
 * hand-built arrays now live.
 *
 * CURRENT PER-SURFACE POLICY (preserved exactly — this helper makes the split
 * explicit, it does not resolve it):
 *   • web /valid            → { includeLollyRoot: true }
 *       pins the Lolly CA root FIRST, then the vendored C2PA lists — so
 *       Lolly-CA-enrolled exports read as CA-verified identities there.
 *   • CLI `lolly validate`  → { includeLollyRoot: false, extra: --trust-anchor PEMs }
 *       vendored lists + any explicitly pinned roots. Does NOT pin the Lolly
 *       root: a Lolly-CA-signed file that reads "Verified" on /valid reads
 *       plain "Credential intact" here unless the user pins the root by flag.
 *   • MCP `lolly_verify`    → { includeLollyRoot: false }
 *       vendored lists only — same gap as the CLI.
 * Whether the CLI/MCP omission of the Lolly root is deliberate posture or an
 * accident of parallel evolution is an open PRODUCT decision — flagged in
 * plans/maintainability-2026-07-18.md. Do not "fix" it here silently.
 *
 * `extra` entries are PEM certificate strings (e.g. the CLI's --trust-anchor
 * file contents), appended after the vendored list in order; a malformed PEM
 * throws (matching the CLI's previous inline pemToDer behaviour). The vendored
 * cache is never mutated — a fresh array is returned each call.
 */
export function defaultTrustAnchors(
  { includeLollyRoot = false, extra = [] }: { includeLollyRoot?: boolean; extra?: string[] } = {},
): Uint8Array[] {
  return [
    // Empty LOLLY_CA_ROOT_PEM = no root configured yet: degrade to vendored-only
    // (the same guard the web view had around its CA_ROOT_PEM import).
    ...(includeLollyRoot && LOLLY_CA_ROOT_PEM ? [pemToDer(LOLLY_CA_ROOT_PEM)] : []),
    ...c2paTrustAnchors(),
    ...extra.map((pem) => pemToDer(pem)),
  ];
}

// Convenience re-export so verdict consumers can type full reports without a
// second import path.
export type { C2paReport, C2paCheck, C2paSignerIdentity };
