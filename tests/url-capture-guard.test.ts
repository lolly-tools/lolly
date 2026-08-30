// SPDX-License-Identifier: MPL-2.0
/**
 * assertPublicHttpUrl - the hosted-host capture guard (docs/threat-model.md row
 * "host.capture.page on a hosted host"). Literal-hostname checks only; DNS
 * rebinding and redirects are the egress policy's job and are not tested here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicHttpUrl } from '../packages/node-shell/src/url-capture.ts';

const REFUSED = [
  'http://169.254.169.254/latest/meta-data/',   // cloud metadata
  'http://localhost:9/', 'http://LOCALHOST/', 'http://foo.localhost/',
  'http://127.0.0.1/', 'http://127.1.2.3/', 'http://0.0.0.0/',
  'http://10.0.0.1/', 'http://172.16.5.5/', 'http://172.31.255.255/', 'http://192.168.1.1/',
  'http://100.64.0.1/',                           // CGNAT
  'http://224.0.0.1/', 'http://255.255.255.255/',
  'http://0x7f000001/', 'http://2130706433/', 'http://017700000001/', 'http://127.1/',  // obfuscated 127.0.0.1
  'http://[::1]/', 'http://[::]/', 'http://[fe80::1]/', 'http://[fd00::1]/', 'http://[fc00::1]/',
  'http://[::ffff:127.0.0.1]/', 'http://[::ffff:10.0.0.1]/', 'http://[::ffff:7f00:1]/',
  'http://printer.local/', 'http://db.internal/',
  'file:///etc/passwd', 'ftp://example.com/', 'javascript:alert(1)', 'data:text/html,hi',
  'http://user:pw@example.com/', 'http://user@example.com/',
  'not a url', '',
];
const ALLOWED = [
  'https://example.com/', 'http://example.com:8080/path?q=1#frag',
  'https://1.1.1.1/', 'http://172.32.0.1/', 'http://172.15.0.1/', 'http://100.63.0.1/', 'http://100.128.0.1/',
  'https://[2606:4700:4700::1111]/', 'https://sub.example.co.uk/x',
];

test('assertPublicHttpUrl refuses local, private, obfuscated and non-http targets', () => {
  for (const u of REFUSED) assert.throws(() => assertPublicHttpUrl(u), Error, `should refuse ${JSON.stringify(u)}`);
});

test('assertPublicHttpUrl allows ordinary public http(s) targets', () => {
  for (const u of ALLOWED) assert.doesNotThrow(() => assertPublicHttpUrl(u), `should allow ${u}`);
});
