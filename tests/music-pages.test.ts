// SPDX-License-Identifier: MPL-2.0
/**
 * The music genre pages (/info/music/<slug>/) and the background music hub
 * (docs/background-music.md): the registers that drive them against the genres the
 * music generator lists.
 *
 *  - every genre the genre picker lists has page copy in docs/site/music-genres.json,
 *    an address, and a listening sample in docs/music/samples/ whose bytes match its
 *    recipe and whose Content Credentials read back as the music generator's own;
 *  - the group headings match the picker's;
 *  - the samples stay within the size budget (Andy, 2026-11-15: about 12 MB);
 *  - the hub's Questions section, which every genre page repeats, answers the
 *    questions a newcomer asks, in the licence's words.
 *
 * Run directly: node --test tests/music-pages.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANCHOR_SECTIONS, GENRE_SLUG, MUSIC_CREDIT, MUSIC_GROUP_TITLE, excerptAnchor, genrePageSlug, makeYourOwnHash,
  plainText, questionsFromMarkdown, registerProblems, type MusicRegister, type SampleSet,
} from '../docs/music-pages.ts';
import { GENRE_GROUPS } from '../shells/web/src/lib/genre-icons.ts';
import { LOFI_MOODS } from '../engine/src/lofi-compose.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { isTuneDeclaration } from '../engine/src/tune-provenance.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const register = JSON.parse(readFileSync(resolve(ROOT, 'docs/site/music-genres.json'), 'utf8')) as MusicRegister;
const samples = JSON.parse(readFileSync(resolve(ROOT, 'docs/music/samples.json'), 'utf8')) as SampleSet;
const listed = GENRE_GROUPS.flatMap(g => g.moods);
/** The most the committed samples may weigh together (Andy, 2026-11-15: about 12 MB). */
const SAMPLE_BUDGET = 12.5e6;

test('every genre the picker lists has page copy, and its related genres are real genres', () => {
  assert.deepEqual(registerProblems(register, listed), []);
  assert.equal(new Set(listed).size, LOFI_MOODS.length, 'the picker lists every genre the composer has, once');
});

test('every genre has a readable, unique address', () => {
  const slugs = LOFI_MOODS.map(m => GENRE_SLUG[m]);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(genrePageSlug('dnb'), 'music/drum-and-bass');
});

test('the group headings are the genre picker\'s', () => {
  const picker = readFileSync(resolve(ROOT, 'shells/web/src/views/music-studio/genre-picker.ts'), 'utf8');
  for (const [id, title] of Object.entries(MUSIC_GROUP_TITLE)) {
    assert.ok(picker.includes(`${id}: t('${title}')`), `the picker titles the ${id} group "${title}"`);
  }
  assert.deepEqual(Object.keys(MUSIC_GROUP_TITLE).sort(), GENRE_GROUPS.map(g => g.id).sort());
});

test('each page\'s title and description are written for a search result', () => {
  const descriptions = new Set<string>();
  for (const g of register.genres) {
    assert.match(g.title, /^Free .+ background music generator: make your own, free with credit$/, `${g.id} title`);
    assert.ok(g.description.length >= 110 && g.description.length <= 160, `${g.id} description is ${g.description.length} characters`);
    assert.ok(!descriptions.has(g.description), `${g.id} description is not another genre's`);
    descriptions.add(g.description);
    const all = [g.title, g.description, g.lead, ...g.sound, ...g.uses, ...g.faq.flatMap(q => [q.q, q.a])].join('\n');
    assert.doesNotMatch(all, /copyright[- ]free|royalty[- ]free|no copyright|rights cleared|legally safe/i, `${g.id} keeps to the licence's words`);
  }
});

test('every genre has a sample whose bytes match its recipe, within the size budget', () => {
  const recipes = new Map(samples.samples.map(s => [s.style, s]));
  let total = 0;
  for (const mood of listed) {
    const s = recipes.get(mood);
    assert.ok(s, `${mood} has a sample recipe (node scripts/build-music-samples.ts --search --only=${mood})`);
    assert.equal(s.file, `${GENRE_SLUG[mood]}.m4a`);
    const path = resolve(ROOT, 'docs/music/samples', s.file);
    assert.ok(existsSync(path), `${s.file} is committed`);
    const bytes = readFileSync(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), s.sha256, `${s.file} is the file its recipe rendered`);
    assert.equal(statSync(path).size, s.bytes);
    assert.ok(isTuneDeclaration(s.declaration), `${s.file} declares the music generator`);
    assert.ok((ANCHOR_SECTIONS as readonly string[]).length && s.anchorBar >= 0);
    total += s.bytes;
  }
  assert.ok(total <= SAMPLE_BUDGET, `the samples weigh ${(total / 1e6).toFixed(2)} MB, over the ${SAMPLE_BUDGET / 1e6} MB budget`);
});

test('a sample\'s Content Credentials read back as the music generator\'s, as a download\'s do', async () => {
  // One sample is enough to prove the path; the recipe test above holds every file's
  // declaration as the script read it back when it wrote the file.
  const s = samples.samples.find(x => x.style === 'warm') ?? samples.samples[0]!;
  const report = await verifyC2pa(new Uint8Array(readFileSync(resolve(ROOT, 'docs/music/samples', s.file))));
  assert.equal(report.state, 'valid');
  assert.ok(report.history?.some(h => h.action === 'c2pa.created' && isTuneDeclaration(h.description)), 'the created step declares the music generator');
});

test('the excerpt opens on the first drop, else the groove, else the first verse', () => {
  assert.equal(excerptAnchor(['intro', 'verse', 'build', 'drop', 'drop']), 3);
  assert.equal(excerptAnchor(['intro', 'verse', 'groove', 'feature']), 2);
  assert.equal(excerptAnchor(['intro', 'intro', 'verse']), 2);
  assert.equal(excerptAnchor(['intro']), 0);
});

test('"Make your own" keeps the reader in the genre they came for', () => {
  assert.equal(makeYourOwnHash('lofiHouse', 4, 64), '#/music?style=lofiHouse&seed=4&bars=64&lock=genre');
});

test('the hub answers a newcomer\'s questions in the licence\'s words', () => {
  const md = readFileSync(resolve(ROOT, 'docs/background-music.md'), 'utf8');
  const qs = questionsFromMarkdown(md, 'Questions');
  const asked = qs.map(q => q.q.toLowerCase());
  for (const want of ['free', 'commercially', 'credit', 'copyright-free', 'ai', 'samples', 'file types']) {
    assert.ok(asked.some(q => q.includes(want)), `a question about ${want}`);
  }
  const text = qs.map(q => plainText(q.a)).join('\n');
  assert.ok(text.includes(MUSIC_CREDIT), 'the answers give the credit line');
  assert.doesNotMatch(text, /\bis copyright-free\b|rights cleared|legally safe|royalty-free(?! as long as)/i);
  assert.ok(md.includes('<!-- the genre grid renders here -->'), 'the hub keeps the mark the genre grid replaces');
});
