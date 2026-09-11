// SPDX-License-Identifier: MPL-2.0
/**
 * /valid's TEXT-PAYLOAD logic - the C2PA 2.4 text bindings as the verify page has
 * to talk about them, plus the two policies that decide what the page will fetch.
 *
 * Pure by design, exactly like valid-verdict.ts: report/text in, a model out.
 * Zero DOM, zero network, zero side effects - valid.ts renders these models and
 * owns every `t()` / `escape()` call, so the copy can be tested as data and the
 * URL policy can be attacked in a test file instead of in a browser.
 *
 * Two rules run through all of it, and they are the reason this file exists
 * rather than a pile of template literals in the view:
 *
 *  1. **A carrier problem is not an accusation.** The engine reports a dozen
 *     distinct ways a text credential can be present-but-unusable (section A.7.1.4,
 *     section A.8.7.1, section A.9.3/section A.9.5, section 15.12.1.3), and most of them are producer bugs,
 *     truncated copies or invisible characters lost in a clipboard - NOT
 *     evidence that anyone changed the content. `manifest.inaccessible` in
 *     particular means "the credential is over there", and must never render as
 *     a broken one. Every string below is written to be true of the honest cause
 *     as well as the dishonest one.
 *  2. **Nothing is fetched on your behalf.** The page's own promise. A pasted
 *     URL and an external manifest reference are both resolved through the same
 *     same-origin gate (`classifyUrl`), and anything else is refused in
 *     words rather than followed quietly.
 */
import type { VerifyReport, TextBinding } from './valid-verdict.ts';
import { hashFailed } from './valid-verdict.ts';
import { analyzeTextSignals, textFacts } from '@lolly/engine';
import type {
  TextSignalReport, TextSignalBand, TextSignalSource, TextSignalDocKind, TextHeatmap, TextFacts,
} from '@lolly/engine';

// ── Honest format labels ─────────────────────────────────────────────────────
// `report.format` is a sniff result, not a language claim: 'code' means "at
// least one section A.9 manifest DELIMITER appeared in this text", never "this is
// JavaScript". The summary line used to print the sniff token verbatim, which
// read as a file-type verdict the sniffer never made.
//
// 'code' says MARKER, not "armour block", and the difference is the whole point:
// the sniffer sets it on ONE delimiter, which is the section A.9.5 case the engine
// deliberately reports as "no credential here" (prose that quotes a delimiter is
// byte-identical to a damaged block, so nothing is claimed either way). The old
// label asserted a block on the very line that goes on to deny one - the only
// place in this wave where the copy stated something the engine had not
// established. "Marker" is true of one delimiter and of a whole block.
export const TEXT_FORMAT_LABEL: Record<string, string> = {
  html: 'HTML document',
  code: 'source text with a C2PA manifest marker',
  text: 'plain text',
};

/** The English display string for a sniffed format - the raw token for every
 *  binary/svg format, whose presentation is deliberately unchanged. */
export function formatLabel(format: string | null | undefined): string {
  const f = format ?? '';
  return TEXT_FORMAT_LABEL[f] ?? f;
}

/** Sniffed format → the filename a pasted payload is wrapped in. The extension
 *  is cosmetic (verification always re-sniffs the bytes), so it must never
 *  over-claim: 'code' has no knowable language, and an unrecognised paste is
 *  plain text, not "unknown.bin". */
export function pastedFileName(format: string | null | undefined): string {
  if (format === 'html') return 'pasted.html';
  if (format === 'svg') return 'pasted.svg';
  return 'pasted.txt';
}

// ── The text preview snippet ─────────────────────────────────────────────────
export const TEXT_SNIPPET_MAX = 2048;
/** The first ~2 KB of a text payload, for the escaped <pre> that replaces the
 *  image preview. Cuts on a character boundary and reports how much was left
 *  out, so the panel can say so instead of implying the file ends there. */
export function textSnippet(text: string, cap = TEXT_SNIPPET_MAX): { body: string; omitted: number } {
  if (text.length <= cap) return { body: text, omitted: 0 };
  // Never split a surrogate pair: half an astral character renders as U+FFFD,
  // which would show damage the file does not have.
  let end = cap;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return { body: text.slice(0, end), omitted: text.length - end };
}

// ── The one URL gate ─────────────────────────────────────────────────────────
//
// `#/verify?src=` has always required a path starting with a SINGLE `/` (see the
// comment at its call site in valid.ts): this page promises nothing is fetched on
// your behalf, so a link must not be able to send your browser to a third party.
// Pasted text and an external manifest reference are the two new ways a URL can
// arrive, and both go through the same gate.
//
// The subtle part is normalising an absolute URL to a path. `new URL(
// 'https://lolly.example//evil.test/x').pathname` is `//evil.test/x`, and handing
// THAT to fetch() is a protocol-relative request to evil.test - same-origin
// checked, cross-origin fetched. So the single-`/` rule is re-asserted on the
// normalised path, not only on the raw input.

