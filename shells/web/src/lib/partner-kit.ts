// SPDX-License-Identifier: MPL-2.0
/**
 * The partner kit a piece carries as a guest (Lolly Work plan 82, M8).
 *
 * A partner company's kit is a catalog asset of its own type (`partner-kit`, never
 * `tokens`, so the tokens bridge never takes it for the design system and the chrome
 * never moves). Lolly Work serves it to that company's people only, and org-config tells
 * a member which kit is theirs (`partner.company.kit`: the asset id, the live revision
 * and the company's name). This module is the one place the app reads it:
 *
 * - which kit a piece opens with: a link's `_kit`, else a saved document's
 *   `__partnerKit`, else, for new work only, the person's company's kit;
 * - the kit's JSON at the attached revision, through `host.assets` and the asset's
 *   version route, read with the engine's own reader and kept per `id@revision`;
 * - the colours it offers under "Partner" in every colour field, the logos the asset
 *   picker offers first, and what the Design checks measure the marks against.
 *
 * A kit colour picked from the swatches is a literal, as every stored choice is, so a
 * reopened piece keeps the colour it was made with. Nothing here edits a kit: the brand
 * team makes and changes it in the Work console.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PartnerKitAttachmentV1, PartnerKitV1 } from '@lolly-tools/core/partner-kit-v1';
import { checkPartnerKit, partnerKitLogoIds } from '../../../../engine/src/partner-kit.ts';
import { guestRecolourFrom, type GuestMarkMeasure } from '../../../../engine/src/partner-kit-check.ts';
import { readPartnerKitAttachment } from '../../../../engine/src/url-mode.ts';
import { setGuestSwatches, type GuestSwatchGroup } from '../components/color-field.ts';
import { tRaw } from '../i18n.ts';
import { instanceFetch, instancePath } from './instance.ts';
import { dropPieceState, getPieceState, notifyPieceKit, partnerCheckFor, partnerKitOffer, setPieceState } from './partner-kit-state.ts';

export { brandGuestFor, currentPiece, measureOf, onPieceKitChange, partnerCheckFor, partnerKitParam, partnerMarkIds, pieceKit, pieceKitData, setCurrentPiece } from './partner-kit-state.ts';

/**
 * The attachment a piece opens with, and the values to create it from. A link's `_kit`
 * wins, then what a saved document holds; new work by a member whose company has a kit
 * starts with that kit at its live revision, stored as `__partnerKit` like any other
 * choice made at creation. Anything else opens with no kit, so a document made before
 * the kit existed keeps having none until the person attaches one.
 */
export function openingKit<V extends Record<string, unknown>>(values: V, link: PartnerKitAttachmentV1 | null | undefined, newWork: boolean): { values: V; attachment: PartnerKitAttachmentV1 | null } {
  const fromLink = readPartnerKitAttachment(link);
  const saved = readPartnerKitAttachment(values.__partnerKit);
  const offer = partnerKitOffer();
  const own = newWork && offer ? { id: offer.id, revision: offer.revision } : null;
  const attachment = fromLink ?? saved ?? own;
  if (!attachment) return { values, attachment: null };
  return { values: { ...values, __partnerKit: attachment }, attachment };
}

const cache = new Map<string, Promise<PartnerKitV1 | null>>();

/** Where Lolly Work serves one version of an instance asset's JSON: its catalog route with `?v=N`. */
export function kitVersionPath(attachment: PartnerKitAttachmentV1): string {
  return `/catalog/${attachment.id}/json?v=${attachment.revision}`;
}

/**
 * The kit at an attached revision, or null when this person is not served it, the bytes
 * do not read as `partner-kit-v1`, or the asset is not a kit. The feed says whether the
 * asset is a kit served to this person; the bytes come from Work's version route, so a
 * piece made at revision 1 reads revision 1 after the kit moved on. Kept per
 * `id@revision`, so a piece and the colour fields beside the piece read the kit once.
 */
export function loadPartnerKit(host: Pick<HostV1, 'assets'>, attachment: PartnerKitAttachmentV1, fetchImpl: (path: string) => Promise<Response> = (path) => instanceFetch(instancePath(path), { credentials: 'include' })): Promise<PartnerKitV1 | null> {
  const key = `${attachment.id}@${attachment.revision}`;
  const known = cache.get(key);
  if (known) return known;
  const read = (async (): Promise<PartnerKitV1 | null> => {
    try {
      const ref = await host.assets.get(attachment.id);
      if ((ref?.type as string | undefined) !== 'partner-kit') return null;
      const res = await fetchImpl(kitVersionPath(attachment));
      if (!res.ok) return null;
      const result = checkPartnerKit(await res.text());
      return result.ok ? result.kit : null;
    } catch {
      return null;
    }
  })();
  cache.set(key, read);
  void read.then((kit) => { if (!kit) cache.delete(key); });
  return read;
}

