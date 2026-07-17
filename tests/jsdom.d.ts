// SPDX-License-Identifier: MPL-2.0
// jsdom ships no type declarations (no @types/jsdom). The tests project pulls
// shells/cli/src/run.ts (and its jsdom imports) into its own program via
// cli-smoke.test.ts, and a project's ambient .d.ts files don't travel across
// tsconfig boundaries — so this is the same minimal shim every shell carries
// (shells/{cli,tui,web}/src/jsdom.d.ts), declared once for the tests program.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