// Whitespace and control characters never appear in a URI reference - the same
// refusal the engine’s own safeExternalUrl makes, repeated here because this module
// must never trust a value that arrived inside a file.
const CONTROL_CHARS = /[\u0000-\u0020\u007f]/;
/** A path this page may fetch: same-origin by construction. */
const SINGLE_SLASH_PATH = /^\/[^/]/;

export type UrlGate =
  /** Safe to fetch: a same-origin path (already normalised). */
  | { kind: 'same-origin'; path: string }
  /** A real http(s) URL somewhere else. `host` is for the refusal sentence. */
  | { kind: 'elsewhere'; host: string }
  /** An address this page REFUSES to follow: a non-http(s) scheme
   *  (`javascript:`, `data:`, `file:`, `blob:`), a protocol-relative
   *  `//host/x`, userinfo smuggled into a same-origin URL, or a same-origin URL
   *  whose path normalises back to `//host`. Every one of these is an ABSOLUTE
   *  reference the engine was willing to hand up - the refusal is this page's,
   *  and the copy has to say so rather than blame the reference for being
   *  relative, which it is not. */
  | { kind: 'unresolvable' }
  /** A genuinely RELATIVE reference (`doc.c2pa`, `../c/doc.c2pa`) with no base
   *  to resolve it against - the only case where "it only means something next
   *  to where the file is served from" is the true sentence. Split out from
   *  `unresolvable` because those two facts want two different explanations,
   *  and one of them was being told about the other. */
  | { kind: 'no-base' }
  /** Not a URL at all - for pasted text this is the ordinary case. */
  | { kind: 'not-a-url' };

/**
 * Classify a reference under this page's fetch policy.
 *
 * `base` is the URL the document itself was read from, when there is one (the
 * `?src=` path) - a relative manifest reference only means something next to the
 * place its document is served from, and a file on your device no longer records
 * that. Without a base, a relative reference is `unresolvable` rather than
 * guessed against this site's origin.
 */
export function classifyUrl(raw: string, origin: string, base?: string | null): UrlGate {
  const url = (raw ?? '').trim();
  if (!url || url.length > 2048 || CONTROL_CHARS.test(url)) return { kind: 'not-a-url' };
  // Protocol-relative: `//evil.test/x` is a URL to another host wearing a path's
  // clothes. Refused before anything resolves it.
  if (url.startsWith('//')) return { kind: 'unresolvable' };
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url);
  if (scheme) {
    // `javascript:`, `data:`, `file:`, `blob:` - nothing this page will follow.
    if (!/^https?$/i.test(scheme[1]!)) return { kind: 'unresolvable' };
    return absolute(url, origin);
  }
  if (url === '/') return { kind: 'same-origin', path: url };
  // A bare `/`-rooted path. It is NOT handed back verbatim: `fetch()` resolves
  // it against the document, and the WHATWG URL parser treats a BACKSLASH as a
  // path separator for http(s) - so `/\evil.test/m.c2pa` passes a single-`/`
  // regex, then resolves to `https://evil.test/m.c2pa`. Origin-checked,
  // cross-origin fetched, which is the exact promise this page makes. `/..//x`
  // is the same shape one normalisation further on. Resolving it here and
  // re-running the absolute checks means every branch of this gate leaves
  // through one door.
  if (SINGLE_SLASH_PATH.test(url)) {
    try { return absolute(new URL(url, origin).href, origin); } catch { return { kind: 'unresolvable' }; }
  }
  // A relative reference. Resolvable only against the document's own address.
  if (!base) return { kind: 'no-base' };
  try {
    return absolute(new URL(url, new URL(base, origin)).href, origin);
  } catch { return { kind: 'unresolvable' }; }
}

function absolute(href: string, origin: string): UrlGate {
  let u: URL;
  try { u = new URL(href); } catch { return { kind: 'unresolvable' }; }
  // Origin first, so the oldest look-alike in the book - 
  // `https://lolly.example@evil.test/x`, which IS evil.test - is named by the
  // host it actually resolves to rather than dismissed as unparseable.
  if (u.origin !== origin) return { kind: 'elsewhere', host: u.host };
  // Then userinfo. A credential reference has no business carrying credentials,
  // and `https://evil.test@lolly.example/x` resolves same-origin - refused
  // rather than fetched with a username attached.
  if (u.username || u.password) return { kind: 'unresolvable' };
  const path = `${u.pathname}${u.search}`;
  // The normalised path must ALSO pass the single-`/` rule - see the block
  // comment above: a same-origin URL can normalise to a protocol-relative path.
  if (!SINGLE_SLASH_PATH.test(path)) return { kind: 'unresolvable' };
  return { kind: 'same-origin', path };
}

