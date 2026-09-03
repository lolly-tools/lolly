// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom). The tests project pulls
// shells/cli/src/run.ts (and its jsdom imports) into its own program via
// cli-smoke.test.ts, and a project's ambient .d.ts files don't travel across
// tsconfig boundaries - so this is the same minimal shim every shell carries
// (shells/{cli,tui,web}/src/jsdom.d.ts), declared once for the tests program.
// Keep it in step with shells/cli/src/jsdom.d.ts: run.ts's quietVirtualConsole
// needs the VirtualConsole class and the JSDOM options bag.
declare module 'jsdom' {
  export class VirtualConsole {
    on(event: 'jsdomError', listener: (err: Error) => void): this;
    on(event: 'error' | 'warn' | 'info' | 'log' | 'debug', listener: (...args: unknown[]) => void): this;
    sendTo(console: Console): this;
  }
  export interface JSDOMOptions {
    virtualConsole?: VirtualConsole;
    /** The realm's document URL. A suite that drives web-shell view code needs a real
     *  origin: the default `about:blank` is opaque, so storage and history reads throw. */
    url?: string;
  }
  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
  }
}
