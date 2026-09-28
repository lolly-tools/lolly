// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom); same ambient-shim pattern
// as shells/{cli,web,tui}/src/jsdom.d.ts, narrowed to what scripts use -
// gen-shutter-mark.ts parses icon.svg with a contentType option and walks the
// resulting document via the standard DOM surface; tool-history-audit.ts gives
// its document a URL and a silent console.
declare module 'jsdom' {
  /** A console that drops jsdom's messages unless it is sent somewhere. */
  export class VirtualConsole {
    sendTo(console: Console): this;
  }
  export interface JSDOMOptions {
    contentType?: string;
    url?: string;
    virtualConsole?: VirtualConsole;
  }
  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
  }
}