/**
 * Pasted text → the URL gate, or null when the text is a PAYLOAD to verify.
 *
 * Deliberately narrow. Only a single whitespace-free token that is an absolute
 * http(s) URL or a `/`-rooted path counts as an address; `notes.txt`,
 * `example.com` and anything with a space or newline in it are payload. Reading
 * an address into a paste that was not one would silently swallow the very text
 * someone asked us to check - the more expensive mistake of the two.
 */
export function classifyPastedUrl(text: string, origin: string): UrlGate | null {
  const s = (text ?? '').trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^(https?:\/\/|\/)/i.test(s)) return null;
  const gate = classifyUrl(s, origin);
  return gate.kind === 'not-a-url' ? null : gate;
}

// ── textBinding → honest copy ────────────────────────────────────────────────
//
// Every `title`/`body` below is an ENGLISH SOURCE STRING, keyed exactly as
// `t()` will look it up (English is the key; see i18n.ts). The view interpolates
// `params` through `t()`, which escapes them, and escapes `detail`/`url`
// separately - nothing here builds markup.

export interface VerifyNotice {
  /** Stable identifier: the data attribute in the DOM and what tests assert on. */
  id: string;
  /** 'warn' is reserved for the one shape where content really is outside the
   *  credential. Everything else is 'info' - a carrier problem is not damage. */
  tone: 'info' | 'warn';
  title: string;
  body: string;
  params?: Record<string, string | number>;
  /** The engine's own detail sentence, shown verbatim under the copy. */
  detail?: string;
  /** A reference to display verbatim (never linkified - see valid.ts). */
  url?: string;
  /** Offer "Fetch and check": a same-origin path this page may fetch. */
  fetchPath?: string;
}

export interface NoticeContext {
  /** location.origin. */
  origin: string;
  /** The address the checked document was read from, when it had one. */
  base?: string | null;
  /** The payload arrived through the paste/text-drop path. */
  pasted?: boolean;
  /** The file's bytes are still in hand, so a re-check can actually run. */
  refetchable?: boolean;
}

const STATUS = {
  htmlMultipleManifests: 'manifest.html.multipleManifests',
  structuredTextMultipleReferences: 'manifest.structuredText.multipleReferences',
  structuredTextNoManifest: 'manifest.structuredText.noManifest',
  structuredTextEmptyReference: 'manifest.structuredText.emptyReference',
  textCorruptedWrapper: 'manifest.text.corruptedWrapper',
  textMultipleWrappers: 'manifest.text.multipleWrappers',
  credentialUnreadable: 'credential.unreadable',
  unsupportedReference: 'lolly.manifest.unsupportedReference',
  malformedBase64: 'lolly.manifest.malformedBase64',
  htmlUnterminatedScript: 'lolly.html.unterminatedScript',
  tooLarge: 'lolly.text.tooLarge',
} as const;

const failed = (report: VerifyReport, ...codes: string[]): boolean =>
  (report.checks ?? []).some((c) => !c.ok && codes.includes(c.code));
const passed = (report: VerifyReport, code: string): boolean =>
  (report.checks ?? []).some((c) => c.ok && c.code === code);

/** The external-credential notice - the one the M1 report singles out as the
 *  field a shell must special-case so it does not render as "broken". */
function externalNotice(b: TextBinding, ctx: NoticeContext): VerifyNotice {
  const gate = classifyUrl(b.manifestUrl!, ctx.origin, ctx.base);
  const base = { id: 'manifest-elsewhere', tone: 'info' as const, url: b.manifestUrl };
  if (gate.kind === 'same-origin') {
    return {
      ...base,
      title: 'The credential can be fetched from this site',
      body: 'This file names the address below instead of carrying its Content Credential, and that address is served by this site - so it can be fetched and checked against these bytes. Nothing is fetched until you ask for it.',
      ...(ctx.refetchable ? { fetchPath: gate.path } : {}),
    };
  }
  if (gate.kind === 'elsewhere') {
    return {
      ...base,
      title: 'The credential is kept on another site',
      body: 'This file names the address below instead of carrying its Content Credential, and that address is on {host}. Nothing is fetched on your behalf here, so this copy has not been checked against that credential.',
      params: { host: gate.host },
    };
  }
  if (gate.kind === 'no-base') {
    return {
      ...base,
      title: 'Where the credential lives cannot be worked out here',
      body: 'This file names the address below instead of carrying its Content Credential, and it is a relative address - it only means something next to the place the file itself is served from, and a copy on your device no longer records where that was.',
    };
  }
  // `unresolvable`: an ABSOLUTE reference this page will not follow - a scheme
  // it refuses, a protocol-relative host, userinfo, or a path that normalises
  // back out of the origin. Calling any of those "a relative address" while
  // printing the absolute address underneath is a sentence the reader can see
  // is false, and it hides the actual reason the fetch was withheld.
  return {
    ...base,
    title: 'That credential address is not one this page will follow',
    body: 'This file names the address below instead of carrying its Content Credential, but that address is not one this page is willing to resolve - it points somewhere other than the plain http(s) location a credential can be fetched from. Nothing was fetched, so this copy has not been checked against it.',
  };
}

