// SPDX-License-Identifier: MPL-2.0
import { openAssetInText, textAssetSupported } from '../../lib/text-handoff.ts';
import { paintSyntaxPreview, syntaxLanguageForFile } from '../../lib/syntax-preview.ts';
/**
 * catalog details: building the sheet and wiring its events, in mount order.
 *
 * Every function takes the shared `dt: DetailsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `dt.<module>.<fn>`. Extracted verbatim
 * from openDetails() by scripts/split-closure.ts.
 */
import { escape as escapeText } from '../../utils.ts';
import { assetAddedAt, assetModifiedAt } from '../catalog-filter.ts';
import { wireAudioTransport } from '../../lib/audio-transport.ts';
import { t, tRaw } from '../../i18n.ts';
import { aiSignalsChip, assetAiKind } from '../../lib/genai-pill.ts';
import { announce } from '../../a11y.ts';
import { mountModal } from '../../components/modal.ts';
import { setSearchBarQuery } from '../../components/search-bar.ts';
import { playSfx } from '../../lib/sfx.ts';
import { destroyLottiePlayers, lottiePlayerFor, mountLottieMarker } from '../lottie-mount.ts';
import { extractAssetMetadata } from '../../lib/asset-metadata.ts';
import { analyzeVerifyText } from '../valid-text.ts';
import { categoryLabel, libCategory } from '../../lib/asset-category.ts';
import { assetBaseId, saveFavouriteAssets } from '../../lib/asset-favourites.ts';
import { icon } from '../../lib/icons.ts';
import { storeUserUpload } from '../picker.ts';
import type { PickerHost } from '../picker.ts';
import type { UpscaleHost } from '../upscale-dialog.ts';
import type { MatteHost } from '../matte-dialog.ts';
import type { ExtractAudioHost } from '../../lib/extract-audio.ts';
import type { VideoJobHost } from '../../lib/video-jobs.ts';
import { looksLikeMarkdown } from '../../lib/markdown.ts';
import { derivePeaks } from '../../lib/audio-peaks.ts';
import { songUrlToWavBlobUrl } from '../../lib/zzfxm-render.ts';
import { modUrlToWavBlobUrl } from '../../lib/mod-render.ts';
import { attachAudioMeter } from '../../lib/audio-meter.ts';
import { applySuggestion, buildThemedAssetId, buildTreatedAssetId, extractC2paStore, humanizeText, restyleIconTheme, rewordCandidates, verifyC2pa } from '@lolly/engine';
import type { RewordCandidate, } from '@lolly/engine';
import { lollyBadge } from '../../lib/lolly-badge.ts';
import { CHEVRON_LEFT, CHEVRON_RIGHT, CROP_ICON, DOWNLOAD_ICON, EYE_ICON, EYE_OFF_ICON, PAUSE_ICON, PENCIL_ICON, PLAY_ICON, REPLACE_ICON, SHARE_ICON, SHIELD_ICON, STAR_ICON, TAG_ICON, TRASH_ICON, attachZoom, catalogAddedText, isThemable, isVector, isVerifiableAsset, setCropModeActive, svgTextToDataUrl } from './shared.ts';
import { audioCardArt, wireAudioViz } from './details-shared.ts';
import { bindOp, type DetailsCtx } from './details-context.ts';

/** The asset's facts the sheet is built from. */
export function readAsset(dt: DetailsCtx): void {
  const { cat, initialTheme, initialTreatment, ref } = dt;
  const { PASSPORT_CRED_CACHE, TREATMENT_FILTER_PREFIX, host } = cat; dt.PASSPORT_CRED_CACHE = PASSPORT_CRED_CACHE; dt.TREATMENT_FILTER_PREFIX = TREATMENT_FILTER_PREFIX; dt.host = host;
  // Fire-and-forget: heal a pre-embed TTS clip while its details are open
  // (meta.tts is the cheap pre-filter - everything else never fetches).
  if (ref.source === 'user' && ref.type === 'audio' && ref.meta?.tts) void cat.sections.maybeHealTtsClip(ref);
  const nav = cat.sections.navRefs(ref); dt.nav = nav;
  const base = assetBaseId(ref.id); dt.base = base;
  const isUser = ref.source === 'user'; dt.isUser = isUser;
  const fav = cat.favSet.has(base); dt.fav = fav;
  const hidden = cat.hiddenSet.has(base); dt.hidden = hidden;
  const name = String(ref.meta?.name ?? ref.id); dt.name = name;
  const tags = (ref.meta?.tags as string[] | undefined) ?? []; dt.tags = tags;
  const aiKind = assetAiKind(ref); dt.aiKind = aiKind;
  // Offer the credential checker for every asset whose container the reader can
  // inspect (not just AI-flagged ones), plus any AI-flagged asset so its claim can
  // always be checked. The "Made with Lolly" lockup is revealed lazily below.
  const showVerify = isVerifiableAsset(ref) || !!aiKind; dt.showVerify = showVerify;
  // Themable icons get the same colour swatches as the download dialog, right here in the
  // details view - pick a pairing and the preview recolours live; Download + Copy-link then
  // carry the choice. dBaseSvg caches the raw SVG so re-colouring doesn't re-fetch.
  const themable = isThemable(ref) && cat.iconThemes.length > 0; dt.themable = themable;
  // Raster photos get the bitmap sibling: a colour-treatment strip (greyscale/duotone) that
  // washes the preview live and bakes into the download - mirroring the category grid.
  const treatable = ref.type === 'raster' && !ref.meta?._placeholder && cat.photoTreatments.length > 0; dt.treatable = treatable;
  // Every still/audio/video has a real Download-as pipeline. Original remains the
  // one-click default; conversion controls only appear after opening the dialog.
  const configurable = isVector(ref) || isThemable(ref) || (ref.type === 'raster' && !ref.meta?.animated)
    || ref.type === 'audio' || ref.type === 'video'; dt.configurable = configurable;
  // Honour a theme from a shared link (initialTheme) if it's valid, else the first pairing.
  dt.dTheme = themable
    ? ((initialTheme && cat.iconThemes.some(t => t.id === initialTheme) ? initialTheme : cat.iconThemes[0]?.id) ?? null)
    : null;
  // Photo treatment: honour a valid initial (shared link / category selection), else Original.
  dt.dTreatment = treatable && initialTreatment && cat.photoTreatments.some(t => t.id === initialTreatment)
    ? initialTreatment
    : null;
  dt.dBaseSvg = null;
  // A text asset's decoded content, cached once for both the reading preview and the
  // "Analyse text" action so neither re-fetches (plans/125).
  dt.dTextContent = null;
  // The last humanized (cleaned) text, for the Copy-cleaned button (plans/125).
  dt.dCleanedText = null;
  // What the MAIN reading preview currently shows: null = the asset's own
  // bytes; set to the working copy once edits exist, so the render-mode fill
  // and the unsaved pill both track the same fact.
  dt.dPreviewText = null;
  // The working copy's BASELINE (the analysed slice of the original) - the
  // unsaved pill and the save actions key off `dCleanedText !== dWorkBase`,
  // never off mere analysis having run.
  dt.dWorkBase = null;
  // The last analysis of the working copy - the preview painter reads its
  // marks; recomputed by renderTextPanel after every accepted edit.
  dt.dAnalysis = null;
  // The reword panel's working state (plans/127). The mechanical change list
  // survives re-renders; suggestions/spans are recomputed from the CURRENT
  // cleaned text after every accepted edit (indices shift); model alternatives
  // are cleared whenever the text changes; dModelTouched flips once any model
  // candidate is accepted, and the save path then stamps aiGenerated.
  dt.dHumanizeResult = null;
  dt.dSuggestions = [];
  dt.dRewordSpans = [];
  const dRewordAlts = new Map<number, RewordCandidate[]>(); dt.dRewordAlts = dRewordAlts;
  dt.dModelTouched = false;
  dt.dRewordStatus = 'unstaged';
  dt.dRewordBytes = 0;

  // ── The floating edit card - one decision at a time, made AT the text ────
  // Clicking an underlined swap or sentence in the preview opens one small
  // card beside it: what changes, and the buttons to decide. Esc or an
  // outside click closes it; accepting an edit re-derives everything.
  dt.dCard = null;
}

