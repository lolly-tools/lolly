// SPDX-License-Identifier: MPL-2.0

interface FileDropZoneOptions {
  onFile(file: File): Promise<void>;
  onComplete(): Promise<void>;
}

/** Process picked or dropped files in order with the existing drop-zone cues. */
export function wireFileDropZone(drop: HTMLElement, file: HTMLInputElement, opts: FileDropZoneOptions): void {
  async function take(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    drop.classList.add('is-busy');
    for (const f of Array.from(files)) await opts.onFile(f);
    drop.classList.remove('is-busy');
    file.value = '';
    await opts.onComplete();
  }

  file.addEventListener('change', () => { void take(file.files); });
  for (const evt of ['dragenter', 'dragover', 'dragleave', 'drop']) {
    drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
  }
  for (const evt of ['dragenter', 'dragover']) {
    drop.addEventListener(evt, () => drop.classList.add('is-dragover'));
  }
  for (const evt of ['dragleave', 'drop']) {
    drop.addEventListener(evt, () => drop.classList.remove('is-dragover'));
  }
  drop.addEventListener('drop', (e) => { void take((e as DragEvent).dataTransfer?.files ?? null); });
}
