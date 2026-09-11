// SPDX-License-Identifier: MPL-2.0
/**
 * sdp-codec tests - plan 100 section 6.1 / section 2.9 / section 11.21, wave 2.1.
 * Run directly:  node --test shells/web/src/collab/sdp-codec.test.ts
 *
 * Four things are actually being proved here, in rising order of how much they
 * would hurt if they broke:
 *
 *  1. REAL SDP PARSES. The fixtures are shaped like what Chrome, Firefox and Safari
 *     genuinely emit for a data-channel-only description - session-level vs
 *     media-level fingerprints, uppercase `UDP`, mDNS `.local` candidates, TCP
 *     candidates with `tcptype`, LF-only line endings, `relay` candidates that must
 *     be dropped, component-2 lines that must be ignored. A codec that only reads
 *     its own output is worthless.
 *  2. THE LOOP CLOSES. `extract(reconstruct(m)) === m` over fixtures and fuzz: the
 *     boilerplate we hardcode really is boilerplate, and nothing that varies is lost.
 *  3. THE BUDGET HOLDS. section 6.1 asks for ~60–150 bytes; the size tests state the actual
 *     numbers (via `t.diagnostic`) so a regression shows up as a number, not a vibe.
 *  4. NOTHING THROWS. Every decode entry point is fed truncation, garbage, hostile
 *     lengths and wrong versions - including a fuzz sweep of random bytes and random
 *     strings - and must always return a typed failure (section 11.21).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SDP_CODEC_VERSION,
  MAX_CANDIDATES,
  MAX_PAYLOAD_BYTES,
  MAX_TOKEN_CHARS,
  QR_ALPHABET,
  extract,
  reconstruct,
  pack,
  unpack,
  encodeToken,
  decodeToken,
  encodePayload,
  decodePayload,
  sniffSkin,
} from './sdp-codec.ts';
import type { CollabPayload, IceCandidate, InviteMeta, SdpMaterial, TokenSkin } from './sdp-codec.ts';

// ── helpers ───────────────────────────────────────────────────────────────────

function ok<T>(r: { ok: true; value: T } | { ok: false; code: string; reason: string }, what = ''): T {
  assert.equal(r.ok, true, `${what} expected ok, got ${r.ok === false ? `${r.code}: ${r.reason}` : ''}`);
  return (r as { ok: true; value: T }).value;
}

function err(r: { ok: boolean; code?: string; reason?: string }, code: string, what = ''): void {
  assert.equal(r.ok, false, `${what} expected failure ${code}, got ok`);
  assert.equal(r.code, code, `${what} expected ${code}, got ${r.code}: ${r.reason}`);
  assert.equal(typeof r.reason, 'string');
}

/** Deterministic PRNG - a failing fuzz case must be reproducible from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ICE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const FP_ALGOS = ['sha-256', 'sha-384', 'sha-512'] as const;
const FP_LEN = { 'sha-256': 32, 'sha-384': 48, 'sha-512': 64 } as const;
const SETUP_ROLES = ['actpass', 'active', 'passive'] as const;
const SKINS: readonly TokenSkin[] = ['link', 'qr'];

const pick = <T>(rnd: () => number, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const int = (rnd: () => number, lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

function randomIce(rnd: () => number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ICE_CHARS[Math.floor(rnd() * 64)];
  return s;
}

function randomHex(rnd: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(rnd() * 16)];
  return s;
}

function randomAddress(rnd: () => number): string {
  const kind = int(rnd, 0, 3);
  if (kind === 0) return `${int(rnd, 1, 254)}.${int(rnd, 0, 255)}.${int(rnd, 0, 255)}.${int(rnd, 1, 254)}`;
  if (kind === 1) {
    // Eight non-zero groups: canonical by construction (no leading zeros, no `::`).
    const groups: string[] = [];
    for (let i = 0; i < 8; i++) groups.push(int(rnd, 1, 0xffff).toString(16));
    return groups.join(':');
  }
  if (kind === 2) {
    const h = randomHex(rnd, 32);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`;
  }
  return `host-${int(rnd, 1, 99)}.lan`;
}

function randomMaterial(rnd: () => number): SdpMaterial {
  const algo = pick(rnd, FP_ALGOS);
  const bytes = new Uint8Array(FP_LEN[algo]);
  for (let i = 0; i < bytes.length; i++) bytes[i] = int(rnd, 0, 255);
  const candidates: IceCandidate[] = [];
  for (let i = 0, n = int(rnd, 0, MAX_CANDIDATES); i < n; i++) {
    const protocol = rnd() < 0.2 ? 'tcp' : 'udp';
    const c: IceCandidate = {
      type: rnd() < 0.6 ? 'host' : 'srflx',
      protocol,
      address: randomAddress(rnd),
      port: int(rnd, 0, 65535),
    };
    if (rnd() < 0.35) c.priority = int(rnd, 0, 0xffffffff);
    // Only ever `true`, only ever on tcp - the documented normalized form.
    if (protocol === 'tcp' && rnd() < 0.5) c.tcpActive = true;
    candidates.push(c);
  }
  return {
    fingerprint: { algo, bytes },
    iceUfrag: randomIce(rnd, int(rnd, 4, 16)),
    icePwd: randomIce(rnd, int(rnd, 22, 40)),
    candidates,
    setupRole: pick(rnd, SETUP_ROLES),
  };
}

function randomInvite(rnd: () => number): InviteMeta {
  const meta: InviteMeta = {
    v: SDP_CODEC_VERSION,
    toolId: pick(rnd, ['design', 'qr-code', 'meeting-planner', 'chart', 'a', 'street-map']),
    toolVersion: pick(rnd, ['1.4.0', '0.0.1', '12.255.7', '2.0.0-beta.3', '1.10.0']),
    engineVersion: pick(rnd, ['1.108.0', '1.77.0', '2.0.0', '1.108.0-rc.1']),
  };
  if (rnd() < 0.8) meta.name = pick(rnd, ['Priya', 'Andy', 'Ada Lovelace', 'Zoë', '田中']);
  if (rnd() < 0.7) meta.colorIndex = int(rnd, 0, 254);
  if (rnd() < 0.6) meta.opVersion = pick(rnd, ['1.1.0', '1.0.0', '2.0.0']);
  return meta;
}

// ── fixtures: what real browsers emit for a data-channel-only description ──────

/**
 * Chrome/Edge (libwebrtc), non-trickle: media-level ICE credentials + fingerprint,
 * lowercase `udp`, `generation`/`network-id`/`network-cost` extensions, srflx with a
 * real raddr, and - deliberately - a `relay` candidate and a component-2 line that
 * the extractor must both ignore.
 */
