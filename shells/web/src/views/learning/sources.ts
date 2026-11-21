// SPDX-License-Identifier: MPL-2.0
import type { LearningCtx } from './context.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { svgDataUrl } from '../../lib/format.ts';
import { openPicker } from '../picker.ts';
import { armSessionReturn } from '../../lib/search/projects-source.ts';
import { learningRenditions } from '../../../../../engine/src/learning/delivery.ts';
import { learningReader } from '../../lib/learning-entry.ts';
import { learningAssetBlock, learningSessionCandidate, learningSourceValues } from '../../lib/learning-selection.ts';
import { isBatchSlot, isHiddenSlot } from '../../lib/batch-slots.ts';

export function sourcesOps(ctx: LearningCtx): LearningCtx['sources'] {
  return {
    inspect: () => inspect(ctx),
    pick: () => pick(ctx),
    refresh: (id) => refresh(ctx, id),
    edit: (id) => edit(ctx, id),
  };
}
export async function pick(ctx: LearningCtx): Promise<void> {
  const lesson = ctx.module.lessons.find((l) => l.id === ctx.selected);
  if (!lesson) {
    ctx.ui.status('Add or select a lesson first.');
    return;
  }
  const countBefore = lesson.blocks.length;
  const addAsset = async (asset: AssetRef): Promise<boolean> => {
    try {
      ctx.edit.insert(learningAssetBlock(asset));
    } catch (error) {
      pickerError(ctx, error instanceof Error ? error.message : 'This file is not supported.');
      return false;
    }
    await inspect(ctx);
    ctx.edit.change();
    ctx.ui.render();
    return true;
  };
  await openPicker(ctx.host, {
    title: `Add content to ${lesson.title || 'this lesson'}`,
    initialTab: ctx.module.projectId ? 'projects' : 'uploads',
    initialFolder: ctx.module.projectId || undefined,
    allowUpload: true,
    collect: {
      folderName: lesson.title,
      tools: [],
      guided: {
        hint: 'Add images, video, audio or saved tool sessions. Use Add resource in the lesson for PDF and text downloads.',
      },
      onAsset: addAsset,
      onSession: async (slot) => {
        if (slot.startsWith('__learning__:') || isBatchSlot(slot) || isHiddenSlot(slot))
          return false;
        const data = await ctx.host.state.load(slot);
        if (!data?.__toolId) return false;
        try {
          const candidate = await learningSessionCandidate(learningReader(ctx.host), slot, data);
          if (!candidate.block) return false;
          ctx.edit.insert(candidate.block);
          await inspect(ctx);
        } catch (error) {
          pickerError(ctx, error instanceof Error ? error.message : 'This source is unavailable.');
          return false;
        }
        ctx.edit.change();
        ctx.ui.render();
        return true;
      },
      onOpenTool: () => {
        ctx.ui.status('Save the creation in its tool, then add it from Projects.');
      },
      onQuickAddTool: async () => false,
    },
  });
  if (!ctx.disposed) {
    const added =
      lesson.blocks.length > countBefore
        ? lesson.blocks.find((b) => b.id === ctx.insertAfter) || lesson.blocks.at(-1)
        : undefined;
    ctx.insertAfter = undefined;
    ctx.ui.render(
      added
        ? `[data-block="${CSS.escape(added.id)}"] [data-block-field]`
        : '[data-action=add-source]'
    );
  }
}
export async function refresh(ctx: LearningCtx, blockId: string): Promise<void> {
  const block = ctx.module.lessons.flatMap((l) => l.blocks).find((b) => b.id === blockId);
  if (!block?.source?.slot) return;
  const data = await ctx.host.state.load(block.source.slot);
  if (!data?.__toolId) throw new Error('The source is unavailable. Replace it using Add content.');
  block.source.values = learningSourceValues(data);
  block.source.toolId = data.__toolId;
  block.source.toolVersion = data.__toolVersion;
  block.source.capturedAt = new Date().toISOString();
  await inspect(ctx);
  ctx.edit.change();
  ctx.ui.render();
}
export async function edit(ctx: LearningCtx, blockId: string): Promise<void> {
  const source = ctx.module.lessons.flatMap((l) => l.blocks).find((b) => b.id === blockId)?.source;
  if (!source?.slot || !source.toolId) return;
  await ctx.persistence.save();
  armSessionReturn(`/#/learning?slot=${encodeURIComponent(ctx.slot)}`);
  window.location.hash = `#/tool/${encodeURIComponent(source.toolId)}?slot=${encodeURIComponent(source.slot)}`;
}

