// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations; the TUI (like the CLI) touches only the DOM
// surface JSDOM exposes. Mirrors shells/cli/src/jsdom.d.ts.
declare module 'jsdom' {
  // Only the options the shells actually pass: `runScripts`/`pretendToBeVisual` let the
  // interactive canvas execute a tool's own <script> in a live DOM.
  export interface ConstructorOptions {
    runScripts?: 'dangerously' | 'outside-only';
    pretendToBeVisual?: boolean;
    url?: string;
    resources?: string;
  }
  export class JSDOM {
    constructor(html?: string, options?: ConstructorOptions);
    readonly window: Window & typeof globalThis;
  }
}
