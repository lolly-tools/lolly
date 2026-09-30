// SPDX-License-Identifier: MPL-2.0
/** Original files travel in memory and are consumed once by the destination. */
export type FileUtility = 'unpack' | 'prepare';
let pending: { target: FileUtility; file: File } | null = null;

export function setPendingUtility(target: FileUtility, file: File): void {
  pending = { target, file };
}

export function takePendingUtility(target: FileUtility): File | null {
  if (pending?.target !== target) return null;
  const file = pending.file;
  pending = null;
  return file;
}
