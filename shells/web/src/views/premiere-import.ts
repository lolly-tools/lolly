// SPDX-License-Identifier: MPL-2.0
import { readPremiereXml, premiereSequenceValues } from '../../../../engine/src/premiere-xml.ts';
import { readZip } from '../../../../engine/src/zip.ts';
import { choiceDialog } from '../components/confirm-dialog.ts';
import { t } from '../i18n.ts';
import type { PickerHost } from './picker.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

async function chooseMedia(): Promise<File[]> {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = 'video/*,audio/*,image/*';
  input.hidden = true;
  document.body.append(input);
  return new Promise((resolve) => {
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    input.click();
  });
}
export async function importPremiereFile(
  file: File | Blob,
  {
    host,
    interactive = false,
    warn = () => {},
  }: { host?: HostV1; interactive?: boolean; warn?: (message: string) => void } = {}
) {
  if (file.size > 256 * 1024 * 1024)
    throw new Error(t('Choose an interchange package smaller than 256 MB.'));
  const bytes = new Uint8Array(await file.arrayBuffer()),
    sources = new Map<string, File>();
  let xml: string;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const parts = readZip(bytes, {
      maxInputBytes: 256 * 1024 * 1024,
      maxTotalBytes: 256 * 1024 * 1024,
      maxEntryBytes: 128 * 1024 * 1024,
      maxEntries: 1024,
    });
    const source = parts.find((p) => p.name === 'sequence.xml');
    if (!source) throw new Error(t('The package has no sequence.xml.'));
    xml = new TextDecoder().decode(source.bytes);
    for (const part of parts)
      if (part.name.startsWith('Media/'))
        sources.set(part.name, new File([part.bytes as BlobPart], part.name.split('/').pop()!));
  } else {
    if (bytes.length > 8 * 1024 * 1024) throw new Error(t('Choose XML smaller than 8 MB.'));
    xml = new TextDecoder().decode(bytes);
  }
  const sequence = readPremiereXml(xml, (s) =>
    new DOMParser().parseFromString(s, 'application/xml')
  );
  if (interactive && !sources.size && sequence.clips.length) {
    const answer = await choiceDialog({
      title: t('Sequence media'),
      message: t(
        'Select the media files referenced by this XML, or continue with labelled placeholders.'
      ),
      choices: [
        { id: 'select', label: t('Select media files') },
        { id: 'placeholders', label: t('Use placeholders') },
      ],
    });
    if (!answer) throw new Error(t('Sequence import cancelled.'));
    if (answer === 'select')
      for (const media of await chooseMedia()) {
        if (sources.has(media.name)) throw new Error(t('Selected media filenames must be unique.'));
        sources.set(media.name, media);
      }
  }
  const result = await premiereSequenceValues(sequence, async (path) => {
    const relative = path.replace(/^file:\/\/(?:localhost)?\/?/i, '');
    let decoded: string;
    try {
      decoded = decodeURIComponent(relative);
    } catch {
      decoded = relative;
    }
    const media = sources.get(decoded) ?? sources.get(decoded.split('/').pop() ?? '');
    if (media && host && !('_uploadUserAsset' in host.assets))
      throw new Error(t('This shell cannot store sequence media.'));
    return media && host
      ? (await import('./picker.ts')).storeUserUpload(host as PickerHost, media, {
          batch: true,
        })
      : null;
  });
  for (const note of result.notes) warn(note);
  if (interactive && result.notes.length)
    await choiceDialog({
      title: t('Sequence import notes'),
      message: t('Review the imported clips and missing media.'),
      items: result.notes.slice(0, 100),
      choices: [{ id: 'continue', label: t('Continue'), primary: true }],
    });
  return {
    boxes: result.values.boxes as object[],
    width: sequence.width,
    height: sequence.height,
    background: '#000000',
    sequenceValues: { projectFps: String(result.values.projectFps) },
  };
}
