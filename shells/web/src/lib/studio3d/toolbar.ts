// SPDX-License-Identifier: MPL-2.0
/**
 * 3D Studio's controls, drawn by the stage kit (lib/stage-kit.ts) beside the picture
 * instead of inside the scaled artboard (plan 368, W1 and W3).
 *
 * `syncStudioControls` builds the groups from the mount's state on every sync: Move
 * lights, framing, the camera path, focus (only with depth of field), the collection or
 * arrangement items, the selected object's actions (Duplicate, Remove, Rest on the stage
 * and Tilt), and the source notes at the end. The object's name opens the list of objects.
 * There is no Orbit, Move or Turn mode: an object is selected, moved, turned, lifted and
 * scaled on the canvas (handles.ts, plan 368 D4). The buttons keep their `data-studio-*`
 * attributes, so tests and scripts find them by those.
 *
 * A mount with no stage kit (multi-edit, a Design scene box, an export or a one-off
 * render) draws no controls at all, and a mount with no `setInput` draws none either.
 */
import {
  studioActiveObject,
  studioObjectName,
  studioObjectSelect,
} from '../../../../../engine/src/studio3d-arrangement.ts';
import {
  type StudioValues,
  studioActiveIndex,
  studioCollectionRows,
  studioFocusEdit,
} from '../../../../../engine/src/studio3d-collection.ts';
import {
  studioAddCameraKey,
  studioCameraApparentSize,
  studioCameraFromKey,
  studioCameraKeyLabel,
  studioCameraPresetEdit,
  studioIsCameraPreset,
} from '../../../../../engine/src/studio3d-camera-path.ts';
import { studioPlaceableLights } from '../../../../../engine/src/studio3d-lights.ts';
import { tRaw } from '../../i18n.ts';
import type { StageKitAction, StageKitGroup, StageKitItem } from '../stage-kit.ts';
import { STUDIO_VIEW_PRESETS } from './camera-nav.ts';
import {
  type StudioControls,
  type StudioMode,
  activeObject,
  commit,
  focusQuietly,
  modeStatus,
  note,
  objectEditing,
  resetCamera,
  selectedObject,
  setSelected,
  setStudioMode,
  studioFit,
  studioMode,
  viewFrom,
} from './controls.ts';
import {
  canDuplicate,
  canRemove,
  duplicateEdits,
  removeEdits,
  restEdits,
} from './object-edit.ts';

/** The View menu's names, translated where they are shown. */
const VIEW_LABELS: Record<(typeof STUDIO_VIEW_PRESETS)[number]['id'], () => string> = {
  front: () => tRaw('Front'),
  side: () => tRaw('Side'),
  top: () => tRaw('Top'),
  'three-quarter': () => tRaw('Three-quarter'),
};

/** Run a control's action; an action that cannot run reports why in the status line. */
function guarded(entry: StudioControls, action: () => void): () => void {
  return () => {
    try {
      // A wheel or key view still waiting for its pause is saved first, as its own step.
      entry.flushView?.();
      action();
    } catch (error) {
      note(entry, (error as Error).message);
    }
  };
}

/** A mode button switches to its mode, or back to the rest state when it is already on. */
function toggleMode(entry: StudioControls, mode: StudioMode): void {
  setStudioMode(entry, studioMode(entry) === mode ? 'orbit' : mode);
  entry.canvas.focus({ preventScroll: true });
}

function rows(values: StudioValues, key: string): StudioValues[] {
  const list = values[key];
  return Array.isArray(list) ? (list as StudioValues[]) : [];
}

/** The name of the selected arrangement object, as its list button reads: "2 of 3: Sphere". */
function objectLabel(values: StudioValues): string {
  try {
    const index = studioActiveObject(values);
    const objects = rows(values, 'objects');
    const row = objects[index] ?? {};
    const missing =
      (row.kind === 'artwork' || row.kind === 'model') &&
      !(row.asset && (typeof row.asset === 'string' || (row.asset as { url?: string }).url));
    const state = row.visible === false ? tRaw(' (hidden)') : missing ? tRaw(' (no file yet)') : '';
    return tRaw('{n} of {count}: {name}', { n: index + 1, count: objects.length, name: studioObjectName(row, index) }) + state;
  } catch (error) {
    return (error as Error).message;
  }
}

