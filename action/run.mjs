// SPDX-License-Identifier: MPL-2.0
/**
 * Safe process boundary for the Lolly Render composite action.
 *
 * GitHub Action inputs are data. They must never be reconstructed as shell source:
 * the previous `eval "set -- $IN_ARGS"` made command substitution and control
 * operators execute in the caller's job. This runner parses the deprecated string
 * form itself and always launches the CLI with `shell: false`.
 */

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_ARGS = 512;
const MAX_ARG_BYTES = 256 * 1024;
const ACTION_OWNED_FLAGS = new Set(['export', 'format', 'output']);

export class ActionInputError extends Error {}

function pushLegacyToken(out, token, started) {
  if (started) out.push(token);
}

/**
 * Compatibility parser for the deprecated `args` input.
 *
 * It deliberately implements only whitespace, single/double quotes, and backslash
 * escaping. Shell expansion is not a feature. Unquoted shell control operators and
 * all expansion sigils are rejected with a route to `args-json`.
 */
export function parseLegacyArgs(source) {
  const input = String(source ?? '');
  if (!input.trim()) return [];
  const out = [];
  let token = '';
  let started = false;
  let quote = null;
  let escaped = false;

  for (const char of input) {
    if (char === '\r' || char === '\n' || char === '\0') {
      throw new ActionInputError('Legacy args cannot contain newlines or NUL. Use args-json.');
    }
    // Expansion has no compatibility meaning here. Reject it even inside quotes so
    // a caller never mistakes this deliberately small parser for a shell.
    if (char === '$' || char === '`') {
      throw new ActionInputError('Legacy args do not support shell expansion. Use args-json for literal $ or backticks.');
    }
    if (escaped) {
      token += char;
      started = true;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      started = true;
      continue;
    }
    if (quote !== null) {
      if (char === quote) quote = null;
      else token += char;
      started = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      pushLegacyToken(out, token, started);
      token = '';
      started = false;
      continue;
    }
    if (';&|<>'.includes(char)) {
      throw new ActionInputError('Legacy args contain a shell control operator. Use args-json.');
    }
    token += char;
    started = true;
  }

  if (escaped) throw new ActionInputError('Legacy args end with an incomplete escape.');
  if (quote !== null) throw new ActionInputError('Legacy args contain an unclosed quote.');
  pushLegacyToken(out, token, started);
  return out;
}

export function parseJsonArgs(source) {
  const input = String(source ?? '').trim();
  if (!input) return [];
  let value;
  try {
    value = JSON.parse(input);
  } catch {
    throw new ActionInputError('args-json must be a valid JSON array of strings.');
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ActionInputError('args-json must be a JSON array containing only strings.');
  }
  return value;
}

export function validateToolArgs(args) {
  if (args.length > MAX_ARGS) {
    throw new ActionInputError(`Too many tool arguments (${args.length}); maximum is ${MAX_ARGS}.`);
  }
  let bytes = 0;
  for (const arg of args) {
    bytes += Buffer.byteLength(arg, 'utf8');
    if (arg.includes('\0')) throw new ActionInputError('Tool arguments cannot contain NUL.');
    const match = /^--([A-Za-z0-9][A-Za-z0-9._-]*)(?:=[\s\S]*)?$/.exec(arg);
    if (!match) {
      throw new ActionInputError(`Tool arguments must be complete --key or --key=value entries (invalid: ${JSON.stringify(arg)}).`);
    }
    if (ACTION_OWNED_FLAGS.has(match[1])) {
      throw new ActionInputError(`--${match[1]} is owned by the action; use its dedicated input.`);
    }
  }
  if (bytes > MAX_ARG_BYTES) {
    throw new ActionInputError(`Tool arguments exceed the ${MAX_ARG_BYTES}-byte action limit.`);
  }
  return args;
}

export function toolArgsFromEnv(env) {
  const json = String(env.IN_ARGS_JSON ?? '').trim();
  const legacy = String(env.IN_ARGS ?? '').trim();
  if (json && legacy) throw new ActionInputError('Set only one of args-json or legacy args.');
  return validateToolArgs(json ? parseJsonArgs(json) : parseLegacyArgs(legacy));
}

function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function resolveWorkspacePath(workspace, input, label) {
  const raw = String(input ?? '');
  if (!raw) throw new ActionInputError(`${label} cannot be empty.`);
  if (raw.includes('\0') || raw.includes('\r') || raw.includes('\n')) {
    throw new ActionInputError(`${label} contains a forbidden control character.`);
  }
  if (isAbsolute(raw)) throw new ActionInputError(`${label} must be workspace-relative.`);
  const target = resolve(workspace, raw);
  if (!isWithin(resolve(workspace), target)) {
    throw new ActionInputError(`${label} must stay inside GITHUB_WORKSPACE.`);
  }
  return target;
}

