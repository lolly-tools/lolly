// SPDX-License-Identifier: MPL-2.0
// Terminal highlighting for the docs' shell fences (bash, sh, shell, zsh), done once at
// build time so neither reader ships a highlighter. The scanner splits the source into
// runs that each carry a kind; the runs always join back to the exact source, so the page
// text, search and Copy read what the author wrote. Each run is escaped on the way out and
// its class comes from the fixed list below, so nothing in the code can reach the markup.
//
// Kinds (each drawn by docs-components.css as `.sh-<kind>`):
//   cmd     the command word, and a shell keyword such as `for` or `do`
//   flag    an option: -n, --set, the --from-literal part of --from-literal=x
//   key     the name in a key=value argument or an environment assignment
//   op      = | || && ; & > < ( ) $( and the like
//   str     a quoted string, and the body of a here-document
//   var     $X, ${X}, $1, $?
//   ph      a placeholder to fill in: <registry>
//   cont    the backslash that continues a command on the next line
//   com     a comment
//   out     expected output, written as a comment line straight after a command, or a
//           line with no prompt in an example whose commands start with `$ `
//   prompt  the `$ ` before a command in such an example

import { esc } from './esc.ts';

export type ShellKind = '' | 'cmd' | 'flag' | 'key' | 'op' | 'str' | 'var' | 'ph' | 'cont' | 'com' | 'out' | 'prompt';
export interface CodeRun { kind: ShellKind; text: string }

/** Fence languages that are drawn as a terminal. */
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh']);
export function isShellLang(lang: string): boolean {
  return SHELL_LANGS.has(lang);
}

/** Commands whose next word is another command (`sudo helm …`). */
const PREFIX = new Set(['sudo', 'env', 'exec', 'nohup', 'time', 'command', 'builtin', 'xargs', 'watch', 'nice']);
/** Shell keywords after which a command follows. */
const KEYWORD_THEN_CMD = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!']);

