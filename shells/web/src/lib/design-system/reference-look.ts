// SPDX-License-Identifier: MPL-2.0
/** A reference proposes a look; only the studio's existing install path commits it. */
import { brandContext } from '../../../../../engine/src/brand-context.ts';
import { readBrandStyleEvidence } from '../../../../../engine/src/brand-evidence.ts';
import { createTokenSet, ENGINE_VERSION, TOKEN_EXT, contrastRatio } from '@lolly/engine';
import { buildBrandDocFromUsage } from '../brand-propose.ts';
import { censusToUsage, type DesignCensus } from './census.ts';

export interface ReferenceEvidence {
  method: 'image' | 'svg' | 'website' | 'files' | 'paste';
  label: string;
  sha256?: string;
  files?: string[];
}

export function referenceLook(census: DesignCensus, name: string, evidence: ReferenceEvidence, primary?: string, theme?: string) {
  if (primary && !census.colors.some(c => c.hex === primary)) throw new Error('Choose a colour from this reference.');
  const { doc, roles } = buildBrandDocFromUsage(censusToUsage(census), name, { primary, includeFonts: false });
  const extensions = (doc.$extensions ?? {}) as Record<string, unknown>;
  const vendor = (extensions[TOKEN_EXT] ?? {}) as Record<string, unknown>;
  doc.$extensions = { ...extensions, [TOKEN_EXT]: { ...vendor, reference: { ...evidence, ...(census.styles ? { styles: readBrandStyleEvidence(census.styles) } : {}), engineVersion: ENGINE_VERSION } } };
  const tokens = createTokenSet(doc, { theme: theme ?? roles.surfaceLook });
  const colors = new Map(tokens.colors().map(c => [c.path, c.value]));
  const color = (path: string): string => colors.get(`color.semantic.${path}`) ?? roles.primary;
  const preview = { primary: color('primary'), surface: color('surface'), text: color('text'), onPrimary: color('on-primary') };
  return {
    doc, roles, preview,
    contrast: { text: contrastRatio(preview.text, preview.surface), action: contrastRatio(preview.onPrimary, preview.primary) },
  };
}

/** Portable context includes observations and proposed tokens, never the page's raw text. */
export function referenceReport(census: DesignCensus, name: string, evidence: ReferenceEvidence, primary?: string) {
  const look = census.colors.length ? referenceLook(census, name, evidence, primary) : null;
  return {
    format: 'lolly-reference', version: 1, engineVersion: ENGINE_VERSION,
    source: evidence, observations: census,
    proposedTokens: look?.doc ?? null, checks: look?.contrast ?? null,
    context: look ? brandContext(look.doc, { name }) : null,
    coverage: {
      colors: evidence.method === 'image' ? 'sampled pixels' : evidence.method === 'svg' ? 'vector paints' : 'declared styles',
      fonts: 'names only; no font files included or installed',
      styles: census.styles?.mode ?? 'unavailable',
      preview: 'generated colour roles; a rendered poster is a preview, not a conformance check',
      modes: 'generated light and dark suggestions, not observed source modes',
      notAssessed: ['layout', 'motion', 'logo identity', 'subjective quality'],
    },
  };
}
