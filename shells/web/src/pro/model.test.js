/**
 * Unit tests for the pure /pro batch-grid model logic.
 * Run directly:  node --test shells/web/src/pro/model.test.js
 *
 * These live next to the feature (not in the repo-root tests/ suite) so the
 * whole /pro module — tests included — can be removed in one delete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveColumns, constraintSignature, cellInput, isCellEditable, bulkTargets,
} from './model.js';

const TOOLS = {
  poster: {
    inputs: [
      { id: 'headline', label: 'Headline', type: 'text', maxLength: 60 },
      { id: 'size', label: 'Size', type: 'number', min: 10, max: 100 },
      { id: 'logo', label: 'Logo', type: 'asset' },
    ],
  },
  // Shares headline (same constraints) and size (DIFFERENT min/max) with poster.
  banner: {
    inputs: [
      { id: 'headline', label: 'Headline', type: 'text', maxLength: 60 },
      { id: 'size', label: 'Size', type: 'number', min: 0, max: 10 },
      { id: 'cta', label: 'Call to action', type: 'text' },
    ],
  },
  // 'headline' here is a number — a type clash with the text headline elsewhere.
  oddball: {
    inputs: [{ id: 'headline', label: 'Headline', type: 'number' }],
  },
};

const row = (toolId) => ({ toolId, manifest: TOOLS[toolId] });

test('union of inputs becomes columns in first-seen order', () => {
  const cols = deriveColumns([row('poster'), row('banner')]);
  assert.deepEqual(cols.map(c => c.key), ['headline', 'size', 'logo', 'cta']);
});

test('reserved-named inputs (width/height/unit/dpi/…) get no column', () => {
  // These collide with the fixed dimension columns / reserved URL params and are
  // fed by the export-dimension flow — so they must not duplicate as columns.
  const dimTool = {
    inputs: [
      { id: 'width',  label: 'Width',  type: 'number' },
      { id: 'height', label: 'Height', type: 'number' },
      { id: 'unit',   label: 'Unit',   type: 'select' },
      { id: 'dpi',    label: 'DPI',    type: 'number' },
      { id: 'palette', label: 'Palette', type: 'select' },
    ],
  };
  const cols = deriveColumns([{ toolId: 'chart', manifest: dimTool }]);
  assert.deepEqual(cols.map(c => c.key), ['palette']);
});

test('a shared input with identical constraints is bulk-writable', () => {
  const cols = deriveColumns([row('poster'), row('banner')]);
  const headline = cols.find(c => c.key === 'headline');
  assert.equal(headline.bulk, true);
  assert.equal(headline.members.size, 2);
});

test('a shared input with different min/max is NOT bulk-writable', () => {
  const cols = deriveColumns([row('poster'), row('banner')]);
  const size = cols.find(c => c.key === 'size');
  assert.equal(size.bulk, false);
  assert.match(size.reason, /constrain this field differently/);
});

test('same id with different types is mixed and not bulk', () => {
  const cols = deriveColumns([row('poster'), row('oddball')]);
  const headline = cols.find(c => c.key === 'headline');
  assert.equal(headline.type, 'mixed');
  assert.equal(headline.bulk, false);
});

test('selecting the same template twice collapses to one member per column', () => {
  const cols = deriveColumns([row('poster'), row('poster')]);
  const headline = cols.find(c => c.key === 'headline');
  assert.equal(headline.members.size, 1);
  assert.equal(headline.bulk, true);
});

test('cellInput is null for a tool lacking the column (→ greyed cell)', () => {
  const cols = deriveColumns([row('poster'), row('banner')]);
  const cta = cols.find(c => c.key === 'cta');
  assert.equal(cellInput(cta, row('poster')), null);     // poster has no cta
  assert.ok(cellInput(cta, row('banner')));              // banner does
});

test('asset cells are editable only when an asset picker is available', () => {
  const cols = deriveColumns([row('poster')]);
  const logo = cols.find(c => c.key === 'logo');
  assert.equal(isCellEditable(logo, row('poster'), { assetPicker: false }), false);
  assert.equal(isCellEditable(logo, row('poster'), { assetPicker: true }), true);
});

test('bulkTargets returns only rows whose tool has an editable cell', () => {
  const rows = [row('poster'), row('banner'), row('oddball')];
  const cols = deriveColumns(rows);
  const headline = cols.find(c => c.key === 'headline');
  // oddball's headline is a number (type clash) but per-cell it is still a
  // valid editable number cell, so it IS a target for its own column membership.
  const targets = bulkTargets(headline, rows);
  assert.equal(targets.length, 3);
});

test('constraintSignature ignores label/default but captures constraints', () => {
  const a = constraintSignature({ id: 'x', label: 'A', type: 'text', maxLength: 60, default: 'hi' });
  const b = constraintSignature({ id: 'x', label: 'B', type: 'text', maxLength: 60, default: 'yo' });
  const c = constraintSignature({ id: 'x', label: 'A', type: 'text', maxLength: 10 });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('empty / manifest-less rows contribute no columns', () => {
  assert.deepEqual(deriveColumns([{ toolId: '', manifest: null }]), []);
  assert.deepEqual(deriveColumns([]), []);
});
