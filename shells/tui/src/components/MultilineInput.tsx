// SPDX-License-Identifier: MPL-2.0
/**
 * A real multi-line text editor for the TUI - the terminal counterpart to a web
 * <textarea>, used to edit `longtext` inputs (Code Canvas's code, digi-ad copy, layout
 * box text, …) with actual line breaks instead of the single-line field's `\n` escape.
 *
 * Keys: type to insert · Enter = new line · Backspace/Delete · ← → move · ↑ ↓ move a line
 * (keeping the column) · Ctrl-A/Ctrl-E line home/end · Esc = save & close. The caret is a
 * reverse-video cell; the view scrolls vertically to keep the caret in sight. Long lines
 * truncate (no horizontal scroll yet). ToolView routes ALL keys here while it's mounted
 * (mode 'editml'), so it fully owns input.
 *
 * The text + caret live in ONE internal state object edited through functional updaters,
 * so a fast run of keystrokes always accumulates on the latest value (a value-prop-derived
 * editor would drop characters when several land before a re-render). onChange keeps the
 * parent's draft in sync; Esc submits the current text.
 */
import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.ts';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;   // Esc → save & close
  width: number;
  height: number;                  // visible rows
}

interface St { text: string; caret: number }

const clamp = (c: number, len: number): number => Math.max(0, Math.min(len, c));

/** Move the caret one line up/down, keeping the column. */
function moveLine({ text, caret }: St, dir: number): St {
  const lines = text.split('\n');
  const before = text.slice(0, caret);
  const line = (before.match(/\n/g)?.length) ?? 0;
  const col = caret - (before.lastIndexOf('\n') + 1);
  const li = line + dir;
  if (li < 0 || li >= lines.length) return { text, caret };
  let start = 0;
  for (let i = 0; i < li; i++) start += lines[i]!.length + 1;
  return { text, caret: start + Math.min(col, lines[li]!.length) };
}

export function MultilineInput({ value, onChange, onSubmit, height }: Props) {
  const [st, setSt] = useState<St>(() => ({ text: value, caret: value.length }));
  // Sync the parent's draft whenever the text changes (commit reads the submitted value).
  useEffect(() => { onChange(st.text); }, [st.text]);   // eslint-disable-line react-hooks/exhaustive-deps
  const submitRef = useRef(onSubmit); submitRef.current = onSubmit;

  useInput((input, key) => {
    if (key.escape) { setSt((prev) => { submitRef.current(prev.text); return prev; }); return; }
    setSt((prev) => {
      const { text, caret } = prev;
      if (key.return) return { text: text.slice(0, caret) + '\n' + text.slice(caret), caret: caret + 1 };
      if (key.backspace || key.delete) return caret > 0 ? { text: text.slice(0, caret - 1) + text.slice(caret), caret: caret - 1 } : prev;
      if (key.leftArrow) return { text, caret: clamp(caret - 1, text.length) };
      if (key.rightArrow) return { text, caret: clamp(caret + 1, text.length) };
      if (key.upArrow) return moveLine(prev, -1);
      if (key.downArrow) return moveLine(prev, 1);
      if (key.ctrl && input === 'a') { const bol = text.lastIndexOf('\n', caret - 1) + 1; return { text, caret: bol }; }
      if (key.ctrl && input === 'e') { const nl = text.indexOf('\n', caret); return { text, caret: nl < 0 ? text.length : nl }; }
      if (input && !key.ctrl && !key.meta) return { text: text.slice(0, caret) + input + text.slice(caret), caret: caret + input.length };
      return prev;
    });
  });

  // ── Render: window the lines so the caret line stays visible; mark the caret cell ──
  const { text, caret } = st;
  const lines = text.split('\n');
  const before = text.slice(0, caret);
  const caretLine = (before.match(/\n/g)?.length) ?? 0;
  const caretCol = caret - (before.lastIndexOf('\n') + 1);
  const rows = Math.max(1, height);
  const start = Math.max(0, Math.min(caretLine - Math.floor(rows / 2), Math.max(0, lines.length - rows)));
  const visible = lines.slice(start, start + rows);

  return (
    <Box flexDirection="column">
      {visible.map((ln, i) => {
        const li = start + i;
        if (li !== caretLine) return <Text key={li} wrap="truncate-end">{ln.length ? ln : ' '}</Text>;
        const pre = ln.slice(0, caretCol);
        const at = ln[caretCol] ?? ' ';
        const post = ln.slice(caretCol + 1);
        return <Text key={li} wrap="truncate-end"><Text>{pre}</Text><Text inverse>{at}</Text><Text>{post}</Text></Text>;
      })}
      <Text color={theme.dim}>{`  line ${caretLine + 1}/${lines.length} · ⏎ new line · esc save`}</Text>
    </Box>
  );
}
