// SPDX-License-Identifier: MPL-2.0
/** Read and resolve sound profiles without a renderer, storage or personal preferences. */
import Ajv from 'ajv';
import schema from '@lolly-tools/core/schema/sonic-profile-v1.schema.json' with { type: 'json' };
import type {
  SonicFindingV1,
  SonicProfileV1,
  SonicRecipeV1,
} from '@lolly-tools/core/sonic-profile-v1';
import { sha256Hex } from './bytes.ts';
import { TOKEN_EXT } from './token-ext.ts';

const valid = new Ajv({ allErrors: false }).compile<SonicProfileV1>(schema);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function readSonicProfile(value: unknown): SonicProfileV1 | null {
  if (!valid(value)) return null;
  if (
    new Set(value.contexts.map((c) => c.id)).size !== value.contexts.length ||
    !value.contexts.some((c) => c.id === value.defaultContext)
  )
    return null;
  if (
    value.contexts.some(
      (c) => new Set(c.requirements.map((r) => r.id)).size !== c.requirements.length
    )
  )
    return null;
  if (!value.label.trim() || value.contexts.some((c) => !c.label.trim())) return null;
  if (
    value.review.state === 'reviewed' &&
    (!value.review.reviewer.trim() ||
      !value.review.notes.trim() ||
      !Number.isFinite(Date.parse(value.review.at)))
  )
    return null;
  return structuredClone(value);
}

/** Absent and unsupported records stay distinct so an older editor never erases newer work. */
export function sonicProfileOf(doc: unknown): {
  state: 'absent' | 'unsupported' | 'readable';
  profile: SonicProfileV1 | null;
} {
  const ext = isRecord(doc) && isRecord(doc.$extensions) ? doc.$extensions[TOKEN_EXT] : undefined;
  if (!isRecord(ext) || !Object.hasOwn(ext, 'sonicProfile'))
    return { state: 'absent', profile: null };
  const profile = readSonicProfile(ext.sonicProfile);
  return { state: profile ? 'readable' : 'unsupported', profile };
}

