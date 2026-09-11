// SPDX-License-Identifier: MPL-2.0
/**
 * /valid's pure verdict/scorecard logic - extracted from valid.ts so it's importable
 * (and testable) without that view's top-level CSS side-effect import, which makes the
 * view itself unloadable outside a bundler. Zero DOM, zero side effects: report/watermark
 * data in, a resolved state or scorecard model out. valid.ts imports all of this back for
 * rendering; nothing here renders anything itself.
 *
 * Local mirror of the engine verifier's report shape (c2pa-verify's C2paReport is not
 * re-exported through the barrel). Structural - the awaited result of verifyC2pa() is
 * assignable to it.
 */

import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import type { IconName } from '../lib/icons.ts';

export interface Check { code: string; ok: boolean; explanation: string; }
export interface SignerIdentity { email: string | null; issuer: string | undefined; }
export interface Signer {
  commonName: string | undefined;
  organization: string | undefined;
  notBefore: string;
  notAfter: string;
  selfSigned: boolean;
  alg: string;
  identity?: SignerIdentity;
}
export interface Claim {
  title: unknown;
  format: unknown;
  claimGenerator: unknown;
  generatorInfo: Record<string, string | number | boolean> | null;
  instanceId: unknown;
  manifestLabel: string;
  actions: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; parameters?: unknown }>;
}
// ── C2PA 2.4 text bindings (engine 1.115.0) ──────────────────────────────────
// Local mirrors of the engine's C2paTextBinding / C2paAiDisclosure, same rule as
// VerifyReport itself: structural, so the awaited verifyC2pa() result stays
// assignable without importing the engine's own types through a barrel that does
// not re-export them yet. Every field is optional - the engine only sets what it
// actually established, and a shell that guesses at an absent one would be
// inventing a finding.
export type TextBindingKind = 'html' | 'structuredText' | 'text';
export interface TextBinding {
  kind: TextBindingKind;
  /** A C2PA_TEXT_STATUS code - the carrier is present but unusable. */
  status?: string;
  detail?: string;
  /** section A.7.1.2 / section A.9.3 external reference. THE ENGINE NEVER FETCHES IT. */
  manifestUrl?: string;
  /** The verified store arrived via verifyC2pa's `externalManifest` option - the
   *  shell fetched `manifestUrl` itself, so this report is about a credential
   *  that is NOT inside the file. */
  externalManifestUsed?: boolean;
  wrappers?: number;
  matchedWrappers?: number;
  wrappersTruncated?: boolean;
  selectedWrapper?: number;
  exclusionsConform?: 'narrower' | 'other';
  /** section 15.12.1.3.4 - the machine-derivable "this is part of a longer signed
   *  text" shapes only. Never set from a plain hash mismatch. */
  fragment?: boolean;
  exclusionsFrom?: 'wrapper' | 'selectors';
}
// section 18.28 c2pa.ai-disclosure - claim CONTENT (what the signer declared), read for
// every format and never a failure.
export interface AiDisclosure {
  modelType?: string;
  modelName?: string;
  modelIdentifier?: string;
  oversight?: string;
  scientificDomain?: string[];
}

export interface VerifyReport {
  found: boolean;
  state: 'valid' | 'invalid' | 'none';
  trusted: boolean;
  madeWithLolly: boolean;
  likelyMadeWithLolly: boolean;
  partsMadeWithLolly: boolean;
  delivered: boolean;
  format: string | null;
  checks: Check[];
  reason?: string;
  claim?: Claim;
  environment?: (Record<string, string | number | boolean> & { inputs?: Record<string, string> }) | null;
  author?: { name: string; email?: string; url?: string };
  rights?: string;
  signer?: Signer;
  aiGenerated?: { kind: 'generated' | 'composite'; sourceType: string };
  history?: Array<{ action: unknown; when: unknown; softwareAgent: unknown; digitalSourceType?: unknown; description?: unknown; parameters?: unknown; generator?: unknown }>;
  // Present only for the three C2PA 2.4 text formats (html / code / text).
  textBinding?: TextBinding;
  // section 18.28, any format. `aiDisclosures` appears only when a claim made more than
  // one; `aiDisclosure` is always the first of them.
  aiDisclosure?: AiDisclosure;
  aiDisclosures?: AiDisclosure[];
  // claim_generator_info.specVersion - informational per section 10.2.3.1, so nothing
  // here (or in the engine) branches on it.
  specVersion?: string;
}

