// SPDX-License-Identifier: MPL-2.0
// The persistent keyboard-shortcut bar (lazygit/k9s style) pinned at the bottom.
import { Box, Text } from 'ink';
import { theme } from '../theme.ts';

export interface Shortcut { key: string; label: string }

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
