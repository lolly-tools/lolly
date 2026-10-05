// SPDX-License-Identifier: MPL-2.0
/**
 * share-sections - a generic registry of extra sections for the Share dialog.
 *
 * A neutral seam so components/share-dialog.ts can stay unaware of any particular
 * feature. The dialog consults this registry once it has rendered its own rows and
 * mounts whatever sections are registered; the registry is EMPTY by default, so the
 * dialog is byte-identical until something registers a builder.
 *
 * It knows nothing about WHO registers a section: a deployment's optional control
 * plane registers one to offer instance-hosted links (see src/org/), but the
 * registry is a standalone primitive - a test or a future feature can drive it the
 * same way. Each builder is handed a small, product-neutral context (the tool id,
 * the already-serialised state parts, the chosen format, a copy helper and, over a
 * live tool, a reader for the document itself) and
 * returns a DOM node to mount, or null to render nothing.
 */

/** The document a Share dialog was opened over, read at the moment a section asks. */
export interface ShareDocument {
  agentInvitation?: import('./agent-invitation-host.ts').AgentInvitationHost;
  /** Input values by input id, exactly as a saved session keeps them. */
  inputs: Record<string, unknown>;
  /** The loaded manifest's version. */
  toolVersion?: string;
  /** The name the person gave the document, when there is one. */
  label?: string;
  /** The emoji set the document draws with, as its URL params (the reserved `emoji`,
   *  `emojifx` and `emojistyle`), when one is chosen. */
  emoji?: { emoji: string; emojifx: string; emojistyle?: string };
}

export interface ShareSectionContext {
  /** The tool the link opens (as the dialog resolved it). */
  toolId?: string;
  /** The query parts the dialog serialised the current state into ("key=value"). */
  baseParts: readonly string[];
  /** The export format the link implies, if any. */
  currentFormat?: string;
  /** Copy text to the clipboard via the dialog's own affordance (with a fallback). */
  copy: (text: string) => Promise<void>;
  /**
   * Dismiss the Share dialog, exactly as its own Done button does.
   *
   * Optional, and absent when a section is built outside a dialog (a test drives the
   * builder directly). A section that NAVIGATES needs it: this is a modal, so a row that
   * changed the route without it would leave the dialog sitting over the page it just
   * sent the reader to.
   */
  close?: () => void;
  /**
   * Read the live document. Present only when the dialog was opened over a running
   * tool (the tool view); absent for a saved creation shared from elsewhere, so a
   * section that saves a document offers nothing without this reader.
   */
  document?: () => ShareDocument;
  /**
   * Where the dialog mounted this section: 'lead' when the section asked to sit above
   * the dialog's own link rows (so it can draw its divider below itself, not above).
   * Absent in the default place.
   */
  placement?: 'lead';
}

/** Builds a section for the given context, or returns null to add nothing. May be
 *  async (e.g. a lazily-imported builder), in which case the dialog mounts it once
 *  it resolves, provided the dialog is still open. */
export type ShareSectionBuilder = (ctx: ShareSectionContext) => HTMLElement | null | Promise<HTMLElement | null>;

/** Where in the dialog a section goes: 'after' (the default) below the dialog's own
 *  rows, or 'lead' above them, straight under the heading. */
export type ShareSectionPlacement = 'lead' | 'after';

/** The section's place in the order. Optional, and dormant: every section
 *  registered without one shares the default 0 and mounts in arrival order, exactly
 *  as before the hint existed. A lower number mounts above a higher one.
 *  `placement` is dormant the same way: without it a section mounts after the
 *  dialog's own rows, where every section went before the option existed. */
export interface ShareSectionOptions {
  order?: number;
  placement?: ShareSectionPlacement;
}

const builders: ShareSectionBuilder[] = [];
const orders = new WeakMap<ShareSectionBuilder, number>();
const leads = new WeakSet<ShareSectionBuilder>();

/** Register a section builder; returns an unregister fn. */
export function registerShareSection(builder: ShareSectionBuilder, opts: ShareSectionOptions = {}): () => void {
  builders.push(builder);
  if (typeof opts.order === 'number' && Number.isFinite(opts.order)) orders.set(builder, opts.order);
  if (opts.placement === 'lead') leads.add(builder);
  return () => {
    const i = builders.indexOf(builder);
    if (i >= 0) builders.splice(i, 1);
  };
}

/** A builder's ordering hint (0 when it gave none). */
export function shareSectionOrder(builder: ShareSectionBuilder): number {
  return orders.get(builder) ?? 0;
}

/** Where a builder asked its section to go ('after' when it gave no placement). */
export function shareSectionPlacement(builder: ShareSectionBuilder): ShareSectionPlacement {
  return leads.has(builder) ? 'lead' : 'after';
}

/** The registered builders (a copy, so iteration is stable across un/registration),
 *  lowest order first; equal orders keep their registration order. */
export function shareSectionBuilders(): readonly ShareSectionBuilder[] {
  return builders
    .map((b, i) => ({ b, i, o: shareSectionOrder(b) }))
    .sort((x, y) => x.o - y.o || x.i - y.i)
    .map((x) => x.b);
}

/** The order each mounted section was given, kept off the DOM so the markup is the
 *  same as before the hint existed. */
const mountedOrders = new WeakMap<Element, number>();

/**
 * Mount a built section into the dialog's host by its order. Builders may resolve
 * in any order (some lazy-load a module), so the node goes before the first section
 * already mounted with a higher order, else at the end. With every order equal this
 * is a plain append, which is what the dialog did before.
 */
export function mountShareSection(host: Element, node: HTMLElement, order = 0): void {
  mountedOrders.set(node, order);
  for (const child of Array.from(host.children)) {
    const o = mountedOrders.get(child);
    if (o !== undefined && o > order) { host.insertBefore(node, child); return; }
  }
  host.appendChild(node);
}

/** TEST-ONLY: empty the registry back to its dormant default. */
export function _clearShareSectionsForTests(): void {
  builders.length = 0;
}
