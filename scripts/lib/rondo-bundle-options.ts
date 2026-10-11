import type { InlineConfig } from 'vite';

type BundleOptions = NonNullable<NonNullable<InlineConfig['build']>['rolldownOptions']>;

/** Dependency locations are debug labels, not editor content. Legal notices stay intact. */
export function rondoBundleOptions(): BundleOptions {
  return {
    experimental: { attachDebugInfo: 'none' },
    output: { codeSplitting: false, comments: { legal: true } },
  };
}
