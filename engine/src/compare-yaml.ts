// SPDX-License-Identifier: MPL-2.0
/** Ordinary YAML data for structure comparison, without alias or tag evaluation. */
import { Composer, CST, Lexer, Parser, isAlias, isMap, isScalar, isSeq } from 'yaml';
import { COMPARE_MAX_TEXT } from './compare-budget.ts';

export type ComparisonYamlReadResult = { ok: true; value: unknown } | { ok: false; limitation: string };

const MAX_TOKENS = 100_000;
const MAX_STACK = 128;
const MAX_DEPTH = 64;
const MAX_NODES = 20_000;
const MAX_SCALAR = 64 * 1024;
const MAX_NUMBER = 128;
const NUMBER_SOURCE = /^(?:[-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+|[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+|[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*))$/;
const INVALID = 'This YAML is malformed or unsupported for structure comparison. Choose Text mode.';
const LIMIT = 'This YAML exceeds the structure reading limits. Choose Text mode.';
const SINGLE = 'YAML structure comparison needs one nonempty document. Choose Text mode.';
const REFERENCES = 'YAML anchors and aliases are not supported in structure comparison. Choose Text mode.';
const TAGS = 'YAML tags and directives are not supported in structure comparison. Choose Text mode.';
const KEYS = 'YAML structure comparison needs unique string keys. Choose Text mode.';
const MERGE = 'YAML merge keys are not supported in structure comparison. Choose Text mode.';
const NUMBERS = 'YAML structure comparison needs finite numbers and safe integers. Choose Text mode.';

class Refusal extends Error {
  readonly limitation: string;
  constructor(limitation: string) { super(limitation); this.limitation = limitation; }
}

/** Count UTF-8 without allocating a second input or replacing invalid surrogates. */
function checkString(text: string, maxBytes: number, signal?: AbortSignal): void {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    if (!(i % 4096)) signal?.throwIfAborted();
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(++i);
      if (!(low >= 0xdc00 && low <= 0xdfff)) throw new Refusal(INVALID);
      bytes += 4;
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new Refusal(INVALID);
    else bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    if (bytes > maxBytes) throw new Refusal(LIMIT);
  }
}

/** Guard construction before the recursive Composer sees any collection. */
function syntax(text: string, signal?: AbortSignal): CST.Token[] {
  const parser = new Parser(), tokens: CST.Token[] = [];
  let count = 0, documents = 0;
  const accept = (token: CST.Token): void => {
    if (token.type === 'document' && ++documents > 1) throw new Refusal(SINGLE);
    tokens.push(token);
  };
  for (const lexeme of new Lexer().lex(text)) {
    signal?.throwIfAborted();
    if (++count > MAX_TOKENS || !Array.isArray(parser.stack) || parser.stack.length > MAX_STACK) throw new Refusal(LIMIT);
    for (const token of parser.next(lexeme)) accept(token);
    if (parser.stack.length > MAX_STACK) throw new Refusal(LIMIT);
  }
  for (const token of parser.end()) accept(token);
  if (documents !== 1) throw new Refusal(SINGLE);
  return tokens;
}

/** Validate the whole CST iteratively, including properties on keys and scalars. */
function checkSyntax(tokens: CST.Token[], signal?: AbortSignal): void {
  const queue = tokens.map(token => ({ token, depth: -1 }));
  let nodes = 0;
  while (queue.length) {
    signal?.throwIfAborted();
    const { token, depth } = queue.pop()!;
    if (token.type === 'alias' || token.type === 'anchor') throw new Refusal(REFERENCES);
    if (token.type === 'tag' || token.type === 'directive' || token.type === 'directive-line') throw new Refusal(TAGS);
    if (token.type === 'error' || token.type === 'flow-error-end') throw new Refusal(INVALID);
    const scalar = CST.isScalar(token), collection = CST.isCollection(token);
    if (scalar || collection) {
      if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new Refusal(LIMIT);
      if (scalar) {
        checkString(token.source, MAX_SCALAR, signal);
        const raw = token.source.trim();
        if (token.type === 'scalar' && NUMBER_SOURCE.test(raw)) {
          if (raw.length > MAX_NUMBER) throw new Refusal(LIMIT);
          const value = Number(raw), coefficient = raw.split(/[eE]/)[0]!;
          if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))
            || (value === 0 && /[1-9]/.test(coefficient))) throw new Refusal(NUMBERS);
        }
      }
    }
    const add = (child: CST.Token | null | undefined, childDepth = depth): void => { if (child) queue.push({ token: child, depth: childDepth }); };
    if (token.type === 'document') {
      if (!token.value) throw new Refusal(SINGLE);
      for (const child of token.start) add(child);
      add(token.value, 0);
      for (const child of token.end ?? []) add(child);
    } else if (collection) {
      if (token.items.length > MAX_NODES) throw new Refusal(LIMIT);
      if (token.type === 'flow-collection') { add(token.start); for (const child of token.end) add(child); }
      for (const item of token.items) {
        for (const child of item.start) add(child);
        if ('key' in item) add(item.key, depth + 1);
        if ('sep' in item) for (const child of item.sep ?? []) add(child);
        add(item.value, depth + 1);
      }
    } else if (token.type === 'block-scalar') { for (const child of token.props) add(child); }
    else if ('end' in token) { for (const child of token.end ?? []) add(child); }
  }
}

