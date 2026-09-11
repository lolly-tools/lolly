// SPDX-License-Identifier: MPL-2.0
/**
 * A fixed-size bordered panel - the building block of the "hard masonry" layout.
 * Give it an explicit width/height and it NEVER resizes as its content changes, so
 * nothing shakes: callers window their content to fit and the panel reserves the space
 * regardless. Mirrors the web UI's bordered cards/sidebar.
 */
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { theme } from '../theme.ts';

export function Panel({ title, width, height, active = false, children }: {
  title?: string;
  width?: number;
  height?: number;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={active ? theme.accentName : theme.border}
      paddingX={1}
      overflow="hidden"
    >
      {title ? <Text bold color={active ? theme.accentName : undefined} wrap="truncate-end">{title}</Text> : null}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">{children}</Box>
    </Box>
  );
}
