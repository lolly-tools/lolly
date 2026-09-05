// SPDX-License-Identifier: MPL-2.0
/**
 * The installed desktop app as the Node shells' full-fidelity renderer
 * (plans/202 WP2.2).
 *
 * The CLI, the TUI and the MCP service can already produce every format, but only
 * through a scoped Chromium plus a built web shell. Someone who installed the
 * desktop app has both of those already, bundled and kept current by the app's own
 * updater. So the Node renderer tries the app first.
 *
 * THREE RUNGS, in this order:
 *
 *   1. `desktop-running`   - an app already listening. `render.json` in the app's
 *                            data directory names a port, a per-launch token and the
 *                            process that owns them; a ping over the loopback socket
 *                            confirms it before anything is rendered.
 *   2. `desktop-installed` - an app on this machine that is not listening yet. We
 *                            start it in its hidden `--render-server` mode (no dock
 *                            icon, no window) and wait a bounded time for its
 *                            `render.json` to appear.
 *   3. `chromium`          - the historical tier, with its message unchanged. This
 *                            is what a checkout with no installed app still gets.
 *
 * `LOLLY_RENDERER=desktop|chromium|auto` pins a rung; `auto` is the default and the
 * only value that falls through from one rung to the next. An explicit `desktop`
 * never quietly becomes Chromium, and an explicit `chromium` never launches an app.
 *
 * WIRE PROTOCOL: `u32` big-endian length, then that many bytes of JSON. One request
 * frame out, one reply frame back, then the socket closes. It is defined in
 * `shells/tauri-desktop/src-tauri/src/render_server.rs`, which serves it.
 */
import { constants, existsSync, accessSync, readFileSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { desktopAppDataDir } from './state-dir.ts';

export type RendererPreference = 'auto' | 'desktop' | 'chromium';
/** The three renderers, in the order `auto` tries them. */
export type RendererRung = 'desktop-running' | 'desktop-installed' | 'chromium';
/** What `lolly list --json` reports, including the case where nothing can render. */
export type RendererStatus = RendererRung | 'none';

export class DesktopRendererError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesktopRendererError';
  }
}

export function rendererPreference(value = process.env.LOLLY_RENDERER): RendererPreference {
  const resolved = (value || 'auto').toLowerCase();
  if (resolved === 'auto' || resolved === 'desktop' || resolved === 'chromium') return resolved;
  throw new DesktopRendererError(
    `LOLLY_RENDERER must be "auto", "desktop", or "chromium" (got ${JSON.stringify(value)}).`,
  );
}

// ── which rungs exist, and in what order ─────────────────────────────────────

/** What this machine can actually do, as three yes/no facts. */
export interface RendererAvailability {
  /** A desktop app is listening on the loopback render endpoint right now. */
  running: boolean;
  /** A desktop executable is here and can be started in render-server mode. */
  installed: boolean;
  /** Chromium plus a built web shell. */
  chromium: boolean;
}

/**
 * The rung order for a preference. Pure, so the order is pinned by test rather
 * than discovered from a machine that happens to have an app on it.
 *
 * `chromium` is always in its own order even when unavailable: that rung owns the
 * one message that explains what to install, and swallowing it here would replace
 * a useful sentence with a vaguer one.
 */
export function rendererOrder(preference: RendererPreference, available: RendererAvailability): RendererRung[] {
  if (preference === 'chromium') return ['chromium'];
  const desktop: RendererRung[] = [
    ...(available.running ? (['desktop-running'] as const) : []),
    ...(available.installed ? (['desktop-installed'] as const) : []),
  ];
  if (preference === 'desktop') return desktop;
  return [...desktop, 'chromium'];
}

/** The best renderer this machine has, for the environment report. */
export function rendererStatus(
  available: RendererAvailability, preference: RendererPreference = 'auto',
): RendererStatus {
  if (preference === 'chromium') return available.chromium ? 'chromium' : 'none';
  if (available.running) return 'desktop-running';
  if (available.installed) return 'desktop-installed';
  if (preference === 'desktop') return 'none';
  if (available.chromium) return 'chromium';
  return 'none';
}

// ── finding an installed app ─────────────────────────────────────────────────