const CHROME_OFFER = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:1467250027 1 udp 2122260223 192.168.1.42 55823 typ host generation 0 network-id 1 network-cost 10',
  'a=candidate:1467250027 2 udp 2122260222 192.168.1.42 55824 typ host generation 0 network-id 1',
  'a=candidate:3348148910 1 udp 1686052607 203.0.113.77 55823 typ srflx raddr 192.168.1.42 rport 55823 generation 0 network-id 1',
  'a=candidate:2983889144 1 udp 41885439 198.51.100.7 61233 typ relay raddr 203.0.113.77 rport 55823 generation 0',
  'a=ice-ufrag:4ZcD',
  'a=ice-pwd:2/1muCWoOi3uLifh0NuRHlsw',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB:3B:41:AF:B4:9A:4A:2F:CB:8A:9C:AA:B1',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
].join('\r\n');

/** Chrome with mDNS obfuscation on (the default on a LAN, section 11.1). */
const CHROME_MDNS_OFFER = [
  'v=0',
  'o=- 1234567890123456789 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:1 1 udp 2122260223 4a3f2e1d-9b8c-4d7e-8f6a-5b4c3d2e1f09.local 55823 typ host generation 0 network-cost 999',
  'a=candidate:2 1 udp 2122194687 b7c8d9e0-1a2b-3c4d-5e6f-708192a3b4c5.local 49877 typ host generation 0 network-cost 999',
  'a=candidate:3 1 udp 2122129151 c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f.local 61012 typ host generation 0 network-cost 999',
  'a=ice-ufrag:Qm7t',
  'a=ice-pwd:Jd8xKp2vQ1sRt5Yb9Nc3Ze7L',
  'a=fingerprint:sha-256 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
].join('\r\n');

/**
 * Firefox: fingerprint at SESSION level, uppercase `UDP`/`TCP`, a TCP host candidate
 * with `tcptype`, `a=end-of-candidates`, and (here) LF-only line endings - three
 * independent shapes Chrome never produces.
 */
const FIREFOX_OFFER = [
  'v=0',
  'o=mozilla...THIS_IS_SDPARTA-99.0 8123456789012345678 0 IN IP4 0.0.0.0',
  's=-',
  't=0 0',
  'a=fingerprint:sha-256 AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89',
  'a=group:BUNDLE 0',
  'a=ice-options:trickle',
  'a=msid-semantic:WMS *',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:0 1 UDP 2122252543 192.168.1.42 49155 typ host',
  'a=candidate:1 1 TCP 2105524479 192.168.1.42 9 typ host tcptype active',
  'a=sendrecv',
  'a=end-of-candidates',
  'a=ice-pwd:6a1c4f8e2b7d0359ac81ef46',
  'a=ice-ufrag:2b3d9f01',
  'a=mid:0',
  'a=setup:actpass',
  'a=sctp-port:5000',
  'a=max-message-size:1073741823',
].join('\n');

/** Safari (WebKit/libwebrtc) answering, with an IPv6 host candidate. */
const SAFARI_ANSWER = [
  'v=0',
  'o=- 7401235062845123456 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=msid-semantic: WMS',
  'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 0.0.0.0',
  'a=candidate:842163049 1 udp 2122262783 2001:db8::42 51293 typ host generation 0 network-cost 999',
  'a=candidate:842163050 1 udp 1677729535 198.51.100.9 51293 typ srflx raddr 0.0.0.0 rport 0 generation 0',
  'a=ice-ufrag:Xk9m',
  'a=ice-pwd:aB3dEf6HiJkLmNoPqRsTuVwX',
  'a=fingerprint:sha-256 0F:1E:2D:3C:4B:5A:69:78:87:96:A5:B4:C3:D2:E1:F0:0F:1E:2D:3C:4B:5A:69:78:87:96:A5:B4:C3:D2:E1:F0',
  'a=setup:active',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
].join('\r\n');

