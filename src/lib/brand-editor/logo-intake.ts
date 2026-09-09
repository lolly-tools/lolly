// SPDX-License-Identifier: MPL-2.0
/**
 * brand editor: multi-file intake, candidate chips and placement.
 *
 * Every function takes the shared `bedit: BrandEditorCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `bedit.<module>.<fn>`. Extracted verbatim
 * from mountBrandEditor() by scripts/split-closure.ts.
 */
import { colorToHex, createTokenSet } from '@lolly/engine';
import { LOGO_ORIENTATIONS, LOGO_SLUG_RE, LOGO_TREATMENTS, removeLogo, splitVariant, variantLabel } from '../brand-logos.ts';
import type { LogoVariant } from '../brand-logos.ts';
import { hasPendingLogoFiles, takePendingLogoFiles } from '../design-system/pending-files.ts';
import { deriveMonoSvg, deriveReverseSvg, eligibleForDerivedVariants } from '../design-system/recolor-logo.ts';
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { announce } from '../../a11y.ts';
import { playSfx } from '../sfx.ts';
import type { LogoCandidateChip } from './shared.ts';
import { bindOp, type BrandEditorCtx } from './context.ts';

/** Focus something in the room right now, if it is still there. Used to hand
 *  the keyboard back the instant a card closes, ahead of whatever repaint the
 *  answer triggers (which re-anchors it through `intakeFocus`). */
export const refocus = (bedit: BrandEditorCtx, sel: string): void => {
  const { root } = bedit; root.querySelector<HTMLElement>(sel)?.focus(); };
/** The chip element itself. It carries `tabindex="-1"` for the one moment its
 *  own buttons cannot hold focus: while a placement is busy and they are
 *  disabled. */
export const chipSel = (_bedit: BrandEditorCtx, key: string): string => `[data-logo-chip="${key}"]`;
/** The chip's first control - Place on a confident chip, Change slot on an
 *  unsure one, the dismiss ✕ when it has neither. */
export const chipActionSel = (bedit: BrandEditorCtx, key: string): string => `${chipSel(bedit, key)} button`;
/**
 * Where the keyboard arrives when a chip leaves the queue: the chip that took its
 * place (or the one before it, when the tail went), and the drop zone that
 * started all this when nothing is left.
 */
export const focusAfterChip = (bedit: BrandEditorCtx, index: number): void => {
  const next = bedit.intake[index] ?? bedit.intake[index - 1];
  bedit.intakeEmptyFocus = !next;
  bedit.intakeFocus = next ? chipActionSel(bedit, next.key) : null;
};
/** Returns the index the candidate held, so the caller can say where the
 *  keyboard goes next (-1 when there was no such chip). */
export const dropCandidate = (bedit: BrandEditorCtx, key: string): number => {
  const i = bedit.intake.findIndex(c => c.key === key);
  if (i < 0) return -1;
  URL.revokeObjectURL(bedit.intake[i]!.url);
  bedit.intake.splice(i, 1);
  return i;
};
export const slotMenuHtml = (bedit: BrandEditorCtx, c: LogoCandidateChip): string =>
  `<div class="be-logo-chip-menu" data-logo-menu-for="${escapeText(c.key)}" role="group" aria-label="${escapeText(t('Choose a slot'))}">
        ${LOGO_ORIENTATIONS.flatMap(o => LOGO_TREATMENTS.map(tr => {
      const v = `${o}-${tr}` as LogoVariant;
      return `<button type="button" class="be-btn be-btn--sm be-logo-chip-slot${v === c.variant ? ' is-suggested' : ''}" data-logo-place="${escapeText(c.key)}" data-variant="${escapeText(v)}">
            <span>${escapeText(variantLabel(v))}</span>${bedit.filledDefaultSlots.has(v) ? `<span class="be-logo-chip-taken">${t('in use')}</span>` : ''}
          </button>`;
    })).join('')}
      </div>`;
