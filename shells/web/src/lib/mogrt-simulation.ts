// SPDX-License-Identifier: MPL-2.0
/** A native approximation of exposed controls, never an Adobe project renderer. */
import type { MogrtPreview } from './mogrt.ts';
export type MogrtLayout = 'title' | 'left' | 'right';
export interface MogrtSimulationOptions {
  layout: MogrtLayout; background: string; foreground: string; duration: number;
  values: string[];
}
export function defaultMogrtSimulation(template: MogrtPreview): MogrtSimulationOptions {
  const lower = /lower.?third|name.?plate/i.test(template.name);
  return { layout: lower ? /right|ROF/i.test(template.name) ? 'right' : 'left' : 'title',
    background: lower ? 'transparent' : /jungle/i.test(template.name) ? '#30ba78' : '#071b16',
    foreground: '#ffffff', duration: template.duration ?? 6, values: template.controls.map(c => c.value) };
}
const bounded = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const color = (value: string, fallback: string) => value === 'transparent' || /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
export function simulateMogrt(template: MogrtPreview, options: MogrtSimulationOptions) {
  const w = bounded(template.width ?? 1920, 1920, 16, 8192), h = bounded(template.height ?? 1080, 1080, 16, 8192);
  const dur = bounded(options.duration, 6, 0.1, 600);
  const lower = options.layout !== 'title';
  const texts = template.controls.map((control, index) => ({ control, index }))
    .filter(({ control }) => control.type === 6 || (control.type === undefined && !/size|opacity|slider/i.test(control.name))).slice(0, 12);
  const scaleIndex = template.controls.findIndex(c => /size/i.test(c.name) && c.type === 2);
  const scaleControl = template.controls[scaleIndex];
  const scale = scaleControl ? bounded(Number(options.values[scaleIndex]), 100, bounded(scaleControl.min ?? 1, 1, 1, 1000), bounded(scaleControl.max ?? 200, 200, 1, 1000)) / 100 : 1;
  const frameId = 'mogrt-frame';
  const boxes: Record<string, string | number>[] = [{ id: frameId, kind: 'frame', name: `${template.name} · simulation`, x: 0, y: 0, w, h,
    bg: color(options.background, 'transparent'), start: 0, dur }];
  const rowH = Math.min(h * (lower ? 0.07 : 0.11), h * 0.7 / Math.max(1, texts.length));
  const y = lower ? h * 0.84 - rowH * texts.length : (h - rowH * texts.length) / 2;
  for (const [{ control, index }, row] of texts.map((v, i) => [v, i] as const)) {
    const fontSize = Math.min(rowH * 0.8, bounded((control.fontSize ?? h * 0.045) * scale, h * 0.045, 4, h));
    const font = control.font ?? template.fonts[row] ?? '';
    boxes.push({ id: `mogrt-text-${index}`, kind: 'text', frame: frameId, name: control.name,
      text: (options.values[index] ?? control.value).slice(0, 2000), x: w * 0.08, y: y + row * rowH, w: w * 0.84, h: rowH,
      fg: color(options.foreground, '#ffffff'), bg: 'transparent', font: 'sans',
      weight: /extrabold/i.test(font) ? '800' : /semibold/i.test(font) ? '600' : /light/i.test(font) ? '300' : '400',
      fontSize, align: options.layout === 'title' ? 'center' : options.layout, valign: 'middle', pad: 0,
      start: 0, dur, enter: lower ? options.layout === 'left' ? 'slide-right' : 'slide-left' : 'fade', exit: 'fade', enterMs: 400, exitMs: 400 });
  }
  return { boxes, width: w, height: h, duration: dur };
}
