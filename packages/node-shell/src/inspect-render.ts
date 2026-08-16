// SPDX-License-Identifier: MPL-2.0
/**
 * The terminal rendering of an {@link Inspection}. Shared by the CLI, the TUI, and
 * anything else that shows this report to a person.
 *
 * Two rules govern every line below.
 *
 * **Everything printed here is attacker-controlled.** Titles, author names, font names,
 * XMP fields, and the hidden text itself all come from the file being examined, and the
 * file may have been crafted to make the report say something else. So every
 * interpolated value goes through `clean()`, which strips C0/C1 control characters
 * including ESC. This stops a crafted document from emitting ANSI sequences that repaint
 * or erase verdict lines in the tool meant to be trustworthy about them. This is the same
 * discipline as `shells/cli/src/validate.ts`, applied to a much larger attack surface:
 * that file prints a handful of claim fields, this one prints page text.
 *
 * **The wording is the product.** A user decides whether to send a file based on these
 * sentences. So: hidden text is described as "present in the file, not visible on the
 * page", never as an accusation. Limits are printed, not hidden, and the report always
 * ends by saying what it did not check.
 */

import type { Inspection } from './inspect.ts';

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', YELLOW = '\x1b[33m', RESET = '\x1b[0m';

export interface RenderOptions {
  /** ANSI colour. Callers pass their own TTY + NO_COLOR decision. */
  color?: boolean;
  /** Print the extracted document text (only present when inspected with `text: true`). */
  showText?: boolean;
  /** Characters of hidden text quoted back per finding. 0 prints the count only. */
  quote?: number;
  /**
   * Print the `path · size · format` heading. `lolly validate` turns it off because it
   * has already printed its own headline for the same file, and two headings for one
   * file read as two files.
   */
  heading?: boolean;
}

/**
 * Strip control characters from anything that came out of the inspected file.
 * Applied to EVERY interpolated value below without exception.
 */
export const clean = (v: unknown): string =>
  String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');

const DEFAULT_QUOTE = 80;

export function renderInspection(r: Inspection, opts: RenderOptions = {}): string {
  const c = opts.color !== false;
  const paint = (code: string, s: string): string => (c ? code + s + RESET : s);
  const out: string[] = [];
  const line = (s = ''): number => out.push(s);

  if (opts.heading !== false) {
    line(`${paint(BOLD, clean(r.path))}${paint(DIM, `  ${bytesLabel(r.bytes)}${r.format ? ` · ${clean(r.format)}` : ' · unrecognised container'}`)}`);
  }

  // ── hidden text first: it is the finding that changes what someone does next ──
  if (r.hiddenText && r.hiddenText.findings.length) {
    const h = r.hiddenText;
    line(paint(YELLOW, '! Text present in the file but not visible on the page'));
    line(paint(DIM, `  ${clean(h.summary)}`));
    const quote = opts.quote ?? DEFAULT_QUOTE;
    for (const f of h.findings.slice(0, 20)) {
      const where = `page ${(f.page ?? 0) + 1}`;
      const cov = `${Math.round(f.coverage * 100)}% covered${f.fullyHidden ? ', nothing legible left' : ''}`;
      const text = quote > 0 ? ` ${paint(DIM, '“')}${clean(truncate(f.text, quote))}${paint(DIM, '”')}` : '';
      line(`  ${paint(DIM, where.padEnd(8))}${text}`);
      line(`  ${' '.repeat(8)}${paint(DIM, `${cov}, behind ${clean(f.fill || 'a filled shape')}`)}`);
    }
    if (h.findings.length > 20) line(paint(DIM, `  … and ${h.findings.length - 20} more runs`));
    line(paint(DIM, '  This says where the words are, not why. A failed redaction and a layering'));
    line(paint(DIM, '  mistake look identical from the outside.'));
  } else if (r.hiddenText) {
    line(paint(DIM, `○ No text found hidden under opaque shapes (${r.hiddenText.pagesScanned} page${r.hiddenText.pagesScanned === 1 ? '' : 's'} scanned)`));
  }

  // ── metadata ────────────────────────────────────────────────────────────────
  const m = r.metadata;
  if (m) {
    if (m.gps) {
      line(paint(YELLOW, '! Location recorded') + paint(DIM, `  ${m.gps.lat.toFixed(5)}, ${m.gps.lon.toFixed(5)}`));
    }
    if (m.appended) {
      const a = m.appended;
      const tone = a.declared ? DIM : YELLOW;
      const mark = a.declared ? '○' : '!';
      line(paint(tone, `${mark} ${bytesLabel(a.bytes)} of data ride after the ${clean(m.format || 'container')} ends`)
        + paint(DIM, ` — ${clean(a.kind)} at offset ${a.offset}${a.declared ? ', declared by the container itself' : ''}`));
    }
    if (m.ai) {
      line(paint(YELLOW, `~ AI provenance declared in metadata`)
        + paint(DIM, ` — ${clean(m.ai.sourceType)}${m.ai.credit ? ` (${clean(m.ai.credit)})` : ''}`));
    }
    if (m.fields.length) {
      line(paint(BOLD, `Metadata`) + paint(DIM, ` — ${m.fields.length} field${m.fields.length === 1 ? '' : 's'}${m.sensitiveCount ? `, ${m.sensitiveCount} personally identifying` : ''}`));
      for (const f of m.fields) {
        const mark = f.sensitive ? paint(YELLOW, '·') : paint(DIM, '·');
        line(`  ${mark} ${paint(DIM, clean(f.label).padEnd(18))} ${clean(truncate(f.value, 120))}`);
      }
    } else if (m.format) {
      line(paint(DIM, `○ No embedded metadata found in this ${clean(m.format)}`));
    }
    if (m.residual) {
      line(paint(DIM, `  A clean copy is available: strip would remove ${clean(m.residual)}.`));
    } else if (m.strippable && m.fields.length) {
      line(paint(DIM, '  A clean copy is available (lolly strip-data).'));
    }
  }

  // ── PDF structure ───────────────────────────────────────────────────────────
  const p = r.pdf;
  if (p) {
    line(paint(BOLD, 'Document') + paint(DIM, ` — ${p.pageCount} page${p.pageCount === 1 ? '' : 's'}, ${p.pagesScanned} examined${p.encrypted ? ', encrypted' : ''}`));
    const info: Array<[string, string | undefined]> = [
      ['Title', p.info.title], ['Author', p.info.author], ['Subject', p.info.subject],
      ['Keywords', p.info.keywords], ['Creator', p.info.creator], ['Producer', p.info.producer],
      ['Created', p.info.created], ['Modified', p.info.modified],
      ['XMP packet', p.info.xmp ? 'present' : undefined],
    ];
    for (const [k, v] of info) if (v) line(`  ${paint(DIM, k.padEnd(11))} ${clean(truncate(v, 120))}`);
    const fonts = [...new Set(p.pages.flatMap((pg) => pg.fonts))].sort();
    const images = p.pages.reduce((a, pg) => a + pg.images, 0);
    const annots = p.pages.reduce((a, pg) => a + pg.annotations, 0);
    const scans = p.pages.filter((pg) => pg.scanned).length;
    const chars = p.pages.reduce((a, pg) => a + pg.textChars, 0);
    if (fonts.length) line(`  ${paint(DIM, 'Fonts'.padEnd(11))} ${clean(fonts.slice(0, 12).join(', '))}${fonts.length > 12 ? ` (+${fonts.length - 12})` : ''}`);
    // No page was read: printing "0 characters of text, 0 images" would read as a fact
    // about the document rather than as a fact about the failure.
    if (p.pagesScanned) {
      line(`  ${paint(DIM, 'Contents'.padEnd(11))} ${chars} characters of text, ${images} image${images === 1 ? '' : 's'}, ${annots} annotation${annots === 1 ? '' : 's'}`);
    } else {
      line(`  ${paint(DIM, 'Contents'.padEnd(11))} not read — see the incomplete-report note below`);
    }
    if (scans) line(`  ${paint(DIM, 'Scanned'.padEnd(11))} ${scans} page${scans === 1 ? '' : 's'} carry no text layer — nothing to extract without OCR`);
    if (opts.showText && p.text) {
      line(paint(BOLD, 'Text'));
      for (const l of p.text.split('\n')) line(`  ${clean(l)}`);
    }
  }

  // ── credential, when the caller asked for one ───────────────────────────────
  if (r.credential) {
    const v = r.credential;
    const label = v.state === 'none'
      ? paint(DIM, '○ No Content Credentials found')
      : v.tone === 'bad'
        ? paint(RED, `✕ Content Credentials: ${v.state}`)
        : v.tone === 'warn'
          ? paint(YELLOW, `! Content Credentials: ${v.state}`)
          : paint(GREEN, `✓ Content Credentials: ${v.state}`);
    line(label + (v.identity?.email ? paint(DIM, ` — ${clean(v.identity.email)}`) : ''));
  }

  // ── what ran, what did not ──────────────────────────────────────────────────
  if (r.errors.length) {
    line(paint(RED, `✕ ${r.errors.length} check${r.errors.length === 1 ? '' : 's'} did not complete — this report is incomplete`));
    for (const e of r.errors) line(paint(DIM, `  ${clean(e)}`));
  }
  if (r.checked.length) {
    line(paint(DIM, 'Checked:'));
    for (const s of r.checked) line(paint(DIM, `  · ${clean(s)}`));
  }
  line(paint(DIM, 'Not checked:'));
  for (const s of r.limits) line(paint(DIM, `  · ${clean(s)}`));

  return out.join('\n') + '\n';
}

function truncate(s: string, n: number): string {
  const t = String(s);
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
