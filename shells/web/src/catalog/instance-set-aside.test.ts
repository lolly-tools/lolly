// SPDX-License-Identifier: MPL-2.0
/**
 * An instance whose catalog this build cannot verify (plain case: a release app that
 * someone pointed at a deployment signed by another key). The app used to show no tools
 * and blame the connection. It now sets the instance aside for the page load and loads
 * the catalog built into the app, with a note that says which tools those are.
 *
 * Run directly:  node --test shells/web/src/catalog/instance-set-aside.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tauri.localhost/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { isCatalogTrustFailure, noteInstanceCatalogSetAside } = await import('./integrity.ts');

test('a refused or mismatched catalog is a trust failure, and a network fault is not', () => {
  assert.equal(isCatalogTrustFailure(new Error('Catalog refused: signature does not verify against the pinned key')), true);
  assert.equal(isCatalogTrustFailure(new Error('catalog integrity: tool index rejected - hash mismatch')), true);
  assert.equal(isCatalogTrustFailure(new TypeError('Failed to fetch')), false);
  assert.equal(isCatalogTrustFailure(new Error('The catalog exceeds the 16 MiB limit')), false);
  assert.equal(isCatalogTrustFailure('Catalog refused: text only'), false);
});

test('the note says which instance was set aside and that the built-in tools are shown', () => {
  noteInstanceCatalogSetAside('https://lolly.example.org/team');
  const note = document.getElementById('lolly-instance-set-aside');
  assert.ok(note);
  assert.equal(note.getAttribute('role'), 'status');
  assert.match(note.textContent ?? '', /^lolly\.example\.org signs its tools with a key this app does not trust\./);
  assert.match(note.textContent ?? '', /tools built into this app/);
  assert.equal(document.documentElement.dataset.catalogInstance, 'set-aside');
  // It is not the refusal state: the bundled catalog verified and tools are on screen.
  assert.notEqual(document.documentElement.dataset.catalogTrust, 'refused');
});

test('sync sets the instance aside only on a trust failure and tries the bundled catalog once', () => {
  const source = readFileSync(new URL('./sync.ts', import.meta.url), 'utf8');
  const branch = source.slice(source.indexOf('if (isCatalogTrustFailure(e) && getInstanceBase())'));
  assert.ok(branch.length < source.length, 'the fallback branch is present');
  const body = branch.slice(0, branch.indexOf('noteCatalogIntegrityFailure(e)'));
  assert.match(body, /suspendInstanceBase\(\)/);
  assert.match(body, /noteInstanceCatalogSetAside\(setAside\)/);
  assert.match(body, /return syncCatalog\(host, onAssetsReady, maintenanceGate, signInRequired\)/);
  // The retry runs with no instance in use, so a second refusal cannot loop.
  assert.match(readFileSync(new URL('../lib/instance.ts', import.meta.url), 'utf8'), /if \(was\) \{ suspended = was; base = ''; instanceSession = null; \}/);
});
