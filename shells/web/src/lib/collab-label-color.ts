// SPDX-License-Identifier: MPL-2.0
import { apcaContrast } from '../../../../engine/src/color-tools.ts';

/** Keep the person's hue while repairing text contrast on its own background. */
export function collabLabelColor(color: string, floor = 75): { fill: string; ink: string; lc: number } {
  const source = /^#[0-9a-f]{6}$/i.test(color) ? color : '#7474a0';
  const channels = [1, 3, 5].map(at => Number.parseInt(source.slice(at, at + 2), 16));
  const black = Math.abs(apcaContrast('#000000', source)), white = Math.abs(apcaContrast('#ffffff', source));
  const ink = black >= white ? '#000000' : '#ffffff', target = ink === '#000000' ? 255 : 0;
  let fill = source, lc = Math.max(black, white);
  for (let step = 1; lc < floor && step <= 20; step++) {
    fill = '#' + channels.map(value => Math.round(value + (target - value) * step / 20).toString(16).padStart(2, '0')).join('');
    lc = Math.abs(apcaContrast(ink, fill));
  }
  return { fill, ink, lc };
}
