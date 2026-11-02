// SPDX-License-Identifier: MPL-2.0
import type { PickerHost } from '../views/picker.ts';

/** Everything the file-picker fallback should let through - a superset of the
 *  picker's UPLOAD_ACCEPT (that list deliberately excludes design formats). */
const UNIVERSAL_ACCEPT =
  '.fig,.penpot,.zip,.tar,.tgz,.gz,.svg,.idml,.indd,.af,.afdesign,.afphoto,.afpub,.aftemplate,.dxf,.pdf,.ai,.pptx,.docx,.xlsx,.csv,.tsv,.psd,.psb,.xcf,image/*,video/*,audio/*,' +
  '.mov,.json,.lottie,.mp3,.wav,.ogg,.m4a,.flac,.jxl,.bmp,.ico,.cur,.svgz,.lolly';

/**
 * No-drag fallback (the welcome dialog's "Bring your design" tile): a native
 * file picker that feeds the same chooser. The input is parked on <body> and
 * removed on change/cancel. The picker opens at once, because it needs the
 * click's user activation. `ready` holds back only the chooser: its choices
 * navigate, so a caller whose button is on screen before the shell listens for
 * navigation passes a promise that settles once the shell does.
 */
export function openDropFilePicker(host: PickerHost, opts: { ready?: Promise<unknown> } = {}): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = UNIVERSAL_ACCEPT;
  input.style.display = 'none';
  document.body.appendChild(input);
  const done = (): void => input.remove();
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    done();
    if (!files.length) return;
    void Promise.resolve(opts.ready)
      .then(() => import('./drop-router.ts'))
      .then(router => router.openDropChooser(files, host));
  });
  input.addEventListener('cancel', done);
  input.click();
}
