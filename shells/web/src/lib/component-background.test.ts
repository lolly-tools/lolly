// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { componentBackground } from './component-background.ts';
import { buildComponentArchive } from './component-penpot.ts';
import type { PenpotIrShape } from '../../../../engine/src/penpot-file.ts';

test('component gradients preserve layered paints, opacity, rounded masks and editable colour-wheel geometry', () => {
  const dom = new JSDOM('<!doctype html>');
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['document', 'XMLSerializer']) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value: (dom.window as any)[key] });
  }
  try {
    const box = { x: 24, y: 30, w: 240, h: 240 };
    const paints = componentBackground('radial-gradient(circle, rgba(255,255,255,0.8), transparent), conic-gradient(from 0deg, red, blue, green, red)', box, 120)!;
    assert.ok(paints, 'the wheel must export actual colour, not an empty surface');
    const flat: PenpotIrShape[] = [];
    const visit = (shape: PenpotIrShape): void => { flat.push(shape); if ('children' in shape) shape.children.forEach(visit); };
    paints.forEach(visit);
    const mask = paints[0]!;
    assert.ok(mask.type === 'group' && mask.masked);
    assert.equal(mask.children[0]!.radius, 120);
    assert.ok(flat.filter(s => s.type === 'path').length > 40, 'conic wheel remains editable native wedges');
    const radial = flat.flatMap(s => s.fills || []).find(f => f.gradient?.type === 'radial')?.gradient;
    assert.ok(radial);
    assert.equal(radial.stops[0]!.opacity, 0.8);
    assert.equal(radial.stops.at(-1)!.opacity, 0);
    const linear = componentBackground('linear-gradient(90deg, red 0%, blue 100%)', box, 8)!;
    const build = buildComponentArchive({ name: 'Colour instruments', pages: [{ name: 'Wheel', shapes: [{ type: 'board', name: 'Wheel', x: 0, y: 0, w: 300, h: 300, children: [...paints, ...linear] }] }] });
    assert.deepEqual(build.warnings, []);
    const objects = Object.values(build.entries).filter((v): v is string => typeof v === 'string').map(v => JSON.parse(v));
    assert.ok(objects.some(o => o.maskedGroup === true));
    assert.ok(objects.some(o => o.fills?.some((f: any) => f.fillColorGradient?.type === 'linear')));
    assert.equal(componentBackground('url(example.png)', box, 8), null, 'unsupported paint must be reported instead of silently corrupted');
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
    dom.window.close();
  }
});
