// SPDX-License-Identifier: MPL-2.0
/**
 * A mounted piece's partner kit (Lolly Work plan 82, M8): the attachment it opened with,
 * Attach and Detach, and the kit's line in the tool sidebar's Design system section,
 * "Partner kit: Northwind IT · revision 2" with Detach, or "Attach Northwind IT's kit"
 * when the person's company has a kit and the piece has none. Everyone else sees nothing
 * new. Design has no sidebar section: its inspector draws the same line from the shared
 * state (views/design-document-context.ts) and runs the same actions.
 *
 * A module of its own, beside theme-section.ts, so a test can mount it with a fake root,
 * host and runtime. The kit reader is lib/partner-kit.ts and the shared state
 * lib/partner-kit-state.ts. The kit is read only here; the brand team edits it in Work.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PartnerKitAttachmentV1 } from '@lolly-tools/core/partner-kit-v1';
import { attachPieceKit, currentPiece, detachPieceKit, onPieceKitChange, releasePieceKit, setCurrentPiece } from '../../lib/partner-kit.ts';
import { partnerKitOffer, partnerKitStatus, setPieceKitActions } from '../../lib/partner-kit-state.ts';
import { t, tRaw } from '../../i18n.ts';

export interface PartnerKitLineOpts {
  /** The mounted view; the line goes in its `#theme-section-body` when it has one. */
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
  /** Whether the sidebar line has something to say, so the section shows for it alone. */
  visible(): boolean;
  destroy(): void;
}

export function mountPartnerKitLine(opts: PartnerKitLineOpts): PartnerKitLine {
  const { root, host, runtime } = opts;
  const attach = opts.attach ?? attachPieceKit;
  let destroyed = false;

  // The piece's own kit and its actions, whatever surface shows them.
  const attachOffer = async (): Promise<void> => {
    const offer = partnerKitOffer();
    if (!offer) return;
    const kit = await attach(host, runtime, { id: offer.id, revision: offer.revision });
    if (kit) opts.markDirty();
  };
  const detach = (): void => {
    detachPieceKit(runtime);
    opts.markDirty();
  };
  setCurrentPiece(runtime);
  setPieceKitActions(runtime, { attach: attachOffer, detach });
  if (opts.attachment) void attach(host, runtime, opts.attachment);

  const section = root.querySelector<HTMLDetailsElement>('#theme-section');
  const body = root.querySelector<HTMLElement>('#theme-section-body');
  const node = section && body ? body.ownerDocument.createElement('div') : null;
  let firstShow = true;
  if (node && body) {
    // Beside the section's body, not in it: the theme choices control redraws the body.
    node.className = 'input-section-body partner-kit-line';
    node.hidden = true;
    body.before(node);
    node.addEventListener('click', (event) => {
      const act = (event.target as Element | null)?.closest?.('[data-partner-kit]')?.getAttribute('data-partner-kit');
      if (act === 'detach') detach();
      else if (act === 'attach') void attachOffer();
    });
  }

  const render = (): void => {
    if (destroyed || !node || !section) return;
    const status = partnerKitStatus(runtime);
    const doc = node.ownerDocument;
    const button = (act: 'attach' | 'detach', label: string): HTMLButtonElement => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'tool-notice-link';
      b.dataset.partnerKit = act;
      b.textContent = label;
      return b;
    };
    if (status?.kind === 'attached') {
      const text = doc.createElement('span');
      text.className = 'partner-kit-line-text';
      text.textContent = tRaw('Partner kit: {company} · revision {revision}', { company: status.label, revision: status.revision });
      node.replaceChildren(text, button('detach', t('Detach')));
      node.hidden = false;
    } else if (status?.kind === 'offer') {
      node.replaceChildren(button('attach', tRaw('Attach {company}’s kit', { company: status.label })));
      node.hidden = false;
    } else {
      node.replaceChildren();
      node.hidden = true;
    }
    if (!node.hidden) {
      section.hidden = false;
      // Open the section the first time the kit is what shows it, so the person sees the kit at once.
      if (firstShow) { firstShow = false; section.open = true; }
    }
    opts.refreshSection?.();
  };

  const off = onPieceKitChange(render);
  render();

  return {
    visible: () => !!node && !node.hidden,
    destroy() {
      destroyed = true;
      off();
      setPieceKitActions(runtime, null);
      releasePieceKit(runtime);
      if (currentPiece() === runtime) setCurrentPiece(null);
      node?.remove();
    },
  };
}
