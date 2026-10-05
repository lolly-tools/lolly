// SPDX-License-Identifier: MPL-2.0
/**
 * start: brand.
 *
 * Every function takes the shared `start: StartCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `start.<module>.<fn>`. Extracted verbatim
 * from mountStart() by scripts/split-closure.ts.
 */
import { t, tRaw } from '../../i18n.ts';
import { focusWhenViewReady } from '../../components/view-loading.ts';
import { mountBrandEditor } from '../../lib/brand-editor.ts';
import { activeDesignSystemRecord } from '../../lib/design-system/active.ts';
import { renameDesignSystem } from '../../lib/design-system/manage.ts';
import { mountVersionsRoom } from '../../lib/design-system/rooms/versions.ts';
import { mountCheckpointRecovery } from '../../lib/design-system/checkpoint-recovery.ts';
import { readIndex } from '../../lib/design-system/versions-io.ts';
import { playSfx } from '../../lib/sfx.ts';
import { escape as escapeText } from '../../utils.ts';
import { bindOp, type StartCtx } from './context.ts';

export const checkpointBeforeInstall = async (start: StartCtx): Promise<void> => {
  const { studio } = start;
  // Best-effort by design: a first-ever install has no head to snapshot, and a
  // storage failure must never stop the tokens the user asked for from landing.
  try {
    await studio.load();
    await studio.checkpoint(t('Before import'));
  } catch {
    /* nothing to go back to */
  }
};
export function wireRegistry(start: StartCtx): void {
  const { focusDsName, host, viewEl } = start;
  // The name is editable HERE, alongside the actual brand editor. Profile owns
  // switching and destructive management; it deliberately no longer carries a
  // second, disconnected rename affordance.
  void activeDesignSystemRecord(host)
    .then((rec) => {
      const line = viewEl.querySelector<HTMLElement>('[data-start-ds]');
      if (!line || !rec) return;
      const state = rec.locked ? ` <span class="start-ds-lock">${t('read-only')}</span>` : '';
      line.innerHTML = rec.locked
        ? `${t('Editing {name}', { name: escapeText(rec.label) })}${state} · <a href="#/profile?focus=design-systems-section">${t('Switch')}</a>`
        : `${t('Editing')} <input class="start-ds-name" data-start-ds-name value="${escapeText(rec.label)}" aria-label="${escapeText(t('Design system name'))}"> · <a href="#/profile?focus=design-systems-section">${t('Switch')}</a>`;
      line.hidden = false;
      const nameInput = line.querySelector<HTMLInputElement>('[data-start-ds-name]');
      nameInput?.addEventListener('change', async () => {
        const label = nameInput.value.trim();
        if (!label) {
          nameInput.value = rec.label;
          return;
        }
        try {
          await renameDesignSystem(
            host as unknown as Parameters<typeof renameDesignSystem>[0],
            rec.id,
            label
          );
          nameInput.value = label;
          document.title = `${label} · Lolly`;
          start.exporting.showNote(t('Design system name saved.'));
        } catch (err) {
          nameInput.value = rec.label;
          start.exporting.showNote(String((err as { message?: unknown })?.message ?? err), true);
        }
      });
      if (focusDsName)
        queueMicrotask(() => focusWhenViewReady(() => {
          nameInput?.focus();
          nameInput?.select();
        }));
    })
    .catch(() => {
      /* no registry - the line stays hidden */
    });
}

export async function mountEditor(start: StartCtx): Promise<void> {
  const { editorMount, host, overviewPanel, shell, studio, tray } = start;
  try {
    start.editor = await mountBrandEditor(
      editorMount,
      host as unknown as Parameters<typeof mountBrandEditor>[1],
      {
        tray,
        onChange: () => {
          if (!shell.isConnected) return;
          // The first colour, face or mark furnishes the system, so the foot's
          // export actions appear on the edit that did it - before the early return
          // below, because that edit is usually made in a room with the Overview
          // panel hidden. One keyed read while unfurnished, then nothing.
          start.rooms.refreshFurnished();
          // Only a VISIBLE Overview re-reads - the same rule the room applies to
          // its own palette subscription (lib/design-system/rooms/overview.ts).
          // This callback runs on every commit, and one refresh walks the whole
          // system: the tokens doc, its colours, four font-family reads, and a
          // logo listing that mints and revokes an object URL per slot. A hidden
          // panel is caught by the refresh selectRoom() runs on entry.
          if (overviewPanel.hidden) return;
          start.overview?.refresh();
        },
        // The durable half of the room's undo (plan 97 section 6): the editor's own stack
        // is session-only, so a destructive action also asks the host for a named
        // checkpoint. Same shape as checkpointBeforeInstall, with the label the
        // room supplies. Best-effort - a first-ever edit has no head to snapshot.
        checkpoint: async (label) => {
          try {
            await studio.load();
            await studio.checkpoint(label);
          } catch {
            /* nothing to go back to */
          }
        },
        // Beat 0's "or bring a file" - the same picker the rail's "Add from…"
        // opens, on its source list (plan 182 section 3a).
        openImport: async () => {
          await start.importReady;
          if (!shell.isConnected) return;
          start.sources.openImport();
          playSfx('click');
        },
        // "From an image" beside the add row. THIS view owns the image pipeline
        // (the source picker's image tile runs the same call), so the room asks
        // for it rather than carrying a second copy - plan 182 section 5.3.
        scanImage: async (file) => {
          await start.importReady;
          if (!shell.isConnected) return;
          start.sources.openImport('image');
          void start.images.scanImageFile(file, start.sources.srcNote);
        },
      }
    );
  } catch (err) {
    const error = document.createElement('p');
    error.className = 'be-err';
    error.textContent = tRaw('Couldn’t open the brand editor: {error}', { error: String((err as { message?: unknown })?.message ?? err) });
    editorMount.replaceChildren(error);
  }
}

