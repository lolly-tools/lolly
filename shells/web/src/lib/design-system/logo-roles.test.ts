// SPDX-License-Identifier: MPL-2.0
// The colour roles a placed logo proposes (plan 320 S1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logoOfferFromRaster, logoOfferFromSvg, logoTextFor } from './logo-roles.ts';

// The study's bakery mark: a white rectangle first, then a red disc with cream
// crumbs, then the wordmark in a dark brown.
const CRUMB = ['#fff', '#C8553D', '#F6E7C8', '#F6E7C8', '#3B2A20'];

test('a mark on a white rectangle leads with its ink, not with the rectangle', () => {
  const offer = logoOfferFromSvg(CRUMB, 'crumb-logo.svg');
  assert.ok(offer);
  assert.equal(offer.main, '#C8553D');
  assert.deepEqual(offer.colours, ['#C8553D', '#F6E7C8', '#3B2A20'], 'white is the canvas, so it is not offered');
});

test('the wordmark colour becomes the text colour when it reads on paper', () => {
  const offer = logoOfferFromSvg(CRUMB)!;
  assert.equal(logoTextFor(offer, offer.main), '#3B2A20');
  // Choosing the brown as the main colour leaves no other dark neutral for text.
  assert.equal(logoTextFor(offer, '#3B2A20'), null);
});

test('a mark with no colour leads with its darkest ink', () => {
  assert.equal(logoOfferFromSvg(['#000000', '#ffffff'])!.main, '#000000');
  assert.equal(logoOfferFromSvg(['#ffffff', '#1a1a1a'])!.main, '#1A1A1A');
});

test('a white-only mark still offers white', () => {
  assert.deepEqual(logoOfferFromSvg(['#ffffff'])!.colours, ['#FFFFFF']);
});

test('nothing readable offers nothing', () => {
  assert.equal(logoOfferFromSvg([]), null);
  assert.equal(logoOfferFromSvg(['not a colour']), null);
  assert.equal(logoOfferFromRaster([]), null);
});

test('a light accent is not text, and a mid grey that fails on white is not either', () => {
  const offer = logoOfferFromSvg(['#0057B8', '#FFD700', '#9a9a9a'])!;
  assert.equal(offer.main, '#0057B8');
  assert.equal(logoTextFor(offer, offer.main), null);
});

test('a raster census drops specks and folds anti-aliased edges into their ink', () => {
  const offer = logoOfferFromRaster([
    { hex: '#ffffff', weight: 5000 },
    { hex: '#c8553d', weight: 3000 },
    { hex: '#c9563e', weight: 200 },   // the same red after compression
    { hex: '#3b2a20', weight: 1500 },
    { hex: '#e0a090', weight: 50 },    // an edge blend, under 3 percent
  ])!;
  assert.equal(offer.main, '#C8553D');
  assert.deepEqual(offer.colours, ['#C8553D', '#3B2A20']);
});

test('the offer never holds more than six colours', () => {
  const many = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6'];
  assert.equal(logoOfferFromSvg(many)!.colours.length, 6);
});
