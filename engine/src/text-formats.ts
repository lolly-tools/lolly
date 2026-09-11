// SPDX-License-Identifier: MPL-2.0
/** Portable formatters and loss-aware structured text conversions. */
import { parseAllDocuments, stringify } from 'yaml';
export function readYaml(text: string): unknown[] {
  return parseAllDocuments(text).map((doc) => {
    if (doc.errors.length) throw new Error(doc.errors.map((e) => e.message).join('\n'));
    return doc.toJS({ maxAliasCount: 100 });
  });
}
export function writeYaml(values: unknown[]): string {
  return values.map((v) => stringify(v)).join('---\n');
}
function ensureConvertible(value: unknown, to: string, seen = new Set<object>()): void {
  if (value === null && to === 'toml')
    throw new Error('TOML cannot represent null. No values have been discarded.');
  if (
    typeof value === 'bigint' ||
    (typeof value === 'number' &&
      (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))))
  )
    throw new Error('This value cannot be converted without losing numeric precision.');
  if (value instanceof Date)
    throw new Error('Date types cannot be converted without changing their meaning.');
  if (value && typeof value === 'object') {
    if (seen.has(value)) throw new Error('Cyclic aliases cannot be converted.');
    seen.add(value);
    for (const v of Object.values(value)) ensureConvertible(v, to, seen);
    seen.delete(value);
  }
}
export async function convertStructured(text: string, from: string, to: string): Promise<string> {
  const toml = from === 'toml' || to === 'toml' ? await import('smol-toml') : null;
  const values =
    from === 'yaml'
      ? readYaml(text)
      : [from === 'toml' ? toml!.parse(text, { integersAsBigInt: 'asNeeded' }) : JSON.parse(text)];
  for (const value of values) ensureConvertible(value, to);
  if (to === 'yaml') return writeYaml(values);
  if (values.length !== 1)
    throw new Error(`Choose a single YAML document to convert to ${to.toUpperCase()}.`);
  if (to === 'toml') {
    if (!values[0] || typeof values[0] !== 'object' || Array.isArray(values[0]))
      throw new Error('TOML needs an object at the top level.');
    return toml!.stringify(values[0] as Record<string, unknown>);
  }
  return JSON.stringify(values[0], null, 2);
}
export async function formatCode(text: string, language: string): Promise<string> {
  if (language === 'sql') return (await import('sql-formatter')).format(text);
  const { format } = await import('prettier/standalone');
  const parser = (
    {
      javascript: 'babel',
      typescript: 'babel-ts',
      css: 'css',
      html: 'html',
      markdown: 'markdown',
    } as Record<string, string>
  )[language];
  if (!parser) throw new Error('Choose a supported code language.');
  const plugins = parser.startsWith('babel')
    ? [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')]
    : parser === 'css'
      ? [await import('prettier/plugins/postcss')]
      : parser === 'html'
        ? [await import('prettier/plugins/html')]
        : [await import('prettier/plugins/markdown')];
  return format(text, { parser, plugins });
}

export async function compactCode(text: string, language: string): Promise<string> {
  if (language === 'javascript') {
    const { minify } = await import('terser');
    const result = await minify(text, {
      compress: false,
      mangle: false,
      format: { comments: 'some' },
    });
    if (result.code == null) throw new Error('JavaScript could not be compacted.');
    return result.code;
  }
  if (language === 'css') {
    const { parse, generate } = await import('css-tree');
    return generate(
      parse(text, {
        onParseError: (error) => {
          throw error;
        },
      })
    );
  }
  throw new Error('Compact mode supports JavaScript and CSS.');
}