// The pixel-watermark detection result (engine detectWatermark), surfaced only
// when present - a durable, lower-confidence provenance signal that lives in the
// pixels rather than the C2PA metadata container.
export interface Watermark {
  present: boolean;
  score: number;
  // Set when the mark was found INSIDE a container file's embedded raster
  // (a .pptx slide image, a PDF image XObject) rather than in the dropped file's
  // own pixels - the note/pip wording changes to say so.
  embedded?: boolean;
}

export const STATUS_WORD = { pass: 'passed', fail: 'failed', warn: 'invalid', na: 'n/a' };

export const STATE_COPY = {
  valid: {
    cls: 'is-valid',
    title: 'Credential intact',
    sub: 'The file is exactly what its embedded credential signed. Signed with an on-device key - integrity, not identity.',
  },
  invalid: {
    cls: 'is-invalid',
    title: 'Credential broken',
    sub: 'The file carries Content Credentials, but they no longer match its bytes - it was modified after signing, or the credential is damaged.',
  },
  none: {
    cls: 'is-none',
    title: 'No Content Credentials',
    sub: 'This file carries no C2PA manifest. It was still inspected on-device for a Lolly Imprint, embedded metadata and hidden data.',
  },
  // state 'valid' + the signing chain verifies against the pinned Lolly CA
  // root: integrity plus a CA-verified signer identity. What was made - and
  // with which app - remains the signer’s own claim.
  trusted: {
    cls: 'is-valid is-trusted',
    title: 'Verified',
    sub: 'The file is exactly what its embedded credential signed, and the signing certificate chains to the pinned Lolly CA root - integrity plus a CA-verified identity. What it records about how it was made is still the signer’s own claim.',
  },
  // state 'valid' + the claim records Lolly → the answer users came for.
  lolly: {
    cls: 'is-valid is-lolly',
    title: 'Made with Lolly',
    sub: 'The credential is intact and records a Lolly export - the file has not changed since it was made. (Integrity plus the maker’s claim; an on-device key, not a CA identity.)',
  },
  // state 'valid' + trusted + a c2pa.published (not created) action: an existing
  // asset Lolly distributes but did not author. Honest journey - verified
  // authentic, delivered by Lolly, made by someone else (shown below).
  delivered: {
    cls: 'is-valid is-delivered',
    title: 'Delivered by Lolly',
    sub: 'This is the genuine official version, delivered by Lolly. The credential chains to the pinned Lolly CA root, so the file is intact and its origin is CA-verified. Lolly delivered this asset - it did not create it; who made it is recorded below as the signer’s own claim.',
  },
  // Every check passed EXCEPT the cert validity window: the bytes still match
  // what was signed - saying "modified after signing" here would be false.
  expired: {
    cls: 'is-none is-expired',
    title: 'Credential expired',
    sub: 'The file still matches exactly what its credential signed - nothing was modified - but the signing certificate (a short-lived on-device key; the lifetime is picked at export) has lapsed, so the credential no longer validates.',
  },
  // state 'invalid' with ONE failure: manifest.inaccessible. C2PA 2.4 section A.7.1.2 /
  // section A.9.3 let a text asset REFERENCE its credential instead of carrying it, and
  // the engine reports `invalid` there because `state` is integrity-only and NO
  // integrity check could run - 'valid' would be a lie and 'none' (no credential
  // at all) would be a different one. Rendering that as the flat "Credential
  // broken", with its "Bytes no longer match" and "Modified after signing"
  // badges, would be the loudest lie of the three: nothing was compared. Same
  // lesson as the expired-certificate state - a verdict word must describe what
  // was actually established.
  external: {
    cls: 'is-none is-external',
    title: 'Credential stored elsewhere',
    sub: 'This file does not carry its Content Credential - it points at one kept somewhere else. Nothing is fetched on your behalf here, so these bytes have not been checked against it. The address is shown below.',
  },
  // state 'invalid' whose ONLY failures are carrier problems (see CARRIER_CODES):
  // the credential could not be read out of the file at all, so NO hash was ever
  // computed and nothing was compared. The flat "Credential broken" hero - with
  // its "Bytes no longer match" and "Modified after signing" badges - states
  // three things the engine never established, and it directly contradicts the
  // note this page is about to print underneath ("nothing here says its content
  // was changed"). Two markers quoted in a prose document about C2PA are enough
  // to reach this state, and since M2 added .md/.txt/text-paste ingestion, that
  // document now has three routes here. Amber, not red, and worded for the
  // honest cause as well as the dishonest one.
  carrier: {
    cls: 'is-none is-carrier',
    title: 'Credential could not be checked',
    sub: 'This file declares a Content Credential that could not be read out of it, so nothing was hashed and nothing was compared. That is a problem with how the credential was written into the file, or with the copy that arrived here - nothing on this page says the content was changed. What went wrong is explained below.',
  },
  // state 'invalid' whose ONLY failure is assertion.dataHash.additionalExclusions
  // Present: the credential's declared exclusion reaches OUTSIDE its own manifest
  // block, so part of the file is deliberately not bound. The hash over the rest
  // still ran and still PASSED, which is why the flat broken hero was false on
  // its own page - the check list right below it prints "data hash valid". This
  // is the section A.7.1.3 / section A.9.4 forged-carve-out shape, and the correct reading is
  // "the bytes are intact, the coverage is not", never "the file was edited".
  uncovered: {
    cls: 'is-none is-uncovered',
    title: 'Not all of this file is covered by its credential',
    sub: 'The bytes this credential does cover match exactly what was signed. But its declared exclusion reaches beyond its own manifest block, so part of what you can see here was never covered by the signature - that part is not vouched for, and could have been changed without the credential noticing.',
  },
  // The text readers cap at 16 MiB (engine MAX_TEXT_BYTES) while this page accepts
  // far larger files, so a big HTML document carrying a real credential lands
  // here with found:false. "This file carries no C2PA manifest" would be a flat
  // positive claim of absence about a file whose text was never searched - the
  // mirror image of the never-accuse rule, and just as wrong. Never exonerate
  // either.
  notInspected: {
    cls: 'is-none is-notinspected',
    title: 'Not inspected as text',
    sub: 'This file is past the size limit for on-device text inspection, so its text was never searched for a C2PA manifest - nothing is claimed about it either way. It was still inspected on-device for a Lolly Imprint, embedded metadata and hidden data.',
  },
  // state 'invalid', but ONLY the hard binding (the file's own bytes) failed - 
  // the claim signature and every hashed-URI-bound assertion (the actions and
  // export context this page shows as edit history / "made from") checked out,
  // and the claim records a Lolly creation. A softer, honest middle ground
  // between the flat "Made with Lolly" and "Credential broken".
  likelyLolly: {
    cls: 'is-none is-likelylolly',
    title: 'Likely made with Lolly',
    sub: 'The credential’s own content checks out - its signature is valid and everything it references matches - and it records a Lolly export, but the file’s bytes no longer match the hard binding, so this exact copy can’t be vouched for. It was probably re-saved, re-encoded, or re-uploaded through something that left the manifest alone.',
  },
};