/**
 * Every place a Lolly desktop executable might be, best first.
 *
 * The macOS binary inside the bundle is `lolly-desktop`, not `Lolly` - the product
 * name is the bundle's, the Mach-O keeps the crate's. The 1.0.6 build installed on
 * the machine this was written on is `Lolly.app/Contents/MacOS/lolly-desktop`, and
 * looking only for `Lolly` found nothing at all. Both names are tried everywhere,
 * for the same reason.
 */
export function desktopExecutableCandidates(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  userHome = homedir(),
): string[] {
  const explicit = env.LOLLY_DESKTOP_BIN ? [env.LOLLY_DESKTOP_BIN] : [];
  if (platform === 'darwin') {
    const bundles = ['/Applications/Lolly.app', join(userHome, 'Applications', 'Lolly.app')];
    return [
      ...explicit,
      ...bundles.flatMap(app => ['lolly-desktop', 'Lolly'].map(bin => join(app, 'Contents', 'MacOS', bin))),
    ];
  }
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || join(userHome, 'AppData', 'Local');
    const programs = env.ProgramFiles || 'C:\\Program Files';
    const dirs = [
      join(local, 'Lolly'),
      join(local, 'Programs', 'Lolly'),
      join(programs, 'Lolly'),
      ...windowsInstallLocations(env),
    ];
    return [
      ...explicit,
      ...dirs.flatMap(dir => ['Lolly.exe', 'lolly-desktop.exe'].map(bin => join(dir, bin))),
      ...pathCandidates(['Lolly.exe', 'lolly-desktop.exe', 'lolly.exe'], platform, env),
    ];
  }
  return [
    ...explicit,
    ...(env.APPIMAGE ? [env.APPIMAGE] : []),
    ...['lolly-desktop', 'lolly', 'Lolly'].flatMap(bin => [
      join(userHome, '.local', 'bin', bin), join('/usr/bin', bin), join('/app/bin', bin),
    ]),
    ...pathCandidates(['lolly-desktop', 'Lolly', 'lolly'], platform, env),
  ];
}

/** Every `PATH` directory crossed with the names an installed app answers to. */
function pathCandidates(names: string[], platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  const raw = env.PATH || env.Path || '';
  if (!raw) return [];
  const sep = platform === 'win32' ? ';' : delimiter;
  const out: string[] = [];
  for (const dir of raw.split(sep).filter(Boolean).slice(0, 64)) {
    for (const name of names) out.push(join(dir, name));
  }
  return out;
}

/**
 * Where the Windows installer said it put the app. Tauri's NSIS package writes an
 * uninstall key under the bundle identifier; `reg query` is the read that needs no
 * dependency. Any failure is simply no answer, never a thrown error.
 */
function windowsInstallLocations(env: NodeJS.ProcessEnv): string[] {
  if (process.platform !== 'win32') return [];
  const keys = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\tools.lolly.Desktop',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\tools.lolly.Desktop',
  ];
  const found: string[] = [];
  for (const key of keys) {
    try {
      const out = spawnSync('reg', ['query', key, '/v', 'InstallLocation'], {
        encoding: 'utf8', timeout: 4_000, windowsHide: true, env,
      });
      const match = /InstallLocation\s+REG_SZ\s+(.+)/i.exec(out.stdout || '');
      if (match?.[1]) found.push(match[1].trim());
    } catch { /* no registry answer is not an error */ }
  }
  return found;
}

