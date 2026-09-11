// SPDX-License-Identifier: MPL-2.0
/** Exact text, source selections and bounded undo history for shared editors. */
export interface TextSelection {
  start: number;
  end: number;
}
export interface TextSnapshot extends TextSelection {
  text: string;
  scroll: number;
}
/** Immutable edits with bounded undo, shared by the plain-text editor and its tests. */
export class TextDocument {
  value: TextSnapshot;
  revision = 0;
  private past: TextSnapshot[] = [];
  private future: TextSnapshot[] = [];
  constructor(text = '') {
    this.value = { text, start: 0, end: 0, scroll: 0 };
  }
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }
  reset(text: string): void {
    this.value = { text, start: 0, end: 0, scroll: 0 };
    this.past = [];
    this.future = [];
    this.revision++;
  }
  select(start: number, end: number, scroll = this.value.scroll): void {
    this.value = { ...this.value, start, end, scroll };
  }
  commit(next: TextSnapshot): void {
    if (next.text === this.value.text) {
      this.value = next;
      return;
    }
    this.past.push(this.value);
    this.future = [];
    this.value = next;
    this.revision++;
    let size = this.value.text.length;
    for (let i = this.past.length - 1; i >= 0; i--) {
      size += this.past[i]!.text.length;
      if (size > 8 * 1024 * 1024 || this.past.length - i > 100) {
        this.past.splice(0, i + 1);
        break;
      }
    }
  }
  replace(
    text: string,
    selection: TextSelection = this.value,
    expectedRevision = this.revision
  ): boolean {
    if (expectedRevision !== this.revision) return false;
    const { start, end } = selection;
    if (start < 0 || end < start || end > this.value.text.length)
      throw new Error('Invalid text selection.');
    this.commit({
      text: this.value.text.slice(0, start) + text + this.value.text.slice(end),
      start,
      end: start + text.length,
      scroll: this.value.scroll,
    });
    return true;
  }
  undo(): boolean {
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(this.value);
    this.value = previous;
    this.revision++;
    return true;
  }
  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.value);
    this.value = next;
    this.revision++;
    return true;
  }
}

export const displayText = (text: string): string => text.replace(/\r\n?/g, '\n');
export function sourceOffset(text: string, displayOffset: number): number {
  let display = 0,
    at = 0;
  while (at < text.length && display < displayOffset) {
    if (text[at] === '\r' && text[at + 1] === '\n') at++;
    at++;
    display++;
  }
  return at;
}
export function displayOffset(text: string, sourcePosition: number): number {
  return displayText(text.slice(0, sourcePosition)).length;
}
/** Preserve untouched line endings while applying the textarea's normalized edit. */
export function textFromInput(previous: string, nextDisplay: string): string {
  const old = displayText(previous);
  let start = 0,
    end = old.length,
    nextEnd = nextDisplay.length;
  while (start < end && start < nextEnd && old[start] === nextDisplay[start]) start++;
  while (end > start && nextEnd > start && old[end - 1] === nextDisplay[nextEnd - 1]) {
    end--;
    nextEnd--;
  }
  const ending =
    previous.includes('\r\n') && !previous.replace(/\r\n/g, '').includes('\n') ? '\r\n' : '\n';
  return (
    previous.slice(0, sourceOffset(previous, start)) +
    nextDisplay.slice(start, nextEnd).replace(/\n/g, ending) +
    previous.slice(sourceOffset(previous, end))
  );
}
