// SPDX-License-Identifier: MPL-2.0
import type { LearningCtx } from './context.ts';
import type {
  LearningModule,
  LearningRelease,
  LearningTarget,
} from '@lolly-tools/core/learning-v1';
import { learningSummary } from '../../../../../engine/src/learning/delivery.ts';
import { destinationTarget, exportMarkup, presetNotice } from './shared.ts';
import { courseFocus } from '../../lib/learning-ui.ts';
import {
  checkLearningExportSize,
  learningExportKey,
  learningHandoff,
} from '../../../../../engine/src/learning/preflight.ts';
import { checkLearningModule } from '../../../../../engine/src/learning/module.ts';
import {
  learningPresetByRef,
  learningPresetFor,
  learningPresetRef,
  learningPresetStatus,
} from '../../../../../engine/src/learning/presets.ts';
import {
  compileLearningModule,
  type CompiledLearning,
} from '../../../../../engine/src/learning/compile.ts';
import { buildLearningPackage } from '../../../../../packages/learning-player/src/package.ts';
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import { resolveLearningBlock } from '../../lib/learning-render.ts';
import {
  captureLearningPresentation,
  freezeLearningPresentation,
} from '../../lib/learning-presentation.ts';
import { startJob, cancelJob, type JobHandle } from '../../lib/jobs.ts';
import { deliverBatchFile } from '../../lib/background-delivery.ts';
import { releaseDeliveryFor } from '../../lib/download-recovery.ts';
import { getExportPolicy, exportAffordance } from '../../lib/export-policy.ts';
import { unzipSync } from 'fflate';
import '../../lib/learning-entry.css';

