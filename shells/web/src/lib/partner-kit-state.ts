// SPDX-License-Identifier: MPL-2.0
/**
 * The partner kit state the app shares (Lolly Work plan 82, M8): which kit is the
 * person's, as org-config says (`partner.company.kit`: the kit asset's id, its live
 * revision and the company's name), and which kit each mounted piece carries.
 *
 * Kept apart from lib/partner-kit.ts, which reads kits, so org-config can set the offer
 * at boot and Save, Share, the asset picker and the checks can ask about a piece without
 * loading the kit reader. The reader loads when a piece has a kit to read.
 */
import type { PartnerKitAttachmentV1, PartnerKitV1 } from '@lolly-tools/core/partner-kit-v1';
import { PARTNER_KIT_LOGO_SURFACES, PARTNER_KIT_MAX_LABEL } from '@lolly-tools/core/partner-kit-v1';
import { formatPartnerKitParam, readPartnerKitAttachment } from '../../../../engine/src/url-mode.ts';
import type { GuestMarkMeasure } from '../../../../engine/src/partner-kit-check.ts';
import type { ExportPartner } from '@lolly-tools/core/host-v1';
import { workspacePartner } from './workspace-templates.ts';

/** What org-config says the person's company kit is: the asset, its live revision and the company's name. */
export interface PartnerKitOffer extends PartnerKitAttachmentV1 {
  label: string;
}

let offer: PartnerKitOffer | null = null;

/** Read org-config's `partner.company.kit`, or null when it is absent or does not read. */
export function readPartnerKitOffer(raw: unknown): PartnerKitOffer | null {
  const attachment = readPartnerKitAttachment(raw);
  const label = raw && typeof raw === 'object' ? (raw as { label?: unknown }).label : undefined;
  if (!attachment || typeof label !== 'string' || !label.trim()) return null;
  return { ...attachment, label: label.trim().slice(0, PARTNER_KIT_MAX_LABEL) };
}

/** The person's company kit, set from org-config; null for everyone else. */
export function setPartnerKitOffer(next: PartnerKitOffer | null): void {
  offer = next;
}

export function partnerKitOffer(): PartnerKitOffer | null {
  return offer;
}

/** A mounted piece's attachment, and the kit once read (null while it reads). */
export interface Piece { attachment: PartnerKitAttachmentV1; kit: PartnerKitV1 | null }
const pieces = new WeakMap<object, Piece>();
const listeners = new Set<() => void>();
/** Tell what shows the kit that a piece's kit changed. */
export const notifyPieceKit = (): void => { for (const fn of [...listeners]) { try { fn(); } catch { /* a listener's fault is its own */ } } };

/** Hear about an attach or a detach, to redraw what shows the kit. Returns the way to stop. */
export function onPieceKitChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The kit attachment of a mounted piece, by its runtime, or null. */
export function pieceKit(runtime: object | null | undefined): PartnerKitAttachmentV1 | null {
  const piece = runtime ? pieces.get(runtime) : undefined;
  return piece ? { ...piece.attachment } : null;
}

/** The attached kit itself, read and checked, or null. */
export function pieceKitData(runtime: object | null | undefined): PartnerKitV1 | null {
  return (runtime && pieces.get(runtime)?.kit) || null;
}

/** A piece's state, for lib/partner-kit.ts. */
export function getPieceState(runtime: object): Piece | undefined {
  return pieces.get(runtime);
}
export function setPieceState(runtime: object, piece: Piece): void {
  pieces.set(runtime, piece);
}
export function dropPieceState(runtime: object): boolean {
  return pieces.delete(runtime);
}

