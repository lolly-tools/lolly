// SPDX-License-Identifier: MPL-2.0
/**
 * cost-authoring - the FURNITURE for slot:cost-authoring, extracted out of core's
 * default mounted path.
 *
 * This is the rate-card AUTHORING/manage UX turned into an Extension conforming to
 * `@lolly-tools/core/extension-v1`. Core defines the door (the `cost-authoring`
 * slot, its typed `CostAuthoringContext`, and the mount site beside the cost
 * panel); it carries NONE of this furniture on the default boot path, so a plain
 * OSS build renders no authoring UI and the slot stays empty. What core keeps: the
 * preflight COUNTS, the pure cost CALCULATOR (`engine/src/rate-card.ts`), card
 * CONSUMPTION (the `lib/rate-cards.ts` storage rail, the CLI `--rate-card`, a
 * supplied confidential catalog card). A supplied card parses, stores and prices
 * with this file never imported.
 *
 * WHY IT LEFT CORE: authoring/curating supplier rate cards is org/deployer config,
 * not core-individual config. It is hydrated by a supply channel - the control
 * plane (a governed manager), the community (an OSS author's bundle), or a
 * deliberate LOCAL opt-in here - all through the one `registerExtension` contract.
 *
 * REVERSIBILITY: when hydrated, the mount renders a single "manage rate cards"
 * trigger that opens `openRateCardsPanel` UNCHANGED - today's authoring behaviour,
 * byte-identical. Nothing about the modal, the dropzone, the New-card scaffold, or
 * the store moved; only the DEFAULT MOUNT of that behaviour did.
 *
 * TRUST: a hydrated component runs in the shell realm, same reach as a tool
 * `hooks.js` - not sandboxed. This bundled-in local extension is org-trusted by the
 * self-hoster who enables it; a community/control-plane bundle carries the same
 * caveat (see the header of @lolly-tools/core/extension-v1). Enabling it is a
 * deliberate act (see enableLocalCostAuthoring) - it is NEVER on the plain-OSS boot
 * path, so importing this module has no effect until you call the opt-in.
 */

import type { Extension, Disposer } from '@lolly-tools/core/extension-v1';
import type { CostAuthoringContext } from '../views/cost-panel.ts';
import { registerExtension } from '../lib/extensions.ts';
import { openRateCardsPanel } from '../components/rate-cards-manager.ts';

/**
 * The authoring furniture as an Extension. A `single`-slot component: it hydrates
 * one "manage rate cards" trigger into the slot element; clicking it opens the
 * unchanged manager modal, and a card added/removed there fires the context's
 * `onChange` so the cost panel reprices at once.
 */
export const costAuthoringExtension: Extension<CostAuthoringContext, HTMLElement> = {
  id: 'lolly:cost-authoring',
  slot: 'cost-authoring',
  contract: '^1.0.0',
  mount(host) {
    const btn = host.el.ownerDocument.createElement('button');
    btn.type = 'button';
    btn.className = 'cost-authoring-open';
    btn.textContent = host.t('Manage rate cards');
    btn.addEventListener('click', () => {
      void openRateCardsPanel({ host: host.context.host, onChange: host.context.onChange });
    });
    host.el.appendChild(btn);
    return () => btn.remove();
  },
};

/**
 * The LOCAL power-user / self-hoster opt-in: register the authoring furniture on
 * the `local` channel (self-opting - no control plane or opt-in signal needed).
 * Returns the unregister disposer. Call this once from your own boot customisation
 * to restore in-app authoring; the default OSS boot never calls it.
 *
 * This is deliberately a code-level opt-in, not a user-facing toggle: authoring
 * supplier rate cards is a deployer decision, and surfacing it to every individual
 * is exactly the confusion this extraction removes.
 */
export function enableLocalCostAuthoring(): Disposer {
  return registerExtension(costAuthoringExtension, 'local');
}
