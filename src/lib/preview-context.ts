// SPDX-License-Identifier: MPL-2.0
/** The effective brand and opted-in profile that an on-device preview renders with. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { profileSignature } from '../personalize-previews.ts';

export async function previewContextSignature(host: Pick<HostV1, 'tokens' | 'profile'>): Promise<string> {
  const [set, active, profile, colors] = await Promise.all([
    host.tokens?.get(), host.tokens?.active?.(), host.profile?.get(), host.tokens?.colors?.(),
  ]);
  const tokens = set?.query().map(({ path, type, value }) => [path, type, value])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))) ?? [];
  return JSON.stringify({
    version: 2,
    brand: active?.id ?? null,
    tokens,
    colors: colors ?? [],
    theme: typeof document === 'undefined' ? '' : document.documentElement.dataset.theme ?? '',
    details: profileSignature(profile),
  });
}