export const candidateChipHtml = (bedit: BrandEditorCtx, c: LogoCandidateChip): string => {
  const { LOGO_CONFIRM_MIN } = bedit;
  const label = variantLabel(c.variant);
  const sure = c.generated || c.confidence >= LOGO_CONFIRM_MIN;
  const lead = c.generated
    ? tRaw('Generated {variant}', { variant: label })
    : sure ? tRaw('Looks like the {variant}', { variant: label }) : t('Not sure which slot this is');
  // The classifier's own reason fragments, verbatim - they say what was measured.
  const why = c.reasons.filter(Boolean).join(', ');
  const act = c.generated ? t('Add') : bedit.filledDefaultSlots.has(c.variant) ? t('Replace') : t('Place');
  return `<div class="be-logo-chip" data-logo-chip="${escapeText(c.key)}" tabindex="-1"${c.generated ? ' data-generated="1"' : ''}>
        <span class="be-logo-chip-art"><img src="${escapeText(c.url)}" alt="" loading="lazy"></span>
        <div class="be-logo-chip-body">
          <p class="be-logo-chip-lead">${escapeText(lead)}${c.generated ? `<span class="be-logo-chip-tag">${t('Generated')}</span>` : ''}</p>
          <p class="be-logo-chip-why" title="${escapeText(why)}">${escapeText(c.file.name)}${why ? ` · ${escapeText(why)}` : ''}</p>
        </div>
        <div class="be-logo-chip-acts">
          ${sure ? `<button type="button" class="be-cta be-btn--sm" data-logo-place="${escapeText(c.key)}" data-variant="${escapeText(c.variant)}"${c.busy ? ' disabled' : ''}>${escapeText(act)}</button>` : ''}
          ${c.generated ? '' : `<button type="button" class="be-btn be-btn--sm" data-logo-menu="${escapeText(c.key)}" aria-expanded="${c.menuOpen ? 'true' : 'false'}"${c.busy ? ' disabled' : ''}>${t('Change slot')}</button>`}
          <button type="button" class="be-logo-chip-x" data-logo-dismiss="${escapeText(c.key)}" aria-label="${escapeText(tRaw('Dismiss {name}', { name: c.file.name }))}">&#x2715;</button>
        </div>
        ${c.menuOpen && !c.generated ? slotMenuHtml(bedit, c) : ''}
      </div>`;
};
export const addLogoFiles = async (bedit: BrandEditorCtx, files: File[]): Promise<void> => {
  const { LOGO_ACCEPT_TYPES, LOGO_CONFIRM_MIN, LOGO_INTAKE_MAX, LOGO_MAX_BYTES, root } = bedit;
  if (!files.length) return;
  bedit.logos.showLogoErr('');
  const typed = files.filter(f => LOGO_ACCEPT_TYPES.test(f.type));
  if (typed.length < files.length) bedit.logos.showLogoErr(t('Use a PNG, JPEG, SVG or WebP image.'));
  const usable = typed.filter(f => f.size <= LOGO_MAX_BYTES);
  const tooBig = typed.find(f => f.size > LOGO_MAX_BYTES);
  // The same sentence installLogo throws, said before the classify/trim/tap
  // rather than after all three.
  if (tooBig) bedit.logos.showLogoErr(tRaw('That logo is {size} MB - the limit is 4 MB.', { size: (tooBig.size / 1024 / 1024).toFixed(1) }));
  const room = Math.max(0, LOGO_INTAKE_MAX - bedit.intake.length);
  if (usable.length > room) bedit.logos.showLogoErr(t('Place or dismiss the marks already waiting, then drop the rest.'));
  for (const file of usable.slice(0, room)) {
    const judged = await bedit.logos.classifyLogoFile(file);
    if (!root.isConnected) return;
    bedit.intake.push({
      key: `belg${++bedit.intakeSeq}`,
      file,
      variant: judged ? `${judged.orientation}-${judged.treatment}` : 'horizontal-primary',
      confidence: judged ? judged.confidence : 0,
      reasons: judged ? judged.reasons : [t('this file could not be read')],
      url: URL.createObjectURL(file),
      menuOpen: !judged || judged.confidence < LOGO_CONFIRM_MIN,
      busy: false,
      generated: false,
    });
    bedit.renderIntake(); // chips appear as each file is judged, not in one late batch
  }
};
/** The ink a generated mono mark is painted in: the design system's own text
 *  colour, read from the LIGHT theme deliberately - a mono mark is the one that
 *  has to read on paper, and a dark theme's text is nearly white, which would
 *  generate an invisible mark. */
