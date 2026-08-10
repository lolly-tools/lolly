// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom); same ambient-shim pattern
// as shells/{cli,web,tui}/src/jsdom.d.ts, narrowed to what scripts use —
// gen-shutter-mark.ts parses icon.svg with a contentType option and walks the
// resulting document via the standard DOM surface.
declare module 'jsdom' {
  export interface JSDOMOptions {
    contentType?: string;
  }
  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
  }
}
