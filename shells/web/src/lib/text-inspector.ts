// SPDX-License-Identifier: MPL-2.0
/** Optional precision controls read and write the same authored text as the canvas bar. */
import type { FontsPort, TextPropertyCommand, TextPropertyPort, TextPropertyState } from '../views/design-ports.ts';
import { textControlNumber, destroyTextControls, styleTextControls, textControlRow, textControlGrid, textControlGroup, textControlAction } from './text-control-ui.ts';
import { t } from '../i18n.ts';
import { mountTextColor } from './text-color.ts';
import { mountParagraphControls } from './text-paragraph-controls.ts';
import { mountTextStyleControls } from './text-style-controls.ts';
import { mountTextTypographyControls } from './text-typography-controls.ts';
import { mountTextFrameControls } from './text-frame-controls.ts';
import { mountParagraphTokenControls } from './text-paragraph-token-controls.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
export function mountTextInspector(root: HTMLElement, ids: string[], port: TextPropertyPort, fonts?: FontsPort, tokenHost?: HostV1) {
  let currentState = port.read(ids);
  const readState = () => currentState;
  const refreshers: Array<(state: TextPropertyState) => void> = [];
  const caption = document.createElement('p'); caption.className = 'fc-insp-hint'; root.append(caption);
  let fieldRoot = root;
  const row = (label: string, control: HTMLElement) => textControlRow(fieldRoot, label, control);
  const select = (label: string, choices: Array<[string, string]>, read: (state: TextPropertyState) => string, command: (value: string) => TextPropertyCommand) => {
    const input = document.createElement('select'); input.setAttribute('aria-label', label);
    const mixed = new Option(t('Mixed'), ''); mixed.disabled = true; input.add(mixed);
    for (const [value, name] of choices) input.add(new Option(name, value));
    input.addEventListener('change', () => port.apply(ids, command(input.value), label)); row(label, input);
    refreshers.push(state => { if (document.activeElement === input) return; const value = read(state); if (value && ![...input.options].some(option => option.value === value)) input.add(new Option(value, value)); input.value = value; });
  };
  const number = (label: string, read: (state: TextPropertyState) => number | undefined, command: (value: number) => TextPropertyCommand, min: number, max: number) => {
    const field = textControlNumber(fieldRoot, label, { value: currentState ? read(currentState) ?? 'mixed' : 'mixed', min, max, step: 1, precision: 1, onCommit: value => port.apply(ids, command(value), label) });
    refreshers.push(state => field.set(read(state) ?? 'mixed'));
  };
  select(t('Font'), fonts?.options() ?? [], state => state.mixed.includes('font') ? '' : state.family, family => ({ kind: 'font', family }));
  fieldRoot = textControlGrid(root);
  number(t('Size'), state => state.mixed.includes('size') ? undefined : state.character.size ?? 16, size => ({ kind: 'character', value: { size } }), 1, 1000);
  select(t('Weight'), [100, 200, 300, 400, 500, 600, 700, 800, 900].map(weight => [String(weight), String(weight)]), state => state.mixed.includes('weight') ? '' : String(state.character.weight ?? 400), weight => ({ kind: 'font', weight: Number(weight) }));
  fieldRoot = root;
  const toolbar = document.createElement('div'); toolbar.className = 'text-control-toolbar'; root.append(toolbar);
  const toggles = document.createElement('div'); toggles.className = 'text-control-choices'; toggles.setAttribute('role', 'group'); toggles.setAttribute('aria-label', t('Text formatting')); toolbar.append(toggles);
  for (const [key, label, glyph] of [['weight', t('Bold'), 'B'], ['italic', t('Italic'), 'I'], ['underline', t('Underline'), 'U']] as const) {
    const button = textControlAction(toggles, label, () => {
      const state = readState(); if (!state) return;
      const enabled = !state.mixed.includes(key) && (key === 'weight' ? (state.character.weight ?? 400) >= 600 : !!state.character[key]);
      port.apply(ids, key === 'weight' ? { kind: 'font', weight: enabled ? 400 : 700 } : key === 'italic' ? { kind: 'font', italic: !enabled } : { kind: 'character', value: { underline: !enabled } }, label);
    });
    button.textContent = glyph; button.classList.add('text-control-icon'); button.dataset.textFormat = key;
    refreshers.push(state => button.setAttribute('aria-pressed', state.mixed.includes(key) ? 'mixed' : String(key === 'weight' ? (state.character.weight ?? 400) >= 600 : !!state.character[key])));
  }
  const color = document.createElement('div'); toolbar.append(color);
  const colorControl = mountTextColor(color, readState()?.character.color ?? '#000000', value => port.apply(ids, { kind: 'character', value: { color: value } }, t('Text colour')));
  refreshers.push(state => colorControl.update(state.character.color ?? '#000000', state.mixed.includes('color')));
  const paragraphs = mountParagraphControls(root, () => readState()?.paragraph ?? {}, (value, label) => port.apply(ids, { kind: 'paragraph', value }, label));
  refreshers.push(() => paragraphs.refresh());
  const typographyToken = port.typographyToken?.bind(port);
  const tokenControls = tokenHost?.tokens ? mountParagraphTokenControls(root, tokenHost, () => readState()?.paragraph ?? {}, (field, value) => port.apply(ids, { kind: 'paragraph-token', field, value }, value ? t('Link paragraph token') : t('Make paragraph custom')), () => ({ selection: readState()?.paragraphTokenSelection, active: readState()?.paragraphTokenActive, mixed: readState()?.paragraphTokenMixed, restoreRefs: readState()?.paragraphTokenRestores }),
    typographyToken ? { read: () => readState()?.paragraphTypography, write: link => typographyToken(ids, link) } : undefined) : undefined;
  if (tokenControls) refreshers.push(() => tokenControls.refresh());
  if(port.typography){const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('More character settings');advanced.append(summary);root.append(advanced);const controls=mountTextTypographyControls(advanced,port.typography(ids));refreshers.push(()=>controls.refresh());}
  const styles = mountTextStyleControls(root, () => readState()?.styles ?? { styles: [], paragraphOverrides: false, characterOverrides: false }, (value, label) => port.apply(ids, { kind: 'style', value }, label),value=>port.apply(ids,{kind:'style-definition',value},t('Update text style')));
  refreshers.push(() => styles.refresh());
  const frameGroup = textControlGroup(root, t('Frame options'));
  const frames = mountTextFrameControls(frameGroup,()=>readState()!.frame,()=>readState()?.linked ?? false,value=>port.apply(ids,{kind:'frame',value},t('Text frame')),()=>readState()?.appliedScale??1);
  refreshers.push(()=>frames.refresh());
  function refresh() {
    currentState = port.read(ids); const state = currentState; if (!state) { caption.textContent = t('Select text frames to format.'); return; }
    root.dataset.composedInspector = state.storyIds.join(' ');
    caption.textContent = state.scope === 'caret' ? t('At caret') : state.scope === 'range' ? t('Selected text') : t('Entire selected stories');
    for (const update of refreshers) update(state);
  }
  styleTextControls(root);
  const off = port.subscribe(refresh); refresh();
  return { destroy() { destroyTextControls(root); colorControl.close(); tokenControls?.destroy(); off(); } };
}
