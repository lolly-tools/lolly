// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import type * as Policy from '../shells/web/src/lib/ai-policy.ts';

test('managed build: first boot denied, real Worker terminated, streamed fetch aborted', {
  skip:
    process.env.LOLLY_AI_BROWSER_TEST !== '1' &&
    'set LOLLY_AI_BROWSER_TEST=1 (installed Chromium required)',
  timeout: 30_000,
}, async () => {
  const compiled = await build({
    entryPoints: [new URL('../shells/web/src/lib/ai-policy.ts', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'policyUnderTest',
    define: { 'import.meta.env': JSON.stringify({ VITE_REQUIRE_AI_POLICY: 'true' }) },
  });
  let modelRequests = 0;
  let modelClosed = false;
  const server = createServer((req, res) => {
    if (req.url === '/models/stream') {
      modelRequests++;
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.write('model fragment');
      res.on('close', () => {
        modelClosed = true;
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>Local AI policy test</title>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${addr.port}`);
    await page.addScriptTag({ content: compiled.outputFiles[0]!.text });
    const result = await page.evaluate(async () => {
      const api = (globalThis as unknown as { policyUnderTest: typeof Policy }).policyUnderTest;
      const initial = api.aiAllowed('ocr');
      api.aiPolicy.apply({ version: 1, enabled: true, capabilities: ['ocr'], maxAgeSeconds: 60 });
      let terminated = 0,
        errors = 0,
        replies = 0;
      const url = URL.createObjectURL(
        new Blob(
          [
            'onmessage = () => { postMessage("ready"); setInterval(() => postMessage("late"), 10); };',
          ],
          { type: 'text/javascript' }
        )
      );
      const worker = api.guardAiWorker('ocr', () => {
        const w = new Worker(url);
        const stop = w.terminate.bind(w);
        w.terminate = () => {
          terminated++;
          stop();
        };
        return w;
      });
      worker.onerror = () => {
        errors++;
      };
      await new Promise<void>((resolve) => {
        worker.onmessage = () => {
          replies++;
          api.aiPolicy.apply(null);
          resolve();
        };
        worker.postMessage('start');
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
      URL.revokeObjectURL(url);
      let denied = false;
      try {
        worker.postMessage('again');
      } catch (error) {
        denied = (error as { code?: string }).code === 'AI_POLICY_DENIED';
      }
      api.aiPolicy.apply({ version: 1, enabled: true, capabilities: ['ocr'], maxAgeSeconds: 60 });
      let signalAborted = false,
        fetchRejected = false;
      try {
        await api.runAi('ocr', async (signal) => {
          const response = await fetch('/models/stream', { signal });
          const bytes = response.arrayBuffer();
          api.aiPolicy.apply(null);
          signalAborted = signal.aborted;
          return bytes;
        });
      } catch {
        fetchRejected = true;
      }
      return { initial, terminated, errors, replies, denied, signalAborted, fetchRejected };
    });
    assert.deepEqual(result, {
      initial: false,
      terminated: 1,
      errors: 1,
      replies: 1,
      denied: true,
      signalAborted: true,
      fetchRejected: true,
    });
    assert.equal(modelRequests, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(modelClosed, true, 'revocation closed the real network request');
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