/** The section A.8 wrapper-count notice, worded from what the assertion actually
 *  selected rather than from the raw count: at extraction time more than one
 *  wrapper is a NOTICE (section A.8.4.1 hands selection to the exclusions), and only
 *  more than one MATCH is the section 15.12.1.3.1 rejection. */
function wrapperNotice(b: TextBinding): VerifyNotice {
  const n = b.wrappers ?? 0;
  if ((b.matchedWrappers ?? 0) > 1) {
    return {
      id: 'multiple-wrappers',
      tone: 'info',
      title: 'More than one hidden credential matches this text',
      body: 'This text carries {n} invisible C2PA wrappers, and the credential’s own exclusions select more than one of them. C2PA allows exactly one, so no verdict about the text can be drawn from them.',
      params: { n },
    };
  }
  if (b.selectedWrapper) {
    return {
      id: 'multiple-wrappers',
      tone: 'info',
      title: 'This text carries more than one hidden credential',
      body: 'It holds {n} invisible C2PA wrappers. The credential’s own exclusions select wrapper {k}, and that is the one checked above.',
      params: { n, k: b.selectedWrapper },
    };
  }
  return {
    id: 'multiple-wrappers',
    tone: 'info',
    title: 'This text carries more than one hidden credential',
    body: 'It holds {n} invisible C2PA wrappers. Which one binds the text is decided by the credential’s own exclusions, so this on its own is not a problem with the text.',
    params: { n },
  };
}

const STATUS_NOTICE: Record<string, { id: string; title: string; body: string }> = {
  [STATUS.htmlMultipleManifests]: {
    id: 'multiple-manifests',
    title: 'This file declares more than one credential',
    body: 'C2PA allows a file to be associated with a single manifest, so there is no way to tell which one is meant to bind these bytes. That is a problem with how the file was written or copied - nothing here says its content was changed.',
  },
  [STATUS.structuredTextMultipleReferences]: {
    id: 'multiple-manifests',
    title: 'This file declares more than one credential',
    body: 'C2PA allows a file to be associated with a single manifest, so there is no way to tell which one is meant to bind these bytes. That is a problem with how the file was written or copied - nothing here says its content was changed.',
  },
  [STATUS.structuredTextNoManifest]: {
    id: 'no-manifest-block',
    title: 'No C2PA manifest block here',
    body: 'This text contains one of the two C2PA manifest markers but not both, in order. Text that merely quotes a marker looks exactly the same, so nothing is claimed either way.',
  },
  [STATUS.structuredTextEmptyReference]: {
    id: 'empty-block',
    title: 'The credential block is empty',
    body: 'This file carries the markers that hold a C2PA manifest with nothing between them, so there is no credential to check.',
  },
  [STATUS.textCorruptedWrapper]: {
    id: 'corrupted-wrapper',
    title: 'The hidden credential did not decode',
    body: 'This text carries the invisible marker C2PA hides a manifest in, but the wrapper itself is incomplete, or of a version this reader does not know. Copying text between apps routinely drops the invisible characters it is made of.',
  },
  [STATUS.unsupportedReference]: {
    id: 'unsupported-reference',
    title: 'The credential reference is not one this page can follow',
    body: 'This file points at its credential with something other than an embedded manifest or an http(s) address, so there is nothing here that can safely be resolved.',
  },
  [STATUS.malformedBase64]: {
    id: 'malformed-base64',
    title: 'The credential could not be decoded',
    body: 'A C2PA manifest travels through text as base64, and this copy is not valid base64 - the usual cause is a truncated or re-wrapped copy rather than a changed file.',
  },
  [STATUS.htmlUnterminatedScript]: {
    id: 'unterminated-script',
    title: 'The credential element is cut off',
    body: 'The element holding this document’s credential has no closing tag, so what arrived here is a truncated copy rather than a whole document.',
  },
  [STATUS.tooLarge]: {
    id: 'too-large',
    title: 'Too large to inspect as text',
    body: 'This file is past the size limit for on-device text inspection, so its text was never searched for a credential. Nothing was checked, and nothing is claimed about it either way.',
  },
  [STATUS.credentialUnreadable]: {
    id: 'unreadable',
    title: 'The credential could not be read',
    body: 'A C2PA credential is declared here, but it could not be read at all - so there is nothing to check these bytes against.',
  },
};

