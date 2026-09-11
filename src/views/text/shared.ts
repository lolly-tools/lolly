// SPDX-License-Identifier: MPL-2.0
import type { TextOperation } from '@lolly-tools/core/host-v1';
import { icon, type IconName } from '../../lib/icons.ts';
import { detectCodeLanguage } from '../../../../../engine/src/text-syntax.ts';
import { fold, tokenize, scoreHaystack } from '../../lib/search/match.ts';

export const ACTION_HELP: Record<string, string> = {
  upper: 'Make every letter uppercase.',
  lower: 'Make every letter lowercase.',
  title: 'Capitalise the start of each word.',
  sentence: 'Capitalise the start of each sentence.',
  kebab: 'Turn words into a URL-friendly slug.',
  snake: 'Join lowercase words with underscores.',
  pascal: 'Join words with a capital at each word.',
  camel: 'Join words, starting with a lowercase letter.',
  trim: 'Remove extra spaces at the start and end of lines.',
  blank: 'Remove blank lines.',
  dedupe: 'Keep one copy of each repeated line.',
  sort: 'Put lines in alphabetical order.',
  endings: 'Switch between Unix and Windows line endings.',
  normalize: 'Use a consistent Unicode representation.',
  replace: 'Find a word or phrase and replace it.',
  clean: 'Clean up punctuation, spacing and hidden characters.',
  inspect: 'Count words, inspect hidden characters and review text signals.',
  'reword-rules': 'Find phrases that could be written more simply.',
  redact: 'Replace emails, identifiers and private details with aliases.',
  restore: 'Restore text using a saved alias map.',
  logs: 'Find errors, search events and inspect the original log lines.',
  regex: 'Find pattern matches, inspect capture groups or replace matches.',
  diff: 'See what changed between two versions of text.',
  schema: 'Check JSON against a schema you provide.',
  jwt: 'Read a token’s header and payload. Does not verify its signature.',
  hash: 'Calculate or compare a text checksum.',
  json: 'Make JSON readable or compact.',
  yaml: 'Format YAML and check its structure.',
  helm: 'Inspect values or common issues without running templates.',
  structured: 'Convert structured data between JSON, YAML and TOML.',
  format: 'Format JavaScript, TypeScript, CSS, HTML, Markdown or SQL.',
  xml: 'Check XML syntax or validate it against an XSD schema.',
  'base64-encode': 'Encode text as Base64.',
  'base64-decode': 'Read text encoded as Base64.',
  'url-encode': 'Escape text for a URL component.',
  'url-decode': 'Read percent-encoded text.',
  'html-escape': 'Turn special characters into HTML entities.',
  'html-unescape': 'Read common HTML entities as characters.',
  table: 'Turn CSV or tab-separated rows into a table.',
  rot13: 'Apply the reversible ROT13 letter substitution.',
  qwerty: 'Encode or decode a keyboard substitution cipher.',
  'emoji-cipher': 'Encode or decode a playful emoji substitution.',
  ascii: 'Turn a short phrase into copyable ASCII lettering.',
  lorem: 'Generate placeholder paragraphs for a layout.',
  uuid: 'Generate unique identifiers.',
  random: 'Generate a random string of characters.',
  timestamp: 'Read a Unix timestamp or convert a date.',
  'ai-synopsis': 'Use local AI to select key excerpts with source references.',
  'ai-rewrite': 'Suggest a rewrite using the local AI model.',
  'prepare-sharing': 'Review and remove private details before sharing.',
  'preview-markdown': 'Read formatted Markdown before downloading it.',
};
export const ACTION_NAMES: Record<string, string> = {
  redact: 'De-identify text',
  ascii: 'Create ASCII art',
  'ai-synopsis': 'AI synopsis',
  format: 'Format code',
  regex: 'Find with a regular expression',
};
export const actionName = (operation: TextOperation): string =>
  ACTION_NAMES[operation.id] ?? operation.label;
export const actionHelp = (operation: TextOperation): string =>
  ACTION_HELP[operation.id] ?? operation.label;
export const needsText = (operation: TextOperation): boolean =>
  !['ascii', 'lorem', 'uuid', 'random'].includes(operation.id);
