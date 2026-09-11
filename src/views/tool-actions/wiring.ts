// SPDX-License-Identifier: MPL-2.0
/**
 * actions bar: event wiring, done at mount.
 *
 * Every function takes the shared `ta: ActionsCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `ta.<module>.<fn>`. Extracted verbatim
 * from renderActions() by scripts/split-closure.ts.
 */
import { DEFAULT_CMYK_CONDITION, HDR_DEFAULTS, SEPARATING_FORMATS, VIDEO_CODEC_STRINGS, composeSong, frameFilterApplies, generatedSongSpec, selectFramePage, serializeUrlState } from '@lolly/engine';
import { announce } from '../../a11y.js';
import { CENTRE_LOW } from '../../bridge/audio-envelope.ts';
import { _setExportNoticeSink } from '../../bridge/export.ts';
import { linkHelpDescriptions, wireHelpTips } from '../../components/help-tip.js';
import { currentLang, t, tRaw } from '../../i18n.ts';
import { DeliveryResult } from '../../lib/delivery-result.ts';
import { chooseLocationDeliver, deliverFile } from '../../lib/deliver-file.ts';
import { mountDownloadRecovery } from '../../lib/download-recovery.ts';
import { deliverBatchFile, releaseBackgroundDelivery } from '../../lib/background-delivery.ts';
import { openApprovalRequest } from '../../lib/approval-request.ts';
import { isAudioFormat as isAudioFmt } from '../../lib/audio-encode.js';
import { stageDeckAsSequence, stagedDeckMs } from '../../lib/deck-as-sequence.ts';
import { saveExportPrefs } from '../../lib/export-prefs.ts';
import { livePalette } from '../../lib/live-palette.ts';
import { isModuleFormat, modUrlToWavBlobUrl } from '../../lib/mod-render.ts';
import { buildStepsDropped, restMsOf } from '../../lib/motion-model.ts';
import { loopRank } from '../../lib/neurospicy.ts';
import { pcmToWavBlob } from '../../lib/pcm-wav.ts';
import { embedRowLabel, isOwnProfile, listEligible, ownDigest } from '../../lib/press-profile-embed.ts';
import { stepFor } from '../../lib/unit-steps.ts';
import { renderSong, songUrlToWavBlobUrl } from '../../lib/zzfxm-render.ts';
import { bumpMetric, recordFormat } from '../../metrics.js';
import { escape as escapeText } from '../../utils.js';
import { wireDurableConsent } from '../export-durable-card.ts';
import { wirePreflight } from '../export-preflight.ts';
import type { IdentityStatus, RunExportOpts } from '../tool.ts';
import { addScrubBehavior, captureThumbnail, exportTargetNode } from '../tool-action-helpers.ts';
import { ZIP_BUNDLE, extFor, fmtLabel, isC2paFmt, isCmykFmt, isPrintFmt } from './shared.ts';
import type { MediaFrameLike } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

export function wireFormatAndName(ta: ActionsCtx): void {
  const { el, exportDefaults, formatEl } = ta;
  formatEl?.addEventListener('change', ta.notes.refreshFilenamePlaceholder);
  el.querySelectorAll<HTMLInputElement>(
    '[data-action="pdf-c2pa"], [data-action="imprint"]'
  ).forEach((cb) => { cb.addEventListener('change', ta.notes.refreshFilenamePlaceholder); });
  el.addEventListener('lolly:export-open', ta.notes.refreshFilenamePlaceholder);
  const aspectWarnEl = el.querySelector<HTMLElement>('[data-aspect-warning]'); ta.aspectWarnEl = aspectWarnEl;
  const fidelityWarnEl = el.querySelector<HTMLElement>('[data-fidelity-warning]'); ta.fidelityWarnEl = fidelityWarnEl;
  const durationEl = el.querySelector<HTMLInputElement>('[data-action="video-duration"]'); ta.durationEl = durationEl;
  const liveLabelEl = el.querySelector<HTMLElement>('[data-live-capture]'); ta.liveLabelEl = liveLabelEl;
  // Seed the Pro-settings selects from a link's ?fps= / ?codec= / ?vq= (exportDefaults.video).
  // Only a value the select actually offers is applied; an odd fps (say 45) still reaches
  // the auto-export through tool.ts, it just cannot be shown here.
  {
    const v = exportDefaults.video;
    const seed = (sel: string, value: string | null | undefined): void => {
      if (value == null) return;
      const s = el.querySelector<HTMLSelectElement>(sel);
      if (s && [...s.options].some((o) => o.value === value)) s.value = value;
    };
    if (v) {
      seed('[data-action="video-fps"]', v.fps != null ? String(v.fps) : null);
      seed('[data-action="video-codec"]', v.codec ? VIDEO_CODEC_STRINGS[v.codec] : null);
      seed('[data-action="video-quality"]', v.quality ?? null);
    }
  }

  // ── Contact sheets: the "Frames" control (plans/fable-timeline-editing section 4.6) ─
  // A still export of a timed composition renders the frame at the playhead
  // (Andy's WYSIWYG rule). `cuts=N` instead samples N stills at equal MIDPOINT
  // intervals across the sequence - raster/SVG come back as a zip of N files, PDF
  // as N pages. Storyboards, thumbnail sheets, social carousels.
  //
  // The control exists ONLY while the artboard is a timed composition, and is
  // visible only for a still format - so no other tool, and no motion format, can
  // ever put `cuts` on the export opts. It's created/removed by syncFramesUi
  // (below) rather than baked into the panel HTML, because a canvas can BECOME a
  // sequence after mount (the MutationObserver path the Duration field already
  // uses) and a control that is merely hidden would still answer querySelector.
  const CUTS_MAX = 64; ta.CUTS_MAX = CUTS_MAX;
}

export function wireDuration(ta: ActionsCtx): void {
  const { canvasEl, durationEl, el, exportDefaults, hasStillFmt, host, liveLabelEl } = ta;
  // Observation mechanism: the export bar has no existing hook that fires AFTER the
  // canvas DOM is repainted - runtime.subscribe fires on model change, which is
  // before the template rehydrates and restamps data-seq-ms, so it would read the
  // previous length. A MutationObserver on the canvas is the event-driven read of
  // the thing that actually changed: `attributes` catches an in-place restamp,
  // `childList` catches the artboard being replaced wholesale by a re-render. It
  // lives as long as canvasEl does (same lifetime as the runtime.subscribe above);
  // there is no teardown seam here and none is needed - the node goes with the mount.
  if (canvasEl && (durationEl || liveLabelEl || hasStillFmt)) {
    new MutationObserver(() => ta.sequence.syncSequenceUi()).observe(canvasEl, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-seq-ms', 'data-sequence', 'data-clip-ms'],
    });
  }
  ta.sequence.syncSequenceUi();

  // Fill the colour-profile select with the profiles loaded on THIS device - the
  // only route to an embedded /DestOutputProfile, and therefore to a genuinely
  // PDF/X-4-conformant Print PDF (see lib/press-profile-embed.ts). The four
  // registry rows above keep their exact meaning: the condition's NAME, no bytes.
  // The size in each label is arithmetic off the stored asset, so it cannot rot
  // into a lie the way a written figure would.
  const cmykSel = el.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]'); ta.cmykSel = cmykSel;
  if (cmykSel) {
    const askedOwn = isOwnProfile(exportDefaults.profile);
    listEligible(host as never, 'CMYK')
      .then((rows) => {
        for (const e of rows) {
          const o = document.createElement('option');
          o.value = `own:${e.digest}`;
          o.textContent = embedRowLabel(e);
          cmykSel.append(o);
        }
        if (!askedOwn) return;
        // A link carries bare `own` (a digest is device-local): one eligible profile
        // resolves it, several or none does not - and guessing would let storage
        // order decide what a file DECLARES. Unresolved, the export embeds nothing
        // and declares nothing rather than falling back to a condition nobody chose,
        // so the row must SAY that instead of promising an embed: it stays selected
        // (the link still round-trips, and nothing is refused) but it is named after
        // the outcome, not the intention.
        const asked =
          ownDigest(exportDefaults.profile ?? '') ?? (rows.length === 1 ? rows[0]!.digest : null);
        if (asked && rows.some((r) => r.digest === asked)) {
          cmykSel.value = `own:${asked}`;
          return;
        }
        const o = document.createElement('option');
        o.value = 'own';
        o.textContent = rows.length
          ? 'Choose which profile to embed'
          : 'No profile on this device to embed';
        cmykSel.append(o);
        cmykSel.value = 'own';
      })
      .catch(() => {
        /* no profile store on this host - the registry rows stand alone */
      });
  }

  // Fill the audio-track select from the catalog (music beds, type: 'audio').
  // Once per mount - the popup DOM persists across open/close. Tolerates an
  // empty store (first visit before catalog sync finishes) and offline: the
  // select simply keeps its "None" option.
  const audioSel = el.querySelector<HTMLSelectElement>('[data-action="video-audio"]'); ta.audioSel = audioSel;
  if (audioSel) {
    host.assets
      .query({ type: 'audio' })
      .then((tracks) => {
        const tagsOf = (t: (typeof tracks)[number]): string[] =>
          (t.meta?.tags as string[] | undefined) ?? [];
        const isLoop = (t: (typeof tracks)[number]): boolean =>
          tagsOf(t).includes('neurospicy') || tagsOf(t).includes('loop');
        const byName = (a: (typeof tracks)[number], b: (typeof tracks)[number]): number =>
          String(a.meta?.name ?? a.id).localeCompare(String(b.meta?.name ?? b.id));
        const opt = (t: (typeof tracks)[number]): HTMLOptionElement => {
          const o = document.createElement('option');
          o.value = t.id;
          o.textContent = String(t.meta?.name ?? t.id.split('/').pop() ?? '');
          return o;
        };
        // Focus loops FIRST - any FEATURED_LOOPS up top via loopRank, the rest alphabetical
        // - then the licensed music beds below.
        const loops = tracks
          .filter(isLoop)
          .sort((a, b) => loopRank(a.id) - loopRank(b.id) || byName(a, b));
        if (loops.length) {
          const grp = document.createElement('optgroup');
          grp.label = 'Focus loops (Neurospicy)';
          loops.forEach((t) => { grp.appendChild(opt(t)); });
          audioSel.appendChild(grp);
        }
        const music = tracks.filter((t) => !isLoop(t)).sort(byName);
        if (music.length) {
          const grp2 = document.createElement('optgroup');
          grp2.label = 'Music beds';
          music.forEach((t) => { grp2.appendChild(opt(t)); });
          audioSel.appendChild(grp2);
        }
        // The user's own audio uploads (incl. Script-audio TTS clips) - the catalog
        // query lists library assets only, so the user store is appended explicitly.
        // Sequenced after the catalog groups so the order is stable.
        const listUser = (
          host.assets as unknown as {
            _listUserAssets?: () => Promise<
              { id: string; type: string; meta?: Record<string, unknown> }[]
            >;
          }
        )._listUserAssets;
        return listUser?.call(host.assets).then((all) => {
          const ups = all.filter((a) => a.type === 'audio');
          if (!ups.length) return;
          const grp3 = document.createElement('optgroup');
          grp3.label = t('Your uploads');
          for (const a of ups) {
            const o = document.createElement('option');
            o.value = a.id;
            o.textContent = String(a.meta?.name ?? a.id.split('/').pop() ?? '');
            grp3.appendChild(o);
          }
          audioSel.appendChild(grp3);
        });
      })
      .catch(() => {
        /* pre-sync/offline - leave "None" only */
      });
  }
}