/** Replace only the sound extension, retaining every unrelated token and vendor field. */
export function withSonicProfile(doc: unknown, profile: SonicProfileV1): Record<string, unknown> {
  if (!isRecord(doc)) throw new Error('Load a design system before saving its sound.');
  if (doc.$extensions !== undefined && !isRecord(doc.$extensions))
    throw new Error('The design system extensions need a compatible editor.');
  if (
    isRecord(doc.$extensions) &&
    doc.$extensions[TOKEN_EXT] !== undefined &&
    !isRecord(doc.$extensions[TOKEN_EXT])
  )
    throw new Error('The design system extensions need a compatible editor.');
  const checked = readSonicProfile(profile);
  if (!checked) throw new Error('The sound profile is invalid.');
  if (sonicProfileOf(doc).state === 'unsupported')
    throw new Error('This sound profile needs a newer or compatible editor.');
  const copy = structuredClone(doc);
  const extensions = isRecord(copy.$extensions) ? copy.$extensions : {};
  const vendor = isRecord(extensions[TOKEN_EXT]) ? extensions[TOKEN_EXT] : {};
  copy.$extensions = { ...extensions, [TOKEN_EXT]: { ...vendor, sonicProfile: checked } };
  return copy;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const sonicProfileDigest = (profile: SonicProfileV1): Promise<string> =>
  sha256Hex(new TextEncoder().encode(canonical(profile)));

export interface SonicMusicAdapter {
  id: string;
  version: string;
  /** Validate every authored setting before resolving a new seed. No permissive fallback. */
  resolve(parameters: string, seed: number): { parameters: string; findings: SonicFindingV1[] };
}

export async function resolveSonicRecipe(
  value: unknown,
  request: {
    documentContext?: string;
    campaignContext?: string;
    requiredContext?: string;
    seed: number;
  },
  adapter: SonicMusicAdapter
): Promise<{ recipe: SonicRecipeV1 | null; findings: SonicFindingV1[] }> {
  const findings: SonicFindingV1[] = [];
  const error = (code: string, message: string) =>
    findings.push({ code, message, severity: 'error' });
  const profile = readSonicProfile(value);
  if (!profile) {
    error('profile-invalid', 'The sound profile is invalid or uses an unsupported version.');
    return { recipe: null, findings };
  }
  if (!Number.isSafeInteger(request.seed) || request.seed < 0 || request.seed > 4294967295)
    error('seed-invalid', 'Choose an unsigned 32-bit seed.');
  const selection =
    request.documentContext !== undefined
      ? 'document'
      : request.campaignContext !== undefined
        ? 'campaign'
        : 'default';
  const contextId = request.documentContext ?? request.campaignContext ?? profile.defaultContext;
  const context = profile.contexts.find((c) => c.id === contextId);
  if (!context) error('context-missing', `The sound profile has no context named "${contextId}".`);
  if (request.requiredContext !== undefined && contextId !== request.requiredContext)
    error('context-conflict', 'The selected sound conflicts with the required context.');
  if (!context || findings.length) return { recipe: null, findings };
  if (context.music.adapter !== adapter.id)
    error('adapter-missing', `This sound needs the "${context.music.adapter}" music adapter.`);
  for (const requirement of context.requirements) {
    findings.push({
      code: 'requirement-unsupported',
      severity: requirement.requirement === 'required' ? 'error' : 'notice',
      message: `${requirement.label}: this music adapter does not check ${requirement.kind}.`,
    });
  }
  if (context.signature.resource)
    findings.push({
      code: 'signature-separate',
      severity: 'notice',
      message:
        'The signature is its own audio file. Place it in the sequence; the generated music does not include it.',
    });
  if (profile.review.state === 'draft')
    findings.push({
      code: 'listening-pending',
      severity: 'notice',
      message:
        'This sound is a draft. Nobody has recorded a listening review of it yet.',
    });
  if (findings.some((f) => f.severity === 'error')) return { recipe: null, findings };
  let resolved: ReturnType<SonicMusicAdapter['resolve']>;
  try {
    resolved = adapter.resolve(context.music.parameters, request.seed);
  } catch (cause) {
    error(
      'adapter-invalid',
      cause instanceof Error ? cause.message : 'The music settings could not be resolved.'
    );
    return { recipe: null, findings };
  }
  findings.push(...resolved.findings);
  if (findings.some((f) => f.severity === 'error')) return { recipe: null, findings };
  return {
    recipe: {
      schemaVersion: 1,
      profile,
      profileSha256: await sonicProfileDigest(profile),
      contextId,
      selection,
      seed: request.seed,
      music: { adapter: adapter.id, version: adapter.version, parameters: resolved.parameters },
      findings: structuredClone(findings),
    },
    findings,
  };
}

/** Check retained context and digest before using a file's claimed sound selection. */
export async function readSonicRecipe(
  value: unknown,
  adapter: SonicMusicAdapter
): Promise<SonicRecipeV1 | null> {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.music) ||
    typeof value.contextId !== 'string' ||
    typeof value.seed !== 'number' ||
    !['document', 'campaign', 'default'].includes(String(value.selection))
  )
    return null;
  const { recipe } = await resolveSonicRecipe(
    value.profile,
    { documentContext: value.contextId, seed: value.seed },
    adapter
  );
  if (
    !recipe ||
    recipe.profileSha256 !== value.profileSha256 ||
    recipe.music.parameters !== value.music.parameters ||
    value.music.adapter !== adapter.id ||
    typeof value.music.version !== 'string' ||
    !value.music.version.length
  )
    return null;
  return {
    ...recipe,
    selection: value.selection as SonicRecipeV1['selection'],
    music: { ...recipe.music, version: value.music.version },
  };
}