const WORD_STOP = /[\s;|&<>()"'`$\\]/;
const ASSIGN = /^([A-Za-z_][A-Za-z0-9_]*)(=)/;
const KEY_VALUE = /^([A-Za-z_][\w.\-/[\]]*)(=)/;
const FLAG = /^(--?[A-Za-z0-9][\w.-]*)(=?)/;
const PLACEHOLDER = /^<[A-Za-z][\w.:-]*>/;
const VAR = /^\$(?:\{[^}\n]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9?@#*!$-])/;
const HEREDOC = /^<<-?[ \t]*(['"]?)([A-Za-z_][\w-]*)\1/;

/** The scanner. One instance reads one block. */
class ShellScanner {
  readonly runs: CodeRun[] = [];
  private i = 0;
  /** True where the next word is a command. */
  private expectCmd = true;
  /** True after a prefix command such as sudo, until its command word. */
  private afterPrefix = false;
  /** True between the start of a word and the next separator. */
  private inWord = false;
  /** The kind of the last finished line: what came before a comment line. */
  private lastLine: 'none' | 'blank' | 'code' | 'note' = 'none';
  private lineHasCode = false;
  /** Here-document delimiters waiting for the end of the current line. */
  private heredocs: string[] = [];
  private readonly transcript: boolean;
  private readonly s: string;

  constructor(s: string) {
    this.s = s;
    this.transcript = /^[ \t]*\$ /m.test(s);
  }

  private emit(kind: ShellKind, text: string): void {
    if (!text) return;
    const last = this.runs[this.runs.length - 1];
    if (last && last.kind === kind) last.text += text;
    else this.runs.push({ kind, text });
  }

  private lineEnd(from: number): number {
    const n = this.s.indexOf('\n', from);
    return n === -1 ? this.s.length : n;
  }

  /** Reads the whole block. */
  scan(): CodeRun[] {
    while (this.i < this.s.length) this.scanLine();
    return this.runs;
  }

  /** One physical line at the top level, starting at its first character. */
  private scanLine(): void {
    const start = this.i;
    const end = this.lineEnd(start);
    const line = this.s.slice(start, end);
    if (this.continuedFromLast) {
      this.continuedFromLast = false;
      this.scanContext(null);
      this.finishLine(true);
      return;
    }
    if (!line.trim()) {
      this.emit('', line);
      this.i = end;
      this.finishLine(false, 'blank');
      return;
    }
    if (/^[ \t]*#/.test(line)) {
      this.emit(this.commentLineKind(start), line);
      this.i = end;
      this.finishLine(false, 'note');
      return;
    }
    if (this.transcript) {
      const prompt = /^([ \t]*)(\$ )/.exec(line);
      if (!prompt) {
        this.emit('out', line);
        this.i = end;
        this.finishLine(false, 'note');
        return;
      }
      this.emit('', prompt[1]!);
      this.emit('prompt', prompt[2]!);
      this.i = start + prompt[0].length;
    }
    this.scanContext(null);
    this.finishLine(true);
  }

  private continuedFromLast = false;

  /** Ends a line: takes the newline, reads any here-document bodies and resets the command
   *  position unless the line ended in a continuation. */
  private finishLine(code: boolean, kind?: 'blank' | 'note'): void {
    this.lineHasCode = this.lineHasCode || code;
    if (this.i < this.s.length && this.s[this.i] === '\n') {
      this.emit('', '\n');
      this.i++;
    }
    if (this.heredocs.length) this.readHeredocs();
    this.lastLine = kind ?? (this.lineHasCode ? 'code' : 'blank');
    this.lineHasCode = false;
    if (!this.continuedFromLast) { this.expectCmd = true; this.afterPrefix = false; }
    this.inWord = false;
  }

  /** A comment line straight after a command, with a blank line or the end of the block after
   *  its run of comment lines, shows what the command printed. Otherwise it is a comment, and
   *  so is a run that opens as a sentence ("# Copying the example over…"): that is a note. */
  private commentLineKind(start: number): ShellKind {
    if (this.lastLine === 'note' && this.runs.length) {
      // Same run as the line above: keep its kind.
      for (let r = this.runs.length - 1; r >= 0; r--) {
        const k = this.runs[r]!.kind;
        if (k === 'out' || k === 'com') return k;
        if (k !== '') break;
      }
    }
    if (this.lastLine !== 'code') return 'com';
    if (/^[ \t]*#\s*[A-Z][a-z]/.test(this.s.slice(start, this.lineEnd(start)))) return 'com';
    let at = start;
    for (;;) {
      const end = this.lineEnd(at);
      const next = end + 1;
      if (next >= this.s.length) return 'out';
      const nextLine = this.s.slice(next, this.lineEnd(next));
      if (!nextLine.trim()) return 'out';
      if (!/^[ \t]*#/.test(nextLine)) return 'com';
      at = next;
    }
  }

  private readHeredocs(): void {
    for (const delim of this.heredocs) {
      const bodyStart = this.i;
      let at = this.i;
      let found = -1;
      while (at < this.s.length) {
        const end = this.lineEnd(at);
        if (this.s.slice(at, end).trim() === delim) { found = at; break; }
        at = end + 1;
      }
      if (found === -1) { this.emit('str', this.s.slice(bodyStart)); this.i = this.s.length; break; }
      this.emit('str', this.s.slice(bodyStart, found));
      const end = this.lineEnd(found);
      this.emit('op', this.s.slice(found, end));
      this.i = end;
      if (this.i < this.s.length) { this.emit('', '\n'); this.i++; }
    }
    this.heredocs = [];
  }

  /**
   * Reads commands until the end of the line (top level, `close` null) or until `close`
   * (inside `$(…)` or backticks, where newlines are read as well).
   */
  private scanContext(close: ')' | '`' | null): void {
    let guard = this.s.length * 4 + 16;
    while (this.i < this.s.length && guard-- > 0) {
      const c = this.s[this.i]!;
      if (c === '\n') {
        if (close === null) return;
        this.emit('', '\n'); this.i++;
        if (!this.continuedFromLast) { this.expectCmd = true; this.afterPrefix = false; }
        this.continuedFromLast = false;
        this.inWord = false;
        continue;
      }
      if (close && c === close) return;
      if (c === ' ' || c === '\t') { this.emit('', c); this.i++; this.inWord = false; continue; }
      if (c === '\\') { this.backslash(); continue; }
      if (c === '#' && !this.inWord) {
        const end = this.lineEnd(this.i);
        this.emit('com', this.s.slice(this.i, end));
        this.i = end;
        continue;
      }
      if (c === "'") { this.single(); continue; }
      if (c === '"') { this.double(); continue; }
      if (c === '`') { this.substitution('`'); continue; }
      if (c === '$') { this.dollar(); continue; }
      if (c === '<' || c === '>') { this.angle(); continue; }
      if (c === '|' || c === '&' || c === ';') { this.separator(); continue; }
      if (c === '(' || c === ')') {
        this.emit('op', c); this.i++;
        this.inWord = false;
        if (c === '(') this.expectCmd = true;
        continue;
      }
      this.word();
    }
  }

  private backslash(): void {
    const next = this.s[this.i + 1];
    if (next === '\n' || next === undefined) {
      this.emit('cont', '\\');
      this.i++;
      this.continuedFromLast = true;
      this.inWord = false;
      return;
    }
    // An escaped character belongs to the word it sits in.
    this.emit('', this.s.slice(this.i, this.i + 2));
    this.i += 2;
    this.markWordStarted();
  }

  private single(): void {
    const close = this.closingQuote("'", this.i + 1);
    if (close === -1) { this.emit('', "'"); this.i++; this.markWordStarted(); return; }
    this.markWordStarted();
    this.stringText(this.s.slice(this.i, close + 1));
    this.i = close + 1;
  }

  /** Where the quote opened at `from - 1` closes, or -1. A quote that opens a word (or a
   *  value after `=`) may run over several lines, as a JSON body does; one inside a word
   *  must close on its own line, so the apostrophe in `don't` colours no later line. */
  private closingQuote(q: '"' | "'", from: number): number {
    const spans = !this.inWord || this.s[from - 2] === '=';
    const limit = spans ? this.s.length : this.lineEnd(from);
    for (let j = from; j < limit; j++) {
      const c = this.s[j];
      if (q === '"' && c === '\\') { j++; continue; }
      if (c === q) return j;
    }
    return -1;
  }

  /** Quoted text, with any placeholder in it drawn as one. */
  private stringText(text: string): void {
    let rest = text;
    for (let at = rest.search(/<[A-Za-z]/); at !== -1; at = rest.search(/<[A-Za-z]/)) {
      const ph = PLACEHOLDER.exec(rest.slice(at));
      if (!ph) { this.emit('str', rest.slice(0, at + 1)); rest = rest.slice(at + 1); continue; }
      this.emit('str', rest.slice(0, at));
      this.emit('ph', ph[0]);
      rest = rest.slice(at + ph[0].length);
    }
    this.emit('str', rest);
  }

  private double(): void {
    // No closing quote: the character is read as itself, so one stray quote cannot colour
    // the rest of the block.
    const close = this.closingQuote('"', this.i + 1);
    if (close === -1) { this.emit('', '"'); this.i++; this.markWordStarted(); return; }
    this.markWordStarted();
    this.emit('str', '"');
    this.i++;
    let text = '';
    const flush = (): void => { this.stringText(text); text = ''; };
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === '"') { flush(); this.emit('str', '"'); this.i++; return; }
      if (c === '\\' && this.i + 1 < this.s.length) { text += this.s.slice(this.i, this.i + 2); this.i += 2; continue; }
      if (c === '$' || c === '`') { flush(); if (c === '$') this.dollar(true); else this.substitution('`'); continue; }
      text += c;
      this.i++;
    }
    flush();
  }

  private dollar(inString = false): void {
    const rest = this.s.slice(this.i);
    if (rest.startsWith('$(') && !rest.startsWith('$((')) { this.substitution(')'); if (!inString) this.markWordStarted(); return; }
    const v = VAR.exec(rest);
    if (v) { this.emit('var', v[0]); this.i += v[0].length; } else { this.emit(inString ? 'str' : '', '$'); this.i++; }
    if (!inString) this.markWordStarted();
  }

  /** `$(…)` or a backtick pair: a nested command, read like the top level. */
  private substitution(close: ')' | '`'): void {
    const open = close === ')' ? '$(' : '`';
    const saved = { expectCmd: this.expectCmd, afterPrefix: this.afterPrefix, inWord: this.inWord };
    this.emit('op', open);
    this.i += open.length;
    this.expectCmd = true;
    this.afterPrefix = false;
    this.inWord = false;
    this.scanContext(close);
    if (this.s[this.i] === close) { this.emit('op', close); this.i++; }
    this.expectCmd = saved.expectCmd;
    this.afterPrefix = saved.afterPrefix;
    this.inWord = saved.inWord;
  }

  private angle(): void {
    const rest = this.s.slice(this.i);
    const ph = PLACEHOLDER.exec(rest);
    if (ph) {
      if (this.expectCmd && !this.inWord) this.expectCmd = false;
      this.emit('ph', ph[0]); this.i += ph[0].length; this.markWordStarted();
      return;
    }
    const hd = HEREDOC.exec(rest);
    if (hd) { this.heredocs.push(hd[2]!); this.emit('op', hd[0]); this.i += hd[0].length; this.inWord = false; return; }
    const op = /^(?:[<>]{1,2}&?[0-9-]?)/.exec(rest)![0];
    this.emit('op', op);
    this.i += op.length;
    this.inWord = false;
  }

  private separator(): void {
    const op = /^(?:\|\||&&|;;|[|&;]|&>>?)/.exec(this.s.slice(this.i))![0];
    this.emit('op', op);
    this.i += op.length;
    this.inWord = false;
    if (op.startsWith('&>')) return;
    this.expectCmd = true;
    this.afterPrefix = false;
  }

  private markWordStarted(): void {
    if (!this.inWord && this.expectCmd) { this.expectCmd = false; this.afterPrefix = false; }
    this.inWord = true;
  }

  /** A run of ordinary word characters. Only the first run of a word is classified. */
  private word(): void {
    let j = this.i;
    while (j < this.s.length && !WORD_STOP.test(this.s[j]!)) j++;
    if (j === this.i) { this.emit('', this.s[this.i]!); this.i++; return; }
    const seg = this.s.slice(this.i, j);
    this.i = j;
    if (this.inWord) { this.emit('', seg); return; }
    this.inWord = true;
    if (this.expectCmd) { this.commandWord(seg); return; }
    this.argument(seg);
  }

  private commandWord(seg: string): void {
    const assign = ASSIGN.exec(seg);
    if (assign) {
      // NAME=value before a command: the command position stays open.
      this.emit('key', assign[1]!); this.emit('op', '='); this.emit('', seg.slice(assign[0].length));
      return;
    }
    if (this.afterPrefix && seg.startsWith('-')) { this.flag(seg); return; }
    this.emit('cmd', seg);
    if (PREFIX.has(seg)) { this.afterPrefix = true; return; }
    if (KEYWORD_THEN_CMD.has(seg)) return;
    this.expectCmd = false;
    this.afterPrefix = false;
  }

  private argument(seg: string): void {
    if (seg.startsWith('-')) { this.flag(seg); return; }
    this.value(seg);
  }

  private flag(seg: string): void {
    const f = FLAG.exec(seg);
    if (!f) { this.emit('', seg); return; }
    this.emit('flag', f[1]!);
    if (f[2]) { this.emit('op', '='); this.value(seg.slice(f[0].length)); return; }
    this.emit('', seg.slice(f[1]!.length));
  }

  private value(seg: string): void {
    const kv = KEY_VALUE.exec(seg);
    if (kv) { this.emit('key', kv[1]!); this.emit('op', '='); this.emit('', seg.slice(kv[0].length)); return; }
    this.emit('', seg);
  }
}

/**
 * The runs of a shell example. Joined, they are exactly `code`; if the scanner ever failed
 * that, the block is returned as one plain run instead.
 */
export function shellRuns(code: string): CodeRun[] {
  let runs: CodeRun[];
  try {
    runs = new ShellScanner(code).scan();
  } catch {
    return [{ kind: '', text: code }];
  }
  return runs.map((r) => r.text).join('') === code ? runs : [{ kind: '', text: code }];
}

/**
 * The code element's inner HTML for a list of runs. A wrapping block (`wrap`) also holds
 * each whitespace-separated piece together in a `doc-code-token`, with the runs' own spans
 * inside it, so a long argument never breaks after a hyphen. Plain text comes out exactly
 * as the block renderer has always written plain code.
 */
export function codeRunsHtml(runs: readonly CodeRun[], wrap: boolean): string {
  const span = (kind: ShellKind, text: string): string => (kind ? `<span class="sh-${kind}">${esc(text)}</span>` : esc(text));
  if (!wrap) return runs.map((r) => span(r.kind, r.text)).join('');
  let out = '';
  let open = false;
  for (const r of runs) {
    for (const piece of r.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s/.test(piece)) {
        if (open) { out += '</span>'; open = false; }
        out += esc(piece);
        continue;
      }
      if (!open) { out += '<span class="doc-code-token">'; open = true; }
      out += span(r.kind, piece);
    }
  }
  return open ? `${out}</span>` : out;
}