/** The selected collection item and its pill text, as the template used to write the pill. */
function collectionItem(values: StudioValues): { label: string; index: number; ownFraming: boolean } {
  const selected = studioCollectionRows(values)[studioActiveIndex(values)]!;
  return {
    index: selected.index,
    ownFraming: !!selected.ownFraming,
    label: `${selected.index + 1}. ${selected.name}${selected.ownFraming ? tRaw(' (own framing)') : ''}`,
  };
}

/** The camera move's own keys, when a move is chosen: what Convert to keys hands over. */
function moveKeys(entry: StudioControls): unknown[] {
  return studioIsCameraPreset(entry.recipe.cameraMotion?.kind ?? 'still') ? (entry.recipe.cameraMotion?.keys ?? []) : [];
}

function addCameraKey(entry: StudioControls): void {
  const edit = studioAddCameraKey(entry.inputValues);
  const count = (edit.value as unknown[]).length;
  commit(entry, tRaw('Add key'), edit, ...(count >= 2 ? [] : [{ id: 'cameraMotion', value: 'still' }]));
  note(
    entry,
    count >= 2
      ? tRaw('Key {n} saved: play the path to see the move.', { n: count })
      : tRaw('First key saved: turn the camera, then add another.')
  );
}

/**
 * Each press shows the next saved key, wrapping at the end, so a view already in the
 * path can be recalled and composed from. It moves the camera and nothing else.
 */
function goToKey(entry: StudioControls): void {
  const keys = rows(entry.inputValues, 'cameraKeys');
  if (!keys.length) throw new Error(tRaw('Add a camera key first.'));
  const last = Number(entry.canvas.dataset.cameraKey);
  const next = Number.isInteger(last) && last >= 0 ? (last + 1) % keys.length : 0;
  entry.canvas.dataset.cameraKey = String(next);
  commit(entry, tRaw('Go to key'), ...studioCameraFromKey(entry.inputValues, next));
  const label = studioCameraKeyLabel(entry.inputValues, next);
  note(
    entry,
    entry.inputValues.cameraMotion === 'keys' && keys.length >= 2
      ? tRaw('{key}: turn Play path off to hold this view.', { key: label })
      : tRaw('{key}.', { key: label })
  );
}

/**
 * A camera move draws its keys from the live view. Convert to keys hands those rows over
 * as one edit, so one undo takes the move back.
 */
function convertToKeys(entry: StudioControls): void {
  const keys = moveKeys(entry) as Parameters<typeof studioCameraApparentSize>[0][];
  const edits = studioCameraPresetEdit(entry.recipe);
  // A dolly holds the subject's size by trading lens for distance. Where the zoom range
  // cannot go that far, the framing moves, and the status line reports that. Both are
  // read before the commit, because the commit hands this view its next recipe.
  const live = studioCameraApparentSize(entry.recipe.camera);
  const framed = keys.every((key) => Math.abs(studioCameraApparentSize(key) - live) <= live * 0.02);
  commit(entry, tRaw('Convert to keys'), ...edits);
  note(
    entry,
    framed
      ? tRaw('Converted to {n} keys, which you can edit under Motion.', { n: keys.length })
      : tRaw('Converted to {n} keys; the zoom range limited the move, so the subject changes size.', { n: keys.length })
  );
}

/** Put the selected collection item back on the collection's shared framing. */
function useSharedFraming(entry: StudioControls, index: number): void {
  commit(entry, tRaw('Use shared framing'), {
    id: 'subjects',
    value: rows(entry.inputValues, 'subjects').map((item, i) => (i === index ? { ...item, ownFraming: false } : item)),
  });
}

/** The objects of an arrangement as a menu: choosing one selects it and shows its handles. */
function objectMenu(entry: StudioControls): { id: string; label: string; checked: boolean; onPress(): void }[] {
  const objects = rows(entry.inputValues, 'objects');
  const active = activeObject(entry);
  return objects.map((row, index) => ({
    id: `object-${index + 1}`,
    label: studioObjectName(row, index),
    checked: index === active,
    onPress: () => {
      if (index !== active) commit(entry, tRaw('Select'), studioObjectSelect(entry.inputValues, index));
      // The saved selection comes back with the next render; the handles follow the choice now.
      entry.inputValues = { ...entry.inputValues, activeObject: index + 1 };
      setSelected(entry, true);
      entry.canvas.focus({ preventScroll: true });
    },
  }));
}

