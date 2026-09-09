// SPDX-License-Identifier: MPL-2.0
/**
 * catalog: thumbnail markup, text signals, OCR frames, AI pills and persisted signals.
 *
 * Every function takes the shared `cat: CatCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `cat.<module>.<fn>`. Extracted verbatim
 * from mountCatalog() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { assetAddedAt, matchContext as matchContextRule } from '../catalog-filter.ts';
import { audioTransportHtml } from '../../lib/audio-transport.ts';
import { t, tRaw } from '../../i18n.ts';
import { GENAI_CLAIM, aiSignalsChip, assetAiKind, genAiPill } from '../../lib/genai-pill.ts';
import { motionVideoThumb } from '../../lib/preview-media.ts';
import { buildHighlightSegments, heatBucket } from '../valid-text.ts';
import type { TextSignalMark, TextSignalPanel } from '../valid-text.ts';
import { categoryLabel, libCategory } from '../../lib/asset-category.ts';
import { assetBaseId } from '../../lib/asset-favourites.ts';
import { icon } from '../../lib/icons.ts';
import { audioThumbPlaceholder } from '../../lib/audio-thumb.ts';
import { peaksFingerprint } from '../../lib/audio-peaks.ts';
import { isModuleFormat } from '../../lib/mod-render.ts';
import { groupPalette, isTransparent } from '../../lib/swatches.ts';
import { hexToOklch, oklchToHex } from '../../../../../engine/src/brand-derive.ts';
import { rampOklab } from '../../../../../engine/src/color-tools.ts';
import { LEXICON_VERSION } from '@lolly/engine';
import type { HumanizeResult } from '@lolly/engine';
import { wmNoteSlot } from '../../lib/wm-note.ts';
import { visibleTextHtml } from '../../lib/invisible-chars.ts';
import { tsigFactsHtml } from '../tsig-facts.ts';
import { aiModelSlot } from '../tsig-model-note.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { PhotoTreatment } from '../../../../../engine/src/photo-treatment.ts';
import { CHECK_ICON } from './shared.ts';
import type { AiSignalsNote, RewordUiState } from './shared.ts';
import { bindOp, type CatCtx } from './context.ts';

// `asSpan` renders the thumbnail with span-only markup (for nesting inside a <button>);
// otherwise a plain <img>/<div>. Both are used: tiles nest it in the open-details button.
export function thumbHtml(cat: CatCtx, ref: AssetRef, asSpan = false, full = false): string {
  const tag = asSpan ? 'span' : 'div';
  if (ref.meta?._placeholder) return `<${tag} class="cat-thumb cat-thumb-stub">${escapeText(ref.type)}</${tag}>`;
  // A brand PALETTE asset. Its swatches are the live brand palette (the same
  // source the Swatches panel paints from), so it needs no fetch. A grid tile is
  // a compact mosaic of the presets; the details modal (full) is Colour Lab in a
  // card - every preset with its hex + OKLCH and a freshly EXTRAPOLATED OKLab
  // tint→shade ramp (the exact derivation the #/lab view uses), so the "hard-coded
  // presets and their extrapolated values" all read at a glance.
  if (ref.type === 'palette') {
    const g = groupPalette(cat.palette);
    const presets = [...g.brand, ...g.spectrum];
    const solid = (presets.length ? presets : cat.palette).filter(c => !isTransparent(c.hex));
    if (full) {
      const rows = solid.map(c => {
        const o = hexToOklch(c.hex);
        if (!o) return '';
        // Same tint→shade curve as the Colour Lab view: chroma pulled in at the
        // pale end and pushed out at the dark end so the ramp reads clean top and
        // bottom; the perceptual spacing is rampOklab's correctLightness.
        const ramp = rampOklab(
          [oklchToHex({ l: 0.97, c: o.c * 0.22, h: o.h }), c.hex, oklchToHex({ l: 0.13, c: o.c * 0.5, h: o.h })],
          9, { correctLightness: true },
        );
        const cells = ramp.map(hx => `<span class="cat-lab-step" style="background:${escapeText(hx)}" title="${escapeText(hx)}"></span>`).join('');
        const oklch = `oklch(${(o.l * 100).toFixed(1)}% ${o.c.toFixed(3)} ${Math.round(o.h)})`;
        return `<div class="cat-lab-row">`
          + `<span class="cat-lab-swatch" style="background:${escapeText(c.hex)}"></span>`
          + `<span class="cat-lab-name">${escapeText(c.label)}</span>`
          + `<code class="cat-lab-hex">${escapeText(c.hex)}</code>`
          + `<code class="cat-lab-oklch">${escapeText(oklch)}</code>`
          + `<span class="cat-lab-ramp">${cells}</span></div>`;
      }).join('');
      return `<${tag} class="cat-thumb cat-swatch-lab">${rows}</${tag}>`;
    }
    const cells = solid.slice(0, 12).map(c => `<span style="background:${escapeText(c.hex)}"></span>`).join('');
    return `<${tag} class="cat-thumb cat-thumb-swatches" aria-hidden="true">${cells}</${tag}>`;
  }
  // Lottie: a looping player mounted over the still poster - autoplayLottieThumbs mounts it
  // while the tile is on screen; the poster background (or a ▶ for a posterless user upload)
  // is the resting frame. The json is the play source: a library lottie exposes it on
  // meta.animationUrl (ref.url is the poster); a user upload's url IS the json.
  if (ref.type === 'lottie') {
    const json = ref.source === 'user' ? ref.url : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : '');
    const poster = ref.source !== 'user' && typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
    // A looping SVG player mounted over the still poster. Grid tiles get it via
    // autoplayLottieThumbs (on-screen gated); the details modal (full) mounts one player and
    // makes it zoomable - a Lottie renders as SVG, so it inspects crisply like vector art,
    // with a play/pause overlay (openDetails). The poster is the resting background until the
    // player loads; a posterless user upload shows a centred ▶. In the modal attachZoom sizes
    // the box explicitly, so the "no intrinsic height" grid caveat doesn't apply.
    if (json) {
      const style = poster ? ` style="background-image:url('${escapeText(poster)}')"` : '';
      return `<${tag} class="cat-thumb cat-thumb-motion" data-lottie-src="${escapeText(json)}" data-lottie-fit="contain"${style} aria-hidden="true">${poster ? '' : '▶'}</${tag}>`;
    }
    if (poster) return `<img class="cat-thumb" src="${escapeText(poster)}" alt="" loading="lazy" decoding="async">`;
    return `<span class="cat-thumb cat-thumb-stub" aria-hidden="true">▶</span>`;
  }
  // A video needs a <video> (an <img> src=mp4 would break). <video> is phrasing
  // content, so it's valid inside the tile's <button> - no span/div switch needed.
  // It PLAYS ONLY ON INTENT - hover/focus on a mouse, the most-centered tile on touch -
  // through the one policy in lib/preview-media.ts, armed by mountMotionThumbs below.
  // It used to be `autoplay preload="metadata"` with no visibility gate, so painting the
  // grid fetched a header for every clip in the catalog and played all of them at once.
  // (gif/apng/animated-webp are type:'raster' and animate natively in the <img> below.)
  // In the details modal (`full`) the user has explicitly opened THIS asset, so it is
  // the one video that should load and play on sight - the intent gate exists to stop a
  // grid of them, not to make an opened clip sit there dead with no poster to show.
  if (ref.type === 'video') {
    return full
      ? `<video class="cat-thumb" src="${escapeText(ref.url)}" muted loop autoplay playsinline preload="metadata"></video>`
      : motionVideoThumb(ref.url, 'cat-thumb');
  }
  // Audio. In the details modal (full) it gets a real <audio controls> player to preview;
  // on a grid tile it draws its own MEASURED waveform (mountAudioThumbs swaps the glyph
  // for one once peaks exist - a glyph, never an invented shape, until then). The grid
  // tile nests the thumb inside a <button>, where an interactive <audio> control is
  // invalid - so the player is the `full` path only (the modal preview isn't a button).
  // Both use `tag` (span inside a button, div in the modal).
  if (ref.type === 'audio') {
    if (full) {
      // zzfxm songs and tracker modules are song data, not a playable audio file - 
      // mark them so openDetails renders them to a WAV blob (plays in ANY browser, no
      // codec dependency). Encoded audio plays directly; an onerror surfaces an
      // unsupported-format note instead of failing quietly.
      const zz = ref.format === 'zzfxm';
      const mod = isModuleFormat(ref.format);
      const srcAttr = zz ? `data-zzfxm-url="${escapeText(ref.url)}"`
        : mod ? `data-mod-url="${escapeText(ref.url)}"`
        : `src="${escapeText(ref.url)}"`;
      // A big live level meter above the controls (same bar look + theming as the
      // Neurospicy player's - lib/audio-meter.ts draws both). Wired in openDetails.
      // The audio surface ESCALATES rather than switching modes: the bars analyser is
      // what you get for free, a visualiser is one click up, and immersive is one more - 
      // the same ladder the Neurospicy player uses (inline → panel → fullscreen). The
      // cover commit lives at the top of it because "keep what I'm looking at" is the
      // whole interaction; there is no separate picker to learn.
      // The MEDIA fills the stage; every control lives in the one shared bar. The
      // visualiser and the meter occupy the same box (one hidden at a time), so
      // escalating never changes the pane's height.
      return `<${tag} class="cat-thumb cat-thumb-audio cat-stage" data-audio-stage>`
        + `<canvas class="cat-audio-meter" data-audio-meter width="640" height="160" role="button" tabindex="0" aria-label="${escapeText(t('Switch visualisation'))}"></canvas>`
        + `<div class="cat-audio-viz" data-audio-viz hidden></div>`
        + `<div class="cat-stage-bar">`
          // The element is the PLAYBACK ENGINE, not the UI: the meter and the visualiser
          // both tap it, and an element yields only one MediaElementSource ever, so it
          // stays exactly where it is. Only its native chrome goes - see lib/audio-transport.
          + `<audio ${srcAttr} preload="metadata" data-audio-preview></audio>`
          + audioTransportHtml({
            play: t('Play'), pause: t('Pause'), seek: t('Seek'),
            mute: t('Mute'), unmute: t('Unmute'), volume: t('Volume'),
          })
          // The look controls only exist once you have escalated - before that the bar
          // is just a player, which is all an asset you are auditioning needs.
          // Two dials, deliberately separate: PRESET (the form) and COLOUR (the paint).
          // Shuffling one must not disturb the other - that is the difference between
          // adjusting a look and losing it.
          + `<span class="cat-viz-group" data-audio-vizbar hidden>`
            + `<button type="button" class="cat-viz-btn" data-viz-prev title="${escapeText(t('Previous preset'))}" aria-label="${escapeText(t('Previous preset'))}">‹</button>`
            + `<span class="cat-viz-name" data-viz-name></span>`
            + `<button type="button" class="cat-viz-btn" data-viz-next title="${escapeText(t('Next preset'))}" aria-label="${escapeText(t('Next preset'))}">›</button>`
            + `<button type="button" class="cat-viz-btn" data-viz-shuffle title="${escapeText(t('Shuffle preset'))}" aria-label="${escapeText(t('Shuffle preset'))}">🎲</button>`
            + `<button type="button" class="cat-viz-btn" data-viz-colour-shuffle title="${escapeText(t('Shuffle brand colour'))}" aria-label="${escapeText(t('Shuffle brand colour'))}">🎨</button>`
            + `<button type="button" class="cat-viz-btn" data-viz-immerse title="${escapeText(t('Immersive'))}" aria-label="${escapeText(t('Immersive'))}">⛶</button>`
            + `<button type="button" class="cat-viz-btn is-primary" data-viz-cover>${escapeText(t('Use as cover'))}</button>`
          + `</span>`
          + `<button type="button" class="cat-viz-hint" data-viz-toggle aria-pressed="false">${escapeText(t('Visualiser'))}</button>`
        + `</div>`
        + `<p class="cat-audio-note" role="status" hidden></p></${tag}>`;
    }
    // .cat-thumb-motion is the "an inline SVG fills this box" rule (`> svg` at 100%),
    // written for the Lottie player and doing the identical job here.
    return `<${tag} class="cat-thumb cat-thumb-motion cat-thumb-audio" data-audio-thumb="${escapeText(ref.id)}" data-audio-fp="${escapeText(peaksFingerprint(ref))}">`
      + audioThumbPlaceholder({ label: String(ref.meta?.name ?? ref.id) })
      + `</${tag}>`;
  }
  // A text asset (.txt/.md, plans/125): the bytes ARE the text, so an <img src=text>
  // is a broken image. The modal (full) shows a real reading preview filled after mount
  // from the asset url (the fetch is async; this markup is built sync). A grid tile shows
  // a calm document stub. A tabular data asset gets its own stub glyph.
  if (ref.type === 'text' || ref.type === 'data') {
    if (full && ref.type === 'text') {
      // The reading surface: raw monospace <pre> (textContent-filled) plus a
      // rendered-markdown sibling the toggle swaps in, and a small tools pill
      // (font zoom for both modes; the render toggle unhides for md-shaped
      // text once the fetch arrives). Rendered HTML is DOMPurify-sanitised.
      return `<${tag} class="cat-thumb cat-thumb-text"><pre class="cat-text-preview" data-text-src="${escapeText(ref.url)}">${escapeText(t('Loading…'))}</pre>`
        + `<div class="cat-md-rendered" data-md-rendered hidden></div>`
        + `<span class="cat-text-tools">`
        + `<button type="button" data-act="text-zoom-out" title="${escapeText(t('Smaller text'))}" aria-label="${escapeText(t('Smaller text'))}">${icon('zoomOut', { size: 14 })}</button>`
        + `<button type="button" data-act="text-zoom-in" title="${escapeText(t('Larger text'))}" aria-label="${escapeText(t('Larger text'))}">${icon('zoomIn', { size: 14 })}</button>`
        + `<button type="button" data-act="text-render" hidden aria-pressed="false" title="${escapeText(t('Rendered or monospace'))}" aria-label="${escapeText(t('Rendered or monospace'))}">${icon('document', { size: 14 })}</button>`
        + `</span></${tag}>`;
    }
    // A text tile starts as the calm ¶ glyph and is upgraded post-mount by
    // lib/text-thumbs.ts (mountTextThumbGrid): a brand-inked excerpt sized by
    // document length, focused on the hottest AI-signal region with its heat
    // marks, and a faint corner score donut - the audio-waveform treatment,
    // for text. Data assets keep the ▦ stub (their bytes are not prose).
    if (ref.type === 'text') {
      return `<${tag} class="cat-thumb cat-thumb-stub cat-thumb-ttxt" data-text-thumb="${escapeText(ref.id)}" aria-hidden="true">¶</${tag}>`;
    }
    // A stored PDF (an auto-saved render keeps its credentialed bytes verbatim,
    // so it is typed 'data') starts as the ▦ stub and is upgraded
    // post-mount to a first-page vector preview by lib/pdf-thumbs.ts
    // (mountPdfThumbGrid) - the audio/text-thumb treatment, for documents.
    const fmt = String(ref.meta?.format ?? '').toLowerCase();
    if (fmt.startsWith('pdf') || /\.pdf$/i.test(String(ref.meta?.name ?? ''))) {
      return `<${tag} class="cat-thumb cat-thumb-stub" data-pdf-thumb="${escapeText(ref.id)}" aria-hidden="true">▦</${tag}>`;
    }
    return `<${tag} class="cat-thumb cat-thumb-stub" aria-hidden="true">▦</${tag}>`;
  }
  // A 3-D model (GLB) or a LUT (.cube colour grade): the tile can't render the mesh
  // or run the grade live, so it shows a rendered still poster (a companion PNG that
  // query() surfaces on meta.posterUrl), exactly as a lottie/video tiles from its
  // poster - a LUT's poster is the grade applied to a reference chart. Same still in
  // the details modal.
  if (ref.type === 'model' || ref.type === 'lut') {
    const poster = typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
    return poster
      ? `<img class="cat-thumb" src="${escapeText(poster)}" alt="" loading="lazy" decoding="async">`
      : `<${tag} class="cat-thumb cat-thumb-stub" aria-hidden="true">◈</${tag}>`;
  }
  // Grid tiles show the small `thumb` derivative (query() puts its url on meta.thumbUrl);
  // the details/zoom modal passes full=true to keep the original for close inspection.
  const src = !full && typeof ref.meta?.thumbUrl === 'string' && ref.meta.thumbUrl ? ref.meta.thumbUrl : ref.url;
  return `<img class="cat-thumb" src="${escapeText(src)}" alt="" loading="lazy" decoding="async">`;
}
// The catalog's compact render of a text AI-likelihood report (plans/125), the
// counterpart to the verify view's panel. A SIGNAL, never a verdict: hedged heading,
// "not proof" summary. Reads fine unstyled (headings + a list), so it needs no new CSS.
export function catTextSignalsHtml(cat: CatCtx, panel: TextSignalPanel): string {
  const heading: Record<TextSignalPanel['band'], string> = {
    none: t('No signals that this text was AI-generated'),
    weak: t('A few weak signals that this text may be AI-generated'),
    notable: t('Signals that this text may be AI-generated'),
    strong: t('Strong signals that this text may be AI-generated'),
  };
  const title: Record<string, string> = {
    'model-fingerprint': t('Model fingerprint'),
    'invisible-char': t('Invisible characters'),
    'tag-chars': t('Hidden tag characters'),
    'variation-selectors': t('Unusual variation selectors'),
    'bidi-override': t('Bidirectional override characters'),
    'mixed-script': t('Mixed-script words'),
    'anomalous-space': t('Unusual spacing'),
    'ai-vocabulary': t('AI-favoured vocabulary'),
    'ai-phrasing': t('AI stock phrasing'),
    'ai-structure': t('AI sentence structure'),
    'claude-tell': t('Claude-associated phrasing'),
    'smart-punctuation': t('Curly quotes / smart punctuation'),
    'em-dash-density': t('Heavy em-dash use'),
    'list-heavy': t('List-heavy structure'),
    'uniform-burstiness': t('Unusually uniform sentences'),
    'chatbot-leftover': t('Chatbot boilerplate'),
    'template-placeholder': t('Unfilled template placeholders'),
    'uniform-paragraphs': t('Unusually uniform paragraphs'),
    'ai-span': t('Concentrated AI-like section'),
    'family-tell': t('Model-associated phrasing'),
    'spelling-variant-mix': t('Mixed US/British spelling'),
    'model-estimate': t('On-device model estimate'),
  };
  const rows = panel.rows.map((r) => `<li><strong>${escapeText(title[r.kind] ?? r.kind)}</strong>${r.detail ? ` - ${escapeText(r.detail)}` : ''}</li>`).join('');
  // The heat-bar minimap, start of the text to its end - the same rolling windows
  // the verify view paints. `cell.heat` is a plain 0-1 number the engine already
  // rounded, and it is the ONLY thing interpolated into the style attribute, as a
  // custom property the stylesheet turns into a colour.
  const heatbar = panel.heatmap && panel.heatmap.cells.length >= 4
    ? `<div class="cat-tsig-heatbar" role="img" aria-label="${escapeText(t('Where AI-writing signals concentrate in this text'))}">${panel.heatmap.cells.map((c) => `<i style="--h:${c.heat}"></i>`).join('')}</div>`
    : '';
  const guess = panel.guessFamily
    ? (panel.guessConfidence === 'high'
      ? `<p class="cat-tsig-guess">${tRaw('Identified as <strong>{family}</strong> from a leaked model fingerprint.', { family: escapeText(panel.guessFamily) })}</p>`
      : `<p class="cat-tsig-guess">${tRaw('Best guess (low confidence): consistent with <strong>{family}</strong> output.', { family: escapeText(panel.guessFamily) })}</p>`)
    : '';
  // The runners-up behind a LOW-confidence guess keep the winner honest ("leans X
  // over Y", not "is X"). A leaked fingerprint needs no runners-up.
  // Absence of a leaked marker is not a failed check: chat apps strip their own
  // scaffolding on copy, so most AI text carries none. Said out loud (mirrors valid.ts).
  const noMarker = panel.band !== 'none' && !panel.pixelSourced && !panel.rows.some((r) => r.kind === 'model-fingerprint')
    ? `<p class="cat-tsig-cands">${escapeText(t('No leaked model markers were found in this text. Chat apps usually strip them from copied answers, so their absence proves nothing either way.'))}</p>`
    : '';
  const cands = panel.guessConfidence === 'low' && (panel.guessCandidates?.length ?? 0) >= 2
    ? `<p class="cat-tsig-cands">${escapeText(t('Style comparison across families:'))} ${escapeText(panel.guessCandidates!.map((c) => `${c.family} ${c.strength}`).join(' · '))}</p>`
    : '';
  // The score donut: a centred hero gauge with the rating INSIDE the ring.
  // Colour follows the BAND (a state, not a series); the number wears text
  // tokens, so colour is never the only carrier. Numeric-only SVG.
  const gn = Math.max(0, Math.min(100, Math.round(panel.score)));
  const gc = 2 * Math.PI * 26;
  const gOn = (gn / 100) * gc;
  const gauge = `<div class="cat-tsig-gauge-wrap"><svg class="cat-tsig-gauge" viewBox="0 0 64 64" role="img" aria-label="${escapeText(tRaw('Signal score {n} of 100', { n: gn }))}" data-band="${escapeText(panel.band)}">`
    + '<circle class="cat-tsig-gauge-track" cx="32" cy="32" r="26"/>'
    + `<circle class="cat-tsig-gauge-fill" cx="32" cy="32" r="26" stroke-dasharray="${gOn.toFixed(2)} ${gc.toFixed(2)}"/>`
    + `<text class="cat-tsig-gauge-num" x="32" y="34">${gn}</text>`
    + '<text class="cat-tsig-gauge-den" x="32" y="45">/100</text>'
    + '</svg></div>';
  // The reword-watermark slot (lib/wm-note.ts): filled after render ONLY on
  // a detection - the one signal here that names its source with confidence.
  const wm = panel.text != null ? wmNoteSlot(panel.text, 'cat-tsig-guess cat-tsig-wm') : '';
  // The model-tier slot (views/tsig-model-note.ts): consent line / estimate /
  // honesty copy; a conclusive estimate re-renders this panel via the callback.
  const modelSlot = aiModelSlot(panel, 'cat-tsig-note', (p) => catTextSignalsHtml(cat, p));
  return `<div class="cat-tsig" data-band="${escapeText(panel.band)}" role="note" data-tsig-root>
      <p class="cat-tsig-head">${icon('aiSpark', { size: 14 })} <strong>${escapeText(heading[panel.band])}</strong></p>
      ${wm}
      ${gauge}
      ${heatbar}
      ${rows ? `<ul class="cat-tsig-list">${rows}</ul>` : ''}
      ${guess}
      ${cands}
      ${noMarker}
      ${modelSlot}
      ${panel.facts ? tsigFactsHtml(panel.facts) : ''}
      <p class="cat-tsig-note${panel.band === 'strong' ? ' guide-warn' : panel.band === 'notable' ? ' guide-hint' : ''}">${escapeText(panel.summary)}</p>
    </div>`;
}
/** Extracted text with its flagged spans wrapped in confidence-graded <mark>s.
 *  The tier class keeps the coarse amber/red base; the heat bucket (t1 coolest,
 *  t5 hottest) refines it to the same 5-step temperature the verify view grades. */
