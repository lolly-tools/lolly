// SPDX-License-Identifier: MPL-2.0
/** A catalog preview of every glyph in one set, including custom symbols. */
import type { ClipboardAPI, EmojiAPI } from '@lolly-tools/core/host-v1';
import type { EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { applyEmojiCategories, filterEmojiSet, loadEmojiSet } from '../lib/emoji-set.ts';
import type { EmojiSetArt, EmojiSetArtwork, EmojiSetEntry } from '../lib/emoji-set.ts';
import { EMOJI_CATEGORY_IDS, EMOJI_CATEGORY_LABELS, emojiCategoryIndex, emojiCategoryValue } from '../lib/emoji-categories.ts';
import { tRaw as t } from '../i18n.ts';
import './emoji-set-browser.css';

interface BrowserHost {
  emoji?: EmojiAPI;
  clipboard: Pick<ClipboardAPI, 'writeText'>;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Parse one admitted emoji SVG into a node this document can hold, or null if the
 *  parser refuses it. Never HTML: an XML document cannot carry markup of its own. */
function parseInlineSvg(markup: string): SVGElement | null {
  try {
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const root = parsed.documentElement;
    if (root?.nodeName !== 'svg' || parsed.querySelector('parsererror')) return null;
    const node = document.importNode(root, true) as unknown as SVGElement;
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    return node;
  } catch { return null; }
}

function button(text: string): HTMLButtonElement {
  const el = element('button', 'btn', text);
  el.type = 'button';
  return el;
}

class EmojiSetBrowser {
  readonly root = element('section', 'emoji-set-browser');
  readonly search = element('input');
  readonly filter = element('select');
  readonly categories = element('optgroup');
  readonly count = element('p', 'emoji-set-count');
  readonly grid = element('div', 'emoji-set-grid');
  readonly empty = element('p', 'emoji-set-empty');
  readonly detail = element('div', 'emoji-set-detail');
  readonly large = element('span', 'emoji-set-large');
  readonly label = element('strong');
  readonly code = element('code');
  readonly copy = button(t('Copy emoji'));
  readonly message = element('span', 'emoji-set-message');
  readonly ready: Promise<void>;
  private host: BrowserHost;
  private pin: EmojiPackPinV1;
  private stopped = false;
  private set: EmojiSetArtwork | null = null;
  private selected: EmojiSetEntry | null = null;
  private selectedButton: HTMLButtonElement | null = null;
  private focused: HTMLButtonElement | null = null;
  private observer: IntersectionObserver | null = null;
  private cells = new Map<HTMLButtonElement, EmojiSetEntry>();
  private pending = new Set<HTMLButtonElement>();
  private drawing = false;

  constructor(container: HTMLElement, host: BrowserHost, pin: EmojiPackPinV1) {
    this.host = host;
    this.pin = pin;
    this.build();
    container.replaceChildren(this.root);
    this.ready = this.load();
  }

  private build(): void {
    this.root.setAttribute('aria-label', t('Browse emoji set'));
    const heading = element('h3', '', t('Browse the full set'));
    this.search.type = 'search';
    this.search.placeholder = t('Search by name, emoji or code');
    this.search.setAttribute('aria-label', t('Search emoji set'));
    this.search.autocomplete = 'off';
    this.search.addEventListener('input', () => this.render());
    this.filter.setAttribute('aria-label', t('Show'));
    // Two ways to narrow the same list, so one control with two labelled groups
    // rather than two: what KIND of glyph, and which Unicode CATEGORY - the same
    // nine the text selector wears as tabs. The category group is built here and
    // stays disabled until its dataset has loaded (loadCategories below), so the
    // control never offers a filter it cannot yet answer.
    const kinds = element('optgroup');
    kinds.label = t('Glyph type');
    for (const [value, label] of [['all', t('All glyphs')], ['emoji', t('Emoji without skin tones')], ['tones', t('Skin tones')], ['custom', t('Custom symbols')]]) {
      const option = element('option', '', label);
      option.value = value!;
      kinds.append(option);
    }
    this.categories.label = t('Category');
    this.categories.disabled = true;
    for (const id of EMOJI_CATEGORY_IDS) {
      const option = element('option', '', t(EMOJI_CATEGORY_LABELS[id]));
      option.value = emojiCategoryValue(id);
      this.categories.append(option);
    }
    this.filter.append(kinds, this.categories);
    this.filter.addEventListener('change', () => this.render());
    const sizeLabel = element('label', 'emoji-set-size', t('Size'));
    const size = element('input');
    size.type = 'range'; size.min = '44'; size.max = '88'; size.value = '556';
    size.addEventListener('input', () => this.root.style.setProperty('--emoji-set-cell', `${size.value}px`));
    sizeLabel.append(size);
    const controls = element('div', 'emoji-set-controls');
    controls.append(this.filter, sizeLabel);
    const header = element('div', 'emoji-set-header');
    this.count.setAttribute('role', 'status');
    header.append(heading, this.search, controls, this.count);
    this.grid.setAttribute('role', 'group');
    this.grid.setAttribute('aria-label', t('Glyphs'));
    this.grid.addEventListener('keydown', event => this.navigate(event));
    this.grid.addEventListener('click', event => {
      const cell = (event.target as Element).closest<HTMLButtonElement>('button');
      if (cell && this.cells.has(cell)) this.select(cell);
    });
    this.grid.addEventListener('focusin', event => {
      const cell = event.target as HTMLButtonElement;
      if (!this.cells.has(cell)) return;
      if (this.focused) this.focused.tabIndex = -1;
      cell.tabIndex = 0;
      this.focused = cell;
      this.queue(cell);
    });
    // Arrow keys and touch browsing belong to this surface, not asset paging.
    this.root.addEventListener('keydown', event => {
      if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') event.stopPropagation();
    });
    this.root.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
    this.empty.setAttribute('role', 'status');
    const info = element('div', 'emoji-set-info');
    info.append(this.label, this.code, this.copy, this.message);
    this.message.setAttribute('role', 'status');
    this.copy.addEventListener('click', () => { void this.copySelected(); });
    this.detail.append(this.large, info);
    this.detail.hidden = true;
    const scroll = element('div', 'emoji-set-scroll');
    scroll.append(this.grid, this.empty);
    this.root.append(header, scroll, this.detail);
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) this.queue(entry.target as HTMLButtonElement);
      }, { root: scroll, rootMargin: '120px' });
    }
  }

  private async load(): Promise<void> {
    this.root.setAttribute('aria-busy', 'true');
    this.empty.replaceChildren(document.createTextNode(t('Loading the full emoji set…')));
    this.search.disabled = this.filter.disabled = true;
    try {
      const set = await loadEmojiSet(this.host.emoji, this.pin);
      if (this.stopped) { set.destroy(); return; }
      this.set = set;
      this.search.disabled = this.filter.disabled = false;
      for (const option of [...this.filter.options].filter(o => o.parentElement !== this.categories)) {
        option.hidden = option.value !== 'all' && !set.entries.some(entry => entry.kind === option.value);
      }
      this.render();
      void this.loadCategories(set);
    } catch {
      if (this.stopped) return;
      const retry = button(t('Try again'));
      retry.addEventListener('click', () => { void this.load(); });
      this.empty.replaceChildren(document.createTextNode(t('This set could not be loaded. Check your connection and try again.')), retry);
    } finally {
      if (!this.stopped) this.root.setAttribute('aria-busy', 'false');
    }
  }

  /**
   * Bring the category filter in once its dataset resolves. Deliberately AFTER the
   * first render and never awaited by it: the list is complete and searchable
   * without categories, and half a megabyte of emoji data must not stand between a
   * person and the set they opened. Each category is offered only where the set
   * actually has glyphs in it, and the current selection is left alone.
   */
  private async loadCategories(set: EmojiSetArtwork): Promise<void> {
    const lookup = await emojiCategoryIndex();
    if (this.stopped || this.set !== set || !lookup.size) return;
    applyEmojiCategories(set.entries, lookup);
    const present = new Set(set.entries.map(entry => entry.category));
    for (const option of [...this.categories.children] as HTMLOptionElement[]) {
      option.hidden = !present.has(option.value.slice(6) as never);
    }
    this.categories.disabled = [...this.categories.children].every(o => (o as HTMLOptionElement).hidden);
  }

  private render(): void {
    if (!this.set || this.stopped) return;
    const matches = filterEmojiSet(this.set.entries, this.search.value, this.filter.value);
    this.count.textContent = t('{shown} of {total} glyphs', { shown: matches.length.toLocaleString(), total: this.set.entries.length.toLocaleString() });
    this.observer?.disconnect();
    this.pending.clear();
    this.cells.clear();
    this.focused = this.selectedButton = null;
    const fragment = document.createDocumentFragment();
    for (const entry of matches) {
      const cell = button('');
      cell.className = 'emoji-set-cell btn';
      cell.setAttribute('aria-label', entry.glyph.label);
      cell.title = entry.glyph.label;
      cell.setAttribute('aria-pressed', String(entry === this.selected));
      cell.tabIndex = -1;
      cell.dataset.key = entry.key;
      if (entry === this.selected) this.selectedButton = cell;
      this.cells.set(cell, entry);
      fragment.append(cell);
    }
    this.grid.replaceChildren(fragment);
    this.grid.parentElement!.scrollTop = 0;
    this.empty.textContent = t('No glyphs match your search.');
    this.empty.hidden = matches.length > 0;
    this.focused = this.selectedButton ?? this.cells.keys().next().value ?? null;
    if (this.focused) this.focused.tabIndex = 0;
    for (const cell of this.cells.keys()) {
      if (this.observer) this.observer.observe(cell);
      else this.queue(cell);
    }
    if (!this.selectedButton) {
      this.selected = null;
      this.detail.hidden = true;
      if (this.focused) this.select(this.focused);
    }
  }

  private queue(cell: HTMLButtonElement): void {
    this.observer?.unobserve(cell);
    if (cell.dataset.drawn || !this.cells.has(cell) || this.stopped) return;
    this.pending.add(cell);
    void this.draw();
  }

  private async draw(): Promise<void> {
    if (this.drawing || !this.set) return;
    this.drawing = true;
    try {
      while (this.pending.size && !this.stopped) {
        const batch = [...this.pending].slice(0, 8);
        await Promise.all(batch.map(async cell => {
          this.pending.delete(cell);
          const entry = this.cells.get(cell);
          if (!entry) return;
          const art = await this.set!.art(entry);
          if (this.stopped || !this.cells.has(cell)) return;
          this.paint(cell, art);
          cell.dataset.drawn = 'true';
        }));
        // Give scrolling and typing a turn between artwork batches.
        if (this.pending.size) await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally { this.drawing = false; }
  }

  /**
   * Draw one prepared glyph.
   *
   * Single-ink artwork goes in INLINE, because that is the only way its
   * `currentColor` paints can see the surrounding text colour - an `<svg>` behind
   * an `<img>` is its own document and inherits nothing, so a monochrome set drew
   * black on black in a dark theme and needed a filled plate to be visible at all.
   * Inline, the glyph simply follows the theme and stays legible on either side of
   * a switch. Everything else stays an `<img>`: colour artwork has its own palette,
   * and the separate document is worth keeping where it buys something.
   *
   * The markup is parsed as XML, never assigned as HTML: it comes from the engine's
   * admitted subset, and going through the XML parser keeps that the only thing
   * this can ever build.
   */
  private paint(target: HTMLElement, art: EmojiSetArt | null): void {
    const inline = art?.ink ? parseInlineSvg(art.ink) : null;
    target.classList.toggle('is-ink', !!inline);
    if (inline) {
      target.replaceChildren(inline);
    } else if (art) {
      const img = element('img');
      img.alt = ''; img.src = art.url; img.draggable = false;
      target.replaceChildren(img);
    } else {
      const missing = element('span', 'emoji-set-missing', t('Preview unavailable'));
      target.replaceChildren(missing);
    }
  }

  private select(cell: HTMLButtonElement): void {
    const entry = this.cells.get(cell);
    if (!entry || !this.set) return;
    this.selectedButton?.setAttribute('aria-pressed', 'false');
    this.selected = entry;
    this.selectedButton = cell;
    cell.setAttribute('aria-pressed', 'true');
    this.detail.hidden = false;
    this.label.textContent = entry.glyph.label;
    this.code.textContent = entry.text ? entry.key.split('-').map(hex => `U+${hex.toUpperCase()}`).join(' ') : entry.key;
    this.copy.textContent = entry.text ? t('Copy emoji') : t('Copy symbol ID');
    this.message.textContent = '';
    this.large.replaceChildren();
    this.large.setAttribute('role', 'img');
    this.large.setAttribute('aria-label', entry.glyph.label);
    this.queue(cell);
    void this.set.art(entry).then(art => {
      if (!this.stopped && this.selected === entry) this.paint(this.large, art);
    });
  }

  private async copySelected(): Promise<void> {
    const entry = this.selected;
    if (!entry) return;
    try {
      await this.host.clipboard.writeText(entry.text || entry.key);
      if (!this.stopped && this.selected === entry) this.message.textContent = t('Copied');
    } catch {
      if (!this.stopped && this.selected === entry) this.message.textContent = t('Could not copy. Try again.');
    }
  }

  private navigate(event: KeyboardEvent): void {
    const cell = event.target as HTMLButtonElement;
    if (!this.cells.has(cell)) return;
    const cells = [...this.cells.keys()];
    const current = cells.indexOf(cell);
    const columns = Math.max(1, getComputedStyle(this.grid).gridTemplateColumns.split(/\s+/).length);
    const rtl = getComputedStyle(this.grid).direction === 'rtl';
    const step: Record<string, number> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -columns, ArrowDown: columns };
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1
      : step[event.key] !== undefined ? Math.max(0, Math.min(cells.length - 1, current + step[event.key]!)) : null;
    if (index === null) return;
    event.preventDefault();
    const target = cells[index]!;
    target.focus();
    this.select(target);
  }

  destroy(): void {
    this.stopped = true;
    this.observer?.disconnect();
    this.pending.clear();
    this.cells.clear();
    this.set?.destroy();
    this.root.remove();
  }
}

export function mountEmojiSetBrowser(container: HTMLElement, host: BrowserHost, pin: EmojiPackPinV1): { ready: Promise<void>; destroy(): void } {
  return new EmojiSetBrowser(container, host, pin);
}
