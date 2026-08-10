// SPDX-License-Identifier: MPL-2.0
/**
 * The private-collab (plan 100 Track A) REAL-BROWSER drills.
 *
 * WHAT THIS IS. Every other collab suite in the repo runs under jsdom with stubbed
 * effects: the ceremony machine, the codec, the op guard and the mount seam are all
 * covered there, and none of them ever opens an `RTCPeerConnection`. This file is the
 * other half — plan 100 §10's "loopback pair" and "the real two-tab ceremony
 * end-to-end", driven through the SHIPPING UI (Share dialog → invite link → `#/join`
 * → `#/join-reply`) with two real peer connections in one browser.
 *
 * WHY IT IS GATED, TWICE. It needs a headless browser AND a running dev server, and it
 * takes tens of seconds. `npm test` must stay green and fast on a bare machine
 * (tests/README.md, "Gated / conditional tests"), so:
 *
 *   • `LOLLY_BROWSER_DRILLS=1` — the explicit opt-in. Without it the whole describe
 *     skips with the reason printed, exactly like `browserGate()` does for the
 *     sequence-export browser tier.
 *   • a browser must be resolvable — `browserInstalled()` from packages/node-shell,
 *     the same check `tests/helpers/sequence-browser.ts` uses.
 *
 * WHY IT LAUNCHES ITS OWN CHROMIUM rather than reusing `getBrowser()`. Two flags this
 * drill cannot do without, and which have no business in the shared render launcher:
 *
 *   • `--disable-features=WebRtcHideLocalIpsWithMdns`. Chrome replaces host candidates
 *     with `<uuid>.local` mDNS names unless a media permission has been granted
 *     (plan 100 §11.1 — the same snag the QR camera prompt incidentally solves for
 *     real users). A headless container has no mDNS responder to resolve them with, so
 *     the pair would gather candidates and never connect. Turning the obfuscation off
 *     is what makes "host candidates, same machine" true here.
 *   • `--use-fake-ui-for-media-stream` / `--use-fake-device-for-media-stream` so
 *     nothing in the flow can block on a permission prompt.
 *
 * ONE BROWSER CONTEXT, THREE PAGES. `BroadcastChannel` — the §11.25 reply-link handoff
 * — only reaches same-origin contexts sharing a storage partition, which in Playwright
 * means pages of ONE `BrowserContext`. That is also why the drill can enable the
 * feature flag once: the flag lives on the profile record in IndexedDB (`lolly` →
 * `profile` → `me`), `hydrateFeatureFlags` mirrors it to localStorage at every boot,
 * and both are context-scoped. The cost of sharing a context is that both "devices"
 * share a profile and a database; nothing in Track A's ceremony reads either in a way
 * that makes the pair less real, and the alternative (two contexts) would make the
 * link leg untestable and force the paste leg on every run.
 *
 * THE FLAG IS SET THROUGH THE PROFILE, NOT THE MIRROR. Writing `lolly:featureFlags`
 * directly does not survive a reload: `hydrateFeatureFlags(profile)` REBUILDS the
 * mirror from the profile at every boot, filling anything unset from the flag's own
 * `default`. The profile record is the source of truth, so that is what this writes —
 * in BOTH directions, since that `default` went TRUE on 2026-08-10 and the flag-off
 * drill now has to make a flag-off device rather than assume a fresh one is one.
 *
 * WHAT COUNTS AS A FAILURE. Any uncaught page error, on any page, at any point, fails
 * the run (`pageerror` is collected per page and asserted in the last test). Console
 * `error` lines are recorded to the log file but not fatal — the shell logs recoverable
 * things (absent previews, an offline model) that are not this feature's business.
 *
 * ARTIFACTS. Screenshots and a JSON log per page land in `LOLLY_DRILL_OUT`
 * (default `<repo>/.drills/collab`), one numbered PNG per milestone.
 *
 * RUN IT:
 *   LOLLY_BROWSER_DRILLS=1 node --test tests/collab-private.browser.test.ts
 *   # against a dev server you already have up (skips the spawn):
 *   LOLLY_BROWSER_DRILLS=1 LOLLY_DRILL_BASE=http://localhost:5173 node --test …
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { browserInstalled } from '../packages/node-shell/src/browsers.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
// The plate module is pure (no DOM, no RTC, no clock — see its header), so the drill can
// hold the shipping implementation itself rather than a copy of its shape: the regex the
// UI is judged against is the one the UI derives from, and the independent re-derivation
// below runs the real `derivePlate` over fingerprints read out of the live SDP.
import { PLATE_RE, derivePlate } from '../shells/web/src/collab/plate.ts';

// ── Gate ──────────────────────────────────────────────────────────────────────

/** Why the drills can't run here, or null when they can. */
function drillGate(): string | null {
  if (process.env.LOLLY_BROWSER_DRILLS !== '1') {
    return 'set LOLLY_BROWSER_DRILLS=1 to run the private-collab browser drills';
  }
  if (!browserInstalled()) {
    return 'no headless browser: run `npm run install:browser` in shells/cli, or set LOLLY_BROWSER_CHANNEL=chrome';
  }
  return null;
}

const GATE = drillGate();
const OUT = process.env.LOLLY_DRILL_OUT || join(repoRoot(), '.drills', 'collab');

// The tool the pair co-edits. A community tool (present in every profile view), fast to
// mount, and `url` is a plain scalar text control — the simplest possible convergence
// assertion. `padding` is the second control, used for the focus-ring drill.
const TOOL_ID = 'qr-code';
const FIELD = 'url';
const FIELD_2 = 'padding';
/** A value the URL never carried — see the ceremony drill's remount check. */
const SENTINEL = 'https://drill.example/sentinel-before-collab';

// ── Small utilities ───────────────────────────────────────────────────────────

type PageLog = { page: string; console: string[]; errors: string[] };
const logs: PageLog[] = [];
/** Notes every drill records for the final report — kept even when a drill fails. */
const notes: string[] = [];

function note(line: string): void {
  notes.push(line);
  console.log(`[drill] ${line}`);
}

async function shot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ path: join(OUT, `${name}.png`) });
  } catch (e) {
    note(`screenshot ${name} failed: ${(e as Error).message}`);
  }
}

/** Attach the log collectors a page is judged on. */
function watch(page: Page, label: string): PageLog {
  const log: PageLog = { page: label, console: [], errors: [] };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.console.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => { log.errors.push(e.stack || e.message); });
  // Navigations are load-bearing here: the inviter's adoption is a FORCED same-document
  // re-entry, and telling that apart from a document reload (which would destroy the
  // peer connection) is the difference between a passing drill and a lying one.
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) log.console.push(`nav: ${f.url()}`);
  });
  logs.push(log);
  return log;
}

