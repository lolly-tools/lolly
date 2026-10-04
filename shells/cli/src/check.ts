// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly check` (plan 291 W1): every check Lolly has for a Design document, a `.lolly`
 * or an export, in one call and one findings list.
 *
 *   lolly check <design.json|file.lolly|export.pdf|.pptx|.png|.jpg|.webp|.svg>
 *               [--source=<deck.pptx|deck.pdf|inventory.json>] [--file=<tokens.json>]
 *               [--theme=<name> | --themes=<a,b|all>] [--browser=auto|off|require]
 *               [--page-cap=N] [--ocr]
 *               [--edits=<edits.json>] [--strict] [--json]
 *
 * The work is `checkFile` (@lolly-tools/node-shell/check), shared with the
 * `lolly_check` MCP tool. With `--json` the envelope's `result` is a `CheckReportV1`
 * (schemas/check-report-v1.schema.json). Without it, one line per family and one per
 * finding go to stdout.
 *
 * `-` reads a Design document (JSON) from standard input; anything else is read from
 * its path, and the kind of input comes from the file name.
 *
 * The design system for the brand family follows `system context`: `--file`, then the
 * active terminal system, then the active content profile's head tokens asset. With
 * none, the brand family is reported unavailable and the rest still run, so the verb
 * works on a content-free install.
 *
 * Exit codes: 0 clean, 5 warnings to review (the full report, `ok:false`), 4 an error
 * finding or any warning under `--strict`, 3 `--browser=require` on a document with no
 * browser tier (an export has no render family, so the requirement does not apply
 * to an export), 2 usage (an unknown flag, or a `--theme` the design system does not
 * declare), 1 a family that crashed or an export with no page that could be decoded.
 * Findings are never `warn()` calls, so the global `--strict` does not promote them a
 * second time.
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { CheckFindingV1, CheckReportV1 } from '@lolly-tools/core';
import { CheckInputError, checkFile, parseFidelityEdits, type CheckFileOptionsV1 } from '@lolly-tools/node-shell/check';
import { cleanControlChars } from '@lolly-tools/node-shell/verdict-report';
import { CliError, EXIT, usageError } from './exit-codes.ts';
import { emitResult } from './envelope.ts';
import { writeOut } from './output.ts';
import { readStdin } from './run.ts';

export interface CheckCliOptions {
  json?: boolean;
  strict?: boolean;
}

const BROWSER_MODES = ['auto', 'off', 'require'] as const;

const kindOf = (code: string): string => code.toUpperCase().replace(/[.-]/g, '_');

/** An input or source the check cannot read, as the run's own error. */
function asCliError(err: unknown): unknown {
  if (err instanceof CheckInputError) {
    const exit = err.code === 'input.unsupported' ? EXIT.USAGE : EXIT.FAILED;
    return new CliError(err.message, exit, kindOf(err.code), err.code);
  }
  return err;
}

async function readInput(path: string): Promise<{ bytes: Uint8Array; name: string }> {
  if (!path) throw usageError('lolly check needs a file: a Design document (.json), a .lolly, or an export (.pdf, .pptx, .png, .jpg, .webp, .svg).', 'MISSING_ARGUMENT');
  if (path === '-') {
    const bytes = new Uint8Array(await readStdin());
    if (!bytes.length) throw usageError('Standard input is empty.', 'EMPTY_INPUT');
    return { bytes, name: 'standard-input.json' };
  }
  try {
    return { bytes: new Uint8Array(await readFile(resolve(process.cwd(), path))), name: basename(path) };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw usageError(`No file at ${path}.`, 'FILE_NOT_FOUND');
    throw err;
  }
}

const SEVERITY_WORD: Record<string, string> = { error: 'error', warn: 'review', info: 'note' };

/**
 * Layer ids, names, messages and the deck's own words come from the file being
 * checked. Every one is scrubbed of control characters at this print boundary, as
 * preflight does, so a crafted file cannot write ANSI that erases lines and forges a
 * "clean (exit 0)" verdict. The `--json` envelope is data and is left as it is.
 */
const clean = cleanControlChars;

function findingLine(f: CheckFindingV1): string {
  const where = [f.artboardId, f.layerId].filter(Boolean).join('/') || f.page && `page ${f.page}` || '';
  return `  ${SEVERITY_WORD[f.severity] ?? f.severity}  ${clean(f.code)}${where ? `  [${clean(where)}]` : ''}${f.theme ? `  (${clean(f.theme)})` : ''}  ${clean(f.message)}`;
}

