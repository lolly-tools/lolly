// SPDX-License-Identifier: MPL-2.0
/** One-slide recommendation orchestration, with optional on-device matching. */
import { LAYOUT_OPTIONS_VERSION, layoutOptionCatalog, layoutOptionQuery, type LayoutOptionsResult } from '../../../../../engine/src/rebrand-layout-options.ts';
import { aiAllowed } from '../ai-policy.ts';
import { createEmbedSession } from '../ask/embed-session.ts';
import { t } from '../../i18n.ts';
import { decodeBudgetFor } from './budget.ts';
import { runStage } from './stage-runner.ts';
import type { LayoutOptionsRequest } from './stage-layout-options.ts';

export interface LayoutOptionsRun {
  signal: AbortSignal;
  useModel: boolean;
  progress: (done: number, total: number) => void;
}

export async function suggestLayouts(input: LayoutOptionsRequest, opts: LayoutOptionsRun): Promise<LayoutOptionsResult> {
  opts.signal.throwIfAborted();
  let semantic: Record<string, number> | undefined;
  if (opts.useModel && aiAllowed('embedding')) {
    let session: ReturnType<typeof createEmbedSession> | undefined;
    try {
      session = createEmbedSession(opts.signal);
      const query = await session.embed(layoutOptionQuery(input.source, input.plan, input.intent));
      const scores: Record<string, number> = {};
      for (const item of layoutOptionCatalog(input.system.master, input.allowed)) {
        opts.signal.throwIfAborted();
        const vector = await session.embed(item.description);
        scores[item.id] = query.reduce((sum, n, i) => sum + n * vector[i]!, 0);
      }
      semantic = scores;
    } catch {
      opts.signal.throwIfAborted();
      // Compilation and structural matching still work if inference fails.
    } finally { session?.dispose(); }
  }
  opts.signal.throwIfAborted();
  if (!aiAllowed('embedding')) semantic = undefined;
  const run = async (scores?: Record<string, number>): Promise<LayoutOptionsResult> => {
    const reply = await runStage<LayoutOptionsRequest, LayoutOptionsResult>({
      projectId: input.source.source.instanceId, planRevision: input.plan.revision,
      stage: 'compile', name: 'rebrand.layout-options', algorithmVersion: LAYOUT_OPTIONS_VERSION,
      input: { ...input, semantic: scores }, budget: decodeBudgetFor('laptop'),
      signal: opts.signal, quiet: true, title: t('Checking slide layouts'),
      onProgress: p => opts.progress(p.done ?? 0, p.total ?? 0),
    });
    opts.signal.throwIfAborted();
    return reply.result;
  };
  const result = await run(semantic);
  return semantic && !aiAllowed('embedding') ? run() : result;
}
