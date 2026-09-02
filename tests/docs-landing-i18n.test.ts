// SPDX-License-Identifier: MPL-2.0
/**
 * The landing is data (plans/177 P4): docs/site/{hero-chrome,covers,whatwhy,
 * persona,behind}.json, rendered by docs/build.ts and localised through the
 * site catalogue by `localizeSiteJson` - every copy string is a t() key, and the
 * keys named in LANDING_I18N_SKIP are routes, slugs, file names and code that
 * must never reach a translator.
 *
 * Two halves have to agree and live in different repos: build.ts (the docs
 * submodule) applies the skip list when it RENDERS; scripts/translate.ts (the
 * parent) applies its own copy when it EXTRACTS the site corpus. A key added
 * to one list but not the other fails silently in one of two ways - a route
 * sent to a translator, or a sentence that never becomes a pending key and
 * ships English in 26 locales without anyone noticing. So this pins the two
 * lists, the file list, and the end-to-end property: every copy string in the
 * five files is a key the site corpus extracts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sliceDataLiteral, extractSiteKeys, landingJsonStrings, LANDING_SITE_JSON, LANDING_I18N_SKIP,
} from '../scripts/translate.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildTs = readFileSync(resolve(repoRoot, 'docs/build.ts'), 'utf8');

function evalLiteral<T>(text: string): T { return new Function(`return (${text});`)() as T; }

test('build.ts and translate.ts carry the same LANDING_I18N_SKIP list', () => {
  const inBuild = evalLiteral<string[]>(sliceDataLiteral(buildTs, /\bconst\s+LANDING_I18N_SKIP\s*=/, 'LANDING_I18N_SKIP'));
  assert.deepEqual([...inBuild].sort(), [...LANDING_I18N_SKIP].sort(),
    'the render-side skip list (docs/build.ts) and the extract-side one (scripts/translate.ts) drifted');
  // The list must stay a list of KEY NAMES, never copy.
  for (const k of inBuild) assert.match(k, /^[a-z]+$/, `skip entry "${k}" does not look like a JSON key`);
});

test('every landing beat file exists and build.ts reads exactly those files', () => {
  for (const name of LANDING_SITE_JSON) {
    assert.ok(existsSync(resolve(repoRoot, 'docs/site', name)), `docs/site/${name} is missing`);
  }
  const read = [...buildTs.matchAll(/loadLandingJson<[^>]+>\('([a-z-]+\.json)'\)/g)].map((m) => m[1]!);
  assert.deepEqual([...new Set(read)].sort(), [...LANDING_SITE_JSON].sort(),
    'build.ts reads a different set of landing files than translate.ts walks - add the file to LANDING_SITE_JSON (translate.ts) or stop reading it');
});

test('every copy string in the landing files is a site-corpus key', () => {
  const keys = new Set(extractSiteKeys());
  for (const name of LANDING_SITE_JSON) {
    const data = JSON.parse(readFileSync(resolve(repoRoot, 'docs/site', name), 'utf8'));
    const strings = landingJsonStrings(data);
    assert.ok(strings.length >= 3, `docs/site/${name} yielded only ${strings.length} copy strings`);
    for (const s of strings) assert.ok(keys.has(s), `docs/site/${name} copy is not a site key: ${s}`);
  }
});

test('the skipped keys hold routes, slugs and code - never a sentence', () => {
  // A skipped value with a space and a capital letter is a sentence someone
  // put under the wrong key: it would ship untranslated in 26 locales.
  const walk = (value: unknown, key: string, out: Array<[string, string]>): void => {
    if (typeof value === 'string') { if (LANDING_I18N_SKIP.includes(key)) out.push([key, value]); }
    else if (Array.isArray(value)) for (const v of value) walk(v, key, out);
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, k, out);
  };
  for (const name of LANDING_SITE_JSON) {
    const data = JSON.parse(readFileSync(resolve(repoRoot, 'docs/site', name), 'utf8'));
    const skipped: Array<[string, string]> = [];
    walk(data, '', skipped);
    for (const [key, value] of skipped) {
      assert.ok(!/^[A-Z][a-z]+ [a-z]+ [a-z]+/.test(value),
        `docs/site/${name}: "${key}" holds what reads like copy ("${value}") - it is on the skip list and will never be translated`);
    }
  }
});