export function catHighlightHtml(_cat: CatCtx, text: string, marks: TextSignalMark[]): string {
  // Tooltip names the grade so the reader knows what is ignorable - the
  // copy maps buckets exactly as valid.ts's heatGradeWord does.
  const grade = (b: number): string => b >= 4 ? t('a strong tell') : b === 3 ? t('a moderate signal') : t('a weak hint, safe to ignore');
  return buildHighlightSegments(text, marks).map((s) => {
    if (!s.tier) return visibleTextHtml(s.text, 'cat-invis');
    const b = heatBucket(s.heat ?? 0);
    return `<mark class="cat-hl cat-hl--${escapeText(s.tier)} cat-hl--t${b}" title="${escapeText(grade(b))}">${visibleTextHtml(s.text, 'cat-invis')}</mark>`;
  }).join('');
}
/** The Humanize result: what the deterministic clean-up changed, the cleaned text with
 *  its remaining (semantic) tells highlighted, deterministic plain-wording suggestions
 *  (accepted per row, still no genAI stamp), the on-device model's reword offers when
 *  staged (accepting one flags the saved copy as AI-assisted - plans/127), and the
 *  honest AI-origins opt-in - a nudge to declare, never an auto-stamp.
 *  `canDeclare` = the asset is a user upload: the declare action writes onto the
 *  record's meta, and built-in catalog content is an immutable checksum-validated
 *  contract, so the button must never render for it (it would be a dead control). */