export const monoInk = (bedit: BrandEditorCtx): string => {
  const { MONO_INK_FALLBACK } = bedit;
  try {
    return colorToHex(createTokenSet(bedit.doc, { theme: 'light' }).resolve('color.semantic.text')) ?? MONO_INK_FALLBACK;
  } catch { return MONO_INK_FALLBACK; }
};
export const derivedName = (_bedit: BrandEditorCtx, name: string, suffix: string): string =>
  `${name.replace(/\.[a-z0-9]+$/i, '') || 'logo'}-${suffix}.svg`;
/**
 * A colour SVG placed in a primary slot can father its own siblings: a
 * single-ink mono and a light-for-dark reverse (recolor-logo.ts, pure). They
 * arrive as chips marked Generated and are placed only on a tap, and only into
 * an EMPTY sibling - a generated mark never displaces one the user chose. A
 * mark the recolour cannot honestly derive from (a gradient, a pattern) gets no
 * chip at all, never a disabled one.
 */
export const offerDerivedVariants = async (bedit: BrandEditorCtx, file: File, variant: string, identity: string): Promise<void> => {
  if (identity !== 'default' || !bedit.logos.isSvgLogoFile(file)) return;
  const { orientation, treatment } = splitVariant(variant);
  if (!orientation || treatment !== 'primary') return;
  let text = '';
  try { text = await file.text(); } catch { return; }
  const eligible = eligibleForDerivedVariants(text);
  if (!eligible.mono && !eligible.reverse) return;
  const wanted: Array<{ slot: string; suffix: string; svg: string | null; why: string }> = [];
  if (eligible.mono) {
    wanted.push({
      slot: `${orientation}-mono`, suffix: 'mono', svg: deriveMonoSvg(text, monoInk(bedit)),
      why: t('one ink, recoloured from the colour mark'),
    });
  }
  if (eligible.reverse) {
    wanted.push({
      slot: `${orientation}-primary-reverse`, suffix: 'reverse', svg: deriveReverseSvg(text),
      why: t('dark ink turned white, so it reads on a dark background'),
    });
  }
  let offered = false;
  for (const w of wanted) {
    if (!w.svg || bedit.filledDefaultSlots.has(w.slot)) continue;
    if (bedit.intake.some(c => c.generated && c.variant === w.slot)) continue;
    const made = new File([w.svg], derivedName(bedit, file.name, w.suffix), { type: 'image/svg+xml' });
    bedit.intake.push({
      key: `belg${++bedit.intakeSeq}`, file: made, variant: w.slot, confidence: 1,
      reasons: [w.why], url: URL.createObjectURL(made), menuOpen: false, busy: false, generated: true,
    });
    offered = true;
  }
  if (offered) { bedit.renderIntake(); announce(t('Generated marks are offered for the empty slots.')); }
};
export const placeCandidate = async (bedit: BrandEditorCtx, key: string, variant: string): Promise<void> => {
  const { root } = bedit;
  const c = bedit.intake.find(x => x.key === key);
  if (!c || c.busy || !LOGO_SLUG_RE.test(variant)) return;
  if (bedit.logos.trimBusy()) { bedit.logos.showLogoErr(t('Answer the trim card above first.')); return; }
  // A generated mark is an offer for an EMPTY slot and never displaces one the
  // user chose (offerDerivedVariants states the rule; this is where it is kept).
  // The slot can fill between the chip appearing and the tap, so the check
  // belongs at the moment of the act, not only at offer time.
  if (c.generated && bedit.filledDefaultSlots.has(variant)) {
    const i = dropCandidate(bedit, key);
    focusAfterChip(bedit, i);
    bedit.renderIntake();
    bedit.logos.showLogoErr(t('That slot holds a mark you added, so the generated one was dropped.'));
    return;
  }
  c.busy = true; c.variant = variant;
  // The button the user just pressed is about to be re-rendered as a disabled
  // one, so the chip itself holds the keyboard until the placement settles.
  bedit.intakeFocus = chipSel(bedit, key);
  bedit.renderIntake();
  bedit.logos.showLogoErr('');
  try {
    // A generated mark is derived from bytes the user already resolved, so it
    // is not offered a second trim.
    const file = c.generated ? c.file : await bedit.logos.withTrimOffer(c.file, () => refocus(bedit, chipSel(bedit, key)));
    if (!root.isConnected) return;
    if (!file) {
      // Backed out of the trim card: the chip stays exactly as it was, with the
      // keyboard back on its action.
      c.busy = false;
      bedit.intakeFocus = chipActionSel(bedit, key);
      bedit.renderIntake();
      return;
    }
    await bedit.logos.installLogoFile(variant, 'default', file);
    playSfx('saveProfile');
    const i = dropCandidate(bedit, key);
    focusAfterChip(bedit, i);
    bedit.renderIntake();     // the chip goes now, whatever the matrix repaint does
    focusAfterChip(bedit, i);  // …and the matrix repaint re-renders the queue under it
    await bedit.logos.paintLogos(); // repaints the matrix, and the queue's labels with it
    bedit.state.notify('logos');
    announce(tRaw('{variant} logo added', { variant: variantLabel(variant) }));
    if (!c.generated) {
      void bedit.logos.suggestFromLogo(file);
      void offerDerivedVariants(bedit, file, variant, 'default');
    }
  } catch (err) {
    c.busy = false;
    bedit.intakeFocus = chipActionSel(bedit, key);
    bedit.renderIntake();
    bedit.logos.showLogoErr(String((err as { message?: unknown })?.message ?? err));
  }
};
export function defineRenderIntake(bedit: BrandEditorCtx): void {
  const { queueEl, root } = bedit;
  bedit.renderIntake = (): void => {
    if (!queueEl) return;
    // A generated chip whose slot has SINCE been filled has nothing left to
    // offer: it was only ever an offer for an empty sibling (see
    // offerDerivedVariants), and a chip that lingered would keep an action that
    // displaces the mark the user just chose. Pruned here rather than at offer
    // time alone, because the slot can fill after the chip appears.
    for (const c of bedit.intake.filter(x => x.generated && !x.busy && bedit.filledDefaultSlots.has(x.variant))) {
      bedit.logoIntake.dropCandidate(c.key);
    }
    if (!bedit.intake.length) {
      queueEl.innerHTML = '';
      queueEl.hidden = true;
      bedit.intakeFocus = null;
      // The last chip went and took the keyboard with it: hand it to the drop
      // zone, which is where the queue came from and where the next file starts.
      if (bedit.intakeEmptyFocus) {
        bedit.intakeEmptyFocus = false;
        root.querySelector<HTMLElement>('[data-be-logo-multi]')?.focus();
      }
      return;
    }
    queueEl.hidden = false;
    // Chips remain, so the "hand it back to the drop zone" answer no longer
    // applies: drop it rather than letting it fire at some later empty render.
    bedit.intakeEmptyFocus = false;
    queueEl.innerHTML = `<p class="be-logo-queue-head">${t('Waiting for a slot')}</p>`
      + bedit.intake.map(bedit.logoIntake.candidateChipHtml).join('');
    if (bedit.intakeFocus) {
      queueEl.querySelector<HTMLElement>(bedit.intakeFocus)?.focus();
      bedit.intakeFocus = null;
    }
  };
}

