// SPDX-License-Identifier: MPL-2.0
/**
 * /valid - on-device Content Credentials check.
 *
 * Drop any stamped export (pdf, png/apng, jpg, gif, svg, tiff, webp, mp4,
 * webm, mp3, wav) and the engine verifier (engine/src/c2pa-verify.js) re-checks the
 * credential the export pipeline embeds: assertion hashed-URIs, the COSE claim
 * signature, the certificate window and the hard binding. Nothing leaves the
 * device. When a Lolly CA root is pinned (src/ca-root.js) it is passed as a
 * trust anchor, so a signing chain that verifies against it upgrades the
 * result to a CA-verified identity - "signed by <email>"; otherwise a green
 * result means "the file is exactly what its credential signed" - integrity,
 * not identity. Check codes mirror c2patool /
 * verify.contentauthenticity.org so the two reports read side-by-side.
 *
 * The headline answer is the one users actually ask for: was this genuinely
 * made with Lolly? When the credential is intact AND records Lolly, the hero
 * flips to the "Made with Lolly" callout and surfaces the export context the
 * writer recorded (tool, author from the profile, browser engine, OS).
 *
 * Shares the platform/capabilities `.plat-*` chrome so it reads as a sibling
 * dashboard; the CLI exposes the same engine verifier as `validate <file>`.
 */

import '../styles/parts/valid.css';   // async CSS chunk (lazy view - not on the landing)
import '../styles/parts/valid-report.css';
import { verifyC2pa, verifySeal, pemToDer, c2paTrustAnchors, extractFileMetadata, appendedIsExpected, stripMetadata, detectWatermark, detectWatermarkSearch, analyzeLsb, isPptx, pptxMediaImages, evaluateReuse, licenceDisplayName, normaliseLicence, rightsReportFromC2pa } from '@lolly/engine';
import type { FileMetadata, StripFormat, SealVerifyResult } from '@lolly/engine';
import type { CreativeOperationV1, CreativeUseRoleV1, DeliveryRouteV1 } from '@lolly-tools/core/rights-v1';
import { looksLikePptxFile, inflatePptx, PPTX_MIME } from '../bridge/pptx.ts';
// The docx sniff only (a name/type test plus its MIME). The reader itself is loaded
// lazily where it is used, so a drop that is not a Word file never pays for it.
import { looksLikeDocxFile, DOCX_MIME } from '../lib/office-text.ts';
import { contextCardsHtml, journeyEvidenceLabel } from './valid-context.ts';
import { readVerifyMetadata } from './valid-read-metadata.ts';
import { renderMetadata } from './valid-metadata.ts';
import { vendorMark } from './valid-vendors.ts';
import { checkingHtml, updateVerifyProgress } from './valid-progress.ts';
import { CA_ROOT_PEM } from '../ca-root.ts';
import { escape } from '../utils.ts';
import { textSignalLabels } from './valid-text-labels.ts';
import { wireTextHandoffs } from '../lib/text-handoff.ts';
// Aliased (not `icon`) - this file has function parameters named `icon` (fact(),
// the change-history `section` builder) that would otherwise shadow the import.
import { icon as glyph, type IconName } from '../lib/icons.ts';
import { t, tRaw } from '../i18n.ts';
// The WP-F async-job foundation: the watermark work is heavy and long, so it runs
// as a registered job with the global toast owning progress and cancel, rather
// than as an in-view bar that dies with the view. See the deep-scan job section below.
import { startJob, type JobHandle } from '../lib/jobs.ts';
import { announce } from '../a11y.ts';
import { armViewEnter } from '../view-enter.ts';
import { playSfx } from '../lib/sfx.ts';
import { prepareAssetForVerify, takePendingVerify } from '../lib/verify-handoff.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
// The pure verdict/scorecard model - no DOM, no CSS import, so it's importable (and
// tested) standalone. See valid-verdict.ts's header for why this lives apart from the
// rendering below.
import {isExpectedRow, pipStatusWord, scorecardModel, resolveState, sourceTypeLabel,
  stateTone, STATE_COPY, hashFailed, rightsReportOf, rightsSourceReport,
} from './valid-verdict.ts';
import type { Check, SignerIdentity, Signer, Claim, VerifyReport, Watermark, ScorecardItem } from './valid-verdict.ts';
import { provenanceOverviewHtml, provenanceSummaryHtml } from './valid-provenance.ts';
import { pdfPreviewFor, pdfPageCountFor, mediaPreviewHtml, wireVerifyPreviews, type VerifyPreview as Preview } from './valid-preview.ts';
import { softwareName } from '@lolly/engine';
import { auxiliaryMetadataHtml } from './valid-auxiliary.ts';
import { metadataValueHtml, metadataLinkHtml, metadataUrl, wireMetadataLinks, visibleLinkedTextHtml } from './valid-links.ts';
import { wireVerifyActions } from './valid-actions.ts';
import { wireAddressRequests } from './valid-location.ts';
import { saveReportCard } from './valid-report-card.ts';
// The C2PA 2.4 text-binding models - same pure-module rule as valid-verdict.ts.
// The copy for every carrier state, the snippet cap, and the ONE url gate both
// the paste path and the external-manifest fetch go through, all testable
// without a browser (valid-text.test.ts).
import {
  TEXT_FORMAT_LABEL, formatLabel, pastedFileName, textSnippet, classifyUrl, classifyPastedUrl,
  verifyTextNotices, suppressModifiedBadge, aiDisclosureRows, analyzeVerifyText, buildHighlightSegments, heatBucket,
} from './valid-text.ts';
import type { VerifyNotice, NoticeContext, TextSignalPanel, TextSignalMark } from './valid-text.ts';
// The shared "Reworded with Lolly" note (lib/wm-note.ts): a hidden slot in the
// text-signals panel plus a queued post-render check, filled only on a
// reword-watermark detection. The catalog's Analyse-text panel renders the
// identical note through the same module.
import { wmNoteSlot } from '../lib/wm-note.ts';
// The on-device model tier's shared seam (plans/126 WP-A): consent line,
// estimate row and honesty copy for the classifier check, re-rendering this
// panel through its own builder on a conclusive estimate.
import { aiModelSlot } from './tsig-model-note.ts';
// The Document facts census section (shared with the catalog panel).
import { tsigFactsHtml } from './tsig-facts.ts';
import { scannedUnreadNote, type DocReadNotes } from './doc-read.ts';
// The illumination strip + the completeness receipt (pure models; the strip
// renders through this view's existing reviewed sinks).
import { verifyLampCues } from './valid-text.ts';
import { lampStripHtml, wireLampScroll, type TrustLamp } from './trust-lamps.ts';
import { verifyReceiptModel, receiptCounts, type ReceiptInput } from './valid-receipt.ts';
import { aiDetectAvailable } from '../lib/ai-detect.ts';
import { rewordAvailable } from '../lib/reworder.ts';
// Deep engine import, NOT the `@lolly/engine` barrel - the beam-pack.ts:125
// precedent: index.ts does not re-export the c2pa-extract surface, and widening
// that one shared facade for a single lazy view is what the bundle budget is
// there to prevent. `sniffFormat` names a PASTED payload's file (pasted.html /
// pasted.txt); the verification itself always re-sniffs the bytes.
import { sniffFormat } from '../../../../engine/src/c2pa-extract.ts';
import { appendScoreToggle } from './valid-score-toggle.ts';

// Trust anchors: the pinned Lolly CA root (identity for Lolly-signed assets)
// plus the vendored C2PA trust list (Google/Gemini, the camera makers, Bria,
// …), so a credential from a recognised signer upgrades from "valid" to a
// named, CA-verified identity - "signed by <issuer>". A self-signed on-device
// export still reads as intact-but-untrusted (it chains to none of these).
const VERIFY_OPTS: { trustAnchors: Uint8Array[] } = {
  trustAnchors: [
    ...(CA_ROOT_PEM ? [pemToDer(CA_ROOT_PEM)] : []),
    ...c2paTrustAnchors(),
  ],
};

// Verification reads the WHOLE file into memory (and the PDF extractor makes a
// byte-transparent string copy on top), so bound what a drop can pull in. Far
// above any real credentialed asset; a multi-GB drop must fail with a message,
// not an OOM'd tab.
const MAX_VERIFY_BYTES = 256 * 1024 * 1024;

// Path data for all of these (including 'shield'/'chevronDown' below) lives in
// lib/icons.ts - the shared registry (see plans/76-component-audit.md rec 5).
// 'globe', 'calendar', 'package' and 'image' are deduped there against
// near-identical glyphs from catalog-summary.ts/category-icons.ts/profile.ts.
const ICON_SHIELD = glyph('shield');
const ICON_CHEVRON = glyph('chevronDown');

// Supported inputs as glanceable category chips (label to scan, exact formats on
// hover) - the same "prompt above, formats subordinate" hierarchy as the catalogue
// drop area (lib/upload-dropzone.ts), rather than a run-on `·`-separated sentence.
const VERIFY_FORMAT_GROUPS: ReadonlyArray<{ label: string; formats: string }> = [
  { label: 'Images', formats: 'PNG, APNG, JPG, GIF, SVG, TIFF, WEBP, AVIF' },
  { label: 'Documents', formats: 'PDF, PowerPoint, Word' },
  { label: 'Audio', formats: 'MP3, WAV, M4A, OGG, OPUS' },
  { label: 'Video', formats: 'MP4, WEBM, MOV, MKV' },
  { label: 'Text & code', formats: 'HTML, Markdown, JS, CSS, TXT' },
];
const verifyFormatChips = (): string =>
  VERIFY_FORMAT_GROUPS
    .map((g) => `<span class="valid-drop-chip" title="${escape(t(g.formats))}">${escape(t(g.label))}</span>`)
    .join('');

// Small line icons, wrapped consistently - shared by the hero check scorecard
// and the per-fact <dt> labels. /valid's icons are a hair thinner (1.9) than
// the registry default (2).
const svgIcon = (name: IconName): string => glyph(name, { strokeWidth: 1.9 });

// One scorecard pip's markup - factored out of scorecardHtml so the
// deep-scan click handler (mountValid) can append a freshly-found TrustMark
// pip to a LIVE `<ul class="valid-score">` after the fact, using the exact
// same template rather than re-rendering (and losing scroll/expand state)
// on the whole report.
function scorecardPipHtml(it: ScorecardItem, i: number): string {
  return `<li class="valid-score-pip is-${it.status}${it.ash ? ' is-ash' : ''}" style="--i:${i}" aria-label="${escape(it.label)}${it.hideStatus ? '' : `: ${escape(pipStatusWord(it))}`}">` +
      `<span class="valid-score-ic" aria-hidden="true">${svgIcon(it.icon)}</span>` +
      `<span class="valid-score-label" aria-hidden="true">${escape(it.label)}</span>` +
      (it.hideStatus ? '' : `<span class="valid-score-status" aria-hidden="true">${escape(pipStatusWord(it))}</span>`) +
    `</li>`;
}

// The compact, icon-only pip the mini scorecard uses in a collapsed report row.
// Shared by miniScoreHtml and injectDeepScanPip so a passively-found deep-scan
// pip matches the rest of the mini row exactly.
function miniScorePipHtml(it: ScorecardItem): string {
  return `<li class="valid-score-pip is-${it.status}${it.ash ? ' is-ash' : ''}" title="${escape(it.label)}${it.hideStatus ? '' : `: ${escape(pipStatusWord(it))}`}"><span class="valid-score-ic">${svgIcon(it.icon)}</span></li>`;
}

function scorecardHtml(report: VerifyReport, watermark?: Watermark, extra?: ScorecardItem[]): string {
  const items = scorecardModel(report, watermark, extra);
  const priority: IconName[] = ['hash', 'pen', 'userCheck', 'cpu', 'clock'];
  const rank = (item: ScorecardItem): number => item.status === 'fail' ? -1 : priority.includes(item.icon) ? priority.indexOf(item.icon) : 10;
  items.sort((a, b) => rank(a) - rank(b));
  const more = items.length > 4
    ? `<button type="button" class="valid-score-more" data-score-toggle data-score-count="${items.length}" aria-expanded="false">${t('Show all {n} checks', { n: items.length })}</button>`
    : '';
  return `<div class="valid-score-wrap"><ul class="valid-score" aria-label="${escape(t('Verification checks at a glance'))}">${items.map(scorecardPipHtml).join('')}</ul>${more}</div>`;
}

// Key findings lead the report; technical evidence starts collapsed at every size.
const disclosureOpenAttr = (): string => '';

function checkRow(c: Check, i = 0): string {
  const cls = c.ok ? 'ok' : isExpectedRow(c) ? 'info' : 'bad';
  const mark = c.ok ? '✓' : isExpectedRow(c) ? 'ℹ' : '✕';
  return `
    <li class="valid-check valid-check--${cls}" style="--i:${i}">
      <span class="valid-check-mark" aria-hidden="true">${mark}</span>
      <span class="valid-check-text"><code>${escape(c.code)}</code><span>${escape(c.explanation)}</span></span>
    </li>`;
}

function fact(label: string, value: unknown, icon: IconName): string {
  if (value == null || value === '') return '';
  return `<div class="valid-fact"><dt><span class="valid-fact-ic" aria-hidden="true">${svgIcon(icon)}</span><span>${escape(label)}</span></dt><dd>${escape(String(value))}</dd></div>`;
}

// The scalar-input digest recorded by the writer's tools.lolly.export assertion
// (env.inputs) - "what this was made from": the colours, sizes, toggles and short
// text the tool rendered with. Boxed as its own panel (matching change-history/
// assertion-log) and placed ABOVE change history so an inspected asset tells its
// "what it's made from" story before its "what happened to it" story. Empty in →
// nothing rendered (so panelsBlock silently drops this column when there's no digest).
// `recreate` (the /verify path only - the catalog/gallery callers pass none) adds
// the "Recreate with these settings" CTA: the anchor's plain href opens a blank
// session as the fallback; mountValid's delegated [data-recreate] handler upgrades
// the click into a digest-seeded link (lib/seed-url.ts). Settings-honest wording:
// the digest is scalar-only, so this reopens the recorded settings, not a clone.
export function inputsDigestHtml(
  inputs: Record<string, string> | undefined,
  recreate?: { toolId: string; toolName: string; fileIndex: number },
  /** The recorded tool NAME when it did not resolve against this build's index
   *  (plans/143 V1): a verified Lolly file opened on another instance still gets
   *  a door - an honest line plus the gallery - instead of a silent dead end at
   *  the exact moment the file has made someone curious. */
  missingTool?: string,
): string {
  const entries = inputs ? Object.entries(inputs).filter(([, v]) => v != null && v !== '') : [];
  if (!entries.length) return '';
  const isColor = (v: string): boolean => /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());
  const rows = entries.map(([k, v]) => {
    const sw = isColor(v) ? `<span class="valid-input-swatch" style="background:${escape(v)}" aria-hidden="true"></span>` : '';
    return `<div class="valid-input-row"><dt>${escape(k)}</dt><dd>${sw}<span>${escape(v)}</span></dd></div>`;
  }).join('');
  const cta = recreate ? `
      <a class="btn valid-recreate" href="#/tool/${escape(recreate.toolId)}"
         data-recreate="${recreate.fileIndex}" data-recreate-tool="${escape(recreate.toolId)}">${t('Recreate with these settings in {tool}', { tool: recreate.toolName })}</a>` : missingTool ? `
      <p class="valid-recreate-absent">${t('Made with the {tool} tool, which is not in this catalogue.', { tool: missingTool })}</p>
      <a class="btn valid-recreate" href="/">${t('Explore the tools here')}</a>` : '';
  return `
    <div class="valid-inputs valid-panel">
      <h3>${svgIcon('sparkle')}<span>${t('Made from')}</span></h3>
      <dl class="valid-input-list">${rows}</dl>${cta}
    </div>`;
}

// ── Script (a synthetic-voice step's recorded text) ─────────────────────────
// A recorded action whose `parameters` carry a `script` string is a generated
// voice declaring its exact source text - the machine-readable Article 50 mark
// a TTS clip's credential writes at creation (views/script-audio.ts), riding
// ingredient chains into composed exports. Surfaced as its own panel: the
// script plus the voice/model/lang recipe, so anyone holding the file can read
// what was said and recreate the clip in another voice or language. Collapsed
// beyond ~6 lines ([data-script-expand]); [data-script-copy] copies the text.
// The parameters value is raw CBOR (a Map from our decoder) or a plain object
// from a foreign report - read both, strings only, everything escape()d.
const paramRecord = (p: unknown): Record<string, unknown> | null => {
  if (p instanceof Map) {
    const o: Record<string, unknown> = {};
    for (const [k, v] of p) if (typeof k === 'string') o[k] = v;
    return o;
  }
  return p && typeof p === 'object' ? p as Record<string, unknown> : null;
};
export function scriptHtml(report: VerifyReport): string {
  const acts: Array<{ parameters?: unknown }> = report.history?.length ? report.history : (report.claim?.actions ?? []);
  const params = acts.map((a) => paramRecord(a.parameters)).find((p) => typeof p?.script === 'string' && (p.script as string).trim());
  if (!params) return '';
  const script = String(params.script);
  const recipe: Array<[string, unknown]> = [
    [t('Voice'), params.voice], [t('Model'), params.model], [t('Language'), params.lang],
  ];
  const rows = recipe.filter(([, v]) => typeof v === 'string' && v)
    .map(([k, v]) => `<div class="valid-input-row"><dt>${escape(k)}</dt><dd><span>${escape(String(v))}</span></dd></div>`).join('');
  // Clamp long scripts: the expand button only exists when there is something
  // hidden to reveal (>6 source lines or enough text to wrap well past them).
  const long = script.split('\n').length > 6 || script.length > 420;
  return `
    <div class="valid-script valid-panel">
      <h3>${svgIcon('mic')}<span>${t('Script')}</span></h3>
      <p class="valid-script-note guide-fact">${t('The voice is AI-generated. The credential records the exact script it was synthesized from.')}</p>
      ${rows ? `<dl class="valid-input-list">${rows}</dl>` : ''}
      <pre class="valid-script-text${long ? ' is-clamped' : ''}" data-script-text>${escape(script)}</pre>
      <div class="valid-script-actions">
        ${long ? `<button type="button" class="valid-clean-link" data-script-expand aria-expanded="false">${t('Show the full script')}</button>` : ''}
        <button type="button" class="valid-clean-link" data-script-copy>${t('Copy script')}</button>
      </div>
    </div>`;
}

// "Recreate in <tool>": env.tool records the tool's display NAME (the id only as
// a fallback - engine/src/metadata.ts), and in whatever language the EXPORTER ran;
// resolve it back to a live tool id against the loaded tool index by matching id,
// name, and every i18n sidecar name, case-insensitively. No index yet, or no match
// (a retired or foreign tool) → undefined and the CTA simply isn't offered.
function resolveRecreateTool(recorded: unknown, recordedId?: unknown): { toolId: string; toolName: string } | undefined {
  const tools = window.__toolIndex?.tools ?? [];
  // Engine 1.157+ records the manifest id beside the name: an exact id match wins
  // outright, so two tools sharing a display name (or a renamed tool) reopen the
  // one that actually made the file. Older records fall through to the name match.
  const id = typeof recordedId === 'string' ? recordedId.trim() : '';
  if (id) {
    const hit = tools.find((tool) => tool.id === id);
    if (hit) return { toolId: hit.id, toolName: typeof hit.name === 'string' && hit.name ? hit.name : hit.id };
  }
  const wanted = typeof recorded === 'string' ? recorded.trim().toLowerCase() : '';
  if (!wanted) return undefined;
  for (const tool of tools) {
    const i18nNames = Object.values((tool.i18n ?? {}) as Record<string, { name?: unknown } | undefined>).map((o) => o?.name);
    const names = [tool.id, tool.name, ...i18nNames];
    if (names.some((n) => typeof n === 'string' && n.trim().toLowerCase() === wanted)) {
      return { toolId: tool.id, toolName: typeof tool.name === 'string' && tool.name ? tool.name : tool.id };
    }
  }
  return undefined;
}

// The "checked on this device" footnote, wrapped as a professional callout: a
// lock chip (privacy - nothing left the device) beside the explanatory prose.
const deviceNote = (inner: string): string =>
  `<div class="valid-note">
    <span class="valid-note-ic" aria-hidden="true">${svgIcon('lock')}</span>
    <p class="valid-note-body">${inner}</p>
  </div>`;

// "You made this here" - the checked bytes hash-match an entry in this device's
// own export history (lib/export-history.ts contentHash), so beyond anything the
// credential claims we KNOW this exact file left this browser, and can reopen the
// tool with the exact state it was downloaded with (the entry's reopen query).
// Local knowledge only - independent of (and shown regardless of) the C2PA verdict.
interface LocalExportMatch { href: string; at: number }
const mineNote = (mine: LocalExportMatch): string =>
  `<div class="valid-note valid-note--mine">
    <span class="valid-note-ic" aria-hidden="true">${svgIcon('userCheck')}</span>
    ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - exportReopenHref() builds a fixed '#/tool/<id>' hash route from this device's own export history */ ''}
    <p class="valid-note-body">${t('<strong>You made this here.</strong> This exact file matches one you exported on this device ({when}).', { when: fmtDate(mine.at) })} <a href="${escape(mine.href)}">${t('Reopen it exactly as it was')}</a></p>
  </div>`;