function executable(path: string): boolean {
  try {
    if (!existsSync(path)) return false;
    if (process.platform !== 'win32') accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function findDesktopExecutable(): string | null {
  return desktopExecutableCandidates().find(executable) ?? null;
}

/**
 * Does this executable know how to be a render endpoint?
 *
 * It has to be asked, not assumed. An app that predates the endpoint reads an
 * unknown leading flag as "open the window" (`classify` in `cli.rs`), so starting
 * one with `--render-server` puts a window on someone's screen and then leaves the
 * process running while the caller waits for an advert that will never appear. That
 * happened on the machine this was written on: the installed 1.0.6 build and the
 * source tree's 1.0.6 build differ here, so a version number could not tell them
 * apart either.
 *
 * `--help` is the safe question. Every build has answered it since the CLI mode
 * shipped, it prints and exits without ever building the app, and only a build that
 * serves the endpoint names `--render-server` in the text. Cached per process: the
 * answer cannot change while this process runs, and the render path asks on every
 * job that has no endpoint yet.
 */
const probeCache = new Map<string, boolean>();

export function desktopServesRenderEndpoint(executablePath: string): boolean {
  const cached = probeCache.get(executablePath);
  if (cached !== undefined) return cached;
  let serves = false;
  try {
    const out = spawnSync(executablePath, ['--help'], {
      encoding: 'utf8', timeout: 15_000, windowsHide: true,
    });
    serves = /--render-server/.test(`${out.stdout ?? ''}${out.stderr ?? ''}`);
  } catch {
    serves = false;
  }
  probeCache.set(executablePath, serves);
  return serves;
}

/** Test seam: forget what the probe learned. */
export function resetDesktopProbe(): void {
  probeCache.clear();
}

/**
 * Is there an app here that can be started as a render endpoint? A Lolly that is
 * installed but cannot serve one is deliberately NOT this rung: claiming it would
 * make `lolly list --json` promise a renderer that only ever opens a window.
 */
export function desktopInstalled(executablePath = findDesktopExecutable()): boolean {
  return Boolean(executablePath) && desktopServesRenderEndpoint(executablePath!);
}

// ── the advert file ──────────────────────────────────────────────────────────

/** A render endpoint that is up, as `render.json` describes it. */
export interface RenderServer {
  port: number;
  token: string;
  pid: number;
  version: string;
  /** The advert file this came from. */
  file: string;
}

/** Facts about the machine, injected so tests can drive every rung with no app. */
export interface ServerProbe {
  /** Overrides the app data directory. */
  dataDir?: string | null;
  /** Reads a file, or returns null when it is missing or unreadable. */
  readFile?: (path: string) => string | null;
  /** Is this process id still alive? */
  alive?: (pid: number) => boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * Where the desktop app advertises its render endpoint. `LOLLY_RENDER_SERVER`
 * points at a specific file, for an app installed somewhere unusual and for tests.
 */
export function renderServerPath(probe: ServerProbe = {}): string | null {
  const env = probe.env ?? process.env;
  const override = env.LOLLY_RENDER_SERVER?.trim();
  if (override) return override;
  const dir = probe.dataDir === undefined ? desktopAppDataDir(env) : probe.dataDir;
  return dir ? join(dir, 'render.json') : null;
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists and belongs to someone else. Only ESRCH is
    // proof that nothing is there.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readTextOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Read the advert, if it names a live process. A file left behind by a crashed app
 * is not an endpoint, so the process id is checked before the port is believed.
 */
export function readRenderServer(probe: ServerProbe = {}): RenderServer | null {
  const file = renderServerPath(probe);
  if (!file) return null;
  const raw = (probe.readFile ?? readTextOrNull)(file);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const value = parsed as Partial<Record<keyof RenderServer, unknown>>;
  const port = Number(value.port);
  const pid = Number(value.pid);
  const token = typeof value.token === 'string' ? value.token : '';
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  if (!Number.isInteger(pid) || pid < 1) return null;
  if (!token) return null;
  if (!(probe.alive ?? processAlive)(pid)) return null;
  return { port, token, pid, version: typeof value.version === 'string' ? value.version : '', file };
}

// ── the frame protocol ───────────────────────────────────────────────────────

/**
 * Biggest reply we will hold. A minute of video is well inside it, and a number
 * this size cannot be reached by accident, so a nonsense length header fails fast
 * instead of growing the process.
 */
const MAX_REPLY_BYTES = 256 * 1024 * 1024;

export interface RenderJob {
  /** A full tool link, as `exportUrl` builds it. The URL contract is the payload. */
  toolUrl?: string;
  toolId?: string;
  query?: string;
  format?: string;
  /** Extra inputs and reserved export params, unencoded. */
  params?: Record<string, string>;
  /** Write the bytes here instead of returning them. */
  outPath?: string;
}

interface ServerReply {
  ok?: boolean;
  error?: string;
  bytes?: string;
  size?: number;
  path?: string;
  filename?: string;
  pong?: boolean;
  version?: string;
}

/** Send one framed request to a render endpoint and read its one framed reply. */
function call(port: number, request: unknown, timeoutMs: number): Promise<ServerReply> {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(request), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    const socket = connect({ port, host: '127.0.0.1' });
    let chunks: Buffer[] = [];
    let received = 0;
    let expected: number | null = null;
    let settled = false;
    const finish = (err: Error | null, reply?: ServerReply): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err); else resolve(reply!);
    };
    socket.setTimeout(timeoutMs, () => finish(new DesktopRendererError(
      `The desktop render endpoint on 127.0.0.1:${port} stopped answering after ${Math.round(timeoutMs / 1000)}s.`,
    )));
    socket.on('error', e => finish(new DesktopRendererError(
      `Could not reach the desktop render endpoint on 127.0.0.1:${port}: ${e.message}`,
    )));
    socket.on('connect', () => socket.write(Buffer.concat([header, body])));
    socket.on('data', chunk => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      chunks.push(bytes);
      received += bytes.length;
      if (expected === null && received >= 4) {
        const all = Buffer.concat(chunks);
        expected = all.readUInt32BE(0);
        if (expected > MAX_REPLY_BYTES) {
          finish(new DesktopRendererError(`The desktop render endpoint offered ${expected} bytes, over the ${MAX_REPLY_BYTES}-byte limit.`));
          return;
        }
        chunks = [all];
      }
      if (expected !== null && received >= expected + 4) {
        const all = Buffer.concat(chunks);
        try {
          finish(null, JSON.parse(all.subarray(4, 4 + expected).toString('utf8')) as ServerReply);
        } catch (e) {
          finish(new DesktopRendererError(`The desktop render endpoint sent a reply that is not JSON: ${(e as Error).message}`));
        }
      }
    });
    socket.on('close', () => finish(new DesktopRendererError(
      'The desktop render endpoint closed the connection before it answered.',
    )));
  });
}

