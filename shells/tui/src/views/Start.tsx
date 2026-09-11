// SPDX-License-Identifier: MPL-2.0
/** A first-launch landing, deliberately shorter than a wizard. */
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { markNodeStartSeen } from '@lolly-tools/node-shell/design-systems';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import type { SystemAction } from './System.tsx';

const CHOICES = [
  { title: 'Make a QR code', note: 'A quick first win; no setup or existing file needed.', action: 'qr' as const },
  { title: 'One colour', note: 'Build a usable palette from the one thing you know.', action: 'colour' as const },
  { title: 'Bring a file', note: '.lolly, tokens, Penpot, a token zip, or SVG.', action: 'import' as const },
  { title: 'Mix resources', note: 'Start a system, then layer in logos, fonts and references.', action: 'resource' as const },
  { title: 'Explore tools first', note: 'Setup stays optional. Come back with 5 System.', action: 'tools' as const },
];

export function Start({ onSystem, onQuickTool, onExplore, onQuit }: {
  onSystem: (action: SystemAction) => void;
  onQuickTool: (toolId: string) => void;
  onExplore: () => void;
  onQuit: () => void;
}) {
  const { cols, rows } = useTermSize();
  const compact = rows < 26 || cols < 66;
  const [selected, setSelected] = useState(0);
  const choose = (index: number): void => {
    const choice = CHOICES[index];
    if (!choice) return;
    void markNodeStartSeen();
    if (choice.action === 'qr') onQuickTool('qr-code');
    else if (choice.action === 'tools') onExplore();
    else onSystem(choice.action);
  };
  useInput((input, key) => {
    if (input === 'q' || key.escape) return onQuit();
    const direct = Number.parseInt(input, 10);
    if (direct >= 1 && direct <= CHOICES.length) return choose(direct - 1);
    if (key.upArrow || input === 'k') setSelected(i => Math.max(0, i - 1));
    else if (key.downArrow || input === 'j') setSelected(i => Math.min(CHOICES.length - 1, i + 1));
    else if (key.return) choose(selected);
  });
  return (
    <Box flexDirection="column" width={cols} height={rows} alignItems="center" justifyContent="center">
      <Box width={Math.min(70, Math.max(30, cols - 4))} paddingX={2} paddingY={compact ? 0 : 1} borderStyle="double" borderColor={theme.accentName} flexDirection="column" flexShrink={0}>
        <Text bold color={theme.accentName}>LOLLY</Text>
        <Text bold>Make it yours, from whatever you have.</Text>
        <Text color={theme.dim}>{compact ? 'Nothing required · everything stays on this device.' : 'Nothing here is a required step. Everything stays on this device.'}</Text>
        <Text> </Text>
        {CHOICES.map((choice, i) => (
          <Box key={choice.title} flexDirection="column" marginBottom={!compact && i !== CHOICES.length - 1 ? 1 : 0} flexShrink={0}>
            <Text inverse={selected === i}><Text bold color={selected === i ? undefined : theme.accentName}>{i + 1}</Text>  <Text bold>{choice.title}</Text></Text>
            {compact ? null : <Text color={theme.dim}>   {choice.note}</Text>}
          </Box>
        ))}
        {compact ? <Text color={theme.dim}>   {CHOICES[selected]?.note}</Text> : null}
        <Text> </Text>
        <Text color={theme.dim}>↑↓ choose · Enter open · q quit</Text>
      </Box>
    </Box>
  );
}
