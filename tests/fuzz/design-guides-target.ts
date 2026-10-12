// SPDX-License-Identifier: MPL-2.0
import {
  MAX_DESIGN_GUIDE_RECORDS,
  guideSnapTargets,
  parseDesignGuides,
  parseGuideRecords,
  serializeDesignGuides,
  serializeGuideRecords,
  serializeGuideEdit,
} from '../../shells/web/src/views/design-guides.ts';
import type { DesignGuide } from '../../shells/web/src/views/design-ports.ts';
import type { SnapLines } from '../../shells/web/src/views/free-canvas-math.ts';

const encoder = new TextEncoder();

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new WebAssembly.RuntimeError(`Guide codec invariant: ${message}`);
}

/** Output failures use the discovery runner's finding class, never a refusal. */
export function assertDesignGuideOutput(guides: readonly DesignGuide[], targets: SnapLines): void {
  const ids = new Set<string>();
  for (const guide of guides) {
    invariant(
      typeof guide.id === 'string' && /^[\w-]{1,80}$/.test(guide.id) && !ids.has(guide.id),
      'invalid or duplicate identity'
    );
    ids.add(guide.id);
    invariant([guide.x, guide.y, guide.rotation].every(Number.isFinite), 'non-finite geometry');
    invariant(
      typeof guide.color === 'string' && typeof guide.snap === 'boolean',
      'invalid properties'
    );
  }
  invariant(
    [...(targets.x ?? []), ...(targets.y ?? [])].every(Number.isFinite),
    'non-finite axis snap target'
  );
  for (const guide of targets.angled ?? []) {
    invariant(
      [guide.x, guide.y, guide.rotation].every(Number.isFinite),
      'non-finite angled snap target'
    );
  }
}

/** Exercise the existing text/JSON codecs and snap projection without mounting DOM. */
export function invokeDesignGuides(bytes: Uint8Array): void {
  const text = new TextDecoder().decode(bytes);
  const legacy = parseDesignGuides(text);
  for (const values of [legacy.x, legacy.y]) {
    invariant(values.every(Number.isFinite), 'non-finite legacy position');
    invariant(
      values.every((value, index) => index === 0 || value > values[index - 1]!),
      'legacy order'
    );
  }
  const legacyWire = serializeDesignGuides(legacy);
  invariant(
    serializeDesignGuides(parseDesignGuides(legacyWire)) === legacyWire,
    'unstable legacy canonicalization'
  );

  const records = parseGuideRecords(text);
  assertDesignGuideOutput(records, guideSnapTargets(records));
  const axisOnly = records.every(
    (guide) => !guide.color && guide.snap && [0, 90].includes(((guide.rotation % 180) + 180) % 180)
  );
  if (records.length <= MAX_DESIGN_GUIDE_RECORDS || axisOnly) {
    const editWire = serializeGuideEdit(records);
    const editRestored = parseGuideRecords(editWire);
    invariant(editRestored.length === records.length, 'editable wire lost guide records');
    invariant(
      JSON.stringify(guideSnapTargets(editRestored)) === JSON.stringify(guideSnapTargets(records)),
      'editable wire changed snap geometry'
    );
  }
  const canonical = serializeGuideRecords(records);
  const restored = parseGuideRecords(canonical);
  assertDesignGuideOutput(restored, guideSnapTargets(restored));
  // Writing an uncapped v1 set as v2 retains the v2 reader's existing prefix rule.
  const admitted = records.slice(0, MAX_DESIGN_GUIDE_RECORDS);
  invariant(
    restored.length === admitted.length &&
      restored.every((guide, index) => guide.id === admitted[index]!.id),
    'identity changed during reparse'
  );
  invariant(
    restored.every(
      (guide, index) => guide.x === admitted[index]!.x && guide.y === admitted[index]!.y
    ),
    'position changed during reparse'
  );
  invariant(
    serializeGuideRecords(restored) === serializeGuideRecords(admitted),
    'unstable v2 canonicalization'
  );
}

/** Valid wires come from the maintained writers, including finite overflow cases. */
export async function designGuideSeeds(): Promise<Uint8Array[]> {
  const guide = (id: string, patch: Partial<DesignGuide> = {}): DesignGuide => ({
    id,
    x: 25,
    y: 50,
    rotation: 90,
    color: '',
    snap: true,
    ...patch,
  });
  const legacy = { x: [-17.125, 0, 24.875, 24.875], y: [-0.005, 80.004, 192] };
  return [
    serializeDesignGuides({ x: [], y: [] }),
    serializeDesignGuides(legacy),
    JSON.stringify(parseDesignGuides(serializeDesignGuides(legacy))),
    serializeGuideRecords([
      guide('vertical', { color: '#abcdef' }),
      guide('horizontal', { rotation: 0, x: -10, color: 'rgba(10,20,30,0.5)' }),
      guide('angled', { rotation: -45, x: -15.125, color: 'var(--guide-color)' }),
      guide('disabled', { rotation: 359.999, snap: false }),
    ]),
    serializeDesignGuides({ x: [-1e308, 1e308, Number.MAX_VALUE], y: [-Number.MAX_VALUE, 1e308] }),
    serializeGuideRecords([
      guide('i'.repeat(80), { x: 1e308, y: -1e308, rotation: 90 }),
      guide('huge-angle', { x: -Number.MAX_VALUE, y: Number.MAX_VALUE, rotation: 1e308 }),
    ]),
    serializeDesignGuides({ x: Array.from({ length: 1005 }, (_, index) => index - 500), y: [] }),
    serializeGuideRecords(
      Array.from({ length: 1005 }, (_, index) => guide(`g${index}`, { x: index }))
    ),
  ].map((wire) => encoder.encode(wire));
}
