// SPDX-License-Identifier: MPL-2.0
/**
 * Verify's "Made from" panel, moved out of views/valid.ts. An export credential
 * records menu, number, switch and colour choices as readable values and typed
 * text as a `sha256:` fingerprint (engine summarizeInputDigests).
 */
import { escape as escapeText } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon as glyph } from '../lib/icons.ts';

const svgIcon = (name: Parameters<typeof glyph>[0]): string => glyph(name, { strokeWidth: 1.9 });

/** A recorded input kept as a fingerprint rather than a value. */
export const isFingerprint = (v: string): boolean => /^sha256:[0-9a-f]{64}$/.test(v);

// The scalar-input digest recorded by the writer's tools.lolly.export assertion
// (env.inputs) - "what this was made from": the colours, sizes, toggles and short
// text the tool rendered with. Boxed as its own panel (matching change-history/
// assertion-log) and placed ABOVE change history so an inspected asset tells its
// "what it's made from" story before its "what happened to it" story. Empty in →
// nothing rendered (so panelsBlock silently drops this column when there's no digest).
// `recreate` (the /verify path only - the catalog/gallery callers pass none) adds
// the "Recreate with these settings" CTA: the anchor's plain href opens a blank
// session as the fallback; mountValid's delegated [data-recreate] handler upgrades
// the click into a digest-seeded link (lib/seed-url.ts). Settings-honest wording:
// the digest is scalar-only, so this reopens the recorded settings, not a clone.
export function inputsDigestHtml(
  inputs: Record<string, string> | undefined,
  recreate?: { toolId: string; toolName: string; fileIndex: number },
  /** The recorded tool NAME when it did not resolve against this build's index
   *  (plans/143 V1): a verified Lolly file opened on another instance still gets
   *  a door - an honest line plus the gallery - instead of a silent dead end at
   *  the exact moment the file has made someone curious. */
  missingTool?: string,
): string {
  const entries = inputs ? Object.entries(inputs).filter(([, v]) => v != null && v !== '') : [];
  if (!entries.length) return '';
  const isColor = (v: string): boolean => /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim());
  // Typed text travels as a fingerprint (engine summarizeInputDigests), so the row
  // reads "Text, fingerprinted" and keeps the hash itself for hover, not as the value.
  const rows = entries.map(([k, v]) => {
    if (isFingerprint(v)) return `<div class="valid-input-row"><dt>${escapeText(k)}</dt><dd><span class="valid-input-fingerprint" title="${escapeText(v)}">${t('Text, fingerprinted')}</span></dd></div>`;
    const sw = isColor(v) ? `<span class="valid-input-swatch" style="background:${escapeText(v)}" aria-hidden="true"></span>` : '';
    return `<div class="valid-input-row"><dt>${escapeText(k)}</dt><dd>${sw}<span>${escapeText(v)}</span></dd></div>`;
  }).join('');
  const fingerprinted = entries.some(([, v]) => isFingerprint(v))
    ? `<p class="valid-input-note">${t('Typed text is recorded only as a fingerprint, so the words themselves are not in the file.')}</p>` : '';
  const cta = recreate ? `
      <a class="btn valid-recreate" href="#/tool/${escapeText(recreate.toolId)}"
         data-recreate="${recreate.fileIndex}" data-recreate-tool="${escapeText(recreate.toolId)}">${t('Recreate with these settings in {tool}', { tool: recreate.toolName })}</a>` : missingTool ? `
      <p class="valid-recreate-absent">${t('Made with the {tool} tool, which is not in this catalogue.', { tool: missingTool })}</p>
      <a class="btn valid-recreate" href="/#/tools">${t('Explore the tools here')}</a>` : '';
  return `
    <div class="valid-inputs valid-panel">
      <h3>${svgIcon('sparkle')}<span>${t('Made from')}</span></h3>
      <dl class="valid-input-list">${rows}</dl>${fingerprinted}${cta}
    </div>`;
}

/**
 * The recorded inputs as values a tool link can be seeded with. Choices are display
 * strings, so each is read back by the manifest's type: a number drops its unit
 * ("12 mm" gives 12) and a switch reads 'true' or 'false', which serializeUrlState
 * would otherwise take as a truthy string. A fingerprint stands for text the file
 * does not carry: for that input the tool keeps its own value.
 */
export function seedValuesFromDigest(inputs: Record<string, string> | undefined, typeById: ReadonlyMap<string, string>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inputs ?? {})) {
    if (isFingerprint(v)) continue;
    const type = typeById.get(k);
    if (type === 'number') {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) values[k] = n;
    } else if (type === 'boolean') values[k] = v === 'true';
    else values[k] = v;
  }
  return values;
}