// ── extract ───────────────────────────────────────────────────────────────────

test('extract: a Chrome offer yields exactly the material that varies', () => {
  const m = ok(extract(CHROME_OFFER), 'chrome');
  assert.equal(m.fingerprint.algo, 'sha-256');
  assert.equal(m.fingerprint.bytes.length, 32);
  assert.equal(m.fingerprint.bytes[0], 0x4a);
  assert.equal(m.fingerprint.bytes[31], 0xb1);
  assert.equal(m.iceUfrag, '4ZcD');
  assert.equal(m.icePwd, '2/1muCWoOi3uLifh0NuRHlsw');
  assert.equal(m.setupRole, 'actpass');
  // component 2 ignored, relay dropped (no TURN in OSS, section 6.2a), host before srflx.
  assert.deepEqual(m.candidates, [
    { type: 'host', protocol: 'udp', address: '192.168.1.42', port: 55823 },
    { type: 'srflx', protocol: 'udp', address: '203.0.113.77', port: 55823 },
  ]);
});

test('extract: priorities are dropped by default and kept on request', () => {
  const lean = ok(extract(CHROME_OFFER));
  assert.equal(lean.candidates[0]!.priority, undefined);
  const full = ok(extract(CHROME_OFFER, { keepPriority: true }));
  assert.equal(full.candidates[0]!.priority, 2122260223);
  assert.equal(full.candidates[1]!.priority, 1686052607);
  // Dropping them costs 4 bytes per candidate - that is the whole point.
  assert.equal(ok(pack({ kind: 'answer', material: full })).length - ok(pack({ kind: 'answer', material: lean })).length, 8);
});

test('extract: Firefox shapes - session-level fingerprint, uppercase transport, tcptype, LF endings', () => {
  const m = ok(extract(FIREFOX_OFFER), 'firefox');
  assert.equal(m.fingerprint.algo, 'sha-256');
  assert.equal(m.iceUfrag, '2b3d9f01');
  assert.equal(m.icePwd, '6a1c4f8e2b7d0359ac81ef46');
  assert.deepEqual(m.candidates, [
    { type: 'host', protocol: 'udp', address: '192.168.1.42', port: 49155 },
    { type: 'host', protocol: 'tcp', address: '192.168.1.42', port: 9, tcpActive: true },
  ]);
});

test('extract: mDNS candidates survive verbatim', () => {
  const m = ok(extract(CHROME_MDNS_OFFER), 'mdns');
  assert.equal(m.candidates.length, 3);
  assert.equal(m.candidates[0]!.address, '4a3f2e1d-9b8c-4d7e-8f6a-5b4c3d2e1f09.local');
  assert.equal(m.candidates[2]!.address, 'c1d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f.local');
});

test('extract: an IPv6 host candidate and a null-raddr srflx (Safari)', () => {
  const m = ok(extract(SAFARI_ANSWER), 'safari');
  assert.equal(m.setupRole, 'active');
  assert.deepEqual(m.candidates, [
    { type: 'host', protocol: 'udp', address: '2001:db8::42', port: 51293 },
    { type: 'srflx', protocol: 'udp', address: '198.51.100.9', port: 51293 },
  ]);
});

test('extract: refusals are typed, never thrown', () => {
  err(extract(''), 'empty');
  err(extract('hello world'), 'not-sdp');
  // An audio offer is valid SDP and still not something this codec may rebuild.
  err(extract('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=ice-ufrag:abcd\r\n'), 'not-sdp');
  err(extract(CHROME_OFFER.replace(/^a=fingerprint:.*$/m, '')), 'bad-field');
  err(extract(CHROME_OFFER.replace(/^a=ice-pwd:.*$/m, '')), 'bad-field');
  err(extract('v=0\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\n'), 'bad-field');
  err(extract(`v=0\n${'x'.repeat(70 * 1024)}`), 'too-large');
});

test('extract: a SHA-1 fingerprint is refused, not downgraded to', () => {
  const sha1 = CHROME_OFFER.replace(
    /^a=fingerprint:.*$/m,
    'a=fingerprint:sha-1 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB',
  );
  const r = extract(sha1);
  err(r, 'bad-field');
  assert.match((r as { reason: string }).reason, /sha-256/);
});

test('extract: an ICE credential outside the RFC 5245 charset is refused (SDP injection)', () => {
  const injected = CHROME_OFFER.replace('a=ice-ufrag:4ZcD', 'a=ice-ufrag:4Zc$');
  err(extract(injected), 'bad-charset');
  const tooShort = CHROME_OFFER.replace('a=ice-pwd:2/1muCWoOi3uLifh0NuRHlsw', 'a=ice-pwd:short');
  err(extract(tooShort), 'bad-field');
});

test('extract: more candidates than the cap keeps the highest-priority ones', () => {
  const extra: string[] = [];
  for (let i = 0; i < 14; i++) {
    extra.push(`a=candidate:${i} 1 udp ${1000 + i} 10.0.0.${i} ${40000 + i} typ host`);
  }
  const sdp = CHROME_OFFER.replace('a=ice-ufrag:4ZcD', `${extra.join('\r\n')}\r\na=ice-ufrag:4ZcD`);
  const m = ok(extract(sdp, { keepPriority: true }));
  assert.equal(m.candidates.length, MAX_CANDIDATES);
  assert.equal(m.candidates[0]!.address, '192.168.1.42'); // priority 2122260223 wins
  for (let i = 1; i < m.candidates.length; i++) {
    assert.ok(m.candidates[i - 1]!.priority! >= m.candidates[i]!.priority!);
  }
});

