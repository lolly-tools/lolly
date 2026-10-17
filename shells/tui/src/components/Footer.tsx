// SPDX-License-Identifier: MPL-2.0
// The persistent keyboard-shortcut bar (lazygit/k9s style) pinned at the bottom.
import { Box, Text } from 'ink';
import { theme } from '../theme.ts';

export interface Shortcut { key: string; label: string }

/** Lines the footer takes at `cols`: the note, then the shortcuts as flex-wrap places them. */
export function footerLines(shortcuts: Shortcut[], note: string | undefined, cols: number): number {
  const width = Math.max(1, cols - 2);
  let lines = 1, used = 0;
  for (const s of shortcuts) {
    const w = s.key.length + s.label.length + 4;
    if (used && used + w > width) { lines += 1; used = 0; }
    used += w;
  }
  return lines + (note ? 1 : 0);
}

export function Footer({ shortcuts, note }: { shortcuts: Shortcut[]; note?: string }) {
  return (
    <Box flexDirection="column">
      {note ? (
        <Box paddingX={1}>
          <Text color={theme.dim} wrap="truncate-end">{note}</Text>
        </Box>
      ) : null}
      <Box paddingX={1} flexWrap="wrap">
        {shortcuts.map((s, i) => (
          <Text key={i}>
            <Text bold color={theme.accentName}>{s.key}</Text>
            <Text color={theme.dim}>{' ' + s.label + '   '}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}
