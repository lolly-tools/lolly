// SPDX-License-Identifier: MPL-2.0
/**
 * "What can THIS installation actually do?" - the capability report an agent reads
 * before it tries something, instead of discovering it from an exit 3.
 *
 * Exit 3 (`UNAVAILABLE_HERE`) is the contract's retry-on-another-runner code, and it is
 * honest, but it is also after the fact: a pipeline that wants a PDF learns it needs a
 * browser only once the render has failed. This is the same information up front.
 *
 * It is reported INSIDE the `list --json` envelope's `result.environment` rather than
 * as a new `lolly capabilities` command. The contract freezes the command list (section 1.1)
 * and explicitly allows keys to be added inside `result` (section 5.2); `list` is already the
 * discovery call, so the facts about the runner ride along with the facts about the
 * tools and an agent needs one call, not two.
 *
 * Everything here is a CHECK, never a claim: the browser tier reports whether Chromium
 * is resolvable AND whether the web shell is built, separately, because those fail for
 * different reasons and want different fixes.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { browserInstalled, resolveBrowsersDir } from '@lolly-tools/node-shell/browsers';
import { desktopRendererReport } from '@lolly-tools/node-shell/desktop-renderer';
import type { RendererStatus } from '@lolly-tools/node-shell/desktop-renderer';
import { NODE_FORMATS } from '@lolly-tools/node-shell/raster';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
import { CLI_CAPABILITIES } from './bridge.ts';
import { toolVersions } from './envelope.ts';

export interface TierReport {
  available: boolean;
  /** Why not, when `available` is false. Human wording; not a stable handle. */
  reason?: string;
  [k: string]: unknown;
}

export interface EnvironmentReport {
  engine: string;
  cli: string;
  /** The resolved content root (LOLLY_ROOT › marker walk › cwd). */
  root: string;
  /** The host-bridge capabilities this shell fulfils. A tool needing more is refused. */
  capabilities: string[];
  /** Formats the DOM-free tier can produce with no browser and no native module. */
  nativeFormats: string[];
  /**
   * Which full-fidelity renderer this machine would use for an HTML-layout raster,
   * a PDF or a video: `desktop-running` (an installed app already listening),
   * `desktop-installed` (one that would be started for the job), `chromium`, or
   * `none` when nothing here can produce those formats. `tiers.desktop.order` shows
   * what `LOLLY_RENDERER` would try, in order.
   */
  renderer: RendererStatus;
  tiers: {
    /** jsdom + the engine: svg/emf/eps/dxf, the data formats, html. Always present. */
    domFree: TierReport;
    /** resvg: SVG → PNG without a browser. */
    raster: TierReport;
    /** The desktop app's own WebView render path, over its loopback endpoint. */
    desktop: TierReport;
    /** Chromium + the built web shell: HTML-layout raster, jpg/webp, pdf, video. */
    browser: TierReport;
    /** sharp: host.images (decode/resize) for tools that process bitmaps. */
    images: TierReport;
  };
  /** Environment variables that changed a resolution above, and their values. */
  env: Record<string, string>;
}

/** Is a package importable here? A missing optional native module is a fact, not a crash. */
function resolvable(spec: string): boolean {
  try {
    // `import.meta.resolve` is synchronous and does not execute the module, so probing
    // for sharp/resvg costs nothing at startup.
    import.meta.resolve(spec);
    return true;
  } catch {
    return false;
  }
}

/** The env vars from the contract's frozen set (section 1.5) that are actually set here. */
const REPORTED_ENV = [
  'LOLLY_ROOT', 'LOLLY_TRUST_ANCHOR', 'LOLLY_BROWSER_PATH', 'LOLLY_BROWSER_CHANNEL',
  'PLAYWRIGHT_BROWSERS_PATH', 'LOLLY_WEB_BASE', 'LOLLY_WEB_DIST', 'LOLLY_VIDEO_CAPTURE',
  'LOLLY_STATE_DIR', 'LOLLY_RENDERER', 'LOLLY_DESKTOP_BIN', 'LOLLY_RENDER_SERVER',
  'NO_COLOR',
];

export async function describeEnvironment(): Promise<EnvironmentReport> {
  const { engine, cli } = await toolVersions();
  const root = repoRoot();

  const hasBrowser = browserInstalled();
  const remote = process.env.LOLLY_WEB_BASE;
  const dist = process.env.LOLLY_WEB_DIST || join(root, 'shells', 'web', 'dist');
  const webBuilt = Boolean(remote) || existsSync(join(dist, 'index.html'));
  const hasResvg = resolvable('@resvg/resvg-js');
  const hasSharp = resolvable('sharp');

  const browserReason = hasBrowser && webBuilt
    ? undefined
    : [
        hasBrowser ? null : 'no Chromium (`lolly install-browser`)',
        webBuilt ? null : 'no built web shell (`pnpm run build:web`, or set LOLLY_WEB_BASE/LOLLY_WEB_DIST)',
      ].filter(Boolean).join('; ');

  const env: Record<string, string> = {};
  for (const k of REPORTED_ENV) if (process.env[k]) env[k] = process.env[k]!;

  // Checked, not claimed: this reads the desktop app's advert, confirms the process
  // behind it is alive, and pings the loopback endpoint before it says an app is
  // running (plans/202 WP2.2).
  const desktop = await desktopRendererReport(hasBrowser && webBuilt);

  return {
    engine,
    cli,
    root,
    capabilities: [...CLI_CAPABILITIES],
    nativeFormats: [...NODE_FORMATS],
    renderer: desktop.renderer,
    tiers: {
      domFree: { available: true, formats: [...NODE_FORMATS] },
      raster: hasResvg
        ? { available: true, engine: 'resvg', note: 'SVG-native tools only; an HTML-layout tool needs the browser tier' }
        : { available: false, reason: '@resvg/resvg-js is not installed' },
      desktop: {
        available: desktop.available,
        renderer: desktop.renderer,
        preference: desktop.preference,
        order: desktop.order,
        ...(desktop.executable ? { executable: desktop.executable } : {}),
        ...(desktop.server ? { server: desktop.server } : {}),
        ...(desktop.reason ? { reason: desktop.reason } : {}),
      },
      browser: {
        available: hasBrowser && webBuilt,
        ...(browserReason ? { reason: browserReason } : {}),
        chromium: hasBrowser,
        browsersDir: resolveBrowsersDir(),
        webShell: webBuilt,
      },
      images: hasSharp
        ? { available: true, engine: 'sharp' }
        : { available: false, reason: 'sharp is not installed - host.images is unavailable' },
    },
    env,
  };
}