// ── reconstruct ───────────────────────────────────────────────────────────────

test('reconstruct: emits the lines a browser needs, and only those', () => {
  const m = ok(extract(CHROME_OFFER));
  const sdp = ok(reconstruct(m, 'offer'));
  for (const line of [
    'v=0',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=mid:0',
    'a=ice-ufrag:4ZcD',
    'a=ice-pwd:2/1muCWoOi3uLifh0NuRHlsw',
    'a=setup:actpass',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    'a=end-of-candidates',
  ]) {
    assert.ok(sdp.includes(`${line}\r\n`), `missing ${line}`);
  }
  assert.ok(sdp.startsWith('v=0\r\n'));
  assert.ok(sdp.endsWith('\r\n'));
  assert.match(sdp, /^o=- \d{1,19} 2 IN IP4 127\.0\.0\.1$/m);
  assert.match(sdp, /^a=fingerprint:sha-256 4A:AD(?::[0-9A-F]{2}){30}$/m);
  // Non-trickle by construction: never advertise a back-channel a blob cannot have.
  assert.ok(!sdp.includes('ice-options:trickle'));
  // The c-line is the ONLY place an address may be faked; candidates carry the truth.
  assert.match(sdp, /^a=candidate:1 1 udp \d+ 192\.168\.1\.42 55823 typ host$/m);
  assert.match(sdp, /^a=candidate:2 1 udp \d+ 203\.0\.113\.77 55823 typ srflx raddr 0\.0\.0\.0 rport 0$/m);
});

test('reconstruct: an answer never says actpass (RFC 5763 section 5)', () => {
  const m = ok(extract(CHROME_OFFER));
  assert.ok(ok(reconstruct(m, 'offer')).includes('a=setup:actpass\r\n'));
  assert.ok(ok(reconstruct(m, 'answer')).includes('a=setup:active\r\n'));
  const passive: SdpMaterial = { ...m, setupRole: 'passive' };
  assert.ok(ok(reconstruct(passive, 'answer')).includes('a=setup:passive\r\n'));
});

test('reconstruct: tcp candidates keep their tcptype; pure function, stable output', () => {
  const m = ok(extract(FIREFOX_OFFER));
  const sdp = ok(reconstruct(m, 'offer'));
  assert.match(sdp, /^a=candidate:3 1 tcp \d+ 192\.168\.1\.42 9 typ host tcptype active$/m);
  assert.equal(sdp, ok(reconstruct(m, 'offer')));
});

test('reconstruct → extract is the identity on every fixture', () => {
  for (const [name, sdp] of Object.entries({ CHROME_OFFER, CHROME_MDNS_OFFER, FIREFOX_OFFER, SAFARI_ANSWER })) {
    const material = ok(extract(sdp), name);
    const rebuilt = ok(reconstruct(material, 'offer'), name);
    assert.deepStrictEqual(ok(extract(rebuilt), name), material, name);
  }
});

test('reconstruct: refuses material it cannot safely spell', () => {
  const m = ok(extract(CHROME_OFFER));
  err(reconstruct({ ...m, iceUfrag: 'bad\r\na=candidate:9 1 udp 1 1.2.3.4 1 typ host' }, 'offer'), 'bad-charset');
  err(reconstruct({ ...m, fingerprint: { ...m.fingerprint, bytes: new Uint8Array(8) } }, 'offer'), 'bad-field');
  err(reconstruct(m, 'sideways' as 'offer'), 'bad-field');
});

// ── pack / unpack ─────────────────────────────────────────────────────────────

test('pack/unpack: fuzz round-trip is the identity (2,000 random payloads)', () => {
  const rnd = mulberry32(0x10ccae);
  for (let i = 0; i < 2000; i++) {
    const material = randomMaterial(rnd);
    const payload: CollabPayload =
      rnd() < 0.5 ? { kind: 'answer', material } : { kind: 'invite', material, invite: randomInvite(rnd) };
    const bytes = ok(pack(payload), `iteration ${i}`);
    assert.deepStrictEqual(ok(unpack(bytes), `iteration ${i}`), payload, `iteration ${i}`);
  }
});

test('pack/unpack: fuzz round-trip survives both text skins', () => {
  const rnd = mulberry32(0x5eed42);
  for (let i = 0; i < 400; i++) {
    const material = randomMaterial(rnd);
    const payload: CollabPayload = { kind: 'invite', material, invite: randomInvite(rnd) };
    for (const skin of SKINS) {
      const token: string = ok(encodePayload(payload, skin), `${skin} ${i}`);
      assert.deepStrictEqual(ok(decodePayload(token, skin), `${skin} ${i}`), payload, `${skin} ${i}`);
      // ...and the skin sniffer agrees without being told.
      assert.deepStrictEqual(ok(decodePayload(token), `auto ${skin} ${i}`), payload);
    }
  }
});

