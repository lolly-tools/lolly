// SPDX-License-Identifier: MPL-2.0
/**
 * switch.ts - the one place a design-system switch happens (plans/186 section 3.4).
 *
 * A switch is a write to one key followed by the repaint the shell already
 * performs at boot, in an order that matters. It used to be done by hand in two
 * places (the profile view's backup import, the drop route's pack import), each
 * with a slightly different list; both now call this. The steps:
 *
 *   1. the pointer (registry.setActive) and the tokens bridge's caches, INCLUDING
 *      the build-lock verdict that a plain bust keeps on purpose;
 *   2. fonts: the outgoing system's faces leave document.fonts, the incoming
 *      system's are registered, and the vector-export registry is dropped;
 *   3. the instance base follows a HOSTED record (its instance becomes the base,
 *      and leaving a hosted record for one that is not clears it), with the
 *      catalog resync and the installed-tools merge that a base change needs;
 *   4. the chrome paint under its generation token, then the theme so the PWA
 *      colour follows the new background - and the record's own theme when it
 *      declares one;
 *   5. the four caches that had no buster before this plan;
 *   6. the `lolly:design-system-changed` event, then a remount for the
 *      stateless views only. A mounted tool is never torn down under someone's
 *      work: the caller is told it needs a reload and shows the banner.
 *
 * Every step is best-effort after the first: a failed repaint must not leave
 * the pointer half-moved, so the pointer goes first and the rest is `catch`ed.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { DesignSystemRecord, DesignSystemRegistry } from './registry.ts';
import type { WebTokensAPI } from '../../bridge/tokens.ts';
import { registerUserFonts } from '../register-user-fonts.ts';
import { getInstanceBase, setInstanceBase } from '../instance.ts';
import { applyChromeBrandVars } from '../../brand-vars.ts';
import { applyTheme, currentTheme } from '../../theme.ts';
import { bustLivePalette } from '../live-palette.ts';
import { invalidateVizPalette } from '../viz-palette.ts';
import { bustChipPairs } from '../particles.ts';
import { setSwatches } from '../../components/color-field.ts';

/** Fired on `window` after a switch, before any remount. `detail` is the new record. */
export const DESIGN_SYSTEM_CHANGED_EVENT = 'lolly:design-system-changed';

/** The routes a switch may remount in place: they hold no work of the person's.
 *  Everything else (a tool, batch, projects) is left standing and told. */
export const REMOUNTABLE_ROUTES = new Set(['gallery', 'utilities', 'dashboard', 'profile', 'start', 'catalog']);

export interface SwitchHost extends HostV1 {
  designSystems: DesignSystemRegistry;
  tokens?: WebTokensAPI;
}

export interface SwitchResult {
  record: DesignSystemRecord;
  /** The instance base changed (a hosted record was entered or left). */
  baseChanged: boolean;
  /** The current view holds work and was not remounted; show the reload banner. */
  needsReload: boolean;
}

export interface SwitchOptions {
  /** The current route name (parseRoute().name) - decides remount vs banner. */
  route?: string;
  /** Skip the remount entirely (a caller that will navigate itself). */
  noRemount?: boolean;
  /** Injected for tests: the catalog resync and the installed-tools merge. */
  resync?: (host: SwitchHost) => Promise<void>;
  /** Injected for tests: the base write (IndexedDB-backed in the shell). */
  setBase?: (url: string | null) => Promise<void>;
}

/** The instance a record wants as the base: hosted, or carried by an instance
 *  pack loaded from a file. Ordinary local/file systems want none. */
export function instanceOf(record: DesignSystemRecord): string {
  return record.source.kind === 'hosted' ? record.source.instance
    : record.source.kind === 'file' ? record.source.instance ?? '' : '';
}

export async function switchDesignSystem(host: SwitchHost, id: string, opts: SwitchOptions = {}): Promise<SwitchResult> {
  const registry = host.designSystems;
  const previous = await registry.active();
  await registry.setActive(id);
  const record = await registry.active();

  // 1. Caches, lock included: whether the ACTIVE material is read-only is a
  //    record fact now, but the build lock memo also has to be re-read because a
  //    pack import may have changed the shipped catalog's flag underneath it.
  host.tokens?.bust({ lock: true });

  // 2. Fonts.
  await registerUserFonts(host as unknown as Parameters<typeof registerUserFonts>[0]).catch(() => { /* faces are cosmetic to a switch */ });

  // 3. The base follows hosted records, and only them: a base a person set by
  //    hand (the desktop instance sheet) is not this module's to clear.
  const from = instanceOf(previous);
  const to = instanceOf(record);
  let baseChanged = false;
  if (to !== from && (to || from === getInstanceBase())) {
    try {
      await (opts.setBase ?? setInstanceBase)(to || null);
      baseChanged = true;
      await (opts.resync ?? defaultResync)(host);
    } catch { /* offline or a refused base - the material on the device still renders */ }
  }

  // 4. Chrome, then theme.
  await applyChromeBrandVars(host as unknown as Parameters<typeof applyChromeBrandVars>[0]).catch(() => { /* cosmetic */ });
  try {
    const theme = record.appearance?.theme;
    if (typeof document !== 'undefined') applyTheme(theme ?? currentTheme(), false);
  } catch { /* no document */ }

  // 5. The session caches nothing else busts.
  bustLivePalette(host);
  invalidateVizPalette();
  bustChipPairs();
  try {
    const swatches = await host.tokens?.colors?.();
    if (swatches?.length) setSwatches(swatches.map(s => ({ value: s.value, label: s.name, group: s.group, ref: s.ref })));
  } catch { /* the built-in palette stands */ }

  // 6. Tell the page, then remount what may be remounted.
  let needsReload = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DESIGN_SYSTEM_CHANGED_EVENT, { detail: record }));
    if (!opts.noRemount) {
      if (opts.route && REMOUNTABLE_ROUTES.has(opts.route)) window.dispatchEvent(new Event('lolly:remount'));
      else if (opts.route) needsReload = true;
    }
  }
  return { record, baseChanged, needsReload };
}

/** The catalog resync a base change needs: the same pair the instance sheet and
 *  the profile's Leave button run. Dynamic imports keep this module off any
 *  boot path that only wants the event name. */
async function defaultResync(host: SwitchHost): Promise<void> {
  const { syncCatalog } = await import('../../catalog/sync.ts');
  await syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]).catch(() => { /* offline - the cache stands */ });
  const { mergeInstalledToolsIntoIndex } = await import('../installed-tools.ts');
  await mergeInstalledToolsIntoIndex().catch(() => { /* no sideloads */ });
}