export function seedIntakeQueue(bedit: BrandEditorCtx): void {
  const { root } = bedit;
  /**
   * Marks sent over from another view (plan 97 section 8, M5 - the PDF exploder's
   * "Send to the Design System studio"). They go through addLogoFiles, the very
   * same door a multi-file drop uses: classified, chipped, and waiting for a tap.
   * A mark lifted off page 3 of a guidelines PDF is exactly as much of a guess as
   * one dropped by hand, so it is never placed into a slot on arrival.
   *
   * Drained once. `takePendingLogoFiles()` empties the stash, so a second call
   * would find nothing anyway - the latch says so at the call site rather than
   * leaving the guarantee to a module the paint cannot see.
   */
  bedit.pendingLogosDrained = false;
  bedit.drainPendingLogos = (): void => {
    if (bedit.pendingLogosDrained || !hasPendingLogoFiles()) return;
    bedit.pendingLogosDrained = true;
    const arrived = takePendingLogoFiles();
    void bedit.logoIntake.addLogoFiles(arrived).then(() => {
      if (!root.isConnected) return;
      // What actually reached the queue, not what was handed over: the type,
      // size and room gates above can turn some of it away, and they say so
      // themselves in the error line. Counting the chips keeps this sentence
      // from claiming marks the room refused.
      const n = bedit.intake.filter(c => arrived.includes(c.file)).length;
      if (!n) return;
      announce(tRaw(n === 1 ? '{n} mark arrived from the PDF' : '{n} marks arrived from the PDF', { n }));
    });
  };
}

