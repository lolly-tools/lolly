// SPDX-License-Identifier: MPL-2.0
/**
 * `--themes=<a,b|all>` on both `lolly run` forms (plan 291 M4, E24): one document,
 * exported once per theme its design system declares, to `<stem>-<theme>.<ext>`.
 *
 * A theme name becomes the URL-mode `_themes` choice (`{"<group>":"<theme id>"}`) the
 * way the engine resolves a legacy theme name (`resolveTokenSelection(doc, {theme})`),
 * so `--themes=dark` and `--_themes={"":"dark"}` render the same file.
 */
import { basename, dirname, extname, join } from 'node:path';
import { resolveTokenSelection } from '@lolly/engine';
import { usageError } from './exit-codes.ts';

/** One export of a `--themes` run: the name the file is called by, and the choice it renders in. */
export interface ThemeRun {
  theme: string;
  selection: Record<string, string>;
}

/** A theme name as one file-name segment. */
function fileSegment(theme: string): string {
  return theme.replace(/[^\w.-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '') || 'theme';
}

/** `<stem>-<theme>.<ext>` beside `path`: `deck.pptx` and `dark` give `deck-dark.pptx`. */
export function themedOutputPath(path: string, theme: string): string {
  const ext = extname(path);
  const stem = basename(path, ext);
  const leaf = `${stem}-${fileSegment(theme)}${ext}`;
  const dir = dirname(path);
  return dir === '.' && !path.startsWith('./') ? leaf : join(dir, leaf);
}

/** The themes a token document declares, as `{name, group}` in document order. */
function declaredThemes(doc: unknown): Array<{ name: string; id: string; group: string }> {
  const raw = doc && typeof doc === 'object' && Array.isArray((doc as { $themes?: unknown }).$themes) ? (doc as { $themes: unknown[] }).$themes : [];
  const out: Array<{ name: string; id: string; group: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const t = entry as { id?: unknown; name?: unknown; group?: unknown };
    const id = typeof t.id === 'string' ? t.id : typeof t.name === 'string' ? t.name : '';
    if (!id) continue;
    out.push({ id, name: typeof t.name === 'string' ? t.name : id, group: typeof t.group === 'string' ? t.group : '' });
  }
  return out;
}

/**
 * The exports a `--themes` value asks for, in the order given. `all` is every theme the
 * design system declares. A name the design system does not declare is a usage error
 * that lists the ones it does, so a typo never exports the default theme under the
 * typo's name.
 */
export function themeRuns(doc: unknown, spec: string): ThemeRun[] {
  const declared = declaredThemes(doc);
  const names = [...new Set(spec.split(',').map((s) => s.trim()).filter(Boolean))];
  if (!names.length) throw usageError('--themes needs at least one theme name, or `all`.', 'BAD_FLAG_VALUE');
  if (!declared.length) {
    throw usageError('--themes needs a design system that declares themes, and the active one declares none. Drop --themes to export once.', 'BAD_FLAG_VALUE');
  }
  const list = names.includes('all') ? declared.map((t) => (declared.filter((o) => o.name === t.name).length > 1 && t.group ? `${t.group}/${t.name}` : t.name)) : names;
  const known = new Set(declared.flatMap((t) => [t.name, t.id, `${t.group}/${t.name}`, `${t.group}/${t.id}`]));
  const unknown = list.filter((name) => !known.has(name));
  if (unknown.length) {
    throw usageError(
      `--themes names ${unknown.length === 1 ? 'a theme' : 'themes'} the design system does not declare: ${unknown.join(', ')}. ` +
        `Its themes are ${[...new Set(declared.map((t) => t.name))].join(', ')} (or pass --themes=all).`,
      'BAD_FLAG_VALUE',
    );
  }
  return [...new Set(list)].map((theme) => ({ theme, selection: resolveTokenSelection(doc, { theme }).choices }));
}

/**
 * The `--themes` and `--_themes` pair, checked before anything renders. Both name the
 * theme, so giving both is a conflict; `--themes` without an output path is refused,
 * because one stream cannot hold several files.
 */
export function themesPlan(flags: Record<string, string>, outputPath: string | undefined): string | null {
  const spec = flags.themes;
  if (spec === undefined) return null;
  if (flags._themes !== undefined) {
    throw usageError('--themes and --_themes both choose the theme. Use --themes=<names> for one file per theme, or --_themes=<json> for one file.', 'CONFLICTING_FLAGS');
  }
  if (!outputPath || outputPath === '-') {
    throw usageError('--themes writes one file per theme, named <stem>-<theme>.<ext> after --output, so it needs --output=<file>. Nothing was written.', 'MISSING_ARGUMENT');
  }
  return spec;
}
