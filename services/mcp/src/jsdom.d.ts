// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom); the MCP server touches only
// the DOM surface JSDOM exposes, so declare exactly that (mirrors
// shells/cli/src/jsdom.d.ts). This is an ambient module declaration.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
