// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the shared OPC docProps/core.xml shape written by both pptx.ts and
 * docx.ts: the 'Lolly' fallback when no author opted in, the "both authors"
 * rule from plans/144 G6 (source first, joined with "; ", only when the names
 * actually differ), and that every field is XML-escaped so a title or author
 * containing markup characters can't break the package.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { corePropsXml, type OoxmlCoreMeta } from '../engine/src/ooxml-props.ts';

const NOW = '2026-09-12T00:00:00Z';

test('with no meta at all, title falls back and creator/lastModifiedBy fall back to Lolly', () => {
  const xml = corePropsXml(null, NOW, 'Document');
  assert.match(xml, /<dc:title>Document<\/dc:title>/);
  assert.match(xml, /<dc:creator>Lolly<\/dc:creator>/);
  assert.match(xml, /<cp:lastModifiedBy>Lolly<\/cp:lastModifiedBy>/);
  assert.doesNotMatch(xml, /<dc:description>/);
});

test('an opted-in author name is used for both dc:creator and cp:lastModifiedBy', () => {
  const meta: OoxmlCoreMeta = { author: 'Ada Lovelace' };
  const xml = corePropsXml(meta, NOW, 'Document');
  assert.match(xml, /<dc:creator>Ada Lovelace<\/dc:creator>/);
  assert.match(xml, /<cp:lastModifiedBy>Ada Lovelace<\/cp:lastModifiedBy>/);
});

test('a different source author is joined before the current author with "; ", but lastModifiedBy stays the current actor', () => {
  const meta: OoxmlCoreMeta = { author: 'Ada Lovelace', sourceAuthor: 'Charles Babbage' };
  const xml = corePropsXml(meta, NOW, 'Document');
  assert.match(xml, /<dc:creator>Charles Babbage; Ada Lovelace<\/dc:creator>/);
  assert.match(xml, /<cp:lastModifiedBy>Ada Lovelace<\/cp:lastModifiedBy>/);
});

test('a source author identical to the current author (case-insensitive, ignoring surrounding whitespace) collapses to one name', () => {
  const meta: OoxmlCoreMeta = { author: 'Ada Lovelace', sourceAuthor: '  ADA LOVELACE  ' };
  const xml = corePropsXml(meta, NOW, 'Document');
  assert.match(xml, /<dc:creator>Ada Lovelace<\/dc:creator>/);
});

test('a source author with no current author is used alone as the creator, but lastModifiedBy still falls back to Lolly', () => {
  const meta: OoxmlCoreMeta = { sourceAuthor: 'Charles Babbage' };
  const xml = corePropsXml(meta, NOW, 'Document');
  assert.match(xml, /<dc:creator>Charles Babbage<\/dc:creator>/);
  assert.match(xml, /<cp:lastModifiedBy>Lolly<\/cp:lastModifiedBy>/);
});

test('description joins description/contact/source with a middle dot, and is omitted entirely when all three are absent', () => {
  const xml = corePropsXml({ description: 'A memo', contact: 'ada@example.com', source: 'lolly.tools' }, NOW, 'Document');
  assert.match(xml, /<dc:description>A memo · ada@example\.com · lolly\.tools<\/dc:description>/);
});

test('title, description and author fields are XML-escaped', () => {
  const xml = corePropsXml({ title: 'A & B <C>', author: '"Quoted" Name' }, NOW, 'Fallback');
  assert.match(xml, /<dc:title>A &amp; B &lt;C&gt;<\/dc:title>/);
  assert.match(xml, /<dc:creator>&quot;Quoted&quot; Name<\/dc:creator>/);
});

test('the created and modified timestamps both echo the supplied `now` value verbatim', () => {
  const xml = corePropsXml(null, NOW, 'Document');
  assert.match(xml, new RegExp(`<dcterms:created xsi:type="dcterms:W3CDTF">${NOW}</dcterms:created>`));
  assert.match(xml, new RegExp(`<dcterms:modified xsi:type="dcterms:W3CDTF">${NOW}</dcterms:modified>`));
});