/** The dialog's DOM, zoom state and controls. */
export function buildSheet(dt: DetailsCtx): void {
  const { cat, configurable, fav, hidden, host, isUser, name, nav, ref, showVerify, tags, themable, treatable } = dt;
  dt.dTextZoom = 1;    // font scale for the text reading surface (both modes)
  // A text asset (.txt/.md): the bytes are the text. Offers Copy text + Analyse text.
  const isTextAsset = ref.type === 'text'; dt.isTextAsset = isTextAsset;
  // A Lottie plays in the details view as a live SVG player (mounted below), not a still - with a
  // play/pause overlay. Both library (json on meta.animationUrl) and user (url IS the json) lotties.
  const lottieJson = ref.type === 'lottie'
    ? (ref.source === 'user' ? ref.url : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : ''))
    : ''; dt.lottieJson = lottieJson;
  const isMotionLottie = !!lottieJson; dt.isMotionLottie = isMotionLottie;
  // Zoomable when the preview is a real still image OR a Lottie (both inspect crisply under zoom - 
  // a Lottie renders as SVG). A video reads better auto-playing at fit-size, so it opts out; audio
  // is a player, not an image, so it opts out too; a placeholder/dataless-lottie stub has nothing
  // to zoom. attachZoom handles the <svg> player.
  const zoomable = !ref.meta?._placeholder
    && ref.type !== 'audio'
    && ref.type !== 'text' && ref.type !== 'data'
    && ref.type !== 'palette'   // a scrollable swatch card, not a zoom stage
    && !(ref.type === 'lottie' && !isMotionLottie); dt.zoomable = zoomable;
  // Crop only makes sense on a static raster/vector - never a live motion preview or a video.
  // model (a 3-D mesh) and lut (a colour grade) tile from a still poster, but the
  // poster is a preview - cropping it would crop the picture, not the asset - so no crop.
  const croppable = zoomable && !isMotionLottie && ref.type !== 'video' && ref.type !== 'model' && ref.type !== 'lut'; dt.croppable = croppable;
  // On-device AI edits for a raster, brought over from the asset picker: Upscale
  // (host.upscale, v1.101) and Remove background (host.matte, v1.103) - same gates the
  // picker uses. Both route through their dialogs, which PRESERVE the source's
  // provenance: an ingested AI image (Gemini, ChatGPT, …) keeps its Content Credential
  // and Gen-AI flag through the edit - recorded as a cut-out/upscale ingredient, never
  // laundered away - which is the whole reason to offer these on a credentialed asset.
  const canUpscale = zoomable && ref.type === 'raster' && host.upscale?.isAvailable() === true; dt.canUpscale = canUpscale;
  // Retouch (plan 124 WP-E): brush-mask content-aware fill. Pure engine math,
  // no model and no capability gate - honest on any device that decodes the
  // image. Static rasters only, like matte.
  const canRetouch = zoomable && ref.type === 'raster' && !ref.meta?.animated && !ref.meta?._placeholder; dt.canRetouch = canRetouch;
  // Grade + Open in Darkroom (2026-08-20): still bitmaps only - a LUT applied
  // here would flatten an animated raster to one frame. Grade is the quick
  // inline look (the video Grade tab's still sibling, views/grade-inline.ts);
  // Darkroom is the deep editor, opened with this image preloaded.
  const canGrade = zoomable && ref.type === 'raster' && !ref.meta?.animated && !ref.meta?._placeholder; dt.canGrade = canGrade;
  // No model gate any more (2026-08-20): the matte dialog now offers a colour
  // key alongside the AI model, and the key needs no capability at all - so
  // "Remove background" works on every device, model staged or not.
  const canMatte = zoomable && ref.type === 'raster' && !ref.meta?.animated; dt.canMatte = canMatte;
  // Read text OUT of an image (host.ocr, plans/125). Gated on a STAGED model, so it
  // is invisible until one is vendored - honest progressive enhancement.
  const ocrAvail = host.ocr?.isAvailable() === true && (host.ocr?.models().length ?? 0) > 0; dt.ocrAvail = ocrAvail;
  const canOcr = ref.type === 'raster' && !ref.meta?._placeholder && ocrAvail; dt.canOcr = canOcr;
  // PDFs read their text layer (+ per-page OCR of scanned pages when the model
  // is present) and vectors read their own <text> elements - both digital-first,
  // so neither needs the OCR gate to OFFER the read. Any media, best effort.
  const canReadDoc = ref.format === 'pdf' && !ref.meta?._placeholder; dt.canReadDoc = canReadDoc;
  const canReadVector = ref.type === 'vector' && !ref.meta?._placeholder; dt.canReadVector = canReadVector;
  // "Extract audio" (WP-C): decode a video's sound track on-device and save it as
  // an audio user asset. Video only - it is nonsensical anywhere else - and only
  // where the browser can decode audio at all. A catalog-side extraction is its own
  // derived asset (no 'renders' tag), with the source video carried as an ingredient.
  const canExtractAudio = ref.type === 'video' && !ref.meta?._placeholder
    && typeof (window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext) !== 'undefined'; dt.canExtractAudio = canExtractAudio;
  // Streaming on-device VIDEO processing (WP-G): background-remove to a transparent
  // animated WebP/APNG, crop, or upscale - each opens the shared video-job dialog and
  // runs as a WP-F background job. Video only, and only where WebCodecs can decode
  // (mediabunny needs VideoDecoder); crop/upscale also need the video encoder.
  // Matte offers TWO methods in the dialog - the on-device model (if a model is staged)
  // and the deterministic COLOUR KEY (decode only, no model) - so the affordance appears
  // for any decodable video; the dialog offers whichever methods are actually available.
  const videoDecodable = ref.type === 'video' && !ref.meta?._placeholder
    && typeof (window as { VideoDecoder?: unknown }).VideoDecoder !== 'undefined'; dt.videoDecodable = videoDecodable;
  const videoEncodable = typeof (window as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined'; dt.videoEncodable = videoEncodable;
  const canVideoMatte = videoDecodable; dt.canVideoMatte = canVideoMatte;
  const canVideoCrop = videoDecodable && videoEncodable; dt.canVideoCrop = canVideoCrop;
  const canVideoUpscale = videoDecodable && videoEncodable && host.upscale?.isAvailable() === true; dt.canVideoUpscale = canVideoUpscale;
  // Grade + Trim (plans/130) are the two video edits that need the frame VISIBLE to be
  // answerable, so they are inline modes over this preview rather than dialog forms -
  // the crop/retouch pattern. Both re-encode, so both need the encoder as well as the
  // decoder; the model-free maths (a LUT, grain, a vignette, a time window) needs
  // nothing else, which is why there is no third capability in these gates.
  const canVideoGrade = videoDecodable && videoEncodable; dt.canVideoGrade = canVideoGrade;
  const canVideoTrim = videoDecodable && videoEncodable; dt.canVideoTrim = canVideoTrim;
  // "Trim margins" (plan 97 section 7.3): the retro-trim of an upload that arrived padded,
  // offering the same before/after card every ingest surface shows. Uploads only - 
  // a catalog asset is an immutable, checksum-validated contract. A still raster or
  // a vector only: an animated raster would come back as a single-frame PNG, which
  // is a different asset, not a trimmed one.
  const trimmable = isUser && !ref.meta?._placeholder && !ref.meta?.animated
    && (ref.type === 'raster' || ref.type === 'vector'); dt.trimmable = trimmable;
  // "Edit script" (plans/181 section 5.4): a clip Lolly SYNTHESIZED can go back
  // to the words that made it - Script audio prefills the recipe and Save
  // rewrites these very bytes, so every document using the clip hears the fix.
  // The gate is the same cheap meta.tts pre-filter the heal above uses; the
  // studio re-reads the block through ttsRecipeFromMeta and leaves a blank
  // sheet if it does not hold up, so a recording or an upload can never land
  // in an editor that would claim Lolly made it.
  const ttsBlock = (ref.meta as { tts?: { text?: unknown; voice?: unknown } } | undefined)?.tts; dt.ttsBlock = ttsBlock as DetailsCtx['ttsBlock'];
  const canEditScript = isUser && ref.type === 'audio'
    && typeof ttsBlock?.text === 'string' && !!ttsBlock.text.trim()
    && typeof ttsBlock?.voice === 'string' && !!ttsBlock.voice.trim(); dt.canEditScript = canEditScript;
  const wasOpen = !!cat.detailsDialog; dt.wasOpen = wasOpen; // paging (←/→) replaces an open modal - cue only a FRESH open
  cat.sections.closeDetails();
  const content = `
      <button type="button" class="cat-details-close" data-act="close" aria-label="${escapeText(t('Close'))}">×</button>
      <div class="cat-details-preview${zoomable ? ' is-zoomable' : ''}">
        <span class="cat-unsaved-pill" data-unsaved hidden>${t('Edits not saved')}</span>
        ${nav.prev ? `<button type="button" class="cat-details-nav cat-details-prev" data-nav="prev" aria-label="${escapeText(t('Previous asset'))}">${CHEVRON_LEFT}</button>` : ''}
        ${nav.next ? `<button type="button" class="cat-details-nav cat-details-next" data-nav="next" aria-label="${escapeText(t('Next asset'))}">${CHEVRON_RIGHT}</button>` : ''}
        ${zoomable
          ? `<div class="cat-zoom-stage">${cat.thumbs.thumbHtml(ref, false, true)}</div>
             <div class="cat-stage-bar">
               ${isMotionLottie ? `<button type="button" class="cat-motion-toggle is-playing" data-act="motion-toggle" aria-label="${escapeText(t('Pause'))}" title="${escapeText(t('Pause'))}">${PAUSE_ICON}</button>` : ''}
               <div class="cat-zoom-hud"></div>
             </div>`
          : cat.thumbs.thumbHtml(ref, false, true)}
      </div>
      <div class="cat-details-body">
        <!-- Toolbar FIRST: the meta/tech/credential sections below are variable
             length, so the actions live at a fixed spot at the top of the column
             instead of drifting down with the content (Andy, 2026-08-20). -->
        ${(() => {
          // Grouped toolbar (plans/132 WP-J): four rows - pinned verbs, the EDIT
          // family, manage, destructive last - instead of ~16 flat buttons. The
          // edit row collapses behind an "Edit…" expander under 860px (the
          // toggle-edit act below); every button and gate is unchanged.
          const pinned = [
            // A 3-D model opens in the 3D tool; a LUT opens in the Darkroom - the
            // primary "edit" verb for these types (they have no in-place crop/grade).
            ref.type === 'model' ? `<button type="button" class="btn cat-act-open-3d" data-act="open-3d">${icon('box', { size: 14 })}<span>${t('Open in 3D')}</span></button>` : '',
            ref.type === 'lut' ? `<button type="button" class="btn cat-act-open-lut" data-act="open-lut">${icon('camera', { size: 14 })}<span>${t('Open in Darkroom')}</span></button>` : '',
            `<button type="button" class="btn cat-act-fav${fav ? ' is-fav' : ''}" data-act="fav" data-sfx="twinkle" aria-pressed="${fav}">${STAR_ICON}<span>${fav ? t('Favourited') : t('Favourite')}</span></button>`,
            `<button type="button" class="btn cat-act-download" data-act="download">${DOWNLOAD_ICON}<span>${configurable ? t('Download…') : t('Download')}</span></button>`,
            textAssetSupported(ref) ? `<button type="button" class="btn" data-act="open-text">${t('Open in Text')}</button>` : '',
            isTextAsset ? `<button type="button" class="btn cat-act-dl-as" data-act="dl-as" aria-haspopup="menu" aria-expanded="false">${DOWNLOAD_ICON}<span>${t('Download as')}</span></button>` : '',
            `<button type="button" class="btn" data-act="prepare">${t('Prepare for sharing')}</button>`,
            `<button type="button" class="btn cat-act-send" data-act="send">${icon('upload', { size: 14 })}<span>${t('Send to…')}</span></button>`,
            `<button type="button" class="btn cat-act-share" data-act="share">${SHARE_ICON}<span>${t('Copy link')}</span></button>`,
          ];
          const edit = [
            croppable ? `<button type="button" class="btn cat-act-crop" data-act="crop">${CROP_ICON}<span>${t('Crop…')}</span></button>` : '',
            canRetouch ? `<button type="button" class="btn cat-act-retouch" data-act="retouch">${icon('stamp', { size: 14 })}<span>${t('Retouch…')}</span></button>` : '',
            canGrade ? `<button type="button" class="btn cat-act-grade" data-act="grade">${icon('palette', { size: 14 })}<span>${t('Grade…')}</span></button>` : '',
            canGrade ? `<button type="button" class="btn cat-act-darkroom" data-act="darkroom">${icon('camera', { size: 14 })}<span>${t('Open in Darkroom')}</span></button>` : '',
            canUpscale ? `<button type="button" class="btn cat-act-upscale" data-act="upscale">${icon('aiSpark', { size: 14 })}<span>${t('Upscale…')}</span></button>` : '',
            canMatte ? `<button type="button" class="btn cat-act-matte" data-act="matte">${icon('scissors', { size: 14 })}<span>${t('Remove background…')}</span></button>` : '',
            trimmable ? `<button type="button" class="btn cat-act-trim" data-act="trim">${icon('fitContain', { size: 14 })}<span>${t('Trim margins')}</span></button>` : '',
            canOcr || canReadDoc || canReadVector ? `<button type="button" class="btn cat-act-read-text" data-act="read-text">${icon('aiSpark', { size: 14 })}<span>${t('Read text')}</span></button>` : '',
            canExtractAudio ? `<button type="button" class="btn cat-act-extract-audio" data-act="extract-audio">${icon('music', { size: 14 })}<span>${t('Extract audio…')}</span></button>` : '',
            canEditScript ? `<button type="button" class="btn cat-act-edit-script" data-act="edit-script">${icon('mic', { size: 14 })}<span>${t('Edit script')}</span></button>` : '',
            canVideoMatte ? `<button type="button" class="btn cat-act-vid-matte" data-act="vid-matte">${icon('scissors', { size: 14 })}<span>${t('Remove background…')}</span></button>` : '',
            canVideoCrop ? `<button type="button" class="btn cat-act-vid-crop" data-act="vid-crop">${CROP_ICON}<span>${t('Crop…')}</span></button>` : '',
            canVideoUpscale ? `<button type="button" class="btn cat-act-vid-upscale" data-act="vid-upscale">${icon('aiSpark', { size: 14 })}<span>${t('Upscale…')}</span></button>` : '',
            canVideoGrade ? `<button type="button" class="btn cat-act-vid-grade" data-act="vid-grade">${icon('palette', { size: 14 })}<span>${t('Grade…')}</span></button>` : '',
            canVideoTrim ? `<button type="button" class="btn cat-act-vid-trim" data-act="vid-trim">${icon('filmStrip', { size: 14 })}<span>${t('Trim…')}</span></button>` : '',
            isTextAsset ? `<button type="button" class="btn cat-act-analyse-text" data-act="analyse-text">${icon('aiSpark', { size: 14 })}<span>${t('Analyse text')}</span></button>
            <button type="button" class="btn cat-act-humanize" data-act="humanize">${icon('wrench', { size: 14 })}<span>${t('Fix characters')}</span></button>
            <button type="button" class="btn cat-act-copy-text" data-act="copy-text">${icon('duplicate', { size: 14 })}<span>${t('Copy text')}</span></button>` : '',
          ];
          const manage = [
            `<button type="button" class="btn" data-act="add-to-project">${icon('folder', { size: 14 })}<span>${t('Add to project…')}</span></button>`,
            `<button type="button" class="btn" data-act="recategorise">${TAG_ICON}<span>${t('Recategorise…')}</span></button>`,
            isUser ? `<button type="button" class="btn" data-act="rename">${PENCIL_ICON}<span>${t('Rename')}</span></button>
               <button type="button" class="btn" data-act="replace">${REPLACE_ICON}<span>${t('Replace…')}</span></button>` : '',
          ];
          const danger = [
            isUser
              ? `<button type="button" class="btn cat-act-danger" data-act="delete">${TRASH_ICON}<span>${t('Delete')}</span></button>`
              : (hidden
                  ? `<button type="button" class="btn" data-act="unhide">${EYE_ICON}<span>${t('Unhide')}</span></button>`
                  : `<button type="button" class="btn cat-act-danger" data-act="hide">${EYE_OFF_ICON}<span>${t('Hide')}</span></button>`),
          ];
          const row = (btns: string[], cls = ''): string => {
            const inner = btns.filter(Boolean).join('');
            return inner ? `<span class="cat-act-row${cls ? ` ${cls}` : ''}">${inner}</span>` : '';
          };
          const editRow = row(edit, 'cat-act-row--edit');
          const editToggle = editRow
            ? `<button type="button" class="btn cat-act-more" data-act="toggle-edit" aria-expanded="false">${PENCIL_ICON}<span>${t('Edit…')}</span></button>`
            : '';
          return `<div class="cat-details-actions">
            ${row(pinned)}${editToggle}${editRow}${row(manage)}${row(danger, 'cat-act-row--danger')}
          </div>`;
        })()}
        <div class="cat-passport" data-passport></div>
        <h2 class="cat-details-name">${escapeText(name)}${aiSignalsChip(ref)}</h2>
        ${ref.type === 'audio' ? `<div class="cat-details-art" data-audio-art aria-hidden="true">${audioCardArt(cat, ref)}</div>` : ''}
        <dl class="cat-details-meta">
          <div><dt>${t('Source')}</dt><dd>${isUser ? t('Your upload') : t('SUSE catalog')}</dd></div>
          <div><dt>${t('Category')}</dt><dd>${escapeText(t(categoryLabel(libCategory(ref, cat.overrides))))}</dd></div>
          <div><dt>${t('Format')}</dt><dd>${escapeText(String(ref.format ?? ref.type).toUpperCase())}</dd></div>
          ${(() => {
            // Licence + credit for a catalog asset that carries them (e.g. the SUSE7
            // LUT, CC BY 4.0, © SUSE / Peter Chamalian). The SPDX id prettifies
            // in place (cc-by-4.0 → CC BY 4.0); the credit is the required attribution.
            const lic = (ref.meta as { license?: string } | undefined)?.license;
            const cred = (ref.meta as { attribution?: string } | undefined)?.attribution;
            return (lic ? `<div><dt>${t('Licence')}</dt><dd>${escapeText(String(lic).replace(/-/g, ' ').toUpperCase())}</dd></div>` : '')
              + (cred ? `<div><dt>${t('Credit')}</dt><dd>${escapeText(String(cred))}</dd></div>` : '');
          })()}
          <div class="cat-details-origins-row"><dt>${t('Origins')}</dt><dd class="cat-details-ai" data-origins></dd></div>
          ${(() => {
            // Added/Modified (plans/132 WP-A): uploads always have a date (the id
            // embeds mint time); a catalog asset shows the date its file was first
            // committed to its brand pack, which the index carries as `added`.
            const added = assetAddedAt(ref);
            const modified = assetModifiedAt(ref);
            const fmtDate = (ts: number): string => new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const addedText = added ? fmtDate(added) : catalogAddedText(ref);
            return (addedText ? `<div><dt>${t('Added')}</dt><dd>${escapeText(addedText)}</dd></div>` : '')
              + (modified && added && modified - added > 60_000 ? `<div><dt>${t('Modified')}</dt><dd>${escapeText(fmtDate(modified))}</dd></div>` : '');
          })()}
          ${(() => {
            // Which projects reference this asset (plans/132 WP-D) - read straight
            // off the profile's folder records, no extra fetch.
            const profFolders = ((cat.profile as unknown as { folders?: Array<{ name: string; items?: Array<{ ref?: string }> }> })?.folders ?? []);
            const inFolders = profFolders.filter(f => (f.items ?? []).some(it => it.ref === ref.id || String(it.ref ?? '').split('?')[0] === ref.id));
            if (!inFolders.length) return '';
            const names = inFolders.slice(0, 2).map(f => escapeText(f.name)).join(', ');
            const extra = inFolders.length > 2 ? ` +${inFolders.length - 2}` : '';
            return `<div><dt>${t('Projects')}</dt><dd>${names}${extra}</dd></div>`;
          })()}
          <div><dt>${t('ID')}</dt><dd><code>${escapeText(ref.id)}</code></dd></div>
          ${tags.length || isUser ? `<div><dt>${t('Tags')}</dt><dd class="cat-details-tags">${tags.map(tag => `<button type="button" class="cat-tag" data-tag="${escapeText(String(tag))}" title="${escapeText(t('Show everything with this tag'))}">${escapeText(String(tag))}</button>`).join('')}${isUser ? `<button type="button" class="cat-tag cat-tag--edit" data-act="edit-tags">${tags.length ? t('Edit…') : t('Add tags…')}</button>` : ''}</dd></div>` : ''}
        </dl>
        <div class="cat-details-tech" data-tech hidden></div>
        <div class="cat-details-tech" data-usage hidden></div>
        ${isTextAsset || canOcr || canReadDoc || canReadVector ? `<div class="cat-details-tsig" data-tsig hidden></div>` : ''}
        ${showVerify ? `<div class="cat-details-cred">
          <div class="cat-cred-lolly" hidden>${lollyBadge('lg')}<span class="cat-cred-lolly-sub">${t('This file’s Content Credential records a Lolly export, intact.')}</span></div>
          <div class="cat-cred-panels" hidden></div>
          <button type="button" class="btn cat-act-verify" data-act="verify">${SHIELD_ICON}<span>${t('Check Content Credentials')}</span></button>
        </div>` : ''}
        ${themable ? `<div class="cat-dl-section"><span class="cat-dl-label">${t('Colours')}</span>${cat.thumbs.iconSwatchRow(dt.dTheme)}</div>` : ''}
        ${treatable ? `<div class="cat-dl-section"><span class="cat-dl-label">${t('Colour')}</span>${cat.thumbs.treatmentSwatchRow(dt.dTreatment)}</div>` : ''}
      </div>`; dt.content = content;
  // Exits inline trim mode, or null when no card is up. Assigned by enterInlineTrim
  // below; declared here so the modal's onClose can answer an open card (its teardown
  // revokes the two preview object URLs) when the dialog goes away under it.
  dt.inlineTrim = null;
  // The toolbar's "Download as" format menu (text assets) - a body-popover
  // mounted INSIDE this dialog so it paints above the ::backdrop.
  dt.dlAsPopover = null;
  const modal = mountModal(content, {
    className: 'cat-details',
    initialFocus: (el) => el.querySelector<HTMLElement>('.cat-details-close'),
    onClose: () => {
      cat.detailsMeterDispose?.();
      cat.detailsMeterDispose = null;
      cat.detailsTransport?.destroy();
      cat.detailsTransport = null;
      cat.vizTeardown?.();
      cat.vizTeardown = null;
      // Destroy any Lottie player mounted in the preview - lottie-web ticks every mounted player
      // from one global rAF and won't stop on removal alone, so an un-reaped modal player leaks a loop.
      destroyLottiePlayers(modal.el);
      // Free a zzfxm→WAV preview blob (only the one we minted; user-upload URLs are managed).
      const wav = modal.el.querySelector<HTMLAudioElement>('[data-audio-preview]')?.dataset.wavBlob;
      if (wav) URL.revokeObjectURL(wav);
      setCropModeActive(false);   // clear the attachZoom pause if the modal closed mid-crop (backdrop/paging)
      dt.inlineTrim?.();           // …and answer an open trim card, so its preview URLs are revoked
      dt.inlineRetouch?.exit();    // …and stand a brush session down (aborts any in-flight fill)
      dt.inlineVideoEdit?.exit();  // …and the video Grade/Trim mode (its own <video> would keep decoding)
      dt.inlineGrade?.exit();      // …and the still grade mode (an enqueued job keeps running - by design)
      dt.dlAsPopover?.close(false); // …and the Download-as menu (it lives inside this dialog's subtree)
      cat.sections.syncAssetUrl(null);       // the bar goes back to the plain catalog URL
      cat.detailsDialog = null;
      cat.detailsModal = null;
    },
  }); dt.modal = modal;
  const dlg = modal.el; dt.dlg = dlg;
  cat.detailsDialog = dlg;
  cat.detailsModal = modal;
  // The address bar mirrors the Share button (`#/c?asset=<id>`) while an
  // asset is open, so copy/pasting the URL shares this exact view. Paging
  // re-syncs it per asset (Andy, 2026-08-19).
  cat.sections.syncAssetUrl(ref.id);
  if (!wasOpen) playSfx('whisper');
}