// True when the ONLY failure (beyond the always-present untrusted marker) is
// the certificate validity window.
export function isExpiredOnly(report: VerifyReport): boolean {
  const fails = report.checks.filter((c) => !c.ok && c.code !== 'signingCredential.untrusted');
  return fails.length === 1 && fails[0]!.code === 'signingCredential.expired';
}

// True when the ONLY failure is "the credential lives elsewhere" - the C2PA 2.4
// external-reference case (section A.7.1.2 / section A.9.3). Same shape as isExpiredOnly, and
// for the same reason: an `invalid` state whose single cause is not damage must
// not be worded as damage. A report that ALSO carries a real failure keeps the
// broken verdict - this is a rewording of one specific case, never a softener.
export function isExternalOnly(report: VerifyReport): boolean {
  const fails = report.checks.filter((c) => !c.ok && c.code !== 'signingCredential.untrusted');
  return fails.length === 1 && fails[0]!.code === 'manifest.inaccessible';
}

// ── Did a hash comparison actually happen? ───────────────────────────────────
//
// The hard-binding rows are the ONLY checks that establish anything about
// whether these bytes are the bytes that were hashed. Every hero sentence and
// badge that says "bytes no longer match" / "modified after signing" is an
// inference FROM one of them, so it may only be printed when one of them is
// actually in the report. Nine of the C2PA 2.4 text statuses return before the
// binding ever runs (M1 section 3: "'your exclusions are wrong' and 'your bytes
// changed' are different accusations"), and one of them - the section A.7.1.3 /
// section A.9.4 carve-out - fails the report with the hash row PASSING beside it.
const HASH_FAIL_CODES = ['assertion.dataHash.mismatch', 'assertion.bmffHash.mismatch'];
const HASH_PASS_CODES = ['assertion.dataHash.match', 'assertion.bmffHash.match'];
/** A hard-binding comparison ran and FAILED - the only evidence for "the bytes changed". */
export const hashFailed = (report: VerifyReport): boolean =>
  (report.checks ?? []).some((c) => !c.ok && HASH_FAIL_CODES.includes(c.code));
