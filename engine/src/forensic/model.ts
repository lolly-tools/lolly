// SPDX-License-Identifier: MPL-2.0
/** Token-measured windows retain context, including a full-context final window. */
import type { ForensicModelWindow } from './types.ts';
export async function forensicModelWindows(
  text: string,
  maxTokens: number,
  measure: (text: string) => number,
  score: (text: string) => Promise<number>,
  cap = 32,
  cancelled: () => boolean = () => false
): Promise<{ windows: ForensicModelWindow[]; complete: boolean; rawMean: number }> {
  if (
    !Number.isInteger(maxTokens) ||
    maxTokens < 8 ||
    !Number.isInteger(cap) ||
    cap < 2 ||
    cap > 128
  )
    throw new Error('Invalid classifier budget.');
  const bounded = text.slice(0, 65_536),
    measured: { index: number; length: number; tokens: number }[] = [];
  const count = (part: string): number => {
    const n = measure(part);
    if (!Number.isInteger(n) || n < 1) throw new Error('Invalid classifier token count.');
    return n;
  };
  for (let index = 0; index < bounded.length; ) {
    let length = Math.min(8192, bounded.length - index);
    if (count(bounded.slice(index, index + length)) > maxTokens) {
      let low = 1,
        high = length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (count(bounded.slice(index, index + mid)) <= maxTokens) low = mid;
        else high = mid - 1;
      }
      length = low;
      const boundary = bounded.lastIndexOf(' ', index + length);
      if (boundary > index + length * 0.6) length = boundary - index;
    }
    let tokens = count(bounded.slice(index, index + length));
    if (tokens > maxTokens) throw new Error('A token exceeds the classifier budget.');
    if (index + length === bounded.length && measured.length && tokens < maxTokens * 0.7) {
      let low = Math.max(0, bounded.length - 8192),
        high = index;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (count(bounded.slice(mid)) <= maxTokens) high = mid;
        else low = mid + 1;
      }
      const boundary = bounded.indexOf(' ', low);
      index = boundary >= 0 && boundary < index ? boundary + 1 : low;
      length = bounded.length - index;
      tokens = count(bounded.slice(index));
    }
    measured.push({ index, length, tokens });
    if (index + length === bounded.length) break;
    const overlap = Math.min(200, Math.floor(length * 0.1)),
      boundary = bounded.indexOf(' ', index + length - overlap);
    index = boundary >= 0 && boundary < index + length ? boundary + 1 : index + length;
    if (measured.length > 8192) throw new Error('Classifier planning budget exceeded.');
  }
  const selected =
    measured.length <= cap
      ? measured
      : Array.from(
          { length: cap },
          (_, i) => measured[Math.round((i * (measured.length - 1)) / (cap - 1))]!
        );
  const windows: ForensicModelWindow[] = [];
  for (const part of selected) {
    if (cancelled()) throw new Error('Classifier inspection cancelled.');
    const rawScore = await score(bounded.slice(part.index, part.index + part.length));
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 1)
      throw new Error('Invalid classifier score.');
    windows.push({ ...part, rawScore });
  }
  let end = 0,
    covered = true,
    total = 0,
    weighted = 0;
  for (const segment of windows) {
    if (segment.index > end) covered = false;
    const novel = Math.max(0, segment.index + segment.length - Math.max(end, segment.index));
    weighted += novel * segment.rawScore;
    total += novel;
    end = Math.max(end, segment.index + segment.length);
  }
  return {
    windows,
    complete: covered && end === text.length,
    rawMean: total ? weighted / total : 0,
  };
}
