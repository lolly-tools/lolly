// SPDX-License-Identifier: MPL-2.0
/**
 * Trust-anchor assembly for the TUI's verify path - the terminal twin of the CLI's
 * repeatable `--trust-anchor=<root.pem>` (shells/cli/src/validate.ts).
 *
 * Why this file exists: the TUI verifies bytes with the SAME engine verifier the CLI and
 * the web /valid view run, but it has no argv to carry pinned CA roots. Without a source
 * for them the identical file verified as "Verified" in the CLI (`--trust-anchor=corp.pem`)
 * read plain untrusted here - a confidently wrong verdict in a trust tool. Anchors are
 * therefore sourced from the two places a long-lived interactive shell can read:
 *
 *   1. `LOLLY_TRUST_ANCHOR` - a PATH-style list (path.delimiter separated) of PEM files.
 *   2. `trustAnchors` on the persisted profile record (~/.lolly/profile.json, store.ts),
 *      editable from the Profile view. A string (same PATH-style list) or an array.
 *
 * Env wins the ordering (it is the more explicit, per-invocation channel) but both are
 * pinned; the two lists are concatenated and de-duplicated.
 *
 * Policy note, deliberately identical to the CLI: the Lolly CA root IS pinned
 * (includeLollyRoot: true) as of plans/73-cli-ga-contract.md section 12 O1 (Andy, 2026-08-01), so a
 * Lolly-CA-signed export reads the same here as it does on the web /valid view. It used
 * to be excluded on both terminal surfaces, which made "Verified" mean one thing in the
 * browser and another in the terminal. The TUI has no argv, so there is no
 * `--no-default-anchors` twin here: the bare-trust check is a CLI affordance.
 *
 * Pure enough to test: only `loadTrustAnchors` touches disk, and every string it renders
 * comes from `describeAnchors`, which is a pure function of the resolved sources.
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { defaultTrustAnchors, c2paTrustAnchors, LOLLY_CA_ROOT_PEM } from '@lolly/engine';
import { expandHome, splitAnchorList, describeAnchorSet } from '@lolly-tools/node-shell/trust-anchors';

/** One pinned PEM path plus where it was configured (shown in the verdict panel). */
export interface AnchorSource {
  path: string;
  from: 'env' | 'profile';
}

/** What was actually fed to verifyC2pa, with enough provenance to explain a verdict. */
export interface ResolvedAnchors {
  /** DER roots, in the order defaultTrustAnchors assembled them. */
  anchors: Uint8Array[];
  /** How many of those came from the vendored C2PA known-certificate list. */
  vendored: number;
  /** Pinned PEMs that loaded cleanly. */
  loaded: AnchorSource[];
  /** Pinned PEMs that could not be read or parsed, with the reason. */
  failed: Array<AnchorSource & { reason: string }>;
  /** Whether the Lolly CA root was pinned (always true today - see the header). */
  lollyRoot: boolean;
}

/**
 * The PATH-splitting and `~`-expansion rules come from the SHARED module, not from a
 * private copy here. Two identical copies is how the CLI and the TUI last disagreed
 * about `path.delimiter` on Windows, and the shared module's header plus the CLI's
 * comment both already claimed the fork was collapsed while this file still forked it.
 */
const splitList = splitAnchorList;

/**
 * The pinned-anchor paths for this session, env first then profile, de-duplicated by the
 * literal path string. Pure: the caller supplies both sources.
 */
export function anchorPaths(
  env: string | undefined,
  profile: Record<string, unknown> | null | undefined,
): AnchorSource[] {
  const out: AnchorSource[] = [];
  const seen = new Set<string>();
  const push = (paths: string[], from: AnchorSource['from']): void => {
    for (const p of paths) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push({ path: p, from });
    }
  };
  push(splitList(env), 'env');
  push(splitList(profile?.trustAnchors), 'profile');
  return out;
}

/**
 * Read every pinned PEM and hand the whole set to the engine's assembler. A PEM that
 * cannot be read or parsed is REPORTED, never silently dropped: a typo'd path must not
 * quietly turn a trusted file untrusted.
 */
export async function loadTrustAnchors(
  env: string | undefined,
  profile: Record<string, unknown> | null | undefined,
): Promise<ResolvedAnchors> {
  const sources = anchorPaths(env, profile);
  const pems: string[] = [];
  const loaded: AnchorSource[] = [];
  const failed: Array<AnchorSource & { reason: string }> = [];
  for (const s of sources) {
    try {
      pems.push(await readFile(expandHome(s.path), 'utf8'));
      loaded.push(s);
    } catch (e) {
      failed.push({ ...s, reason: (e as Error).message });
    }
  }
  const vendored = c2paTrustAnchors().length;
  // A malformed PEM throws out of pemToDer inside the engine assembler; retry one at a
  // time so ONE bad file doesn't cost the user every other anchor they pinned.
  let anchors: Uint8Array[];
  try {
    anchors = defaultTrustAnchors({ includeLollyRoot: true, extra: pems });
  } catch {
    const good: string[] = [];
    for (let i = 0; i < pems.length; i++) {
      try { defaultTrustAnchors({ includeLollyRoot: true, extra: [pems[i]!] }); good.push(pems[i]!); }
      catch (e) {
        const s = loaded[i]!;
        failed.push({ ...s, reason: (e as Error).message });
      }
    }
    const stillGood = new Set(good);
    for (let i = loaded.length - 1; i >= 0; i--) if (!stillGood.has(pems[i]!)) loaded.splice(i, 1);
    anchors = defaultTrustAnchors({ includeLollyRoot: true, extra: good });
  }
  return { anchors, vendored, loaded, failed, lollyRoot: Boolean(LOLLY_CA_ROOT_PEM) };
}

/**
 * The verdict panel's "which anchor set produced this?" lines. Pure - one line per fact,
 * so a user can tell WHY something reads untrusted instead of guessing.
 */
export function describeAnchors(r: ResolvedAnchors): Array<{ text: string; warn: boolean }> {
  const out: Array<{ text: string; warn: boolean }> = [];
  // The sentence itself comes from the SHARED module, so the CLI's validate report and
  // this panel cannot describe the same anchor set in two different ways. Only the
  // per-source suffix (`(LOLLY_TRUST_ANCHOR)` / `(profile)`) is this shell's own - the
  // CLI has one channel for pinned roots and does not need it.
  out.push({
    text: '  ' + describeAnchorSet({
      lollyRoot: r.lollyRoot,
      vendored: r.vendored,
      pinned: r.loaded.map(s => `${basename(s.path)} (${s.from === 'env' ? 'LOLLY_TRUST_ANCHOR' : 'profile'})`),
    }),
    warn: false,
  });
  if (!r.loaded.length) {
    out.push({
      text: '  A signer outside that list reads untrusted by design. Pin a root with LOLLY_TRUST_ANCHOR=/path/root.pem or the profile\'s Trust anchors field.',
      warn: false,
    });
  }
  for (const f of r.failed) {
    out.push({ text: `  ! Trust anchor not loaded: ${f.path} (${f.from}) - ${f.reason}`, warn: true });
  }
  return out;
}
