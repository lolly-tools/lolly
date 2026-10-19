// SPDX-License-Identifier: MPL-2.0
/**
 * The preset LUTs darkroom ships, as both Grade modes offer them (the clip mode
 * in views/video-edit-inline.ts and the still mode in views/grade-inline.ts),
 * offered by the same ids and fetched from the same served path -
 * `community/darkroom/hooks.js` owns the files, this is a second reader of them,
 * never a copy. Keys double as the whitelist: an id that is not in here is never
 * interpolated into a URL. One list, so the two Grade buttons can never offer
 * different looks.
 *
 * Each look carries its rights record (plan 253), copied from the NOTICE.md
 * beside the files: who made it, under what licence, and where the public-domain
 * ones came from. A grade passes the record on as a transformation input, so the
 * creator rides into the graded file's C2PA and the rules credit the look under
 * its own licence, never the picture's.
 *
 * No runtime imports: both Grade modes load this module, and neither pulls the
 * video pipeline or the engine in through this list.
 */
import type { CreativeWorkRecordV1, RightsEvidenceV1 } from '@lolly-tools/core/rights-v1';
import type { LutSource } from './video-jobs.ts';

/** The LUT record for a grade: the work, used as a transformation input that applying it does not change. */
export function lutSource(work: CreativeWorkRecordV1, more: { attribution?: string; created?: string } = {}): LutSource {
  return {
    work,
    use: { work: work.id, role: 'transformation', operations: [] },
    ...(more.attribution ? { detail: { attribution: more.attribution } } : {}),
    ...(more.created ? { created: more.created } : {}),
  };
}

export const PRESET_LUT_BASE = '/tools/darkroom/assets/luts/';

/** The four public-domain film looks: resampled from FilmSim (CC0 1.0) at a pinned commit. */
const FILMSIM_CC0: RightsEvidenceV1 = {
  declaration: 'CC0 1.0', expression: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  assertedBy: 'catalog', evidence: 'notice-file', status: 'parsed',
};
const filmSim = (id: string, label: string, upstreamSha256: string): PresetLut => ({
  id, label, source: lutSource({
    id: `darkroom/luts/${id}`,
    title: label,
    creators: [{ name: 'Sébastien Guyader' }],
    sourceUrl: 'https://github.com/sguyader/FilmSim',
    revision: '1453b2b55c48d99a889b1e455f91f6898ba2db41',
    sourceHash: `sha256:${upstreamSha256}`,
    rights: [FILMSIM_CC0],
  }),
});

export interface PresetLut {
  id: string;
  label: string;
  source: LutSource;
}

export const PRESET_LUTS: PresetLut[] = [
  filmSim('slide-standard', 'Standard slide', 'acf26aee152dbce9fff685aa727a5550855d425aa90610dd63b3ff2f15be0fe7'),
  filmSim('slide-vivid', 'Vivid slide', '1b347b4c5afec78ad7f79103bf04b319e182b7133ffe2a8864c732a7003b7eea'),
  filmSim('chrome-muted', 'Muted chrome', 'cc303723b76205aedf970dc814dbecd6d9795955411aa2d6b265873864de7a66'),
  filmSim('mono-fine', 'Fine mono (B&W)', 'd4c9f720c1588531b7f748e13505e11f392af663415e625bda0ff3455b41c7a5'),
  // CC BY 4.0, which asks for a credit: the author made it for SUSE, who holds
  // the copyright, and asked to be credited as "SUSE · Peter Chamalian".
  { id: 'suse7-slog3-heavy', label: 'SUSE7 S-Log3 (Heavy)', source: lutSource({
    id: 'darkroom/luts/suse7-slog3-heavy',
    title: 'SUSE7 S-Log3 (Heavy)',
    creators: [{ name: 'Peter Chamalian', role: 'Director of Photography & Editor' }, { name: 'SUSE', role: 'publisher' }],
    rights: [{
      declaration: 'CC BY 4.0', expression: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/',
      copyright: '© 2025 SUSE', assertedBy: 'source', evidence: 'notice-file', status: 'parsed',
    }],
  }, { attribution: 'SUSE · Peter Chamalian', created: '2025-09' }) },
];
