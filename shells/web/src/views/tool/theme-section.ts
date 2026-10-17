// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's Design system section (plans/319 A4): when to show it, what
 * it opens with, and what a switch has to refresh beside the canvas.
 *
 * A separate module from stage-layout.ts for the reason emoji-section.ts gives:
 * the view's own modules cannot be loaded outside a bundler, and everything here
 * can, with a fake controller and a fake section.
 *
 * The section is chrome, not an input. It sits outside `#tool-inputs` (which
 * renderInputs rewrites on every model change) and it is offered by the design
 * system, not by the tool: every tool whose design system has a theme group with
 * more than one option shows it, minus the groups the tool's `tokenAxes` ignores.
 * The state is the view's one `DocumentThemeController`, so this section and the
 * Design inspector's Document section always show the same choice.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { ColorSwatchOption } from '../../components/color-field.ts';
import type { DocumentThemeController, DocumentThemeGroup } from '../../lib/document-theme.ts';
import type { ThemeChoices } from '../../components/theme-choices.ts';
import { swatchFace } from '../../../../../engine/src/color-face.ts';

export interface ThemeSectionOpts {
  /** The mounted view, holding `#theme-section` and `#theme-section-body`. */
  root: ParentNode;
  controller: DocumentThemeController;
  /** Loads the control. A test hands in the module it already imported. */
  load?: () => Promise<{ mountThemeChoices: typeof import('../../components/theme-choices.ts').mountThemeChoices }>;
}

export interface ThemeSection {
  destroy(): void;
}

/**
 * Open on first show when there is a colourway to pick: choosing the lead is the
 * reason the section exists. A design system that offers only light and dark
 * opens folded, so every tool's sidebar does not grow by a row nobody asked for.
 */
export function opensByDefault(groups: readonly DocumentThemeGroup[]): boolean {
  return groups.some((group) => group.kind === 'colourway');
}

export function mountThemeSection(opts: ThemeSectionOpts): ThemeSection {
  const { controller, root } = opts;
  const section = root.querySelector<HTMLDetailsElement>('#theme-section');
  const body = root.querySelector<HTMLElement>('#theme-section-body');
  let control: ThemeChoices | null = null;
  let loading: Promise<void> | null = null;
  let destroyed = false;
  let shownOnce = false;
  const load = opts.load ?? (() => import('../../components/theme-choices.ts'));

  const show = (visible: boolean): void => {
    if (!section) return;
    section.hidden = !visible;
    if (visible && !shownOnce) {
      shownOnce = true;
      if (opensByDefault(controller.groups())) section.open = true;
    }
  };

  // The control (and its stylesheet) loads the first time there is something to
  // show, so a tool whose design system offers no choice never pays for the chunk. The
  // controller is subscribed throughout, so a design-system switch that brings
  // choices in shows the section without a remount.
  const sync = (): void => {
    if (destroyed || !section || !body) return;
    const visible = controller.groups().length > 0;
    if (control || !visible) { if (!control) show(false); return; }
    if (loading) return;
    loading = load().then(({ mountThemeChoices }) => {
      if (destroyed) return;
      control = mountThemeChoices(body, controller, { onVisible: show });
    }).catch((error: unknown) => {
      console.warn('[theme] the Design system section could not load:', error);
      loading = null;
    });
  };
  const off = controller.subscribe(sync);
  void controller.ready.then(sync);

  return {
    destroy() {
      destroyed = true;
      off();
      control?.destroy();
      control = null;
    },
  };
}

/**
 * Re-seed the colour field's swatches from a host scoped to the document's choice,
 * and redraw any swatch grid already open under `scope`. The swatches were read when
 * the tool mounted; without this, a colourway switch left the picker offering the
 * previous lead as "Primary".
 */
export async function refreshThemeSwatches(host: HostV1, scope: HTMLElement | null, colorField: {
  setSwatches(list: ColorSwatchOption[]): void;
  refreshSwatches(scope: HTMLElement): void;
}): Promise<void> {
  const swatches = await host.tokens?.colors?.();
  if (!swatches?.length) return;
  colorField.setSwatches(swatches.map((s) => ({ value: s.value, wide: swatchFace(s, 'display-p3'), label: s.name, group: s.group, ref: s.ref })));
  if (scope) colorField.refreshSwatches(scope);
}
