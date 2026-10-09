// SPDX-License-Identifier: MPL-2.0
/** The maintained corpus in an owned, normally started bundled desktop GUI. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { productProbeIdentity, productProbeOptions } from '../../shells/tauri-desktop/webgpu-product-probe.mjs';
import { TAURI_CSP } from '../../shells/tauri-shared/vite-csp.mjs';
import type { QualificationBrowser, QualificationPage } from './webgpu-local-receiver.ts';
import { runtimeOverrides } from '../../scripts/verify-webgpu-native.ts';

export const PRODUCT_PAGE = 'lolly-product://main';
export const PRODUCT_COMMAND_LIMIT = 1024 * 1024;
export const PRODUCT_REPLY_LIMIT = 16 * 1024 * 1024;
const SOURCE_LIMIT = 64 * 1024;
const OUTPUT_PREFIX = 'LOLLY_WEBGPU_PRODUCT ';
export const PRODUCT_DIAGNOSTIC_LIMIT = 16;
export const PRODUCT_SOURCE_PREFIX_BYTES = 192;
export type ProductPhase = 'native-handshake' | 'onboarding-poll' | 'csp' | 'probe-load' | 'tool-wait' | 'corpus' | 'closing';
interface CommandDiagnostic { id: number; phase: ProductPhase; sourceSha256: string; sourceBytes: number; sourcePrefix: string }
interface ProtocolDiagnostic { phase: ProductPhase; pendingCommand: CommandDiagnostic | null }
interface ProductDiagnostic extends ProtocolDiagnostic { event: 'startup-phase' | 'protocol-failure'; message?: string }

function bytePrefix(value: string, limit: number): string {
  let prefix = '', bytes = 0;
  for (const character of value) {
    const length = Buffer.byteLength(character); if (bytes + length > limit) break;
    prefix += character; bytes += length;
  }
  return prefix;
}

/** Host-only evidence never includes command arguments or changes the wire. */
export function productDiagnosticRecorder(records: Array<Record<string, unknown>>, write: (line: string) => void = line => { process.stderr.write(line); }): (entry: ProductDiagnostic) => void {
  let count = 0;
  return entry => {
    if (count >= PRODUCT_DIAGNOSTIC_LIMIT) return;
    count++;
    const command = entry.pendingCommand;
    const record = { event: entry.event, phase: entry.phase,
      pendingCommand: command ? { id: command.id, phase: command.phase, sourceSha256: command.sourceSha256,
        sourceBytes: command.sourceBytes, sourcePrefix: bytePrefix(command.sourcePrefix, PRODUCT_SOURCE_PREFIX_BYTES) } : null,
      ...(entry.message === undefined ? {} : { message: bytePrefix(entry.message, 2048) }) };
    records.push(record);
    write('LOLLY_WEBGPU_PRODUCT_DIAGNOSTIC ' + JSON.stringify(record) + '\n');
  };
}

class ProductCommandError extends Error {
  readonly diagnostic: ProtocolDiagnostic;
  constructor(error: Error, diagnostic: ProtocolDiagnostic) {
    super(`${bytePrefix(error.message, 2048)}\nProduct host diagnostic: ${JSON.stringify(diagnostic)}`, { cause: error });
    this.diagnostic = diagnostic;
  }
}

interface Pending { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout>; command: CommandDiagnostic }
export interface ProductReady {
  event: 'ready'; runId: string; url: string; nativeUrl: string; identifier: string;
  runtime: string; secureContext: boolean; os: string; architecture: string;
}
export interface ProductTransport {
  platform: 'ios';
  launch(): ChildProcessWithoutNullStreams;
  runtime(ready: ProductReady): string;
  close(child: ChildProcessWithoutNullStreams): Promise<void>;
}
interface ProductReply { event: 'reply'; runId: string; reply: { id: number; value?: unknown; error?: string; stack?: string } }
interface ProductFailure { event: 'failure'; runId: string; error: string }
type ProductMessage = ProductReady | ProductReply | ProductFailure;

export function isProductUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'tauri:' && url.hostname === 'localhost' && !url.port && !url.username && !url.password;
  } catch { return false; }
}

function onlyFields(object: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(object).every(key => fields.includes(key));
}

