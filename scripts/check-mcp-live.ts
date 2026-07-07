// SPDX-License-Identifier: MPL-2.0
/**
 * Live smoke-check for the serverless functions behind lolly.tools.
 *
 * WHY THIS EXISTS
 * The MCP handler is bundled into a single Vercel function (see build-mcp-fn.ts);
 * the repo's explicit `.ts` import specifiers make that bundling fragile — a
 * botched build makes the function throw at import time and return 500, or vanish
 * so the SPA rewrite answers with 405/HTML. Either way the MCP endpoint is dead
 * but the site still "works", so it goes unnoticed. This check asserts the
 * functions are alive and behaving:
 *   - POST /api/mcp  → 401 (function is up AND auth-gated), NOT 405 (SPA
 *     fallback / no function) and NOT 500 (crash at import/handler time).
 *   - GET  /api/ca/health → JSON body ({"ok":true...}), NOT HTML (SPA fallback).
 *
 * Usage: `npm run check:mcp` or `node scripts/check-mcp-live.ts --base=<url>`
 * to point at a preview deployment instead of production.
 */

export {}; // ensure this file is treated as a module (top-level await)

const DEFAULT_BASE = 'https://lolly.tools';

const baseArg = process.argv.find((a) => a.startsWith('--base='));
const base = (baseArg ? baseArg.slice('--base='.length) : DEFAULT_BASE).replace(/\/+$/, '');

let failures = 0;
function report(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`);
  if (!ok) failures++;
}

// --- Check 1: MCP function is alive and auth-gated (401, not 405/500) ---------
try {
  const res = await fetch(`${base}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  if (res.status === 401) {
    report('POST /api/mcp', true, 'HTTP 401 (function alive + auth-gated)');
  } else if (res.status === 405) {
    report('POST /api/mcp', false, 'HTTP 405 — SPA fallback, MCP function not deployed');
  } else if (res.status === 500) {
    report('POST /api/mcp', false, 'HTTP 500 — function crashed (likely .ts bundling regression)');
  } else {
    report('POST /api/mcp', false, `HTTP ${res.status} — expected 401`);
  }
} catch (err) {
  report('POST /api/mcp', false, `request failed: ${(err as Error).message}`);
}

// --- Check 2: CA health endpoint returns JSON, not HTML -----------------------
try {
  const res = await fetch(`${base}/api/ca/health`);
  const ctype = res.headers.get('content-type') ?? '';
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  const isJson = ctype.includes('application/json') || parsed !== undefined;
  const ok = isJson && !!parsed && (parsed as { ok?: unknown }).ok === true;
  if (ok) {
    report('GET /api/ca/health', true, `JSON ${JSON.stringify(parsed)}`);
  } else if (!isJson) {
    report('GET /api/ca/health', false, `non-JSON response (content-type: ${ctype || 'none'}) — SPA fallback?`);
  } else {
    report('GET /api/ca/health', false, `JSON but not ok:true — ${text.slice(0, 120)}`);
  }
} catch (err) {
  report('GET /api/ca/health', false, `request failed: ${(err as Error).message}`);
}

// --- Check 3: OAuth discovery serves JSON (not the SPA fallback) --------------
// claude.ai's custom-connector flow starts here; if these fall through to
// index.html the connector fails to discover the auth server.
for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server']) {
  try {
    const res = await fetch(`${base}${path}`);
    const ctype = res.headers.get('content-type') ?? '';
    const text = await res.text();
    let parsed: Record<string, unknown> | undefined;
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { parsed = undefined; }
    const isJson = ctype.includes('application/json') && !!parsed;
    // A real metadata doc names a resource or an issuer; the SPA index.html does not.
    const looksRight = isJson && (('resource' in parsed!) || ('issuer' in parsed!) || ('authorization_endpoint' in parsed!));
    if (looksRight) report(`GET ${path}`, true, `JSON metadata (${res.status})`);
    else if (!isJson) report(`GET ${path}`, false, `non-JSON (content-type: ${ctype || 'none'}) — SPA fallback, OAuth not routed`);
    else report(`GET ${path}`, false, `JSON but not OAuth metadata — ${text.slice(0, 100)}`);
  } catch (err) {
    report(`GET ${path}`, false, `request failed: ${(err as Error).message}`);
  }
}

// --- Check 4: AUTHENTICATED initialize + tools/list (proves data files bundled) ---
// The checks above are all file-read-free, so a broken `functions.includeFiles`
// (catalog/** + tools/** not shipped into the function) passes them all while the
// first real MCP call throws ENOENT. This is the only check that reads disk: it
// drives an authenticated `initialize` (→ serverInstructions → loadIndex) and a
// `tools/list` (→ catalog read). Runs only when LOLLY_MCP_TOKEN is in the env.
const token = process.env.LOLLY_MCP_TOKEN;
if (!token) {
  console.log('• skipped authenticated initialize/tools-list — set LOLLY_MCP_TOKEN to run it');
} else {
  const rpc = async (method: string, params: unknown): Promise<{ status: number; body: Record<string, unknown> | undefined }> => {
    const res = await fetch(`${base}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const text = await res.text();
    let body: Record<string, unknown> | undefined;
    try { body = JSON.parse(text) as Record<string, unknown>; } catch { body = undefined; }
    return { status: res.status, body };
  };
  try {
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
    const initOk = init.status === 200 && !!init.body && !init.body.error && !!init.body.result;
    report('POST /api/mcp initialize (authed)', initOk,
      initOk ? 'JSON-RPC result (function has catalog/tools on disk)'
      : init.status === 500 ? 'HTTP 500 — likely ENOENT: includeFiles did not ship catalog/tools'
      : `HTTP ${init.status} — ${JSON.stringify(init.body).slice(0, 120)}`);

    const list = await rpc('tools/list', {});
    const tools = (list.body?.result as { tools?: unknown[] } | undefined)?.tools;
    const listOk = list.status === 200 && Array.isArray(tools) && tools.length > 0;
    report('POST /api/mcp tools/list (authed)', listOk,
      listOk ? `${tools!.length} tools (catalog index read OK)`
      : `HTTP ${list.status} — no non-empty tools array (catalog read failed?)`);
  } catch (err) {
    report('POST /api/mcp (authed)', false, `request failed: ${(err as Error).message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed against ${base}`);
  process.exit(1);
}
console.log(`\nAll live checks passed against ${base}`);
