// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-share-private.ts - the "Private collab" section of the Share dialog
 * (plans/100 section 0/section 6, Track A: P2P pairs). An OSS individual feature, deliberately
 * NOT under src/org/ (section 1 - org/ is control-plane awareness only, and a private
 * collab is exactly the "airgapped edge user's dream" the org boundary excludes).
 *
 * Registers into the generic lib/share-sections.ts seam once, as a side effect of
 * being imported - main.ts imports this module for exactly that effect (see its
 * boot sequence, right beside the other one-shot install*()/hydrate*() calls).
 * Unlike org/collab-share.ts's registration (routed through org/index.ts's async
 * initOrg(), because it depends on a control-plane probe that may never resolve),
 * this section needs no such gate: it self-registers unconditionally, and the
 * builder itself decides on every dialog open whether it has anything to show.
 * The registry starts empty (lib/share-sections.ts), so this import is what turns
 * the row on at all - nothing else in the boot path depends on its load order.
 *
 * Two independent gates, both required, checked fresh on every dialog open. Since
 * plans/108 Phase 1 the pair is asked ONCE, through `lib/collab-availability.ts`
 * (`canStartCollab(target, 'private')`), so this row and every other surface that
 * offers a collab read the same rule instead of each restating it; what the two gates
 * are has not changed:
 *   - `isFlagOnSync(PRIVATE_COLLAB_FLAG)` - the `private-collab` flag
 *     (feature-flags.ts), ON by default since 2026-08-10, so this row is part of the
 *     ordinary Share dialog rather than a beta anyone had to find first. It is still
 *     a gate: a user who turned the flag off, or an instance that governs it off,
 *     gets no row. The SYNC mirror, not the profile-aware `isFlagOn`, because the
 *     Share dialog's builder runs outside any profile-aware view.
 *   - a `'private'` opener registered in lib/collab-launch.ts - the actual
 *     invite/accept ceremony (plans/100 section 6.1). `collab/private-opener.ts` registers
 *     one unconditionally and `main.ts` imports it for that effect, so on a shipped
 *     boot this gate is satisfied and the flag is the one that decides.
 *
 * Row copy follows plans/100 section 0's naming: "Private collab" heading, "Start a
 * collab" verb - never "rooms"/"multiplayer". `announce()` on a successful open,
 * exactly like org/share-links.ts's rows and org/collab-share.ts's "Work collab"
 * row; a missing/throwing opener degrades to silence (openCollabLaunch's own
 * tolerance - see lib/collab-launch.ts).
 */

import { registerShareSection } from './share-sections.ts';
import type { ShareSectionContext } from './share-sections.ts';
import { canStartCollab, startCollab } from './collab-availability.ts';
import type { CollabTarget } from './collab-availability.ts';
import { hasConnection } from './provider-connections.ts';
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';

// The rendezvous providers (plans/138 Tier C), hardcoded here so the gate stays a
// LIGHT check on the boot path - importing lib/collab-rendezvous.ts (which pulls the
// four adapters) just to enumerate kinds would drag that chunk into boot. Kept in
// step with `rendezvousKinds()` in lib/collab-rendezvous.ts by hand (4 entries).
const RENDEZVOUS_KINDS = ['s3', 'webdav', 'gdrive', 'dropbox'] as const;

/** The dialog's live mount, as the availability seam names it: a session of a tool,
 *  seeded from the state the dialog serialised. No control-plane `sessionId` - that is
 *  the Work-collab row's business (`org/collab-share.ts`), and this row is Track A. */
function targetOf(ctx: ShareSectionContext): CollabTarget {
  return { kind: 'session', toolId: ctx.toolId, baseParts: ctx.baseParts, currentFormat: ctx.currentFormat };
}

/**
 * Build the "Private collab" section, or null when the flag is off or no
 * `'private'` opener is registered yet. Exported for tests, which call it
 * directly rather than through the share-sections registry.
 */