/** The selected object's actions. The ones that need a selection wait for one. */
function objectActions(entry: StudioControls, disabled: boolean): StageKitAction[] {
  const run = (action: () => void) => guarded(entry, action);
  const arrangement = entry.inputValues.source === 'arrangement';
  const editing = objectEditing(entry);
  const row = selectedObject(entry);
  const none = disabled || row === null;
  return [
    {
      id: 'studio-duplicate',
      label: tRaw('Duplicate'),
      shortLabel: tRaw('Copy'),
      icon: 'duplicate',
      disabled: none || !canDuplicate(entry),
      hidden: !arrangement || !editing,
      data: { 'studio-duplicate': '' },
      onPress: run(() => {
        if (row === null) return;
        // The copy stands one footprint to the side of the original, clear of the original.
        const offset = Math.max(0.4, 2 * (entry.handle.selection(row)?.radius ?? 0.4) + 0.1);
        commit(entry, tRaw('Duplicate'), ...duplicateEdits(entry, row, offset));
        entry.inputValues = { ...entry.inputValues, activeObject: rows(entry.inputValues, 'objects').length + 1 };
        setSelected(entry, true);
      }),
    },
    {
      id: 'studio-remove',
      label: tRaw('Remove'),
      icon: 'trash',
      disabled: none || !canRemove(entry, row),
      hidden: !arrangement || !editing,
      data: { 'studio-remove': '' },
      onPress: run(() => {
        if (row === null) return;
        const edits = removeEdits(entry, row);
        setSelected(entry, false);
        commit(entry, tRaw('Remove'), ...edits);
        entry.canvas.focus({ preventScroll: true });
      }),
    },
    {
      id: 'studio-rest',
      label: tRaw('Rest on the stage'),
      shortLabel: tRaw('Rest'),
      icon: 'alignB',
      title: tRaw('Put the object down on the stage, with no height'),
      disabled: none || !restEdits(entry, row),
      hidden: !editing,
      data: { 'studio-rest': '' },
      onPress: run(() => {
        const edits = row === null ? null : restEdits(entry, row);
        if (edits) commit(entry, tRaw('Rest on the stage'), ...edits);
      }),
    },
  ];
}

