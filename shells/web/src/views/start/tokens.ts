// SPDX-License-Identifier: MPL-2.0
/**
 * start: tokens.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { deriveBrandTokens, extractPenpotProject, extractSvgColors, scanPenpotAppliedTokens, scanPenpotUsage, summarizeTokensDoc } from '@lolly/engine';
import { announce } from '../../a11y.ts';
import { applyChromeBrandVars } from '../../brand-vars.ts';
import { bustFontRegistry } from '../../bridge/font-registry.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import { markWelcomeDismissed } from '../../components/welcome-dialog.ts';
import { t, tRaw } from '../../i18n.ts';
import { addSwatch } from '../../lib/brand-doc.ts';
import { buildBrandDocFromUsage, proposeBrandRoles, proposeFonts, proposeFontsFromTokens, proposeRolesFromTokens, withRoleAliases } from '../../lib/brand-propose.ts';
import { censusFromSvgColors } from '../../lib/design-system/census.ts';
import { applyMappingChoice, censusFromTokensDoc, chooserRows, colorTokenRows, designFileLimit, docNeedsMappingReview, followRoles, routeDesignFile } from '../../lib/design-system/sources/file.ts';
import type { DesignFileRoute, RoleFollow } from '../../lib/design-system/sources/file.ts';
import { openLollyFile } from '../../lib/drop-router.ts';
import { playSfx } from '../../lib/sfx.ts';
import { applyTheme } from '../../theme.ts';
import { carryUserFontTokens, installGoogleFont } from '../../user-fonts.ts';
import type { UserFontsHost } from '../../user-fonts.ts';
import { escape as escapeText } from '../../utils.ts';
import { FONT_NAME, IMAGE_NAME, PDF_NAME } from './shared.ts';
import { bindOp, type StartCtx } from './context.ts';

/** What a dropped file IS decides who handles it. One router for the shell's
 *  drag-anywhere and the card's own drop, so both answer the same. */
export async function routeDroppedFile(start: StartCtx, file: File): Promise<void> {
  if (PDF_NAME.test(file.name) || file.type === 'application/pdf') {
    start.sources.openImport('pdf');
    await start.pdf.scanPdfFile(file, start.sources.srcNote);
    return;
  }
  const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
  if (!isSvg && (IMAGE_NAME.test(file.name) || file.type.startsWith('image/'))) {
    start.sources.openImport('image');
    await start.images.scanImageFile(file, start.sources.srcNote);
    return;
  }
  if (FONT_NAME.test(file.name)) {
    // No silent install: the Type room takes the file, and this says so.
    start.exporting.showNote(tRaw('Open Type to install {name}', { name: file.name }));
    start.sources.chooseSource('font');
    return;
  }
  start.sources.openImport('file');
  await handleImportFile(start, file);
}
export async function install(start: StartCtx, 
  doc: Record<string, unknown>,
  label: string,
  btn: HTMLButtonElement,
  opts?: { onError?: (message: string) => void; area?: 'overview'; requireCheckpoint?: boolean; onInstalled?: () => void }
): Promise<void> {
  const { host, importResult, shell } = start;
  if (start.installing) return;
  start.installing = true;
  btn.disabled = true;
  const prevLabel = btn.textContent;
  btn.textContent = t('Installing…');
  try {
    if (opts?.requireCheckpoint) {
      await start.studio.load();
      if (start.studio.doc()) await start.studio.checkpoint(t('Before import'));
    } else await start.brand.checkpointBeforeInstall();
    // A doc with no font group inherits the fonts already installed here, so an
    // import never silently undoes a chosen face.
    const withFonts = await carryUserFontTokens(host as unknown as UserFontsHost, doc);
    // An import replaces the ACTIVE system's material but keeps its name: `label`
    // (the file's name, or "My brand" when it has none) is used only for a system
    // this write creates. Passed as a rename, it renamed whichever system was open.
    await installUserTokens(host, withFonts, { labelIfNew: label });
    void applyChromeBrandVars(host); // bust() cleared caches; nothing repaints chrome by itself
    await start.editor?.reload();
    await start.exporting.refreshHead(); // the head moved - the tokens export follows it
    markWelcomeDismissed();
    opts?.onInstalled?.();
    start.installing = false;
    // The user may have navigated away while the install ran - the tokens
    // were saved either way, but only a still-mounted view touches its own DOM
    // (or the URL: selectRoom replaceStates, which would rewrite the NEW view's).
    if (!shell.isConnected) return;
    start.sources.closeImport();
    importResult.hidden = true;
    btn.disabled = false;
    btn.textContent = prevLabel;
    start.rooms.selectRoom(opts?.area ?? 'color');
    announce(tRaw('{label} installed - the studio now shows it', { label }));
    playSfx('saveProfile');
  } catch (err) {
    start.installing = false;
    btn.disabled = false;
    btn.textContent = prevLabel;
    (opts?.onError ?? start.feedback.showImportError)(
      tRaw('Couldn’t install the brand: {error}', {
        error: String((err as { message?: unknown })?.message ?? err),
      })
    );
  }
}
/** Surface and text for the primary chosen right now (sources/file.ts owns the
 *  rule; this binds it to the card's held state). */
