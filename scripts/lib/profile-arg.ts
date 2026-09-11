// SPDX-License-Identifier: MPL-2.0
/**
 * `--profile=<name>` for a content script, applied before the resolver is asked
 * anything.
 *
 * The per-brand loops (scripts/build-catalog-all.ts, scripts/build-og-all.ts) used to
 * switch the repo-root tools/ and catalog/ symlink views to each profile in turn and
 * restore the active one in a `finally`. The subrepo collapse (plan 244) removed the
 * views, so a loop now runs each script as its own process and names the profile on
 * the command line - nothing shared is mutated, and there is nothing to restore if a
 * run throws halfway through.
 *
 * The flag is turned into LOLLY_PROFILE because that is the one environment variable
 * the resolver reads, and because it then also reaches any child process the script
 * spawns. Precedence is unchanged: an explicit flag beats the sticky choice and
 * profiles.json's default, exactly as `contentRoots({ profile })` would.
 *
 * Call it at MODULE scope, above the first `catalogFile()` / `toolDirs()` call. Those
 * constants are usually evaluated while the module body runs, and contentRoots()
 * caches its answer, so a call made later inside main() would be too late.
 */

/** The `--profile=<name>` (or `--profile <name>`) value in argv, or null. */
export function profileArg(argv: string[] = process.argv.slice(2)): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--profile=')) {
      const name = arg.slice('--profile='.length).trim();
      if (name) return name;
    }
    if (arg === '--profile') {
      const name = argv[i + 1]?.trim();
      if (name && !name.startsWith('-')) return name;
    }
  }
  return null;
}

/** Apply `--profile=<name>` to this process, if given. Returns the name, or null. */
export function applyProfileArg(argv: string[] = process.argv.slice(2)): string | null {
  const name = profileArg(argv);
  if (name) process.env.LOLLY_PROFILE = name;
  return name;
}
