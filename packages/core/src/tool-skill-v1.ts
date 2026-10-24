// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from './manifest.ts';
import { isAgentSkillName, parseSkillFrontmatter } from './skill-frontmatter-v1.ts';

export const TOOL_SKILL_MAX_BYTES = 65536;
export const TOOL_SKILL_FILES_MAX_BYTES = 524288;
export type ToolSkillManifest = Pick<ToolManifest, 'id' | 'name' | 'version' | 'engineVersion' | 'render' | 'description' | 'requires' | 'capabilities' | 'privacy' | 'examples'> & {
  inputs: Array<{ id: string; type: string; urlKey?: string }>;
};
export interface ToolSkillV1 {
  toolId: string;
  toolVersion: string;
  toolVersionRange: string;
  skillRevision: string;
  origin: 'generated' | 'authored';
  markdown: string;
  references: string[];
  files: Record<string, string>;
  warning?: string;
}
export interface ToolSkillSourceV1 {
  version: 1;
  toolId: string;
  toolVersionRange: string;
  skillRevision: string;
  references?: string[];
}

/** References stay inside the tool's skill directory and remain portable. */
export function isToolSkillReference(path: string): boolean {
  return /^skill\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(md|json)$/.test(path);
}

function text(value: string): string { return value.replace(/[\r\n|`]/g, ' '); }
function bytes(value: string): number { return new TextEncoder().encode(value).length; }

/** A baseline from the actual loaded manifest, including private and installed tools. */
export function generateToolSkill(manifest: ToolSkillManifest): ToolSkillV1 {
  const references = ['reference/inputs.json'];
  const files: Record<string, string> = { 'reference/inputs.json': JSON.stringify(manifest.inputs, null, 2) + '\n' };
  if (manifest.examples?.length) {
    references.push('reference/examples.json');
    files['reference/examples.json'] = JSON.stringify(manifest.examples, null, 2) + '\n';
  }
  const rows = manifest.inputs.map(input => `| ${text(input.id)} | ${text(input.type)} | ${text(input.urlKey ?? '')} |`);
  const markdown = [
    '---', `name: lolly-${manifest.id.slice(0, 58)}`,
    `description: ${JSON.stringify(`Operate the Lolly ${manifest.name} tool (${manifest.id}) using its declared inputs and supported output formats.`)}`, '---', '',
    `# ${text(manifest.name)}`, '',
    `Tool ID: \`${manifest.id}\`. Tool version: \`${manifest.version}\`. Engine range: \`${manifest.engineVersion}\`.`, '',
    ...(manifest.description ? [text(manifest.description), ''] : []),
    'Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.', '',
    `Declared output formats: ${(manifest.render.formats ?? []).map(text).join(', ') || 'none'}. The connected surface may support a subset; check its capabilities.`, '',
    `Required host APIs: ${(manifest.requires ?? []).join(', ') || 'none'}. Device capabilities: ${(manifest.capabilities ?? []).join(', ') || 'none'}.`, '',
    ...(manifest.privacy === 'on-device' ? ['This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.', ''] : []),
    '## Inputs', '', '| ID | Type | URL alias |', '| --- | --- | --- |', ...rows, '',
    'Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.', '',
    ...(manifest.examples?.length ? ['Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.', ''] : []),
    '## Review', '',
    'Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.', '',
    'A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document\'s effective design system. Never infer live layer editing from this manifest.', '',
  ].join('\n');
  if (bytes(markdown) > TOOL_SKILL_MAX_BYTES) throw new Error('Generated tool skill exceeds its size limit.');
  return {
    toolId: manifest.id, toolVersion: manifest.version, toolVersionRange: manifest.version,
    skillRevision: '1', origin: 'generated', markdown, references,
    files,
  };
}

/** Authored guidance is optional; invalid or incompatible guidance falls back visibly. */
export async function readToolSkill(
  manifest: ToolSkillManifest,
  read: (path: string) => Promise<string | null>,
  compatible: (version: string, range: string) => boolean,
): Promise<ToolSkillV1> {
  const fallback = generateToolSkill(manifest);
  const sourceText = await read('skill.json');
  if (sourceText === null) return fallback;
  try {
    if (bytes(sourceText) > 4096) throw new Error('Skill metadata exceeds its size limit.');
    const source = JSON.parse(sourceText) as ToolSkillSourceV1;
    if (source.version !== 1 || source.toolId !== manifest.id || typeof source.toolVersionRange !== 'string'
      || typeof source.skillRevision !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(source.skillRevision)) throw new Error('Invalid tool skill metadata.');
    if (!compatible(manifest.version, source.toolVersionRange)) throw new Error(`Authored skill does not support tool version ${manifest.version}.`);
    const references = source.references ?? [];
    if (!Array.isArray(references) || references.length > 16 || new Set(references).size !== references.length
      || references.some(path => typeof path !== 'string' || !isToolSkillReference(path))) throw new Error('Invalid tool skill reference.');
    const markdown = await read('SKILL.md');
    const frontmatter = markdown === null ? null : parseSkillFrontmatter(markdown);
    if (markdown === null || bytes(markdown) > TOOL_SKILL_MAX_BYTES || !markdown.startsWith('---\n') || !frontmatter || frontmatter.errors.length
      || !isAgentSkillName(frontmatter.fields.name, 'lolly-') || !frontmatter.fields.description?.trim()) throw new Error('Invalid or missing authored SKILL.md.');
    const files = { ...fallback.files };
    let total = bytes(markdown);
    for (const path of references) {
      const contents = await read(path);
      if (contents === null) throw new Error(`Missing skill reference: ${path}`);
      total += bytes(contents);
      if (total > TOOL_SKILL_FILES_MAX_BYTES) throw new Error('Skill references exceed their size limit.');
      files[path] = contents;
    }
    return { ...fallback, origin: 'authored', toolVersionRange: source.toolVersionRange,
      skillRevision: source.skillRevision, markdown, references: [...fallback.references, ...references], files };
  } catch (error) {
    return { ...fallback, warning: error instanceof Error ? error.message : 'Authored skill unavailable.' };
  }
}