/** A hard-binding comparison ran at all, either way. */
export const hasHashVerdict = (report: VerifyReport): boolean =>
  (report.checks ?? []).some((c) => HASH_FAIL_CODES.includes(c.code) || HASH_PASS_CODES.includes(c.code));

// Failures that mean "the credential could not be got out of this file", as
// opposed to "the credential itself did not check out" (claimSignature.mismatch,
// assertion.hashedURI.mismatch, assertion.missing - those ARE damage and keep
// the broken verdict). Deliberately NOT a catch-all: a code that is not listed
// here falls through to the flat invalid state, which is the safe direction.
const CARRIER_CODES = new Set([
  'manifest.html.multipleManifests',
  'manifest.structuredText.multipleReferences',
  'manifest.structuredText.emptyReference',
  'manifest.structuredText.malformedReference',
  'manifest.text.corruptedWrapper',
  'manifest.text.multipleWrappers',
  'manifest.inaccessible',
  'credential.unreadable',
  // section 15.12.1.3.1 step 3: the exclusions are wrong, which is a different
  // accusation from "the bytes changed" - and the hash never ran.
  'assertion.dataHash.malformed',
]);
/** Every failure is a carrier problem AND no hash was ever computed. */
export function isCarrierOnly(report: VerifyReport): boolean {
  const fails = (report.checks ?? []).filter((c) => !c.ok && c.code !== 'signingCredential.untrusted');
  return fails.length > 0 && fails.every((c) => CARRIER_CODES.has(c.code)) && !hasHashVerdict(report);
}

/** The ONE failure is the section A.7.1.3 / section A.9.4 carve-out - the hash itself passed. */
export function isExclusionsOnly(report: VerifyReport): boolean {
  const fails = (report.checks ?? []).filter((c) => !c.ok && c.code !== 'signingCredential.untrusted');
  return fails.length === 1 && fails[0]!.code === 'assertion.dataHash.additionalExclusionsPresent';
}

// The engine's C2PA_TEXT_STATUS value for "the text readers declined to look".
// Kept as a literal here for the same reason valid-text.ts keeps its own copy:
// this module must not import the engine to word one sentence.
const STATUS_TOO_LARGE = 'lolly.text.tooLarge';

// The untrusted marker is the designed posture, not damage - render it as an
// informational row, never as a failure.
export const isExpectedRow = (c: Check): boolean => c.code === 'signingCredential.untrusted';

