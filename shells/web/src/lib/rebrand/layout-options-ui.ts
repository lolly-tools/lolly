// SPDX-License-Identifier: MPL-2.0
/** Recommendations inside the existing layout chooser, with no plan writes until a pick. */
import type { LayoutOption, LayoutOptionsResult } from '../../../../../engine/src/rebrand-layout-options.ts';
import { t, tRaw } from '../../i18n.ts';
import { aiAllowed, aiPolicy } from '../ai-policy.ts';
import { embedAvailable } from '../ask/embed.ts';
import { embedModelOffer } from '../ask/embed-offer.ts';
import { downloadEmbedModel } from '../ask/embed-download.ts';
import { modelPartInfo } from '../model-parts.ts';
import { fmtBytes } from '../format.ts';
import { suggestLayouts, type LayoutOptionsRun } from './layout-options.ts';
import type { LayoutOptionsRequest } from './stage-layout-options.ts';

export interface LayoutOptionsUiDeps {
  request: () => LayoutOptionsRequest | null;
  draw: (option: LayoutOption) => Element | null;
  preview: (id: string | null) => void;
  pick: (id: string) => void;
  autoStart?: boolean;
  run?: (input: LayoutOptionsRequest, opts: LayoutOptionsRun) => Promise<LayoutOptionsResult>;
}