export function decodeProductMessage(line: string, runId: string, platform: 'macos' | 'ios' = 'macos'): ProductMessage {
  if (!line.startsWith(OUTPUT_PREFIX) || Buffer.byteLength(line) > PRODUCT_REPLY_LIMIT + 4096) throw new Error('Invalid product qualification output frame.');
  const row: unknown = JSON.parse(line.slice(OUTPUT_PREFIX.length));
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Malformed product qualification message.');
  const object = row as Record<string, unknown>;
  if (object.runId !== runId) throw new Error('Product qualification reply has a different run ID.');
  if (object.event === 'ready') {
    if (!onlyFields(object, ['event', 'runId', 'url', 'nativeUrl', 'identifier', 'runtime', 'secureContext', 'os', 'architecture'])
      || object.identifier !== productProbeIdentity(runId) || !isProductUrl(object.url) || !isProductUrl(object.nativeUrl)
      || typeof object.secureContext !== 'boolean' || typeof object.runtime !== 'string' || !object.runtime || (platform === 'macos' && object.runtime.startsWith('unavailable:'))
      || object.os !== platform || typeof object.architecture !== 'string' || (platform === 'ios' && object.architecture !== 'aarch64')) throw new Error('Product qualification did not start on its exact owned bundled origin/runtime.');
  } else if (object.event === 'reply') {
    const reply = object.reply as Record<string, unknown> | undefined;
    if (!onlyFields(object, ['event', 'runId', 'reply']) || !reply || typeof reply !== 'object' || Array.isArray(reply)
      || !onlyFields(reply, ['id', 'value', 'error', 'stack']) || !Number.isSafeInteger(reply.id) || Number(reply.id) < 1
      || ('error' in reply && typeof reply.error !== 'string') || ('stack' in reply && typeof reply.stack !== 'string')
      || Buffer.byteLength(JSON.stringify(reply)) > PRODUCT_REPLY_LIMIT) throw new Error('Malformed product qualification reply.');
  } else if (object.event === 'failure') {
    if (!onlyFields(object, ['event', 'runId', 'error']) || typeof object.error !== 'string' || object.error.length > 2048) throw new Error('Malformed product qualification failure.');
  } else throw new Error('Unknown product qualification event.');
  return row as ProductMessage;
}

/** A single ordered request prevents unbounded native/page work queues. */
export class ProductProbeProtocol {
  readonly runId: string;
  readonly write: (line: string) => void;
  readonly onReady: (ready: ProductReady) => void;
  readonly onFailure: (error: Error) => void;
  private id = 0;
  private pending: Pending | null = null;
  private platform: 'macos' | 'ios';
  private ready = false;
  private failure: Error | null = null;
  private phase: ProductPhase = 'corpus';
  constructor(runId: string, write: (line: string) => void, onReady: (ready: ProductReady) => void, onFailure: (error: Error) => void = () => {}, platform: 'macos' | 'ios' = 'macos') {
    productProbeIdentity(runId); this.runId = runId; this.write = write; this.onReady = onReady; this.onFailure = onFailure; this.platform = platform;
  }
  setPhase(phase: ProductPhase): void { this.phase = phase; }
  diagnostic(): ProtocolDiagnostic { return { phase: this.pending?.command.phase ?? this.phase, pendingCommand: this.pending ? { ...this.pending.command } : null }; }
  fail(error: Error): void {
    if (this.failure) return;
    this.failure = new ProductCommandError(error, this.diagnostic());
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(this.failure); this.pending = null; }
    this.onFailure(this.failure);
  }
  receive(line: string): void {
    try {
      const row = decodeProductMessage(line, this.runId, this.platform);
      if (this.failure) throw this.failure;
      if (row.event === 'ready') {
        if (this.ready) throw new Error('Product qualification repeated its handshake.');
        this.ready = true; this.onReady(row);
      } else if (row.event === 'failure') throw new Error(row.error);
      else {
        if (!this.pending || row.reply.id !== this.id) throw new Error('Product qualification reply sequence differs.');
        const pending = this.pending; this.pending = null; clearTimeout(pending.timer);
        if (row.reply.error !== undefined) pending.reject(new ProductCommandError(new Error(`${row.reply.error}\n${row.reply.stack ?? ''}`), { phase: pending.command.phase, pendingCommand: pending.command }));
        else pending.resolve(row.reply.value);
      }
    } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
  }
  request(source: string, arg?: unknown, close = false): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    if (!this.ready || this.pending) return Promise.reject(new Error('Product qualification is not ready or has a pending command.'));
    if (!source || Buffer.byteLength(source) > SOURCE_LIMIT || this.id >= 10_000) return Promise.reject(new Error('Product qualification command exceeds its source/sequence bound.'));
    const id = this.id + 1;
    let line: string;
    try { line = JSON.stringify({ id, source, arg: arg ?? null, close }) + '\n'; }
    catch (error) { return Promise.reject(error); }
    if (Buffer.byteLength(line) > PRODUCT_COMMAND_LIMIT) return Promise.reject(new Error('Product qualification command exceeds its byte bound.'));
    this.id = id;
    const command = { id, phase: this.phase, sourceSha256: createHash('sha256').update(source).digest('hex'),
      sourceBytes: Buffer.byteLength(source), sourcePrefix: bytePrefix(source, PRODUCT_SOURCE_PREFIX_BYTES) };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Product qualification command did not finish within 30 seconds.')), 30_000);
      this.pending = { resolve, reject, timer, command };
      try { this.write(line); } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
}

