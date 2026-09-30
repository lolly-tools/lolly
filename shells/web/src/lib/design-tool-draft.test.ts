// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { designToolPolicy, evaluateDesignTool, validateDesignTool, validateDesignValues } from '@lolly-tools/core/design-tool-v1';
import { makeDesignInput, newDesignToolDraft } from './design-tool-draft.ts';
import { editDesignRule } from '../views/design-rules-fields.ts';

test('exposing content preserves full defaults, uses compact text and reopens an existing binding', () => {
  const draft = newDesignToolDraft([{ id:'board', label:'Board', width:640, height:480, background:'#ffffff', boxes:[
    { id:'heading', name:'Heading', text:'Meetup', kind:'text', fg:'#123456' },
    { id:'copy', name:'Copy', text:'First line\nSecond line', kind:'text' },
    { id:'long', name:'Long copy', text:'x'.repeat(350), kind:'text' },
  ] }]);
  const heading = makeDesignInput(draft, 'heading', 'text')!;
  assert.equal(heading.input.type, 'text');
  assert.equal(makeDesignInput(draft, 'copy', 'text')!.input.type, 'longtext');
  const long = makeDesignInput(draft, 'long', 'text')!;
  assert.equal(long.input.maxLength, 350); assert.equal(String(long.input.default).length, 350);
  assert.equal(makeDesignInput(draft, 'heading', 'text'), heading); assert.equal(draft.inputs.length, 3);
  editDesignRule(heading, 'control', 'longtext'); assert.equal(heading.input.default, 'Meetup');
  editDesignRule(heading, 'control', 'text'); assert.equal(heading.input.default, 'Meetup');
});

test('colour inputs keep their property target and enforce approved values', () => {
  const draft = newDesignToolDraft([{ id:'board', label:'Board', width:640, height:480, background:'#ffffff', boxes:[{ id:'shape', name:'Badge', kind:'shape', fill:'#123456' }] }]);
  const field = makeDesignInput(draft, 'shape', 'fill')!;
  field.input.type = 'select'; field.input.options = [{ value:'#123456', label:'Ink' }, { value:'#abcdef', label:'Sky' }]; field.approved = ['#123456','#abcdef'];
  assert.deepEqual(validateDesignTool(draft), []);
  assert.equal(evaluateDesignTool(draft, { [field.input.id]:'#abcdef' }).variant.boxes[0]!.fill, '#abcdef');
  assert.ok(validateDesignValues(designToolPolicy(draft), { [field.input.id]:'#ffffff' }).some(issue => issue.inputId === field.input.id));
});
