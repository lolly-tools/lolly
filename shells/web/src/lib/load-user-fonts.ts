// SPDX-License-Identifier: MPL-2.0
/**
 * Load user-uploaded fonts from IndexedDB and inject @font-face rules.
 * Called during app initialization so fonts are available before the UI renders.
 */

import { getInstalledFonts } from './font-asset-handler.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { debug } from './debug.ts';

const FONT_STYLE_ID = 'user-fonts-style';

export async function loadUserFonts(host: HostV1): Promise<void> {
  try {
    debug('[load-user-fonts] Loading user fonts...');

    // Remove existing style tag if present
    const existingStyle = document.getElementById(FONT_STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    const fonts = await getInstalledFonts(host);
    if (!fonts.length) {
      debug('[load-user-fonts] No user fonts to load');
      return;
    }

    debug('[load-user-fonts] Loading', fonts.length, 'fonts');

    // Create style tag for @font-face rules
    const style = document.createElement('style');
    style.id = FONT_STYLE_ID;
    let css = '';

    // For each installed font, load the blob and create a @font-face rule
    for (const font of fonts) {
      try {
        debug('[load-user-fonts] Loading font blob for', font.family);

        if (!host.state || !host.state.load) {
          console.warn('[load-user-fonts] host.state not available');
          continue;
        }

        const stored = (await host.state.load('font-asset:' + font.id)) as
          | { blob: Blob; format: string; fileSize: number } | null | undefined;

        if (stored?.blob) {
          const blobUrl = URL.createObjectURL(stored.blob);
          debug('[load-user-fonts] Created blob URL for', font.family);

          // Determine font format
          const format = stored.format === 'woff2' ? 'woff2' :
                        stored.format === 'woff' ? 'woff' :
                        stored.format === 'otf' ? 'embedded-opentype' :
                        stored.format === 'ttf' ? 'truetype' : 'embedded-opentype';

          // Create @font-face rule
          const fontStyle = font.style === 'italic' ? 'italic' : 'normal';
          css += `
            @font-face {
              font-family: '${font.family.replace(/'/g, "\\'")}';
              src: url('${blobUrl}') format('${format}');
              font-weight: ${font.weight};
              font-style: ${fontStyle};
              font-display: swap;
            }
          `;
        }
      } catch (e) {
        console.error('[load-user-fonts] Error loading font', font.family, ':', e instanceof Error ? e.message : e);
      }
    }

    if (css) {
      style.textContent = css;
      document.head.appendChild(style);
      debug('[load-user-fonts] ✓ User fonts loaded and @font-face rules injected');
    }
  } catch (e) {
    console.error('[load-user-fonts] Error:', e instanceof Error ? e.message : e);
  }
}
