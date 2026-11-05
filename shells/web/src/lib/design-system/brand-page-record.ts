// SPDX-License-Identifier: MPL-2.0
/**
 * Whether this design system's exports name its brand page (plan 351 B5). The setting
 * lives in the tokens document, so it travels with the design system, and off means the
 * key is gone. A locked system's material is read-only, so its manager decides.
 */
import { installUserTokens } from '../../bridge/tokens.ts';
import { readRecordedBrandPage, withRecordedBrandPage } from '../../../../../engine/src/brand-page-address.ts';
import type { UsageHost } from './usage-model.ts';

export interface BrandPageSetting {
  /** The address exports record now, or null when the setting is off. */
  address: string | null;
  /** The material is read-only here, so the setting cannot change on this device. */
  locked: boolean;
}

export async function readBrandPageSetting(host: Pick<UsageHost, 'tokens'>): Promise<BrandPageSetting> {
  const tokens = host.tokens;
  const [doc, locked] = await Promise.all([tokens.raw?.().catch(() => null) ?? null, tokens.isLocked?.().catch(() => true) ?? true]);
  return { address: readRecordedBrandPage(doc), locked };
}

/** One write, on one person's act: a good address, or null to turn the setting off. */
export async function writeBrandPageSetting(host: Parameters<typeof installUserTokens>[0] & Pick<UsageHost, 'tokens'>, address: string | null, labelIfNew: string): Promise<void> {
  const doc = await host.tokens.raw?.();
  await installUserTokens(host, withRecordedBrandPage(doc, address) as object, { labelIfNew });
}
