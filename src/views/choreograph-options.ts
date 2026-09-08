// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { SVG } from './free-canvas-icons.ts';
import type { ShowcaseId } from './choreograph.ts';

export const CHOREO_SHOWCASES: ReadonlyArray<{
  id: ShowcaseId;
  label: string;
  sub: string;
  ms: number;
  icon: string;
  quick?: boolean;
}> = [
  {
    id: 'buildup',
    label: t('Buildup'),
    sub: t('Assemble from nothing'),
    ms: 3000,
    icon: SVG.front,
  },
  {
    id: 'deconstruct',
    label: t('Deconstruct'),
    sub: t('Fly apart at the end'),
    ms: 2500,
    icon: SVG.ungroup,
  },
  {
    id: 'loop',
    label: t('The Loop'),
    sub: t('Assemble, hold, fly apart - cycles as a GIF'),
    ms: 6000,
    icon: SVG.rotate,
  },
  {
    id: 'hero',
    label: t('Hero arc'),
    sub: t('Explode, fly through, come home'),
    ms: 6000,
    icon: SVG.choreo,
  },
  {
    id: 'trench',
    label: t('Trench run'),
    sub: t('A small lift, the camera flies between'),
    ms: 5000,
    icon: SVG.camera,
  },
  {
    id: 'scan',
    label: t('Map-scan'),
    sub: t('Hardly raised, the camera scans the page'),
    ms: 8000,
    icon: SVG.move,
  },
  { id: 'editorial-reveal', label: t('Editorial reveal'), sub: t('Lift, settle, leave room to read'), ms: 6000, icon: SVG.front, quick: true },
  { id: 'type-snap', label: t('Type snap'), sub: t('Anticipate, snap, settle'), ms: 6000, icon: SVG.choreo, quick: true },
  { id: 'feature-cascade', label: t('Feature cascade'), sub: t('Deal the layers in a measured sequence'), ms: 6000, icon: SVG.front, quick: true },
  { id: 'assemble-loop', label: t('Assemble loop'), sub: t('Arrive, hold, unwind, repeat'), ms: 6000, icon: SVG.rotate, quick: true },
];

/** Reflect the recipe without offering float/3-D controls that it cannot use. */
export function reflectChoreographChoice(panel: HTMLElement, id: ShowcaseId): void {
  for (const card of panel.querySelectorAll<HTMLButtonElement>('[data-choreo]')) {
    const on = card.dataset.choreo === id;
    card.setAttribute('aria-checked', on ? 'true' : 'false');
    card.tabIndex = on ? 0 : -1;
  }
  const articulated = !!CHOREO_SHOWCASES.find(recipe => recipe.id === id)?.quick;
  for (const input of panel.querySelectorAll<HTMLInputElement>('[data-choreo-float], [data-choreo-tumble]')) {
    input.disabled = articulated;
    if (articulated) input.checked = false;
  }
}
