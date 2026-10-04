// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apcaContrast } from '../../../../engine/src/color-tools.ts';
import { collabPalette } from './collab-colors.ts';
import { collabLabelColor } from './collab-label-color.ts';

test('brand-colored cursor labels and chat bubbles meet their APCA text floors', () => {
  const palette = collabPalette({ palette: ['#30ba78', '#fe7c3f', '#2453ff', '#e5007d'], accent: '#30ba78' });
  for (const color of [...palette.map(color => color.hex), '#000000', '#ffffff', '#888888', '#ffff00', '#0000ff', 'invalid']) {
    for (const floor of [75, 90]) {
      const label = collabLabelColor(color, floor);
      assert.ok(Math.abs(apcaContrast(label.ink, label.fill)) >= floor, `${color}: Lc ${label.lc}`);
      assert.equal(label.lc, Math.abs(apcaContrast(label.ink, label.fill)));
    }
  }
});