const fmtDate = (iso: unknown): string => {
  const d = new Date(iso as string | number | Date);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// Icon-only mirror of the hero scorecard for the collapsed summary - the "highlights
// showing when collapsed". Same eight pips, same colour = state, label as a tooltip.
function miniScoreHtml(report: VerifyReport, watermark?: Watermark, extra?: ScorecardItem[]): string {
  if (!report.found && !watermark?.present && !extra?.length) return '';
  return `<ul class="valid-score valid-score--mini" aria-hidden="true">${scorecardModel(report, watermark, extra).map(miniScorePipHtml).join('')}</ul>`;
}

// The strongest POSITIVE signal to lead the summary badge / hero verdict with
// when a file carries NO C2PA credential: an exact local-export match ("Made on
// this device") or a detected Lolly Imprint. A bare "No Content Credentials"
// reads at a glance as "nothing here" and buries these - so surface the real
// signal instead. Returns null when a credential exists (its own verdict leads)
// or there is nothing positive to show.
function noCredentialSignal(report: VerifyReport, watermark?: Watermark, mine?: LocalExportMatch): string | null {
  if (report.found) return null;               // a C2PA credential exists → its verdict leads
  if (mine) return t('Made on this device');   // exact byte-match to a local export - the strongest signal
  if (watermark?.present) return t('Lolly Imprint');
  return null;
}

// The format chip beside a filename. The three C2PA 2.4 text bindings are said
// in words - 'code' is "an section A.9 manifest delimiter appeared in this text", and
// printing the token raw read as a claim about the file's LANGUAGE that the
// sniffer never made. Every other format keeps its own token, exactly as before,
// and both the collapsed summary and the full report use this one function so
// they cannot drift.
const formatChip = (format: string | null): string => {
  if (!format) return '';
  const label = TEXT_FORMAT_LABEL[format] ? t(formatLabel(format)) : format;
  return ` <span class="valid-fmt">${escape(label)}</span>`;
};

function summaryInner(fileName: string, report: VerifyReport, meta?: FileMetadata, watermark?: Watermark, seal?: SealVerifyResult, mine?: LocalExportMatch): string {
  const { state, identity } = resolveState(report);
  // Attribution chip: OIDC email for a device credential, else the CA signer's
  // organisation (Google, Adobe…). Only when the chain reached a pinned anchor.
  const who = identity ? (identity.email || report.signer?.organization || report.signer?.commonName) : null;
  const tone = stateTone(report);
  const signal = noCredentialSignal(report, watermark, mine);
  const lead = signal
    ? `<span class="valid-item-maker is-lolly" title="${escape(signal)}">${escape(signal)}</span>`
    : `<span class="valid-item-badge is-${tone}">${escape(t(state.title))}</span>`;
  const aiDecl = report.aiGenerated ? t('Content Credential declares AI-generated content')
    : meta?.ai ? t('Embedded metadata declares AI-generated content') : null;
  // The fingerprint tier gets its own softer chip ("AI?"): the container merely
  // matches an AI pipeline's packaging - nothing in the file declares anything.
  const aiHint = !aiDecl && meta?.producer?.signature === 'ai-download'
    ? tRaw('Container matches {vendor}’s AI delivery packaging - a maker fingerprint, not a declaration', { vendor: meta.producer.vendor }) : null;
  const { origin, makerHint } = deriveAi(report, meta);
  const isVideo = PREVIEW_VID.has((report.format || fileName.split('.').pop() || '').toLowerCase());
  return `
    ${lead}
    ${provenanceSummaryHtml(report, meta)}
    ${aiDecl ? `<span class="valid-item-ai" title="${escape(aiDecl)}">${svgIcon('aiSpark')}<span>${t('AI')}</span></span>` : ''}
    ${aiHint ? `<span class="valid-item-ai is-likely" title="${escape(aiHint)}">${svgIcon('aiSpark')}<span>${t('AI?')}</span></span>` : ''}
    <span class="valid-item-name">${escape(fileName)}${formatChip(report.format)}</span>
    ${who ? `<span class="valid-item-signer" title="${escape(tRaw('Signed by {who}', { who }))}">${svgIcon('mail')}<span>${escape(who)}</span></span>` : ''}
    ${miniScoreHtml(report, watermark, [...extraPips(origin, makerHint, isVideo, meta), ...(sealPip(seal) ? [sealPip(seal)!] : [])])}
    <span class="valid-item-chev" aria-hidden="true">${ICON_CHEVRON}</span>`;
}

// ── AI-generated flag ───────────────────────────────────────────────────────
// The loudest marker on the page: when the file declares its pixels came from
// a trained model, we report it in a purple, animated, unmissable banner. Two
// declaration sources, two strengths of claim: a signed C2PA assertion
// (report.aiGenerated), or the bare IPTC DigitalSourceType tag in the file's
// embedded metadata (meta.ai) - the sidecar flag Gemini/Imagen, Midjourney and
// Meta AI write alongside their invisible pixel watermarks. Either way the
// banner also points at the invisible-watermark layer (SynthID, Video Seal…)
// that we canNOT read on-device - declared honestly instead of over-claimed.
interface AiOrigin {
  kind: 'generated' | 'composite';
  via: 'credential' | 'metadata' | 'fingerprint';
  credit?: string;
  /** fingerprint only: the engine's detection constants for the copy params. */
  vendor?: string;
  products?: string;
}
const AI_FLAG_COPY = {
  credential: {
    generated: {
      title: 'AI-generated content',
      sub: 'This file’s Content Credential declares it was generated by AI - produced by a trained algorithmic model, not captured or hand-made.',
    },
    composite: {
      title: 'Contains AI-generated content',
      sub: 'This file’s Content Credential declares AI-generated elements were composited in - part of it was produced by a trained algorithmic model.',
    },
  },
  metadata: {
    generated: {
      title: 'AI-generated content',
      sub: 'This file’s embedded metadata declares it was generated by AI - the IPTC “digital source type” tag its generator wrote next to the pixels. The tag is genuine when present but trivially stripped, so its absence never proves the opposite.',
    },
    composite: {
      title: 'Contains AI-generated content',
      sub: 'This file’s embedded metadata declares AI-generated elements were composited in - a tag written by the editing tool, and easily stripped.',
    },
  },
  // The weakest of the three claims, worded to match: nothing in the file SAYS
  // it is AI-made. Its container carries the same maker markers the vendor's
  // AI products write on the files they deliver - a pipeline fingerprint that
  // other services from the same vendor can also leave.
  // {vendor}/{products} come from the engine's own detection table (literal
  // constants like "Google" / "Gemini or Veo"), never from file bytes.
  fingerprint: {
    generated: {
      title: 'Likely AI-generated',
      sub: 'This file carries no credential and no AI declaration, but its container matches the packaging {vendor}’s AI tools write on the files they deliver - most likely {products}. That is a fingerprint of the maker’s pipeline, not a statement by it: other {vendor} services can package a file the same way.',
    },
    composite: {
      title: 'Likely AI-generated',
      sub: 'This file carries no credential and no AI declaration, but its container matches the packaging {vendor}’s AI tools write on the files they deliver - most likely {products}. That is a fingerprint of the maker’s pipeline, not a statement by it: other {vendor} services can package a file the same way.',
    },
  },
};
// Matches the makers whose AI output carries Google's SynthID pixel watermark
// (Gemini/Imagen/Veo - and "Nano Banana", Gemini's image-model brand).
const SYNTHID_MAKERS = /google|gemini|imagen|veo|nano.?banana/i;
function aiFlagHtml(origin: AiOrigin | undefined, makerHint = '', isAudio = false): string {
  if (!origin) return '';
  const c = AI_FLAG_COPY[origin.via][origin.kind];
  const likely = origin.via === 'fingerprint';
  // The fingerprint sub is parameterised on the engine's own detection
  // constants ("Google" / "Gemini or Veo") - t() escapes its params and returns
  // markup-ready text, so it is injected as-is; the static subs keep escape().
  const sub = likely ? t(c.sub, { vendor: origin.vendor ?? '', products: origin.products ?? '' }) : escape(t(c.sub));
  // The invisible-watermark layer: Google (and partners) stamp SynthID into the
  // signal itself - pixels for stills/video, the waveform for audio. We can't
  // read it on-device, so we just share what's likely - we don't route users to
  // a maker's proprietary detector or make excuses for what we can't do.
  const note = SYNTHID_MAKERS.test(`${origin.credit ?? ''} ${makerHint}`)
    ? (isAudio
      ? t('Google’s AI models also stamp an invisible <strong>SynthID</strong> watermark into the audio signal itself, so this file very likely carries one - it survives re-encoding and metadata stripping.')
      : t('Google’s AI models also stamp an invisible <strong>SynthID</strong> watermark into the pixels themselves, so this file very likely carries one - it survives even when this label is stripped.'))
    : t('Large AI generators also typically stamp an invisible watermark into the pixels themselves (Google’s SynthID - also adopted by OpenAI - or Meta’s Video Seal), which survives metadata stripping.');
  return `
    <div class="valid-ai-flag${likely ? ' valid-ai-flag--likely' : ''}" role="alert">
      <span class="valid-ai-flag-ic" aria-hidden="true">${svgIcon('aiSpark')}</span>
      <span class="valid-ai-flag-text">
        <strong>${escape(t(c.title))}</strong>
        <span>${sub}</span>
        ${origin.credit ? `<span class="valid-ai-flag-credit">“${escape(origin.credit)}”</span>` : ''}
        <span class="valid-ai-flag-note">${note}</span>
      </span>
      <span class="valid-ai-flag-tag" aria-hidden="true">${likely ? t('AI?') : t('AI')}</span>
    </div>`;
}

// ── C2PA 2.4 text-binding notes ──────────────────────────────────────────────
// The sentences `state` cannot say. Every one of them is resolved in the pure
// module (valid-text.ts) - this only paints. Two escaping rules hold here:
// `t(source, params)` ESCAPES its params and returns markup-ready text, so it is
// injected as-is (double-escaping would show `&amp;lt;` to the reader); anything
// that came out of the checked FILE - the engine's `detail`, the credential's own
// URL - is escape()'d at the point of use and never linkified. A reference
// inside an untrusted document is a claim about where its credential lives, not
// somewhere this page invites a click.
const NOTE_ICON: Record<string, IconName> = {
  'manifest-elsewhere': 'link',
  'external-used': 'link',
  fragment: 'scissors',
  'multiple-wrappers': 'layers',
  'multiple-manifests': 'layers',
  'no-manifest-block': 'info',
  'empty-block': 'info',
  'corrupted-wrapper': 'info',
  'unsupported-reference': 'lock',
  'malformed-base64': 'info',
  'unterminated-script': 'scissors',
  'too-large': 'info',
  unreadable: 'eye',
  'wrappers-truncated': 'layers',
  'exclusions-narrower': 'hash',
  'exclusions-other': 'alert',
  reserialized: 'convert',
};
function noteHtml(n: VerifyNotice, fileIndex: number): string {
  return `
    <div class="valid-note valid-note--${n.tone}" role="note" data-note="${escape(n.id)}">
      <span class="valid-note-ic" aria-hidden="true">${svgIcon(NOTE_ICON[n.id] ?? 'info')}</span>
      <div class="valid-note-text">
        <strong>${t(n.title)}</strong>
        <span>${t(n.body, n.params)}</span>
        ${n.url ? `<code class="valid-note-url">${escape(n.url)}</code>` : ''}
        ${n.detail ? `<span class="valid-note-detail">${escape(n.detail)}</span>` : ''}
      </div>
      ${n.fetchPath
    ? `<button type="button" class="btn valid-note-action" data-fetch-manifest="${fileIndex}" data-manifest-path="${escape(n.fetchPath)}">${t('Fetch and check')}</button>`
    : ''}
    </div>`;
}
function notesHtml(notes: VerifyNotice[], fileIndex: number): string {
  return notes.length ? `<div class="valid-notes">${notes.map((n) => noteHtml(n, fileIndex)).join('')}</div>` : '';
}

// ── section 18.28 ai-disclosure ─────────────────────────────────────────────────────
// CLAIM CONTENT, not a detection: the signer wrote down which model made this.
// Worded as the declaration it is ("declares…"), attributed to whoever signed - 
// which is the same posture as the selfnote line under the credential facts, and
// the reason this never borrows the aiFlag's red-alert framing. It rides the
// shared violet (--vf-ai-*, the GEN-AI pill family) because it IS the same
// subject, and appears for EVERY format, not only the text bindings.
function aiDisclosureHtml(report: VerifyReport, identity: SignerIdentity | undefined): string {
  const rows = aiDisclosureRows(report);
  if (!rows.length) return '';
  const body = rows.map((r) => `
        <li class="valid-aidecl-row">
          <span class="valid-aidecl-model">${r.model
    ? tRaw('Declares it was generated by <strong>{model}</strong>', { model: escape(r.model) })
    : t('Declares AI involvement without naming a model')}</span>
          ${r.modelType ? `<span class="valid-aidecl-fact">${t('Model type: {type}', { type: r.modelType })}</span>` : ''}
          ${r.oversight ? `<span class="valid-aidecl-fact">${t('Human oversight, as declared: {level}', { level: r.oversight })}</span>` : ''}
          ${r.domains ? `<span class="valid-aidecl-fact">${t('Scientific domain: {domains}', { domains: r.domains })}</span>` : ''}
        </li>`).join('');
  return `
    <div class="valid-aidecl" role="note">
      <span class="valid-aidecl-ic" aria-hidden="true">${svgIcon('aiSpark')}</span>
      <div class="valid-aidecl-text">
        <strong>${rows.length > 1 ? t('AI disclosures in this credential') : t('AI disclosure in this credential')}</strong>
        <ul class="valid-aidecl-list">${body}</ul>
        <span class="valid-aidecl-note">${identity
    ? t('A declaration recorded in the credential, made by its CA-verified signer. It says what the signer says was used - it is not a detection.')
    : t('A declaration recorded in the credential, self-asserted by whoever signed it. It says what the signer says was used - it is not a detection, and its absence from a file proves nothing either way.')}</span>
      </div>
      <span class="valid-aidecl-tag" aria-hidden="true">${t('AI')}</span>
    </div>`;
}

// ── Text AI-likelihood signals (plans/125) ───────────────────────────────────
// The DETECTION counterpart to aiDisclosureHtml's DECLARATION: it reads the text
// itself for signals it was AI-generated. A SIGNAL, never a verdict - so the band
// heading is hedged, the summary carries "This is not proof", and the strongest
// band is a soft 'warn', never a red failure. Reuses the GEN-AI pill panel family
// (valid-aidecl-*) it sits beside, so it needs no new stylesheet. Rendered only
// for a TEXT payload; a declaration in the credential (above) always outranks it.
const TSIG_KIND_TITLE: Record<string, string> = {
  'model-fingerprint': 'Model fingerprint',
  'invisible-char': 'Invisible characters',
  'tag-chars': 'Hidden tag characters',
  'variation-selectors': 'Unusual variation selectors',
  'bidi-override': 'Bidirectional override characters',
  'mixed-script': 'Mixed-script words',
  'anomalous-space': 'Unusual spacing',
  'ai-vocabulary': 'AI-favoured vocabulary',
  'ai-phrasing': 'AI stock phrasing',
  'ai-structure': 'AI sentence structure',
  'claude-tell': 'Claude-associated phrasing',
  'smart-punctuation': 'Curly quotes / smart punctuation',
  'em-dash-density': 'Heavy em-dash use',
  'list-heavy': 'List-heavy structure',
  'uniform-burstiness': 'Unusually uniform sentences',
  'chatbot-leftover': 'Chatbot boilerplate',
  'template-placeholder': 'Unfilled template placeholders',
  'uniform-paragraphs': 'Unusually uniform paragraphs',
  'ai-span': 'Concentrated AI-like section',
  'family-tell': 'Model-associated phrasing',
  'spelling-variant-mix': 'Mixed US/British spelling',
};

/** The hero donut gauge for the 0-100 signal score - the "how full is the dial"
 *  read, centred in the panel with the rating INSIDE the ring. Colour follows
 *  the BAND (a state, not a series); the number wears text tokens, so colour is
 *  never the only carrier. Numeric-only interpolation, so no sink risk. */
function tsigGaugeSvg(score: number, band: TextSignalPanel['band']): string {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  const c = 2 * Math.PI * 26;
  const on = (n / 100) * c;
  return `<div class="valid-tsig-gauge-wrap"><svg class="valid-tsig-gauge" viewBox="0 0 64 64" role="img" aria-label="${escape(tRaw('AI-writing evidence score {n} of 100 - heuristic, not a probability', { n }))}" data-band="${escape(band)}">`
    + '<circle class="valid-tsig-gauge-track" cx="32" cy="32" r="26"/>'
    + `<circle class="valid-tsig-gauge-fill" cx="32" cy="32" r="26" stroke-dasharray="${on.toFixed(2)} ${c.toFixed(2)}"/>`
    + `<text class="valid-tsig-gauge-num" x="32" y="34">${n}</text>`
    + '<text class="valid-tsig-gauge-den" x="32" y="45">/100</text>'
    + `</svg><span class="valid-tsig-gauge-copy"><strong>${t('AI-writing evidence')}</strong><small>${t('Heuristic score · not a probability')}</small></span></div>`;
}

/** The word for a temperature bucket, for the mark tooltips: names the grade so
 *  a reader knows what they are free to ignore. Enablement, never control - the
 *  hottest mark is still just information. */
function heatGradeWord(bucket: 1 | 2 | 3 | 4 | 5): string {
  if (bucket >= 4) return t('a strong tell');
  if (bucket === 3) return t('a moderate signal');
  return t('a weak hint, safe to ignore');
}

/** The extracted text with its flagged spans wrapped in <mark>, coloured by its
 *  confidence temperature (cool amber = a soft style hint, hot red = a hard
 *  byte-level artifact) so the reader sees at a glance what is ignorable.
 *  Every run renders through visibleLinkedTextHtml (escape()d, with each invisible
 *  character surfaced as a named chip - a zero-width character inside a mark
 *  is otherwise a hairline nobody can see). */
function highlightExtractHtml(text: string, marks: TextSignalMark[]): string {
  const runs = buildHighlightSegments(text, marks).map((s) => {
    if (!s.tier) return visibleLinkedTextHtml(s.text);
    const title = TSIG_KIND_TITLE[s.kind ?? ''] ?? (s.kind ?? '');
    const bucket = heatBucket(s.heat ?? 0);
    return `<mark class="valid-hl valid-hl--${escape(s.tier)} valid-hl--t${bucket}" title="${escape(`${t(title)} · ${heatGradeWord(bucket)}`)}">${visibleLinkedTextHtml(s.text)}</mark>`;
  }).join('');
  const legend = marks.length > 0
    ? `<span class="valid-tsig-legend">${escape(t('Cooler marks are weak hints you can freely ignore. Hotter marks are harder evidence. Everything here is a signal, not a verdict.'))}</span>`
    : '';
  return `<pre class="valid-tsig-extract" aria-label="${escape(t('Extracted text'))}">${runs}</pre>${legend}`;
}

// One OCR line: its text and its box in SOURCE-image pixel coordinates.
type OcrLineBox = { text: string; box: { x: number; y: number; w: number; h: number } };

/** Per-line strongest signal tier: a line is flagged when a mark's span overlaps
 *  its character range in the joined OCR text (`artifact` outranks `heuristic`).
 *  Each flagged line also carries the HOTTEST overlapping mark's heat, so the
 *  overlay can grade its box on the same temperature scale as the extract. */
function lineSignalTiers(lines: OcrLineBox[], marks: TextSignalMark[]): Array<{ tier: 'artifact' | 'heuristic'; heat: number } | null> {
  const tiers: Array<{ tier: 'artifact' | 'heuristic'; heat: number } | null> = [];
  let offset = 0;
  for (const ln of lines) {
    const start = offset;
    const end = offset + ln.text.length;
    offset = end + 1; // the '\n' the lines were joined with
    let tier: 'artifact' | 'heuristic' | null = null;
    let heat = 0;
    for (const m of marks) {
      if (m.index < end && m.index + m.length > start) {
        if (m.tier === 'artifact') tier = 'artifact';
        else if (tier !== 'artifact') tier = 'heuristic';
        if (m.heat > heat) heat = m.heat;
      }
    }
    tiers.push(tier ? { tier, heat } : null);
  }
  return tiers;
}

/** An SVG overlay (natural-size viewBox) boxing every OCR line - flagged lines
 *  coloured by tier, the rest faint - so the user sees WHERE on the image the
 *  signals sit. Built with DOM nodes (only numeric attributes, no markup sink). */
function buildOverlaySvg(lines: OcrLineBox[], marks: TextSignalMark[], w: number, h: number): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'valid-ocr-overlay');
  svg.setAttribute('aria-hidden', 'true');
  const tiers = lineSignalTiers(lines, marks);
  lines.forEach((ln, i) => {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(ln.box.x));
    r.setAttribute('y', String(ln.box.y));
    r.setAttribute('width', String(ln.box.w));
    r.setAttribute('height', String(ln.box.h));
    r.setAttribute('rx', '2');
    const sig = tiers[i] ?? null;
    r.setAttribute('class', sig
      ? `valid-ocr-box valid-ocr-box--${sig.tier} valid-ocr-box--t${heatBucket(sig.heat)}`
      : 'valid-ocr-box valid-ocr-box--plain');
    svg.appendChild(r);
  });
  return svg;
}

function textSignalsHtml(panel: TextSignalPanel | undefined): string {
  if (!panel) return '';
  const { heading, bandLabel, rows } = textSignalLabels(panel);
  // The extracted text itself, highlighted - present whenever analyzeVerifyText ran
  // (the paste path, the text-file path, and the image→OCR path all attach it).
  const openText = panel.text != null ? `<button class="btn" type="button" data-open-text="${escape(panel.text)}">${t('Open in Text')}</button>` : '';
  const extract = panel.text != null ? highlightExtractHtml(panel.text, panel.marks) : '';
  // The heat-bar minimap: one cell per rolling window, start of the text to its
  // end. `cell.heat` is a plain 0-1 number the engine already rounded - the ONLY
  // thing interpolated into the style attribute, as a custom property the
  // stylesheet turns into a colour.
  const heatbar = panel.heatmap && panel.heatmap.cells.length >= 4
    ? `<div class="valid-tsig-heatbar" role="img" aria-label="${escape(t('Where AI-writing signals concentrate in this text'))}">${panel.heatmap.cells.map((c) => `<i style="--h:${c.heat}"></i>`).join('')}</div><span class="valid-tsig-heatbar-cap">${t('Signal heat across the text, start to end')}</span>`
    : '';
  // The best-guess source. A leaked FINGERPRINT names the model with confidence; a
  // STYLE guess (Claude or generic) is hedged and low-confidence, "consistent with".
  const guess = panel.guessFamily
    ? (panel.guessConfidence === 'high'
      ? `<p class="valid-tsig-guess valid-tsig-guess--high">${tRaw('Identified as <strong>{family}</strong> from a leaked model fingerprint.', { family: escape(panel.guessFamily) })}</p>`
      : `<p class="valid-tsig-guess">${tRaw('Best guess (low confidence): consistent with <strong>{family}</strong> output.', { family: escape(panel.guessFamily) })}</p>`)
    : '';
  // The runners-up behind a LOW-confidence guess: showing every family that
  // scored keeps the winner honest ("leans X over Y", not "is X"). A leaked
  // fingerprint needs no runners-up, so a high-confidence guess shows none.
  const cands = panel.guessConfidence === 'low' && (panel.guessCandidates?.length ?? 0) >= 2
    ? `<p class="valid-tsig-cands">${escape(t('Style comparison across families:'))} ${escape(panel.guessCandidates!.map((c) => `${c.family} ${c.strength}`).join(' · '))}</p>`
    : '';
  // Absence of a leaked marker must not read as a failed check: chat apps strip
  // their own scaffolding on copy, so most AI text carries none. Said out loud
  // whenever signals were found but nothing named a model - enablement, not
  // silence the reader has to interpret.
  const noMarker = panel.band !== 'none' && !panel.pixelSourced && !panel.rows.some((r) => r.kind === 'model-fingerprint')
    ? `<p class="valid-tsig-cands">${escape(t('No leaked model markers were found in this text. Chat apps usually strip them from copied answers, so their absence proves nothing either way.'))}</p>`
    : '';
  // The reword-watermark slot: filled after render ONLY on a detection - the
  // one signal here that names its source with confidence (see lib/wm-note.ts).
  const wm = panel.text != null ? wmNoteSlot(panel.text, 'valid-tsig-guess valid-tsig-guess--high') : '';
  // The model-tier slot (consent button / estimate / honesty line) - a
  // conclusive estimate re-renders this whole panel via the callback.
  const modelSlot = aiModelSlot(panel, 'valid-tsig-cands', (p) => textSignalsHtml(p));
  return `
    <div class="valid-aidecl valid-tsig" role="note" data-tsig-band="${escape(panel.band)}" data-tsig-root>
      <span class="valid-aidecl-ic" aria-hidden="true">${svgIcon('aiSpark')}</span>
      <div class="valid-aidecl-text">
        <strong>${escape(heading)} <span class="valid-tsig-band" data-band="${escape(panel.band)}">${escape(bandLabel)}</span></strong>
        ${wm}
        ${tsigGaugeSvg(panel.score, panel.band)}
        ${modelSlot}
        <details class="valid-tsig-details valid-panel-disclosure"${disclosureOpenAttr()}>
          <summary>
            <span>${t('Review the evidence')}</span>
            <span class="valid-tsig-details-count">${t('{n} findings', { n: panel.rows.length })}</span>
            <span class="valid-disclosure-chev" aria-hidden="true">${ICON_CHEVRON}</span>
          </summary>
          <div class="valid-tsig-details-body">
            ${heatbar}
            <details class="valid-text-extract-disclosure"><summary>${svgIcon('document')}<span>${t('Extracted text')}</span>${ICON_CHEVRON}</summary>${openText}${extract}</details>
            ${rows ? `<ul class="valid-aidecl-list">${rows}</ul>` : ''}
            ${guess}
            ${cands}
            ${noMarker}
            ${panel.facts ? tsigFactsHtml(panel.facts) : ''}
          </div>
        </details>
        <span class="valid-aidecl-note${panel.band === 'strong' ? ' guide-warn' : panel.band === 'notable' ? ' guide-hint' : ''}">${t('Writing patterns are hints, not proof of AI use.')}</span>
      </div>
      <span class="valid-aidecl-tag" aria-hidden="true">${t('AI?')}</span>
    </div>`;
}

// ── Lolly Imprint (our pixel watermark) ──────────────────────────────────────
// Shown ONLY when the in-pixel mark is found (absence is uninformative - resize
// erases it and non-Lolly rasters never carry it, so "not found" must never read
// as "not made with Lolly"). Deliberately quiet and clearly secondary to the
// C2PA verdict: a durable hint, not a cryptographic guarantee.
function watermarkNote(wm: Watermark | undefined): string {
  if (!wm?.present) return '';
  return `
    <div class="valid-wm" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('imprint')}</span>
      <div class="valid-wm-text">
        <strong>${wm.embedded ? t('Lolly Imprint found in an embedded image') : t('Lolly Imprint present')}</strong>
        <span>${wm.embedded
    ? t("This file isn't a raster Lolly signs directly, but one of the images embedded inside it carries the Lolly Imprint - an imperceptible watermark Lolly can embed in the pixels of a raster it renders. It rides in the image itself and survives recompression, so it's a durable hint that an image in this file came from Lolly. A supporting signal, not a cryptographic guarantee.")
    : t("The Lolly Imprint is an imperceptible watermark Lolly can embed in the pixels of a raster export. Unlike the Content Credential - which travels in metadata and is lost to a re-save or strip - it rides in the image itself and survives recompression, so it's a durable hint that the image came from Lolly. A supporting signal, not a cryptographic guarantee.")}</span>
      </div>
    </div>`;
}

// The scorecard pip for a detected Lolly Imprint - the exact item scorecardModel
// seats beside the verdict, reused so a Tier-2 (opt-in resize search) recovery
// injects an IDENTICAL pip. Presence is presence: the wording never depends on
// which tier found it or on the scale/offset it was recovered at.
const lollyImprintPip = (): ScorecardItem => ({ icon: 'imprint', label: t('Lolly Imprint'), status: 'pass', statusWord: t('detected') });

// ── Opt-in Tier-2 "resized Imprint" search ───────────────────────────────────
// The automatic pixel pass (pixelChecks) runs Tier 0 (plain detect) + Tier 1 (the
// cheap block-phase OFFSET search, crop recovery). It deliberately does NOT run
// Tier 2 - the resample-heavy SCALE grid - because that costs a bilinear resample
// + detect per cell and the common case on a public /verify page is an unmarked
// file, so paying it silently on every miss is unacceptable. Exactly like the
// TrustMark deep-scan button, it's offered PER FILE, ONLY when nothing was found
// yet, and only for a raster we can decode. Honest scope: it recovers a CROPPED or
// MODERATELY-resized Imprint (~0.5×–2×); it does NOT survive an aggressive social-
// media downscale (that needs a resize-invariant scheme, out of scope here).
function imprintRescanBlock(fileIndex: number, format: string | null, fileName: string, present: boolean, madeWithLolly: boolean): string {
  if (present || madeWithLolly || !isDeepScannable(format, fileName)) return '';
  return `
    <div class="valid-wm valid-wm--action" data-imprint-rescan-block="${fileIndex}">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('imprint')}</span>
      <div class="valid-wm-text">
        <strong>${t('Was this image resized or cropped?')}</strong>
        <span>${t('Search for a Lolly Imprint after cropping or resizing. Runs on this device.')}</span>
        <div data-imprint-rescan-result="${fileIndex}"></div>
      </div>
      <button type="button" class="btn valid-wm-rescan" data-imprint-rescan="${fileIndex}">${t('Search for a resized Imprint')}</button>
    </div>`;
}

// ── SEAL (hackerfactor) signature - byte-level cryptographic provenance ──────
// DISTINCT from Meta's "Content Seal" pixel watermark (contentSealPip/Note
// below): SEAL signs the FILE BYTES and publishes its public key in DNS. It runs
// on the DEFAULT verify path (byte-level, like the C2PA / metadata reads - NOT
// the neural deep scan). Only a positive OR a present-but-failed result renders;
// a file with no SEAL record shows nothing (absence is never "clean"). SEAL
// proves DOMAIN control + byte integrity - not a CA-verified legal identity, and
// nothing about the visual content.
function sealPip(seal: SealVerifyResult | undefined): ScorecardItem | null {
  if (!seal?.found) return null;
  if (seal.valid && seal.keySource === 'dns') return { icon: 'seal', label: t('SEAL signature'), status: 'pass', statusWord: t('verified') };
  // Valid but the key came from the file itself (no DNS confirmation) - integrity
  // without domain attribution, so it's an amber "present", not a green verdict.
  if (seal.valid) return { icon: 'seal', label: t('SEAL signature'), status: 'warn', statusWord: t('unconfirmed key') };
  return { icon: 'seal', label: t('SEAL signature'), status: 'fail', statusWord: t('failed') };
}
function sealNoteHtml(seal: SealVerifyResult | undefined): string {
  if (!seal?.found) return '';
  const domain = seal.domain ? escape(seal.domain) : t('an undisclosed domain');
  const idLine = seal.signerId ? ` ${t('Signer id: {id}.', { id: seal.signerId })}` : '';
  const whenLine = seal.timestamp ? ` ${t('Self-asserted signing time: {when}.', { when: seal.timestamp })}` : '';
  if (seal.valid && seal.keySource === 'dns') {
    const coverage = seal.coversWholeFile
      ? t('The signature covers the whole file, so its bytes are unchanged since it was signed.')
      : t('The signature covers only part of the file, so only that portion is proven unchanged.');
    return `
    <div class="valid-wm" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('seal')}</span>
      <div class="valid-wm-text">
        <strong>${tRaw('Signed by {domain} (SEAL)', { domain })}</strong>
        <span>${t('A SEAL cryptographic signature over the file’s bytes verified against the public key published in DNS for this domain.')} ${coverage}${idLine}${whenLine}</span>
        <span>${t('SEAL proves control of the domain - domain-level attribution, not a CA-verified legal identity - and says nothing about the visual content. Checked on this device; only a public-key DNS lookup left the device, never the file.')}</span>
      </div>
    </div>`;
  }
  if (seal.valid) {
    // Verified against the record's OWN inline key - internally consistent, but
    // the key was never confirmed against DNS, so the domain is unattested.
    return `
    <div class="valid-wm valid-wm--warn" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('seal')}</span>
      <div class="valid-wm-text">
        <strong>${t('SEAL signature is internally consistent')}</strong>
        <span>${tRaw('This file’s SEAL signature verifies against a public key the file itself supplied, but that key was not confirmed against DNS for {domain} - so the bytes are self-consistent, without proven domain attribution.', { domain })}${idLine}${whenLine}</span>
      </div>
    </div>`;
  }
  return `
    <div class="valid-wm valid-wm--warn" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('seal')}</span>
      <div class="valid-wm-text">
        <strong>${t('SEAL signature did not verify')}</strong>
        <span>${tRaw('This file carries a SEAL signature record naming {domain}, but it did not validate: {reason}', { domain, reason: escape(seal.reason) })}</span>
      </div>
    </div>`;
}

// ── Appended-payload extraction (view + download) ────────────────────────────
// The steganalysis reader already surfaces trailing bytes as a metadata row
// (see file-metadata.ts's `appended`); this callout goes one step further and
// lets a viewer actually see and pull out what's riding after the container
// ends - same "reveal, never launder" stance as the clean-copy action below.
// Shown for EVERY appended payload, including the legitimate motion-photo
// case (no warning pip there - see stegoPips - but "here's the trailing data"
// is still a neutral, useful action). The View/Download handlers themselves
// live in mountValid (they need activeFiles); this only builds the markup.
const PAYLOAD_EXT: Record<string, string> = {
  'zip archive': 'zip', 'gzip data': 'gz', 'PDF document': 'pdf',
  'Windows executable': 'bin', 'ELF executable': 'bin',
  'video (motion photo)': 'mp4', text: 'txt',
  // Declared second images (MPF): our own HDR gain map, and foreign multi-picture
  // JPEGs. Both are real JPEGs, so a download should land as one.
  'HDR gain map (ISO 21496-1 / Ultra HDR)': 'jpg', 'second image (MPF multi-picture)': 'jpg',
};
/** Extension for a downloaded payload, derived from the engine's best-effort
 *  `kind` sniff. Anything not explicitly named above (images, RAR, generic
 *  binary data) falls back to a neutral `.bin` rather than guessing wrong. */
