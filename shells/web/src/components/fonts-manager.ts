// SPDX-License-Identifier: MPL-2.0
/**
 * Font upload and management component.
 * Can be mounted in brand config or catalog contexts.
 */

// Styles: the `.fonts-*` block lives in styles/parts/brand-studio.css, which the
// only mounter (lib/brand-editor.ts) already imports. There WAS a second copy in
// styles/parts/fonts-manager.css - same layer, same specificity, so which one won
// depended on Vite's chunk order, and the copies had drifted onto a
// `var(--text-secondary)` token that is defined nowhere. One home now.
import { installFontAsset, getInstalledFonts, removeFontAsset, refreshFontRegistry } from '../lib/font-asset-handler.ts';
import { validateFontFile } from '../lib/font-utils.ts';
import { setPrimaryFont, setMonoFont } from '../user-fonts.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';

export interface FontsManagerOptions {
  host: HostV1;
  showBranding?: boolean;
  onFontInstalled?: (fontFamily: string) => void;
}

const errText = (e: unknown): string => String((e as { message?: unknown } | null)?.message ?? e);

/** A failure the user needs to know about. This component used to narrate its
 *  whole lifecycle to the console (24 calls, uniquely in the shell) and reported
 *  real failures the same way - i.e. nowhere the user could see. Errors go to the
 *  live region, the way lib/brand-editor.ts reports its own. */
const fail = (message: string): void => { announce(message, { assertive: true }); };

