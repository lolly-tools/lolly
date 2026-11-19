// SPDX-License-Identifier: MPL-2.0
/**
 * Which file in a built web app answers a request path, and which headers go with the answer.
 *
 * The rules are read from the repository's vercel.json, the file the hosted deployment
 * ships with, so the local launcher (`lolly app`) answers the same routes and sends the
 * same Content-Security-Policy without a second written copy of either. esbuild inlines
 * the JSON into the packaged CLI, so nothing is read from disk at run time.
 *
 * Pure: the only outside fact is an injected "is this a file" probe.
 */
import vercel from '../../../vercel.json' with { type: 'json' };

interface HeaderRule { source: string; headers: Array<{ key: string; value: string }> }
interface PathRule { source: string; destination: string; has?: unknown }
interface HostingConfig { headers?: HeaderRule[]; rewrites?: PathRule[]; redirects?: PathRule[] }

/** The parts of vercel.json this module reads. */
export const HOSTING: HostingConfig = vercel as HostingConfig;

/** The end of a parenthesised group that opens at `start`, one past its `)`. */
function groupEnd(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === '\\') i++;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
  }
  throw new Error(`Unbalanced group in route pattern: ${source}`);
}

/**
 * A vercel.json `source` as an anchored RegExp. Covers the forms the file uses:
 * literal text, raw groups, `:name`, `:name(pattern)` and `:name*`. Anything else
 * throws, and the test that compiles every rule in the file fails first.
 */
export function compileSource(source: string): RegExp {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === '\\') { out += source.slice(i, i + 2); i += 2; continue; }
    if (c === '(') { const end = groupEnd(source, i); out += source.slice(i, end); i = end; continue; }
    if (c === ':') {
      const name = /^[A-Za-z0-9_]+/.exec(source.slice(i + 1))?.[0];
      if (!name) throw new Error(`Unnamed parameter in route pattern: ${source}`);
      i += 1 + name.length;
      if (source[i] === '(') {
        const end = groupEnd(source, i);
        out += `(?<${name}>${source.slice(i + 1, end - 1)})`;
        i = end;
      } else if (source[i] === '*') { out += `(?<${name}>.*)`; i++; }
      else out += `(?<${name}>[^/]+)`;
      continue;
    }
    if ('[]{}'.includes(c)) throw new Error(`Unsupported syntax in route pattern: ${source}`);
    out += '.+^$|'.includes(c) ? `\\${c}` : c;
    i++;
  }
  return new RegExp(`^${out}$`);
}

/** Fill a destination's `:name` slots from the groups its source captured. */
function fillDestination(destination: string, groups: Record<string, string> | undefined): string {
  return destination.replace(/:([A-Za-z0-9_]+)/g, (whole, name: string) => groups?.[name] ?? whole);
}

interface CompiledRule { pattern: RegExp; destination: string }
const compileRules = (rules: PathRule[] | undefined): CompiledRule[] =>
  (rules ?? [])
    // A rule with `has` depends on the host name, which is never the public one here.
    .filter(rule => rule.has === undefined)
    .map(rule => ({ pattern: compileSource(rule.source), destination: rule.destination }));

let compiled: { rewrites: CompiledRule[]; redirects: CompiledRule[]; headers: Array<{ pattern: RegExp; headers: HeaderRule['headers'] }> } | null = null;
function rules(): NonNullable<typeof compiled> {
  compiled ??= {
    rewrites: compileRules(HOSTING.rewrites),
    redirects: compileRules(HOSTING.redirects),
    headers: (HOSTING.headers ?? []).map(rule => ({ pattern: compileSource(rule.source), headers: rule.headers })),
  };
  return compiled;
}

/** A destination this server can answer from the built directory. */
const isLocalFile = (destination: string): boolean => destination.startsWith('/') && !destination.startsWith('/api/');

/**
 * The share-card pages (`/t/<tool>.html`, `/view/<name>.html`) only redirect a person
 * into the app shell, and a build made without them still has the shell.
 */
const isShellStub = (destination: string): boolean => /^\/(?:t|view)\/[^/]+\.html$/.test(destination);

export type RouteAnswer =
  | { kind: 'file'; path: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'missing' };

/**
 * Resolve a clean, absolute request path. Order follows the hosted deployment: redirects,
 * then a file that exists, then the rewrites in file order. `isFile` takes a path that
 * starts with `/`, relative to the served directory.
 */
export function resolveRoute(path: string, isFile: (path: string) => boolean): RouteAnswer {
  const { redirects, rewrites } = rules();
  for (const rule of redirects) {
    const match = rule.pattern.exec(path);
    if (match && rule.destination.startsWith('/')) return { kind: 'redirect', location: fillDestination(rule.destination, match.groups) };
  }
  const direct = path.endsWith('/') ? `${path}index.html` : path;
  if (isFile(direct)) return { kind: 'file', path: direct };
  // A directory page uses relative links, so its address needs the closing slash.
  if (!path.endsWith('/') && isFile(`${path}/index.html`)) return { kind: 'redirect', location: `${path}/` };
  for (const rule of rewrites) {
    const match = rule.pattern.exec(path);
    if (!match) continue;
    if (!isLocalFile(rule.destination)) return { kind: 'missing' };
    const destination = fillDestination(rule.destination, match.groups);
    if (isFile(destination)) return { kind: 'file', path: destination };
    if (isShellStub(destination) && isFile('/index.html')) return { kind: 'file', path: '/index.html' };
    return { kind: 'missing' };
  }
  return { kind: 'missing' };
}

/** Cache headers come from the shared delivery rules, never from the hosting file. */
const CACHE_HEADERS = new Set(['cache-control', 'cdn-cache-control']);

/**
 * The hosted deployment's response headers for a request path: the security set, and
 * a fixed Content-Type where the file declares one.
 */
export function hostedHeaders(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of rules().headers) {
    if (!rule.pattern.test(path)) continue;
    for (const { key, value } of rule.headers) {
      if (!CACHE_HEADERS.has(key.toLowerCase())) out[key] = value;
    }
  }
  return out;
}