// Eight canonical C2PA checks for the hero scorecard. The verifier emits a
// variable number of rows (one hashed-URI per assertion, trusted vs untrusted,
// …); this collapses them onto a stable eight so the hero reads as a consistent
// glance, with each pip's state (pass / fail / warn / not-applicable) derived
// from the actual rows - never hard-coded.
export interface ScorecardItem { icon: IconName; label: string; status: keyof typeof STATUS_WORD; hideStatus?: boolean; ash?: boolean; statusWord?: string; }
// A pip's status word: the shared pass/fail vocabulary unless the item carries
// its own (the Lolly Imprint says "detected" - presence, not a graded check).
export const pipStatusWord = (it: ScorecardItem): string => it.statusWord ?? t(STATUS_WORD[it.status]);
export function scorecardModel(report: VerifyReport, watermark?: Watermark, extra: ScorecardItem[] = []): ScorecardItem[] {
  const cs = report.checks || [];
  const okRow = (code: string): boolean => cs.some((c) => c.ok && c.code === code);
  const badRow = (...codes: string[]): boolean => cs.some((c) => !c.ok && !isExpectedRow(c) && codes.includes(c.code));
  const present = (code: string): boolean => cs.some((c) => c.code === code);
  const found = !!report.found;
  const na = 'na';

  // "Manifest readable" is about a manifest we actually read. With the credential
  // stored elsewhere (section A.7.1.2 / section A.9.3) there was nothing in these bytes to
  // read, so this is not-applicable - a green "readable: passed" would be the
  // scorecard vouching for a file the page just said it could not check.
  const readable = present('credential.unreadable') ? 'fail'
    : present('manifest.inaccessible') ? na
      : found ? 'pass' : na;
  const assertions = badRow('assertion.hashedURI.mismatch', 'assertion.missing') ? 'fail'
    : okRow('assertion.hashedURI.match') ? 'pass' : na;
  const signature = badRow('claimSignature.mismatch') ? 'fail' : okRow('claimSignature.validated') ? 'pass' : na;
  const validity = present('signingCredential.expired') ? 'warn' : okRow('claimSignature.insideValidity') ? 'pass' : na;
  const binding = badRow('assertion.dataHash.mismatch', 'assertion.bmffHash.mismatch') ? 'fail'
    : (okRow('assertion.dataHash.match') || okRow('assertion.bmffHash.match')) ? 'pass' : na;
  const trust = okRow('signingCredential.trusted') ? 'pass'
    : (report.signer?.identity && present('signingCredential.expired')) ? 'warn' : na;
  const lollyMade = !!report.madeWithLolly;
  const lollyLikely = !!report.likelyMadeWithLolly;
  const lollyParts = !!report.partsMadeWithLolly;

  return [
    // Yes/no, not a graded check: "Made with Lolly" (green tick), a "Likely"
    // amber middle ground (manifest content checks out, file bytes don't), or
    // a plain "Not made with Lolly" - none of these show a status pill, "not
    // applicable"/"invalid" would misword the amber and grey cases.
    {
      icon: 'lollipop',
      label: lollyMade ? t('Made with Lolly') : lollyLikely ? t('Likely made with Lolly')
        : lollyParts ? t('Parts made with Lolly') : t('Not made with Lolly'),
      status: lollyMade ? 'pass' : (lollyLikely || lollyParts) ? 'warn' : na,
      hideStatus: !lollyMade,
    },
    // The Lolly Imprint - detected in the pixels ON this device, so it earns a
    // real pass pip, seated right beside the Made-with-Lolly verdict it backs.
    // Present ONLY when found: absence is uninformative (resize erases it;
    // non-Lolly rasters never carry it), so there is no fail/na state.
    ...(watermark?.present ? [{ icon: 'imprint' as IconName, label: t('Lolly Imprint'), status: 'pass' as const, statusWord: watermark.embedded ? t('in an image') : t('detected') }] : []),
    // Extra signal pips, seated up top with the other watermark facts: the
    // SynthID/Meta likelihood pip (aiMarkPip) and the steganalysis heuristics
    // (stegoPips) - built by the caller so both scorecards stay in sync.
    ...extra,
    { icon: 'document', label: t('Manifest found'), status: found ? 'pass' : na },
    { icon: 'eye', label: t('Manifest readable'), status: readable },
    { icon: 'link', label: t('Assertions bound to the claim'), status: assertions },
    { icon: 'pen', label: t('Claim signature valid'), status: signature },
    { icon: 'clock', label: t('Certificate within validity'), status: validity },
    { icon: 'hash', label: t('File bytes match (hard binding)'), status: binding },
    // "Signer identity" has no CA answer when the file was signed with a
    // self-signed on-device key - so say that plainly (dark-ash card) rather
    // than a bare "not applicable".
    (trust === 'na' && report.signer?.selfSigned
      ? { icon: 'cpu', label: t('Signed with an on-device key'), status: na, hideStatus: true, ash: true }
      : { icon: 'userCheck', label: t('Signer identity (CA-verified)'), status: trust }),
  ];
}