export async function inspect(ctx: LearningCtx): Promise<void> {
  const sessions = await ctx.host.state.list();
  ctx.sourceDisplay = {};
  for (const block of ctx.module.lessons.flatMap((lesson) => lesson.blocks)) {
    const source = block.source;
    if (!source) continue;
    if (source.kind === 'session') {
      const entry = sessions.find((item) => item.slot === source.slot);
      const name =
        entry?.label ||
        String(source.values?.title || source.values?.name || `${source.toolId} creation`);
      const pages = Array.isArray(source.values?.slides) ? source.values.slides.length : undefined;
      const current = !!entry && !!source.capturedAt && entry.updatedAt <= source.capturedAt;
      // A stored picture is read here (this view shows it at once); a legacy row
      // still carries its data URL.
      const thumb = !current ? undefined
        : entry.preview ? (await (await import('../../components/preview-image.ts')).pictureSrcFor(entry.preview)) ?? undefined
          : entry.thumb ?? undefined;
      ctx.sourceDisplay[block.id] = {
        name,
        preview: thumb && /^\s*<(\?xml|svg)/i.test(thumb) ? svgDataUrl(thumb) : thumb,
        detail: pages ? `${pages} slides` : undefined,
      };
    } else if (source.asset) {
      try {
        const ref = await ctx.host.assets.get(source.asset.id, {
          format: source.asset.format,
          version: source.asset.version,
        });
        ctx.sourceDisplay[block.id] = {
          name: String(ref.meta?.name || source.asset.meta?.name || source.asset.id),
          preview:
            block.kind === 'image'
              ? ref.url
              : typeof ref.meta?.posterUrl === 'string'
                ? ref.meta.posterUrl
                : undefined,
          media: ['video', 'audio'].includes(block.kind) ? ref.url : undefined,
          detail: [
            source.asset.format?.toUpperCase(),
            typeof ref.meta?.durationMs === 'number' && ref.meta.durationMs > 0
              ? `${Math.ceil(ref.meta.durationMs / 1000)} seconds`
              : '',
          ]
            .filter(Boolean)
            .join(' / '),
        };
      } catch {
        ctx.sourceDisplay[block.id] = {
          name: String(source.asset.meta?.name || source.asset.id),
          unavailable: true,
        };
      }
    }
  }
  const ids = [
    ...new Set(
      ctx.module.lessons
        .flatMap((l) => l.blocks)
        .map((b) => b.source?.toolId)
        .filter((id): id is string => !!id)
    ),
  ];
  for (const id of ids) {
    try {
      ctx.sourceChoices[id] = learningRenditions(await learningReader(ctx.host).tool(id));
    } catch {
      ctx.sourceChoices[id] = [];
    }
  }
}

function pickerError(ctx: LearningCtx, message: string): void {
  ctx.ui.status(message);
  const dialog = document.querySelector('.asset-picker-dialog');
  if (!dialog) return;
  let error = dialog.querySelector<HTMLElement>('[data-learning-source-error]');
  if (!error) {
    error = document.createElement('p');
    error.dataset.learningSourceError = '';
    error.className = 'learning-picker-error';
    error.setAttribute('role', 'alert');
    dialog.prepend(error);
  }
  error.textContent = message;
}
