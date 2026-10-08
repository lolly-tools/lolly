// SPDX-License-Identifier: MPL-2.0
/**
 * document-scope - where the document on screen belongs, said in a chip on the stage,
 * and what Save, Cmd-S and a Leave with unsaved changes mean there (plan 75 section
 * 5.1, G1).
 *
 * A neutral seam, the sibling of lib/share-sections.ts and lib/session-source.ts: the
 * tool view announces each mount here ({@link mountDocumentScope}) and asks it before a
 * save ({@link saveInDocumentScope}) and a leave ({@link documentLeavePrompt}); a
 * provider registered by whoever knows where documents can live (a workspace's
 * control plane, org/team-scope.ts) claims the documents that are its own. The
 * registry is EMPTY by default and nothing claims anything, so:
 *
 *  - with no provider and no external session source, no chip is drawn, Save saves on
 *    this device and the leave prompt is the one it always was: the shell is
 *    byte-identical to one without this file;
 *  - with an external session source registered (a workspace) and no claim, the chip
 *    says "On this device", so a person who also has team documents can tell the two
 *    apart at a glance.
 *
 * The provider's copy arrives already localised; this file adds only "On this device".
 * The chip itself (components/document-scope-chip.ts) is imported the first time there
 * is a chip to draw, so a deployment without a workspace never loads that component.
 */
import type { ShareDocument } from './share-sections.ts';
import { getSessionSource } from './session-source.ts';
import { tRaw } from '../i18n.ts';

/** What the person may do with the document where it belongs. */
export type DocumentScopeRole = 'device' | 'edit' | 'view';

export interface DocumentScopeChip {
  /** Where the document belongs and the person's role there ("Brand refresh · Can edit"). */
  label: string;
  role: DocumentScopeRole;
  /** The save state ("Not saved yet", "Saving…", "Saved just now"), when there is one. */
  state?: string;
}

/** One mounted tool, as the tool view hands it over. */
export interface DocumentScopeMount {
  readonly toolId: string;
  /** The tool view's root element: the chip goes on its stage, a banner above its inputs. */
  readonly view: HTMLElement;
  /** The document as a save elsewhere sends it: the values a local save keeps. */
  document(): ShareDocument;
  /** True while the document holds edits that were neither saved nor exported. */
  unsaved(): boolean;
  /** The tool's own save on this device, never routed through a scope. */
  saveOnDevice(): Promise<boolean>;
}

/** One row of the chip's menu. `run` does the work; the chip closes its menu first. */
export interface DocumentScopeMenuItem {
  id: string;
  label: string;
  run(): void;
}

export interface DocumentScopeProvider {
  /** The chip for this mount, or null when the document is not this provider's. */
  chip(mount: DocumentScopeMount): DocumentScopeChip | null;
  /** Save the document where it belongs, telling the person how it went. Resolves true
   *  only when it was saved there. Absent: Save saves on this device as before. */
  save?(mount: DocumentScopeMount): Promise<boolean>;
  /** The question a Leave with unsaved changes asks ("Save changes to Brand refresh?"),
   *  or null for the ordinary one. */
  leavePrompt?(mount: DocumentScopeMount): string | null;
  /** The chip's menu rows. */
  menu?(mount: DocumentScopeMount): DocumentScopeMenuItem[];
  /** Chrome that lives as long as the claim (a banner, a read-only layer). Called when
   *  the provider claims a mount; the returned teardown runs when the claim or the
   *  mount ends. */
  attach?(mount: DocumentScopeMount): () => void;
}

/** Latest registration first: a provider registered later is asked first. */
const providers: DocumentScopeProvider[] = [];
const listeners = new Set<() => void>();
/** The mount the tool view announced last, until its teardown. */
let mounted: DocumentScopeMount | null = null;

/** Tell every mounted chip to read its provider again (a save finished, a role came in). */
export function notifyDocumentScopeChange(): void {
  for (const fn of [...listeners]) {
    try { fn(); } catch (e) { console.error(e); }
  }
}

/** Hear every {@link notifyDocumentScopeChange} (a provider's own chrome follows the changes).
 *  Returns the unsubscribe. */
export function onDocumentScopeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Register a provider. Returns the unregister. */
export function registerDocumentScope(provider: DocumentScopeProvider): () => void {
  providers.unshift(provider);
  notifyDocumentScopeChange();
  return () => {
    const at = providers.indexOf(provider);
    if (at < 0) return;
    providers.splice(at, 1);
    notifyDocumentScopeChange();
  };
}

/** The provider that claims `mount`, with its chip. One provider's failure is its own. */
function claim(mount: DocumentScopeMount): { provider: DocumentScopeProvider; chip: DocumentScopeChip } | null {
  for (const provider of providers) {
    try {
      const chip = provider.chip(mount);
      if (chip) return { provider, chip };
    } catch (e) {
      console.error(e);
    }
  }
  return null;
}

