// SPDX-License-Identifier: MPL-2.0
/**
 * The partner kit's line in the tool sidebar's Design system section (Lolly Work plan
 * 82, M8): "Partner kit: Northwind IT · revision 2" with Detach, or "Attach Northwind
 * IT's kit" when the person's company has a kit and the piece has none. Everyone else
 * sees nothing new. The kit is read only here; the brand team edits it in Work.
 *
 * A module of its own, beside theme-section.ts, so a test can mount it with a fake root,
 * host and runtime. The kit reader is lib/partner-kit.ts and the shared state lib/partner-kit-state.ts.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PartnerKitAttachmentV1 } from '@lolly-tools/core/partner-kit-v1';
import { attachPieceKit, currentPiece, detachPieceKit, onPieceKitChange, pieceKit, pieceKitData, releasePieceKit, setCurrentPiece } from '../../lib/partner-kit.ts';
import { partnerKitOffer } from '../../lib/partner-kit-state.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';

export interface PartnerKitLineOpts {
  /** The mounted view, holding `#theme-section` and `#theme-section-body`. */
  root: ParentNode;
  host: Pick<HostV1, 'assets' | 'log'>;
  /** The piece's runtime: the attachment is kept per runtime. */
  runtime: object;
  /** What the piece opened with (a link's `_kit`, a saved `__partnerKit`, or new work's seed). */
  attachment: PartnerKitAttachmentV1 | null;
  /** The piece changed: an attach or a detach is a change the session saves. */
  markDirty(): void;
  /** Ask the Design system section to show or hide again now that the line has changed. */
  refreshSection?(): void;
  /** Attach and detach for a test. */
  attach?: typeof attachPieceKit;
}

export interface PartnerKitLine {
  /** Whether the line has something to say, so the section shows for it alone. */
  visible(): boolean;
  destroy(): void;
}

export function mountPartnerKitLine(opts: PartnerKitLineOpts): PartnerKitLine {
  const { root, host, runtime } = opts;
  const attach = opts.attach ?? attachPieceKit;
  const section = root.querySelector<HTMLDetailsElement>('#theme-section');
  const body = root.querySelector<HTMLElement>('#theme-section-body');
  if (!section || !body) return { visible: () => false, destroy: () => {} };
  const node = body.ownerDocument.createElement('div');
  node.className = 'partner-kit-line';
  node.hidden = true;
  body.prepend(node);
  let destroyed = false;
  let firstShow = true;

  const render = (): void => {
    if (destroyed) return;
    const kit = pieceKitData(runtime);
    const attached = pieceKit(runtime);
    const offer = partnerKitOffer();
    if (kit && attached) {
      node.innerHTML = `<span class="partner-kit-line-text">${escapeText(tRaw('Partner kit: {company} · revision {revision}', { company: kit.label, revision: attached.revision }))}</span>`
        + `<button type="button" class="tool-notice-link" data-partner-kit="detach">${escapeText(t('Detach'))}</button>`;
      node.hidden = false;
    } else if (!attached && offer) {
      node.innerHTML = `<button type="button" class="tool-notice-link" data-partner-kit="attach">${escapeText(tRaw('Attach {company}’s kit', { company: offer.label }))}</button>`;
      node.hidden = false;
    } else {
      node.innerHTML = '';
      node.hidden = true;
    }
    if (!node.hidden) {
      section.hidden = false;
      // Open the section the first time the kit is what shows it, so the person sees the kit at once.
      if (firstShow) { firstShow = false; section.open = true; }
    }
    opts.refreshSection?.();
  };

  node.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest?.('[data-partner-kit]');
    if (!button) return;
    if (button.getAttribute('data-partner-kit') === 'detach') {
      detachPieceKit(runtime);
      opts.markDirty();
      return;
    }
    const offer = partnerKitOffer();
    if (!offer) return;
    void attach(host, runtime, { id: offer.id, revision: offer.revision }).then((kit) => { if (kit) opts.markDirty(); });
  });

  const off = onPieceKitChange(render);
  if (opts.attachment) {
    setCurrentPiece(runtime);
    void attach(host, runtime, opts.attachment);
  } else {
    setCurrentPiece(runtime);
  }
  render();

  return {
    visible: () => !node.hidden,
    destroy() {
      destroyed = true;
      off();
      releasePieceKit(runtime);
      if (currentPiece() === runtime) setCurrentPiece(null);
      node.remove();
    },
  };
}
