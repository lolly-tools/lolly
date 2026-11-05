// SPDX-License-Identifier: MPL-2.0
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChildProcess } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Panel } from '../components/Panel.tsx';
import { Footer, footerLines } from '../components/Footer.tsx';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { TERMINAL_WORKFLOWS } from '../automation.ts';
import { startCliProcess, stopCliProcess } from '../cli-process.ts';
import { shellWord, terminalReportLines } from '../terminal-workflows.ts';

const SHORTCUTS = [
  { key: 'arrows', label: 'move/scroll' },
  { key: 'enter', label: 'choose' },
  { key: 'esc', label: 'back' },
];

export function Automation({ onBack }: { onBack: () => void }) {
  const { cols, rows } = useTermSize();
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'choose' | 'input' | 'review' | 'running' | 'report'>('choose');
  const [field, setField] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Array<{ id: string; text: string }>>([]);
  const [scroll, setScroll] = useState(0);
  const [status, setStatus] = useState(
    'Existing commands, with a review before running. No model downloads.'
  );
  const active = useRef(true);
  const child = useRef<ChildProcess | null>(null);
  const filtered = TERMINAL_WORKFLOWS.filter((workflow) =>
    workflow.label.toLowerCase().includes(search.trim().toLowerCase())
  );
  const current = filtered[Math.min(selected, Math.max(0, filtered.length - 1))];
  const height = Math.max(1, rows - footerLines(SHORTCUTS, ' ', cols) - 7);
  const reviewLines = useMemo(
    () =>
      terminalReportLines(
        [
          'lolly ' + (current?.args(values) ?? []).map(shellWord).join(' '),
          '',
          'Enter runs this command. Escape cancels.',
        ],
        cols - 6
      ).map((text) => ({ id: crypto.randomUUID(), text })),
    [current, values, cols]
  );
  const start = Math.max(0, selected - height + 1);
  useEffect(() => {
    const stop = (): void => stopCliProcess(child.current);
    process.on('exit', stop);
    return () => {
      active.current = false;
      stop();
      process.off('exit', stop);
    };
  }, []);
  const report = (text: string): void => {
    setLines(
      terminalReportLines(text.split('\n'), cols - 6).map((text) => ({
        id: crypto.randomUUID(),
        text,
      }))
    );
    setScroll(0);
    setMode('report');
  };
  async function run(): Promise<void> {
    if (!current || child.current) return;
    setMode('running');
    setStatus('Running locally. c cancels.');
    try {
      const task = startCliProcess([...current.args(values), '--json']);
      child.current = task;
      let stdout = '',
        stderr = '',
        oversized = false;
      task.stdout.on('data', (data: Buffer) => {
        if (oversized) return;
        stdout += data.toString();
        if (stdout.length > 8 * 1024 * 1024) {
          oversized = true;
          stopCliProcess(task);
        }
      });
      task.stderr.on('data', (data: Buffer) => {
        stderr = (stderr + stripVTControlCharacters(data.toString())).slice(-16000);
        if (active.current) setStatus(stderr.trim().split('\n').at(-1) ?? '');
      });
      const code = await new Promise<number | null>((resolve, reject) => {
        task.once('error', reject);
        task.once('close', resolve);
      });
      if (!active.current) return;
      if (oversized) throw new Error('The report exceeds 8 MB. Use the CLI for this result.');
      let rendered = stdout;
      try {
        rendered = JSON.stringify(JSON.parse(stdout), null, 2);
      } catch {
        /* A cancelled process may have no result. */
      }
      report(`Exit: ${code ?? 'cancelled'}\n${rendered || stderr || 'No result was produced.'}`);
      setStatus('Full command report. Escape returns to the workflow list.');
    } catch (error) {
      if (active.current) {
        report((error as Error).message);
        setStatus('The command could not finish.');
      }
    } finally {
      child.current = null;
    }
  }
  useInput((input, key) => {
    if (mode === 'running') {
      if (input === 'c' || key.escape) stopCliProcess(child.current);
      return;
    }
    if (mode === 'input') {
      if (key.escape) setMode('choose');
      return;
    }
    if (mode === 'review') {
      if (key.escape) setMode('choose');
      else if (key.return) void run();
      else if (key.downArrow || input === 'j')
        setScroll((value) => Math.min(Math.max(0, reviewLines.length - height), value + 1));
      else if (key.upArrow || input === 'k') setScroll((value) => Math.max(0, value - 1));
      return;
    }
    if (mode === 'report') {
      if (key.escape || input === 'q') {
        setMode('choose');
        return;
      }
      if (key.downArrow || input === 'j')
        setScroll((value) => Math.min(Math.max(0, lines.length - height), value + 1));
      if (key.upArrow || input === 'k') setScroll((value) => Math.max(0, value - 1));
      return;
    }
    if (key.escape) onBack();
    if (key.downArrow)
      setSelected((value) => Math.min(Math.max(0, filtered.length - 1), value + 1));
    if (key.upArrow) setSelected((value) => Math.max(0, value - 1));
    if (key.return && current) {
      setValues(Object.fromEntries(current.fields.map((field) => [field.id, field.initial ?? ''])));
      setField(0);
      setScroll(0);
      setMode(current.fields.length ? 'input' : 'review');
    }
  });
  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Text bold color={theme.accentName}>
        Terminal workflows
      </Text>
      <Panel
        title={mode === 'choose' ? 'Find a workflow' : (current?.label ?? 'Workflow')}
        width={cols}
        height={rows - footerLines(SHORTCUTS, ' ', cols) - 2}
        active
      >
        {mode === 'choose' ? (
          <>
            <TextInput
              value={search}
              onChange={(value) => {
                setSearch(value.replace(/[\r\n]/g, ' '));
                setSelected(0);
              }}
              placeholder="Models, files, learning, compose..."
            />
            {filtered.slice(start, start + height).map((workflow, index) => (
              <Text
                key={workflow.id}
                color={start + index === selected ? theme.accentName : theme.dim}
                wrap="truncate-end"
              >
                {start + index === selected ? '> ' : '  '}
                {workflow.label}
              </Text>
            ))}
          </>
        ) : mode === 'input' && current?.fields[field] ? (
          <>
            <Text>{current.fields[field]!.label}</Text>
            <TextInput
              value={values[current.fields[field]!.id] ?? ''}
              onChange={(value) =>
                setValues((values) => ({ ...values, [current.fields[field]!.id]: value }))
              }
              onSubmit={(value) => {
                if (!value.trim()) {
                  setStatus('Enter a value, or Escape to go back.');
                  return;
                }
                if (field + 1 < current.fields.length) setField(field + 1);
                else setMode('review');
              }}
            />
          </>
        ) : mode === 'review' ? (
          reviewLines
            .slice(scroll, scroll + height)
            .map((line) => <Text key={line.id}>{line.text || ' '}</Text>)
        ) : mode === 'report' ? (
          lines
            .slice(scroll, scroll + height)
            .map((line) => <Text key={line.id}>{line.text || ' '}</Text>)
        ) : (
          <Text>Working locally...</Text>
        )}
      </Panel>
      <Text wrap="truncate-end">{status}</Text>
      <Footer
        shortcuts={SHORTCUTS}
        note={
          mode === 'report'
            ? `Lines ${scroll + 1}-${Math.min(lines.length, scroll + height)} of ${lines.length}`
            : undefined
        }
      />
    </Box>
  );
}