/** The chip for `mount`: a provider's, else "On this device" on a workspace, else none. */
export function documentScopeChip(mount: DocumentScopeMount | null = mounted): DocumentScopeChip | null {
  if (!mount) return null;
  const claimed = claim(mount);
  if (claimed) return claimed.chip;
  return getSessionSource() ? { label: tRaw('On this device'), role: 'device' } : null;
}

/** The mounted document of `toolId`, when the tool view announced that mount. */
function mountOf(toolId: string | undefined): DocumentScopeMount | null {
  return mounted && (!toolId || mounted.toolId === toolId) ? mounted : null;
}

/** True when a provider claims the mounted document (of `toolId`, when given): it
 *  belongs somewhere other than this device. */
export function documentScopeClaimed(toolId?: string): boolean {
  const mount = mountOf(toolId);
  return !!mount && !!claim(mount);
}

/**
 * Save the mounted document of `toolId` where it belongs. Null when no provider claims
 * it or the claim has no save: the caller saves on this device, exactly as before.
 */
export function saveInDocumentScope(toolId: string): Promise<boolean> | null {
  const mount = mountOf(toolId);
  const claimed = mount ? claim(mount) : null;
  if (!mount || !claimed?.provider.save) return null;
  return claimed.provider.save(mount).catch((e: unknown) => {
    console.error(e);
    return false;
  });
}

/** The question a Leave with unsaved changes asks over the mounted document, or null. */
export function documentLeavePrompt(): string | null {
  const mount = mounted;
  const claimed = mount ? claim(mount) : null;
  if (!mount || !claimed?.provider.leavePrompt) return null;
  try { return claimed.provider.leavePrompt(mount); } catch (e) { console.error(e); return null; }
}

/** What the chip component draws with (implemented by components/document-scope-chip.ts). */
export interface DocumentScopeChipView {
  update(chip: DocumentScopeChip, menu: readonly DocumentScopeMenuItem[]): void;
  destroy(): void;
}

/**
 * Announce a tool mount. The tool view calls this once its stage is laid out and calls
 * the returned teardown with the rest of the mount's. Draws the chip when there is one,
 * runs the claiming provider's `attach`, and keeps both current: when a provider
 * registers or reports a change, when the document is edited, saved or exported, and
 * when the address changes. Dormant (no chip, no provider) it costs three listeners.
 */
export function mountDocumentScope(mount: DocumentScopeMount): () => void {
  mounted = mount;
  let view: DocumentScopeChipView | null = null;
  let loading = false;
  let ended = false;
  let attachedTo: DocumentScopeProvider | null = null;
  let detach: (() => void) | null = null;
  let pending = false;

  const draw = (): void => {
    if (ended || mounted !== mount) return;
    const claimed = claim(mount);
    const provider = claimed?.provider ?? null;
    if (provider !== attachedTo) {
      try { detach?.(); } catch (e) { console.error(e); }
      detach = null;
      attachedTo = provider;
      try { detach = provider?.attach?.(mount) ?? null; } catch (e) { console.error(e); }
    }
    const chip = claimed?.chip ?? documentScopeChip(mount);
    if (!chip) {
      view?.destroy();
      view = null;
      return;
    }
    let menu: DocumentScopeMenuItem[] = [];
    try { menu = provider?.menu?.(mount) ?? []; } catch (e) { console.error(e); }
    if (view) { view.update(chip, menu); return; }
    if (loading) return;
    loading = true;
    void import('../components/document-scope-chip.ts').then(({ createDocumentScopeChip }) => {
      loading = false;
      if (ended || mounted !== mount || view) return;
      const stage = mount.view.querySelector<HTMLElement>('#tool-stage') ?? mount.view;
      view = createDocumentScopeChip(stage);
      draw();
    }).catch((e: unknown) => { loading = false; console.error(e); });
  };
  // Edits, saves and address writes arrive in bursts; one draw per frame is enough.
  const schedule = (): void => {
    if (pending || ended) return;
    pending = true;
    const run = (): void => { pending = false; draw(); };
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
    else setTimeout(run, 16);
  };
  const off = onDocumentScopeChange(draw);
  // The tool view's dirty flag changes on the canvas ('lolly-session-status', which does
  // not bubble, so it is caught on the way down), and a save or export announces itself
  // from the actions panel ('lolly:export-complete', which bubbles).
  mount.view.addEventListener('lolly-session-status', schedule, true);
  mount.view.addEventListener('lolly:export-complete', schedule);
  globalThis.addEventListener?.('lolly:url-state', schedule);
  draw();
  return () => {
    if (ended) return;
    ended = true;
    off();
    mount.view.removeEventListener('lolly-session-status', schedule, true);
    mount.view.removeEventListener('lolly:export-complete', schedule);
    globalThis.removeEventListener?.('lolly:url-state', schedule);
    if (mounted === mount) mounted = null;
    try { detach?.(); } catch (e) { console.error(e); }
    detach = null;
    view?.destroy();
    view = null;
  };
}

/** TEST-ONLY: forget every provider and the mounted tool. */
export function _resetDocumentScopeForTests(): void {
  providers.length = 0;
  listeners.clear();
  mounted = null;
}