async function hash(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
interface Checked {
  key: string;
  snapshot: LearningModule;
  compiled: CompiledLearning;
  bytes: Uint8Array;
  hash: string;
  target: LearningTarget;
  settings: LearningCtx['exportSettings'];
}
/** Destination, preflight and delivery share one retained snapshot and exact ZIP. */
export function deliveryOps(ctx: LearningCtx): LearningCtx['delivery'] {
  let modal: ModalHandle<void> | undefined;
  let recovery: HTMLDetailsElement | undefined;
  let checked: Checked | undefined;
  let original: LearningRelease | undefined;
  let job: JobHandle | undefined;
  let controller: AbortController | undefined;
  let message = '';
  let note = '';
  let saved: LearningRelease | undefined;
  let saving = false;
  let step = 0;
  let tone = 'info';
  const snapshot = () => original?.snapshot || ctx.module;
  const key = () =>
    JSON.stringify([
      learningExportKey(snapshot(), ctx.target, ctx.exportSettings),
      original ? null : captureLearningPresentation(ctx.root),
    ]);
  const ready = () => !!checked && checked.key === key();
  const cancel = () => {
    if (job) cancelJob(job.id);
  };
  const invalidate = () => {
    if (original) return;
    const hadPreparedPackage = !!checked || !!saved || ctx.checking;
    checked = undefined;
    saved = undefined;
    cancel();
    message = hadPreparedPackage
      ? 'The course changed. Check the updated version before downloading.'
      : '';
    tone = 'info';
    step = Math.min(step, 1);
    paint();
  };
  const close = () => {
    modal?.close();
    modal = undefined;
    if (ctx.disposed) {
      cancel();
      checked = undefined;
    }
  };
  const paint = () => {
    if (!modal || ctx.disposed) return;
    const focused = courseFocus(modal.el, 'data-delivery-');
    const scroll = modal.el.querySelector('[data-delivery-body]')?.scrollTop || 0;
    const expanded = [...modal.el.querySelectorAll<HTMLDetailsElement>('details[open]')].map(
      (el) =>
        el.hasAttribute('data-delivery-reviews') ? 'data-delivery-reviews' : 'data-delivery-handoff'
    );
    modal.el.querySelector('[data-learning-panel]')!.innerHTML = exportMarkup({
      module: snapshot(),
      target: ctx.target,
      destination: ctx.exportSettings.destination,
      maxMB: ctx.exportSettings.maxMB,
      step,
      active: ctx.checking || saving,
      checking: ctx.checking,
      saving,
      saved: !!saved,
      original: !!original,
      ready: ready(),
      bytes: checked?.bytes.length || 0,
      note,
      message,
      tone,
    });
    for (const attr of expanded) {
      const details = modal.el.querySelector<HTMLDetailsElement>(`[${attr}]`);
      if (details) details.open = true;
    }
    if (recovery)
      recovery.hidden =
        !saved || !recovery.querySelector('[data-delivery-recovery]')?.childElementCount;
    for (const title of modal.el.querySelectorAll<HTMLElement>('.job-pill-title')) {
      const pill = title.closest<HTMLElement>('.job-pill');
      if (pill)
        pill.hidden =
          !!checked &&
          title.textContent === `Checking course: ${checked.snapshot.title}` &&
          !!pill.querySelector('.job-row-status--done');
    }
    const body = modal.el.querySelector('[data-delivery-body]');
    if (body) body.scrollTop = scroll;
    if (focused) modal.el.querySelector<HTMLElement>(focused)?.focus({ preventScroll: true });
  };
  const showStep = (next: number) => {
    if (ctx.checking || saving || (next === 2 && !ready())) return;
    step = next;
    paint();
    const body = modal?.el.querySelector<HTMLElement>('[data-delivery-body]');
    if (body) body.scrollTop = 0;
    modal?.el
      .querySelector<HTMLElement>(`[data-delivery-step="${next}"]`)
      ?.focus({ preventScroll: true });
  };
  const status = (text: string, kind = 'info') => {
    message = text;
    tone = kind;
    const el = modal?.el.querySelector<HTMLElement>('[data-delivery-status]');
    if (el) {
      el.textContent = text;
      el.hidden = !text;
      el.dataset.tone = kind;
    }
    ctx.ui.status(text);
  };
  const check = async () => {
    if (ctx.checking || saving) return;
    checked = undefined;
    saved = undefined;
    step = 1;
    message = 'Preparing course content...';
    tone = 'info';
    if (exportAffordance(getExportPolicy()) !== 'download')
      throw new Error('Course download is unavailable under the current export policy.');
    checkLearningExportSize(1, ctx.exportSettings.maxMB);
    const draft = structuredClone(snapshot()),
      target = ctx.target,
      settings = { ...ctx.exportSettings };
    const presentation = original ? null : captureLearningPresentation(ctx.root);
    const fingerprint = JSON.stringify([learningExportKey(draft, target, settings), presentation]);
    const releaseId = original?.id || crypto.randomUUID();
    const frozen = original;
    controller = new AbortController();
    const signal = controller.signal;
    ctx.checking = true;
    job = startJob({
      title: `Checking course: ${draft.title}`,
      cancel: () => controller?.abort(),
      heavy: true,
    });
    const currentJob = job;
    paint();
    ctx.ui.render();
    try {
      await currentJob.started;
      signal.throwIfAborted();
      await ctx.persistence.save();
      signal.throwIfAborted();
      let compiled: CompiledLearning;
      let retainedBytes: Uint8Array | undefined;
      if (frozen) {
        const artifact = frozen.artifacts.find((a) => a.target === target) || frozen.artifacts[0];
        if (!artifact) throw new Error('The saved version has no package.');
        const ref = await ctx.host.assets.get(artifact.asset.id, {
          format: 'zip',
          version: artifact.asset.version,
        });
        const response = await fetch(ref.url, { signal });
        if (!response.ok) throw new Error('The saved package is unavailable on this device.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if ((await hash(bytes)) !== artifact.hash)
          throw new Error('The saved package checksum has changed. Restore a backup.');
        if (artifact.target === target) retainedBytes = bytes;
        compiled = {
          content: structuredClone(frozen.content),
          files: Object.fromEntries(
            Object.entries(unzipSync(bytes)).filter(([path]) => path.startsWith('media/'))
          ),
        };
      } else {
        compiled = await compileLearningModule(
          draft,
          releaseId,
          (block) => resolveLearningBlock(ctx.host, block, signal),
          hash,
          (text) => {
            status(text);
            currentJob.progress(0, 0, text);
          },
          { throwIfCancelled: () => signal.throwIfAborted() }
        );
        await freezeLearningPresentation(ctx, compiled, presentation!, hash, signal);
      }
      signal.throwIfAborted();
      status('Checking package size and integrity...');
      // Yield before compression so Cancel can be handled after the final render.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      signal.throwIfAborted();
      const bytes = retainedBytes || buildLearningPackage(compiled, target);
      checkLearningExportSize(
        bytes.length,
        settings.maxMB || learningPresetFor(settings.destination, target).limits.packageMB || 0
      );
      const digest = await hash(bytes);
      signal.throwIfAborted();
      if (fingerprint !== key())
        throw new Error('The course or destination changed. Check again before downloading.');
      checked = {
        key: fingerprint,
        snapshot: draft,
        compiled,
        bytes,
        hash: digest,
        target,
        settings,
      };
      step = 2;
      status('', 'success');
      currentJob.finish();
    } catch (error) {
      status(
        signal.aborted
          ? 'Check cancelled. No package version was saved.'
          : error instanceof Error
            ? error.message
            : 'The package could not be prepared.',
        signal.aborted ? 'info' : 'error'
      );
      if (!signal.aborted) currentJob.fail(error);
    } finally {
      currentJob.settle();
      job = undefined;
      controller = undefined;
      ctx.checking = false;
      paint();
      if (step === 2) {
        const body = modal?.el.querySelector('[data-delivery-body]');
        if (body) body.scrollTop = 0;
        modal?.el
          .querySelector<HTMLElement>('[data-delivery-save], [data-delivery-download]')
          ?.focus({ preventScroll: true });
      }
      if (!ctx.disposed) ctx.ui.render();
    }
  };
  const save = async () => {
    if (!ready() || !checked || saving || saved) return;
    if (exportAffordance(getExportPolicy()) !== 'download')
      throw new Error('Course download is unavailable under the current export policy.');
    const prepared = checked;
    saving = true;
    ctx.busy = true;
    paint();
    ctx.ui.render();
    try {
      if (!ready()) throw new Error('The course changed. Check again.');
      const id = prepared.compiled.content.releaseId;
      const filename = `${prepared.snapshot.title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 70) || 'course'}-${id.slice(0, 8)}-${prepared.target}.zip`;
      const asset = {
        source: 'user' as const,
        id: `user/learning/${id}-${prepared.target}`,
        type: 'data' as const,
        format: 'zip',
        version: prepared.hash,
        url: '',
        meta: { name: filename },
      };
      const existing = original?.artifacts.find((a) => a.target === prepared.target);
      if (existing) {
        saved = original;
      } else {
        await ctx.host.assets._uploadUserAsset({
          ...asset,
          blob: new Blob([prepared.bytes.slice().buffer], { type: 'application/zip' }),
        });
        const artifact = {
          target: prepared.target,
          preset: learningPresetRef(
            learningPresetFor(prepared.settings.destination, prepared.target)
          ),
          filename,
          hash: prepared.hash,
          asset,
        };
        const release: LearningRelease = original || {
          id,
          createdAt: new Date().toISOString(),
          note,
          snapshot: prepared.snapshot,
          content: prepared.compiled.content,
          files: [],
          artifacts: [],
        };
        release.artifacts.push(artifact);
        if (!original) ctx.releases.push(release);
        try {
          await ctx.persistence.save();
        } catch (error) {
          release.artifacts.pop();
          if (!original) ctx.releases.pop();
          throw error;
        }
        saved = release;
      }
      status('');
      paint();
      await download();
    } finally {
      saving = false;
      ctx.busy = false;
      paint();
      if (step === 2) {
        const body = modal?.el.querySelector('[data-delivery-body]');
        if (body) body.scrollTop = 0;
        modal?.el
          .querySelector<HTMLElement>('[data-delivery-save], [data-delivery-download]')
          ?.focus({ preventScroll: true });
      }
      if (!ctx.disposed) ctx.ui.render();
    }
  };
  const download = async () => {
    if (!saved) return;
    await ctx.publishing.download(
      `${saved.id}/${ctx.target}`,
      modal?.el,
      recovery?.querySelector<HTMLElement>('[data-delivery-recovery]') || undefined
    );
    if (recovery) recovery.hidden = false;
  };
  const report = async () => {
    const artifact = saved?.artifacts.find((a) => a.target === ctx.target);
    if (!artifact || !saved) return;
    // Versions saved before the registry record a plain label that no preset matches.
    const preset = learningPresetByRef(artifact.preset);
    const status = preset && learningPresetStatus(preset);
    const text = JSON.stringify(
      {
        schemaVersion: 1,
        title: saved.snapshot.title,
        moduleId: saved.snapshot.id,
        releaseId: saved.id,
        createdAt: saved.createdAt,
        destination: ctx.exportSettings.destination,
        target: artifact.target,
        filename: artifact.filename,
        sha256: artifact.hash,
        packageBytes: checked?.bytes.length,
        summary: learningSummary(saved.snapshot),
        checks: checkLearningModule(saved.snapshot),
        handoff: learningHandoff(artifact.target),
        preset: preset
          ? {
              ref: artifact.preset,
              name: preset.name,
              target: preset.target,
              status: status!.label,
              launch: preset.launch,
              limits: preset.limits,
              media: preset.media,
              instructions: preset.instructions,
              documentation: preset.documentation,
              evidence: preset.evidence,
            }
          : { ref: artifact.preset },
        compatibility: status?.tested
          ? `${status.detail} Test this tenant's settings before assigning learners.`
          : `${status ? `${status.label}. ${status.detail} ` : ''}Receiving website or LMS acceptance testing is required.`,
      },
      null,
      2
    );
    await deliverBatchFile(
      modal?.el,
      recovery?.querySelector<HTMLElement>('[data-delivery-recovery]') || undefined,
      {
        blob: new Blob([text], { type: 'application/json' }),
        filename: artifact.filename.replace(/\.zip$/, '-handoff.json'),
        label: 'Course handoff report',
      },
      ctx.host
    );
  };
  const open = (releaseId?: string) => {
    if (ctx.disposed || saving) return;
    if (modal) return;
    const next = releaseId ? ctx.releases.find((r) => r.id === releaseId) : undefined;
    if (next?.id !== original?.id) {
      cancel();
      checked = undefined;
      saved = undefined;
      step = 0;
    }
    if (next?.id !== original?.id) note = next?.note || '';
    original = next;
    step = ready() ? 2 : Math.min(step, 1);
    modal = mountModal<void>('<div class="learning-dialog-content" data-learning-panel></div>', {
      className: 'learning-ui learning-export',
      ariaLabel: 'Export course',
      onClose: () => {
        if (modal) releaseDeliveryFor(modal.el);
        recovery = undefined;
        modal = undefined;
        if (!ctx.disposed)
          ctx.root
            .querySelector<HTMLElement>('[data-action=build]')
            ?.focus({ preventScroll: true });
      },
    });
    recovery = document.createElement('details');
    recovery.className = 'learning-download-help';
    const recoveryTitle = document.createElement('summary');
    recoveryTitle.textContent = 'Download help';
    const recoveryStatus = document.createElement('div');
    recoveryStatus.dataset.deliveryRecovery = '';
    recovery.append(recoveryTitle, recoveryStatus);
    modal.el.querySelector('[data-learning-panel]')!.after(recovery);
    paint();
    // The current step, not the LMS field, takes focus so a phone keyboard stays closed.
    modal.el.querySelector<HTMLElement>(`[data-delivery-step="${step}"]`)?.focus();
    const settingsChanged = () => {
      checked = undefined;
      saved = undefined;
      message = '';
      tone = 'info';
      void ctx.persistence
        .save()
        .catch((error) =>
          status(error instanceof Error ? error.message : 'Settings could not be saved.')
        );
    };
    // A listed LMS name selects its preset's format at once. The status changes in
    // place rather than by repainting, so typing keeps the caret and a pending click.
    const nameTarget = destinationTarget(modal.el, () => ctx.target);
    const chooseDestination = (value: string): boolean => {
      const before = ctx.target;
      ctx.exportSettings.destination = value;
      ctx.target = nameTarget(value);
      const root = modal?.el;
      if (root) {
        const notice = presetNotice(value, ctx.target);
        const select = root.querySelector<HTMLSelectElement>('[data-delivery-target]');
        if (select) select.value = ctx.target;
        const box = root.querySelector<HTMLElement>('[data-delivery-preset]');
        if (box) box.dataset.tone = notice.tone;
        for (const [attr, text] of [
          ['data-delivery-preset-label', notice.label],
          ['data-delivery-preset-detail', notice.detail],
          ['data-delivery-format', notice.format],
        ] as const) {
          const node = root.querySelector(`[${attr}]`);
          if (node) node.textContent = text;
        }
        const limit = root.querySelector<HTMLInputElement>('[data-delivery-limit]');
        if (limit) limit.placeholder = notice.limit;
      }
      return ctx.target !== before;
    };
    modal.el.addEventListener('change', (event) => {
      const el = event.target as HTMLInputElement;
      if (ctx.checking || saving) return;
      if (el.matches('[data-delivery-target]')) ctx.target = el.value as LearningTarget;
      else if (el.matches('[data-delivery-name]')) chooseDestination(el.value);
      else if (el.matches('[data-delivery-limit]')) ctx.exportSettings.maxMB = Number(el.value);
      else return;
      settingsChanged();
      if (el.matches('[data-delivery-target]')) paint();
    });
    modal.el.addEventListener('input', (event) => {
      const el = event.target as HTMLInputElement | HTMLTextAreaElement;
      if (el.matches('[data-delivery-note]')) note = el.value;
      else if (el.matches('[data-delivery-name]') && !ctx.checking && !saving) {
        if (chooseDestination(el.value)) settingsChanged();
      }
    });
    modal.el.addEventListener('click', (event) => {
      const el = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!el) return;
      if (el.hasAttribute('data-delivery-next') || el.hasAttribute('data-delivery-step')) {
        if (
          !modal?.el.querySelector<HTMLInputElement>('[data-delivery-limit]')?.reportValidity() &&
          step === 0
        )
          return;
        showStep(el.hasAttribute('data-delivery-next') ? 1 : Number(el.dataset.deliveryStep));
        return;
      }
      if (el.hasAttribute('data-delivery-back')) {
        showStep(step - 1);
        return;
      }
      if (el.hasAttribute('data-delivery-close')) {
        close();
        return;
      }
      if (el.hasAttribute('data-delivery-cancel')) {
        cancel();
        return;
      }
      if (el.dataset.deliveryLesson) {
        const id = el.dataset.deliveryLesson;
        close();
        const blockId = el.dataset.deliveryBlock;
        void ctx.edit.action('lesson', id).then(() => {
          if (blockId && !ctx.disposed)
            ctx.ui.render(
              `[data-block="${CSS.escape(blockId)}"] :is([data-block-field], [data-quiz-field=prompt])`
            );
        });
        return;
      }
      const action = el.hasAttribute('data-delivery-check')
        ? check
        : el.hasAttribute('data-delivery-save')
          ? save
          : el.hasAttribute('data-delivery-report')
            ? report
            : el.hasAttribute('data-delivery-download')
              ? download
              : undefined;
      if (action)
        void action().catch((error) => {
          if (recovery) recovery.open = true;
          status(error instanceof Error ? error.message : 'The export failed.', 'error');
          paint();
        });
    });
  };
  return { open, close, invalidate };
}
