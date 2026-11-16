// SPDX-License-Identifier: MPL-2.0
/**
 * 3D Studio's stage kit controls (shells/web/src/lib/studio3d/toolbar.ts) for a set of
 * values, without a browser: a mount-shaped entry with a stub renderer and a canvas that
 * only carries data flags, and a stage kit that records what it was asked to draw.
 */
import { buildStudioScene } from '../../engine/src/studio3d.ts';
import type { StageKitAction, StageKitGroup } from '../../shells/web/src/lib/stage-kit.ts';

export interface StudioBarHarness {
  /** What the studio last asked the kit to draw. */
  groups(): StageKitGroup[];
  /** The last status sentence. */
  status(): string;
  /** A visible action by its id (`studio-fit`), or undefined when hidden or absent. */
  action(id: string): StageKitAction | undefined;
  /** Every visible item's id, in bar order. */
  visible(): string[];
  /** The edits written so far, in order; `commitMany` writes appear as one array entry. */
  edits: Array<{ id: string; value: unknown } | Record<string, unknown>>;
  entry: Record<string, unknown> & { recipe: unknown; inputValues: Record<string, unknown> };
  /** Load new values into the same mount and sync again. */
  sync(values: Record<string, unknown>): Promise<void>;
}

export async function studioBarHarness(
  values: Record<string, unknown>,
  extra: { commitMany?: boolean; addObjects?: boolean; reviewCollection?: boolean } = {}
): Promise<StudioBarHarness> {
  const { syncStudioControls } = await import('../../shells/web/src/lib/studio3d/toolbar.ts');
  let groups: StageKitGroup[] = [];
  let status = '';
  const edits: StudioBarHarness['edits'] = [];
  const dataset: Record<string, string> = {};
  const canvas = {
    dataset,
    style: {} as Record<string, string>,
    tabIndex: 0,
    focus() {},
    dispatchEvent() { return true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 }),
  };
  const entry = {
    canvas,
    marker: {},
    handle: { highlight() {}, showLightHandles() {}, fit: () => null, view() {} },
    ready: true,
    recipe: buildStudioScene({ version: 1, values }),
    inputValues: values,
    inputCamera: {},
    notes: 'Notes',
    options: {
      setInput: (id: string, value: unknown) => edits.push({ id, value }),
      ...(extra.commitMany ? { commitMany: (batch: Record<string, unknown>) => edits.push(batch) } : {}),
      ...(extra.addObjects ? { addObjects() {} } : {}),
      ...(extra.reviewCollection ? { reviewCollection() {} } : {}),
      chrome: {
        setBar: (next: readonly StageKitGroup[]) => { groups = [...next]; },
        setStatus: (text: string) => { status = text; },
      },
    },
    render() {},
  };
  syncStudioControls(entry as never);
  const shown = () =>
    groups.filter((g) => !g.hidden).flatMap((g) => g.items.filter((item) => !item.hidden && (item.kind !== 'pill' || item.text)));
  return {
    groups: () => groups,
    status: () => status,
    action: (id) => shown().find((item): item is StageKitAction => item.id === id && item.kind !== 'pill'),
    visible: () => shown().map((item) => item.id),
    edits,
    entry: entry as StudioBarHarness['entry'],
    async sync(next) {
      entry.inputValues = next;
      entry.recipe = buildStudioScene({ version: 1, values: next });
      syncStudioControls(entry as never);
    },
  };
}