export const followsFor = (start: StartCtx, primaryPath: string): Record<'surface' | 'text', RoleFollow> =>
  followRoles(primaryPath, start.pendingTokens, start.pendingRoles);
// Shared "N sets · N themes · N tokens, N colours" blurb - every doc-shaped
// import path (JSON tokens, Penpot tokens) shows the same stats before the
// user commits.
export function statLineFor(_start: StartCtx, doc: Record<string, unknown>): string {
  try {
    const s = summarizeTokensDoc(doc);
    return [
      s.sets.length
        ? t(s.sets.length === 1 ? '{n} set' : '{n} sets', { n: s.sets.length })
        : null,
      s.themes.length
        ? t(s.themes.length === 1 ? '{n} theme' : '{n} themes', { n: s.themes.length })
        : null,
      t(s.tokenCount === 1 ? '{n} token' : '{n} tokens', { n: s.tokenCount }),
      t(s.colorCount === 1 ? '{n} colour' : '{n} colours', { n: s.colorCount }),
    ]
      .filter(Boolean)
      .join(' · ');
  } catch {
    return '';
  } // stats are decorative - the install button still stands
}
/** Why a file could not be routed, in this view's own words. The router reports
 *  machine reasons precisely so the copy lives here (lib/design-system/sources/file.ts). */
export function refusalText(_start: StartCtx, 
  route: Extract<DesignFileRoute, { kind: 'refused' }>,
  filename: string
): string {
  switch (route.reason) {
    case 'too-large':
      return tRaw('{filename} is too large (max {n} MB).', {
        filename,
        n: Math.round((route.limit ?? 0) / (1024 * 1024)),
      });
    case 'unreadable-zip':
      // The bomb guard's own sentence is user-facing; fflate's ("invalid zip
      // data") is not, so it rides as the reason rather than standing alone.
      return route.detail
        ? tRaw('{filename} could not be unzipped: {reason}', { filename, reason: route.detail })
        : tRaw('{filename} could not be unzipped.', { filename });
    case 'unknown-zip':
      return tRaw(
        '{filename} isn’t a design system pack, a Penpot export or a zip of token set files.',
        { filename }
      );
    case 'not-json':
      return tRaw('Couldn’t read {filename} - is it valid JSON?', { filename });
    default:
      return tRaw('No tokens found: {reason}.', {
        reason: route.detail ?? t('unrecognised document'),
      });
  }
}
// extractSvgColors can return a bare named colour ("rebeccapurple") verbatim
// - deriveBrandTokens's parser only understands hex/rgb()/hsl()/oklch()/lch(),
// NOT bare names, and throws on anything else. The browser itself is the one
// dependency-free place that resolves every CSS colour name it recognises
// (not just a hand-copied subset), so ask it via a detached element rather
// than hand-rolling a second named-colour table here.
export function toHexForDerive(_start: StartCtx, value: string): string | null {
  if (value.startsWith('#')) return value;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;left:-9999px;top:-9999px;';
  probe.style.color = value;
  if (!probe.style.color) return null; // the browser didn't recognise it
  document.body.appendChild(probe);
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color);
  probe.remove();
  if (!rgb) return null;
  const hex = (n: string): string => Number(n).toString(16).padStart(2, '0');
  return `#${hex(rgb[1]!)}${hex(rgb[2]!)}${hex(rgb[3]!)}`;
}
/**
 * One picked/dropped design file, routed by what it turns out to BE.
 *
 * The sniffing, the size caps and the three zip shapes live in
 * lib/design-system/sources/file.ts, which is pure and covered; this function
 * owns the copy, the cards and the install - the split plan 97 section 8 asks for.
 * The size cap is checked from `File.size` first so a mispicked multi-GB file
 * is refused before a byte of it is read (the router re-checks what it is
 * handed, because a cap enforced at one of two call sites will be skipped).
 */