test('pack: addresses that cannot be spelled canonically are carried verbatim', () => {
  const base = ok(extract(CHROME_OFFER));
  for (const address of ['192.168.001.5', '2001:0db8:0000:0000:0000:0000:0000:0042', '::ffff:192.0.2.1', 'A1B2C3D4-0000-0000-0000-000000000000.local', 'peer.local', 'fe80::1']) {
    const material: SdpMaterial = { ...base, candidates: [{ type: 'host', protocol: 'udp', address, port: 4000 }] };
    const back = ok(unpack(ok(pack({ kind: 'answer', material }))), address);
    assert.equal(back.material.candidates[0]!.address, address, address);
  }
});

test('pack: the compact forms really are compact', () => {
  const base = ok(extract(CHROME_OFFER));
  const size = (address: string): number =>
    ok(pack({ kind: 'answer', material: { ...base, candidates: [{ type: 'host', protocol: 'udp', address, port: 1 }] } })).length;
  const empty = ok(pack({ kind: 'answer', material: { ...base, candidates: [] } })).length;
  assert.equal(size('192.168.1.42') - empty, 1 + 4 + 2);
  assert.equal(size('2001:db8::42') - empty, 1 + 16 + 2);
  assert.equal(size('4a3f2e1d-9b8c-4d7e-8f6a-5b4c3d2e1f09.local') - empty, 1 + 16 + 2);
  assert.equal(size('peer.local') - empty, 1 + 1 + 10 + 2);
});

test('pack: normalization - tcpActive is only ever present, and only on tcp', () => {
  const base = ok(extract(CHROME_OFFER));
  const withFlag = (c: IceCandidate): IceCandidate =>
    ok(unpack(ok(pack({ kind: 'answer', material: { ...base, candidates: [c] } })))).material.candidates[0]!;
  assert.deepEqual(withFlag({ type: 'host', protocol: 'tcp', address: '10.0.0.1', port: 9, tcpActive: false }), {
    type: 'host', protocol: 'tcp', address: '10.0.0.1', port: 9,
  });
  err(pack({ kind: 'answer', material: { ...base, candidates: [{ type: 'host', protocol: 'udp', address: '10.0.0.1', port: 9, tcpActive: true }] } }), 'bad-field');
});

test('pack: field validation refuses what would poison the far side', () => {
  const base = ok(extract(CHROME_OFFER));
  const invite = (meta: Partial<InviteMeta>): CollabPayload => ({
    kind: 'invite',
    material: base,
    invite: { v: SDP_CODEC_VERSION, toolId: 'qr-code', toolVersion: '1.0.0', engineVersion: '1.108.0', ...meta },
  });
  err(pack(invite({ toolId: '../../etc/passwd' })), 'bad-field');
  err(pack(invite({ toolId: 'Design' })), 'bad-field');
  err(pack(invite({ toolId: '' })), 'bad-field');
  err(pack(invite({ name: 'Priya\r\nEvil' })), 'bad-field');
  err(pack(invite({ name: 'x'.repeat(200) })), 'too-large');
  // A stranger's `name` is rendered as a chip, so the invisible half of Unicode is
  // refused alongside the control codes: an unterminated RLO reverses the chrome
  // printed after it, and a zero-width character clones another collaborator's chip
  // exactly. Written as escapes because the literals are, by definition, unreadable.
  err(pack(invite({ name: '\u202egnp.txt' })), 'bad-field');   // RIGHT-TO-LEFT OVERRIDE
  err(pack(invite({ name: 'A\u200bB' })), 'bad-field');        // ZERO WIDTH SPACE
  err(pack(invite({ name: 'A\ufeffB' })), 'bad-field');        // ZWNBSP (BOM)
  err(pack(invite({ name: '\u2066x' })), 'bad-field');         // LEFT-TO-RIGHT ISOLATE
  err(pack(invite({ name: 'a\u2028b' })), 'bad-field');        // LINE SEPARATOR
  err(pack(invite({ name: 'a\u200fb' })), 'bad-field');        // RIGHT-TO-LEFT MARK
  // ...and the names people actually have are untouched.
  ok(pack(invite({ name: 'Zo\u00eb \u4e2d\u6751 \ud83d\ude42' })));
  // Prototype-chain words are not catalog tool ids: the acceptor's `checkTool` gate
  // may index a plain object, where `constructor` is truthy and "do I have this
  // tool?" answers yes for a tool nobody has.
  err(pack(invite({ toolId: 'constructor' })), 'bad-field');
  err(pack(invite({ toolId: 'prototype' })), 'bad-field');
  err(pack(invite({ toolId: '__proto__' })), 'bad-field');
  err(pack(invite({ colorIndex: 255 })), 'bad-field');
  err(pack(invite({ colorIndex: 1.5 })), 'bad-field');
  err(pack(invite({ v: 2 as 1 })), 'unsupported-version');
  err(pack({ kind: 'answer', material: { ...base, candidates: new Array(MAX_CANDIDATES + 1).fill(base.candidates[0]) } }), 'too-large');
  err(pack({ kind: 'answer', material: { ...base, candidates: [{ type: 'host', protocol: 'udp', address: '10.0.0.1', port: 70000 }] } }), 'bad-field');
  err(pack({ kind: 'answer', material: { ...base, candidates: [{ type: 'host', protocol: 'udp', address: '10.0.0.1 typ host', port: 1 }] } }), 'bad-charset');
  err(pack({ kind: 'answer', material: { ...base, setupRole: 'holdconn' as 'active' } }), 'bad-field');
  err(pack({ kind: 'answer', material: { ...base, fingerprint: { algo: 'sha-1' as 'sha-256', bytes: new Uint8Array(20) } } }), 'bad-field');
  err(pack({ kind: 'sideways', material: base } as unknown as CollabPayload), 'bad-field');
});

