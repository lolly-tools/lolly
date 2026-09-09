// SPDX-License-Identifier: MPL-2.0
/**
 * Install Chromium for the MCP server's Tier-B (headless-browser) render path,
 * SCOPED to this package (services/mcp/.browsers) so the browser travels when
 * this package splits into its own repo (plans/77-mcp-server.md).
 *
 * It drives the `playwright-core` we already depend on, not the full `playwright`
 * package, so a plain `pnpm install` never downloads a browser (keeps the web /
 * Vercel install light). This is the one explicit step that pulls Chromium.
 *
 *   pnpm run install:browser                    # Chromium → ./.browsers
 *   pnpm run install:browser --with-deps     # + OS system deps (Linux containers)
 *   pnpm run install:browser --force         # reinstall
 *
 * An explicit PLAYWRIGHT_BROWSERS_PATH in the environment is honoured (a container
 * can install into its own system cache instead of the scoped dir).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { BROWSERS_DIR } from '../src/paths.ts';

const require = createRequire(import.meta.url);
// Resolve the playwright-core CLI via its package.json (always resolvable). cli.js
// is its sibling. Avoids depending on subpath `exports` for './cli.js'.
const cli = join(dirname(require.resolve('playwright-core/package.json')), 'cli.js');

process.env.PLAYWRIGHT_BROWSERS_PATH ??= BROWSERS_DIR;

const passthrough = process.argv.slice(2);
const args = [cli, 'install', 'chromium', ...passthrough];

console.error(`Installing Chromium into ${process.env.PLAYWRIGHT_BROWSERS_PATH} …`);
const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
if (r.error) { console.error(r.error.message); process.exit(1); }
process.exit(r.status ?? 1);
