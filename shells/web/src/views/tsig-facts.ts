// SPDX-License-Identifier: MPL-2.0
/**
 * The "Document facts" section - the neutral census (engine text-facts.ts)
 * rendered for the verify and catalog text panels. One builder for both, so
 * the interrogation surface reads identically wherever a text is inspected.
 *
 * Two registers, deliberately separate:
 *  - SEVERE hidden characters (bidi overrides, tag characters, private-use
 *    glyphs) render as an always-visible warning line ABOVE the collapsible -
 *    a census must never flatten danger into inventory. The score keeps the
 *    judgement; severity still reads as severity.
 *  - everything else is quiet rows inside a native <details>: structure,
 *    scripts, link hosts (never fetched), typography, line endings. Facts a
 *    reader can interrogate offline and verify against the bytes; empty rows
 *    are simply absent. Opens itself only when a severe character exists.
 *
 * Every value is escape()d; no user text reaches markup unescaped. Styled by
 * `.tsig-facts*` in styles/parts/valid.css (parts load globally, so the
 * catalog uses the same classes).
 */
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import type { TextFacts } from '@lolly/engine';

const chip = (name: string, count: number, severe: boolean): string =>
  `<span class="tsig-facts-chip${severe ? ' tsig-facts-chip--severe' : ''}">${escape(name)}${count > 1 ? ` ×${count}` : ''}</span>`;

export function tsigFactsHtml(facts: TextFacts): string {
  const severe = facts.hidden.filter((h) => h.severity === 'severe');
  const note = facts.hidden.filter((h) => h.severity === 'note');

  const warning = severe.length
    ? `<p class="tsig-facts-warn guide-warn">${escape(t('This text contains characters that can disguise, reorder or smuggle content past a reader:'))} ${severe.map((h) => chip(h.name, h.count, true)).join(' ')}</p>`
    : '';

  const rows: string[] = [];
  const row = (label: string, value: string): void => {
    rows.push(`<div class="tsig-facts-row"><dt>${escape(label)}</dt><dd>${value}</dd></div>`);
  };

  row(t('Structure'), escape(tRaw('{w} words · {s} sentences · {p} paragraphs', { w: facts.words, s: facts.sentences, p: facts.paragraphs })
    + (facts.bulletLines ? ` · ${tRaw('{n} list lines', { n: facts.bulletLines })}` : '')));
  if (facts.scripts.length) {
    row(t('Scripts'), escape(facts.scripts.map((s) => `${s.script} ${s.pct}%`).join(' · ')));
  }
  if (note.length) {
    row(t('Hidden characters'), note.map((h) => chip(h.name, h.count, false)).join(' '));
  }
  if (facts.linkHosts.length) {
    row(t('Links point to'), escape(facts.linkHosts.map((l) => l.count > 1 ? `${l.host} ×${l.count}` : l.host).join(' · ')));
  }
  const p = facts.punctuation;
  if (p.emDash || p.curlyQuotes || p.ellipsisChar) {
    const bits: string[] = [];
    if (p.emDash) bits.push(tRaw('{n} em-dashes', { n: p.emDash }));
    if (p.curlyQuotes) bits.push(tRaw('{n} curly quotes', { n: p.curlyQuotes }));
    if (p.ellipsisChar) bits.push(tRaw('{n} ellipsis characters', { n: p.ellipsisChar }));
    row(t('Typography'), escape(bits.join(' · ')));
  }
  // Line endings earn a row only when they say something: a CRLF/LF mix inside
  // one document is a splice trail; pure CRLF names a Windows-side journey.
  if (facts.lineEndings.crlf > 0) {
    row(t('Line endings'), escape(facts.lineEndings.lf > 0
      ? tRaw('mixed - {crlf} CRLF and {lf} LF', { crlf: facts.lineEndings.crlf, lf: facts.lineEndings.lf })
      : `CRLF (${t('Windows-style')})`));
  }
  if (facts.bom) row(t('Byte-order mark'), escape(t('present at the start of the text')));

  return `${warning}
    <details class="tsig-facts"${severe.length ? ' open' : ''}>
      <summary>${escape(t('Document facts'))}</summary>
      <dl class="tsig-facts-list">${rows.join('')}</dl>
      <p class="tsig-facts-cap">${escape(t('Counts, not verdicts: everything here can be checked against the bytes on this device. Nothing was fetched.'))}</p>
    </details>`;
}
