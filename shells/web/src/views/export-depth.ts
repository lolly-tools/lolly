// SPDX-License-Identifier: MPL-2.0
/**
 * Deep output in the export panel - the pro-format grouping and the depth fact
 * (plans/61-deeprichpixels.md section 10 item 3).
 *
 * Both halves obey the plan's governing rule, DEPTH FOLLOWS PROVENANCE.
 *
 * 1. `isProFormat` names the float interchange formats (OpenEXR, Radiance RGBE).
 *    They are compositing/VFX containers, not peers of png/jpg, so the picker
 *    puts them under their own <optgroup> - a native one, which costs no CSS and
 *    no space and carries its own a11y semantics. The group is built only from
 *    formats that SURVIVED the picker's support filter, so where they cannot be
 *    produced there is no group and no option. Today that is everywhere on the
 *    web: `proFormatSupport()` (bridge/format-support.ts) is false, because the
 *    engine's EXR/Radiance writers are fed by a resvg float rasterisation that
 *    only the Node shell has.
 *
 * 2. `depthFact` STATES what the pipeline will write; it is not a setting. When
 *    an HDR PNG is written at 16 bits the user has no decision to make, and a
 *    control would imply one that does not exist. The one honest control is the
 *    opposite direction (`?depth=8`, to keep a file small) and it already works
 *    through the URL with no UI.
 *
 * The fact is derived from the real export path, never from a list of formats
 * that "feel deep":
 *
 *   png  + hdr  → bridge/export-hdr-png.ts: a 16-bit IDAT written by the engine's
 *                 own PNG writer. `depth=8` is IGNORED there (8-bit PQ IS the
 *                 banding defect), so the fact holds whatever the link asked for.
 *   jpeg + hdr  → bridge/export-gainmap-jpeg.ts: an ordinary SDR JPEG with the HDR
 *                 rendition appended as an ISO 21496-1 gain map. Not deeper bytes,
 *                 so it is a different fact. `depth=8` DOES opt out here (back to
 *                 the legacy 8-bit PQ path), so the fact disappears with it.
 *
 * Everything else the web shell writes is 8 bits per channel - including HDR
 * AVIF and HDR TIFF, which still take the legacy 8-bit transform - and says
 * nothing at all. Absence is the information.
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

/** The `depth` URL param as parsed by the engine (absent ⇒ 'auto'). */
export type DepthSetting = 8 | 16 | 'float' | 'auto';

export interface DepthFact {
  /** Which pipeline produced it. Only 'deep' (more bits per channel) today; see depthFact. */
  kind: 'deep';
  /** Two words at most. The whole visible affordance. */
  label: string;
  /** One sentence, shown only in the tooltip layer. */
  why: string;
}

/**
 * What the export will actually carry beyond an ordinary 8-bit image, or null when
 * it carries nothing beyond one - which is the common case, and renders nothing.
 */
export function depthFact(
  fmt: string | undefined,
  opts: { hdr?: boolean; depth?: DepthSetting } = {},
): DepthFact | null {
  if (!fmt || !opts.hdr) return null;
  if (fmt === 'png') {
    return {
      kind: 'deep',
      label: t('16-bit'),
      why: t('An HDR PNG is written at 16 bits per channel, so the brightness curve stays smooth instead of banding in the shadows.'),
    };
  }
  // DELIBERATELY NO FACT FOR HDR JPEG, though it is the more impressive output.
  // A gain-map JPEG only gets its second rendition when the view transform finds
  // something to lift; a dark or unmatched design legitimately ships a plain SDR
  // JPEG instead (export-gainmap-jpeg.ts returns mapLength 0 and says so in the
  // log). That is a NORMAL outcome, not an error, and this panel cannot know
  // which way it will go without running the transform. A fact that is wrong in
  // an ordinary case is worse than no fact at all, so the JPEG says nothing.
  // If a cheap pre-flight headroom probe ever exists, this is where it goes.
  return null;
}

/**
 * Reflect `fact` into the panel: create the element when there is something true to
 * say, remove it when there is not. Nothing is reserved and nothing is left behind - 
 * in the common case the panel's markup does not contain the node at all.
 *
 * The fact is inserted AFTER `.filename-extension`, never inside it: that row is a
 * flex pair (filename grows, format select hugs) and a third child would resize both
 * every time HDR was toggled. As a following sibling in the panel's flex column it
 * cannot change that row's box.
 *
 * It is a `role="note"`, not a control: no tabindex, nothing to click, nothing to
 * change. The `why` rides the app's [data-tip] tooltip primitive (parts/tooltip.css)
 * and is mirrored into aria-label, because the bubble is a pseudo-element and is
 * never read out.
 */
export function applyDepthFact(panel: Element | null | undefined, fact: DepthFact | null): void {
  if (!panel) return;
  const existing = panel.querySelector<HTMLElement>('[data-depth-fact]');
  if (!fact) {
    existing?.remove();
    return;
  }
  const row = panel.querySelector('.filename-extension');
  if (!row) return;
  const node = existing ?? panel.ownerDocument.createElement('span');
  node.className = 'export-depth-fact';
  node.dataset.depthFact = fact.kind;
  node.setAttribute('role', 'note');
  node.setAttribute('data-tip', fact.why);
  // aria-label carries label + sentence because the [data-tip] bubble is a CSS
  // pseudo-element no AT can reach. The visible text is then aria-hidden so the
  // label is not announced twice (once as the name, once as the content) - the
  // aria-label already opens with it.
  node.setAttribute('aria-label', `${fact.label}. ${fact.why}`);
  node.textContent = '';
  const visible = panel.ownerDocument.createElement('span');
  visible.setAttribute('aria-hidden', 'true');
  visible.textContent = fact.label;
  node.append(visible);
  if (!existing) row.after(node);
}
