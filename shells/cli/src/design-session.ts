// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly run <design-session.lolly> --export=<fmt> [--output=<file>] [--s=<frame>]
 * [--c2pa=on|off] [--imprint=0|1] [--no-provenance] [--theme=<name> | --_themes=<json> |
 * --themes=<a,b|all>] [--file=<tokens.json>]` (plan 291 W8): export a saved Design session with the web shell's
 * own exporter. `--themes` (M4) exports the one session once per theme, to
 * <stem>-<theme>.<ext> beside --output; `--theme` exports it once in one theme, to
 * --output as given.
 *
 * The file is opened in the web shell through the `#/open` route, with no drop and no
 * chooser, then exported through the URL-mode export of its slot. That is the route a
 * person's browser takes, so the PPTX, PDF or image is the one the app writes. A reusable
 * tool `.lolly` keeps its own `--trust-tool` path (design-tool.ts); this path is for a
 * plain session that a person or `lolly package` saved.
 */
import { basename, dirname } from 'node:path';
import { stat, writeFile } from 'node:fs/promises';
import { frameFilterApplies, selectFramePage } from '@lolly/engine';
import { readLollyFile, type LollyFileContents } from '@lolly-tools/node-shell/lolly-file';
import { exportDesignSessionThemesViaWebShell, closeWebShell, type DesignSessionExportFormat } from '@lolly-tools/node-shell/webshell-render';
import { themeRuns, themedOutputPath, themesPlan, type ThemeRun } from './themes.ts';
import { closeBrowser } from '@lolly-tools/node-shell/browsers';
import { isOn } from './args.ts';
import { note, writeOut } from './output.ts';
import { usageError } from './exit-codes.ts';

/** The formats this path exports, as `--export` spells them. */
export const DESIGN_SESSION_EXPORT_FORMATS: readonly DesignSessionExportFormat[] = ['pptx', 'pdf', 'png', 'svg', 'jpg', 'jpeg', 'webp'];

/** The flags this path reads, plus the process-wide ones every verb accepts. */
export const SESSION_RUN_FLAGS = new Set(['export', 'output', 's', 'c2pa', 'imprint', 'no-provenance', 'themes', 'theme', '_themes', 'file', 'force', 'quiet', 'verbose', 'strict']);

/** The provenance settings the export URL carries. Absent means the app's own default. */
export interface SessionProvenance { c2pa?: boolean; imprint?: boolean }

/** A number as Design's renderer reads one (community/design/hooks.js `num`). */
function rendererNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/** Whether Design's renderer hides a box (hooks.js `isHiddenBox`). */
function rendererHidden(value: unknown): boolean {
  if (value === true || value === false) return value;
  return /^(true|1|yes|on)$/i.test(String(value ?? ''));
}

/**
 * The frame ids a saved session renders as pages, in page order. This is the rule
 * Design's renderer uses (hooks.js frameGroupsFor): every frame that is not hidden,
 * by `order` and then by x. A `--s` address is resolved against this list, the list
 * the web shell's per-slide export walks.
 */
export function sessionFramePages(session: Record<string, unknown>): string[] {
  let boxes: unknown = session.boxes;
  if (typeof boxes === 'string') { try { boxes = JSON.parse(boxes); } catch { boxes = []; } }
  if (!Array.isArray(boxes)) return [];
  const frames: Array<{ id: string; order: number; x: number }> = [];
  for (const box of boxes) {
    if (!box || typeof box !== 'object') continue;
    const row = box as Record<string, unknown>;
    if (String(row.kind) !== 'frame' || rendererHidden(row.hidden)) continue;
    frames.push({ id: String(row.id), order: rendererNumber(row.order), x: rendererNumber(row.x) });
  }
  frames.sort((a, b) => (a.order - b.order) || (a.x - b.x));
  return frames.map((frame) => frame.id);
}

/**
 * Settle which frame the export takes, before a browser starts. An address that points
 * at no rendered frame is refused (exit 2), the same answer `run design --document` gives.
 * A one-image format from a deck of several frames, with no `--s`, takes the first
 * frame by position and says so, so a dropped frame is never silent.
 */
