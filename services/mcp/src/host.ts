// SPDX-License-Identifier: MPL-2.0
/**
 * The headless HostV1 for server-side rendering.
 *
 * We reuse the CLI's Node bridge (createCliBridge), the canonical "same engine,
 * different transport" host, rather than duplicating asset resolution / export
 * logic. Two adaptations for a server context:
 *   1. log() is redirected to stderr. In stdio transport, stdout IS the JSON-RPC
 *      channel, so the CLI bridge's stdout logging would corrupt it.
 *   2. jsdom globals are set per render and restored, and renders are serialized
 *      through a mutex (jsdom mutates shared globalThis). This is safe, but not
 *      maximally concurrent. Worker-thread pooling is a later optimization (roadmap).
 *
 * NOTE (roadmap): depending on shells/cli couples a service to a shell. Before
 * splitting this package out, extract createCliBridge into a shared node-host
 * module. See plans/77-mcp-server.md section 7 + section 13.
 */

import { createCliBridge } from '../../../shells/cli/src/bridge.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

type Jsdom = { window: Window & typeof globalThis };

// Serialize renders: each mutates globalThis.{window,document,Element}.
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}

/**
 * Run `fn` with a fresh jsdom DOM + a headless host bound to `profile`. Globals
 * are installed for the duration and restored afterward. Serialized process-wide.
 */
export function withHost<T>(profile: Profile, fn: (dom: Jsdom, host: HostV1) => Promise<T>): Promise<T> {
  return enqueue(async () => {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>') as unknown as Jsdom;
    const g = globalThis as Record<string, unknown>;
    const prev = { window: g['window'], document: g['document'], Element: g['Element'] };
    g['window'] = dom.window;
    g['document'] = dom.window.document;
    g['Element'] = (dom.window as unknown as { Element: unknown }).Element;
    try {
      // A hosted process: a hook's host.capture.page may only reach public http(s)
      // pages, never the worker's own network (cloud metadata, localhost, RFC 1918).
      const host = await createCliBridge({ dom: dom as never, profile, capturePublicOnly: true, aiEnabled: false });
      // Redirect logging to stderr (never stdout - it is the stdio protocol channel).
      (host as { log: HostV1['log'] }).log = (level, msg, ctx) => {
        process.stderr.write(`[mcp:${level}] ${msg}${ctx ? ' ' + safeJson(ctx) : ''}\n`);
      };
      return await fn(dom, host);
    } finally {
      g['window'] = prev.window;
      g['document'] = prev.document;
      g['Element'] = prev.Element;
      try { (dom.window as unknown as { close?: () => void }).close?.(); } catch { /* ignore */ }
    }
  });
}