export function payloadExt(kind: string): string {
  return PAYLOAD_EXT[kind] ?? 'bin';
}
export function appendedPayloadHtml(meta: FileMetadata | undefined, fileIndex: number): string {
  if (!meta?.appended) return '';
  // DECLARED appends (a motion photo's video, an MPF gain map) are expected and
  // disclosed, not hidden data. The engine owns that judgement - never re-derive
  // it here by string-matching a kind.
  const expected = appendedIsExpected(meta.appended);
  // Reuse the already-formatted "kind - size" string from the metadata row
  // instead of reformatting the byte count here.
  const detail = meta.fields.find((f) => f.label === 'Appended data')?.value ?? meta.appended.kind;
  return `
    <div class="valid-wm${expected ? '' : ' valid-wm--warn'}" role="note" data-payload-block="${fileIndex}">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('package')}</span>
      <div class="valid-wm-text">
        <strong>${expected ? t('Appended image or video data') : t('Appended data found')}</strong>
        <span>${escape(detail)}</span>
        ${auxiliaryMetadataHtml(meta)}
        <div class="valid-payload-actions">
          <button type="button" class="btn valid-payload-button" data-payload-view="${fileIndex}">${svgIcon('code')}<span>${t('Raw bytes')}</span></button>
          <button type="button" class="btn valid-payload-button" data-payload-download="${fileIndex}">${svgIcon('download')}<span>${t('Download')}</span></button>
        </div>
        <div class="valid-payload-view" data-payload-panel="${fileIndex}" hidden></div>
      </div>
    </div>`;
}
// Hex dump with an ASCII gutter - 16 bytes/row, classic layout. The payload is
// attacker-controlled bytes; the caller escapes this output before it ever
// touches innerHTML (see payloadPreviewHtml), so nothing here needs escaping
// itself, but every byte is rendered as its numeric hex/period form, never as
// a live character - there is no path from payload bytes to markup.
function hexDump(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, Math.min(i + 16, bytes.length));
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = Array.from(row, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
}
const PAYLOAD_PREVIEW_MAX = 2048;
/** Renders the first ~2 KB of a (possibly hostile) payload as plain escaped
 *  text - a hex dump for anything binary, decoded UTF-8 for the `text` kind.
 *  SECURITY: this is the only thing ever done with payload bytes on this
 *  page - no parsing, no rendering as an image/HTML/script, and the result is
 *  always passed through `escape()` before reaching innerHTML, so a payload
 *  crafted to look like markup can never execute or inject. */
function payloadPreviewHtml(bytes: Uint8Array, kind: string): string {
  const truncated = bytes.length > PAYLOAD_PREVIEW_MAX;
  const slice = bytes.subarray(0, PAYLOAD_PREVIEW_MAX);
  const body = kind === 'text'
    ? new TextDecoder('utf-8', { fatal: false }).decode(slice)
    : hexDump(slice);
  const more = truncated ? `\n\n${t('… {n} more bytes not shown', { n: bytes.length - PAYLOAD_PREVIEW_MAX })}` : '';
  return `<pre class="valid-payload-dump">${escape(body)}${escape(more)}</pre>`;
}

// ── Deep scan for third-party watermarks (Adobe TrustMark + Meta Content Seal) ──
// See plans/31-watermark-detectors.md. The two neural decoders (lib/trustmark.ts,
// lib/contentseal.ts) each pull in onnxruntime-web + a model and must NEVER load
// on the default verify path - they're lazily dynamic-imported. The scan runs
// AUTOMATICALLY (scanOne/startBatchScan in mountValid) once the models are
// on-device; the one-time ~90 MB download is offered once per batch via the
// header banner (deepScanBannerHtml → enableDeepScan), so a single consent
// serves every file. Reuses the Lolly Imprint's `.valid-wm` styling for the
// positive-result notes (same "a durable in-pixel mark was found" idea).
const TRUSTMARK_DETECTED_PIP: ScorecardItem = {
  icon: 'imprint', label: '', status: 'pass', statusWord: '',
};
/** Builds the scorecard pip for a positive TrustMark decode - a real
 *  on-device, ECC-validated read, so (like the Lolly Imprint) it earns a
 *  green pass pip rather than the amber SynthID/Meta likelihood wording. */
function trustmarkPip(): ScorecardItem {
  return { ...TRUSTMARK_DETECTED_PIP, label: t('TrustMark'), statusWord: t('detected') };
}
function trustmarkNoteHtml(payloadHex: string, schema: string): string {
  return `
    <div class="valid-wm" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('imprint')}</span>
      <div class="valid-wm-text">
        <strong>${t('Adobe TrustMark detected')}</strong>
        <span>${tRaw('A TrustMark watermark ({schema}) was decoded from the pixels and passed its error-correction check - a real, on-device read, not a guess. Recovered payload: {payload}', { schema: escape(schema), payload: `<code>${escape(payloadHex)}</code>` })}</span>
      </div>
    </div>`;
}
/** A positive read of Lolly's OWN durable mark - a TrustMark-format soft binding
 *  carrying Lolly's identifier, recognised on-device (engine readLollyDurable).
 *  It's a real, ECC-validated read, so (like the Lolly Imprint) a green pass pip
 * - and it's the more specific answer, so it REPLACES the generic TrustMark pip
 *  when the payload is ours. See plans/28-durable-content-credentials.md. */
function lollyDurablePip(): ScorecardItem {
  return { ...TRUSTMARK_DETECTED_PIP, label: t('Lolly durable mark'), statusWord: t('detected') };
}
// Honest scope: this states what it PROVES (a Lolly identifier is watermarked
// into the pixels and error-corrected) and what it's FOR (re-linking after a
// metadata strip). It does NOT claim a manifest was resolved - that lookup
// (CAI Soft Binding Resolution) is deferred to a SUSE-hosted deploy.
function lollyDurableNoteHtml(schema: string): string {
  return `
    <div class="valid-wm" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('imprint')}</span>
      <div class="valid-wm-text">
        <strong>${t('Durable Lolly credential')}</strong>
        <span>${t('A TrustMark-format watermark ({schema}) carrying Lolly’s own identifier was decoded from the pixels and passed its error-correction check - a real, on-device read. Unlike the Content Credential, which lives in metadata and is stripped on upload, this identifier is hidden in the pixels, so it can re-link this file to Lolly even after the metadata is gone.', { schema })}</span>
      </div>
    </div>`;
}
/** The pip for a positive Content Seal read - a consistent message survived
 *  four re-encodings on THIS device. Unlike TrustMark this has NO error-
 *  correcting gate (it's a statistical consensus that a flat/low-detail image
 *  can trip), so it reads as an amber "likely", not a green "detected". */
function contentSealPip(): ScorecardItem {
  return { icon: 'imprint', label: t('Content Seal'), status: 'warn', statusWord: t('likely') };
}
// The Content Seal positive note ALWAYS carries the Muse-proprietary caveat: the
// open Pixel Seal / Video Seal extractor is not Meta's production "Muse" variant,
// so a hit must never be read as "this is Meta Muse / Meta AI output". Absence is
// never shown at all (see scanOne), so this only appears on a real detection.
function contentSealNoteHtml(messageHex: string): string {
  const msg = messageHex
    ? ` ${tRaw('Recovered message: {payload}', { payload: `<code>${escape(messageHex)}</code>` })}`
    : '';
  return `
    <div class="valid-wm" role="note">
      <span class="valid-wm-ic" aria-hidden="true">${svgIcon('imprint')}</span>
      <div class="valid-wm-text">
        <strong>${t('Meta Content Seal likely')}</strong>
        <span>${t('An open Pixel Seal image watermark decoded consistently from the pixels across several re-encodings. Unlike a Content Credential or TrustMark - which carry an error-correcting check - this is a statistical match with no cryptographic gate, so a low-detail or flat image can occasionally read as a false positive.')}${msg}</span>
        <span>${t('This reads only Meta’s open-source Pixel Seal / Video Seal image watermark. Meta’s production “Muse” image pipeline uses a separate proprietary variant this cannot read, so a hit does not mean Meta Muse or Meta AI, and its absence rules nothing out.')}</span>
      </div>
    </div>`;
}
// Per-file deep-scan slot: the pip-injection anchor + a notes area, appended
// below the hero scorecard. Gated to formats the pixel decode can read
// (WM_DECODABLE) - omitted for PDF/video/TIFF/SVG. There is NO per-file button:
// the scan runs automatically once the detector models are on-device, and the
// one-time download is offered ONCE per batch in the header banner
// (deepScanBannerHtml) so every file benefits from a single consent.
function deepScanBlock(fileIndex: number, format: string | null, fileName: string): string {
  if (!isDeepScannable(format, fileName)) return '';
  return `
    <div class="valid-deepscan" data-deepscan-block="${fileIndex}" hidden>
      <div data-deepscan-result="${fileIndex}"></div>
    </div>`;
}
function isDeepScannable(format: string | null, fileName: string): boolean {
  return WM_DECODABLE.has((format || fileName.split('.').pop() || '').toLowerCase());
}
// The batch-level consent banner, shown at the top of the report when deep-scan
// models aren't yet on-device and at least one file is a decodable raster. One
// click downloads the detectors once (~90 MB) and then every image in the batch
// is scanned automatically; on a later visit (models cached) this never appears
// and scanning is silent/automatic.
function deepScanBannerHtml(count: number): string {
  return `
    <div class="valid-deepscan-banner" data-deepscan-banner role="note">
      <span class="valid-deepscan-banner-ic" aria-hidden="true">${svgIcon('imprint')}</span>
      <div class="valid-deepscan-banner-text">
        <strong>${t('Scan for invisible watermarks?')}</strong>
        <span data-deepscan-banner-msg>${t('Check {n} image(s) for Adobe TrustMark / Meta Content Seal watermarks in the pixels. Downloads a detector once (~90 MB), then runs automatically for every file - on-device, nothing uploaded.', { n: count })}</span>
        <div class="valid-deepscan-progress" data-deepscan-progress role="progressbar" aria-label="${escape(t('Downloading the watermark detector'))}" hidden>
          <div class="valid-deepscan-progress-fill" data-deepscan-progress-fill></div>
        </div>
      </div>
      <button type="button" class="btn valid-deepscan-enable" data-deep-scan-enable>${t('Enable')}</button>
    </div>`;
}

// ── The watermark work as BACKGROUND JOBS (plans/124 section 9, WP-F) ────────
//
// Three runs on this page are heavy and long: the one-time ~90 MB detector
// download plus a scan of the whole batch (the banner's Enable), the passive
// scan of every decodable file once the models are on-device, and the opt-in
// Tier-2 Imprint grid search. Each used to live entirely inside the view - an
// in-banner bar or a button label, no way to stop it, and navigating away left
// it writing into a detached DOM with nobody watching the progress.
//
// They are WP-F jobs now (lib/jobs.ts): the global toast owns the bar and the ✕,
// one heavy job runs at a time, the work outlives the view, and a re-entered
// /verify showing the SAME files joins the running job instead of starting a
// second scan of them.
//
// WHAT CANCEL CAN HONESTLY DO HERE. Nothing downstream takes an AbortSignal:
// lib/trustmark.ts and lib/contentseal.ts expose only `cacheOnly`, the model
// fetcher they share (lib/ort.ts) takes no signal, and the engine's
// detectWatermarkSearch has no abort seam. So cancel is COOPERATIVE and lands
// BETWEEN stages - the download in flight completes, the file being scanned
// completes, and nothing after it starts. Anything a cancelled run had already
// computed is dropped and never painted. That is the whole promise: the ✕ stops
// the queue, it does not kill a wasm inference mid-run.

/** The slice of a JobHandle a scan driver needs, so the drivers test against a
 *  plain object with no registry, no toast and no DOM. */
export interface ScanJobSink {
  readonly cancelled: boolean;
  progress(done: number, total: number, note?: string): void;
}

/** What a finished (or cancelled) scan run reports back. */
export interface ScanRunResult {
  scanned: number;
  positives: number;
  cancelled: boolean;
}

/**
 * A stable identity for one dropped batch, so a re-entered view can recognise
 * that the files on screen are already being scanned. Name + size + last-modified
 * is what tells two drops apart without holding on to the File objects. `suffix`
 * narrows the key to one run within the batch (the per-file Imprint search).
 */
export function batchKey(files: readonly File[], suffix = ''): string {
  const body = files.map((f) => `${f.name}:${f.size}:${f.lastModified || 0}`).join('|');
  return suffix ? `${body}#${suffix}` : body;
}

// Module scope, NOT the mountValid closure - that is the point. A job started by
// one mount has to be findable by the next one, which is what stops a re-entered
// view double-starting the same scan. An entry lives exactly as long as its run.
const liveScanJobs = new Map<string, JobHandle>();

/** Is a scan for this batch key still running? The double-start guard, and the
 *  honest answer a re-entered view gives instead of starting a second scan. */
export function scanJobActive(key: string): boolean {
  return liveScanJobs.has(key);
}

/**
 * Visit `indexes` in order, reporting i-of-N and stopping BETWEEN files on cancel.
 *
 * `scanOne` resolves how many POSITIVE detections that file surfaced - 0 for a
 * clean file, an uninstalled model, or one the browser could not decode. Absence
 * is never a verdict (plans/31-watermark-detectors.md), so a zero stays silent in
 * the report; only the toast ever says a scan happened at all.
 */
export async function runScanBatch(
  sink: ScanJobSink,
  indexes: readonly number[],
  scanOne: (index: number) => Promise<number>,
): Promise<ScanRunResult> {
  const total = indexes.length;
  let scanned = 0;
  let positives = 0;
  for (const index of indexes) {
    if (sink.cancelled) return { scanned, positives, cancelled: true };
    sink.progress(scanned, total, t('Checking image {n} of {total}…', { n: scanned + 1, total }));
    positives += await scanOne(index);
    scanned++;
  }
  sink.progress(scanned, total);
  return { scanned, positives, cancelled: sink.cancelled };
}

/**
 * The finished-scan announcement, and the reason it is its own job.
 *
 * The toast renders a job's TITLE and a status word on a done row - never its
 * progress note (lib/job-toast.ts) - so a title fixed at start-time cannot carry
 * a count that is only known at the end. A second, instant, LIGHT job whose title
 * IS the answer is the one channel that survives the view being torn down. Light,
 * so it never occupies the serial heavy slot, and not cancellable, because there
 * is nothing left to cancel.
 *
 * Silent on zero, exactly like the report: "no watermark found" is not a verdict
 * this page states.
 */
export function announceScanResult(positives: number, title?: (n: number) => string): void {
  if (positives <= 0) return;
  const text = title ? title(positives) : t('{n} invisible watermark(s) found', { n: positives });
  startJob({ title: text, heavy: false }).finish(positives);
}

export interface ScanJobHooks {
  /** Mirrors every progress call so a still-mounted view can paint a compact
   *  status of its own. The toast is the survivor; this is the convenience copy. */
  onProgress?: (done: number, total: number, note?: string) => void;
  /** Fires once the run settles, cancelled or not. Never fires on a throw. */
  onDone?: (result: ScanRunResult) => void;
  onError?: (err: unknown) => void;
  /** Overrides the completion announcement's wording. Return null for silence. */
  announce?: (positives: number) => string;
}

/**
 * Register one scan run as a heavy job, guarded against double-starting the same
 * batch. Returns the handle, or null when a run for `key` is already live - the
 * caller then says so rather than queueing a duplicate.
 *
 * The work function receives a sink, not the raw handle, so every progress call
 * reaches both the toast and the caller's own compact status in one place.
 */
export function startScanJob(
  key: string,
  title: string,
  work: (sink: ScanJobSink) => Promise<ScanRunResult>,
  hooks: ScanJobHooks = {},
): JobHandle | null {
  if (liveScanJobs.has(key)) return null;
  // A no-op callback is what makes the toast show its ✕ at all; the actual stop is
  // cooperative, polled by the drivers between stages (see the section header).
  const job = startJob({ title, cancel: () => { /* cooperative - the drivers poll job.cancelled */ } });
  liveScanJobs.set(key, job);
  const sink: ScanJobSink = {
    get cancelled(): boolean { return job.cancelled; },
    progress(done, total, note): void {
      job.progress(done, total, note);
      hooks.onProgress?.(done, total, note);
    },
  };
  void (async (): Promise<void> => {
    try {
      await job.started;
      if (job.cancelled) { hooks.onDone?.({ scanned: 0, positives: 0, cancelled: true }); return; }
      const result = await work(sink);
      if (job.cancelled || result.cancelled) { hooks.onDone?.({ ...result, cancelled: true }); return; }
      job.finish(result);
      announceScanResult(result.positives, hooks.announce);
      hooks.onDone?.(result);
    } catch (err) {
      if (!job.cancelled) job.fail(err);
      hooks.onError?.(err);
    } finally {
      job.settle();
      liveScanJobs.delete(key);
    }
  })();
  return job;
}

/** Test-only: forget every live scan-job registration, so one test's guard can
 *  never leak into the next. Mirrors lib/jobs.ts's __resetJobsForTest. */
export function __resetScanJobsForTest(): void {
  liveScanJobs.clear();
}

// ── AI declaration + third-party watermark pip ──────────────────────────────
// The AI declaration, from either source: the signed credential wins (stronger
// claim), else the bare IPTC tag in the file's embedded metadata (meta.ai).
// `makerHint` joins everything that names the maker - the claim generator, the
// agents on AI-sourced history steps, and the software/credit fields read from
// bare metadata - for the SynthID/Meta maker checks.
function deriveAi(report: VerifyReport, meta: FileMetadata | undefined): { origin: AiOrigin | undefined; makerHint: string } {
  const origin: AiOrigin | undefined = report.aiGenerated
    ? { kind: report.aiGenerated.kind, via: 'credential' }
    : meta?.ai
      ? { kind: meta.ai.kind, via: 'metadata', credit: meta.ai.credit }
      : meta?.producer?.signature === 'ai-download'
        // The container matches an AI pipeline's delivery packaging (engine
        // file-metadata.ts, `producer`) - the weakest tier, shown as "likely".
        ? { kind: 'generated', via: 'fingerprint', vendor: meta.producer.vendor, products: meta.producer.hint, credit: meta.producer.markers.join(' · ') }
        : undefined;
  if (!origin) return { origin, makerHint: '' };
  const gen = report.claim?.generatorInfo?.name != null ? String(report.claim.generatorInfo.name)
    : typeof report.claim?.claimGenerator === 'string' ? report.claim.claimGenerator : '';
  const makerHint = [
    gen,
    ...(report.history ?? []).filter((a) => AI_SOURCE_SLUGS[sourceSlug(a)]).map(stepAgent),
    ...(meta?.fields ?? []).filter((f) => f.group === 'software' || f.label === 'Credit').map((f) => f.value),
  ].filter(Boolean).join(' ');
  return { origin, makerHint };
}

// SynthID / Meta's in-pixel watermarks can't be read outside their makers, so
// their scorecard pip states likelihood: an amber pip whose label carries the
// whole claim (no status word - "passed"/"invalid" would both misword it),
// shown when the file's own AI declaration names a maker whose policy is to
// watermark all AI output. The Lolly Imprint pip (a real on-device detection)
// is appended in scorecardModel; this one rides beside it.
const META_MAKERS = /meta\s?ai|imagined?\s+with\s+ai|\bemu\b/i;
function aiMarkPip(origin: AiOrigin | undefined, makerHint: string, isVideo: boolean): ScorecardItem | null {
  if (!origin) return null;
  const hay = `${origin.credit ?? ''} ${makerHint}`;
  if (SYNTHID_MAKERS.test(hay)) return { icon: 'aiSpark', label: t('SynthID likely'), status: 'warn', hideStatus: true };
  if (META_MAKERS.test(hay)) return { icon: 'aiSpark', label: isVideo ? t('Meta Video Seal likely') : t('Meta AI watermark likely'), status: 'warn', hideStatus: true };
  return null;
}

// Steganalysis pips - amber heuristics from the byte read (a payload appended
// after the image container ends) and the shell's pixel pass (chi-square LSB
// analysis, engine steganalysis.ts). The legitimate motion-photo append stays
// out of the scorecard - it's disclosed in the metadata panel instead.
export function stegoPips(meta: FileMetadata | undefined): ScorecardItem[] {
  const pips: ScorecardItem[] = [];
  if (meta?.appended && !appendedIsExpected(meta.appended)) {
    pips.push({ icon: 'package', label: t('Hidden data appended'), status: 'warn', hideStatus: true });
  }
  if (meta?.lsb?.suspicious) {
    pips.push({ icon: 'eye', label: t('LSB steganography likely'), status: 'warn', hideStatus: true });
  }
  return pips;
}

// One list for both scorecards: the SynthID/Meta likelihood pip + steganalysis.
function extraPips(origin: AiOrigin | undefined, makerHint: string, isVideo: boolean, meta: FileMetadata | undefined): ScorecardItem[] {
  const ai = aiMarkPip(origin, makerHint, isVideo);
  return [...(ai ? [ai] : []), ...stegoPips(meta)];
}

// ── Change history (the recorded C2PA actions) ──────────────────────────────
// Human labels + a glyph per C2PA action code; unknown codes fall back to the
// bare code with the c2pa. prefix stripped.
const ACTION_LABEL: Record<string, string> = {
  'c2pa.created': 'Created', 'c2pa.edited': 'Edited', 'c2pa.opened': 'Opened',
  'c2pa.placed': 'Placed', 'c2pa.removed': 'Removed', 'c2pa.published': 'Published',
  'c2pa.converted': 'Converted', 'c2pa.cropped': 'Cropped', 'c2pa.resized': 'Resized',
  'c2pa.filtered': 'Filtered', 'c2pa.color_adjustments': 'Colour adjusted',
  'c2pa.drawing': 'Retouched', 'c2pa.transcoded': 'Transcoded', 'c2pa.repackaged': 'Repackaged',
  'c2pa.managed': 'Managed', 'c2pa.saved': 'Saved', 'c2pa.printed': 'Printed',
  'c2pa.unknown': 'Modified',
};
const ACTION_ICON: Record<string, IconName> = {
  'c2pa.created': 'sparkle', 'c2pa.edited': 'pen', 'c2pa.opened': 'eye',
  'c2pa.placed': 'package', 'c2pa.published': 'package', 'c2pa.drawing': 'pen',
  'c2pa.color_adjustments': 'droplet', 'c2pa.filtered': 'sliders', 'c2pa.cropped': 'crop',
  'c2pa.resized': 'resize', 'c2pa.converted': 'convert', 'c2pa.transcoded': 'convert',
};
// A composite source type reads as stacked layers regardless of the action code
// carrying it (a created/opened step that merged multiple elements). Keyed on the
// IPTC digitalSourceType slug - takes precedence over ACTION_ICON in stepsHtml().
const SOURCE_ICON: Partial<Record<string, IconName>> = {
  composite: 'layers',
  compositeWithTrainedAlgorithmicMedia: 'layers',
  // Sensor origin - a live camera frame or a recording. A mic-only take is
  // re-pointed to the mic glyph in stepsHtml() from its description.
  digitalCapture: 'camera',
  computationalCapture: 'camera',
  // A display capture is its own origin - a screen, never a camera.
  screenCapture: 'monitor',
};
// Friendly wording for an action's IPTC DigitalSourceType - see sourceTypeLabel
// in valid-verdict.ts, which picks the produced-vs-ingested phrasing per action.
const AI_SOURCE_SLUGS: Record<string, 'generated' | 'composite'> = {
  trainedAlgorithmicMedia: 'generated',
  compositeWithTrainedAlgorithmicMedia: 'composite',
};
const sourceSlug = (a: { digitalSourceType?: unknown }): string =>
  (typeof a.digitalSourceType === 'string' ? a.digitalSourceType : '').split('/').pop() ?? '';

// Keep the product name in history pills and the full version in their detail.
const shortAgent = softwareName;
// The "who did this step": the action's softwareAgent if set, else the recording
// manifest's generator. null when neither is present.
const stepAgent = (a: { softwareAgent?: unknown; generator?: unknown }): string | null => {
  const agent = a.softwareAgent;
  if (agent && typeof agent === 'object' && 'name' in agent && typeof agent.name === 'string') return `${agent.name}${'version' in agent && typeof agent.version === 'string' ? ` ${agent.version}` : ''}`;
  const raw = (typeof a.softwareAgent === 'string' && a.softwareAgent) || (typeof a.generator === 'string' && a.generator) || '';
  return raw ? String(raw) : null;
};
// Strip a trailing "… by <maker>." now that the maker rides in the pill, and
// drop the description entirely if what remains just echoes the step label
// (e.g. "Resized by Google Generative AI." → "" beside a "Resized" row).
function tidyStepDescription(desc: string, label: string): string {
  const cleaned = desc.replace(/\s+by\s+[^.]+\.?\s*$/i, '').trim();
  return cleaned.toLowerCase() === label.toLowerCase() ? '' : cleaned;
}

export function stepsHtml(report: VerifyReport): string {
  // The full provenance chain (all manifests) when the engine surfaced it, else
  // just the active manifest's own actions.
  const acts = report.history?.length ? report.history : (report.claim?.actions ?? []);
  if (!acts.length) return '';
  const rowData = acts.map((a) => {
    const code = String(a.action ?? '');
    const label = ACTION_LABEL[code] ? t(ACTION_LABEL[code]!) : (code.replace(/^c2pa\./, '') || t('Step'));
    const slug = sourceSlug(a);
    const isAi = !!AI_SOURCE_SLUGS[slug];
    const desc = a.description ? tidyStepDescription(String(a.description), label) : '';
    // A mic-only capture (digitalCapture whose description says microphone, not
    // camera) must NOT read "Captured by a camera": swap to the mic glyph and let
    // the description carry the wording instead of the camera source line.
    const isCapture = slug === 'digitalCapture' || slug === 'computationalCapture';
    const isMicCapture = isCapture && /microphone/i.test(desc) && !/camera/i.test(desc);
    const srcLabel = sourceTypeLabel(code, slug);
    const src = isMicCapture || !srcLabel ? undefined : t(srcLabel);
    // A composite/capture source type wins the glyph; else the action's own icon.
    const icon = isMicCapture ? 'mic' : (SOURCE_ICON[slug] ?? ACTION_ICON[code] ?? 'clock');
    // Who did it → a left-side pill. Lolly reads bold green (mark our own edits
    // prominently), an AI-sourced step reads purple, any other maker solid grey.
    const agent = stepAgent(a);
    const agentCls = agent && /lolly/i.test(agent) ? 'lolly' : isAi ? 'ai' : 'other';
    const meta = [
      desc ? escape(desc) : null,
      a.when ? escape(fmtDate(a.when)) : null,
    ].filter(Boolean).join('<span class="valid-step-dot" aria-hidden="true">·</span>');
    // The source-type note (e.g. "Generated by AI") always gets its own line - 
    // it's a distinct claim from the description/timestamp, not more list prose.
    const srcLine = src ? `<span class="valid-step-src">${isAi ? `${svgIcon('aiSpark')} ` : ''}${escape(src)}</span>` : '';
    return { agent, agentCls, label, icon, meta, srcLine };
  });
  // The rail segment spanning the FIRST through LAST step credited to Lolly reads
  // green (matching the lolly pill's own colour) - so the "Lolly leg" of a file's
  // journey visually pops even when other makers' steps sit before/after it.
  const lollyIdxs = rowData.reduce<number[]>((acc, r, i) => (r.agentCls === 'lolly' ? [...acc, i] : acc), []);
  const firstLolly = lollyIdxs[0];
  const lastLolly = lollyIdxs[lollyIdxs.length - 1];
  const rows = rowData.map((r, i) => {
    const railLolly = firstLolly !== undefined && i >= firstLolly && i < lastLolly!;
    return `
      <li class="valid-step is-${r.agentCls}${railLolly ? ' valid-step--rail-lolly' : ''}">
        <span class="valid-step-agent" title="${r.agent ? escape(r.agent) : escape(t('Unknown source'))}">${r.agent ? vendorMark(shortAgent(r.agent)) : ''}<span>${escape(r.agent ? shortAgent(r.agent) : '-')}</span></span>
        <div class="valid-step-main">
          <span class="valid-step-label"><span class="valid-step-ic" aria-hidden="true">${svgIcon(r.icon)}</span>${escape(r.label)}</span>
          ${r.meta ? `<span class="valid-step-meta">${r.meta}</span>` : ''}
          ${r.srcLine}
        </div>
      </li>`;
  }).join('');
  return `
    <details class="valid-steps valid-panel valid-panel-disclosure" open>
      <summary class="valid-panel-summary">
        <span class="valid-panel-summary-title">${svgIcon('clock')}<span>${t('Credential journey')}</span></span>
        <span class="valid-panel-summary-meta">${t('{n} steps', { n: acts.length })}</span>
        <span class="valid-disclosure-chev" aria-hidden="true">${ICON_CHEVRON}</span>
      </summary>
      <p class="valid-origin-note">${escape(journeyEvidenceLabel(report))}</p><ol class="valid-steps-list">${rows}</ol>
    </details>`;
}

/**
 * Sources - what went INTO this file, as its credential records it.
 *
 * Read-only, and deliberately plain. Each row is one recorded ingredient: what it
 * is, how it was used, who made it, the licence it came under, where the exact
 * bytes live and what was done to them.
 *
 * The line that earns this panel is the honesty line. A source that carries no
 * Content Credential of its own - an upstream SVG, a CC BY illustration, an emoji
 * pack's artwork - is recorded by the exporter, which is not the same thing as
 * the source signing for itself. A reader cannot tell those apart from a title
 * and a licence, so the panel says which one it is on every row rather than
 * letting a recorded licence read as a proven one.
 */