/**
 * Every notice this report earns, in reading order.
 *
 * Deliberately additive to the existing verdict rendering: nothing here changes
 * a state, a check row or a scorecard pip. It says the things `state` cannot - 
 * "the credential is over there", "this is part of something longer", "the
 * invisible characters got lost in the clipboard".
 */
export function verifyTextNotices(report: VerifyReport, ctx: NoticeContext): VerifyNotice[] {
  const out: VerifyNotice[] = [];
  const b = report.textBinding;

  if (b) {
    if (b.externalManifestUsed && b.manifestUrl) {
      out.push({
        id: 'external-used',
        tone: 'info',
        title: 'Checked against a credential fetched from this site',
        body: 'The credential is not inside this file. It was fetched from the address below when you asked, and checked against these bytes - so this verdict is about this file and that credential together.',
        url: b.manifestUrl,
      });
    } else if (b.manifestUrl) {
      out.push(externalNotice(b, ctx));
    }

    if (b.status && b.status !== STATUS.textMultipleWrappers) {
      const copy = STATUS_NOTICE[b.status];
      if (copy) out.push({ ...copy, tone: 'info', ...(b.detail ? { detail: b.detail } : {}) });
    }
    // The wrapper count is worth saying whenever there IS more than one, whether
    // or not it was the reported status (the assertion may have selected one
    // cleanly, which is the good case and still worth showing).
    if ((b.wrappers ?? 0) > 1 || b.status === STATUS.textMultipleWrappers) out.push(wrapperNotice(b));

    if (b.wrappersTruncated) {
      out.push({
        id: 'wrappers-truncated',
        tone: 'info',
        title: 'More hidden wrappers than this reader will walk',
        body: 'This text carries more invisible C2PA wrappers than the reader inspects, so “no wrapper matches” can only mean “none of the first {n}” here.',
        params: { n: b.wrappers ?? 0 },
      });
    }
    if (b.fragment) {
      out.push({
        id: 'fragment',
        tone: 'info',
        title: 'This looks like a fragment of a larger signed text',
        body: 'The credential accounts for more text than this copy contains, so what you have is most likely part of a longer signed original rather than a changed version of it.',
      });
    }
    if (b.exclusionsConform === 'narrower') {
      out.push({
        id: 'exclusions-narrower',
        tone: 'info',
        title: 'The credential covers more of this file than it had to',
        body: 'Its declared exclusion sits inside the manifest block instead of covering exactly that block. That is not what the specification asks for, but it binds more of the file, not less.',
      });
    }
    if (b.exclusionsConform === 'other') {
      out.push({
        id: 'exclusions-other',
        tone: 'warn',
        title: 'Part of this file is outside its credential',
        body: 'The credential excludes bytes that are not its own manifest block, so some of what you can see here is not covered by the hash that was signed.',
      });
    }
  }

  const reserialized = reserializedNotice(report, ctx);
  if (reserialized) out.push(reserialized);
  return out;
}

/**
 * The paste-specific one: a credential whose own contents check out, over bytes
 * that no longer hash to what was signed, in a markup carrier that arrived
 * through the clipboard.
 *
 * That combination has a known innocent cause - copying out of a rendered page
 * hands you the BROWSER's serialization (attribute order, quoting, entity form,
 * whitespace), not the author's file - and "modified after signing" would be the
 * wrong sentence for it. Gated on the claim signature having VERIFIED, so this
 * never becomes a soft landing for a file whose credential is itself damaged.
 */
export function reserializedNotice(report: VerifyReport, ctx: NoticeContext): VerifyNotice | null {
  if (!ctx.pasted || !report.found) return null;
  if (!['html', 'code', 'svg'].includes(report.format ?? '')) return null;
  if (!failed(report, 'assertion.dataHash.mismatch')) return null;
  if (!passed(report, 'claimSignature.validated')) return null;
  return {
    id: 'reserialized',
    tone: 'info',
    title: 'These bytes were re-serialized on the way here',
    body: 'The credential itself checks out - its signature is valid and everything it references matches - but the pasted bytes do not hash to what was signed. Copying markup out of a rendered page gives you what the browser rewrote (quoting, attribute order, entities, whitespace), not the file the author signed. Save or download the original file and check that instead.',
  };
}