export function paintPassport(dt: DetailsCtx): void {
  const { PASSPORT_CRED_CACHE, TREATMENT_FILTER_PREFIX, cat, dlg, initialTheme, ref, showVerify, themable, treatable } = dt;
  dt.panels.renderPassport('checking');
  void (async () => {
    const cacheKey = `${ref.id}|${ref.version ?? 'x'}`;
    let cred = PASSPORT_CRED_CACHE.get(cacheKey) ?? null;
    if (cred === null && !PASSPORT_CRED_CACHE.has(cacheKey)) {
      try {
        const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
        const r = await verifyC2pa(bytes);
        cred = { found: !!r.found, state: String(r.state), trusted: !!(r as { trusted?: boolean }).trusted };
      } catch { cred = null; }
      PASSPORT_CRED_CACHE.set(cacheKey, cred);
    }
    if (cat.detailsDialog !== dlg) return; // paged away while hashing
    dt.panels.renderPassport(cred);
  })();

  // Technical metadata (resolution, DPI, EXIF, audio/video props, page count, viewBox…):
  // extract off-thread and fill the initially-hidden panel. Cancel/stale-safe - ←/→ paging
  // re-runs openDetails per asset, so a slow result must not overwrite a newer asset's panel.
  void extractAssetMetadata(ref).then(techFields => {
    if (cat.detailsDialog !== dlg) return;          // modal closed or paged to another asset
    if (!techFields.length) return;             // nothing readable - leave the panel hidden
    const box = dlg.querySelector<HTMLElement>('[data-tech]');
    if (!box) return;
    box.innerHTML = `<div class="cat-tech-head">${t('Details')}</div>`
      + `<dl class="cat-details-meta">${techFields
            .map(f => `<div><dt>${escapeText(f.label)}</dt><dd>${escapeText(f.value)}</dd></div>`)
            .join('')}</dl>`;
    box.hidden = false;
  }).catch(() => { /* never blocks the modal */ });

  // "Used in" (plans/132 WP-G): which saved sessions reference this asset -
  // async off the lazy per-mount session index, same stale-guard as the tech
  // panel. Makes Replace's "everything that uses it updates" claim inspectable.
  void cat.bulk.usedInSessions(ref).then(uses => {
    if (cat.detailsDialog !== dlg || !uses.length) return;
    const box = dlg.querySelector<HTMLElement>('[data-usage]');
    if (!box) return;
    const shown = uses.slice(0, 5);
    const extra = uses.length - shown.length;
    box.innerHTML = `<div class="cat-tech-head">${t('Used in')}</div>`
      + `<dl class="cat-details-meta">${shown
            .map(u => `<div><dt>${escapeText(t('Session'))}</dt><dd>${escapeText(u.label)}</dd></div>`)
            .join('')}${extra > 0 ? `<div><dt></dt><dd>${escapeText(tRaw('and {n} more', { n: extra }))}</dd></div>` : ''}</dl>`;
    box.hidden = false;
  }).catch(() => { /* best-effort - the panel just stays hidden */ });

  // "Made with Lolly" is only honest when the stored file genuinely carries an intact
  // Lolly credential, so reveal the lockup lazily off the authoritative verifier rather
  // than asserting it. Cheap gate first: fetch once, skip anything with no embedded
  // credential (most catalog art, and re-encoded user uploads whose store no longer
  // binds) before the heavier verify. Video/audio are skipped (a whole-file fetch just
  // for a badge isn't worth it - the checker button still covers them). Guarded on the
  // modal still being THIS dialog, since ←/→ paging swaps it out.
  if (showVerify && ref.type !== 'video' && ref.type !== 'audio' && Number(ref.meta?.bytes ?? 0) < 12_000_000) {
    void (async () => {
      try {
        const bytes = new Uint8Array(await (await fetch(ref.url)).arrayBuffer());
        if (!extractC2paStore(bytes)) return;
        const report = await verifyC2pa(bytes);
        if (cat.detailsDialog !== dlg) return;
        if (report.madeWithLolly) {
          const lockup = dlg.querySelector<HTMLElement>('.cat-cred-lolly');
          if (lockup) lockup.hidden = false;
        }
        // Surface the same "Made from" + "Change history" panels the Verify checker
        // shows, inline - reusing its renderers so they never drift. Only when the
        // credential parsed (report.found + a claim); each renderer returns '' when it
        // has nothing, so a bare credential just shows an empty panel set (skipped).
        if (report.found && report.claim) {
          const { stepsHtml, inputsDigestHtml } = await import('../valid.ts');
          if (cat.detailsDialog !== dlg) return;
          const env = report.environment as { inputs?: Record<string, string> } | null | undefined;
          const panels = inputsDigestHtml(env?.inputs) + stepsHtml(report);
          const box = dlg.querySelector<HTMLElement>('.cat-cred-panels');
          if (box && panels) { box.innerHTML = panels; box.hidden = false; }
        }
      } catch { /* leave the lockup + panels hidden - the checker button is still there */ }
    })();
  }

  // A shared themed link opens on that colour - recolour the preview to match on open
  // (the swatch is already marked active above). Best-effort; leaves the base otherwise.
  if (themable && initialTheme && dt.dTheme) {
    void (async () => {
      try {
        if (!dt.dBaseSvg) dt.dBaseSvg = await (await fetch(ref.url)).text();
        const th = cat.iconThemes.find(x => x.id === dt.dTheme);
        const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
        if (img && th) img.src = svgTextToDataUrl(restyleIconTheme(dt.dBaseSvg, th) || dt.dBaseSvg);
      } catch { /* leave the base preview */ }
    })();
  }
  // A raster photo opens on its carried treatment (category selection / shared link) - a
  // cheap live CSS filter over the injected defs, exactly like the grid + picker previews.
  if (treatable && dt.dTreatment) {
    cat.wiring.ensureTreatmentDefs();
    const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
    if (img) img.style.filter = `url(#${TREATMENT_FILTER_PREFIX}${dt.dTreatment})`;
  }
}

