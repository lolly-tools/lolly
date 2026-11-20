// SPDX-License-Identifier: MPL-2.0
/**
 * The cascade layer order is stated twice, and the two must agree.
 *
 * styles/app.css declares the order for the stylesheet. index.html declares the
 * same line in the document, ahead of every stylesheet, because a layer is ranked
 * where it is FIRST named: a build that links a view chunk's stylesheet before the
 * main one (both Tauri shells do) otherwise meets `@layer views` first and ranks
 * it lowest. In the 1.2.1 iPhone app that put `views` under `chrome`, so the shared
 * profile button kept its fixed corner pin inside the stage rail and sat half
 * behind it, and the rail's fold never applied.
 *
 * Run directly:
 *   node --test shells/web/src/styles/layer-order-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url)))); // this file lives at src/styles/

const ORDER = /@layer\s+([\w-]+(?:\s*,\s*[\w-]+)+)\s*;/;
const names = (statement: string): string[] => statement.split(',').map((name) => name.trim());

const APP_CSS = readFileSync(join(WEB_DIR, 'src/styles/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const HTML = readFileSync(join(WEB_DIR, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');

test('index.html states the same layer order as app.css', () => {
  const sheet = ORDER.exec(APP_CSS);
  const page = ORDER.exec(HTML);
  assert.ok(sheet, 'styles/app.css declares the layer order');
  assert.ok(page, 'index.html declares the layer order in a <style> of its own');
  assert.deepEqual(names(page[1]!), names(sheet[1]!), 'the two statements list the same layers in the same order');
});

test('the statement comes before anything in the document that can name a layer', () => {
  const at = HTML.search(ORDER);
  const firstSheet = HTML.search(/<link\b[^>]*\brel=["']stylesheet["']/);
  assert.ok(at >= 0 && firstSheet >= 0, 'index.html has the statement and a stylesheet link');
  assert.ok(at < firstSheet, 'the layer order is stated before the first stylesheet link');
  // A build adds its stylesheet links at the end of <head>, and a script can add a
  // <style> while the head parses, so the statement leads the head.
  const before = HTML.slice(HTML.indexOf('<head>'), HTML.lastIndexOf('<style', at));
  assert.doesNotMatch(before, /<script\b|<link\b|<style\b/, 'nothing that loads or runs sits between <head> and the statement');
});