/**
 * True when the hero's flat "Modified after signing" badge would contradict a
 * note the page is about to show underneath it.
 *
 * "Modified after signing" is an INFERENCE from a hash mismatch, and it is a
 * fair one only while no better explanation is in hand. Once the page is
 * printing "these bytes were re-serialized on the way here", stamping the
 * accusation over the top of it is the page arguing with itself in favour of the
 * harsher reading. The other two badges stay - a credential IS here, and these
 * bytes are NOT the ones it hashed. Both are facts.
 */
export function suppressModifiedBadge(notes: VerifyNotice[]): boolean {
  return notes.some((n) => n.id === 'reserialized');
}

// ── section 18.28 ai-disclosure ─────────────────────────────────────────────────────

export interface AiDisclosureRow {
  /** modelName, else modelIdentifier - null when the claim disclosed neither. */
  model: string | null;
  modelType?: string;
  oversight?: string;
  domains?: string;
}

/** Every disclosure the claim made, in claim order. Empty when there is none -
 *  and absence is NOT a statement that no model was involved. */
export function aiDisclosureRows(report: VerifyReport): AiDisclosureRow[] {
  const list = report.aiDisclosures?.length ? report.aiDisclosures
    : report.aiDisclosure ? [report.aiDisclosure] : [];
  return list.map((d) => ({
    model: d.modelName?.trim() || d.modelIdentifier?.trim() || null,
    ...(d.modelType ? { modelType: d.modelType } : {}),
    ...(d.oversight ? { oversight: d.oversight } : {}),
    ...(d.scientificDomain?.length ? { domains: d.scientificDomain.join(' · ') } : {}),
  }));
}

// ── Text AI-likelihood signals (plans/125) ───────────────────────────────────
//
// The DUAL of `aiDisclosureRows` above: that reads what a credential DECLARES (an
// authoritative, signed statement); this READS THE TEXT ITSELF for signals that it
// was AI-generated. The two are meant to sit together - a declaration is stronger
// than a detection, and this panel is careful never to overstep it. A SIGNAL, never
// a verdict: the engine's `analyzeTextSignals` returns a coarse band plus findings,
// and this builds the view model. The view owns t()/escape and the copy for each
// `kind`, exactly like the notice mapping above. See [[perceptibility-is-not-a-safeguard]].

/** One finding, flattened for the view. `detail` is the engine's factual sentence
 *  (with counts) shown verbatim; `kind` is what the view maps to a localised title. */
export interface TextSignalRow {
  kind: string;
  tier: 'artifact' | 'heuristic';
  detail?: string;
}

/** A span to highlight in the analyzed text: WHERE (index/length into the same
 *  string the report was built from), its `tier` (the honest "confidence" of
 *  the signal - `artifact` is a byte-level tell, `heuristic` a softer style
 *  tell), and its `heat` (0-1 confidence temperature for the graded highlight). */
export interface TextSignalMark {
  index: number;
  length: number;
  tier: 'artifact' | 'heuristic';
  kind: string;
  heat: number;
}

/** One run of text for the highlighter: plain when `tier` is absent, else marked. */
export interface HighlightSegment {
  text: string;
  tier?: 'artifact' | 'heuristic';
  kind?: string;
  heat?: number;
}

/** Heat (0-1) → the 5-step temperature bucket the stylesheets grade (t1 = the
 *  coolest style hint, t5 = a hard artifact). Shared by the verify view and the
 *  catalog so the two highlighters never disagree on a colour. */
export function heatBucket(heat: number): 1 | 2 | 3 | 4 | 5 {
  if (heat >= 0.8) return 5;
  if (heat >= 0.6) return 4;
  if (heat >= 0.45) return 3;
  if (heat >= 0.3) return 2;
  return 1;
}

