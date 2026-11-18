// SPDX-License-Identifier: MPL-2.0
/**
 * A design system from one colour, made on the gallery itself. The first-visit
 * greeting (components/welcome-hero.ts) offers a few colours on a blank install;
 * one press builds the same document Design System Setup builds from a first
 * colour, installs it through the same write (installUserTokens) and repaints the
 * page through the one switch path, so the covers under the greeting change while
 * the person watches. Undo removes the system and puts the starter back.
 *
 * Only for an install still on the blank starter. A shipped brand (Lolly Demo)
 * has colourways and its own role words, which a fresh derive would drop, so that
 * audience keeps the door to Design System Setup.
 *
 * Loaded on the first press, so a visit that never picks a colour pays nothing.
 */
import { DEFAULT_DESIGN_SYSTEM_ID, deriveBrandTokens } from '@lolly/engine';
import { installUserTokens, type InstallTokensHost } from '../../bridge/tokens.ts';
import { STUDIO_GROUPS } from '../token-studio.ts';
import { removeDesignSystem, type ManageHost } from './manage.ts';
import { switchDesignSystem, type SwitchHost } from './switch.ts';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** What the greeting needs from the gallery's host. */
export type OneColourHost = SwitchHost & ManageHost & InstallTokensHost;

/**
 * The document for `primary`: a fresh derive, with everything that is not colour
 * carried over from `current` (the faces, the logo slots, the shape and the
 * studio's own groups), as a palette rebuild in the studio does. A derive writes
 * colour only, so each carried group goes in where the fresh document has none.
 */
export function designSystemFromColour(current: unknown, primary: string): Rec {
  const next = deriveBrandTokens({ primary, name: 'My brand' }) as Rec;
  const cur = isRec(current) ? current : {};
  const from = isRec(cur.base) ? cur.base : cur;
  const to = isRec(next.base) ? next.base : next;
  for (const group of [...STUDIO_GROUPS, 'font', 'asset', 'shape']) {
    if (to[group] === undefined && isRec(from[group])) to[group] = structuredClone(from[group]);
  }
  return next;
}

/** A colour that was applied, and the way back. */
export interface OneColourResult {
  /** Put the starter back and remove the system this press made. */
  undo(): Promise<void>;
}

/**
 * Make the active blank starter the person's own from one colour, or change the
 * colour of the system an earlier press made. Returns null, having changed
 * nothing, when this device already holds a design system of the person's own
 * that this module did not make: one press must never overwrite someone's work.
 */
export async function startFromColour(host: OneColourHost, primary: string, madeHere: boolean): Promise<OneColourResult | null> {
  const registry = host.designSystems;
  const before = await registry.active();
  if (!madeHere) {
    if (before.source.kind !== 'shipped') return null;
    if (await registry.get(DEFAULT_DESIGN_SYSTEM_ID)) return null;
  }
  const doc = designSystemFromColour(await host.tokens?.raw?.(), primary);
  await installUserTokens(host, doc);
  const made = await registry.activeId();
  await switchDesignSystem(host, made, { previous: before, route: 'gallery' });
  return {
    async undo() {
      await removeDesignSystem(host, made);
      await switchDesignSystem(host, await registry.activeId(), { route: 'gallery' });
    },
  };
}
