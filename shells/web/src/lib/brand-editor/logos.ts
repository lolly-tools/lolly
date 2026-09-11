// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: the Logos room - tiles, stats, classification and the trim offer.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { colorToHex, extractSvgColors } from '@lolly/engine';
import { nameColor } from '../color-namer.ts';
import { addSwatch, prettify, walkSwatches } from '../brand-doc.ts';
import { serializeColor } from '../color-formats.ts';
import { LOGO_ORIENTATIONS, LOGO_TREATMENTS, ORIENTATION_META, TREATMENT_META, installLogo, listLogos, splitVariant } from '../brand-logos.ts';
import type { LogoSlot, LogoVariant } from '../brand-logos.ts';
import { classifyLogoRasterStats, classifyLogoSvg } from '../design-system/classify-logo.ts';
import type { LogoClassification } from '../design-system/classify-logo.ts';
import { mountTrimOffer, prepareTrim } from '../design-system/trim-offer.ts';
import { rasterAlphaBounds } from '../design-system/trim-bounds.ts';
import { candidatesFromCensus, createTray } from '../design-system/tray.ts';
import type { Tray } from '../design-system/tray.ts';
import { censusFromSvgColors, censusHex } from '../design-system/census.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { prefersReducedMotion } from '../a11y-prefs.ts';
import { playSfx } from '../sfx.ts';
import { assignRole } from '../design-system/roles.ts';
import { logoGroupHtml } from './shared.ts';
import type { RasterLogoStats } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

export const showLogoErr = (bedit: BrandEditorCtx, m: string): void => {
  const { logoErr } = bedit; if (logoErr) { logoErr.textContent = m; logoErr.hidden = !m; } if (m) announce(m, { assertive: true }); };