/** The verify-view model for a text AI-likelihood check. */
export interface TextSignalPanel {
  band: TextSignalBand;
  /** The granular 0-100 AI-likelihood score (the fine companion to `band`). */
  score: number;
  /** 'warn' only at the strongest band; everything softer is informational. */
  tone: 'info' | 'warn';
  /** The engine's plain, non-accusatory summary (already carries the OCR note). */
  summary: string;
  /** True when the text was read from an image: only style signals were checked. */
  pixelSourced: boolean;
  rows: TextSignalRow[];
  /** The style/fingerprint guess rationale, when one was offered. */
  guess?: string;
  /** The best-guess source (e.g. 'generic-LLM' | 'Claude' | 'ChatGPT (OpenAI)'). */
  guessFamily?: string;
  /** 'high' ONLY when a leaked model fingerprint named the source; else 'low'. */
  guessConfidence?: 'low' | 'high';
  /** Every family that scored, strongest first - "leans X over Y". */
  guessCandidates?: Array<{ family: string; strength: number }>;
  /** What the engine analysed the text AS ('code' = comments-only style tells). */
  docKind: TextSignalDocKind;
  /** The rolling-window heat map, when the text was long enough to window. */
  heatmap?: TextHeatmap;
  /** Merged, non-overlapping spans for highlighting the analyzed text. */
  marks: TextSignalMark[];
  /** The analyzed text itself, so the view can show it for inspection with the
   *  `marks` highlighted. Set by `analyzeVerifyText`; absent on a bare `textSignalPanel`. */
  text?: string;
  /** The neutral document census (engine textFacts) - the interrogation
   *  surface's raw material. Set by `analyzeVerifyText` alongside `text`. */
  facts?: TextFacts;
}

/** Flatten a report's finding spans into merged, non-overlapping marks. Overlaps
 *  keep the higher-confidence tier (`artifact` beats `heuristic`) and the HOTTEST
 *  heat - a span flagged twice shows at its strongest grade. The wide `ai-span`
 *  region is deliberately excluded: it is a REGION note the heat map already
 *  paints, and merging it here would swallow every precise mark inside it. */
