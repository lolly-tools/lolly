// SPDX-License-Identifier: MPL-2.0
/**
 * The in-app docs reader's clipboard writer for Copy (lib/docs-enhance.ts).
 *
 * host.clipboard.writeText falls back to document.execCommand('copy') without reading its
 * result (bridge/clipboard.ts), so a refused copy can resolve as a success. The docs
 * promise to report only a copy that happened, so this writer uses the host bridge only
 * when the async Clipboard API is present, where the bridge's promise reflects the real
 * outcome, and refuses otherwise. The reader then offers text selection instead.
 * Tool-facing clipboard behaviour is unchanged.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';
import type { DocsEnhanceLabels } from './docs-enhance.ts';

export function docsClipboardWriter(host: Pick<HostV1, 'clipboard'>): (text: string) => Promise<void> {
  return (text: string) =>
    typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'
      ? host.clipboard.writeText(text)
      : Promise.reject(new Error('clipboard unavailable'));
}

/** Copy's words for the in-app readers, in the app's language. The static site carries
 *  the same words per locale on the article (docs/build.ts readingAttr). */
export function docsCopyLabels(): DocsEnhanceLabels {
  return {
    copy: t('Copy'),
    copied: t('Copied to clipboard'),
    copyFailed: t('Copy did not work'),
    help: t('Select the text, then use your device’s copy command.'),
    select: t('Select text'),
    selected: t('Text selected. Use your device’s copy command.'),
    copyNamed: (label) => tRaw('Copy {label}', { label }),
  };
}