export async function handleImportFile(start: StartCtx, file: File): Promise<void> {
  const { SOURCE_LABEL, host, importResult, shell } = start;
  start.importedDoc = null;
  start.pendingUsage = null;
  start.pendingRoles = null;
  start.roleChoice = null;
  start.pendingTokens = [];
  start.pendingSvgColors = [];

  // `.lolly` is a container family, not a design-system synonym. Hand it to
  // the manifest-first intake even here: this context recommends "Add its
  // design system", while a shared session still retains its honest "Open
  // shared design" route. Close this modal first so the preflight is the one
  // active dialog rather than a second sheet stacked on top of it.
  if (/\.lolly$/i.test(file.name) || file.type === 'application/vnd.lolly+zip') {
    start.sources.closeImport();
    await openLollyFile(file, host as unknown as Parameters<typeof openLollyFile>[1], {
      preferred: 'design-system',
    });
    return;
  }

  const limit = designFileLimit(file.name, file.type);
  if (file.size > limit) {
    start.feedback.showImportError(
      tRaw('{filename} is too large (max {n} MB).', {
        filename: file.name,
        n: Math.round(limit / (1024 * 1024)),
      })
    );
    return;
  }
  let fileRoute: DesignFileRoute;
  try {
    fileRoute = await routeDesignFile(file.name, new Uint8Array(await file.arrayBuffer()), {
      type: file.type,
    });
  } catch (err) {
    start.feedback.showImportError(String((err as { message?: unknown })?.message ?? err));
    return;
  }

  if (fileRoute.kind === 'refused') {
    start.feedback.showImportError(refusalText(start, fileRoute, file.name));
    return;
  }

  // SVG has no formal-token concept - every colour it uses is "not a token",
  // so scan for what's actually there and let the user pick which to keep
  // (see the checkbox review below) rather than treating every incidental
  // fill as part of the design system.
  if (fileRoute.kind === 'svg') {
    let svgColors: string[] = [];
    try {
      svgColors = extractSvgColors(await file.text());
    } catch {
      start.feedback.showImportError(tRaw('Couldn’t read {filename} as SVG.', { filename: file.name }));
      return;
    }
    if (!svgColors.length) {
      start.feedback.showImportError(tRaw('No colours found in {filename}.', { filename: file.name }));
      return;
    }
    start.importedLabel = fileRoute.label || t('My brand');
    start.pendingSvgColors = svgColors;
    start.feedback.showImportResult(
      `
        <p class="start-import-name">${escapeText(file.name)}<span class="start-import-source">${t('colours in use')}</span></p>
        <p class="start-import-warn">${t(
          svgColors.length === 1
            ? 'Found {n} colour - none are linked to a design token, so review and drop any you don’t want. The first one kept becomes your main brand colour.'
            : 'Found {n} colours - none are linked to a design token, so review and drop any you don’t want. The first one kept becomes your main brand colour.',
          { n: svgColors.length }
        )}</p>
        <div class="start-color-actions">
          <button type="button" class="be-btn be-btn--sm" data-colors-all>${t('Select all')}</button>
          <button type="button" class="be-btn be-btn--sm" data-colors-none>${t('Select none')}</button>
        </div>
        <ul class="start-color-grid" role="list">
          ${svgColors
            .map(
              (hex, i) => `
            <li class="start-color-chip">
              <label>
                <input type="checkbox" data-color-idx="${i}" checked>
                <span class="start-color-swatch" style="background:${escapeText(hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escapeText(hex)}</span>
              </label>
            </li>`
            )
            .join('')}
        </ul>
        <div class="start-color-actions">
          <button type="button" class="be-cta start-cta--import" data-install-colors disabled>${t('Use these colours')}</button>
          <button type="button" class="be-btn be-btn--sm" data-colors-tray>${t('Keep these for later')}</button>
        </div>`,
      {
        say: tRaw(
          svgColors.length === 1
            ? '{n} colour found in {filename}. Review the selection below.'
            : '{n} colours found in {filename}. Review the selection below.',
          { n: svgColors.length, filename: file.name }
        ),
      }
    );
    // The colour-review path builds its doc lazily from whichever boxes are
    // still checked at click time (see data-install-colors below) rather
    // than from importedDoc/data-install-import.
    return;
  }

  // A Lolly design-system PACK: tokens + fonts + a theme preference, installed
  // in one step - no preview leg, because the pack carries its own integrity
  // map and the importer verifies it (brand-transfer.ts).
  if (fileRoute.kind === 'pack') {
    if (!start.editor) {
      start.feedback.showImportError(t('The brand editor didn’t open - reload the page and try again.'));
      return;
    }
    start.feedback.showImportResult(
      `<p class="start-import-stats">${t('Loading {filename}…', { filename: file.name })}</p>`,
      { say: tRaw('Loading {filename}…', { filename: file.name }) }
    );
    try {
      await start.brand.checkpointBeforeInstall();
      // routeDesignFile already inflated this bounded archive. Hand those
      // exact parts to the integrity-verifying importer instead of reading
      // and inflating the File a second time.
      await start.editor.importPack(fileRoute.files);
      // The pack carries its own theme preference (prefs.json → localStorage);
      // apply it, same as the old wizard's pack path did.
      applyTheme(localStorage.getItem('theme') || 'light');
      markWelcomeDismissed();
      void start.exporting.refreshHead();
      if (!shell.isConnected) return;
      start.sources.closeImport();
      importResult.hidden = true;
      start.rooms.selectRoom('color');
      playSfx('saveProfile');
    } catch (err) {
      start.feedback.showImportError(String((err as { message?: unknown })?.message ?? err));
    }
    return;
  }

  // A Penpot project export: its FORMAL design tokens when it declares any -
  // Penpot shape/layer fills that aren't tied to a token are out of scope here,
  // the same "prefer tokens" stance as the SVG path's opposite case - and the
  // look it actually paints with when it declares none.
  if (fileRoute.kind === 'penpot') {
    const files = fileRoute.files;
    const { doc, warnings } = extractPenpotProject(files);
    if (!doc) {
      // No formal tokens - the common case. Scan what the file actually
      // USES (every paint source, gradients, fonts) and propose the look
      // as brand roles instead of dead-ending.
      const usage = scanPenpotUsage(files);
      const roles = proposeBrandRoles(usage);
      if (!roles) {
        start.feedback.showImportError(
          tRaw(
            warnings[0]
              ? 'No design tokens found in {filename} - {warning}. Try exporting an SVG instead so we can read its colours.'
              : 'No design tokens found in {filename}. Try exporting an SVG instead so we can read its colours.',
            { filename: file.name, warning: warnings[0] ?? '' }
          )
        );
        return;
      }
      start.pendingUsage = usage;
      start.importedLabel = fileRoute.label || t('My brand');
      const fonts = proposeFonts(usage);
      const gradN = usage.gradients.length;
      const statBits = [
        t(usage.colors.length === 1 ? '{n} colour' : '{n} colours', { n: usage.colors.length }),
        gradN ? t(gradN === 1 ? '{n} gradient' : '{n} gradients', { n: gradN }) : null,
        usage.fonts.length
          ? t(usage.fonts.length === 1 ? '{n} font' : '{n} fonts', { n: usage.fonts.length })
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const roleChips: Array<[string, string]> = [
        [t('Primary'), roles.primary],
        ...(roles.secondary ? [[t('Secondary'), roles.secondary] as [string, string]] : []),
        [t('Surface'), roles.surface],
        [t('Text'), roles.text],
      ];
      const fontLines = [
        fonts.google.length
          ? `<p class="start-import-stats">${escapeText(tRaw('Fonts: {list}', { list: fonts.google.join(', ') }))}</p>`
          : '',
        fonts.missing.length
          ? `<p class="start-import-warn">${escapeText(
                tRaw(
                  fonts.missing.length === 1
                    ? '{list} has no downloadable source, so it stays as a name only.'
                    : '{list} have no downloadable source, so they stay as names only.',
                  { list: fonts.missing.join(', ') }
                )
              )}</p>`
          : '',
      ].join('');
      start.feedback.showImportResult(
        `
          <p class="start-import-name">${escapeText(file.name)}<span class="start-import-source">${t('look in use')}</span></p>
          ${statBits ? `<p class="start-import-stats">${escapeText(statBits)}</p>` : ''}
          <p class="start-import-warn">${t('This file declares no design tokens, so this is the look it actually uses.')}</p>
          <ul class="start-color-grid start-look-roles" role="list">
            ${roleChips
              .map(
                ([label, hex]) => `
              <li class="start-color-chip">
                <span class="start-color-swatch" style="background:${escapeText(hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escapeText(hex)}</span>
                <span class="start-color-role">${escapeText(label)}</span>
              </li>`
              )
              .join('')}
          </ul>
          ${
            roles.extras.length
              ? `
            <p class="start-import-stats">${t('Keep any of the other colours as swatches:')}</p>
            <ul class="start-color-grid" role="list">
              ${roles.extras
                .map(
                  (hex, i) => `
                <li class="start-color-chip">
                  <label>
                    <input type="checkbox" data-color-idx="${i}" checked>
                    <span class="start-color-swatch" style="background:${escapeText(hex)}" aria-hidden="true"></span>
                    <span class="start-color-hex">${escapeText(hex)}</span>
                  </label>
                </li>`
                )
                .join('')}
            </ul>`
              : ''
          }
          ${fontLines}
          ${
            gradN
              ? `<p class="start-import-stats">${escapeText(
                  t(
                    gradN === 1
                      ? 'Its gradient becomes a brand token.'
                      : 'The top gradients become brand tokens.'
                  )
                )}</p>`
              : ''
          }
          <button type="button" class="be-cta start-cta--import" data-install-look>${t('Make this look your brand')}</button>`,
        { say: cardSay(start, file.name, statBits) }
      );
      return;
    }
    // The file declares tokens, so those ARE the design system - but a doc
    // alone never says which token is the primary. Read how the designer
    // applied them (and, for an older export that carries no applied
    // references, what the file paints) so the install can also write the
    // semantic roles as aliases to their own tokens. No usable colour tokens
    // → the doc installs exactly as it does today.
    start.importedLabel = fileRoute.label || t('My brand');
    const appliedTokens = scanPenpotAppliedTokens(files);
    const roles = proposeRolesFromTokens(doc, appliedTokens, scanPenpotUsage(files));
    start.importedDoc = roles ? withRoleAliases(doc, roles.refs) : doc;
    const statLine = statLineFor(start, doc);
    const tokenFonts = roles ? proposeFontsFromTokens(doc, appliedTokens) : null;
    const roleChips: Array<[string, string, string | undefined]> = roles
      ? [
          [t('Primary'), roles.primary, roles.refs.primary],
          ...(roles.secondary
            ? [
                [t('Secondary'), roles.secondary, roles.refs.secondary] as [
                  string,
                  string,
                  string | undefined,
                ],
              ]
            : []),
          [t('Surface'), roles.surface, roles.refs.surface],
          [t('Text'), roles.text, roles.refs.text],
        ]
      : [];
    start.feedback.showImportResult(
      `
        <p class="start-import-name">${escapeText(file.name)}<span class="start-import-source">${t('penpot tokens')}</span></p>
        ${statLine ? `<p class="start-import-stats">${escapeText(statLine)}</p>` : ''}
        ${warnings.length ? `<p class="start-import-warn">${escapeText(warnings.join(' · '))}</p>` : ''}
        ${
          roles
            ? `
          <p class="start-import-stats">${t('These are the tokens the file declares. Roles below follow how the designer applied them.')}</p>
          <ul class="start-color-grid start-look-roles" role="list">
            ${roleChips
              .map(
                ([label, hex, ref]) => `
              <li class="start-color-chip">
                <span class="start-color-swatch" style="background:${escapeText(hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escapeText(ref ?? hex)}</span>
                <span class="start-color-role">${escapeText(label)}</span>
              </li>`
              )
              .join('')}
          </ul>`
            : ''
        }
        ${tokenFonts?.missing.length ? `<p class="start-import-stats">${escapeText(tRaw('Type: {list}', { list: tokenFonts.missing.slice(0, 4).join(', ') }))}</p>` : ''}
        <button type="button" class="be-cta start-cta--import" data-install-import>${t('Install these tokens')}</button>`,
      { say: cardSay(start, file.name, statLine) }
    );
    return;
  }

  // A token DOCUMENT: a DTCG/Tokens-Studio JSON, or a zip of loose token-set
  // files (the shape assembleTokenSetFiles has always read for the CLI and the
  // web could never open - the router assembles it, so both paths land here).
  const { doc, warnings, source } = fileRoute.extraction;
  if (!doc) {
    // the router only returns `tokens` with a doc; belt and braces
    start.feedback.showImportError(
      tRaw('No tokens found: {reason}.', { reason: warnings[0] ?? t('unrecognised document') })
    );
    return;
  }
  start.importedDoc = doc;
  start.importedLabel = fileRoute.label || t('My brand');
  const statLine = statLineFor(start, doc);
  // Built before the call, not inside it: `mappingReviewHtml` is what decides
  // whether there is a question on this card (it sets `pendingRoles`), and the
  // announcement has to carry that question - it is the one thing the card
  // asks for and the only reason the install button says something different.
  const html = `
      <p class="start-import-name">${escapeText(file.name)}<span class="start-import-source">${escapeText(SOURCE_LABEL[source]())}</span></p>
      ${statLine ? `<p class="start-import-stats">${escapeText(statLine)}</p>` : ''}
      ${warnings.length ? `<p class="start-import-warn">${escapeText(warnings.join(' · '))}</p>` : ''}
      ${mappingReviewHtml(start, doc)}
      <div class="start-color-actions">
        <button type="button" class="be-cta start-cta--import" data-install-import>${
          start.pendingRoles ? t('Install with these roles') : t('Install these tokens')
        }</button>
        ${start.pendingRoles ? `<button type="button" class="be-btn be-btn--sm" data-install-plain>${t('Install without roles')}</button>` : ''}
        <button type="button" class="be-btn be-btn--sm" data-tokens-tray>${t('Review first')}</button>
      </div>`;
  start.feedback.showImportResult(html, {
    say: cardSay(start, file.name, statLine, start.pendingRoles ? t('Which one is the primary?') : ''),
  });
}
/** What a result card says out loud: the file, what was found in it, and the
 *  one question it asks, if it asks one. The card itself carries the detail -
 *  focus moves there, so this is the headline and not a transcript. */
export function cardSay(_start: StartCtx, filename: string, statLine: string, question = ''): string {
  const head = statLine ? tRaw('{filename}: {stats}', { filename, stats: statLine }) : filename;
  return question ? `${head} ${question}` : head;
}
/**
 * The semantic mapping review (plan 97 section 8) - the card that stops an import
 * landing a full palette with every `--brand-*` var still dark.
 *
 * It renders only for the case it is about: a document that resolves colour
 * tokens and NONE of `color.semantic.{primary,surface,text}`. A doc that
 * already carries roles, or carries no colours at all, never sees it and
 * installs byte-identically to before. One decision, not four: which token is
 * the primary; surface and text FOLLOW it and are shown read-only, because a
 * card asking four questions is a form.
 *
 * "Follow" is literal - see `followsFor`. They are recomputed on every pick
 * and the read-only pair repaints, because the alternative is a card that
 * promises a consequence and installs a different one.
 *
 * Returns markup for the existing result sink - nothing here is a new one.
 */
export function mappingReviewHtml(start: StartCtx, doc: Record<string, unknown>): string {
  if (!docNeedsMappingReview(doc)) return '';
  // proposeRolesFromTokens with no census at all is the "no weights anywhere"
  // branch, and it is the only proposer that returns the declared token PATHS
  // withRoleAliases needs to write an alias rather than a literal.
  const proposal = proposeRolesFromTokens(doc, [], null);
  if (!proposal?.refs.primary) return '';
  start.pendingRoles = proposal;
  start.roleChoice = proposal.refs.primary;
  start.pendingTokens = colorTokenRows(doc);
  const choices = chooserRows(start.pendingTokens, start.roleChoice);
  const follows = followsFor(start, start.roleChoice);
  return `
      <div class="ds-roles-card">
        <p class="ds-roles-q">${t('Which one is the primary?')}</p>
        <p class="start-import-warn">${t('This document declares colours but no roles, so nothing would pick up its main colour without one.')}</p>
        <ul class="ds-roles-choices" role="list">
          ${choices
            .map(
              (c) => `
            <li>
              <button type="button" class="ds-roles-chip" data-role-pick="${escapeText(c.path)}"
                aria-pressed="${c.path === start.roleChoice ? 'true' : 'false'}">
                <span class="start-color-swatch" style="background:${escapeText(c.hex)}" aria-hidden="true"></span>
                <span class="start-color-hex">${escapeText(c.path)}</span>
              </button>
            </li>`
            )
            .join('')}
        </ul>
        <p class="start-import-stats">${t('Surface and text follow from it.')}</p>
        <ul class="start-color-grid start-look-roles" role="list">
          ${(['surface', 'text'] as const)
            .map(
              (role) => `
            <li class="start-color-chip" data-ds-follow="${role}">
              <span class="start-color-swatch" style="background:${escapeText(follows[role].hex)}" aria-hidden="true"></span>
              <span class="start-color-hex">${escapeText(follows[role].ref ?? follows[role].hex)}</span>
              <span class="start-color-role">${escapeText(role === 'surface' ? t('Surface') : t('Text'))}</span>
            </li>`
            )
            .join('')}
        </ul>
      </div>`;
}
// Colour-review checkboxes (the SVG path): select all/none, enable "Use
// these colours" only while at least one is checked, and build the doc from
// whatever's checked at click time.
// Both actions on that card act on the SELECTION, so both follow it.
export const syncColorActions = (start: StartCtx, anyChecked: boolean): void => {
  const { importResult } = start;
  const installBtn = importResult.querySelector<HTMLButtonElement>('[data-install-colors]');
  const trayBtn = importResult.querySelector<HTMLButtonElement>('[data-colors-tray]');
  if (installBtn) installBtn.disabled = !anyChecked;
  if (trayBtn) trayBtn.disabled = !anyChecked;
};
export function wireTokenDrop(start: StartCtx): void {
  const { importFile, importPanel } = start;
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = ''; // so re-picking the same file re-fires change
    if (file) await start.tokens.handleImportFile(file);
  });

  // Drag & drop uses the same routing as the picker - the card is one
  // control with two mouths.
  const dropEl = importPanel.querySelector<HTMLElement>('[data-start-import-drop]')!; start.dropEl = dropEl;
  dropEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dropEl.classList.add('is-dragover');
  });
  dropEl.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && dropEl.contains(e.relatedTarget as Node)) return;
    dropEl.classList.remove('is-dragover');
  });
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    // The shell's own drag-anywhere drop listener is an ANCESTOR of this card -
    // without this the same file would be handled twice.
    e.stopPropagation();
    dropEl.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    // The SAME router the drag-anywhere drop uses. The card advertises design
    // files, but a photo or a font is often dropped here (it is the biggest
    // drop target on the page), and parsing one as JSON to refuse it with "is it
    // valid JSON?" is a worse answer than the image scan or the Type hand-off
    // the identical file gets one pixel outside this card.
    if (file) void start.tokens.routeDroppedFile(file);
  });
}

