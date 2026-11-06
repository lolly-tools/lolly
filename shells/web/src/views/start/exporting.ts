// SPDX-License-Identifier: MPL-2.0
/**
 * start: exporting.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { t, tRaw } from '../../i18n.ts';
import { withoutRecordedBrandPage } from '../../../../../engine/src/brand-page-address.ts';
import { playSfx } from '../../lib/sfx.ts';
import { saveBlob } from '../../pro/zip.ts';
import { bindOp, type StartCtx } from './context.ts';

// ── Export (always on) ───────────────────────────────────────────────────────
export const showNote = (start: StartCtx, msg: string, isError = false): void => {
  const { noteEl } = start;
  if (!noteEl) return;
  noteEl.textContent = msg;
  noteEl.classList.toggle('is-error', isError);
  if (msg) {
    setTimeout(() => {
    const noteEl = start.noteEl as NonNullable<StartCtx['noteEl']>;
      if (!noteEl.isConnected || noteEl.textContent !== msg) return;
      noteEl.textContent = '';
    }, 4000);
  }
};
// The tray's surface (lib/design-system/tray-ui.ts) and its two commit paths.
// The model itself was created above the editor mount - see the note there.
export const isRec = (_start: StartCtx, v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const refreshHead = async (start: StartCtx): Promise<void> => {
  const { studio } = start;
  try {
    await studio.load();
    const doc = studio.doc();
    start.headDoc = isRec(start, doc) ? doc : null;
  } catch {
    start.headDoc = null;
  }
};
// "Fonts for Linux (.rpm)": seal the brand's fonts into an installable system
// package (plan 197 M5). Shell-side, because enumerating the brand's fonts uses a
// host.assets internal a sandboxed tool hook can't reach. Google-fetched and
// SUSE/platform faces are redistributable (packed silently); a self-uploaded face
// needs a confirm - a NON-blocking two-click one (a browser confirm() dialog would
// jam the page). The package bytes come from host.export.pack (the engine's RPM
// writer); like every export.file path it carries no watermark.
export const fontExt = (_start: StartCtx, b: Uint8Array): string => {
  const sig = String.fromCharCode(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0);
  if (sig === 'wOF2') return 'woff2';
  if (sig === 'wOFF') return 'woff';
  if (sig === 'OTTO') return 'otf';
  return 'ttf';
};
export function wirePackExport(start: StartCtx): void {
  const { viewEl } = start;
  viewEl
    .querySelector<HTMLButtonElement>('[data-start-export]')
    ?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (!start.editor) {
        start.exporting.showNote(t('The brand editor didn’t open - reload to export.'), true);
        return;
      }
      btn.disabled = true;
      try {
        const { filename } = await start.editor.exportPack();
        start.exporting.showNote(tRaw('Exported {filename}', { filename }));
      } catch (err) {
        start.exporting.showNote(String((err as { message?: unknown })?.message ?? err), true);
      }
      btn.disabled = false;
    });
}

export function wireTokensExport(start: StartCtx): void {
  const { viewEl } = start;
  // The plain document, beside the pack. The pack zip carries fonts, logos and a
  // theme preference and verifies its own integrity map (brand-transfer.ts); this
  // is what a repo, a CI step or another tokens tool actually reads, and it is
  // the head document verbatim - the same precedence host.tokens.raw() applies.
  viewEl
    .querySelector<HTMLButtonElement>('[data-start-export-tokens]')
    ?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      try {
        await start.exporting.refreshHead();
        if (!start.headDoc) start.exporting.showNote(t('There are no tokens to export yet.'), true);
        else {
          await saveBlob(
            new Blob([JSON.stringify(withoutRecordedBrandPage(start.headDoc), null, 2)], { type: 'application/json' }),
            'tokens.json'
          );
          start.exporting.showNote(tRaw('Exported {filename}', { filename: 'tokens.json' }));
          playSfx('whoosh');
        }
      } catch (err) {
        start.exporting.showNote(String((err as { message?: unknown })?.message ?? err), true);
      }
      btn.disabled = false;
    });
}

export function wireFontsExport(start: StartCtx): void {
  const { host, viewEl } = start;
  start.getOnDeviceArmed = false;
  viewEl
    .querySelector<HTMLButtonElement>('[data-start-get-on-device]')
    ?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      try {
        // StartHost narrows the host; the runtime host is the full bridge, so reach
        // export.pack through a typed cast (added in engine 1.178, feature-detected).
        const exp = (host as unknown as { export?: { pack?: (s: unknown) => Promise<Uint8Array> } })
          .export;
        if (typeof exp?.pack !== 'function') {
          start.exporting.showNote(t('This build can’t create packages yet.'), true);
          btn.disabled = false;
          return;
        }
        const assetsApi = host.assets as unknown as {
          _exportUserAssets?: () => Promise<
            Array<{ id?: string; type?: string; blob?: Blob; meta?: Record<string, unknown> }>
          >;
        };
        const records = (await assetsApi._exportUserAssets?.()) ?? [];
        const faces = records.filter(
          (r) =>
            r?.type === 'font' &&
            typeof r?.id === 'string' &&
            r.id.startsWith('user/fonts/') &&
            r.blob
        );
        if (faces.length === 0) {
          start.exporting.showNote(t('No fonts to package yet - add fonts in the Type room first.'), true);
          start.getOnDeviceArmed = false;
          btn.disabled = false;
          return;
        }
        const hasUpload = faces.some((r) => r.meta?.source === 'upload');
        if (hasUpload && !start.getOnDeviceArmed) {
          start.getOnDeviceArmed = true;
          start.exporting.showNote(
            t(
              'Some of these fonts you uploaded - click again to confirm you may redistribute them.'
            ),
            true
          );
          btn.disabled = false;
          return;
        }
        start.getOnDeviceArmed = false;
        const fonts: { name: string; data: Uint8Array }[] = [];
        const seen = new Set<string>();
        for (const r of faces) {
          const bytes = new Uint8Array(await (r.blob as Blob).arrayBuffer());
          const fam = String(r.meta?.family ?? 'Font').replace(/[^A-Za-z0-9]+/g, '') || 'Font';
          const wt = String(r.meta?.weight ?? '400').replace(/[^A-Za-z0-9]+/g, '');
          const ital = r.meta?.style === 'italic' ? 'Italic' : '';
          const ext = start.exporting.fontExt(bytes);
          let name = `${fam}-${wt}${ital}.${ext}`;
          for (let i = 1; seen.has(name); i++) name = `${fam}-${wt}${ital}-${i}.${ext}`;
          seen.add(name);
          fonts.push({ name, data: bytes });
        }
        const allRedistributable = faces.every((r) => r.meta?.source === 'google-fonts');
        const spec = {
          target: 'rpm' as const,
          type: 'font' as const,
          meta: {
            name: 'brand-fonts',
            version: '1.0',
            release: '1',
            summary: 'Brand fonts packaged by Lolly',
            description: 'Fonts from your Lolly brand, installed system-wide.',
            license: allRedistributable ? 'OFL-1.1' : 'LicenseRef-lolly-user-supplied',
            vendor: 'Lolly',
            url: 'https://lolly.tools',
          },
          foundry: 'brand',
          fonts,
        };
        const bytes = await exp.pack(spec);
        await saveBlob(
          new Blob([bytes as BlobPart], { type: 'application/x-rpm' }),
          `${spec.meta.name}-${spec.meta.version}-${spec.meta.release}.noarch.rpm`
        );
        start.exporting.showNote(tRaw('Exported {filename}', { filename: `${spec.meta.name}.rpm` }));
        playSfx('whoosh');
      } catch (err) {
        start.exporting.showNote(String((err as { message?: unknown })?.message ?? err), true);
      }
      btn.disabled = false;
    });
}

export function exportingOps(start: StartCtx) {
  return {
    showNote: bindOp(start, showNote),
    isRec: bindOp(start, isRec),
    refreshHead: bindOp(start, refreshHead),
    fontExt: bindOp(start, fontExt),
    wirePackExport: bindOp(start, wirePackExport),
    wireTokensExport: bindOp(start, wireTokensExport),
    wireFontsExport: bindOp(start, wireFontsExport),
  };
}
