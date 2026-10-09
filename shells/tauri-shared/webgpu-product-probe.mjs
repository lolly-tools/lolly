// SPDX-License-Identifier: MPL-2.0
/** Explicit unsigned product qualification; absent from ordinary frontend builds. */
import { resolve } from 'node:path';

export const PRODUCT_PROBE_ENV = 'LOLLY_WEBGPU_PRODUCT_PROBE';
export const PRODUCT_PROBE_PREFIX = 'tools.lolly.WebGpuProductQualification.r';
export const PRODUCT_PROBE_VIRTUAL = 'virtual:lolly-webgpu-product-probe';
const RUN_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function productProbeIdentity(id) {
  if (!RUN_ID.test(id ?? '')) throw new Error('Product qualification needs a UUID v4 run ID.');
  return PRODUCT_PROBE_PREFIX + id.replaceAll('-', '');
}

export function productProbeOptions(env = process.env) {
  const id = env[PRODUCT_PROBE_ENV];
  if (id === undefined || id === '') return null;
  const identifier = productProbeIdentity(id);
  if (env.LOLLY_WEBGPU_QUALIFICATION_BUILD !== '1') throw new Error('Product probe requires the explicit marked qualification build.');
  if (env.GITHUB_REF_TYPE === 'tag' || (env.GITHUB_REF ?? '').startsWith('refs/tags/')) throw new Error('Product probe cannot be built on a release tag.');
  if (env.LOLLY_RELEASE_BUILD === '1' || env.LOLLY_CATALOG_SIGNING_KEY || env.VITE_CATALOG_PUBLIC_KEY_JWK || env.VITE_CATALOG_TRUST_MODE === 'verified') {
    throw new Error('Product probe cannot use release trust or catalog signing credentials.');
  }
  return { id, identifier };
}

export function productProbeSource(id, entry) {
  productProbeIdentity(id);
  return `
const runId = ${JSON.stringify(id)};
const invoke = window.__TAURI_INTERNALS__?.invoke;
if (typeof invoke !== 'function') throw new Error('Product qualification requires the native feature.');
let stopped = false, observationSent = false;
let awaitStage = 'ready-await', lastCommandId = null;
const observe = sequence => {
  if (stopped || observationSent || sequence !== 1) return false;
  observationSent = true;
  const state = { stage: awaitStage, lastCommandId, visibility: document.visibilityState, hasFocus: document.hasFocus() };
  invoke('webgpu_qualification_observation', { runId, url: location.href, sequence, state }).catch(() => {});
  return true;
};
const url = () => location.href;
const failure = (kind, error) => {
  const detail = error?.message ? [error.name, error.message, error.stack, error.url].filter(Boolean).join('\\n') : String(error);
  const bytes = new TextEncoder().encode(kind + ': ' + detail);
  const message = new TextDecoder().decode(bytes.slice(0, 2000));
  invoke('webgpu_qualification_failure', { runId, url: url(), error: message }).catch(() => {});
};
window.addEventListener('vite:preloadError', event => failure('Vite preload failed', event.payload), true);
window.addEventListener('error', event => { if (event.error) failure('Product page error', event.error); }, true);
window.addEventListener('unhandledrejection', event => failure('Product unhandled rejection', event.reason), true);
const load = async () => {
  if (document.documentElement.dataset.webgpu !== 'ready') throw new Error('The real product startup check has not passed.');
  const module = await import(${JSON.stringify(entry)});
  window.lutProbe = { ...module };
  return true;
};
Object.defineProperty(window, '__lollyProductQualification', { value: Object.freeze({ load, observe }), configurable: true });
(async () => {
  await invoke('webgpu_qualification_ready', { runId, url: url(), secureContext: isSecureContext });
  while (!stopped) {
    awaitStage = 'before-next';
    const command = await invoke('webgpu_qualification_next', { runId, url: url() });
    if (command) lastCommandId = command.id;
    awaitStage = 'after-next';
    if (!command) {
      awaitStage = 'before-idle';
      await new Promise(resolve => setTimeout(resolve, 10));
      awaitStage = 'after-idle';
      continue;
    }
    let reply;
    awaitStage = 'before-evaluate';
    try {
      const value = await (0, eval)('(' + command.source + ')')(command.arg);
      reply = { id: command.id, value: value ?? null };
    } catch (error) { reply = { id: command.id, error: String(error), stack: error?.stack }; }
    awaitStage = 'after-evaluate';
    awaitStage = 'before-reply';
    await invoke('webgpu_qualification_reply', { runId, url: url(), reply });
    awaitStage = 'after-reply';
    if (command.close) { stopped = true; awaitStage = 'stopped'; }
  }
})().catch(error => {
  console.error('[webgpu-product-qualification]', error);
  failure('Product receiver failed', error);
});
`;
}

export function webGpuProductProbe({ root, env = process.env }) {
  const options = productProbeOptions(env);
  if (!options) return null;
  const entry = resolve(root, 'tests/helpers/webgpu-probe-entry.ts');
  const internal = '\0' + PRODUCT_PROBE_VIRTUAL;
  return {
    name: 'webgpu-product-qualification',
    apply: 'build',
    transformIndexHtml: { order: 'pre', handler() {
      return [{ tag: 'script', attrs: { type: 'module', src: PRODUCT_PROBE_VIRTUAL }, injectTo: 'body' }];
    } },
    resolveId(source) { return source === PRODUCT_PROBE_VIRTUAL ? internal : null; },
    load(source) { return source === internal ? productProbeSource(options.id, entry) : null; },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'webgpu-product-probe.json', source: JSON.stringify({
        version: 1, runId: options.id, identifier: options.identifier, scope: 'Instrumented unsigned product qualification; not for release.',
      }) + '\n' });
    },
  };
}