export function catTextWorkHtml(cat: CatCtx, panel: TextSignalPanel, result: HumanizeResult | null, canDeclare: boolean, rw: RewordUiState, edited: boolean, truncated: boolean): string {
  // What Fix characters changed - only once it has run.
  const fixed = result
    ? `<p class="cat-tsig-head">${icon('wrench', { size: 14 })} <strong>${t('Characters fixed to house style, on-device')}</strong></p>
        ${result.changes.length
          ? `<ul class="cat-tsig-list">${result.changes.map((c) => `<li><strong>${escapeText(c.label)}</strong> ×${c.count}</li>`).join('')}</ul>`
          : `<p class="cat-tsig-note">${t('Nothing to fix. The characters in this text already match house style.')}</p>`}`
    : '';
  // The edits live INLINE now: the sidebar narrates what is marked in the
  // preview and offers the bulk apply; each decision happens at the text.
  const n = rw.suggestions.length;
  const m = rw.status !== 'unstaged' ? rw.spans.length : 0;
  const guidance = n + m
    ? `<div class="cat-reword-sec">
          <p class="cat-tsig-head"><strong>${t('Suggested edits')}</strong></p>
          <p class="cat-tsig-note">${n ? tRaw('{n} wording swaps are underlined in the preview.', { n }) : ''}
            ${m ? tRaw('{n} sentences have a dotted underline: the on-device model can offer a plainer version. Accepting one flags the saved copy as AI-assisted, and model wording carries Lolly\'s public reword watermark so AI-written text stays detectable on Verify.', { n: m }) : ''}
            ${t('Click a highlight to decide each one.')}</p>
          ${rw.status === 'need-download' && m ? `<p class="cat-tsig-note">${escapeText(tRaw('First use downloads the rewriter once (~{mb} MB); it works offline after that.', { mb: Math.round(rw.modelBytes / (1024 * 1024)) }))}</p>` : ''}
          ${n > 1 ? `<button type="button" class="btn cat-reword-apply-all" data-act="reword-suggest-all">${escapeText(tRaw('Apply all {n} swaps', { n }))}</button>` : ''}
          ${truncated ? `<p class="cat-tsig-note">${t('The preview shows the first part of a long document; Apply all still covers the whole text.')}</p>` : ''}
        </div>`
    : `<p class="cat-tsig-note">${t('No wording edits to offer for this text.')}</p>`;
  // Save/copy only once the working copy differs from the file - before that
  // they would duplicate Copy text and save an identical asset.
  const saveLabel = rw.modelTouched ? t('Add to catalog (flagged as AI-assisted)') : t('Add to catalog');
  const actions = edited
    ? `<div class="cat-humanize-actions"><button type="button" class="btn cat-act-copy-clean" data-act="copy-clean">${icon('duplicate', { size: 14 })}<span>${t('Copy edited text')}</span></button><button type="button" class="btn cat-act-save-clean" data-act="save-clean">${icon('filePlus', { size: 14 })}<span>${saveLabel}</span></button></div>`
    : '';
  // Offer the honest declaration only when signals remain - so it reads as encouragement
  // to do the right thing, not a prompt on obviously-human text - and only where the
  // declaration can actually land (a user upload, per `canDeclare` above).
  const declare = canDeclare && panel.band !== 'none'
    ? `<p class="cat-tsig-note">${t('If this text did come from AI, you can flag its AI origins on the asset so that travels honestly wherever it is used.')} <button type="button" class="btn cat-act-declare-ai" data-act="declare-ai-origins">${t('Flag AI origins')}</button></p>`
    : '';
  return `${catTextSignalsHtml(cat, panel)}<div class="cat-tsig" role="note">
      ${fixed}
      ${guidance}
      ${actions}
      ${declare}
    </div>`;
}
/** Decode a raster asset URL to the RGBA frame host.ocr.run expects. */
export async function rasterToOcrFrame(_cat: CatCtx, url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  const cx = canvas.getContext('2d');
  if (!cx) throw new Error('no 2d context');
  cx.drawImage(bmp, 0, 0);
  const img = cx.getImageData(0, 0, bmp.width, bmp.height);
  const frame = { width: bmp.width, height: bmp.height, data: img.data };
  bmp.close?.();
  return frame;
}
// A row of two-colour theme swatches (the icon "colours" picker) - shared by the download
// dialog, the asset-details modal and the icons-category header, so they all offer the same
// control. Reuses the download dialog's .cat-dl-theme / .cat-dl-duo chrome; `active` marks
// the current pairing.
export const iconSwatchRow = (cat: CatCtx, active: string | null): string =>
  `<div class="cat-dl-themes" role="group" aria-label="${escapeText(t('Icon colours'))}">${cat.iconThemes.map(th =>
      `<button type="button" class="cat-dl-theme${th.id === active ? ' is-active' : ''}" data-theme="${escapeText(th.id)}" data-sfx="shimmer" data-voice="${escapeText(th.label ?? th.id)}" aria-pressed="${th.id === active}" title="${escapeText(th.label ?? th.id)}"><span class="cat-dl-duo" style="background:${escapeText(th.previewBg ?? '#fff')}"><i style="background:${escapeText(String(th.c2 ?? '#888'))}"></i><i style="background:${escapeText(String(th.c1 ?? '#333'))}"></i></span></button>`).join('')}</div>`;
