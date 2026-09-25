// SPDX-License-Identifier: MPL-2.0
/**
 * The licence a person declares for their own export (the export panel's Licence
 * dropdown, `licence=` in a link, `--licence=` on the CLI): which ids are
 * accepted, what notice reaches the file's metadata, and that a tool input bound
 * to the licence field keeps precedence.
 *
 * Run with: node --test tests/output-licence.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { createRuntime } from '../engine/src/runtime.ts';
import { OUTPUT_LICENCE_CHOICES, outputLicenceId, outputLicenceNotice } from '../engine/src/rights-profiles.ts';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.ts';

let seq = 0;
function tool(inputs: unknown[] = [{ id: 'title', type: 'text', default: 'Hello' }]): Parameters<typeof createRuntime>[0] {
  return {
    trustClass: 'catalog',
    manifest: {
      id: `output-licence-${++seq}`, name: 'Output licence', version: '1.0.0',
      engineVersion: '^1.0.0', status: 'official',
      render: { width: 100, height: 100, formats: ['png'] },
      inputs,
    },
    template: '<p>{{title}}</p>',
    styles: null, hooksSource: null, hooksUrl: null,
    textTemplates: {}, textTemplateErrors: {},
  } as unknown as Parameters<typeof createRuntime>[0];
}

function host(renders: Record<string, unknown>[]): Parameters<typeof createRuntime>[1] {
  return {
    version: '1', shell: 'test',
    profile: { get: async () => ({}) },
    log: () => {},
    export: {
      render: async (_node: unknown, _format: string, options: Record<string, unknown>) => {
        renders.push(options);
        return new Blob([new Uint8Array([1])], { type: 'image/png' });
      },
    },
  } as unknown as Parameters<typeof createRuntime>[1];
}

const canvas = (): Element => new JSDOM('<div id="c"><p>Hello</p></div>').window.document.getElementById('c')!;

test('the choices are the CC 4.0 set plus CC0 and the Public Domain Mark, each with a deed link', () => {
  assert.deepEqual(OUTPUT_LICENCE_CHOICES.map((c) => c.id), [
    'CC0-1.0', 'CC-PDM-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-ND-4.0', 'CC-BY-NC-ND-4.0',
  ]);
  for (const c of OUTPUT_LICENCE_CHOICES) assert.match(c.url, /^https:\/\/creativecommons\.org\//);
  assert.equal(outputLicenceNotice('CC-BY-4.0'), 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)');
  assert.equal(outputLicenceNotice(null), '');
  assert.equal(outputLicenceId('MIT'), null, 'only a listed choice is a declaration');
  assert.equal(outputLicenceId({}), null);
});

test('a declared licence reaches the export metadata and the rights context', async () => {
  const renders: Record<string, unknown>[] = [];
  const runtime = await createRuntime(tool(), host(renders));
  assert.equal(runtime.outputLicence(), null, 'no declaration by default');
  await runtime.export(canvas(), 'png', {});
  assert.equal((renders[0]!.meta as { license?: string }).license, undefined, 'nothing is written when none was chosen');

  const undeclared = runtime.rights().fingerprint;
  runtime.setOutputLicence('CC-BY-SA-4.0');
  await runtime.export(canvas(), 'png', {});
  assert.equal((renders[1]!.meta as { license?: string }).license, 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)');
  // The declaration is one of the facts the evaluation is made from.
  assert.notEqual(runtime.rights().fingerprint, undeclared);
  assert.equal(runtime.rights().fingerprint, runtime.rights({ outputLicence: 'CC-BY-SA-4.0' }).fingerprint);
  assert.equal(runtime.rights({ outputLicence: null }).fingerprint, undeclared, 'an explicit context still wins');

  runtime.setOutputLicence('not-a-licence');
  assert.equal(runtime.outputLicence(), null, 'an unknown id clears the declaration');
});

test('a tool input bound to the licence field keeps precedence over the panel', async () => {
  const renders: Record<string, unknown>[] = [];
  const runtime = await createRuntime(tool([
    { id: 'title', type: 'text', default: 'Hello' },
    { id: 'license', type: 'text', default: 'All rights reserved', bindToMeta: 'license' },
  ]), host(renders));
  runtime.setOutputLicence('CC0-1.0');
  await runtime.export(canvas(), 'png', {});
  assert.equal((renders[0]!.meta as { license?: string }).license, 'All rights reserved');
});

test('licence is a reserved link param that round-trips', () => {
  const manifest = tool().manifest as Parameters<typeof parseUrlState>[1];
  const state = parseUrlState('title=Hi&licence=CC-BY-4.0', manifest);
  assert.equal(state.licence, 'CC-BY-4.0');
  assert.equal(state.values.licence, undefined, 'reserved, never an input value');
  assert.equal(new URLSearchParams(serializeUrlState([], { licence: 'CC0-1.0' })).get('licence'), 'CC0-1.0');
  assert.equal(new URLSearchParams(serializeUrlState([], {})).get('licence'), null);
});
