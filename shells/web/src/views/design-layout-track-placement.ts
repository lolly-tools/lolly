// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
// Copyright (c) KALEIDOS SUBSIDIARY SL
// Adapted from Penpot layout.cljc's add-grid-track, remove-grid-row/column and reorder-grid-track helpers.
import type { Box } from './free-canvas-math.ts';

/** An appended authored track can still precede implicitly placed cells. */
export function addTrackPlacement(
  boxes: Box[],
  container: string,
  axis: string,
  index: number
): Box[] {
  const field = axis === 'column' ? 'layoutColumn' : 'layoutRow',
    spanField = `${field}Span`,
    track = index + 1;
  return boxes.map((box) => {
    if (
      String(box.layoutOwner || box.frame || '') !== container ||
      box.layoutAbsolute === true ||
      box.layoutAbsolute === 'true'
    )
      return box;
    const start = Number(box[field]) || 0,
      span = Number(box[spanField]) || 1;
    if (!start) return box;
    if (start >= track) return { ...box, [field]: start + 1 };
    if (start < track && track < start + span) return { ...box, [spanField]: span + 1 };
    return box;
  });
}

/** Automatic children retain automatic placement; explicit cells follow their tracks. */
export function removeTrackPlacement(
  boxes: Box[],
  container: string,
  axis: string,
  index: number
): Box[] {
  const field = axis === 'column' ? 'layoutColumn' : 'layoutRow',
    spanField = `${field}Span`,
    track = index + 1;
  return boxes.map((box) => {
    if (
      String(box.layoutOwner || box.frame || '') !== container ||
      box.layoutAbsolute === true ||
      box.layoutAbsolute === 'true'
    )
      return box;
    const start = Number(box[field]) || 0,
      span = Number(box[spanField]) || 1;
    if (!start) return box;
    if (start === track && span === 1)
      return {
        ...box,
        layoutRow: 0,
        layoutColumn: 0,
        layoutRowSpan: 1,
        layoutColumnSpan: 1,
        layoutArea: '',
      };
    if (start <= track && track < start + span) return { ...box, [spanField]: span - 1 };
    if (start > track) return { ...box, [field]: start - 1 };
    return box;
  });
}
/** Penpot keeps occupied cells' first segment when a moved track splits a span. */
export function reorderTrackPlacement(
  boxes: Box[],
  container: string,
  axis: string,
  from: number,
  to: number
): Box[] {
  const field = axis === 'column' ? 'layoutColumn' : 'layoutRow',
    spanField = `${field}Span`,
    source = from + 1,
    target = to + 1;
  return boxes.map((box) => {
    if (
      String(box.layoutOwner || box.frame || '') !== container ||
      box.layoutAbsolute === true ||
      box.layoutAbsolute === 'true'
    )
      return box;
    const start = Number(box[field]) || 0;
    if (!start) return box;
    let span = Number(box[spanField]) || 1;
    if (span > 1 && start <= source && source < start + span)
      span = start === source ? 1 : source - start;
    const boundary = source > target ? target - 1 : target;
    if (span > 1 && start <= boundary && boundary < start + span) span = boundary - start + 1;
    let next = start;
    if (start === source) next = target;
    else if (source < target && start > source && start <= target) next--;
    else if (source > target && start >= target && start < source) next++;
    return next === start && span === (Number(box[spanField]) || 1)
      ? box
      : { ...box, [field]: next, [spanField]: span };
  });
}
