// SPDX-License-Identifier: MPL-2.0
/**
 * The sidebar's one control for passing a picture to another tool: a chip in the
 * picture slot's actions row, beside Fit canvas. Which tools it offers is decided
 * in lib/picture-handoff.ts from the manifests.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { presentApis } from '@lolly-tools/core/host-v1';
import { toolSupport } from '../capabilities.ts';
import { getTool } from '../bridge/tool-loader.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { openPictureIn, pictureDestinations, type IndexedTool } from '../lib/picture-handoff.ts';
import { mountSidebarLiveControls } from './live-controls.ts';

const valuesOf = (runtime: Runtime): Record<string, InputValue> =>
  Object.fromEntries(runtime.getModel().map((input) => [input.id, input.value]));

/** Called by renderInputs after each panel rebuild. A tool with no such picture gets nothing. */
export async function mountPictureHandoff(panel: HTMLElement, runtime: Runtime, host: HostV1, toolId: string | undefined): Promise<void> {
  if (!toolId) return;
  const manifest = await getTool(toolId).then((tool) => tool.manifest, () => null);
  if (!manifest) return;
  const inputId = manifest.renditionOf?.input;
  if (!inputId || !panel.isConnected) return;
  const slot = panel.querySelector(`.asset-picker-trigger[data-input-id="${CSS.escape(inputId)}"]`)?.closest<HTMLElement>('.asset-slot');
  if (!slot || slot.querySelector('[data-handoff]')) return;
  const index = (window.__toolIndex?.tools ?? []) as (IndexedTool & { capabilities?: string[]; requires?: string[] })[];
  const able = index.filter((tool) => toolSupport(tool, host.capabilities, presentApis(host)).status === 'ok');
  const destinations = pictureDestinations(manifest, inputId, valuesOf(runtime)[inputId], able);
  if (!destinations.length) return;

  let actions = slot.querySelector<HTMLElement>('.slot-actions');
  if (!actions) {
    const settings = slot.querySelector<HTMLElement>('.asset-slot-settings') ?? slot.appendChild(Object.assign(document.createElement('div'), { className: 'asset-slot-settings' }));
    actions = settings.appendChild(Object.assign(document.createElement('div'), { className: 'slot-actions' }));
  }
  for (const destination of destinations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot-act';
    button.dataset.handoff = destination.id;
    button.textContent = tRaw('Open in {tool}', { tool: destination.name }); // a text sink
    button.addEventListener('click', () => {
      button.disabled = true;
      openPictureIn(host, manifest, valuesOf(runtime), inputId, destination.id).catch((error: unknown) => {
        button.disabled = false;
        announce(error instanceof Error ? error.message : t('Could not open this asset.'), { assertive: true });
      });
    });
    actions.append(button);
  }
}

/** What renderInputs adds to the asset slots after each panel rebuild: the live
 *  camera controls, and the picture hand-off. */
export function mountSlotExtras(panel: HTMLElement, runtime: Runtime, host: HostV1, toolId: string | undefined): void {
  mountSidebarLiveControls(panel, runtime);
  void mountPictureHandoff(panel, runtime, host, toolId);
}
