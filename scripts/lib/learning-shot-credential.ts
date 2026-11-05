// SPDX-License-Identifier: MPL-2.0
/**
 * Content Credentials for the learning-module docs baseline.
 *
 * Every file in `docs/shots/` carries a credential, and
 * `tests/docs-shot-credentials.test.ts` holds the whole corpus to it: an
 * uncredentialed baseline still renders, it just quietly stops being provable.
 * The shots pipeline stamps what it captures, but this one baseline is written by
 * `scripts/check-learning-browser.ts` (it drives the authoring view and lifts the
 * result through the web shell's own DOM-to-SVG walker), so the stamp lives here.
 *
 * The claim says only what is true: Lolly produced these bytes, on the docs
 * surface, from the authoring view at the recorded address. It names no recipe the
 * shots pipeline could replay, because there is none.
 */
import { embedC2pa } from '../../engine/src/index.ts';
import { buildExportC2paOpts } from '@lolly-tools/node-shell/c2pa-opts';

/** One credential-model row, in the shape `summarizeInputs` reads. */
const row = (id: string, type: string, value: unknown): Record<string, unknown> =>
  ({ id, type, value, isDirty: true, label: id });

/**
 * The same bytes, with Content Credentials attached. A signing failure returns the
 * bytes unchanged and reports that, exactly as the shots pipeline does: a missing
 * credential is reported by its own test, and is never worth losing the shot over.
 */
export async function stampLearningShot(bytes: Uint8Array, origin: string): Promise<Uint8Array> {
  try {
    return await embedC2pa(bytes, 'svg', buildExportC2paOpts({
      surface: 'docs',
      manifest: { id: 'learning-module', name: 'Learning module' },
      model: [
        row('url', 'url', `${origin}/#/learning`),
        row('view', 'text', '.learning-author'),
        row('source', 'text', 'scripts/check-learning-browser.ts --shots'),
      ] as never,
      format: 'svg',
      days: 365,
    }));
  } catch (e) {
    console.warn(`⚠  training-module-outline: Content Credentials not attached - ${(e as Error).message}`);
    return bytes;
  }
}