const MIME: Record<string, string> = {
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
  mp4: 'video/mp4', webm: 'video/webm', json: 'application/json',
  csv: 'text/csv', html: 'text/html; charset=utf-8',
};

export function mimeForFormat(format: string): string {
  return MIME[format.toLowerCase()] ?? 'application/octet-stream';
}

/** How long one render may take. Video records in real time, so it gets longer. */
function renderTimeout(format: string): number {
  const configured = Number.parseInt(process.env.LOLLY_CLI_TIMEOUT || '', 10);
  const base = Number.isFinite(configured) && configured > 0 ? configured * 1000 : 0;
  const motion = ['webm', 'mp4', 'gif', 'apng'].includes(format.toLowerCase());
  return Math.max(base, motion ? 240_000 : 120_000);
}

/** Ask an endpoint whether it is really there. Cheap, so the environment report can. */
export async function pingRenderServer(server: RenderServer, timeoutMs = 1_500): Promise<boolean> {
  try {
    const reply = await call(server.port, { token: server.token, op: 'ping' }, timeoutMs);
    return reply.ok === true && reply.pong === true;
  } catch {
    return false;
  }
}

/** Run one job on a render endpoint and return the bytes it produced. */
export async function renderViaRenderServer(
  server: RenderServer, job: RenderJob,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const format = job.format || 'png';
  const reply = await call(server.port, { token: server.token, op: 'render', ...job }, renderTimeout(format));
  if (reply.ok !== true) {
    throw new DesktopRendererError(reply.error || 'The desktop renderer refused the job without saying why.');
  }
  if (typeof reply.bytes !== 'string') {
    throw new DesktopRendererError('The desktop renderer reported success but returned no bytes.');
  }
  return { bytes: new Uint8Array(Buffer.from(reply.bytes, 'base64')), mime: mimeForFormat(format) };
}

// ── starting an installed app ────────────────────────────────────────────────

/** How long to wait for a freshly started app to advertise its endpoint. */
const LAUNCH_WAIT_MS = 45_000;

function sleep(ms: number): Promise<void> {
  // Keep this timer referenced. The server process is deliberately detached and
  // unref'd; without a referenced poll timer, a one-shot CLI can exit while it is
  // still awaiting the advert it just asked the desktop app to create.
  return new Promise(done => setTimeout(done, ms));
}

/** The `.app` a macOS executable lives in, when it lives in one. */
function macBundleFor(executablePath: string): string | null {
  const match = /^(.*\.app)\/Contents\/MacOS\/[^/]+$/.exec(executablePath);
  return match?.[1] ?? null;
}

/**
 * Start an app that has already passed the `--render-server` probe, in its hidden
 * render-server mode.
 *
 * On macOS a bundled executable is started through `open -g -a <bundle>`, so
 * LaunchServices runs the whole `.app` in the background rather than a bare Mach-O
 * out of its bundle. Everywhere else the executable is started directly, detached.
 * Either way the app sets its own accessory activation policy, so nothing appears
 * in the dock or the task bar.
 */