export function mountLayoutOptions(deps: LayoutOptionsUiDeps): { root: HTMLElement; dispose: () => void } {
  const root = document.createElement('section');
  root.className = 'rb-layout-options';
  root.dataset.layoutOptions = '';
  const label = document.createElement('label');
  label.textContent = t('What would work better?');
  const intent = document.createElement('input');
  intent.className = 'field-input';
  intent.type = 'text'; intent.maxLength = 400;
  intent.placeholder = t('Optional: compare ideas, show steps…');
  intent.setAttribute('aria-label', t('What should this layout emphasise?'));
  intent.dataset.key = 'layout-intent';
  label.append(intent);
  const actions = document.createElement('div'); actions.className = 'rb-layout-options-actions';
  const go = document.createElement('button'); go.type = 'button'; go.className = 'btn';
  go.dataset.key = 'suggest-layouts'; go.textContent = t('Generate layouts');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn';
  cancel.textContent = t('Cancel'); cancel.hidden = true;
  const model = document.createElement('button'); model.type = 'button'; model.className = 'btn'; model.hidden = true;
  model.dataset.key = 'layout-model';
  const status = document.createElement('p'); status.className = 'lp-help'; status.setAttribute('role', 'status');
  status.textContent = t('Layouts sized for this slide, using your brand.');
  const results = document.createElement('div'); results.className = 'rb-layout-options-results';
  const refine = document.createElement('details'); refine.className = 'rb-layout-refine';
  const summary = document.createElement('summary'); summary.textContent = t('Refine layouts');
  refine.append(summary, label, model);
  const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'btn btn--primary';
  apply.dataset.key = 'apply-layout-option'; apply.textContent = t('Apply layout'); apply.hidden = true;
  actions.append(go, cancel); root.append(status, apply, results, actions, refine);
  let disposed = false;
  let running: AbortController | null = null;
  let modelReady = false;
  let detachDownload: (() => void) | undefined;
  let last: LayoutOptionsResult | null = null;
  let selected: string | null = null;
  const clear = (): void => { selected = null; apply.hidden = true; last = null; results.replaceChildren(); deps.preview(null); };
  apply.addEventListener('click', () => {
    if (live() && selected && (!last?.modelUsed || aiAllowed('embedding'))) deps.pick(selected);
  });
  const live = (): boolean => !disposed && root.isConnected;
  const probe = async (): Promise<void> => {
    if (!embedAvailable()) { model.hidden = true; modelReady = false; return; }
    try {
      const info = await modelPartInfo('ask');
      if (disposed) return;
      modelReady = info.allowed && info.ready === true;
      model.hidden = modelReady || !info.allowed || !info.available;
      model.textContent = tRaw('Download local matching ({size})', { size: fmtBytes(info.bytes ?? 23_685_047) });
      model.title = t('Optional download. Slide content stays on this device.');
    } catch { modelReady = false; model.hidden = true; }
  };
  const stop = (): void => {
    running?.abort(); running = null; go.disabled = false; cancel.hidden = true; intent.disabled = false;
  };
  cancel.addEventListener('click', () => { stop(); status.textContent = t('Layout suggestions cancelled.'); });
  intent.addEventListener('input', clear);
  model.addEventListener('click', () => {
    model.disabled = true;
    void embedModelOffer().then(offer => {
      if (!live()) return;
      if (!offer) { model.disabled = false; void probe(); return; }
      detachDownload?.();
      const download = downloadEmbedModel(offer.manifest, {
        onProgress: () => { if (live()) model.textContent = t('Downloading local matching…'); },
        onDone: () => { if (live()) { model.disabled = false; void probe(); status.textContent = t('Local matching is ready. Choose Suggest layouts.'); } },
        onError: () => { if (live()) { model.disabled = false; void probe(); status.textContent = t('The download did not finish. Layout checks still work.'); } },
      });
      detachDownload = download.detach;
    }).catch(() => { if (live()) { model.disabled = false; status.textContent = t('Local matching is unavailable. Layout checks still work.'); } });
  });
  go.addEventListener('click', () => {
    const input = deps.request();
    if (!input) return;
    stop();
    const controller = new AbortController(); running = controller;
    go.disabled = true; cancel.hidden = false; intent.disabled = true;
    clear();
    status.textContent = modelReady ? t('Matching and checking layouts on this device…') : t('Checking layouts…');
    void (deps.run ?? suggestLayouts)({ ...input, intent: intent.value.trim() }, {
      signal: controller.signal, useModel: modelReady,
      progress: (done, total) => { if (live() && running === controller) status.textContent = tRaw('Checked {done} of {total} layouts.', { done, total }); },
    }).then(result => {
      if (!live() || running !== controller || controller.signal.aborted) return;
      last = result;
      root.dataset.matching = result.modelUsed ? 'local' : 'rules';
      const unread = result.rejected.some(r => r.issues.includes('unread-picture'));
      status.textContent = result.options.length
        ? t('Select a layout to preview. Apply when you are happy with the result.')
        : unread ? t('Read the text in this slide picture before suggesting editable layouts.')
          : t('No suitable layout passed the checks. Browse arrangement options below, or review the slide content.');
      if (!result.options.length && !unread) {
        const issues = new Set(result.rejected.flatMap(row => row.issues));
        if (issues.has('missing-content') || issues.has('tray')) status.textContent += ` ${t('Some content could not be placed on the slides.')}`;
        else if (issues.has('overflow')) status.textContent += ` ${t('The text did not fit without clipping.')}`;
        else if (issues.has('omitted-vector')) status.textContent += ` ${t('The source reading has omissions to review.')}`;
      }
      if (input.source.slides[0]?.recovery) status.textContent += ` ${t('Check the recognised text against the original.')}`;
      for (const option of result.options) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'rb-layout-option';
        button.dataset.layoutOption = option.id;
        const art = deps.draw(option); if (art) button.append(art);
        const name = document.createElement('span'); name.textContent = option.name; button.append(name);
        const detail = document.createElement('small');
        const objects = option.keptObjects === 1 ? t('1 object') : tRaw('{count} objects', { count: option.keptObjects });
        const slides = option.frameCount === 1 ? t('1 slide') : tRaw('{count} slides', { count: option.frameCount });
        detail.textContent = `${objects} · ${slides}`; button.append(detail);
        button.title = t('Preview this layout, then choose to apply to this slide.');
        button.addEventListener('pointerenter', () => deps.preview(option.id));
        button.addEventListener('pointerleave', () => deps.preview(selected));
        button.addEventListener('focus', () => deps.preview(option.id));
        button.addEventListener('blur', () => deps.preview(selected));
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          if (!live()) return;
          selected = option.id;
          for (const choice of results.querySelectorAll('button')) choice.setAttribute('aria-pressed', String(choice === button));
          deps.preview(selected); apply.hidden = false;
          apply.textContent = tRaw('Apply {name}', { name: option.name });
        });
        results.append(button);
      }
    }).catch(() => {
      if (live() && running === controller && !controller.signal.aborted) status.textContent = t('Layout checks could not finish. Try again or choose a layout below.');
    }).finally(() => { if (running === controller) stop(); });
  });
  const unsubscribe = aiPolicy.subscribe(() => {
    if (aiAllowed('embedding')) return;
    modelReady = false; model.hidden = true;
    if (running || last?.modelUsed) {
      stop(); clear();
      status.textContent = t('Local matching is unavailable. Choose Suggest layouts to check without the model.');
    }
  });
  const start = setTimeout(() => { void probe().then(() => { if (live() && deps.autoStart && !running) go.click(); }); }, 0);
  return { root, dispose() { disposed = true; clearTimeout(start); stop(); detachDownload?.(); unsubscribe(); } };
}