/** The groups the stage kit draws for this mount, or none. */
export function studioBar(entry: StudioControls): StageKitGroup[] {
  const { options, recipe, inputValues: values } = entry;
  if (!options.setInput) return [];
  const disabled = !entry.ready;
  const mode = studioMode(entry);
  const arrangement = values.source === 'arrangement';
  const collection = values.source === 'collection';
  const keys = rows(values, 'cameraKeys').length;
  const plays = values.cameraMotion === 'keys' && keys >= 2;
  const run = (action: () => void) => guarded(entry, action);
  const modeButton = (id: StudioMode, label: string, shortLabel: string, icon: StageKitAction['icon'], attr: string, extra: Partial<StageKitAction> = {}): StageKitAction => ({
    id: `studio-${attr}`,
    label,
    shortLabel,
    icon,
    pressed: mode === id,
    disabled,
    data: { [`studio-${attr}`]: '' },
    onPress: run(() => {
      if (id !== 'orbit') return toggleMode(entry, id);
      setStudioMode(entry, 'orbit');
      entry.canvas.focus({ preventScroll: true });
    }),
    ...extra,
  });

  const groups: StageKitGroup[] = [
    {
      id: 'studio-modes',
      label: tRaw('Lights'),
      items: [
        modeButton('lights', tRaw('Move lights'), tRaw('Lights'), 'sunburst', 'lights', { hidden: !studioPlaceableLights(recipe).length }),
      ],
    },
    {
      id: 'studio-framing',
      label: tRaw('Framing'),
      phoneIcons: true,
      // Four related views read well as icons with tooltips; they give their labels up first.
      collapse: 0,
      items: [
        {
          id: 'studio-view',
          label: tRaw('View'),
          icon: 'eye',
          title: tRaw('Front, side, top or three-quarter view'),
          disabled,
          data: { 'studio-view': '' },
          menu: () => STUDIO_VIEW_PRESETS.map((view) => ({
            id: view.id,
            label: VIEW_LABELS[view.id](),
            checked: Math.abs(recipe.camera.azimuth - view.azimuth) < 0.5 && Math.abs(recipe.camera.elevation - view.elevation) < 0.5,
            onPress: run(() => viewFrom(entry, view.azimuth, view.elevation)),
          })),
        },
        {
          id: 'studio-fit',
          label: arrangement ? tRaw('Frame all') : tRaw('Fit object'),
          icon: 'fitAll',
          disabled,
          data: { 'studio-fit': '' },
          onPress: run(() => { studioFit(entry); }),
        },
        {
          id: 'studio-fit-selected',
          label: tRaw('Fit selected'),
          icon: 'box',
          disabled,
          hidden: !arrangement,
          data: { 'studio-fit-selected': '' },
          onPress: run(() => { studioFit(entry, activeObject(entry)); }),
        },
        {
          id: 'studio-reset',
          label: tRaw('Reset camera'),
          icon: 'home',
          disabled,
          data: { 'studio-reset': '' },
          onPress: run(() => resetCamera(entry)),
        },
      ],
    },
    {
      id: 'studio-path',
      label: tRaw('Camera path'),
      phoneIcons: true,
      items: [
        {
          id: 'studio-add-key',
          label: tRaw('Add key'),
          icon: 'camera',
          title: tRaw('Save this view as the next key of the camera path'),
          disabled,
          data: { 'studio-add-key': '' },
          onPress: run(() => addCameraKey(entry)),
        },
        {
          id: 'studio-go-key',
          label: tRaw('Go to key'),
          icon: 'skipForward',
          title: tRaw('Show the next saved key in the preview'),
          disabled,
          hidden: !keys,
          data: { 'studio-go-key': '' },
          onPress: run(() => goToKey(entry)),
        },
        {
          id: 'studio-play',
          label: tRaw('Play path'),
          icon: plays ? 'pause' : 'play',
          pressed: plays,
          disabled,
          hidden: !keys,
          data: { 'studio-play': '' },
          onPress: run(() => commit(entry, tRaw('Play path'), { id: 'cameraMotion', value: values.cameraMotion === 'keys' ? 'still' : 'keys' })),
        },
        {
          id: 'studio-convert-keys',
          label: tRaw('Convert to keys'),
          icon: 'keyframe',
          title: tRaw('Turn the chosen camera move into keys you can edit'),
          disabled,
          hidden: moveKeys(entry).length < 2,
          data: { 'studio-convert-keys': '' },
          onPress: run(() => convertToKeys(entry)),
        },
      ],
    },
  ];

  if (values.depthOfField === true) {
    groups.push({
      id: 'studio-focus',
      label: tRaw('Focus'),
      items: [
        modeButton('focus', tRaw('Pick focus'), tRaw('Focus'), 'focus', 'focus', { disabled: disabled || recipe.camera.aperture === 0 }),
        {
          id: 'studio-auto-focus',
          label: tRaw('Auto focus'),
          shortLabel: tRaw('Auto'),
          icon: 'aperture',
          disabled,
          data: { 'studio-auto-focus': '' },
          onPress: run(() => commit(entry, tRaw('Auto focus'), studioFocusEdit(entry.inputValues, 0))),
        },
      ],
    });
  }

  const items: StageKitItem[] = [];
  if (collection) {
    const item = collectionItem(values);
    items.push(
      { kind: 'pill', id: 'studio-item-label', text: item.label, data: { 'studio-item-label': '' } },
      {
        id: 'studio-add',
        label: tRaw('Add items'),
        shortLabel: tRaw('Add'),
        icon: 'plus',
        hidden: !options.addObjects,
        data: { 'studio-add': '' },
        onPress: run(() => options.addObjects?.()),
      },
      {
        id: 'studio-review',
        label: tRaw('Review collection'),
        shortLabel: tRaw('Review'),
        icon: 'grid',
        hidden: !options.reviewCollection,
        data: { 'studio-review': '' },
        onPress: run(() => options.reviewCollection?.()),
      },
      {
        id: 'studio-shared-camera',
        label: tRaw('Use shared framing'),
        shortLabel: tRaw('Shared'),
        icon: 'link',
        hidden: !item.ownFraming,
        data: { 'studio-shared-camera': '' },
        onPress: run(() => useSharedFraming(entry, item.index)),
      },
    );
  } else if (arrangement) {
    const name = objectLabel(values);
    items.push(
      {
        id: 'studio-object-label',
        label: name,
        // The phone shows the object's own name, without the count.
        shortLabel: name.replace(/^[^:]*:\s*/, ''),
        icon: 'layers',
        title: tRaw('Choose the object to work on'),
        disabled,
        data: { 'studio-object-label': '' },
        menu: () => objectMenu(entry),
      },
      {
        id: 'studio-add',
        label: tRaw('Add objects'),
        shortLabel: tRaw('Add'),
        icon: 'plus',
        title: tRaw('Choose several SVG or model files from the library or your uploads'),
        hidden: !options.addObjects,
        data: { 'studio-add': '' },
        onPress: run(() => options.addObjects?.()),
      },
    );
  }
  if (items.length) groups.push({ id: 'studio-items', label: collection ? tRaw('Collection') : tRaw('Objects'), items });
  groups.push({
    id: 'studio-object',
    label: tRaw('Selected object'),
    items: [
      ...objectActions(entry, disabled),
      modeButton('tilt', tRaw('Tilt'), tRaw('Tilt'), 'rotateCw', 'tilt', {
        title: tRaw('Drag to turn and tilt the object freely'),
      }),
    ],
  });

  const expert = values.controls === 'expert' || values.materialMode === 'custom';
  const notesTitle = expert ? tRaw('Material slots and source notes') : tRaw('Source notes');
  groups.push({
    id: 'studio-notes',
    label: notesTitle,
    phoneIcons: true,
    collapse: 1,
    items: [{
      id: 'studio-info',
      label: notesTitle,
      icon: 'info',
      disabled: !entry.notes,
      data: { 'studio-notes': '' },
      panel: {
        label: notesTitle,
        render: (el) => {
          const title = el.ownerDocument.createElement('h2');
          title.className = 'stage-kit-panel-title';
          title.textContent = notesTitle;
          const text = el.ownerDocument.createElement('p');
          text.className = 'stage-kit-panel-text';
          text.setAttribute('data-studio-info', '');
          text.textContent = entry.notes ?? '';
          el.append(title, text);
        },
      },
    }],
  });
  return groups;
}