test('unpack: hostile and truncated payloads always come back as typed failures', () => {
  const good = ok(pack({
    kind: 'invite',
    material: ok(extract(CHROME_MDNS_OFFER)),
    invite: { v: 1, toolId: 'design', toolVersion: '1.4.0', engineVersion: '1.108.0', name: 'Priya', colorIndex: 2 },
  }));

  err(unpack(new Uint8Array(0)), 'empty');
  err(unpack(new Uint8Array(MAX_PAYLOAD_BYTES + 1)), 'too-large');
  err(unpack(new Uint8Array([0, 0, 0])), 'unsupported-version');
  err(unpack(new Uint8Array([2, ...good.slice(1)])), 'unsupported-version');
  err(unpack(new Uint8Array([99])), 'unsupported-version');

  // Every truncation of a valid payload fails; none throws, none half-succeeds.
  for (let cut = 1; cut < good.length; cut++) {
    const r = unpack(good.slice(0, cut));
    assert.equal(r.ok, false, `truncation at ${cut} decoded`);
  }
  err(unpack(new Uint8Array([...good, 0])), 'trailing-bytes');

  // Reserved bits are a hard error: a future shape bumps the version byte instead.
  const reserved = Uint8Array.from(good);
  reserved[1] = (reserved[1]! | 0x80) & 0xff;
  err(unpack(reserved), 'bad-field');

  // Kind 2/3 and setup role 3 do not exist.
  const badKind = Uint8Array.from(good);
  badKind[1] = (badKind[1]! & ~0b11) | 0b10;
  err(unpack(badKind), 'bad-field');
  const badRole = Uint8Array.from(good);
  badRole[1] = badRole[1]! | 0b1100;
  err(unpack(badRole), 'bad-field');
  const badAlgo = Uint8Array.from(good);
  badAlgo[1] = badAlgo[1]! | 0b110000;
  err(unpack(badAlgo), 'bad-field');
});

test('unpack: a prototype-chain toolId is refused on the way IN, not only on the way out', () => {
  const material = ok(extract(CHROME_MDNS_OFFER));
  // `construct0r` is a legal id and exactly as long as `constructor`, so one byte
  // turns a payload we produced into one we would have refused to produce - which
  // is precisely what a hostile invite is.
  const good = ok(pack({
    kind: 'invite',
    material,
    invite: { v: SDP_CODEC_VERSION, toolId: 'construct0r', toolVersion: '1.0.0', engineVersion: '1.108.0' },
  }));
  ok(unpack(good));

  const needle = [...'construct0r'].map(ch => ch.charCodeAt(0));
  let at = -1;
  for (let i = 0; i + needle.length <= good.length && at < 0; i++) {
    if (needle.every((b, k) => good[i + k] === b)) at = i;
  }
  assert.ok(at >= 0, 'the tool id is not in the packed bytes');
  const hostile = Uint8Array.from(good);
  hostile[at + 9] = 'o'.charCodeAt(0);
  err(unpack(hostile), 'bad-field');
});

test('unpack: an answer may not smuggle invite metadata', () => {
  const material = ok(extract(SAFARI_ANSWER));
  const answer = ok(pack({ kind: 'answer', material }));
  const flagged = Uint8Array.from(answer);
  flagged[1] = flagged[1]! | (1 << 6);
  err(unpack(flagged), 'bad-field');
});

test('unpack: random bytes never throw and essentially never decode', () => {
  const rnd = mulberry32(0xbadbeef);
  let decoded = 0;
  for (let i = 0; i < 5000; i++) {
    const bytes = new Uint8Array(int(rnd, 0, 200));
    for (let j = 0; j < bytes.length; j++) bytes[j] = int(rnd, 0, 255);
    const r = unpack(bytes);
    if (r.ok) decoded++;
    else assert.equal(typeof r.reason, 'string');
  }
  assert.ok(decoded < 5, `random bytes decoded ${decoded} times`);
});

test('unpack: single-bit flips of a valid payload are caught or harmless, never fatal', () => {
  const good = ok(pack({ kind: 'answer', material: ok(extract(CHROME_MDNS_OFFER)) }));
  for (let i = 0; i < good.length; i++) {
    for (let bit = 0; bit < 8; bit++) {
      const flipped = Uint8Array.from(good);
      flipped[i] = flipped[i]! ^ (1 << bit);
      const r = unpack(flipped);
      if (!r.ok) assert.equal(typeof r.reason, 'string');
    }
  }
});

// ── size budget (section 6.1: ~60–150 bytes) ─────────────────────────────────────────