export function wireFormatChange(ta: ActionsCtx): void {
  const { animParamsEl, ditherEl, el, exportDefaults, formatEl, matchFmtInput, onUrlSync, runtime } = ta;
  // Show/hide timing params and format-specific controls when the format selector changes.
  if (formatEl) {
    formatEl.addEventListener('change', () => {
      const fmt = formatEl.value;
      ta.audio.syncCaptionsUi(fmt);
      if (animParamsEl) animParamsEl.style.display = ta.formatRules.isAnimatedFmt(fmt) ? 'flex' : 'none';
      if (ditherEl) ditherEl.style.display = fmt === 'gif' ? 'flex' : 'none';
      el.querySelectorAll<HTMLElement>('[data-vector-only]').forEach((c) => {
        c.style.display = ta.formatRules.isVectorFmt(fmt) ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-alpha-only]').forEach((c) => {
        c.style.display = ta.formatRules.isAlphaFmt(fmt) ? 'flex' : 'none';
      });
      // `data-suppressed` wins over the video-format test: syncSequenceUi sets it on
      // "Record live" for a timed composition, and without this check switching format
      // would hand the control straight back.
      el.querySelectorAll<HTMLElement>('[data-video-only]').forEach((c) => {
        c.style.display = ta.formatRules.isVideoFmt(fmt) && c.dataset.suppressed !== '1' ? 'flex' : 'none';
      });
      // Contact sheets are a STILL-format affordance; the same handler owns them, so
      // the Frames row can't survive a switch to a motion format. It only exists at
      // all while the artboard is a sequence (syncFramesUi), so this is a no-op
      // everywhere else - no data-suppressed flag needed, nothing to fight over.
      el.querySelectorAll<HTMLElement>('[data-seq-still-only]').forEach((c) => {
        c.style.display = ta.sequence.isStillFmt(fmt) ? 'flex' : 'none';
      });
      if (!ta.formatRules.isVideoFmt(fmt)) ta.audio.stopAudioPreview(); // the audio card is hidden - don't keep a preview playing under it
      el.querySelectorAll<HTMLElement>('[data-html-only]').forEach((c) => {
        c.style.display = fmt === 'html' ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-emf-only]').forEach((c) => {
        c.style.display = fmt === 'emf' ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-rpm-only]').forEach((c) => {
        c.style.display = fmt === 'rpm' || fmt === 'tar.gz' ? 'flex' : 'none';
      });
      ta.copying.renderSendTargets(fmt);
      el.querySelectorAll<HTMLElement>('[data-cmyk-only]').forEach((c) => {
        c.style.display = isCmykFmt(fmt) ? 'flex' : 'none';
      });
      el.querySelectorAll<HTMLElement>('[data-printmarks-only]').forEach((c) => {
        c.style.display = isPrintFmt(fmt) ? 'flex' : 'none';
      });
      ta.audio.syncBarsDefault(fmt);
      ta.audio.syncPrintDefault(fmt); // open the marks card for a CMYK press format, close it otherwise
      ta.dims.updateFidelityWarning(); // only SVG/HTML keep a frosted panel
      ta.refresh.refreshPrintUi(); // owns [data-pdf-only] (password) visibility - see below
      ta.refresh.refreshDepthFact();
      ta.preflight.refreshPreflight(); // the format is the single biggest input to every check
      onUrlSync?.('format');
      onUrlSync?.('marks'); // bars may have flipped with the format
    });
  }

  // matchExportFormat: keep the export format tracking the dropped file's own format
  // until the user picks one. A ?format= link / saved session locks it up-front; any
  // manual pick locks it too. Idempotent - the subscribe fires on every input change,
  // but only acts when a NEW upload's format differs from the current selection. The
  // subscription's lifetime is this mount's runtime.
  if (formatEl && matchFmtInput) {
    let formatLocked = !!exportDefaults.format;
    let autoSetting = false;
    formatEl.addEventListener('change', () => {
      if (!autoSetting) formatLocked = true;
    });
    runtime.subscribe(() => {
      if (formatLocked) return;
      const f = ta.formatRules.assetExportFormat();
      if (f && f !== formatEl.value) {
        autoSetting = true;
        formatEl.value = f;
        formatEl.dispatchEvent(new Event('change', { bubbles: true })); // runs the per-format UI refresh above
        autoSetting = false;
      }
    });
  }
}

export function readPassword(ta: ActionsCtx): void {
  const { exportDefaults } = ta;
  // Whether the password field currently holds a value that came from ?password=
  // (a Standard-tier link lock). The Strong tier must NEVER reuse a URL-sourced
  // password - that would key "strong" encryption with a secret that already
  // travelled in a link - so we clear the field if the tier flips to strong while
  // this is set. Cleared as soon as the user types (they then own the value).
  ta.pwFromUrl = Boolean(exportDefaults.password);

  // Encryption-tier control for the password card. Standard = 40-bit RC4,
  // built into an unfinished document - so it works only on a plain RGB `pdf` with
  // no print finishing. Strong = AES-256 encrypt-last, which composes with CMYK /
  // marks / pdf-cmyk. When Standard can't apply we disable it and fall to Strong.
  const STD_LOCK_HINT =
    'Requires this password to open the PDF. A basic 40-bit lock - it opens in any PDF app and travels in a share link, so treat it as a deterrent, not protection for confidential files.'; ta.STD_LOCK_HINT = STD_LOCK_HINT;
  const STRONG_LOCK_HINT =
    'AES-256 encryption (PDF 2.0). The recipient must type this exact password to open - it is never included in a link and can’t be recovered if lost. It opens only in newer PDF apps (Acrobat / Preview from ~2018 on); older apps may report the file as damaged.'; ta.STRONG_LOCK_HINT = STRONG_LOCK_HINT;
  // ZIP variants - same two tiers, different reach: standard = PKWARE ZipCrypto
  // (opens anywhere incl. Windows Explorer, weak); strong = WinZip AES-256.
  const STD_ZIP_HINT =
    'Locks the ZIP with a password. Traditional Zip encryption - it opens in any unzip tool including Windows Explorer, and travels in a share link, so treat it as a deterrent, not protection for confidential files.'; ta.STD_ZIP_HINT = STD_ZIP_HINT;
  const STRONG_ZIP_HINT =
    'AES-256 ZIP encryption. The recipient must type this exact password - it is never included in a link and can’t be recovered if lost. It opens in 7-Zip, Keka, WinZip or macOS Archive Utility, but NOT Windows Explorer’s built-in extract.'; ta.STRONG_ZIP_HINT = STRONG_ZIP_HINT;
}

