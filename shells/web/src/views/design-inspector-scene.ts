// SPDX-License-Identifier: MPL-2.0
/** The Design inspector's one-line reading of a 3D scene field (moved out of design-inspector.ts). */
import { t } from '../i18n.ts';

/**
 * WHAT A SCENE FIELD SAYS, in one short line (plan 265 milestone 3, D2).
 *
 * A `kind: '3d'` box stores the 3D Studio's own readable query with every value that
 * matches a studio default left out (see `engine/src/design-scene.ts`), so reading the
 * query IS reading what the author chose - which is the only thing a summary can
 * honestly report from here. This column is mounted against fakes and is handed no tool
 * manifest, so it never claims to know a default: a query that carries nothing reads as
 * "Studio defaults", and an empty field as "Empty scene".
 *
 * The six source words are the studio's wire values, pinned by its own compat suite. A
 * source this table has not met falls through to the wire word itself, so a studio that
 * grows a seventh still reads rather than going blank.
 */
const SCENE_SOURCE_LABEL: Record<string, () => string> = {
  primitive: () => t('Shape'),
  artwork: () => t('Artwork'),
  model: () => t('Model'),
  text: () => t('Words'),
  collection: () => t('Collection'),
  arrangement: () => t('Arrangement'),
};

/** A scene asset id as a person can read it: a catalog id says itself, an upload cannot. */
const sceneAssetLabel = (id: string): string => (id.startsWith('user/') ? t('one of your uploads') : id);

/** The scene's subject and its lighting studio, both empty when the query says nothing. */
export function sceneSummary(query: string): { subject: string; studio: string } {
  const q = new URLSearchParams(query);
  const source = (q.get('source') ?? '').trim();
  const detail = (q.get('words') ?? '').replace(/\s+/g, ' ').trim()
    || (q.get('primitive') ?? '').trim()
    || sceneAssetLabel((q.get('artwork') ?? '').trim() || (q.get('modelAsset') ?? '').trim() || '')
    || '';
  const parts = [source ? (SCENE_SOURCE_LABEL[source]?.() ?? source) : '', detail.slice(0, 80)].filter(Boolean);
  return { subject: parts.join(' · '), studio: (q.get('studio') ?? '').trim() };
}