export function sessionFrameChoice(
  pages: readonly string[], frame: string | undefined, format: DesignSessionExportFormat, name: string,
): { frame?: string; note?: string } {
  if (frame !== undefined) {
    const pick = selectFramePage(pages, frame);
    if (pick.kind === 'unmatched') {
      throw usageError(
        `--s=${frame} names no frame in ${name}` +
        (pages.length
          ? ` (it renders ${pages.length} ${pages.length === 1 ? 'frame' : 'frames'}: ${pages.join(', ')}; a number is the 1-based position, anything else is a frame id).`
          : ': it has no frames, so there is nothing to select.') +
        ' Nothing was written.',
        'SLIDE_NOT_FOUND',
      );
    }
    return { frame };
  }
  if (pages.length > 1 && frameFilterApplies(format)) {
    return {
      frame: '1',
      note: `ℹ ${name} has ${pages.length} frames and a ${format} holds one, so this export is the first frame, ${pages[0]}. Pass --s=<frame id or position> for another.`,
    };
  }
  return {};
}

/** Whether a read `.lolly` is a saved Design session (not a tool, project or renovation). */
export function isDesignSessionFile(contents: LollyFileContents): boolean {
  const kind = contents.manifest.kind ?? 'session';
  const toolId = contents.manifest.tool?.id ?? contents.session.__toolId;
  return kind === 'session' && toolId === 'design';
}

/** Check the flags and settle the format before a browser starts. */
export function designSessionRunPlan(flags: Record<string, string>): { format: DesignSessionExportFormat; output?: string; frame?: string; provenance?: SessionProvenance; themes?: string; theme?: string; selection?: Record<string, string> } {
  for (const key of Object.keys(flags)) {
    if (key === 'trust-tool') throw usageError('--trust-tool is for a reusable tool file. This is a saved Design session, which carries no code to trust; run it without the flag.', 'CONFLICTING_FLAGS');
    if (!SESSION_RUN_FLAGS.has(key)) throw usageError(`--${key} is not an option of a saved Design session. It takes --export, --output, --s, --c2pa, --imprint, --no-provenance, --theme, --_themes, --themes, --file and --force.`, 'UNKNOWN_FLAG');
  }
  const format = (flags.export || 'png').toLowerCase();
  if (!(DESIGN_SESSION_EXPORT_FORMATS as readonly string[]).includes(format)) {
    throw usageError(`--export=${flags.export} is not a format a saved Design session exports to here. Use one of ${DESIGN_SESSION_EXPORT_FORMATS.join(', ')}.`, 'BAD_FLAG_VALUE');
  }
  const frame = flags.s;
  if (frame !== undefined && !/^[\w.:-]{1,128}$/.test(frame)) throw usageError(`--s=${frame} is not a frame id.`, 'BAD_FLAG_VALUE');
  // The same provenance words every other render takes. The app sets both marks on by
  // default, so an opt-out has to travel on the export URL to count.
  const bare = isOn(flags['no-provenance']);
  const c2pa = flags.c2pa === undefined ? undefined : isOn(flags.c2pa);
  const imprint = flags.imprint === undefined ? undefined : isOn(flags.imprint);
  if (bare && (c2pa || imprint)) {
    throw usageError('--no-provenance turns every provenance mark off, but this run also asks for one explicitly. Drop --no-provenance, or drop the --c2pa/--imprint that contradicts it.', 'CONFLICTING_FLAGS');
  }
  const provenance: SessionProvenance = bare
    ? { c2pa: false, imprint: false }
    : { ...(c2pa !== undefined ? { c2pa } : {}), ...(imprint !== undefined ? { imprint } : {}) };
  const themes = themesPlan(flags, flags.output);
  const one = sessionThemeChoice(flags, themes !== null);
  return {
    format: format as DesignSessionExportFormat,
    ...(themes !== null ? { themes } : {}),
    ...one,
    ...(flags.output ? { output: flags.output } : {}),
    ...(frame ? { frame } : {}),
    ...(Object.keys(provenance).length ? { provenance } : {}),
  };
}

/**
 * Refuse an --output the export could not be written to, before a browser starts: a
 * folder that does not exist, or an --output that is itself a folder. Without this the
 * write failed with ENOENT after the whole export had run. `--themes` writes beside
 * --output, so the same folder is checked. `--force` needs no check here: run always
 * replaces its output, and accepts the flag that compose and package take.
 */
export async function sessionOutputFolderCheck(plan: { output?: string }): Promise<void> {
  if (!plan.output) return;
  const target = await stat(plan.output).catch(() => null);
  if (target?.isDirectory()) throw usageError(`${plan.output} is a folder; --output takes a file. Nothing was written.`, 'BAD_FLAG_VALUE');
  const folder = await stat(dirname(plan.output)).catch(() => null);
  if (!folder?.isDirectory()) throw usageError(`The folder for ${plan.output} does not exist; make it first. Nothing was written.`, 'BAD_FLAG_VALUE');
}

