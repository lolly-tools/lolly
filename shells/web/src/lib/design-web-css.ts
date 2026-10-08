// SPDX-License-Identifier: MPL-2.0
import { generate, ident, parse, walk } from 'css-tree';

export const WEB_CSS_LIMIT = 16_384;
const GROUPS = new Set(['media', 'supports', 'container', 'layer', 'scope', 'keyframes', '-webkit-keyframes', 'starting-style']);
const RESOURCE_FUNCTIONS = new Set(['url', 'src', 'image', 'image-set', '-webkit-image-set', 'expression']);

/** Local appearance rules cannot add network requests to a collaborator's page. */
export function compileWebCss(source: string): string {
  if (source.length > WEB_CSS_LIMIT) throw new Error('Page CSS is limited to 16 KB.');
  const tree = parse(source, { parseCustomProperty: true, onParseError(error) { throw error; } });
  let count = 0;
  walk(tree, node => {
    if (++count > 20_000) throw new Error('Page CSS has too many rules.');
    if (node.type === 'Raw') throw new Error('Complete each CSS rule before applying.');
    if (node.type === 'Declaration' && node.value.type === 'Value' && node.value.children.isEmpty) {
      throw new Error('Complete each CSS declaration before applying.');
    }
    if (node.type === 'Url'
      || (node.type === 'Function' && RESOURCE_FUNCTIONS.has(ident.decode(node.name).toLowerCase()))
      || (node.type === 'Atrule' && !GROUPS.has(ident.decode(node.name).toLowerCase()))
      || (node.type === 'Declaration' && ['behavior', '-moz-binding'].includes(ident.decode(node.property).toLowerCase()))) {
      throw new Error('Page CSS supports appearance rules without imports, fonts or resource URLs.');
    }
  });
  return generate(tree);
}

// Specific consent providers only. A user can target another banner in Page CSS.
export const COOKIE_BANNER_CSS = `
#onetrust-banner-sdk, #onetrust-pc-sdk, .onetrust-pc-dark-filter,
#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #didomi-host,
#truste-consent-track, #truste-consent-content, #trustarc-banner-overlay,
.osano-cm-window, .osano-cm-dialog { display: none !important; }
html:has(#onetrust-banner-sdk), body:has(#onetrust-banner-sdk),
html:has(#CybotCookiebotDialog), body:has(#CybotCookiebotDialog) { overflow: auto !important; }
`;

interface Appearance {
  css: string;
  source?: string;
  hide: boolean;
  style?: HTMLStyleElement;
  load: () => void;
}
const appearances = new WeakMap<HTMLIFrameElement, Appearance>();

function paint(frame: HTMLIFrameElement, state: Appearance): void {
  try {
    const doc = frame.contentDocument;
    // Never style an initial blank page, a redirected external page, or an opaque frame.
    if (!doc?.head || doc.URL === 'about:blank' || new URL(doc.URL).origin !== location.origin) return;
    const text = state.css + (state.hide ? COOKIE_BANNER_CSS : '');
    if (state.style?.isConnected && state.style.ownerDocument === doc && state.style.textContent === text) return;
    state.style?.remove();
    state.style = undefined;
    if (!state.css && !state.hide) return;
    const style = doc.createElement('style');
    style.dataset.lollyPageAppearance = '';
    style.textContent = text;
    doc.head.appendChild(style);
    state.style = style;
  } catch { /* The page changed origin; its appearance remains under its own control. */ }
}

/** Reuse one stylesheet and load listener while the editor parks a live frame. */
export function updateWebAppearance(frame: HTMLIFrameElement, marker: HTMLElement): void {
  let state = appearances.get(frame);
  if (!state) {
    state = { css: '', hide: false, load: () => { const current = appearances.get(frame); if (current) paint(frame, current); } };
    appearances.set(frame, state);
    frame.addEventListener('load', state.load);
  }
  const source = marker.dataset.webCss ?? '';
  if (state.source !== source) {
    state.source = source;
    try { state.css = compileWebCss(source); }
    catch { state.css = ''; } // Invalid shared rules never reach a live page.
  }
  state.hide = marker.dataset.webHideCookies === '1';
  paint(frame, state);
}

export function clearWebAppearance(frame: HTMLIFrameElement): void {
  const state = appearances.get(frame);
  if (!state) return;
  frame.removeEventListener('load', state.load);
  state.style?.remove();
  appearances.delete(frame);
}