export function wireIntakeZone(bedit: BrandEditorCtx): void {
  const { LOGO_CONFIRM_MIN, fontsHost, pendingIdentities, queueEl, root } = bedit;
  const intakeZone = bedit.ramps.$('[data-be-logo-intake]') as HTMLElement | null; bedit.intakeZone = intakeZone as BrandEditorCtx['intakeZone'];
  if (intakeZone) {
    intakeZone.addEventListener('change', (e) => {
      const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-logo-multi]');
      if (!input) return;
      const picked = [...(input.files ?? [])];
      input.value = '';
      void bedit.logoIntake.addLogoFiles(picked);
    });
    const over = (e: DragEvent): void => { e.preventDefault(); intakeZone.classList.add('is-over'); };
    intakeZone.addEventListener('dragenter', over);
    intakeZone.addEventListener('dragover', over);
    intakeZone.addEventListener('dragleave', (e) => {
      // Crossing into a child fires dragleave on the parent; only a real exit counts.
      const to = e.relatedTarget as Node | null;
      if (to && intakeZone.contains(to)) return;
      intakeZone.classList.remove('is-over');
    });
    intakeZone.addEventListener('drop', (e) => {
      // preventDefault also stops the wrapped file input claiming the drop itself,
      // so the files are read here exactly once; stopPropagation keeps a
      // view-level drop router (drop-router.ts, attached per view) from ALSO
      // opening the front-door chooser over a drop that named its destination.
      e.preventDefault();
      e.stopPropagation();
      intakeZone.classList.remove('is-over');
      void bedit.logoIntake.addLogoFiles([...(e.dataTransfer?.files ?? [])]);
    });
  }

  queueEl?.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const place = el.closest<HTMLElement>('[data-logo-place]');
    if (place) { void bedit.logoIntake.placeCandidate(place.dataset.logoPlace ?? '', place.dataset.variant ?? ''); return; }
    const menu = el.closest<HTMLElement>('[data-logo-menu]');
    if (menu) {
      const c = bedit.intake.find(x => x.key === menu.dataset.logoMenu);
      if (!c) return;
      c.menuOpen = !c.menuOpen;
      bedit.intakeFocus = c.menuOpen
        ? `[data-logo-menu-for="${c.key}"] .be-logo-chip-slot`
        : `[data-logo-menu="${c.key}"]`;
      bedit.renderIntake();
      return;
    }
    const dismiss = el.closest<HTMLElement>('[data-logo-dismiss]');
    if (dismiss) {
      // The ✕ the user pressed is about to be removed with its chip, so say where
      // the keyboard goes before the queue re-renders.
      bedit.logoIntake.focusAfterChip(bedit.logoIntake.dropCandidate(dismiss.dataset.logoDismiss ?? ''));
      bedit.renderIntake();
    }
  });
  queueEl?.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-logo-chip]');
    const c = chip ? bedit.intake.find(x => x.key === chip.dataset.logoChip) : null;
    // Only a menu the user OPENED closes: on a low-confidence chip the menu IS
    // the chip's body, and closing it would leave nothing to act on.
    if (!c?.menuOpen || c.confidence < LOGO_CONFIRM_MIN) return;
    e.stopPropagation();
    c.menuOpen = false;
    bedit.intakeFocus = `[data-logo-menu="${c.key}"]`;
    bedit.renderIntake();
  });

  bedit.ramps.$('[data-be-logos]')?.addEventListener('change', async (e) => {
    const target = e.target as HTMLElement;
    // A custom-mark file pick: needs the name typed beside it.
    const addFile = target.closest<HTMLInputElement>('[data-addmark-file]');
    if (addFile) {
      const form = addFile.closest<HTMLElement>('[data-logo-addmark]');
      const nameInput = form?.querySelector<HTMLInputElement>('[data-addmark-name]');
      const identity = form?.dataset.identity || 'default';
      const label = nameInput?.value.trim() ?? '';
      const slug = bedit.logos.slugify(label);
      const file = addFile.files?.[0]; addFile.value = '';
      if (!file) return;
      bedit.logos.showLogoErr('');
      if (!slug || !LOGO_SLUG_RE.test(slug)) { bedit.logos.showLogoErr(t('Name the mark first - letters and numbers, e.g. "Icon".')); nameInput?.focus(); return; }
      if (bedit.logos.trimBusy()) { bedit.logos.showLogoErr(t('Answer the trim card above first.')); return; }
      // The picker that started this is inside the form, which paintLogos
      // rebuilds; the keyboard goes back to the same control on the fresh markup.
      const addmarkSel = `[data-logo-addmark][data-identity="${identity}"] [data-addmark-name]`;
      try {
        const picked = await bedit.logos.withTrimOffer(file, () => bedit.logoIntake.refocus(addmarkSel));
        if (!root.isConnected) return;
        if (!picked) return;   // backed out of the trim card: nothing is installed
        // installLogoFile, not installLogo: the unnamed identity has to be
        // OMITTED, and the literal 'default' this path used to pass is refused
        // outright ("default is reserved") - so no custom mark could be added to
        // the first logo at all.
        await bedit.logos.installLogoFile(slug, identity, picked, label);
        playSfx('saveProfile'); await bedit.logos.paintLogos(); bedit.state.notify('logos');
        bedit.logoIntake.refocus(addmarkSel);
        void bedit.logos.suggestFromLogo(picked);
        announce(tRaw('{label} mark added', { label }));
      } catch (err) { bedit.logos.showLogoErr(String((err as { message?: unknown })?.message ?? err)); }
      return;
    }
    const input = target.closest<HTMLInputElement>('[data-logo-file]'); if (!input) return;
    const variant = input.dataset.logoFile!;
    const identity = input.dataset.identity || 'default';
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    bedit.logos.showLogoErr('');
    if (bedit.logos.trimBusy()) { bedit.logos.showLogoErr(t('Answer the trim card above first.')); return; }
    // paintLogos rebuilds the whole matrix, so the keyboard is handed back to the
    // same tile's file input on the fresh markup rather than left on <body>.
    const tileSel = `[data-logo-file="${variant}"][data-identity="${identity}"]`;
    try {
      // The same trim offer the intake chips get - the affordance belongs to
      // "a user file becomes an asset", not to one control (plan 97 section 7.3).
      const picked = await bedit.logos.withTrimOffer(file, () => bedit.logoIntake.refocus(tileSel));
      if (!root.isConnected) return;
      if (!picked) return;   // backed out of the trim card: nothing is installed
      await bedit.logos.installLogoFile(variant, identity, picked);
      playSfx('saveProfile'); await bedit.logos.paintLogos(); bedit.state.notify('logos');
      bedit.logoIntake.refocus(tileSel);
      void bedit.logos.suggestFromLogo(picked);
      void bedit.logoIntake.offerDerivedVariants(picked, variant, identity);
      announce(tRaw('{variant} logo added', { variant: variantLabel(variant) }));
    } catch (err) { bedit.logos.showLogoErr(String((err as { message?: unknown })?.message ?? err)); }
  });
  bedit.ramps.$('[data-be-logos]')?.addEventListener('submit', (e) => {
    // The custom-mark form has no submit button (its "action" is the file
    // picker), but Enter in its name field still implicitly submits - swallow
    // that and forward the intent to the picker instead of reloading the page.
    const addmark = (e.target as HTMLElement).closest<HTMLElement>('[data-logo-addmark]');
    if (addmark) {
      e.preventDefault();
      addmark.querySelector<HTMLInputElement>('[data-addmark-file]')?.click();
      return;
    }
    const form = (e.target as HTMLElement).closest<HTMLElement>('[data-logo-addidentity]');
    if (!form) return;
    e.preventDefault();
    const nameInput = form.querySelector<HTMLInputElement>('[data-addidentity-name]');
    const slug = bedit.logos.slugify(nameInput?.value ?? '');
    bedit.logos.showLogoErr('');
    if (!slug || !LOGO_SLUG_RE.test(slug)) { bedit.logos.showLogoErr(t('Name the logo first - letters and numbers, e.g. "Product".')); nameInput?.focus(); return; }
    if (slug === 'default') { bedit.logos.showLogoErr(t('“Default” is the unnamed logo above - pick a different name.')); nameInput?.focus(); return; }
    if (!pendingIdentities.includes(slug)) pendingIdentities.push(slug);
    void bedit.logos.paintLogos().then(() => {
      // Land the user in the fresh section rather than leaving them at the form.
      root.querySelector(`[data-be-logos] .be-logo-identity[data-identity="${slug}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
  bedit.ramps.$('[data-be-logos]')?.addEventListener('click', async (e) => {
    const del = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-logo-del]'); if (!del) return;
    e.preventDefault();
    const variant = del.dataset.logoDel!;
    const identity = del.dataset.identity || 'default';
    const ok = await confirmDialog({ title: tRaw('Remove the {variant} mark?', { variant: variantLabel(variant).toLowerCase() }), message: t('It’s deleted from this device.'), confirmLabel: t('Remove') });
    if (!ok) return; del.disabled = true;
    try {
      await removeLogo(fontsHost, variant, identity === 'default' ? undefined : identity);
      await bedit.logos.paintLogos(); bedit.state.notify('logos');
    } catch (err) { del.disabled = false; bedit.logos.showLogoErr(String((err as { message?: unknown })?.message ?? err)); }
  });

  // ── Palette download ─────────────────────────────────────────────────────
  const palErr = bedit.ramps.$('[data-be-pal-err]') as HTMLElement | null; bedit.palErr = palErr;
  const palFmtSel = bedit.ramps.$('[data-be-pal-fmt]') as HTMLSelectElement | null; bedit.palFmtSel = palFmtSel;
}

export function logoIntakeOps(bedit: BrandEditorCtx) {
  return {
    refocus: bindOp(bedit, refocus),
    chipSel: bindOp(bedit, chipSel),
    chipActionSel: bindOp(bedit, chipActionSel),
    focusAfterChip: bindOp(bedit, focusAfterChip),
    dropCandidate: bindOp(bedit, dropCandidate),
    slotMenuHtml: bindOp(bedit, slotMenuHtml),
    candidateChipHtml: bindOp(bedit, candidateChipHtml),
    addLogoFiles: bindOp(bedit, addLogoFiles),
    monoInk: bindOp(bedit, monoInk),
    derivedName: bindOp(bedit, derivedName),
    offerDerivedVariants: bindOp(bedit, offerDerivedVariants),
    placeCandidate: bindOp(bedit, placeCandidate),
    defineRenderIntake: bindOp(bedit, defineRenderIntake),
    seedIntakeQueue: bindOp(bedit, seedIntakeQueue),
    wireIntakeZone: bindOp(bedit, wireIntakeZone),
  };
}