/** The kit's colours as a swatch group headed by the company's name, each a plain colour, never a token link. */
export function partnerSwatches(kit: Pick<PartnerKitV1, 'colours' | 'label'> | null): GuestSwatchGroup | null {
  if (!kit?.colours?.length) return null;
  const spoken = tRaw('{company}’s colours (partner kit)', { company: kit.label });
  return { heading: kit.label, spoken, swatches: kit.colours.map((c) => ({ value: c.value, label: c.name, group: spoken, ref: null })) };
}

/**
 * Attach a kit to a mounted piece. The kit is read first: a kit this person is not served
 * leaves the piece with none and a warning, as a link naming a design system the device
 * does not hold falls back with one. The colour fields offer the kit's colours while the
 * piece is mounted.
 */
export async function attachPieceKit(host: Pick<HostV1, 'assets' | 'log'>, runtime: object, attachment: PartnerKitAttachmentV1 | null, deps: { load?: typeof loadPartnerKit } = {}): Promise<PartnerKitV1 | null> {
  const att = readPartnerKitAttachment(attachment);
  if (!att) return null;
  setPieceState(runtime, { attachment: att, kit: null });
  notifyPieceKit();
  const kit = await (deps.load ?? loadPartnerKit)(host, att);
  if (getPieceState(runtime)?.attachment !== att) return null; // detached or replaced while it read
  if (!kit) {
    dropPieceState(runtime);
    try { host.log?.('warn', `The partner kit ${att.id} at revision ${att.revision} is not available here, so this piece opens without the kit.`); } catch { /* logging is best effort */ }
    notifyPieceKit();
    return null;
  }
  setPieceState(runtime, { attachment: att, kit });
  const group = partnerSwatches(kit);
  setGuestSwatches(group ? [group] : null);
  notifyPieceKit();
  return kit;
}

/** Take the kit off a piece: the piece keeps the colours it already uses, as literals. */
export function detachPieceKit(runtime: object): void {
  if (!dropPieceState(runtime)) return;
  setGuestSwatches(null);
  notifyPieceKit();
}

/** Forget a piece when its view unmounts, so the next tool's colour fields offer no partner colours. */
export function releasePieceKit(runtime: object): void {
  if (dropPieceState(runtime)) setGuestSwatches(null);
}

/** The web host's catalog reads the checks use when it has them. */
interface CheckHost extends Pick<HostV1, 'assets'> {
  assets: HostV1['assets'] & {
    _iconThemes?(): Promise<unknown[]>; _photoTreatments?(): Promise<unknown[]>;
    /** Every id that still resolves, colourway looks first (bridge/assets.ts). */
    _knownIconThemes?(): Promise<unknown[]>; _knownPhotoTreatments?(): Promise<unknown[]>;
  };
}

/**
 * What the Design checks measure a piece's marks against, with what the catalog knows: the
 * logos' own proportions, so a contained mark is measured where it is drawn, and the icon
 * themes and photo treatments, so a recoloured mark is judged by its colours. A read the
 * host cannot answer is left out, and the check then lists that measure as not taken.
 */
export async function partnerCheckInput(runtime: { getModel(): ReadonlyArray<{ id: string; value?: unknown }> }, host: CheckHost): Promise<{ kit: PartnerKitV1; measure: GuestMarkMeasure } | null> {
  const base = partnerCheckFor(runtime);
  if (!base) return null;
  const safe = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => { try { return await read(); } catch { return fallback; } };
  const [themes, treatments, refs] = await Promise.all([
    safe(async () => (await (host.assets._knownIconThemes ?? host.assets._iconThemes)?.call(host.assets)) ?? [], [] as unknown[]),
    safe(async () => (await (host.assets._knownPhotoTreatments ?? host.assets._photoTreatments)?.call(host.assets)) ?? [], [] as unknown[]),
    Promise.all(partnerKitLogoIds(base.kit).map((id) => safe<readonly [string, unknown]>(async () => [id, await host.assets.get(id)], [id, null]))),
  ]);
  // Each logo's own size, which gives its proportions too: a fit Design draws at the logo's own size needs the size.
  const sizes = new Map<string, { width: number; height: number }>();
  for (const [id, ref] of refs) {
    const w = Number((ref as { width?: unknown } | null)?.width), h = Number((ref as { height?: unknown } | null)?.height);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) sizes.set(id, { width: w, height: h });
  }
  return {
    kit: base.kit,
    measure: {
      ...base.measure,
      logoAspect: (id) => { const size = sizes.get(id); return size ? size.width / size.height : null; },
      logoSize: (id) => sizes.get(id) ?? null,
      recolour: guestRecolourFrom({ iconThemes: { themes }, photoTreatments: { treatments } }),
    },
  };
}