/** The kit's logo asset ids, in surface order, once each. */
function logoIds(kit: Pick<PartnerKitV1, 'logos'>): string[] {
  const ids: string[] = [];
  for (const surface of PARTNER_KIT_LOGO_SURFACES) {
    const id = kit.logos?.[surface]?.id;
    if (typeof id === 'string' && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The `_kit` part of a share link for a piece, or null when it carries no kit. */
export function partnerKitParam(runtime: object | null | undefined): string | null {
  const value = formatPartnerKitParam(pieceKit(runtime));
  return value ? `_kit=${encodeURIComponent(value)}` : null;
}

/** The kit logos the asset picker offers first, for the piece being edited. */
export function partnerMarkIds(runtime: object | null | undefined): string[] {
  const kit = pieceKitData(runtime);
  return kit ? logoIds(kit) : [];
}

/** What the brand check takes as the partner's own (`checkBrandDesign`'s `guest`). */
export function brandGuestFor(runtime: object | null | undefined): { colours: string[]; assets: string[] } | undefined {
  const kit = pieceKitData(runtime);
  return kit ? { colours: kit.colours.map((c) => c.value), assets: logoIds(kit) } : undefined;
}

/** The current piece the asset picker and the checks read, when there is one mounted. */
let current: object | null = null;
export function setCurrentPiece(runtime: object | null): void {
  current = runtime;
}
export function currentPiece(): object | null {
  return current;
}

/** What the Design checks measure a piece's partner marks against, or null when it carries no kit. */
export function partnerCheckFor(runtime: { getModel(): ReadonlyArray<{ id: string; value?: unknown }> } | null | undefined): { kit: PartnerKitV1; measure: GuestMarkMeasure } | null {
  const kit = pieceKitData(runtime);
  return kit && runtime ? { kit, measure: measureOf(runtime.getModel()) } : null;
}

/** How Design's CSS pixels turn into export pixels and millimetres, from the document's own unit and dpi. */
export function measureOf(model: ReadonlyArray<{ id: string; value?: unknown }>): GuestMarkMeasure {
  const unit = model.find((i) => i.id === 'documentUnit')?.value;
  const dpi = Number(model.find((i) => i.id === 'documentDpi')?.value);
  // The document's own CSS can restyle a layer, so the check is told the document has some.
  const customCss = model.find((i) => i.id === 'customCss')?.value;
  return {
    ...(typeof unit === 'string' ? { unit } : {}),
    ...(Number.isFinite(dpi) && dpi > 0 ? { dpi } : {}),
    ...(typeof customCss === 'string' && customCss.trim() ? { customCss } : {}),
  };
}

/** What a surface shows for a piece: its kit and revision, or the company's kit to attach, or nothing. */
export type PartnerKitStatus = { kind: 'attached'; label: string; revision: number } | { kind: 'offer'; label: string } | null;

export function partnerKitStatus(runtime: object | null | undefined): PartnerKitStatus {
  const kit = pieceKitData(runtime);
  const attached = pieceKit(runtime);
  if (kit && attached) return { kind: 'attached', label: kit.label, revision: attached.revision };
  if (!attached && runtime && offer) return { kind: 'offer', label: offer.label };
  return null;
}

/** Attach and Detach for a mounted piece, registered by its view so another surface (Design's inspector) can offer them. */
export interface PieceKitActions { attach(): Promise<unknown>; detach(): void }
const actions = new WeakMap<object, PieceKitActions>();
export function setPieceKitActions(runtime: object, next: PieceKitActions | null): void {
  if (next) actions.set(runtime, next);
  else actions.delete(runtime);
}

/** Run Attach or Detach on the piece being edited. Resolves once the change is in place. */
export async function runPieceKitAction(act: 'attach' | 'detach'): Promise<void> {
  const own = current ? actions.get(current) : undefined;
  if (!own) return;
  if (act === 'detach') own.detach();
  else await own.attach();
}

/**
 * Keep a piece's partner record with its attachment, and tell the runtime's subscribers
 * (the export card among them) when the record changes. Returns the way to stop.
 * It lives here, not in workspace-templates.ts, which is on the boot path: this
 * module reaches the engine's URL reader, which must stay off boot.
 */
export function followPiecePartner(runtime: { setPartner(partner: ExportPartner | null): void; refresh?(): void }): () => void {
  let last = '';
  const update = (): void => {
    const partner = workspacePartner();
    const kit = pieceKit(runtime);
    const next = kit && partner?.company && pieceKitData(runtime)?.id === partner.company.id ? { ...partner, kit } : partner;
    const key = JSON.stringify(next);
    if (key === last) return;
    const first = last === '';
    last = key;
    runtime.setPartner(next);
    if (!first) runtime.refresh?.();
  };
  update();
  return onPieceKitChange(update);
}
