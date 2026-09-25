// SPDX-License-Identifier: MPL-2.0
/**
 * Rebrand in the terminal (plan 274 section 5): pick a .pptx or .pdf, review the plan as a
 * checklist, compile to a folder. The logic lives in `../rebrand-session.ts`; this
 * file only lays it out and binds keys.
 *
 * Four lists, switched with Tab: the review queue (Keep, Replace and Remove on
 * k, e and x, with the scope named on the status row and switched with s; it
 * starts on this object only, as the web view does), the slides (space includes
 * or leaves one out), and the colour and font mappings, which are read-only.
 * Replace is on e, not r, because r is redo in the tool view, and it is offered
 * only when the item names what goes in. Esc asks once before it leaves a review
 * with edits the last compile did not write. Every state is a word on the row, and the selected row is
 * marked with a pointer as well as inverse video, so nothing depends on colour.
 * Fits 80 columns: rows are cut at the edge rather than wrapped. The shortcut row
 * is drawn here rather than through components/Footer.tsx so the view imports no
 * other .tsx file, which keeps its test a single esbuild transform, as Prepare's is.
 */
import { useState } from 'react';
import { dirname, resolve } from 'node:path';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  acceptAll,
  autoMatch,
  checklistOf,
  colourRowText,
  compileTo,
  compiledLines,
  countsLines,
  decideItem,
  expandHome,
  folderState,
  fontRowText,
  openRebrand,
  queueDetail,
  queueIndexAfter,
  queueRowText,
  replacementFor,
  scopeText,
  slideRowText,
  toggleSlide,
  undoLast,
  type RebrandEdit,
  type RebrandScope,
  type RebrandSession,
} from '../rebrand-session.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';

type Mode = 'path' | 'reading' | 'review' | 'output' | 'compiling';
type Section = 'queue' | 'slides' | 'colours' | 'fonts';
const SECTIONS: readonly Section[] = ['queue', 'slides', 'colours', 'fonts'];
const SECTION_NAMES: Record<Section, string> = { queue: 'Queue', slides: 'Slides', colours: 'Colours', fonts: 'Fonts' };

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
// Rows whose place is their meaning (a count row, a detail line, a status line) and
// which never reorder, so the position is the key; two equal lines still differ.
const byPlace = (lines: readonly string[]): Array<{ id: string; text: string }> => lines.map((text, i) => ({ id: `row-${i}`, text }));

