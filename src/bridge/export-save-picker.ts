// SPDX-License-Identifier: MPL-2.0
/**
 * "Save as…" in a browser (File System Access) - plans/202 WP4.3.
 *
 * The desktop shell answers the export panel's Save As button with a native
 * dialog, through its own export override's __LOLLY_DESKTOP_EXPORT__ seam. A
 * Chromium browser can put the same dialog up with showSaveFilePicker, so the
 * panel offers the button there too - behind the probe below, so a browser
 * without the API renders no control it cannot honour. One-shot by construction,
 * exactly like the desktop seam: an ordinary Download after a cancelled Save As
 * must never surprise the user with a dialog.
 *
 * Its own module rather than a block inside bridge/export.ts: the arming flag and
 * the picker call are one small state machine with one caller in the web export
 * bridge (consumeSaveAsNext, from download()) and one in the export panel.
 */

type SaveFilePicker = (opts: {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;

let saveAsNext = false;

/** Can this browser put a real save dialog up? Chromium-family only today. */
export function saveFilePickerSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker === 'function';
}

/** Send the NEXT download through the save dialog. No-op where unsupported, so a
 *  caller that skipped the probe still cannot arm a dialog that cannot open. */
export function requestSaveAsNext(): void { saveAsNext = saveFilePickerSupported(); }

/** Disarm it (the export panel calls this when its Save As is dismissed). */
export function cancelSaveAsNext(): void { saveAsNext = false; }

/**
 * Call directly from a user gesture with an already-prepared file. A successful
 * result confirms the write closed; cancelling the picker is a separate outcome.
 * API refusal and write failures propagate so callers cannot report a false save.
 */
export async function saveFileWithPicker(blob: Blob, filename: string): Promise<'saved' | 'cancelled'> {
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (typeof picker !== 'function') throw new Error('This browser does not support a save dialog.');
  const ext = /\.[a-z0-9]+$/i.exec(filename)?.[0];
  let handle: Awaited<ReturnType<SaveFilePicker>>;
  try {
    handle = await picker.call(window, {
      suggestedName: filename,
      ...(ext && blob.type
        ? { types: [{ description: `${ext.slice(1).toUpperCase()} file`, accept: { [blob.type]: [ext] } }] }
        : {}),
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
    throw err;
  }
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return 'saved';
}

/**
 * The web export bridge's download() calls this first. Disarms whatever the Save
 * As button armed (one delivery only) and reports whether the dialog settled the
 * file. False - not armed, or the picker refused - means deliver the ordinary
 * anchor way, so a refused picker still saves the file.
 */
export async function consumeSaveAsNext(blob: Blob, filename: string): Promise<boolean> {
  if (!saveAsNext) return false;
  saveAsNext = false;
  try {
    await saveFileWithPicker(blob, filename);
    return true;
  } catch {
    return false;
  }
}
