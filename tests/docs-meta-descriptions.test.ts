// SPDX-License-Identifier: MPL-2.0
/**
 * Per-page social/search descriptions.
 *
 * Every /info page used to ship the same site-wide sentence, so forty different
 * links previewed identically in a search result, a Slack unfurl or a shared
 * card, and told a reader nothing about where the link went. Pages now use their
 * own first sentence (which cannot drift from the docs) or an explicit
 * `description` where that sentence makes a poor preview on its own.
 *
 * This guards the shipped HTML, because that is what a crawler and a chat client
 * actually read.
 *
 * Run directly: node --test tests/docs-meta-descriptions.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUILT = join(new URL('..', import.meta.url).pathname, 'shells/web/public/info');
const pages = existsSync(BUILT) ? readdirSync(BUILT).filter((f) => f.endsWith('.html')) : [];
const skip = pages.length ? false : 'no built /info on disk';

const descOf = (html: string): string | null =>
  /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? null;

const readAll = (): { file: string; desc: string }[] =>
  pages.map((f) => ({ file: f, desc: descOf(readFileSync(join(BUILT, f), 'utf-8')) ?? '' }))
    .filter((p) => p.desc);

test('every built page carries a description', { skip }, () => {
  const missing = pages.filter((f) => {
    const html = readFileSync(join(BUILT, f), 'utf-8');
    // Redirect stubs are meta-refresh shells with no content of their own.
    return !/location\.replace/.test(html) && !descOf(html);
  });
  assert.deepEqual(missing, [], 'a page ships with no description meta');
});

test('descriptions are not all the same site-wide sentence', { skip }, () => {
  // The regression this whole file exists for: one string across every page.
  const all = readAll();
  const unique = new Set(all.map((p) => p.desc));
  assert.ok(unique.size > all.length * 0.6,
    `only ${unique.size} distinct descriptions across ${all.length} pages - they have collapsed to a shared default`);
});

test('descriptions fit a preview without being truncated mid-clause', { skip }, () => {
  // Search results and unfurls cut around 200 characters; under ~60 reads as a
  // fragment rather than a summary.
  const bad = readAll().filter((p) => p.desc.length < 60 || p.desc.length > 200)
    .map((p) => `${p.file} (${p.desc.length})`);
  assert.deepEqual(bad, [], 'description length outside the useful preview range');
});

test('no description describes the document instead of the subject', { skip }, () => {
  // "This document captures…" / "This page covers…" tells a reader nothing about
  // what is IN it, which is the whole job of a preview.
  const meta = readAll().filter((p) => /^(this (document|page|directory|guide)|the following)\b/i.test(p.desc))
    .map((p) => `${p.file}: ${p.desc.slice(0, 60)}`);
  assert.deepEqual(meta, [], 'description is about the document rather than its subject');
});

test('the description, og:description and twitter:description agree', { skip }, () => {
  const mismatched: string[] = [];
  for (const f of pages) {
    const html = readFileSync(join(BUILT, f), 'utf-8');
    const d = descOf(html);
    if (!d) continue;
    const og = /<meta property="og:description" content="([^"]*)"/.exec(html)?.[1];
    const tw = /<meta name="twitter:description" content="([^"]*)"/.exec(html)?.[1];
    if (og !== d || tw !== d) mismatched.push(f);
  }
  assert.deepEqual(mismatched, [], 'a page previews differently on different platforms');
});
