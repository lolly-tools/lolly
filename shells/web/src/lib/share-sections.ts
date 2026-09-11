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
 * the already-serialised state parts, the chosen format, and a copy helper) and
 * returns a DOM node to mount, or null to render nothing.
 */

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
}

/** Builds a section for the given context, or returns null to add nothing. May be
 *  async (e.g. a lazily-imported builder), in which case the dialog mounts it once
 *  it resolves, provided the dialog is still open. */
export type ShareSectionBuilder = (ctx: ShareSectionContext) => HTMLElement | null | Promise<HTMLElement | null>;

const builders: ShareSectionBuilder[] = [];

/** Register a section builder; returns an unregister fn. */
export function registerShareSection(builder: ShareSectionBuilder): () => void {
  builders.push(builder);
  return () => {
    const i = builders.indexOf(builder);
    if (i >= 0) builders.splice(i, 1);
  };
}

/** The registered builders (a copy, so iteration is stable across un/registration). */
export function shareSectionBuilders(): readonly ShareSectionBuilder[] {
  return builders.slice();
}

/** TEST-ONLY: empty the registry back to its dormant default. */
export function _clearShareSectionsForTests(): void {
  builders.length = 0;
}
