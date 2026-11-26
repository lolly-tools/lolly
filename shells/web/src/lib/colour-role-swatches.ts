// SPDX-License-Identifier: MPL-2.0
/**
 * What a colour field offers, from the colours a design system resolves to (plans/352).
 *
 * A system that declares colour roles leads with them, in its own order and its own
 * words. The rest of its colours follow, without the copies that would only repeat a
 * role: a colourway's own `color.colourway.*` values, the on-colours, and a slot a role
 * fills. On-colours stay one press away on the role they belong to.
 *
 * A system that declares none gets the list it has always had, in the same order and
 * with nothing left out, so its picker looks exactly as it did. That is why the check
 * comes first, and the role reader loads only once a role is found.
 */
import type { ColorSwatch, HostV1 } from '@lolly-tools/core/host-v1';
import type { ColourRolesReadingV1 } from '@lolly-tools/core/brand-system-v1';
import { swatchFace } from '../../../../engine/src/color-face.ts';
import { TOKEN_EXT } from '../../../../engine/src/token-ext.ts';
import { tRaw } from '../i18n.ts';
import type { ColorSwatchOption } from '../components/color-field.ts';

export interface SwatchOptionsConfig {
  /** Paint each swatch in its wide-gamut face where it has one, as the tool view does. */
  wide?: boolean;
  /** The list a system with no roles shows: the tool view keeps every colour, the Setup rooms leave the colourway copies out. */
  plain?: (list: readonly ColorSwatch[]) => readonly ColorSwatch[];
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Does this document declare a colour role? Cheap, and it decides nothing beyond whether to read further. */
export function declaresColourRoles(doc: unknown): boolean {
  const ext = record(doc) && record(doc.$extensions) && Object.hasOwn(doc.$extensions, TOKEN_EXT) ? doc.$extensions[TOKEN_EXT] : null;
  const system = record(ext) && Object.hasOwn(ext, 'brandSystem') ? ext.brandSystem : null;
  return record(system) && Array.isArray(system.roles) && system.roles.some(r => record(r) && r.group === 'colourway');
}

const face = (swatch: ColorSwatch, wide: boolean): Pick<ColorSwatchOption, 'wide'> => (wide ? { wide: swatchFace(swatch, 'display-p3') } : {});

/** One swatch, with the fields the picker has always read. */
function plainOption(swatch: ColorSwatch, wide: boolean): ColorSwatchOption {
  return { value: swatch.value, ...face(swatch, wide), label: swatch.name, group: swatch.group, ref: swatch.ref };
}

/**
 * The options for a system that declares roles: each declared role in brand order, then
 * every other colour except the copies. Pure, so a test can hold it to the reading. A
 * role with no colour in this look is left out, because a swatch needs a colour to paint.
 */
export function roleSwatchOptions(reading: ColourRolesReadingV1, swatches: readonly ColorSwatch[], wide = false): ColorSwatchOption[] {
  const declared = reading.roles.filter(role => role.declared);
  const byPath = new Map(swatches.map(s => [s.path, s]));
  const declaredIds = new Set(declared.map(role => role.id));
  const roles = declared.flatMap((role): ColorSwatchOption[] => {
    const own = byPath.get(role.path);
    if (!own) return [];
    const on = byPath.get(`color.semantic.on-${role.id}`) ?? (role.slots.includes('primary') ? byPath.get('color.semantic.on-primary') : undefined);
    return [{
      value: own.value, ...face(own, wide), label: role.label, group: null, ref: own.ref,
      role: {
        id: role.id,
        ...(role.description ? { description: role.description } : {}),
        fills: [...role.slots],
        ...(on ? { on: { value: on.value, ...face(on, wide), ref: on.ref, label: tRaw('On {role}', { role: role.label }) } } : {}),
      },
    }];
  });
  // A filled slot's own token is a second name for the role. A slot no role fills stays in the list.
  const repeats = new Set(declared.map(role => role.path));
  for (const slot of reading.slots) if (slot.roleId && slot.roleId !== slot.slot && declaredIds.has(slot.roleId)) repeats.add(`color.semantic.${slot.slot}`);
  const rest = swatches
    .filter(s => !repeats.has(s.path) && !/^color\.colourway\./.test(s.path) && !/^color\.semantic\.on-/.test(s.path))
    .map(s => plainOption(s, wide));
  return [...roles, ...rest];
}

/** The document these colours came from: the render document where the host has one, else its edit head. */
async function documentOf(host: Pick<HostV1, 'tokens'>): Promise<unknown> {
  const tokens = host.tokens as (HostV1['tokens'] & { raw?: () => Promise<unknown> }) | undefined;
  try {
    if (tokens?.snapshot) return (await tokens.snapshot()).document;
    if (tokens?.raw) return await tokens.raw();
  } catch { /* no document, no roles: the plain list stands */ }
  return null;
}

/**
 * The options a colour field offers under this host. Read the host's own colours first
 * and hand them in, so the list and the words describe one read.
 */
export async function colourFieldOptions(host: Pick<HostV1, 'tokens'>, swatches: readonly ColorSwatch[], config: SwatchOptionsConfig = {}): Promise<ColorSwatchOption[]> {
  const wide = config.wide === true;
  const doc = await documentOf(host);
  if (declaresColourRoles(doc)) {
    const { readColourRoles } = await import('../../../../engine/src/colour-roles.ts');
    const options = roleSwatchOptions(readColourRoles(doc), swatches, wide);
    if (options.some(option => option.role)) return options;
  }
  return (config.plain ? config.plain(swatches) : swatches).map(s => plainOption(s, wide));
}
