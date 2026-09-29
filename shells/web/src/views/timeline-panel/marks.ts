// SPDX-License-Identifier: MPL-2.0
import { parseSequenceMarks, serialiseSequenceMarks, sequenceRange, chaptersVtt, type MarkerKind, type SequenceMarks } from '../../../../../engine/src/sequence-marks.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { mountBodyPopover } from '../../components/body-popover.ts';
import { mountModal } from '../../components/modal.ts';
import { bindOp, type TpCtx } from './context.ts';

export function read(tp: TpCtx): SequenceMarks { return parseSequenceMarks(tp.opts.projectTime?.marks()); }
function write(tp: TpCtx, marks: SequenceMarks): void {
  tp.opts.projectTime?.writeMarks(serialiseSequenceMarks(marks));
  sync(tp);
}
export function add(tp: TpCtx, edit = false): void {
  if (!tp.opts.projectTime) return;
  const marks = read(tp);
  const ms = Math.round(tp.helpers.quantiseTime(tp.clock.t() / 1000) * 1000);
  const index = marks.markers.findIndex(m => m.ms === ms);
  if (index >= 0) { if (edit) editMarker(tp, index); return; }
  if (marks.markers.length >= 256) return;
  marks.markers.push({ kind: 'm', ms, label: '', color: '888888' });
  marks.markers.sort((a, b) => a.ms - b.ms);
  write(tp, marks);
  if (edit) editMarker(tp, marks.markers.findIndex(m => m.ms === ms));
}
export function setMark(tp: TpCtx, side: 'inMs' | 'outMs'): void {
  if (!tp.opts.projectTime) return;
  const marks = read(tp);
  marks[side] = Math.round(tp.helpers.quantiseTime(tp.clock.t() / 1000) * 1000);
  if (side === 'inMs' && marks.outMs !== undefined && marks.outMs <= marks.inMs!) delete marks.outMs;
  if (side === 'outMs' && marks.inMs !== undefined && marks.inMs >= marks.outMs!) delete marks.inMs;
  write(tp, marks);
}
export function seek(tp: TpCtx, direction: number): void {
  const at = tp.clock.t();
  const points = read(tp).markers.map(m => m.ms);
  const next = direction > 0 ? points.find(ms => ms > at + 1) : points.reverse().find(ms => ms < at - 1);
  if (next !== undefined) tp.clock.seek(next);
}
export function editMarker(tp: TpCtx, index: number): void {
  const marks = read(tp);
  const marker = marks.markers[index];
  if (!marker) return;
  tp.clock.pause();
  const modal = mountModal('', { className: 'modal tl-junction-modal', ariaLabel: t('Marker') });
  const form = document.createElement('form');
  form.className = 'tl-junction';
  const heading = document.createElement('h2'); heading.textContent = t('Marker'); form.append(heading);
  const field = (name: string, input: HTMLElement): void => {
    const label = document.createElement('label'); label.className = 'field-row';
    const title = document.createElement('span'); title.textContent = name;
    label.append(title, input); form.append(label);
  };
  const label = document.createElement('input'); label.className = 'field-input'; label.value = marker.label; label.maxLength = 160;
  field(t('Label'), label);
  const kind = document.createElement('select'); kind.className = 'field-input';
  for (const [value, text] of [['m', t('Marker')], ['c', t('Chapter')], ['r', t('Range')], ['n', t('Note')]]) {
    const option = document.createElement('option'); option.value = value!; option.textContent = text!; kind.append(option);
  }
  kind.value = marker.kind; field(t('Type'), kind);
  const color = document.createElement('input'); color.type = 'color'; color.value = `#${marker.color}`; field(t('Colour'), color);
  const end = document.createElement('input'); end.type = 'number'; end.className = 'field-input'; end.min = String(marker.ms / 1000);
  end.max = '3600'; end.step = String(tp.helpers.frameStep()); end.value = String((marker.endMs ?? marker.ms + 1000) / 1000);
  field(t('End (s)'), end);
  const update = (): void => { end.parentElement!.hidden = kind.value !== 'r'; }; kind.addEventListener('change', update); update();
  const actions = document.createElement('div'); actions.className = 'tl-junction-actions';
  const remove = tp.helpers.actionBtn('', t('Delete'), 'trash');
  remove.addEventListener('click', () => { marks.markers.splice(index, 1); write(tp, marks); modal.close(); });
  const done = document.createElement('button'); done.type = 'submit'; done.className = 'btn btn--primary'; done.textContent = t('Done');
  actions.append(remove, done); form.append(actions); modal.el.append(form); label.focus();
  form.addEventListener('submit', event => {
    event.preventDefault();
    marks.markers[index] = { ...marker, kind: kind.value as MarkerKind, label: label.value,
      color: color.value.slice(1), endMs: kind.value === 'r' ? Math.max(marker.ms + 1, Math.min(3_600_000, Math.round(tp.helpers.quantiseTime(Number(end.value)) * 1000))) : undefined };
    write(tp, marks); modal.close();
  });
}
export function sync(tp: TpCtx): void {
  if (!tp.opts.projectTime || !tp.rulerInner) return;
  tp.rulerInner.querySelector('.tl-marks')?.remove();
  const layer = document.createElement('div'); layer.className = 'tl-marks';
  const marks = read(tp);
  marks.markers.forEach((mark, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'tl-marker';
    button.style.left = `${mark.ms / 1000 * tp.pxPerSec}px`; button.style.color = `#${mark.color}`;
    button.textContent = '◆'; button.title = `${mark.label || t('Marker')} · ${(mark.ms / 1000).toFixed(3)}s`;
    button.setAttribute('aria-label', button.title);
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', () => { tp.clock.seek(mark.ms); editMarker(tp, i); });
    layer.append(button);
  });
  if (marks.inMs !== undefined || marks.outMs !== undefined) {
    const range = sequenceRange(marks, tp.rows.durationSec() * 1000);
    const band = document.createElement('div'); band.className = 'tl-marked-range';
    band.style.left = `${range.fromMs / 1000 * tp.pxPerSec}px`;
    band.style.width = `${(range.toMs - range.fromMs) / 1000 * tp.pxPerSec}px`;
    band.title = `${t('Range')} ${(range.fromMs / 1000).toFixed(2)}–${(range.toMs / 1000).toFixed(2)}s`;
    layer.append(band);
  }
  tp.rulerInner.append(layer);
  tp.cues?.sync();
}
export function wire(tp: TpCtx): void {
  if (!tp.opts.projectTime) return;
  const trigger = tp.helpers.actionBtn('tl-marks-menu', t('Markers'), 'pin');
  const actions: [string, () => void][] = [
    [t('Add marker'), () => add(tp, true)], [t('Set in point'), () => setMark(tp, 'inMs')],
    [t('Set out point'), () => setMark(tp, 'outMs')],
    [t('Clear range'), () => { const marks = read(tp); delete marks.inMs; delete marks.outMs; write(tp, marks); }],
    [t('Export chapters'), () => {
      const blob = new Blob([chaptersVtt(read(tp), tp.rows.durationSec() * 1000)], { type: 'text/vtt' });
      void tp.host.export?.download(blob, 'chapters.vtt').catch(() => announce(t('Export failed'), { assertive: true }));
    }],
    [t('Preview mix'), () => { void tp.rangePreview.open(); }],
    [t('Review frames'), () => { void tp.rangePreview.open(true); }],
  ];
  tp.markerMenu = mountBodyPopover(trigger, (el, pop) => {
    el.textContent = '';
    for (const [text, action] of actions) {
      const button = tp.menus.menuItem(text, 'pin', () => { pop.close(true); action(); });
      el.append(button);
    }
    return el.querySelector('button');
  }, { className: 'folder-menu tl-menu', ariaLabel: t('Markers'), position: tp.menus.menuPosition });
  trigger.addEventListener('click', () => { if (tp.markerMenu?.isOpen()) tp.markerMenu.close(true); else tp.markerMenu?.open(); });
  tp.tools.append(trigger);
}
export function marksOps(tp: TpCtx) {
  return { read: bindOp(tp, read), add: bindOp(tp, add), setMark: bindOp(tp, setMark), seek: bindOp(tp, seek), sync: bindOp(tp, sync), wire: bindOp(tp, wire) };
}