test('size: a typical LAN invite fits the QR budget', t => {
  const meta: InviteMeta = {
    v: SDP_CODEC_VERSION,
    toolId: 'design',
    toolVersion: '1.4.0',
    engineVersion: '1.108.0',
    name: 'Priya',
    colorIndex: 2,
    opVersion: '1.1.0',
  };
  const cases: Array<[string, CollabPayload]> = [
    ['invite · 3 mDNS host candidates', { kind: 'invite', material: ok(extract(CHROME_MDNS_OFFER)), invite: meta }],
    ['invite · 2 IPv4 candidates (host + srflx)', { kind: 'invite', material: ok(extract(CHROME_OFFER)), invite: meta }],
    ['invite · 1 IPv4 host candidate', {
      kind: 'invite',
      material: { ...ok(extract(CHROME_OFFER)), candidates: [{ type: 'host', protocol: 'udp', address: '192.168.1.42', port: 55823 }] },
      invite: meta,
    }],
    ['answer · 3 mDNS host candidates', { kind: 'answer', material: ok(extract(CHROME_MDNS_OFFER)) }],
    ['answer · 2 IPv4 candidates', { kind: 'answer', material: ok(extract(CHROME_OFFER)) }],
  ];
  for (const [label, payload] of cases) {
    const bytes = ok(pack(payload), label);
    const link = encodeToken(bytes, 'link');
    const qr = encodeToken(bytes, 'qr');
    t.diagnostic(`${label}: ${bytes.length} B · link ${link.length} chars · qr ${qr.length} chars`);
    assert.ok(bytes.length <= 150, `${label} is ${bytes.length} B, over the 150 B budget`);
  }
});

test('size: the worst case a peer can hand us still fits the hard cap', t => {
  const rnd = mulberry32(7);
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) bytes[i] = i;
  const material: SdpMaterial = {
    fingerprint: { algo: 'sha-512', bytes },
    iceUfrag: 'u'.repeat(64),
    icePwd: 'p'.repeat(64),
    candidates: Array.from({ length: MAX_CANDIDATES }, () => ({
      type: 'srflx' as const,
      protocol: 'tcp' as const,
      address: randomAddress(rnd).slice(0, 40),
      port: 65535,
      priority: 0xffffffff,
      tcpActive: true,
    })),
    setupRole: 'passive',
  };
  const packed = ok(pack({
    kind: 'invite',
    material,
    invite: {
      v: SDP_CODEC_VERSION,
      toolId: 'x'.repeat(64),
      toolVersion: 'y'.repeat(32),
      engineVersion: 'z'.repeat(32),
      name: 'n'.repeat(48),
      colorIndex: 254,
      opVersion: 'w'.repeat(32),
    },
  }));
  t.diagnostic(`worst case: ${packed.length} B (cap ${MAX_PAYLOAD_BYTES})`);
  assert.ok(packed.length <= MAX_PAYLOAD_BYTES);
  assert.deepStrictEqual(ok(unpack(packed)).material.candidates.length, MAX_CANDIDATES);
});

test('size: the compact semver path pays for itself', () => {
  const base = ok(extract(CHROME_OFFER));
  const invite = (toolVersion: string): number =>
    ok(pack({ kind: 'invite', material: base, invite: { v: 1, toolId: 'a', toolVersion, engineVersion: '1.0.0' } })).length;
  assert.equal(invite('1.108.0'), invite('1.0.0'));                  // 4 bytes either way
  assert.equal(invite('2.0.0-beta.3') - invite('1.108.0'), 13 - 4);  // the string path
  // A non-canonical spelling must NOT take the compact path (it would not round-trip).
  const odd = ok(pack({ kind: 'invite', material: base, invite: { v: 1, toolId: 'a', toolVersion: '1.010.0', engineVersion: '1.0.0' } }));
  assert.equal(ok(unpack(odd)).kind === 'invite' && (ok(unpack(odd)) as { invite: InviteMeta }).invite.toolVersion, '1.010.0');
});

// ── text skins ────────────────────────────────────────────────────────────────

test('skins: the QR alphabet is a subset of QR alphanumeric mode', () => {
  // ISO/IEC 18004 alphanumeric set - anything outside forces byte mode (8 b/char).
  const QR_ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  assert.equal(QR_ALPHABET.length, 32);
  for (const ch of QR_ALPHABET) assert.ok(QR_ALPHANUMERIC.includes(ch), `${ch} is not QR-alphanumeric`);
  // The confusable digits are absent by construction (RFC 4648's reason for A-Z2-7).
  for (const ch of '0189') assert.ok(!QR_ALPHABET.includes(ch));

  const rnd = mulberry32(3);
  const bytes = new Uint8Array(120);
  for (let i = 0; i < bytes.length; i++) bytes[i] = int(rnd, 0, 255);
  const qr = encodeToken(bytes, 'qr');
  const link = encodeToken(bytes, 'link');
  assert.match(qr, /^[A-Z2-7]+$/);
  assert.match(link, /^[A-Za-z0-9_-]+$/);
  assert.equal(qr.length, Math.ceil((120 * 8) / 5));
  assert.equal(link.length, Math.ceil((120 * 8) / 6));
  // The trade this codec is making, stated as an assertion: fewer BITS on the
  // symbol despite more characters (5.5 b/char alphanumeric vs 8 b/char byte).
  assert.ok(qr.length * 5.5 < link.length * 8);
});