interface ProductReceipt { version: number; runId: string; identifier: string; binary: string; binarySha256: string; sources: Record<string, unknown> }
export interface ProductQualificationBrowser extends QualificationBrowser {
  productQualification: { sources: Record<string, unknown>; startup: Array<Record<string, unknown>> };
}

export function productReceiverBrowser(env: NodeJS.ProcessEnv = process.env, transport?: ProductTransport): ProductQualificationBrowser {
  if (process.platform !== 'darwin') throw new Error('Bundled product qualification currently requires macOS.');
  const runId = env.LOLLY_WEBGPU_PRODUCT_PROBE ?? '', identifier = productProbeIdentity(runId);
  productProbeOptions(env);
  if (Object.keys(runtimeOverrides(env)).length || (env.LOLLY_WEBGPU_TEST_ADAPTER && env.LOLLY_WEBGPU_TEST_ADAPTER !== 'default')) {
    throw new Error('Product qualification refuses graphics/runtime preference overrides.');
  }
  const binary = env.LOLLY_WEBGPU_PRODUCT_BINARY, receiptPath = env.LOLLY_WEBGPU_PRODUCT_RECEIPT;
  if (!binary || !receiptPath) throw new Error('Product qualification needs its source-bound binary receipt.');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as ProductReceipt;
  if (receipt.version !== 1 || receipt.runId !== runId || receipt.identifier !== identifier || receipt.binary !== binary
    || receipt.binarySha256 !== createHash('sha256').update(readFileSync(binary)).digest('hex')) throw new Error('Product qualification binary differs from its receipt.');
  let active: QualificationPage | null = null, runtime = 'not started';
  const startup: Array<Record<string, unknown>> = [];
  const recordDiagnostic = productDiagnosticRecorder(startup);
  return {
    productQualification: { sources: receipt.sources, startup },
    version: () => runtime,
    async close() { await active?.close(); },
    async newPage() {
      if (active) throw new Error('Close the first owned product page before another normal single-instance launch.');
      let child: ChildProcessWithoutNullStreams | null = null, protocol: ProductProbeProtocol | null = null, closed = false;
      let phase: ProductPhase = 'native-handshake';
      const recordedErrors = new WeakSet<Error>();
      const setPhase = (next: ProductPhase) => { phase = next; protocol?.setPhase(next); recordDiagnostic({ event: 'startup-phase', phase, pendingCommand: null }); };
      const failure = (error: Error): ProductCommandError => {
        const wrapped = error instanceof ProductCommandError ? error : new ProductCommandError(error, protocol?.diagnostic() ?? { phase, pendingCommand: null });
        if (!recordedErrors.has(wrapped)) { recordedErrors.add(wrapped); recordDiagnostic({ event: 'protocol-failure', ...wrapped.diagnostic, message: error.message }); }
        return wrapped;
      };
      const page: QualificationPage = {
        async goto(url) {
          if (url !== PRODUCT_PAGE || child || closed) throw new Error('Product qualification starts the bundled GUI once; it does not navigate to an external fixture.');
          setPhase('native-handshake');
          child = transport?.launch() ?? spawn(binary, [], { env: { ...env }, stdio: 'pipe' });
          let output = Buffer.alloc(0), stderrBytes = 0;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(failure(new Error('Bundled product did not complete its native handshake within 30 seconds.'))), 30_000);
            protocol = new ProductProbeProtocol(runId, line => { child!.stdin.write(line); }, ready => {
              runtime = transport?.runtime(ready) ?? `WKWebView ${ready.runtime}`; startup.push({ ...ready }); clearTimeout(timer); resolve();
            }, error => { clearTimeout(timer); if (!closed) failure(error); reject(error); }, transport?.platform ?? 'macos');
            protocol.setPhase(phase);
            child!.stdout.on('data', (chunk: Buffer) => {
              output = Buffer.concat([output, chunk]);
              if (output.length > PRODUCT_REPLY_LIMIT + 4096) { const error = new Error('Product output exceeds its frame bound.'); protocol!.fail(error); clearTimeout(timer); reject(error); return; }
              let newline = output.indexOf(10);
              while (newline >= 0) {
                const line = output.subarray(0, newline).toString(); output = output.subarray(newline + 1);
                if (line.startsWith(OUTPUT_PREFIX)) protocol!.receive(line);
                newline = output.indexOf(10);
              }
            });
            child!.stderr.on('data', (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes <= 64 * 1024) process.stderr.write(chunk); });
            child!.once('error', error => { protocol!.fail(error); clearTimeout(timer); reject(error); });
            child!.stdin.on('error', error => { protocol!.fail(error); clearTimeout(timer); reject(error); });
            child!.once('exit', (code, signal) => {
              const error = new Error(`Owned product exited (${code ?? signal}) before the qualification page closed.`);
              if (!closed) { protocol!.fail(error); clearTimeout(timer); reject(error); }
            });
          });
          const deadline = Date.now() + 30_000;
          setPhase('onboarding-poll');
          let choices = 0;
          while (true) {
            const state = await page.evaluate(() => {
              if (document.documentElement.dataset.webgpu === 'unsupported') return 'unsupported';
              const button = document.querySelector<HTMLButtonElement>('.instance-sheet [data-act="choose-bundled"], .instance-sheet [data-act="import-done"], .models-welcome [data-act="later"], .welcome-dialog [data-choice="explore"]');
              if (button) { button.click(); return 'choice'; }
              return document.documentElement.dataset.webgpu === 'ready' && document.querySelector('.gtile[data-tool-id]') ? 'ready' : 'waiting';
            });
            if (state === 'unsupported') {
              const observed = await page.evaluate(() => ({ api: Boolean(navigator.gpu), secureContext: isSecureContext,
                url: location.href, webgpu: document.documentElement.dataset.webgpu, text: document.body.innerText.slice(0, 2048) }));
              startup.push({ status: 'actual product startup refused WebGPU', ...observed });
              throw new Error(`The real bundled product startup refused WebGPU: ${JSON.stringify(observed)}`);
            }
            if (state === 'choice') choices++;
            if (state === 'ready') break;
            if (Date.now() > deadline) throw failure(new Error('Bundled product gallery/startup did not become ready within 30 seconds.'));
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          setPhase('csp');
          const facts = await page.evaluate(expectedCsp => {
            const csp = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content;
            if (csp !== expectedCsp || !isSecureContext) throw new Error('Bundled product CSP or secure-context observation differs.');
            return { origin: location.origin, url: location.href, csp, webgpu: document.documentElement.dataset.webgpu };
          }, TAURI_CSP);
          setPhase('probe-load');
          await page.evaluate(async () => {
            const probe = (window as Window & { __lollyProductQualification?: { load(): Promise<boolean> } }).__lollyProductQualification;
            if (!probe) throw new Error('Bundled qualification module is absent.');
            await probe.load();
            location.hash = '#/tool/qr-code?url=https%3A%2F%2Fexample.org';
          });
          setPhase('tool-wait');
          await page.waitForFunction(() => Boolean(document.querySelector('#tool-canvas svg')));
          startup.push({ ...facts, instanceChoiceClicks: choices, toolMounted: 'qr-code', probeLoad: 'after real gallery startup' });
          setPhase('corpus');
        },
        async evaluate<R, A = undefined>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<Awaited<R>> {
          if (closed || !protocol) throw new Error('Owned product page is not started.');
          try { return await protocol.request(fn.toString(), arg) as Awaited<R>; }
          catch (error) { throw failure(error instanceof Error ? error : new Error(String(error))); }
        },
        async waitForFunction(fn) {
          const started = Date.now();
          while (!await page.evaluate(fn)) {
            if (Date.now() - started > 30_000) throw failure(new Error('Product qualification page did not become ready.'));
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        },
        async close() {
          if (closed) return;
          closed = true; setPhase('closing'); protocol?.fail(new Error('Owned product page closed.'));
          const owned = child;
          if (owned && transport) await transport.close(owned);
          else if (owned && owned.exitCode === null && owned.signalCode === null) {
            await new Promise<void>(resolve => {
              const timer = setTimeout(() => { owned.kill('SIGKILL'); }, 3000);
              owned.once('exit', () => { clearTimeout(timer); resolve(); }); owned.kill('SIGTERM');
            });
          }
          if (active === page) active = null;
        },
      };
      active = page;
      return page;
    },
  };
}