/** The human report: the verdict, a line per family, then the findings by family. */
export function checkOutline(report: CheckReportV1): string {
  const lines: string[] = [];
  const s = report.summary;
  lines.push(`${clean(report.input.name ?? 'input')}: ${report.outcome} (exit ${report.exitCode}). ${s.error} errors, ${s.warn} to review, ${s.info} notes.`);
  if (report.designSystem) {
    const ds = report.designSystem;
    lines.push(`Design system: ${ds.origin}${ds.profile ? ` ${clean(ds.profile)}` : ''}${ds.tokensAsset ? ` (${clean(ds.tokensAsset)})` : ''}`);
  }
  for (const [family, state] of Object.entries(report.families)) {
    const counts = state.error + state.warn + state.info ? ` ${state.error}/${state.warn}/${state.info}` : '';
    lines.push(`${family.padEnd(9)} ${state.state}${counts}${state.reason ? `  ${clean(state.reason)}` : ''}`);
  }
  for (const family of Object.keys(report.families)) {
    const own = report.findings.filter((f) => f.family === family);
    if (!own.length) continue;
    lines.push('', `${family}:`);
    for (const f of own) lines.push(findingLine(f));
  }
  if (report.fidelity?.editedStrings.length) {
    lines.push('', 'Edited wording (listed for review, not hidden):');
    for (const e of report.fidelity.editedStrings) lines.push(`  “${clean(e.source)}” → “${clean(e.result)}”`);
  }
  if (report.fidelity?.excepted?.length) {
    lines.push('', 'Recorded as deliberate edits (excepted, not passed):');
    for (const e of report.fidelity.excepted)
      lines.push(`  slide ${e.slide}: “${clean(e.source)}”${e.result !== undefined && e.result !== e.source ? ` → “${clean(e.result)}”` : ''}  ${clean(e.reason)}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * `--edits=<edits.json>`: the changes to the source's wording made on purpose, a JSON
 * array of `{ "source", "result", "reason" }`. Their fidelity findings stay in the report,
 * marked excepted. Any problem in the file refuses the run rather than using part of the file.
 */
async function readEdits(path: string, source: string | undefined): Promise<NonNullable<CheckFileOptionsV1['edits']>> {
  if (!source) throw usageError('--edits applies to the fidelity check, which needs --source=<deck or inventory>.', 'MISSING_ARGUMENT');
  const { bytes } = await readInput(path);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw usageError(`${path} is not JSON. --edits takes a JSON array of { "source", "result", "reason" }.`, 'BAD_FLAG_VALUE');
  }
  const { edits, problems } = parseFidelityEdits(value);
  if (problems.length)
    throw usageError(`${path} has ${problems.length === 1 ? 'a problem' : `${problems.length} problems`}: ${problems.slice(0, 5).join(' ')}${problems.length > 5 ? ` And ${problems.length - 5} more.` : ''}`, 'BAD_FLAG_VALUE');
  return edits;
}

export async function checkCli(positionals: string[], flags: Record<string, string>, opts: CheckCliOptions = {}): Promise<number> {
  if (positionals.length > 1) throw usageError(`lolly check takes one file; got ${positionals.length}.`, 'TOO_MANY_ARGUMENTS');
  const browser = flags.browser ?? 'auto';
  if (!(BROWSER_MODES as readonly string[]).includes(browser))
    throw usageError(`--browser must be auto, off or require (got "${browser}").`, 'BAD_FLAG_VALUE');
  let pageCap: number | undefined;
  if (flags['page-cap'] !== undefined) {
    pageCap = Number(flags['page-cap']);
    if (!Number.isInteger(pageCap) || pageCap < 1 || pageCap > 100)
      throw usageError(`--page-cap must be a whole number from 1 to 100 (got "${flags['page-cap']}").`, 'BAD_FLAG_VALUE');
  }
  const { bytes, name } = await readInput(positionals[0] ?? '');

  const checkOpts: CheckFileOptionsV1 = {
    strict: opts.strict === true,
    browser: browser as CheckFileOptionsV1['browser'],
    ...(pageCap ? { pageCap } : {}),
    ...(flags.theme ? { theme: flags.theme } : {}),
    // Plan 291 W4: one report over several themes, each render, brand and Verify finding naming its theme.
    ...(flags.themes ? { themes: flags.themes.trim() === 'all' ? 'all' as const : flags.themes.split(',').map((n) => n.trim()).filter(Boolean) } : {}),
    ...(flags.ocr !== undefined && !/^(0|false|off|no)$/i.test(flags.ocr) ? { ocr: true } : {}),
  };
  if (flags.source) {
    const source = await readInput(flags.source);
    checkOpts.source = source;
  }
  if (flags.edits !== undefined) checkOpts.edits = await readEdits(flags.edits, flags.source);
  // The brand family needs a design system for a document, and for a .pptx, whose
  // painted colours it reads (plan 291 M4); any other export skips that family.
  if (/\.(json|lolly|pptx)$/i.test(name)) {
    const { briefSource, designSystemOf } = await import('./system.ts');
    const { doc, origin } = await briefSource(flags);
    if (doc && origin) checkOpts.designSystem = { doc, ...designSystemOf(origin) };
    // The profile's catalog belongs to the profile's own design system: a --file or a
    // terminal system that is another brand is checked without it (as `system check` is).
    const { readBriefCatalogFor } = await import('@lolly-tools/node-shell/design-brief');
    checkOpts.catalog = readBriefCatalogFor(origin?.kind, doc);
  }

  let report: CheckReportV1;
  try {
    report = await checkFile(bytes, name, checkOpts);
  } catch (err) {
    throw asCliError(err);
  } finally {
    if (browser !== 'off' && /\.(json|lolly)$/i.test(name)) {
      const { closeWebShell } = await import('@lolly-tools/node-shell/webshell-render');
      const { closeBrowser } = await import('@lolly-tools/node-shell/browsers');
      await closeWebShell();
      await closeBrowser();
    }
  }
  if (opts.json) await emitResult(report, report.exitCode);
  else await writeOut(checkOutline(report));
  return report.exitCode;
}