test('skins: tolerant where it is unambiguous, strict where it is not', () => {
  const rnd = mulberry32(11);
  const bytes = new Uint8Array(40);
  for (let i = 0; i < bytes.length; i++) bytes[i] = int(rnd, 0, 255);
  const qr = encodeToken(bytes, 'qr');
  const link = encodeToken(bytes, 'link');

  assert.deepStrictEqual(ok(decodeToken(`  ${qr}  `, 'qr')), bytes);
  assert.deepStrictEqual(ok(decodeToken(qr.replace(/(.{4})/g, '$1-'), 'qr')), bytes);
  assert.deepStrictEqual(ok(decodeToken(qr.toLowerCase(), 'qr')), bytes);
  assert.deepStrictEqual(ok(decodeToken(`${link}\n`, 'link')), bytes);
  assert.deepStrictEqual(ok(decodeToken(link.replace(/-/g, '+').replace(/_/g, '/'), 'link')), bytes);
  assert.deepStrictEqual(ok(decodeToken(`${link}==`, 'link')), bytes);

  err(decodeToken('', 'qr'), 'empty');
  err(decodeToken('   ', 'link'), 'empty');
  err(decodeToken('AB01!', 'qr'), 'bad-charset');
  err(decodeToken('ab+cd*', 'link'), 'bad-charset');
  err(decodeToken('A', 'qr'), 'truncated');
  err(decodeToken('A', 'link'), 'truncated');
  err(decodeToken('x'.repeat(MAX_TOKEN_CHARS + 1), 'link'), 'too-large');
  // Non-canonical padding bits: one payload, one token.
  err(decodeToken('AB', 'qr'), 'bad-field');
});

test('skins: sniffSkin picks the right one for real tokens', () => {
  const rnd = mulberry32(99);
  for (let i = 0; i < 200; i++) {
    const material = randomMaterial(rnd);
    const payload: CollabPayload = { kind: 'answer', material };
    assert.equal(sniffSkin(ok(encodePayload(payload, 'qr'))), 'qr');
    assert.equal(sniffSkin(ok(encodePayload(payload, 'link'))), 'link');
  }
});

test('decodePayload: a stranger\'s string is always a typed answer', () => {
  const rnd = mulberry32(0xf00d);
  for (let i = 0; i < 2000; i++) {
    const len = int(rnd, 0, 60);
    let s = '';
    for (let j = 0; j < len; j++) s += String.fromCharCode(int(rnd, 32, 126));
    const r = decodePayload(s);
    if (!r.ok) {
      assert.equal(typeof r.code, 'string');
      assert.equal(typeof r.reason, 'string');
    }
  }
  err(decodePayload(''), 'empty');
  err(decodePayload('not a token at all!'), 'bad-charset');

  // The shape the join view actually produces: `URLSearchParams.get('inv')` is
  // `string | null`, and the default 'auto' skin sniffs BEFORE decodeToken's guard - 
  // so a missing or duplicated param has to come back typed, not as a TypeError.
  for (const junk of [null, undefined, 123, {}, [], Symbol.iterator]) {
    for (const skin of ['auto', 'link', 'qr'] as const) {
      const r = decodePayload(junk as unknown as string, skin);
      assert.equal(r.ok, false, `decodePayload(${String(junk)}, ${skin}) decoded`);
      assert.equal(typeof (r as { code: string }).code, 'string');
      assert.equal(typeof (r as { reason: string }).reason, 'string');
    }
  }
});

// ── the whole ceremony, end to end (no network) ───────────────────────────────

test('end to end: offer → invite link → answer token → both sides rebuild valid SDP', () => {
  // A: gather, extract, invite.
  const offerMaterial = ok(extract(CHROME_MDNS_OFFER));
  const invite: InviteMeta = {
    v: SDP_CODEC_VERSION,
    toolId: 'design',
    toolVersion: '1.4.0',
    engineVersion: '1.108.0',
    name: 'Priya',
    colorIndex: 2,
    opVersion: '1.1.0',
  };
  const link = `https://lolly.tools/#/join?inv=${ok(encodePayload({ kind: 'invite', material: offerMaterial, invite }, 'link'))}`;

  // B: read the link (untrusted), rebuild A's offer, answer.
  const token = new URL(link).hash.split('inv=')[1]!;
  const received = ok(decodePayload(token, 'link'));
  assert.equal(received.kind, 'invite');
  assert.deepStrictEqual(received.kind === 'invite' ? received.invite : null, invite);
  const remoteOffer = ok(reconstruct(received.material, 'offer'));
  assert.ok(remoteOffer.includes('a=setup:actpass\r\n'));
  assert.deepStrictEqual(ok(extract(remoteOffer)), offerMaterial);

  // B answers over the QR skin; A rebuilds it as its remote description.
  const answerMaterial = ok(extract(SAFARI_ANSWER));
  const answerToken = ok(encodePayload({ kind: 'answer', material: answerMaterial }, 'qr'));
  assert.match(answerToken, /^[A-Z2-7]+$/);
  const back = ok(decodePayload(answerToken, 'qr'));
  assert.equal(back.kind, 'answer');
  const remoteAnswer = ok(reconstruct(back.material, 'answer'));
  assert.ok(remoteAnswer.includes('a=setup:active\r\n'));
  assert.deepStrictEqual(ok(extract(remoteAnswer)), answerMaterial);

  // The fingerprint - the trust root - is byte-identical on both legs.
  assert.deepStrictEqual(back.material.fingerprint.bytes, answerMaterial.fingerprint.bytes);
});
