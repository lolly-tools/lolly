// SPDX-License-Identifier: MPL-2.0
/** Shared readable production labels for the view and its PDF report. */
import type { ProductionCheck } from '../../../../engine/src/production.ts';
import { t } from '../i18n.ts';
export function productionCheckLabel(check: ProductionCheck): string {
  const labels: Record<string, string> = {
    format: 'Format',
    readability: 'Readable',
    width: 'Width',
    height: 'Height',
    pages: 'Pages',
    alpha: 'Transparency',
    source: 'Source',
    context: 'Settings',
  };
  return t(
    labels[check.id] ??
      (check.location === 'artifact' ? check.id.replaceAll('.', ' ') : check.location)
  );
}
export function productionCheckReason(check: ProductionCheck): string {
  if (check.reason === 'exact-requirement')
    return check.state === 'pass'
      ? t('Matches the requirement.')
      : t('Does not match the requirement.');
  if (check.reason === 'fact-unavailable') return t('This measurement is unavailable.');
  return check.reason.replaceAll('-', ' ');
}
export function productionCheckValue(
  check: ProductionCheck,
  value: string | number | undefined
): string {
  if (value === undefined) return t('Unavailable');
  if (check.id === 'readability') return value === 'true' ? t('Yes') : t('No');
  if (check.id === 'alpha') return value === 'true' ? t('Opaque') : t('Transparent');
  return String(value);
}