// The bitmap sibling of iconSwatchRow: a photo-treatment strip for raster groups. Leads
// with an "Original" (no-treatment) button, then one gradient swatch per treatment
// (greyscale ramp / duotone shadow→highlight). Reuses the .cat-dl-theme chrome; the extra
// .cat-dl-treat class routes clicks to the treatment handler (not the icon one).
export const treatmentSwatchRow = (cat: CatCtx, active: string | null): string => {
  const swatch = (t: PhotoTreatment): string => {
    if (t.kind === 'greyscale') return 'linear-gradient(135deg,#2b2b2b,#e9e9e9)';
    const stops = [t.shadow ?? '#333', t.mid, t.highlight ?? '#eee'].filter(Boolean).map(c => escapeText(String(c)));
    return `linear-gradient(135deg,${stops.join(',')})`;
  };
  return `<div class="cat-dl-themes" role="group" aria-label="${escapeText(t('Photo colour treatment'))}">`
    + `<button type="button" class="cat-dl-theme cat-dl-treat${!active ? ' is-active' : ''}" data-treatment="" data-voice="${escapeText(t('Original'))}" aria-pressed="${!active}" title="${escapeText(t('Original - no treatment'))}" style="width:auto;padding:0 9px;font-size:11px;font-weight:600">${t('Original')}</button>`
    + cat.photoTreatments.map(tr =>
      `<button type="button" class="cat-dl-theme cat-dl-treat${tr.id === active ? ' is-active' : ''}" data-treatment="${escapeText(tr.id)}" data-sfx="shimmer" data-voice="${escapeText(tr.label ?? tr.id)}" aria-pressed="${tr.id === active}" title="${escapeText(tr.label ?? tr.id)}"><span class="cat-dl-duo" style="background:${swatch(tr)}"></span></button>`).join('')
    + `</div>`;
};
/** A DOM-built copy of genAiPill (text form) - for in-place updates where a
 *  string would need a new raw-HTML sink. */
