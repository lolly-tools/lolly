// SPDX-License-Identifier: MPL-2.0
import { composeSlideMarkdown } from '../../../../engine/src/slide-composition.ts';
import type { SlideComposition, SlideMarkdownContent, SlideCellBox } from '../../../../engine/src/slide-composition.ts';
import { mountModal, type ModalHandle } from '../components/modal.ts';

interface Slide { layout?: string; arrangement?: unknown; content?: string }
interface CompositionRead { content: SlideMarkdownContent; plan: SlideComposition; choices: SlideComposition[] }
interface Options {
  canvas: HTMLElement;
  slide(): Slide | undefined;
  index(): number;
  commit(index: number, patch: Record<string, unknown>): void;
}

function button(text: string, action: () => void): HTMLButtonElement {
  const el = document.createElement('button'); el.type = 'button'; el.textContent = text;
  el.addEventListener('click', action); return el;
}

function read(slide: Slide, node?: Element | null): CompositionRead {
  const json = node?.querySelector('[data-slide-composition]')?.textContent;
  try { if (json) return JSON.parse(json) as CompositionRead; } catch { /* Wait for the next render. */ }
  return composeSlideMarkdown(slide.content ?? '', { recipe: String(slide.arrangement ?? '') });
}

const STYLE_PROPERTIES = ['display', 'position', 'box-sizing', 'top', 'left', 'right', 'bottom', 'padding', 'margin', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'border', 'border-radius', 'text-align', 'text-decoration', 'list-style-type', 'white-space', 'overflow-wrap', 'object-fit'];
function snapshot(source: HTMLElement): HTMLElement {
  const copy = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement>('*')];
  const copies = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
  originals.forEach((node, i) => {
    const target = copies[i]!, css = getComputedStyle(node);
    target.removeAttribute('id');
    for (const property of STYLE_PROPERTIES) target.style.setProperty(property, css.getPropertyValue(property));
    if (node.closest('[data-fit-floor]')) {
      const fit = Number(css.getPropertyValue('--fit')) || 1;
      target.style.fontSize = `${parseFloat(css.fontSize) / fit}px`;
      target.style.lineHeight = `${parseFloat(css.lineHeight) / fit}px`;
    }
    if (css.position === 'absolute') { target.style.width = css.width; target.style.height = css.height; }
  });
  copy.querySelectorAll('script, [data-slide-notes]').forEach(n => { n.remove(); });
  Object.assign(copy.style, { width: `${source.clientWidth}px`, height: `${source.clientHeight}px`, position: 'absolute', inset: '0', opacity: '1', transformOrigin: 'top left', animation: 'none', pointerEvents: 'none', overflow: 'hidden' });
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}

function position(node: HTMLElement, box: SlideCellBox, width: number, height: number): void {
  Object.assign(node.style, { left: `${box.x * width}px`, top: `${box.y * height}px`, width: `${box.w * width}px`, height: `${box.h * height}px` });
}

