// SPDX-License-Identifier: MPL-2.0
// The name a logo's own words suggest (plan 320 S5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { logoWords } from './logo-words.ts';

const parser = new new JSDOM('').window.DOMParser();
const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160">${body}</svg>`;

test('the first live text run is the name, with its spacing tidied', () => {
  assert.equal(logoWords(svg('<rect width="480" height="160" fill="#fff"/><text x="160" y="96">Crumb &amp;  Co</text><text y="140">BAKERY SINCE 1990</text>'), parser), 'Crumb & Co');
  assert.equal(logoWords(svg('<text><tspan>North</tspan><tspan>wind</tspan></text>'), parser), 'Northwind');
});

test('a title stands in when the lettering is outlined', () => {
  assert.equal(logoWords(svg('<title>Halcyon Group</title><path d="M0 0h10v10z"/>'), parser), 'Halcyon Group');
});

test('outlines alone, a paragraph or a broken file give nothing', () => {
  assert.equal(logoWords(svg('<path d="M0 0h10v10z"/>'), parser), '');
  assert.equal(logoWords(svg(`<text>${'word '.repeat(20)}</text>`), parser), '');
  assert.equal(logoWords('<svg><text>unclosed', parser), '');
});
