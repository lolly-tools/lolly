// SPDX-License-Identifier: MPL-2.0
/**
 * Creation feedback for in-browser agents: the report `lolly_check_document` returns,
 * and the compact delta `lolly_apply_document_changes` adds after each change. Both
 * come from the engine's `creationFeedback`, read off the mounted Design tool exactly
 * as the export panel's card reads it, so an agent and a person see the same findings.
 * The feedback informs; nothing here refuses an edit.
 */
import { creationFeedbackDelta, type CreationFeedbackReportV1 } from '@lolly/engine';
import { readCreationFeedback } from './creation-feedback.ts';
import { siteData } from './site-tools-data.ts';
import type { SiteToolSource } from './site-tools-context.ts';

/** The report for the mounted tool, or null when it is not a Design document. */
export async function siteCreationFeedback(tool: SiteToolSource | null): Promise<CreationFeedbackReportV1 | null> {
  if (tool?.tool.manifest.id !== 'design') return null;
  const { report } = await readCreationFeedback({ model: () => tool.model(), snapshot: () => tool.host.tokens?.snapshot?.() });
  return report;
}

/**
 * An apply result with `feedback` added: what changed on the layers it touched. A
 * replayed or empty apply, or a tool that is not Design, comes back unchanged.
 */
export function withApplyFeedback(result: unknown, before: CreationFeedbackReportV1 | null, after: CreationFeedbackReportV1 | null): unknown {
  if (!after || !result || typeof result !== 'object' || Array.isArray(result)) return result;
  const applied = result as { changed?: unknown; replayed?: unknown; changedIds?: unknown };
  if (applied.changed !== true || applied.replayed === true) return result;
  const touched = Array.isArray(applied.changedIds) ? applied.changedIds.filter((id): id is string => typeof id === 'string') : [];
  return { ...result, feedback: siteData(creationFeedbackDelta(before, after, touched), 12_000) };
}
