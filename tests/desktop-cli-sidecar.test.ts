// SPDX-License-Identifier: MPL-2.0
/**
 * The desktop app's bundled CLI, checked from the side the Rust cannot check (plans/202
 * WP1.3).
 *
 * `shells/tauri-desktop/src-tauri/src/cli.rs` keeps its own copy of the CLI's verb list,
 * because Rust cannot read a TypeScript const. Its unit tests pin that copy against a
 * second hand-written list in the same file, so the two agree with each other and both
 * can be wrong together: add a verb to `shells/cli/src/args.ts` and the desktop binary
 * quietly reads it as a tool id, answering `unknown tool "scan"` instead of running it.
 *
 * This test is the join. It reads the real `args.ts` and the real `cli.rs` and asserts
 * every reserved verb has exactly one home. It also pins the bundle wiring in
 * `tauri.conf.json`, including the one entry that must NOT come back: a second copy of
 * tools/ and catalog/ as bundle resources.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const CLI_RS = join(REPO, 'shells/tauri-desktop/src-tauri/src/cli.rs');
const ARGS_TS = join(REPO, 'shells/cli/src/args.ts');
const CONF = join(REPO, 'shells/tauri-desktop/src-tauri/tauri.conf.json');

/** The verbs the desktop binary answers itself rather than forwarding. */
const ANSWERED_BY_THE_APP = new Set([
  // `Lolly run <tool>` is the off-screen WebView render that predates the sidecar.
  'run',
  // Both are answered before classify even looks at the argument.
  'help',
  'version',
]);

/** `RESERVED_SUBCOMMANDS` out of shells/cli/src/args.ts. */
function reservedVerbs(): string[] {
  const src = readFileSync(ARGS_TS, 'utf8');
  const block = /export const RESERVED_SUBCOMMANDS = \[([\s\S]*?)\] as const;/.exec(src);
  assert.ok(block, 'RESERVED_SUBCOMMANDS is no longer spelled the way this test reads it');
  // Strip line comments first, so a verb named inside prose is not mistaken for an entry.
  const body = block[1]!.replace(/\/\/[^\n]*/g, '');
  return [...body.matchAll(/'([a-z][a-z-]*)'/g)].map(m => m[1]!);
}

/** The arms of `is_sidecar_verb` in cli.rs. */
function forwardedVerbs(): string[] {
  const src = readFileSync(CLI_RS, 'utf8');
  const fn = /fn is_sidecar_verb\(value: &str\) -> bool \{([\s\S]*?)\n\}/.exec(src);
  assert.ok(fn, 'is_sidecar_verb is no longer spelled the way this test reads it');
  return [...fn[1]!.matchAll(/"([a-z][a-z-]*)"/g)].map(m => m[1]!);
}

test('every reserved CLI verb is either forwarded to the sidecar or answered by the app', () => {
  const forwarded = new Set(forwardedVerbs());
  const homeless: string[] = [];
  for (const verb of reservedVerbs()) {
    if (ANSWERED_BY_THE_APP.has(verb)) continue;
    if (!forwarded.has(verb)) homeless.push(verb);
  }
  assert.deepEqual(
    homeless,
    [],
    `these verbs exist in shells/cli/src/args.ts and the desktop binary would read them as tool ids: ${homeless.join(', ')}. `
    + 'Add them to is_sidecar_verb in shells/tauri-desktop/src-tauri/src/cli.rs.',
  );
});

test('the app never forwards a verb it answers itself', () => {
  for (const verb of forwardedVerbs()) {
    assert.ok(
      !ANSWERED_BY_THE_APP.has(verb),
      `${verb} is answered by the desktop binary; forwarding it too would shadow that`,
    );
  }
});

test('tauri.conf.json declares the sidecar and its payload', () => {
  const conf = JSON.parse(readFileSync(CONF, 'utf8')) as {
    bundle: { externalBin?: string[]; resources?: Record<string, string> };
  };
  assert.deepEqual(
    conf.bundle.externalBin,
    ['bin/lolly-cli'],
    'the sidecar is one externalBin; scripts/build-cli-sidecar.ts names its files bin/lolly-cli-<triple>',
  );
  const resources = conf.bundle.resources ?? {};
  assert.equal(resources['cli-lib'], 'cli-lib', 'the CLI payload rides as a resource directory of that name');
});

test('tools and catalog are never duplicated as bundle resources', () => {
  // They are already embedded in the binary through frontendDist, and the rlib is close
  // to the 2 GB `ar` archive-offset limit (see the pruneEmbeddedDownloads note in
  // shells/tauri-desktop/vite.config.js). The sidecar gets its root from
  // src/root_export.rs, which writes the embedded copy out once per version.
  const conf = JSON.parse(readFileSync(CONF, 'utf8')) as {
    bundle: { resources?: Record<string, string> };
  };
  for (const [source, target] of Object.entries(conf.bundle.resources ?? {})) {
    for (const path of [source, target]) {
      assert.ok(
        !/(^|[/\\])(tools|catalog)([/\\]|$)/.test(path),
        `bundle.resources carries "${source}": "${target}" - that is a second copy of embedded content`,
      );
    }
  }
});
