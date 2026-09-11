// SPDX-License-Identifier: MPL-2.0
import { t } from '../../i18n.ts';
import { escape as esc } from '../../utils.ts';
import type { BrandEditorHandle } from '../brand-editor.ts';
import { setupMobileSheet, type MobileSheetHandle } from '../mobile-sheet.ts';
import { swatchTile } from '../swatches.ts';

// ── Mobile palette sheet (≤640px, Colours room only) ─────────────────────────
// A fixed bottom sheet + sibling grip (both DIRECT children of `.start`, which
// the CSS specificity depends on - see brand-studio.css) mirroring the
// COMMITTED palette so it stays visible while the derive/generate panels
// scroll; the desktop split side pane serves ≥1100px, this serves phones. The
// mirror is READ-ONLY and never reparents live tiles: tapping a chip snaps the
// sheet to peek FIRST, then centres the real [data-be-tile] and forwards a
// click, so the swatch editor opens on the real grid above the peek strip.
// It re-renders off the palette-change seam (editor.onPalette - fired from
// BOTH repaintPalette and persist(), double-fires included), by re-reading the
// grid the editor just painted - the same walkSwatches output, same theme.
export interface PaletteSheet {
  /** Fold an expanded sheet back to peek; true when the Esc was consumed. */
  collapse: () => boolean;
  teardown: () => void;
}

export function mountPaletteSheet(
  shell: HTMLElement,
  editor: BrandEditorHandle,
  editorRoot: HTMLElement
): PaletteSheet {
  const sheet = document.createElement('div');
  sheet.className = 'stu-sheet';
  sheet.setAttribute('role', 'region');
  sheet.setAttribute('aria-label', esc(t('The palette')));
  sheet.innerHTML = `
    <div class="stu-sheet-head">
      <div class="stu-sheet-strip" data-stu-strip aria-label="${esc(t('Brand palette'))}"></div>
    </div>
    <div class="stu-sheet-body" data-stu-groups></div>`;
  const grip = document.createElement('button');
  grip.type = 'button';
  grip.className = 'stu-sheet-grip';
  grip.setAttribute('aria-label', esc(t('Drag to resize the palette, tap to expand')));
  shell.append(sheet, grip);

  const stripEl = sheet.querySelector<HTMLElement>('[data-stu-strip]')!;
  const groupsEl = sheet.querySelector<HTMLElement>('[data-stu-groups]')!;
  let handle: MobileSheetHandle | null = null;

  const chipHtml = (tile: HTMLElement): string => {
    const sw = tile.style.getPropertyValue('--sw').trim() || 'transparent';
    const label = tile.getAttribute('aria-label') ?? '';
    return swatchTile({ label, hex: sw }, { size: 'sm', idx: tile.dataset.beTile ?? '' });
  };
  const render = (): void => {
    let stripHtml = '',
      bodyHtml = '';
    editorRoot.querySelectorAll<HTMLElement>('[data-be-pal] .be-pal-group').forEach((g) => {
      // The group label's first node is the name text (a count <span> follows).
      const name =
        g.querySelector('.be-pal-group-label')?.firstChild?.textContent?.trim() ?? t('Colours');
      const chips = [...g.querySelectorAll<HTMLElement>('[data-be-tile]')].map(chipHtml).join('');
      if (!chips) return;
      stripHtml += chips;
      bodyHtml += `
        <div class="stu-sheet-group">
          <span class="stu-sheet-group-label">${esc(name)}</span>
          <div class="stu-sheet-grid">${chips}</div>
        </div>`;
    });
    stripEl.innerHTML = stripHtml;
    groupsEl.innerHTML = bodyHtml;
    syncMarks();
    handle?.refresh(); // the peek strip's height may have changed - re-measure
  };
  // Multi-select state lives on the real tiles; the mirror only reflects it.
  // Re-read after every render and after a forwarded tap, so collecting from
  // the sheet is visible in the sheet, not just in the (off-screen) grid.
  function syncMarks(): void {
    sheet.querySelectorAll<HTMLElement>('[data-stu-tile]').forEach((chip) => {
      const src = editorRoot.querySelector<HTMLElement>(`[data-be-tile="${chip.dataset.stuTile}"]`);
      chip.classList.toggle('is-multi', !!src?.classList.contains('is-multi'));
      const pressed = src?.getAttribute('aria-pressed');
      if (pressed != null) chip.setAttribute('aria-pressed', pressed);
      else chip.removeAttribute('aria-pressed');
    });
  }
  render(); // populate BEFORE the driver mounts so its first peek measure is real

  handle = setupMobileSheet(shell, sheet, grip, {
    anchor: 'bottom',
    initial: 'peek', // keeps the sheet always visible without covering the page
    names: {
      heightVar: '--stu-sheet-h',
      stateAttr: 'data-stu-sheet',
      peekVar: '--stu-peek-h',
      draggingClass: 'is-stu-sheet-dragging',
      headerSel: '.stu-sheet-head',
    },
  });

  // The driver's grip handling is pointer-only, so keyboard activation
  // (Enter/Space - a click with detail 0 and no pointer sequence) would
  // otherwise do nothing on a focusable button. Step through the stops with
  // the same bounce as a tap; real pointer taps (detail ≥ 1) already went
  // through the driver's pointerup, so they're ignored here.
  let keyDir: 1 | -1 = 1;
  grip.addEventListener('click', (e) => {
    if (e.detail !== 0 || !handle) return;
    const states = ['peek', 'half', 'full'] as const;
    const idx = Math.max(0, states.indexOf(handle.state()));
    if (idx === 0) keyDir = 1;
    else if (idx === states.length - 1) keyDir = -1;
    handle.setState(states[idx + keyDir]!);
  });

  // The mirror supports previews/settings only; it must not cover the real palette.
  const palette = editorRoot.querySelector('.be-palette');
  const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    const visible = entries.some(entry => entry.isIntersecting);
    shell.toggleAttribute('data-palette-visible', visible);
    if (!visible) handle?.refresh();
  });
  if (palette) visibility?.observe(palette);

  const unsubPalette = editor.onPalette(render);
  const refresh = (): void => handle?.refresh();
  const mql = window.matchMedia('(max-width: 640px)');
  window.addEventListener('orientationchange', refresh);
  mql.addEventListener('change', refresh); // a display:none-at-mount head measures 0 - re-measure when the sheet appears

  // Tap = navigate, not edit-in-place.
  sheet.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-stu-tile]');
    if (!chip) return;
    handle?.setState('peek');
    const tile = editorRoot.querySelector<HTMLElement>(`[data-be-tile="${chip.dataset.stuTile}"]`);
    if (!tile) return;
    // The tile's palette group is a <details> the user may have folded - a
    // hidden tile can't be scrolled to or anchor the editor popover, so unfold.
    const group = tile.closest<HTMLDetailsElement>('details.be-pal-group');
    if (group && !group.open) group.open = true;
    tile.scrollIntoView({ block: 'center' });
    tile.click();
    requestAnimationFrame(syncMarks); // a select-mode tap toggled the tile - reflect it here
  });

  return {
    collapse: () => {
      if (!mql.matches || !handle || handle.state() === 'peek') return false;
      handle.setState('peek');
      return true;
    },
    teardown: () => {
      unsubPalette();
      visibility?.disconnect();
      shell.removeAttribute('data-palette-visible');
      window.removeEventListener('orientationchange', refresh);
      mql.removeEventListener('change', refresh);
      handle?.teardown();
      sheet.remove();
      grip.remove();
    },
  };
}
