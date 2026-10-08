#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Release gate for the WebGPU startup requirement (plan 295; Andy's decision of
 * 2026-10-08: "Merge now, gate releases").
 *
 * The web shell will not start without a usable WebGPU adapter and device. Main may
 * carry that requirement; running instances retain their reviewed release pins. No
 * versioned release may ship it until WebGPU conformance has run on every required target
 * (plan 295, P0b) and the result is published as the supported-environment table in
 * docs/supported-environments.md. Ordinary CI never runs this check. A release does:
 *
 *   pnpm run check:release                       # the release checklist in release mode
 *   node scripts/webgpu-release-gate.ts          # this check alone
 *
 * and so do the release tools that publish: scripts/build-release-web.ts (signed web,
 * desktop and mobile frontends, including the web container), scripts/yunohost-release.ts
 * (the YunoHost tarball), shells/tauri-desktop/release/build-latest-json.ts --out (the desktop updater
 * manifests), scripts/ship.ts (every ship driver publishes the web shell) and the package
 * workflows when a `v*` tag triggers them. CI's `instance-shell` job, which builds a
 * verified web shell in release mode, runs this check as its first step.
 *
 * Scope (Andy, 2026-10-08: "Gate only the web shell"): the gate covers the web shell and
 * the Tauri apps, which carry the WebGPU requirement. The MCP, CA and Penpot images and the
 * /info docs do not require WebGPU, so they never call this check and never wait for it:
 * .github/workflows/deployment-suse.yml builds them in jobs of their own, and only its
 * web image job depends on the gate. tests/webgpu-release-gate.test.ts holds that line.
 *
 * The table is an ordinary Markdown table: the first column is the environment, and
 * the second column starts with "Supported" or "Not supported":
 *
 *   | Environment | WebGPU result | Versions | Adapter and backend | Evidence |
 *   |---|---|---|---|---|
 *   | Chrome and Edge (Chromium) | Supported | 153 | ... | ... |
 *   | Firefox | Not supported: no adapter | 155 | ... | ... |
 *
 * Every entry in REQUIRED_WEBGPU_TARGETS needs exactly one row, and the first column must
 * be that entry's name exactly (case and spacing aside), so versions go in a column of
 * their own. A looser match let one environment's result stand in for another's: a
 * "Chrome on Android" row answered for the Android app. Rows for other environments are
 * allowed and ignored. "Not supported" is a published answer; a blank, "pending" or
 * "not run" is not.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the supported-environment table is published (the /info docs source). */
export const SUPPORTED_ENVIRONMENTS_PATH = 'docs/supported-environments.md';

export interface WebGpuTarget { name: string; matches(environment: string): boolean }

/** A first-column cell as a name: emphasis and code marks dropped, spacing and case folded. */
function environmentName(cell: string): string {
  return cell.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function exactly(name: string): WebGpuTarget {
  const wanted = environmentName(name);
  return { name, matches: (cell) => environmentName(cell) === wanted };
}

/**
 * The environments a release ships the requirement to: the browsers the web shell is
 * opened in, and the webview each packaged app embeds. A row answers for a target only
 * when its first column is the target's name.
 */
export const REQUIRED_WEBGPU_TARGETS: readonly WebGpuTarget[] = [
  exactly('Chrome and Edge (Chromium)'),
  exactly('Firefox'),
  exactly('Safari (WebKit)'),
  exactly('macOS app (WKWebView)'),
  exactly('iOS and iPadOS app (WKWebView)'),
  exactly('Windows app (WebView2)'),
  exactly('Linux app (WebKitGTK)'),
  exactly('Android app (WebView)'),
];

/** Whether the web shell's boot still makes WebGPU a startup requirement. */
export function webGpuStartupGatePresent(root = REPO): boolean {
  const main = join(root, 'shells', 'web', 'src', 'main.ts');
  if (!existsSync(main)) return false;
  const source = readFileSync(main, 'utf8');
  return source.includes("from './lib/webgpu/device.ts'") && /\b(?:startWebGpuCheck|requireWebGpu)\(/.test(source);
}

function tableRows(markdown: string): string[][] {
  return markdown.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

/** What the table lacks, one line per problem; empty when every target has a published result. */
export function supportedEnvironmentProblems(markdown: string): string[] {
  const rows = tableRows(markdown);
  const problems: string[] = [];
  for (const target of REQUIRED_WEBGPU_TARGETS) {
    const matching = rows.filter((cells) => target.matches(cells[0] ?? ''));
    if (!matching.length) { problems.push(`no row for ${target.name}`); continue; }
    if (matching.length > 1) { problems.push(`${matching.length} rows for ${target.name}; publish one`); continue; }
    const row = matching[0]!;
    const result = row[1] ?? '';
    if (!/^(?:not\s+)?supported\b/i.test(result)) {
      problems.push(`${target.name}: the result column says "${result}", not "Supported" or "Not supported"`);
    }
  }
  return problems;
}

/** Every reason a release may not ship yet; empty when it may. */
export function webGpuReleaseProblems(root = REPO): string[] {
  if (!webGpuStartupGatePresent(root)) return [];
  const table = join(root, SUPPORTED_ENVIRONMENTS_PATH);
  if (!existsSync(table)) return [`${SUPPORTED_ENVIRONMENTS_PATH} does not exist`];
  return supportedEnvironmentProblems(readFileSync(table, 'utf8'));
}

/** Throw with the full explanation when a release may not ship; release tools call this first. */
export function assertWebGpuReleaseAllowed(root = REPO): void {
  const problems = webGpuReleaseProblems(root);
  if (!problems.length) return;
  throw new Error([
    'Release refused: the web shell requires WebGPU at startup, and the supported-environment table is not published (plan 295, P0b).',
    ...problems.map((problem) => `  - ${problem}`),
    `Run the WebGPU conformance on each target and publish ${SUPPORTED_ENVIRONMENTS_PATH} with one row per environment:`,
    ...REQUIRED_WEBGPU_TARGETS.map((target) => `  - ${target.name}`),
    'The first column of each row is the environment name exactly as listed, and the second starts with "Supported" or "Not supported". See scripts/webgpu-release-gate.ts.',
  ].join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertWebGpuReleaseAllowed();
    console.log(webGpuStartupGatePresent()
      ? `WebGPU release gate: ${SUPPORTED_ENVIRONMENTS_PATH} covers all ${REQUIRED_WEBGPU_TARGETS.length} required environments.`
      : 'WebGPU release gate: the web shell does not require WebGPU at startup; nothing to check.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
