#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Tool drift between an MCP image and the web shell it will drive (plan 295 section 1B).
 *
 * The MCP browser image is qualified against a web shell built from its own source.
 * In production it drives the shell at its webBase instead, and that shell stays on
 * an older release while the web shell image waits for the WebGPU table. A tool that
 * is new in the MCP image fails a Tier-B render there, and a tool whose manifest,
 * template or hooks changed renders with the shell's older files. This reads the
 * paired shell's signed file list (catalog/tools/index.sig.json), hashes the same
 * kinds of file in the MCP image's tools/ tree and reports every tool that differs.
 *
 *   node deploy/docker/web-pairing.ts --tools <MCP tools dir> --web-base https://lolly.example
 *
 * It prints the report as JSON and exits 0 whatever the drift: whether to deploy is
 * the operator's decision. Under GitHub Actions it also writes an annotation and a
 * step summary. The report compares file lists only; it does not verify who signed
 * the shell's list.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATALOG_SIGNED_I18N_SIDECAR,
  CATALOG_SIGNED_TEMPLATE_FILE,
  CATALOG_SIGNED_TOOL_FILES,
} from '../../engine/src/catalog-integrity.ts';

/** Whether a path inside one tool's directory is a kind of file the catalog signature covers. */
export function isSignedToolFile(path: string): boolean {
  return (
    CATALOG_SIGNED_TOOL_FILES.includes(path) ||
    CATALOG_SIGNED_I18N_SIDECAR.test(path) ||
    CATALOG_SIGNED_TEMPLATE_FILE.test(path)
  );
}

/** `<tool id>/<file>` to SHA-256 for every file of a signed kind in a tools/ tree. */
export function signedFileHashes(toolsDir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(toolsDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = relative(toolsDir, join(entry.parentPath, entry.name)).split(sep).join('/');
    const slash = path.indexOf('/');
    if (slash <= 0 || !isSignedToolFile(path.slice(slash + 1))) continue;
    files[path] = createHash('sha256').update(readFileSync(join(toolsDir, path))).digest('hex');
  }
  return files;
}

/** The `files` map of a catalog signature envelope, refusing any entry that is not `<tool id>/<file>` to a SHA-256. */
export function envelopeFiles(envelope: unknown): Record<string, string> {
  const files = (envelope as { files?: unknown } | null)?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('the signature has no files map');
  }
  const out: Record<string, string> = {};
  for (const [path, hash] of Object.entries(files)) {
    const parts = path.split('/');
    const valid =
      /^[a-z0-9-]+$/.test(parts[0] ?? '') &&
      parts.length > 1 &&
      parts.every((part) => part !== '' && part !== '.' && part !== '..') &&
      typeof hash === 'string' &&
      /^[a-f0-9]{64}$/.test(hash);
    if (!valid) throw new Error(`the signature lists an unexpected entry: ${JSON.stringify(path)}`);
    out[path] = hash;
  }
  return out;
}

export interface PairingDrift {
  /** Tools the MCP image carries and the paired shell does not: a Tier-B render of one fails. */
  missingFromShell: string[];
  /** Tools in both whose signed files differ: a Tier-B render of one uses the shell's files. */
  changed: { id: string; files: string[] }[];
  /** Tools the paired shell carries and the MCP image does not. */
  onlyInShell: string[];
}

const toolOf = (path: string): string => path.slice(0, path.indexOf('/'));

/** Compare two `<tool id>/<file>` hash maps, tool by tool. */
export function compareToolFiles(
  mcp: Record<string, string>,
  shell: Record<string, string>
): PairingDrift {
  const mcpTools = new Set(Object.keys(mcp).map(toolOf));
  const shellTools = new Set(Object.keys(shell).map(toolOf));
  const changed = new Map<string, string[]>();
  for (const path of new Set([...Object.keys(mcp), ...Object.keys(shell)])) {
    const id = toolOf(path);
    if (!mcpTools.has(id) || !shellTools.has(id)) continue;
    if (Object.hasOwn(mcp, path) && Object.hasOwn(shell, path) && mcp[path] === shell[path]) continue;
    changed.set(id, [...(changed.get(id) ?? []), path.slice(id.length + 1)]);
  }
  return {
    missingFromShell: [...mcpTools].filter((id) => !shellTools.has(id)).sort(),
    changed: [...changed.keys()].sort().map((id) => ({ id, files: (changed.get(id) ?? []).sort() })),
    onlyInShell: [...shellTools].filter((id) => !mcpTools.has(id)).sort(),
  };
}

/** The origin of an HTTPS web base with no path, query, fragment or credentials. */
export function webOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('--web-base must be an HTTPS origin with no path, query or credentials');
  }
  return url.origin;
}

export type PairingReport =
  | ({
      checked: true;
      webBase: string;
      signedAt: string | null;
      signatureVerified: false;
      mcpTools: number;
      paired: boolean;
    } & PairingDrift)
  | { checked: false; webBase: string; reason: string };

/** Read the paired shell's signed file list and compare the MCP tools with that list. */
export async function pairingReport(
  toolsDir: string,
  webBase: string,
  fetchImpl: typeof fetch = fetch
): Promise<PairingReport> {
  const origin = webOrigin(webBase);
  const mcp = signedFileHashes(toolsDir);
  const source = `${origin}/catalog/tools/index.sig.json`;
  let envelope: unknown;
  let shell: Record<string, string>;
  try {
    const response = await fetchImpl(source, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    envelope = await response.json();
    shell = envelopeFiles(envelope);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { checked: false, webBase: origin, reason: `Could not read ${source}: ${reason}` };
  }
  const drift = compareToolFiles(mcp, shell);
  const signedAt = (envelope as { signedAt?: unknown }).signedAt;
  return {
    checked: true,
    webBase: origin,
    signedAt: typeof signedAt === 'string' ? signedAt : null,
    signatureVerified: false,
    mcpTools: new Set(Object.keys(mcp).map(toolOf)).size,
    paired: !drift.missingFromShell.length && !drift.changed.length && !drift.onlyInShell.length,
    ...drift,
  };
}

/** A workflow command's message, escaped the way GitHub Actions reads workflow commands. */
const command = (text: string): string =>
  text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

function annotate(report: PairingReport): void {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  let title: string;
  let message: string;
  let level = 'warning';
  if (!report.checked) {
    title = 'Web pairing not checked';
    message = report.reason;
  } else if (report.paired) {
    level = 'notice';
    title = 'MCP tools match the paired web shell';
    message = `All ${report.mcpTools} tools match the signed files at ${report.webBase}.`;
  } else {
    title = 'MCP tools differ from the paired web shell';
    message = `Compared with ${report.webBase}: missing from the shell ${report.missingFromShell.length}, changed ${report.changed.length}, only in the shell ${report.onlyInShell.length}. web-pairing.json lists the tools.`;
  }
  console.error(`::${level} title=${command(title)}::${command(message)}`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  const lines = [`### ${title}`, '', message, ''];
  if (report.checked) {
    for (const id of report.missingFromShell) lines.push(`- missing from the shell: \`${id}\``);
    for (const { id, files } of report.changed) lines.push(`- changed: \`${id}\` (${files.join(', ')})`);
    for (const id of report.onlyInShell) lines.push(`- only in the shell: \`${id}\``);
  }
  appendFileSync(summary, `${lines.join('\n')}\n`);
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index > 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await pairingReport(resolve(argument('--tools')), argument('--web-base'));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    annotate(report);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