export function wirePrint(ta: ActionsCtx): void {
  const { durableFmts, el, onUrlSync } = ta;
  // Each of these changes a setting preflight reports on (bleed, the mark set),
  // and none of them had a fidelity-warning equivalent to ride - so they take the
  // refresh explicitly, or the card would keep stating the previous bleed.
  el.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.addEventListener(
    'change',
    () => {
      ta.marksUserSet = true; // a manual toggle stops the per-format auto open/close
      ta.refresh.refreshPrintUi();
      ta.preflight.refreshPreflight();
      onUrlSync?.('bleed');
      onUrlSync?.('marks');
    }
  );
  el.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.addEventListener(
    'input',
    () => {
      ta.preflight.refreshPreflight();
      onUrlSync?.('bleed');
    }
  );
  ['mark-crop', 'mark-reg', 'mark-bleed', 'mark-bars', 'mark-prov'].forEach((a) =>
    { el.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.addEventListener('change', () => {
      if (a === 'mark-bars') ta.barsUserSet = true; // stop auto-tracking once chosen
      ta.preflight.refreshPreflight(); // the mark set changes the bleed/media boxes
      onUrlSync?.('marks');
    }); }
  );
  ta.refresh.refreshPrintUi(); // initial state (e.g. card pre-opened from a shared link)
  ta.refresh.refreshDepthFact(); // renders nothing unless a deep/gain-map path is already selected

  // Colour profile (CMYK press condition) - print-PDF only; persists via URL/save.
  el.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.addEventListener(
    'change',
    () => {
      ta.preflight.refreshPreflight();
      onUrlSync?.('profile');
    }
  );

  el.querySelector<HTMLInputElement>('[data-action="filename"]')?.addEventListener('input', () =>
    onUrlSync?.('filename')
  );

  // Full-page HTML export toggle ("no stage") - round-trips through the URL as ?nostage.
  el.querySelector<HTMLInputElement>('[data-action="full-page"]')?.addEventListener('change', () =>
    onUrlSync?.('nostage')
  );

  // Pixel-watermark toggle - round-trips through the URL as ?imprint=1 (see syncUrl).
  el.querySelector<HTMLInputElement>('[data-action="imprint"]')?.addEventListener('change', () =>
    onUrlSync?.('imprint')
  );
  el.querySelector<HTMLInputElement>('[data-action="durable"]')?.addEventListener('change', () => {
    ta.preflight.refreshPreflight();
    onUrlSync?.('durable');
  });
  // Ask where the durable model can come from, then finish the card (the probe and
  // the consent line are export-durable-card.ts): a shell that started hidden
  // reveals the card once a route answers.
  wireDurableConsent(el, durableFmts.length > 0, (available) => {
    if (available && !ta.durableRouteOk) {
      ta.durableRouteOk = true;
      ta.refresh.refreshPrintUi(); // owns [data-durable-only] visibility for the live format
    }
  });
  el.querySelector<HTMLInputElement>('[data-action="hdr"]')?.addEventListener('change', (e) => {
    // Reveal the dials when HDR is on, hide them when off (like the print card).
    const on = (e.target as HTMLInputElement).checked;
    const body = el.querySelector<HTMLElement>('[data-hdr-body]');
    if (body) body.style.display = on ? 'grid' : 'none';
    ta.refresh.refreshDepthFact(); // HDR is what makes the PNG deep / the JPEG a gain map
    ta.preflight.refreshPreflight(); // HDR on a format that cannot carry it is a warning
    onUrlSync?.('hdr');
  });
  for (const a of ['hdr-peak', 'hdr-reach', 'hdr-lift', 'hdr-focus']) {
    el.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.addEventListener('input', () =>
      onUrlSync?.('hdr')
    );
  }

  // PDF open-password - clear-text in the URL by design (see pdfPassRow). Syncs on
  // input so a crafted/edited link round-trips; syncUrl gates it to the pdf format.
  el.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.addEventListener(
    'input',
    () => {
      ta.pwFromUrl = false;
      onUrlSync?.('password');
    }
  );

  // Password protect disclosure - the header toggles the body open/closed (purely
  // visual; the input value still drives export). Focus the field on expand.
  el.querySelector<HTMLButtonElement>('[data-action="pdfpass-toggle"]')?.addEventListener(
    'click',
    () => {
      const card = el!.querySelector('.export-pdfpass');
      const open = card?.classList.toggle('is-open') ?? false;
      const body = el!.querySelector<HTMLElement>('[data-pdfpass-body]');
      if (body) body.style.display = open ? 'flex' : 'none';
      el!
        .querySelector('[data-action="pdfpass-toggle"]')
        ?.setAttribute('aria-expanded', String(open));
      if (open) el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.focus();
    }
  );

  // WP-B "Pro settings" disclosure - same idiom as the password card: the header toggles
  // the body open/closed (purely visual; the selects drive export whether open or not).
  el.querySelector<HTMLButtonElement>('[data-action="prosettings-toggle"]')?.addEventListener(
    'click',
    () => {
      const card = el!.querySelector('.export-pro-settings');
      const open = card?.classList.toggle('is-open') ?? false;
      const body = el!.querySelector<HTMLElement>('[data-prosettings-body]');
      if (body) body.style.display = open ? 'flex' : 'none';
      el!
        .querySelector('[data-action="prosettings-toggle"]')
        ?.setAttribute('aria-expanded', String(open));
    }
  );

  // "Content protection" disclosure - the outer header toggles the whole group of
  // four provenance/protection cards open/closed. Purely visual, same idiom as the
  // password card's own toggle above: nothing inside changes state or export
  // behaviour, and each inner card's own disclosure (password, print marks) keeps
  // working independently once the group is open.
  el.querySelector<HTMLButtonElement>('[data-action="protection-toggle"]')?.addEventListener(
    'click',
    () => {
      const card = el!.querySelector('.export-protection');
      const open = card?.classList.toggle('is-open') ?? false;
      const body = el!.querySelector<HTMLElement>('[data-protection-body]');
      if (body) body.style.display = open ? 'flex' : 'none';
      el!
        .querySelector('[data-action="protection-toggle"]')
        ?.setAttribute('aria-expanded', String(open));
    }
  );

  // Encryption-tier switch: refresh the hint/constraints, re-evaluate the C2PA
  // exclusion, and re-sync the URL - the strong tier is deliberately never written
  // to a link, so switching to it drops any ?password= that was there.
  el.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.addEventListener(
    'change',
    () => {
      ta.refresh.refreshLockTier();
      ta.refresh.refreshC2paUi('tier');
      onUrlSync?.('password');
    }
  );

  // Content Credentials ↔ open-password exclusion: an encrypted PDF can't take
  // the C2PA incremental update, so whichever is active disables the other
  // (mirrors the marks-vs-password exclusion in refreshPrintUi). Checking the
  // box clears a typed password; a typed password (or a ?password= link - the
  // initial call below) unchecks the box and wins over a tool's render.c2pa.
  const c2paEl = el.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]'); ta.c2paEl = c2paEl;
  const pdfPassEl = el.querySelector<HTMLInputElement>('[data-action="pdf-password"]'); ta.pdfPassEl = pdfPassEl;
}

export function wireC2pa(ta: ActionsCtx): void {
  const { c2paEl, el, formatEl, host, pdfPassEl } = ta;
  c2paEl?.addEventListener('change', () => ta.refresh.refreshC2paUi('c2pa'));
  pdfPassEl?.addEventListener('input', () => ta.refresh.refreshC2paUi('password'));
  formatEl?.addEventListener('change', () => ta.refresh.refreshC2paUi('format'));
  ta.refresh.refreshC2paUi(); // initial state (?password= link vs a c2pa-default tool)

  // The C2PA card's explanation lives behind an info (?) tip - wire the same
  // delegated tap/Escape/outside-click behaviour the sidebar uses (attach-once;
  // the document dismiss listener is dropped in mountTool's cleanup). Hover
  // reveal is pure CSS.
  wireHelpTips(el);
  wirePreflight(el); // the "Before you export" control opens its details modal
  linkHelpDescriptions(el);

  // Credential lifetime: the 7/30/90/365 select only makes sense for the
  // ephemeral per-export cert. With an enrolled identity (host.identity) the
  // window was fixed at enrolment, so the picker is swapped for the identity
  // line - you can't sign with validity your certificate doesn't have.
  (async () => {
    const lifeEl = el!.querySelector<HTMLElement>('[data-c2pa-life]');
    if (!lifeEl) return;
    let s: IdentityStatus | null | undefined = null;
    try {
      s = await host.identity?.status();
    } catch {
      /* CA/bridge absent - keep the picker */
    }
    if (!s?.enrolled || s.expired) return;
    const until = s.notAfter ? new Date(s.notAfter).toLocaleDateString() : '';
    const renew = (s.daysLeft ?? Infinity) < 7 ? ' <a href="#/profile">Renew soon</a>' : '';
    lifeEl.innerHTML = `<p class="c2pa-life-signed">Signed as <strong>${escapeText(s.identity?.email ?? '')}</strong>${until ? ` · verified until ${escapeText(until)}` : ''}${renew}</p>`;
  })();
}

export function wireCostSlot(ta: ActionsCtx): void {
  const { el, invalidatePreview, onUrlSync } = ta;
  // Label the floating scrub readout with the value + current unit (e.g. "1024 px",
  // "210 mm") so a drag reads clearly even with the cursor/finger over the field.
  // (dimUnit() is defined above with the other dimension helpers.)
  (
    [
      [el.querySelector<HTMLInputElement>('[data-action="export-width"]'), 'w'],
      [el.querySelector<HTMLInputElement>('[data-action="export-height"]'), 'h'],
    ] as [HTMLInputElement | null, string][]
  ).forEach(([inp, key]) => {
    if (!inp) return;
    const onDimChange = () => {
      ta.sizeUserSet = true;
      onUrlSync?.(key);
      ta.video.refreshCanvasPreview();
      invalidatePreview();
      ta.video.pulseCanvasResize();
    };
    inp.addEventListener('input', onDimChange);
    addScrubBehavior(inp, onDimChange, {
      format: (v) => `${v} ${ta.refresh.dimUnit()}`,
      step: () => stepFor(ta.refresh.dimUnit()),
    });
  });

  // A committed bar edit resizes the ACTIVE artboard only (plans/142 WP-B replaced
  // the old resize-ALL-artboards confirm flow). Members stay put: a w/h edit never
  // moves the frame origin. No artboards → return, the single-artboard path applies.
  ta.artResizing = false;
}

export function wireCostRows(ta: ActionsCtx): void {
  const { el } = ta;
  [
    el.querySelector<HTMLInputElement>('[data-action="export-width"]'),
    el.querySelector<HTMLInputElement>('[data-action="export-height"]'),
  ].forEach((inp) =>
    { inp?.addEventListener('change', () => {
      ta.video.resizeArtboardFromDims();
    }); }
  );
}

