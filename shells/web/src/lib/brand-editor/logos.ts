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
import { logoOfferFromRaster, logoOfferFromSvg, logoTextFor } from '../design-system/logo-roles.ts';
import type { LogoRoleOffer } from '../design-system/logo-roles.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { prefersReducedMotion } from '../a11y-prefs.ts';
import { playSfx } from '../sfx.ts';
import { assignRole } from '../design-system/roles.ts';
import { logoGroupHtml } from './shared.ts';
import type { LogoOfferState, RasterLogoStats } from './shared.ts';
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
  // 4.2). The whole tile is the file input's label and its drop target:
  // data-file-drop marks it, and logo-intake.ts wires the drop through
  // lib/file-drop-tile.ts to the same placement a picked file takes.
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
        <label class="be-logo-drop" data-file-drop data-drop-label="${escapeText(slot ? t('Drop to replace') : t('Drop to add'))}">
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
      hint: t('Marks the design system calls by its own name - an icon, a crest, a favicon.'),
      cls: ' be-logo-group--custom',
      filled: customs.length > 0,
      body: `${customTiles}
            <form class="be-logo-addmark" data-logo-addmark data-identity="${escapeText(identity)}" data-file-drop data-drop-label="${escapeText(t('Drop to add'))}">
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
/**
 * Read a placed mark's colours and put its card up (plan 320 S1). The card asks
 * which colour is the main one, with the likeliest answer selected; on a
 * first-ever install, with nothing of the person's to overwrite, the answer is
 * applied at once and the card says what changed. Either way the person sees
 * the question where they placed the logo and again at the top of Colours.
 */
export const suggestFromLogo = async (bedit: BrandEditorCtx, file: File): Promise<void> => {
  if (file.size > 10 * 1024 * 1024) return;
  let offer: LogoRoleOffer | null = null;
  try {
    if (isSvgLogoFile(bedit, file)) {
      const colors = extractSvgColors(await file.text()).map(c => colorToHex(c) ?? '').filter(c => /^#/.test(c));
      offer = logoOfferFromSvg(colors, file.name);
    } else {
      const stats = await rasterLogoStats(bedit, file);
      offer = stats ? logoOfferFromRaster(stats.colors, file.name) : null;
    }
  } catch { return; }
  if (!offer || !bedit.root.isConnected) return;
  bedit.logoOffer = { label: file.name, offer, main: offer.main, applied: false, undoEntry: null };
  if (!bedit.isUserBrand) {
    applyLogoOffer(bedit);
    // ONCE, though. The apply just wrote swatches, pointed the roles at them and
    // persisted, so from here on there IS something of the person's: the second
    // file of a multi-file drop must ask rather than apply (plan 97 section 7.3
    // keeps exactly one automatic choice, on a first-ever install). Without this
    // line the last file dropped would silently win.
    bedit.isUserBrand = true;
  }
  paintLogoOffer(bedit);
};
/** The swatch for a logo colour: one already in the palette with that exact
 *  colour, else a new custom swatch named for the colour. */
const swatchKeyFor = (bedit: BrandEditorCtx, hex: string): string | undefined => {
  const ctx = bedit.state.editContext();
  const same = walkSwatches(bedit.doc, ctx).find(s => s.kind !== 'semantic' && !s.isAlias && s.hex.toUpperCase() === hex);
  if (same) return same.key;
  const path = addSwatch(bedit.doc, 'custom', nameColor(hex), serializeColor(hex, 'lch'));
  // walkSwatches owns the path to key mapping (it strips the set prefix), so the
  // key is read back off the swatch rather than derived here.
  return path ? walkSwatches(bedit.doc, ctx).find(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]))?.key : undefined;
};
/**
 * Put the logo's colours in the palette and point the roles at them. The main
 * colour becomes the primary UNSCOPED (no context): a mark's colour is the
 * brand's primary in both themes, and with colourways that is the canonical
 * lead, which the logo belongs to (plans/319). The text colour, when the file
 * has one, is the light theme's text only, because a logo on paper says
 * nothing about the dark theme.
 */
const setLogoRoles = (bedit: BrandEditorCtx, state: LogoOfferState): void => {
  const keys = new Map(state.offer.colours.map(hex => [hex, swatchKeyFor(bedit, hex)]));
  const mainKey = keys.get(state.main);
  if (mainKey) assignRole(bedit.doc, 'primary', mainKey);
  const text = logoTextFor(state.offer, state.main);
  const textKey = text ? keys.get(text) : undefined;
  if (textKey) assignRole(bedit.doc, 'text', textKey, 'light');
  bedit.state.setPrimaryTo(state.main); // the Generate wing's picker follows the new primary
  bedit.ramps.repaintPalette();
  bedit.state.persist(true);
};
export const applyLogoOffer = (bedit: BrandEditorCtx): void => {
  const state = bedit.logoOffer;
  if (!state || state.applied) return;
  bedit.state.pushUndo(t('Colours from the logo'));
  state.undoEntry = bedit.undoStack.at(-1) ?? null;
  setLogoRoles(bedit, state);
  state.applied = true;
  bedit.state.notify('color');
  announce(tRaw('Tools now use {name}.', { name: nameColor(state.main) }));
};
/** True while the apply is still the latest edit, so rewinding it touches nothing else. */
const applyIsLatest = (bedit: BrandEditorCtx, state: LogoOfferState): boolean =>
  !!state.undoEntry && bedit.undoStack.at(-1) === state.undoEntry;
/**
 * A different main colour. Before the apply this only moves the selection. After
 * it, the apply is redone from the same starting point when nothing else has
 * changed since, so the text colour follows too; otherwise only the primary
 * moves, as its own undo step.
 */
export const chooseLogoMain = (bedit: BrandEditorCtx, hex: string): void => {
  const state = bedit.logoOffer;
  if (!state?.offer.colours.includes(hex) || hex === state.main) return;
  state.main = hex;
  if (state.applied) {
    if (applyIsLatest(bedit, state)) {
      bedit.doc = structuredClone(state.undoEntry!.doc);
      bedit.derive.reseedFromDoc();
    } else {
      bedit.state.pushUndo(t('Main colour'));
    }
    setLogoRoles(bedit, state);
    announce(tRaw('Tools now use {name}.', { name: nameColor(hex) }));
  }
  paintLogoOffer(bedit);
};
export const undoLogoOffer = (bedit: BrandEditorCtx): void => {
  const state = bedit.logoOffer;
  if (!state?.applied || !applyIsLatest(bedit, state)) return;
  bedit.replace.undoLast();
  state.applied = false;
  state.undoEntry = null;
  paintLogoOffer(bedit);
};
/** Not now: the colours wait in the tray instead, as they always could. */
export const deferLogoOffer = (bedit: BrandEditorCtx): void => {
  const state = bedit.logoOffer;
  if (!state) return;
  bedit.logoOffer = null;
  if (!state.applied) void trayColorsFromLogo(bedit, state.offer.colours, state.label);
  paintLogoOffer(bedit);
};
const logoOfferHtml = (bedit: BrandEditorCtx, state: LogoOfferState, where: string): string => {
  const text = logoTextFor(state.offer, state.main);
  const choices = state.offer.colours.map(hex => `
      <label class="be-logo-colours-choice">
        <input type="radio" name="be-logo-main-${escapeText(where)}" value="${hex}" data-logo-colours-main${hex === state.main ? ' checked' : ''}>
        <span class="be-logo-colours-sw" style="--sw:${hex}" aria-hidden="true"></span>
        <span class="be-logo-colours-name">${escapeText(nameColor(hex))}</span>
      </label>`).join('');
  const actions = state.applied
    ? `${applyIsLatest(bedit, state) ? `<button type="button" class="be-btn" data-logo-colours-act="undo">${t('Undo')}</button>` : ''}
       <button type="button" class="be-btn" data-logo-colours-act="close">${t('Done')}</button>`
    : `<button type="button" class="be-cta is-active" data-logo-colours-act="use">${t('Use these colours')}</button>
       <button type="button" class="be-btn" data-logo-colours-act="later">${t('Not now')}</button>`;
  return `
    <h3 class="be-logo-colours-title">${escapeText(tRaw('Colours from {file}', { file: state.label }))}</h3>
    <fieldset class="be-logo-colours-pick">
      <legend>${t('Which is the main colour?')}</legend>
      <div class="be-logo-colours-choices">${choices}</div>
    </fieldset>
    ${state.applied
      ? `<p class="be-logo-colours-note" role="status">${escapeText(tRaw('Tools now use {name}.', { name: nameColor(state.main) }))}${text ? ` ${escapeText(tRaw('Text uses {name}.', { name: nameColor(text) }))}` : ''}</p>`
      : `<p class="be-logo-colours-note">${escapeText(text ? tRaw('Tools will use the main colour, and {name} for text.', { name: nameColor(text) }) : t('Tools will use the main colour.'))}</p>`}
    <div class="be-logo-colours-actions">${actions}</div>`;
};
/** Paint the card in every room that has a place for it, keeping the keyboard
 *  on the same control in the room it was in. */
export const paintLogoOffer = (bedit: BrandEditorCtx): void => {
  const state = bedit.logoOffer;
  const active = document.activeElement as HTMLElement | null;
  const from = active?.closest<HTMLElement>('[data-be-logo-colours]');
  const refocus = from ? (active!.dataset.logoColoursAct ? `[data-logo-colours-act="${active!.dataset.logoColoursAct}"]` : active!.matches('[data-logo-colours-main]') ? '[data-logo-colours-main]:checked' : '') : '';
  for (const mount of bedit.root.querySelectorAll<HTMLElement>('[data-be-logo-colours]')) {
    mount.hidden = !state;
    mount.innerHTML = state ? logoOfferHtml(bedit, state, mount.dataset.beLogoColours || 'room') : '';
  }
  if (!from) return;
  const target = (refocus ? from.querySelector<HTMLElement>(refocus) : null)
    ?? from.querySelector<HTMLElement>('[data-logo-colours-main]:checked')
    ?? from.closest<HTMLElement>('[data-be-tab-panel]')?.querySelector<HTMLElement>('[data-be-logo-multi], [data-be-pal] button');
  target?.focus();
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
  // Each bucket keeps the sum of the real channels that fell in it, so a colour
  // reported back is the mean of its pixels rather than the bucket's corner: the
  // logo colours card puts these colours in the palette (plan 320 S1).
  const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
  let sampled = 0;
  let clear = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      sampled++;
      if (data[i + 3]! <= CLASSIFY_ALPHA_MIN) { clear++; continue; }
      const key = `#${q(data[i]!)}${q(data[i + 1]!)}${q(data[i + 2]!)}`;
      const bucket = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n++; bucket.r += data[i]!; bucket.g += data[i + 1]!; bucket.b += data[i + 2]!;
      counts.set(key, bucket);
    }
  }
  // Orientation reads CONTENT bounds, never the canvas: a mark centred in a
  // padded export is the same shape whatever the padding.
  const box = rasterAlphaBounds(data, width, height, { alphaMin: CLASSIFY_ALPHA_MIN });
  return {
    width: box?.width || width,
    height: box?.height || height,
    colors: [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 16).map(c => ({
      hex: `#${[c.r, c.g, c.b].map(v => Math.round(v / c.n).toString(16).padStart(2, '0')).join('')}`,
      weight: c.n,
    })),
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
  // The logo colours card, in both rooms (plan 320 S1).
  bedit.root.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-be-logo-colours] [data-logo-colours-act]')?.dataset.logoColoursAct;
    if (!act) return;
    playSfx('click');
    if (act === 'use') { bedit.logos.applyLogoOffer(); bedit.logos.paintLogoOffer(); }
    else if (act === 'undo') bedit.logos.undoLogoOffer();
    else bedit.logos.deferLogoOffer();
  });
  bedit.root.addEventListener('change', (e) => {
    const radio = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-logo-colours] [data-logo-colours-main]');
    if (radio?.checked) bedit.logos.chooseLogoMain(radio.value);
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
    trayHandle: bindOp(bedit, trayHandle),
    trayColorsFromLogo: bindOp(bedit, trayColorsFromLogo),
    suggestFromLogo: bindOp(bedit, suggestFromLogo),
    applyLogoOffer: bindOp(bedit, applyLogoOffer),
    chooseLogoMain: bindOp(bedit, chooseLogoMain),
    undoLogoOffer: bindOp(bedit, undoLogoOffer),
    deferLogoOffer: bindOp(bedit, deferLogoOffer),
    paintLogoOffer: bindOp(bedit, paintLogoOffer),
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
