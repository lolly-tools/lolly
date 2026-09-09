// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly validate <file> [--json] [--deep] [--trust-anchor=<root.pem>]` - 
 * on-device Content Credentials check for any stampable container (pdf,
 * png/apng, jpg, gif, svg, tiff, webp, mp4, webm).
 *
 * `--deep` additionally runs the web shell's neural pixel-watermark scan
 * (Adobe TrustMark / Meta Content Seal, incl. Lolly's own ?durable=1 mark)
 * by driving the built dist in the scoped Chromium - the same on-device
 * decode the /valid view runs. Needs the Tier-B setup (`lolly
 * install-browser` + `pnpm run build:web`); everything else in this file
 * stays DOM-free and browser-free.
 *
 * The same engine verifier that backs the web shell's /valid view
 * (engine/src/c2pa-verify.js): re-checks the credential a Lolly export embeds
 * - hashed URIs, COSE claim signature, certificate window, hard binding - and
 * prints a report whose codes mirror c2patool /
 * verify.contentauthenticity.org, headlined by the question users actually
 * ask: was this genuinely made with Lolly, by whom, and where. No jsdom, no
 * network: bytes in, verdict out.
 *
 * `--trust-anchor=<root.pem>` (repeatable) pins CA roots, the same trust
 * decision as `c2patool --trust_anchors`: a signature whose x5chain verifies
 * to a pinned root reports the CA-verified identity instead of the default
 * signingCredential.untrusted.
 *
 * TRUST ANCHORS, DECIDED (plans/73-cli-ga-contract.md section 12 O1, Andy 2026-08-01):
 * the default set is the Lolly CA root + the vendored C2PA known-certificate
 * list + whatever `--trust-anchor` / `$LOLLY_TRUST_ANCHOR` pins. The Lolly root
 * used to be excluded here, so a Lolly-CA-signed export that read "Verified" on
 * the web /valid view read plain "Credential intact" in the terminal - one word
 * meaning two things depending on which surface asked. `--no-default-anchors`
 * drops BOTH built-in sets for a bare-trust check: only the caller's pinned
 * roots count, and with none pinned the anchor set is empty, under which every
 * signer reads untrusted by construction. Whichever set ran is printed with the
 * verdict, in the same words the TUI's verdict panel uses, because "verified"
 * is only meaningful beside "verified by what".
 *
 * EXIT CODES (plans/73-cli-ga-contract.md section 6b) - derived from the engine's shared verdict
 * ladder (resolveVerdict), NOT from the raw report.state this file used to branch on:
 *
 *   valid / expired          → 0   the file matches what was signed
 *   likelyLolly / invalid    → 4   REFUSED: a credential is present and the bytes moved
 *   none                     → 5   NOT_FOUND: a legitimate negative answer
 *   unreadable / ENOENT      → 2   USAGE: you named a path that cannot be read
 *
 * The old mapping was 0 / 1 / 2 with a missing file ALSO 1, so a CI loop could not tell
 * a forged file from a typo'd path. An expired credential is deliberately 0: Lolly signs
 * with ephemeral 7/30/90/365-day on-device certificates, so any other rule would fail
 * every gate in the fleet on its own correct output within a month. `--strict` promotes
 * expired to 4 for anyone who wants the stricter reading, and `--require=none` turns off
 * verdict-based exit codes entirely ("just tell me what is in this file").
 */

import { readFile } from 'node:fs/promises';
import { verifyC2pa, resolveVerdict, defaultTrustAnchors, c2paTrustAnchors, LOLLY_CA_ROOT_PEM } from '@lolly/engine';
import type { DeepScanResult } from '@lolly-tools/node-shell/webshell-render';
import type { Inspection } from '@lolly-tools/node-shell/inspect';
import { verdictSlug } from '@lolly-tools/node-shell/verdict-slugs';
import { cleanControlChars, verdictHeadline, verdictFacts, verdictChecks } from '@lolly-tools/node-shell/verdict-report';
import { expandHome, splitAnchorList, describeAnchorSet } from '@lolly-tools/node-shell/trust-anchors';
import { EXIT, usageError } from './exit-codes.ts';
import { useColor } from './output.ts';

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', YELLOW = '\x1b[33m', RESET = '\x1b[0m';
// NO_COLOR is honoured in addition to the isTTY check (contract section 1.5).
const tty = useColor(process.stdout);
const paint = (code: string, s: string) => (tty ? code + s + RESET : s);

// Every claim/signer string is attacker-controlled bytes from the file being
// checked. Strip control characters (incl. ESC) before printing so a crafted
// manifest can't inject ANSI sequences that forge or hide verdict lines in
// the very tool meant to be trustworthy about them.
// THE scrub lives once in node-shell/verdict-report so the CLI, the TUI and MCP
// cannot patch one copy and leave the other two holed; this is the local alias.
const clean = cleanControlChars;
// Verdict tone -> this surface's ANSI colour. Kept beside the paints below.
const TONE_ANSI = { good: GREEN, warn: YELLOW, bad: RED, dim: DIM } as const;

export interface ValidateOpts {
  json?: boolean;
  deep?: boolean;
  /** PEM paths pinned with --trust-anchor (repeatable), from the real parser. */
  trustAnchors?: string[];
  /**
   * --no-default-anchors: verify against the pinned roots ALONE (no Lolly CA root,
   * no vendored C2PA list). Default true = the section 12 O1 anchor set.
   */
  defaultAnchors?: boolean;
  /** `credential` (default) = the verdict IS the exit code; `none` = report only. */
  require?: string;
  /** --strict: an expired credential becomes a refusal. */
  strict?: boolean;
  /**
   * --metadata: add the file report (contract section 6b) - embedded metadata, PDF structure,
   * and the failed-redaction pass. Implemented by @lolly-tools/node-shell/inspect, the
   * one implementation the TUI and MCP consume too.
   */
  metadata?: boolean;
}

/**
 * Validate N files. One record each, exit = the WORST file's code (contract B9).
 *
 * `-` reads the file from stdin, so `curl … | lolly validate -` works.
 */
export async function validateFilesCli(files: string[], opts: ValidateOpts = {}): Promise<number> {
  const requireMode = opts.require ?? 'credential';
  if (requireMode !== 'credential' && requireMode !== 'none') {
    throw usageError(`--require must be "credential" or "none" (got "${requireMode}").`, 'BAD_FLAG_VALUE');
  }
  let worst: number = EXIT.OK;
  const records: unknown[] = [];
  for (const f of files) {
    const { exit, record } = await validateFile(f, opts);
    if (record) records.push(record);
    // "Worst" is by severity, not by number: 4 (a forged file) outranks 5 (no
    // credential at all), which outranks 2, which outranks 0.
    if (SEVERITY.indexOf(exit) > SEVERITY.indexOf(worst)) worst = exit;
  }
  if (opts.json) {
    // ONE document for the whole invocation, whatever the file count. The per-file
    // record keeps the section 5.2 shape ({ verdict, resolved, report, metadata }); wrapping it
    // in `files[]` even for a single file means a consumer never branches on arity.
    const { emitResult } = await import('./envelope.ts');
    await emitResult({ files: records }, worst);
  }
  return worst;
}

/**
 * One file. Kept exported under its original name for callers that want the code only.
 */
export async function validateCli(filePath: string, opts: ValidateOpts = {}): Promise<number> {
  return (await validateFile(filePath, opts)).exit;
}

/**
 * Exit codes this command can produce, least to most alarming.
 *
 * NOT_FOUND sits BELOW USAGE deliberately: "this file carries no credential" is a
 * legitimate answer about a file, while "I could not read that path" is a broken
 * invocation, and across a list of files the broken invocation is the more actionable
 * thing to report.
 */
const SEVERITY: number[] = [EXIT.OK, EXIT.NOT_FOUND, EXIT.USAGE, EXIT.FAILED, EXIT.REFUSED];

/** The per-file answer: the exit code, plus the JSON record when `--json` asked for one. */
export interface ValidateFileOutcome {
  exit: number;
  record: unknown | null;
}

export async function validateFile(
  filePath: string,
  { json = false, deep = false, trustAnchors, defaultAnchors = true, require: requireMode = 'credential', strict = false, metadata = false }: ValidateOpts = {},
): Promise<ValidateFileOutcome> {
  // --trust-anchor=<root.pem> is repeatable and comes from the REAL parser now (this
  // used to re-scan process.argv, because the old flag parser kept only the last
  // occurrence - a second parser is a second set of rules waiting to disagree).
  // $LOLLY_TRUST_ANCHOR adds `path.delimiter`-separated paths, honoured by the CLI and
  // the TUI alike (contract section 1.5/section 4.7): flag first, then environment. The splitting and
  // `~` rules come from @lolly-tools/node-shell/trust-anchors so the two shells cannot
  // disagree - this file used to hard-code `':'`, which splits a Windows `C:\…\root.pem`
  // at the drive letter and then reports two unreadable anchors.
  const fromEnv = splitAnchorList(process.env.LOLLY_TRUST_ANCHOR);
  const anchorPaths = [...(trustAnchors ?? []), ...fromEnv];
  // The Lolly CA root + the vendored C2PA trust list (Google/Gemini, camera makers, …)
  // plus any --trust-anchor=<root.pem> the caller pins - the SAME set the web /valid
  // view uses, decided in contract section 12 O1. `--no-default-anchors` drops both built-in
  // sets, leaving only what was pinned (possibly nothing, which is the bare-trust
  // check: every signer reads untrusted by construction).
  const extra: string[] = [];
  for (const p of anchorPaths) {
    try { extra.push(await readFile(expandHome(p), 'utf8')); }
    catch (e) { throw usageError(`--trust-anchor: cannot read "${p}" (${(e as Error).message}).`, 'ANCHOR_UNREADABLE'); }
  }
  const anchors = defaultTrustAnchors({ includeLollyRoot: defaultAnchors, includeVendored: defaultAnchors, extra });
  // What produced this verdict, in the TUI's words (node-shell/trust-anchors.ts).
  const anchorFacts = {
    lollyRoot: defaultAnchors && Boolean(LOLLY_CA_ROOT_PEM),
    vendored: defaultAnchors ? c2paTrustAnchors().length : 0,
    pinned: anchorPaths,
  };
  // A path that cannot be read is exit 2 (USAGE), never 1 - the whole point of the
  // taxonomy is that a typo'd path and a forged file are different answers.
  let bytes: Uint8Array;
  try {
    if (filePath === '-') {
      const { readStdin } = await import('./run.ts');
      const buf = await readStdin();
      if (!buf.length) throw new Error('stdin was empty');
      bytes = new Uint8Array(buf);
    } else {
      bytes = new Uint8Array(await readFile(filePath));
    }
  } catch (e) {
    const message = `cannot read "${filePath}" - ${(e as Error).message}`;
    process.stderr.write(`Error: ${message}\n`);
    // Under --json the unreadable file is still a RECORD, not a silence: a batch of ten
    // files must not lose the other nine because one path was typo'd.
    return {
      exit: EXIT.USAGE,
      record: json ? { file: filePath, ok: false, error: { code: 'USAGE', exit: EXIT.USAGE, kind: 'INPUT_UNREADABLE', message } } : null,
    };
  }
  const report = await verifyC2pa(bytes, { trustAnchors: anchors });

  // --metadata: the file report (contract section 6b) - "what else is in this file", on top of
  // "is the credential intact". One implementation, in @lolly-tools/node-shell/inspect,
  // so this command, the TUI and MCP cannot drift the way the verdict ladder did.
  // The already-verified `report` is NOT passed in: the credential is rendered above by
  // this file's own richer renderer, and printing a second verdict line would read as a
  // second opinion. Never throws - a hostile file yields fewer findings and an `errors`
  // list, which the renderer prints as "this report is incomplete".
  let inspection: Inspection | null = null;
  if (metadata) {
    const { inspectBytes } = await import('@lolly-tools/node-shell/inspect');
    inspection = await inspectBytes(bytes, { path: filePath });
  }

  // --deep: the neural pixel-watermark scan (Adobe TrustMark / Meta Content Seal,
  // incl. Lolly's ?durable=1 mark) - the /valid view's own decode, driven headlessly
  // via the Tier-B browser. Advisory: it never changes the exit code (a durable mark
  // is a soft binding, and its ABSENCE is never proof - per the detectors' policy).
  let deepScan: DeepScanResult | null = null;
  let deepErr: string | null = null;
  if (deep) {
    try {
      const [{ deepScanViaWebShell, closeWebShell }, { closeBrowser }] = await Promise.all([
        import('@lolly-tools/node-shell/webshell-render'),
        import('@lolly-tools/node-shell/browsers'),
      ]);
      try { deepScan = (await deepScanViaWebShell([filePath]))[0] ?? null; }
      finally { await closeWebShell(); await closeBrowser(); }
    } catch (err) {
      deepErr = (err as Error).message;
    }
  }

  // The exit code is computed before the JSON is written so the envelope's `ok` and the
  // process's exit code cannot disagree.
  const exit = (inspection && strict && (await import('@lolly-tools/node-shell/inspect')).hasShareRisk(inspection))
    ? EXIT.REFUSED
    : requireMode === 'none' ? EXIT.OK : verdictExit(resolvedState(report).state, strict);

  if (json) {
    // The section 5.2 result shape, aligned with the MCP twin (services/mcp/src/tools.ts) so
    // one question has one answer shape across both machine surfaces:
    //   verdict - the legacy slug ('made-with-lolly', 'no-credential', …)
    //   resolved - the engine's semantic verdict (state + tone + the flags behind it)
    //   report - the full verifier output, unchanged
    //   metadata - the file report, when --metadata ran; null when it did not, and
    //              never a fabricated empty object, because "not examined" and "nothing
    //              found" are different answers.
    //   anchors - WHICH trust anchors produced `resolved.trusted` (contract section 12 O1).
    //              Additive key under schemaVersion 1; consumers ignore what they
    //              do not know.
    const resolved = resolvedState(report);
    return {
      exit,
      record: {
        file: filePath,
        ok: exit === EXIT.OK,
        verdict: verdictSlug(resolved.state),
        resolved,
        report,
        metadata: inspection,
        anchors: anchorFacts,
        ...(deep ? { deepScan, ...(deepErr ? { deepScanError: deepErr } : {}) } : {}),
      },
    };
  }
  {
    // Headline + facts + checks come from the shared node-shell renderer
    // (verdict-report.ts) so this surface and the TUI can never again print
    // different words for the same verdict. This file keeps ONLY the ANSI skin.
    // Two CLI quirks survive the move and are carried by the shared renderer:
    //  • partsMadeWithLolly IS elevated to a headline here (elevateParts) - 
    //    resolveVerdict keeps it a flag, matching the web hero where parts is
    //    only a scorecard pip;
    //  • no separate "Verified" headline for a CA-trusted signer (the web /valid
    //    has one): 'trusted' renders as "Credential intact", identity in facts.
    const v = resolvedState(report);
    const h = verdictHeadline(v, { elevateParts: true });
    const headline = paint(TONE_ANSI[h.tone], `${h.glyph} ${h.name}`) + (h.detail ? paint(DIM, ` - ${h.detail}`) : '');
    process.stdout.write(`${paint(BOLD, filePath)}${report.format ? paint(DIM, `  [${report.format}]`) : ''}\n${headline}\n`);
    if (report.reason && report.state !== 'invalid') process.stdout.write(paint(DIM, `  ${clean(report.reason)}\n`));
    if (report.claim && !report.madeWithLolly) {
      process.stdout.write(paint(DIM, report.trusted
        ? '  (fields below are the CA-verified signer’s own claim)\n'
        : '  (fields below are self-asserted by whoever signed the file)\n'));
    }

    for (const [k, val] of verdictFacts(report)) process.stdout.write(`  ${paint(DIM, k.padEnd(11))} ${val}\n`);
    for (const chk of verdictChecks(report)) {
      const mark = chk.mark === 'ok' ? paint(GREEN, '✓') : chk.mark === 'info' ? paint(DIM, 'ℹ') : paint(RED, '✕');
      process.stdout.write(`  ${mark} ${chk.code} ${paint(DIM, ' - ' + chk.explanation)}\n`);
    }
    // WHICH anchor set produced that verdict. Printed for every file that was read,
    // including the no-credential case: "nothing vouches for this signer" and "you
    // asked me to trust nothing" are different answers and must not look alike.
    if (report.state !== 'none' || anchorFacts.pinned.length || !defaultAnchors) {
      process.stdout.write(paint(DIM, `  ${describeAnchorSet(anchorFacts)}\n`));
    }
    if (deepErr) {
      process.stdout.write(paint(YELLOW, `! Deep scan unavailable`) + paint(DIM, ` - ${clean(deepErr)}\n`));
    } else if (deepScan) {
      if (!deepScan.scanned) {
        process.stdout.write(paint(DIM, `○ Deep scan: this file type can't be pixel-scanned (raster/video only)\n`));
      } else if (deepScan.lollyDurable) {
        process.stdout.write(paint(GREEN, '✦ Lolly durable mark decoded from the pixels') + paint(DIM,
          ' - a TrustMark-format identifier that survives metadata stripping and re-encoding\n'));
      } else {
        if (deepScan.trustmark) process.stdout.write(paint(YELLOW, '~ Adobe TrustMark watermark decoded') + paint(DIM, ' - embedded by another TrustMark-aware tool\n'));
        if (deepScan.contentSeal) process.stdout.write(paint(YELLOW, '~ Meta Content Seal watermark decoded\n'));
        if (!deepScan.trustmark && !deepScan.contentSeal) {
          process.stdout.write(paint(DIM, '○ Deep scan: no pixel watermark decoded (not proof of absence)\n'));
        }
      }
    }
    if (inspection) {
      const { renderInspection } = await import('@lolly-tools/node-shell/inspect-render');
      // heading:false - this file already printed the path headline for these bytes.
      process.stdout.write(renderInspection(inspection, { color: tty, heading: false }));
    }
  }

  // `--require=none` is the inspection mode: the file was readable, so the run
  // succeeded, whatever the credential says. `--require=credential` (the default)
  // keeps gate semantics - the verdict IS the exit code.
  //
  // --strict + --metadata: a share risk the inspection FOUND (text present but not
  // visible, a GPS fix, undeclared bytes appended past the container) is a warning in
  // the normal reading and a refusal under --strict, which is exactly what section 1.2 says
  // --strict does. It cannot fire without --metadata, because without it the pass never
  // ran and the CLI must not imply a check it did not perform. `exit` above already
  // applied all three rules; this return is the human path's use of the same number.
  return { exit, record: null };
}

/** The engine's shared verdict ladder - one ladder for the CLI, the TUI and /valid. */
function resolvedState(report: Parameters<typeof resolveVerdict>[0]): ReturnType<typeof resolveVerdict> {
  return resolveVerdict(report);
}

/**
 * Resolved verdict → exit code (contract section 6b).
 *
 * `expired` is 0 by design: Lolly signs with ephemeral on-device certificates of
 * 7/30/90/365 days, and the engine already softens expiry to a `warn` tone. Any other
 * rule would fail every gate in the fleet on its own correct output within a month.
 * `--strict` is the opt-in for the stricter reading.
 */
export function verdictExit(state: string, strict = false): number {
  switch (state) {
    case 'none': return EXIT.NOT_FOUND;
    case 'invalid': case 'likelyLolly': return EXIT.REFUSED;
    case 'expired': return strict ? EXIT.REFUSED : EXIT.OK;
    // 'valid', 'trusted', 'lolly', 'delivered' - the file matches what was signed.
    default: return EXIT.OK;
  }
}
