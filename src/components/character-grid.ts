// SPDX-License-Identifier: MPL-2.0
import './character-grid.css';
export interface CharacterChoice {
  value: string;
  label: string;
}
/** Bounded, paged symbol choices with native buttons and arrow-key navigation. */
export function mountCharacterGrid(
  container: HTMLElement,
  options: {
    onPick: (value: string) => void;
    onPreview?: (choice: CharacterChoice) => void;
    pageSize?: number;
  }
): { set(choices: CharacterChoice[], fontFamily: string): void; destroy(): void } {
  const abort = new AbortController();
  const pageSize = Math.max(1, Math.min(120, options.pageSize ?? 120));
  let picked = '';
  let choices: CharacterChoice[] = [],
    page = 0;
  const cells = document.createElement('div');
  cells.className = 'character-grid';
  cells.setAttribute('role', 'group');
  cells.setAttribute('aria-label', 'Characters');
  const nav = document.createElement('div');
  nav.className = 'character-grid-nav';
  const previous = document.createElement('button'),
    next = document.createElement('button'),
    status = document.createElement('span');
  previous.type = next.type = 'button';
  previous.className = next.className = 'btn';
  previous.textContent = 'Previous';
  next.textContent = 'Next';
  status.setAttribute('role', 'status');
  nav.append(previous, status, next);
  container.replaceChildren(cells, nav);
  const render = (): void => {
    cells.replaceChildren();
    choices.slice(page * pageSize, (page + 1) * pageSize).forEach((choice, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--ghost character-grid-cell';
      button.setAttribute('aria-pressed', String(choice.value === picked));
      button.textContent = /^\p{Mark}/u.test(choice.value)
        ? `◌${choice.value}`
        : /^[\p{White_Space}\p{Default_Ignorable_Code_Point}]+$/u.test(choice.value)
          ? 'U+' + choice.value.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
          : choice.value;
      if (button.textContent.startsWith('U+')) button.classList.add('character-grid-invisible');
      button.title = choice.label;
      button.setAttribute('aria-label', choice.label);
      button.tabIndex = i === 0 ? 0 : -1;
      button.addEventListener('pointerenter', () => options.onPreview?.(choice), {
        signal: abort.signal,
      });
      button.addEventListener('focus', () => options.onPreview?.(choice), { signal: abort.signal });
      button.addEventListener(
        'click',
        () => {
          picked = choice.value;
          cells.querySelectorAll('button').forEach((cell) => {
            cell.setAttribute('aria-pressed', String(cell === button));
          });
          options.onPreview?.(choice);
          options.onPick(choice.value);
        },
        {
          signal: abort.signal,
        }
      );
      cells.append(button);
    });
    previous.disabled = page === 0;
    next.disabled = (page + 1) * pageSize >= choices.length;
    nav.hidden = choices.length <= pageSize;
    status.textContent = choices.length
      ? `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, choices.length)} of ${choices.length}`
      : 'No matching characters';
  };
  previous.addEventListener(
    'click',
    () => {
      page--;
      render();
    },
    { signal: abort.signal }
  );
  next.addEventListener(
    'click',
    () => {
      page++;
      render();
    },
    { signal: abort.signal }
  );
  cells.addEventListener(
    'keydown',
    (event) => {
      const buttons = Array.from(cells.querySelectorAll('button')),
        at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (at < 0) return;
      const first = buttons[0]!.getBoundingClientRect();
      const gap = Number.parseFloat(getComputedStyle(cells).columnGap) || 0;
      const columns = Math.max(
        1,
        Math.round((cells.clientWidth + gap) / Math.max(1, first.width + gap))
      );
      const move: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: columns,
        ArrowUp: -columns,
        Home: -at,
        End: buttons.length - at - 1,
      };
      if (move[event.key] === undefined) return;
      event.preventDefault();
      buttons[at]!.tabIndex = -1;
      const target = buttons[Math.max(0, Math.min(buttons.length - 1, at + move[event.key]!))]!;
      target.tabIndex = 0;
      target.focus();
    },
    { signal: abort.signal }
  );
  return {
    set(values, fontFamily) {
      choices = values;
      page = 0;
      cells.style.fontFamily = fontFamily;
      render();
    },
    destroy() {
      abort.abort();
      container.replaceChildren();
    },
  };
}