export function genAiPillEl(_cat: CatCtx): HTMLElement {
  const pill = document.createElement('span');
  pill.className = 'chip genai-pill';
  pill.title = GENAI_CLAIM;
  const lbl = document.createElement('span');
  lbl.className = 'genai-pill-lbl';
  lbl.textContent = 'Gen AI';
  pill.appendChild(lbl);
  return pill;
}
/** Add/remove the declared Gen AI pill on this asset's grid tile in place -
 *  the reflectAiChipInPlace discipline (DOM API only, idempotent). */
export function reflectGenAiInPlace(cat: CatCtx, ref: AssetRef): void {
  const { viewEl } = cat;
  const sub = viewEl.querySelector<HTMLElement>(`.cat-tile[data-id="${CSS.escape(ref.id)}"] .cat-tile-sub`);
  if (!sub) return;
  const existing = sub.querySelector<HTMLElement>('.genai-pill');
  if (!assetAiKind(ref)) { existing?.remove(); return; }
  if (existing) return;
  const chip = sub.querySelector('.cat-ai-chip');
  const pill = genAiPillEl(cat);
  if (chip) sub.insertBefore(pill, chip); else sub.appendChild(pill);
}
/** Drop the chip into the open modal's title row + this asset's grid tile in
 *  place - the same in-place discipline as reflectFavInGrid (no full re-render).
 *  DOM API only, so no new raw-HTML sink. Idempotent: an existing chip is
 *  updated, never doubled. */