export function Rebrand({ onBack }: { onBack: () => void }) {
  const { cols, rows } = useTermSize();
  const [mode, setMode] = useState<Mode>('path');
  const [draft, setDraft] = useState('');
  const [session, setSession] = useState<RebrandSession | null>(null);
  const [section, setSection] = useState<Section>('queue');
  const [sel, setSel] = useState<Record<Section, number>>({ queue: 0, slides: 0, colours: 0, fonts: 0 });
  const [scope, setScope] = useState<RebrandScope>('one');
  // A single line wraps; a list of lines (the compile result) is one row each, cut at the edge.
  const [status, setStatus] = useState<string | string[]>('Type the path to a .pptx or .pdf and press Enter. The file is read on this device.');
  const [confirmCompile, setConfirmCompile] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // The folder the person was asked about making, so a second Enter on the same path makes it.
  const [confirmFolder, setConfirmFolder] = useState<string | null>(null);
  // The plan revision the last compile wrote, or null before the first compile.
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const [pptx, setPptx] = useState(true);

  const list = session ? checklistOf(session) : null;
  const lengthOf = (s: Section): number => !list ? 0 : s === 'queue' ? list.queue.length : s === 'slides' ? list.slides.length : s === 'colours' ? list.colours.length : list.fonts.length;
  const at = Math.min(sel[section], Math.max(0, lengthOf(section) - 1));
  const item = list && section === 'queue' ? list.queue[at] : undefined;
  const canReplace = Boolean(session && item && replacementFor(item, session.plan));

  // Keep the queue selection on the same item after an edit re-sorts the queue, and
  // after a decision move on once the item settles.
  const apply = (edit: RebrandEdit, moveOnSettled = false): void => {
    if (list && edit.session !== session) {
      const current = list.queue[Math.min(sel.queue, Math.max(0, list.queue.length - 1))];
      const next = checklistOf(edit.session).queue;
      setSel(s => ({ ...s, queue: queueIndexAfter(next, current?.id, s.queue, moveOnSettled) }));
      setScope('one');
    }
    setSession(edit.session);
    setStatus(edit.message);
    setConfirmCompile(false);
  };

  // Edits the last compile did not write, in words, or null when there are none.
  const unsaved = (): string | null => {
    if (!session) return null;
    if (savedRevision === null) return session.undo.length > 0 ? `${plural(session.undo.length, 'edit is', 'edits are')} not saved` : null;
    return session.plan.revision !== savedRevision ? 'The edits since the last compile are not saved' : null;
  };

  const read = async (path: string): Promise<void> => {
    setMode('reading');
    setStatus('Reading the deck and making the first pass.');
    try {
      const opened = await openRebrand(path);
      setSession(opened);
      setSel({ queue: 0, slides: 0, colours: 0, fonts: 0 });
      setSection('queue');
      setScope('one');
      setSavedRevision(null);
      setMode('review');
      const n = checklistOf(opened).queue.length;
      setStatus(`Read ${opened.source.slides.length} slides into ${n} queue items. Nothing is written until you compile.`);
    } catch (err) {
      setMode('path');
      setStatus(errText(err));
    }
  };

  const compile = async (dir: string, createFolder: boolean): Promise<void> => {
    if (!session) return;
    setMode('compiling');
    setStatus('Compiling the plan and writing the files.');
    try {
      const result = await compileTo(session, dir, { pptx, createFolder });
      setSavedRevision(session.plan.revision);
      setStatus(compiledLines(result));
    } catch (err) {
      setStatus(errText(err));
    }
    setConfirmFolder(null);
    setMode('review');
  };

  const submitFolder = async (typed: string): Promise<void> => {
    const dir = typed.trim();
    if (!dir) return;
    const full = resolve(expandHome(dir));
    const state = await folderState(dir);
    if (state === 'not-a-folder') {
      setStatus(`${full} is not a folder. Type another folder.`);
      return;
    }
    if (state === 'missing' && confirmFolder !== full) {
      setConfirmFolder(full);
      setStatus(`${full} does not exist yet. Press Enter again to make it and compile, or change the path.`);
      return;
    }
    await compile(dir, state === 'missing');
  };

  useInput((input, key) => {
    if (mode === 'reading' || mode === 'compiling') return;
    if (mode === 'path') {
      if (key.escape) onBack();
      return;
    }
    if (mode === 'output') {
      if (key.escape) { setMode('review'); setConfirmFolder(null); setStatus('Compile cancelled. The plan is as you left it.'); }
      else if (key.tab) setPptx(v => !v);
      return;
    }
    if (!session || !list) return;
    if (key.escape) {
      const left = unsaved();
      if (left && !confirmLeave) {
        setConfirmLeave(true);
        setStatus(`Leave the review? ${left}. Press Esc again to leave, or another key to stay.`);
        return;
      }
      return onBack();
    }
    if (confirmLeave) {
      setConfirmLeave(false);
      setStatus('Staying in the review.');
    }
    if (key.tab) {
      const i = SECTIONS.indexOf(section);
      setSection(SECTIONS[(i + (key.shift ? SECTIONS.length - 1 : 1)) % SECTIONS.length]!);
      return;
    }
    if (key.upArrow || key.downArrow || key.pageUp || key.pageDown) {
      const step = key.pageUp || key.pageDown ? 10 : 1;
      const dir = key.upArrow || key.pageUp ? -step : step;
      const max = Math.max(0, lengthOf(section) - 1);
      setSel(s => ({ ...s, [section]: Math.min(max, Math.max(0, Math.min(s[section], max) + dir)) }));
      if (section === 'queue') setScope('one');
      return;
    }
    if (input === 'u') return apply(undoLast(session));
    // Auto-match (plan 275 decision 28): every slide whose layout read is clear or likely takes it, one undo step.
    if (input === 'm') return apply(autoMatch(session));
    if (input === 'a') return apply(acceptAll(session));
    if (input === 'c') {
      if (list.summary.slides.included === 0) {
        setStatus('Every slide is left out, so there is nothing to compile. Include at least one slide.');
        return;
      }
      if (list.pending > 0 && !confirmCompile) {
        setConfirmCompile(true);
        const flagged = list.pendingAttention > 0 ? `, ${list.pendingAttention} of them flagged as needing attention,` : '';
        setStatus(`${list.pending} ${list.pending === 1 ? 'object waits' : 'objects wait'} for an answer${flagged} and compile as keep. Press c again to compile, or a to accept all suggestions first.`);
        return;
      }
      setConfirmCompile(false);
      setConfirmFolder(null);
      setDraft(dirname(session.path));
      setMode('output');
      setStatus('Type the folder to write into and press Enter. Existing files are never replaced.');
      return;
    }
    if (section === 'queue' && item) {
      if (input === 's') {
        if (item.objectIds.length > 1) setScope(v => (v === 'group' ? 'one' : 'group'));
        return;
      }
      if (input === 'r') {
        setStatus('Redo is not built here. Replace is on e.');
        return;
      }
      const action = input === 'k' ? 'keep' : input === 'e' ? 'replace' : input === 'x' ? 'remove' : null;
      if (action) apply(decideItem(session, item, action, scope), true);
      return;
    }
    if (section === 'slides' && (input === ' ' || key.return)) {
      const slide = list.slides[at];
      if (slide) apply(toggleSlide(session, slide.id));
    }
  });

  const width = Math.max(20, cols - 2);
  const listRows = Math.max(3, rows - 15);
  const len = lengthOf(section);
  const start = Math.max(0, Math.min(at - Math.floor(listRows / 2), len - listRows));
  const rowText = (i: number): string => {
    if (!list) return '';
    if (section === 'queue') return queueRowText(list.queue[i]!);
    if (section === 'slides') return slideRowText(list.slides[i]!);
    if (section === 'colours') return colourRowText(list.colours[i]!);
    return fontRowText(list.fonts[i]!);
  };
  const shown = Array.from({ length: Math.max(0, Math.min(listRows, len - start)) }, (_, k) => start + k);
  const readOnly = section === 'colours' || section === 'fonts';
  const detail = item ? queueDetail(item) : readOnly ? ['Read-only here. Change mappings in the web view or by editing the plan file.'] : [];
  const counts = list ? countsLines(list.summary) : ['Rebrand reads a PowerPoint deck and proposes what to keep, replace and remove.'];
  const statusLines = Array.isArray(status) ? status : null;

  const shortcuts = mode === 'output'
    ? [{ key: 'Enter', label: 'compile' }, { key: 'Tab', label: `.pptx ${pptx ? 'on' : 'off'}` }, { key: 'Esc', label: 'cancel' }]
    : mode === 'path'
      ? [{ key: 'Enter', label: 'read' }, { key: 'Esc', label: 'back' }]
      : [
        { key: 'Tab', label: 'list' },
        { key: 'Up/Down', label: 'move' },
        ...(section === 'queue' ? [{ key: 'k', label: 'keep' }, ...(canReplace ? [{ key: 'e', label: 'replace' }] : []), { key: 'x', label: 'remove' }, { key: 's', label: 'scope' }] : []),
        ...(section === 'slides' ? [{ key: 'Space', label: 'include' }] : []),
        { key: 'a', label: 'accept all' },
        ...(list && list.autoMatch.count > 0 ? [{ key: 'm', label: list.autoMatch.count === 1 ? 'match 1 layout' : `match ${list.autoMatch.count} layouts` }] : []),
        { key: 'u', label: 'undo' },
        { key: 'c', label: 'compile' },
        { key: 'Esc', label: 'back' },
      ];

  return (
    <Box flexDirection="column" width={cols} height={rows} paddingX={1}>
      <Text bold wrap="truncate-end">
        Rebrand{session ? ` · ${session.stem} · design system from the ${session.resolved.profile} profile${session.resolved.neutralMaster ? ', neutral slide master' : ''}` : ''}
      </Text>
      <Box flexDirection="column" height={3} flexShrink={0} overflow="hidden" width={width}>
        {byPlace(counts).map(row => <Text key={row.id} wrap={list ? 'truncate-end' : 'wrap'} color={theme.dim}>{row.text}</Text>)}
      </Box>
      {mode === 'path' || mode === 'reading' ? (
        <Box flexDirection="column" flexGrow={1}>
          <Text>Deck to rebrand (.pptx or .pdf):</Text>
          {mode === 'path' ? <TextInput value={draft} onChange={setDraft} onSubmit={v => { if (v.trim()) void read(v); }} /> : <Text color={theme.dim}>Reading.</Text>}
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          <Text wrap="truncate-end">
            {SECTIONS.map(s => (s === section ? `[${SECTION_NAMES[s]} ${lengthOf(s)}]` : ` ${SECTION_NAMES[s]} ${lengthOf(s)} `)).join('  ')}
          </Text>
          <Box flexDirection="column" height={listRows} flexShrink={0} overflow="hidden">
            {len === 0 ? <Text color={theme.dim}>Nothing in this list.</Text> : shown.map(i => (
              <Text key={i} inverse={i === at} wrap="truncate-end">{i === at ? '> ' : '  '}{rowText(i)}</Text>
            ))}
          </Box>
          <Box flexDirection="column" height={3} flexShrink={0} overflow="hidden">
            {byPlace(detail).map(row => <Text key={row.id} wrap="truncate-end" color={row.id === 'row-0' ? undefined : theme.dim}>{row.text}</Text>)}
          </Box>
          {mode === 'output' ? (
            <Box>
              <Text>Folder: </Text>
              <TextInput value={draft} onChange={v => { setDraft(v); setConfirmFolder(null); }} onSubmit={v => { void submitFolder(v); }} />
            </Box>
          ) : (
            <Text wrap="truncate-end">{item && section === 'queue' ? scopeText(item, scope) : ' '}</Text>
          )}
        </Box>
      )}
      <Box flexDirection="column" height={3} flexShrink={0} overflow="hidden">
        {statusLines
          ? byPlace(statusLines).map(row => <Text key={row.id} wrap="truncate-end">{row.text}</Text>)
          : <Text wrap="wrap">{mode === 'reading' || mode === 'compiling' ? `Working. ${status}` : status}</Text>}
      </Box>
      <Box flexWrap="wrap">
        {shortcuts.map(s => (
          <Text key={s.key}><Text bold color={theme.accentName}>{s.key}</Text><Text color={theme.dim}>{` ${s.label}   `}</Text></Text>
        ))}
      </Box>
    </Box>
  );
}
