/**
 * Pure-logic tests for the web shell's tree-blocks + reference-picker helpers
 * (shells/web/src/views/block-tree.ts). These guard the drag-to-reparent algebra
 * and the id derivation that keeps a dropdown's stored value resolvable by a
 * tool's hook — the parts most likely to silently corrupt a diagram.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  slugRef,
  deriveBlockKeys,
  nestingActive,
  blockParentIndex,
  blockTreeOrder,
  blockSubtree,
  blockReparentMove,
  buildRefOptions,
  materializeRefTarget,
} from '../shells/web/src/views/block-tree.ts';
import type { ResolvedNestingCfg, BlockRow } from '../shells/web/src/views/block-tree.ts';

const CFG: ResolvedNestingCfg = { parentField: 'parent', keyField: 'nodeId', labelField: 'label', prefix: 'node-' };

// A small tree:  ceo → (cto → (eng, qa)), cfo
const tree = (): BlockRow[] => [
  { nodeId: 'ceo', label: 'CEO', parent: '' },
  { nodeId: 'cto', label: 'CTO', parent: 'ceo' },
  { nodeId: 'eng', label: 'Eng Lead', parent: 'cto' },
  { nodeId: 'qa', label: 'QA Lead', parent: 'cto' },
  { nodeId: 'cfo', label: 'CFO', parent: 'ceo' },
];

test('slugRef mirrors the tool slug (lowercase, hyphenate, trim)', () => {
  assert.equal(slugRef('Eng Lead'), 'eng-lead');
  assert.equal(slugRef('  CEO Office!! '), 'ceo-office');
  assert.equal(slugRef(''), '');
  assert.equal(slugRef(null as any), '');
});

test('deriveBlockKeys prefers nodeId, falls back to label, then ordinal, and dedupes', () => {
  const rows: BlockRow[] = [
    { nodeId: 'ceo', label: 'CEO' },
    { nodeId: '', label: 'Eng Lead' },   // → eng-lead
    { nodeId: '', label: '' },           // → node-3
    { nodeId: '', label: 'Lead' },       // → lead
    { nodeId: '', label: 'Lead' },       // → lead-2 (collision)
  ];
  assert.deepEqual(deriveBlockKeys(rows, CFG), ['ceo', 'eng-lead', 'node-3', 'lead', 'lead-2']);
});

test('deriveBlockKeys matches a tool hook so a stored slug resolves', () => {
  // A picker stores the derived id of the target; the hook later slugs the
  // target's nodeId AND the back-reference, so the two must agree.
  const rows = tree();
  const keys = deriveBlockKeys(rows, CFG);
  assert.equal(keys[2], 'eng'); // referencing 'eng' resolves to row 2
});

test('nestingActive gates on activeWhen with array membership', () => {
  const input: any = { nesting: { activeWhen: { diagramType: ['org', 'mindmap'] } } };
  assert.equal(nestingActive(input, { diagramType: 'org' }), true);
  assert.equal(nestingActive(input, { diagramType: 'mindmap' }), true);
  assert.equal(nestingActive(input, { diagramType: 'process' }), false);
  assert.equal(nestingActive({ nesting: {} } as any, {}), true);   // no activeWhen ⇒ on
  assert.equal(nestingActive({} as any, {}), false);               // no nesting ⇒ off
});

test('blockParentIndex resolves parents and treats unknown/self refs as roots', () => {
  const rows: BlockRow[] = [
    { nodeId: 'a', parent: '' },
    { nodeId: 'b', parent: 'a' },
    { nodeId: 'c', parent: 'ghost' }, // unknown → root
    { nodeId: 'd', parent: 'd' },     // self → root
  ];
  const keys = deriveBlockKeys(rows, CFG);
  assert.deepEqual(blockParentIndex(rows, keys, 'parent'), [-1, 0, -1, -1]);
});

test('blockTreeOrder yields pre-order with depths', () => {
  const rows = tree();
  const keys = deriveBlockKeys(rows, CFG);
  const order = blockTreeOrder(rows, blockParentIndex(rows, keys, 'parent'));
  assert.deepEqual(order.map(e => keys[e.idx]), ['ceo', 'cto', 'eng', 'qa', 'cfo']);
  assert.deepEqual(order.map(e => e.depth), [0, 1, 2, 2, 1]);
});

test('blockTreeOrder is cycle-safe (promotes a cyclic node to a root)', () => {
  const rows: BlockRow[] = [
    { nodeId: 'a', parent: 'b' },
    { nodeId: 'b', parent: 'a' }, // a↔b cycle
  ];
  const keys = deriveBlockKeys(rows, CFG);
  const order = blockTreeOrder(rows, blockParentIndex(rows, keys, 'parent'));
  assert.equal(order.length, 2); // both appear exactly once, no infinite loop
});

test('blockSubtree returns the node and all descendants, pre-order', () => {
  const rows = tree();
  const keys = deriveBlockKeys(rows, CFG);
  const pIdx = blockParentIndex(rows, keys, 'parent');
  assert.deepEqual(blockSubtree(1, pIdx).map(i => keys[i]), ['cto', 'eng', 'qa']);
  assert.deepEqual(blockSubtree(2, pIdx), [2]); // leaf
});

test('reparent INSIDE makes the dragged node a child of the target', () => {
  // Drag CFO (idx 4) inside CTO (idx 1).
  const out = blockReparentMove(tree(), 4, 1, 'inside', CFG)!;
  const keys = deriveBlockKeys(out, CFG);
  const cfo = out[keys.indexOf('cfo')]!;
  assert.equal(slugRef(cfo.parent), 'cto');
  // CFO now sits immediately after CTO in pre-order (first child).
  const order = blockTreeOrder(out, blockParentIndex(out, keys, 'parent')).map(e => keys[e.idx]);
  assert.deepEqual(order, ['ceo', 'cto', 'cfo', 'eng', 'qa']);
});

test('reparent BEFORE makes the dragged node a preceding sibling of the target', () => {
  // Drag QA (idx 3) before CFO (idx 4): QA becomes a child of CEO, before CFO.
  const out = blockReparentMove(tree(), 3, 4, 'before', CFG)!;
  const keys = deriveBlockKeys(out, CFG);
  const qa = out[keys.indexOf('qa')]!;
  assert.equal(slugRef(qa.parent), 'ceo'); // CFO's parent
  const order = blockTreeOrder(out, blockParentIndex(out, keys, 'parent')).map(e => keys[e.idx]);
  assert.deepEqual(order, ['ceo', 'cto', 'eng', 'qa', 'cfo']);
});

test('reparent AFTER lands past the target whole subtree', () => {
  // Drag CFO (idx 4) after CTO (idx 1): CFO is a sibling of CTO, placed after
  // CTO's entire subtree (eng, qa) — not wedged between them.
  const out = blockReparentMove(tree(), 4, 1, 'after', CFG)!;
  const keys = deriveBlockKeys(out, CFG);
  const cfo = out[keys.indexOf('cfo')]!;
  assert.equal(slugRef(cfo.parent), 'ceo'); // CTO's parent
  const order = blockTreeOrder(out, blockParentIndex(out, keys, 'parent')).map(e => keys[e.idx]);
  assert.deepEqual(order, ['ceo', 'cto', 'eng', 'qa', 'cfo']);
});

test('reparent moves the whole subtree, not just the node', () => {
  // Drag CTO (idx 1, with eng+qa) inside CFO (idx 4).
  const out = blockReparentMove(tree(), 1, 4, 'inside', CFG)!;
  const keys = deriveBlockKeys(out, CFG);
  assert.equal(slugRef(out[keys.indexOf('cto')]!.parent), 'cfo');
  const order = blockTreeOrder(out, blockParentIndex(out, keys, 'parent')).map(e => keys[e.idx]);
  assert.deepEqual(order, ['ceo', 'cfo', 'cto', 'eng', 'qa']);
});

test('reparent refuses to drop a node into its own subtree (would orphan it)', () => {
  assert.equal(blockReparentMove(tree(), 1, 2, 'inside', CFG), null); // CTO into eng
  assert.equal(blockReparentMove(tree(), 1, 1, 'inside', CFG), null); // onto self
});

test('buildRefOptions excludes self and descendants for a parent picker', () => {
  const rows = tree();
  const getRows = (id: string): BlockRow[] => (id === 'nodes' ? rows : []);
  const { options } = buildRefOptions({
    of: { input: 'nodes', value: 'nodeId', label: 'label', excludeSelf: true, excludeDescendants: true, emptyLabel: '— Top level —' },
    ownerInputId: 'nodes',
    idx: 1, // CTO — its subtree (cto, eng, qa) must be excluded
    getRows,
    ownerNestingCfg: CFG,
  });
  const values = options.map(o => o.value);
  assert.deepEqual(values, ['ceo', 'cfo']); // not cto/eng/qa
  assert.equal(options.find(o => o.value === 'ceo')!.label, 'CEO');
});

// ── Regression tests for the adversarial-review findings ─────────────────────

test('blockSubtree is cycle-safe (terminates on a 2-cycle parentIdx)', () => {
  // a.parent=b, b.parent=a → parentIdx [1,0]. Must not stack-overflow.
  assert.deepEqual(blockSubtree(0, [1, 0]).sort(), [0, 1]);
  assert.deepEqual(blockSubtree(5, [1, 0]), []); // out-of-range idx
});

test('buildRefOptions does not throw on cyclic owner data (excludeDescendants)', () => {
  const rows: BlockRow[] = [
    { nodeId: 'a', parent: 'b' },
    { nodeId: 'b', parent: 'a' }, // mutual cycle
  ];
  assert.doesNotThrow(() => buildRefOptions({
    of: { input: 'nodes', value: 'nodeId', label: 'label', excludeSelf: true, excludeDescendants: true },
    ownerInputId: 'nodes', idx: 0,
    getRows: (id: string) => (id === 'nodes' ? rows : []),
    ownerNestingCfg: CFG,
  }));
});

test('buildRefOptions tolerates a getRows that returns non-array', () => {
  assert.doesNotThrow(() => buildRefOptions({
    of: { input: 'missing', value: 'nodeId', label: 'label' },
    ownerInputId: 'arrows', idx: 0,
    getRows: () => undefined,
  }));
});

test('blockReparentMove refuses to drop into its own subtree even on cyclic input', () => {
  // a is a real child of b (a.parent=b); b.parent=c, c.parent=b is a side cycle.
  const rows: BlockRow[] = [
    { nodeId: 'a', parent: 'b' },
    { nodeId: 'b', parent: 'c' },
    { nodeId: 'c', parent: 'b' },
  ];
  // Dropping b (idx1) inside a (idx0) — a is b's descendant, so it must be refused.
  assert.equal(blockReparentMove(rows, 1, 0, 'inside', CFG), null);
});

test('drag-to-nest onto a blank-id card anchors the reference durably (no drift)', () => {
  // Two blank cards (no id, no label) — keys are position-derived. After nesting,
  // the reference must still resolve, i.e. the dragged card is a child of the target.
  const rows: BlockRow[] = [{ nodeId: '', label: '' }, { nodeId: '', label: '' }];
  const out = blockReparentMove(rows, 0, 1, 'inside', CFG)!;
  const keys = deriveBlockKeys(out, CFG);
  const pIdx = blockParentIndex(out, keys, 'parent');
  // exactly one root and one child (the drag actually nested something)
  assert.equal(pIdx.filter(p => p === -1).length, 1);
  assert.equal(pIdx.filter(p => p >= 0).length, 1);
  // the target carries an explicit id now (durable across future reorders)
  const targetPos = pIdx.indexOf(-1);
  assert.ok(slugRef(out[targetPos]!.nodeId), 'target nodeId was materialised');
});

test('reparent keeps duplicate-label references unambiguous after reorder', () => {
  // P with two children both labelled "Lead" (ids lead, lead-2). Drag the 2nd Lead
  // inside the 1st. The 1st gets an explicit id so the link survives.
  const rows: BlockRow[] = [
    { nodeId: 'p', label: 'P', parent: '' },
    { nodeId: '', label: 'Lead', parent: 'p' },
    { nodeId: '', label: 'Lead', parent: 'p' },
  ];
  const out = blockReparentMove(rows, 2, 1, 'inside', CFG)!;
  const keys = deriveBlockKeys(out, CFG);
  const pIdx = blockParentIndex(out, keys, 'parent');
  // C2 must be a child of C1 (not of P, not orphaned)
  const c1Pos = out.findIndex(r => r.parent === 'p' && slugRef(r.label) === 'lead');
  const c2 = out.find(r => slugRef(r.parent) !== 'p' && slugRef(r.label) === 'lead');
  assert.ok(c2, 'second Lead exists');
  assert.equal(blockParentIndex(out, keys, 'parent')[out.indexOf(c2!)], c1Pos);
  assert.ok(slugRef(out[c1Pos]!.nodeId), 'first Lead got a durable id');
});

test('materializeRefTarget writes a durable key onto a referenced blank row', () => {
  const rows: BlockRow[] = [{ nodeId: '', label: 'Eng Lead' }, { nodeId: 'qa', label: 'QA' }];
  const out = materializeRefTarget(rows, 'eng-lead', CFG);
  assert.equal(out[0]!.nodeId, 'eng-lead');           // materialised
  assert.equal(out[1]!.nodeId, 'qa');                 // untouched
  // already-explicit / unknown refs are no-ops (same array returned)
  assert.equal(materializeRefTarget(rows, 'qa', CFG), rows);
  assert.equal(materializeRefTarget(rows, 'ghost', CFG), rows);
});

test('buildRefOptions merges multiple sources and dedupes by value', () => {
  const nodes: BlockRow[] = [{ nodeId: 'api', label: 'API' }];
  const layers: BlockRow[] = [{ layerId: 'data', label: 'Data' }, { layerId: 'api', label: 'Dup' }];
  const { options } = buildRefOptions({
    of: { sources: [
      { input: 'nodes', value: 'nodeId', label: 'label' },
      { input: 'layers', value: 'layerId', label: 'label' },
    ] },
    ownerInputId: 'arrows',
    idx: 0,
    getRows: (id: string) => (id === 'nodes' ? nodes : id === 'layers' ? layers : []),
  });
  // 'api' from nodes wins; the layer 'api' dup is dropped; 'data' stays.
  assert.deepEqual(options.map(o => o.value), ['api', 'data']);
});
