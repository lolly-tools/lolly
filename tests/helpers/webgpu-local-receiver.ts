// SPDX-License-Identifier: MPL-2.0
/** Runs the same qualification corpus in an owned Safari or packaged WKWebView page. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export interface QualificationPage {
  goto(url: string): Promise<void>;
  waitForFunction(fn: () => unknown): Promise<void>;
  evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<Awaited<R>>;
  close(): Promise<void>;
}
export interface QualificationBrowser {
  newPage(): Promise<QualificationPage>;
  version(): string;
  close(): Promise<void>;
  handleRequest?(req: IncomingMessage, res: ServerResponse): boolean;
  receiverScript?: string;
}

interface Command { id: number; source: string; arg?: unknown }
interface Pending { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }

/** Entirely local collector. Unknown page IDs never receive test commands. */
export function localReceiverBrowser(kind: 'safari-local' | 'firefox-local' | 'tauri-macos' | 'tauri-windows' | 'tauri-linux' | 'ios-simulator' | 'android-webview'): QualificationBrowser {
  const actors = new Map<string, { commands: Command[]; pending: Map<number, Pending>; answered: boolean; retired: boolean; child?: ChildProcess }>();
  let commandId = 0;
  const externalBrowser = kind === 'safari-local' || kind === 'firefox-local';
  const version = externalBrowser
    ? execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', `/Applications/${kind === 'safari-local' ? 'Safari' : 'Firefox'}.app/Contents/Info.plist`], { encoding: 'utf8' }).trim()
    : process.env.LOLLY_WEBGPU_NATIVE_VERSION;
  if (!version) throw new Error('Native webview qualification needs its recorded runtime version.');
  const enqueue = (actor: ReturnType<typeof actors.get>, source: string, arg?: unknown): Promise<unknown> => {
    if (!actor) throw new Error('Qualification page is closed.');
    const id = ++commandId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { actor.pending.delete(id); reject(new Error('Local qualification page did not answer within 30 seconds.')); }, 30_000);
      actor.pending.set(id, { resolve, reject, timer }); actor.commands.push({ id, source, arg });
    });
  };
  const receiverScript = `
    const actor = new URL(location.href).searchParams.get('qualification');
    if (actor) {
      const base = '/_qualification/' + encodeURIComponent(actor);
      (async () => { while (!window.__lollyQualificationClosed) {
        const commands = await (await fetch(base + '/next')).json();
        for (const command of commands) {
          let reply;
          try { const value = await (0,eval)('(' + command.source + ')')(command.arg); reply = { id: command.id, value: value ?? null }; }
          catch (error) { reply = { id: command.id, error: String(error), stack: error?.stack }; }
          await fetch(base + '/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(reply) });
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      } })().catch(error => { document.body.textContent = 'Qualification receiver failed: ' + error; });
    }`;
  const handleRequest = (req: IncomingMessage, res: ServerResponse): boolean => {
    const match = /^\/_qualification\/([a-f0-9-]+)\/(next|reply)$/.exec(req.url ?? '');
    if (!match) return false;
    const actor = actors.get(match[1]!);
    res.setHeader('cache-control', 'no-store'); res.setHeader('content-type', 'application/json');
    if (!actor) { res.statusCode = 404; res.end('{}'); return true; }
    if (match[2] === 'next' && req.method === 'GET') { res.end(JSON.stringify(actor.commands.splice(0))); return true; }
    if (match[2] !== 'reply' || req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return true; }
    const parts: Buffer[] = []; let bytes = 0;
    req.on('data', chunk => { bytes += chunk.length; if (bytes > 16 * 1024 * 1024) req.destroy(); else parts.push(chunk); });
    req.on('end', () => {
      try {
        const reply = JSON.parse(Buffer.concat(parts).toString());
        const pending = actor.pending.get(reply.id);
        if (!pending) throw new Error('Unknown qualification command.');
        actor.answered = true; actor.pending.delete(reply.id); clearTimeout(pending.timer);
        if (reply.error) pending.reject(new Error(`${reply.error}\n${reply.stack ?? ''}`)); else pending.resolve(reply.value);
        res.end('{}');
      } catch { res.statusCode = 400; res.end('{}'); }
    });
    return true;
  };
  const closeActor = async (actor: NonNullable<ReturnType<typeof actors.get>>) => {
    if (actor.answered && !actor.retired && !actor.pending.size) {
      await enqueue(actor, "() => { window.__lollyQualificationClosed = true; document.body.textContent = 'Qualification complete. Results were saved by the local test runner.'; return true; }").catch(() => {});
    }
    for (const pending of actor.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Qualification page closed.')); }
    actor.child?.kill();
  };
  return {
    version: () => version,
    receiverScript, handleRequest,
    async newPage() {
      const id = randomUUID(), actor = { commands: [] as Command[], pending: new Map<number, Pending>(), answered: false, retired: false, child: undefined as ChildProcess | undefined };
      actors.set(id, actor);
      return {
        async goto(url) {
          const address = new URL(url); address.searchParams.set('qualification', id);
          const request = process.env.LOLLY_WEBGPU_OPEN_REQUEST;
          if (request) writeFileSync(request, JSON.stringify({ url: address.href, page: id }) + '\n');
          if (kind === 'ios-simulator' || kind === 'android-webview') {
            for (const [otherId, other] of actors) if (otherId !== id) {
              if (other.pending.size) throw new Error('An earlier native qualification page still has an active command.');
              other.retired = true;
            }
          }
          if (kind === 'ios-simulator') {
            const device = process.env.LOLLY_WEBGPU_IOS_DEVICE;
            if (!device) throw new Error('Owned iOS simulator is not configured.');
            actor.child = spawn('xcrun', ['simctl', 'launch', '--terminate-running-process', device, 'tools.lolly.WebGpuQualification', address.href], { stdio: 'ignore' });
          } else if (!externalBrowser) {
            const binary = process.env.LOLLY_WEBGPU_NATIVE_BINARY;
            if (!binary) throw new Error('Native qualification binary is not configured.');
            actor.child = spawn(binary, [address.href], { stdio: 'ignore' });
          } else {
            if (!request) throw new Error('Native browser qualification needs a local open-request file.');
            console.log(`Open an owned ${kind === 'safari-local' ? 'Safari' : 'Firefox'} qualification tab: ${address.href}`);
          }
        },
        async evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<Awaited<R>> {
          return await enqueue(actors.get(id), fn.toString(), arg) as Awaited<R>;
        },
        async waitForFunction(fn) {
          const started = Date.now();
          while (!await enqueue(actors.get(id), fn.toString())) {
            if (Date.now() - started > 30_000) throw new Error('Qualification page did not become ready.');
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        },
        async close() {
          await closeActor(actor); actors.delete(id);
        },
      };
    },
    async close() {
      for (const actor of actors.values()) await closeActor(actor);
      actors.clear();
    },
  };
}