function assertRealPathWithin(workspace, target, label) {
  const realWorkspace = realpathSync(workspace);
  const realTarget = realpathSync(target);
  if (!isWithin(realWorkspace, realTarget)) {
    throw new ActionInputError(`${label} resolves outside GITHUB_WORKSPACE through a symlink.`);
  }
  return realTarget;
}

function requireExisting(workspace, input, label, kind) {
  const target = resolveWorkspacePath(workspace, input, label);
  if (!existsSync(target)) throw new ActionInputError(`${label} does not exist: ${input}`);
  const real = assertRealPathWithin(workspace, target, label);
  const stat = statSync(real);
  if (kind === 'file' && !stat.isFile()) throw new ActionInputError(`${label} must be a file.`);
  if (kind === 'directory' && !stat.isDirectory()) throw new ActionInputError(`${label} must be a directory.`);
  return real;
}

function safeId(value, label) {
  const text = String(value ?? '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(text)) {
    throw new ActionInputError(`${label} must contain only lowercase letters, digits, and hyphens.`);
  }
  return text;
}

function runCli(repo, argv, env, spawn = spawnSync) {
  const cli = join(repo, 'shells/cli/bin/lolly.ts');
  const result = spawn(process.execPath, [cli, ...argv], {
    cwd: repo,
    env,
    shell: false,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Lolly CLI terminated by signal ${result.signal}.`);
  if (result.status !== 0) throw new Error(`Lolly CLI exited with status ${result.status ?? 'unknown'}.`);
}

function listOutputFiles(root, dir = root, prefix = '') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name.includes('\r') || entry.name.includes('\n')) {
      throw new ActionInputError('Output filenames cannot contain newlines.');
    }
    const abs = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listOutputFiles(root, abs, rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files.sort((a, b) => a.localeCompare(b, 'en'));
}

function writeOutputs(outputFile, outDir, files) {
  if (!outputFile) throw new ActionInputError('GITHUB_OUTPUT is not set.');
  if (outDir.includes('\r') || outDir.includes('\n')) {
    throw new ActionInputError('Resolved output directory cannot contain newlines.');
  }
  const delimiter = `LOLLY_FILES_${randomUUID().replaceAll('-', '')}`;
  appendFileSync(
    outputFile,
    `out-dir=${outDir}\nfiles<<${delimiter}\n${files.join('\n')}\n${delimiter}\n`,
    'utf8',
  );
}

export function runAction(env = process.env, options = {}) {
  const workspaceInput = String(env.GITHUB_WORKSPACE ?? '');
  if (!workspaceInput || !isAbsolute(workspaceInput) || !existsSync(workspaceInput)) {
    throw new ActionInputError('GITHUB_WORKSPACE must be an existing absolute directory.');
  }
  const workspace = realpathSync(workspaceInput);
  if (!statSync(workspace).isDirectory()) {
    throw new ActionInputError('GITHUB_WORKSPACE must be a directory.');
  }
  const repo = options.cwd ? realpathSync(options.cwd) : realpathSync(process.cwd());
  if (!isWithin(workspace, repo)) throw new ActionInputError('The Lolly checkout must stay inside GITHUB_WORKSPACE.');

  const outInput = String(env.IN_OUT_DIR || './lolly-out');
  const outCandidate = resolveWorkspacePath(workspace, outInput, 'out-dir');
  mkdirSync(outCandidate, { recursive: true });
  const outDir = assertRealPathWithin(workspace, outCandidate, 'out-dir');

  const browser = String(env.IN_BROWSER || 'false');
  if (browser !== 'true' && browser !== 'false') {
    throw new ActionInputError('browser must be exactly "true" or "false".');
  }

  const childEnv = { ...env };
  if (String(env.IN_PROFILE_ROOT ?? '').trim()) {
    childEnv.LOLLY_ROOT = requireExisting(workspace, env.IN_PROFILE_ROOT, 'profile-root', 'directory');
  }
  if (browser === 'true' && !childEnv.LOLLY_WEB_DIST) {
    childEnv.LOLLY_WEB_DIST = join(repo, 'shells/web/dist');
  }

  const rows = String(env.IN_ROWS ?? '').trim();
  if (rows) {
    const rowsPath = requireExisting(workspace, rows, 'rows', 'file');
    runCli(repo, ['batch', rowsPath, `--out-dir=${outDir}`], childEnv, options.spawn);
  } else {
    const tool = safeId(env.IN_TOOL, 'tool');
    const format = safeId(env.IN_FORMAT || 'svg', 'format');
    const args = toolArgsFromEnv(env);
    const output = join(outDir, `${tool}.${format}`);
    runCli(repo, [tool, ...args, `--export=${format}`, `--output=${output}`], childEnv, options.spawn);
  }

  const files = listOutputFiles(outDir);
  writeOutputs(env.GITHUB_OUTPUT, outDir, files);
  return { outDir, files };
}

function workflowEscape(message) {
  return String(message).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    runAction();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`::error::${workflowEscape(message)}\n`);
    process.exitCode = 1;
  }
}

