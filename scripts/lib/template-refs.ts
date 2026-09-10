// SPDX-License-Identifier: MPL-2.0
/**
 * Template refs in brand data (plans/226 section 4.6).
 *
 * A TemplateRef is the string the profile stores for one template:
 * `"<toolId>:<tid>"` for a shipped starter, `"user:<id>"` for one the person
 * saved (`shells/web/src/lib/template-ref.ts` is the runtime parser). Brand
 * packs curate the shipped half through `defaultHiddenTemplates` in
 * `catalog/assets/index.json` - starters a fresh profile does not see until it
 * asks for them, exactly as `defaultHiddenTools` hides a whole tool.
 *
 * Nothing notices a typo at runtime: a ref that resolves to no template hides
 * nothing, and a ref that names a tool this profile does not mount hides
 * nothing here while hiding something in a brand that does. So the check has to
 * happen where both halves are on disk, which is this validator.
 *
 * Two rules live here rather than in the script so tests can drive them:
 *
 *   - every `defaultHiddenTemplates` entry parses as `<toolId>:<tid>` and names
 *     a template file that exists in THIS profile's view;
 *   - no tool may take the id `user`, because that word is the ref prefix. A
 *     `user/` tool would make `user:letter` mean both "the letter starter of the
 *     user tool" and "the saved template whose id is letter".
 *
 * Pure and side-effect-free: the caller supplies the two lookups and prefixes
 * each message with the file it came from.
 */

/** The ref prefix a saved template uses, and therefore a forbidden tool id. */
export const USER_TEMPLATE_REF_PREFIX = 'user';

/** How the checks describe the accepted ref shape, in one place. */
const REF_SHAPE = '"<toolId>:<templateId>"';

/** Lookups the ref check needs from the profile's view on disk. */
export interface TemplateRefLookups {
  /** Is `toolId` a tool this profile mounts? */
  hasTool(toolId: string): boolean;
  /** Does `tools/<toolId>/templates/<tid>.json` exist? */
  hasTemplateFile(toolId: string, tid: string): boolean;
}

/**
 * The reason tool id `id` may not be used, or null when it is fine.
 *
 * Only the ref-prefix collision is judged here; the reserved CLI verbs and the
 * app's own path words are separate lists the validator checks beside this one.
 */
export function reservedTemplateToolIdError(id: string): string | null {
  if (id !== USER_TEMPLATE_REF_PREFIX) return null;
  return (
    `tool id "${USER_TEMPLATE_REF_PREFIX}" is the prefix a saved template's ref uses ` +
    `("${USER_TEMPLATE_REF_PREFIX}:<id>"), so every ref into this tool would also read as ` +
    `one of the person's own templates. Rename the tool.`
  );
}

/**
 * Every problem with a `defaultHiddenTemplates` value, as messages.
 *
 * An empty array is valid and expected: both brand packs carry the key so a
 * curator can see it without reading the docs first. `undefined` is valid too -
 * a pack that hides nothing needs no key at all.
 */
export function defaultHiddenTemplateErrors(value: unknown, look: TemplateRefLookups): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    return [`"defaultHiddenTemplates" must be an array of template refs (${REF_SHAPE})`];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ref of value) {
    if (typeof ref !== 'string' || !ref) {
      out.push(`defaultHiddenTemplates entry ${JSON.stringify(ref)} must be a template ref (${REF_SHAPE})`);
      continue;
    }
    if (seen.has(ref)) {
      out.push(`defaultHiddenTemplates lists "${ref}" twice`);
      continue;
    }
    seen.add(ref);
    const colon = ref.indexOf(':');
    const toolId = colon < 0 ? '' : ref.slice(0, colon);
    const tid = colon < 0 ? '' : ref.slice(colon + 1);
    if (!toolId || !tid || tid.includes(':')) {
      out.push(`defaultHiddenTemplates entry "${ref}" must be ${REF_SHAPE}`);
      continue;
    }
    if (toolId === USER_TEMPLATE_REF_PREFIX) {
      out.push(
        `defaultHiddenTemplates entry "${ref}" names a template the person saved - ` +
        `a brand can only hide the starters it ships`,
      );
      continue;
    }
    if (!look.hasTool(toolId)) {
      out.push(`defaultHiddenTemplates entry "${ref}" names tool "${toolId}", which is not a tool in this profile`);
      continue;
    }
    if (!look.hasTemplateFile(toolId, tid)) {
      out.push(
        `defaultHiddenTemplates entry "${ref}" names no template: tools/${toolId}/templates/${tid}.json does not exist`,
      );
    }
  }
  return out;
}
