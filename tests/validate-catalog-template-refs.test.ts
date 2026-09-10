// SPDX-License-Identifier: MPL-2.0
/**
 * Brand-curated template refs (plans/226 section 4.6 / WP-5).
 *
 * `catalog/assets/index.json` gains a top-level `defaultHiddenTemplates`: the
 * shipped starters a fresh profile does not see until it asks for them, one
 * `"<toolId>:<tid>"` ref each. It lives in the ASSET index rather than the tool
 * index for the same reason `defaultHiddenTools` does - that file is per-brand,
 * hand-maintained and round-trips its top-level keys through checksum-assets,
 * while the tool index is regenerated from the manifests every build.
 *
 * Nothing notices a bad ref at runtime: it simply hides nothing. So the rules are
 * a validator's job, and they live in scripts/lib/template-refs.ts as pure
 * functions this file can drive without running the whole script (the same shape
 * as scripts/lib/canvas-refs.ts and tests/canvas-schema-contract.test.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defaultHiddenTemplateErrors,
  reservedTemplateToolIdError,
  USER_TEMPLATE_REF_PREFIX,
} from '../scripts/lib/template-refs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A view holding one tool with one template, which is all the rules need. */
const LOOK = {
  hasTool: (id: string) => id === 'chart' || id === 'design',
  hasTemplateFile: (toolId: string, tid: string) => toolId === 'chart' && tid === 'revenue',
};

// ─── defaultHiddenTemplates ───────────────────────────────────────────────────

test('an absent or empty defaultHiddenTemplates is fine', () => {
  assert.deepEqual(defaultHiddenTemplateErrors(undefined, LOOK), []);
  assert.deepEqual(defaultHiddenTemplateErrors([], LOOK), []);
});

test('a ref naming a template that exists passes', () => {
  assert.deepEqual(defaultHiddenTemplateErrors(['chart:revenue'], LOOK), []);
});

test('the value has to be an array of refs', () => {
  const errors = defaultHiddenTemplateErrors('chart:revenue', LOOK);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /must be an array of template refs/);
});

test('a ref that is not "<toolId>:<templateId>" is refused', () => {
  for (const ref of ['revenue', 'chart:', ':revenue', 'chart:revenue:extra']) {
    const errors = defaultHiddenTemplateErrors([ref], LOOK);
    assert.equal(errors.length, 1, `expected one error for ${JSON.stringify(ref)}`);
    assert.match(errors[0] ?? '', /must be "<toolId>:<templateId>"/);
  }
  const notAString = defaultHiddenTemplateErrors([42, ''], LOOK);
  assert.equal(notAString.length, 2);
  for (const message of notAString) assert.match(message, /must be a template ref/);
});

test('a ref into a tool this profile does not mount names the tool in the error', () => {
  const errors = defaultHiddenTemplateErrors(['street-map:city-poster'], LOOK);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /names tool "street-map", which is not a tool in this profile/);
});

test('a ref whose template file does not exist points at the missing path', () => {
  const errors = defaultHiddenTemplateErrors(['chart:quarterly'], LOOK);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /tools\/chart\/templates\/quarterly\.json does not exist/);
});

test('a brand cannot hide one of the person\'s own templates', () => {
  const errors = defaultHiddenTemplateErrors([`${USER_TEMPLATE_REF_PREFIX}:abc123`], LOOK);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /a brand can only hide the starters it ships/);
});

test('a ref listed twice is reported once, and the rest of the list is still checked', () => {
  const errors = defaultHiddenTemplateErrors(['chart:revenue', 'chart:revenue', 'chart:nope'], LOOK);
  assert.equal(errors.length, 2);
  assert.match(errors[0] ?? '', /lists "chart:revenue" twice/);
  assert.match(errors[1] ?? '', /chart\/templates\/nope\.json does not exist/);
});

// ─── the reserved tool id ─────────────────────────────────────────────────────

test('a tool may not take the id "user" - the ref prefix', () => {
  const message = reservedTemplateToolIdError(USER_TEMPLATE_REF_PREFIX);
  assert.ok(message, 'a tool called "user" must be refused');
  assert.match(message, /Rename the tool/);
});

test('every other tool id is fine', () => {
  for (const id of ['users', 'user-guide', 'chart', 'design', 'User']) {
    assert.equal(reservedTemplateToolIdError(id), null, id);
  }
});

// ─── wiring ───────────────────────────────────────────────────────────────────

test('validate-catalog runs both rules (they are not dead code)', () => {
  const src = readFileSync(join(ROOT, 'scripts/validate-catalog.ts'), 'utf8');
  assert.match(src, /defaultHiddenTemplateErrors\(assetsIndex\.defaultHiddenTemplates/);
  assert.match(src, /reservedTemplateToolIdError\(manifest\.id\)/);
});

test('both brand packs carry the key, so a curator can see it', () => {
  for (const brand of ['suse', 'lolly-start']) {
    const path = join(ROOT, `brands/${brand}/catalog/assets/index.json`);
    const index = JSON.parse(readFileSync(path, 'utf8')) as { defaultHiddenTemplates?: unknown };
    assert.ok(
      Array.isArray(index.defaultHiddenTemplates),
      `brands/${brand}/catalog/assets/index.json should declare defaultHiddenTemplates as an array`,
    );
  }
});