export function wireTextAsset(dt: DetailsCtx): void {
  const { dlg, isTextAsset, ref } = dt;
  if (isTextAsset) {
    void (async () => {
      const pre = dlg.querySelector<HTMLElement>('.cat-text-preview[data-text-src]');
      try {
        const text = await (await fetch(ref.url)).text();
        dt.dTextContent = text;
        if (pre) {
          const shown = text.length > 8192 ? text.slice(0, 8192) : text;
          // Chips from the FIRST paint: hidden characters must not wait for
          // an Analyse click to become visible.
          pre.replaceChildren();
          const language = syntaxLanguageForFile(String(ref.meta?.name ?? `file.${ref.format}`));
          if (language === 'plain') dt.panels.appendVisible(pre, shown);
          else paintSyntaxPreview(pre, shown, language, { invisibleClass: 'cat-invis' });
          if (text.length > shown.length) pre.appendChild(document.createTextNode(`\n\n${t('…preview truncated.')}`));
        }
        // Markdown-shaped text gets the render toggle; a real .md defaults to
        // the rendered view (the raw bytes stay one tap away).
        const mdCapable = ref.format === 'md' || ref.format === 'markdown' || looksLikeMarkdown(text);
        const renderBtn = dlg.querySelector<HTMLElement>('[data-act="text-render"]');
        if (mdCapable && renderBtn) renderBtn.hidden = false;
        if (ref.format === 'md' || ref.format === 'markdown') dt.panels.setTextRenderMode(true);
      } catch {
        if (pre) pre.textContent = t('This text could not be read.');
      }
    })();
  }

  // Inline crop mode: the Crop action overlays the shared crop box on THIS open preview
  // rather than spawning the standalone crop dialog. Same source prep (prepCropSource),
  // same crop-box interaction (wireCropBox) and same signed downloadCrop - Cancel/Escape or
  // a completed download returns to the detail view (this same modal, same asset), never
  // reopening or reloading it. `inlineCrop` holds the exit fn while cropping (null otherwise),
  // which the keydown/close handlers read to know a crop is in progress.
  dt.inlineCrop = null;
  // Inline Retouch (plan 124 WP-E): the preview becomes the brush stage with
  // a toolbar on top - the crop pattern exactly. The handle's busy() gates
  // Escape so a committing save can never be torn down mid-write.
  dt.inlineRetouch = null;
  dt.retouchEntering = false;
}