export function sourcesHtml(report: VerifyReport, fileIndex = 0): string {
  const sources = report.ingredients ?? [];
  if (!sources.length) return '';
  // The engine reads the same ingredients into the plan's own vocabulary: one
  // computed summary sentence and one ready-to-paste credit line per source. It
  // names nothing itself, so no creator or licence is hard-coded in this view.
  const rightsReport = rightsReportOf(report);
  // `relationship` is a string off the file under review, so the two known values
  // are tested by name rather than looked up in an object. Both strings are
  // literal t() call sites, which is the only form the translation extractor can
  // see, so they are translated like the rest of the panel.
  const useText = (relationship: string | undefined): string => {
    if (relationship === 'componentOf') return t('Placed in this file');
    if (relationship === 'parentOf') return t('This file was made from it');
    return relationship ?? '';
  };
  const rows = sources.map((source, i) => {
    const rights = source.rights;
    const link = rights?.sourceUrl || source.data?.url || source.informationalUri || '';
    // http(s) only: a credential is a file somebody sent you, so its links are
    // untrusted input and must never be able to name a javascript: target.
    const safe = metadataUrl(link);
    // The canonical licence NAME, with the exact declaration kept in the title so
    // nothing a source wrote is replaced by a tidier spelling of it. The name is
    // read whenever the identifier resolves, not only when it differs from the
    // declaration: a credential records `CC-BY-SA-4.0`, and printing the raw id
    // here while the export panel printed `CC BY-SA 4.0` handed two people two
    // different strings for one licence.
    const declared = rights?.license ?? '';
    const canonical = declared ? normaliseLicence(declared) : null;
    const licenceText = canonical?.id ? licenceDisplayName(canonical.id) : declared;
    const licenceCell = declared
      ? `<span title="${escape(declared)}">${metadataLinkHtml(rights?.licenseUrl || declared, licenceText)}</span>`
      : '';
    const facts: Array<[string, string]> = [
      [t('Used'), useText(source.relationship)],
      [t('Creator'), rights?.creator ?? ''],
      [t('Attribution'), rights?.attribution ?? ''],
      // The upstream release tag or commit the bytes came from. Labelled as the
      // source's revision, because a bare 40-character hash beside Creator and
      // Licence reads as noise rather than as provenance.
      [t('Source revision'), rights?.revision ?? ''],
    ];
    const factRows = facts.filter(([, value]) => value).map(([label, value]) =>
      `<div class="valid-input-row"><dt>${escape(label)}</dt><dd><span>${metadataValueHtml(value)}</span></dd></div>`).join('')
      + (licenceCell ? `<div class="valid-input-row"><dt>${escape(t('Licence'))}</dt><dd>${licenceCell}</dd></div>` : '');
    const changes = rights?.modifications?.length
      ? `<p class="valid-source-changes">${t('Changed on the way in: {list}', { list: rights.modifications.join(', ') })}</p>`
      : '';
    const credit = source.credentialed
      ? t('Signed by the source, and its credential travelled with it.')
      : t('Recorded by the exporter, not signed by the source.');
    // The credit line as the engine assembles it, carried on the button so a copy
    // never has to re-derive it from the markup around it.
    const creditLine = rightsReport?.recorded[i]?.credit ?? '';
    const actions = [
      creditLine
        ? `<button type="button" class="btn valid-source-act" data-copy-credit="${escape(creditLine)}">${t('Copy credit')}</button>`
        : '',
      safe
        // nosemgrep: lolly-href-escape-is-not-scheme-validation -- safe is restricted to HTTP(S) immediately above.
        ? metadataLinkHtml(safe, t('Open source'))
        : '',
    ].filter(Boolean).join('');
    return `
      <li class="valid-source">
        <p class="valid-source-title">${escape(source.title || t('Untitled source'))}${source.format ? ` <span class="valid-source-format">${escape(source.format)}</span>` : ''}</p>
        <p class="valid-source-credit">${escape(credit)}</p>
        <dl class="valid-input-list">${factRows}</dl>
        ${changes}
        ${actions ? `<p class="valid-source-actions">${actions}</p>` : ''}
      </li>`;
  }).join('');
  const summaryLine = rightsReport
    ? `<p class="valid-sources-summary">${escape(rightsReport.summary)}</p>`
      + rightsReport.carried.limits.map((line) => `<p class="valid-sources-limit">${escape(line)}</p>`).join('')
    : '';
  // Opening Verify says nothing about what someone intends to do next, so the
  // reuse question is asked only when a reader picks one. Nothing is fetched.
  const reuseOpts = [`<option value="">${escape(t('Choose a use…'))}</option>`]
    .concat(REUSE_CHECKS.map((check) => `<option value="${escape(check.id)}">${escape(t(check.label))}</option>`)).join('');
  const reuseBlock = `
        <div class="valid-sources-reuse">
          <label class="valid-sources-reuse-label" for="valid-reuse-${fileIndex}">${t('Check for this use')}</label>
          <select class="field-select" id="valid-reuse-${fileIndex}" data-reuse-check="${fileIndex}">${reuseOpts}</select>
          <div class="valid-sources-reuse-out" data-reuse-out="${fileIndex}" aria-live="polite"></div>
        </div>`;
  return `
    <details class="valid-sources valid-panel valid-panel-disclosure" open>
      <summary class="valid-panel-summary">
        <span class="valid-panel-summary-title">${svgIcon('layersStack')}<span>${t('Sources')}</span></span>
        <span class="valid-panel-summary-meta">${t('{n} recorded', { n: sources.length })}</span>
        <span class="valid-disclosure-chev" aria-hidden="true">${ICON_CHEVRON}</span>
      </summary>
      ${summaryLine}
      <ul class="valid-sources-list">${rows}</ul>
      ${reuseBlock}
    </details>`;
}

/**
 * The four reuses a reader can ask about, each one a delivery context the engine
 * evaluator already understands. They are questions, not intentions: nothing is
 * recorded, nothing is fetched and the answer is thrown away when the select is
 * put back to its first option.
 */
interface ReuseCheck {
  id: string;
  label: string;
  role: CreativeUseRoleV1;
  operations: CreativeOperationV1[];
  route: DeliveryRouteV1;
  canCarryCredential: boolean;
  canCarryReadableCredit: boolean;
}
const REUSE_CHECKS: ReuseCheck[] = [
  { id: 'share', label: 'Share it publicly as it is', role: 'incorporated', operations: ['placed'], route: 'file-with-c2pa', canCarryCredential: true, canCarryReadableCredit: true },
  { id: 'adapt', label: 'Adapt it and share the result', role: 'incorporated', operations: ['placed', 'recoloured'], route: 'file-with-c2pa', canCarryCredential: true, canCarryReadableCredit: true },
  { id: 'redistribute', label: 'Pass on the source files themselves', role: 'source-distribution', operations: ['placed'], route: 'package', canCarryCredential: true, canCarryReadableCredit: true },
  { id: 'stripped', label: 'Post it where metadata is removed', role: 'incorporated', operations: ['placed'], route: 'connector', canCarryCredential: false, canCarryReadableCredit: false },
];

/**
 * The answer to one reuse question, in the same words the export panel uses. A
 * licence with conditions is stated, never styled as a broken asset, and the
 * status is the evaluator's own so a terminal and this page cannot disagree.
 */
export function reuseAnswerHtml(report: VerifyReport, checkId: string): string {
  const check = REUSE_CHECKS.find((c) => c.id === checkId);
  if (!check) return '';
  const evaluation = evaluateReuse(rightsSourceReport(report), {
    operation: check.role === 'source-distribution' ? 'package' : 'send',
    delivery: {
      format: report.format ?? '',
      route: check.route,
      canCarryCredential: check.canCarryCredential,
      canCarryReadableCredit: check.canCarryReadableCredit,
    },
    audience: 'public',
  }, { role: check.role, operations: check.operations });
  const head = evaluation.status === 'ready'
    ? t('Nothing is left to decide for this use, on what this file records.')
    : evaluation.status === 'unknown'
      ? t('Some of what this use needs is not recorded here.')
      : evaluation.status === 'use-not-covered'
        ? t('A recorded licence does not cover this use.')
        : t('This use needs a decision from you.');
  const issues = evaluation.issues.map((issue) =>
    `<li><span class="valid-reuse-code">${escape(issue.code)}</span> ${escape(issue.summary)}</li>`).join('');
  return `<p class="valid-reuse-head">${escape(head)}</p>${issues ? `<ul class="valid-reuse-issues">${issues}</ul>` : ''}`;
}

// The assertion/validation log, boxed as a panel matching Change history - the raw,
// per-check result behind the hero scorecard's eight collapsed pips (every
// hashed-URI assertion, the claim signature, the certificate window, the hard
// binding, trust). Paired with stepsHtml() into .valid-panels so "what happened"
// and "what was checked" read as two distinct boxes, side by side when there's room.
function checksHtml(report: VerifyReport): string {
  if (!report.checks.length) return '';
  return `
    <details class="valid-checks-panel valid-panel valid-panel-disclosure"${disclosureOpenAttr()}>
      <summary class="valid-panel-summary">
        <span class="valid-panel-summary-title">${svgIcon('checklist')}<span>${t('Assertion log')}</span></span>
        <span class="valid-panel-summary-meta">${t('{n} checks', { n: report.checks.length })}</span>
        <span class="valid-disclosure-chev" aria-hidden="true">${ICON_CHEVRON}</span>
      </summary>
      <ul class="valid-checks">${report.checks.map(checkRow).join('')}</ul>
    </details>`;
}

// ── Uploaded-media preview ──────────────────────────────────────────────────
// A look at the actual file being checked: a large view at the top of the card,
// a smaller one beside the embedded metadata. Images and video render inline;
// PDF gets the browser's native viewer; formats a browser can't decode (TIFF,
// MKV) fall back to a labelled placeholder. The object URL is owned by handle().
// A text payload has no pixels to show, so its "preview" is the text itself - 
// the first ~2 KB, escaped into a <pre>. That is the only faithful preview a
// pasted HTML document or an armoured source file has, and rendering it as
// MARKUP (in an iframe, say) would be showing the reader a browser's
// interpretation of an unverified document rather than its bytes.
type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none';

const PREVIEW_IMG = new Set(['png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif']);
const PREVIEW_VID = new Set(['mp4', 'm4v', 'mov', 'webm']);
// Audio-only formats get an <audio> player. The m4a/opus entries matter twice
// over: an .m4a SNIFFS as 'mp4' (same BMFF container), so only its extension
// says "this is audio, not a black video box".
const PREVIEW_AUD = new Set(['mp3', 'wav', 'ogg', 'opus', 'm4a']);
// Raster formats a <canvas> can decode to RGBA - shared by the Lolly-Imprint/
// LSB pixel pass (mountValid's pixelChecks) AND the TrustMark deep-scan
// button's gating (deepScanBlock below), so both agree on what's checkable.
// SVG is deliberately excluded even though it's in PREVIEW_IMG: watermarks
// live in RASTER pixels, and rasterising a vector for the sake of a scan
// would be meaningless (there is no pixel grid to have carried a mark).
// DELIBERATELY unchanged by the text-payload work: a watermark lives in raster
// pixels, and there are none in a text file - no format below is text.
const WM_DECODABLE = new Set(['png', 'apng', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);
// The three C2PA 2.4 text bindings. Keyed on the SNIFFED format only (never on
// the file extension): 'code'/'text' mean "a C2PA carrier was found in this
// text", which no extension can tell us.
const PREVIEW_TEXT = new Set(['html', 'code', 'text']);
// Plain-text file EXTENSIONS (plans/125). A .txt/.md carries no C2PA credential,
// so verifyC2pa returns format:null and the sniff-based PREVIEW_TEXT never fires -
// yet these files ARE the payload a user wants to inspect and check for AI
// provenance. When the format sniff is empty, a known text extension makes it a
// text preview so its bytes show AND the text-signal (AI-likelihood) analysis runs.
const TEXT_EXT = new Set(['md', 'markdown', 'txt', 'text']);
export function previewKind(format: string | null, name: string): PreviewKind {
  const f = (format || name.split('.').pop() || '').toLowerCase();
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (PREVIEW_IMG.has(f)) return 'image';
  if (PREVIEW_AUD.has(f) || PREVIEW_AUD.has(ext)) return 'audio';
  if (PREVIEW_VID.has(f)) return 'video';
  if (f === 'pdf') return 'pdf';
  // The sniffed C2PA text carriers, OR a plain-text extension when nothing was sniffed.
  if (PREVIEW_TEXT.has(f) || (!format && TEXT_EXT.has(f))) return 'text';
  return 'none';
}
// `notes` is the resolved text-binding/paste model (valid-text.ts), built by the
// caller because it needs the page origin, the address the file was read from
// and whether it arrived through the clipboard - none of which this renderer
// should know about. Empty for every ordinary binary drop, which is why the
// whole feature is invisible on those paths.
function renderReportBody(fileName: string, report: VerifyReport, meta: FileMetadata | undefined, preview: Preview | undefined, fileIndex: number, watermark?: Watermark, mine?: LocalExportMatch, seal?: SealVerifyResult, notes: VerifyNotice[] = [], textSignals?: TextSignalPanel, ocrReady = false): string {
  const { state, sub, identity } = resolveState(report);
  const claim: Partial<Claim> = report.claim ?? {};
  const signer: Partial<Signer> = report.signer ?? {};
  const env: Record<string, string | number | boolean> & { inputs?: Record<string, string> } = report.environment ?? {};
  const signedAt = claim.actions?.find((a) => a.when)?.when;
  const generator = claim.generatorInfo?.name
    ? `${claim.generatorInfo!.name}${claim.generatorInfo!.version ? ' ' + claim.generatorInfo!.version : ''}`
    : claim.claimGenerator;
  // AI declaration (credential or bare metadata) + the extra scorecard pips it
  // and the steganalysis reads imply - see deriveAi/aiMarkPip/stegoPips.
  const { origin: aiOrigin, makerHint } = deriveAi(report, meta);
  const pips = extraPips(aiOrigin, makerHint, preview?.kind === 'video', meta);
  // SEAL is a byte-level signal computed alongside C2PA (see sealPip): its pip
  // rides with the other watermark/provenance pips in the hero scorecard.
  const sp = sealPip(seal);
  if (sp) pips.push(sp);
  // Who signed: the device credential's OIDC email when present, else the
  // organisation / common name from a CA signer's certificate (Google, Adobe,
  // Microsoft… carry no SAN email). Only shown when the chain reached a pinned
  // anchor (identity set) - an org name alone is never proof.
  const signerWho = identity ? (identity.email || signer.organization || signer.commonName) : null;
  const identityLine = (identity && signerWho) ? `
          <p class="valid-identity-line">${report.trusted
    ? t('Signed by <strong>{who}</strong> - identity verified by <strong>{issuer}</strong>', { who: signerWho, issuer: identity!.issuer ?? t('a recognised C2PA root') })
    : t('Signed by <strong>{who}</strong> - identity was CA-verified; the certificate has since expired', { who: signerWho })}</p>` : '';
  // "Made from", "what happened" and "what was checked" - distinct boxed panels,
  // paired with the file/facts summary so they share one row wherever the page
  // has the room (see .valid-panels). madeFromBlock is placed ahead of stepsBlock
  // in panelsBlock below so it reads (and, on narrow viewports, stacks) directly
  // above change history.
  // The recreate CTA rides the digest panel only when the claim's own content is
  // trustworthy (made / likely-made with Lolly - the digest IS a Lolly assertion)
  // AND the recorded tool name resolves against this build's tool index.
  const recreate = (report.madeWithLolly || report.likelyMadeWithLolly) ? resolveRecreateTool(env.tool, env.toolId) : undefined;
  // The recorded tool name when it exists but is not in this catalogue - e.g. a
  // brand-pack file verified on the public instance (plans/143 V1). The digest
  // then offers the gallery instead of nothing.
  const missingTool = !recreate && (report.madeWithLolly || report.likelyMadeWithLolly) && typeof env.tool === 'string' && env.tool.trim()
    ? env.tool.trim() : undefined;
  const madeFromBlock = report.found && report.claim ? inputsDigestHtml(env.inputs, recreate ? { ...recreate, fileIndex } : undefined, missingTool) : '';
  const stepsBlock = report.found && report.claim ? stepsHtml(report) : '';
  // A synthetic-voice step's recorded script (its own panel, between "made
  // from" and "what happened" - it is source material, not an event).
  const scriptBlock = report.found && report.claim ? scriptHtml(report) : '';
  // "Sources" reads with "Made from" and the script: all three are material that
  // went in, distinct from the history of what was done to it.
  const sourcesBlock = report.found ? sourcesHtml(report, fileIndex) : '';
  const checksBlock = checksHtml(report);
  const selfnoteBlock = report.found && report.claim && !report.madeWithLolly ? `
        <p class="valid-selfnote guide-absent">${identity
    ? t('As recorded in the credential - asserted by its CA-verified signer:')
    : t('As recorded in the credential - self-asserted by whoever signed it:')}</p>` : '';
  const factsBlock = report.found && report.claim ? `
        <dl class="valid-facts">
          ${fact(t('Title'), claim.title, 'tag')}
          ${fact(t('Tool'), env.tool && env.toolVersion ? `${env.tool} ${env.toolVersion}` : env.tool, 'tool')}
          ${fact(t('Produced by'), report.author ? `${report.author.name}${report.author.email ? ` <${report.author.email}>` : ''}` : null, 'user')}
          ${fact(t('Contact'), report.author?.url ?? null, 'link')}
          ${fact(t('Rights / licence'), report.rights ?? null, 'badgeCheck')}
          ${fact(report.delivered ? t('Delivered by') : t('Made with'), generator, report.delivered ? 'package' : 'lollipop')}
          ${fact(t('Signed'), signedAt ? fmtDate(signedAt) : null, 'clock')}
          ${fact(t('Where'), [env.surface, env.engine, env.os].filter(Boolean).join(' · ') || null, 'globe')}
          ${fact(t('Size'), env.dimensions, 'image')}
          ${fact(t('Signer'), signer.commonName, 'seal')}
          ${fact(t('Identity'), identity?.email, 'mail')}
          ${fact(t('Issuer'), identity ? identity.issuer
    : signer.organization ? `${signer.organization} ${signer.selfSigned ? t('(self-signed, on-device)') : t('(unverified - does not chain to a trust anchor)')}` : null, 'building')}
          ${fact(t('Algorithm'), signer.alg, 'cpu')}
          ${fact(t('Certificate valid'), signer.notBefore ? `${fmtDate(signer.notBefore)} → ${fmtDate(signer.notAfter)}` : null, 'calendar')}
          ${fact(t('Manifest'), claim.manifestLabel, 'document')}
          ${fact(t('C2PA version'), report.specVersion ?? null, 'checklist')}
        </dl>` : '';
  const summaryBlock = report.found ? `
      <details class="valid-summary valid-panel valid-panel-disclosure"${disclosureOpenAttr()}>
        <summary class="valid-panel-summary">
          <span class="valid-panel-summary-title">${svgIcon('document')}<span>${t('File & credential details')}</span></span>
          <span class="valid-panel-summary-meta">${escape(fileName)}</span>
          <span class="valid-disclosure-chev" aria-hidden="true">${ICON_CHEVRON}</span>
        </summary>
        <div class="valid-panel-body">
          <p class="valid-file"><strong>${escape(fileName)}</strong>${formatChip(report.format)}${report.reason ? ` - ${escape(report.reason)}` : ''}</p>
          ${selfnoteBlock}
          ${factsBlock}
        </div>
      </details>` : '';
  const panelsBlock = `<div class="valid-panels">${madeFromBlock}${scriptBlock}${sourcesBlock}${summaryBlock}${checksBlock}${renderMetadata(meta, fileIndex)}</div>`;
  // The two "key validations" + the signed-by caption shown under the "Made with
  // Lolly" pill - only for the flagship lolly hero; every other good state keeps
  // the single prose sub + identityLine above.
  const signedByCa = identity?.issuer || signer.organization || signer.commonName;
  const lollyValidationsHtml = state === STATE_COPY.lolly ? `
          <div class="valid-hero-vbadges">
            <div class="valid-vbadge"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('seal')}</span><span>${t('The credential is intact and records a Lolly export')}</span></div>
            <div class="valid-vbadge"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('hash')}</span><span>${t('This file has not changed since it was made')}</span></div>
          </div>
          <p class="valid-hero-signedby">${identity
    ? t('Signed with <strong>{ca}</strong> Certificate Authority.', { ca: signedByCa ?? t('a Certificate Authority') })
    : t('Signed with an on-device key, not a CA identity.')}</p>` : '';
  // Mirrors lollyValidationsHtml's badge treatment for the broken-credential
  // verdict - three plain facts instead of one sentence to parse.
  // The third badge is an INFERENCE, not a fact - and when a note below already
  // names the known innocent cause of this mismatch (a carrier re-serialized on
  // its way through the clipboard), stamping "Modified after signing" over the
  // top of it would be the page contradicting itself in favour of the accusation.
  // The two factual badges stay: a credential is here, and these bytes are not
  // the ones it hashed. Same rule as the expired-cert lesson.
  // ...and the OTHER two badges are inferences too, from the one row that can
  // support them: a failed hard binding. `resolveState` now routes the states
  // where no hash mismatch was established (a carrier problem, an exclusion
  // carve-out, an external credential) to their own heroes, but the gate is
  // re-asserted here on the evidence itself rather than on the state identity - 
  // "Bytes no longer match" must never be printed over a report whose own check
  // list says the data hash is valid.
  const knownCauseMismatch = suppressModifiedBadge(notes);
  const invalidBadgesHtml = state === STATE_COPY.invalid && hashFailed(report) ? `
          <div class="valid-hero-vbadges">
            <div class="valid-vbadge is-fail"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('seal')}</span><span>${t('Content Credentials detected')}</span></div>
            <div class="valid-vbadge is-fail"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('hash')}</span><span>${t('Bytes no longer match')}</span></div>
            ${knownCauseMismatch ? '' : `<div class="valid-vbadge is-fail"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('pen')}</span><span>${t('Modified after signing')}</span></div>`}
          </div>` : '';
  // The middle-ground verdict: mixed tones in one badge group, unlike the pure
  // pass (lolly) or pure fail (invalid) groups above - two green facts about
  // the MANIFEST's own content (still trustworthy) and one amber fact about
  // the FILE's current bytes (can't be vouched for).
  const likelyLollyBadgesHtml = state === STATE_COPY.likelyLolly ? `
          <div class="valid-hero-vbadges">
            <div class="valid-vbadge"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('seal')}</span><span>${t("The credential's own content checks out")}</span></div>
            <div class="valid-vbadge"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('lollipop')}</span><span>${t('It records a Lolly creation')}</span></div>
            <div class="valid-vbadge is-warn"><span class="valid-vbadge-ic" aria-hidden="true">${svgIcon('hash')}</span><span>${t("This file's bytes no longer match")}</span></div>
          </div>` : '';
  // When there's no C2PA credential, lead the hero with the strongest positive
  // signal (made on this device / Lolly Imprint) as a green pill, rather than a
  // bare grey "No Content Credentials" - the actual C2PA absence stays in the sub.
  const noCredSignal = noCredentialSignal(report, watermark, mine);
  const verdictHtml = report.madeWithLolly
    ? `<span class="valid-hero-pill valid-hero-pill--lolly"><span class="valid-lolly-badge" aria-hidden="true">🍭</span>${escape(t(state.title))}</span>`
    : report.likelyMadeWithLolly
      ? `<span class="valid-hero-pill valid-hero-pill--likely-lolly"><span class="valid-lolly-badge" aria-hidden="true">🍭</span>${escape(t(state.title))}</span>`
      : report.trusted
        ? `<span class="valid-hero-pill valid-hero-pill--trusted"><span class="valid-trusted-badge" aria-hidden="true">✓</span>${escape(t(state.title))}</span>`
        : noCredSignal
          ? `<span class="valid-hero-pill valid-hero-pill--lolly"><span class="valid-lolly-badge" aria-hidden="true">🍭</span>${escape(noCredSignal)}</span>`
          : `<span class="valid-hero-verdict">${escape(t(state.title))}</span>`;
  // A file whose intact chain records Lolly steps without being a Lolly creation
  // gets the amber lolly pill BESIDE the main verdict - credit for the Lolly leg
  // without claiming the whole file (see engine partsMadeWithLolly).
  const partsPill = report.partsMadeWithLolly
    ? ` <span class="valid-hero-pill valid-hero-pill--likely-lolly" title="${escape(t('The provenance chain records steps made with Lolly, but the file as it stands was produced by another tool.'))}"><span class="valid-lolly-badge" aria-hidden="true">🍭</span>${t('Parts made with Lolly')}</span>`
    : '';
  // The illumination strip: four lamps, one glance, C2PA leading. Cues come
  // from the pure model (valid-text.ts); labels/words localise here.
  const lamps: TrustLamp[] = verifyLampCues({
    report,
    watermarkPresent: !!watermark?.present,
    sealFound: !!seal?.found,
    sealValid: !!seal?.valid,
    aiLikely: !!makerHint,
    ...(textSignals ? { panel: textSignals } : {}),
  }).map((c) => ({ id: c.id, label: t(c.id === 'provenance' ? 'Credentials & marks' : c.id === 'origin' ? 'AI origin' : c.label), state: c.state, word: t(c.word), ...(c.detail ? { detail: t(c.detail) } : {}) }));
  const lampStrip = lamps.some((lamp) => lamp.state !== 'unlit') ? lampStripHtml(lamps) : '';

  // The completeness receipt: what ran, what could not, and why - the
  // negative space made visible, with the report-card and keep actions.
  const receiptInput: ReceiptInput = {
    imprintScannable: isDeepScannable(report.format, fileName),
    sealScanned: seal !== undefined,
    textAnalysed: !!textSignals,
    pixelSourced: !!textSignals?.pixelSourced,
    textReadable: preview?.kind === 'image' || report.format === 'pdf' || report.format === 'svg',
    ocrReady,
    rewordReady: rewordAvailable(),
    detectorStaged: aiDetectAvailable(),
  };
  const receiptRows = verifyReceiptModel(receiptInput);
  const counts = receiptCounts(receiptRows);
  const receiptHtml = `
    <div class="valid-receipt" data-lamp-section="receipt">
      <p class="guide-fact">${escape(tRaw('{ran} checks ran on this device · {not} could not run or did not apply · nothing was fetched.', { ran: counts.ran, not: counts.not }))}</p>
      <details class="valid-receipt-list"><summary>${escape(t('See every check'))}</summary>
        <ul>${receiptRows.map((r) => r.status === 'ran'
          ? `<li class="valid-receipt-ran">${escape(t(r.name))}</li>`
          : `<li class="valid-receipt-not">${escape(t(r.name))} - <span class="guide-absent">${escape(t(r.why ?? ''))}</span></li>`).join('')}</ul>
      </details>
      <div class="valid-receipt-actions">
        <button type="button" class="btn" data-report-card data-file-index="${fileIndex}">${svgIcon('seal')}<span>${t('Save a signed report card')}</span></button>
        <button type="button" class="btn" data-add-catalog data-file-index="${fileIndex}">${svgIcon('package')}<span>${t('Keep in my catalogue with these findings')}</span></button>
      </div>
    </div>`;

  // Unwitnessed files: absence framed deliberately, with language to hand a
  // colleague - the request itself evangelises credentials.
  const askCred = !report.found && !noCredSignal && !watermark?.present ? `
    <div class="valid-askcred">
      <button type="button" class="btn" data-ask-cred data-file-name="${escape(fileName)}">${svgIcon('seal')}<span>${t('Copy a note asking for credentials')}</span></button>
    </div>` : '';

  return `
    <div class="valid-result ${state.cls}" data-actions-index="${fileIndex}">
      <div class="valid-top">
        <div class="valid-hero">
          <div class="valid-hero-title">
            <span class="valid-hero-icon">${report.madeWithLolly || noCredSignal
    ? '<span class="valid-hero-logo" aria-hidden="true"></span>'
    : ICON_SHIELD}</span>
            <h2><span class="valid-hero-filename">${escape(fileName)}</span> ${verdictHtml}${partsPill}</h2>
          </div>
          ${state === STATE_COPY.lolly ? lollyValidationsHtml
    : state === STATE_COPY.likelyLolly ? likelyLollyBadgesHtml
    // Keyed on the badge markup existing, not on the state: an invalid report
    // with no hash failure produces none, and falls back to the prose sub that
    // resolveState reworded for exactly that case.
    : invalidBadgesHtml ? invalidBadgesHtml
      : `${report.found ? `<p>${sub}</p>` : ''}${identityLine}`}
        </div>
        ${report.found || watermark?.present || pips.length ? scorecardHtml(report, watermark, pips) : ''}
      </div>
      <div class="valid-origin-layout">${provenanceOverviewHtml(report, meta)}${mediaPreviewHtml(preview, fileIndex)}</div>
      ${lampStrip}
      ${stepsBlock ? `<div class="valid-journey-feature" data-lamp-section="provenance">${stepsBlock}</div>` : ''}
      ${contextCardsHtml(report, meta)}
      <div data-lamp-section="provenance"><span data-lamp-section="integrity"></span>${panelsBlock}</div>
      ${askCred}
      ${deepScanBlock(fileIndex, report.format, fileName)}
      <div data-lamp-section="origin">
      ${aiFlagHtml(aiOrigin, makerHint, preview?.kind === 'audio')}
      ${aiDisclosureHtml(report, identity)}
      </div>
      <div data-lamp-section="signals">
      ${textSignalsHtml(textSignals)}
      ${(preview?.kind === 'image' && (ocrReady || report.format === 'svg')) || report.format === 'pdf' ? `<div class="valid-tsig-ocr">
        <button type="button" class="btn valid-ocr-read" data-ocr-read data-read-kind="${report.format === 'pdf' ? 'pdf' : report.format === 'svg' ? 'svg' : 'image'}" data-file-index="${fileIndex}">${svgIcon('aiSpark')}<span>${report.format === 'pdf' ? t('Read the text in this document') : report.format === 'svg' ? t('Read the text in this vector') : t('Read the text in this image')}</span></button>
        <div class="valid-ocr-result" data-ocr-result hidden></div>
      </div>` : ''}
      </div>
      ${notesHtml(notes, fileIndex)}
      ${mine ? mineNote(mine) : ''}
      ${claimPanelHtml(fileIndex, report.format, fileName, report.found)}
      ${watermarkNote(watermark)}
      ${imprintRescanBlock(fileIndex, report.format, fileName, !!watermark?.present, report.madeWithLolly)}
      ${sealNoteHtml(seal)}
      ${appendedPayloadHtml(meta, fileIndex)}
      ${receiptHtml}
      ${report.found ? deviceNote(report.format === 'webm' || report.format === 'mkv'
    ? t("<strong>Checked entirely on this device</strong> - the file was not uploaded. WebM has no standardised C2PA container mapping yet, so this credential is Lolly's own Matroska attachment: only Lolly (here and via <code>lolly validate</code>) can read it - external C2PA viewers don't support WebM at all.")
    : identity
      ? tRaw("<strong>Checked entirely on this device</strong> - the file was not uploaded. The signer's identity was verified against the Lolly CA root pinned in this app (the same root <code>lolly validate --trust-anchor</code> uses). Validators that don't pin that root - {link}, or <code>c2patool</code> without <code>--trust_anchors</code> - still show the signer as an unknown source.", { link: '<a href="https://verify.contentauthenticity.org/" target="_blank" rel="noopener">verify.contentauthenticity.org</a>' })
      : tRaw('<strong>Checked entirely on this device</strong> - the file was not uploaded. The same file on {link} reads the same, with the signer shown as an unknown source (there is no CA behind an on-device key - by design).', { link: '<a href="https://verify.contentauthenticity.org/" target="_blank" rel="noopener">verify.contentauthenticity.org</a>' })) : ''}
    </div>`;
}

