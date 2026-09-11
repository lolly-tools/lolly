// SPDX-License-Identifier: MPL-2.0
/**
 * active.ts - which design system this device is on, asked in ONE place
 * (plans/186 section 3.3, "the head is a pointer").
 *
 * Before the registry every caller worked the answer out for itself, by
 * comparing an asset id to the literal `user/tokens/brand`: the font module read
 * the head there, the drop router decided "has this person built something here"
 * there, the dashboard picked its status line there. That is fine while a device
 * holds exactly one design system and impossible the moment it holds two, since
 * a second system's head is a different id and none of those comparisons would
 * ever be true for it.
 *
 * So the id and the "is this mine" verdict come from here instead. With a
 * registry the answer is the active record's; without one (an older host, a
 * partial test host) each function falls back to exactly the test its callers
 * ran before, so nothing moves on a device that has not migrated yet.
 *
 * DOM-free and dependency-light on purpose: it is read on the boot path, from
 * modules that must keep running under plain node.
 */
import { USER_TOKENS_ID } from '../../bridge/tokens.ts';
import type { DesignSystemRecord } from './registry.ts';

/** The part of a record these reads need. A slice of the real one, so a caller
 *  can hand over `host.tokens.activeRecord()`'s answer unchanged. */
export type ActiveRecord = Pick<
  DesignSystemRecord,
  'headId' | 'id' | 'label' | 'locked' | 'source'
>;

/**
 * The host, read structurally.
 *
 * Every caller here carries its own narrow host slice (the studio's HostV1, the
 * font module's UserFontsHost, the picker's) and none of them declares the two
 * optional methods this module wants. Typing the parameter tightly would make
 * each of them cast at the call site, which is the scattering this module
 * exists to end, so the two reads are narrowed once, below.
 */
export interface ActiveSystemHost {
  tokens?: unknown;
  assets?: unknown;
}

interface TokensSlice {
  activeRecord?(): Promise<ActiveRecord | null>;
}

interface AssetsSlice {
  _findMetaByType?(type: string): Promise<{ id?: string } | null>;
}

const tokensOf = (host: ActiveSystemHost): TokensSlice | undefined =>
  (host.tokens ?? undefined) as TokensSlice | undefined;

const assetsOf = (host: ActiveSystemHost): AssetsSlice | undefined =>
  (host.assets ?? undefined) as AssetsSlice | undefined;

/** The active record, or null when this host has no registry behind it. */
export async function activeDesignSystemRecord(
  host: ActiveSystemHost
): Promise<ActiveRecord | null> {
  return (
    (await tokensOf(host)
      ?.activeRecord?.()
      .catch(() => null)) ?? null
  );
}

/**
 * The asset id a head read or write belongs to.
 *
 * The shipped system is deliberately not it: its head is the catalog's own
 * tokens asset, which nothing on this path may write, and every caller that asks
 * for a head id is either reading the person's own document or about to add to
 * it. Answering with the legacy user id there keeps the pre-registry behaviour,
 * where a first install shadowed the catalog at that one well-known id.
 */
export async function activeHeadId(host: ActiveSystemHost): Promise<string> {
  const record = await activeDesignSystemRecord(host);
  if (record && record.source.kind !== 'shipped' && record.headId) return record.headId;
  return USER_TOKENS_ID;
}

/**
 * Does this device have a design system of the person's own active?
 *
 * True for anything they installed, imported or subscribed to; false only for
 * the shipped catalog system, which is what a fresh install runs on. Without a
 * registry it is the test the callers all ran before: asset discovery is
 * user-first, so it answers the legacy user id exactly when a user tokens
 * document was installed here.
 */
export async function isUserDesignSystemActive(host: ActiveSystemHost): Promise<boolean> {
  const record = await activeDesignSystemRecord(host);
  if (record) return record.source.kind !== 'shipped';
  try {
    return (await assetsOf(host)?._findMetaByType?.('tokens'))?.id === USER_TOKENS_ID;
  } catch {
    return false;
  }
}

/**
 * Where the active system came from (`shipped`, `local`, `file`, `hosted`), or
 * null when no registry answers.
 *
 * The null is the useful half: a caller that has to tell "the build's own
 * catalog" from "a system somebody brought here" can act on the record when
 * there is one and keep its own older test when there is not, rather than
 * reading a stand-in answer as fact.
 */
export async function activeDesignSystemSource(host: ActiveSystemHost): Promise<string | null> {
  return (await activeDesignSystemRecord(host))?.source.kind ?? null;
}

/** The active system's name, or null without a registry. The record's label is
 *  the one the person set, so it beats any name stored on the asset. */
export async function activeDesignSystemLabel(host: ActiveSystemHost): Promise<string | null> {
  return (await activeDesignSystemRecord(host))?.label ?? null;
}