export function reflectAiChipInPlace(cat: CatCtx, ref: AssetRef): void {
  const { viewEl } = cat;
  const sig = ref.meta?.aiSignals as AiSignalsNote | undefined;
  if (!sig || sig.v !== LEXICON_VERSION || (sig.band !== 'notable' && sig.band !== 'strong')) return;
  const spots = [
    cat.detailsDialog?.querySelector<HTMLElement>('.cat-details-name') ?? null,
    viewEl.querySelector<HTMLElement>(`.cat-tile[data-id="${CSS.escape(ref.id)}"] .cat-tile-sub`),
  ];
  for (const spot of spots) {
    if (!spot) continue;
    const chip = spot.querySelector<HTMLElement>('.cat-ai-chip') ?? spot.appendChild(document.createElement('span'));
    chip.className = 'cat-ai-chip';
    chip.dataset.band = sig.band;
    chip.title = t('Signals consistent with AI-generated text were found in this asset. A signal, not proof.');
    chip.textContent = t('AI?');
  }
}
/**
 * Write an analysis verdict onto a USER upload's meta so the confidence travels
 * with the asset. Built-in catalog content is an immutable checksum-validated
 * contract and is NEVER mutated - this returns without writing for it.
 *
 * The same read-then-`_updateUserAssetMeta` merge the declare-ai-origins action
 * uses: a meta-only write at the storage layer, so every other field (blob,
 * credential, version) rides forward untouched, cached object URLs survive, and
 * neither the quota check nor the version-pin preserver runs - annotating an
 * asset adds no bytes and must never freeze a pinned duplicate. Best-effort on
 * purpose: the panel already rendered, so a failed write must never surface as
 * a failed analysis.
 */