export function wireRecoveryAndVersions(start: StartCtx): void {
  const { host, shell, studio, versionsPanel, viewEl } = start;
  // ── Versions (plan 97 section 6a, M7) ───────────────────────────────────────────────
  // The panel writes the head through THIS studio, so publish, activate and
  // restore land on the same undo stack as every other edit and repaint chrome
  // through the same afterInstall. Version payloads never come through here -
  // they go to installUserTokens with an explicit slug, which is where
  // immutability is enforced (lib/design-system/versions-io.ts).
  const versionsCtx = {
    host: host as unknown as Parameters<typeof mountVersionsRoom>[1]['host'],
    // load() first, every time. The rooms install through their own path, so the
    // studio's in-memory head goes stale the moment a colour is edited - and the
    // undo entry is a snapshot of THAT. Without the re-read, undoing a publish
    // would step back to the document this view mounted with and quietly drop
    // every edit made since.
    install: async (doc: unknown, action: string) => {
      await studio.load();
      await studio.install(doc, action);
    },
    // No `label`: every head write here goes through `install` above, and a
    // hard-coded name on the fallback path would rename whatever the user calls
    // their design system on the next publish or activate. The chokepoint keeps
    // the existing name when a write does not supply one (bridge/tokens.ts).
    undo: () => studio.undo(),
    notify: start.exporting.showNote,
  }; start.versionsCtx = versionsCtx;
  start.recovery = null as StartCtx['recovery'];
  viewEl.querySelector('[data-start-recovery]')?.addEventListener('click', () => {
    if (start.recovery?.el.isConnected) return;
    start.recovery = mountCheckpointRecovery(studio, async () => {
      if (!shell.isConnected) return;
      await start.editor?.reload();
      await start.exporting.refreshHead();
      start.overview?.refresh();
      start.versions?.refresh();
      start.rooms.refreshFurnished();
    }, host);
  });
  // The panel is built the first time it is opened, and it reads on mount - so
  // this is both the lazy mount and the re-entry refresh.
  start.openVersions = (): void => {
    if (start.versions) start.versions.refresh();
    else start.versions = mountVersionsRoom(versionsPanel, versionsCtx);
  };
  if (start.activeArea === 'versions') start.openVersions(); // arrived by deep link
  // Whether to OFFER the rail entry, resolved once: has anything been PUBLISHED?
  // The version index the head document carries, not "does a design system
  // exist" - the second answer is true one colour into a blank brand, which is how
  // the entry ended up on the first-run face (plans/137 B2). Until the first publish, the
  // quiet "Versions & publishing" line under the export actions is the way in.
  // The head is already memoised by the tokens bridge, so this reads no more than
  // hasPublishableSystem did, and never on a render or an export path.
  void readIndex(versionsCtx)
    .then((index) => {
      if (!shell.isConnected) return;
      // ||=, not =: a `?area=versions` arrival has already latched the entry on,
      // and a late "nothing published yet" must not take it away underneath.
      start.versionsOffered ||= index.versions.length > 0;
      start.rooms.syncVersionsEntry();
    })
    .catch(() => {
      /* undiscoverable storage - the entry stays hidden */
    });
}

export function brandOps(start: StartCtx) {
  return {
    checkpointBeforeInstall: bindOp(start, checkpointBeforeInstall),
    wireRegistry: bindOp(start, wireRegistry),
    mountEditor: bindOp(start, mountEditor),
    wireRecoveryAndVersions: bindOp(start, wireRecoveryAndVersions),
  };
}
