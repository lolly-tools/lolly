// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelsBaseOverride } from './models-base.ts';

test('an empty body means this server', () => {
  assert.equal(parseModelsBaseOverride(''), '');
  assert.equal(parseModelsBaseOverride('\n'), '');
});

test('an https origin is accepted and a trailing slash is dropped', () => {
  assert.equal(parseModelsBaseOverride('https://models.example.org/\n'), 'https://models.example.org');
  assert.equal(parseModelsBaseOverride('https://models.example.org:8443'), 'https://models.example.org:8443');
});

test('anything else keeps the build-time value', () => {
  for (const body of ['<!doctype html><html></html>', 'http://models.example.org', 'https://a.example.org/path', 'https://*.example.org', 'javascript:alert(1)']) {
    assert.equal(parseModelsBaseOverride(body), undefined, body);
  }
});
