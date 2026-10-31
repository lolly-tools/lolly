// SPDX-License-Identifier: MPL-2.0
/**
 * SPIKE, plan 324 section 8: the pure parts of the pairing transport.
 * Run directly:  node --test shells/web/src/lib/pairing-spike.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAIRING_SPIKE_BUILD, _resetForTests, activate, fromPairedTransport, isPairedScheme, pairedOrigin,
  pairedSocketCtor, parsePairingLink, schemeBaseFor, toPairedTransport,
} from './pairing-spike.ts';

test('the spike is off unless the build sets VITE_PAIRING_SPIKE=1', () => {
  assert.equal(PAIRING_SPIKE_BUILD, false);
  assert.equal(pairedOrigin(), null);
});

test('scheme base follows the platform form Tauri builds', () => {
  assert.equal(schemeBaseFor(), 'lolly-instance://localhost');
  assert.equal(schemeBaseFor((path, protocol) => `${protocol}://localhost/${path}`), 'lolly-instance://localhost');
  assert.equal(schemeBaseFor((path, protocol) => `http://${protocol}.localhost/${path}`), 'http://lolly-instance.localhost');
});

test('only the paired origin is mapped, both ways', () => {
  _resetForTests();
  assert.equal(toPairedTransport('https://192.168.1.20:8443/catalog/x.png'), 'https://192.168.1.20:8443/catalog/x.png');
  // activate() installs the fetch shim only where a window exists; node has none.
  activate('https://192.168.1.20:8443', 'lolly-instance://localhost');
  assert.equal(toPairedTransport('https://192.168.1.20:8443/catalog/x.png?v=1'), 'lolly-instance://localhost/catalog/x.png?v=1');
  assert.equal(toPairedTransport('https://192.168.1.20:8443'), 'lolly-instance://localhost');
  for (const other of [
    'https://192.168.1.20:9443/catalog/x.png',
    'https://192.168.1.21:8443/catalog/x.png',
    'http://192.168.1.20:8443/catalog/x.png',
    'https://192.168.1.20:8443.evil.example/x',
    'https://lolli.li/models/a.onnx',
  ]) {
    assert.equal(toPairedTransport(other), other, other);
  }
  assert.ok(isPairedScheme('lolly-instance://localhost/api/v1/instance'));
  assert.ok(!isPairedScheme('lolly-instance://localhostx/api'));
  assert.equal(fromPairedTransport('lolly-instance://localhost/api/v1/instance'), 'https://192.168.1.20:8443/api/v1/instance');
  assert.equal(pairedSocketCtor('wss://192.168.1.20:8443/ws/collab/s1') !== null, true);
  assert.equal(pairedSocketCtor('wss://elsewhere.example/ws/collab/s1'), null);
  _resetForTests();
});

test('pairing link: the QR payload and its refusals', () => {
  const fp = 'Fxt-tbgQ-NvebtKdsWmbrdwlG6BFxjuDbYgXOFsULp0';
  const link = `lolly://pair?v=1&u=https%3A%2F%2F192.168.50.60%3A8443&fp=${fp}&kid=Y2C0hGUH57c4xU0tkmF2ffTJ1RQ1nc6FzW8hU89tR5o`;
  assert.deepEqual(parsePairingLink(link), {
    origin: 'https://192.168.50.60:8443', fingerprint: fp, keyId: 'Y2C0hGUH57c4xU0tkmF2ffTJ1RQ1nc6FzW8hU89tR5o',
  });
  assert.throws(() => parsePairingLink(link.replace('v=1', 'v=2')));
  assert.throws(() => parsePairingLink(link.replace('https%3A', 'http%3A')));
  assert.throws(() => parsePairingLink(link.replace('%3A8443', '%3A8443%2Fapp')));
  assert.throws(() => parsePairingLink(link.replace(fp, fp.slice(1))));
  assert.throws(() => parsePairingLink(link.replace('kid=Y2C0', 'kid=%3C')));
  assert.throws(() => parsePairingLink('https://pair/?v=1'));
});
