// SPDX-License-Identifier: MPL-2.0
/**
 * Deep output in the export panel - the pro-format grouping
 * (plans/61-deeprichpixels.md section 10 item 3).
 *
 * `isProFormat` names the float interchange formats (OpenEXR, Radiance RGBE).
 * They are compositing/VFX containers, not peers of png/jpg, so the picker
 * puts them under their own <optgroup> - a native one, which costs no CSS and
 * no space and carries its own a11y semantics. The group is built only from
 * formats that SURVIVED the picker's support filter, so where they cannot be
 * produced there is no group and no option. Today that is everywhere on the
 * web: `proFormatSupport()` (bridge/format-support.ts) is false, because the
 * engine's EXR/Radiance writers are fed by a resvg float rasterisation that
 * only the Node shell has.
 */
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';

/** The float interchange formats. Mirrors DEEP_FORMATS in packages/node-shell/src/raster.ts. */
export const PRO_FORMATS: readonly string[] = ['exr', 'hdr'];

export const isProFormat = (f: string | undefined): boolean => !!f && PRO_FORMATS.includes(f);

/**
 * The <option> markup for the format picker, with the pro float formats collected
 * into their own native <optgroup>.
 *
 * `formats` is the list that already survived the picker's support filter, so a
 * format that cannot be produced here never reaches this function - and the group
 * is emitted only when it would hold something. Ordinary formats keep their exact
 * original order and markup; a tool with no pro format gets byte-identical output
 * to the flat list this replaced.
 */
export function formatOptionsHtml(
  formats: readonly string[],
  selected: string | undefined,
  label: (f: string) => string,
): string {
  const option = (f: string): string =>
    `<option value="${f}" ${f === selected ? 'selected' : ''}>${label(f)}</option>`;
  const pro = formats.filter(isProFormat);
  return formats.filter(f => !isProFormat(f)).map(option).join('')
    + (pro.length ? `<optgroup label="${escape(t('Pro'))}">${pro.map(option).join('')}</optgroup>` : '');
}