export const identityLabel = (_bedit: BrandEditorCtx, id: string): string => (id === 'default' ? t('The logo') : prettify(id));
export const logoTile = (_bedit: BrandEditorCtx, v: string, identity: string, slot: LogoSlot | undefined, label?: string): string => {
  const { treatment } = splitVariant(v);
  const tm = treatment ? TREATMENT_META[treatment] : null;
  const name = label ?? slot?.label ?? (tm ? tm.label : prettify(v));
  const hint = slot ? t('Click to replace') : (tm ? tm.hint : t('A mark named its own way.'));
  // An empty slot says what it IS - "Not set", in the muted register - rather
  // than showing a bare "+" that reads as an instruction (plan 182 section
  // 4.2). The whole tile is still the drop target and the file input's label,
  // so nothing about adding a mark changed; only the words did.
  const body = slot
    ? `<span class="be-logo-art"><img src="${escapeText(slot.url)}" alt="${escapeText(tRaw('{name} logo', { name }))}" loading="lazy"></span>`
    : `<span class="be-logo-empty">${t('Not set')}</span>`;
  // The slot's file input is `visually-hidden`, never `hidden`: a display:none
  // input is not focusable, which made every logo slot mouse-only. The label
  // draws the keyboard ring on its behalf via .be-logo-drop:focus-within
  // (brand-studio.css) - the same construction the shared dropzone uses.
  return `<div class="be-logo-slot${slot ? ' is-filled' : ''}" data-be-logo="${escapeText(v)}" data-treatment="${treatment ?? 'custom'}">
        <div class="be-logo-slot-head"><span class="be-logo-slot-name">${escapeText(name)}</span>
          ${slot ? `<button type="button" class="be-logo-del" data-logo-del="${escapeText(v)}" data-identity="${escapeText(identity)}" aria-label="${escapeText(tRaw('Remove the {name} mark', { name }))}">&#x2715;</button>` : ''}</div>
        <label class="be-logo-drop">
          ${body}
          <input type="file" class="be-logo-file visually-hidden" data-logo-file="${escapeText(v)}" data-identity="${escapeText(identity)}" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escapeText(tRaw('Replace the {name} mark', { name }))}">
        </label>
        <p class="be-logo-hint">${escapeText(hint)}</p>
      </div>`;
};
export const paintLogos = async (bedit: BrandEditorCtx): Promise<void> => {
  const { fontsHost, pendingIdentities, root } = bedit;
  const mount = bedit.ramps.$('[data-be-logos]') as HTMLElement | null; if (!mount) return;
  bedit.logoUrls.forEach(u => { URL.revokeObjectURL(u); }); bedit.logoUrls = [];
  const slots = await listLogos(fontsHost).catch(() => [] as LogoSlot[]);
  bedit.logoUrls = slots.map(s => s.url);
  bedit.filledDefaultSlots = new Set(slots.filter(s => s.identity === 'default').map(s => s.variant));
  // default leads, then stored identities in first-seen order, then this
  // session's still-empty additions.
  const identities: string[] = ['default'];
  for (const s of slots) if (!identities.includes(s.identity)) identities.push(s.identity);
  for (const p of pendingIdentities) if (!identities.includes(p)) identities.push(p);
  const sections = identities.map(identity => {
    const mine = slots.filter(s => s.identity === identity);
    const byVariant = new Map(mine.map(s => [s.variant, s]));
    const groups = LOGO_ORIENTATIONS.map(o => {
      const om = ORIENTATION_META[o];
      const variants = LOGO_TREATMENTS.map(tr => `${o}-${tr}` as LogoVariant);
      const tiles = variants.map(v => logoTile(bedit, v, identity, byVariant.get(v))).join('');
      return logoGroupHtml({
        name: escapeText(om.label), hint: escapeText(om.hint), body: tiles,
        filled: variants.some(v => byVariant.has(v)),
      });
    }).join('');
    const customs = mine.filter(s => s.custom);
    const customTiles = customs.map(s => logoTile(bedit, s.variant, identity, s)).join('');
    const customGroup = logoGroupHtml({
      name: t('Custom marks'),
      hint: t('Marks the design system names its own way - an icon, a crest, a favicon.'),
      cls: ' be-logo-group--custom',
      filled: customs.length > 0,
      body: `${customTiles}
            <form class="be-logo-addmark" data-logo-addmark data-identity="${escapeText(identity)}">
              <input type="text" class="be-logo-addmark-name" data-addmark-name placeholder="${escapeText(t('Name it - Icon, Crest…'))}" autocomplete="off" spellcheck="false" aria-label="${escapeText(t('Custom mark name'))}">
              <label class="be-btn be-logo-addmark-pick">${t('Choose file…')}
                <input type="file" class="visually-hidden" data-addmark-file accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escapeText(t('Choose a file for this mark'))}"></label>
            </form>`,
    });
    return `<section class="be-logo-identity" data-identity="${escapeText(identity)}">
          ${identities.length > 1 || identity !== 'default' ? `<div class="be-logo-identity-head"><h4 class="be-logo-identity-name">${escapeText(identityLabel(bedit, identity))}</h4></div>` : ''}
          ${groups}${customGroup}
        </section>`;
  }).join('');
  const addIdentity = `<form class="be-logo-addidentity" data-logo-addidentity>
        <input type="text" data-addidentity-name placeholder="${escapeText(t('Another logo? Name it - Product, Event…'))}" autocomplete="off" spellcheck="false" aria-label="${escapeText(t('New logo name'))}">
        <button type="submit" class="be-btn">${t('+ Add another logo')}</button>
      </form>`;
  // A room that went away mid-paint drains NOTHING. `takePendingLogoFiles()`
  // empties the one-shot stash and nothing can re-arm it, so draining into a
  // torn-down room does not just waste the paint - it destroys the hand-off,
  // and the marks cannot be sent again without re-opening the document.
  if (!root.isConnected) return;
  mount.innerHTML = sections + addIdentity;
  bedit.renderIntake();
  // Only the FIRST paint has anything to drain (the stash is one-shot and the
  // drain latches), so the repaint after every placement costs one boolean.
  bedit.drainPendingLogos();
};
/** A slug brand-logos accepts, from whatever the user typed. */
export const slugify = (_bedit: BrandEditorCtx, name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
/** Add the colour, give it the primary role, and point the Generate wing's
 *  picker at it - one motion, persisted immediately (plan 97 section 6). */
export const takePrimaryFromLogo = (bedit: BrandEditorCtx, hex: string): void => {
  const name = nameColor(hex);
  const path = addSwatch(bedit.doc, 'custom', name, serializeColor(hex, 'lch'));
  // walkSwatches owns the path→key mapping (it strips the set prefix), so read
  // the key back off the swatch rather than re-deriving it here.
  const swatchKey = path
    ? walkSwatches(bedit.doc, bedit.currentTheme).find(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]))?.key
    : undefined;
  // Deliberately UNSCOPED (no theme): a mark's colour is the brand's primary
  // in both themes, unlike surface and text, which each theme inverts.
  if (swatchKey) assignRole(bedit.doc, 'primary', swatchKey);
  bedit.state.setPrimaryTo(hex); // the Generate wing's picker follows the new primary
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
};
export const trayHandle = async (bedit: BrandEditorCtx): Promise<Tray | null> => {
  const { host, opts } = bedit;
  if (opts.tray) return opts.tray;
  if (bedit.tray) return bedit.tray;
  try {
    const made = createTray(host);
    await made.load();
    bedit.tray = made;
    return bedit.tray;
  } catch { return null; }
};
/**
 * The colours a mark carries beyond the one the hero offers. They used to be
 * dropped on the floor; now they wait in the tray for as long as the user
 * likes (plan 97 section 8) and nothing is added to the palette on their account.
 */
export const trayColorsFromLogo = async (bedit: BrandEditorCtx, colors: string[], label: string): Promise<void> => {
  if (!colors.length) return;
  const handle = await trayHandle(bedit);
  if (!handle) return;
  // censusFromSvgColors appends an implied white ground when the artwork
  // carries none - a claim about the PAGE a mark sits on, which is right for
  // the role proposer and wrong for a shopping list. Candidates are filtered
  // back to the colours the file actually paints with.
  const own = new Set(colors.map(c => censusHex(c)).filter((h): h is string => !!h));
  const candidates = candidatesFromCensus(censusFromSvgColors(colors, label))
    .filter(c => c.type === 'color' && own.has(censusHex(c.value) ?? ''));
  if (!candidates.length) return;
  try {
    const added = await handle.add(candidates);
    if (added > 0) announce(t('Other colours from this file are waiting in the tray.'));
  } catch { /* the tray is a convenience; a failed add never fails an install */ }
};
export const suggestFromLogo = async (bedit: BrandEditorCtx, file: File): Promise<void> => {
  const { suggestEl } = bedit;
  if (!/svg/i.test(file.type) || file.size > 10 * 1024 * 1024) return;
  let colors: string[] = [];
  try { colors = extractSvgColors(await file.text()).map(c => colorToHex(c) ?? '').filter(c => /^#/.test(c)); } catch { return; }
  const first = colors[0];
  // The leading colour keeps its privileged path below; every other one is a
  // candidate, not a decision.
  void trayColorsFromLogo(bedit, colors.slice(1), file.name);
  if (!first || !suggestEl) return;
  if (!bedit.isUserBrand) {
    // Nothing of the user's to clobber yet - take it, and say what happened.
    takePrimaryFromLogo(bedit, first);
    // ONCE, though. That call just wrote a custom swatch, gave it the primary
    // role and persisted, so from here on there IS something of the user's:
    // the second file of a multi-file drop must OFFER rather than take (plan
    // 97 section 7.3 keeps exactly one auto-set, primary on a first-ever install).
    // Without this line every extra logo adds another swatch and reassigns the
    // role, and the last file dropped silently wins.
    bedit.isUserBrand = true;
    suggestEl.innerHTML = `<span class="be-suggest-note"><span class="be-suggest-sw" style="--sw:${escapeText(first)}" aria-hidden="true"></span>${t('Primary set from the logo.')}</span>`;
    suggestEl.hidden = false;
    announce(t('Primary set from the logo.'));
    return;
  }
  suggestEl.innerHTML = `
      <span class="be-suggest-note"><span class="be-suggest-sw" style="--sw:${escapeText(first)}" aria-hidden="true"></span>${t('Found in the logo:')} <code>${escapeText(first)}</code></span>
      <button type="button" class="be-btn be-btn--sm" data-be-suggest-use="${escapeText(first)}">${t('Use as primary')}</button>
      <button type="button" class="be-suggest-dismiss" data-be-suggest-dismiss aria-label="${escapeText(t('Dismiss suggestion'))}">&#x2715;</button>`;
  suggestEl.hidden = false;
};
export const isSvgLogoFile = (_bedit: BrandEditorCtx, f: File): boolean => /^image\/svg(\+xml)?$/i.test(f.type);
/**
 * A raster mark's stats for the classifier: content bounds for the shape, a
 * quantized census for the ink, and how much of the frame is transparent. The
 * decode lives here because classify-logo.ts is deliberately DOM-free.
 */
