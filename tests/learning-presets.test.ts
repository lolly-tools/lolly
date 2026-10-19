// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEARNING_TARGETS } from '../engine/src/learning/delivery.ts';
import {
  LEARNING_PRESETS,
  LEARNING_PRESET_TESTED_CHECKS,
  learningPresetByRef,
  learningPresetChoices,
  learningPresetFor,
  learningPresetRef,
  learningPresetStatus,
  learningPresetTarget,
  parseLearningPresets,
  type LearningPreset,
} from '../engine/src/learning/presets.ts';
import registry from '../engine/src/learning/lms-presets.json' with { type: 'json' };

const ROOT = new URL('..', import.meta.url).pathname;
const clone = () =>
  structuredClone(registry) as { schemaVersion: number; presets: Record<string, unknown>[] };
const withPreset = (preset: Record<string, unknown>) => {
  const value = clone();
  value.presets.push(preset);
  return value;
};
const named = (fields: Record<string, unknown> = {}) => ({
  id: 'example-lms-scorm12',
  version: 1,
  name: 'Example LMS',
  generic: false,
  aliases: [],
  target: 'scorm12',
  launch: null,
  limits: { packageMB: null, stateChars: null },
  media: null,
  instructions: 'Upload the unopened ZIP as a SCORM 1.2 package.',
  documentation: null,
  evidence: [],
  ...fields,
});
const fullRun = {
  environment: 'Example LMS 4.2',
  testedAt: '2026-10-01',
  checks: [...LEARNING_PRESET_TESTED_CHECKS, 'review'],
  record: 'Maintainer acceptance record 2026-10-01',
};

test('the built-in registry validates and gives every course target one standard preset', () => {
  assert.deepEqual(parseLearningPresets(registry), LEARNING_PRESETS);
  for (const target of LEARNING_TARGETS) {
    const standard = LEARNING_PRESETS.filter((p) => p.generic && p.target === target.id);
    assert.equal(standard.length, 1, target.id);
  }
  assert.equal(new Set(LEARNING_PRESETS.map((p) => p.id)).size, LEARNING_PRESETS.length);
});

test('no built-in preset claims Tested, and unknown limits stay unknown', () => {
  for (const preset of LEARNING_PRESETS) {
    const status = learningPresetStatus(preset);
    assert.equal(status.tested, false, preset.id);
    assert.equal(status.label, 'Standard target');
    assert.equal(
      status.detail,
      preset.target === 'static'
        ? 'This website has not been tested.'
        : 'This LMS has not been tested.'
    );
    assert.deepEqual(preset.evidence, []);
    assert.deepEqual(preset.limits, { packageMB: null, stateChars: null });
  }
});

test('the searchable list offers named LMS products, Website and Other LMS', () => {
  const choices = learningPresetChoices();
  assert.deepEqual(choices.slice(-2), ['Website', 'Other LMS']);
  assert.ok(choices.includes('Litmos'));
  assert.ok(choices.includes('Moodle'));
  assert.equal(new Set(choices).size, choices.length);
});

test('a destination name resolves to a preset for the exact target, or to the standard target', () => {
  assert.equal(learningPresetFor('Moodle', 'scorm12').id, 'moodle-scorm12');
  assert.equal(learningPresetFor('  sap   LITMOS ', 'scorm12').id, 'litmos-scorm12');
  // No Moodle preset exists for SCORM 2004, so the standard target is recorded instead.
  assert.equal(learningPresetFor('Moodle', 'scorm2004').id, 'other-scorm2004');
  assert.equal(learningPresetFor('An unlisted LMS', 'cmi5').id, 'other-cmi5');
  assert.equal(learningPresetFor('', 'static').id, 'website');
  assert.equal(learningPresetFor('Website', 'scorm12').id, 'other-scorm12');
});

test('choosing a name selects its target; an unknown name keeps the current target', () => {
  assert.equal(learningPresetTarget('Website', 'scorm12'), 'static');
  assert.equal(learningPresetTarget('Other LMS', 'static'), 'scorm12');
  assert.equal(learningPresetTarget('Other LMS', 'scorm2004'), 'scorm2004');
  assert.equal(learningPresetTarget('moodle', 'static'), 'scorm12');
  assert.equal(learningPresetTarget('Moodle', 'scorm12'), 'scorm12');
  assert.equal(learningPresetTarget('Intranet portal', 'tincan'), 'tincan');
  assert.equal(learningPresetTarget('', 'cmi5'), 'cmi5');
});

test('Tested needs the full learner sequence for a named LMS version', () => {
  const importOnly = parseLearningPresets(
    withPreset(named({ evidence: [{ ...fullRun, checks: ['import'] }] }))
  ).find((p) => p.id === 'example-lms-scorm12')!;
  assert.equal(learningPresetStatus(importOnly).tested, false);
  assert.equal(learningPresetStatus(importOnly).label, 'Standard target');

  const missingResume = parseLearningPresets(
    withPreset(
      named({ evidence: [{ ...fullRun, checks: ['import', 'launch', 'media', 'completion'] }] })
    )
  ).find((p) => p.id === 'example-lms-scorm12')!;
  assert.equal(learningPresetStatus(missingResume).tested, false);

  const presets = parseLearningPresets(
    withPreset(
      named({
        evidence: [{ ...fullRun, testedAt: '2026-09-01', environment: 'Example LMS 4.1' }, fullRun],
      })
    )
  );
  const tested = presets.find((p) => p.id === 'example-lms-scorm12')!;
  const status = learningPresetStatus(tested);
  assert.equal(status.tested, true);
  assert.equal(status.label, 'Tested');
  assert.equal(
    status.detail,
    'Tested in Example LMS 4.2 on 2026-10-01. Checked import, launch, media, completion, resume and review.'
  );
  assert.equal(learningPresetChoices(presets).includes('Example LMS'), true);

  // A tested preset is preferred when one name has presets for several targets.
  const twoTargets = withPreset(named({ id: 'example-lms-cmi5', target: 'cmi5' }));
  twoTargets.presets.push(named({ evidence: [fullRun] }));
  const both = parseLearningPresets(twoTargets);
  assert.equal(learningPresetTarget('Example LMS', 'static', both), 'scorm12');
  assert.equal(learningPresetTarget('Example LMS', 'cmi5', both), 'cmi5');
  assert.equal(learningPresetFor('Example LMS', 'cmi5', both).id, 'example-lms-cmi5');
});

