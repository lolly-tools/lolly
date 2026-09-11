// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom); the web shell only touches
// jsdom from its node:test unit tests (e.g. view-fade.test.ts), so declare exactly
// that surface. `window` is a full DOM Window so tests type-check against lib.dom.
// This mirrors shells/cli/src/jsdom.d.ts and shells/tui/src/jsdom.d.ts - an ambient
// module declaration (a non-module .d.ts), not an augmentation of the untyped package.
declare module 'jsdom' {
  /** Where jsdom routes a page's own errors. Declared for the same reason
   *  shells/cli/src/run.ts has quietVirtualConsole: a test can then swallow the
   *  noise jsdom makes over CSS its parser is too old to understand. */
  export class VirtualConsole {
    on(event: 'jsdomError', listener: (err: Error) => void): this;
  }
  export class JSDOM {
    constructor(html?: string, options?: { pretendToBeVisual?: boolean; [key: string]: unknown });
    readonly window: Window & typeof globalThis;
    /** Re-point the document's URL without rebuilding the DOM - how
     *  back-pill.test.ts walks the router through a sequence of views. */
    reconfigure(settings: { url?: string; windowTop?: unknown }): void;
  }
}