/** Build plain data ourselves, so aliases, key coercion and prototypes never enter. */
function plainData(node: unknown, signal?: AbortSignal): unknown {
  let result: unknown, nodes = 0;
  const queue: { node: unknown; depth: number; assign(value: unknown): void }[] = [{ node, depth: 0, assign: value => { result = value; } }];
  while (queue.length) {
    signal?.throwIfAborted();
    const entry = queue.pop()!, current = entry.node;
    if (++nodes > MAX_NODES || entry.depth > MAX_DEPTH) throw new Refusal(LIMIT);
    if (current === null || current === undefined) { entry.assign(null); continue; }
    if (isAlias(current)) throw new Refusal(REFERENCES);
    if (!isMap(current) && !isSeq(current) && !isScalar(current)) throw new Refusal(INVALID);
    if (current.anchor) throw new Refusal(REFERENCES);
    if (current.tag) throw new Refusal(TAGS);
    if (isMap(current)) {
      const value: Record<string, unknown> = Object.create(null), keys = new Set<string>();
      nodes += current.items.length;
      if (nodes > MAX_NODES) throw new Refusal(LIMIT);
      entry.assign(value);
      for (const pair of current.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') throw new Refusal(KEYS);
        const key = pair.key.value;
        checkString(key, MAX_SCALAR, signal);
        if (keys.has(key)) throw new Refusal(KEYS);
        if (key === '<<') throw new Refusal(MERGE);
        keys.add(key);
        queue.push({ node: pair.value, depth: entry.depth + 1, assign: child => { value[key] = child; } });
      }
    } else if (isSeq(current)) {
      if (current.items.length > MAX_NODES) throw new Refusal(LIMIT);
      const value: unknown[] = new Array(current.items.length); entry.assign(value);
      current.items.forEach((child, index) => { queue.push({ node: child, depth: entry.depth + 1, assign: item => { value[index] = item; } }); });
    } else {
      const value: unknown = current.value;
      if (typeof value === 'bigint') {
        if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Refusal(NUMBERS);
        entry.assign(Number(value));
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Refusal(NUMBERS);
        entry.assign(value);
      } else if (typeof value === 'string') { checkString(value, MAX_SCALAR, signal); entry.assign(value); }
      else if (value === null || typeof value === 'boolean') entry.assign(value);
      else throw new Refusal(INVALID);
    }
  }
  return result;
}

/** Refusals contain fixed copy only. Aborted work never becomes a reading result. */
export function readComparisonYaml(text: string, signal?: AbortSignal): ComparisonYamlReadResult {
  signal?.throwIfAborted();
  try {
    if (typeof text !== 'string') throw new Refusal(INVALID);
    checkString(text, COMPARE_MAX_TEXT, signal);
    const tokens = syntax(text, signal); checkSyntax(tokens, signal);
    const composer = new Composer({ version: '1.2', schema: 'core', customTags: [], resolveKnownTags: false, merge: false,
      uniqueKeys: false, stringKeys: false, intAsBigInt: true, strict: true, prettyErrors: false, logLevel: 'silent' });
    const documents = [...composer.compose(tokens, false, text.length)];
    signal?.throwIfAborted();
    if (documents.length !== 1 || documents[0]!.contents === null) throw new Refusal(SINGLE);
    const doc = documents[0]!;
    if (doc.errors.length || doc.warnings.length) throw new Refusal(INVALID);
    return { ok: true, value: plainData(doc.contents, signal) };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return { ok: false, limitation: error instanceof Refusal ? error.limitation : INVALID };
  }
}
