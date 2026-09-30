// SPDX-License-Identifier: MPL-2.0
import { updateRouteParams } from '../lib/url-state.ts';
import type { LearningCtx } from './learning/context.ts';
import type { LearningBlock, LearningRelease, LearningTarget } from '@lolly-tools/core/learning-v1';
import type { PickerHost } from './picker.ts';
import { newLearningModule, parseLearningModule } from '../../../../engine/src/learning/module.ts';
import { createFolderStore } from '../folders.ts';
import { richTextOps } from './learning/rich-text.ts';
import { quizzesOps } from './learning/quizzes.ts';
import { mountLessonInteraction } from './learning/lessons.ts';
import { uiOps } from './learning/ui.ts';
import { editOps } from './learning/edit.ts';
import { sourcesOps } from './learning/sources.ts';
import { deliveryOps } from './learning/delivery.ts';
import { publishingOps } from './learning/publishing.ts';
import { persistenceOps, LEARNING_SLOT_PREFIX } from './learning/store.ts';
import './learning/styles.css';
import { mountLearningMenus } from './learning/menus.ts';
import { mountBlockInteraction } from './learning/blocks.ts';

export async function mountLearning(
  root: HTMLElement & { _cleanup?: () => void; _beforeLeave?: () => Promise<boolean> },
  host: PickerHost,
  params = ''
): Promise<void> {
  const query = new URLSearchParams(params);
  const requested = query.get('slot');
  if (requested && !requested.startsWith(LEARNING_SLOT_PREFIX))
    throw new Error('Invalid learning module address.');
  const slot = requested || LEARNING_SLOT_PREFIX + crypto.randomUUID();
  const data = requested ? await host.state.load(slot) : null;
  if (requested && !data?.__learningModule)
    throw new Error('This module is unavailable on this device.');
  const module = data
    ? parseLearningModule(data.__learningModule)
    : newLearningModule(slot.slice(LEARNING_SLOT_PREFIX.length));
  if (!data) module.projectId = query.get('from');
  const storedSettings =
    data?.__learningExportSettings && typeof data.__learningExportSettings === 'object'
      ? (data.__learningExportSettings as Record<string, unknown>)
      : {};
  const ctx = {
    root,
    host,
    slot,
    module,
    undo: [],
    lastEdit: structuredClone(module),
    releases: (Array.isArray(data?.__learningReleases)
      ? data.__learningReleases
      : []) as LearningRelease[],
    selected: module.lessons.find(lesson => lesson.id === query.get('_lesson'))?.id || module.lessons[0]?.id || '',
    selectedBlocks: new Set<string>((query.get('_blocks') ?? '').split(',').filter(Boolean).slice(0, 512)),
    flushTyping: async () => {},
    target: ['static', 'scorm12', 'scorm2004', 'tincan', 'cmi5'].includes(
      String(data?.__learningTarget)
    )
      ? data!.__learningTarget
      : 'scorm12',
    exportSettings: {
      destination: String(storedSettings.destination || '').slice(0, 200),
      maxMB: Math.max(0, Number(storedSettings.maxMB) || 0),
    },
    sourceChoices: {},
    sourceDisplay: {},
    checking: false,
    busy: false,
    disposed: false,
    dirty: false,
    pendingTyping: false,
    savedRevision: data ? module.revision : 0,
    saving: Promise.resolve(),
    previewUrls: [],
    preview: null,
  } as unknown as LearningCtx;
  ctx.richText = richTextOps(ctx);
  ctx.quizzes = quizzesOps(ctx);
  ctx.ui = uiOps(ctx);
  ctx.edit = editOps(ctx);
  ctx.sources = sourcesOps(ctx);
  ctx.publishing = publishingOps(ctx);
  ctx.persistence = persistenceOps(ctx);
  ctx.delivery = deliveryOps(ctx);
  await ctx.sources.inspect();
  ctx.ui.render();
  if (!data) {
    await ctx.persistence.save();
    if (module.projectId)
      await createFolderStore(host as unknown as Parameters<typeof createFolderStore>[0]).addItem(
        module.projectId,
        { type: 'session', ref: slot }
      );
    updateRouteParams({ slot });
  }
  const click = (event: Event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (target?.dataset.action === 'insert-content') return;
    if (target?.dataset.action?.startsWith('add-')) ctx.insertAfter = undefined;
    if (target)
      void ctx
        .flushTyping()
        .then(() => ctx.edit.action(target.dataset.action!, target.dataset.id))
        .catch((error) =>
          ctx.ui.status(error instanceof Error ? error.message : 'The operation failed.')
        );
  };
  const change = async (event: Event) => {
    if (ctx.busy) return;
    const el = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (ctx.quizzes.change(el)) return;
    const lesson = ctx.module.lessons.find((l) => l.id === ctx.selected);
    if (
      el.matches('[data-resource]') &&
      el instanceof HTMLInputElement &&
      el.files?.[0] &&
      lesson
    ) {
      const file = el.files[0],
        pdf = /\.pdf$/i.test(file.name);
      if (!/\.(pdf|txt)$/i.test(file.name) || file.size > 50 * 1024 * 1024)
        throw new Error('Choose a PDF or plain text resource smaller than 50 MB.');
      const id = `user/learning-resource/${crypto.randomUUID()}`,
        format = pdf ? 'pdf' : 'txt';
      await host.assets._uploadUserAsset({
        id,
        type: 'data',
        format,
        blob: new Blob([await file.arrayBuffer()], {
          type: pdf ? 'application/pdf' : 'text/plain',
        }),
        meta: { name: file.name },
      });
      ctx.edit.insert({
        id: crypto.randomUUID(),
        kind: 'resource',
        description: file.name,
        source: { kind: 'asset', asset: { source: 'user', id, type: 'data', format, url: '' } },
      });
      ctx.insertAfter = undefined;
    } else if (el.dataset.module) {
      const key = el.dataset.module;
      if (key === 'title' || key === 'description' || key === 'objectives' || key === 'language')
        ctx.module[key] = el.value;
    } else if (el.dataset.lesson && lesson) {
      if (el.dataset.lesson === 'required') lesson.required = (el as HTMLInputElement).checked;
      if (el.dataset.lesson === 'title') lesson.title = el.value;
      if (el.dataset.lesson === 'section') {
        const title = el.value.trim();
        let section = ctx.module.sections.find((s) => s.title === title);
        if (title && !section) {
          section = { id: crypto.randomUUID(), title };
          ctx.module.sections.push(section);
        }
        lesson.sectionId = section?.id;
        ctx.module.sections = ctx.module.sections.filter((s) =>
          ctx.module.lessons.some((l) => l.sectionId === s.id)
        );
      }
    } else if (el.dataset.blockField && lesson) {
      const block = lesson.blocks.find(
        (b) => b.id === el.closest<HTMLElement>('[data-block]')?.dataset.block
      );
      if (!block) return;
      const key = el.dataset.blockField;
      if (key === 'text' || key === 'description' || key === 'transcript' || key === 'captions')
        block[key] = el.value;
      if (key === 'decorative') block.decorative = (el as HTMLInputElement).checked;
      if (key === 'render') {
        if (!ctx.sourceChoices[block.source?.toolId || '']?.some((r) => r.kind === el.value))
          return;
        block.kind = el.value as LearningBlock['kind'];
        if (block.source) block.source.motion = block.kind === 'video';
      }
    } else if (el.matches('[data-target]')) {
      ctx.target = el.value as LearningTarget;
      return;
    } else return;
    ctx.edit.change();
    if (
      el.matches('[data-resource]') ||
      el.dataset.blockField === 'render' ||
      (el instanceof HTMLInputElement && el.type === 'checkbox')
    )
      ctx.ui.render();
    else {
      ctx.ui.checks();
    }
  };
  let inputTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingInput: Event | undefined;
  const committedValues = new WeakMap<EventTarget, string>();
  const commit = async (event: Event) => {
    if (pendingInput?.target === event.target) {
      clearTimeout(inputTimer);
      pendingInput = undefined;
      ctx.pendingTyping = false;
    }
    const el = event.target;
    const textField =
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && el.type !== 'checkbox' && el.type !== 'file');
    if (textField && committedValues.get(el) === el.value) {
      if (!ctx.dirty) ctx.ui.status('Saved on this device');
      return;
    }
    await change(event);
    if (textField) committedValues.set(el, el.value);
  };
  const onChange = (event: Event) => {
    void commit(event).catch((error) =>
      ctx.ui.status(error instanceof Error ? error.message : 'The content could not be added.')
    );
  };
  ctx.flushTyping = async () => {
    ctx.richText.flush();
    if (pendingInput) await commit(pendingInput);
  };
  // Save a pause in typing without replacing the focused field. Blur commits
  // immediately, and leaving the route flushes the same pending edit.
  const onInput = (event: Event) => {
    const el = event.target;
    if (
      ctx.busy ||
      !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ||
      el.type === 'checkbox' ||
      !el.matches(
        '[data-module], [data-lesson], [data-block-field], [data-quiz-field], [data-quiz-option-text]'
      )
    )
      return;
    clearTimeout(inputTimer);
    pendingInput = event;
    ctx.pendingTyping = true;
    ctx.ui.status('Saving changes...');
    inputTimer = setTimeout(() => onChange(event), 500);
  };
  const unload = (event: BeforeUnloadEvent) => {
    if (pendingInput || ctx.richText.pending() || ctx.dirty || ctx.busy) event.preventDefault();
  };
  root._beforeLeave = async () => {
    await ctx.flushTyping();
    if (!ctx.dirty && !ctx.busy) return true;
    if (!ctx.busy) {
      try {
        await ctx.persistence.save();
        return true;
      } catch {
        /* Keep recoverable edits visible. */
      }
    }
    updateRouteParams({ slot: ctx.slot });
    ctx.ui.status(
      ctx.busy
        ? 'Wait for the package operation to finish before leaving.'
        : 'Your changes could not be saved. Use Retry save before leaving.'
    );
    return false;
  };
  root.addEventListener('click', click);
  const cleanupLessons = mountLessonInteraction(ctx);
  const cleanupBlocks = mountBlockInteraction(ctx);
  const cleanupMenus = mountLearningMenus(ctx);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  window.addEventListener('beforeunload', unload);
  root._cleanup = () => {
    ctx.richText.destroy();
    ctx.disposed = true;
    cleanupLessons();
    clearTimeout(inputTimer);
    cleanupBlocks();
    cleanupMenus();
    ctx.publishing.closePreview();
    ctx.delivery.close();
    root.removeEventListener('click', click);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
    window.removeEventListener('beforeunload', unload);
  };
  if (query.get('export') === '1') ctx.delivery.open();
}
