#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * brand-tool CLI
 *
 * Usage:
 *   brand-tool                                    # list tools
 *   brand-tool <tool-id>                          # show inputs for a tool
 *   brand-tool <tool-id> --foo=bar                # run, write to stdout
 *   brand-tool <tool-id> --foo=bar --output=f.svg # run, write to file
 *   brand-tool <tool-id> --foo=bar --export=svg   # explicit format
 *
 * Architectural note: this CLI is URL mode under a different transport.
 * --foo=bar argv pairs become the same input values the web shell would
 * parse from ?foo=bar in the URL hash. The engine doesn't know which path
 * delivered them.
 */

import { argv, exit } from 'node:process';
import { runToolCli, listToolsCli, showToolInputsCli } from '../src/run.js';

const args = argv.slice(2);

try {
  if (args.length === 0) {
    await listToolsCli();
    exit(0);
  }

  const toolId = args[0];
  const flags = parseArgs(args.slice(1));

  // No flags → show the tool's input schema
  if (Object.keys(flags).length === 0) {
    await showToolInputsCli(toolId);
    exit(0);
  }

  const { output, export: format, ...params } = flags;
  await runToolCli({ toolId, params, outputPath: output, format });
} catch (e) {
  process.stderr.write(`Error: ${e.message}\n`);
  if (e.validationErrors?.length) {
    for (const ve of e.validationErrors) {
      process.stderr.write(`  ${ve.path}: ${ve.message}\n`);
    }
  }
  if (process.env.DEBUG) process.stderr.write(e.stack + '\n');
  exit(1);
}

function parseArgs(rest) {
  const out = {};
  for (const a of rest) {
    // [\s\S] (not .) so a value may span newlines — multiline longtext inputs
    // are a single argv element and must survive intact, matching URL-mode's %0A.
    const m = /^--([^=]+)(?:=([\s\S]*))?$/.exec(a);
    if (m) out[m[1]] = m[2] ?? '1';
  }
  return out;
}
