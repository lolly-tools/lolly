// SPDX-License-Identifier: MPL-2.0
// The tool loader's "is this the SPA shell instead of the file?" classifier. It
// must be decided on content: Tauri's asset resolver labels every text file whose
// extension it does not know (.md, .ics, .vcf) `text/html`, so a header check
// rejected chart's real template.md and the verified loader failed closed on iOS
// (2026-09-08). These pin the contract from both sides - a genuine HTML document
// is caught however it is dressed, and no legitimate tool-file body is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeHtmlDocument, looksLikeHtmlDocumentBytes } from './tool-file-guard.ts';

test('the bytes variant classifies pinned/bundled bodies the same way, and never a binary asset', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  assert.equal(looksLikeHtmlDocumentBytes(enc('<!doctype html><html></html>')), true, 'the shell as bytes');
  assert.equal(looksLikeHtmlDocumentBytes(enc('{{{_data.ics}}}')), false, 'a sibling template as bytes');
  assert.equal(looksLikeHtmlDocumentBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), false, 'a PNG header');
  assert.equal(looksLikeHtmlDocumentBytes(new Uint8Array([0x77, 0x4f, 0x46, 0x32])), false, 'a WOFF2 header');
  assert.equal(looksLikeHtmlDocumentBytes(new Uint8Array(0)), false, 'empty');
});

test('the SPA index.html fallback is recognised as an HTML document', () => {
  assert.equal(looksLikeHtmlDocument('<!doctype html><html lang="en"><head></head><body></body></html>'), true);
  assert.equal(looksLikeHtmlDocument('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">'), true, 'case-insensitive');
  assert.equal(looksLikeHtmlDocument('<html lang="en"><body></body></html>'), true, 'a doctype-less document');
  assert.equal(looksLikeHtmlDocument('﻿\n  \t<!doctype html>'), true, 'BOM and leading whitespace are skipped');
});

test('the real bytes of every sibling text template are NOT mistaken for the shell', () => {
  // The exact stubs that failed to load on iOS - chart and timezone.
  assert.equal(looksLikeHtmlDocument('{{{mdSource}}}\n'), false, 'chart/template.md');
  assert.equal(looksLikeHtmlDocument('{{{_data.ics}}}'), false, 'timezone/template.ics');
  assert.equal(looksLikeHtmlDocument('{{{_data.csv}}}\n'), false, 'timezone/template.csv');
  assert.equal(looksLikeHtmlDocument('{{{_data.markdown}}}\n'), false, 'timezone/template.md');
  // Rendered-shaped text templates a tool may ship in full.
  assert.equal(looksLikeHtmlDocument('BEGIN:VCALENDAR\nVERSION:2.0\n'), false, 'a real .ics body');
  assert.equal(looksLikeHtmlDocument('BEGIN:VCARD\nFN:{{name}}\n'), false, 'a real .vcf body');
  assert.equal(looksLikeHtmlDocument('name,city\n{{name}},{{city}}\n'), false, 'a real .csv body');
  assert.equal(looksLikeHtmlDocument('# {{title}}\n\nBody.\n'), false, 'a real .md body');
});

test('the other tool files the loader fetches are never classified as the shell', () => {
  assert.equal(looksLikeHtmlDocument('{"id":"chart","name":"Chart"}'), false, 'tool.json');
  assert.equal(looksLikeHtmlDocument('.tool-canvas { color: red; }'), false, 'styles.css');
  assert.equal(looksLikeHtmlDocument('return { onInit() { return {}; } };'), false, 'hooks.js');
  assert.equal(looksLikeHtmlDocument(''), false, 'an empty body');
});

test('template.html itself is an HTML document - the caller excludes it by extension, not this predicate', () => {
  // Documents the division of labour: the predicate answers the content question
  // only; makeFetchFile skips the check for *.html paths, so this true is correct.
  assert.equal(looksLikeHtmlDocument('<!doctype html><div class="tool-canvas">{{title}}</div>'), true);
});
