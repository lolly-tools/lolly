// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom). Mirrors the minimal shim
// every shell carries (shells/{cli,tui,web}/src/jsdom.d.ts) — just the surface
// this package's dock.test.ts uses: the JSDOM constructor + its window.
declare module 'jsdom' {
  export interface JSDOMOptions {
    url?: string;
    pretendToBeVisual?: boolean;
  }
  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
  }
}