function startDesktopServer(executablePath: string | null, platform = process.platform): Promise<boolean> {
  const bundle = executablePath && platform === 'darwin' ? macBundleFor(executablePath) : null;
  if (bundle) {
    try {
      const out = spawnSync('open', ['-g', '-a', bundle, '--args', '--render-server'], {
        encoding: 'utf8', timeout: 10_000,
      });
      return Promise.resolve(out.status === 0);
    } catch {
      return Promise.resolve(false);
    }
  }
  if (executablePath) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (started: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(started);
      };
      try {
        const child = spawn(executablePath, ['--render-server'], {
          detached: true, stdio: 'ignore', windowsHide: true,
        });
        child.once('error', () => finish(false));
        child.once('spawn', () => {
          child.unref();
          finish(true);
        });
      } catch {
        finish(false);
      }
    });
  }
  return Promise.resolve(false);
}

/**
 * Start the app and wait for its endpoint, or answer null within the bounded wait.
 * Null is a fact the caller acts on (fall to Chromium), never an exception.
 *
 * Nothing is started until the executable has said it serves the endpoint. Skipping
 * that check opens a window on an older build and leaves the process behind, which
 * is exactly what happened the first time this ran against a real install.
 */
export async function launchRenderServer(
  opts: { executable?: string | null; probe?: ServerProbe; waitMs?: number } = {},
): Promise<RenderServer | null> {
  const executablePath = opts.executable === undefined ? findDesktopExecutable() : opts.executable;
  if (!executablePath || !desktopServesRenderEndpoint(executablePath)) return null;
  if (!await startDesktopServer(executablePath)) return null;
  const deadline = Date.now() + (opts.waitMs ?? LAUNCH_WAIT_MS);
  while (Date.now() < deadline) {
    await sleep(250);
    const server = readRenderServer(opts.probe);
    if (server && await pingRenderServer(server)) return server;
  }
  return null;
}

// ── the rung walk ────────────────────────────────────────────────────────────

export interface RenderedBytes { bytes: Uint8Array; mime: string }

/** Everything the walk needs, injected so a test can pin the order with no app. */
export interface RendererDrivers {
  /** An endpoint that is already up, or null. */
  runningServer: () => RenderServer | null;
  /** Is a desktop executable here to start? */
  installed: () => boolean;
  /** Start one and wait for its endpoint, or null. */
  launchServer: () => Promise<RenderServer | null>;
  renderOnServer: (server: RenderServer) => Promise<RenderedBytes>;
  renderOnChromium: () => Promise<RenderedBytes>;
  /** Told about each rung that failed while `auto` was still walking. */
  onFallback?: (rung: RendererRung, reason: Error) => void;
}

/**
 * Walk the rungs for a preference and return the first that produced bytes.
 *
 * The order decides what a failure may fall through to: `chromium` is in the order
 * only for `auto` and `chromium`, so an explicit `desktop` that fails reports the
 * desktop failure rather than rendering somewhere else.
 */
export async function renderThroughRungs(
  preference: RendererPreference, drivers: RendererDrivers,
): Promise<{ rung: RendererRung; result: RenderedBytes }> {
  const running = preference === 'chromium' ? null : drivers.runningServer();
  const available: RendererAvailability = {
    running: Boolean(running),
    installed: preference === 'chromium' ? false : drivers.installed(),
    chromium: true,
  };
  const order = rendererOrder(preference, available);
  if (!order.length) {
    throw new DesktopRendererError(
      'LOLLY_RENDERER=desktop, but no Lolly desktop app is running or installed here. ' +
      'Install the app, set LOLLY_DESKTOP_BIN to its executable, or use LOLLY_RENDERER=auto.',
    );
  }
  let last: Error | null = null;
  for (const rung of order) {
    try {
      if (rung === 'desktop-running') return { rung, result: await drivers.renderOnServer(running!) };
      if (rung === 'desktop-installed') {
        const server = await drivers.launchServer();
        if (!server) {
          throw new DesktopRendererError('The installed Lolly app did not open its render endpoint in time.');
        }
        return { rung, result: await drivers.renderOnServer(server) };
      }
      return { rung, result: await drivers.renderOnChromium() };
    } catch (err) {
      last = err instanceof Error ? err : new Error(String(err));
      drivers.onFallback?.(rung, last);
    }
  }
  throw last ?? new DesktopRendererError('No full-fidelity renderer is available.');
}

