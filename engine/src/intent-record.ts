// SPDX-License-Identifier: MPL-2.0
/**
 * From a resolved intent to the record a file carries (plan 350 W4b). `lolly intent --render`
 * and `lolly_render` both come through here, so a person and an agent get the same record,
 * the same refusals and the same words for what happened.
 *
 * Pure: no DOM, clock, network or randomness, so the same intent gives the same record. The
 * caller's digest is never read: every field comes from a resolution the caller's own server
 * worked out. Free text is fingerprinted the way typed inputs are, so the words stay out of
 * the file, and the prompt is a fingerprint unless that run asked for the words.
 *
 * Only the file can say what was recorded. `confirmIntentRecord` reads it back, and a
 * surface reports "recorded" only from that reading.
 */
import type { IntentResolutionV1 } from '@lolly-tools/core/intent-v1';
import { sha256Hex } from './bytes.ts';
import { canonicalJson } from './canonical-json.ts';
import type { C2paIntentRecord } from './c2pa.ts';
import type { C2paReport } from './c2pa-verify.ts';

/** Every refusal `intentRecordFor` gives, for a caller to branch on. */
export const INTENT_RECORD_CODES = ['intent.purpose-needed', 'intent.surface-needed', 'intent.surface-unknown', 'intent.tool-not-candidate'] as const;
export type IntentRecordCode = (typeof INTENT_RECORD_CODES)[number];

export type IntentRecordChoice =
  | { ok: true; record: C2paIntentRecord }
  | { ok: false; code: IntentRecordCode; message: string };

/** A `sha256:` fingerprint in the form typed inputs take in `tools.lolly.export`. */
const fingerprint = async (type: string, value: string): Promise<string> =>
  `sha256:${await sha256Hex(new TextEncoder().encode(JSON.stringify([type, value, ''])))}`;

/**
 * The record for one file, or why this tool and surface do not belong to this intent. With
 * `surface` left out, an intent with one surface means that one. `toolId` left out means the
 * tool the resolver chose. `recordPrompt` is this run's answer, and the request's own flag
 * stands when the run says nothing.
 */
export async function intentRecordFor(
  resolution: IntentResolutionV1,
  request: { surface?: string; toolId?: string; recordPrompt?: boolean } = {},
): Promise<IntentRecordChoice> {
  const purpose = resolution.closed.purpose;
  if (!purpose) return { ok: false, code: 'intent.purpose-needed', message: 'This intent has a prompt and no purpose. Read the prompt, choose a purpose and call again.' };
  const surfaces = resolution.surfaces;
  if (request.surface === undefined && surfaces.length !== 1) {
    return { ok: false, code: 'intent.surface-needed', message: `This intent has ${surfaces.length} surfaces. Name one: ${surfaces.map((s) => s.surface.id).join(', ')}.` };
  }
  const result = request.surface === undefined ? surfaces[0] : surfaces.find((s) => s.surface.id === request.surface);
  if (!result) {
    return { ok: false, code: 'intent.surface-unknown', message: `This intent has no surface named ${request.surface}. It has: ${surfaces.map((s) => s.surface.id).join(', ')}.` };
  }
  const toolId = request.toolId ?? result.chosen?.toolId;
  if (!toolId || !result.candidates.some((c) => c.toolId === toolId)) {
    const fits = result.candidates.map((c) => c.toolId).join(', ');
    return { ok: false, code: 'intent.tool-not-candidate', message: `${toolId ?? 'No tool'} does not answer this intent on ${result.surface.id}. ${fits ? `These do: ${fits}.` : 'No tool does.'}` };
  }
  const { occasion, audience, region } = resolution.freeText;
  const wantsWords = request.recordPrompt ?? resolution.recordPrompt;
  const prompt = resolution.prompt;
  return {
    ok: true,
    record: {
      purpose,
      surface: result.surface.id,
      tool: toolId,
      ...(resolution.closed.language ? { language: resolution.closed.language } : {}),
      rulesVersion: resolution.closed.rulesVersion,
      vocabularyVersion: resolution.closed.vocabularyVersion,
      intentDigest: resolution.intentDigest,
      ...(occasion ? { occasion: await fingerprint('text', occasion) } : {}),
      ...(audience ? { audience: await fingerprint('text', audience) } : {}),
      ...(region ? { region: await fingerprint('text', region) } : {}),
      ...(prompt ? (wantsWords ? { prompt } : { promptFingerprint: await fingerprint('longtext', prompt) }) : {}),
    },
  };
}

/** Why a file holds no intent record. */
export type IntentNotRecordedReason = 'opted-out' | 'no-credential' | 'no-route' | 'not-confirmed';

/** What a finished file holds, for a run's result. `recorded` comes only from reading the file. */
export type IntentRecordOutcome =
  | { state: 'recorded'; record: C2paIntentRecord; promptInFile: boolean }
  | { state: 'not-recorded'; reason: IntentNotRecordedReason };

/** What the file reads back as, against what was meant to go in. */
export function confirmIntentRecord(report: Pick<C2paReport, 'state' | 'intent'>, expected: C2paIntentRecord): IntentRecordOutcome {
  if (!report.intent) return { state: 'not-recorded', reason: report.state === 'none' ? 'no-credential' : 'not-confirmed' };
  const { promptNote: _note, ...read } = report.intent;
  if (canonicalJson(read) !== canonicalJson(expected)) return { state: 'not-recorded', reason: 'not-confirmed' };
  return { state: 'recorded', record: read, promptInFile: read.prompt !== undefined };
}

const NOT_RECORDED: Record<IntentNotRecordedReason, string> = {
  'opted-out': 'The intent was not recorded, as asked.',
  'no-credential': 'The intent was not recorded: this render wrote no Content Credential.',
  'no-route': 'The intent was not recorded: this format cannot carry a Content Credential.',
  'not-confirmed': 'The intent was not recorded: reading the file back did not find the record.',
};

/**
 * The words a run shows at the moment it writes the file, one per line. A surface adds how
 * to opt out in its own terms. Lists what was fingerprinted without repeating the words.
 */
export function intentRecordWords(outcome: IntentRecordOutcome): string[] {
  if (outcome.state === 'not-recorded') return [NOT_RECORDED[outcome.reason]];
  const r = outcome.record;
  const lines = [
    `Recorded the intent in this file's Content Credentials: purpose ${r.purpose}, surface ${r.surface}, tool ${r.tool}${r.language ? `, language ${r.language}` : ''}.`,
  ];
  const hidden = [
    r.occasion && 'occasion', r.audience && 'audience', r.region && 'region', r.promptFingerprint && 'prompt',
  ].filter((name): name is string => !!name);
  if (hidden.length) lines.push(`Fingerprints only, so the words are not in the file: ${hidden.join(', ')}.`);
  if (outcome.promptInFile) lines.push('The prompt\'s own words are in this file, and files travel.');
  return lines;
}
