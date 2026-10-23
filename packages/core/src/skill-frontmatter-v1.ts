// SPDX-License-Identifier: MPL-2.0
/**
 * Agent Skills frontmatter (agentskills.io/specification), read one way for tool skills
 * and brand skills: a leading `---` block of `key: value` lines, an indented `metadata:`
 * map of strings, and folded or literal block scalars for long values. Only the subset
 * the specification uses is read. Anything else becomes an error message, never a guess.
 */

export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_COMPATIBILITY_MAX = 500;

export interface SkillFrontmatterV1 {
  /** True when the text opens with a `---` line. */
  present: boolean;
  /** Top-level string fields, `metadata` excepted. */
  fields: Record<string, string>;
  /** The `metadata` map. The specification allows strings only. */
  metadata: Record<string, string>;
  /** The text after the closing `---` line, unchanged; the whole text when there is no block. */
  body: string;
  /** Characters the block takes, closing line included, so `text.slice(length) === body`. */
  length: number;
  errors: string[];
}

/**
 * A skill name as the specification states it: 1 to 64 characters of lowercase letters,
 * digits and single hyphens, with no hyphen at either end. `prefix` narrows it further
 * (tool skills are `lolly-<tool>`).
 */
export function isAgentSkillName(name: unknown, prefix = ''): name is string {
  return typeof name === 'string' && name.length >= 1 && name.length <= SKILL_NAME_MAX
    && name.startsWith(prefix) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

function scalar(raw: string): string | null {
  const t = raw.trim();
  if (t.startsWith('"')) {
    try { const s: unknown = JSON.parse(t); return typeof s === 'string' ? s : null; } catch { return null; }
  }
  if (t.startsWith("'")) return t.length >= 2 && t.endsWith("'") ? t.slice(1, -1).replace(/''/g, "'") : null;
  // A plain scalar ends at an unquoted comment.
  return t.replace(/\s+#.*$/, '');
}

const BLOCK = /^([|>])([+-]?)$/;

/** Reads the frontmatter block, if any, and returns the body untouched. */
export function parseSkillFrontmatter(text: string): SkillFrontmatterV1 {
  const lines = text.split('\n');
  const clean = (line: string | undefined): string => (line ?? '').replace(/\r$/, '');
  if (clean(lines[0]) !== '---') return { present: false, fields: {}, metadata: {}, body: text, length: 0, errors: [] };
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (clean(lines[i]).trimEnd() === '---') { end = i; break; }
  if (end < 0) return { present: true, fields: {}, metadata: {}, body: text, length: 0, errors: ['The frontmatter block is not closed with a --- line.'] };
  const length = lines.slice(0, end + 1).reduce((n, line) => n + line.length + 1, 0);
  const fields: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  const errors: string[] = [];
  const block = lines.slice(1, end).map(clean);
  for (let i = 0; i < block.length; i++) {
    const line = block[i]!;
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const top = /^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$/.exec(line);
    if (!top) { errors.push(`Frontmatter line ${i + 2} is not a "key: value" line.`); continue; }
    const key = top[1]!;
    const value = (top[2] ?? '').trim();
    // Indented lines that follow belong to this key.
    const nested: string[] = [];
    while (i + 1 < block.length && (/^[ \t]+\S/.test(block[i + 1]!) || !block[i + 1]!.trim())) nested.push(block[++i]!);
    while (nested.length && !nested[nested.length - 1]!.trim()) nested.pop();
    if (key in fields || (key === 'metadata' && Object.keys(metadata).length)) errors.push(`Frontmatter key "${key}" appears twice.`);
    if (key === 'metadata') {
      if (value) { errors.push('Frontmatter "metadata" must be an indented map.'); continue; }
      for (const row of nested) {
        if (!row.trim()) continue;
        const m = /^[ \t]+([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(row);
        const v = m ? scalar(m[2]!) : null;
        if (!m || v === null) { errors.push(`A metadata line could not be read: "${row.trim().slice(0, 60)}".`); continue; }
        metadata[m[1]!] = v;
      }
      continue;
    }
    const style = BLOCK.exec(value);
    if (style) {
      const indent = Math.min(...nested.filter((r) => r.trim()).map((r) => /^[ \t]*/.exec(r)![0].length));
      const rows = nested.map((r) => r.slice(Number.isFinite(indent) ? indent : 0));
      let joined: string;
      if (style[1] === '|') joined = rows.join('\n');
      else {
        // Folded: lines of one paragraph join with a space, a blank line keeps a break.
        const paragraphs: string[] = [];
        let current = '';
        for (const row of rows) {
          if (!row.trim()) { paragraphs.push(current); current = ''; } else current = current ? `${current} ${row.trim()}` : row.trim();
        }
        paragraphs.push(current);
        joined = paragraphs.join('\n');
      }
      if (style[2] !== '+') joined = joined.replace(/\n+$/, '');
      fields[key] = joined;
      continue;
    }
    if (nested.length) { errors.push(`Frontmatter "${key}" holds a list or map, which this reader does not take.`); continue; }
    const v = scalar(value);
    if (v === null) { errors.push(`Frontmatter "${key}" has an unclosed quote.`); continue; }
    fields[key] = v;
  }
  return { present: true, fields, metadata, body: lines.slice(end + 1).join('\n'), length, errors };
}

/** Writes a frontmatter block from strings, quoting every value so it reads back exactly. */
export function writeSkillFrontmatter(fields: Record<string, string>, metadata: Record<string, string> = {}): string {
  const out = ['---'];
  for (const [key, value] of Object.entries(fields)) out.push(`${key}: ${JSON.stringify(value)}`);
  const meta = Object.entries(metadata);
  if (meta.length) { out.push('metadata:'); for (const [key, value] of meta) out.push(`  ${key}: ${JSON.stringify(value)}`); }
  out.push('---', '');
  return out.join('\n');
}
