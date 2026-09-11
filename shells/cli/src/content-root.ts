// SPDX-License-Identifier: MPL-2.0
/**
 * "Where are the tools?" - the answer this CLI gives when it has no content.
 *
 * The published `@lolly-tools/cli` package carries NO tools and NO catalog (plans/131:
 * content-free binaries; community/ alone is 79 MB and a brand catalog another 56 MB).
 * It renders from a root someone points it at. In a checkout that root is found by the
 * marker walk in packages/node-shell/src/repo-root.ts and nobody ever thinks about it;
 * from `npm i -g` there is no marker anywhere above node_modules, and the first thing a
 * new user used to see was a raw ENOENT on catalog/tools/index.json.
 *
 * So a command that needs content checks first and exits 3 UNAVAILABLE_HERE - the
 * retry-somewhere-else code (see exit-codes.ts) - with the three real routes to a root.
 * Exit 2 would be wrong: the invocation was fine, this installation has nothing to run.
 *
 * The routes are the ones that exist today. There is no download here, and `lolly system
 * import` is listed for what it actually does (a design system: colours, fonts, logos -
 * see system.ts), NOT as a source of tools, because it is not one.
 */

import { hasCatalogMarker, repoRoot } from '@lolly-tools/node-shell/repo-root';
import { unavailableHere } from './exit-codes.ts';

/**
 * Commands that run with no tools and no catalog: the design-system store, the file
 * utilities, the on-device models, and the meta commands. Everything else needs
 * content - including a bare tool id and a pasted lolly.tools URL, which is why this
 * is a deny list rather than an allow list of verbs.
 */
export const CONTENT_FREE_COMMANDS: ReadonlySet<string> = new Set([
  'prepare', 'files', 'start', 'system', 'completion', 'install-browser', 'help', 'version',
  // File-in file-out: `validate` reads Content Credentials out of bytes you already
  // have, the ML and speech commands run a local model, `mix` mixes audio sources,
  // and `icons`/`pack` build a Linux package from files named on the command line.
  'validate', 'models', 'speak', 'transcribe', 'mix', 'icons', 'pack',
  'upscale', 'matte', 'ocr', 'detect-ai', 'reword', 'depth',
]);

/** Does this command need tools/ and catalog/ to be present? */
export function needsContentRoot(cmd: string | undefined): boolean {
  return !CONTENT_FREE_COMMANDS.has(cmd ?? '');
}

/**
 * The message, built for the environment it is printed in. The root is taken for the
 * call shape (and so a caller reads as one), but the text names LOLLY_ROOT and the
 * working directory rather than the root that was searched.
 */
export function noContentRootMessage(_root: string, env: NodeJS.ProcessEnv = process.env): string {
  const named = env.LOLLY_ROOT?.trim();
  const head = named
    ? `LOLLY_ROOT is set to ${named}, but there is no catalog/tools/index.json under it.`
    : 'No tools or catalog here.';
  return `${head}

This CLI ships without content, so it renders from a root you point it at.
Three ways to get one:

  1. A directory holding tools/ and catalog/
       LOLLY_ROOT=/path/to/lolly lolly list
     A Lolly checkout has both after \`pnpm install\` builds the profile views.

  2. The desktop app
     Lolly for macOS, Windows and Linux carries its own tools and catalog, and
     from the next release it bundles this same CLI, so installing it is enough.

  3. lolly system import <pack.lolly>
     Your design system: colours, fonts and logos, kept on this machine and used
     by every render. It adds no tools, so it needs 1 or 2 beside it.

Looked in: ${named ? `LOLLY_ROOT, ` : ''}the directories above this install, and ${process.cwd()}.`;
}

/**
 * Throw the exit-3 refusal when this installation has no content.
 *
 * `root` is injectable so a test can drive a directory that has none without depending
 * on where the test process happens to live (repoRoot() caches, and inside a checkout it
 * always answers the checkout).
 */
export function assertContentRoot(root: string = repoRoot(), env: NodeJS.ProcessEnv = process.env): void {
  if (hasCatalogMarker(root)) return;
  throw unavailableHere(noContentRootMessage(root, env), 'NO_CONTENT_ROOT');
}