export interface ResolvedState {
  state: (typeof STATE_COPY)[keyof typeof STATE_COPY];
  sub: string;
  identity: SignerIdentity | undefined;
}
// Resolve the hero state (which STATE_COPY entry it maps to) and the occasionally
// reworded sub-line. Shared by the full report body AND the collapsed summary so the
// two never disagree on the headline. Defence in depth: a green "trusted" hero must
// never outrank a broken credential - the engine only sets report.trusted when the
// file is intact, but the view never trusts that invariant blind, so an invalid file
// always resolves to its failure state whatever `trusted` says.
export function resolveState(report: VerifyReport): ResolvedState {
  const trusted = report.trusted && report.state === 'valid';
  const state = report.madeWithLolly ? STATE_COPY.lolly
    : trusted && report.delivered ? STATE_COPY.delivered
    : trusted ? STATE_COPY.trusted
    : report.state === 'invalid' && isExternalOnly(report) ? STATE_COPY.external
    : report.state === 'invalid' && report.likelyMadeWithLolly ? STATE_COPY.likelyLolly
    : report.state === 'invalid' && isExpiredOnly(report) ? STATE_COPY.expired
    // "We declined to look" is not "we looked and it is clean" - the flat
    // no-credential hero would be a positive claim of absence about text that
    // was never read.
    : report.textBinding?.status === STATUS_TOO_LARGE ? STATE_COPY.notInspected
    // The two invalid states where NO hash mismatch was established. Both come
    // before the flat invalid fall-through, and both are one predicate wide on
    // purpose: an unlisted failure code keeps the broken verdict.
    : report.state === 'invalid' && isExclusionsOnly(report) ? STATE_COPY.uncovered
    : report.state === 'invalid' && isCarrierOnly(report) ? STATE_COPY.carrier
    : (STATE_COPY[report.state] ?? STATE_COPY.none);
  // Set only when the signing chain verified against the pinned root: a still-valid
  // cert (report.trusted true) or an anchored-but-expired one (identity CA-verified,
  // signing time unprovable).
  const identity = report.signer?.identity;
  // Two subs would lie once a chain verifies against the anchor: the lolly one claims
  // "an on-device key, not a CA identity" and the expired one blames "a one-year
  // on-device key". Swap the wording, keep the state.
  // The default trusted copy is Lolly-specific ("the pinned Lolly CA root"),
  // which is wrong for a third-party signer (Google, Adobe, Microsoft…). When
  // the chain verified against a NON-Lolly anchor, name the actual root and the
  // signer's organisation instead. Delivered/lolly stay Lolly-worded (they ARE
  // Lolly). signerOrg comes from the CA-verified cert - only used once trusted.
  const signerOrg = report.signer?.organization || report.signer?.commonName;
  const thirdPartyRoot = !!identity?.issuer && !/\blolly\b/i.test(identity.issuer);
  // NB: `sub` is rendered as raw HTML (so the signer/anchor names can be <strong>).
  // The static STATE_COPY subs carry no HTML metacharacters; any cert-derived value
  // interpolated here (issuer, signerOrg) MUST be escape()'d - it is attacker-controlled.
  // Every intact-state sub says "its EMBEDDED credential", which is exactly the
  // word that stops being true once the shell fetched the credential from the
  // address the file names (engine 1.116.0's externalManifest). The verdict is
  // unchanged and earned - these bytes really do match that credential - but the
  // sentence has to name which credential, because a reader who assumes it came
  // with the file would be assuming the wrong thing.
  const sub = report.state === 'valid' && report.textBinding?.externalManifestUsed
    ? t('This file is exactly what the credential it points at signed. That credential is not inside the file - it was fetched from the address the file names, at your request, and checked against these bytes.')
    : state === STATE_COPY.lolly && report.trusted
    ? t('The credential is intact and records a Lolly export - the file has not changed since it was made. (Integrity plus the maker’s claim, signed under a CA-verified identity.)')
    : state === STATE_COPY.expired && identity
      ? t('The file still matches exactly what its credential signed - nothing was modified - but the short-lived signing certificate has expired, so the credential no longer validates. Without a trusted timestamp the time of signing cannot be proven.')
      : state === STATE_COPY.trusted && thirdPartyRoot
        ? tRaw('The file is exactly what its embedded credential signed, and the signing certificate chains to <strong>{issuer}</strong> - a recognised C2PA trust anchor{signer}. Integrity plus a CA-verified identity; what it records about how it was made is still the signer’s own claim.', {
            issuer: escape(identity!.issuer!),
            signer: signerOrg ? t(', identifying the signer as <strong>{org}</strong>', { org: signerOrg }) : '',
          })
        // The external hero's default sub ends "The address is shown below."
        // One route here has no address to show: a reference the engine refused
        // to hand up at all (a `javascript:` href - M1 section 3, "manifestUrl is
        // deliberately absent"). Promising an address that is never rendered
        // sends the reader looking for something that is not on the page.
        : state === STATE_COPY.external && !report.textBinding?.manifestUrl
          ? t('This file does not carry its Content Credential - it points at one kept somewhere else, but not in a form this page can follow, so no address is shown and these bytes have not been checked against it.')
        // An invalid state that no hash mismatch caused: the default sub's
        // "they no longer match its bytes - it was modified after signing" is
        // false either way, and which honest sentence applies depends on
        // whether a hash comparison ran at all.
          : state === STATE_COPY.invalid && !hashFailed(report)
            ? (hasHashVerdict(report)
              ? t('The file carries Content Credentials, and its bytes still match the hash that was signed - what failed is inside the credential itself. The checks below say which part.')
              : t('The file carries Content Credentials, but the credential itself did not check out, so these bytes were never compared against it. Nothing here establishes that the content was changed - the checks below say what failed.'))
            : t(state.sub);
  return { state, sub, identity };
}

