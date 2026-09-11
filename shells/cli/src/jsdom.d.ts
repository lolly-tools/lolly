// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom); the CLI touches only the
// DOM surface JSDOM exposes, so declare exactly that. `window` is a full DOM
// Window so the engine + Handlebars type-check against lib.dom (no APIs are
// used at runtime that jsdom doesn't implement). This is an ambient module
// declaration (a non-module .d.ts), not an augmentation of the untyped package.
declare module 'jsdom' {
  /** The subset of jsdom's VirtualConsole the CLI uses: an EventEmitter whose
   *  'jsdomError' + console-level events we listen to (see quietVirtualConsole in
   *  run.ts, which stops a designed feature-detection path printing a stack trace). */
  export class VirtualConsole {
    on(event: 'jsdomError', listener: (err: Error) => void): this;
    on(event: 'error' | 'warn' | 'info' | 'log' | 'debug', listener: (...args: unknown[]) => void): this;
    sendTo(console: Console): this;
  }
  export interface JSDOMOptions {
    virtualConsole?: VirtualConsole;
  }
  export class JSDOM {
    constructor(html?: string, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
  }
}