/**
 * One theme for one file (`--theme=<name>` or `--_themes=<json>`), written to --output as
 * given or to stdout. `--themes` is the many-files form and gives each file its theme's
 * name, so `--themes=light --output=light.pptx` writes light-light.pptx; `--theme=light`
 * writes light.pptx.
 */
function sessionThemeChoice(flags: Record<string, string>, many: boolean): { theme?: string; selection?: Record<string, string> } {
  const theme = flags.theme?.trim();
  const json = flags._themes;
  if (theme === undefined && json === undefined) return {};
  if (many) throw usageError(`--themes writes one file per theme; --${theme !== undefined ? 'theme' : '_themes'} picks the theme of one file. Use one of them.`, 'CONFLICTING_FLAGS');
  if (theme !== undefined && json !== undefined) throw usageError('--theme and --_themes both choose the theme. Use --theme=<name>, or --_themes=<json> for a choice per token group.', 'CONFLICTING_FLAGS');
  if (theme !== undefined) {
    if (!theme || theme === 'all' || theme.includes(',')) throw usageError(`--theme takes one theme name (got "${flags.theme}"). For a file per theme, use --themes=<a,b|all> with --output.`, 'BAD_FLAG_VALUE');
    return { theme };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(json!); } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some((v) => typeof v !== 'string')) {
    throw usageError(`--_themes takes a JSON object of token group to theme id, such as {"":"dark"} (got ${json}).`, 'BAD_FLAG_VALUE');
  }
  return { selection: parsed as Record<string, string> };
}

/**
 * Export the session and write the bytes to --output, or to stdout. With --themes, the
 * one opened session is exported once per theme, each to <stem>-<theme>.<ext>. With
 * --theme or --_themes, it is exported once in that theme, to --output as given.
 */
export async function runDesignSession(path: string, bytes: Uint8Array, flags: Record<string, string>, contents?: LollyFileContents): Promise<void> {
  const plan = designSessionRunPlan(flags);
  await sessionOutputFolderCheck(plan);
  const name = basename(path);
  const pages = sessionFramePages((contents ?? readLollyFile(bytes, { allowTool: true })).session);
  const choice = sessionFrameChoice(pages, plan.frame, plan.format, name);
  // The design system the session renders in follows the ladder `lolly package` lowered
  // it with: --file, then the terminal system, then the content profile's. The page is
  // given the first two, since it holds only the profile's own.
  if (flags.file !== undefined && (!flags.file || flags.file === '1' || flags.file === 'true')) throw usageError('--file needs a path: write --file=<tokens.json>.', 'MISSING_FLAG_VALUE');
  const { briefSource } = await import('./system.ts');
  const system = await briefSource(flags.file ? { file: flags.file } : {});
  const designSystem = system.origin && system.origin.kind !== 'profile' ? system.doc : undefined;
  let runs: ThemeRun[] | null = null;
  let selection = plan.selection;
  if (plan.themes !== undefined || plan.theme !== undefined) {
    const doc = system.doc ?? null;
    if (plan.themes !== undefined) runs = themeRuns(doc, plan.themes);
    else selection = themeRuns(doc, plan.theme!)[0]!.selection;
  }
  try {
    const results = await exportDesignSessionThemesViaWebShell(bytes, {
      name, format: plan.format, ...(choice.frame ? { frame: choice.frame } : {}), ...(plan.provenance ?? {}),
      ...(designSystem !== undefined ? { designSystem } : {}),
      ...(runs ? { tokenSelections: runs.map((run) => run.selection) } : selection ? { tokenSelections: [selection] } : {}),
    });
    if (choice.note) note(choice.note);
    // The exporter's own notes (what a PowerPoint export could not keep), once each.
    for (const line of new Set(results.flatMap((r) => r.notes ?? []))) note(line);
    if (runs) {
      for (const [i, run] of runs.entries()) {
        const out = themedOutputPath(plan.output!, run.theme);
        await writeFile(out, results[i]!.bytes);
        note(`✓ Wrote ${results[i]!.bytes.length} bytes to ${out} (theme ${run.theme})`);
      }
    } else if (plan.output) {
      await writeFile(plan.output, results[0]!.bytes);
      note(`✓ Wrote ${results[0]!.bytes.length} bytes to ${plan.output}`);
    } else await writeOut(Buffer.from(results[0]!.bytes));
  } finally {
    await closeBrowser();
    await closeWebShell();
  }
}