/** An active-slide preview uses the same text, font faces and measured DOM as the canvas. */
function preview(source: HTMLElement, plan: SlideComposition): { node: HTMLElement; fit(): boolean } {
  const node = snapshot(source), width = source.clientWidth, height = source.clientHeight;
  const cells = node.querySelectorAll<HTMLElement>('.sl-flow-cell');
  const ink = getComputedStyle(source).color;
  cells.forEach((cell, i) => {
    position(cell, plan.cells[i]!, width, height);
    cell.style.backgroundColor = plan.kind === 'cards' ? `color-mix(in srgb, ${ink} 5%, ${source.style.getPropertyValue('--bg')})` : 'transparent';
    cell.style.padding = plan.kind === 'cards' ? `${height * .018}px ${width * .014}px` : `${height * .018}px 0`;
    cell.style.borderTopWidth = plan.kind === 'columns' || plan.kind === 'text' || plan.kind === 'quote' ? '0' : `${height * .0025}px`;
    const text = cell.querySelector<HTMLElement>('.sl-flow-text');
    if (text) text.style.height = '100%';
    cell.querySelectorAll<HTMLElement>('.sl-flow-ordinal').forEach(n => { n.style.display = plan.kind === 'steps' ? 'block' : 'none'; });
  });
  return { node, fit() {
    let fits = true;
    node.querySelectorAll<HTMLElement>('[data-fit="box"]').forEach(box => {
      const inner = box.firstElementChild as HTMLElement | null;
      if (!inner) return;
      const sizes = [box, ...box.querySelectorAll<HTMLElement>('*')].map(el => ({ el, size: parseFloat(getComputedStyle(el).fontSize), leading: parseFloat(getComputedStyle(el).lineHeight) }));
      const apply = (scale: number): void => sizes.forEach(({ el, size, leading }) => { el.style.fontSize = `${size * scale}px`; el.style.lineHeight = `${leading * scale}px`; });
      const over = (): boolean => inner.scrollHeight > box.clientHeight + 1 || inner.scrollWidth > box.clientWidth + 1;
      if (!over()) return;
      let lo = .8, hi = 1;
      for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; apply(mid); if (over()) hi = mid; else lo = mid; }
      apply(lo); if (over()) fits = false;
    });
    return fits;
  } };
}

/** One dialog at a time; opening it never changes the deck or its undo history. */
export function createDeckCompositionUI(options: Options): { chooseButton(): HTMLButtonElement; status(): HTMLElement; edit(): void; destroy(): void } {
  let modal: ModalHandle<void> | null = null;
  let dispose: (() => void) | undefined;
  const status = document.createElement('span'); status.className = 'deck-compose__status'; status.setAttribute('role', 'status');
  const updateStatus = (): void => {
    const overflow = options.canvas.querySelector(`.sl-slide--${options.index()}.sl-l-auto [data-overflow="true"]`);
    status.textContent = overflow ? 'Text needs more room. Shorten it or split this slide.' : '';
  };
  options.canvas.addEventListener('lolly:deck-fit-done', updateStatus);
  function close(): void { modal?.close(); }
  function open(title: string): HTMLDialogElement {
    close();
    const heading = document.createElement('h2'); heading.textContent = title; heading.id = 'deck-compose-title';
    modal = mountModal(heading.outerHTML, { className: 'deck-compose', ariaLabel: title,
      onClose() { dispose?.(); dispose = undefined; modal = null; } });
    return modal.el;
  }
  function choose(): void {
    const slide = options.slide(); if (!slide) return;
    const index = options.index(), source = options.canvas.querySelector<HTMLElement>(`.sl-slide--${index}`);
    const result = read(slide, source), panel = open('Choose layout');
    const hint = document.createElement('p'); hint.textContent = 'Layouts for this slide’s text. Your headings and bullets stay together.'; panel.append(hint);
    const grid = document.createElement('div'); grid.className = 'deck-compose__choices'; panel.append(grid);
    const choices = [...result.choices.slice(0, 3)];
    if (!choices.some(c => c.id === result.plan.id)) choices[2] = result.plan;
    const frames: { frame: HTMLElement; copy: HTMLElement; width: number }[] = [];
    for (const plan of choices) {
      const card = button(plan.name, () => { options.commit(index, { layout: 'auto', arrangement: plan.id }); close(); });
      card.className = 'deck-compose__choice'; card.setAttribute('aria-pressed', String(slide.layout === 'auto' && plan.id === result.plan.id));
      grid.append(card);
      if (source?.querySelector('.sl-composition') && source.clientWidth) {
        const frame = document.createElement('span'); frame.className = 'deck-compose__preview'; frame.style.aspectRatio = `${source.clientWidth} / ${source.clientHeight}`;
        const rendered = preview(source, plan); frame.append(rendered.node); card.prepend(frame);
        frames.push({ frame, copy: rendered.node, width: source.clientWidth });
        if (!rendered.fit()) { card.disabled = true; card.append(document.createTextNode(' · Text needs more room')); }
      }
    }
    const resize = (): void => frames.forEach(({ frame, copy, width }) => { copy.style.transform = `scale(${frame.clientWidth / width})`; });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(grid); dispose = () => observer?.disconnect(); resize();
    const actions = document.createElement('div'); actions.className = 'deck-compose__actions';
    actions.append(button('Automatic from text', () => { options.commit(index, { layout: 'auto', arrangement: '' }); close(); }), button('Cancel', close));
    panel.append(actions);
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Fixed layouts and image slots'; details.append(summary);
    const fixed = document.createElement('select'); fixed.setAttribute('aria-label', 'Fixed slide layout');
    for (const [value, label] of Object.entries({ title: 'Title only', full: 'Full image', hero: 'Image and title', split: 'Side by side', stack: 'Stacked', golden: 'Golden ratio', cols3: 'Three image columns', grid4: 'Four image grid', bignum: 'Big number', mainpoint: 'Main point' })) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; fixed.append(option);
    }
    fixed.value = slide.layout === 'auto' ? 'title' : slide.layout ?? 'title';
    details.append(fixed, button('Use fixed layout', () => { options.commit(index, { layout: fixed.value }); close(); })); panel.append(details);
  }
  function edit(): void {
    const slide = options.slide(); if (!slide) return;
    const index = options.index(), panel = open('Edit slide text');
    const hint = document.createElement('p'); hint.textContent = 'Use bullets for peer items, or ## headings with bullets for grouped content.';
    const text = document.createElement('textarea'); text.className = 'deck-compose__markdown'; text.setAttribute('aria-label', 'Slide Markdown'); text.value = slide.content ?? '';
    const apply = (): void => { options.commit(index, { content: text.value }); close(); };
    text.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') apply(); });
    const actions = document.createElement('div'); actions.className = 'deck-compose__actions'; actions.append(button('Cancel', close), button('Apply text', apply));
    panel.append(hint, text, actions); text.focus();
  }
  return { chooseButton() { const el = button('Choose layout', choose); el.className = 'btn btn--primary deck-bar__choose-layout'; return el; }, status() { updateStatus(); return status; }, edit, destroy() { close(); options.canvas.removeEventListener('lolly:deck-fit-done', updateStatus); } };
}

