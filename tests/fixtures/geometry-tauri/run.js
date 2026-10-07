// SPDX-License-Identifier: MPL-2.0
export async function run() {
  const progress = stage => window.__TAURI_INTERNALS__.invoke('geometry_progress', { stage });
  await progress('load host module');
  const host = await import('./host.js');
  const mode = window.__geometryMode;
  const control = blocked => window.__TAURI_INTERNALS__.invoke('geometry_block', { blocked });
  const metadata = { mode, userAgent: navigator.userAgent, origin: location.origin, csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content };
  if (mode !== 'qualification') { await progress(`benchmark ${mode}`); return { ...metadata, benchmark: await host.benchGeometryHosts(mode === 'reverse', ['typescript', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-norm-curves']) }; }
  const { probeHostNorm } = await import('./norm.js');
  const inputs = await (await fetch('./inputs.json')).json();
  await progress('raw main qualification');
  const main = await probeHostNorm(inputs);
  await progress('raw worker qualification');
  const worker = new Worker('./norm-worker.js', { type: 'module' });
  let workerResult;
  try { workerResult = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Raw packaged worker timed out.')), 120_000); worker.onmessage = e => { clearTimeout(timer); e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result); }; worker.onerror = e => { clearTimeout(timer); reject(Error(e.message)); }; worker.postMessage(inputs); }); }
  finally { worker.terminate(); }
  await progress('actual host and hook qualification');
  const result = await host.probeGeometryHosts(['typescript', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-norm-curves']);
  await progress('loading refusal');
  await control(true);
  const loading = await host.probeGeometryLoadingFailure('wasm-host-norm-curves', control);
  await progress('worker refusal');
  const workerFailure = await host.probeGeometryWorkerFailure('wasm-host-norm-curves', control);
  return { ...metadata, main, worker: workerResult, result, loading, workerFailure };
}
