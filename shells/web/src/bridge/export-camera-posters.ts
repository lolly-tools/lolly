// SPDX-License-Identifier: MPL-2.0
/** Structured editors receive a captured poster, without changing the saved camera layer. */
export function cameraPosterBoxes(boxes: Record<string, unknown>[]): Record<string, unknown>[] {
  return boxes.map(box => box.kind === 'webcam' ? { ...box, kind: 'image' } : box);
}
