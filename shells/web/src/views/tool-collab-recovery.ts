// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { subscribeCanvasRecovery } from '../lib/canvas-recovery.ts';
import { t } from '../i18n.ts';

/** A new Library slot keeps interrupted work separate from the room and earlier saves. */
export function mountCollabRecovery(runtime: object, host: HostV1 | null | undefined, parent: HTMLElement,
  capture: () => { state: Record<string, unknown>; label?: string }) {
  const root = parent.ownerDocument.createElement('div'); root.className = 'collab-recovery'; root.hidden = true;
  const status = parent.ownerDocument.createElement('span'); status.setAttribute('role', 'status');
  const download = parent.ownerDocument.createElement('button'); download.type = 'button'; download.textContent = t('Download recovery copy');
  const projects = parent.ownerDocument.createElement('a'); projects.href = '#/projects'; projects.textContent = t('Open Projects');
  root.append(status, download, projects); parent.append(root);
  let disposed = false, latest: Record<string, unknown> | undefined, generation = 0;
  download.addEventListener('click', () => {
    if (!latest) return;
    const blob = new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json' });
    void (host?.export?.download ? host.export.download(blob, 'lolly-recovery.json')
      : import('../bridge/export.ts').then(({ anchorSave }) => anchorSave(blob, 'lolly-recovery.json')))
      .catch(() => { if (!disposed) status.textContent = t('Recovery download failed. Try again.'); });
  });
  const off = subscribeCanvasRecovery(runtime, draft => {
    const ticket = ++generation, current = capture();
    const copy = { ...current.state, ...draft.values, __label: `${current.label ?? 'Canvas'} · ${draft.label}` };
    latest = copy; root.hidden = false; projects.hidden = true; status.textContent = t('Saving an interrupted edit on this device…');
    const slot = `collab-recovery:${draft.id}`;
    void (async () => {
      if (!host?.state) throw new Error('Device storage unavailable');
      if (!await host.state.load(slot)) await host.state.save(slot, copy);
    })().then(() => {
      if (!disposed && ticket === generation) { status.textContent = t('Interrupted edit saved on this device.'); projects.hidden = false; }
    }).catch(() => {
      if (!disposed && ticket === generation) status.textContent = t('Recovery copy could not be saved here. Download the recovery copy.');
    });
  });
  return { teardown() { disposed = true; off(); root.remove(); } };
}