export function suggestedActions(text: string, language = 'auto', filename = ''): string[] {
  if (!text.trim()) return ['ascii', 'lorem', 'uuid'];
  if (
    /\.(log|jsonl|ndjson)$/i.test(filename) ||
    /^(?:\d{4}-\d\d-\d\d.*(?:INFO|WARN|ERROR)|\{.*"(?:level|PRIORITY)")/m.test(text)
  )
    return ['logs', 'redact', 'inspect'];
  const kind = language === 'auto' ? detectCodeLanguage(text) : language;
  if (kind === 'json') return ['json', 'structured', 'schema'];
  if (kind === 'yaml' || kind === 'toml')
    return kind === 'yaml' ? ['yaml', 'structured', 'diff'] : ['structured', 'diff', 'inspect'];
  if (['javascript', 'typescript', 'css', 'html', 'sql'].includes(kind))
    return ['format', 'diff', 'inspect'];
  if (kind === 'xml') return ['xml', 'diff', 'inspect'];
  if (/^#{1,6}\s|\*\*|^[-*]\s/m.test(text)) return ['preview-markdown', 'clean', 'ai-synopsis'];
  return ['clean', 'replace', 'ai-synopsis'];
}
export function findActions(
  operations: TextOperation[],
  query: string,
  preferred: string[] = []
): TextOperation[] {
  const words = tokenize(query);
  return operations
    .map((operation) => {
      const aliases =
        (
          {
            upper: 'upper case capitals capital letters',
            lower: 'lower case',
            trim: 'remove spaces whitespace tidy',
            clean: 'cleanup clean up remove spaces typography',
            'ai-synopsis': 'summarize summarise summary summarize text',
            ascii: 'text art banner big letters',
            logs: 'system logs error warnings troubleshoot',
            redact: 'anonymize anonymise redact sensitive private remove email',
          } as Record<string, string>
        )[operation.id] ?? '';
      const score = words.length
        ? scoreHaystack(
            [
              { text: fold(`${actionName(operation)} ${operation.id} ${aliases}`), weight: 4 },
              { text: fold(`${actionHelp(operation)} ${operation.keywords.join(' ')}`), weight: 1 },
            ],
            words
          )
        : 1;
      return {
        operation,
        score:
          score +
          (words.length
            ? 0
            : preferred.includes(operation.id)
              ? preferred.length - preferred.indexOf(operation.id)
              : 0),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.operation);
}
export const SAMPLE_TEXT: Record<string, string> = {
  writing:
    'Good writing starts with a clear idea.\n\nSelect a sentence to transform just that part, or work on the whole document. You can clean up punctuation, compare versions, or ask local AI to select key excerpts.',
  json: '{"name":"Lolly","purpose":"Create on-brand","features":["text","characters","code"],"onDevice":true}',
  logs: '2026-09-11T10:00:00Z INFO app Service ready\n2026-09-11T10:01:00Z ERROR app Connection refused\n2026-09-11T10:01:02Z ERROR app Connection refused\n2026-09-11T10:02:00Z WARN app Retrying connection\n2026-09-11T10:02:04Z INFO app Connection restored\n',
};
export const RESULT_NAMES: Record<string, string> = {
  json: 'Formatted JSON',
  yaml: 'Formatted YAML',
  format: 'Formatted code',
  ascii: 'ASCII art',
  logs: 'Log analysis',
  inspect: 'Text inspection',
  diff: 'Text comparison',
  redact: 'De-identified text',
  synopsis: 'AI synopsis',
  rewrite: 'AI rewrite',
  'explain-logs': 'Log synopsis',
  regex: 'Pattern matches',
  'reword-rules': 'Writing suggestions',
  schema: 'Schema validation',
  xml: 'XML validation',
};

export function actionIcon(operation: Pick<TextOperation, 'id' | 'group'>): string {
  const names: Record<string, IconName> = {
    upper: 'font',
    lower: 'font',
    title: 'font',
    sentence: 'font',
    ascii: 'font',
    logs: 'checklist',
    inspect: 'search',
    clean: 'paintbrush',
    replace: 'repeat',
    diff: 'arrowsH',
    json: 'code',
    yaml: 'code',
    format: 'code',
    structured: 'convert',
    schema: 'shieldCheck',
    xml: 'code',
    redact: 'shield',
    restore: 'undo',
    regex: 'search',
    hash: 'hash',
    uuid: 'hash',
    random: 'sparkle',
    timestamp: 'clock',
    table: 'table',
    sort: 'sortDir',
    dedupe: 'duplicate',
    'ai-synopsis': 'aiSpark',
    'ai-rewrite': 'aiSpark',
    'preview-markdown': 'eye',
    'prepare-sharing': 'shield',
  };
  return icon(
    names[operation.id] ??
      ({ Edit: 'pen', Inspect: 'search', Convert: 'convert', Generate: 'plus' } as const)[
        operation.group
      ],
    { className: 'text-icon' }
  );
}