export function wireTokenReview(start: StartCtx): void {
  const { host, importResult } = start;
  importResult.addEventListener('input', (e) => {
    if (!(e.target as HTMLElement).matches('[data-color-idx]')) return;
    start.tokens.syncColorActions(!!importResult.querySelector('[data-color-idx]:checked'));
  });
  importResult.addEventListener('click', (e) => {
    const all = (e.target as HTMLElement).closest('[data-colors-all]');
    const none = (e.target as HTMLElement).closest('[data-colors-none]');
    if (!all && !none) return;
    importResult.querySelectorAll<HTMLInputElement>('[data-color-idx]').forEach((cb) => {
      cb.checked = !!all;
    });
    start.tokens.syncColorActions(!!all);
  });

  // Delegated: the install button is re-created with every result render.
  importResult.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // The mapping card's chooser: one decision, so picking a chip moves the
    // pressed state and repaints what the card says follows from it. Nothing
    // installs until the button below is pressed. Repainted in place rather than
    // re-rendered - two swatches and two labels, and the card has no second sink.
    const pick = target.closest<HTMLElement>('[data-role-pick]')?.dataset.rolePick;
    if (pick) {
      start.roleChoice = pick;
      importResult.querySelectorAll<HTMLElement>('[data-role-pick]').forEach((chip) => {
        chip.setAttribute('aria-pressed', String(chip.dataset.rolePick === pick));
      });
      const follows = start.tokens.followsFor(pick);
      for (const role of ['surface', 'text'] as const) {
        const li = importResult.querySelector<HTMLElement>(`[data-ds-follow="${role}"]`);
        const sw = li?.querySelector<HTMLElement>('.start-color-swatch');
        const label = li?.querySelector<HTMLElement>('.start-color-hex');
        if (sw) sw.style.background = follows[role].hex;
        if (label) label.textContent = follows[role].ref ?? follows[role].hex;
      }
      return;
    }

    const importBtnEl = target.closest<HTMLButtonElement>('[data-install-import]');
    if (importBtnEl && start.importedDoc) {
      // With a proposal on the card, the chosen roles are folded into the doc
      // that installs - ONE install, aliases not literals, so editing the token
      // later still moves the role with it. Surface and text come from the SAME
      // followsFor the card painted, so what installs is what it showed; a
      // secondary that collides with the chosen primary is dropped rather than
      // written as a second alias to one token.
      const follows = start.roleChoice ? start.tokens.followsFor(start.roleChoice) : null;
      const doc =
        start.pendingRoles && start.roleChoice && follows
          ? applyMappingChoice(start.importedDoc, {
              primary: start.roleChoice,
              secondary:
                start.pendingRoles.refs.secondary === start.roleChoice
                  ? undefined
                  : start.pendingRoles.refs.secondary,
              surface: follows.surface.ref,
              text: follows.text.ref,
            })
          : start.importedDoc;
      void start.tokens.install(doc, start.importedLabel, importBtnEl);
      return;
    }

    // Skip is EXACTLY today's behaviour: the raw document installs, no roles
    // written, nothing else different.
    const plainBtn = target.closest<HTMLButtonElement>('[data-install-plain]');
    if (plainBtn && start.importedDoc) {
      void start.tokens.install(start.importedDoc, start.importedLabel, plainBtn);
      return;
    }

    // "Review first" (plan 97 section 8): the document decomposes into candidates
    // instead of installing, so it can be shopped one at a time. Nothing is
    // written by pressing it.
    if (target.closest('[data-tokens-tray]') && start.importedDoc) {
      void (async () => {
        // The rail note, not the dialog's: the modal closes on the way out, and a
        // message that leaves with it was never read.
        await start.candidates.keepInTray(censusFromTokensDoc(start.importedDoc, start.importedLabel), start.exporting.showNote);
        start.sources.closeImport();
      })();
      return;
    }

    // The SVG path's second door: keep the scanned colours as candidates rather
    // than deriving a whole design system from them right now.
    if (target.closest('[data-colors-tray]') && start.pendingSvgColors.length) {
      const kept: string[] = [];
      importResult.querySelectorAll<HTMLElement>('.start-color-chip').forEach((li) => {
        const cb = li.querySelector<HTMLInputElement>('[data-color-idx]');
        const hex = li.querySelector<HTMLElement>('.start-color-hex')?.textContent;
        if (cb?.checked && hex) kept.push(hex);
      });
      if (!kept.length) return; // the button follows the selection (syncColorActions)
      void (async () => {
        await start.candidates.keepInTray(censusFromSvgColors(kept, start.importedLabel), start.exporting.showNote);
        start.sources.closeImport();
      })();
      return;
    }

    const colorsBtn = target.closest<HTMLButtonElement>('[data-install-colors]');
    if (!colorsBtn) return;
    const swatches = importResult.querySelectorAll<HTMLElement>('.start-color-chip');
    const kept: string[] = [];
    swatches.forEach((li) => {
      const cb = li.querySelector<HTMLInputElement>('[data-color-idx]');
      const raw = li.querySelector<HTMLElement>('.start-color-hex')?.textContent;
      const hex = raw && start.tokens.toHexForDerive(raw);
      if (cb?.checked && hex) kept.push(hex);
    });
    if (!kept.length) {
      start.feedback.showImportError(t('None of the kept colours could be used - try a different selection.'));
      return;
    }
    const doc = deriveBrandTokens({ primary: kept[0]!, name: start.importedLabel });
    kept
      .slice(1)
      .forEach((hex, i) => { addSwatch(doc, 'custom', t('Extracted {n}', { n: i + 2 }), hex); });
    void start.tokens.install(doc, start.importedLabel, colorsBtn);
  });

  // Delegated: the usage-proposal CTA (the token-less Penpot path). Google
  // faces are fetched FIRST so the doc's font roles resolve on-device - but a
  // failed fetch is non-fatal, offline the tokens still name the family.
  importResult.addEventListener('click', async (e) => {
    const lookBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-install-look]');
    if (!lookBtn || !start.pendingUsage || lookBtn.disabled) return;
    const keepExtras: string[] = [];
    importResult.querySelectorAll<HTMLElement>('.start-color-chip').forEach((li) => {
      const cb = li.querySelector<HTMLInputElement>('[data-color-idx]');
      const hex = li.querySelector<HTMLElement>('.start-color-hex')?.textContent;
      if (cb?.checked && hex) keepExtras.push(hex);
    });
    lookBtn.disabled = true;
    const fonts = proposeFonts(start.pendingUsage);
    let landed = false;
    for (const family of fonts.google) {
      try {
        await installGoogleFont(host as unknown as UserFontsHost, family, { neverPrimary: true });
        landed = true;
      } catch {
        /* offline or blocked - the font token still points at the family */
      }
    }
    if (landed) bustFontRegistry();
    lookBtn.disabled = false;
    const { doc } = buildBrandDocFromUsage(start.pendingUsage, start.importedLabel, { keepExtras });
    void start.tokens.install(doc, start.importedLabel, lookBtn);
  });
}

export function tokensOps(start: StartCtx) {
  return {
    routeDroppedFile: bindOp(start, routeDroppedFile),
    install: bindOp(start, install),
    followsFor: bindOp(start, followsFor),
    statLineFor: bindOp(start, statLineFor),
    refusalText: bindOp(start, refusalText),
    toHexForDerive: bindOp(start, toHexForDerive),
    handleImportFile: bindOp(start, handleImportFile),
    cardSay: bindOp(start, cardSay),
    mappingReviewHtml: bindOp(start, mappingReviewHtml),
    syncColorActions: bindOp(start, syncColorActions),
    wireTokenDrop: bindOp(start, wireTokenDrop),
    wireTokenReview: bindOp(start, wireTokenReview),
  };
}
