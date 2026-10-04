// SPDX-License-Identifier: MPL-2.0
/**
 * Design authoring keys on the CLI (plan 291 W5, design-authoring-v1): the one place
 * `lolly run design --document`, `lolly compile design --inputs` and
 * `lolly validate design --inputs` lower `$in`, `$style`, `$points`, `$stack` and the
 * rest to stored rows before anything else reads the document.
 *
 * Text styles take their sizes and colours from the design system the other verbs
 * use: `--file`, then the terminal's active system, then the content profile's own
 * (`briefSource`, the ladder `lolly check` and `lolly package` follow). The brief is
 * read only when the document carries an authoring key, so a stored document costs
 * nothing extra and comes back as it was.
 */
import { designBrief, expandDesignAuthoringDocument, hasDesignAuthoring, type DesignAuthoringNote } from '@lolly/engine';
import { refused } from './exit-codes.ts';

export interface LoweredDocumentV1 {
  /** Every input value the document carries, `boxes` lowered and `$styles` / `$theme` taken off. */
  values: Record<string, unknown>;
  rows: Record<string, unknown>[];
  notes: DesignAuthoringNote[];
  /** False when the document carried no authoring key: `values` is then the document's own. */
  expanded: boolean;
}

/** The design brief authored text styles resolve in, or null when no design system is found. */
async function authoringBrief(flags: { file?: string; theme?: string }): Promise<unknown | null> {
  const { briefSource } = await import('./system.ts');
  const { readBriefCatalogFor } = await import('@lolly-tools/node-shell/design-brief');
  const { doc, origin } = await briefSource(flags as never);
  if (!doc) return null;
  return designBrief(doc, readBriefCatalogFor(origin?.kind, doc), flags.theme ? { theme: flags.theme } : {});
}

/**
 * A Design document in any accepted shape (a rows array, `{boxes}`, `{values: {boxes}}`,
 * a saved session) with its authoring lowered. A key that cannot be lowered is refused
 * (exit 4, `AUTHORING_INVALID`) with its JSON pointer, as `lolly package` refuses such a key.
 */
export async function lowerDesignDocument(
  doc: unknown,
  opts: { file?: string; theme?: string; what?: string } = {},
): Promise<LoweredDocumentV1> {
  const brief = hasDesignAuthoring(doc) ? await authoringBrief(opts) : null;
  try {
    return expandDesignAuthoringDocument(doc, { brief, ...(opts.theme ? { theme: opts.theme } : {}) });
  } catch (err) {
    throw refused(`${opts.what ? `${opts.what}: ` : ''}${err instanceof Error ? err.message : String(err)}`, 'AUTHORING_INVALID');
  }
}

/** One line per authoring note, for stderr. */
export function authoringNoteLines(notes: readonly DesignAuthoringNote[]): string[] {
  return notes.map((n) => `ℹ ${n.path || '/'}: ${n.message}`);
}