export const rasterLogoStats = async (bedit: BrandEditorCtx, file: File): Promise<RasterLogoStats | null> => {
  const { CLASSIFY_ALPHA_MIN, CLASSIFY_MAX_PIXELS, CLASSIFY_MAX_SAMPLES } = bedit;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return null; }
  const { width, height } = bitmap;
  if (!width || !height || width * height > CLASSIFY_MAX_PIXELS) { bitmap.close?.(); return null; }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) { bitmap.close?.(); return null; }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, width, height).data; } catch { return null; }
  // Sample on a grid rather than every pixel: the census needs the ink's
  // proportions, and a stride keeps a 12 Mpx export as cheap as a 300px one.
  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / CLASSIFY_MAX_SAMPLES)));
  const q = (v: number): string =>
    { const { CLASSIFY_QUANT } = bedit; return Math.min(255, Math.round(v / CLASSIFY_QUANT) * CLASSIFY_QUANT).toString(16).padStart(2, '0'); };
  const counts = new Map<string, number>();
  let sampled = 0;
  let clear = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      sampled++;
      if (data[i + 3]! <= CLASSIFY_ALPHA_MIN) { clear++; continue; }
      const key = `#${q(data[i]!)}${q(data[i + 1]!)}${q(data[i + 2]!)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  // Orientation reads CONTENT bounds, never the canvas: a mark centred in a
  // padded export is the same shape whatever the padding.
  const box = rasterAlphaBounds(data, width, height, { alphaMin: CLASSIFY_ALPHA_MIN });
  return {
    width: box?.width || width,
    height: box?.height || height,
    colors: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([hex, weight]) => ({ hex, weight })),
    transparentShare: sampled > 0 ? clear / sampled : 0,
    // Deliberately not a number: classifyLogoRasterStats recomputes the light
    // share from `colors` against its own OKLCH threshold, and passing one here
    // would mean duplicating that threshold and then drifting from it.
    lightShare: Number.NaN,
  };
};
export const classifyLogoFile = async (bedit: BrandEditorCtx, file: File): Promise<LogoClassification | null> => {
  if (isSvgLogoFile(bedit, file)) {
    try { return classifyLogoSvg(await file.text()); } catch { return null; }
  }
  const stats = await rasterLogoStats(bedit, file);
  return stats ? classifyLogoRasterStats(stats) : null;
};
/** Close whatever offer is open. A placement still waiting on it resolves with
 *  its ORIGINAL file - the non-destructive answer, the same one Escape gives. */
export const closeTrimOffer = (bedit: BrandEditorCtx): void => {
  const { trimMount } = bedit;
  const teardown = bedit.trimTeardown; bedit.trimTeardown = null;
  const abandon = bedit.trimAbandon; bedit.trimAbandon = null;
  teardown?.();
  if (trimMount) trimMount.hidden = true;
  abandon?.();
};
/** True while a trim card is on screen. One mount, one decision: a second
 *  placement started now would tear that card down under the user, so every
 *  entry point checks this first. */
export const trimBusy = (bedit: BrandEditorCtx): boolean => bedit.trimTeardown !== null;
/**
 * Run the shared trim offer over a file on its way to becoming an asset and
 * resolve with the bytes to ingest. NULL means the user backed out (Escape, or
 * the card's ✕): the placement is abandoned and nothing is installed.
 *
 * `restore` hands the keyboard back after the card is answered - the card took
 * focus on mount and its buttons are about to be removed, so without it every
 * placement drops the user on <body>. Called for a USER answer only; on the
 * abandon path the whole surface is going away.
 *
 * ORDERING (trim-offer.ts's own rule, plan 97 section 4 gap 4): this MUST run BEFORE
 * the store path - storeUserUpload's normaliser strips the root width/height,
 * after which a viewBox rewrite has nothing left to bite on. A file with no
 * margin worth removing never sees a card at all.
 */
export const withTrimOffer = (bedit: BrandEditorCtx, file: File, restore?: () => void): Promise<File | null> => { const { root } = bedit; return new Promise<File | null>((resolve) => {
const { trimMount } = bedit;
  void (async () => {
    let proposal: Awaited<ReturnType<typeof prepareTrim>> = null;
    try { proposal = await prepareTrim(file); } catch { /* unreadable - no offer */ }
    if (!proposal || !trimMount || !root.isConnected) { resolve(file); return; }
    closeTrimOffer(bedit);
    trimMount.hidden = false;
    let settled = false;
    const finish = (chosen: File | null, restoreFocus = false): void => {
      if (settled) return;
      settled = true;
      closeTrimOffer(bedit);
      if (restoreFocus) restore?.();
      resolve(chosen);
    };
    // The room repainting under an open card is not the user backing out: the
    // file they picked still installs, with the margins it arrived with.
    bedit.trimAbandon = () => finish(file);
    bedit.trimTeardown = mountTrimOffer(trimMount, proposal, {
      t,
      onResolve: chosen => finish(chosen, true),
      onCancel: () => finish(null, true),
    });
    trimMount.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  })();
}); };
/** installLogo expresses the unnamed identity by OMITTING it (passing
 *  'default' is refused as a reserved name), so every install funnels through
 *  here rather than repeating that ternary at each call site. */
export const installLogoFile = (bedit: BrandEditorCtx, variant: string, identity: string, file: File, label?: string): Promise<void> =>
  { const { fontsHost } = bedit; return installLogo(fontsHost, variant, file, {
    ...(identity && identity !== 'default' ? { identity } : {}),
    ...(label ? { label } : {}),
  }); };
export function wireLogoSuggest(bedit: BrandEditorCtx): void {
  const { suggestEl } = bedit;
  suggestEl?.addEventListener('click', (e) => {
    const use = (e.target as HTMLElement).closest<HTMLElement>('[data-be-suggest-use]');
    if (use) {
      bedit.logos.takePrimaryFromLogo(use.dataset.beSuggestUse!);
      suggestEl.hidden = true; playSfx('click');
      announce(t('Primary set from the logo.'));
      return;
    }
    if ((e.target as HTMLElement).closest('[data-be-suggest-dismiss]')) suggestEl.hidden = true;
  });

  // ── Level 0: multi-file intake → classify → confirm chip (plan 97 section 7.3) ─────
  // A dropped file is never filed silently. Each one is classified by the pure
  // heuristics in classify-logo.ts, proposes one of the eight slots, and waits as
  // a confirm chip; under LOGO_CONFIRM_MIN the chip leads with the slot menu
  // instead, because a guess is not a proposal. Every placement (chip or per-slot
  // tile) runs the shared trim offer first, and a placed colour SVG then offers
  // its generated mono / reverse siblings as further chips.

  /** Mirrors brand-logos.ts's own ACCEPT gate (not exported there): what enters
   *  the queue has to be something installLogo will actually take, so a chip
   *  never promises a placement that cannot happen. */
  const LOGO_ACCEPT_TYPES = /^image\/(png|jpeg|svg\+xml|webp)$/; bedit.LOGO_ACCEPT_TYPES = LOGO_ACCEPT_TYPES;
  /** The OTHER half of that gate, mirrored for the same reason: installLogo
   *  refuses anything over 4 MB, and a chip that led to that refusal would have
   *  cost a classification, a trim answer and a tap to say no. */
  const LOGO_MAX_BYTES = 4 * 1024 * 1024; bedit.LOGO_MAX_BYTES = LOGO_MAX_BYTES;
}

export function logosOps(bedit: BrandEditorCtx) {
  return {
    showLogoErr: bindOp(bedit, showLogoErr),
    identityLabel: bindOp(bedit, identityLabel),
    logoTile: bindOp(bedit, logoTile),
    paintLogos: bindOp(bedit, paintLogos),
    slugify: bindOp(bedit, slugify),
    takePrimaryFromLogo: bindOp(bedit, takePrimaryFromLogo),
    trayHandle: bindOp(bedit, trayHandle),
    trayColorsFromLogo: bindOp(bedit, trayColorsFromLogo),
    suggestFromLogo: bindOp(bedit, suggestFromLogo),
    isSvgLogoFile: bindOp(bedit, isSvgLogoFile),
    rasterLogoStats: bindOp(bedit, rasterLogoStats),
    classifyLogoFile: bindOp(bedit, classifyLogoFile),
    closeTrimOffer: bindOp(bedit, closeTrimOffer),
    trimBusy: bindOp(bedit, trimBusy),
    withTrimOffer: bindOp(bedit, withTrimOffer),
    installLogoFile: bindOp(bedit, installLogoFile),
    wireLogoSuggest: bindOp(bedit, wireLogoSuggest),
  };
}