test('a saved artifact records the preset id and version', () => {
  const preset = learningPresetFor('Moodle', 'scorm12');
  assert.equal(learningPresetRef(preset), 'moodle-scorm12@1');
  assert.equal(learningPresetByRef('moodle-scorm12@1'), preset);
  assert.equal(learningPresetByRef('moodle-scorm12@2'), undefined);
  // Versions saved before the registry recorded these labels.
  assert.equal(learningPresetByRef('unverified'), undefined);
  assert.equal(learningPresetByRef('browser-progress-v1'), undefined);
});

test('validation refuses unsafe or ambiguous preset records', () => {
  const refuse = (value: unknown, pattern: RegExp) =>
    assert.throws(() => parseLearningPresets(value), pattern);
  refuse(null, /schemaVersion: 1/);
  refuse({ ...clone(), schemaVersion: 2 }, /schemaVersion: 1/);
  refuse({ schemaVersion: 1, presets: [] }, /between 1 and 200/);
  refuse(withPreset(named({ password: 'secret' })), /unexpected or missing fields/);
  refuse(withPreset(named({ id: 'Example LMS' })), /lower-case slug/);
  refuse(withPreset(named({ version: 0 })), /positive whole number/);
  refuse(withPreset(named({ target: 'aicc' })), /supported course target/);
  refuse(
    withPreset(named({ limits: { packageMB: 0, stateChars: null } })),
    /positive numbers or null/
  );
  refuse(
    withPreset(named({ limits: { packageMB: 100, stateChars: 4.5 } })),
    /positive numbers or null/
  );
  refuse(withPreset(named({ limits: { packageMB: 100 } })), /positive numbers or null/);
  refuse(
    withPreset(named({ instructions: 'Open https://tenant.example.com/admin?token=abc first.' })),
    /instructions must be plain text/
  );
  refuse(withPreset(named({ launch: 'Ask admin@example.com' })), /launch must be plain text/);
  for (const documentation of [
    'http://example.com/scorm',
    'https://user:pass@example.com/scorm',
    'https://example.com/scorm?tenant=acme',
    'https://example.com/scorm#setup',
    'not a link',
  ])
    refuse(withPreset(named({ documentation })), /public https page/);
  refuse(
    withPreset(named({ evidence: [{ ...fullRun, environment: 'Example LMS' }] })),
    /LMS version/
  );
  refuse(withPreset(named({ evidence: [{ ...fullRun, testedAt: '2026-02-30' }] })), /YYYY-MM-DD/);
  refuse(withPreset(named({ evidence: [{ ...fullRun, checks: [] }] })), /distinct values/);
  refuse(
    withPreset(named({ evidence: [{ ...fullRun, checks: ['import', 'import'] }] })),
    /distinct values/
  );
  refuse(withPreset(named({ evidence: [{ ...fullRun, checks: ['opened'] }] })), /distinct values/);
  refuse(
    withPreset(named({ evidence: [{ ...fullRun, record: 'learner@example.com' }] })),
    /plain record reference/
  );
  refuse(
    withPreset(named({ evidence: [{ ...fullRun, tenant: 'acme' }] })),
    /environment, testedAt/
  );
  refuse(withPreset(named({ id: 'moodle-scorm12' })), /id is used twice/);
  refuse(withPreset(named({ name: 'moodle' })), /already names moodle-scorm12/);
  refuse(withPreset(named({ aliases: ['Other LMS'], target: 'cmi5' })), /already names other-cmi5/);
  refuse(withPreset(named({ name: 'Website', target: 'scorm2004' })), /standard target name/);
  const standardEvidence = clone();
  standardEvidence.presets[1] = { ...standardEvidence.presets[1], evidence: [fullRun] };
  refuse(standardEvidence, /standard target cannot hold LMS evidence/);
  const missingStandard = clone();
  missingStandard.presets = missingStandard.presets.filter((p) => p.id !== 'other-cmi5');
  refuse(missingStandard, /exactly one standard preset for cmi5/);
  refuse(
    withPreset(
      named({ id: 'second-website', name: 'Second website', generic: true, target: 'static' })
    ),
    /exactly one standard preset for Website/
  );
});

test('the engine holds no vendor branches: preset names appear only in the registry data', () => {
  const vendors = (registry.presets as LearningPreset[])
    .filter((p) => !p.generic)
    .flatMap((p) => [p.name, ...p.aliases])
    .map((name) => name.toLowerCase());
  assert.ok(vendors.length > 0);
  const dir = join(ROOT, 'engine/src/learning');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(dir, file), 'utf8').toLowerCase();
    for (const vendor of vendors)
      assert.equal(source.includes(vendor), false, `${file} names ${vendor}`);
  }
});
