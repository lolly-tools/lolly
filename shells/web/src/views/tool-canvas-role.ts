// SPDX-License-Identifier: MPL-2.0
import type { ToolManifest } from '@lolly/engine';

export function toolCanvasRole(
  manifest: Pick<ToolManifest, 'id' | 'render'>,
  hasExportFile: boolean,
  hideSidebar: boolean,
): 'group' | 'img' {
  return hasExportFile || manifest.id === '3d-studio' || hideSidebar ||
    manifest.render.webPreview === true || manifest.render.sidebar === false || manifest.render.export === false
    ? 'group' : 'img';
}

/**
 * What a person can operate inside a canvas: form controls, links, a player with its
 * own controls, an embedded page, anything that takes keyboard focus and anything that
 * declares a widget role.
 */
const CANVAS_CONTROL = [
  'button', 'a[href]', 'input:not([type="hidden"])', 'select', 'textarea', 'summary',
  'audio[controls]', 'video[controls]', 'iframe',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])',
  '[role="button"]', '[role="link"]', '[role="slider"]', '[role="checkbox"]', '[role="switch"]', '[role="tab"]', '[role="textbox"]',
].join(', ');
/** The attributes whose change can make an element a control, or show or hide one. */
const CONTROL_ATTRIBUTES = ['hidden', 'inert', 'aria-hidden', 'tabindex', 'href', 'contenteditable', 'type', 'controls', 'role'];

/**
 * The role of a canvas after a paint. An image role tells assistive technology that
 * the element has no children, so a control inside one cannot be reached. A canvas
 * whose markup holds a control is a group, whatever the manifest says: URL
 * Screenshot's capture button and a tool's own slider are both found this way. A
 * control that the canvas hides, makes inert or keeps from assistive technology does
 * not count.
 */
export function paintedCanvasRole(base: 'group' | 'img', content: ParentNode): 'group' | 'img' {
  if (base === 'group') return 'group';
  for (const control of content.querySelectorAll(CANVAS_CONTROL)) {
    // Only what the canvas itself hides counts. While a dialog is open the whole page
    // is inert, and that says nothing about the canvas.
    const hiddenBy = control.closest('[hidden], [inert], [aria-hidden="true"]');
    if (!hiddenBy || !content.contains(hiddenBy)) return 'group';
  }
  return 'img';
}

/**
 * Keep a canvas's role true to what the canvas holds, for as long as the view is
 * mounted. Returns the function that ends the watch.
 *
 * One check after the paint is not enough: a control often arrives later. A map adds
 * its zoom buttons when its script has run, and the Design editor adds its boxes after
 * the first paint. The canvas is watched until its first control shows. From then on
 * the canvas stays a group: a group with a label is right for a picture too, and a role
 * that changed back and forth would be announced each time.
 */
export function watchCanvasRole(holder: Element, content: Element): () => void {
  const view = content.ownerDocument.defaultView;
  const Observer = view?.MutationObserver;
  let frame = 0;
  let done = false;
  let observer: MutationObserver | null = null;
  const stop = (): void => {
    done = true;
    observer?.disconnect();
    if (frame) view?.cancelAnimationFrame(frame);
    frame = 0;
  };
  const check = (): void => {
    frame = 0;
    if (done || paintedCanvasRole('img', content) === 'img') return;
    holder.setAttribute('role', 'group');
    stop();
  };
  check();
  if (done || !Observer || !view) return stop;
  // Many changes in one frame cost one check.
  observer = new Observer(() => { if (!frame && !done) frame = view.requestAnimationFrame(check); });
  observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: CONTROL_ATTRIBUTES });
  return stop;
}
