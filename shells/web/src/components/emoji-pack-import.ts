// SPDX-License-Identifier: MPL-2.0
/** Import a versioned pack with the same admission checks as the renderer. */
import type { EmojiAPI, HostV1 } from '@lolly-tools/core/host-v1';
import type { EmojiSetInfoV1, EmojiStyleV1, EmojiPackManifestV1 } from '@lolly-tools/core/emoji-v1';
import { EMOJI_BUNDLE_MAX_BYTES } from '@lolly-tools/core/emoji-v1';
import { tRaw } from '../i18n.ts';

export function mountEmojiPackImport(root: HTMLElement, api: EmojiAPI, installed: (info: EmojiSetInfoV1) => void): void {
  if (!api.install) return;
  const row = document.createElement('div');
  row.className = 'field-row';
  const titleId = `emoji-import-${Math.random().toString(36).slice(2, 8)}`;
  const title = document.createElement('span'); title.className = 'field-label'; title.id = titleId; title.textContent = tRaw('Import emoji set');
  // The native file control never shows ("No file chosen"): the input is visually
  // hidden and kept out of the tab order and the accessibility tree, and a
  // standard button, named by the row label and its own text, opens it.
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.className = 'visually-hidden'; input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
  const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'btn';
  choose.id = `${titleId}-choose`;
  choose.textContent = tRaw('Choose an emoji set…');
  choose.setAttribute('aria-labelledby', `${titleId} ${choose.id}`);
  choose.addEventListener('click', () => input.click());
  const status = document.createElement('p'); status.className = 'emoji-style-note'; status.setAttribute('role', 'status');
  status.textContent = tRaw('Import a Lolly emoji set with its artwork, version and source credits. Earlier versions stay available to saved documents.');
  input.addEventListener('change', () => {
    const file = input.files?.[0]; if (!file) return;
    input.disabled = true; choose.disabled = true; status.textContent = tRaw('Checking emoji artwork…');
    void (async () => {
      if (file.size > EMOJI_BUNDLE_MAX_BYTES) throw new Error(tRaw('Emoji pack exceeds the 64 MiB limit.'));
      const info = await api.install!(new Uint8Array(await file.arrayBuffer()));
      installed(info);
    })().catch(error => { status.textContent = String(error instanceof Error ? error.message : error); })
      .finally(() => { input.disabled = false; choose.disabled = false; input.value = ''; });
  });
  row.append(title, choose, input); root.append(row, status);
}

/** An editable pack export retains original artwork and all source notices. */
export function mountEmojiPackExport(root: HTMLElement, host: HostV1, style: EmojiStyleV1 | null): void {
  if (!style || !host.emoji) return;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = tRaw('Export emoji set');
  const status = document.createElement('p'); status.setAttribute('role', 'status'); root.append(button, status);
  button.addEventListener('click', () => {
    button.disabled = true;
    void (async () => {
      const bytes = await host.emoji!.manifest(style.primary);
      if (!bytes) throw new Error(tRaw('This emoji set is unavailable.'));
      const manifest = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const pack = JSON.parse(manifest) as EmojiPackManifestV1;
      const artwork: Record<string, string> = Object.create(null);
      let size = bytes.length;
      for (const glyph of pack.glyphs) {
        const svg = await host.emoji!.artwork(style.primary, glyph.asset);
        if (!svg) throw new Error(tRaw('This emoji set is incomplete.'));
        size += svg.length;
        if (size > EMOJI_BUNDLE_MAX_BYTES) throw new Error(tRaw('Emoji pack exceeds the 64 MiB limit.'));
        artwork[glyph.asset.url] = new TextDecoder('utf-8', { fatal: true }).decode(svg);
      }
      const blob = new Blob([JSON.stringify({ schemaVersion: 1, kind: 'emoji-pack-bundle', manifest, artwork })], { type: 'application/json' });
      if (blob.size > EMOJI_BUNDLE_MAX_BYTES) throw new Error(tRaw('Emoji pack exceeds the 64 MiB limit.'));
      await host.export.download(blob, `${pack.family}-${pack.style}-${pack.version}.emoji.json`);
    })().catch(error => { status.textContent = String(error instanceof Error ? error.message : error); }).finally(() => { button.disabled = false; });
  });
}
