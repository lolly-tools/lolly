// SPDX-License-Identifier: MPL-2.0
/** On-device text transformations with platform services injected by the host. */
import type { TextToolsAPI, TextToolRequest, TextToolResult } from '@lolly-tools/core/host-v1';
import { highlightCode } from './text-syntax.ts';
import { TEXT_OPERATIONS } from './text-operations.ts';
import { textFacts } from './text-facts.ts';
import { analyzeTextSignals } from './text-signals.ts';
import { humanizeText } from './humanize.ts';
import { suggestRewrites } from './reword.ts';
import { inspectPrivateText, replacePrivateSpans } from './prepare-text.ts';
import { compareSources } from './compare.ts';
import { parseTableText, toTsv, toMarkdown, toHtmlTable } from './table-text.ts';
import { textAscii } from './text-ascii.ts';
import { parseTextLogs, filterTextLogs, groupTextLogs } from './text-logs.ts';
import { readYaml, writeYaml, convertStructured, formatCode, compactCode } from './text-formats.ts';
export interface TextToolEnvironment {
  xml?(text: string, schema: string, format: boolean): Promise<string>;
  digest(algorithm: string, bytes: Uint8Array): Promise<Uint8Array>;
  random(length: number): Uint8Array;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encode64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out +=
      B64[(n >>> 18) & 63]! +
      B64[(n >>> 12) & 63]! +
      (i + 1 < bytes.length ? B64[(n >>> 6) & 63] : '=') +
      (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
function decode64(text: string): string {
  const s = text.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(s) ||
    s.replace(/=+$/, '').length % 4 === 1 ||
    (s.includes('=') && s.length % 4 !== 0)
  )
    throw new Error('This is not valid Base64.');
  const body = s.replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0,
    n = 0;
  for (const c of body) {
    n = (n << 6) | B64.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((n >>> bits) & 255);
    }
  }
  if (bits && n & ((1 << bits) - 1)) throw new Error('This Base64 has invalid padding bits.');
  return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
}
const EMOJI = [
  '🍎',
  '🐝',
  '🐱',
  '🐬',
  '🥚',
  '🐸',
  '🍇',
  '🌻',
  '🍦',
  '🤹',
  '🔑',
  '🦁',
  '🌙',
  '🎵',
  '🐙',
  '🍕',
  '👑',
  '🌈',
  '🐍',
  '🌴',
  '☂️',
  '🎻',
  '🍉',
  '❌',
  '🪀',
  '⚡',
  '🌑',
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
];
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae arcu quis lectus consequat posuere. Sed interdum, nibh et cursus finibus, est neque feugiat justo, vitae facilisis lorem sem vitae mi.';
function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`Choose a number from ${min} to ${max}.`);
  return Math.trunc(n);
}
export function createTextToolsAPI(env: TextToolEnvironment): TextToolsAPI {
  return {
    async highlight(text, language, options) {
      return highlightCode(text, language, options);
    },
    async operations() {
      return structuredClone(TEXT_OPERATIONS);
    },
    async run(request) {
      return runTextTool(request, env);
    },
  };
}
export async function runTextTool(
  request: TextToolRequest,
  env: TextToolEnvironment
): Promise<TextToolResult> {
  const { text, operation } = request;
  const o = request.options ?? {};
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 4 * 1024 * 1024)
    throw new Error('Use a text excerpt of 4 MiB or less.');
  const s = (key: string, fallback = ''): string => String(o[key] ?? fallback);
  let out = text,
    format = 'txt';
  const notes: string[] = [];
  let details: Record<string, unknown> | undefined;
  const lines = (): string[] => text.split(/\r\n|\r|\n/);
  const words = (): string[] =>
    text.replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2').match(/[\p{L}\p{N}]+/gu) ?? [];
  switch (operation) {
    case 'identity':
      break;
    case 'upper':
      out = text.toUpperCase();
      break;
    case 'lower':
      out = text.toLowerCase();
      break;
    case 'title':
      out = text.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
      break;
    case 'sentence':
      out = text
        .toLowerCase()
        .replace(/(^|[.!?]\s+)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
      break;
    case 'kebab':
    case 'snake':
      out = words()
        .map((w) => w.toLowerCase())
        .join(operation === 'kebab' ? '-' : '_');
      break;
    case 'pascal':
    case 'camel':
      out = words()
        .map((w, i) =>
          i || operation === 'pascal'
            ? w[0]!.toUpperCase() + w.slice(1).toLowerCase()
            : w.toLowerCase()
        )
        .join('');
      break;
    case 'trim':
      out = lines()
        .map((l) => l.trim())
        .join('\n');
      break;
    case 'blank':
      out = lines()
        .filter((l) => l.trim())
        .join('\n');
      break;
    case 'dedupe':
      out = [...new Set(lines())].join('\n');
      break;
    case 'sort':
      out = lines()
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .join('\n');
      if (s('order') === 'descending') out = out.split('\n').reverse().join('\n');
      break;
    case 'endings':
      out = lines().join(s('style') === 'CRLF' ? '\r\n' : '\n');
      break;
    case 'normalize':
      out = text.normalize(s('form', 'NFC'));
      if (s('form').startsWith('NFK'))
        notes.push(
          'Compatibility normalization can change the appearance and meaning of characters.'
        );
      break;
    case 'replace':
      if (!s('find')) throw new Error('Enter text to find.');
      out = text.split(s('find')).join(s('replacement'));
      break;
    case 'clean': {
      const r = humanizeText(text);
      out = r.text;
      details = { changes: r.changes };
      break;
    }
    case 'reword-rules':
      details = { suggestions: suggestRewrites(text) };
      out = JSON.stringify(details, null, 2);
      format = 'json';
      break;
    case 'inspect': {
      const facts = textFacts(text);
      const signals = analyzeTextSignals(text, { source: 'digital' });
      details = { facts, signals };
      out = `${facts.words} words · ${[...text].length} code points · ${new TextEncoder().encode(text).length} UTF-8 bytes\n${facts.sentences} sentences · ${facts.paragraphs} paragraphs\n\n${signals.summary}\n\n${facts.hidden.map((h) => `${h.name}: ${h.count}`).join('\n')}\n\n${signals.findings.map((f) => f.label).join('\n')}`;
      notes.push('Style signals are observations, not proof of who wrote the text.');
      break;
    }
    case 'redact': {
      const literals = s('literals').split('\n').filter(Boolean);
      const report = inspectPrivateText(
        text,
        literals.map((value, i) => ({
          id: `text-${i}`,
          kind: 'literal',
          value,
          label: 'Custom value',
        }))
      );
      const map: Record<string, string> = {};
      const values = new Map<string, string>();
      out = replacePrivateSpans(
        text,
        report.spans.map((span) => {
          let alias = values.get(span.value);
          if (!alias) {
            alias = `[PRIVATE_${values.size + 1}]`;
            while (text.includes(alias)) alias = `[${alias}]`;
            values.set(span.value, alias);
            map[alias] = span.value;
          }
          return { span, replacement: alias };
        })
      );
      details = { aliases: map, findings: report.spans };
      notes.push(
        'Review suggestions before replacing. The alias map contains the original private values.'
      );
      if (report.truncated) notes.push('The finding limit was reached. Review the remaining text.');
      break;
    }
    case 'restore': {
      const map: unknown = JSON.parse(s('map'));
      if (!map || typeof map !== 'object' || Array.isArray(map))
        throw new Error('Use an alias map object.');
      const entries = Object.entries(map);
      if (entries.some(([k, v]) => !k || typeof v !== 'string'))
        throw new Error('Alias names and values must be text.');
      const keys = entries.map(([k]) => k).sort((a, b) => b.length - a.length);
      const pattern = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      out = pattern
        ? text.replace(new RegExp(pattern, 'g'), (key) =>
            String((map as Record<string, unknown>)[key])
          )
        : text;
      break;
    }
    case 'logs': {
      const report = parseTextLogs(text);
      const visible = filterTextLogs(report.events, {
        query: s('query'),
        exact: s('match') === 'exact',
        severity: s('severity'),
        source: s('source'),
        from: s('from'),
        until: s('until'),
      });
      const groups = groupTextLogs(visible);
      details = { ...report, visible, groups };
      out = visible.map((e) => e.raw).join('');
      notes.push(
        `${visible.length} of ${report.events.length} events. Unclassified lines are retained.`
      );
      if (s('from') || s('until'))
        notes.push('Time filters omit events without a complete date and timestamp.');
      break;
    }
    case 'regex': {
      if (!s('pattern')) throw new Error('Enter a regular expression.');
      const flags = s('flags', 'gu');
      const re = new RegExp(s('pattern'), flags.includes('g') ? flags : flags + 'g');
      const matches: unknown[] = [];
      for (const m of text.matchAll(re)) {
        matches.push({ at: m.index, text: m[0], groups: m.groups ?? m.slice(1) });
        if (matches.length >= 10000) {
          notes.push('Showing the first 10,000 matches.');
          break;
        }
      }
      const replacing = s('mode') === 'replace' || (!s('mode') && !!s('replacement'));
      details = { matches, source: text, replacing };
      out = replacing ? text.replace(re, s('replacement')) : JSON.stringify(matches, null, 2);
      format = replacing ? 'txt' : 'json';
      break;
    }
    case 'diff': {
      const result = compareSources({
        version: 1,
        before: {
          identity: { id: 'before', label: 'Text', kind: 'text' },
          content: { kind: 'text', text },
        },
        after: {
          identity: { id: 'after', label: 'Compared text', kind: 'text' },
          content: { kind: 'text', text: s('after') },
        },
        options: { granularity: s('granularity') === 'word' ? 'word' : 'line' },
      });
      details = { comparison: result };
      out = JSON.stringify(result, null, 2);
      notes.push(...result.limitations);
      format = 'json';
      break;
    }
    case 'schema': {
      const { default: Ajv } = await import('ajv');
      const ajv = new Ajv({ allErrors: true, strict: true, validateFormats: false });
      const validate = ajv.compile(JSON.parse(s('schema')));
      const valid = validate(JSON.parse(text));
      out = valid ? 'Valid against this schema.' : JSON.stringify(validate.errors, null, 2);
      notes.push(
        'JSON Schema draft-07. External references are not fetched. Format annotations are not validated.'
      );
      details = { valid, errors: validate.errors };
      break;
    }
    case 'jwt': {
      const parts = text.trim().split('.');
      if (parts.length !== 3) throw new Error('A JWT has three dot-separated parts.');
      const header: unknown = JSON.parse(decode64(parts[0]!));
      const payload: unknown = JSON.parse(decode64(parts[1]!));
      out = JSON.stringify({ header, payload }, null, 2);
      format = 'json';
      notes.push('Decoded only. The signature and claims have not been verified.');
      break;
    }
    case 'hash':
      out = [...(await env.digest(s('algorithm', 'SHA-256'), new TextEncoder().encode(text)))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (s('expected')) {
        const matches = out.toLowerCase() === s('expected').trim().toLowerCase();
        notes.push(matches ? 'Checksum matches.' : 'Checksum does not match.');
        details = { matches };
      }
      break;
    case 'json':
      out = JSON.stringify(JSON.parse(text), null, s('style') === 'compact' ? undefined : 2);
      format = 'json';
      break;
    case 'yaml':
      out = writeYaml(readYaml(text));
      format = 'yaml';
      notes.push('Formatting keeps values; comments and anchors may be rewritten.');
      break;
    case 'helm': {
      const directive = /\{\{-?[\s\S]*?-?\}\}/g;
      const paths = [
        ...new Set(
          [...text.matchAll(directive)].flatMap((m) =>
            [
              ...m[0].matchAll(
                /\.(Values|Release|Chart|Capabilities|Files|Template)((?:\.[A-Za-z0-9_]+)*)/g
              ),
            ].map((r) => '.' + r[1] + r[2])
          )
        ),
      ].sort();
      if (s('mode') === 'lint') {
        const neutral = text
          .split(/\r\n|\r|\n/)
          .map((line) =>
            line.replace(directive, '').trim() ? line.replace(directive, '__helmval__') : ''
          )
          .join('\n');
        readYaml(neutral);
        out = 'YAML structure is valid after masking template directives.';
      } else out = paths.join('\n');
      details = { paths };
      notes.push(
        'Static template inspection. Go templates, chart schemas and Kubernetes resources are not evaluated.'
      );
      break;
    }
    case 'structured':
      out = await convertStructured(text, s('from', 'json'), s('to', 'yaml'));
      format = s('to', 'yaml');
      notes.push(
        'Conversion preserves supported values; comments, anchors, and source formatting do not carry across formats.'
      );
      break;
    case 'format':
      out =
        s('style') === 'compact'
          ? await compactCode(text, s('language', 'javascript'))
          : await formatCode(text, s('language', 'javascript'));
      if (s('style') === 'compact')
        notes.push('Review before applying. Comments and source formatting may change.');
      format =
        ({ javascript: 'js', typescript: 'ts', markdown: 'md' } as Record<string, string>)[
          s('language')
        ] ?? s('language', 'js');
      break;
    case 'xml':
      if (!env.xml) throw new Error('XML support is unavailable in this shell.');
      out = await env.xml(text, s('schema'), s('mode') === 'format');
      format = s('mode') === 'format' ? 'xml' : 'txt';
      notes.push('Single-document XML and XSD 1.0. External resources are not loaded.');
      break;
    case 'base64-encode':
      out = encode64(text);
      if (s('alphabet') === 'url-safe')
        out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      break;
    case 'base64-decode':
      out = decode64(text);
      break;
    case 'url-encode':
      out = encodeURIComponent(text);
      break;
    case 'url-decode':
      out = decodeURIComponent(text);
      break;
    case 'html-escape':
      out = text.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
      );
      break;
    case 'html-unescape':
      out = text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (raw, v: string) => {
        const names: Record<string, string> = {
          amp: '&',
          lt: '<',
          gt: '>',
          quot: '"',
          apos: "'",
          nbsp: '\u00a0',
        };
        if (names[v]) return names[v];
        if (!v.startsWith('#')) return raw;
        const n =
          v[1]!.toLowerCase() === 'x' ? Number.parseInt(v.slice(2), 16) : Number(v.slice(1));
        return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : raw;
      });
      notes.push('Decodes numeric and basic HTML entities. Other named entities are retained.');
      break;
    case 'table': {
      const value = parseTableText(text);
      if (!value) throw new Error('Paste CSV, TSV or a Markdown table.');
      const target = s('format', 'markdown');
      out =
        target === 'html'
          ? toHtmlTable(value)
          : target === 'tsv'
            ? toTsv(value)
            : toMarkdown(value);
      format = target === 'markdown' ? 'md' : target;
      break;
    }
    case 'rot13':
      out = text.replace(/[a-z]/gi, (c) =>
        String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() <= 'm' ? 13 : -13))
      );
      break;
    case 'qwerty': {
      const q = 'qwertyuiopasdfghjklzxcvbnm';
      const from = s('direction') === 'decode' ? q : ALPHABET;
      const to = from === q ? ALPHABET : q;
      out = text.replace(/[a-z]/gi, (c) => {
        const v = to[from.indexOf(c.toLowerCase())]!;
        return c === c.toUpperCase() ? v.toUpperCase() : v;
      });
      break;
    }
    case 'emoji-cipher': {
      if (s('direction') === 'decode') {
        out = text;
        EMOJI.forEach((e, i) => {
          out = out.split(e).join((ALPHABET + '0123456789')[i]!);
        });
      } else
        out = text.replace(
          /[a-z0-9]/gi,
          (c) => EMOJI[(ALPHABET + '0123456789').indexOf(c.toLowerCase())]!
        );
      notes.push('A novelty cipher, not encryption. Emoji encoding does not preserve letter case.');
      break;
    }
    case 'ascii':
      out = textAscii(text, {
        style: s('style'),
        ink: s('ink', '#'),
        spacing: bounded(o.spacing, 1, 0, 8),
        width: bounded(o.width, 0, 0, 500),
        align: s('align'),
      });
      notes.push(
        'This original alphabet renders letters in uppercase. Copy preserves spaces and line breaks.'
      );
      break;
    case 'lorem':
      out = Array.from({ length: bounded(o.paragraphs, 3, 1, 100) }, () => LOREM).join('\n\n');
      break;
    case 'uuid':
      out = Array.from({ length: bounded(o.count, 1, 1, 1000) }, () => {
        const b = env.random(16);
        b[6] = (b[6]! & 15) | 64;
        b[8] = (b[8]! & 63) | 128;
        const h = [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
      }).join('\n');
      break;
    case 'random': {
      const alphabet = [
        ...new Set([...s('alphabet', ALPHABET + ALPHABET.toUpperCase() + '0123456789')]),
      ];
      if (!alphabet.length || alphabet.length > 256)
        throw new Error('Choose 1 to 256 different characters.');
      const length = bounded(o.length, 32, 1, 10000);
      const limit = 256 - (256 % alphabet.length);
      out = '';
      while ([...out].length < length) {
        for (const b of env.random(Math.min(20000, length * 2))) {
          if (b < limit) out += alphabet[b % alphabet.length];
          if ([...out].length === length) break;
        }
      }
      break;
    }
    case 'timestamp': {
      const input = text.trim();
      const date = /^-?\d+(?:\.\d+)?$/.test(input)
        ? new Date(Number(input) * (s('unit') === 'milliseconds' ? 1 : 1000))
        : new Date(input);
      if (!Number.isFinite(date.getTime()))
        throw new Error('Enter an ISO date or a numeric timestamp.');
      out = `${date.toISOString()}\n${date.getTime()} milliseconds\n${date.getTime() / 1000} seconds`;
      break;
    }
    default:
      throw new Error(`Unknown text action: ${operation}`);
  }
  return { text: out, format, notes, ...(details ? { details } : {}) };
}
