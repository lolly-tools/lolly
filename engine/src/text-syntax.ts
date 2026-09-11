// SPDX-License-Identifier: MPL-2.0
/** Shared lexical highlighting. Token markup never evaluates the source. */
export interface SyntaxOptions {
  calloutMode?: string;
  calloutPrefixes?: string[];
}
export interface SyntaxResult {
  html: string;
  language: string;
  truncated: boolean;
}
const KW: Record<string, string> = {
  javascript:
    'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|import|export|default|from|async|await|try|catch|finally|throw|this|super|true|false|null|undefined|void|yield|static',
  typescript:
    'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|import|export|default|from|async|await|try|catch|finally|throw|this|super|true|false|null|undefined|void|yield|static|type|interface|enum|implements|abstract|readonly|private|public|protected|namespace|declare|as|keyof|infer|never|unknown|any|string|number|boolean|object',
  python:
    'def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|pass|break|continue|True|False|None|del|assert|is|self|print',
  rust: 'fn|let|mut|const|struct|enum|impl|trait|use|mod|pub|return|if|else|match|for|while|loop|break|continue|in|where|type|async|await|move|ref|self|Self|super|crate|true|false',
  go: 'func|var|const|type|struct|interface|return|if|else|for|range|switch|case|break|continue|default|import|package|go|chan|select|defer|fallthrough|map|make|new|nil|true|false|iota',
  css: 'important|media|keyframes|charset|import|supports|root|hover|focus|active|before|after|not|nth-child|first-child|last-child',
  bash: 'if|then|else|elif|fi|for|do|done|while|case|esac|in|function|return|exit|echo|export|local|source|readonly|set|unset|true|false',
  dockerfile:
    'FROM|AS|RUN|CMD|LABEL|MAINTAINER|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL',
  json: '',
  html: '',
  plain: '',
};
export const SYNTAX_LANGUAGES = [...Object.keys(KW), 'yaml', 'toml', 'sql', 'xml'];
export function detectCodeLanguage(code: string): string {
  if (/^\s*FROM\s+\S+/m.test(code)) return 'dockerfile';
  if (/^\s*<(!DOCTYPE|html)/i.test(code)) return 'html';
  if (/^\s*[{[]/.test(code)) {
    try {
      JSON.parse(code);
      return 'json';
    } catch {
      /* Continue with lexical hints. */
    }
  }
  if (/\bdef \w+\(|^from \w+ import|\bprint\(/m.test(code)) return 'python';
  if (/\bfn \w+\(|\blet mut\b|\bimpl\b|\buse std::/m.test(code)) return 'rust';
  if (/\bfunc \w+\(|\bpackage \w|\bfmt\.\w/m.test(code)) return 'go';
  if (/^#!.*(?:bash|sh)|^\s*(?:echo|export)\s/m.test(code)) return 'bash';
  if (/^\s*(?:SELECT|CREATE TABLE|INSERT INTO)\s/im.test(code)) return 'sql';
  if (/\{[^}]*:\s*[^;]+;/.test(code) && !code.includes('function')) return 'css';
  if (/\binterface\s+\w|\btype\s+\w+\s*=/.test(code)) return 'typescript';
  if (/\b(?:const|let|function|import)\s|=>/.test(code)) return 'javascript';
  if (/^[\w.-]+\s*=\s*\S/m.test(code)) return 'toml';
  if (/^[\w.-]+:\s+\S/m.test(code)) return 'yaml';
  return 'plain';
}
export function escapeCode(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
}
function callout(raw: string, opts: SyntaxOptions): string | null {
  if (!opts.calloutMode || opts.calloutMode === 'off') return null;
  const text = raw.replace(/^(?:\/\/|#)\s*/, '');
  const matches =
    opts.calloutMode === 'all' ||
    (opts.calloutMode === 'tags' &&
      /^(TODO|FIXME|FIX|NOTE|HACK|XXX|BUG|WIP|WARNING|WARN|OPTIMIZE|REVIEW|DEPRECATED)\b/i.test(
        text
      )) ||
    (opts.calloutMode === 'custom' &&
      opts.calloutPrefixes?.some((p) => text.toLowerCase().startsWith(p.toLowerCase())));
  if (!matches) return null;
  const html = escapeCode(text)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])__([^_]+?)__(?![\w])/g, '$1<strong>$2</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w*])_([^_]+?)_(?![\w])/g, '$1<em>$2</em>');
  return `<span class="cc-callout"><span class="cc-callout-arrow">←</span><span class="cc-callout-text">${html}</span></span>`;
}
export function highlightCode(
  source: string,
  language = 'auto',
  opts: SyntaxOptions = {}
): SyntaxResult {
  const lang = language === 'auto' ? detectCodeLanguage(source) : language;
  if (lang === 'plain' || !SYNTAX_LANGUAGES.includes(lang))
    return { html: escapeCode(source), language: 'plain', truncated: false };
  const end = Math.min(source.length, 80000),
    parts: string[] = [];
  const keywords = new Set(
    (
      KW[lang] ??
      (lang === 'sql'
        ? 'SELECT|FROM|WHERE|AS|JOIN|ON|AND|OR|NOT|NULL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ORDER|BY|GROUP|LIMIT'
        : 'true|false|null')
    ).split('|')
  );
  const emit = (start: number, stop: number, token?: string): void => {
    const value = escapeCode(source.slice(start, stop));
    parts.push(token ? `<span class="tok-${token}">${value}</span>` : value);
  };
  let i = 0;
  while (i < end) {
    const start = i,
      c = source[i]!;
    const lineComment =
      (c === '/' &&
        source[i + 1] === '/' &&
        source[i - 1] !== ':' &&
        !['css', 'json'].includes(lang)) ||
      (c === '#' && ['python', 'bash', 'dockerfile', 'yaml', 'toml'].includes(lang)) ||
      (c === '-' && source[i + 1] === '-' && lang === 'sql');
    if (lineComment) {
      i = source.indexOf('\n', i);
      if (i < 0) i = source.length;
      const before = source.slice(source.lastIndexOf('\n', start - 1) + 1, start);
      const special = before.trim() ? callout(source.slice(start, i), opts) : null;
      if (special) parts.push(special);
      else emit(start, i, 'comment');
      continue;
    }
    if (
      source.startsWith('/*', i) ||
      (['html', 'xml'].includes(lang) && source.startsWith('<!--', i))
    ) {
      const close = source.startsWith('<!--', i) ? '-->' : '*/';
      const at = source.indexOf(close, i + 2);
      i = at < 0 ? source.length : at + close.length;
      emit(start, i, 'comment');
      continue;
    }
    if ('\'"`'.includes(c)) {
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i++] === c) break;
      }
      i = Math.min(i, source.length);
      emit(start, i, 'string');
      continue;
    }
    if ((lang === 'html' || lang === 'xml') && c === '<') {
      const at = source.indexOf('>', i + 1);
      i = at < 0 ? source.length : at + 1;
      emit(start, i, 'keyword');
      continue;
    }
    if (/\d/.test(c) && !/[\w$]/.test(source[i - 1] ?? '')) {
      i++;
      while (i < source.length && /[\w.]/.test(source[i]!)) i++;
      emit(start, i, 'number');
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      i++;
      while (i < source.length && /[\w$-]/.test(source[i]!)) i++;
      const word = source.slice(start, i);
      let after = i;
      while (/\s/.test(source[after] ?? '') && after < source.length) after++;
      emit(
        start,
        i,
        keywords.has(word) || (lang === 'sql' && keywords.has(word.toUpperCase()))
          ? 'keyword'
          : source[after] === '('
            ? 'function'
            : /^[A-Z][a-zA-Z]+$/.test(word)
              ? 'type'
              : undefined
      );
      continue;
    }
    i++;
    emit(start, i, /[+*=!<>|&?:%-]/.test(c) ? 'operator' : undefined);
  }
  if (i < source.length) parts.push(escapeCode(source.slice(i)));
  return { html: parts.join(''), language: lang, truncated: end < source.length };
}