// ── the environment report ───────────────────────────────────────────────────

export interface DesktopRendererReport {
  /** True when a desktop rung can serve a render here. */
  available: boolean;
  renderer: RendererStatus;
  preference: RendererPreference;
  order: RendererRung[];
  executable?: string;
  server?: { port: number; pid: number; version: string; file: string };
  reason?: string;
}

/**
 * What can render here, checked rather than claimed: the advert is read, the
 * process behind it is confirmed alive, and the endpoint is pinged before this
 * says an app is running.
 */
export async function desktopRendererReport(chromiumAvailable = true): Promise<DesktopRendererReport> {
  const preference = rendererPreference();
  const executablePath = findDesktopExecutable();
  const installed = desktopInstalled(executablePath);
  const advertised = readRenderServer();
  const running = advertised && await pingRenderServer(advertised) ? advertised : null;
  const available: RendererAvailability = {
    running: Boolean(running),
    installed,
    chromium: chromiumAvailable,
  };
  // Keyed off `installed`, not off the executable path, and the two differ: an app
  // that is here but does not serve the render endpoint is not a rung, and saying it
  // is would contradict the `available` beside it. Name that case, since "no app
  // installed" would be wrong in front of someone looking at their own Lolly icon.
  const reason = running || installed
    ? undefined
    : executablePath
      ? `the Lolly app at ${executablePath} does not serve a render endpoint (it predates \`--render-server\`); update it, or render through Chromium`
      : 'no Lolly desktop app is running or installed here (set LOLLY_DESKTOP_BIN to point at one)';
  return {
    available: available.running || available.installed,
    renderer: rendererStatus(available, preference),
    preference,
    order: rendererOrder(preference, available),
    ...(executablePath ? { executable: executablePath } : {}),
    ...(running ? { server: { port: running.port, pid: running.pid, version: running.version, file: running.file } } : {}),
    ...(reason ? { reason } : {}),
  };
}

// ── the one-shot fallback, still used by callers that want a file on disk ─────

function safeExtension(format: string): string {
  return /^[a-z0-9][a-z0-9-]{0,15}$/i.test(format) ? format.toLowerCase() : 'bin';
}

/**
 * Render by running the installed executable once, writing to a file.
 *
 * The endpoint is the path the Node renderer takes. This stays for the callers who
 * want a file rather than bytes, and as the shape the Linux D-Bus `Render` method
 * mirrors. It boots the whole app per render, so it is slower than the endpoint by
 * exactly one cold start.
 */
export async function renderViaDesktopCommand(
  toolUrl: string, format: string, executablePath = findDesktopExecutable(),
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!executablePath) {
    throw new DesktopRendererError('No Lolly desktop renderer is installed. Set LOLLY_DESKTOP_BIN to its executable.');
  }
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'lolly-desktop-render-'));
  const ext = safeExtension(format);
  const output = join(dir, `export.${ext}`);
  try {
    await runOnce(executablePath, toolUrl, output);
    if (!existsSync(output) || statSync(output).size === 0) {
      throw new DesktopRendererError('The desktop renderer exited successfully but wrote no output file.');
    }
    return { bytes: new Uint8Array(await readFile(output)), mime: mimeForFormat(ext) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runOnce(executablePath: string, toolUrl: string, output: string): Promise<void> {
  const seconds = Number.parseInt(process.env.LOLLY_CLI_TIMEOUT || '90', 10);
  const timeoutMs = (Number.isFinite(seconds) && seconds > 0 ? seconds : 90) * 1000 + 10_000;
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, [toolUrl, `--output=${output}`], {
      env: process.env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true,
    });
    let stderr = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', chunk => {
      if (stderr.length < 16_384) stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new DesktopRendererError(`The desktop renderer timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    child.once('error', err => {
      clearTimeout(timer);
      reject(new DesktopRendererError(`Could not launch ${basename(executablePath)}: ${err.message}`));
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new DesktopRendererError(
        `The desktop renderer exited ${code ?? signal ?? 'without a status'}${stderr.trim() ? `: ${stderr.trim()}` : '.'}`,
      ));
    });
  });
}
