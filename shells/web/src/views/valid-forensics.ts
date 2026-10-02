// SPDX-License-Identifier: MPL-2.0
/** Event delegation keeps asynchronous evidence tied to its original file and panel. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { verifyForensicReport } from '../../../../engine/src/forensic.ts';
import type { ForensicReport } from '../../../../engine/src/forensic.ts';
import { startJob, cancelJob } from '../lib/jobs.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { collectForensicFile } from './valid-forensics-collect.ts';
import {
  forensicWorkspaceHtml,
  forensicVisibleFindings,
  readableForensicReport,
  type ForensicViewState,
} from './valid-forensics-render.ts';
import { DEFAULT_LAYERS, pageHeat, stepSegment } from './valid-forensics-heat.ts';
import '../styles/parts/valid-forensics.css';
const reportStates = new WeakMap<HTMLElement, ForensicViewState>();
export const forensicStateForReport = (panel: HTMLElement): ForensicViewState | undefined => reportStates.get(panel);
export { forensicPanelHtml } from './valid-forensics-render.ts';
export function wireForensicVerify(
  root: HTMLElement,
  host: HostV1,
  files: () => File[]
): () => void {
  const states = new Map<HTMLElement, ForensicViewState>(),
    running = new Map<HTMLElement, { controller: AbortController; job: string }>();
  let alive = true;
  const started = new WeakSet<HTMLElement>();
  const dispose = (panel: HTMLElement) => {
    const active = running.get(panel);
    if (active) {
      active.controller.abort();
      cancelJob(active.job);
      running.delete(panel);
    }
    for (const url of states.get(panel)?.collection.previews.values() ?? [])
      URL.revokeObjectURL(url);
    states.delete(panel);
    reportStates.delete(panel);
  };
  const observer = new MutationObserver(() => {
    for (const panel of new Set([...states.keys(), ...running.keys()]))
      if (!root.contains(panel)) dispose(panel);
    for (const panel of root.querySelectorAll<HTMLElement>('[data-forensic-index]')) {
      if (started.has(panel) || !files()[Number(panel.dataset.forensicIndex)]) continue;
      started.add(panel);
      void inspect(panel);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  const content = (panel: HTMLElement) =>
    panel.querySelector<HTMLElement>('[data-forensic-content]')!;
  const paint = (panel: HTMLElement) => {
    const state = states.get(panel);
    if (state && alive && root.contains(panel)) {
      reportStates.set(panel, state);
      const prior = panel.querySelector('.forensic-preview-scroll');
      const top = prior?.scrollTop ?? 0,
        left = prior?.scrollLeft ?? 0;
      content(panel).innerHTML = forensicWorkspaceHtml(state);
      const next = panel.querySelector('.forensic-preview-scroll');
      if (next) {
        next.scrollTop = top;
        next.scrollLeft = left;
      }
    }
  };
  async function inspect(panel: HTMLElement): Promise<void> {
    if (running.has(panel)) return;
    const file = files()[Number(panel.dataset.forensicIndex)];
    if (!file) return;
    const previous = states.get(panel),
      pageCap = Math.min(100, Math.max(6, (previous?.collection.report.pages.length ?? 0) + 6));
    const controller = new AbortController();
    const job = startJob({ title: t('Inspecting AI evidence'), cancel: () => controller.abort() });
    running.set(panel, { controller, job: job.id });
    content(panel).innerHTML =
      `<div class="forensic-progress" role="status"><span data-forensic-progress>${t('Waiting to inspect this file…')}</span><button type="button" class="btn" data-forensic="cancel">${t('Cancel inspection')}</button></div>${previous ? forensicWorkspaceHtml(previous) : ''}`;
    panel.setAttribute('aria-busy', 'true');
    try {
      await job.started;
      const collection = await collectForensicFile(file, host, {
        signal: controller.signal,
        pageCap,
        origins: JSON.parse(panel.dataset.forensicOrigins ?? '[]'),
        progress: (done, total) => {
          job.progress(done, total);
          const label = panel.querySelector('[data-forensic-progress]');
          if (label) label.textContent = t('Inspecting pages: {done} of {total}', { done, total });
        },
      });
      if (
        !alive ||
        !root.contains(panel) ||
        files()[Number(panel.dataset.forensicIndex)] !== file
      ) {
        for (const url of collection.previews.values()) URL.revokeObjectURL(url);
        return;
      }
      for (const url of previous?.collection.previews.values() ?? []) URL.revokeObjectURL(url);
      states.set(panel, {
        collection,
        page: collection.report.pages[0]?.id ?? '',
        selected: collection.report.findings[0]?.id ?? '',
        location: 0,
        zoom: previous?.zoom ?? 100,
        filter: 'all',
        overlays: true,
        annotations: [],
        skippedModel: previous?.skippedModel,
        ...(previous?.layers ? { layers: previous.layers } : {}),
        history: previous
          ? [
              ...(previous.history ?? []),
              { report: previous.collection.report, annotations: previous.annotations },
            ].slice(-5)
          : [],
      });
      const initial = panel.querySelector<HTMLElement>(':scope > button');
      if (initial) initial.hidden = true;
      paint(panel);
      job.finish();
      announce(
        controller.signal.aborted
          ? t('Inspection cancelled. Collected evidence and unread portions are shown.')
          : t('AI evidence inspection finished. Coverage and limitations are available.')
      );
    } catch (error) {
      if (alive && root.contains(panel)) {
        if (previous) {
          previous.message = error instanceof Error ? error.message : String(error);
          paint(panel);
        } else content(panel).textContent = error instanceof Error ? error.message : String(error);
      }
      job.fail(error);
    } finally {
      running.delete(panel);
      panel.removeAttribute('aria-busy');
      job.settle();
    }
  }
  const save = (text: string, type: string, name: string) => {
    void host.export.download(new Blob([text], { type }), name).catch(error => announce(error instanceof Error ? error.message : t('Could not save evidence.')));
  };
  async function click(event: Event): Promise<void> {
    const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-forensic]')
          : null,
      panel = target?.closest<HTMLElement>('[data-forensic-index]');
    if (!target || !panel) return;
    const action = target.dataset.forensic,
      state = states.get(panel);
    if (action === 'cancel') {
      const active = running.get(panel);
      if (active) cancelJob(active.job);
      target.textContent = t('Cancelling…');
      target.setAttribute('disabled', '');
      return;
    }
    if (action === 'inspect') {
      await inspect(panel);
      return;
    }
    if (action === 'ocr' || action === 'model') {
      const { ensureModel } = await import('../lib/model-offer.ts');
      if (
        await ensureModel(action === 'ocr' ? 'ocr' : 'ai-detect', {
          reason: t('AI evidence inspection'),
        })
      )
        await inspect(panel);
      return;
    }
    if (!state) return;
    if (action === 'skip-model') { state.skippedModel = true; paint(panel); return; }
    if (action === 'segment' || action === 'segment-step' || action === 'region' || action === 'inspect-close') {
      const report = state.collection.report;
      const previous = state.inspect;
      if (action === 'inspect-close') state.inspect = undefined;
      else if (action === 'region') state.inspect = { kind: 'region', index: Number(target.dataset.region) };
      else
        state.inspect = {
          kind: 'segment',
          index:
            action === 'segment'
              ? Number(target.dataset.seg)
              : stepSegment(report, state.page, previous?.index ?? 0, Number(target.dataset.step)),
        };
      paint(panel);
      const open = state.inspect ?? previous;
      // Focus stays in the text (or on the page), where the reader is working;
      // the inspector next to the text is announced rather than jumped to.
      const anchor = open
        ? panel.querySelector<HTMLElement>(
            open.kind === 'region' ? `[data-forensic="region"][data-region="${open.index}"]` : `.fh-text [data-seg="${open.index}"]`
          )
        : null;
      anchor?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (anchor?.tabIndex === 0 || anchor?.matches('button')) anchor.focus({ preventScroll: true });
      if (state.inspect?.kind === 'segment') {
        const segment = pageHeat(report, state.page).segments[state.inspect.index];
        announce(
          segment?.signals.length
            ? t('{count} signals in this sentence: {labels}', { count: segment.signals.length, labels: segment.signals.map((s) => s.label).join(', ') })
            : t('No located pattern in this sentence.')
        );
      }
      return;
    }
    if (action === 'select') {
      state.selected = target.dataset.finding ?? '';
      state.location = Number(target.dataset.location ?? 0);
      state.page =
        state.collection.report.findings.find((f) => f.id === state.selected)?.locations[
          state.location
        ]?.page ?? state.page;
      paint(panel);
      const focus = [...panel.querySelectorAll<HTMLElement>('[data-finding]')].find(
        (el) => el.dataset.finding === state.selected && el.closest('.forensic-findings')
      );
      focus?.focus();
      announce(state.collection.report.findings.find((f) => f.id === state.selected)?.label ?? '');
    } else if (action === 'location') {
      state.location = Number(target.dataset.location);
      state.page =
        state.collection.report.findings.find((f) => f.id === state.selected)?.locations[
          Number(target.dataset.location)
        ]?.page ?? state.page;
      paint(panel);
      panel
        .querySelector('.forensic-region.is-selected')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      panel
        .querySelector<HTMLElement>(`[data-forensic="location"][data-location="${state.location}"]`)
        ?.focus({ preventScroll: true });
    } else if (action === 'annotate') {
      const kind = panel.querySelector<HTMLSelectElement>('[data-forensic-annotation]')!.value as
        | 'brand-requirement'
        | 'quoted-example'
        | 'misdetected';
      state.annotations.push({
        reportSha256: state.collection.report.reportSha256,
        finding: state.selected,
        kind,
        note: panel
          .querySelector<HTMLTextAreaElement>('[data-forensic-note]')!
          .value.slice(0, 1000),
      });
      state.message = t('Review note saved with this assessment.');
      paint(panel);
      announce(state.message);
    } else if (action === 'json')
      save(
        JSON.stringify(
          {
            profile: 'lolly/forensic-review-v1',
            report: state.collection.report,
            annotations: state.annotations,
            history: state.history ?? [],
          },
          null,
          2
        ),
        'application/json',
        'ai-evidence.json'
      );
    else if (action === 'readable')
      save(
        readableForensicReport(state.collection.report, state.annotations),
        'text/markdown',
        'ai-evidence.md'
      );
  }
  async function change(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement,
      panel = target.closest<HTMLElement>('[data-forensic-index]');
    if (!panel) return;
    const state = states.get(panel);
    if (!state) return;
    if (target.matches('[data-forensic-page]')) {
      state.page = target.value;
      state.inspect = undefined;
    } else if (target.matches('[data-forensic-layer]')) {
      const key = target.dataset.forensicLayer as keyof typeof DEFAULT_LAYERS;
      state.layers = { ...(state.layers ?? DEFAULT_LAYERS), [key]: target.checked };
    } else if (target.matches('[data-forensic-filter]')) {
      state.filter = target.value;
      const visible = forensicVisibleFindings(state);
      if (!visible.some((f) => f.id === state.selected)) {
        state.selected = visible[0]?.id ?? '';
        state.location = 0;
      }
    } else if (target.matches('[data-forensic-overlays]')) state.overlays = target.checked;
    else if (target.matches('[data-forensic-reload]')) {
      const upload = target.files?.[0],
        original = files()[Number(panel.dataset.forensicIndex)];
      if (!upload || !original || upload.size > 8_000_000) return;
      try {
        const parsed = JSON.parse(await upload.text()) as {
          profile?: string;
          report: ForensicReport;
          annotations?: ForensicViewState['annotations'];
        };
        if (
          !(await verifyForensicReport(parsed.report, new Uint8Array(await original.arrayBuffer())))
        )
          throw new Error('Evidence does not match this file, or its report hash changed.');
        if (parsed.report.likelihood.state !== 'unavailable')
          throw new Error('No installed calibration can validate this probability claim.');
        if (parsed.profile !== 'lolly/forensic-review-v1')
          throw new Error('Unsupported review report.');
        const annotations = parsed.annotations ?? [];
        if (
          !Array.isArray(annotations) ||
          annotations.length > 1000 ||
          annotations.some(
            (a) =>
              a.reportSha256 !== parsed.report.reportSha256 ||
              !parsed.report.findings.some((f) => f.id === a.finding) ||
              !['brand-requirement', 'quoted-example', 'misdetected'].includes(a.kind) ||
              typeof a.note !== 'string' ||
              a.note.length > 1000
          )
        )
          throw new Error('Invalid review notes.');
        state.collection.report = parsed.report;
        state.annotations = annotations;
        state.imported = true;
        state.page = parsed.report.pages[0]?.id ?? '';
        state.selected = parsed.report.findings[0]?.id ?? '';
        state.location = 0;
        state.message = t('Evidence reloaded and matched to this file.');
      } catch (error) {
        state.message = error instanceof Error ? error.message : String(error);
        paint(panel);
        announce(state.message);
        return;
      }
    } else return;
    paint(panel);
    if (target.matches('[data-forensic-filter]'))
      panel.querySelector<HTMLElement>('[data-forensic-filter]')?.focus({ preventScroll: true });
    if (target.matches('[data-forensic-page]'))
      panel.querySelector<HTMLElement>('[data-forensic-page]')?.focus({ preventScroll: true });
    if (target.matches('[data-forensic-overlays]'))
      panel.querySelector<HTMLElement>('[data-forensic-overlays]')?.focus({ preventScroll: true });
    if (target.matches('[data-forensic-layer]'))
      panel
        .querySelector<HTMLElement>(`[data-forensic-layer="${target.dataset.forensicLayer}"]`)
        ?.focus({ preventScroll: true });
  }
  const onClick = (event: Event) => {
      void click(event).catch((error) => announce(String(error)));
    },
    onChange = (event: Event) => {
      void change(event).catch((error) => announce(String(error)));
    };
  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-forensic-zoom]')) {
      const panel = target.closest<HTMLElement>('[data-forensic-index]');
      const state = panel && states.get(panel);
      if (state) state.zoom = Number(target.value);
      const output = panel?.querySelector('[data-forensic-zoom-value]');
      if (output) output.textContent = `${target.value}%`;
      const preview = target
        .closest('[data-forensic-index]')
        ?.querySelector<HTMLElement>('.forensic-preview');
      if (preview) preview.style.width = `${target.value}%`;
    }
  };
  // A lit sentence is a span with role=button, so Enter and Space must open the sentence too.
  const onKeydown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      target instanceof HTMLElement &&
      target.matches('[data-forensic="segment"][role="button"]')
    ) {
      event.preventDefault();
      target.click();
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeydown);
  return () => {
    alive = false;
    observer.disconnect();
    for (const panel of new Set([...states.keys(), ...running.keys()])) dispose(panel);
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeydown);
  };
}

/** Add evidence inspection to the view's existing teardown. */
export function mountForensicVerify(view: HTMLElement, root: HTMLElement, host: HostV1, files: () => File[]): void {
  const el = view as HTMLElement & { _cleanup?: () => void };
  const previous = el._cleanup;
  const cleanup = wireForensicVerify(root, host, files);
  el._cleanup = () => { previous?.(); cleanup(); };
}