// ─── Claim / add-your-credentials (the embed write flow, folded into /verify) ──
//
// /verify is no longer read-only: under each file's report a viewer can add their
// OWN Content Credential - author, copyright, licence - which is layered ON TOP of
// whatever the file already carries (the existing chain is preserved as ingredients,
// never replaced; see host.c2pa.sign + collectIngredients). This is the same signing
// path the Embed, Imprint & Track tool uses; hosting it here means "inspect the
// credentials, then claim the file" is one surface. The signed file downloads and
// the panel re-verifies in place so the viewer immediately sees their claim on the chain.

/**
 * Licence options offered when claiming a file - mirrors community/claim
 * (option value = the exact string embedded as dc:rights, incl. the CC deed URL).
 *
 * The first option is empty and means exactly what it says: no public licence was
 * declared. It is NOT a retained-rights notice, which is the second option and
 * writes a notice of its own. Those are different facts about a file, and the
 * empty value used to be labelled as the second one, which said something the
 * claimant never chose (plan 253, section 9.3).
 */
export const CLAIM_LICENCES: Array<{ value: string; label: string }> = [
  { value: '', label: 'No public licence declared' },
  { value: 'All rights reserved', label: 'All rights reserved - a retained-rights notice' },
  { value: 'CC0 1.0 (Public Domain) · https://creativecommons.org/publicdomain/zero/1.0/', label: 'CC0 1.0 - Public Domain' },
  { value: 'CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/', label: 'CC BY 4.0 - Attribution' },
  { value: 'CC BY-SA 4.0 · https://creativecommons.org/licenses/by-sa/4.0/', label: 'CC BY-SA 4.0 - Attribution-ShareAlike' },
  { value: 'CC BY-ND 4.0 · https://creativecommons.org/licenses/by-nd/4.0/', label: 'CC BY-ND 4.0 - Attribution-NoDerivatives' },
  { value: 'CC BY-NC 4.0 · https://creativecommons.org/licenses/by-nc/4.0/', label: 'CC BY-NC 4.0 - Attribution-NonCommercial' },
  { value: 'CC BY-NC-SA 4.0 · https://creativecommons.org/licenses/by-nc-sa/4.0/', label: 'CC BY-NC-SA 4.0 - NonCommercial-ShareAlike' },
  { value: 'CC BY-NC-ND 4.0 · https://creativecommons.org/licenses/by-nc-nd/4.0/', label: 'CC BY-NC-ND 4.0 - NonCommercial-NoDerivatives' },
  { value: 'Public Domain Mark 1.0 · https://creativecommons.org/publicdomain/mark/1.0/', label: 'Public Domain Mark - already public domain' },
];

/**
 * What the claimant says their claim rests on. Signing records the sentence, not
 * a finding: uploading a file is not ownership of it, and a Lolly signature says
 * who asserted this and that the bytes match, never that the assertion is true.
 */
export const CLAIM_BASIS: Array<{ value: string; label: string; sentence: string }> = [
  { value: 'author', label: 'I created this work', sentence: 'Credentials added by the claimant, who asserts they created this work.' },
  { value: 'contribution', label: 'I hold rights in my own contribution', sentence: 'Credentials added by the claimant, who asserts rights in their own contribution and not in the rest of the work.' },
  { value: 'distribution', label: 'I am authorised to distribute this work', sentence: 'Credentials added by the claimant, who asserts they are authorised to distribute this work.' },
];

/**
 * What a stripped file no longer carries, said plainly, with the credit it used
 * to carry beside it and a way to deliver that credit some other way.
 *
 * The stripped bytes are never restamped. A privacy control that quietly put a
 * credential back would not be one, so the remedy is a package: the clean file
 * and CREDITS.txt together (plan 253, section 10.2). Empty when nothing was
 * recorded, so an ordinary private file gets no note it does not need.
 */
export function stripCreditNoteHtml(fileIndex: string, format: string, sources: { count: number; credits: string }): string {
  if (!sources.count || !sources.credits) return '';
  return `${t('All embedded metadata removed. This file no longer carries its source credits ({n} sources); include the accompanying credit when sharing.', { n: sources.count })}
      <button type="button" class="btn valid-source-act" data-copy-credit="${escape(sources.credits)}">${t('Copy credit')}</button>
      <button type="button" class="btn valid-source-act" data-clean-copy="${escape(fileIndex)}" data-clean-format="${escape(format)}" data-clean-package="1">${t('Clean file with separate credits')}</button>`;
}

/**
 * The `dc:rights` line one claim writes: the copyright notice the claimant typed
 * and the licence they chose, in that order, and nothing else.
 *
 * Three distinct outcomes, which is the whole point of the chooser above. No
 * public licence declared writes no licence line at all; All rights reserved
 * writes that notice; a public licence writes its name and deed URL. The profile
 * is never a source of either field, so nobody is given a licence or an ownership
 * claim they did not make (plan 253, section 9.3).
 */
export function claimRights(copyright: string, licence: string): string {
  return [copyright, licence].map((s) => String(s || '').trim()).filter(Boolean).join(' · ');
}

/** The engine format key + MIME + whether it takes the pixel Imprint, for a verify
 *  format string / filename - the claimable set (what host.c2pa.sign can carry a
 *  credential in). Null → the file can't be credentialed, so no claim panel. Mirrors
 *  the embed tool's _formatKey so both surfaces agree on what is claimable. */
function claimFormatFor(format: string | null | undefined, fileName: string): { key: string; mime: string; raster: boolean } | null {
  const f = String(format || '').toLowerCase();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const is = (k: string, e?: string): boolean => f === k || (!!e && ext === e);
  if (is('jpg', 'jpg') || is('jpeg', 'jpeg') || f === 'jpeg') return { key: 'jpg', mime: 'image/jpeg', raster: true };
  if (is('png', 'png')) return { key: 'png', mime: 'image/png', raster: true };
  if (is('webp', 'webp')) return { key: 'webp', mime: 'image/webp', raster: true };
  if (is('avif', 'avif')) return { key: 'avif', mime: 'image/avif', raster: false };
  if (is('tiff', 'tiff') || ext === 'tif') return { key: 'tiff', mime: 'image/tiff', raster: false };
  if (is('gif', 'gif')) return { key: 'gif', mime: 'image/gif', raster: false };
  if (is('svg', 'svg')) return { key: 'svg', mime: 'image/svg+xml', raster: false };
  if (is('pdf', 'pdf')) return { key: 'pdf', mime: 'application/pdf', raster: false };
  if (f === 'mp4' || ext === 'mp4' || ext === 'mov' || ext === 'm4v') return { key: 'mp4', mime: 'video/mp4', raster: false };
  if (is('webm', 'webm')) return { key: 'webm', mime: 'video/webm', raster: false };
  if (ext === 'm4a' || f === 'm4a') return { key: 'm4a', mime: 'audio/mp4', raster: false };
  if (f === 'mp3' || ext === 'mp3') return { key: 'mp3', mime: 'audio/mpeg', raster: false };
  if (f === 'wav' || ext === 'wav') return { key: 'wav', mime: 'audio/wav', raster: false };
  return null;
}

/** The per-file "Add your credentials" action card. Fields start blank; the
 *  author/contact are filled from the opted-in profile after mount (prefillClaim,
 *  which honours the profile's "Use my details" gate). Copyright + licence are
 *  NEVER auto-filled - they are user-asserted. A collapsible panel so it sits quietly
 *  under the report until a viewer wants to claim the file. */
function claimPanelHtml(fileIndex: number, format: string | null | undefined, fileName: string, hasCredential: boolean): string {
  const fk = claimFormatFor(format, fileName);
  if (!fk) return ''; // not a format we can carry a credential in
  const chainNote = hasCredential
    ? t('Your claim is added on top of the existing credential - the chain already on this file is preserved, not replaced.')
    : t('This adds the first Content Credential to the file - your authorship, on the file itself.');
  const durableRow = fk.raster ? `
        <label class="valid-claim-check">
          <input type="checkbox" data-claim-durable="${fileIndex}">
          <span>${t('Also add a durable invisible watermark')} <span class="valid-claim-hint">${t('survives screenshotting')}</span></span>
        </label>` : '';
  const licenceOpts = CLAIM_LICENCES.map(l =>
    `<option value="${escape(l.value)}">${escape(t(l.label))}</option>`).join('');
  const basisOpts = CLAIM_BASIS.map(b =>
    `<option value="${escape(b.value)}">${escape(t(b.label))}</option>`).join('');
  return `
      <details class="valid-panel valid-claim" data-claim-panel="${fileIndex}" data-claim-key="${escape(fk.key)}" data-claim-mime="${escape(fk.mime)}" data-claim-raster="${fk.raster ? '1' : ''}">
        <summary class="valid-claim-summary">
          <span class="valid-claim-ic" aria-hidden="true">${svgIcon('pen')}</span>
          <span class="valid-claim-title">${t('Add your credentials')}</span>
          <span class="valid-claim-chev" aria-hidden="true">${ICON_CHEVRON}</span>
        </summary>
        <div class="valid-claim-body">
          <p class="valid-claim-note">${escape(chainNote)}</p>
          <label class="valid-claim-field">
            <span>${t('Artist / author')}</span>
            <input type="text" class="valid-claim-input" data-claim-author="${fileIndex}" autocomplete="name" placeholder="${escape(t('Your name'))}">
          </label>
          <label class="valid-claim-field">
            <span>${t('Contact')} <span class="valid-claim-hint">${t('optional')}</span></span>
            <input type="text" class="valid-claim-input" data-claim-contact="${fileIndex}" autocomplete="email" placeholder="${escape(t('Email or site for licensing'))}">
          </label>
          <label class="valid-claim-field">
            <span>${t('Copyright notice')} <span class="valid-claim-hint">${t('optional')}</span></span>
            <input type="text" class="valid-claim-input" data-claim-copyright="${fileIndex}" placeholder="© 2026 ${escape(t('Your Name'))}">
          </label>
          <label class="valid-claim-field">
            <span>${t('Claiming as')}</span>
            <select class="field-select valid-claim-select" data-claim-basis="${fileIndex}">${basisOpts}</select>
          </label>
          <label class="valid-claim-field">
            <span>${t('Rights / licence')}</span>
            <select class="field-select valid-claim-select" data-claim-licence="${fileIndex}">${licenceOpts}</select>
          </label>
          <p class="valid-claim-note">${t('Your answer is recorded as your own assertion. Signing says who asserted it and that the bytes match, never that it is proven.')}</p>
          ${durableRow}
          <div class="valid-claim-actions">
            <button type="button" class="btn valid-claim-sign" data-claim-sign="${fileIndex}">${t('Sign & download')}</button>
            <span class="valid-claim-status" data-claim-status="${fileIndex}" aria-live="polite"></span>
          </div>
          <p class="valid-claim-foot">${t('Signed on your device with your Lolly identity (or a self-signed key). Nothing is uploaded.')}</p>
        </div>
      </details>`;
}

