// SPDX-License-Identifier: MPL-2.0
/** Render damage follows evaluated geometry only when its source receipt matches. */
import type { Box } from './free-canvas-math.ts';
const projections = new WeakMap<Box[], { text: string; boxes: Box[] }>();
export function projectCanvasLayoutBoxes(source: Box[], text: string, receipt: string): Box[] {
  if (
    !text ||
    receipt !==
      JSON.stringify(source)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
  )
    return source;
  const cached = projections.get(source);
  if (cached?.text === text) return cached.boxes;
  try {
    const boxes = JSON.parse(text);
    if (
      !Array.isArray(boxes) ||
      boxes.length !== source.length ||
      boxes.some((b, n) => b.id !== source[n]?.id)
    )
      return source;
    projections.set(source, { text, boxes });
    return boxes;
  } catch {
    return source;
  }
}
