// SPDX-License-Identifier: MPL-2.0
/** Shared canvas-space policy for Design panels and compact actions. */
import { currentLayout, isSplitLayout } from './layout-posture.ts';

/**
 * Compact Design: the bottom action bar and the inspector as a sheet. Never in two
 * panes (lib/layout-posture.ts): there the inspector, layers and export are tabs in
 * the control pane, beside the canvas, whatever the window's width.
 */
export function compactDesignViewport(): boolean {
  if (isSplitLayout()) return false;
  const width = window.visualViewport?.width ?? window.innerWidth;
  const height = window.visualViewport?.height ?? window.innerHeight;
  const touch = !!window.matchMedia?.('(any-pointer: coarse)').matches;
  return width <= 640 || (touch && (width <= 900 || height <= 500));
}

/** The touch screens where Design's tool rail is a horizontal palette at the foot of
 *  the stage rather than a vertical rail. */
export const TOUCH_PALETTE_QUERY = '(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)';

/**
 * Is the tool rail the bottom palette? On a small touch screen, and on a tabletop
 * fold, where the canvas pane is short and wide and its foot is where the thumbs are.
 */
export function toolPaletteAtFoot(): boolean {
  if (isSplitLayout()) return currentLayout().posture === 'tabletop';
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(TOUCH_PALETTE_QUERY).matches;
}

/**
 * Is the tool rail pinned upright along the canvas pane's outer edge? In two side by
 * side panes: the pane is tall, and its outer edge is under the drawing thumb and
 * away from the crease. styles/parts/split.css places the rail.
 */
export function toolRailOnEdge(): boolean {
  return isSplitLayout() && currentLayout().posture !== 'tabletop';
}

export function designPanelsFit(width: number, navigator: number, inspector: number): boolean {
  return width - navigator - inspector >= Math.min(480, width * 0.5);
}

export function stageBottomReserve(style: CSSStyleDeclaration): number {
  const px = (name: string): number => Math.max(0, parseFloat(style.getPropertyValue(name)) || 0);
  if (style.getPropertyValue('--rules-workspace') === '1') return px('--rules-bottom');
  return Math.max(px('--stage-reserve-bottom'), px('--design-panel-reserve')) + px('--design-actions-h') + px('--design-viewport-inset');
}

/** Rules temporarily owns the canvas edges while the editor's panels are parked. */
export function stageSideReserve(style: CSSStyleDeclaration, edge: 'top' | 'left' | 'right'): number {
  const px = (name: string): number => Math.max(0, parseFloat(style.getPropertyValue(name)) || 0);
  if (style.getPropertyValue('--rules-workspace') === '1') return px(`--rules-${edge}`);
  return Math.max(px(`--stage-reserve-${edge}`), edge === 'top' ? px('--stage-rulers-bottom') : edge === 'left' ? px('--stage-rulers-right') : 0);
}

export function panelStageHeight(stage: HTMLElement): number {
  const style = getComputedStyle(stage);
  return Math.max(0, stage.getBoundingClientRect().height
    - (parseFloat(style.getPropertyValue('--stage-reserve-top')) || 0)
    - (parseFloat(style.getPropertyValue('--design-actions-h')) || 0)
    - (parseFloat(style.getPropertyValue('--design-viewport-inset')) || 0));
}

export function compactActionsHeight(): number {
  return document.querySelector('.design-compact-actions')?.getBoundingClientRect().height || 60;
}