function mergeMarks(report: TextSignalReport): TextSignalMark[] {
  const raw: TextSignalMark[] = [];
  for (const f of report.findings) {
    if (f.kind === 'ai-span') continue;
    for (const s of f.spans ?? []) raw.push({ index: s.index, length: s.length, tier: f.tier, kind: f.kind, heat: f.heat });
  }
  raw.sort((a, b) => a.index - b.index || (a.tier === 'artifact' ? 0 : 1) - (b.tier === 'artifact' ? 0 : 1));
  const out: TextSignalMark[] = [];
  for (const m of raw) {
    const last = out[out.length - 1];
    if (last && m.index < last.index + last.length) {
      last.length = Math.max(last.index + last.length, m.index + m.length) - last.index;
      if (m.tier === 'artifact' && last.tier !== 'artifact') { last.tier = 'artifact'; last.kind = m.kind; }
      if (m.heat > last.heat) last.heat = m.heat;
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

/** Split `text` into plain + marked segments for the highlighter. Pure; the view
 *  wraps marked segments in its own `<mark>` markup and escapes the text. */
export function buildHighlightSegments(text: string, marks: TextSignalMark[]): HighlightSegment[] {
  const segs: HighlightSegment[] = [];
  let pos = 0;
  for (const m of marks) {
    const start = Math.max(pos, m.index);
    const end = Math.min(text.length, m.index + m.length);
    if (end <= start) continue;
    if (start > pos) segs.push({ text: text.slice(pos, start) });
    segs.push({ text: text.slice(start, end), tier: m.tier, kind: m.kind, heat: m.heat });
    pos = end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

/** Report → view model. Pure; the view maps `band`/`kind` to localised copy. */
export function textSignalPanel(report: TextSignalReport): TextSignalPanel {
  return {
    band: report.band,
    score: report.score,
    tone: report.band === 'strong' ? 'warn' : 'info',
    summary: report.summary,
    pixelSourced: report.pixelSourced,
    docKind: report.docKind,
    rows: report.findings.map((f) => ({ kind: f.kind, tier: f.tier, ...(f.detail ? { detail: f.detail } : {}) })),
    ...(report.styleGuess ? {
      guess: report.styleGuess.rationale,
      guessFamily: report.styleGuess.family,
      guessConfidence: report.styleGuess.confidence,
      ...(report.styleGuess.candidates?.length ? { guessCandidates: report.styleGuess.candidates } : {}),
    } : {}),
    ...(report.heatmap ? { heatmap: report.heatmap } : {}),
    marks: mergeMarks(report),
  };
}

/** Analyse a text payload for the verify view. `source` picks the tiers:
 *  'digital' (the bytes ARE the text) runs everything; 'ocr' (read from an image)
 *  runs writing-style signals only and flags `pixelSourced`. */
export function analyzeVerifyText(text: string, source: TextSignalSource): TextSignalPanel {
  return { ...textSignalPanel(analyzeTextSignals(text, { source })), text, facts: textFacts(text) };
}

// ── The trust lamp cues (plans: illumination strip) ──────────────────────────
//
// The verify view's four-lamp summary, derived here so it is testable as data.
// Every `label`/`word`/`detail` is an ENGLISH SOURCE STRING the view passes
// through t() - the same contract as the notices above. States follow the
// guidance grammar: fact/warn/hint/unlit, where unlit is never a verdict.

export interface VerifyLampCue {
  id: 'provenance' | 'integrity' | 'origin' | 'signals';
  label: string;
  state: 'fact' | 'warn' | 'hint' | 'unlit';
  word: string;
  detail?: string;
}

export interface VerifyLampInput {
  report: VerifyReport;
  watermarkPresent?: boolean;
  sealFound?: boolean;
  sealValid?: boolean;
  /** The maker-pipeline "likely AI-generated" tier fired. */
  aiLikely?: boolean;
  panel?: TextSignalPanel;
}

/** Derive the strip. Pure; ordering is the evidence hierarchy - C2PA leads. */
export function verifyLampCues(input: VerifyLampInput): VerifyLampCue[] {
  const { report, panel } = input;

  let provenance: VerifyLampCue;
  if (report.found && report.state === 'invalid') {
    provenance = { id: 'provenance', label: 'Provenance', state: 'warn', word: 'credential problem', detail: 'A Content Credential is here but does not check out - the sections below say exactly what and why.' };
  } else if (report.madeWithLolly || report.trusted) {
    provenance = { id: 'provenance', label: 'Provenance', state: 'fact', word: 'verified', detail: 'The Content Credential verifies against a pinned trust anchor.' };
  } else if (report.found && report.state === 'valid') {
    provenance = { id: 'provenance', label: 'Provenance', state: 'fact', word: 'credential intact', detail: 'The Content Credential is intact; its signer is not one of the pinned anchors.' };
  } else if (input.sealFound && input.sealValid) {
    provenance = { id: 'provenance', label: 'Provenance', state: 'fact', word: 'SEAL verified', detail: 'A SEAL signature verifies these bytes against the signer\u2019s DNS key.' };
  } else if (input.watermarkPresent) {
    provenance = { id: 'provenance', label: 'Provenance', state: 'hint', word: 'Imprint found', detail: 'The Lolly Imprint pixel watermark is present - a durable hint, not a credential.' };
  } else {
    provenance = { id: 'provenance', label: 'Provenance', state: 'unlit', word: 'none carried', detail: 'This file carries no credential this page can read. Absence is not a verdict.' };
  }

  let integrity: VerifyLampCue;
  if (hashFailed(report)) {
    integrity = { id: 'integrity', label: 'Integrity', state: 'warn', word: 'bytes changed', detail: 'These bytes no longer hash to what the credential signed.' };
  } else if (report.found && report.state === 'valid') {
    integrity = { id: 'integrity', label: 'Integrity', state: 'fact', word: 'bytes match', detail: 'Every byte the credential covers is unchanged since signing.' };
  } else {
    integrity = { id: 'integrity', label: 'Integrity', state: 'unlit', word: 'nothing to check against', detail: 'Without a credential there is no signed hash to compare these bytes to.' };
  }

  const declared = !!report.aiGenerated || (report.aiDisclosures?.length ?? 0) > 0 || !!report.aiDisclosure;
  let origin: VerifyLampCue;
  if (declared) {
    origin = { id: 'origin', label: 'Origin', state: 'fact', word: 'AI declared', detail: 'The file itself declares AI-generated content - disclosure working as it should.' };
  } else if (input.aiLikely) {
    origin = { id: 'origin', label: 'Origin', state: 'hint', word: 'likely AI-generated', detail: 'The maker pipeline recorded in the file matches a known AI generator.' };
  } else {
    origin = { id: 'origin', label: 'Origin', state: 'unlit', word: 'not declared', detail: 'No origin declaration either way. Absence is not a verdict.' };
  }

  let signals: VerifyLampCue;
  if (!panel) {
    signals = { id: 'signals', label: 'Content signals', state: 'unlit', word: 'no text analysed', detail: 'Use the Read-the-text action to analyse any words this file carries.' };
  } else {
    const severe = (panel.facts?.hidden ?? []).some((h) => h.severity === 'severe');
    const artifact = panel.rows.some((r) => r.tier === 'artifact');
    if (severe || artifact) {
      signals = { id: 'signals', label: 'Content signals', state: 'warn', word: 'hard evidence', detail: 'Byte-level artifacts were found - the analysis section names each one.' };
    } else if (panel.band !== 'none') {
      signals = { id: 'signals', label: 'Content signals', state: 'hint', word: 'signals found', detail: 'Writing-style signals were found. Signals are graded evidence, never proof.' };
    } else {
      signals = { id: 'signals', label: 'Content signals', state: 'fact', word: 'none found', detail: 'The analysis found no signals. Clean text can be either human or AI.' };
    }
  }

  return [provenance, integrity, origin, signals];
}
