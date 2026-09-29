// SPDX-License-Identifier: MPL-2.0
import { compileMotionCues, parseMotionTiming, resolveCues, type MotionTiming } from '../../../../../engine/src/motion-cues.ts';
import { mountModal } from '../../components/modal.ts';
import { t } from '../../i18n.ts';
import type { Box } from '../timeline-math.ts';
import type { TpCtx } from './context.ts';

export function cueTimingOps(tp: TpCtx) {
  let close: (() => void) | undefined;
  const read = (): MotionTiming => { try { return parseMotionTiming(tp.opts.projectTime?.timing?.()); } catch { return { version: 1, cues: [], bindings: [] }; } };
  const sync = (): void => {
    tp.rulerInner?.querySelector('.tl-cues')?.remove();
    if (!tp.rulerInner || !tp.opts.projectTime?.timing) return;
    let timing: MotionTiming;
    try { timing = read(); } catch { return; }
    const layer = document.createElement('div'); layer.className = 'tl-cues';
    const times = resolveCues(timing), duration = tp.clock.duration() / 1000;
    const add = (seconds: number, label: string, cue: boolean): void => {
      const mark = document.createElement(cue ? 'button' : 'span'); mark.className = cue ? 'tl-marker' : 'tl-beat';
      mark.style.cssText = `position:absolute;left:${seconds * tp.pxPerSec}px;top:${cue ? 16 : 0}px;font-size:9px`;
      mark.textContent = label; mark.setAttribute('aria-label', `${label} ${seconds.toFixed(3)}s`);
      if (cue) mark.addEventListener('click', () => tp.clock.seek(seconds * 1000));
      layer.append(mark);
    };
    if (timing.tempo?.bpm) {
      const beat = 60 / timing.tempo.bpm, offset = timing.tempo.offset;
      const step = Math.max(1, Math.ceil(30 / (beat * tp.pxPerSec)));
      const first = Math.max(0, Math.ceil(-offset / beat));
      for (let i = first, count = 0; offset + i * beat <= duration && count < 2000; i += step, count++) {
        const bar = Math.floor(i / timing.tempo.beatsPerBar) + 1, within = i % timing.tempo.beatsPerBar + 1;
        add(offset + i * beat, `${bar}.${within}`, false);
      }
    }
    for (const [id, at] of Object.entries(times)) add(at, id, true);
    tp.rulerInner.append(layer);
  };
  const open = (): void => {
    const project = tp.opts.projectTime;
    if (!project?.writeTiming) return;
    close?.();
    const timing = read(), view = mountModal('', { className: 'modal tl-junction-modal', ariaLabel: t('Beat and cue timing') });
    close = () => view.close();
    const form = document.createElement('form'); form.className = 'tl-junction';
    const heading = document.createElement('h2'); heading.textContent = t('Beat and cue timing'); form.append(heading);
    const field = (label: string, input: HTMLElement): void => { const row = document.createElement('label'); row.className = 'field-row'; const name = document.createElement('span'); name.textContent = label; row.append(name, input); form.append(row); };
    const number = (value: string, min: string, max: string, step: string): HTMLInputElement => { const input = document.createElement('input'); input.type = 'number'; input.className = 'field-input'; input.value = value; input.min = min; input.max = max; input.step = step; return input; };
    const bpm = number(timing.tempo?.bpm?.toString() ?? '', '1', '400', 'any'); field(t('Tempo (BPM, optional)'), bpm);
    const offset = number(String(timing.tempo?.offset ?? 0), '-3600', '3600', 'any'); field(t('Beat offset (s)'), offset);
    const meter = number(String(timing.tempo?.beatsPerBar ?? 4), '1', '32', '1'); field(t('Beats per bar'), meter);
    const snap = document.createElement('input'); snap.type = 'checkbox'; snap.checked = !!timing.snap; field(t('Snap edits to beats'), snap);
    const cue = document.createElement('input'); cue.className = 'field-input'; cue.maxLength = 80; field(t('Cue name (optional)'), cue);
    const at = number(String(tp.clock.t() / 1000), '0', '3600', 'any'); field(t('Cue position'), at);
    const unit = document.createElement('select'); unit.className = 'field-input';
    for (const [value, label] of [['seconds', t('Seconds')], ['beats', t('Beats from offset')]]) { const option = document.createElement('option'); option.value = value!; option.textContent = label!; unit.append(option); }
    field(t('Position unit'), unit);
    const bind = document.createElement('input'); bind.type = 'checkbox'; field(t('Bind selected layer starts to this cue'), bind);
    const summary = document.createElement('p'); summary.setAttribute('role', 'status'); form.append(summary);
    const preview = document.createElement('button'); preview.type = 'submit'; preview.className = 'btn'; preview.textContent = t('Preview changes');
    const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'btn btn--primary'; apply.textContent = t('Apply'); apply.disabled = true;
    form.append(preview, apply); view.el.append(form);
    let result: ReturnType<typeof compileMotionCues<Box>> | null = null;
    let sourceWire = '';
    form.addEventListener('input', () => { result = null; apply.disabled = true; });
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const next: MotionTiming = { ...timing, tempo: { bpm: bpm.value ? Number(bpm.value) : null, offset: Number(offset.value), beatsPerBar: Number(meter.value) }, snap: snap.checked, cues: [...timing.cues], bindings: [...timing.bindings] };
        if (cue.value.trim()) {
          const id = cue.value.trim(); next.cues = next.cues.filter(item => item.id !== id);
          next.cues.push({ id, ...(unit.value === 'beats' ? { beat: Number(at.value) } : { at: Number(at.value) }) });
          if (bind.checked) for (const layerId of tp.selection.get()) {
            next.bindings = next.bindings.filter(item => item.layerId !== layerId || item.target !== 'start');
            next.bindings.push({ layerId, cueId: id, target: 'start' });
          }
        }
        const source = tp.getBoxes();
        result = compileMotionCues(source, next); sourceWire = JSON.stringify(source);
        summary.textContent = `${result.changes.length} ${t('timing changes')}: ${[...new Set(result.changes.map(change => change.layerId))].join(', ')}. ${result.detached.length} ${t('manual edits kept')}.`;
        apply.disabled = false;
      } catch (error) { result = null; apply.disabled = true; summary.textContent = String((error as Error).message); }
    });
    apply.addEventListener('click', async () => {
      if (!result || apply.disabled) return;
      apply.disabled = true;
      try {
        if (JSON.stringify(tp.getBoxes()) !== sourceWire) throw new Error(t('The layers changed. Preview the timing again before applying.'));
        await project.writeTiming!(result.boxes, JSON.stringify(result.timing));
        view.close(); sync();
      } catch (error) { summary.textContent = String((error as Error).message); }
      finally { apply.disabled = false; }
    });
  };
  return { sync, read, destroy() { close?.(); }, wire() { if (!tp.opts.projectTime?.timing) return; const button = tp.helpers.actionBtn('tl-cue-timing', t('Beat and cue timing'), 'pin'); button.addEventListener('click', open); tp.tools.append(button); } };
}
