// SPDX-License-Identifier: MPL-2.0
/** The common, read-only proposal between a reference scan and an explicit install. */
import { changeSummaryHtml } from '../../components/change-summary.ts';
import { mountReferencePreview } from '../../lib/design-system/reference-preview.ts';
import { segHtml } from '../../lib/seg.ts';
import { t, tRaw } from '../../i18n.ts';
import type { DesignCensus } from '../../lib/design-system/census.ts';
import { referenceLook, referenceReport, type ReferenceEvidence } from '../../lib/design-system/reference-look.ts';
import { styleEvidenceHtml } from '../../lib/design-system/style-evidence-view.ts';
import { saveBlob } from '../../pro/zip.ts';
import { bindOp, type StartCtx } from './context.ts';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

export function cancelReference(start: StartCtx): void {
  start.referenceRevision = (start.referenceRevision ?? 0) + 1;
  start.referenceCancel?.();
  start.referenceCancel = undefined;
  start.referencePreviewCancel?.();
  start.referencePreviewCancel = undefined;
}

export function reviewReference(start: StartCtx, census: DesignCensus, evidence: ReferenceEvidence): void {
  const stage = start.importModal?.el.querySelector<HTMLElement>('[data-ds-stage]:not([hidden])');
  if (!stage) return;
  start.referencePreviewCancel?.();
  stage.querySelector('[data-reference-review]')?.remove();
  const card = node('div', 'ds-reference-review');
  card.dataset.referenceReview = '';
  card.tabIndex = -1;
  card.setAttribute('aria-label', t('Try these colours'));
  const title = node('h3', '', t('Try these colours'));
  const source = node('p', 'ds-src-stage-note');
  source.textContent = evidence.label;
  card.append(title, source);
  const status = node('p', 'ds-src-note');
  status.setAttribute('role', 'status');
  const error = (msg: string): void => { status.textContent = msg; status.classList.add('is-error'); };

  const nameLabel = node('label', 'field-label', t('Name for a new design system'));
  const name = node('input', 'field-input');
  name.maxLength = 80;
  name.value = (census.name || evidence.label.replace(/\.[^.]+$/, '') || t('My design system')).slice(0, 80);
  nameLabel.append(name);
  let primary: string | undefined;
  const nameValue = (): string => name.value.trim() || t('My design system');
  const preview = node('div', 'ds-reference-preview');
  const proof = mountReferencePreview(preview, start.host);
  start.referencePreviewCancel = proof.dispose;
  let theme = census.colors.length ? referenceLook(census, nameValue(), evidence).roles.surfaceLook : 'light';
  const modes = node('div', 'ds-reference-modes');
  modes.innerHTML = segHtml('reference-mode', [{ id: 'light', label: t('Light') }, { id: 'dark', label: t('Dark') }], theme, t('Generated palette preview'));
  const contrast = node('p', 'ds-src-stage-note');
  const palette = node('div', 'ds-reference-palette');
  const paint = (): void => {
    const look = referenceLook(census, nameValue(), evidence, primary, theme);
    palette.replaceChildren();
    for (const [label, value] of [[t('Main'), look.preview.primary], [t('Background'), look.preview.surface], [t('Text'), look.preview.text], [t('On main'), look.preview.onPrimary]]) {
      const item = node('span', 'ds-reference-palette-item');
      const swatch = node('span', 'start-color-swatch');
      swatch.style.backgroundColor = value!;
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch, node('span', '', label!), node('code', '', value!));
      palette.append(item);
    }
    contrast.textContent = t('Palette contrast: text on background {text}:1; text on main colour {action}:1. These pairs do not check the whole poster.', {
      text: look.contrast.text.toFixed(1), action: look.contrast.action.toFixed(1),
    });
    proof.update({ doc: look.doc, theme });
  };
  modes.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-val]');
    if (!button || (button.dataset.val !== 'light' && button.dataset.val !== 'dark')) return;
    theme = button.dataset.val;
    modes.querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', String(b === button)); });
    paint();
  });

  if (census.colors.length) {
    const suggested = referenceLook(census, nameValue(), evidence).roles.primary;
    const choices = node('fieldset', 'ds-reference-choices');
    choices.append(node('legend', 'field-label', t('Choose a source colour')));
    const colors = census.colors.slice(0, 12);
    const proposed = census.colors.find(c => c.hex.toLowerCase() === suggested.toLowerCase());
    if (proposed && !colors.includes(proposed)) colors[colors.length - 1] = proposed;
    for (const color of colors) {
      const label = node('label', 'ds-reference-choice');
      const radio = node('input', 'field-radio');
      radio.type = 'radio';
      radio.name = 'reference-primary';
      radio.value = color.hex;
      radio.checked = color.hex.toLowerCase() === suggested.toLowerCase();
      const swatch = node('span', 'start-color-swatch');
      swatch.style.backgroundColor = color.hex;
      swatch.setAttribute('aria-hidden', 'true');
      label.append(radio, swatch, node('span', '', color.hex));
      radio.addEventListener('change', () => { primary = color.hex; paint(); });
      choices.append(label);
    }
    const previewHead = node('div', 'ds-reference-preview-head');
    previewHead.append(node('span', 'chip chip--flag', t('Poster preview')), modes);
    const workspace = node('div', 'ds-reference-workspace');
    const visual = node('div', 'ds-reference-visual');
    const controls = node('div', 'ds-reference-controls');
    visual.append(previewHead, preview);
    workspace.append(visual, controls);
    card.append(workspace);
    controls.append(choices, node('p', 'ds-src-stage-note', t('Lolly generates light and dark palettes from your chosen colour. These modes are suggestions, not recovered brand rules.')));
    paint();
    name.addEventListener('input', paint);
    const scope = node('div', '');
    scope.innerHTML = changeSummaryHtml(t('When you apply'), [
      { label: t('Replace'), detail: t('Active token settings, including custom tokens, with the generated palette and default styles.') },
      { label: t('Keep'), detail: t('Your font choices and library files.') },
      { label: t('Recover'), detail: t('Undo last import restores the previous system and its file references. Added files stay in your library.') },
    ]);
    controls.append(scope);
    const use = node('button', 'be-cta is-active', t('Apply suggested settings'));
    use.type = 'button';
    use.dataset.referenceApply = '';
    use.addEventListener('click', () => {
      if (use.disabled) return;
      const look = referenceLook(census, nameValue(), evidence, primary);
      void start.tokens.install(look.doc, nameValue(), use, { onError: error, area: 'overview', requireCheckpoint: true });
    });
    controls.append(use);
  } else {
    card.append(node('p', '', t('No usable colours found. Try a screenshot, or include the page’s CSS files.')));
  }

  const details = node('details', 'ds-reference-details');
  details.append(node('summary', '', t('Palette, source details and individual choices')));
  if (census.colors.length) details.append(palette, nameLabel, node('p', 'ds-src-stage-note', t('The name is used only when creating a new system. Existing systems keep their name.')));
  details.append(node('p', 'ds-src-stage-note', evidence.method === 'image'
    ? t('Colours were sampled from this image. Fonts and layout were not recognised.')
    : evidence.method === 'svg'
    ? t('Colours were read from this SVG. Fonts and layout were not assessed.')
    : t('Colours and font names were read from declared styles. Layout and motion were not assessed.')));
  if (evidence.method === 'files' || evidence.method === 'paste') {
    details.append(node('p', 'ds-src-stage-note', t('Only the supplied HTML and CSS were read. Linked stylesheets, images and fonts were not fetched.')));
  }
  if (census.styles) {
    const observations = node('div', '');
    observations.innerHTML = styleEvidenceHtml(census.styles);
    details.append(observations);
  }
  if (census.fonts.length) {
    details.append(node('p', 'ds-src-stage-note', t('Font names found in the source, not installed by this suggestion. The preview uses your current font. Open Type to choose or install a face.')));
    const fonts = node('ul', '');
    for (const font of census.fonts.slice(0, 12)) fonts.append(node('li', '', font.family));
    details.append(fonts);
  }
  if (census.colors.length) details.append(contrast);
  const individual = node('button', 'be-btn', t('Choose individual items in the tray'));
  individual.type = 'button';
  individual.addEventListener('click', async () => {
    if (individual.disabled) return;
    const modal = start.importModal;
    individual.disabled = true;
    try {
      await start.candidates.keepInTray(census, msg => { status.textContent = msg; });
      if (start.importModal === modal && start.shell.isConnected) {
        start.sources.closeImport();
        start.trayUi?.open();
      }
    } catch { error(t('Could not keep these items. Please try again.')); }
    finally { individual.disabled = false; }
  });
  if (census.colors.length || census.fonts.length) details.append(individual);
  const download = node('button', 'be-btn', t('Download design context'));
  download.type = 'button';
  download.addEventListener('click', async () => {
    try {
      await saveBlob(new Blob([JSON.stringify({ ...referenceReport(census, nameValue(), evidence, primary), posterPreview: proof.report() }, null, 2)], { type: 'application/json' }), 'lolly-design-context.json');
    } catch { error(t('Could not save the file. Please try again.')); }
  });
  details.append(download);
  if (evidence.sha256) details.append(node('p', 'ds-reference-hash', tRaw('Source SHA-256: {hash}', { hash: evidence.sha256 })));
  card.append(details, status);
  const change = node('button', 'be-btn', t('Change reference'));
  change.type = 'button';
  change.addEventListener('click', () => {
    start.reference.cancelReference();
    stage.classList.remove('has-reference-review');
    card.remove();
    stage.querySelector<HTMLElement>('input[type=file], .ds-src-urlfield')?.focus();
  });
  card.append(change);
  stage.classList.add('has-reference-review');
  stage.append(card);
  start.sources.srcNote('');
  card.focus();
  if (start.importModal) start.importModal.el.scrollTop = 0;
}

export function referenceOps(start: StartCtx) {
  return { cancelReference: bindOp(start, cancelReference), reviewReference: bindOp(start, reviewReference) };
}
