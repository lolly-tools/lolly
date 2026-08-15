// SPDX-License-Identifier: MPL-2.0
/**
 * The docs-narration staleness contract (plans/40-docs-audio-listen.md §5), same
 * pattern as tests/docs-shots-vector.test.ts: every committed
 * docs/audio/<lang>/<slug>/meta.json must carry the textHash of the CURRENT
 * spoken-text document, or sit in the allowlist below with a written reason and
 * date. That keeps "slightly stale narration" an acknowledged state rather than
 * silent drift — a small copy fix need not trigger a re-record the same day,
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
 * passes over an empty set — CI never runs Kokoro or ffmpeg (plan §10), it only
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
 * and the date it was accepted — the "substantially changed" judgement made
 * explicit instead of heuristic. An entry here is a debt with a face, not a
 * pardon: re-render (or prune) and delete the line.
 *
 * Also the only place a non-English artefact can live for now: the hash source
 * for locale narration (translation sidecars, plan §9) is not wired into this
 * test yet, so a committed non-en directory must be listed here until it is.
 */
const STALE_ALLOWED: Record<string, string> = {
  // (Empty since the 2026-08-09 narration sweep re-rendered every stale launch
  // page — en/about, en/beatrice-warde and en/privacy came off the list because
  // their artefacts are fresh again, per this test's own second direction.)
  'en/ai-stance':
    'textHash drifted 2026-08-11: the pull-quote attribution changed from ' +
    '"Architect of Lolly" to "Lolly Contributor" — a three-word byline edit ' +
    'that does not warrant a full TTS re-render. Re-render (node ' +
    'scripts/build-docs-audio.ts) at the next narration sweep to clear this.',
  // The six below are one in-flight docs copy sweep (2026-08-11), still
  // uncommitted in the docs/ submodule — its files were being rewritten while
  // this list was assembled. Re-rendering mid-edit would burn a
  // model-and-ffmpeg pass on words that are still moving, so they are held
  // together and clear together: run `node scripts/build-docs-audio.ts` once
  // the sweep lands, then delete these six entries.
  'en/inclusive-design':
    'textHash drifted 2026-08-11 (docs copy sweep, in flight): the Listen ' +
    'paragraph now says eleven core pages rather than every page, and adds ' +
    'that narration is English-only for now. The page that promises Listen ' +
    'should not be the stale one — re-render as soon as the sweep settles.',
  'en/index':
    'textHash drifted 2026-08-11 (docs copy sweep, in flight): docs/site.md ' +
    'swapped street maps for QR codes in the self-serve bullet, rewrote the ' +
    'PowerPoint bullet around slide reuse plus a Markdown rebuild, changed a ' +
    'CLI example from quotes to wordmark, and dropped the hard 31/29 format ' +
    'counts. Re-render once the sweep settles. WIDER NOW (2026-08-15, plan 117): ' +
    'the landing was rebuilt block by block - a new hero line, three new blocks ' +
    '(worked examples, the sovereignty statement, AI on your terms), a new row ' +
    'set in the era contrast, and the formats and design-import bands moved to ' +
    'their own pages. The narration is a whole page behind, not a few sentences, ' +
    'so re-render this one FIRST at the next sweep.',
  'en/privacy':
    'textHash drifted 2026-08-11 (docs copy sweep, in flight): the enrolment ' +
    'section now distinguishes the throwaway per-export key from the lasting ' +
    'non-extractable one, SUSE Okta became id.suse.com, and the last-updated ' +
    'date moved. A privacy page must be re-rendered, not left stale for long — ' +
    'it is first in the queue once the sweep settles.',
  'en/trust':
    'textHash drifted 2026-08-15 (plan 116 Workstream C): trust.md gained the ' +
    '"Why this is free" section carrying the sceptic paragraph ("We built ' +
    'Lolly for ourselves…"). One new section - re-render at the next audio ' +
    'sweep alongside en/index.',
  // The six below are the 2026-08-15 AI-vernacular sweep: banned phrases and
  // fingerprint unicode were taken out of the copy across the docs set. The
  // pages still say the same things, so they clear together at the next
  // narration sweep (node scripts/build-docs-audio.ts).
  'en/about':
    'textHash drifted 2026-08-15 (AI-vernacular sweep): wording de-ticced; ' +
    're-render at the next audio sweep.',
  'en/beatrice-warde':
    'textHash drifted 2026-08-15 (AI-vernacular sweep): wording de-ticced; ' +
    're-render at the next audio sweep.',
  'en/builders':
    'textHash drifted 2026-08-15 (AI-vernacular sweep): wording de-ticced; ' +
    're-render at the next audio sweep.',
  'en/creators':
    'textHash drifted 2026-08-15 (AI-vernacular sweep): wording de-ticced; ' +
    're-render at the next audio sweep.',
  'en/operators':
    'textHash drifted 2026-08-15 (AI-vernacular sweep): wording de-ticced; ' +
    're-render at the next audio sweep.',
  'en/quickstart':
    'textHash drifted 2026-08-15 (AI-vernacular sweep): wording de-ticced; ' +
    're-render at the next audio sweep.',
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
  if (c.lang !== 'en') return 'locale narration has no hash source wired into this test yet (plan §9)';
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
  // (plan §4.5) — a partial directory is a failed render that got committed.
  const incomplete: string[] = [];
  // committedSlugs() only surfaces directories that carry a meta.json, so a
  // half-committed directory without one would slip past every other case here
  // — enumerate the raw tree for that shape first.
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
