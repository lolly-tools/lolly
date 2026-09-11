// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { typographyFamilies } from '../../../../../engine/src/tokens.ts';
import { characterFontFiles } from '../../bridge/font-registry.ts';
import { mountCharacterGrid, type CharacterChoice } from '../../components/character-grid.ts';
import { escapeHtml as esc } from '../../lib/html.ts';
import { icon } from '../../lib/icons.ts';
import { wireTabs } from '../../lib/tabs.ts';
import { segHtml } from '../../lib/seg.ts';
export async function mountCharacters(
  container: HTMLElement,
  host: HostV1,
  onInsert: (value: string) => void,
  saved: { recents: string[]; save: (values: string[]) => void }
): Promise<() => void> {
  const abort = new AbortController();
  let generation = 0,
    codepoints: number[] = [],
    family = '',
    recents = saved.recents;
  let emojiCleanup: (() => void) | undefined,
    emojiLoading = false,
    filter = 'symbols',
    kind = 'font';
  const readFamilies = async (): Promise<string[]> => {
    const families: string[] = [];
    for (const slot of ['brand', 'display', 'body', 'heading', 'mono']) {
      try {
        families.push(
          ...typographyFamilies(await host.tokens?.resolve(`{font.${slot}}`)).filter(
            (f) => !['serif', 'sans-serif', 'monospace', 'system-ui'].includes(f)
          )
        );
      } catch {
        /* A design system may omit a typography slot. */
      }
    }
    return [...new Set(families)];
  };
  const available = await readFamilies();
  if (abort.signal.aborted) return () => {};
  const id = `characters-${crypto.randomUUID()}`;
  container.innerHTML = `<div class="text-character-heading"><div><h2>Find a character</h2><p class="text-muted">Pick a symbol or emoji to copy it. Insert it in your text when you’re ready.</p></div><label class="text-font-choice" data-font-label>${icon('font', { className: 'text-icon' })}<span>Font</span><select data-font aria-label="Brand font">${available.map((f) => `<option>${esc(f)}</option>`).join('')}</select></label></div>
    <div class="text-tabs text-character-tabs" role="tablist" aria-label="Character collection"><button type="button" role="tab" aria-selected="true" aria-controls="${id}-font" data-kind="font">${icon('font', { className: 'text-icon' })}Brand characters</button><button type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="${id}-emoji" data-kind="emoji">${icon('smile', { className: 'text-icon' })}Emoji</button></div>
    <div class="text-character-layout"><div class="text-character-browser"><section id="${id}-font" data-glyphs role="tabpanel" aria-label="Brand characters"><label class="text-search-field">${icon('search', { className: 'text-icon' })}<input type="search" data-search aria-label="Find a character" placeholder="Search symbols, names or U+ codes"><button type="button" class="btn btn--ghost text-icon-button" data-clear-search aria-label="Clear character search" hidden>${icon('close', { className: 'text-icon' })}</button></label>
    ${segHtml(
      'character-filter',
      [
        { id: 'symbols', label: 'Symbols' },
        { id: 'letters', label: 'Letters' },
        { id: 'all', label: 'All characters' },
        { id: 'recent', label: 'Recent' },
      ],
      'symbols',
      'Character filter',
      { attr: 'data-character-filter', extraClass: 'text-character-filters' }
    )}
    <p data-font-status class="text-muted" role="status"></p><div data-grid></div><div data-empty-characters class="text-empty-state" hidden><p data-empty-message></p><button class="btn btn--ghost" data-reset>Show all characters</button></div></section><section id="${id}-emoji" role="tabpanel" aria-label="Emoji" data-emoji hidden></section></div>
    <aside class="text-character-detail" aria-label="Character details"><div class="text-glyph-preview" data-glyph-preview aria-hidden="true">${icon('font')}</div><strong data-character-name>Pick a character</strong><span data-character-code class="text-muted">Its name and Unicode code appear here.</span><div class="text-row"><button class="btn btn--primary" data-copy-character disabled>${icon('duplicate', { className: 'text-icon' })}Copy</button><button class="btn btn--ghost" data-insert disabled>${icon('plus', { className: 'text-icon' })}Insert in text</button></div><p data-copied class="text-copy-feedback" role="status" aria-live="polite"></p></aside></div>`;
  const q = <T extends HTMLElement>(selector: string): T => container.querySelector<T>(selector)!;
  let selected = '';
  const toast = document.createElement('div');
  toast.className = 'toast toast--wrap text-character-toast';
  toast.setAttribute('aria-hidden', 'true');
  const toastMessage = document.createElement('span');
  toastMessage.className = 'toast-message';
  toast.append(toastMessage);
  document.body.append(toast);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const feedback = (value: string, message: string): void => {
    if (abort.signal.aborted) return;
    if (selected === value) q('[data-copied]').textContent = message;
    if (matchMedia('(max-width: 760px)').matches) {
      toastMessage.textContent = message;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
    }
  };
  const preview = (choice: CharacterChoice): void => {
    if (selected !== choice.value) q('[data-copied]').textContent = '';
    selected = choice.value;
    const invisible = /^[\p{White_Space}\p{Default_Ignorable_Code_Point}]+$/u.test(selected);
    q('[data-glyph-preview]').textContent = invisible
      ? /^\p{White_Space}+$/u.test(selected)
        ? 'Space'
        : 'Invisible'
      : /^\p{Mark}/u.test(selected)
        ? `◌${selected}`
        : selected;
    q('[data-glyph-preview]').classList.toggle('is-invisible', invisible);
    q('[data-glyph-preview]').style.fontFamily =
      kind === 'emoji'
        ? 'Lolly Emoji, sans-serif'
        : `"${family.replace(/["\\]/g, '')}", sans-serif`;
    q('[data-character-name]').textContent = choice.label.split(' · ')[0]!;
    q('[data-character-code]').textContent = [...selected]
      .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
      .join(' ');
    q<HTMLButtonElement>('[data-copy-character]').disabled = false;
    q<HTMLButtonElement>('[data-insert]').disabled = false;
  };
  const pick = async (value: string): Promise<void> => {
    if (kind === 'emoji') preview({ value, label: 'Emoji' });
    try {
      await host.clipboard.writeText(value);
      if (abort.signal.aborted) return;
      feedback(value, `${value} copied to clipboard`);
      recents = [value, ...recents.filter((c) => c !== value)].slice(0, 48);
      saved.save(recents);
      if (filter === 'recent' && kind === 'font') render();
    } catch {
      feedback(value, 'Clipboard unavailable. Insert into text, then copy from the editor.');
    }
  };
  const grid = mountCharacterGrid(q('[data-grid]'), {
    pageSize: 72,
    onPreview: preview,
    onPick: (value) => {
      void pick(value);
    },
  });
  const nameData = import('../../data/unicode/names.json');
  let names: Record<string, string> = {};
  let ranges: Array<[number, number, string]> = [];
  const label = (cp: number): string =>
    (
      names[cp] ??
      `${ranges.find(([a, b]) => cp >= a && cp <= b)?.[2] ?? 'Character'} ${cp.toString(16)}`
    )
      .toLowerCase()
      .replace(/^./u, (c) => c.toUpperCase());
  const render = (): void => {
    const search = q<HTMLInputElement>('[data-search]').value.trim().toLowerCase();
    q('[data-clear-search]').hidden = !search;
    const values = codepoints
      .filter((cp) => cp >= 32 && !(cp >= 127 && cp <= 159))
      .map((cp) => ({
        cp,
        value: String.fromCodePoint(cp),
        label: `${label(cp)} · U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      }))
      .filter((c) =>
        search
          ? c.value.toLowerCase() === search || c.label.toLowerCase().includes(search)
          : filter === 'recent'
            ? recents.includes(c.value)
            : filter === 'letters'
              ? /[\p{Letter}\p{Mark}]/u.test(c.value)
              : filter === 'symbols'
                ? /[\p{Symbol}\p{Punctuation}]/u.test(c.value) || c.cp === 160
                : true
      );
    if (filter === 'symbols' && !search) {
      const familiar = [...'©®™€£¥→←↑↓×÷±≠≤≥∞✓★•'];
      values.sort((a, b) => {
        const rank = (v: string): number => (familiar.includes(v) ? familiar.indexOf(v) : 1000);
        return rank(a.value) - rank(b.value) || a.cp - b.cp;
      });
    }
    grid.set(values, `"${family.replace(/["\\]/g, '')}", sans-serif`);
    q('[data-empty-characters]').hidden = values.length > 0;
    q('[data-empty-message]').textContent = search
      ? `No characters in this font match “${q<HTMLInputElement>('[data-search]').value}”. Try a name such as “arrow”, or a Unicode code.`
      : filter === 'recent'
        ? 'Your recent character picks will appear here.'
        : 'There are no characters in this group.';
  };
  const load = async (): Promise<void> => {
    const revision = ++generation;
    family = q<HTMLSelectElement>('[data-font]').value;
    q('[data-font-status]').textContent = 'Loading characters from your font…';
    try {
      const data = await nameData;
      if (abort.signal.aborted || revision !== generation) return;
      names = data.default.names as Record<string, string>;
      ranges = data.default.ranges as Array<[number, number, string]>;
      if (!family || !host.text?.characters)
        throw new Error(
          'Add a readable font to your brand to browse its characters. Emoji is ready to use.'
        );
      const files = await characterFontFiles(family);
      if (!files.length)
        throw new Error('This font’s files are unavailable. Choose another font or browse Emoji.');
      const points = await Promise.all(files.map((url) => host.text!.characters!(url)));
      if (abort.signal.aborted || revision !== generation) return;
      codepoints = [...new Set(points.flat())].sort((a, b) => a - b);
      q('[data-font-status]').textContent =
        `${codepoints.length} encoded characters in ${family}. Search covers the whole font.`;
      render();
    } catch (error) {
      if (abort.signal.aborted || revision !== generation) return;
      codepoints = [];
      render();
      q('[data-font-status]').textContent = error instanceof Error ? error.message : String(error);
    }
  };
  q('[data-font]').addEventListener(
    'change',
    () => {
      void load();
    },
    { signal: abort.signal }
  );
  q('[data-search]').addEventListener('input', render, { signal: abort.signal });
  container.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element).closest<HTMLElement>('button');
      if (!target) return;
      if (target.dataset.characterFilter) {
        filter = target.dataset.characterFilter;
        q<HTMLInputElement>('[data-search]').value = '';
        container.querySelectorAll('[data-character-filter]').forEach((el) => {
          el.setAttribute('aria-pressed', String(el === target));
        });
        render();
      } else if (target.hasAttribute('data-clear-search')) {
        q<HTMLInputElement>('[data-search]').value = '';
        render();
        q('[data-search]').focus();
      } else if (target.hasAttribute('data-reset')) {
        container.querySelector<HTMLButtonElement>('[data-character-filter="all"]')!.click();
      } else if (target.hasAttribute('data-copy-character')) void pick(selected);
      else if (target.hasAttribute('data-insert')) onInsert(selected);
    },
    { signal: abort.signal }
  );
  wireTabs(container.querySelector('[aria-label="Character collection"]')!, {
    key: 'kind',
    onSelect: (next) => {
      kind = next;
      const emoji = next === 'emoji';
      q('[data-glyphs]').hidden = emoji;
      q('[data-font-label]').hidden = emoji;
      q('[data-emoji]').hidden = !emoji;
      q('[data-copied]').textContent = '';
      selected = '';
      q('[data-glyph-preview]').textContent = '';
      q('[data-character-name]').textContent = emoji ? 'Pick an emoji' : 'Pick a character';
      q('[data-character-code]').textContent = 'Its Unicode code appears here.';
      q<HTMLButtonElement>('[data-copy-character]').disabled = true;
      q<HTMLButtonElement>('[data-insert]').disabled = true;
      if (emoji && !emojiCleanup && !emojiLoading) {
        emojiLoading = true;
        q('[data-emoji]').textContent = 'Loading emoji…';
        void import('../../components/emoji-picker.ts')
          .then(async ({ mountEmojiBrowser }) => {
            if (abort.signal.aborted) return;
            emojiCleanup = await mountEmojiBrowser(q('[data-emoji]'), (value) => {
              void pick(value);
            });
            if (abort.signal.aborted) emojiCleanup();
          })
          .catch(() => {
            q('[data-emoji]').textContent =
              'Emoji could not load. Switch back to Brand characters and try again.';
          })
          .finally(() => {
            emojiLoading = false;
          });
      }
    },
  });
  const refreshFonts = async (): Promise<void> => {
    const families = await readFamilies();
    if (abort.signal.aborted) return;
    const select = q<HTMLSelectElement>('[data-font]');
    select.replaceChildren(...families.map((font) => new Option(font, font)));
    if (families.includes(family)) select.value = family;
    await load();
  };
  document.addEventListener(
    'lolly:brand-fonts',
    () => {
      void refreshFonts();
    },
    { signal: abort.signal }
  );
  window.addEventListener(
    'lolly:design-system-changed',
    () => {
      void refreshFonts();
    },
    { signal: abort.signal }
  );
  void load();
  return () => {
    abort.abort();
    clearTimeout(toastTimer);
    toast.remove();
    generation++;
    emojiCleanup?.();
    grid.destroy();
    container.replaceChildren();
  };
}
