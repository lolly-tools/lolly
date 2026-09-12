// SPDX-License-Identifier: MPL-2.0
/**
 * profile: the one-line value each collapsed card shows in its summary.
 *
 * Every function takes the shared `pv: ProfileViewCtx` first (see context.ts). Sibling
 * calls in this file are direct; a call into another module, and every use of a
 * function as a value (an event listener), goes through `pv.<module>.<fn>`. Extracted verbatim
 * from mountProfile() by scripts/split-closure.ts.
 */
import { THEME_LABELS } from '../../theme.ts';
import { t, tRaw } from '../../i18n.ts';
import { flagHidden, isFlagOn } from '../../feature-flags.ts';
import { bindOp, type ProfileViewCtx } from './context.ts';

// currentTheme() can hand back a name that is not one of THEMES (a stale stored
// value), so a miss shows the raw name rather than an empty summary.
export const themeLabel = (_pv: ProfileViewCtx, name: string): string => tRaw((THEME_LABELS as Record<string, string>)[name] ?? name);
export const a11yOnCount = (pv: ProfileViewCtx) => { const { A11Y_ROWS, a11yState } = pv; return A11Y_ROWS.filter(r => a11yState[r.key]).length; };
export const a11ySummary = (pv: ProfileViewCtx) => (a11yOnCount(pv) ? tRaw('{n} on', { n: a11yOnCount(pv) }) : t('Off'));
export const rendersSummary = (pv: ProfileViewCtx) => (pv.renderSaveState ? t('Keeping copies') : t('Off'));
export const flagsOffCount = (pv: ProfileViewCtx) => { const { LISTED_FLAGS } = pv; return LISTED_FLAGS.filter(f => !flagHidden(f.id) && !isFlagOn(pv.liveProfile, f)).length; };
export const flagsSummary = (pv: ProfileViewCtx) => (flagsOffCount(pv) ? tRaw('{n} off', { n: flagsOffCount(pv) }) : t('All on'));
// Fills a section's summary value after the fact - textContent, so the caller
// passes plain text (tRaw, not t). A section that never loads keeps its blank.
export const setSummary = (pv: ProfileViewCtx, id: string, text: string): void => {
  const { viewEl } = pv;
  const el = viewEl.querySelector<HTMLElement>(`[data-summary="${id}"]`);
  if (el) el.textContent = text;
};
export function summariesOps(pv: ProfileViewCtx) {
  return {
    themeLabel: bindOp(pv, themeLabel),
    a11yOnCount: bindOp(pv, a11yOnCount),
    a11ySummary: bindOp(pv, a11ySummary),
    rendersSummary: bindOp(pv, rendersSummary),
    flagsOffCount: bindOp(pv, flagsOffCount),
    flagsSummary: bindOp(pv, flagsSummary),
    setSummary: bindOp(pv, setSummary),
  };
}
