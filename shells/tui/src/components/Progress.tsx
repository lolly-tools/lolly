// SPDX-License-Identifier: MPL-2.0
/**
 * A fixed-size progress panel for a batch/folder export: a block-glyph bar, a windowed
 * per-file tick log, and a rotating quip at the bottom. Everything is clamped to the
 * given width/height so the panel NEVER shakes as the log grows. Owns its own quip timer.
 *
 * Glyph rules (same fixed-width discipline as emoji.ts): the bar uses width-1 block
 * glyphs (█/░) and the log status prefixes are width-1 (✓/⚠/✗) - NO width-2 emoji here.
 */
import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { Panel } from './Panel.tsx';
import { theme } from '../theme.ts';
import { quipAt } from '../quips.ts';

export interface ProgressProps {
  title?: string;          // default 'Exporting…'
  done: number;
  total: number;
  /** accumulated per-file labels (each already glyph-prefixed by batch-export: '✓ …' / '⚠ …' / '✗ …'). */
  log: string[];
  width: number;
  height: number;
  active?: boolean;        // Panel highlight
  finished?: boolean;      // freeze the quip line → a done message + zip path
  note?: string;           // e.g. the written zip path, shown when finished
}

function colourFor(line: string): string | undefined {
  const c = line.charAt(0);
  if (c === '✓') return theme.accentName;
  if (c === '⚠') return theme.warn;
  if (c === '✗') return theme.danger;
  return theme.dim;
}

export function Progress({ title = 'Exporting…', done, total, log, width, height, active = false, finished = false, note }: ProgressProps): JSX.Element {
  // Rotate the quip on a timer - independent of React re-renders, so a burst of onProgress
  // updates doesn't re-randomise the line.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  // Bar: reserve room for the ` NN/NN` suffix + padding. Block glyphs are width-1.
  const inner = Math.max(4, width - 10);
  const filled = total ? Math.min(inner, Math.round((inner * done) / total)) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, inner - filled));

  // Tick log: window to the rows left after title + bar + quip + borders.
  const rows = Math.max(1, height - 5);
  const window = log.slice(-rows);

  const quipLine = finished ? (note ?? 'Done.') : quipAt(tick);

  return (
    <Panel title={title} width={width} height={height} active={active}>
      <Text wrap="truncate-end">{bar} {done}/{total}</Text>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {window.map((line, i) => (
          <Text key={i} color={colourFor(line)} wrap="truncate-end">{line}</Text>
        ))}
      </Box>
      <Text color={finished ? theme.accentName : theme.dim} wrap="truncate-end">{quipLine}</Text>
    </Panel>
  );
}
