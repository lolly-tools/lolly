// SPDX-License-Identifier: MPL-2.0
/**
 * Document ownership, Save routing and Leave with unsaved changes (plan 75 section
 * 5.1, G1). A tool view announces each mount here and asks before saving or leaving.
 * Providers claim their documents and attach scope-specific behavior, such as the
 * read-only layer. An unclaimed document uses the ordinary device save and leave
 * prompt. This registry does not add controls to the tool stage.
 */
import type { ShareDocument } from './share-sections.ts';

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
  /** The tool view's root element, where a provider may attach a read-only banner. */
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

/** Tell every mounted scope to read its provider again (a save finished, a role came in). */
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

/**
 * Announce a tool mount. The tool view calls this once its stage is laid out and calls
 * the returned teardown with the rest of the mount's. Runs the claiming provider's
 * `attach` and keeps it current when a provider registers or reports a change, when
 * the document is edited, saved or exported, and when the address changes.
 */
export function mountDocumentScope(mount: DocumentScopeMount): () => void {
  mounted = mount;
  let ended = false;
  let attachedTo: DocumentScopeProvider | null = null;
  let detach: (() => void) | null = null;
  let pending = false;

  const refresh = (): void => {
    if (ended || mounted !== mount) return;
    const claimed = claim(mount);
    const provider = claimed?.provider ?? null;
    if (provider !== attachedTo) {
      try { detach?.(); } catch (e) { console.error(e); }
      detach = null;
      attachedTo = provider;
      try { detach = provider?.attach?.(mount) ?? null; } catch (e) { console.error(e); }
    }
  };
  // Edits, saves and address writes arrive in bursts; one refresh per frame is enough.
  const schedule = (): void => {
    if (pending || ended) return;
    pending = true;
    const run = (): void => { pending = false; refresh(); };
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(run);
    else setTimeout(run, 16);
  };
  const off = onDocumentScopeChange(refresh);
  // The tool view's dirty flag changes on the canvas ('lolly-session-status', which does
  // not bubble, so it is caught on the way down), and a save or export announces itself
  // from the actions panel ('lolly:export-complete', which bubbles).
  mount.view.addEventListener('lolly-session-status', schedule, true);
  mount.view.addEventListener('lolly:export-complete', schedule);
  globalThis.addEventListener?.('lolly:url-state', schedule);
  refresh();
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
  };
}

/** TEST-ONLY: forget every provider and the mounted tool. */
export function _resetDocumentScopeForTests(): void {
  providers.length = 0;
  listeners.clear();
  mounted = null;
}
