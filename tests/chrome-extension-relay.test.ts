// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

type RelayEvent = { source: object; origin: string; data: unknown };

function loadRelay(origin = 'https://lolly.tools') {
  let onMessage: ((event: RelayEvent) => void) | undefined;
  const posted: Array<{ data: Record<string, unknown>; targetOrigin: string }> = [];
  const sent: Array<Record<string, unknown>> = [];
  const window = {
    addEventListener(type: string, handler: (event: RelayEvent) => void) {
      if (type === 'message') onMessage = handler;
    },
    postMessage(data: Record<string, unknown>, targetOrigin: string) {
      posted.push({ data, targetOrigin });
    },
  };
  Object.assign(window, { top: window });
  const chrome = {
    runtime: {
      id: 'fixture-extension',
      onMessage: { addListener() {} },
      lastError: undefined,
      sendMessage(message: Record<string, unknown>, callback: (response: Record<string, unknown>) => void) {
        sent.push(message);
        callback(message.type === 'lolly-capture/site'
          ? { ok: true, html: '<main>safe</main>' }
          : { ok: true, dataUrl: 'data:image/png;base64,AA==' });
      },
    },
  };
  const source = readFileSync(new URL('../shells/chrome-extension/content.js', import.meta.url), 'utf8');
  const policy = readFileSync(new URL('../shells/chrome-extension/policy.js', import.meta.url), 'utf8');
  vm.runInNewContext(`${policy}\n${source}`, { window, chrome, location: { origin, href: `${origin}/` } });
  assert.ok(onMessage, 'content script did not install its message listener');
  return { dispatch: onMessage, window, posted, sent };
}

test('extension relay ignores foreign origins and foreign windows', () => {
  const relay = loadRelay();
  const ping = { source: 'lolly-capture/page', type: 'ping' };
  relay.dispatch({ source: relay.window, origin: 'https://evil.example', data: ping });
  relay.dispatch({ source: {}, origin: 'https://lolly.tools', data: ping });
  assert.deepEqual(relay.posted, []);
  assert.deepEqual(relay.sent, []);
});

test('extension relay replies only to the validated requesting origin', () => {
  const relay = loadRelay();
  const origin = 'https://lolly.tools';
  relay.dispatch({ source: relay.window, origin, data: { source: 'lolly-capture/page', type: 'ping' } });
  relay.dispatch({
    source: relay.window,
    origin,
    data: { source: 'lolly-capture/page', type: 'capture', id: 'capture-1', spec: { format: 'png' } },
  });
  relay.dispatch({
    source: relay.window,
    origin,
    data: { source: 'lolly-capture/page', type: 'lolly-capture/site', requestId: 'site-1', url: 'https://example.com' },
  });
  assert.equal(relay.sent.length, 2);
  assert.equal(relay.posted.length, 3);
  assert.deepEqual(new Set(relay.posted.map((message) => message.targetOrigin)), new Set([origin]));
  assert.deepEqual(relay.posted.map((message) => message.data.type), ['pong', 'result', 'lolly-capture/site-result']);
});

test('production relay refuses preview and development origins', () => {
  for (const origin of ['https://preview.lolly.tools', 'http://localhost:5173']) {
    const relay = loadRelay(origin);
    relay.dispatch({ source: relay.window, origin, data: { source: 'lolly-capture/page', type: 'capture', id: 'fixture', spec: {} } });
    assert.equal(relay.sent.length, 0);
  }
});
