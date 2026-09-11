// SPDX-License-Identifier: MPL-2.0
/**
 * Device picker (plans/162) - choose a camera or microphone. A thin `mountModal`
 * adapter, like choiceDialog: the shared modal shell IS the reuse; there is no
 * "universal picker" abstraction (an asset picker's searchable catalog grid and a
 * device's flat radio list share only the modal chrome, which already exists).
 *
 * The enumeration/grouping is pure (`groupDevices`) so it is unit-testable without
 * a real `navigator.mediaDevices`. `device.label` is '' until a getUserMedia grant
 * of that kind, so this is most useful once a stream is already live (the live
 * controls open it while the camera runs) - before a grant it shows generic
 * "Camera 1 / Microphone 1" names.
 */

import { escape } from '../utils.ts';
import { mountModal } from './modal.ts';

export type DeviceKind = 'videoinput' | 'audioinput';

export interface DeviceOption {
  deviceId: string;
  label: string;
  kind: DeviceKind;
}
export interface DeviceGroups {
  cameras: DeviceOption[];
  mics: DeviceOption[];
}

/** A minimal subset of MediaDeviceInfo, so this is testable with plain objects. */
interface DeviceInfoLike {
  deviceId: string;
  kind: string;
  label?: string;
  groupId?: string;
}

/**
 * Group + de-dupe enumerated devices into cameras and mics, with a generic label
 * fallback where the platform withheld the real one (no grant yet). De-dupe is by
 * deviceId; a blank deviceId (some browsers list one before a grant) is dropped.
 */
export function groupDevices(devices: readonly DeviceInfoLike[]): DeviceGroups {
  const cameras: DeviceOption[] = [];
  const mics: DeviceOption[] = [];
  const seen = new Set<string>();
  let camN = 0, micN = 0;
  for (const d of devices) {
    if (!d || !d.deviceId) continue; // pre-grant placeholder entries
    if (d.kind === 'videoinput') {
      camN++;
      if (seen.has('v:' + d.deviceId)) continue;
      seen.add('v:' + d.deviceId);
      cameras.push({ deviceId: d.deviceId, kind: 'videoinput', label: (d.label || '').trim() || `Camera ${camN}` });
    } else if (d.kind === 'audioinput') {
      micN++;
      if (seen.has('a:' + d.deviceId)) continue;
      seen.add('a:' + d.deviceId);
      mics.push({ deviceId: d.deviceId, kind: 'audioinput', label: (d.label || '').trim() || `Microphone ${micN}` });
    }
  }
  return { cameras, mics };
}

/** Enumerate the current input devices, grouped. [] on any failure or no support. */
export async function enumerateInputs(): Promise<DeviceGroups> {
  try {
    const md = (navigator as unknown as { mediaDevices?: { enumerateDevices?: () => Promise<DeviceInfoLike[]> } }).mediaDevices;
    if (!md?.enumerateDevices) return { cameras: [], mics: [] };
    return groupDevices(await md.enumerateDevices());
  } catch {
    return { cameras: [], mics: [] };
  }
}

export interface DevicePickerResult {
  deviceId: string;
  kind: DeviceKind;
}
export interface DevicePickerOpts {
  /** Restrict to one kind (a camera-only or mic-only chooser). Default: both. */
  kind?: DeviceKind;
  /** The currently-selected id per kind, to mark it. */
  currentCameraId?: string;
  currentMicId?: string;
  title?: string;
  t?: (s: string) => string;
}

function section(heading: string, devices: DeviceOption[], currentId: string | undefined, esc: (s: string) => string): string {
  if (!devices.length) return '';
  return `<section class="devpick-section">
    <h3 class="devpick-heading">${esc(heading)}</h3>
    <div class="devpick-list" role="radiogroup" aria-label="${esc(heading)}">
      ${devices.map((d) => `<button type="button" class="devpick-item${d.deviceId === currentId ? ' is-current' : ''}"
        role="radio" aria-checked="${d.deviceId === currentId ? 'true' : 'false'}"
        data-device-id="${esc(d.deviceId)}" data-device-kind="${d.kind}">${esc(d.label)}</button>`).join('')}
    </div>
  </section>`;
}

/**
 * Open the device chooser. Resolves the chosen { deviceId, kind }, or null on
 * cancel. Only cameras/mics that exist are shown; a kind with a single device is
 * still listed (so the label is visible) but the caller may choose not to open the
 * picker at all when there is nothing to switch between.
 */
export async function openDevicePicker(opts: DevicePickerOpts = {}): Promise<DevicePickerResult | null> {
  const t = opts.t ?? ((s: string) => s);
  const { cameras, mics } = await enumerateInputs();
  const showCameras = opts.kind !== 'audioinput' && cameras.length > 0;
  const showMics = opts.kind !== 'videoinput' && mics.length > 0;

  const content = `
    <h2 class="modal-title">${escape(opts.title ?? t('Choose a device'))}</h2>
    <div class="devpick-body">
      ${showCameras ? section(t('Camera'), cameras, opts.currentCameraId, escape) : ''}
      ${showMics ? section(t('Microphone'), mics, opts.currentMicId, escape) : ''}
      ${!showCameras && !showMics ? `<p class="modal-msg">${escape(t('No cameras or microphones were found.'))}</p>` : ''}
    </div>
    <div class="modal-actions">
      <button type="button" class="modal-plain" data-act="cancel">${escape(t('Close'))}</button>
    </div>`;

  return new Promise<DevicePickerResult | null>((resolve) => {
    const modal = mountModal<DevicePickerResult | null>(content, {
      className: 'modal devpick',
      cancelValue: null,
      ariaLabel: opts.title ?? t('Choose a device'),
      initialFocus: (el) => el.querySelector<HTMLElement>('.devpick-item.is-current, .devpick-item'),
      onClose: (result) => resolve(result ?? null),
    });
    modal.el.addEventListener('click', (e) => {
      const item = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-device-id]') : null;
      if (item) { modal.close({ deviceId: item.dataset.deviceId!, kind: item.dataset.deviceKind as DeviceKind }); return; }
      if (e.target instanceof Element && e.target.closest('[data-act]')) modal.close(null);
    });
  });
}