/** Cheap filmstrip geometry; only the active slide renders full chooser previews. */
export function appendCompositionThumb(face: HTMLElement, markdown: string, recipe: string): void {
  const { content, plan } = composeSlideMarkdown(markdown, { recipe });
  const grid = document.createElement('div'); grid.className = 'deck-thumb__composition';
  plan.cells.forEach((box, i) => {
    const cell = document.createElement('span'); cell.textContent = content.groups[i]?.heading || content.groups[i]?.body || '';
    Object.assign(cell.style, { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }); grid.append(cell);
  });
  face.append(grid);
}

export function compositionTextBoxes(slide: Slide, width: number, height: number, node?: Element | null): Record<string, unknown>[] {
  const { content, plan } = read(slide, node);
  const aspect = node instanceof HTMLElement && node.clientHeight ? node.clientWidth / node.clientHeight : 16 / 9;
  const box = (text: string, bounds: SlideCellBox, size: number): Record<string, unknown> => ({ kind: 'text', text, x: bounds.x * width, y: bounds.y * height, w: bounds.w * width, h: bounds.h * height, fontSize: size * width / aspect, fit: true, valign: 't', align: 'l' });
  return [
    ...(content.title ? [box(`**${content.title}**`, plan.titleBox, plan.titleSize)] : []),
    ...(content.intro ? [box(content.intro, plan.introBox, plan.fontSize)] : []),
    ...content.groups.map((group, i) => box([group.heading ? `## ${group.heading}` : '', group.ordinal ? `${group.ordinal}. ${group.body}` : group.body].filter(Boolean).join('\n\n'), plan.cells[i]!, plan.fontSize)),
  ];
}
