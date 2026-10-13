// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readResource, RESOURCES, RESOURCE_TEMPLATES } from '../src/resources.ts';

test('MCP discovers overall and actual-profile tool guidance', async () => {
  assert.ok(RESOURCES.some(resource => resource.uri === 'lolly://skill'));
  assert.ok(RESOURCE_TEMPLATES.some(resource => resource.uriTemplate === 'lolly://tool/{id}/skill'));
  const overall = await readResource('lolly://skill');
  assert.match(overall.text!, /reference\/design-system\.md/);
  const reference = await readResource('lolly://skill/reference/design-system.md');
  assert.match(reference.text!, /lolly system import/);
  const qr = JSON.parse((await readResource('lolly://tool/qr-code/skill')).text!);
  const diagrams = JSON.parse((await readResource('lolly://tool/diagram-builder/skill')).text!);
  assert.equal(qr.toolId, 'qr-code');
  assert.equal(diagrams.toolId, 'diagram-builder');
  assert.equal(diagrams.origin, 'authored');
  assert.ok(diagrams.files['skill/workflow.md']);
  assert.notEqual(qr.markdown, diagrams.markdown);
});

test('skill resources cannot escape the packaged skill root', async () => {
  for (const uri of ['lolly://skill/reference/../../package.json', 'lolly://skill/%2e%2e/package.json', 'lolly://tool/../skill']) {
    await assert.rejects(readResource(uri), /Unknown resource/);
  }
});
