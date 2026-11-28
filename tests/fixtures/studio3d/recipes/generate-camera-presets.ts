// SPDX-License-Identifier: MPL-2.0
/**
 * Writes the pinned camera move recipes (plan 267, lane D).
 *
 *   node tests/fixtures/studio3d/recipes/generate-camera-presets.ts
 *
 * generate.ts pins what the pushed 0.4.0 evaluates, and refuses to write once the
 * engine moves past that commit, by design. A camera move is new behaviour, so it gets
 * its own family of pins, written from today's code: one 05-camera-<kind>.json per move
 * holding the value set, the live camera it was made from, the synthesised keys, the
 * rows Convert to keys hands over, and the pose at five phases of the loop.
 *
 * tests/studio3d-camera-path.test.ts reads these files and compares each field it
 * records, so a move that changes shape has to be re-pinned deliberately.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  studioCameraPose,
  studioCameraPresetRows,
  studioCameraTravels,
} from '../../../../engine/src/studio3d-camera-path.ts';
import { buildStudioScene, studioAnimated } from '../../../../engine/src/studio3d.ts';

const here = import.meta.dirname;
export const PRESET_PHASES = [0, 0.25, 0.5, 0.75, 1];

type Values = Record<string, unknown>;

/** One pinned move: a value set chosen to show what the move is made of. */
export const CAMERA_PRESET_SETS: { kind: string; values: Values; source?: string }[] = [
  {
    kind: 'sweep',
    values: { cameraMotion: 'sweep', cameraAmount: 1.5, cameraEase: 'flow', cameraLoop: true },
  },
  {
    kind: 'pushin',
    values: { cameraMotion: 'pushin', cameraAmount: 2, camera: { zoom: 1.4 } },
  },
  {
    kind: 'dolly',
    values: {
      cameraMotion: 'dolly',
      cameraEase: 'linear',
      camera: { fov: 40, zoom: 1.2 },
      duration: 8,
    },
  },
  {
    kind: 'reveal',
    values: {
      cameraMotion: 'reveal',
      cameraAmount: 0.5,
      camera: { azimuth: -30, elevation: 40, zoom: 0.9 },
      focusDistance: 6,
    },
  },
  {
    kind: 'crane',
    values: { cameraMotion: 'crane', camera: { elevation: 60, panX: 0.4 } },
  },
  {
    // The full turn that the older 3D tool's camera made, added for its retirement.
    kind: 'orbit',
    source: 'camera orbit for retiring the 3d tool',
    values: {
      cameraMotion: 'orbit',
      cameraEase: 'linear',
      cameraLoop: true,
      camera: { azimuth: -40, elevation: 22, zoom: 0.9, panX: 0.2 },
      focusDistance: 4,
    },
  },
];

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function presetFixture(values: Values): Values {
  const scene = buildStudioScene({ version: 1, values });
  return {
    values,
    camera: JSON.parse(JSON.stringify(scene.camera)),
    cameraMotion: JSON.parse(JSON.stringify(scene.cameraMotion)),
    rows: studioCameraPresetRows(scene),
    travels: studioCameraTravels(scene),
    animated: studioAnimated(scene),
    poses: PRESET_PHASES.map((phase) =>
      JSON.parse(JSON.stringify(studioCameraPose(scene, phase)))
    ),
  };
}

export function writeCameraPresets(): number {
  for (const { kind, values, source } of CAMERA_PRESET_SETS)
    writeFileSync(
      join(here, `05-camera-${kind}.json`),
      json({ source: source ?? 'plan 267 lane D', ...presetFixture(values) })
    );
  return CAMERA_PRESET_SETS.length;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  console.log(`wrote ${writeCameraPresets()} camera move fixtures`);
