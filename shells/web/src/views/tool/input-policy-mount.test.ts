// SPDX-License-Identifier: MPL-2.0
/**
 * The tool view announces its mount to the generic input-policy seam BEFORE the
 * sidebar's first render, so whoever governs inputs (src/org/ on a governed
 * instance) has swapped this tool's policy in by the time a control is built.
 *
 * A source pin, because the wire went missing once: from 2026-07-21 to 2026-09-12
 * src/org/index.ts's applyOrgToolPolicies had no caller anywhere, its own comment
 * said "called by the tool view when a tool mounts", and every lock a control
 * plane declared rendered as an editable control. Reads the whole feature
 * (orchestrator plus its modules), per the closure-split rule.
 *
 * Run directly:  node --test shells/web/src/views/tool/input-policy-mount.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = import.meta.dirname;
const FEATURE = [
  readFileSync(resolve(DIR, '..', 'tool.ts'), 'utf8'),
  ...readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort()
    .map((f) => readFileSync(resolve(DIR, f), 'utf8')),
].join('\n');
const SETUP = readFileSync(resolve(DIR, 'setup.ts'), 'utf8');

test('the mount is announced through lib/input-policy, before the runtime exists', () => {
  assert.match(SETUP, /import \{ notifyToolInputMount(?:, [^}]*)? \} from '\.\.\/\.\.\/lib\/input-policy\.ts';/);
  const announce = SETUP.indexOf('notifyToolInputMount(toolId);');
  const runtime = SETUP.indexOf('await createRuntime(');
  assert.ok(announce > 0, 'setup.ts announces the mount');
  assert.ok(runtime > announce, 'the announcement precedes the runtime, and so every render');
});

test('the sidebar sync passes the tool id, so the renderer can look the policy up at all', () => {
  // getInputPolicy(undefined, id) answers undefined: a sync that omits the id
  // renders every governed control as editable, whatever the registry holds.
  const call = SETUP.match(/tview\.prevInputsModel = syncInputs\(([^;]*)\);/);
  assert.ok(call, 'the runtime subscription syncs the sidebar');
  assert.match(call![1]!, /,\s*tview\.toolId\s*$/, 'the last argument is the mounted tool id');
});

test('a locked value reaches the runtime once it exists, so canvas, session and link agree with the control', () => {
  const apply = SETUP.indexOf('policyValuesFor(toolId, runtime.getModel()');
  const runtime = SETUP.indexOf('await createRuntime(');
  assert.ok(apply > runtime && runtime > 0, 'applied right after the runtime is created');
  assert.match(SETUP, /await runtime\.applyPatch\(policyValues\);\s*await runtime\.resolveRefs\(\);/);
});

test('the other sidebar hosts pass a tool id too: bulk editing and the embed child editor', () => {
  const multi = readFileSync(resolve(DIR, '..', 'multi-edit.ts'), 'utf8');
  assert.match(multi, /notifyToolInputMount\(members\[0\]\.tool\.manifest\.id\)/, 'bulk editing announces its mount');
  assert.match(multi, /syncInputs\(m\.panelEl, model, m\.panelModel, rt, host, \(\) => \{ m\.dirty = true; \}, m\.tool\.manifest\.id\)/, 'each card syncs with its own tool id');
  assert.match(multi, /syncInputs\(sharedPanel,[^;]*,\s*sharedToolId\)/, 'the shared panel syncs with the one shared tool id');
  const inputs = readFileSync(resolve(DIR, '..', 'tool-inputs.ts'), 'utf8');
  assert.match(inputs, /syncInputs\(inputsEl, model, prevModel, child, host, \(\) => \{\}, child\.manifest\.id\)/, 'the embed child editor syncs with the child tool id');
});

test('the tool view stays control-plane-unaware: it never imports the org installer', () => {
  assert.doesNotMatch(FEATURE, /applyOrgToolPolicies/);
  assert.doesNotMatch(FEATURE, /from '\.\.\/(\.\.\/)?org\/index\.ts'/);
});
