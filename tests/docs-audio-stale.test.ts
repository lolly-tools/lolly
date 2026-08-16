// SPDX-License-Identifier: MPL-2.0
/**
 * The docs-narration staleness contract (plans/40-docs-audio-listen.md section 5), same
 * pattern as tests/docs-shots-vector.test.ts: every committed
 * docs/audio/<lang>/<slug>/meta.json must carry the textHash of the CURRENT
 * spoken-text document, or sit in the allowlist below with a written reason and
 * date. That keeps "slightly stale narration" an acknowledged state rather than
 * silent drift - a small copy fix need not trigger a re-record the same day,
 * but the exception is visible and expires deliberately.
 *
 * The test fails in both directions:
 *   - a committed artefact whose hash no longer matches the source and is not
 *     listed -> re-render it (node scripts/build-docs-audio.ts) or allowlist it
 *   - a listed entry that is fresh again (or gone)  -> delete it from the list
 * The second direction is the one that matters; without it the list rots by
 * staying true after it stopped being true.
 *
 * With no docs/audio committed (the state at launch of this test) every case
 * passes over an empty set - CI never runs Kokoro or ffmpeg (plan section 10), it only
 * ever judges committed artefacts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ARTEFACT_FILES,
  committedSlugs,
  currentSpoken,
  type AudioMeta,
} from '../scripts/build-docs-audio.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = join(ROOT, 'docs', 'audio');

/**
 * Artefacts allowed to ship stale, keyed '<lang>/<slug>', each with the reason
 * and the date it was accepted - the "substantially changed" judgement made
 * explicit instead of heuristic. An entry here is a debt with a face, not a
 * pardon: re-render (or prune) and delete the line.
 *
 * Also the only place a non-English artefact can live for now: the hash source
 * for locale narration (translation sidecars, plan section 9) is not wired into this
 * test yet, so a committed non-en directory must be listed here until it is.
 */
const STALE_ALLOWED: Record<string, string> = {
  // Empty: the 2026-08-16 narration re-render brought every committed launch
  // page fresh against its source. It cleared the debt that had piled up here -
  // the 2026-08-11 docs copy sweep, plan 116/117's rewrites, the 2026-08-15
  // AI-vernacular sweep, and the 2026-08-16 pass that spelled out the section
  // sign (say "section 2", never the glyph) - all of it is now baked into the
  // audio. An entry here is a debt with a face: add one only with a reason and
  // a date when a page is knowingly left stale, and delete it the moment the
  // page is re-rendered.
};

interface Committed { key: string; lang: string; slug: string; meta: AudioMeta }

/** Every committed artefact, across every language directory. */
function committed(): Committed[] {
  const out: Committed[] = [];
  if (!existsSync(AUDIO)) return out;
  for (const d of readdirSync(AUDIO, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const slug of committedSlugs(d.name)) {
      const meta = JSON.parse(readFileSync(join(AUDIO, d.name, slug, 'meta.json'), 'utf8')) as AudioMeta;
      out.push({ key: `${d.name}/${slug}`, lang: d.name, slug, meta });
    }
  }
  return out;
}

/** Is this committed artefact stale against the current docs source?
 *  Returns the human-readable defect, or null when it is fresh. */
function defect(c: Committed): string | null {
  if (c.lang !== 'en') return 'locale narration has no hash source wired into this test yet (plan section 9)';
  const spoken = currentSpoken(c.slug);
  if (!spoken) return 'docs/build.ts no longer lists this page — prune the artefacts';
  if (spoken.hash !== c.meta.textHash) {
    return `textHash drifted (committed ${c.meta.textHash.slice(0, 12)}…, current ${spoken.hash.slice(0, 12)}…)`;
  }
  return null;
}

test('docs audio: every committed narration matches its source text or is allowlisted', () => {
  const bad = committed()
    .map((c) => ({ c, why: defect(c) }))
    .filter((x) => x.why !== null && !(x.c.key in STALE_ALLOWED));
  assert.deepEqual(
    bad.map((x) => `${x.c.key}: ${x.why}`),
    [],
    'Stale narration must be re-rendered (node scripts/build-docs-audio.ts) or '
      + 'allowlisted in STALE_ALLOWED with a reason and date.',
  );
});

test('docs audio: the stale allowlist has no entries that are fresh again or gone', () => {
  const byKey = new Map(committed().map((c) => [c.key, c]));
  const rotten = Object.keys(STALE_ALLOWED).filter((key) => {
    const c = byKey.get(key);
    return !c || defect(c) === null;
  });
  assert.deepEqual(
    rotten,
    [],
    'These entries no longer describe a stale committed artefact — delete them so '
      + 'the list keeps meaning what it says.',
  );
});

test('docs audio: every allowlist entry states a reason and a date', () => {
  for (const [key, why] of Object.entries(STALE_ALLOWED)) {
    assert.ok(why.trim().length > 40, `${key}: the reason must be specific enough to re-check later`);
    assert.match(why, /20\d\d-\d\d-\d\d/, `${key}: the entry must carry the date it was accepted`);
  }
});

test('docs audio: every committed artefact directory is complete', () => {
  // meta.json is the staleness anchor, but a listener needs all five files
  // (plan section 4.5) - a partial directory is a failed render that got committed.
  const incomplete: string[] = [];
  // committedSlugs() only surfaces directories that carry a meta.json, so a
  // half-committed directory without one would slip past every other case here
  // - enumerate the raw tree for that shape first.
  if (existsSync(AUDIO)) {
    for (const lang of readdirSync(AUDIO, { withFileTypes: true })) {
      if (!lang.isDirectory()) continue;
      for (const d of readdirSync(join(AUDIO, lang.name), { withFileTypes: true })) {
        if (d.isDirectory() && !existsSync(join(AUDIO, lang.name, d.name, 'meta.json'))) {
          incomplete.push(`${lang.name}/${d.name}/meta.json`);
        }
      }
    }
  }
  for (const c of committed()) {
    for (const f of ARTEFACT_FILES) {
      if (!existsSync(join(AUDIO, c.lang, c.slug, f))) incomplete.push(`${c.key}/${f}`);
    }
    for (const field of ['slug', 'lang', 'voice', 'modelVersion', 'textHash', 'duration', 'bytes', 'generated'] as const) {
      if (c.meta[field] == null) incomplete.push(`${c.key}/meta.json missing ${field}`);
    }
  }
  assert.deepEqual(incomplete, [], 'Partial artefact directories — re-render or prune them.');
});
