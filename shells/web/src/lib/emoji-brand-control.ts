// SPDX-License-Identifier: MPL-2.0
/** Emoji typography lives in the same versioned token document as the type roles. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { readEmojiStyle, withEmojiStyle } from '../../../../engine/src/emoji-style.ts';
import { TOKEN_EXT } from '../../../../engine/src/token-ext.ts';
import { mountEmojiStyleControl } from '../components/emoji-style-control.ts';
import { tRaw } from '../i18n.ts';

export function mountBrandEmoji(root: HTMLElement, host: HostV1, doc: () => Record<string, unknown>, commit: (doc: Record<string, unknown>) => void): { update(): void; destroy(): void } {
  const card = document.createElement('details'); card.className = 'be-panel be-emoji-panel';
  const title = document.createElement('summary'); title.textContent = tRaw('Emoji'); card.append(title); root.after(card);
  const body = document.createElement('div'); card.append(body);
  const status = document.createElement('p'); status.setAttribute('role', 'status'); card.append(status);
  const read = () => { const selected = readEmojiStyle(doc()); return selected.status === 'selected' ? selected.style : null; };
  let generation = 0;
  const control = mountEmojiStyleControl(body, { host, mode: 'document', value: read(), onChange(value) {
    if (value && !('primary' in value)) return;
    const mine = ++generation;
    void (async () => {
      const assets = value && host.emoji?.dependencies ? await host.emoji.dependencies([value.primary, ...value.fallbacks]) : [];
      if (mine !== generation) return;
      const next = withEmojiStyle(doc(), value);
      next.$extensions ??= {};
      const ext = next.$extensions as Record<string, unknown>;
      ext[TOKEN_EXT] ??= {};
      const vendor = ext[TOKEN_EXT] as Record<string, unknown>;
      vendor.emojiAssets = assets;
      commit(next); status.textContent = '';
    })().catch(error => { status.textContent = String(error instanceof Error ? error.message : error); control.update(read()); });
  } });
  return { update() { control.update(read()); }, destroy() { generation++; control.destroy(); card.remove(); } };
}
