// SPDX-License-Identifier: MPL-2.0
/** Deliver a portable file through the system share sheet or a download. */
import type { HostV1 } from '@lolly-tools/core/host-v1';

export async function shareFile(
  exporter: Pick<HostV1['export'], 'file' | 'share'>, blob: Blob, filename: string,
): Promise<void> {
  if (await exporter.share?.(blob, { filename, mime: blob.type, title: filename })) return;
  await exporter.file(blob, { filename });
}