export async function persistAiSignals(cat: CatCtx, ref: AssetRef, panel: TextSignalPanel, source: 'digital' | 'ocr'): Promise<void> {
  const { host } = cat;
  if (ref.source !== 'user') return;
  const aiSignals: AiSignalsNote & { at: string } = {
    at: new Date().toISOString(),
    v: LEXICON_VERSION, band: panel.band, score: panel.score, source,
    ...(panel.guessFamily ? {
      family: panel.guessFamily,
      ...(panel.guessConfidence ? { confidence: panel.guessConfidence } : {}),
    } : {}),
  };
  try {
    const recs = await host.assets._exportUserAssets();
    const rec = recs.find((r) => r.id === ref.id);
    if (!rec) return;
    await host.assets._updateUserAssetMeta(ref.id, { ...rec.meta, aiSignals });
    // Reflect on the in-memory ref too, so the chip shows without a reload.
    ref.meta = { ...(ref.meta ?? {}), aiSignals };
    reflectAiChipInPlace(cat, ref);
  } catch { /* best-effort persistence - the on-screen analysis already told the user */ }
}
export function assetTile(cat: CatCtx, ref: AssetRef): string {
  const { selected } = cat;
  const base = assetBaseId(ref.id);
  const fav = cat.favSet.has(base);
  const hidden = cat.hiddenSet.has(base);
  const name = String(ref.meta?.name ?? ref.id);
  const fmt = ref.type === 'lottie' ? 'LOTTIE' : (ref.format ? String(ref.format).toUpperCase() : '');
  const isUser = ref.source === 'user';
  const sourceLabel = isUser ? t('Yours') : t('Catalogue');
  // Generative-AI disclosure - authored on a catalog entry OR auto-detected from an
  // upload's C2PA credential. Shows a violet GEN AI pill in the caption; collapses to a
  // sparkle circle on narrow tiles (see catalog.css).
  const aiKind = assetAiKind(ref);
  // EVERY tile carries a selection checkbox (2026-08-09 - people expect a grid to
  // marquee): catalog assets select for bulk favourite/hide; the destructive bulk
  // actions gate on an all-uploads selection instead (catalog assets are a permanent
  // contract). The whole tile body (bar the checkbox) opens the details modal.
  // Favourite moved off the tile (context menu + selection toolbar), matching the
  // gallery cards.
  const sel = selected.has(ref.id);
  return `
      <div class="cat-tile${fav ? ' is-fav' : ''}${hidden ? ' is-hidden-asset' : ''}${sel ? ' is-selected' : ''}" data-id="${escapeText(ref.id)}" draggable="true">
        <button type="button" class="cat-check" data-select="${escapeText(ref.id)}" aria-pressed="${sel}" aria-label="${escapeText(tRaw('Select {name}', { name }))}" title="${escapeText(t('Select'))}">${CHECK_ICON}</button>
        <button type="button" class="cat-tile-open" data-open="${escapeText(ref.id)}" aria-label="${escapeText(tRaw('View {name} details', { name }))}">
          <span class="cat-tile-fig">${thumbHtml(cat, ref, true)}</span>
          <span class="cat-tile-cap">
            <span class="cat-tile-name" title="${escapeText((() => {
              const added = assetAddedAt(ref);
              return added ? `${name} - ${tRaw('added {date}', { date: new Date(added).toLocaleDateString() })}` : name;
            })())}">${escapeText(name)}</span>
            <span class="cat-tile-sub"><span class="cat-src cat-src--${isUser ? 'user' : 'lib'}">${sourceLabel}</span>${fmt ? ` · ${escapeText(fmt)}` : ''}${aiKind ? genAiPill(aiKind) : ''}${aiSignalsChip(ref)}${(() => {
              // Match context (plans/132 WP-C item 4): while searching, say WHY a tile
              // is in the result set when the name alone doesn't show it.
              if (!cat.query) return '';
              const ctx = matchContextRule(ref, cat.query, x => categoryLabel(libCategory(x, cat.overrides)));
              return ctx ? ` <span class="cat-match-chip" title="${escapeText(t('This is what the search matched'))}">${escapeText(ctx)}</span>` : '';
            })()}</span>
          </span>
        </button>
      </div>`;
}
export function thumbsOps(cat: CatCtx) {
  return {
    thumbHtml: bindOp(cat, thumbHtml),
    catTextSignalsHtml: bindOp(cat, catTextSignalsHtml),
    catHighlightHtml: bindOp(cat, catHighlightHtml),
    catTextWorkHtml: bindOp(cat, catTextWorkHtml),
    rasterToOcrFrame: bindOp(cat, rasterToOcrFrame),
    iconSwatchRow: bindOp(cat, iconSwatchRow),
    treatmentSwatchRow: bindOp(cat, treatmentSwatchRow),
    genAiPillEl: bindOp(cat, genAiPillEl),
    reflectGenAiInPlace: bindOp(cat, reflectGenAiInPlace),
    reflectAiChipInPlace: bindOp(cat, reflectAiChipInPlace),
    persistAiSignals: bindOp(cat, persistAiSignals),
    assetTile: bindOp(cat, assetTile),
  };
}