/** Poll `fn` until it returns a truthy value or the deadline passes. */
async function until<T>(fn: () => Promise<T | null | undefined | false>, ms: number, what: string): Promise<T> {
  const deadline = Date.now() + ms;
  let last: unknown;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v as T;
    } catch (e) { last = e; }
    if (Date.now() > deadline) {
      throw new Error(`timed out after ${ms}ms waiting for ${what}${last ? ` (last error: ${(last as Error).message})` : ''}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
}

// ── The dev server ────────────────────────────────────────────────────────────

let server: ChildProcess | null = null;

/** Start `vite` in shells/web and resolve its base URL; reuse LOLLY_DRILL_BASE if set. */
async function startDevServer(): Promise<string> {
  const existing = process.env.LOLLY_DRILL_BASE;
  if (existing) return existing.replace(/\/$/, '');
  const port = Number(process.env.LOLLY_DRILL_PORT || 5199);
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
    cwd: join(repoRoot(), 'shells', 'web'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server = child;
  const base = `http://localhost:${port}`;
  let out = '';
  child.stdout?.on('data', (b: Buffer) => { out += b.toString(); });
  child.stderr?.on('data', (b: Buffer) => { out += b.toString(); });
  await until(async () => {
    if (/ready in/.test(out) || /Local:/.test(out)) return true;
    try {
      const res = await fetch(`${base}/`);
      return res.ok;
    } catch { return false; }
  }, 60_000, `the dev server on ${base}`);
  // The banner can print a beat before the first request is served.
  await until(async () => (await fetch(`${base}/`).then(r => r.ok, () => false)), 30_000, `${base} to answer`);
  return base;
}

function stopDevServer(): void {
  if (!server) return;
  try { server.kill('SIGTERM'); } catch { /* already gone */ }
  server = null;
}

// ── Flag + boot helpers ───────────────────────────────────────────────────────

/**
 * Set `private-collab` for this browser context by writing the PROFILE record —
 * see the header for why the localStorage mirror alone does not survive a reload.
 *
 * BOTH directions are needed, and `on = false` is not a leftover: as of 2026-08-10 the
 * flag's built-in `default` is TRUE (`shells/web/src/feature-flags.ts` — "it starts on",
 * because a default-off flag met a newcomer with "turn this on in your profile, then open
 * the link again" at the only moment they had a reason to care). A fresh context is
 * therefore a flag-ON device, so the §6.3 enable card can only be reached by a device
 * whose stored value is `false` — the person who turned it off. That is what the FLAG-OFF
 * drill writes before it opens the invite; without the write it would be measuring the
 * ordinary join flow and calling the absent card a regression.
 *
 * `jelly-effects` goes OFF in the same write, and that is a HARNESS concession, not a
 * product statement. The flag's built-in default is brand-aware and resolves to ON for
 * the unlocked `lolly-start` profile, which upgrades every sidebar control to a
 * `<jelly-input>` custom element carrying the `data-input-id` on the HOST — the real
 * `<input>` lives in its shadow root, where Playwright's `fill()` refuses to act
 * ("Element is not an <input>…"). Turning the flag off renders the same controls as
 * the plain CSS primitives, which is a shipping configuration (it is a user toggle),
 * and the collab code paths under test read `[data-input-id]` either way. Nothing about
 * convergence, presence or the ceremony is jelly-aware.
 */
async function setPrivateCollab(page: Page, on: boolean): Promise<void> {
  await page.evaluate((want: boolean) => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('lolly');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      let tx: IDBTransaction;
      try { tx = db.transaction('profile', 'readwrite'); }
      catch (e) { db.close(); reject(e); return; }
      const store = tx.objectStore('profile');
      const get = store.get('me');
      get.onsuccess = () => {
        const prof = (get.result || {}) as Record<string, unknown>;
        prof.featureFlags = {
          ...(prof.featureFlags as object || {}),
          'private-collab': want,
          'jelly-effects': false,
        };
        store.put(prof, 'me');
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), on);
}

/**
 * Record every `RTCPeerConnection`'s lifecycle on `window.__rtcDrill`.
 *
 * Pure observation: a subclass that adds listeners and calls through. `rtc-transport.ts`
 * routes its own diagnostics through an injected `log` that production leaves as a no-op,
 * so without this a stalled pairing is a dialog that says "connecting" and nothing else.
 * Installed as an init script so it is in place before the app's first module runs.
 */
const RTC_PROBE = `(() => {
  const w = window;
  w.__rtcDrill = [];
  w.__t0 = Date.now();
  // The live peer connections, kept OUT of \`__rtcDrill\` because that record is
  // serialised across the CDP boundary and an RTCPeerConnection is not. The plate drill
  // reads \`localDescription\`/\`remoteDescription\` off these to re-derive the plate from
  // the certificate fingerprints DTLS actually validated.
  w.__rtcPcs = [];
  // Every presence frame that crossed the lossy lane, both directions. The discovery
  // announcer is invisible otherwise: its whole job is repeating a hello nobody has
  // answered yet, and "did the announce go out, and did it arrive" is the timeline.
  w.__presence = [];
  // Every connection plate this document ever PAINTED, whether or not it survived. The
  // acceptor's Connected screen is torn down by its own live mount within the same task,
  // so a poll cannot see it — but the mutation record still holds the node.
  w.__plates = [];
  try {
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          const hit = [];
          if (n.matches && n.matches('[data-cer-plate]')) hit.push(n);
          if (n.querySelectorAll) for (const el of n.querySelectorAll('[data-cer-plate]')) hit.push(el);
          for (const el of hit) {
            const text = (el.textContent || '').trim();
            if (text) w.__plates.push({ t: Date.now() - w.__t0, text });
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  } catch { /* observation is best-effort; the live read is the other half */ }
  // Document-load counter. \`__rtcDrill\` is per-document, so an empty one is ambiguous
  // ("nothing built a connection" vs "this document is new"); this disambiguates it.
  try {
    const n = Number(sessionStorage.getItem('__docLoads') || 0) + 1;
    sessionStorage.setItem('__docLoads', String(n));
    w.__docLoads = n;
  } catch { w.__docLoads = -1; }
  const Base = w.RTCPeerConnection;
  if (!Base) return;
  class Probed extends Base {
    constructor(...args) {
      super(...args);
      const id = w.__rtcDrill.length;
      // \`trace\` is the load-bearing one: every transition with a millisecond stamp, so
      // "did ICE connect before the dialog left creating-answer" is answerable.
      const rec = { id, ice: [], conn: [], gather: [], candidates: [], trace: [], channels: [] };
      w.__rtcDrill.push(rec);
      w.__rtcPcs.push(this);
      const at = (s) => rec.trace.push((Date.now() - w.__t0) + 'ms ' + s);
      const frame = (dir, data) => {
        try {
          w.__presence.push({ t: Date.now() - w.__t0, dir, data: typeof data === 'string' ? data : '<binary ' + (data && data.byteLength) + 'B>' });
        } catch { /* a frame we cannot read is still a frame that flew */ }
      };
      this.__drillFrame = frame;
      this.addEventListener('iceconnectionstatechange', () => { rec.ice.push(this.iceConnectionState); at('ice:' + this.iceConnectionState); });
      this.addEventListener('connectionstatechange', () => { rec.conn.push(this.connectionState); at('conn:' + this.connectionState); });
      this.addEventListener('icegatheringstatechange', () => { rec.gather.push(this.iceGatheringState); at('gather:' + this.iceGatheringState); });
      this.addEventListener('signalingstatechange', () => at('sig:' + this.signalingState));
      this.addEventListener('icecandidate', (e) => {
        rec.candidates.push(e.candidate ? e.candidate.candidate : '<end-of-candidates>');
      });
      this.addEventListener('datachannel', (e) => {
        rec.channels.push('in:' + e.channel.label);
        at('dc-in:' + e.channel.label);
        e.channel.addEventListener('open', () => at('dc-in-open:' + e.channel.label));
        if (e.channel.label === 'presence') {
          e.channel.addEventListener('message', (m) => frame('in', m.data));
          // The ANSWERER only ever binds channels it received, so without wrapping send
          // here its own announces never appear and the timeline reads as one-sided.
          const send = e.channel.send.bind(e.channel);
          e.channel.send = (data) => { frame('out', data); return send(data); };
        }
      });
    }
    createDataChannel(label, init) {
      const rec = w.__rtcDrill[w.__rtcDrill.length - 1];
      if (rec) rec.channels.push('out:' + label);
      const dc = super.createDataChannel(label, init);
      dc.addEventListener('open', () => { if (rec) rec.trace.push((Date.now() - w.__t0) + 'ms dc-out-open:' + label); });
      if (label === 'presence') {
        const frame = this.__drillFrame;
        // Own property shadowing the prototype method: the transport holds the channel,
        // not this class, so the wrap has to live on the instance it hands over.
        const send = dc.send.bind(dc);
        dc.send = (data) => { frame && frame('out', data); return send(data); };
        dc.addEventListener('message', (m) => frame && frame('in', m.data));
      }
      return dc;
    }
  }
  w.RTCPeerConnection = Probed;
})();`;

/** Read the RTC probe's records off a page (empty when nothing built a connection). */
async function rtcState(page: Page): Promise<unknown> {
  return page.evaluate(() => (window as unknown as { __rtcDrill?: unknown }).__rtcDrill ?? []);
}

/**
 * Can two `RTCPeerConnection`s in THIS browser, on THIS machine, actually pair?
 *
 * The preflight exists because the first three runs of this drill failed identically
 * and the failure looked like Lolly's: both ceremonies reached step 3, exchanged
 * candidates, went `checking` → `disconnected` → `failed`, and the shell painted its
 * "This network blocks direct connections" copy — which is the CORRECT copy for what
 * was happening. It was the macOS Application Firewall dropping inbound UDP to the
 * Playwright-bundled Chromium (an ad-hoc-signed binary with no firewall entry), while
 * an installed Google Chrome has one and pairs instantly. Both peers gathered exactly
 * one candidate, the machine's LAN address; Chrome no longer emits a 127.0.0.1 host
 * candidate, and `--allow-loopback-in-peer-connection` is not in this build.
 *
 * So this runs the same pairing with NO Lolly code in it. A failure here is an
 * environment verdict, and the drill says so instead of blaming the feature.
 */
async function rtcLoopbackWorks(ctx: BrowserContext, origin: string): Promise<boolean> {
  const p1 = await ctx.newPage();
  const p2 = await ctx.newPage();
  try {
    await p1.goto(origin, { waitUntil: 'domcontentloaded' });
    await p2.goto(origin, { waitUntil: 'domcontentloaded' });
    const arm = (role: string) => {
      const w = window as unknown as { __pc: RTCPeerConnection; __open: boolean };
      const pc = new RTCPeerConnection();
      w.__pc = pc;
      w.__open = false;
      if (role === 'offer') {
        const dc = pc.createDataChannel('ops');
        dc.onopen = () => { w.__open = true; };
      } else {
        pc.addEventListener('datachannel', (e) => { e.channel.onopen = () => { w.__open = true; }; });
      }
    };
    await p1.evaluate(arm, 'offer');
    await p2.evaluate(arm, 'answer');
    const gather = async (page: Page) => page.evaluate(async () => {
      const pc = (window as unknown as { __pc: RTCPeerConnection }).__pc;
      await new Promise<void>((r) => {
        if (pc.iceGatheringState === 'complete') return r();
        pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') r(); });
        setTimeout(r, 8000);
      });
      return pc.localDescription?.sdp ?? '';
    });
    await p1.evaluate(async () => {
      const pc = (window as unknown as { __pc: RTCPeerConnection }).__pc;
      await pc.setLocalDescription(await pc.createOffer());
    });
    const offer = await gather(p1);
    await p2.evaluate(async (sdp) => {
      const pc = (window as unknown as { __pc: RTCPeerConnection }).__pc;
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
    }, offer);
    const answer = await gather(p2);
    await p1.evaluate(async (sdp) => {
      await (window as unknown as { __pc: RTCPeerConnection }).__pc.setRemoteDescription({ type: 'answer', sdp });
    }, answer);
    try {
      await until(
        () => p1.evaluate(() => (window as unknown as { __open: boolean }).__open),
        25_000,
        'a bare loopback data channel to open',
      );
      return true;
    } catch { return false; }
  } finally {
    await p1.close().catch(() => {});
    await p2.close().catch(() => {});
  }
}

/** Everything the ceremony dialog is currently saying, for a failure report. */
async function dialogText(page: Page): Promise<string> {
  return page.evaluate(() => {
    // EVERY open dialog, not the first: a ceremony started from the Share dialog has
    // that one still open behind it, and it is earlier in document order.
    const all = [...document.querySelectorAll('dialog')];
    if (!all.length) return '<no dialog>';
    return all
      .map(d => `[${d.hasAttribute('open') ? 'open' : 'closed'}] ${(d.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 400)}`)
      .join('\n');
  });
}

/**
 * The connection plate this page SHOWED — live if the screen is still up, and from the
 * probe's mutation record if it is not.
 *
 * The fallback is not belt-and-braces. The acceptor's Connected screen is painted and
 * then removed by its own live mount inside a single task (`collab-live-mount.ts`: "one
 * navigates and one re-mounts"), so no poll on any interval can be guaranteed to see it,
 * while the MutationObserver's record still references the node that was inserted.
 */
async function readPlate(page: Page): Promise<{ text: string; source: 'screen' | 'record' | 'none' }> {
  return page.evaluate(() => {
    const live = document.querySelector('[data-cer-plate]')?.textContent?.trim();
    if (live) return { text: live, source: 'screen' as const };
    const seen = (window as unknown as { __plates?: { text: string }[] }).__plates ?? [];
    for (let i = seen.length - 1; i >= 0; i--) {
      const text = seen[i]?.text?.trim();
      if (text) return { text, source: 'record' as const };
    }
    return { text: '', source: 'none' as const };
  }).catch(() => ({ text: '', source: 'none' as const }));
}

/**
 * The two DTLS certificate fingerprints of this page's live pairing, as uppercase hex.
 *
 * Read off the peer connection's own descriptions — the local one it minted its blob
 * from, and the remote one it applied — which is the same material `rtc-transport.ts`
 * hands the ceremony, arrived at independently. That is what makes the re-derivation
 * below a check rather than an echo.
 */
async function readFingerprints(page: Page): Promise<{ local: string; remote: string } | null> {
  return page.evaluate(() => {
    const pcs = (window as unknown as { __rtcPcs?: RTCPeerConnection[] }).__rtcPcs ?? [];
    const fp = (sdp: string | null | undefined): string => {
      const m = /^a=fingerprint:\S+ ([0-9A-Fa-f:]+)/m.exec(sdp ?? '');
      return m ? m[1]!.replace(/:/g, '').toUpperCase() : '';
    };
    for (let i = pcs.length - 1; i >= 0; i--) {
      const local = fp(pcs[i]?.localDescription?.sdp);
      const remote = fp(pcs[i]?.remoteDescription?.sdp);
      if (local && remote) return { local, remote };
    }
    return null;
  }).catch(() => null);
}

/** `AABB…` → bytes. Returns null on anything that is not a whole number of hex pairs. */
function hexBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || /[^0-9A-F]/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Wait until this page has a tool index — the acceptor's tool probe reads it. */
async function waitForCatalog(page: Page): Promise<void> {
  await until(
    () => page.evaluate(() => {
      const idx = (window as unknown as { __toolIndex?: { tools?: unknown[] } }).__toolIndex;
      const cached = (() => { try { return localStorage.getItem('sbt-tool-index'); } catch { return null; } })();
      return Boolean(idx?.tools?.length) && Boolean(cached);
    }),
    45_000,
    'the tool index to be synced and cached',
  );
}

// ── Shared drill state ────────────────────────────────────────────────────────

let browser: Browser;
let context: BrowserContext;
let base = '';
let pageA: Page;   // the inviter
let pageB: Page;   // the acceptor
let replyLeg: 'link' | 'paste' | 'none' = 'none';
let rtcPreflight = false;
let browserLabel = '';
/** Set only when BOTH sides reached connected. Every later drill needs a live pair, and
 *  running one without it does not measure the thing it claims to — an absent pill on a
 *  page that never joined is not "the peer left cleanly". */
let ceremonyOk = false;
/** The inviter half, recorded separately — see §6.2a: the two roles are not symmetric. */
let inviterMounted = false;
let inviterKeptState = '';
let inviterParticipants = 0;
/**
 * The connection plate each side showed at connect (§1; Andy's decision, 2026-08-10).
 *
 * Read during the ceremony rather than after it, because the two roles do not hold the
 * screen for the same length of time: the inviter sits on Connected until a human presses
 * "Start editing", while the acceptor's live mount navigates the join view away inside the
 * same task that painted it. `readPlate` therefore prefers the live node and falls back to
 * the probe's mutation record, which holds the node the mount tore down.
 */
let plateA = '';
let plateB = '';
/** The same plate re-derived in Node from the SDP fingerprints, when they were readable. */
let plateDerived = '';
/** Which read each plate came from — the live screen, or the probe's mutation record. */
let plateSources = '';
let plateFingerprints: { a: string; b: string } | null = null;
/** Every presence frame either side put on (or took off) the lossy lane. */
let presenceFrames: { A: unknown[]; B: unknown[] } = { A: [], B: [] };
/** The invite the ceremony minted, reused by the flag-off drill. */
let mintedInvite = '';
let flagOffCopy = '';
let flagOffHasEnable = false;

/** Fail fast, attributed, rather than time out on something that was never going to be there. */
function requirePair(): void {
  assert.equal(ceremonyOk, true, 'BLOCKED: no live pair — the CEREMONY drill above did not connect both sides. Its failure carries the diagnosis.');
}

describe('private collab — real-browser ceremony drills', { skip: GATE ?? false, timeout: 600_000 }, () => {
  before(async () => {
    mkdirSync(OUT, { recursive: true });
    base = await startDevServer();
    note(`dev server: ${base}`);
    const { chromium } = await import('playwright-core');
    const wanted = process.env.LOLLY_BROWSER_CHANNEL;
    const executablePath = process.env.LOLLY_BROWSER_PATH;
    if (!wanted && !executablePath) {
      const { resolveBrowsersDir } = await import('../packages/node-shell/src/browsers.ts');
      process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolveBrowsersDir();
    }
    const launch = async (channel?: string) => chromium.launch({
      ...(channel ? { channel } : {}),
      ...(executablePath && !channel ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        // The reason this drill can connect at all — see the header.
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        // Asks for a 127.0.0.1 host candidate, which would make a same-machine pair a
        // true loopback pair and sidestep any host firewall. Kept because it is free
        // and correct, but VERIFIED NOT TO WORK on Chromium 1234 (Aug 2026): the switch
        // string is not in the binary and the gathered candidate list is unchanged with
        // and without it. `rtcLoopbackWorks` below is the real answer.
        '--allow-loopback-in-peer-connection',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    });
    const open = async (channel?: string) => {
      browser = await launch(channel);
      context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript(RTC_PROBE);
      browserLabel = channel ? `channel:${channel}` : (executablePath ? `path:${executablePath}` : 'bundled chromium');
    };
    await open(wanted);
    // The preflight, and the one automatic recovery this drill performs. A bundled
    // Chromium that cannot pair on a machine whose firewall allows an INSTALLED Chrome
    // is an environment problem with a known fix, and taking it silently would hide the
    // finding — so it is taken loudly, once, and only when no browser was requested.
    rtcPreflight = await rtcLoopbackWorks(context, `${base}/`);
    note(`RTC loopback preflight (${browserLabel}): ${rtcPreflight ? 'pairs' : 'FAILS'}`);
    if (!rtcPreflight && !wanted && !executablePath) {
      note('retrying with the installed Chrome channel — a bundled Chromium has no macOS firewall entry');
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      try {
        await open('chrome');
        rtcPreflight = await rtcLoopbackWorks(context, `${base}/`);
        note(`RTC loopback preflight (${browserLabel}): ${rtcPreflight ? 'pairs' : 'FAILS'}`);
      } catch (e) {
        note(`no installed Chrome to fall back to: ${(e as Error).message}`);
      }
    }
  });

  after(async () => {
    try {
      writeFileSync(join(OUT, 'console.json'), JSON.stringify({
        browser: browserLabel,
        rtcPreflight,
        replyLeg,
        ceremonyOk,
        inviterMounted,
        inviterKeptState,
        inviterParticipants,
        plateA,
        plateB,
        plateSources,
        plateDerived,
        plateFingerprints,
        presenceFrames: {
          A: presenceFrames.A.length,
          B: presenceFrames.B.length,
        },
        flagOffCopy,
        flagOffHasEnable,
        notes,
        logs,
      }, null, 2));
    } catch { /* the report is best-effort */ }
    try { await context?.close(); } catch { /* ignore */ }
    try { await browser?.close(); } catch { /* ignore */ }
    stopDevServer();
  });

  // ── 1. boot + flag ──────────────────────────────────────────────────────────

  it('PREFLIGHT: two peer connections can pair on this machine', () => {
    assert.equal(
      rtcPreflight,
      true,
      `WebRTC cannot pair between two pages of this browser (${browserLabel}) on this machine, with no Lolly code involved. ` +
      'On macOS this is the Application Firewall dropping inbound UDP to a browser binary it has no entry for: ' +
      'System Settings → Network → Firewall → Options, allow incoming connections for the browser, ' +
      'or re-run with LOLLY_BROWSER_CHANNEL=chrome (an installed Chrome usually already has the entry). ' +
      'Every collab drill below depends on this and would otherwise report the feature as broken.',
    );
  });

  it('boots the shell and turns the private-collab flag on', async () => {
    pageA = await context.newPage();
    watch(pageA, 'A(inviter)');
    await pageA.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(pageA);
    await setPrivateCollab(pageA, true);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    const on = await until(
      () => pageA.evaluate(() => {
        try {
          const m = JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}');
          return m['private-collab'] === true;
        } catch { return false; }
      }),
      20_000,
      'the private-collab flag mirror',
    );
    assert.equal(on, true, 'the flag mirror should carry private-collab:true after a reload');
    await shot(pageA, '01-flag-on');
    note('flag enabled via the profile record; mirror survives a reload');
  });

  // ── 2. the ceremony ─────────────────────────────────────────────────────────

  it('CEREMONY: share dialog → invite link → #/join → reply → both sides connected', async () => {
    // A opens the tool CLEAN and types a sentinel BEFORE the ceremony, so the inviter's
    // forced re-entry can be checked against `collab-live-mount.ts`'s own warning: the
    // remount must NOT rebuild the model from the share-link currency (that path is lossy
    // by design, and reading it as though it were not "is how Start a collab silently
    // deleted people's work"). A value the address bar never carried is the only probe
    // that can tell the two apart.
    await pageA.goto(`${base}/#/tool/${TOOL_ID}`, { waitUntil: 'domcontentloaded' });
    await pageA.waitForSelector(`[data-input-id="${FIELD}"]`, { timeout: 45_000 });
    await pageA.fill(`[data-input-id="${FIELD}"]`, SENTINEL);
    // Dispatched rather than clicked: the Share button lives in the actions bar, which
    // another floating control overlaps at this viewport, and Playwright refuses an
    // intercepted click. The handler is the same one a real click runs.
    await pageA.evaluate(() => document.querySelector<HTMLButtonElement>('[data-action="copy-url"]')?.click());
    await pageA.waitForSelector('[data-act="start-private-collab"]', { timeout: 45_000 });
    await shot(pageA, '02-share-dialog');
    note('A: Share dialog shows the "Private collab" section');

    await pageA.click('[data-act="start-private-collab"]');
    await pageA.waitForSelector('#collab-cer-name', { timeout: 20_000 });
    const step1 = await pageA.getAttribute('[data-cer-heading]', 'data-cer-step');
    assert.equal(step1, '1', 'the inviter ceremony should open on step 1');
    await pageA.fill('#collab-cer-name', 'Ada');
    await shot(pageA, '03-invite-name');

    await pageA.click('[data-act="create-invite"]');
    await pageA.waitForSelector('[data-token="copy-invite-link"]', { timeout: 60_000 });
    const inviteLink = (await pageA.textContent('[data-token="copy-invite-link"]'))?.trim() ?? '';
    assert.match(inviteLink, /#\/join\?inv=/, 'the minted invite must be a #/join?inv= link');
    mintedInvite = inviteLink;
    await shot(pageA, '04-invite-minted');
    note(`A: invite minted (${inviteLink.length} chars)`);

    await pageA.click('[data-act="to-waiting"]');
    await pageA.waitForSelector('#collab-cer-reply', { timeout: 20_000 });
    await shot(pageA, '05-waiting');
    note('A: on step 2, waiting for the reply');

    // B: the acceptor arrives cold on the invite link.
    pageB = await context.newPage();
    watch(pageB, 'B(acceptor)');
    await pageB.goto(inviteLink, { waitUntil: 'domcontentloaded' });
    await pageB.waitForSelector('[data-act="join"]', { timeout: 60_000 });
    const stepB = await pageB.getAttribute('[data-cer-heading]', 'data-cer-step');
    assert.equal(stepB, '2', 'the acceptor should be on step 2 (name) after the tool probe');
    await shot(pageB, '06-accept-name');
    note('B: invite decoded, tool probe passed, name step reached');

    await pageB.fill('#collab-cer-name', 'Grace');
    await pageB.click('[data-act="join"]');
    // THE GUARANTEE, at drill level: the acceptor's answer ALWAYS gets published and
    // rendered. On loopback the peer connection reaches ICE `connected` before the answer
    // has been carried back at all, so a ceremony that completes on ICE promotes straight
    // past this screen — the reply is never shown, never copied, never delivered, and the
    // inviter waits for ever on step 2. This selector not appearing IS that bug.
    try {
      await pageB.waitForSelector('[data-token="copy-answer-link"]', { timeout: 60_000 });
    } catch (e) {
      await shot(pageB, '07-B-no-answer-screen');
      const bNow = await rtcState(pageB) as { trace?: string[] }[];
      writeFileSync(join(OUT, 'answer-screen-missing.json'), JSON.stringify({
        bDialog: await dialogText(pageB),
        aDialog: await dialogText(pageA),
        bRtc: bNow,
      }, null, 2));
      const skippedOnIce = (bNow[0]?.trace ?? []).some(l => /ice:(connected|completed)/.test(l));
      assert.fail(
        `the acceptor never showed its reply: ${(e as Error).message}` +
        (skippedOnIce
          ? '\n\nDIAGNOSIS — the acceptor was promoted out of `awaiting-connection` before the ' +
            'answer screen could be acted on. Its peer connection reached ICE `connected` ' +
            'pre-answer (loopback/LAN peer-reflexive checks get there before the reply has ' +
            'been delivered), so anything that treats ICE `connected` as "the pair is usable" ' +
            'skips the one step a human still has to perform. `connected` must be gated on ' +
            'the transport `ready` event (the ops channel open — which cannot happen until ' +
            'BOTH descriptions are applied), and the answer must be published and rendered ' +
            'before any promotion can be considered. See shells/web/src/collab/ceremony.ts, ' +
            '"What \'connected\' MEANS" and the publish-before-promote guarantee.\n' +
            `Acceptor trace: ${JSON.stringify(bNow[0]?.trace ?? [])}`
          : ''),
      );
    }
    // THE EVIDENCE. Read the instant the answer screen exists — i.e. the instant the
    // machine left `creating-answer` for `awaiting-connection`. Anything already in this
    // trace happened while the machine was still minting, and `onIce` drops ICE events
    // in that phase (see the ceremony assertion below).
    const bAtAnswer = await rtcState(pageB) as { trace?: string[] }[];
    const answerLink = (await pageB.textContent('[data-token="copy-answer-link"]'))?.trim() ?? '';
    const answerCode = (await pageB.textContent('[data-token="copy-answer-code"]'))?.trim() ?? '';
    assert.match(answerLink, /#\/join-reply\?ans=/, 'the reply must be a #/join-reply?ans= link');
    await shot(pageB, '07-answer-minted');
    note('B: answer minted');

    // The LINK leg (§11.25): a third tab in the same context hands the payload to A's
    // waiting dialog over the ceremony BroadcastChannel. Falls back to the paste leg.
    const pageC = await context.newPage();
    watch(pageC, 'C(join-reply)');
    await pageC.goto(answerLink, { waitUntil: 'domcontentloaded' });
    // "Delivered" is A LEAVING the waiting screen, not the field briefly holding text:
    // `deliverReplyToDialog` fills the field and clicks submit in the same turn, so a
    // poll can (and did, first run) miss the filled state entirely.
    let delivered = false;
    try {
      await until(
        () => pageA.evaluate(() => !document.querySelector('#collab-cer-reply')),
        20_000,
        'the reply link to reach A over BroadcastChannel and spend the waiting screen',
      );
      delivered = true;
      replyLeg = 'link';
    } catch (e) {
      note(`reply LINK leg did not deliver: ${(e as Error).message}`);
    }
    await shot(pageC, '08-join-reply-tab');
    if (!delivered) {
      replyLeg = 'paste';
      await pageA.fill('#collab-cer-reply', answerCode);
      await pageA.click('[data-act="submit-reply"]');
    }
    note(`reply leg exercised: ${replyLeg} (join-reply tab says: ${
      (await pageC.textContent('[data-collab-body]').catch(() => null))?.trim() ?? 'n/a'})`);
    try { await pageC.close(); } catch { /* ignore */ }

    // Both sides reach connected. A stall here is the interesting failure, so the whole
    // window is TRACED — every half-second, what each dialog says and where each peer
    // connection is — and written out whether it passes or fails.
    const timeline: unknown[] = [];
    // EVERY read here tolerates a destroyed execution context. The inviter's adoption is
    // a real navigation mid-window, and an observer that dies of the thing it is meant to
    // observe is worse than no observer.
    const peek = async (page: Page) => page.evaluate(() => ({
      loads: (window as unknown as { __docLoads?: number }).__docLoads,
      href: location.href,
      step: document.querySelector('[data-cer-heading]')?.getAttribute('data-cer-step') ?? null,
      head: document.querySelector('[data-cer-heading]')?.textContent ?? null,
      done: Boolean(document.querySelector('[data-act="done"]')),
      plate: document.querySelector('[data-cer-plate]')?.textContent?.trim() ?? null,
      pill: document.querySelectorAll('.collab-pill .collab-av').length,
      rtc: (window as unknown as { __rtcDrill?: { trace: string[] }[] }).__rtcDrill?.map(r => r.trace.join(' | ')) ?? [],
    })).catch(() => null);
    /**
     * "This side's ceremony completed", per role — and the two roles do NOT look the same.
     *
     * The inviter is already in the tool, so its dialog sits on the Connected screen until
     * a human presses "Start editing": `[data-act="done"]` is a stable state to observe.
     * The acceptor arrived cold on `#/join`, so `onConnected` hands the pair straight to
     * `lib/collab-live-mount.ts`, which NAVIGATES to the tool — the route change tears the
     * join view down and the dialog closes with it (`collab-live-mount.ts`: "one navigates
     * and one re-mounts"). Its Connected screen therefore exists for less than a frame,
     * and polling for that button is polling for something the product deliberately does
     * not leave on screen.
     *
     * So the acceptor is judged by what its completion PRODUCES, which is the stronger
     * evidence anyway: the ceremony dialog gone and a live collab mount in its place. The
     * only path to that mount is the dialog's `onConnected`, which fires on phase
     * `connected` and nowhere else — a mounted acceptor is a proof that its machine
     * completed, where the button was only ever a proxy for it.
     */
    const completed = (side: { done: boolean; step: string | null; pill: number } | null, role: 'inviter' | 'acceptor'): boolean => {
      if (!side) return false;
      if (side.done) return true;
      return role === 'acceptor' && side.step === null && side.pill >= 1;
    };
    let connected = false;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const [a, b] = await Promise.all([peek(pageA), peek(pageB)]);
      timeline.push({ t: Date.now(), a, b });
      if (completed(a, 'inviter') && completed(b, 'acceptor')) { connected = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    writeFileSync(join(OUT, 'ceremony-timeline.json'), JSON.stringify(timeline, null, 2));

    // THE PLATE, read at the connected step and before anything is pressed — the inviter
    // is still on the Connected screen and the acceptor's record of it is still warm.
    // Asserted in its own drill below so a mismatch reads as a mismatch rather than as a
    // ceremony that did not connect.
    const [readA, readB] = await Promise.all([readPlate(pageA), readPlate(pageB)]);
    plateA = readA.text;
    plateB = readB.text;
    plateSources = `A:${readA.source} B:${readB.source}`;
    if (plateA) await shot(pageA, '09b-A-plate');
    note(`plates at connect: A=${JSON.stringify(plateA)} (${readA.source}) B=${JSON.stringify(plateB)} (${readB.source})`);

    // The INVITER half is measured before any verdict on the pair. It is a separate
    // claim from "both sides connected" (§6.2a makes the roles asymmetric on purpose),
    // and when the acceptor stalls it is the only half there is evidence for — losing
    // that evidence to a bare `assert.fail` would be throwing away a real result.
    if (await pageA.evaluate(() => Boolean(document.querySelector('[data-act="done"]')))) {
      await shot(pageA, '09-A-connected');
      await pageA.click('[data-act="done"]');
      try {
        await pageA.waitForSelector('.collab-pill', { timeout: 30_000 });
        inviterMounted = true;
        inviterKeptState = await pageA.inputValue(`[data-input-id="${FIELD}"]`).catch(() => '');
        inviterParticipants = await pageA.evaluate(() => document.querySelectorAll('.collab-pill .collab-av').length);
        await shot(pageA, '11-A-mounted');
        note(`A: connected → adopted → remounted with the pill (${inviterParticipants} participant(s)); url field = ${JSON.stringify(inviterKeptState)}`);
      } catch (e) {
        note(`A reached connected but never showed a pill: ${(e as Error).message}`);
      }
    }
    // Still conditional, and still worth trying: an acceptor whose handoff has not yet
    // navigated (a slow seed) IS on the Connected screen, and pressing the button is what
    // a person would do. The usual case is the other one — the mount got there first —
    // which is recorded rather than skipped past, because "which signal completed the
    // acceptor" is exactly the thing this drill exists to report.
    if (await pageB.evaluate(() => Boolean(document.querySelector('[data-act="done"]')))) {
      await shot(pageB, '10-B-connected');
      await pageB.click('[data-act="done"]');
      note('B: completed on the Connected screen, pressed "Start editing"');
    } else if (connected) {
      await shot(pageB, '10-B-connected');
      note('B: completed by handoff — the dialog closed itself and the live mount took the pair');
    }

    if (!connected) {
      await shot(pageA, '09-A-stalled');
      await shot(pageB, '10-B-stalled');
      const earlyIce = (bAtAnswer[0]?.trace ?? []).some(l => /ice:(connected|completed)/.test(l));
      writeFileSync(join(OUT, 'ceremony-stall.json'), JSON.stringify({
        aDialog: await dialogText(pageA),
        bDialog: await dialogText(pageB),
        acceptorTraceWhenAnswerScreenAppeared: bAtAnswer,
        aRtc: await rtcState(pageA),
        bRtc: await rtcState(pageB),
        tail: timeline.slice(-6),
      }, null, 2));
      note('ceremony stalled — see ceremony-stall.json / ceremony-timeline.json');
      // Both sides published their payloads and neither reached `connected`. With the
      // completion signal now being the ops channel rather than ICE, the live suspect is
      // the lane: `ice:connected` in the trace with no `chan:ops:open` means the
      // descriptions never both landed, or the channels never opened over them.
      const laneOpened = (await rtcState(pageB) as { trace?: string[] }[])
        .some(r => (r.trace ?? []).some(l => /chan:ops:open|ops.*open/.test(l)));
      note(`acceptor ops lane observed open: ${laneOpened}`);
      assert.fail(
        'the pair never reached the connected screen on both sides.' +
        (earlyIce && !laneOpened
          ? '\n\nNOTE — the acceptor had ICE up early and its ops channel never opened, so ' +
            'this is a CHANNEL failure, not the ceremony dropping an edge: `connected` is ' +
            'gated on the transport `ready` event by design (ICE-connected is not ' +
            'session-usable). Look at whether both descriptions were applied.'
          : '') +
        (earlyIce
          ? '\n\nHISTORICAL — the first drill\'s acceptor-side race in shells/web/src/collab/ceremony.ts.\n' +
            "The acceptor's peer connection reached ICE `connected` BEFORE the answer screen " +
            'rendered — i.e. while `startAnswer` was still awaiting `effects.createAnswer()` ' +
            "(which waits for ICE gathering to complete before it can mint the reply blob), so " +
            'the machine was still in phase `creating-answer`. `onIce` drops BOTH relevant ' +
            'states in that phase: `checking` only arms the 45s connect watchdog when the ' +
            'phase is already `awaiting-connection`, and `connected` returns early unless the ' +
            'phase is `connecting` or `awaiting-connection`. ICE never transitions again, and ' +
            'nothing re-reads the transport\'s CURRENT state on phase entry — the signal is ' +
            'edge-triggered only. The acceptor therefore sits on "Step 3 of 3: Send the reply ' +
            'back" until ANSWER_WAIT_MS (10 minutes) expires, while the inviter is fully live: ' +
            'all three data channels open on both sides, and the inviter\'s pill shows one ' +
            'participant forever.\n' +
            'It is not a flake — on a loopback/LAN pair ICE connects tens of ms after ' +
            "setLocalDescription, and gathering-complete is always slower.\n" +
            `Acceptor trace at the moment the answer screen appeared: ${JSON.stringify(bAtAnswer[0]?.trace ?? [])}`
          : ''),
      );
    }
    ceremonyOk = true;
    note('both pages reached the connected screen');

    assert.equal(inviterMounted, true, "the inviter's forced remount should have adopted the pair");
    // B's mount is live: the acceptor was never in the tool, so this is a navigation.
    await pageB.waitForSelector('.collab-pill', { timeout: 60_000 });
    await pageB.waitForSelector(`[data-input-id="${FIELD}"]`, { timeout: 60_000 });
    await shot(pageB, '12-B-mounted');
    const bUrl = pageB.url();
    assert.match(bUrl, new RegExp(TOOL_ID), 'the acceptor should land on the tool route');
    note(`A remount + B ephemeral mount both live (B at ${bUrl})`);
  });

  /**
   * PLATE — the confirmation, not a carrier (plan 100 §1; Andy's decision, 2026-08-10).
   *
   * The plate is Lolly's ZRTP-style SAS: six characters derived from BOTH DTLS certificate
   * fingerprints, shown on both screens at connect, compared out loud. Its entire security
   * claim is the EQUALITY — two people reading the same six characters have proved each
   * device is holding the other's real certificate, because a middleman terminating DTLS
   * on both sides has two certificates of its own and cannot make the two derivations
   * agree. So the load-bearing assertion here is plate(A) === plate(B) on two pages that
   * connected through the shipping ceremony, which is the one thing no unit test can
   * establish: `plate.test.ts` pins the maths and `collab-ceremony.test.ts` pins the
   * painting, but only a real pairing can show that the material each side fed in was the
   * material the handshake validated.
   *
   * The shape assertion (`XXX-XXX`, 7 characters) comes second, and the re-derivation
   * third: `derivePlate` is run HERE, in Node, over fingerprints parsed out of each page's
   * live SDP — a path that shares no code with the dialog. A plate that matches across
   * pages but not the certificates would be a plate confirming something other than this
   * connection.
   */
  it('PLATE: both screens show the same connection plate, derived from the two DTLS fingerprints', async () => {
    requirePair();
    assert.ok(
      plateA,
      'the inviter showed no connection plate on its Connected screen. The pairing still works — `syncPlate` drops to no plate rather than a wrong one — but the confirmation step is missing, so nothing tells the two humans their session was not intercepted. Look at `plateMaterial()` on the transport effects (shells/web/src/collab/rtc-transport.ts) and `syncPlate` in shells/web/src/components/collab-ceremony.ts.',
    );
    assert.ok(
      plateB,
      "the acceptor showed no connection plate. Its Connected screen is torn down by its own live mount inside one task, so this is read from the probe's mutation record — an empty record means the node was never inserted with text, i.e. the derivation had not resolved by the time the screen painted (or `plateMaterial` was absent on the acceptor side).",
    );
    for (const [label, plate] of [['A(inviter)', plateA], ['B(acceptor)', plateB]] as const) {
      assert.equal(plate.length, 7, `${label}'s plate should be 7 characters (XXX-XXX), got ${JSON.stringify(plate)}`);
      assert.match(plate, PLATE_RE, `${label}'s plate should be two groups of three from the plate alphabet`);
    }
    assert.equal(
      plateA,
      plateB,
      'THE PLATES DIFFER. This is the failure the plate exists to make visible: two devices that hashed different pairs of DTLS fingerprints. On a loopback drill there is no middleman, so a mismatch here means the derivation is not fed the material the handshake validated — check that `plateMaterial()` returns the fingerprint from the LOCAL description and the one decoded from the peer blob (not a re-read or a cached one), and that `orderFingerprints` is collapsing (mine, theirs) and (theirs, mine) to one ordered pair.',
    );
    await shot(pageB, '09c-B-plate');
    note(`plate agreed on both screens: ${plateA} (read from ${plateSources})`);

    // …and it is the plate for THESE certificates. Best-effort by design: if the SDP does
    // not yield both fingerprints the equality above still stands on its own.
    const [fpA, fpB] = await Promise.all([readFingerprints(pageA), readFingerprints(pageB)]);
    if (fpA) plateFingerprints = { a: `${fpA.local}/${fpA.remote}`, b: fpB ? `${fpB.local}/${fpB.remote}` : '' };
    const local = fpA ? hexBytes(fpA.local) : null;
    const remote = fpA ? hexBytes(fpA.remote) : null;
    if (!local || !remote) {
      note('plate re-derivation skipped: no readable a=fingerprint pair in the inviter SDP');
      return;
    }
    plateDerived = await derivePlate(local, remote);
    assert.equal(
      plateDerived,
      plateA,
      `the plate on screen is not the plate these two certificates derive to (screen ${plateA}, certificates ${plateDerived}). The two sides agreeing with each other but not with the handshake means the confirmation is confirming something else.`,
    );
    if (fpA && fpB) {
      // Free, and it says the pairing is the one it looks like: each side's local
      // fingerprint is the other's remote.
      note(`fingerprints cross correctly: ${fpA.local === fpB.remote && fpA.remote === fpB.local}`);
    }
    note(`plate re-derived in Node from the live SDP fingerprints: ${plateDerived}`);
  });

  // ── 3. the inviter half (measurable even when the acceptor stalls) ──────────

  it('INVITER: the forced remount adopts the pair and does NOT rebuild from the share link', () => {
    assert.equal(inviterMounted, true, 'the inviter should reach connected, adopt the pair and remount with the collab pill');
    // The check `collab-live-mount.ts`'s header asks for by name. `buildShareParams` drops
    // any value whose string form runs past 150 chars and every `user/` asset id, so a
    // remount that went through that currency would come back with the tool's DEFAULT url,
    // not the one the person had typed a moment earlier.
    assert.equal(
      inviterKeptState,
      SENTINEL,
      'starting a collab must not overwrite the inviter\'s live model with the lossy share-link round trip',
    );
    assert.ok(inviterParticipants >= 1, 'the pill should carry at least the local participant');
  });

  /**
   * The inviter starts a collab from INSIDE the Share dialog, and that dialog is a
   * `:modal` `<dialog>` — while it is open the rest of the document is inert. So the
   * ceremony completing is not, on its own, a person who can edit: if the Share dialog
   * is still up when the tool remounts, the sidebar cannot be focused or typed into and
   * the canvas cannot be clicked. `document.activeElement` stays on the "Start a collab"
   * button, `input.focus()` is a no-op, and a trusted keystroke goes nowhere.
   *
   * This is asserted on its own, BEFORE convergence, because a modal over the tool would
   * otherwise fail the next three drills as timeouts that read like "the pair is dead"
   * when the pair is fine (measured: with the dialog dismissed, both directions converge
   * in ~20ms). And the dialog is dismissed either way, so what the later drills measure
   * is their own subject rather than this.
   *
   * The sibling button one function along in `lib/collab-share-private.ts` already does
   * the right thing, with the reason written next to it: `join-private-collab` calls
   * `ctx.close?.()` first — "Dismiss first: this is a modal, and a route change under an
   * open one leaves the dialog covering the page it just navigated to."
   */
  it('INVITER: the Share dialog does not outlive the ceremony it launched', async () => {
    requirePair();
    const before = await pageA.evaluate(() => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog.share-dialog');
      const field = document.querySelector<HTMLInputElement>('[data-input-id="url"]');
      field?.focus();
      return {
        open: Boolean(dialog?.open),
        modal: Boolean(dialog?.matches(':modal')),
        active: document.activeElement?.tagName ?? null,
        fieldTookFocus: document.activeElement === field,
      };
    });
    await shot(pageA, '22-A-after-adoption');
    note(`A after adoption: share dialog open=${before.open} modal=${before.modal}; focus went to ${before.active} (the url field took it: ${before.fieldTookFocus})`);
    // Dismissed whatever the verdict — see the doc comment.
    if (before.open) {
      await pageA.keyboard.press('Escape');
      await until(
        () => pageA.evaluate(() => !document.querySelector('dialog.share-dialog[open]')),
        10_000,
        'the Share dialog to close on Escape',
      );
    }
    assert.equal(
      before.open,
      false,
      'starting a collab must dismiss the Share dialog it was started from: it is a `:modal` <dialog>, so leaving it open makes the whole tool inert — the person who just started a collab cannot type in their own sidebar until they find and press Escape. `lib/collab-share-private.ts`, the `start-private-collab` click handler, needs the `ctx.close?.()` its `join-private-collab` sibling already does.',
    );
  });

  it('FLAG-OFF: an invite opened on a device without the flag is refused, not broken', async () => {
    assert.ok(mintedInvite, 'needs an invite from the ceremony drill');
    // A FRESH context, and then the flag is turned OFF in it. Both halves are load-bearing.
    // The context is fresh because the flag lives on the profile record, which is
    // context-scoped, so nothing this suite did to page A's device can leak in. The write
    // is there because a fresh device is no longer a flag-off device: the built-in default
    // went TRUE on 2026-08-10 (see `setPrivateCollab`), so without it this drill would open
    // the invite on a flag-ON device, walk the ordinary join flow, and read the absent
    // enable card as a missing feature. The device this models is the one that can still
    // exist — somebody who turned private collab off and was then sent an invite.
    const clean = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const page = await clean.newPage();
      watch(page, 'D(flag-off join)');
      // The profile is the source of truth, but `isFlagOnSync` reads the localStorage
      // mirror, and `hydrateFeatureFlags` only rebuilds that mirror at boot — so the write
      // needs a load to happen on, and a reload to be believed.
      await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
      await waitForCatalog(page);
      await setPrivateCollab(page, false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const off = await until(
        () => page.evaluate(() => {
          try {
            const m = JSON.parse(localStorage.getItem('lolly:featureFlags') || '{}');
            return m['private-collab'] === false;
          } catch { return false; }
        }),
        20_000,
        'the private-collab flag mirror to read false on the clean device',
      );
      assert.equal(off, true, 'the clean device should carry private-collab:false before the invite is opened');
      await page.goto(mintedInvite, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-collab-title]', { timeout: 45_000 });
      const title = (await page.textContent('[data-collab-title]'))?.trim() ?? '';
      const body = (await page.textContent('[data-collab-body]'))?.trim() ?? '';
      // Either spelling counts: `data-act="enable-collab"` is the contract `join-route.ts`
      // ships, and the text match keeps the drill honest against a card that is rebuilt
      // without the attribute.
      const hasEnable = await page.evaluate(() => Boolean(
        document.querySelector('[data-act="enable-collab"]')
        ?? [...document.querySelectorAll('button')].find(b => /turn (it )?on/i.test(b.textContent ?? '')),
      ));
      await shot(page, '20-flag-off-join');
      // §6.3 "enable-on-accept": the floor is a sentence rather than a dead end, and the
      // ceiling is an offer the reader can act on without leaving the page. Which of the
      // two arrived is RECORDED as well as asserted — the copy is the evidence when this
      // fails, and the difference between "refused" and "offered" is the whole feature.
      assert.ok(title.length > 0, 'the flag-off join page must say something');
      note(`flag-off #/join → "${title}" / "${body}" (enable-and-continue control present: ${hasEnable})`);
      flagOffCopy = `${title} — ${body}`;
      flagOffHasEnable = hasEnable;
      assert.equal(hasEnable, true, '§6.3 enable-on-accept: an invite must never dead-end an ungoverned user whose flag is off');
      // …and the half that matters: "no reload, no re-paste". Clicking it must walk into
      // the accept ceremony carrying the SAME invite payload.
      await page.evaluate(() => {
        const el = document.querySelector<HTMLButtonElement>('[data-act="enable-collab"]')
          ?? [...document.querySelectorAll('button')].find(b => /turn (it )?on/i.test(b.textContent ?? ''));
        (el as HTMLButtonElement | undefined)?.click();
      });
      await page.waitForSelector('[data-act="join"]', { timeout: 45_000 });
      await shot(page, '21-flag-off-enabled');
      note('§6.3 enable-on-accept: "Turn on and continue" walked straight into the accept ceremony (no reload, no re-paste)');
    } finally {
      await clean.close().catch(() => {});
    }
  });

  // ── 4. convergence ──────────────────────────────────────────────────────────

  it('CONVERGENCE: an edit on A reaches B, and an edit on B reaches A', async () => {
    requirePair();
    const fromA = `https://drill.example/a-${Date.now()}`;
    await pageA.fill(`[data-input-id="${FIELD}"]`, fromA);
    await until(
      () => pageB.evaluate((sel) => {
        const el = document.querySelector<HTMLInputElement>(sel);
        return el?.value ?? '';
      }, `[data-input-id="${FIELD}"]`).then(v => v === fromA),
      30_000,
      "B's model to reflect A's edit",
    );
    await shot(pageB, '13-B-sees-A-edit');
    note('A → B convergence: OK');

    const fromB = `https://drill.example/b-${Date.now()}`;
    await pageB.fill(`[data-input-id="${FIELD}"]`, fromB);
    await until(
      () => pageA.evaluate((sel) => {
        const el = document.querySelector<HTMLInputElement>(sel);
        return el?.value ?? '';
      }, `[data-input-id="${FIELD}"]`).then(v => v === fromB),
      30_000,
      "A's model to reflect B's edit",
    );
    await shot(pageA, '14-A-sees-B-edit');
    note('B → A convergence: OK');

    // The canvas, not only the sidebar — a value that never reached the runtime would
    // still show in the control it was typed into.
    const canvasHasIt = await pageB.evaluate(() => {
      const canvas = document.querySelector('#tool-content, .tool-canvas, #tool-canvas');
      return (canvas?.innerHTML ?? '').length > 0;
    });
    assert.equal(canvasHasIt, true, 'the peer canvas should have rendered content');
  });

  it('PRESENCE: both pills show two participants', async () => {
    requirePair();
    for (const [label, page] of [['A', pageA], ['B', pageB]] as const) {
      const count = await until(
        () => page.evaluate(() => document.querySelectorAll('.collab-pill .collab-av').length).then(n => (n >= 2 ? n : false)),
        30_000,
        `${label}'s pill to show two participants`,
      );
      note(`${label}: pill shows ${count} participants`);
    }
    await shot(pageA, '15-A-pill');
    await shot(pageB, '16-B-pill');
    // The wire behind the pills. The discovery announcer (lib/collab-session.ts) exists
    // because a serverless pair starts with two empty rosters and the engine's occupancy
    // rule would keep both politely silent, so the frames that broke that silence — and
    // how many repeats the lossy lane needed — are the evidence that it did its job.
    const frames = async (page: Page) => page
      .evaluate(() => (window as unknown as { __presence?: unknown[] }).__presence ?? [])
      .catch(() => [] as unknown[]);
    presenceFrames = { A: await frames(pageA), B: await frames(pageB) };
    writeFileSync(join(OUT, 'presence-timeline.json'), JSON.stringify(presenceFrames, null, 2));
    const count = (side: unknown[], dir: string) => side.filter(f => (f as { dir?: string }).dir === dir).length;
    note(`presence frames — A: ${count(presenceFrames.A, 'out')} out / ${count(presenceFrames.A, 'in')} in; ` +
      `B: ${count(presenceFrames.B, 'out')} out / ${count(presenceFrames.B, 'in')} in`);
  });

  it('FOCUS: focusing a control on B paints a peer focus ring on A', async () => {
    requirePair();
    await pageB.focus(`[data-input-id="${FIELD_2}"]`);
    const found = await until(
      () => pageA.evaluate(() => {
        const box = document.querySelector('.collab-focus-box');
        const row = document.querySelector('.input-row.is-remote-focus');
        return Boolean(box || row);
      }),
      30_000,
      "A to paint B's focus ring",
    );
    assert.equal(found, true);
    await shot(pageA, '17-A-focus-ring');
    note('peer focus ring: OK');
  });

  // ── 4. hygiene ──────────────────────────────────────────────────────────────

  it('HYGIENE: A navigating away leaves B honest about the peer', async () => {
    requirePair();
    // An in-app route change (not a reload) — the path that runs the view's
    // collabTeardown rather than tearing the whole document down.
    await pageA.evaluate(() => { window.location.hash = '#/p'; });
    const state = await until(
      () => pageB.evaluate(() => {
        const pill = document.querySelector('.collab-pill');
        if (!pill) return 'pill-gone';
        const avs = pill.querySelectorAll('.collab-av');
        const away = pill.querySelectorAll('.collab-av[data-away]');
        const dot = pill.querySelector('.collab-dot')?.className ?? '';
        if (avs.length <= 1) return `alone (${avs.length} avatar, dot="${dot}")`;
        if (away.length >= 1) return `peer away (dot="${dot}")`;
        return false;
      }),
      45_000,
      "B to notice the peer left (TTL is 30s; a clean teardown should be far faster)",
    );
    await shot(pageB, '18-B-peer-gone');
    note(`B after A left: ${state}`);
  });

  it('HYGIENE: reloading B lands on an honest state (re-pair needed is the contract)', async () => {
    requirePair();
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await pageB.waitForSelector(`[data-input-id="${FIELD}"], [data-collab-join]`, { timeout: 60_000 });
    // A reload destroys the peer connection; a private collab has no server to resume
    // from (plan 100 §6.1: "a dropped connection needs a fresh ceremony"). The only
    // wrong outcome is a pill still claiming a live pair.
    const claims = await pageB.evaluate(() => {
      const pill = document.querySelector('.collab-pill');
      return { pill: Boolean(pill), avatars: pill ? pill.querySelectorAll('.collab-av').length : 0 };
    });
    await shot(pageB, '19-B-reloaded');
    note(`B after reload: pill=${claims.pill} avatars=${claims.avatars}`);
    assert.equal(claims.pill && claims.avatars > 1, false, 'a reloaded acceptor must not still claim a live pair');
  });

  // ── 5. the log gate ─────────────────────────────────────────────────────────

  it('no page threw an uncaught error', () => {
    const failed = logs.filter(l => l.errors.length);
    assert.equal(
      failed.length,
      0,
      failed.map(l => `${l.page}:\n${l.errors.join('\n---\n')}`).join('\n\n'),
    );
  });
});

if (GATE) console.log(`[collab drills] skipped — ${GATE}`);
