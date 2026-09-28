// SPDX-License-Identifier: MPL-2.0
import { parseBoxShadow } from '../../../../engine/src/css-box.ts';

/** Reserve the outer shadow's extent before capturing a layer into a plate. */
export function boxShadowPad(value: string | null | undefined): number {
  return Math.ceil(parseBoxShadow(value).reduce((pad, shadow) => shadow.inset ? pad
    : Math.max(pad, Math.max(Math.abs(shadow.x), Math.abs(shadow.y)) + Math.max(0, shadow.spread + shadow.blur * 1.5)), 0));
}
