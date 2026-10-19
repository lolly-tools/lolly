// SPDX-License-Identifier: MPL-2.0
/**
 * Test fixture: theme groups as the document-theme controller hands them to a
 * surface (lib/document-theme.ts), and a controller double that applies a choice
 * to its own groups and tells its subscribers. Used by the Design system control
 * and section tests (plans/319 A4); nothing in the app imports this file.
 */
import type { DocumentThemeController, DocumentThemeGroup } from '../../lib/document-theme.ts';

export const MODE: DocumentThemeGroup = {
  id: '', label: 'Mode', kind: 'mode', canonical: 'light', active: 'light',
  options: [{ id: 'light', label: 'Light', canonical: true }, { id: 'dark', label: 'Dark', canonical: false }],
};

/** Three leads. The third name holds markup, so a test can show labels are escaped. */
export const COLOURWAY: DocumentThemeGroup = {
  id: 'colourway', label: 'Colourway', kind: 'colourway', canonical: 'pine', active: 'pine',
  options: [
    { id: 'pine', label: 'Pine', canonical: true, swatch: { lead: '#0c322c', partner: '#30ba78' } },
    { id: 'persimmon', label: 'Persimmon', canonical: false, swatch: { lead: '#c2410c', partner: '#7c2d12' } },
    { id: 'waterhole', label: 'Water<hole>', canonical: false, swatch: { lead: '#2453ff', partner: null } },
  ],
};

export const DENSITY: DocumentThemeGroup = {
  id: 'spacing', label: 'Density', kind: 'density', canonical: 'roomy', active: 'roomy',
  options: [{ id: 'roomy', label: 'Roomy', canonical: true }, { id: 'tight', label: 'Tight', canonical: false }],
};

export interface FakeThemeController {
  controller: DocumentThemeController;
  /** Every `choose` call, in order, refused ones included. */
  chosen: Array<[string, string]>;
  /** A change made in another surface, which a mounted control must redraw for. */
  setFromElsewhere(group: string, option: string): void;
  /** New groups, as after a design-system switch. */
  replace(next: DocumentThemeGroup[]): void;
  listeners: Set<() => void>;
}

/** A controller double. With `fail`, every choice is refused and nothing changes. */
export function fakeThemeController(initial: DocumentThemeGroup[], opts: { fail?: boolean } = {}): FakeThemeController {
  let groups = structuredClone(initial);
  const listeners = new Set<() => void>();
  const chosen: Array<[string, string]> = [];
  const notify = (): void => { for (const listener of listeners) listener(); };
  const controller: DocumentThemeController = {
    ready: Promise.resolve(),
    refresh: async () => {},
    groups: () => groups,
    setUsage: () => {},
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async choose(group, option) {
      chosen.push([group, option]);
      if (opts.fail) throw new Error('refused');
      groups = groups.map((g) => (g.id === group ? { ...g, active: option } : g));
      notify();
    },
    dispose() { listeners.clear(); },
  };
  return {
    controller,
    chosen,
    setFromElsewhere(group, option) { groups = groups.map((g) => (g.id === group ? { ...g, active: option } : g)); notify(); },
    replace(next) { groups = structuredClone(next); notify(); },
    listeners,
  };
}