// A single tone for the collapsed summary's badge / card stripe. good = intact
// (valid / lolly / trusted / delivered), warn = expired-only, bad = broken, none
// = no credential.
export function stateTone(report: VerifyReport): 'good' | 'bad' | 'warn' | 'none' {
  const { state } = resolveState(report);
  if (state === STATE_COPY.invalid) return 'bad';
  // Amber, not red: something IS wrong with the carrier or the coverage, and
  // neither is evidence that the content changed.
  if (state === STATE_COPY.expired || state === STATE_COPY.likelyLolly
    || state === STATE_COPY.carrier || state === STATE_COPY.uncovered) return 'warn';
  // A credential kept elsewhere is neutral, never green and never red: nothing
  // was checked. So is a file whose text was never searched. Listed explicitly - 
  // the fall-through below is 'good', and a new state silently inheriting that
  // would be the worst possible default.
  if (state === STATE_COPY.none || state === STATE_COPY.external
    || state === STATE_COPY.notInspected) return 'none';
  return 'good';
}

// ── Change-history source-type wording ───────────────────────────────────────
//
// A step's IPTC `digitalSourceType` says what the material at that step IS. For
// a producing action (created/resized/edited/converted) that is the step's own
// output, so "Generated by AI" reads correctly. For an INGEST action (opened /
// placed) it describes what the step took IN - and Lolly's `c2pa.opened`
// deliberately propagates an ingredient's AI source type onto its own manifest
// so the flag survives even if the ingredient manifests are stripped
// (engine/src/c2pa.ts). Rendered with the producing wording, that propagated
// claim sat under the green Lolly pill reading "Generated by AI", which says
// Lolly generated the pixels. It did not - it opened something that already
// was. Same claim, attributed to the step that actually makes it.

/** Wording when the source type describes what this step PRODUCED. */
export const SOURCE_TYPE_LABEL: Record<string, string> = {
  trainedAlgorithmicMedia: 'Generated by AI',
  compositeWithTrainedAlgorithmicMedia: 'Composited with AI',
  algorithmicMedia: 'Algorithmically generated',
  digitalCreation: 'Created in software',
  digitalCapture: 'Captured by a camera',
  computationalCapture: 'Computational capture',
  screenCapture: 'Captured from a screen',
  digitalArt: 'Digital art',
  minorHumanEdits: 'Minor human edits',
  composite: 'Composite of multiple elements',
  softwareImage: 'Software-generated image',
};

/** Wording when the source type describes what this step took IN. */
export const INGEST_SOURCE_TYPE_LABEL: Record<string, string> = {
  trainedAlgorithmicMedia: 'Source was AI-generated',
  compositeWithTrainedAlgorithmicMedia: 'Source was composited with AI',
  algorithmicMedia: 'Source was algorithmically generated',
  digitalCreation: 'Source was created in software',
  digitalCapture: 'Source came from a camera',
  computationalCapture: 'Source was a computational capture',
  screenCapture: 'Source was captured from a screen',
  digitalArt: 'Source was digital art',
  minorHumanEdits: 'Source had minor human edits',
  composite: 'Source was a composite of multiple elements',
  softwareImage: 'Source was a software-generated image',
};

/** Actions that take material IN rather than produce it. */
export const INGEST_ACTIONS = new Set(['c2pa.opened', 'c2pa.placed']);

/** The source-type line for one history step, or undefined when the slug is unknown. */
export function sourceTypeLabel(action: string, slug: string): string | undefined {
  return (INGEST_ACTIONS.has(action) ? INGEST_SOURCE_TYPE_LABEL : SOURCE_TYPE_LABEL)[slug];
}