export function wireApprovalAndActions(ta: ActionsCtx): void {
  const { canvasEl, desktopExport, el, experience, exportDefaults, exportUnscaled, formatEl, formats, hasToolAudioInput, host, isDesignTool, manifest, pkgInner, runtime } = ta;
  // The "Request approval" CTA (present in place of Download only when the export
  // policy withheld download but permits a request - see `affordance` above). Routes
  // through the generic opener seam (src/lib/approval-request.ts), which a control
  // plane registers to open the approval dialog; the view stays control-plane-unaware.
  el.querySelector<HTMLButtonElement>('[data-action="request-approval"]')?.addEventListener(
    'click',
    () => {
      openApprovalRequest({ toolId: manifest.id, title: manifest.name });
    }
  );

  // "Save as" here is the render pill's Save as - the document dialog (file into a
  // project, or keep as a template) - one label, one meaning. Choosing where an
  // exported FILE is saved is the post-export "Save file…" control (plans/236).
  el.querySelector<HTMLButtonElement>('[data-action="save-as"]')?.addEventListener('click', () => {
    ta.experience.openSaveAs?.();
  });

  el.querySelector<HTMLButtonElement>('[data-action="download"]')?.addEventListener(
    'click',
    async (e) => {
      // Native <button> or jelly-mode <jelly-button> - disable via the attribute,
      // which both honour (jelly syncs it onto its shadow button).
      const btn = e.currentTarget as HTMLButtonElement;
      const prev = btn.textContent;
      btn.toggleAttribute('disabled', true);
      btn.setAttribute('aria-busy', 'true');

      const fmt = formatEl?.value ?? formats[0]!;
      if (fmt === 'lolly') {
        // Portable delivery owns its packaging/options; never ask the render
        // engine to rasterise a .lolly document, including programmatic clicks.
        btn.toggleAttribute('disabled', false);
        btn.removeAttribute('aria-busy');
        el.querySelector<HTMLElement>('[data-lolly-download]')?.click();
        return;
      }
      // Carousel / paged tool: a STILL-image download becomes one image PER PAGE, zipped.
      // (PDF already fans out to a multi-page document via renderMultiPagePdf; animated /
      // html / zip formats keep their own paths.) Each [data-pdf-page] frame is exported
      // at its own measured size - width/height dims are stripped so a re-sized page still
      // exports at its true pixel size rather than the static render dimensions.
      // Gate on the carousel-specific render.pages - NOT render.paged, which also marks
      // multi-page-pdf / doc-studio, whose SVG export must stay a single whole-canvas file.
      // Also admit the Design frame primitive: an editor-layout tool whose
      // boxes input declares canvas.frameField emits one [data-pdf-page] per ARTBOARD (frame
      // box). A no-frames Design doc renders a single .artboard with zero [data-pdf-page], so
      // pageEls stays empty and it correctly falls through to a single flat export. Mirrors
      // tool.ts's frameCfg derivation (render.layout==='editor' && canvas.frameField).
      const framesCanvas =
        manifest.render.layout === 'editor'
          ? (
              manifest.inputs?.find(
                (i) => i.type === 'blocks' && (i as { canvas?: unknown }).canvas
              ) as { canvas?: { frameField?: string } } | undefined
            )?.canvas
          : undefined;
      const hasFrames = !!framesCanvas?.frameField;
      const pageEls =
        (manifest.render.pages || hasFrames) && canvasEl
          ? [...canvasEl.querySelectorAll<HTMLElement>('[data-pdf-page]')]
          : [];
      // The `?s=` STILL-EXPORT FILTER (plan 112 section 10): `?s=2&format=png` renders just
      // that one slide, which is what makes a Design deck's slides individually linkable
      // (and buys per-slide embeds/OG later). The address is resolved by the ENGINE
      // (frame-address.ts) against the ids these pages carry, so the CLI's own `s=` picks
      // the same page from the same string - one meaning, two transports, no shell logic to
      // drift. Absent ⇒ 'none' ⇒ the fan-out below is byte-identical to before this existed.
      // An address that names nothing is NOT collapsed to "the first page": the whole deck
      // exports and the mismatch is announced, so nobody mistakes slide 1 for slide 9.
      // `frameFilterApplies` is a no-op guard HERE (the fan-out branch below already
      // excludes every format it names) - it is called anyway so web and CLI ask the
      // engine the same question rather than each carrying their own format list.
      const framePick = frameFilterApplies(fmt)
        ? selectFramePage(
            pageEls.map((p) => p.getAttribute('data-frame-id')),
            exportDefaults.slide
          )
        : ({ kind: 'none' } as const);
      // A click deck exported as a moving picture (plans/184 R3). With no timeline of its
      // own the whole stage rendered for the export's duration - slide one, five seconds,
      // then nothing - and no "deck as video" action existed. For this export only, the
      // slides go onto a temporary timeline in order (each its own dwell, else the export's
      // duration) and the deck's slide transition becomes the junction between them; the
      // DOM is restored in `finally`, so the document itself never changes. A `?s=` pick
      // (one slide) keeps its single-frame render, and a document that already has a
      // timeline keeps its own timing.
      let unstageDeck: (() => void) | null = null;
      if (
        ta.formatRules.isAnimatedFmt(fmt) &&
        fmt !== 'svg-anim' &&
        pageEls.length >= 2 &&
        framePick.kind !== 'page' &&
        canvasEl &&
        !canvasEl.querySelector('[data-sequence]')
      ) {
        const dwellMs = Math.round(ta.video.videoParams().duration * 1000);
        unstageDeck = stageDeckAsSequence(canvasEl, { dwellMs });
        if (unstageDeck) {
          host.log(
            'info',
            `export: ${pageEls.length} slides placed in order for this ${fmt} (${Math.round(stagedDeckMs(canvasEl, dwellMs) / 100) / 10}s) - each slide's own dwell, else the Duration field as the dwell. The document is unchanged.`
          );
        }
      }
      const isAnimated = ta.formatRules.isAnimatedFmt(fmt);
      const isGif = fmt === 'gif';

      let liveTake = false;
      if (isAnimated) {
        const { wait, duration, fps, live } = ta.video.videoParams();
        const totalS = wait + duration;
        liveTake = live && ta.formatRules.isVideoFmt(fmt);
        btn.textContent = isGif
          ? `Encoding GIF… ${totalS}s`
          : liveTake
            ? `Recording live… ${duration}s` // no wait phase - capture starts once the stage is located
            : fps === 60
              ? `Rendering 60fps… ${totalS}s+`
              : `Recording… ${totalS}s`;
        // A build step is a CLICK, and a video has nobody to click it. Rather than invent
        // a pace for the fragments - which would put words on screen at a speed nobody
        // chose - every box is drawn and the count of unseen steps is said out loud, so
        // the author can reach for "Place in order" and time them deliberately
        // (plans/179 M4). English, like every other export log: host.log is console-only.
        const dropped = buildStepsDropped(canvasEl);
        if (dropped > 0) {
          host.log(
            'warn',
            `export: ${dropped} build step${dropped === 1 ? '' : 's'} cannot be clicked in a moving export, so every box is drawn from the start. Use "Place in order" in the timeline to give them times.`
          );
        }
      } else {
        // Slow non-animated exports (CMYK TIFF, high-DPI raster, PDF) previously froze
        // on a disabled button with no signal. Show progress and tell assistive tech.
        btn.textContent = 'Exporting…';
      }
      announce('Exporting…');

      // Surface the export-quality degradations the bridge would otherwise only
      // console.log (host.log is console-only): the frame rate was lowered to fit the
      // buffer, the clip was truncated, or a sped-up clip's audio was dropped. The
      // bridge calls this sink synchronously as it degrades; we announce each once
      // (a: aria-live) and paint them onto the card when the export settles (b). The
      // sink is registered only for THIS export and cleared in the finally below, so
      // a Save/Send that shares runtime.export never inherits a stale listener.
      const degradeNote = el!.querySelector<HTMLElement>('[data-export-degraded]');
      if (degradeNote) {
        degradeNote.hidden = true;
        degradeNote.textContent = '';
      }
      // A new export replaces the retained one (plans/236): release it and clear its
      // surface, so a retry can never hand over an earlier render as this one.
      ta.deliveryUnmount?.(); ta.deliveryUnmount = null;
      ta.deliveryResult?.dispose(); ta.deliveryResult = null;
      releaseBackgroundDelivery();
      const deliverySurface = el!.querySelector<HTMLElement>('[data-export-delivery]');
      if (deliverySurface) { deliverySurface.hidden = true; deliverySurface.textContent = ''; }
      const degradedNotes: string[] = [];
      _setExportNoticeSink((msg) => {
        if (degradedNotes.includes(msg)) return; // per-clip mutes can repeat the same line
        degradedNotes.push(msg);
        announce(msg);
      });

      // Any zzfxm/tracker track is rendered to a transient WAV blob URL below (the
      // tool audio and a mix-in bed can each mint one); revoke them once the export
      // has consumed them (declared out here so the catch can free them too).
      const wavBlobUrls: string[] = [];
      const trackBlobUrl = (url: string): string => {
        wavBlobUrls.push(url);
        return url;
      };
      const revokeTrackUrls = (): void => {
        for (const u of wavBlobUrls.splice(0)) URL.revokeObjectURL(u);
      };
      try {
        // Resolve the chosen catalog audio track (if any) to a plain fetchable
        // URL before the recording starts - the export bridge stays catalog-
        // agnostic, and a missing/undownloadable track fails here in the UI
        // instead of mid-record. On-demand tier fetches + caches the bytes.
        let audioOpt: { audio?: NonNullable<RunExportOpts['audio']> } = {};
        // ZzFXM songs and tracker modules have no playable audio file - render them
        // to a transient WAV blob URL so the URL-driven muxer paths consume them
        // exactly like an encoded loop. (mod → libopenmpt, zzfxm → the synth.)
        const toWavIfNeeded = async (r: { url: string; format?: string }): Promise<string> =>
          r.format === 'zzfxm'
            ? trackBlobUrl(await songUrlToWavBlobUrl(r.url))
            : isModuleFormat(r.format)
              ? trackBlobUrl(await modUrlToWavBlobUrl(r.url))
              : r.url;
        if (isAudioFmt(fmt) && hasToolAudioInput) {
          // Audio-only export: the deliverable is the tool's OWN clip from the
          // in-point it draws from, and nothing else. No bed, no gain, no fade -
          // the tool applies no processing to the samples, and any envelope here
          // would defeat the untouched-source pass-through in lib/audio-encode.ts.
          const ref = await ta.audio.resolveToolAudio();
          if (ref)
            audioOpt = {
              audio: {
                id: ta.audio.toolAudioRef()?.id,
                url: await toWavIfNeeded(ref),
                volume: 1,
                start: ta.formatRules.stageAudioStart(),
              },
            };
        } else if (ta.formatRules.isVideoFmt(fmt)) {
          const audioId = el!.querySelector<HTMLSelectElement>(
            '[data-action="video-audio"]'
          )?.value;
          const numCtl = (a: string, dflt: number): number => {
            const v = el!.querySelector<HTMLInputElement>(`[data-action="${a}"]`)?.value;
            return v != null && v !== '' ? Number(v) || 0 : dflt;
          };
          // The popup's track choice ('' | __generate__ | asset id) → a fetchable URL.
          const resolveTrack = async (): Promise<{ url: string; id: string } | null> => {
            if (!audioId) return null;
            if (audioId === '__generate__') {
              // A fresh worker render at THIS clip's length - the seed keeps it the
              // same tune the user auditioned, just arranged to fit.
              const pcm = await renderSong(composeSong(generatedSongSpec(ta.genSeed, ta.audio.genDur())));
              return {
                url: trackBlobUrl(URL.createObjectURL(pcmToWavBlob(pcm))),
                id: `zzfxm-generated-${ta.genSeed}`,
              };
            }
            return { url: await toWavIfNeeded(await host.assets.get(audioId)), id: audioId };
          };
          const fadeIn = numCtl('audio-fadein', 0);
          const fadeOut = numCtl('audio-fadeout', 0);
          if (hasToolAudioInput) {
            // Two-row card (section 6.1): the tool's own audio is ALWAYS the primary track
            // (read live - an emptied slot exports silent), the popup's pick is the
            // optional mix-in bed whose centre level sets its gain under the voice.
            const ref = await ta.audio.resolveToolAudio();
            const toolUrl = ref ? await toWavIfNeeded(ref) : null;
            const bed = await resolveTrack();
            const level = Math.max(0, Math.min(100, numCtl('audio-tool-level', 100))) / 100;
            const centreSel =
              el!.querySelector<HTMLSelectElement>('[data-action="audio-centre"]')?.value ?? 'low';
            const centre = centreSel === 'off' ? 0 : centreSel === 'full' ? 1 : CENTRE_LOW;
            if (toolUrl) {
              // In-point: a tool whose visuals begin partway into its own clip (the
              // audiogram's "Start at") stamps that offset on its stage as
              // data-audio-start, the same read-the-stage contract as data-seq-ms -
              // so the soundtrack starts where the picture does instead of at 0:00.
              // A property of the tool's OWN clip, so it applies only here, never to
              // a mix-in or standalone bed that knows nothing about the in-point.
              audioOpt = {
                audio: {
                  id: ta.audio.toolAudioRef()?.id,
                  url: toolUrl,
                  volume: level,
                  start: ta.formatRules.stageAudioStart(),
                  ...(bed ? { mix: { id: bed.id, url: bed.url, centre, fadeIn, fadeOut } } : {}),
                },
              };
            } else if (bed) {
              // Empty tool slot: the mix-in track stands alone, today's single-bed shape.
              audioOpt = {
                audio: { id: bed.id, url: bed.url, fadeIn, fadeOut, volume: 1, duck: 1, start: 0 },
              };
            }
          } else if (audioId) {
            // Single-bed card - unchanged behaviour for tools without their own audio.
            const bed = await resolveTrack();
            const volume = Math.max(0, Math.min(100, numCtl('audio-volume', 100))) / 100;
            const duck = Math.max(0, Math.min(100, numCtl('audio-duck', 100))) / 100;
            if (bed)
              audioOpt = {
                audio: { id: bed.id, url: bed.url, fadeIn, fadeOut, volume, duck, start: 0 },
              };
          }
        }
        // Surface progress on the button for slow non-animated exports - the CMYK
        // TIFF pass and the SVG/PDF vector walk emit onProgress, which was being
        // discarded (the label sat on a static "Exporting…"). Throttle to integer
        // percent so a per-row callback can't thrash the DOM. Animated formats keep
        // their own time-based label (guarded by isAnimated).
        let lastExportPct = -1;
        // The shutter's status block wants the same numbers. exportUnscaled hands
        // its `report` sink to the function it wraps, so this is latched there (the
        // opts object is built before the wrap) and stays null for an export that
        // runs without a shutter, e.g. a live take.
        let reportToShutter: ((done: number, total: number) => void) | null = null;
        // Cancellation for this export (engine 1.141 ExportOpts.signal). Handed to the
        // shutter's status block as onCancel, which makes its one button a real Cancel:
        // the frame loops, the CMYK row pass, the vector walks and the sequence
        // compositor poll the signal and reject with an AbortError, which the catch below
        // reads as "cancelled", not "failed". A format with no yield point ignores it and
        // we discard its result.
        const exportAbort = new AbortController();
        const cancelExport = (): void => exportAbort.abort();
        // The live brand palette (host.tokens, cached) - not the tokenless PALETTE
        // fallback - so CMYK ink substitution always matches the active profile's
        // real brand (SUSE's measured inks, or whichever catalog is mounted).
        const brandPalette = await livePalette(host);
        // Read one HDR slider's value (falls back to its default if the slider isn't
        // rendered for this format/tool).
        const hdrDial = (action: string, def: number): number => {
          const v = Number(el!.querySelector<HTMLInputElement>(`[data-action="${action}"]`)?.value);
          return Number.isFinite(v) ? v : def;
        };
        // Captions for a moving export (plans/180 section 4). Serialised ONCE and used
        // by both options below, so the track inside the file and the files beside it
        // can never disagree. Read only when at least one option is on and only for a
        // video format, so every other export does no work and ships no extra bytes;
        // the burned-in caption boxes are unaffected either way.
        const wantEmbed =
          ta.formatRules.isVideoFmt(fmt) &&
          (el!.querySelector<HTMLInputElement>('[data-action="captions-embed"]')?.checked ?? false);
        const wantSidecar =
          ta.formatRules.isVideoFmt(fmt) &&
          (el!.querySelector<HTMLInputElement>('[data-action="captions-sidecar"]')?.checked ??
            false);
        const captions = wantEmbed || wantSidecar ? await ta.audio.captionText() : null;
        const softCaptionsVtt = wantEmbed && captions ? captions.vtt : undefined;
        const sidecarCaptions = wantSidecar && captions ? captions : null;
        // RunExportOpts plus the durationUserSet contract flag: it belongs to the
        // sequence path (the tool hook reads ctx.opts.durationUserSet), not to the
        // generic shell-wide export options, so it's carried as a local widening
        // rather than pushed into the shared interface. subtitlesVtt (WP-F) rides the
        // same local widening - the bridge ExportOpts declares it; RunExportOpts need not.
        const opts: RunExportOpts & {
          durationUserSet?: boolean;
          cuts?: number;
          subtitlesVtt?: string;
        } & typeof audioOpt = {
          ...ta.dims.exportDims(),
          signal: exportAbort.signal,
          onProgress: (done, total) => {
            // Live take: (done, total) is a seconds countdown from the recorder. The
            // button is the one status surface guaranteed OUTSIDE the capture - the
            // in-page pill is skipped when the stage leaves it no capture-safe spot.
            if (liveTake) {
              if (total > 0) btn.textContent = `Recording live… ${done}s`;
              return;
            }
            // The status block over the sealed shutter gets EVERY format's progress,
            // animated included: the button label below deliberately skips those, and
            // a multi-minute video encode is exactly the export the sealed screen had
            // nothing to say about.
            reportToShutter?.(done, total);
            if (isAnimated || total <= 0) return;
            const pct = Math.floor((done / total) * 100);
            if (pct === lastExportPct) return;
            lastExportPct = pct;
            btn.textContent = `Exporting… ${pct}%`;
          },
          ...(isAnimated ? ta.video.videoParams() : {}),
          // A staged click deck (plans/184 R3): the Duration field is each slide's dwell,
          // not the video's total - the total is the slides added up, which the compositor
          // reads off the stamped data-seq-ms when the duration is NOT flagged user-set.
          // Flagged, it would truncate a two-slide deck to one slide's length.
          ...(unstageDeck ? { durationUserSet: false } : {}),
          // Contact sheet - `opts.cuts` is the pinned cross-agent name the export
          // bridge reads. Passed only when the Frames control is actually mounted
          // (a timed composition) AND the format is a still: every other export omits
          // it entirely, so the single-playhead-frame default path is untouched.
          ...(ta.sequence.isStillFmt(fmt) && el!.querySelector('[data-seq-still-only]')
            ? { cuts: ta.sequence.cutsValue() }
            : {}),
          ...audioOpt,
          ...(softCaptionsVtt ? { subtitlesVtt: softCaptionsVtt } : {}), // the embedded caption track (video only)
          ...(isGif
            ? {
                dither:
                  el!.querySelector<HTMLInputElement>('[data-action="gif-dither"]')?.checked ??
                  false,
              }
            : {}),
          ...(fmt === 'html'
            ? {
                fullPage:
                  el!.querySelector<HTMLInputElement>('[data-action="full-page"]')?.checked ??
                  false,
              }
            : {}),
          // EMF text mode: live GDI text records by default; the "Outline fonts"
          // chip forces the old text-as-paths output (same values as CLI --text).
          ...(fmt === 'emf' &&
          el!.querySelector<HTMLInputElement>('[data-action="emf-outline"]')?.checked
            ? { text: 'outline' as const }
            : {}),
          ...(isPrintFmt(fmt)
            ? {
                ...ta.dims.printOpts(),
                barStyle: SEPARATING_FORMATS.has(fmt)
                  ? ('cmyk-verify' as const)
                  : ('rgb-swatches' as const),
              }
            : {}),
          // The brand palette drives the colour bar for EVERY print format now, not just
          // CMYK: the CMYK paths ALSO do exact brand-swatch matching against it (see
          // buildCmykPaletteMap in bridge/export.ts), while the RGB paths (PDF/SVG/EPS)
          // use it only to paint the brand colours as RGB swatches (barStyle above).
          ...(isPrintFmt(fmt) ? { palette: brandPalette } : {}),
          ...(isCmykFmt(fmt)
            ? {
                colorProfile:
                  el!.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value ||
                  DEFAULT_CMYK_CONDITION,
              }
            : {}),
          ...(() => {
            const pw = el!.querySelector<HTMLInputElement>('[data-action="pdf-password"]')?.value;
            if (!pw) return {};
            const strong =
              el!.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')?.value ===
              'strong';
            // Strong (AES-256, encrypt-last) composes with RGB pdf AND print pdf-cmyk;
            // the 40-bit standard lock is applied by the writer and RGB-pdf only.
            if (strong && (fmt === 'pdf' || fmt === 'pdf-cmyk')) return { strongPassword: pw };
            if (fmt === 'pdf') return { password: pw };
            return {};
          })(),
          // Linux package (plan 197 M6): the panel's name/version/licence/install-path
          // become the RPM metadata; pkgInner is the render put inside the package.
          ...(fmt === 'rpm' || fmt === 'tar.gz'
            ? {
                pkg: {
                  name:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-name"]')
                      ?.value?.trim() || manifest.id,
                  version:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-version"]')
                      ?.value?.trim() || '1.0',
                  license:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-license"]')
                      ?.value?.trim() || undefined,
                  dest:
                    el!
                      .querySelector<HTMLInputElement>('[data-action="pkg-dest"]')
                      ?.value?.trim() || undefined,
                  innerFormat: pkgInner || undefined,
                },
              }
            : {}),
          ...(isC2paFmt(fmt) &&
          el!.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]')?.checked
            ? { c2pa: true, ...(ta.dims.c2paDaysVal() ? { c2paDays: ta.dims.c2paDaysVal()! } : {}) }
            : {}),
          // Pixel watermark - the popup toggle (seeded by ?imprint=); the bridge
          // applies it only to raster formats, so it's harmless to pass through for
          // others / zip members. A tool with no raster format renders no toggle -
          // fall back to the link default.
          ...((el!.querySelector<HTMLInputElement>('[data-action="imprint"]')?.checked ??
          exportDefaults.imprint)
            ? { imprint: true }
            : {}),
          ...((el!.querySelector<HTMLInputElement>('[data-action="durable"]')?.checked ??
          exportDefaults.durable)
            ? { durable: true }
            : {}),
          // Normalize loudness: the select's target LKFS, absent when Off.
          ...((): { normalize?: number } => {
            const v = el!.querySelector<HTMLSelectElement>(
              '[data-action="audio-normalize"]'
            )?.value;
            const n = v && v !== 'off' ? Number(v) : Number.NaN;
            return Number.isFinite(n) ? { normalize: n } : {};
          })(),
          // HDR (Rec.2100 PQ) - opt-in; passes the live brand palette as the colours
          // to boost + the author's slider dials. The bridge applies it to raster
          // (png/jpeg/avif/tiff) and the 10-bit video containers (mp4/webm, plan 154 WP-2);
          // a harmless pass-through for any other format.
          ...((el!.querySelector<HTMLInputElement>('[data-action="hdr"]')?.checked ??
          exportDefaults.hdr)
            ? {
                hdr: true,
                palette: brandPalette,
                hdrPeakNits: hdrDial('hdr-peak', HDR_DEFAULTS.peakNits),
                hdrReach: hdrDial('hdr-reach', HDR_DEFAULTS.reach),
                hdrLift: hdrDial('hdr-lift', HDR_DEFAULTS.lift),
                hdrRichness: hdrDial('hdr-focus', HDR_DEFAULTS.richness),
              }
            : {}),
          // Requested bit depth from the link (?depth=8/16/float). There is no panel
          // control for it - a depth request rides the URL and passes straight
          // through; the export bridge is where depth-follows-provenance is applied.
          ...(exportDefaults.depth ? { depth: exportDefaults.depth } : {}),
          ...(fmt === 'zip'
            ? {
                ...ta.dims.printOpts(), // bundled pdf / pdf-cmyk get marks & bleed; rasters ignore them
                palette: brandPalette,
                colorProfile:
                  el!.querySelector<HTMLSelectElement>('[data-action="cmyk-profile"]')?.value ||
                  DEFAULT_CMYK_CONDITION,
                filename:
                  el!.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ||
                  ta.formatRules.autoFilename(),
                bundleFormats: formats.filter((f) => ZIP_BUNDLE.has(f)),
                // Members re-enter renderFormat with these opts, so each stampable
                // bundled file gets its own credential; the zip container never does.
                ...(el!.querySelector<HTMLInputElement>('[data-action="pdf-c2pa"]')?.checked
                  ? { c2pa: true, ...(ta.dims.c2paDaysVal() ? { c2paDays: ta.dims.c2paDaysVal()! } : {}) }
                  : {}),
                // Whole-zip lock: standard = ZipCrypto, strong = AES-256 (renderZip strips
                // these off the per-member opts so members aren't double-locked).
                ...(() => {
                  const pw = el!.querySelector<HTMLInputElement>(
                    '[data-action="pdf-password"]'
                  )?.value;
                  if (!pw) return {};
                  return el!.querySelector<HTMLSelectElement>('[data-action="pdf-lock-tier"]')
                    ?.value === 'strong'
                    ? { strongPassword: pw }
                    : { password: pw };
                })(),
              }
            : {}),
        };
        const filename =
          el!.querySelector<HTMLInputElement>('[data-action="filename"]')?.value.trim() ||
          ta.formatRules.autoFilename();
        // The exact bytes handed to host.export.download - hashed into the export-
        // history record below so /verify can later match a file back to this device.
        let downloadedBlob: Blob | null = null;
        // A multi-page export downloads a ZIP bundle, not a single render. Flag it so the
        // 'renders' auto-save skips it: saving the zip under the per-page format tag would
        // write a corrupt asset (a .zip stored as if it were a png/svg/pdf).
        let downloadedIsZip = false;
        // plans/236: every delivery below goes through here, so the EXACT bytes and name
        // handed over are retained on the panel together with what the browser could
        // vouch for. A later retry re-hands those bytes; it never re-renders, re-stamps
        // provenance, re-encrypts a ZIP or records a revision (the history and library
        // writes further down run once, for the export, not for a retry).
        const deliver = async (blob: Blob, name: string): Promise<void> => {
          if (!el?.isConnected) {
            await deliverBatchFile(undefined, undefined, { blob, filename: name, label: name }, host);
            return;
          }
          ta.deliveryUnmount?.(); ta.deliveryUnmount = null;
          ta.deliveryResult?.dispose();
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const result = new DeliveryResult(
            { blob, filename: name, label: tRaw('{name} · exported {time}', { name, time }) },
            (again, againName) => deliverFile(host, again, againName),
            chooseLocationDeliver(host),
          );
          ta.deliveryResult = result;
          const surface = el!.querySelector<HTMLElement>('[data-export-delivery]');
          if (surface) {
            surface.hidden = false;
            ta.deliveryUnmount = mountDownloadRecovery(surface, result, {
              ready: tRaw('{name} ready.', { name }),
              saved: t('Saved.'),
            });
          }
          // Retain before attempting delivery: a failed first write must leave
          // the same bytes available to the recovery controls.
          await result.retry();
        };
        const framePages = framePick.kind === 'page' ? [pageEls[framePick.index]!] : pageEls;
        const notesHandout =
          fmt === 'pdf' &&
          isDesignTool &&
          framePages.length > 0 &&
          !!el!.querySelector<HTMLInputElement>('[data-action="pdf-notes-handout"]')?.checked;
        const outputBase = notesHandout ? `${filename}-speaker-notes` : filename;
        // A SCORM course package (plans/180 M-D1): not one render but a zip of them - every
        // artboard as a still, the narrated film with its caption sidecar, the fonts, the
        // manifest, the adapter and a launch page. bridge/export-scorm.ts owns the
        // packaging; this branch owns the two things only the live app can do, which is why
        // they go in as closures: photograph an artboard at its rest pose, and encode the
        // film. Placed BEFORE the still fan-out because it consumes the same pages for a
        // different purpose (a zip of loose images is not a course).
        if (notesHandout) {
          const [handoutModule, sequence] = await Promise.all([
            import('../design-notes-handout.ts'),
            import('../../bridge/sequence-dom.ts'),
          ]);
          const { mountDesignNotesHandout, snapshotDesignHandoutSlide, waitForDesignNotesHandout } =
            handoutModule;
          const { applySequenceTime, restoreSequenceTime, beginAuthoredDom, OFF_CLASS } = sequence;
          const handoutOpts: RunExportOpts & { cuts?: number } = { ...opts };
          delete handoutOpts.width;
          delete handoutOpts.height;
          delete handoutOpts.cuts;
          delete handoutOpts.bundleFormats;
          downloadedBlob = await exportUnscaled(
            async (report) => {
              reportToShutter = report ?? null;
              const previewUrls: string[] = [];
              let handout: ReturnType<typeof mountDesignNotesHandout> | null = null;
              const seqRoot = canvasEl;
              const seqOff = seqRoot ? [...seqRoot.querySelectorAll<HTMLElement>('.seq-off')] : [];
              seqOff.forEach((node) => { node.classList.remove('seq-off'); });
              const releaseAuthored = seqRoot ? beginAuthoredDom(seqRoot) : null;
              const slides: ReturnType<typeof snapshotDesignHandoutSlide>[] = [];
              try {
                try {
                  for (let i = 0; i < framePages.length; i++) {
                    exportAbort.signal.throwIfAborted();
                    const page = framePages[i]!;
                    if (seqRoot) {
                      applySequenceTime(seqRoot, restMsOf(page));
                      for (const node of seqRoot.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)) {
                        node.classList.remove(OFF_CLASS);
                      }
                    }
                    const slide = snapshotDesignHandoutSlide(page, i);
                    // The PDF walker does not scale descendant text uniformly through an
                    // ancestor transform. Photograph the slide once at a bounded native
                    // resolution; the handout lays out its headings and notes separately.
                    if (typeof window.URL?.createObjectURL === 'function') {
                      const scale = Math.min(1, 1600 / slide.width, 1000 / slide.height);
                      const previewOpts: RunExportOpts = {
                        width: Math.max(1, Math.round(slide.width * scale)),
                        height: Math.max(1, Math.round(slide.height * scale)),
                        scale: 1,
                        quality: 0.88,
                        background: '#ffffff',
                        thumbnail: true,
                        embedMeta: false,
                        c2pa: false,
                        imprint: false,
                        durable: false,
                        signal: exportAbort.signal,
                      };
                      const preview = await runtime.export(page, 'jpg', previewOpts);
                      slide.previewSrc = window.URL.createObjectURL(preview);
                      previewUrls.push(slide.previewSrc);
                    }
                    slides.push(slide);
                  }
                } finally {
                  if (seqRoot) restoreSequenceTime(seqRoot);
                  releaseAuthored?.();
                  seqOff.forEach((node) => { node.classList.add('seq-off'); });
                }
                handout = mountDesignNotesHandout(slides, { title: filename });
                await waitForDesignNotesHandout(handout.root);
                return await runtime.export(handout.root, 'pdf', handoutOpts);
              } finally {
                handout?.dispose();
                previewUrls.forEach((url) => { window.URL.revokeObjectURL(url); });
              }
            },
            { shutter: true, detail: t('Speaker notes handout'), onCancel: cancelExport }
          );
          await deliver(downloadedBlob, `${outputBase}.pdf`);
        } else if (fmt === 'scorm') {
          const { buildScormPackage, collectScormFonts } = await import(
            '../../bridge/export-scorm.ts'
          );
          const { narrationSlicesFromModel } = await import('../../lib/narration.ts');
          const { applySequenceTime, restoreSequenceTime, beginAuthoredDom, OFF_CLASS } =
            await import('../../bridge/sequence-dom.ts');
          // SVG where the deck is vector, PNG otherwise - the tool's own format list decides,
          // exactly as the docs-shot pipeline does.
          const stillFmt = formats.includes('svg') ? 'svg' : 'png';
          // Same stage discipline as the fan-out below: lift the playhead's `.seq-off`, hold
          // ONE set of authored styles across every page, and put both back afterwards. The
          // film renderer needs the stage handed back first, so the release is a closure that
          // can be called twice.
          const seqOff = canvasEl ? [...canvasEl.querySelectorAll<HTMLElement>('.seq-off')] : [];
          seqOff.forEach((o) => { o.classList.remove('seq-off'); });
          const seqRoot = canvasEl;
          const releaseAuthored = seqRoot ? beginAuthoredDom(seqRoot) : null;
          let stageHeld = true;
          const releaseStage = (): void => {
            if (!stageHeld) return;
            stageHeld = false;
            if (seqRoot) restoreSequenceTime(seqRoot);
            releaseAuthored?.();
            seqOff.forEach((o) => { o.classList.add('seq-off'); });
          };
          // A deck is NARRATED when a page holds an audio marker. A bed lives on the
          // pasteboard, outside every page, so it does not make a deck narrated by itself.
          const narrated = !!canvasEl?.querySelector('[data-pdf-page] [data-audio-src]');
          const filmFmt = formats.includes('mp4')
            ? 'mp4'
            : formats.includes('webm')
              ? 'webm'
              : null;
          const scormPages: HTMLElement[] = pageEls.length ? pageEls : canvasEl ? [canvasEl] : [];
          let pkg: Awaited<ReturnType<typeof buildScormPackage>>;
          try {
            pkg = await exportUnscaled(
              async (report) =>
                buildScormPackage({
                  title: filename,
                  lang: currentLang(),
                  // The engine has no i18n, so the launch page's own words arrive from here or
                  // the package ships English chrome under a non-English `<html lang>`.
                  // The three templated ones go through t() with NO params on purpose: the
                  // catalog string keeps its {n}/{total}/{title} for the launch page's own
                  // one-line substitution, which is the only place the numbers exist.
                  labels: {
                    previous: t('Previous'),
                    next: t('Next'),
                    slide: t('Slide {n}'),
                    slideOf: t('Slide {n} of {total}'),
                    captions: t('Captions'),
                    video: t('{title} video'),
                  },
                  // T4: the caption sidecar cut from each clip's OWN word timings, clamped to
                  // its slide. Without it the package's .vtt existed only when the burned-in
                  // caption boxes did, so deleting them (or narrating with captions off) sent
                  // an uncaptioned video into an LMS while the exact timings sat unused on
                  // every narration clip.
                  narration: narrationSlicesFromModel(runtime.getModel()),
                  signal: exportAbort.signal,
                  onProgress: (done, total) => {
                    report?.(done, total);
                  },
                  slides: scormPages.map((page) => ({
                    el: page,
                    notes: page.getAttribute('data-frame-notes') || undefined,
                    alt: page.getAttribute('data-frame-name') || undefined,
                  })),
                  fonts: await collectScormFonts(canvasEl),
                  renderStill: async (el) => {
                    // AT REST, not mid-entrance - the fan-out's rule, and for the same reason:
                    // a page whose boxes fade in over 400 ms photographs half-transparent.
                    if (seqRoot) {
                      applySequenceTime(seqRoot, restMsOf(el));
                      for (const o of seqRoot.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)) {
                        o.classList.remove(OFF_CLASS);
                      }
                    }
                    const node = el as HTMLElement;
                    const blob = await runtime.export(node, stillFmt, {
                      ...opts,
                      width: node.offsetWidth,
                      height: node.offsetHeight,
                    });
                    return {
                      bytes: new Uint8Array(await blob.arrayBuffer()),
                      ext: stillFmt === 'svg' ? 'svg' : 'png',
                    };
                  },
                  renderFilm:
                    narrated && filmFmt
                      ? async () => {
                          // The compositor poses the document itself, so hand the stage back before it
                          // runs rather than filming through this branch's still-life scaffolding.
                          releaseStage();
                          // `live` is dropped deliberately: "Record live" films the screen, and a
                          // course package wants the deterministic render at full quality.
                          const { live: _live, ...vp } = ta.video.videoParams();
                          const blob = await runtime.export(exportTargetNode(canvasEl), filmFmt, {
                            ...opts,
                            ...vp,
                          });
                          return {
                            bytes: new Uint8Array(await blob.arrayBuffer()),
                            ext: filmFmt,
                            // The same cues the moving export ships (plans/180 section 4): the timed
                            // composition's own caption boxes, else the tool audio's cached word
                            // timings. Never a second pass over audio we synthesised.
                            captionsVtt: (await ta.audio.captionText())?.vtt,
                          };
                        }
                      : null,
                }),
              { shutter: true, detail: fmtLabel(fmt), onCancel: cancelExport }
            );
          } finally {
            releaseStage();
          }
          downloadedBlob = pkg.blob;
          // A course package is an archive, not a render: the 'renders' auto-save must not
          // store it under the format tag, exactly as the multi-page zip must not.
          downloadedIsZip = true;
          await deliver(pkg.blob, `${filename}-scorm.zip`);
        } else if (
          pageEls.length >= 1 &&
          !isAnimated &&
          fmt !== 'pdf' &&
          fmt !== 'zip' &&
          fmt !== 'html' &&
          fmt !== 'pptx' &&
          fmt !== 'penpot' &&
          fmt !== 'rpm' &&
          fmt !== 'tar.gz'
        ) {
          if (framePick.kind === 'unmatched') {
            const why = tRaw('No slide matches ?s={s}. Exporting every slide.', {
              s: framePick.address.raw,
            });
            console.warn(`[export] ${why}`);
            announce(why, { assertive: true });
          }
          // Export EACH page frame as its own still image, at that frame's own layout size
          // (offsetWidth/Height - transform-independent, and the true possibly-resized page
          // size, not the tool's static render dims). One page → a single file; several → a zip.
          if (framePages.length > 1) btn.textContent = `Exporting ${framePages.length} pages…`;
          const pageOpts: RunExportOpts & { durationUserSet?: boolean; cuts?: number } = {
            ...opts,
          };
          delete pageOpts.bundleFormats;
          // Per-artboard stills fan out one image per frame; a cuts=N contact sheet only
          // applies to a whole [data-sequence] stage (the .lolly-frames wrapper), so it is
          // inert on an individual [data-pdf-page]. Drop it so a framed timed doc's per-slide
          // export can never carry a stray cuts opt into the page-level render.
          delete pageOpts.cuts;
          // A timed slideshow (frames-as-scenes) gates off-playhead artboards with
          // `.seq-off` (display:none, timeline.css) so only the current slide shows live.
          // A per-artboard still export must lift that first, or every non-current frame
          // photographs BLANK. Strip it across the whole canvas for the export window and
          // restore in `finally` (mirrors sequence-render.ts's photograph-time strip; the
          // class name is the CSS contract - OFF_CLASS in bridge/sequence-dom.ts).
          const seqOff = canvasEl ? [...canvasEl.querySelectorAll<HTMLElement>('.seq-off')] : [];
          seqOff.forEach((o) => { o.classList.remove('seq-off'); });
          // Loaded here rather than at the top of the file: the timeline composer is a
          // large module and only a framed, timed document ever reaches this branch.
          const { applySequenceTime, restoreSequenceTime, beginAuthoredDom, OFF_CLASS } =
            await import('../../bridge/sequence-dom.ts');
          // THE DOCUMENT IS THE ROOT, never a single page. The applier reads two of its
          // rules off the whole stage: a frames-as-scenes document opts OUT of depth and
          // tilt entirely, and what says so are the `[data-pdf-page]` elements themselves -
          // which are not descendants of any one page - while `data-seq-ms`, the length an
          // open-ended box is measured against, is stamped on the `.lolly-frames` root.
          // Handed one page, the composition answered both questions the other way from
          // the preview and the video compositor: it projected a lifted box through a
          // camera they refuse, at a perspective measured off the wrong element. One
          // session over the canvas, driven to each page's own rest moment, asks the same
          // questions they do - and it keeps ONE set of authored styles across the whole
          // fan-out, which is what `createSequenceTime` exists to do.
          const seqRoot = canvasEl;
          // The editor's own playhead stands down for the length of the export, so the
          // styles this session captures as authored are the author's and not the pose the
          // timeline happened to be holding. The same scope every other photographer opens.
          const releaseAuthored = seqRoot ? beginAuthoredDom(seqRoot) : null;
          let files: Array<{ name: string; blob: Blob }>;
          try {
            files = await exportUnscaled(
              async (report) => {
                const out: Array<{ name: string; blob: Blob }> = [];
                for (let i = 0; i < framePages.length; i++) {
                  const el = framePages[i]!;
                  // Pages are the honest unit of progress here - each one is a whole
                  // render, and only the last of them reports any sub-progress. It is
                  // also the cancel point: a still page render has no yield point of its
                  // own, so this is what stops a 40-page fan-out part way.
                  report?.(i, framePages.length);
                  exportAbort.signal.throwIfAborted();
                  // AT REST, not mid-entrance. Lifting `.seq-off` above only decides which
                  // artboards are on stage; it says nothing about WHEN each one is
                  // photographed, so a page whose boxes fade in over 400 ms came out as a
                  // page of half-transparent boxes. Compose the document at this page's own
                  // rest moment first - the moment every enter on it has finished, which
                  // restMsOf works out from the page's own timing attributes (plans/179 M4).
                  if (seqRoot) {
                    applySequenceTime(seqRoot, restMsOf(el));
                    // THE APPLIER DOES NOT DECIDE VISIBILITY ON THIS PATH. It hides every box
                    // whose half-open window does not contain that moment - including,
                    // inside the page it was just asked to pose, the two bullets that have
                    // already had their turn. A still of an artboard draws everything ON it:
                    // that is what the strip above decided for the pages, it is what a
                    // moving export says out loud through `buildStepsDropped` for the
                    // fragments, and it is what this export did before it learned about
                    // time. So the POSE is kept and the hiding is lifted again, every page,
                    // before the shot.
                    for (const o of seqRoot.querySelectorAll<HTMLElement>(`.${OFF_CLASS}`)) {
                      o.classList.remove(OFF_CLASS);
                    }
                  }
                  const pb = await runtime.export(el, fmt, {
                    ...pageOpts,
                    width: el.offsetWidth,
                    height: el.offsetHeight,
                  });
                  out.push({ name: `${filename}-${i + 1}.${extFor(fmt, pb)}`, blob: pb });
                }
                return out;
              },
              { shutter: true, detail: fmtLabel(fmt), onCancel: cancelExport }
            );
          } finally {
            // Reverse order of the two scopes above: hand the composition back first (it
            // also lifts every `.seq-off` it wrote), then the playhead, then put the
            // artboards that were genuinely off the playhead back off it.
            if (seqRoot) restoreSequenceTime(seqRoot);
            releaseAuthored?.();
            seqOff.forEach((o) => { o.classList.add('seq-off'); });
          }
          if (files.length === 1) {
            downloadedBlob = files[0]!.blob;
            await deliver(files[0]!.blob, `${filename}.${extFor(fmt, files[0]!.blob)}`);
          } else {
            const { buildZip } = await import('../../pro/zip.ts');
            const zipBlob = await buildZip(files, { zipName: filename });
            downloadedBlob = zipBlob;
            downloadedIsZip = true;
            await deliver(zipBlob, `${filename}.zip`);
          }
        } else {
          // A LIVE take must keep the fit-to-stage scale. exportUnscaled blows the
          // canvas up to native size for the entire recording, so the user would watch
          // a clipped canvas while the capture crops to a viewport slice. Instead,
          // record the preview exactly as displayed: the recorder's sizing/bitrate
          // math already reads the on-screen rect times dpr. A live take also films
          // the SCREEN, so the shutter would appear in the take. Both reasons point
          // the same way, so the ternary below keeps live out of exportUnscaled
          // entirely.
          //
          // EVERY OTHER export gets the shutter, animated included (Andy, 2026-07-27).
          // This used to be `shutter: !isAnimated`, based on the idea that an animated
          // format "records the live canvas over seconds" - true only of a live take,
          // which never reaches this branch. Every other motion path composites
          // OFF-SCREEN: the sequence compositor rasterises static layers once and draws
          // into its own canvas, renderRecord/renderTopTail draw to theirs, renderVideo
          // replays onto an offscreen canvas, and a [data-capture-stream] tool captures
          // its own canvas's backing store, which an overlay cannot reach.
          // `.export-shutter` is also a SIBLING of #tool-canvas-outer, while every
          // capture targets #tool-canvas or below, so it is outside the captured
          // subtree either way. The shake is real for video too: exportUnscaled strips
          // the transform and resizes to full export dimensions, and a lottie layer
          // visibly steps frame-by-frame during a sequence render. The iris is built
          // to hold (see the CSS): it stays closed for the variable export time, while
          // the export popup keeps showing progress underneath it.
          const drvNode = exportTargetNode(canvasEl);
          // Deterministic animated-source render (Andy's "right side of the render line"): the
          // preview plays the effect live, but the final render walks the SOURCE frame-by-frame
          // through the same effect. Register the per-frame drive the export frame loop awaits
          // (createFrameSource → node.__lollyFrameDrive), and PAUSE the live repaint loop (not
          // stop - the source stays armed so renderFrameAt keeps working) so a real-time frame
          // can't clobber the exact frame being captured. renderFrameAt returns null for a
          // camera (not deterministically re-samplable), so this cleanly no-ops there. Only the
          // deterministic path (not the screen-share liveTake) needs it.
          const liveDrive = !liveTake && runtime.isLive() && !!drvNode;
          if (liveDrive) {
            const media = host.media as unknown as {
              renderFrameAt?: (tMs: number) => Promise<MediaFrameLike | null>;
            };
            (drvNode as unknown as { __lollyFrameDrive?: unknown }).__lollyFrameDrive = async (
              t: number,
              durMs: number
            ) => {
              const mf = media.renderFrameAt ? await media.renderFrameAt(t * durMs) : null;
              if (!mf) return; // camera / unseekable → leave the base
              const html = await runtime.applyFrameForExport(mf);
              if (html != null) drvNode!.innerHTML = html; // paint the exact frame before capture
            };
            runtime.pauseLive();
          }
          const blob = await (async (): Promise<Blob> => {
            try {
              return liveTake
                ? await runtime.export(drvNode, fmt, opts)
                : await exportUnscaled(
                    (report) => {
                      reportToShutter = report ?? null; // read by opts.onProgress above
                      return runtime.export(drvNode, fmt, opts);
                    },
                    { shutter: true, detail: fmtLabel(fmt), onCancel: cancelExport }
                  );
            } finally {
              if (liveDrive) {
                delete (drvNode as unknown as { __lollyFrameDrive?: unknown }).__lollyFrameDrive;
                runtime.resumeLive();
                runtime.refresh(); // restore the live preview
              }
            }
          })();
          // Sidecar captions (plans/180 section 4, layer 3). A render is ONE Blob and a
          // browser download is one file, so the only way to hand over the video and its
          // caption files together is a small zip - the same shape the multi-page fan-out
          // above already downloads. The video keeps its own bytes verbatim inside it,
          // credential included; the .vtt and the .srt are the cues the film was captioned
          // from. Off ⇒ the plain single file, unchanged.
          if (sidecarCaptions) {
            const { zipAsync } = await import('../../lib/zip.ts');
            const enc = new TextEncoder();
            const zipped = await zipAsync({
              [`${filename}.${extFor(fmt, blob)}`]: new Uint8Array(await blob.arrayBuffer()),
              [`${filename}.vtt`]: enc.encode(sidecarCaptions.vtt),
              [`${filename}.srt`]: enc.encode(sidecarCaptions.srt),
            });
            const zipBlob = new Blob([zipped as BlobPart], { type: 'application/zip' });
            downloadedBlob = zipBlob;
            downloadedIsZip = true;
            await deliver(zipBlob, `${filename}.zip`);
          } else {
            downloadedBlob = blob;
            await deliver(blob, `${filename}.${extFor(fmt, blob)}`);
          }
        }
        revokeTrackUrls();
        bumpMetric('filesRendered');
        recordFormat(fmt); // local usage metric
        // L3 (plans/163) - remember the format and size this was exported at, so the
        // next fresh mount of this tool opens on them. Best-effort and non-blocking,
        // like the history record and the library copy below: the file has already
        // reached the user, and a lost write only costs the memory. No UI, no switch -
        // the tool's defaults just get better with use. Explicit values (a link's
        // params, a resumed session) still win on the way back in; see
        // lib/export-prefs.ts.
        {
          const { w: lastW, h: lastH } = ta.dims.rawDims();
          void saveExportPrefs(host, manifest.id, {
            format: fmt,
            width: lastW,
            height: lastH,
            unit: ta.refresh.dimUnit(),
            dpi: ta.dims.dimDpi(),
          });
        }
        // A collaboration mount suppresses private device activity.
        if (experience.recordDeviceActivity !== false) {
          const entry = { toolId: manifest.id, label: manifest.name, filename: outputBase,
            format: fmt, query: serializeUrlState(runtime.getModel()), ...(ta.activeSlot ? { slot: ta.activeSlot } : {}) };
          void import('../../lib/export-activity.ts').then(({ recordExportActivity }) => recordExportActivity({
            allowed: true, entry, bytes: downloadedBlob,
            capture: () => captureThumbnail(manifest, canvasEl, runtime, exportUnscaled, fmt, false),
          })).catch(() => {});
        }
        // Auto-save the SAME credentialed bytes into the personal library (the
        // 'renders' tag). Best-effort + non-blocking: the file has already reached
        // the user. Deduped by checksum and gated by the profile toggle inside the
        // helper; large/video renders confirm first (the download is never gated).
        void (async () => {
          try {
            if (!downloadedBlob || downloadedIsZip) return;
            const { saveRenderToLibrary } = await import('../../lib/save-render.ts');
            const dimNum = (v: number | string | undefined): number | undefined => {
              const n = typeof v === 'string' ? Number(v) : v;
              return typeof n === 'number' && Number.isFinite(n) && n > 0
                ? Math.round(n)
                : undefined;
            };
            await saveRenderToLibrary(
              host as unknown as Parameters<typeof saveRenderToLibrary>[0],
              {
                blob: downloadedBlob,
                format: fmt,
                toolId: manifest.id,
                name: outputBase,
                width: notesHandout ? 794 : dimNum(opts.width),
                height: notesHandout ? 1123 : dimNum(opts.height),
              }
            );
          } catch {
            /* saving to the library is best-effort */
          }
        })();
        // Export home (plans/138 A1): if the user pinned a cloud as their export
        // home, this same file ALSO auto-sends there over the send-target driver.
        // Best-effort + non-blocking; the send runs as a light job so the global
        // toast carries its progress and the resulting link.
        void (async () => {
          const { sendTargetsReady } = ta;
          try {
            if (!downloadedBlob) return;
            // autoSendToExportHome resolves the pinned cloud through the same
            // sendTargetsFor() registry the panel renders from, and finding nothing there
            // is indistinguishable from "not connected on this device" - it returns
            // silently. So wait for the panel's own on-demand driver load (memoised;
            // long resolved by the time anyone has exported) rather than reading a
            // registry that may not be filled yet.
            const [{ autoSendToExportHome }] = await Promise.all([
              import('../../lib/export-home.ts'),
              sendTargetsReady,
            ]);
            await autoSendToExportHome(
              host as unknown as Parameters<typeof autoSendToExportHome>[0],
              {
                blob: downloadedBlob,
                format: downloadedIsZip ? 'zip' : fmt,
                name: outputBase,
              }
            );
          } catch {
            /* the export home is best-effort - the download already succeeded */
          }
        })();
      } catch (err) {
        revokeTrackUrls();
        // Cancelled, not broken: nothing was downloaded or saved, so say so quietly and
        // put the button back. The shutter was already restored by exportUnscaled's own
        // finally. 'AbortError' is the one shape every path arrives in - the sequence
        // compositor maps its SEQ_ABORTED onto it.
        if ((err as { name?: string })?.name === 'AbortError') {
          btn.removeAttribute('aria-busy');
          btn.textContent = prev;
          btn.toggleAttribute('disabled', false);
          announce(t('Export cancelled'));
          return;
        }
        console.error('Export failed:', err);
        btn.removeAttribute('aria-busy');
        // Surface WHY so users don't just retry the same doomed export.
        const raw = String((err as { message?: string })?.message || '');
        const why = /too large|maximum|exceeds|canvas size|dimensions/i.test(raw)
          ? 'Too large - reduce size or DPI'
          : /not supported|unsupported|no encoder|mime|codec/i.test(raw)
            ? `Can’t export ${fmt} in this browser`
            : raw && raw.length <= 48
              ? raw
              : 'Export failed - try again';
        btn.textContent = why;
        announce(why, { assertive: true });
        setTimeout(() => {
          btn.textContent = prev;
          btn.toggleAttribute('disabled', false);
        }, 3500);
        return;
      } finally {
        // Save As is armed before the shared render begins. If the render fails
        // before host.export.download consumes it, never let that one-shot choice
        // leak into a later ordinary Download.
        desktopExport?.cancelSaveAs();
        // The staged click deck goes back exactly (plans/184 R3) - before anything else
        // reads the canvas, and whether the export finished, failed or was cancelled.
        unstageDeck?.();
        unstageDeck = null;
        // Always release the module-global sink, whatever exit the export took.
        _setExportNoticeSink(null);
      }

      btn.removeAttribute('aria-busy');
      btn.textContent = prev;
      btn.toggleAttribute('disabled', false);
      announce('Export complete');
      // (b) A calm, visible line on the card for each degradation, honest not alarmed.
      if (degradeNote && degradedNotes.length) {
        degradeNote.textContent = degradedNotes.join(' ');
        degradeNote.hidden = false;
      }
      ta.saving.exportCompleted();
      void ta.notes.offerDetailsAsk()
        .then((shown) => {
          if (!shown) ta.notes.offerReopenNote();
        })
        .catch(() => {
          /* the ask is an extra, never a failure path */
        });
    }
  );

  el.querySelector<HTMLButtonElement>('[data-action="save"]')?.addEventListener(
    'click',
    async function (this: HTMLButtonElement) {
      const qsFolder = await ta.saving.quickSaveFolder();
      if (await ta.saving.performSave(this, qsFolder ? { folderId: qsFolder } : undefined))
        ta.saving.settleSaveButton(this);
    }
  );

  // Cloud send destinations (the send-target seam). The card list is rebuilt
  // per format; ONE delegated click handler on the container survives the
  // re-renders. A send renders the same bytes the Download button would for
  // the cheap cases - dims plus the Outline-fonts chip when the format is EMF
  // - and hands them to the provider; the status line becomes the provider's
  // viewable link on success.
  // Collapsed by default, exactly like Content protection - one tidy header for
  // a capability most exports never touch. The open state lives in the closure so
  // a format change (which rebuilds the card) doesn't slam it shut mid-use.
  ta.sendOpen = false;
}

export function wiringOps(ta: ActionsCtx) {
  return {
    wireFormatAndName: bindOp(ta, wireFormatAndName),
    wireDuration: bindOp(ta, wireDuration),
    wireFormatChange: bindOp(ta, wireFormatChange),
    readPassword: bindOp(ta, readPassword),
    wirePrint: bindOp(ta, wirePrint),
    wireC2pa: bindOp(ta, wireC2pa),
    wireCostSlot: bindOp(ta, wireCostSlot),
    wireCostRows: bindOp(ta, wireCostRows),
    wireApprovalAndActions: bindOp(ta, wireApprovalAndActions),
  };
}
