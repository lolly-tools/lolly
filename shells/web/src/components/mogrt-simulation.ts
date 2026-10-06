// SPDX-License-Identifier: MPL-2.0
import type { MogrtPreview } from '../lib/mogrt.ts';
import { defaultMogrtSimulation, simulateMogrt, type MogrtLayout } from '../lib/mogrt-simulation.ts';
import { setAssetOpening } from '../lib/asset-open-handoff.ts';
import { navigateTo } from '../nav.ts';
import { t } from '../i18n.ts';

export function mountMogrtSimulation(panel: HTMLElement, template: MogrtPreview): void {
  const options = defaultMogrtSimulation(template);
  const section = document.createElement('section');
  section.dataset.mogrtSimulation = '';
  const heading = document.createElement('h3'); heading.textContent = t('Editable simulation');
  const note = document.createElement('p');
  note.textContent = t('Rebuilds exposed text and size controls as editable layers with simple entrance and exit animation. Layout is approximate; Adobe effects, logo artwork, gradients, audio and exact font cuts are not reconstructed. Uses your current brand sans font.');
  const preview = document.createElement('div');
  preview.setAttribute('aria-label', t('Simulated template preview'));
  preview.style.cssText = 'position:relative;overflow:hidden;width:100%;border:1px solid var(--ui-color-border);margin:12px 0';
  const render = () => {
    const result = simulateMogrt(template, options);
    preview.style.aspectRatio = `${result.width}/${result.height}`;
    preview.style.background = String(result.boxes[0]!.bg);
    preview.replaceChildren();
    for (const box of result.boxes.slice(1)) {
      const line = document.createElement('div'); line.textContent = String(box.text);
      line.style.cssText = `position:absolute;overflow:hidden;white-space:pre-wrap;display:flex;align-items:center;line-height:1.12;left:${Number(box.x)/result.width*100}%;top:${Number(box.y)/result.height*100}%;width:${Number(box.w)/result.width*100}%;height:${Number(box.h)/result.height*100}%;color:${box.fg};font-weight:${box.weight};text-align:${box.align};justify-content:${box.align === 'center' ? 'center' : box.align === 'right' ? 'flex-end' : 'flex-start'}`;
      // Container units keep the specimen proportional to the native canvas.
      line.style.fontSize = `${Number(box.fontSize)/result.width*100}cqw`;
      preview.append(line);
    }
  };
  preview.style.containerType = 'inline-size';
  preview.style.fontFamily = 'var(--font-brand, system-ui, sans-serif)';
  section.append(heading, note, preview);
  const field = (name: string, input: HTMLElement) => {
    const label = document.createElement('label'); label.style.cssText = 'display:block;margin:10px 0';
    const title = document.createElement('span'); title.textContent = name; label.append(title, input); section.append(label);
  };
  template.controls.forEach((control, index) => {
    if (control.type !== 6 && !(control.type === 2 && /size/i.test(control.name)) && control.type !== undefined) return;
    if (control.type === undefined && /opacity|slider/i.test(control.name)) return;
    const input = document.createElement('input'); input.className = 'field-input'; input.value = control.value;
    input.setAttribute('aria-label', control.name);
    input.type = control.type === 2 ? 'number' : 'text'; input.maxLength = 2000;
    if (control.type === 2) { input.min = String(control.min ?? 1); input.max = String(control.max ?? 200); }
    input.oninput = () => { options.values[index] = input.value; render(); }; field(control.name, input);
  });
  const layout = document.createElement('select'); layout.className = 'field-select';
  for (const [value, label] of [['title', t('Centered title')], ['left', t('Lower third · left')], ['right', t('Lower third · right')]]) {
    const item = document.createElement('option'); item.value = value!; item.textContent = label!; layout.append(item);
  }
  layout.value = options.layout; layout.onchange = () => { options.layout = layout.value as MogrtLayout; render(); }; field(t('Layout'), layout);
  for (const [key, label] of [['background', t('Background (#hex or transparent)')], ['foreground', t('Text colour (#hex)')]] as const) {
    const input = document.createElement('input'); input.className = 'field-input'; input.value = options[key];
    input.oninput = () => { options[key] = input.value; render(); }; field(label, input);
  }
  const duration = document.createElement('input'); duration.type = 'number'; duration.min = '0.1'; duration.max = '600'; duration.step = '0.1'; duration.value = String(options.duration); duration.className = 'field-input';
  duration.oninput = () => { options.duration = Number(duration.value); render(); }; field(t('Duration (seconds)'), duration);
  const open = document.createElement('button'); open.type = 'button'; open.className = 'btn'; open.textContent = t('Open editable simulation in Sequence');
  open.onclick = () => {
    const result = simulateMogrt(template, options), slot = `mogrt-${crypto.randomUUID()}`;
    setAssetOpening({ toolId: 'design', slot, values: { boxes: result.boxes, projectFps: '24' }, refs: [], kind: 'timeline', at: Date.now() });
    navigateTo(`#/tool/design?${new URLSearchParams({ slot, w: String(result.width), h: String(result.height) })}`);
  };
  open.disabled = !template.controls.some(c => c.type === 6 || (c.type === undefined && !/size|opacity|slider/i.test(c.name)));
  if (open.disabled) note.textContent += ` ${t('This template exposes no text controls to simulate.')}`;
  section.append(open); panel.append(section); render();
}