/**
 * Draw the controls for the mount's current state and put back the mode it was in.
 * Called on every mount and again once the scene is ready. Pick focus ends with a
 * repaint, and a move mode ends when the scene has no objects to move.
 */
export function syncStudioControls(entry: StudioControls): void {
  if (!entry.ready) entry.canvas.dispatchEvent(new Event('studio-reset-gesture'));
  entry.canvas.tabIndex = entry.options.setInput ? 0 : -1;
  // The canvas moves its own camera, so the stage neither pans nor pinches under it and
  // leaves its plain wheel alone (lib/stage-gestures.ts). Ctrl or Cmd with the wheel
  // still zooms the stage.
  if (entry.options.setInput) entry.canvas.setAttribute('data-stage-gestures', 'own');
  else entry.canvas.removeAttribute('data-stage-gestures');
  // The canvas's name says what a press does here: with handles an object is selected
  // and moved, and without them every drag moves the camera.
  entry.canvas.setAttribute(
    'aria-label',
    objectEditing(entry)
      ? tRaw('3D studio preview: click an object to select it, drag an object to move it and use the arrow keys to nudge the selection. Drag empty space to orbit, drag with two fingers or Shift to pan, pinch or scroll to zoom, and double-click to frame.')
      : tRaw('3D studio preview: drag to orbit, drag with two fingers or Shift to pan, pinch or scroll to zoom, and double-click to frame.')
  );
  const chrome = entry.options.chrome;
  entry.refreshChrome = chrome ? () => chrome.setBar(studioBar(entry)) : undefined;
  let mode = studioMode(entry);
  if (mode === 'focus') mode = 'orbit';
  // A repaint keeps a mode and its overlay on the newly selected object or light.
  setStudioMode(entry, mode);
  if (!entry.status) note(entry, modeStatus(entry, mode), false);
  if (entry.ready && entry.canvas.dataset.restoreFocus) {
    const restore = entry.canvas.dataset.restoreFocus;
    if (restore === 'canvas') entry.canvas.focus({ preventScroll: true });
    else if (restore === 'canvas-quiet') focusQuietly(entry.canvas);
    delete entry.canvas.dataset.restoreFocus;
  }
}

/** Take the studio's controls off the stage: its mount is going. */
export function clearStudioControls(entry: StudioControls): void {
  entry.clearHandles?.();
  entry.refreshChrome = undefined;
  entry.options.chrome?.setBar([]);
  entry.options.chrome?.setStatus('');
}