export async function mountValid(viewEl: HTMLElement, host: HostV1, params = ''): Promise<void> {
  document.title = 'Verify an asset - Lolly';
  // Whether an image can be read for text on this device (a staged OCR model exists).
  // Gates the "Read the text in this image" affordance in an image report.
  const ocrReady = host.ocr?.isAvailable() === true && (host.ocr?.models().length ?? 0) > 0;

  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="platform-layout valid-layout">
      <header class="plat-header">
        <h1 class="plat-title">${t('Verify an asset')}</h1>
        <div class="plat-header-text">
          <p class="plat-sub">${t("Inspect Content Credentials, software, creators, dates, locations and rights. Files stay on this device.")}</p>
        </div>
        <div class="valid-header-actions" aria-label="${escape(t('Verify another item'))}">
          <button type="button" class="btn" data-check-more>${svgIcon('document')}<span>${t('Choose other files')}</span></button>
          <button type="button" class="btn" data-result-paste>${svgIcon('clipboard')}<span>${t('Paste text')}</span></button>
        </div>
      </header>

      <div class="valid-intake">
        <div class="valid-drop" data-drop tabindex="0" role="button" aria-label="${escape(t('Choose or drop files to verify'))}">
          <input type="file" multiple accept=".pdf,.pptx,.docx,.png,.apng,.jpg,.jpeg,.gif,.svg,.tif,.tiff,.webp,.avif,.mp4,.m4v,.mov,.m4a,.webm,.mkv,.mp3,.wav,.opus,.html,.htm,.js,.css,.md,.txt,application/pdf,${PPTX_MIME},${DOCX_MIME},image/png,image/jpeg,image/gif,image/svg+xml,image/tiff,image/webp,image/avif,video/mp4,video/webm,video/x-matroska,audio/mp4,audio/mpeg,audio/wav,audio/x-wav,.ogg,audio/ogg,audio/opus,text/*" hidden>
          <span class="valid-drop-icon" aria-hidden="true">${ICON_SHIELD}</span>
          <!-- Two leads, both rendered, one shown per pointer type (valid.css): a coarse
               pointer gets the tap affordance, a mouse keeps the drop sentence. The zone
               is ITSELF the button (role=button above), so this is its visible label, not
               a nested control - no second tab stop, no double picker on click. -->
          <span class="btn btn--primary valid-drop-cta">${t('Choose files')}</span>
          <strong class="valid-drop-lead">${t('Drop files here')}</strong>
          <span class="valid-drop-hint">${verifyFormatChips()}</span>
          <span>${t('Choose one or more files, or paste text.')}</span>
        </div>

        <div class="valid-paste">
          <button type="button" class="btn valid-paste-open" data-paste-open aria-expanded="false" aria-controls="valid-paste-panel">${t('Paste text')}</button>
          <div class="valid-paste-panel" id="valid-paste-panel" data-paste-panel hidden>
            <label class="valid-paste-label" for="valid-paste-text">${t('Paste the text, markup or source you want to check')}</label>
            <textarea id="valid-paste-text" class="valid-paste-text" data-paste-text rows="8" spellcheck="false" autocomplete="off"></textarea>
            <div class="valid-paste-actions">
              <button type="button" class="btn valid-paste-verify" data-paste-verify>${t('Verify this text')}</button>
              <button type="button" class="btn valid-paste-cancel" data-paste-cancel>${t('Cancel')}</button>
            </div>
            <p class="valid-paste-foot">${t('The text is checked on this device, exactly as pasted. Invisible characters matter here - a C2PA text credential is made of them - so paste rather than retype.')}</p>
          </div>
        </div>
      </div>

      <div class="valid-report" data-report hidden></div>
    </div>
  `;
  armViewEnter(viewEl, '.tools-home, .plat-header, .valid-drop');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  const drop = viewEl.querySelector<HTMLElement>('[data-drop]')!;
  const input = drop.querySelector<HTMLInputElement>('input[type="file"]')!;
  const reportEl = viewEl.querySelector<HTMLElement>('[data-report]')!;
  const layoutEl = viewEl.querySelector<HTMLElement>('.valid-layout')!;
  const enterResultMode = (): void => {
    layoutEl.classList.add('has-results');
    layoutEl.classList.remove('is-pasting');
  };

  // The view's own liveness. A watermark job outlives this view by design (WP-F),
  // and every paint it can do asks this first: a detection that lands after the
  // user navigated away is counted and dropped, never written into a detached DOM.
  // CHAINED onto `_cleanup`, not assigned - another mount may already own one (see
  // the paste listener's chain further down).
  let viewAlive = true;
  {
    const el = viewEl as HTMLElement & { _cleanup?: () => void };
    const prev = el._cleanup;
    el._cleanup = wireTextHandoffs(viewEl, () => { prev?.(); viewAlive = false; });
  }

  // Verify one file's bytes, returning its C2PA report, its embedded metadata
  // (EXIF/XMP/… - PDF via the shell's pdf bridge, everything else on the engine),
  // or an error message. Kept narrow so both the single- and multi-file paths
  // share the exact engine call. Bytes are read once and reused for both reads.
  // `externalManifest` is only ever set by fetchExternalManifest below - the
  // credential this page fetched, at the user's explicit request, from a
  // same-origin address the document itself named (engine 1.116.0). Every other
  // caller passes nothing and gets byte-identical behaviour.
  async function verifyFile(file: File, opts: { externalManifest?: Uint8Array } = {}): Promise<{ report?: VerifyReport; error?: string; meta?: FileMetadata; watermark?: Watermark; mine?: LocalExportMatch; seal?: SealVerifyResult; snippet?: { body: string; more: boolean }; textSignals?: TextSignalPanel }> {
    try {
      if (file.size > MAX_VERIFY_BYTES) {
        return { error: t('File is too large to verify here (over {n} MB).', { n: Math.round(MAX_VERIFY_BYTES / 1024 / 1024) }) };
      }
      await updateVerifyProgress(reportEl, 'bytes', activeFiles.indexOf(file));
      const bytes = new Uint8Array(await file.arrayBuffer());
      await updateVerifyProgress(reportEl, 'credentials', activeFiles.indexOf(file));
      const report = await verifyC2pa(bytes, opts.externalManifest ? { ...VERIFY_OPTS, externalManifest: opts.externalManifest } : VERIFY_OPTS);
      // SEAL runs on the same bytes, fully on-device and with NO key resolver:
      // the web shell deliberately passes none, so verification here makes zero
      // network requests of any kind. A record carrying its key inline (`pk=`)
      // still verifies completely offline; one whose key lives in DNS reports
      // "no key resolver" rather than reaching out to a third-party DoH service.
      // Browsers can't do raw DNS, so any web-side lookup would mean handing a
      // resolver operator the domain plus the user's IP - see docs/privacy.md.
      // The Node shells (CLI/TUI/Tauri) can resolve natively and do.
      await updateVerifyProgress(reportEl, 'seal', activeFiles.indexOf(file));
      const seal = await verifySeal(bytes);
      await updateVerifyProgress(reportEl, 'metadata', activeFiles.indexOf(file));
      const meta = await readVerifyMetadata(host, bytes, file);
      if (WM_DECODABLE.has(report.format || '')) await updateVerifyProgress(reportEl, 'pixels', activeFiles.indexOf(file));
      let { watermark, lsb } = await pixelChecks(file, report.format) ?? {};
      // A container file (.pptx / PDF) can carry the Imprint inside an embedded
      // raster even though the file itself isn't one Lolly signs directly. Only
      // scan when the top-level pixel check found no mark of its own.
      if (!watermark?.present) {
        if (report.format === 'pdf' || looksLikePptxFile(file)) await updateVerifyProgress(reportEl, 'container', activeFiles.indexOf(file));
        const embedded = await containerImprintScan(file, report.format, bytes);
        if (embedded?.present) watermark = embedded;
      }
      // The LSB verdict rides on the metadata object (it's "what the file
      // quietly carries", same as the appended-payload read) - one object
      // through the render pipeline instead of another parallel param.
      if (meta && lsb) {
        meta.lsb = lsb;
        if (lsb.suspicious) {
          meta.fields.push({ label: 'LSB analysis', value: t('pixel pair statistics match LSB steganography'), group: 'technical', sensitive: true });
        }
      }
      await updateVerifyProgress(reportEl, 'history', activeFiles.indexOf(file));
      const mine = await localExportByHash(bytes);
      // The text bindings' stand-in for the image preview. Decoded from the
      // bytes we already hold (no second read), non-fatally, and only for the
      // three formats the sniffer identified AS text - an extension never
      // decides this, and a binary file is never decoded as if it were text.
      let snippet: { body: string; more: boolean } | undefined;
      let textSignals: TextSignalPanel | undefined;
      // A .docx is a zip, so the format sniff never calls it text - yet its PROSE is
      // exactly what an AI-writing check wants. Routed off the declared name/type
      // first and the part map second (isDocx, inside the reader), the way the pptx
      // container scan routes. The extracted markdown then takes the SAME path a .md
      // file takes below: escaped text in the <pre> preview, nothing parsed as
      // markup, no URL minted, no network. Unreadable → the ordinary binary report.
      let docxText: string | undefined;
      if (looksLikeDocxFile(file)) {
        try {
          const { docxToMarkdown } = await import('../lib/office-text.ts');
          docxText = (await docxToMarkdown(bytes)).markdown;
        } catch { /* not a readable Word document - leave it as a plain binary drop */ }
      }
      if (docxText !== undefined || previewKind(report.format, file.name) === 'text') {
        // Two caps, and the panel must not confuse them: only the first 64 KB is
        // decoded at all (a 200 MB text file must not become a 200 MB string for
        // a preview), and only the first ~2 KB of THAT is shown. So the caption
        // counts what is on screen rather than claiming a total it cannot know.
        const head = bytes.subarray(0, 64 * 1024);
        // The docx's text is already extracted and whole - only the raw-bytes path
        // has a 64 KB decode window to report on.
        const decoded = docxText ?? new TextDecoder('utf-8', { fatal: false }).decode(head);
        const cut = textSnippet(decoded);
        snippet = { body: cut.body, more: cut.omitted > 0 || (docxText === undefined && bytes.length > head.length) };
        // Read the (same, already-decoded) text for AI-generation signals. The bytes
        // ARE the text, so the byte-level artifact tier applies - source 'digital'.
        // An image would need OCR (host.ocr, not yet wired) and pass source 'ocr'.
        // HTML is the exception: its PROSE is analysed, not its markup - raw page
        // bytes detect as docKind 'code' (the inline-CSS head), which gates every
        // prose tell off, and a built page's head alone can outgrow the 64 KB cap
        // before any prose appears. Same extraction the docs reader's donut runs,
        // so the two numbers agree. Decode bounded at 4 MB (extractHtmlText caps
        // its output at 64 KB); an empty extract falls back to the raw head.
        const ext = (report.format || file.name.split('.').pop() || '').toLowerCase();
        const prose = ext === 'html' || ext === 'htm'
          ? (await import('./doc-read.ts')).extractHtmlText(
              new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 4 * 1024 * 1024)))
          : '';
        await updateVerifyProgress(reportEl, 'text', activeFiles.indexOf(file));
        textSignals = analyzeVerifyText(prose || decoded, 'digital');
      }
      return { report, meta, watermark, mine, seal, snippet, textSignals };
    } catch (err) {
      return { error: (err as Error)?.message || String(err) };
    }
  }

  // "You made this here": match the checked bytes back to this device's own export
  // history by SHA-256 (the contentHash recordExport stores at download time). The
  // history is read once per mount; no hashing at all when no entry carries a hash
  // (pre-hash records, insecure contexts). Best-effort - never fails a verify.
  let exportsByHash: Map<string, { href: string; at: number }> | null = null;
  async function localExportByHash(bytes: Uint8Array): Promise<LocalExportMatch | undefined> {
    try {
      if (!exportsByHash) {
        const { listExports, exportReopenHref } = await import('../lib/export-history.ts');
        // listExports is newest-first; reverse so a re-downloaded file's NEWEST
        // record wins the Map (last set for a duplicate hash).
        exportsByHash = new Map((await listExports(24))
          .filter((e) => e.contentHash)
          .reverse()
          .map((e) => [e.contentHash!, { href: exportReopenHref(e), at: e.at }]));
      }
      if (!exportsByHash.size) return undefined;
      const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      return exportsByHash.get(hex);
    } catch { return undefined; }
  }

  // Decode a raster file to RGBA once and run every pixel-domain check on it:
  // the engine's Lolly-Imprint detector, plus chi-square LSB steganalysis for
  // PNG (the real-world LSB carrier - a lossy format's decoded LSBs are codec
  // noise, not hidden bits, so the analysis would be meaningless there).
  // NB: no downscale - the Imprint must see native-resolution pixels (a resize
  // shifts the 8×8 grid and erases the mark). Best-effort; anything we can't
  // decode (TIFF, SVG, PDF, video) or that faults returns undefined.
  async function pixelChecks(file: File, format: string | null): Promise<{ watermark?: Watermark; lsb?: FileMetadata['lsb'] } | undefined> {
    const fmt = (format || file.name.split('.').pop() || '').toLowerCase();
    if (!WM_DECODABLE.has(fmt)) return undefined;
    let bmp: ImageBitmap | undefined;
    try {
      bmp = await createImageBitmap(file);
      const w = bmp.width, h = bmp.height;
      if (w < 8 || h < 8) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);
      // FAST PATH: a pristine (un-cropped, un-resized) Lolly export detects on this
      // single pass at zero extra cost - the dominant real-world outcome. Only on a
      // MISS do we pay for the crop-recovery offset search (Tier 1: 64 block-phase
      // offsets, NO resample), so an un-resized file stays instant. The resample-
      // heavy scale search (Tier 2) is opt-in per file - never run automatically here.
      const r = detectWatermark(data, { width: w, height: h });
      let present = r.present, score = r.score;
      if (!r.present) {
        const searched = await detectWatermarkSearch(data, { width: w, height: h }, { tier: 1 });
        if (searched.present) {
          present = true; score = searched.score;
          host.log('debug', 'valid: pixel search recovered mark', {
            tier: searched.tier, scale: searched.scale, offsetX: searched.offsetX, offsetY: searched.offsetY,
            hypothesesTried: searched.hypothesesTried, score: +searched.score.toFixed(4),
          });
        }
      }
      const lsb = fmt === 'png' ? analyzeLsb(data, { width: w, height: h }) : undefined;
      return {
        watermark: { present, score },
        lsb: lsb ? { suspicious: lsb.suspicious, score: lsb.score } : undefined,
      };
    } catch {
      return undefined;
    } finally {
      bmp?.close?.();
    }
  }

  // ── Lolly Imprint inside a container file's embedded rasters ─────────────
  // A .pptx or PDF isn't a raster Lolly signs directly, but it can CARRY rasters
  // Lolly rendered (a rasterised slide, a baked CSS fallback) that hold the
  // pixel Imprint. We decode each embedded image at its NATIVE stored resolution
  // (no resize - the mark rides an 8×8 grid a resize would shift) and run the
  // engine detector. Only a POSITIVE hit surfaces (absence is uninformative and
  // must never read as "not made with Lolly"); the unzip/pdf-parse + canvas
  // decode stay shell-side, the enumeration + detection math are engine-pure.
  const CONTAINER_IMG_CAP = 48; // hard bound on images decoded from one container
  const YIELD_EVERY = 6;        // cooperative yield so a big deck doesn't jank the tab

  // Decode encoded image bytes (png/jpeg) to RGBA via a canvas - the same 4-step
  // path pixelChecks uses, but from a byte blob rather than the dropped File.
  async function decodeBytesToRgba(bytes: Uint8Array, mime: string): Promise<{ data: Uint8ClampedArray; width: number; height: number } | undefined> {
    let bmp: ImageBitmap | undefined;
    try {
      bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
      const w = bmp.width, h = bmp.height;
      if (w < 8 || h < 8) return undefined; // too small to carry a mark (detector no-ops anyway)
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);
      return { data, width: w, height: h };
    } catch {
      return undefined;
    } finally {
      bmp?.close?.();
    }
  }

  // First embedded image whose pixels clear the Imprint threshold wins - we stop
  // there (presence-only; no count is claimed). Returns the strongest score seen
  // so the caller can log even a near-miss. Never throws.
  async function scanRgbaImages(items: Array<{ bytes: Uint8Array; mime: string }>): Promise<{ present: boolean; score: number; scanned: number }> {
    let best = 0, scanned = 0;
    for (let i = 0; i < items.length; i++) {
      const rgba = await decodeBytesToRgba(items[i]!.bytes, items[i]!.mime);
      if (!rgba) continue;
      scanned++;
      const r = detectWatermark(rgba.data, { width: rgba.width, height: rgba.height });
      if (r.score > best) best = r.score;
      if (r.present) return { present: true, score: r.score, scanned };
      if (scanned % YIELD_EVERY === 0) await new Promise((res) => setTimeout(res, 0));
    }
    return { present: false, score: best, scanned };
  }

  // .pptx → unzip (fflate, shell-side), enumerate ppt/media/*.{png,jpg,jpeg}
  // (engine pptxMediaImages), decode + detect. Best-effort; never throws.
  async function pptxImprintScan(bytes: Uint8Array): Promise<Watermark | undefined> {
    try {
      const parts = await inflatePptx(bytes);
      if (!isPptx(parts)) return undefined;
      const media = pptxMediaImages(parts, CONTAINER_IMG_CAP);
      if (!media.length) {
        // A native-vector deck (text boxes, roundRect shapes, gradient/solid fills)
        // holds no raster in ppt/media at all - so there is nothing an 8×8-block
        // pixel Imprint could ride. This is the EXPECTED structure of an ordinary
        // deck-builder/deck-studio export, not a broken scan: absence stays
        // uninformative and surfaces NOTHING negative. Logged (neutral) so the
        // trail explains why a green deck reads clean.
        host.log('debug', 'valid: pptx has no raster media; Lolly Imprint only rides embedded raster images, not vector slides');
        return undefined;
      }
      const items: Array<{ bytes: Uint8Array; mime: string }> = [];
      for (const m of media) {
        const b = parts[m.path];
        if (b instanceof Uint8Array) items.push({ bytes: b, mime: m.mime });
      }
      const r = await scanRgbaImages(items);
      host.log('debug', 'valid: pptx imprint scan', { media: media.length, scanned: r.scanned, present: r.present, score: +r.score.toFixed(4) });
      // r.present === false here means the deck's rasters are byte-faithful USER
      // uploads (photos, an SVG logo's PNG fallback) - correctly unmarked, not a
      // failed detect. Still surface nothing; never render absence as "clean".
      return r.present ? { present: true, score: r.score, embedded: true } : undefined;
    } catch { return undefined; }
  }

  // PDF → decode the DCTDecode (JPEG) + non-predictor Flate RGB/Gray image
  // XObjects at native resolution (extractPdfImageBytes, pdf-lib), detect.
  // GAP (logged, not faked): FlateDecode-with-PNG-predictor rasters
  // - what a future imprint-on-embed would write into a PDF - and JPX/CCITT/JBIG2
  // images are NOT decodable by this path yet, so a mark inside one is invisible
  // here. A pure-VECTOR Lolly PDF (QR, lockup) carries no raster XObject at all,
  // so it can hold no pixel Imprint by construction. We surface only real hits
  // and record what we couldn't read, so "no hit" is never shown as "clean".
  async function pdfImprintScan(file: File): Promise<Watermark | undefined> {
    try {
      const { extractPdfImageBytes } = await import('./pdf-import.ts');
      const { images, skipped, skippedFilters } = await extractPdfImageBytes(file, { max: CONTAINER_IMG_CAP });
      if (skipped > 0) {
        host.log('info', 'valid: pdf imprint scan skipped undecodable images', { skipped, filters: skippedFilters });
      }
      if (!images.length) return undefined;
      const r = await scanRgbaImages(images);
      host.log('debug', 'valid: pdf imprint scan', { images: images.length, scanned: r.scanned, present: r.present, score: +r.score.toFixed(4) });
      return r.present ? { present: true, score: r.score, embedded: true } : undefined;
    } catch (err) {
      host.log('warn', 'valid: pdf imprint scan failed', { error: (err as Error)?.message });
      return undefined;
    }
  }

  // Dispatch a container file to its embedded-raster Imprint scan. Only runs when
  // the top-level pixel check found nothing (a raster Lolly signs directly is
  // handled there); a non-container file returns undefined and shows nothing.
  async function containerImprintScan(file: File, format: string | null, bytes: Uint8Array): Promise<Watermark | undefined> {
    if (looksLikePptxFile(file)) return pptxImprintScan(bytes);
    if (format === 'pdf' || /\.pdf$/i.test(file.name)) return pdfImprintScan(file);
    return undefined;
  }

  // ── Deep scan for watermarks (Adobe TrustMark) ──────────────────────────
  // A SEPARATE decode from pixelChecks' - deliberately: pixelChecks always
  // runs (every verify), so keeping it free of anything that would pull in
  // onnxruntime-web is what makes the default /verify path stay instant.
  // This one only runs when the user clicks the button, and imports
  // lib/trustmark.ts lazily right there.
  async function decodeToRgba(file: File): Promise<{ data: Uint8ClampedArray; width: number; height: number } | undefined> {
    let bmp: ImageBitmap | undefined;
    try {
      bmp = await createImageBitmap(file);
      const w = bmp.width, h = bmp.height;
      if (w < 8 || h < 8) return undefined;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, w, h);
      return { data, width: w, height: h };
    } catch {
      return undefined;
    } finally {
      bmp?.close?.();
    }
  }

  // Injects a detected deep-scan pip into the report's LIVE hero scorecard - 
  // positioned RIGHT AFTER the "Made with Lolly" verdict pip (always the first
  // pip), NOT appended after the eight C2PA checks: a real TrustMark/Content Seal
  // read is a top-line provenance signal and belongs beside the verdict. Multiple
  // hits cluster in call order (marked with data-deepscan-pip so the second lands
  // after the first). If the report had no scorecard at all (a file with no C2PA,
  // no Lolly Imprint and no AI declaration), one is created from scratch. Mutates
  // the live DOM rather than re-rendering, so scroll/open-<details>/masonry are
  // undisturbed. Also mirrored into the collapsed row's mini scorecard.
  function injectDeepScanPip(deepscanEl: HTMLElement, pip: ScorecardItem): void {
    // Tag the pip so a later hit inserts after it, keeping the cluster ordered.
    const tag = (html: string): string => html.replace('<li ', '<li data-deepscan-pip ');
    // Place `html` right after the verdict pip (list.firstElementChild) or after
    // the last already-injected deep-scan pip; fall back to append on an empty list.
    const place = (list: HTMLElement, html: string): void => {
      const injected = list.querySelectorAll<HTMLElement>(':scope > [data-deepscan-pip]');
      const anchor = injected.length ? injected[injected.length - 1]! : list.firstElementChild;
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
      else list.insertAdjacentHTML('beforeend', html);
    };

    const resultCard = deepscanEl.closest<HTMLElement>('.valid-result');
    const scoreList = resultCard?.querySelector<HTMLElement>('.valid-score:not(.valid-score--mini)');
    const pipHtml = tag(scorecardPipHtml(pip, 0));
    if (scoreList) {
      place(scoreList, pipHtml);
      const wrap = scoreList.closest<HTMLElement>('.valid-score-wrap');
      let toggle = wrap?.querySelector<HTMLButtonElement>('[data-score-toggle]');
      const count = scoreList.children.length;
      if (!toggle && count > 4 && wrap) {
        toggle = appendScoreToggle(wrap, count, t('Show all {n} checks', { n: count }));
      }
      if (toggle) {
        toggle.dataset.scoreCount = String(count);
        if (toggle.getAttribute('aria-expanded') !== 'true') toggle.textContent = t('Show all {n} checks', { n: count });
      }
    } else {
      deepscanEl.insertAdjacentHTML('beforebegin',
        `<div class="valid-score-wrap"><ul class="valid-score" aria-label="${escape(t('Verification checks at a glance'))}">${pipHtml}</ul></div>`);
    }
    // Mirror into the collapsed row's MINI scorecard (multi-file cards only - 
    // single-file reports have no summary), so a hit shows in the summary without
    // expanding. Create the mini list if the summary had none. Same "after the
    // verdict pip" placement as the full scorecard.
    const summary = deepscanEl.closest<HTMLElement>('.valid-item')?.querySelector<HTMLElement>(':scope > .valid-item-summary');
    if (summary) {
      let mini = summary.querySelector<HTMLElement>('.valid-score--mini');
      if (!mini) {
        mini = document.createElement('ul');
        mini.className = 'valid-score valid-score--mini';
        mini.setAttribute('aria-hidden', 'true');
        summary.insertBefore(mini, summary.querySelector('.valid-item-chev'));
      }
      place(mini, tag(miniScorePipHtml(pip)));
    }
  }

  /**
   * The per-file deep-scan slot to paint into, or null when there is nothing to
   * paint into any more: the view was torn down, or a different batch is on
   * screen. Resolved at PAINT time and never captured, so a job that outlives its
   * view counts its hits and writes into a detached DOM exactly never.
   *
   * The trade that falls out of it: leave mid-scan and come back to the same files
   * and the pips will not appear, because the run that owns them belongs to the
   * mount you left (and the no-double-start guard rightly refuses a second scan of
   * the same batch). The toast's completion count is what tells you the answer in
   * that case - which is exactly why that announcement exists.
   */
  function livePaintTarget(fileIndex: number, key: string): { block: HTMLElement; result: HTMLElement } | null {
    if (!viewAlive || batchKey(activeFiles) !== key) return null;
    const block = reportEl.querySelector<HTMLElement>(`[data-deepscan-block="${fileIndex}"]`);
    const result = block?.querySelector<HTMLElement>(`[data-deepscan-result="${fileIndex}"]`);
    return block?.isConnected && result ? { block, result } : null;
  }

  // Passive per-file scan: decode the file's pixels ONCE, run BOTH detectors
  // (Adobe TrustMark + Meta Content Seal) in cacheOnly mode (NEVER downloads -
  // that's the header banner's one-time job), and - ONLY on a positive
  // detection - inject that maker's green/amber pip + note. Absence is never
  // shown as a verdict (per plans/31-watermark-detectors.md): a negative or
  // not-installed scan stays silent, and the count it returns is what the job's
  // completion announcement is built from. Runs at most once per file per batch.
  //
  // Keyed by BATCH, not by bare index: a job outlives the drop it started from, so
  // a plain index set would let a still-running old scan mark a newly dropped
  // file's slot as already done.
  const scannedKeys = new Set<string>();
  async function scanOne(fileIndex: number, batch: readonly File[], key: string): Promise<number> {
    const mark = `${key}#${fileIndex}`;
    const file = batch[fileIndex];
    if (!file || scannedKeys.has(mark)) return 0;
    scannedKeys.add(mark);
    let found = 0;
    try {
      const [pixels, { detectTrustmark }, { detectContentSeal }] = await Promise.all([
        decodeToRgba(file),
        import('../lib/trustmark.ts'),
        import('../lib/contentseal.ts'),
      ]);
      if (!pixels) return 0;
      const [tm, cs] = await Promise.all([
        detectTrustmark(pixels.data, pixels.width, pixels.height, { cacheOnly: true }),
        detectContentSeal(pixels.data, pixels.width, pixels.height, { cacheOnly: true }),
      ]);
      // Count first, paint second: a hit is a hit whether or not anyone is still
      // looking at the report it belongs to.
      if (tm.status === 'detected') found++;
      if (cs.status === 'detected') found++;
      const target = found ? livePaintTarget(fileIndex, key) : null;
      if (!target) return found;
      const { block, result: resultEl } = target;
      if (tm.status === 'detected') {
        // A Lolly-owned durable id is the more specific answer - show it INSTEAD
        // of the generic TrustMark pip; otherwise fall back to the neutral one.
        if (tm.lolly) {
          injectDeepScanPip(block, lollyDurablePip());
          resultEl.insertAdjacentHTML('beforeend', lollyDurableNoteHtml(tm.schema ?? ''));
        } else {
          injectDeepScanPip(block, trustmarkPip());
          resultEl.insertAdjacentHTML('beforeend', trustmarkNoteHtml(tm.payloadHex ?? '', tm.schema ?? ''));
        }
      }
      if (cs.status === 'detected') {
        injectDeepScanPip(block, contentSealPip());
        resultEl.insertAdjacentHTML('beforeend', contentSealNoteHtml(cs.messageHex ?? ''));
      }
      block.hidden = false;
    } catch (err) {
      // Passive + best-effort: never surface a failure inline (models may just
      // not be cached). scannedKeys stays set so it isn't retried on a
      // re-expand; the header banner is the path to (re)enable.
      host.log('warn', 'valid: passive deep scan failed', { error: (err as Error)?.message });
    }
    return found;
  }

  /** The indexes in the current batch whose pixels a browser decode can read. */
  function decodableIndexes(): number[] {
    const out: number[] = [];
    for (let i = 0; i < activeFiles.length; i++) if (isDeepScannable(null, activeFiles[i]!.name)) out.push(i);
    return out;
  }

  /**
   * The header banner's compact status. The JOB owns the run now - this is the
   * convenience mirror for whoever is still looking at the report, and it goes
   * quiet the moment the banner leaves the document. That `isConnected` check is
   * the detached-DOM write this conversion removes.
   */
  function paintBanner(banner: HTMLElement | null, done: number, total: number, note?: string): void {
    if (!banner?.isConnected) return;
    const msg = banner.querySelector<HTMLElement>('[data-deepscan-banner-msg]');
    const bar = banner.querySelector<HTMLElement>('[data-deepscan-progress]');
    const fill = banner.querySelector<HTMLElement>('[data-deepscan-progress-fill]');
    if (msg && note) msg.textContent = note;
    if (!bar || !fill) return;
    bar.removeAttribute('hidden');
    if (total > 0) {
      bar.classList.remove('is-indeterminate');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuenow', String(Math.min(done, total)));
      fill.style.width = `${Math.min(100, (done / total) * 100)}%`;
    } else {
      bar.classList.add('is-indeterminate');
      bar.removeAttribute('aria-valuenow');
      bar.removeAttribute('aria-valuemax');
    }
  }

  /**
   * The one-time detector download, run as the scan job's FIRST stage so the
   * ~90 MB and the pass over the files share a single bar. Resolves false when
   * TrustMark could not be made ready (the run then ends before any file is
   * touched); Content Seal is best-effort, as it usually isn't vendored at all.
   *
   * `startedX` distinguishes "never fetched" (a 404 that fires before a single
   * onProgress call - the common Content Seal case) from "fetching, size unknown",
   * so a model that simply isn't there can't drag the whole bar indeterminate.
   *
   * No AbortSignal reaches the fetch (lib/ort.ts's fetcher takes none), so a
   * cancel here lands between the two downloads and before the scan.
   */
  async function downloadDetectors(sink: ScanJobSink): Promise<boolean> {
    let loadedTm = 0, totalTm: number | null = null, startedTm = false;
    let loadedCs = 0, totalCs: number | null = null, startedCs = false;
    const report = (): void => {
      const loaded = loadedTm + loadedCs;
      const totalKnown = (!startedTm || totalTm != null) && (!startedCs || totalCs != null);
      const total = totalKnown ? (totalTm ?? 0) + (totalCs ?? 0) : 0;
      sink.progress(loaded, total, total > 0
        ? t('Downloading the detector… {loaded} of {total}', { loaded: formatMb(loaded), total: formatMb(total) })
        : t('Downloading the detector… {loaded} so far', { loaded: formatMb(loaded) }));
    };

    const [{ prefetchTrustmarkModels }, { prefetchContentSealModel }] = await Promise.all([
      import('../lib/trustmark.ts'),
      import('../lib/contentseal.ts'),
    ]);
    sink.progress(0, 0, t('Downloading the detector (~90 MB, once)…'));
    const ok = await prefetchTrustmarkModels({
      onProgress: (p) => { startedTm = true; loadedTm = p.loaded; totalTm = p.total; report(); },
    });
    if (!ok || sink.cancelled) return false;
    await prefetchContentSealModel({
      onProgress: (p) => { startedCs = true; loadedCs = p.loaded; totalCs = p.total; report(); },
    }).catch(() => false); // best-effort; usually absent
    return true;
  }

  /**
   * Register the whole batch's scan as ONE heavy job: optional detector download,
   * then every decodable file in order with i-of-N progress. Returns null when
   * there is nothing to scan, or when a scan of exactly these files is already
   * running - the no-double-start guard a re-entered view relies on.
   *
   * The batch is captured by value, so the run keeps scanning the files it was
   * started for even if a new drop replaces them on screen (those results are
   * counted and simply not painted; see livePaintTarget).
   */
  function startBatchScan(opts: { download?: boolean; banner?: HTMLElement | null } = {}): JobHandle | null {
    const indexes = decodableIndexes();
    if (!indexes.length) return null;
    const batch = activeFiles.slice();
    const key = batchKey(batch);
    const banner = opts.banner ?? null;
    return startScanJob(key, t('Checking for invisible watermarks'), async (sink) => {
      if (opts.download) {
        const ready = await downloadDetectors(sink);
        // Cancel is checked FIRST: a stopped download is the user's own doing and
        // must not surface as "couldn't download", which is what the throw below says.
        if (sink.cancelled) return { scanned: 0, positives: 0, cancelled: true };
        if (!ready) throw new Error(t('Couldn’t download the watermark detector. Check your connection and try again.'));
        // Consent given and spent: the toast carries the scan from here.
        if (banner?.isConnected) banner.remove();
      }
      return runScanBatch(sink, indexes, (i) => scanOne(i, batch, key));
    }, {
      onProgress: (done, total, note) => paintBanner(banner, done, total, note),
      onError: () => {
        if (!banner?.isConnected) return;
        const msg = banner.querySelector<HTMLElement>('[data-deepscan-banner-msg]');
        const bar = banner.querySelector<HTMLElement>('[data-deepscan-progress]');
        const enableBtn = banner.querySelector<HTMLButtonElement>('[data-deep-scan-enable]');
        if (msg) msg.textContent = t('Couldn’t download the watermark detector. Check your connection and try again.');
        bar?.setAttribute('hidden', '');
        if (enableBtn) enableBtn.disabled = false;
      },
      onDone: (r) => {
        // A cancel puts the banner back the way it was, so Enable stays available.
        if (!r.cancelled || !banner?.isConnected) return;
        const bar = banner.querySelector<HTMLElement>('[data-deepscan-progress]');
        const enableBtn = banner.querySelector<HTMLButtonElement>('[data-deep-scan-enable]');
        bar?.setAttribute('hidden', '');
        if (enableBtn) enableBtn.disabled = false;
      },
    });
  }

  // Opt-in Tier-2 "resized Imprint" search (imprintRescanBlock's button). Re-decode
  // the file's pixels ONCE, run the full scale×offset grid, and - only on a hit - 
  // inject the standard Lolly-Imprint pip + note in place (injectDeepScanPip, same
  // DOM-mutation path as the deep-scan pips, so scroll/masonry/open-state survive).
  // A miss updates the button quietly; absence never reads as "not made with Lolly".
  //
  // A WP-F job like the batch scan (see the deep-scan job section): several hundred
  // correlations over a re-decoded image is long enough to deserve the toast's bar
  // rather than a frozen button label, and it survives leaving the page. Its cancel
  // is the honest one available here - the engine's grid search takes no signal, so
  // ✕ stops the run before the decode or between the decode and the search, and
  // always discards whatever came back; a search already inside the grid keeps
  // burning its (bounded, budgeted) hypotheses until it returns.
  function rescanImprint(btn: HTMLButtonElement): void {
    const fileIndex = Number(btn.dataset.imprintRescan);
    const batch = activeFiles.slice();
    const file = batch[fileIndex];
    if (!file) return;
    const key = batchKey(batch, `imprint:${fileIndex}`);
    const original = btn.textContent;
    // Same late resolution as livePaintTarget: never captured, so a result landing
    // after a teardown or a new drop is dropped rather than written to a dead DOM.
    const liveBtn = (): HTMLButtonElement | null =>
      (viewAlive && batchKey(activeFiles) === batchKey(batch) && btn.isConnected) ? btn : null;

    const job = startScanJob(key, t('Searching for a resized Imprint'), async (sink) => {
      const pixels = await decodeToRgba(file);
      if (!pixels) {
        const b = liveBtn();
        if (b) b.textContent = t('Couldn’t read this image.');
        return { scanned: 1, positives: 0, cancelled: false };
      }
      if (sink.cancelled) return { scanned: 0, positives: 0, cancelled: true };
      sink.progress(0, 0, t('Searching the pixels…'));
      const found = await detectWatermarkSearch(pixels.data, { width: pixels.width, height: pixels.height }, { tier: 2 });
      if (sink.cancelled) return { scanned: 1, positives: 0, cancelled: true };
      if (found.present) {
        host.log('debug', 'valid: tier-2 imprint search recovered mark', {
          scale: found.scale, offsetX: found.offsetX, offsetY: found.offsetY,
          hypothesesTried: found.hypothesesTried, score: +found.score.toFixed(4),
        });
      }
      const b = liveBtn();
      const block = b ? reportEl.querySelector<HTMLElement>(`[data-imprint-rescan-block="${fileIndex}"]`) : null;
      const resultEl = block?.querySelector<HTMLElement>(`[data-imprint-rescan-result="${fileIndex}"]`);
      if (b && block && resultEl) {
        if (found.present) {
          injectDeepScanPip(b, lollyImprintPip());
          block.outerHTML = watermarkNote({ present: true, score: found.score });
        } else {
          b.textContent = t('No resized Imprint found');
          resultEl.insertAdjacentHTML('beforeend',
            `<span class="valid-wm-rescan-miss">${t('This image carries no recoverable Lolly Imprint. That doesn’t rule out a Lolly origin - an aggressive downscale erases the Imprint entirely.')}</span>`);
        }
      }
      return { scanned: 1, positives: found.present ? 1 : 0, cancelled: false };
    }, {
      // The Imprint is Lolly's own mark, so it gets its own wording rather than the
      // generic third-party-watermark count.
      announce: () => t('Resized Lolly Imprint recovered'),
      onDone: (r) => {
        // A cancelled run hands the button back; a completed one already said its piece.
        const b = r.cancelled ? liveBtn() : null;
        if (b) { b.disabled = false; b.textContent = original; }
      },
      onError: (err) => {
        const b = liveBtn();
        if (b) { b.disabled = false; b.textContent = original; }
        host.log('warn', 'valid: tier-2 imprint search failed', { error: (err as Error)?.message });
      },
    });
    if (!job) return;   // this exact search is already running - don't start a second
    btn.disabled = true;
    btn.textContent = t('Searching the pixels…');
  }

  /** `bytes` → "12.3 MB", for the download-progress label. Low-bandwidth by
   *  design: one decimal place, no locale-aware NumberFormat machinery. */
  function formatMb(bytes: number): string {
    return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  }

  // The header banner's one-time "Enable" - download the detectors ONCE (network
  // allowed) so the whole batch benefits, then scan everything from cache. Both
  // stages are ONE background job now: the banner keeps a compact status while it
  // is on screen, but the toast is what survives leaving the page, and the ✕ there
  // is the only way to stop the run (there was none before).
  function enableDeepScan(btn: HTMLButtonElement): void {
    const banner = btn.closest<HTMLElement>('[data-deepscan-banner]');
    const msg = banner?.querySelector<HTMLElement>('[data-deepscan-banner-msg]');
    const job = startBatchScan({ download: true, banner });
    if (!job) {
      // Either a scan of exactly these files is already queued or running (a
      // re-entered view, or a second click), or the batch holds nothing a pixel
      // decode can read. Say which, rather than starting a duplicate.
      btn.disabled = true;
      if (msg) {
        msg.textContent = scanJobActive(batchKey(activeFiles))
          ? t('Already checking these images. See the progress toast.')
          : t('There is nothing here to scan for watermarks.');
      }
      return;
    }
    btn.disabled = true;
    if (msg) msg.textContent = t('Downloading the detector (~90 MB, once)…');
    paintBanner(banner ?? null, 0, 0);
  }

  // After a batch renders: if the detector models are already on-device, scan
  // everything automatically (no decision for the user). If not, show ONE
  // consent banner at the top of the report so a single download serves the whole
  // batch. Never auto-downloads. `hasDecodable` guards against showing the banner
  // for a PDF/SVG/video-only batch that can't be deep-scanned at all.
  async function armDeepScan(hasDecodable: boolean): Promise<void> {
    if (!hasDecodable) return;
    let ready = false;
    try {
      const { trustmarkModelsReady } = await import('../lib/trustmark.ts');
      ready = await trustmarkModelsReady();
    } catch { ready = false; }
    // One heavy job for the whole batch. It was completely silent before - a minute
    // of invisible CPU on a big drop; the toast now says a scan is running and how
    // far it has got, while the REPORT keeps its silent-on-negative rule and still
    // shows nothing but positives.
    if (ready) { startBatchScan(); return; }
    const decodableCount = activeFiles.filter((f) => isDeepScannable(null, f.name)).length;
    reportEl.insertAdjacentHTML('afterbegin', deepScanBannerHtml(decodableCount));
  }

  // A collapsed report whose credential check failed to even run (unreadable bytes).
  function errorSummary(fileName: string, message: string): string {
    return `<summary class="valid-item-summary">
        <span class="valid-item-badge is-bad">${t('Error')}</span>
        <span class="valid-item-name">${escape(fileName)}</span>
        <span class="valid-item-chev" aria-hidden="true">${ICON_CHEVRON}</span>
      </summary>
      <div class="valid-item-body"><p class="valid-busy">${t('Could not check this file: {message}', { message })}</p></div>`;
  }

  // Object URLs minted for the media previews. Revoked wholesale at the start of
  // the next check so a fresh drop never leaks the previous batch's blobs.
  let previewUrls: string[] = [];
  function makePreview(file: File, report?: VerifyReport, snippet?: { body: string; more: boolean }): Preview {
    // A snippet only ever exists for a payload verifyFile READ as text - the sniffed
    // text carriers, a plain-text extension, or a .docx it extracted - so its presence
    // is what makes this a text preview, not the container the bytes arrived in.
    const kind = snippet ? 'text' : previewKind(report?.format ?? null, file.name);
    const format = report?.format || (file.name.split('.').pop() || '');
    // A text preview is the decoded snippet, never a blob URL: nothing loads the
    // file, so there is nothing to revoke and no way for a pasted document to be
    // fetched back as a resource.
    const url = kind === 'none' || kind === 'text' ? undefined : URL.createObjectURL(file);
    if (url) previewUrls.push(url);
    return { url, kind, format, name: file.name, thumbnail: pdfPreviewFor(file), pages: pdfPageCountFor(file), ...(snippet ? { snippet } : {}) };
  }

  // The File objects behind the current batch of reports, indexed exactly like the
  // cards/reportBody calls below - so a "download a cleaned copy" click (delegated
  // on reportEl, see wireCleanCopy) can re-read the right file's bytes on demand
  // rather than holding every batch's bytes in memory between renders.
  let activeFiles: File[] = [];
  // Each report's scalar-input digest, same indexing - what a [data-recreate]
  // click (the "Recreate with these settings" CTA) seeds the tool link from.
  let activeDigests: Array<Record<string, string> | undefined> = [];
  // The reports behind the current batch, same indexing - what the Sources
  // panel's "Check for this use" re-reads. Held rather than recomputed because a
  // reuse question must answer about the file that was actually checked.
  let activeReports: Array<VerifyReport | undefined> = [];
  // How the CURRENT batch arrived, which two of the text-binding sentences
  // depend on: `activeSourceUrl` is the address the file was read from (the
  // `?src=`/dropped-link paths - a relative credential reference only means
  // something next to it), and `activePasted` marks the clipboard path, where a
  // hash mismatch on markup has a known innocent cause. Both are per-batch and
  // reset by handle(), so they can never leak onto a later drop.
  let activeSourceUrl: string | null = null;
  let activePasted = false;
  // Set by the callers immediately before they hand their files to handle().
  let pendingSourceUrl: string | null = null;
  let pendingPasted = false;

  /** The text-binding/paste notes for one report - see valid-text.ts. */
  const notesFor = (report: VerifyReport, i: number): VerifyNotice[] => verifyTextNotices(report, {
    origin: location.origin,
    base: activeSourceUrl,
    pasted: activePasted,
    refetchable: !!activeFiles[i],
  } satisfies NoticeContext);

  async function handle(files: FileList | File[] | null | undefined): Promise<void> {
    const list = files ? [...files] : [];
    if (!list.length) return;
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    previewUrls = [];
    activeFiles = list;
    activeDigests = [];
    activeReports = [];
    // A source address only describes a single fetched file; a multi-file batch
    // has none, and the pending markers are one-shot either way.
    activeSourceUrl = list.length === 1 ? pendingSourceUrl : null;
    activePasted = list.length === 1 && pendingPasted;
    pendingSourceUrl = null;
    pendingPasted = false;
    scannedKeys.clear(); // fresh batch - allow each file to be scanned again
    enterResultMode();
    reportEl.hidden = false;

    // One file reads exactly as before - the full report inline, no collapse chrome.
    if (list.length === 1) {
      const file = list[0]!;
      reportEl.innerHTML = `<div class="valid-reports-list">${checkingHtml(t('Checking {name}…', { name: file.name }))}</div>`;
      const { report, error, meta, watermark, mine, seal, snippet, textSignals } = await verifyFile(file);
      activeDigests[0] = report?.environment?.inputs;
      activeReports[0] = report ?? undefined;
      reportEl.querySelector('.valid-reports-list')!.innerHTML = report
        ? renderReportBody(file.name, report, meta, makePreview(file, report, snippet), 0, watermark, mine, seal, notesFor(report, 0), textSignals, ocrReady)
        : `<p class="valid-busy">${t('Could not check this file: {message}', { message: error! })}</p>`;
      void prefillClaim();  // fill the claim form's author/contact from the opted-in profile
      // Audible verdict, as two composable signals: the spooky ghost "hoooo" marks
      // AI-generated content, the bright "signing" chirps mark an intact Lolly make.
      // A file that's BOTH gets the chirps over the ooo; any OTHER AI file gets the
      // ooo alone (no chirps); a non-AI file keeps the usual verdict - chirps if
      // intact, a soft cautionary "uh-oh" if broken, missing, or unreadable.
      if (report?.aiGenerated || meta?.ai) {
        if (report?.madeWithLolly) playSfx('sign');
        playSfx('ghost');
      } else {
        playSfx(report?.state === 'valid' ? 'sign' : 'warn');
      }
      viewEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      // Auto-scan if models are on-device, else offer the one-time header banner.
      if (report) void armDeepScan(isDeepScannable(report.format, file.name));
      return;
    }

    // Several files → a stack of collapsible reports. Default collapsed so the whole
    // batch reads as a triage surface first, then a column of highlight bars. The
    // counters are filters as well as a summary: useful with three files, essential
    // with thirty, and still compact enough to stay above the fold on a phone.
    reportEl.innerHTML = `
      <section class="valid-batch-overview" aria-label="${escape(t('Batch overview'))}">
        <div class="valid-batch-heading">
          <span>${t('Batch overview')}</span>
          <strong data-batch-progress aria-live="polite">${t('Checking 0 of {n}', { n: list.length })}</strong>
        </div>
        <div class="valid-batch-stats" role="group" aria-label="${escape(t('Filter these files'))}">
          <button type="button" class="valid-batch-stat is-all is-active" data-batch-filter="all" aria-pressed="true">
            <strong>${list.length}</strong><span>${t('All files')}</span>
          </button>
          <button type="button" class="valid-batch-stat is-good" data-batch-filter="good" aria-pressed="false" disabled>
            <strong data-batch-good>0</strong><span>${t('Intact')}</span>
          </button>
          <button type="button" class="valid-batch-stat is-attention" data-batch-filter="attention" aria-pressed="false" disabled>
            <strong data-batch-attention>0</strong><span>${t('Needs attention')}</span>
          </button>
          <button type="button" class="valid-batch-stat is-ai" data-batch-filter="ai" aria-pressed="false" disabled>
            <strong data-batch-ai>0</strong><span>${t('AI signals')}</span>
          </button>
          <button type="button" class="valid-batch-stat is-none" data-batch-filter="none" aria-pressed="false" disabled>
            <strong data-batch-none>0</strong><span>${t('No credential')}</span>
          </button>
        </div>
      </section>
      <div class="valid-reports-bar">
        <span class="valid-reports-count">${t('Review files')}</span>
        <div class="valid-reports-actions">
          <button type="button" class="btn valid-reports-toggle" data-expand>${t('Expand all')}</button>
          <button type="button" class="btn valid-reports-toggle" data-collapse>${t('Collapse all')}</button>
        </div>
      </div>
      <div class="valid-reports-list"></div>`;
    const listEl = reportEl.querySelector<HTMLElement>('.valid-reports-list')!;
    const setAll = (open: boolean): void => listEl.querySelectorAll<HTMLDetailsElement>(':scope > details:not([hidden])').forEach((d) => { d.open = open; });
    reportEl.querySelector('[data-expand]')!.addEventListener('click', () => setAll(true));
    reportEl.querySelector('[data-collapse]')!.addEventListener('click', () => setAll(false));

    // Place every card up-front in drop order (busy), so the list doesn't reflow as
    // each result lands. Verify sequentially - bounds memory to one file's bytes at a
    // time and fills the cards top-to-bottom as a visible progress cue.
    const cards = list.map((file, i) => {
      const card = document.createElement('details');
      card.className = 'valid-item is-busy';
      card.dataset.cardIndex = String(i);   // so a post-claim re-verify can replace this one card in place
      card.innerHTML = `<summary class="valid-item-summary">
          <span class="valid-item-badge is-busy">${t('Waiting…')}</span>
          <span class="valid-item-name">${escape(file.name)}</span>
          <span class="valid-item-chev" aria-hidden="true">${ICON_CHEVRON}</span>
        </summary>
        <div class="valid-item-body">${checkingHtml(t('Checking {name}…', { name: file.name }), true)}</div>`;
      listEl.appendChild(card);
      return card;
    });

    type BatchFilter = 'all' | 'good' | 'attention' | 'ai' | 'none';
    const batchCounts = { done: 0, good: 0, attention: 0, ai: 0, none: 0 };
    let activeFilter: BatchFilter = 'all';
    const matchesFilter = (card: HTMLElement, filter: BatchFilter): boolean => {
      if (filter === 'all') return true;
      if (filter === 'good') return card.dataset.batchTone === 'good';
      if (filter === 'attention') return card.dataset.batchTone === 'bad' || card.dataset.batchTone === 'warn';
      if (filter === 'ai') return card.dataset.batchAi === '1';
      return card.dataset.batchCredential === '0';
    };
    const applyBatchFilter = (): void => {
      cards.forEach((card) => { card.hidden = !matchesFilter(card, activeFilter); });
      reportEl.querySelectorAll<HTMLButtonElement>('[data-batch-filter]').forEach((button) => {
        const active = button.dataset.batchFilter === activeFilter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };
    const paintBatchOverview = (): void => {
      const value = (selector: string, n: number): void => {
        const el = reportEl.querySelector<HTMLElement>(selector);
        if (el) el.textContent = String(n);
      };
      value('[data-batch-good]', batchCounts.good);
      value('[data-batch-attention]', batchCounts.attention);
      value('[data-batch-ai]', batchCounts.ai);
      value('[data-batch-none]', batchCounts.none);
      const progress = reportEl.querySelector<HTMLElement>('[data-batch-progress]');
      if (progress) progress.textContent = batchCounts.done === list.length
        ? t('{n} files ready', { n: list.length })
        : t('Checking {done} of {n}', { done: batchCounts.done, n: list.length });
      const enableWhen = (filter: BatchFilter, n: number): void => {
        const button = reportEl.querySelector<HTMLButtonElement>(`[data-batch-filter="${filter}"]`);
        if (button) button.disabled = n === 0;
      };
      enableWhen('good', batchCounts.good);
      enableWhen('attention', batchCounts.attention);
      enableWhen('ai', batchCounts.ai);
      enableWhen('none', batchCounts.none);
    };
    reportEl.querySelector('.valid-batch-stats')!.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-batch-filter]');
      if (!button || button.disabled) return;
      activeFilter = (button.dataset.batchFilter ?? 'all') as BatchFilter;
      applyBatchFilter();
    });
    viewEl.scrollIntoView({ behavior: 'instant', block: 'start' });

    let allValid = true, anyAi = false, anyLolly = false;
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!, card = cards[i]!;
      const { report, error, meta, watermark, mine, seal, snippet, textSignals } = await verifyFile(file);
      activeDigests[i] = report?.environment?.inputs;
      activeReports[i] = report ?? undefined;
      if (report) {
        // A no-credential file with a positive signal (made here / imprint) gets
        // the good (green) stripe, matching its badge - not the neutral grey.
        const cardTone = noCredentialSignal(report, watermark, mine) ? 'good' : stateTone(report);
        card.className = `valid-item is-${cardTone}`;
        card.dataset.batchTone = cardTone;
        card.dataset.batchAi = report.aiGenerated || meta?.ai ? '1' : '0';
        card.dataset.batchCredential = report.found ? '1' : '0';
        card.innerHTML = `<summary class="valid-item-summary">${summaryInner(file.name, report, meta, watermark, seal, mine)}</summary>` +
          `<div class="valid-item-body">${renderReportBody(file.name, report, meta, makePreview(file, report, snippet), i, watermark, mine, seal, notesFor(report, i), textSignals, ocrReady)}</div>`;
        if (cardTone === 'good') batchCounts.good++;
        else if (cardTone === 'bad' || cardTone === 'warn') batchCounts.attention++;
        if (card.dataset.batchAi === '1') batchCounts.ai++;
        if (!report.found) batchCounts.none++;
      } else {
        card.className = 'valid-item is-bad';
        card.dataset.batchTone = 'bad';
        card.dataset.batchAi = '0';
        card.dataset.batchCredential = '0';
        card.innerHTML = errorSummary(file.name, error!);
        batchCounts.attention++;
        batchCounts.none++;
      }
      batchCounts.done++;
      paintBatchOverview();
      applyBatchFilter();
      if (report?.state !== 'valid') allValid = false;
      if (report?.aiGenerated || meta?.ai) anyAi = true;
      if (report?.madeWithLolly) anyLolly = true;
    }
    // One summary verdict, mirroring the single-file rule: AI in the batch → the
    // ghost "hoooo", with the "signing" chirps over it ONLY when every file passed
    // and at least one is a Lolly make; a non-AI batch keeps the usual flourish.
    if (anyAi) {
      if (allValid && anyLolly) playSfx('sign');
      playSfx('ghost');
    } else {
      playSfx(allValid ? 'sign' : 'warn');
    }
    // Arm deep scanning for the batch - auto if the models are on-device, else a
    // single header banner so one download serves every file.
    void armDeepScan(list.some((f) => isDeepScannable(null, f.name)));
    void prefillClaim();  // fill every card's claim form from the opted-in profile
  }

  // Append "-clean" before the extension: report.pdf → report-clean.pdf.
  const cleanFileName = (name: string): string => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)}-clean${name.slice(dot)}` : `${name}-clean`;
  };
  const CLEAN_MIME: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' };

  /**
   * What a strip is about to remove from a third party, read BEFORE the bytes
   * change. A privacy control that quietly drops somebody else's required credit
   * is not a privacy success, so the sources are counted first and the note after
   * the strip says what the clean file no longer carries (plan 253, section 10.2).
   * The stripped bytes are never restamped: the promise was byte removal.
   */
  async function creditsBeforeStrip(bytes: Uint8Array): Promise<{ count: number; credits: string }> {
    try {
      const out = await verifyC2pa(bytes);
      const rights = rightsReportFromC2pa(out);
      const lines = rights.recorded.map((source) => source.credit).filter(Boolean);
      return { count: rights.recorded.length, credits: lines.join('\n') };
    } catch {
      // A file this reader cannot parse gets no claim either way: no sources are
      // reported, and nothing says the file had none.
      return { count: 0, credits: '' };
    }
  }

  // The quiet "download a cleaned copy" action beside the metadata reveal - same
  // lossless byte surgery as the Hidden Data tool (JPEG/PNG/SVG in-engine,
  // PDF via host.pdf.strip), offered right where a viewer just saw what the file
  // discloses, without sending them off to a separate tool.
  async function downloadCleanCopy(btn: HTMLButtonElement): Promise<void> {
    const file = activeFiles[Number(btn.dataset.cleanCopy)];
    const format = (btn.dataset.cleanFormat || '').toUpperCase();
    if (!file) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('Cleaning…');
    try {
      if (file.size > MAX_VERIFY_BYTES) throw new Error('File is too large to clean here.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sources = await creditsBeforeStrip(bytes);
      let outBytes: Uint8Array, mime: string;
      if (format === 'PDF') {
        if (!host.pdf?.strip) throw new Error('PDF cleaning isn’t available in this app.');
        ({ bytes: outBytes } = await host.pdf.strip(bytes));
        mime = 'application/pdf';
      } else {
        const fmt = format.toLowerCase() as StripFormat;
        outBytes = stripMetadata(bytes, fmt);
        mime = CLEAN_MIME[fmt] || 'application/octet-stream';
      }
      if (btn.dataset.cleanPackage === '1' && sources.credits) {
        // The stripped bytes plus the credits, together, so a route that cannot
        // carry metadata still has somewhere to put the credit. The clean file
        // itself is untouched - nothing is written back into it.
        const { zipAsync } = await import('../lib/zip.ts');
        const zip = await zipAsync({
          [cleanFileName(file.name)]: outBytes,
          'CREDITS.txt': new TextEncoder().encode(`${sources.credits}\n`),
        });
        await host.export.file(new Blob([zip as BlobPart], { type: 'application/zip' }), { filename: `${cleanFileName(file.name)}.zip` });
      } else {
        await host.export.file(new Blob([outBytes as BlobPart], { type: mime }), { filename: cleanFileName(file.name) });
      }
      btn.textContent = t('Downloaded ✓');
      showStripNote(btn, sources);
    } catch (err) {
      btn.textContent = t('Couldn’t clean this file');
      host.log('warn', 'valid: clean-copy failed', { error: (err as Error)?.message });
    } finally {
      setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2000);
    }
  }

  /**
   * The note after a strip. It states what left with the metadata rather than
   * reporting a clean file and nothing else, and the credit it offers is the one
   * the file used to carry. Shown once per button.
   */
  function showStripNote(btn: HTMLButtonElement, sources: { count: number; credits: string }): void {
    if (!sources.count || !sources.credits) return;
    const row = btn.parentElement;
    if (!row) return;
    row.querySelector('[data-strip-note]')?.remove();
    const note = document.createElement('p');
    note.className = 'valid-clean-note';
    note.setAttribute('role', 'status');
    note.dataset.stripNote = '1';
    note.innerHTML = stripCreditNoteHtml(btn.dataset.cleanCopy ?? '', btn.dataset.cleanFormat ?? '', sources);
    row.appendChild(note);
  }
  // Append "-payload" before an extension derived from the sniffed kind:
  // report.jpg → report-payload.zip (for an appended zip), report-payload.bin
  // for anything unrecognised - never a name that invites a double-click.
  const payloadFileName = (name: string, kind: string): string => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    return `${base}-payload.${payloadExt(kind)}`;
  };

  // Re-reads the file fresh and re-runs the same deterministic byte-offset
  // detection (engine/src/file-metadata.ts) rather than threading the offset
  // through dataset attributes - mirrors downloadCleanCopy's re-read-on-demand
  // pattern, and keeps a single source of truth for "where the payload starts".
  async function rereadAppended(fileIndex: number): Promise<{ file: File; bytes: Uint8Array; appended: NonNullable<FileMetadata['appended']> } | undefined> {
    const file = activeFiles[fileIndex];
    if (!file || file.size > MAX_VERIFY_BYTES) return undefined;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const appended = extractFileMetadata(bytes).appended;
    return appended ? { file, bytes, appended } : undefined;
  }

  // Toggles the inline hex/text preview on the appended-payload callout.
  // SECURITY: payloadPreviewHtml only ever escape()s a hex dump or decoded
  // text into this panel - there is no path from the (untrusted) payload
  // bytes to rendered/executed markup.
  async function viewPayload(btn: HTMLButtonElement): Promise<void> {
    const fileIndex = Number(btn.dataset.payloadView);
    const panel = reportEl.querySelector<HTMLElement>(`[data-payload-panel="${fileIndex}"]`);
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; btn.textContent = t('Raw bytes'); return; }
    btn.disabled = true;
    try {
      const found = await rereadAppended(fileIndex);
      panel.innerHTML = found
        ? payloadPreviewHtml(found.bytes.subarray(found.appended.offset), found.appended.kind)
        : `<p class="valid-busy">${t('Could not re-read this payload.')}</p>`;
      panel.hidden = false;
      btn.textContent = t('Hide raw bytes');
    } catch (err) {
      panel.innerHTML = `<p class="valid-busy">${t('Could not re-read this payload.')}</p>`;
      panel.hidden = false;
      host.log('warn', 'valid: payload view failed', { error: (err as Error)?.message });
    } finally {
      btn.disabled = false;
    }
  }

  // The extraction download - same on-device re-read, sliced from the recorded
  // offset and handed to host.export.file untouched (no parsing, no re-encode).
  async function downloadPayload(btn: HTMLButtonElement): Promise<void> {
    const fileIndex = Number(btn.dataset.payloadDownload);
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('Extracting…');
    try {
      const found = await rereadAppended(fileIndex);
      if (!found) throw new Error('No appended payload found.');
      const payload = found.bytes.subarray(found.appended.offset);
      await host.export.file(new Blob([payload as BlobPart], { type: 'application/octet-stream' }), {
        filename: payloadFileName(found.file.name, found.appended.kind),
      });
      btn.textContent = t('Downloaded ✓');
    } catch (err) {
      btn.textContent = t('Couldn’t extract this');
      host.log('warn', 'valid: payload download failed', { error: (err as Error)?.message });
    } finally {
      setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2000);
    }
  }

  // "Recreate with these settings in <tool>" - turn the credential's scalar-input
  // digest back into a seeded tool link (lib/seed-url.ts - the same URL shape a
  // share of that look produces). The digest stores every value as a display
  // string (engine summarizeInputs): numbers may carry a unit ("12 mm"), booleans
  // are 'true'/'false' - coerce them per the manifest's input types before
  // seeding, or serializeUrlState would mis-encode them (a truthy 'false' string
  // serialises as boolean ON). Failure falls back to the anchor's blank-session href.
  async function recreateFromDigest(a: HTMLAnchorElement): Promise<void> {
    const toolId = a.dataset.recreateTool || '';
    const inputs = activeDigests[Number(a.dataset.recreate)];
    if (!toolId) return;
    try {
      const [{ getTool }, { toolSeedHref }] = await Promise.all([
        import('../bridge/tool-loader.ts'),
        import('../lib/seed-url.ts'),
      ]);
      const { manifest } = await getTool(toolId);
      const typeById = new Map(manifest.inputs.map((inp) => [inp.id, inp.type]));
      const values: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(inputs ?? {})) {
        const type = typeById.get(k);
        if (type === 'number') {
          const n = parseFloat(v);          // drops a trailing unit ("12 mm" → 12)
          if (!Number.isNaN(n)) values[k] = n;
        } else if (type === 'boolean') {
          values[k] = v === 'true';
        } else {
          values[k] = v;
        }
      }
      window.location.hash = await toolSeedHref(toolId, values);
    } catch {
      window.location.hash = `#/tool/${toolId}`;   // seeding failed - open a blank session
    }
  }

  // ─── Claim flow: prefill from profile, sign a new credential, re-verify in place ──

  // Prefill the author/contact fields of every visible claim form from the profile - 
  // ONLY when the user opted in ("Use my details"), and NEVER copyright/licence (those
  // are user-asserted, never auto-derived; same policy as buildExportMeta). Never
  // clobbers a field the user already typed. Read once, cached for the mount.
  let claimProfile: { firstname?: string; lastname?: string; email?: string; useDetails?: boolean } | null = null;
  let claimProfileLoaded = false;
  async function prefillClaim(root: HTMLElement = reportEl): Promise<void> {
    try {
      if (!claimProfileLoaded) {
        claimProfile = (await host.profile?.get?.()) as typeof claimProfile ?? null;
        claimProfileLoaded = true;
      }
      const p = claimProfile;
      if (!p || p.useDetails !== true) return; // opt-in gate
      const name = [p.firstname, p.lastname].filter(Boolean).join(' ').trim();
      const email = typeof p.email === 'string' ? p.email.trim() : '';
      root.querySelectorAll<HTMLInputElement>('[data-claim-author]').forEach((el) => { if (!el.value) el.value = name; });
      root.querySelectorAll<HTMLInputElement>('[data-claim-contact]').forEach((el) => { if (!el.value) el.value = email; });
    } catch { /* profile unavailable - leave the form blank, no prefill */ }
  }

  // After a successful claim: re-verify the newly-signed bytes and swap the file's
  // report in place, led by a confirmation banner. The re-verify makes the appended
  // credential (the user's claim ON TOP of the preserved chain) show up immediately.
  async function rerenderClaimed(i: number): Promise<void> {
    const file = activeFiles[i];
    if (!file) return;
    const res = await verifyFile(file);
    const banner = `<div class="valid-claim-done" role="status"><span class="valid-claim-done-ic" aria-hidden="true">✓</span> ${t('Your credentials were added and a download was requested. The prepared file’s credential chain includes your claim.')}</div>`;
    repaintCard(i, file, res, banner, `${banner}<p class="valid-busy">${t('Signed and prepared for download, but the re-check could not run: {message}', { message: res.error ?? '' })}</p>`);
  }

  /** Swap one file's rendered report for a freshly-verified one, led by a banner.
   *  Extracted unchanged from rerenderClaimed so the external-manifest re-check
   *  (fetchExternalManifest) lands its result exactly the same way - single-file
   *  and batch layouts, tone, masonry and claim prefill all in one place. */
  function repaintCard(
    i: number,
    file: File,
    res: Awaited<ReturnType<typeof verifyFile>>,
    banner: string,
    failedHtml: string,
  ): void {
    const bodyHtml = res.report
      ? banner + renderReportBody(file.name, res.report, res.meta, makePreview(file, res.report, res.snippet), i, res.watermark, res.mine, res.seal, notesFor(res.report, i), res.textSignals, ocrReady)
      : failedHtml;
    // A repaint replaces the card the reuse check reads from, so the held report
    // follows it. Otherwise a re-signed file would be answered about its old bytes.
    activeReports[i] = res.report ?? undefined;
    if (activeFiles.length === 1) {
      const listWrap = reportEl.querySelector<HTMLElement>('.valid-reports-list');
      if (listWrap) listWrap.innerHTML = bodyHtml;
    } else {
      const card = reportEl.querySelector<HTMLDetailsElement>(`[data-card-index="${i}"]`);
      if (card && res.report) {
        const cardTone = noCredentialSignal(res.report, res.watermark, res.mine) ? 'good' : stateTone(res.report);
        card.className = `valid-item is-${cardTone}`;
        card.innerHTML = `<summary class="valid-item-summary">${summaryInner(file.name, res.report, res.meta, res.watermark, res.seal, res.mine)}</summary>` +
          `<div class="valid-item-body">${bodyHtml}</div>`;
        card.open = true;
      }
    }
    void prefillClaim();
  }

  // ── "Fetch and check" - the section A.7.1.2 / section A.9.3 external credential ───────────
  //
  // A text asset may REFERENCE its Content Credential instead of carrying it.
  // The engine reports that honestly and never fetches (plans/105 M1); this is
  // the only place the reference is ever resolved, and every condition below has
  // to hold: the user clicked, the address came from the file's OWN reference
  // (re-classified here, never trusted from the DOM attribute alone), and it
  // resolves to a same-origin path under the exact `?src=` policy. A
  // cross-origin reference is refused in words - reaching out to it would hand a
  // third party the fact that you are checking this file, which is the promise
  // this page is built on.
  async function fetchExternalManifest(btn: HTMLButtonElement): Promise<void> {
    const i = Number(btn.dataset.fetchManifest);
    const file = activeFiles[i];
    // Re-classified from the attribute rather than trusted as a path: this
    // button's address originated inside an unverified document, and one gate
    // that everything passes through is worth more than a value that was safe
    // when it was written.
    const gate = classifyUrl(btn.dataset.manifestPath ?? '', location.origin);
    if (!file || gate.kind !== 'same-origin') return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('Fetching…');
    try {
      const res = await fetch(gate.path);
      if (!res.ok) throw new Error(String(res.status));
      const manifest = new Uint8Array(await res.arrayBuffer());
      if (!manifest.length) throw new Error('empty');
      const out = await verifyFile(file, { externalManifest: manifest });
      const banner = `<div class="valid-claim-done" role="status"><span class="valid-claim-done-ic" aria-hidden="true">✓</span> ${t('Fetched the credential from {url} and checked this file against it.', { url: gate.path })}</div>`;
      repaintCard(i, file, out, banner, `${banner}<p class="valid-busy">${t('Could not check this file: {message}', { message: out.error ?? '' })}</p>`);
    } catch (err) {
      btn.textContent = t('Couldn’t fetch that credential');
      host.log('warn', 'valid: external manifest fetch failed', { error: String((err as Error)?.message || err) });
      setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2000);
    }
  }

  // Sign a fresh Content Credential into one file, PRESERVING any existing chain as
  // ingredients (host.c2pa.sign appends the new claim as the active manifest on top - 
  // the exact path the Embed tool uses). Raster essence also gets the pixel Imprint.
  async function claimSign(btn: HTMLButtonElement): Promise<void> {
    const i = Number(btn.dataset.claimSign);
    const file = activeFiles[i];
    const panel = reportEl.querySelector<HTMLElement>(`[data-claim-panel="${i}"]`);
    if (!file || !panel) return;
    const statusEl = panel.querySelector<HTMLElement>('[data-claim-status]');
    const setStatus = (msg: string, cls = ''): void => { if (statusEl) { statusEl.textContent = msg; statusEl.className = `valid-claim-status ${cls}`; } };
    const val = (name: string): string => (panel.querySelector<HTMLInputElement>(`[data-claim-${name}]`)?.value ?? '').trim();
    const author = val('author'), contact = val('contact'), copyright = val('copyright');
    const licence = panel.querySelector<HTMLSelectElement>('[data-claim-licence]')?.value ?? '';
    const basis = panel.querySelector<HTMLSelectElement>('[data-claim-basis]')?.value ?? '';
    const durable = !!panel.querySelector<HTMLInputElement>('[data-claim-durable]')?.checked;
    const key = panel.dataset.claimKey ?? '';
    const mime = panel.dataset.claimMime || 'application/octet-stream';
    const raster = panel.dataset.claimRaster === '1';
    btn.disabled = true;
    setStatus(t('Signing…'), 'is-busy');
    try {
      if (!host.c2pa?.sign) throw new Error(t('Signing isn’t available in this app.'));
      if (file.size > MAX_VERIFY_BYTES) throw new Error(t('File is too large to sign here.'));
      const bytes = new Uint8Array(await file.arrayBuffer());
      // Read the EXISTING chain BEFORE any pixel rewrite - the imprint re-encode drops
      // the embedded manifest, so reading after would orphan it.
      let ingredients: unknown[] = [];
      try { ingredients = (await host.c2pa.readIngredients?.(bytes)) ?? []; } catch { ingredients = []; }
      let stamped: Uint8Array<ArrayBufferLike> = bytes;
      let imprinted = false;
      if (raster && host.export?.imprint) {
        try {
          const marked = await host.export.imprint(bytes, key, { durable });
          if (marked && marked.length && marked !== bytes) { stamped = marked; imprinted = true; }
        } catch { /* imprint is best-effort - sign the un-imprinted bytes */ }
      }
      // "Email or site for licensing" - an @-token becomes the author email, a
      // dotted non-@ token the contact site; both land in the manifest's creator
      // entry and come back as /verify's Produced-by/Contact facts.
      const contactTokens = contact.split(/[\s·,;]+/).filter(Boolean);
      const email = contactTokens.find((s) => s.includes('@')) ?? '';
      const site = contactTokens.find((s) => !s.includes('@') && s.includes('.')) ?? '';
      const rights = claimRights(copyright, licence);
      const sentence = CLAIM_BASIS.find((b) => b.value === basis)?.sentence;
      const opts: Parameters<NonNullable<HostV1['c2pa']>['sign']>[2] = { action: 'imported', imprinted } as Record<string, unknown>;
      if (author) (opts as Record<string, unknown>).author = { name: author, ...(email ? { email } : {}), ...(site ? { url: site } : {}) };
      if (rights) (opts as Record<string, unknown>).rights = rights;
      if (sentence) (opts as Record<string, unknown>).description = sentence;
      if (ingredients.length) (opts as Record<string, unknown>).ingredients = ingredients;
      const signed = await host.c2pa.sign(stamped, key, opts);
      await host.export.file(new Blob([signed as BlobPart], { type: mime }), { filename: file.name });
      activeFiles[i] = new File([signed as BlobPart], file.name, { type: mime });
      playSfx('sign');
      await rerenderClaimed(i);
    } catch (err) {
      setStatus((err as Error)?.message || t('Couldn’t add credentials - try again.'), 'is-err');
      btn.disabled = false;
      host.log('warn', 'valid: claim sign failed', { error: String((err as Error)?.message || err) });
    }
  }

  // The OCR overlay carries its own un-pin (ResizeObserver disconnect + load-listener
  // removal) so replacing it also retires the machinery that kept it aligned.
  type OcrOverlayEl = SVGSVGElement & { _ocrUnpin?: () => void };

  // The read-what-could-not-be-read ledger under a document analysis: what was
  // capped, what came off pixels, what stayed unread and why. Every line is a
  // fact the reader can act on - the perceptive-honesty half of best effort.
  function docReadNotesHtml(notes: DocReadNotes): string {
    const bits: string[] = [];
    if (notes.pagesRead < notes.pageCount) bits.push(tRaw('The first {n} of {total} pages were read.', { n: notes.pagesRead, total: notes.pageCount }));
    if (notes.ocrPages > 0) bits.push(tRaw('{n} scanned pages were read with on-device text recognition, so hidden-character checks could not run on those pages.', { n: notes.ocrPages }));
    if (notes.scannedUnread > 0) bits.push(scannedUnreadNote(notes));
    return bits.map((b) => `<p class="valid-tsig-cands">${escape(b)}</p>`).join('');
  }

  // PDF → the text LAYER first (digital - the byte-level artifact tier still
  // applies), then per-page OCR for its SCANNED pages when the on-device model
  // is present: a picture-of-text document gets a best-effort read, never a
  // refusal. The shared extractor (views/doc-read.ts) is the same one the
  // catalog uses, and the result always ends in the risk-assessment panel.
  async function readDocumentText(btn: HTMLButtonElement): Promise<void> {
    const resultEl = btn.parentElement?.querySelector<HTMLElement>('[data-ocr-result]');
    const file = activeFiles[Number(btn.dataset.fileIndex ?? '0')];
    if (!resultEl || !file) return;
    const span = btn.querySelector('span');
    let orig = span?.textContent ?? '';
    btn.disabled = true;
    if (span) span.textContent = t('Reading…');
    try {
      const { extractDocumentText, offerTextRecognition, canOfferOcrAgain } = await import('./doc-read.ts');
      const result = await extractDocumentText(file, ocrReady ? (host.ocr ?? null) : null, (done, total) => {
        if (span) span.textContent = tRaw('Reading page {i} of {n}…', { i: done, n: total });
      }, { ensureOcr: offerTextRecognition });
      // Pages left unread after Not now: the button stays, and a press offers the model again.
      const retry = canOfferOcrAgain(result.notes, ocrReady);
      if (retry) orig = t('Read scanned pages');
      if (result.text == null) {
        resultEl.textContent = result.notes.ocrUnavailable
          ? t('These pages are pictures of text. Text recognition is not on this device, so they were not read.')
          : t('No readable text was found in this document.');
        resultEl.hidden = false;
        return;
      }
      resultEl.innerHTML = textSignalsHtml(analyzeVerifyText(result.text, result.source)) + docReadNotesHtml(result.notes);
      resultEl.hidden = false;
      if (!retry) btn.hidden = true; // one read is enough - the result now shows the analysis
    } catch {
      resultEl.textContent = t('The text in this document could not be read.');
      resultEl.hidden = false;
    } finally {
      btn.disabled = false;
      if (span) span.textContent = orig;
    }
  }

  // SVG → the vector's own <text> elements first (digital, better than any
  // OCR); a vector whose words are paths or embedded rasters falls through to
  // the ordinary rasterise-and-OCR read below. Returns true when handled.
  async function readVectorText(btn: HTMLButtonElement): Promise<boolean> {
    const resultEl = btn.parentElement?.querySelector<HTMLElement>('[data-ocr-result]');
    const file = activeFiles[Number(btn.dataset.fileIndex ?? '0')];
    if (!resultEl || !file) return true;
    const { extractSvgText } = await import('./doc-read.ts');
    const text = extractSvgText(await file.text());
    if (text) {
      resultEl.innerHTML = textSignalsHtml(analyzeVerifyText(text, 'digital'))
        + `<p class="valid-tsig-cands">${escape(t('Read from the vector\u2019s own text elements - a digital extraction, no pixels involved.'))}</p>`;
      resultEl.hidden = false;
      btn.hidden = true;
      return true;
    }
    if (!ocrReady) {
      resultEl.textContent = t('This vector draws its words as shapes, and the text-recognition model that could read them is not installed.');
      resultEl.hidden = false;
      return true;
    }
    return false; // paths-only vector + OCR present: fall through to the raster read
  }

  // Image → OCR → the same text-signals read the text path does, but source:'ocr'
  // (so only writing-style tells apply; the panel says the byte-level layer is gone).
  //
  // The READ is a WP-F background job (lib/ocr-job.ts): wasm inference over a whole
  // page, plus a first-run model download, belongs on the serial heavy queue where
  // the toast owns its progress and its cancel - not on a button the user has to sit
  // and watch. The pixels are decoded HERE, while this card is on screen; everything
  // after that can outlive it, so every paint below is guarded on the result element
  // still being in the document. When it is, the rendering is byte-identical to the
  // blocking version; when it is not, the outcome is announced instead of written to
  // a detached node.
  async function readImageText(btn: HTMLButtonElement): Promise<void> {
    if (btn.dataset.readKind === 'pdf') return readDocumentText(btn);
    if (btn.dataset.readKind === 'svg' && await readVectorText(btn)) return;
    const scope = btn.closest('.valid-item-body') ?? reportEl;
    const img = scope.querySelector<HTMLImageElement>('.valid-preview img');
    const resultEl = btn.parentElement?.querySelector<HTMLElement>('[data-ocr-result]');
    const src = img?.currentSrc || img?.src;
    if (!src || !resultEl || !host.ocr) return;
    const span = btn.querySelector('span');
    const orig = span?.textContent ?? '';
    btn.disabled = true;
    if (span) span.textContent = t('Reading…');
    /** Is the card that started this read still in the document? A new drop
     *  repaints the report, which detaches everything captured above. */
    const alive = (): boolean => resultEl.isConnected;
    const restore = (): void => {
      if (!btn.isConnected) return;
      btn.disabled = false;
      if (span) span.textContent = orig;
    };
    const readFailed = (): void => {
      if (alive()) {
        resultEl.textContent = t('The text in this image could not be read.');
        resultEl.hidden = false;
      } else announce(t('The text in this image could not be read.'));
    };

    let frame: { width: number; height: number; data: Uint8ClampedArray };
    let nW = 0, nH = 0;
    try {
      const bmp = await createImageBitmap(await (await fetch(src)).blob());
      nW = bmp.width; nH = bmp.height;
      const canvas = document.createElement('canvas');
      canvas.width = nW; canvas.height = nH;
      const cx = canvas.getContext('2d');
      if (!cx) throw new Error('no 2d context');
      cx.drawImage(bmp, 0, 0);
      frame = { width: nW, height: nH, data: cx.getImageData(0, 0, nW, nH).data };
      bmp.close?.();
    } catch {
      readFailed();
      restore();
      return;
    }

    const { startOcrJob } = await import('../lib/ocr-job.ts');
    startOcrJob(host, { frame }, {
      onComplete: (result) => {
        if (!result.text.trim()) {
          if (alive()) { resultEl.textContent = t('No readable text was found in this image.'); resultEl.hidden = false; }
          else announce(t('No readable text was found in this image.'));
          return;
        }
        const panel = analyzeVerifyText(result.text, 'ocr');
        if (!alive()) {
          // Nothing left to paint into - this report was replaced while the read ran.
          announce(t('The text was read, but this report has moved on. Check the file again to see it.'));
          return;
        }
        resultEl.innerHTML = textSignalsHtml(panel);
        resultEl.hidden = false;
        btn.hidden = true; // one read is enough - the result now shows the extracted text
        // Overlay the flagged line boxes ON the image - what comms professionals want:
        // exactly which words on the page tripped a signal. Pinned to the <img>'s box so
        // natural-coord rects (preserveAspectRatio="none") map to the displayed pixels.
        if (img?.isConnected && img.parentElement) {
          img.parentElement.style.position = 'relative';
          // Retire any previous overlay WITH its observer - a dangling one would keep
          // re-pinning an element that is no longer in the document.
          const prev = img.parentElement.querySelector<OcrOverlayEl>('.valid-ocr-overlay');
          prev?._ocrUnpin?.();
          prev?.remove();
          const svg = buildOverlaySvg(result.lines, panel.marks, nW, nH) as OcrOverlayEl;
          svg.style.position = 'absolute';
          svg.style.pointerEvents = 'none';
          // Pin the overlay to the <img>'s CURRENT box - and keep it pinned: a one-time
          // pixel snapshot drifts on any window resize or reflow, so the same pin re-runs
          // from a ResizeObserver on the image (and on a late 'load', should the image
          // swap sources under the overlay).
          const pin = (): void => {
            svg.style.left = `${img.offsetLeft}px`;
            svg.style.top = `${img.offsetTop}px`;
            svg.style.width = `${img.offsetWidth}px`;
            svg.style.height = `${img.offsetHeight}px`;
          };
          pin();
          const ro = new ResizeObserver(pin);
          ro.observe(img);
          img.addEventListener('load', pin);
          svg._ocrUnpin = () => { ro.disconnect(); img.removeEventListener('load', pin); };
          img.parentElement.appendChild(svg);
        }
      },
      onError: () => readFailed(),
      onSettled: restore,   // includes a cancel from the toast
    });
  }

  // "Ask for credentials": absence turned into a conversation - copies a
  // courteous, ready-to-send note so a colleague gets language, not suspicion.
  async function copyCredentialRequest(btn: HTMLButtonElement): Promise<void> {
    const name = btn.dataset.fileName ?? t('this file');
    const note = tRaw('Hi - could you share the original of "{name}" with its Content Credentials attached? I would like to verify where it came from before we use it. Most current tools (Adobe apps, cameras, Lolly) can export with credentials switched on - that version verifies instantly and protects your authorship too. Thanks!', { name });
    try {
      await navigator.clipboard.writeText(note);
      const span = btn.querySelector('span');
      if (span) span.textContent = t('Copied - paste it to whoever sent the file');
      btn.disabled = true;
      announce(t('Request copied to the clipboard.'));
    } catch { announce(t('That text could not be copied.')); }
  }

  // Keep the verified file in the user's catalogue WITH its findings attached,
  // so the interrogation becomes the ingredient's standing passport.
  async function keepInCatalog(btn: HTMLButtonElement): Promise<void> {
    const idx = Number(btn.dataset.fileIndex ?? '0');
    const file = activeFiles[idx];
    if (!file) { announce(t('There is no file here to keep - drop the file itself to add it.')); return; }
    const span = btn.querySelector('span');
    const orig = span?.textContent ?? '';
    btn.disabled = true;
    if (span) span.textContent = t('Adding…');
    try {
      const { storeUserUpload } = await import('./picker.ts');
      await storeUserUpload(host as unknown as Parameters<typeof storeUserUpload>[0], file);
      announce(tRaw('"{name}" is in your catalogue, findings attached.', { name: file.name }));
      if (span) span.textContent = t('Kept - see your catalogue');
    } catch {
      btn.disabled = false;
      if (span) span.textContent = orig;
      announce(t('That file could not be added.'));
    }
  }

  wireLampScroll(reportEl);
  wireMetadataLinks(reportEl);
  wireVerifyPreviews(reportEl, (index) => activeFiles[index]);
  wireVerifyActions(viewEl, reportEl);
  wireAddressRequests(reportEl);
  reportEl.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-copy-evidence]') : null;
    if (!button) return;
    try {
      await host.clipboard.writeText(button.dataset.copyEvidence ?? '');
      announce(t('Link copied'));
    } catch { announce(t('Could not copy link')); }
  });
  reportEl.addEventListener('click', (e) => {
    const scoreToggle = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-score-toggle]');
    if (scoreToggle) {
      const wrap = scoreToggle.closest('.valid-score-wrap');
      const expanded = !wrap?.classList.contains('is-expanded');
      wrap?.classList.toggle('is-expanded', expanded);
      scoreToggle.setAttribute('aria-expanded', String(expanded));
      const count = Number(scoreToggle.dataset.scoreCount ?? 0);
      scoreToggle.textContent = expanded ? t('Show fewer checks') : t('Show all {n} checks', { n: count });
    }
    const ocr = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ocr-read]');
    if (ocr) void readImageText(ocr);
    const ask = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ask-cred]');
    if (ask) void copyCredentialRequest(ask);
    const card = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-report-card]');
    if (card) void saveReportCard(host, card);
    const keep = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add-catalog]');
    if (keep) void keepInCatalog(keep);
    const claim = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-claim-sign]');
    if (claim) { void claimSign(claim); }
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-clean-copy]');
    if (btn) downloadCleanCopy(btn);
    const rec = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-recreate]');
    if (rec) { e.preventDefault(); void recreateFromDigest(rec); }
    const enable = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-deep-scan-enable]');
    if (enable) enableDeepScan(enable);
    const rescan = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-imprint-rescan]');
    if (rescan) rescanImprint(rescan);
    const view = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-payload-view]');
    if (view) void viewPayload(view);
    const dl = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-payload-download]');
    if (dl) void downloadPayload(dl);
    const fetchManifest = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-fetch-manifest]');
    if (fetchManifest) void fetchExternalManifest(fetchManifest);
    // Script panel: expand the clamped script / copy it. Both act on the pre
    // in the SAME panel - a batch report renders one panel per file.
    const sx = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-script-expand]');
    if (sx) {
      sx.closest('.valid-script')?.querySelector('[data-script-text]')?.classList.remove('is-clamped');
      sx.setAttribute('aria-expanded', 'true');
      sx.hidden = true;
    }
    const sc = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-script-copy]');
    if (sc) {
      const text = sc.closest('.valid-script')?.querySelector('[data-script-text]')?.textContent ?? '';
      void navigator.clipboard.writeText(text).then(() => {
        const was = sc.textContent;
        sc.textContent = t('Copied');
        setTimeout(() => { sc.textContent = was; }, 1500);
      }).catch(() => { /* clipboard refused - the text stays selectable in the pre */ });
    }
    // Copy one source's credit line. The text rides on the button, so a copy is
    // exactly the line the plan assembled and never a scrape of the markup.
    const cc = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-credit]');
    if (cc) {
      const line = cc.dataset.copyCredit ?? '';
      void navigator.clipboard.writeText(line).then(() => {
        const was = cc.textContent;
        cc.textContent = t('Copied');
        setTimeout(() => { cc.textContent = was; }, 1500);
      }).catch(() => { /* clipboard refused - the line is still readable in the row */ });
    }
  });

  // "Check for this use" - answered from the held report, on this device, on ask.
  reportEl.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('[data-reuse-check]');
    if (!sel) return;
    const i = Number(sel.dataset.reuseCheck ?? '0');
    const out = reportEl.querySelector<HTMLElement>(`[data-reuse-out="${i}"]`);
    const report = activeReports[i];
    if (!out) return;
    out.innerHTML = report && sel.value ? reuseAnswerHtml(report, sel.value) : '';
  });

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => handle(input.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    if (e.dataTransfer?.files?.length) { void handle(e.dataTransfer.files); return; }
    // No File objects - an image dragged straight off another page (even our own
    // docs) arrives as a LINK, not bytes. Silently ignoring it reads as a broken
    // drop zone, so resolve the link or say why we can't.
    void handleDroppedLink(e.dataTransfer);
  });

  // ── The paste path ─────────────────────────────────────────────────────────
  //
  // C2PA 2.4 puts credentials in text - an HTML document (section A.7), an armour block
  // in source (section A.9), invisible variation selectors in prose (section A.8) - and text
  // arrives by CLIPBOARD far more often than as a file. A page that could only
  // take files would tell someone holding a signed paragraph to invent a file
  // for it, and would lose the section A.8 wrapper on the way if they retyped it.
  //
  // Bound at the document (the upscale-dialog precedent) and removed on view
  // teardown. Two rules: FILES win - pasting a screenshot has always been free
  // here and stays that way - and a paste aimed at a real text field is never
  // taken, so the claim form and the fallback textarea below type normally. The
  // default is only prevented when the payload is actually adopted.
  const isTypingTarget = (el: EventTarget | null): boolean =>
    !!(el instanceof Element) && !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');

  const pastedFiles = (dt: DataTransfer | null): File[] => {
    const out: File[] = [];
    for (const item of dt?.items ?? []) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
    return out.length ? out : [...(dt?.files ?? [])];
  };

  /**
   * Verify a text payload from the clipboard (or a dragged selection).
   *
   * Pasted text that IS an address is followed instead of checked - but only
   * under the same gate `?src=` uses, and a cross-origin one is refused in
   * words. Everything else becomes a File of the EXACT bytes pasted (never
   * trimmed, never normalised: section A.8's wrapper and section 15.12.1.3's NFC hash both
   * live in characters an eager cleanup would eat).
   */
  async function handlePastedText(text: string): Promise<void> {
    const gate = classifyPastedUrl(text, location.origin);
    if (gate?.kind === 'same-origin') {
      await verifyFromUrl(gate.path, () => tRaw('Could not read {src} from this site.', { src: gate.path }));
      return;
    }
    if (gate?.kind === 'elsewhere') {
      sayVerifyProblem(t('That address is on another site, and nothing is fetched on your behalf here - save the file and drop it on this page instead.'));
      return;
    }
    if (gate?.kind === 'unresolvable') {
      sayVerifyProblem(t('That looks like an address rather than something to check, and it is not one this page will follow. Save the file and drop it here instead.'));
      return;
    }
    // Cheap pre-check before the encode: characters can only outnumber bytes,
    // so anything past the limit here is past it in bytes too (verifyFile makes
    // the exact check on the encoded File).
    if (text.length > MAX_VERIFY_BYTES) {
      sayVerifyProblem(t('That text is too large to check here (over {n} MB).', { n: Math.round(MAX_VERIFY_BYTES / 1024 / 1024) }));
      return;
    }
    const bytes = new TextEncoder().encode(text);
    pendingPasted = true;
    await handle([new File([bytes as BlobPart], pastedFileName(sniffFormat(bytes)), { type: 'text/plain' })]);
  }

  const onPaste = (e: ClipboardEvent): void => {
    if (isTypingTarget(e.target)) return;
    const files = pastedFiles(e.clipboardData);
    if (files.length) { e.preventDefault(); void handle(files); return; }
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text.trim()) { e.preventDefault(); void handlePastedText(text); }
  };
  document.addEventListener('paste', onPaste);
  // `view._cleanup` is the shell's teardown hook (main.ts runs it on every route
  // change). CHAINED, not replaced: another mount may already own one, and a
  // document-level listener that outlived its view would hijack pastes on every
  // page after this one.
  {
    const el = viewEl as HTMLElement & { _cleanup?: () => void };
    const prev = el._cleanup;
    el._cleanup = () => { prev?.(); document.removeEventListener('paste', onPaste); };
  }

  // The visible fallback. The clipboard is NEVER read programmatically here - 
  // navigator.clipboard.readText() would raise a permission prompt for a page
  // that has not been asked to read anything, and on the platforms where the
  // paste event is awkward (an iPad without a keyboard, a locked-down browser)
  // the honest answer is a plain textarea the person pastes into themselves.
  const pasteOpen = viewEl.querySelector<HTMLButtonElement>('[data-paste-open]')!;
  const pastePanel = viewEl.querySelector<HTMLElement>('[data-paste-panel]')!;
  const pasteText = viewEl.querySelector<HTMLTextAreaElement>('[data-paste-text]')!;
  const setPasteOpen = (open: boolean, restoreFocus = false): void => {
    pastePanel.hidden = !open;
    pasteOpen.setAttribute('aria-expanded', String(open));
    if (open) pasteText.focus();
    else {
      layoutEl.classList.remove('is-pasting');
      if (restoreFocus) pasteOpen.focus();
    }
  };
  pasteOpen.addEventListener('click', () => setPasteOpen(pastePanel.hidden));
  viewEl.querySelector<HTMLButtonElement>('[data-paste-cancel]')!
    .addEventListener('click', () => setPasteOpen(false, true));
  viewEl.querySelector<HTMLButtonElement>('[data-paste-verify]')!.addEventListener('click', () => {
    const text = pasteText.value;
    if (!text.trim()) { pasteText.focus(); return; }
    setPasteOpen(false);
    void handlePastedText(text);
  });
  // House rule: Esc closes and hands focus back to what opened it. Scoped to the
  // panel, so it can't swallow an Esc meant for anything else on the page.
  pastePanel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    setPasteOpen(false, true);
  });
  viewEl.querySelector<HTMLButtonElement>('[data-check-more]')!
    .addEventListener('click', () => { input.value = ''; input.click(); });
  viewEl.querySelector<HTMLButtonElement>('[data-result-paste]')!
    .addEventListener('click', () => {
      layoutEl.classList.add('is-pasting');
      setPasteOpen(true);
    });

  // A cross-page image drag carries text/uri-list (and text/html with the <img>),
  // never the pixels. Fetching the URL is the only way to get bytes - it happens
  // solely on this explicit user drop, same-origin drops (our own docs images)
  // always work, and a cross-origin server that refuses CORS gets a plain
  // explanation instead of dead air.
  const sayVerifyProblem = (msg: string): void => {
    enterResultMode();
    reportEl.hidden = false;
    reportEl.innerHTML = `<div class="valid-reports-list"><p class="valid-busy">${escape(msg)}</p></div>`;
    playSfx('warn');
  };

  /** Fetch a URL's bytes and run them through the normal verify path. */
  async function verifyFromUrl(url: string, onFail: (host: string) => string): Promise<void> {
    const name = decodeURIComponent(new URL(url, location.origin).pathname.split('/').pop() || 'image');
    enterResultMode();
    reportEl.hidden = false;
    reportEl.innerHTML = `<div class="valid-reports-list">${checkingHtml(t('Checking {name}…', { name }))}</div>`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      // The one path where the checked file HAS an address. A credential
      // reference inside it may be relative, and relative to this is the only
      // thing it can be relative to - see NoticeContext.base.
      pendingSourceUrl = url;
      await handle([new File([blob], name, { type: blob.type })]);
    } catch {
      sayVerifyProblem(onFail(new URL(url, location.origin).hostname));
    }
  }

  async function handleDroppedLink(dt: DataTransfer | null): Promise<void> {
    const say = sayVerifyProblem;
    let url = dt?.getData('text/uri-list')?.split('\n').find((l) => l && !l.startsWith('#'))?.trim() ?? '';
    if (!url) {
      const html = dt?.getData('text/html') ?? '';
      url = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? '';
    }
    if (!url) {
      const text = dt?.getData('text/plain')?.trim() ?? '';
      if (/^https?:\/\//i.test(text)) url = text;
    }
    if (!/^https?:\/\//i.test(url)) {
      // No file, no link - but text/plain with something in it IS the payload:
      // dragging a selection out of an editor is the same gesture as pasting it,
      // and a C2PA text credential travels in exactly that kind of selection.
      // Read raw (never trimmed): the invisible characters section A.8 hides a manifest
      // in are part of the bytes, and the hash is over all of them.
      const dropped = dt?.getData('text/plain') ?? '';
      if (dropped.trim()) { await handlePastedText(dropped); return; }
      say(t('That drop carried no file. Drag a file from your computer, or drop an image from a web page.'));
      return;
    }
    await verifyFromUrl(url, (h) => tRaw('Dragging an image between pages hands over a link, not the file - and {host} would not let this page fetch it. Save the image to your device and drop that file here instead.', { host: h }));
  }

  // `#/verify?src=/path/to/file` - verify a file this site already serves, on load.
  // SAME-ORIGIN ONLY, and deliberately so: it must start with a single `/`. This
  // page's promise is that nothing is uploaded and nothing is fetched on your
  // behalf, so a link must not be able to make your browser reach a third-party
  // host (`//evil.example/x` is a protocol-relative URL and is rejected with the
  // rest). It makes a report shareable and reproducible - the docs screenshot of
  // a real change history is captured from exactly such a link.
  const src = new URLSearchParams(params).get('src');
  if (src) {
    if (/^\/[^/]/.test(src)) {
      await verifyFromUrl(src, () => tRaw('Could not read {src} from this site.', { src }));
      // `&check=1` (the docs reader's AI-scan donut): the arriving press was
      // already "check this page", so the same-origin credential reference the
      // page names is resolved without a second "Fetch and check" click. Still
      // the one gate - fetchExternalManifest re-classifies the address and
      // refuses anything cross-origin. Plain ?src= links keep the ask-first
      // button (the docs shots capture that state).
      if (new URLSearchParams(params).get('check')) {
        const fetchBtn = reportEl.querySelector<HTMLButtonElement>('[data-fetch-manifest]');
        if (fetchBtn) void fetchExternalManifest(fetchBtn);
      }
    } else {
      sayVerifyProblem(t('Only files served by this site can be checked from a link. Drop the file here instead.'));
    }
  }

  // Arrived here from the catalog's "Check credentials" link? Verify that asset straight
  // away, and surface the handoff note (e.g. re-encoded-on-import caveat) above the report.
  const showHandoffNote = (note: string | undefined): void => {
    if (!note) return;
    reportEl.querySelector('.valid-reports-list')?.insertAdjacentHTML(
      'afterbegin',
      `<p class="valid-handoff-note">${escape(note)}</p>`,
    );
  };
  const handoff = takePendingVerify();
  if (handoff?.files.length) {
    await handle(handoff.files);
    showHandoffNote(handoff.note);
  } else {
    // `#/verify?asset=<id>` (plan 171) - the shareable form of that same handoff:
    // resolve the asset on THIS device and run the identical preparation (heal +
    // captured-credential re-attach), so a link reaches the verdict the catalog's
    // own button shows. Same-device semantics as every asset id: a catalog id
    // resolves wherever that catalog is synced, a user/ id only where it lives;
    // an id this device doesn't hold reports plainly instead of fetching anything.
    const assetId = new URLSearchParams(params).get('asset');
    if (assetId) {
      let ref = null;
      try { ref = await host.assets.get(assetId); } catch { ref = null; }
      const prep = ref ? await prepareAssetForVerify(host, ref) : null;
      if (prep?.files.length) {
        await handle(prep.files);
        showHandoffNote(prep.note);
      } else {
        sayVerifyProblem(t('No asset with that id is on this device, so there is nothing to check. Open the link where the asset lives, or drop the file here instead.'));
      }
    }
  }
}