/** Keyboard, pointer and action wiring for the open sheet. */
export function wireSheetEvents(dt: DetailsCtx): void {
  const { TREATMENT_FILTER_PREFIX, base, cat, dRewordAlts, dlg, host, isMotionLottie, isUser, name, nav, ocrAvail, ref, themable, treatable, zoomable } = dt;
  // Escape closes the edit CARD, not the modal, while a card is open - the
  // same native-<dialog> close-watcher cancel the crop/trim cards use.
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !dt.dCard) return;
    e.preventDefault();
    e.stopPropagation();
    dt.panels.closeEditCard();
  }, { capture: true });
  dlg.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    // The floating edit card: any click outside it closes it first, and a
    // click on an underlined swap/sentence in the preview opens its card.
    if (dt.dCard && !dt.dCard.contains(target)) dt.panels.closeEditCard();
    const sugAnchor = target.closest<HTMLElement>('[data-sug]');
    if (sugAnchor) {
      const i = Number(sugAnchor.dataset.sug);
      const s = dt.dSuggestions[i];
      if (s) dt.panels.openEditCard(sugAnchor, dt.panels.sugCardHtml(s, i));
      return;
    }
    const rwAnchor = target.closest<HTMLElement>('[data-rw]');
    if (rwAnchor) { dt.panels.openEditCard(rwAnchor, dt.panels.rwCardHtml(Number(rwAnchor.dataset.rw))); return; }
    // Prev/next lightbox paging - reopen the modal on the neighbouring asset, carrying the
    // current colour choice so paging keeps the look.
    const navBtn = target.closest<HTMLElement>('[data-nav]');
    if (navBtn) { const r = navBtn.dataset.nav === 'prev' ? nav.prev : nav.next; if (r) dt.openDetails(cat, r, dt.dTheme, dt.dTreatment); return; }
    // Play/pause the Lottie preview. The player mounts a tick after open, so this is a no-op
    // until then (the marker still shows its resting poster, and the button reflects "playing").
    const motionBtn = target.closest<HTMLElement>('[data-act="motion-toggle"]');
    if (motionBtn) {
      const motionEl = dlg.querySelector<HTMLElement>('.cat-thumb-motion');
      const player = motionEl ? lottiePlayerFor(motionEl) : null;
      if (player) {
        player.togglePause();
        const playing = !player.isPaused;
        motionBtn.classList.toggle('is-playing', playing);
        motionBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
        motionBtn.setAttribute('aria-label', playing ? t('Pause') : t('Play'));
        motionBtn.title = playing ? t('Pause') : t('Play');
      }
      return;
    }
    // Colour treatment swatch (raster photos): wash the preview in place via the live CSS
    // filter, keep the modal open. Checked before the icon branch - treat buttons also carry
    // .cat-dl-theme, but this .cat-dl-treat branch owns them.
    const treatSw = target.closest<HTMLElement>('.cat-dl-treat');
    if (treatSw && treatable) {
      dt.dTreatment = treatSw.dataset.treatment || null;
      dlg.querySelectorAll<HTMLElement>('.cat-dl-treat').forEach(b => {
        const on = b === treatSw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      cat.wiring.ensureTreatmentDefs();
      const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
      if (img) img.style.filter = dt.dTreatment ? `url(#${TREATMENT_FILTER_PREFIX}${dt.dTreatment})` : '';
      return;
    }
    // Colour swatch (themable icons): recolour the preview in place, keep the modal open.
    const sw = target.closest<HTMLElement>('.cat-dl-theme');
    if (sw && themable) {
      dt.dTheme = sw.dataset.theme ?? dt.dTheme;
      dlg.querySelectorAll<HTMLElement>('.cat-dl-theme').forEach(b => {
        const on = b === sw; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      });
      try {
        if (!dt.dBaseSvg) dt.dBaseSvg = await (await fetch(ref.url)).text();
        const th = cat.iconThemes.find(x => x.id === dt.dTheme);
        const img = dlg.querySelector<HTMLImageElement>('.cat-thumb');
        if (img && th) img.src = svgTextToDataUrl(restyleIconTheme(dt.dBaseSvg, th) || dt.dBaseSvg);
      } catch { /* recolour is best-effort - leaves the base preview */ }
      return;
    }
    // A tag chip filters the grid: close the modal and hand `tag:x` to the
    // shared search bar (its onQuery path re-renders, same as typing it).
    const tagBtn = target.closest<HTMLElement>('[data-tag]');
    if (tagBtn?.dataset.tag) {
      cat.sections.closeDetails();
      setSearchBarQuery(`tag:${tagBtn.dataset.tag}`);
      return;
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'open-text') {
      try { await openAssetInText(host, ref); cat.sections.closeDetails(); } catch (error) { announce(error instanceof Error ? error.message : t('This text could not be read.')); }
      return;
    }
    if (act === 'close') { cat.sections.closeDetails(); return; }
    if (act === 'fav') {
      if (cat.favSet.has(base)) cat.favSet.delete(base); else cat.favSet.add(base);
      if (cat.profile) await saveFavouriteAssets(host, cat.profile, cat.favSet);
      const on = cat.favSet.has(base);
      const btn = dlg.querySelector<HTMLElement>('.cat-act-fav');
      btn?.classList.toggle('is-fav', on); btn?.setAttribute('aria-pressed', String(on));
      const lbl = btn?.querySelector('span'); if (lbl) lbl.textContent = on ? t('Favourited') : t('Favourite');
      // Reflect in the grid + favourites strip behind the modal, in place (no full
      // re-render - favouriting never moves a tile between buckets).
      if (cat.mounted) { cat.sections.reflectFavInGrid(base, on); cat.sections.refreshFavStrip(); }
      announce(on ? tRaw('Added {name} to favourites', { name }) : tRaw('Removed {name} from favourites', { name }));
      return;
    }
    if (act === 'share') {
      const btn = target.closest<HTMLElement>('.cat-act-share');
      // Share the styled variant when a colour is picked, so the recipient reopens the same
      // look (the modifier rides in the asset id - buildThemedAssetId / buildTreatedAssetId).
      const link = themable && dt.dTheme
        ? `${location.origin}${location.pathname}#/c?asset=${encodeURIComponent(buildThemedAssetId(base, dt.dTheme))}`
        : treatable && dt.dTreatment
          ? `${location.origin}${location.pathname}#/c?asset=${encodeURIComponent(buildTreatedAssetId(base, dt.dTreatment))}`
          : cat.sections.assetLink(ref);
      try { await navigator.clipboard.writeText(link); } catch { /* clipboard blocked */ }
      const s = btn?.querySelector('span');
      if (s) s.textContent = t('Copied!'); btn?.classList.add('is-copied');
      // Restore to the fixed label (never the current text) so a rapid re-click can't
      // capture 'Copied!' and leave the button stuck.
      setTimeout(() => { if (s) s.textContent = t('Copy link'); btn?.classList.remove('is-copied'); }, 1200);
      return;
    }
    // Text-asset actions (plans/125): both stay IN this modal (like share/crop), so they
    // are handled before the closeDetails() below. The bytes ARE the text - no OCR.
    if (act === 'text-zoom-in' || act === 'text-zoom-out') {
      dt.dTextZoom = Math.max(0.55, Math.min(2.4, dt.dTextZoom * (act === 'text-zoom-in' ? 1.2 : 1 / 1.2)));
      dlg.querySelector<HTMLElement>('.cat-thumb-text')?.style.setProperty('--cat-text-zoom', dt.dTextZoom.toFixed(3));
      return;
    }
    if (act === 'text-render') {
      const box = dlg.querySelector<HTMLElement>('[data-md-rendered]');
      dt.panels.setTextRenderMode(!(box && !box.hidden));
      return;
    }
    if (act === 'dl-text') {
      // Formatted downloads for a text asset: raw bytes, or the shared markdown
      // block model emitted as standalone HTML / RTF / DOCX / ODT
      // (lib/text-doc-export.ts - lazy, the converters are download-only weight).
      const btn = target.closest<HTMLButtonElement>('[data-act="dl-text"]');
      const fmt = btn?.dataset.fmt;
      if (!btn || !fmt || btn.disabled) return;
      btn.disabled = true;
      try {
        const text = dt.dTextContent ?? await (await fetch(ref.url)).text();
        dt.dTextContent = text;
        const rawName = typeof ref.meta?.name === 'string' && ref.meta.name ? ref.meta.name : (ref.id.split('/').pop() ?? 'text');
        const base = rawName.replace(/\.[a-z0-9]+$/i, '') || 'text';
        if (fmt === 'raw') {
          const ext = ref.format && /^[a-z0-9]{1,10}$/i.test(ref.format) ? ref.format : 'txt';
          const mime = ext === 'md' || ext === 'markdown' ? 'text/markdown' : 'text/plain';
          await host.export.download(new Blob([text], { type: mime }), `${base}.${ext}`);
        } else {
          const mod = await import('../../lib/text-doc-export.ts');
          // The HTML page PREFERENCES the active brand's faces (no embedding):
          // readers with the fonts get the brand look, everyone else falls to
          // the system stack the emitter always appends.
          const rootStyle = getComputedStyle(document.documentElement);
          const fontStack = rootStyle.getPropertyValue('--font-brand').trim();
          const monoStack = rootStyle.getPropertyValue('--font-mono').trim();
          if (fmt === 'html') await host.export.download(new Blob([mod.mdToStandaloneHtml(text, base, { fontStack, monoStack })], { type: 'text/html' }), `${base}.html`);
          else if (fmt === 'rtf') await host.export.download(new Blob([mod.mdToRtf(text)], { type: 'application/rtf' }), `${base}.rtf`);
          else if (fmt === 'docx') await host.export.download(await mod.mdToDocxBlob(text, base), `${base}.docx`);
          else if (fmt === 'odt') await host.export.download(await mod.mdToOdtBlob(text, base), `${base}.odt`);
        }
      } catch {
        announce(t('That download could not be built.'));
      } finally {
        btn.disabled = false;
      }
      return;
    }
    if (act === 'copy-text') {
      const btn = target.closest<HTMLElement>('.cat-act-copy-text');
      try {
        const text = dt.dTextContent ?? await (await fetch(ref.url)).text();
        dt.dTextContent = text;
        await navigator.clipboard.writeText(text);
        const s = btn?.querySelector('span');
        if (s) s.textContent = t('Copied!'); btn?.classList.add('is-copied');
        setTimeout(() => { if (s) s.textContent = t('Copy text'); btn?.classList.remove('is-copied'); }, 1200);
      } catch { announce(t('That text could not be copied.')); }
      return;
    }
    if (act === 'analyse-text') {
      const box = dlg.querySelector<HTMLElement>('[data-tsig]');
      try {
        const text = dt.dTextContent ?? await (await fetch(ref.url)).text();
        dt.dTextContent = text;
        // Cap the working slice at ~256 KB: artifacts + heuristics need no
        // more, and a large file must not become a large string here.
        const capped = text.length > 262144 ? text.slice(0, 262144) : text;
        // Analysis arms the whole flow: the working copy starts as the
        // original, and every suggestion/rewrite affordance renders INLINE in
        // the preview from here on. Re-analysing never resets pending edits.
        if (dt.dCleanedText == null) { dt.dCleanedText = capped; dt.dWorkBase = capped; }
        try {
          const rwm = await import('../../lib/reworder.ts');
          dt.dRewordStatus = await rwm.rewordStatus();
          dt.dRewordBytes = rwm.rewordModelBytes();
        } catch { dt.dRewordStatus = 'unstaged'; }
        dt.panels.renderTextPanel();
        // A user upload keeps the verdict on its meta so the confidence
        // travels with the asset (and the AI? chip can render without
        // re-analysing) - but only the UNEDITED document's verdict may land.
        if (dt.dAnalysis && dt.dCleanedText === dt.dWorkBase) await cat.thumbs.persistAiSignals(ref, dt.dAnalysis, 'digital');
      } catch {
        if (box) { box.textContent = t('This text could not be analysed.'); box.hidden = false; }
      }
      target.closest<HTMLElement>('.cat-act-analyse-text')?.setAttribute('aria-expanded', 'true');
      return;
    }
    if (act === 'read-text' && (ref.format === 'pdf' || ref.type === 'vector')) {
      // PDF: text layer + per-page OCR of scanned pages (views/doc-read.ts -
      // the same extractor verify uses). Vector: its own <text> elements,
      // falling back to rasterise-and-OCR when the words are paths. Either
      // way the result ends in the risk-assessment panel and honest notes.
      const box = dlg.querySelector<HTMLElement>('[data-tsig]');
      const btn = target.closest<HTMLButtonElement>('.cat-act-read-text');
      if (btn?.disabled) return;
      const span = btn?.querySelector('span');
      const orig = span?.textContent ?? t('Read text');
      if (btn) btn.disabled = true;
      if (span) span.textContent = t('Reading…');
      const alive = (): boolean => cat.detailsDialog === dlg;
      try {
        const dr = await import('../doc-read.ts');
        let text: string | null = null;
        let source: 'digital' | 'ocr' = 'digital';
        let noteLines: string[] = [];
        if (ref.format === 'pdf') {
          const blob = await (await fetch(ref.url)).blob();
          const result = await dr.extractDocumentText(blob, ocrAvail ? (host.ocr ?? null) : null, (done, total) => {
            if (span) span.textContent = tRaw('Reading page {i} of {n}…', { i: done, n: total });
          });
          text = result.text;
          source = result.source;
          const n = result.notes;
          if (n.pagesRead < n.pageCount) noteLines.push(tRaw('The first {n} of {total} pages were read.', { n: n.pagesRead, total: n.pageCount }));
          if (n.ocrPages > 0) noteLines.push(tRaw('{n} scanned pages were read with on-device text recognition, so hidden-character checks could not run on those pages.', { n: n.ocrPages }));
          if (n.scannedUnread > 0) {
            noteLines.push(n.ocrUnavailable
              ? tRaw('{n} pages are pictures of text and the text-recognition model is not installed, so they were not read.', { n: n.scannedUnread })
              : tRaw('{n} scanned pages were left unread to keep this quick.', { n: n.scannedUnread }));
          }
          if (text == null && n.ocrUnavailable) noteLines = [t('The pages of this document are pictures of text, and the text-recognition model that could read them is not installed.')];
        } else {
          const src = await (await fetch(ref.url)).text();
          text = dr.extractSvgText(src) || null;
          if (text) {
            noteLines.push(t('Read from the vector\u2019s own text elements - a digital extraction, no pixels involved.'));
          } else if (ocrAvail && host.ocr) {
            const frame = await dr.svgToOcrFrame(src, ref.width, ref.height);
            const res = frame ? await host.ocr.run(frame) : null;
            text = res?.text.trim() || null;
            source = 'ocr';
            if (text) noteLines.push(t('This vector draws its words as shapes, so they were read with on-device text recognition.'));
          } else {
            noteLines.push(t('This vector draws its words as shapes, and the text-recognition model that could read them is not installed.'));
          }
        }
        if (!alive() || !box) { announce(t('The text was read. Open this asset again to see the result.')); return; }
        const notesHtml = noteLines.map((b) => `<p class="cat-tsig-note">${escapeText(b)}</p>`).join('');
        if (text == null) {
          box.innerHTML = notesHtml || `<p class="cat-tsig-note">${escapeText(t('No readable text was found.'))}</p>`;
          box.hidden = false;
          return;
        }
        const panel = analyzeVerifyText(text, source);
        box.innerHTML = `<pre class="cat-text-preview cat-text-ocr">${cat.thumbs.catHighlightHtml(text, panel.marks)}</pre>${cat.thumbs.catTextSignalsHtml(panel)}${notesHtml}`;
        box.hidden = false;
        await cat.thumbs.persistAiSignals(ref, panel, source);
      } catch (err) {
        host.log('warn', 'catalog: doc/vector read failed', { error: String((err as Error)?.message ?? err) });
        if (alive() && box) { box.textContent = t('The text could not be read.'); box.hidden = false; }
        else announce(t('The text could not be read.'));
      } finally {
        if (btn?.isConnected) { btn.disabled = false; if (span) span.textContent = orig; }
      }
      return;
    }
    if (act === 'read-text') {
      // Image → OCR → clipboard + a Tier-2 text-signals read (source:'ocr', so no
      // byte-level artifacts - the panel says so).
      //
      // The READ is a WP-F background job (lib/ocr-job.ts): wasm inference over a
      // whole photo, plus a first-run model download, is exactly what the serial
      // heavy queue exists for, and the toast owns its progress and its cancel. The
      // pixels are still decoded HERE, while this asset is on screen; everything
      // after that outlives the modal.
      //
      // So every write below is guarded on THIS modal still being the open one:
      // the old `finally` restored a button that could already be detached (or,
      // after ←/→ paging, could belong to a different asset's modal). When the
      // surface is gone the durable half still runs - persistAiSignals writes the
      // verdict onto the asset's meta - and the announcement says where to find it.
      const box = dlg.querySelector<HTMLElement>('[data-tsig]');
      const btn = target.closest<HTMLButtonElement>('.cat-act-read-text');
      if (btn?.disabled) return; // an OCR run is already in flight - never start a second
      const span = btn?.querySelector('span');
      const orig = span?.textContent ?? t('Read text');
      // Disabled for the whole run (like the retry button's guard): a double-click
      // must not spin up two concurrent OCR passes over the same image.
      if (btn) btn.disabled = true;
      if (span) span.textContent = t('Reading…');
      /** Is the modal that started this read still the open one? */
      const alive = (): boolean => cat.detailsDialog === dlg;
      const restore = (): void => {
        if (!alive()) return;
        if (btn) btn.disabled = false;
        if (span) span.textContent = orig;
      };
      const readFailed = (): void => {
        if (alive() && box) { box.textContent = t('The text could not be read.'); box.hidden = false; }
        else announce(t('The text could not be read.'));
      };
      let frame: { width: number; height: number; data: Uint8ClampedArray };
      try {
        frame = await cat.thumbs.rasterToOcrFrame(ref.url);
      } catch {
        readFailed();
        restore();
        return;
      }
      const { startOcrJob } = await import('../../lib/ocr-job.ts');
      startOcrJob(host, { frame }, {
        onComplete: (result) => {
          void (async (): Promise<void> => {
            const text = result.text.trim();
            if (!text) {
              if (alive() && box) { box.textContent = t('No readable text was found.'); box.hidden = false; }
              else announce(t('No readable text was found.'));
              return;
            }
            const panel = analyzeVerifyText(text, 'ocr');
            if (alive()) {
              if (box) { box.innerHTML = `<pre class="cat-text-preview cat-text-ocr">${cat.thumbs.catHighlightHtml(text, panel.marks)}</pre>${cat.thumbs.catTextSignalsHtml(panel)}`; box.hidden = false; }
              // Announce what actually happened: the clipboard write can be refused
              // (permissions, unfocused document), and "copied" would then be a lie.
              let copied = true;
              try { await navigator.clipboard.writeText(text); } catch { copied = false; }
              announce(copied ? t('Text copied') : t('Text read. Copying to the clipboard was blocked.'));
            } else {
              // Nothing to paint into, and a clipboard write nobody asked for
              // any more would be a surprise - say where the result went instead.
              announce(t('The text was read. Open this asset again to see the result.'));
            }
            // Same persistence as Analyse text, marked 'ocr': the verdict came off
            // pixels, so only style signals ran - the note says which read it was.
            // This is the DURABLE half, so it runs whether or not the modal is open.
            await cat.thumbs.persistAiSignals(ref, panel, 'ocr');
          })();
        },
        onError: () => readFailed(),
        onSettled: restore,   // includes a cancel from the toast
      });
      return;
    }
    if (act === 'humanize') {
      // Fix characters: the deterministic on-device clean-up (no model) of
      // byte-level artifacts - leaked delimiters, invisible characters,
      // homoglyphs. Applies to the CURRENT working copy, so it composes with
      // edits already accepted; the report lists exactly what changed.
      const box = dlg.querySelector<HTMLElement>('[data-tsig]');
      try {
        const text = dt.dTextContent ?? await (await fetch(ref.url)).text();
        dt.dTextContent = text;
        const capped = text.length > 262144 ? text.slice(0, 262144) : text;
        if (dt.dWorkBase == null) dt.dWorkBase = capped;
        const result = humanizeText(dt.dCleanedText ?? capped);
        dt.dCleanedText = result.text;
        dt.dHumanizeResult = result;
        dRewordAlts.clear();
        // The model tier's standing decides whether its affordances render and
        // whether the consent line names a download. Lazy import: the facade
        // (and everything behind it) stays off this view's chunk until the
        // panel is actually opened.
        try {
          const rw = await import('../../lib/reworder.ts');
          dt.dRewordStatus = await rw.rewordStatus();
          dt.dRewordBytes = rw.rewordModelBytes();
        } catch { dt.dRewordStatus = 'unstaged'; }
        // The panel analyses the FIXED text so only the style tells the
        // clean-up cannot fix remain highlighted (the byte-level ones are gone).
        dt.panels.renderTextPanel();
      } catch {
        if (box) { box.textContent = t('The characters in this text could not be fixed.'); box.hidden = false; }
      }
      return;
    }
    if (act === 'edit-card-close') { dt.panels.closeEditCard(); return; }
    if (act === 'reword-suggest' || act === 'reword-suggest-all') {
      // Tier 1: deterministic edits - the copy stays human-authored, no stamp.
      if (dt.dCleanedText == null) return;
      if (act === 'reword-suggest') {
        const s = dt.dSuggestions[Number(target.closest<HTMLElement>('[data-idx]')?.dataset.idx)];
        if (s) dt.dCleanedText = applySuggestion(dt.dCleanedText, s);
      } else {
        // Back to front so earlier indices stay valid (non-overlapping, sorted).
        for (let i = dt.dSuggestions.length - 1; i >= 0; i--) dt.dCleanedText = applySuggestion(dt.dCleanedText, dt.dSuggestions[i]!);
      }
      dRewordAlts.clear();
      dt.panels.renderTextPanel();
      return;
    }
    if (act === 'reword-span') {
      // Tier 2: sample raw candidates off-thread, then the ENGINE gate decides
      // what may be offered (rewordCandidates: normalise → clean → gate → rank).
      // Runs from the floating edit card: the button gives way to the shared
      // candy-stripe bar (the long-job language, inline - the user stays here).
      const btn = target.closest<HTMLButtonElement>('.cat-reword-go');
      const i = Number(btn?.dataset.idx);
      const span = dt.dRewordSpans[i];
      if (dt.dCleanedText == null || !btn || !span || btn.disabled) return;
      btn.disabled = true;
      btn.hidden = true;
      const prog = dt.dCard?.querySelector<HTMLElement>('[data-card-progress]');
      const fill = dt.dCard?.querySelector<HTMLElement>('[data-card-fill]');
      const label = dt.dCard?.querySelector<HTMLElement>('[data-card-label]');
      if (prog) prog.hidden = false;
      try {
        const { rewordSentence } = await import('../../lib/reworder.ts');
        const sentence = dt.dCleanedText.slice(span.index, span.index + span.length);
        const req = rewordSentence(sentence, {
          onProgress: (p) => {
            if (fill) fill.style.width = `${Math.round(p.fraction * 100)}%`;
            if (label) {
              label.textContent = p.phase === 'download'
                ? tRaw('Downloading the rewriter… {pct}%', { pct: Math.round(p.fraction * 100) })
                : tRaw('Writing… {pct}%', { pct: Math.round(p.fraction * 100) });
            }
          },
        });
        const raws = await req.done;
        dRewordAlts.set(i, rewordCandidates(sentence, raws));
        dt.dRewordStatus = 'ready';
        // Text unchanged, so no re-derive: refresh the card in place with the
        // alternatives (or the honest nothing-survived line).
        const anchor = dlg.querySelector<HTMLElement>(`[data-rw="${i}"]`);
        if (anchor) dt.panels.openEditCard(anchor, dt.panels.rwCardHtml(i));
        else { dt.panels.closeEditCard(); dt.panels.renderTextPanel(); }
      } catch {
        if (prog) prog.hidden = true;
        btn.disabled = false;
        btn.hidden = false;
        if (label) label.textContent = '';
        announce(t('The rewriter could not run.'));
      }
      return;
    }
    if (act === 'reword-use') {
      // Accepting a MODEL candidate: from here on the copy is AI-assisted and
      // the save stamps it (the humanize provenance rule).
      const el = target.closest<HTMLElement>('[data-act="reword-use"]');
      const span = dt.dRewordSpans[Number(el?.dataset.idx)];
      const alt = dRewordAlts.get(Number(el?.dataset.idx))?.[Number(el?.dataset.alt)];
      if (dt.dCleanedText != null && span && alt) {
        dt.dCleanedText = dt.dCleanedText.slice(0, span.index) + alt.text + dt.dCleanedText.slice(span.index + span.length);
        dt.dModelTouched = true;
        dRewordAlts.clear();
        dt.panels.renderTextPanel();
      }
      return;
    }
    if (act === 'copy-clean') {
      const btn = target.closest<HTMLElement>('.cat-act-copy-clean');
      if (dt.dCleanedText != null) {
        try {
          await navigator.clipboard.writeText(dt.dCleanedText);
          const s = btn?.querySelector('span');
          if (s) s.textContent = t('Copied!'); btn?.classList.add('is-copied');
          setTimeout(() => { if (s) s.textContent = t('Copy cleaned text'); btn?.classList.remove('is-copied'); }, 1200);
        } catch { announce(t('That text could not be copied.')); }
      }
      return;
    }
    if (act === 'save-clean') {
      // Save the cleaned text as a NEW user text asset through the ordinary
      // ingest path, which re-runs the AI-signal analysis on the cleaned bytes -
      // so the saved copy carries its own (usually calmer) aiSignals note. Works
      // on library text too: the new asset is the user's own copy. Deterministic
      // clean-up, so no genAI stamp (the humanize provenance rule).
      const btn = target.closest<HTMLButtonElement>('.cat-act-save-clean');
      if (dt.dCleanedText != null && btn && !btn.disabled) {
        btn.disabled = true;
        try {
          const rawName = typeof ref.meta?.name === 'string' && ref.meta.name ? ref.meta.name : (ref.id.split('/').pop() ?? 'text');
          const base = rawName.replace(/\.[a-z0-9]+$/i, '');
          const ext = ref.format && /^[a-z0-9]{1,10}$/i.test(ref.format) ? ref.format : 'txt';
          const mime = ext === 'md' || ext === 'markdown' ? 'text/markdown' : 'text/plain';
          const suffix = dt.dModelTouched ? 'reworded' : 'cleaned';
          const saved = await storeUserUpload(host as unknown as PickerHost, new File([dt.dCleanedText], `${base}-${suffix}.${ext}`, { type: mime }));
          if (dt.dModelTouched) {
            // A model wrote some of these sentences (plans/127): stamp the AI
            // origins the way the declare action does - aiGenerated:'partial'
            // rides the download/export path as a C2PA ingredient, and the
            // meta records the flag plus where the copy came from. The
            // deterministic-only save keeps today's no-stamp behaviour (the
            // humanize provenance rule).
            await host.assets._updateUserAssetMeta(
              saved.id,
              { ...(saved.meta ?? {}), aiOriginsDeclared: true, rewordedFrom: ref.id },
              { aiGenerated: 'partial' },
            );
            announce(t('Reworded text saved to your uploads and flagged as AI-assisted.'));
          } else {
            announce(t('Cleaned text saved to your uploads.'));
          }
          // The working copy is now a real asset - the pill's claim is over.
          const pill = dlg.querySelector<HTMLElement>('[data-unsaved]');
          if (pill) pill.hidden = true;
          if (cat.mounted) { await cat.tiles.reload(); if (cat.mounted) cat.sections.rerender(); }
        } catch {
          announce(t('The cleaned text could not be saved.'));
          btn.disabled = false;
        }
      }
      return;
    }
    if (act === 'origin-full' || act === 'origin-partial' || act === 'origin-clear') {
      // The Origins control: the user asserting what they know about how this
      // asset was made (or withdrawing that assertion - never a claim that it
      // is NOT AI; absence stays honest silence). Same safe read-then-merge as
      // declare-ai-origins; null clears the record-level flag, and an asset
      // whose C2PA credential itself declares AI re-derives on the next list -
      // the signed file outranks a mistaken clearing.
      if (!isUser) return;
      const kind = act === 'origin-full' ? 'full' as const : act === 'origin-partial' ? 'partial' as const : null;
      try {
        const recs = await host.assets._exportUserAssets();
        const rec = recs.find((r) => r.id === ref.id);
        if (!rec) return;
        const meta: Record<string, unknown> = { ...(rec.meta ?? {}) };
        if (kind) meta.aiOriginsDeclared = true; else delete meta.aiOriginsDeclared;
        await host.assets._updateUserAssetMeta(ref.id, meta, { aiGenerated: kind });
        const local: Record<string, unknown> = { ...meta };
        if (kind) local.aiGenerated = kind; else delete local.aiGenerated;
        ref.meta = local as typeof ref.meta;
        dt.panels.renderOrigins();
        cat.thumbs.reflectGenAiInPlace(ref);
        announce(kind ? t('Origins declared. It travels with the asset.') : t('Origins declaration removed.'));
      } catch { announce(t('Could not update origins.')); }
      return;
    }
    if (act === 'declare-ai-origins') {
      // No model ran, so nothing is auto-stamped. This is the user CHOOSING to flag AI
      // origins honestly. Maps to aiGenerated:'partial', which the download/export path
      // already carries as a C2PA ingredient, so it follows the asset where used. A safe
      // read-then-merge via _updateUserAssetMeta keeps every other field intact - a
      // meta-level annotation, so no quota metering and no pin-preserve run.
      const btn = target.closest<HTMLElement>('.cat-act-declare-ai');
      try {
        const recs = await host.assets._exportUserAssets();
        const rec = recs.find((r) => r.id === ref.id);
        if (rec) {
          await host.assets._updateUserAssetMeta(ref.id, { ...rec.meta, aiOriginsDeclared: true }, { aiGenerated: 'partial' });
          // The toolbar button keeps its icon (label lives in a <span>); the
          // text-panel note button is bare text.
          if (btn) {
            const label = btn.querySelector('span');
            if (label) label.textContent = t('AI origins flagged');
            else btn.textContent = t('AI origins flagged');
            btn.setAttribute('disabled', '');
          }
          announce(t('Flagged as having AI origins. It travels with the asset.'));
        }
      } catch { announce(t('Could not flag AI origins.')); }
      return;
    }
    if (act === 'add-to-project') { await cat.bulk.addToProject([ref.id]); return; }
    // Mobile toolbar: the EDIT row folds behind this expander under 860px.
    if (act === 'toggle-edit') {
      const actions = dlg.querySelector<HTMLElement>('.cat-details-actions');
      const btn = target.closest<HTMLElement>('.cat-act-more');
      const open = actions?.classList.toggle('is-edit-open') ?? false;
      btn?.setAttribute('aria-expanded', String(open));
      return;
    }
    // "Download as" (text assets): a format menu anchored to its toolbar button,
    // mounted inside THIS dialog. The items carry data-act="dl-text", so their
    // clicks bubble to this same dispatcher - the menu is pure presentation.
    if (act === 'dl-as') {
      const anchor = dlg.querySelector<HTMLElement>('.cat-act-dl-as');
      if (!anchor) return;
      if (dt.dlAsPopover?.isOpen()) { dt.dlAsPopover.close(); return; }
      if (!dt.dlAsPopover) {
        const { mountBodyPopover } = await import('../../components/body-popover.ts');
        const fmts: [string, string][] = [
          ['raw', String(ref.format || 'txt').toUpperCase()],
          ['html', 'HTML'], ['rtf', 'RTF'], ['docx', 'DOCX'], ['odt', 'ODT'],
        ];
        dt.dlAsPopover = mountBodyPopover(anchor, (el, popover) => {
          el.innerHTML = fmts.map(([v, l]) =>
            `<button type="button" class="cat-dl-as-item" data-act="dl-text" data-fmt="${escapeText(v)}">${escapeText(l)}</button>`).join('');
          // Let the item click bubble to this dispatcher first, then fold the menu.
          el.addEventListener('click', (ev) => {
            if ((ev.target as HTMLElement | null)?.closest('[data-act="dl-text"]')) setTimeout(() => popover.close(false), 0);
          });
          return el.querySelector<HTMLElement>('button');
        }, { className: 'cat-dl-as-menu', ariaLabel: tRaw('Download as'), container: dlg });
      }
      dt.dlAsPopover.open();
      return;
    }
    // Crop stays IN this detail modal - an inline mode over the current preview, not a
    // separate dialog - so it must be handled before the closeDetails() below.
    if (act === 'crop') { await dt.inlineModes.enterInlineCrop(); return; }
    // Trim is the same shape: the offer card mounts in this body, under the actions.
    if (act === 'trim') { await dt.inlineModes.enterInlineTrim(); return; }
    // Retouch too: the brush stage takes over THIS preview (plan 124 WP-E).
    if (act === 'retouch') {
      try { await dt.inlineModes.enterInlineRetouch(); }
      catch (err) { host.log('error', 'Retouch failed', { id: ref.id, error: String(err) }); }
      return;
    }
    // Still grade: the look is chosen AT the image (the video Grade rule), and
    // Apply enqueues a background job so the toast owns progress over this modal.
    if (act === 'grade') {
      try { await dt.inlineModes.enterInlineGrade(); }
      catch (err) { host.log('error', 'Grade failed', { id: ref.id, error: String(err) }); }
      return;
    }
    // Crop, Grade and Trim are three tabs of one inline video mode (plans/130) - the
    // stage becomes a paused frame with a crop box on it and a scrub bar under it, so
    // none of them leaves this detail context. Crop moved here from the video-job
    // dialog: framing a picture over four number fields was never the way to ask.
    if (act === 'vid-grade' || act === 'vid-trim' || act === 'vid-crop') {
      try { await dt.inlineModes.enterInlineVideoEdit(act === 'vid-trim' ? 'trim' : act === 'vid-crop' ? 'crop' : 'grade'); }
      catch (err) { host.log('error', 'Video edit failed', { id: ref.id, error: String(err) }); }
      return;
    }
    // The remaining actions leave this asset's detail context, so close first.
    cat.sections.closeDetails();
    // A 3-D model opens in the 3D tool; a LUT opens in the Darkroom, preselected.
    // Each maps the asset id's tail to the tool's own preset key (lolly/3d/duck →
    // model=duck; lolly/luts/suse7-slog3-heavy → lutPreset=suse7-slog3-heavy).
    if (act === 'open-3d') {
      window.location.hash = `#/tool/3d?model=${encodeURIComponent(ref.id.split('/').pop() ?? '')}`;
      return;
    }
    if (act === 'open-lut') {
      window.location.hash = `#/tool/darkroom?lutSource=preset&lutPreset=${encodeURIComponent(ref.id.split('/').pop() ?? '')}&lutIntensity=100`;
      return;
    }
    // A generated clip re-opens on its own script. The asset id is the whole
    // deep link: the studio reads the recipe off the record, so nothing about
    // the clip has to survive a URL.
    if (act === 'edit-script') {
      window.location.hash = `#/script?asset=${encodeURIComponent(ref.id)}`;
      return;
    }
    if (act === 'download') {
      await cat.downloads.openAssetDownloadDialog(ref, dt.dTheme, dt.dTreatment);
    }
    else if (act === 'prepare') {
      if (!host.assets.bytes) throw new Error(t('Local asset bytes are unavailable. Download the asset and open Prepare for sharing.'));
      const bytes = await host.assets.bytes(ref);
      const { openPreparation } = await import('../../lib/prepare-entry.ts');
      const filename = name.toLowerCase().endsWith(`.${ref.format}`) ? name : `${name}.${ref.format || 'bin'}`;
      openPreparation(host, [new File([bytes.slice().buffer as ArrayBuffer], filename)]);
    }
    else if (act === 'send') { await cat.downloads.openSendDialog(ref); }
    else if (act === 'darkroom') {
      // Refined edits happen in the Darkroom tool, seeded with THIS image. The
      // asset input takes the library id straight off the URL; every other input
      // stays at its (all-off) default except the house look at a light touch -
      // the SUSE7 LUT at 25% (Andy, 2026-08-20).
      window.location.hash = `#/tool/darkroom?image=${encodeURIComponent(ref.id)}&lutSource=preset&lutPreset=suse7-slog3-heavy&lutIntensity=25`;
    }
    else if (act === 'upscale') {
      // Enlarge THIS asset on-device. The dialog validates, consents and decodes, then
      // starts a WP-F background JOB and closes - so nothing here waits on the model,
      // and the toast owns progress and cancellation. The saved copy carries the
      // source's Content Credential forward as an ingredient (with the Gen-AI flag
      // intact), so an AI image keeps its provenance. onComplete refreshes a still-open
      // catalog and says which asset arrived; no modal opens itself over the user.
      try {
        const { openUpscaleDialog } = await import('../upscale-dialog.ts');
        await openUpscaleDialog(host as unknown as UpscaleHost, {
          source: ref, sourceName: name,
          onComplete: (made) => {
            if (!cat.mounted) return;
            void cat.tiles.reload().then(() => {
              if (!cat.mounted) return;
              cat.sections.rerender();
              announce(tRaw('{name} is ready in your uploads.', { name: (made.meta?.name as string | undefined) ?? name }));
            });
          },
        });
      } catch (err) {
        host.log('error', 'Upscale failed', { id: ref.id, error: String(err) });
      }
      dt.openDetails(cat, ref); // the run is in the background - restore the asset the user was inspecting
    }
    else if (act === 'matte') {
      // Cut THIS asset out on-device. Same shape as Upscale above and the video ops
      // below: the dialog validates, consents and decodes, then starts a WP-F
      // background JOB and closes, so nothing here waits on the model and the toast
      // owns progress and cancellation. The cutout carries the source's Content
      // Credential forward as an ingredient (with the Gen-AI flag intact), so an AI
      // image keeps its provenance. onComplete refreshes a still-open catalog and
      // says which asset arrived; no modal opens itself over the user.
      try {
        const { openMatteDialog } = await import('../matte-dialog.ts');
        await openMatteDialog(host as unknown as MatteHost, {
          source: ref, sourceName: name,
          onComplete: (made) => {
            if (!cat.mounted) return;
            void cat.tiles.reload().then(() => {
              if (!cat.mounted) return;
              cat.sections.rerender();
              announce(tRaw('{name} is ready in your uploads.', { name: (made.meta?.name as string | undefined) ?? name }));
            });
          },
        });
      } catch (err) {
        host.log('error', 'Background removal failed', { id: ref.id, error: String(err) });
      }
      dt.openDetails(cat, ref); // the run is in the background - restore the asset the user was inspecting
    }
    else if (act === 'extract-audio') {
      // Decode THIS video's sound track on-device and save it as an audio user asset
      // (its own derived asset - no 'renders' tag). Same shape as Upscale and Matte
      // above: the dialog picks a format, starts a WP-F background JOB and closes, so
      // nothing here waits on a whole-file decode and the toast owns progress and
      // cancellation. The source video's own Content Credential rides forward as an
      // ingredient. onComplete refreshes a still-open catalog and says which asset
      // arrived; no modal opens itself over the user.
      try {
        const { openExtractAudioDialog } = await import('../../lib/extract-audio.ts');
        await openExtractAudioDialog(host as unknown as ExtractAudioHost, {
          source: ref, sourceName: name,
          ...(ref.meta?.aiGenerated === 'full' || ref.meta?.aiGenerated === 'partial' ? { aiGenerated: ref.meta.aiGenerated } : {}),
          onComplete: (made) => {
            if (!cat.mounted) return;
            void cat.tiles.reload().then(() => {
              if (!cat.mounted) return;
              cat.sections.rerender();
              announce(tRaw('{name} is ready in your uploads.', { name: (made.meta?.name as string | undefined) ?? name }));
            });
          },
        });
      } catch (err) {
        host.log('error', 'Extract audio failed', { id: ref.id, error: String(err) });
      }
      dt.openDetails(cat, ref); // the run is in the background - restore the asset the user was inspecting
    }
    else if (act === 'vid-matte' || act === 'vid-upscale') {
      // Process THIS video on-device (background-remove / upscale). Both are model runs
      // with no framing decision in them, so they stay in the shared dialog: it starts a
      // WP-F background job and closes; the result ends up as a plain derived user asset
      // (no 'renders' tag) with container-level C2PA, the source video carried as an
      // ingredient. onComplete refreshes a still-open catalog.
      const op = act === 'vid-matte' ? 'matte' : 'upscale';
      try {
        const { openVideoJobDialog } = await import('../video-job-dialog.ts');
        await openVideoJobDialog(host as unknown as VideoJobHost, {
          op, source: ref, sourceName: name,
          ...(ref.meta?.aiGenerated === 'full' || ref.meta?.aiGenerated === 'partial' ? { aiGeneratedSource: ref.meta.aiGenerated } : {}),
          onComplete: () => { if (cat.mounted) { void cat.tiles.reload().then(cat.sections.rerender); } },
        });
      } catch (err) {
        host.log('error', 'Video job failed', { id: ref.id, error: String(err) });
      }
      dt.openDetails(cat, ref); // restore the asset the user was inspecting
    }
    else if (act === 'recategorise') await cat.userAssets.recategorise(ref);
    else if (act === 'replace') await cat.userAssets.replaceUserAsset(ref);
    else if (act === 'rename') await cat.userAssets.renameUserAsset(ref);
    else if (act === 'edit-tags') { await cat.userAssets.editTags([ref]); dt.openDetails(cat, cat.assetById.get(ref.id) ?? ref); }
    else if (act === 'hide') await cat.userAssets.setHidden(base, true);
    else if (act === 'unhide') await cat.userAssets.setHidden(base, false);
    else if (act === 'delete') await cat.userAssets.deleteUserAsset(ref);
    else if (act === 'verify' || act === 'verify-ai') await cat.sections.checkCredentials(ref);
  });
  // ← / → page through assets (lightbox style), like the on-screen prev/next buttons.
  dlg.addEventListener('keydown', (e) => {
    // In crop mode Escape backs out of the crop, not the whole modal: preventDefault
    // suppresses the native <dialog> close request (the close-watcher only fires when the
    // Escape keydown wasn't cancelled), and paging is disabled so it can't tear down the crop.
    if (dt.inlineCrop) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dt.inlineCrop(); }
      return;
    }
    // Same convention for Retouch: Escape backs out of the MODE - unless a
    // save is committing, which must never be torn down mid-write.
    if (dt.inlineRetouch) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!dt.inlineRetouch.busy()) dt.inlineRetouch.exit(); }
      return;
    }
    // And for the video Grade/Trim mode - busy() covers the beat between the Apply
    // click and the job being enqueued, which must not be torn down half-made.
    if (dt.inlineVideoEdit) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!dt.inlineVideoEdit.busy()) dt.inlineVideoEdit.exit(); }
      return;
    }
    // With a trim card up, paging is off for the same reason: it would tear the card
    // down mid-question. Its Escape is handled by the card itself (and cancelled in
    // the capture listener enterInlineTrim arms), so nothing to do here.
    if (dt.inlineTrim) return;
    if (e.key === 'ArrowLeft' && nav.prev) { e.preventDefault(); dt.openDetails(cat, nav.prev, dt.dTheme, dt.dTreatment); }
    else if (e.key === 'ArrowRight' && nav.next) { e.preventDefault(); dt.openDetails(cat, nav.next, dt.dTheme, dt.dTreatment); }
  });
  // Touch parity with ←/→: a single-finger horizontal swipe on the preview pages
  // prev/next, so phone/tablet users skip through a large set as fast as keyboard
  // users. Skipped while an inline edit mode owns the surface, and when the zoom
  // stage is zoomed IN (there a drag pans - attachZoom marks it .is-zoomed).
  // Passive: it never preventDefaults, so vertical scroll (e.g. the swatch card)
  // and pinch-zoom still work; the horizontal-dominance test keeps the two apart.
  const swipeEl = dlg.querySelector<HTMLElement>('.cat-details-preview'); dt.swipeEl = swipeEl as DetailsCtx['swipeEl'];
  if (swipeEl && (nav.prev || nav.next)) {
    let sx = 0, sy = 0, armed = false;
    swipeEl.addEventListener('touchstart', (e) => {
      const p = e.touches[0];
      armed = e.touches.length === 1 && !!p && !dt.inlineCrop && !dt.inlineRetouch && !dt.inlineVideoEdit && !dt.inlineTrim;
      if (p) { sx = p.clientX; sy = p.clientY; }
    }, { passive: true });
    swipeEl.addEventListener('touchend', (e) => {
      const p = e.changedTouches[0];
      if (!armed || e.changedTouches.length !== 1 || !p) return;
      armed = false;
      if (dlg.querySelector('.cat-zoom-stage.is-zoomed')) return;   // zoomed ⇒ the drag panned
      const dx = p.clientX - sx;
      const dy = p.clientY - sy;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;   // not a clean horizontal swipe
      const r = dx < 0 ? nav.next : nav.prev;   // swipe left → next, right → prev
      if (r) dt.openDetails(cat, r, dt.dTheme, dt.dTreatment);
    }, { passive: true });
  }
  if (zoomable) attachZoom(dlg);
  // Mount the looping Lottie player over the poster (autoplays). Guarded so a mount that resolves
  // after the modal was paged/closed doesn't attach to a stale node; closeDetails reaps it.
  if (isMotionLottie) {
    const motionEl = dlg.querySelector<HTMLElement>('.cat-thumb-motion');
    if (motionEl) void mountLottieMarker(motionEl, { isCurrent: () => cat.detailsDialog === dlg });
  }
  // Audio preview: render a zzfxm song to a WAV blob (codec-independent - plays in any
  // browser), and surface a clear note if an encoded file's format is unsupported.
  const audioEl = dlg.querySelector<HTMLAudioElement>('[data-audio-preview]'); dt.audioEl = audioEl as DetailsCtx['audioEl'];
  if (audioEl) {
    const note = audioEl.parentElement?.querySelector<HTMLElement>('.cat-audio-note');
    audioEl.addEventListener('error', () => {
      if (note && !audioEl.dataset.wavBlob) { note.textContent = t('This audio format isn’t supported by your browser.'); note.hidden = false; }
    });
    // zzfxm songs and tracker modules both render to a WAV blob (codec-independent);
    // the only difference is which renderer decodes the source.
    const zzUrl = audioEl.dataset.zzfxmUrl;
    const modUrl = audioEl.dataset.modUrl;
    const render = zzUrl ? songUrlToWavBlobUrl(zzUrl) : modUrl ? modUrlToWavBlobUrl(modUrl) : null;
    if (render) {
      void render
        .then((wav) => { if (cat.detailsDialog === dlg) { audioEl.dataset.wavBlob = wav; audioEl.src = wav; } else URL.revokeObjectURL(wav); })
        .catch(() => { if (note) { note.textContent = t('Couldn’t render this track.'); note.hidden = false; } });
    }
    // The big preview meter: attaches its analyser on first play (a gesture, so the
    // shared AudioContext may run) and is disposed with the modal (closeDetails).
    const meterEl = dlg.querySelector<HTMLCanvasElement>('[data-audio-meter]');
    if (meterEl) cat.detailsMeterDispose = attachAudioMeter(meterEl, audioEl);
    cat.detailsTransport = wireAudioTransport(dlg, audioEl, {
      play: t('Play'), pause: t('Pause'), seek: t('Seek'),
      mute: t('Mute'), unmute: t('Unmute'), volume: t('Volume'),
    });
    wireAudioViz(cat, dlg, ref, cat.detailsMeterDispose);
    // The resting art was built synchronously from whatever peaks were already in
    // memory - which on a cold open is none, so the stage showed the glyph instead of
    // this track's waveform. Measure it now (one asset, deliberately opened) and swap
    // the art in when it arrives.
    // Measure this track so the panel art is its real waveform: audioCardArt reads
    // peaks already in memory, which on a cold open is none.
    void derivePeaks(host, ref, ref.id).then((r) => {
      const art = dlg.querySelector<HTMLElement>('[data-audio-art]');
      if (r && art && cat.detailsDialog === dlg) art.innerHTML = audioCardArt(cat, ref);
    }).catch(() => {});
  }
}

export function sheetOps(dt: DetailsCtx) {
  return {
    readAsset: bindOp(dt, readAsset),
    buildSheet: bindOp(dt, buildSheet),
    paintPassport: bindOp(dt, paintPassport),
    wireTextAsset: bindOp(dt, wireTextAsset),
    wireSheetEvents: bindOp(dt, wireSheetEvents),
  };
}
