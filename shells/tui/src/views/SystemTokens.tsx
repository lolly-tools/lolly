// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system room's token inspector (plan 286 M5): the captured context, one
 * theme choice per group, the issues, a searchable token list and one token's trace.
 * Stepping a choice is a preview and writes nothing; `s` reviews the change and `y`
 * stores the choices on the active terminal system, which CLI and TUI renders then use.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { canonicalJson, inspectTokenDocument } from '@lolly/engine';
import { listTokenRows, storedTokenChoices, tokenIssues, tokenReportContext, traceToken, type TokenTraceStepV1 } from '@lolly-tools/node-shell/token-report';
import { readTerminalTokenSource, stepChoice, storeTerminalChoices, terminalValue, withStoredChoices, type TerminalTokenSource } from '../token-inspector.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { Tabs } from '../components/Tabs.tsx';
import { Footer } from '../components/Footer.tsx';

type Pane = 'list' | 'search' | 'trace' | 'confirm';
interface Review { candidate: Record<string, unknown>; changes: number }

const choiceLine = (choices: Record<string, string>): string => Object.entries(choices).map(([group, id]) => `${group || 'theme'} ${id}`).join(', ');

export function SystemTokens({ onBack }: { onBack: () => void }) {
  const { cols, rows } = useTermSize();
  const compact = rows < 24 || cols < 66;
  const [source, setSource] = useState<TerminalTokenSource | null | undefined>(undefined);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [group, setGroup] = useState(0);
  const [pane, setPane] = useState<Pane>('list');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [trail, setTrail] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  const load = async (message = ''): Promise<void> => {
    const next = await readTerminalTokenSource();
    setSource(next);
    setChoices(next ? storedTokenChoices(next.doc) : {});
    setStatus(message);
  };
  useEffect(() => { void load().catch(e => { setSource(null); setStatus((e as Error).message); }); }, []);

  const stored = useMemo(() => source ? storedTokenChoices(source.doc) : {}, [source]);
  // The stored choices are inspected as stored, so a diagnostic about the document's own
  // selection still shows; only a preview passes its choices explicitly.
  const asked = useMemo(() => canonicalJson(choices) === canonicalJson(stored) ? {} : { selection: choices }, [choices, stored]);
  const inspection = useMemo(() => source ? inspectTokenDocument(source.doc, asked) : null, [source, asked]);
  const context = useMemo(() => source && inspection ? tokenReportContext(source.doc, inspection, source.origin, asked) : null, [source, inspection, asked]);
  const issues = useMemo(() => inspection ? tokenIssues(inspection) : null, [inspection]);
  // Rows left for the list after the tabs, frame, header, status line and footer.
  const pageSize = Math.max(3, rows - (compact ? 13 : 19));
  // The trace header takes more lines than the list's count line.
  const traceRows = Math.max(3, pageSize - (compact ? 4 : 6));
  const list = useMemo(() => inspection ? listTokenRows(inspection, { query, issuesOnly, offset: page * pageSize, limit: pageSize }) : null, [inspection, query, issuesOnly, page, pageSize]);
  const pages = list ? Math.max(1, Math.ceil(list.total / pageSize)) : 1;
  const current = trail.at(-1);
  const trace = useMemo(() => inspection && current ? traceToken(inspection, current) : null, [inspection, current]);
  const steps: { step: TokenTraceStepV1; kind: 'reads' | 'read by' }[] = trace
    ? [...trace.references.map(s => ({ step: s, kind: 'reads' as const })), ...trace.dependents.map(s => ({ step: s, kind: 'read by' as const }))]
    : [];

  // A filter or choice change can shorten the list; keep the page and cursor inside the list.
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);
  useEffect(() => { if (list && cursor >= list.rows.length) setCursor(Math.max(0, list.rows.length - 1)); }, [list, cursor]);
  useEffect(() => { if (step >= steps.length) setStep(Math.max(0, steps.length - 1)); }, [step, steps.length]);

  const stepGroup = (): void => {
    const count = context?.selection.groups.length ?? 0;
    if (count) setGroup(g => (g + 1) % count);
  };
  const stepOption = (): void => {
    if (context?.selection.groups.length) setChoices(c => stepChoice(context.selection, c, group));
  };
  const openReview = (): void => {
    if (!source || !context) return;
    if (!source.writable) { setStatus('This system came with the install and is read-only here. Bring a file or start from a colour to keep choices.'); return; }
    if (!context.preview) { setStatus('These are already the stored choices.'); return; }
    setReview(withStoredChoices(source.doc, choices));
    setPane('confirm');
    setStatus('');
  };
  const store = async (): Promise<void> => {
    if (!source || !review) return;
    setWorking(true);
    try {
      const outcome = await storeTerminalChoices(source, review.candidate);
      setReview(null);
      setPane('list');
      if (outcome === 'stale') await load('The system changed after this review. Its current choices are shown; review again.');
      else await load(`✓ Stored ${choiceLine(choices)} on ${source.origin.label ?? source.origin.id}. Terminal renders use these choices.`);
    } catch (error) { setStatus((error as Error).message); }
    finally { setWorking(false); }
  };

  useInput((input, key) => {
    if (working || source === undefined) return;
    if (pane === 'search') {
      if (key.escape) setPane('list');
      return;
    }
    if (pane === 'confirm') {
      if (input === 'y') void store();
      else if (key.escape || input === 'n') { setReview(null); setPane('list'); setStatus('Nothing was stored.'); }
      return;
    }
    if (input === 'g') return stepGroup();
    if (input === 'o') return stepOption();
    if (input === 'r') { setChoices(stored); setStatus('Back to the stored choices.'); return; }
    if (input === 's') return openReview();
    if (pane === 'trace') {
      if (key.escape || input === 'b') { setTrail(t => t.slice(0, -1)); setStep(0); if (trail.length <= 1) setPane('list'); return; }
      if (key.upArrow || input === 'k') setStep(i => Math.max(0, i - 1));
      else if (key.downArrow || input === 'j') setStep(i => Math.min(Math.max(0, steps.length - 1), i + 1));
      else if (key.return) {
        const picked = steps[step]?.step;
        if (!picked) return;
        if (picked.missing) { setStatus(`No active definition answers ${picked.path} with these choices.`); return; }
        setTrail(t => [...t.slice(-63), picked.path]);
        setStep(0);
        setStatus('');
      }
      return;
    }
    if (key.escape || input === 'b') return onBack();
    if (input === '/') { setDraft(query); setPane('search'); return; }
    if (input === 'x') { setIssuesOnly(v => !v); setPage(0); setCursor(0); return; }
    if (key.upArrow || input === 'k') {
      if (cursor > 0) setCursor(cursor - 1);
      else if (page > 0) { setPage(page - 1); setCursor(pageSize - 1); }
    } else if (key.downArrow || input === 'j') {
      if (list && cursor < list.rows.length - 1) setCursor(cursor + 1);
      else if (page < pages - 1) { setPage(page + 1); setCursor(0); }
    } else if (key.leftArrow || input === 'h') { setPage(p => Math.max(0, p - 1)); setCursor(0); }
    else if (key.rightArrow || input === 'l') { setPage(p => Math.min(pages - 1, p + 1)); setCursor(0); }
    else if (key.return) {
      const picked = list?.rows[cursor];
      if (picked) { setTrail([picked.path]); setStep(0); setPane('trace'); setStatus(''); }
    }
  });

  const header = source && context ? (
    <Box flexDirection="column" flexShrink={0}>
      <Text wrap="truncate">
        <Text color={theme.accentName}>●</Text> <Text bold>{source.origin.label ?? source.origin.id}</Text>
        <Text color={theme.dim}>{source.origin.kind === 'terminal' ? `  terminal system ${source.origin.id}` : `  content profile ${source.origin.id}, read-only`}{compact ? '' : `  ·  revision ${context.revision.slice(7, 19)}`}</Text>
      </Text>
      {context.selection.groups.length ? (
        <Text wrap="truncate">
          <Text color={theme.dim}>Choices </Text>
          {context.selection.groups.map((g, i) => {
            const id = context.selection.choices[g.id];
            const name = g.options.find(o => o.id === id)?.name ?? id;
            return (
              <Text key={g.id || `group-${i}`}>
                <Text inverse={i === group}>{`${g.id || 'Theme'}: ${name}`}</Text>
                <Text color={theme.dim}>{context.selection.defaults.includes(g.id) ? ' (default)' : ''}{i < context.selection.groups.length - 1 ? '  ' : ''}</Text>
              </Text>
            );
          })}
          {context.preview ? <Text color={theme.warn}>  Preview</Text> : null}
        </Text>
      ) : <Text color={theme.dim}>No theme groups. Every set applies.</Text>}
      {compact ? null : <Text color={theme.dim} wrap="truncate">Set order {context.selection.sets.join(' → ') || 'one implicit set'}</Text>}
      <Text color={issues && (issues.diagnostics.length || issues.withIssues) ? theme.warn : theme.dim} wrap="truncate">
        {issues && (issues.diagnostics.length || issues.withIssues)
          ? `${issues.diagnostics.length ? `${issues.diagnostics[0]!.message}${issues.diagnostics.length > 1 ? ` (+${issues.diagnostics.length - 1} more)` : ''}  ` : ''}${issues.withIssues ? `${issues.withIssues} token${issues.withIssues === 1 ? '' : 's'} with issues; x lists them` : ''}`
          : 'No issues found in this document.'}
      </Text>
    </Box>
  ) : null;

  const valueWidth = Math.max(12, cols - 50);
  // The trace keeps the selected step in view, centred where the list allows.
  const windowStart = Math.max(0, Math.min(step - Math.floor(traceRows / 2), steps.length - traceRows));
  const body = source === undefined ? <Text color={theme.dim}>Reading the design system…</Text>
    : !source || !inspection || !list ? <Text color={theme.dim}>No design tokens to inspect. Bring a file or start from one colour first.</Text>
    : pane === 'trace' && trace ? (
      <Box flexDirection="column" flexShrink={0}>
        <Text wrap="truncate"><Text bold>{trace.path}</Text><Text color={theme.dim}>  {trace.type ?? 'unknown type'}  ·  {trace.source ? `winning set ${trace.source.set ?? 'implicit'}` : 'no active definition'}</Text></Text>
        <Text wrap="truncate"><Text color={theme.dim}>Authored  </Text>{terminalValue(trace.authored, cols - 14)}</Text>
        <Text wrap="truncate"><Text color={theme.dim}>Resolved  </Text>{terminalValue(trace.resolved, cols - 14)}</Text>
        {compact ? null : <Text wrap="truncate" color={theme.dim}>Override order  {trace.candidates.map(c => `${c.set ?? 'implicit'} (${c === trace.source ? 'winning' : c.active ? 'overridden' : 'inactive'})`).join(' · ') || 'none'}</Text>}
        <Text wrap="truncate" color={trace.diagnostics.length ? theme.warn : theme.dim}>{trace.diagnostics.length ? `Issues  ${trace.diagnostics.map(d => d.message).join(' ')}` : 'Issues  none'}</Text>
        {compact || !trace.declaredConsumers.length ? null : <Text wrap="truncate" color={theme.dim}>Declared roles  {trace.declaredConsumers.map(c => `${c.label} (${c.roleId})`).join(', ')}</Text>}
        <Text color={theme.dim}>{`Reads ${trace.references.length} · read by ${trace.dependents.length}${trace.truncated ? ' · stopped at a limit' : ''}  (token references in this document only)`}</Text>
        {steps.length ? steps.slice(windowStart, windowStart + traceRows).map(({ step: s, kind }, n) => (
          <Text key={`${kind}:${s.path}`} inverse={windowStart + n === step} wrap="truncate">
            {windowStart + n === step ? '›' : ' '} {kind === 'reads' ? 'reads   ' : 'read by '} {'  '.repeat(s.depth - 1)}{s.path}  <Text color={s.missing ? theme.warn : theme.dim}>{s.missing ? 'missing' : terminalValue(s.resolved, valueWidth)}</Text>
          </Text>
        )) : <Text color={theme.dim}>This token reads no other token and no token reads this one.</Text>}
      </Box>
    ) : (
      <Box flexDirection="column" flexShrink={0}>
        {pane === 'search' ? (
          <Box borderStyle="single" borderColor={theme.accentName} paddingX={1} flexShrink={0}>
            <Text>Search paths › </Text>
            <TextInput value={draft} onChange={setDraft} onSubmit={value => { setQuery(value.trim()); setPage(0); setCursor(0); setPane('list'); }} focus />
          </Box>
        ) : null}
        <Text color={theme.dim} wrap="truncate">{`${list.total} token${list.total === 1 ? '' : 's'}${query ? ` matching "${query}"` : ''}${issuesOnly ? ' with issues' : ''} · page ${Math.min(page + 1, pages)} of ${pages}`}</Text>
        {list.rows.slice(0, pane === 'search' ? Math.max(1, pageSize - 3) : pane === 'confirm' ? Math.max(1, pageSize - 4) : undefined).map((row, i) => (
          <Text key={row.path} inverse={pane === 'list' && i === cursor} wrap="truncate">
            {pane === 'list' && i === cursor ? '›' : ' '} {row.path}  <Text color={theme.dim}>{row.type ?? 'unknown'}{row.active ? ` · ${row.set ?? 'implicit'}` : ' · inactive'}  {row.active ? terminalValue(row.resolved, valueWidth) : ''}</Text>{row.issues ? <Text color={theme.warn}>  {row.issues} issue{row.issues === 1 ? '' : 's'}</Text> : null}
          </Text>
        ))}
        {!list.rows.length ? <Text color={theme.dim}>{query || issuesOnly ? 'Nothing matches. Press / to search again or x to show every token.' : 'This document defines no tokens.'}</Text> : null}
      </Box>
    );

  const confirm = pane === 'confirm' && review && source ? (
    <Box marginTop={1} flexDirection="column" flexShrink={0}>
      <Text bold>{`Store ${choiceLine(choices)} on ${source.origin.label ?? source.origin.id}?`}</Text>
      <Text color={theme.dim}>{`${review.changes} resolved value${review.changes === 1 ? '' : 's'} change. Terminal renders and exports of this system use the stored choices.`}</Text>
    </Box>
  ) : null;

  const shortcuts = pane === 'confirm' ? [{ key: 'y', label: 'store' }, { key: 'esc', label: 'keep reviewing' }]
    : pane === 'search' ? [{ key: 'enter', label: 'search' }, { key: 'esc', label: 'cancel' }]
      : pane === 'trace' ? [{ key: '↑↓', label: 'step' }, { key: 'enter', label: 'open' }, { key: 'g/o', label: 'choice' }, { key: 'r', label: 'stored' }, { key: 's', label: 'store' }, { key: 'esc', label: 'back' }]
        : [{ key: '↑↓', label: 'move' }, { key: '←→', label: 'page' }, { key: 'enter', label: 'trace' }, { key: '/', label: 'search' }, { key: 'x', label: 'issues' }, { key: 'g/o', label: 'choice' }, { key: 'r', label: 'stored' }, { key: 's', label: 'store' }, { key: 'esc', label: 'back' }];

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Tabs active="system" />
      <Box marginX={1} marginTop={compact ? 0 : 1} paddingX={2} paddingY={compact ? 0 : 1} borderStyle="round" borderColor={theme.accentName} flexDirection="column" flexGrow={1}>
        {compact ? null : <Text bold color={theme.accentName}>DESIGN TOKENS</Text>}
        {header}
        {compact ? null : <Text> </Text>}
        {body}
        {confirm}
        {status ? <Box marginTop={1}><Text color={status.startsWith('✓') ? theme.accentName : theme.warn} wrap="truncate">{status}</Text></Box> : null}
      </Box>
      <Footer shortcuts={shortcuts} note={pane === 'list' && !compact ? 'g picks a theme group, o steps its choice. Choices are a preview until stored.' : undefined} />
    </Box>
  );
}