export async function mountFontsManager(container: HTMLElement, opts: FontsManagerOptions): Promise<void> {
  const { host, onFontInstalled } = opts;

  container.innerHTML = `
    <div class="fonts-manager">
      <div class="fonts-upload" role="region" aria-label="Font upload">
        <!-- The browse button is a SIBLING of the label, never a child: interactive
             content inside a <label> is invalid, and it gave the same action two
             focusable targets that fought over the click. The label (with its
             visually-hidden, still-focusable input) is the drop zone AND a target
             in its own right; the button is the explicit second affordance. -->
        <label class="fonts-upload-drop" data-fonts-drop>
          <input type="file" multiple class="fonts-upload-file visually-hidden" accept=".ttf,.otf,.woff,.woff2"
            aria-label="Upload font files (TTF, OTF, WOFF, WOFF2)">
          <span class="fonts-upload-area">
            <span class="fonts-upload-icon" aria-hidden="true">📤</span>
            <span class="fonts-upload-text">
              <strong>Drag and drop font files here</strong>
            </span>
            <span class="fonts-upload-hint">Supports TTF, OTF, WOFF (max 5MB each)</span>
          </span>
        </label>
        <p class="fonts-upload-alt">or <button type="button" class="fonts-upload-btn">click to browse</button></p>
      </div>

      <div class="fonts-list" data-fonts-list aria-label="Installed fonts">
        <div class="fonts-loading">Loading fonts…</div>
      </div>
    </div>
  `;

  const dropZone = container.querySelector<HTMLLabelElement>('[data-fonts-drop]')!;
  const fileInput = container.querySelector<HTMLInputElement>('.fonts-upload-file')!;
  const fontsList = container.querySelector<HTMLElement>('[data-fonts-list]')!;
  const browseBtn = container.querySelector<HTMLButtonElement>('.fonts-upload-btn')!;

  // Click to browse button
  browseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  // Drag and drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropZone.addEventListener(evt, () => {
      dropZone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropZone.addEventListener(evt, () => {
      dropZone.classList.remove('is-dragging');
    });
  });

  // Handle drops and file selection
  const handleFiles = async (files: FileList): Promise<void> => {
    const rejected: string[] = [];
    const validFiles = Array.from(files).filter((f) => {
      const validation = validateFontFile(f);
      if (!validation.valid) { rejected.push(`${f.name} - ${validation.error ?? ''}`.trim()); return false; }
      return true;
    });

    if (!validFiles.length) {
      fail(rejected.length
        ? tRaw("Couldn't add {file}", { file: rejected[0]! })
        : t('No font files to add'));
      return;
    }

    // Disable input while uploading
    fileInput.disabled = true;
    dropZone.classList.add('is-uploading');

    for (const file of validFiles) {
      try {
        const result = await installFontAsset(host, file);
        if (result) {
          announce(tRaw('{family} added', { family: result.family }));
          onFontInstalled?.(result.family);
        } else {
          fail(tRaw("Couldn't read the font in {file}", { file: file.name }));
        }
      } catch (e) {
        fail(tRaw("Couldn't add {file}: {error}", { file: file.name, error: errText(e) }));
      }
    }

    // Refresh registry and list
    try {
      await refreshFontRegistry(host);
      await refreshFontList();
    } catch (e) {
      fail(tRaw("Couldn't refresh your fonts: {error}", { error: errText(e) }));
    }

    fileInput.disabled = false;
    dropZone.classList.remove('is-uploading');
    fileInput.value = '';
  };

  fileInput.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFiles(input.files).catch((err) => {
        fail(tRaw("Couldn't add those fonts: {error}", { error: errText(err) }));
      });
    }
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = (e as DragEvent).dataTransfer;
    if (dt?.files) handleFiles(dt.files);
  });

  // Refresh list of installed fonts
  const refreshFontList = async (): Promise<void> => {
    const fonts = await getInstalledFonts(host);

    if (!fonts.length) {
      fontsList.innerHTML = '<div class="fonts-empty">No fonts installed yet</div>';
      return;
    }

    fontsList.innerHTML = `
      <div class="fonts-items">
        ${fonts
          .map(
            (font) => `
          <div class="fonts-item" data-font-id="${font.id}">
            <div class="fonts-item-name">${font.family}</div>
            <div class="fonts-item-meta">
              <span class="fonts-item-weight">${font.weight}</span>
              <span class="fonts-item-style">${font.style}</span>
              <span class="fonts-item-size">${(font.fileSize / 1024).toFixed(1)}KB</span>
            </div>
            <div class="fonts-item-actions">
              <button type="button" class="fonts-item-btn fonts-set-primary" data-set-primary="${font.id}" aria-label="Set as primary font">Primary</button>
              <button type="button" class="fonts-item-btn fonts-set-mono" data-set-mono="${font.id}" aria-label="Set as mono font">Mono</button>
              <button type="button" class="fonts-item-delete" data-delete-font="${font.id}" aria-label="Delete font">×</button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Attach action handlers
    fontsList.querySelectorAll<HTMLButtonElement>('[data-set-primary]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const fontId = btn.dataset.setPrimary!;
        const font = fonts.find(f => f.id === fontId);
        if (font) {
          try {
            await setPrimaryFont(host as unknown as Parameters<typeof setPrimaryFont>[0], font.family);
            onFontInstalled?.(font.family);
            announce(tRaw('{family} is now your primary font', { family: font.family }));
          } catch (e) {
            fail(tRaw("Couldn't set {family} as your primary font: {error}", { family: font.family, error: errText(e) }));
          }
        }
      });
    });

    fontsList.querySelectorAll<HTMLButtonElement>('[data-set-mono]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const fontId = btn.dataset.setMono!;
        const font = fonts.find(f => f.id === fontId);
        if (font) {
          try {
            await setMonoFont(host as unknown as Parameters<typeof setMonoFont>[0], font.family);
            onFontInstalled?.(font.family);
            announce(tRaw('{family} now serves code & data', { family: font.family }));
          } catch (e) {
            fail(tRaw("Couldn't set {family} for code & data: {error}", { family: font.family, error: errText(e) }));
          }
        }
      });
    });

    fontsList.querySelectorAll<HTMLButtonElement>('[data-delete-font]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const fontId = btn.dataset.deleteFont!;
        if (confirm('Delete this font?')) {
          await removeFontAsset(host, fontId);
          await refreshFontRegistry(host);
          await refreshFontList();
        }
      });
    });
  };

  // Initial load
  await refreshFontList();

  // Listen for font changes from other sessions/tabs
  window.addEventListener('lolly:fonts-refreshed', () => {
    refreshFontList();
  });
}