export function buildPrivateCollabShareSection(ctx: ShareSectionContext): HTMLElement | null {
  // Both gates, in one ask: lib/collab-availability.ts holds the private track's rule
  // for every surface that offers a collab (plans/108 Phase 1), so this row and the
  // gallery tile menu can no longer drift apart.
  if (!canStartCollab(targetOf(ctx), 'private')) return null;

  const section = document.createElement('section');
  section.className = 'share-private-collab';
  section.style.cssText = 'margin-top:.9rem;padding-top:.8rem;border-top:1px solid hsl(var(--border))';

  const heading = document.createElement('h3');
  heading.style.cssText = 'margin:0 0 .5rem;font-size:.82rem;font-weight:650;letter-spacing:.02em;text-transform:uppercase;color:hsl(var(--muted-foreground))';
  heading.textContent = t('Private collab');

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap';
  const note = document.createElement('span');
  note.className = 'share-shortest-note';
  // Hyphen, not an em-dash - house copy rule; the catalog keys moved with it.
  note.textContent = t('Invite one other device to co-edit this session directly - no account, no server.');
  row.appendChild(note);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--sm';
  btn.dataset.act = 'start-private-collab';
  btn.style.cssText = 'margin-top:.5rem';
  btn.textContent = t('Start a collab');

  // The other end of the same feature, and the reason this row has two buttons: an
  // invite is a link OR a code (plans/100 section 6.1's three skins), and until the code door
  // landed the code half had nowhere to go - a person handed a code in a chat had to be
  // sent a link as well. Secondary, because starting one is the common case; it opens
  // the door at #/join rather than duplicating it, so both entrances are one screen.
  const join = document.createElement('button');
  join.type = 'button';
  join.className = 'btn btn--sm';
  join.dataset.act = 'join-private-collab';
  join.style.cssText = 'margin-top:.5rem;margin-left:.4rem';
  join.textContent = t('Join with a code');

  section.append(heading, row, btn, join);

  // Third door (plans/138 Tier C): pair over a cloud you both already have connected -
  // signalling rides a shared-store rendezvous instead of a QR/link. Only shown when
  // at least one rendezvous provider is connected on this device; the picker (and the
  // whole collab/WebRTC chunk) is lazy-imported so it never touches the boot path.
  let cloud: HTMLButtonElement | null = null;
  if (RENDEZVOUS_KINDS.some(hasConnection)) {
    cloud = document.createElement('button');
    cloud.type = 'button';
    cloud.className = 'btn btn--sm';
    cloud.dataset.act = 'cloud-private-collab';
    cloud.style.cssText = 'margin-top:.5rem;margin-left:.4rem';
    cloud.textContent = t('Over shared cloud');
    section.append(cloud);
    cloud.addEventListener('click', () => {
      ctx.close?.();   // the picker is body-mounted and survives the share dialog closing
      void import('./collab-rendezvous-entry.ts').then((m) => {
        m.openRendezvousPicker({ toolId: ctx.toolId, baseParts: ctx.baseParts, currentFormat: ctx.currentFormat });
      }).catch(() => { /* the QR path stays as the fallback */ });
      announce(t('Opening shared-cloud collab'));
    });
  }

  btn.addEventListener('click', () => {
    const opened = startCollab(targetOf(ctx), 'private');
    if (opened) {
      // Dismiss like the join button does: the ceremony dialog takes over, and a
      // share modal left open under it keeps the whole tool inert after adoption
      // (drill finding 2026-08-10 - focus trapped on this very button).
      ctx.close?.();
      announce(t('Starting a collab'));
    }
  });

  join.addEventListener('click', () => {
    // Dismiss first: this is a modal, and a route change under an open one leaves the
    // dialog covering the page it just navigated to.
    ctx.close?.();
    // The route, spelled here rather than imported: `components/collab-ceremony.ts`
    // exports the same constant, but this module is on the BOOT path (main.ts imports it
    // for its registration side effect) and importing the ceremony for one string would
    // drag the whole dialog into the boot chunk.
    globalThis.location.hash = '#/join';
    announce(t('Opening the join screen'));
  });

  return section;
}

// Register once, as a side effect of import - see the header. A module re-eval
// (Vite HMR touching this file in dev) would register a second builder, since
// lib/share-sections.ts's registry has no dedupe; harmless (the row would just
// render twice, until the next full reload) and never a concern in a production
// build's one-shot module graph.
registerShareSection(buildPrivateCollabShareSection);
