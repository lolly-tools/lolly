// SPDX-License-Identifier: MPL-2.0
/**
 * A tiny, escape-first markdown renderer for Ask answers (plans/103 M0).
 *
 * Answers are VERBATIM documentation sections (chunks.ts), so the renderer's job
 * is to present trusted first-party prose safely, not to be a full markdown
 * engine. Everything is escaped first; then a fixed subset is re-admitted:
 * paragraphs, bullet/numbered lists, fenced code, simple tables, blockquotes,
 * and inline code/bold/italic. Links render as anchors ONLY to same-origin /info
 * docs or in-app targets; an external http(s) link renders as plain text (the
 * trust ethos - the Ask panel never becomes an outbound link farm), and images
 * are dropped (a docs screenshot is a build-time capture recipe, useless here).
 *
 * Pure and Node-testable - the only import is utils.escape.
 */
import { escape } from '../../utils.ts';

/** Escaped inline markup: links (in-app only), inline code, bold, italic. */
function inline(s: string): string {
  // Drop images before escaping so their alt/url never leak as text.
  let x = escape(s.replace(/!\[[^\]]*\]\([^)]*\)/g, ''));
  // Links: escape() left [ ] ( ) literal, so match on the escaped string. An
  // in-app or /info target becomes an anchor; an external URL becomes its text.
  x = x.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt: string, url: string) => {
    const u = url.trim();
    if (/^https?:(\/|&#x2f;)/i.test(u)) return txt; // external → text only
    if (/^(\/info\/|#|\/t\/|\/)/.test(u)) return `<a href="${u}">${txt}</a>`;
    return txt; // anything else (mailto, protocol-relative, …) → text
  });
  x = x.replace(/`([^`]+)`/g, '<code>$1</code>');
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return x;
}

/** Does a trimmed line begin a non-paragraph block? (stops paragraph runs). */
function isBlockStart(t: string): boolean {
  return (
    t.startsWith('```') || t.startsWith('~~~') || t.startsWith('|') ||
    t.startsWith('>') || t.startsWith('#') ||
    /^[-*+]\s+/.test(t) || /^\d+\.\s+/.test(t)
  );
}

/** A pipe-table (with a `|---|` separator row dropped) → a scrollable table. */
function renderTable(rows: string[]): string {
  const cells = (line: string): string[] => {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  const isSep = (line: string): boolean => /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-');
  const body = rows.filter((r) => !isSep(r));
  if (!body.length) return '';
  const [head, ...rest] = body;
  const th = cells(head!).map((c) => `<th>${inline(c)}</th>`).join('');
  const trs = rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="ask-table-wrap"><table class="ask-table"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

/** Render a verbatim markdown section to safe HTML. */
export function renderAnswerMd(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  const blank = (s: string): boolean => !s.trim();

  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (blank(t)) { i++; continue; }

    // Fenced code - verbatim, escaped, no inline processing.
    if (t.startsWith('```') || t.startsWith('~~~')) {
      const fence = t.slice(0, 3);
      i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i]!.trim().startsWith(fence)) { code.push(lines[i]!); i++; }
      i++; // closing fence (or EOF)
      out.push(`<pre class="ask-code"><code>${escape(code.join('\n'))}</code></pre>`);
      continue;
    }

    // A leftover heading (h5/h6, or a deeper one inside a section) → strong line.
    const h = /^#{1,6}\s+(.*)$/.exec(t);
    if (h) { out.push(`<p class="ask-h"><strong>${inline(h[1]!.trim())}</strong></p>`); i++; continue; }

    // Pipe table.
    if (t.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) { rows.push(lines[i]!.trim()); i++; }
      const table = renderTable(rows);
      if (table) out.push(table);
      continue;
    }

    // Blockquote.
    if (t.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) { quote.push(lines[i]!.trim().replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // List - bullet or numbered (no nesting; docs sections are shallow).
    const ul = /^[-*+]\s+/.test(t);
    const ol = /^\d+\.\s+/.test(t);
    if (ul || ol) {
      const items: string[] = [];
      while (i < lines.length) {
        const lt = lines[i]!.trim();
        if (ul && /^[-*+]\s+/.test(lt)) items.push(lt.replace(/^[-*+]\s+/, ''));
        else if (ol && /^\d+\.\s+/.test(lt)) items.push(lt.replace(/^\d+\.\s+/, ''));
        else break;
        i++;
      }
      const tag = ol ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // Paragraph - gather to the next blank line or block start.
    const para: string[] = [];
    while (i < lines.length && !blank(lines[i]!) && !isBlockStart(lines[i]!.trim())) { para.push(lines[i]!.trim()); i++; }
    const text = para.join(' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
    if (text) out.push(`<p>${inline(text)}</p>`);
  }

  return out.join('\n');
}
