// SPDX-License-Identifier: MPL-2.0
/**
 * Projects - saved sessions (see store.ts) organised into nestable FOLDERS (see
 * folders.ts), the terminal analogue of the web /p view. The list shows the folders
 * at the current level plus the sessions that live here (at the top level that's the
 * "uncategorised" bucket - every session in no folder). Drill into a folder with ⏎,
 * back out with ← / esc.
 *
 * Keys: n new folder · ⏎/o open (folder → drill in, session → reopen the tool) ·
 * m move a session into a folder · R rename folder · d delete (folder = cascade, the
 * sessions it held survive as uncategorised; session = delete the saved project) ·
 * e export the folder → pick a format → optional ZIP password → a live <Progress>
 * panel that renders the whole subtree to one nested .zip on the Desktop.
 *
 * Formats: the picker offers the union of the batch's tools' declared formats (svg
 * default). svg/emf/eps + data formats render DOM-free; raster/pdf/video render via the
 * scoped Chromium tier once `lolly install-browser` has run - when it's missing, those
 * rows fall back to HTML with a per-row note (never silently). See batch-export.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { basename, dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { parseBatchCsv, type BatchRow } from '@lolly/engine';
import { NODE_FORMATS } from '@lolly-tools/node-shell/raster';
import { browserInstalled } from '@lolly-tools/node-shell/browsers';
import { loadTools } from '../catalog.ts';
import { listSessions, deleteSession, renameSession, configDir } from '../store.ts';
import type { SavedSession } from '../store.ts';
import {
  listFolders, createFolder, renameFolder, removeFolder, moveItem, prune,
  childFolders, uncategorisedRefs, folderPath,
} from '../folders.ts';
import type { Folder } from '../folders.ts';
import { exportFolder, exportSessions, exportBatchRows, planFolderRefs } from '../batch-export.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { Tabs } from '../components/Tabs.tsx';
import { Panel } from '../components/Panel.tsx';
import { Footer } from '../components/Footer.tsx';
import { Progress } from '../components/Progress.tsx';
import type { TuiBridge } from '../bridge.ts';
import type { NavTarget } from '../nav.ts';

type Row = { kind: 'folder'; folder: Folder } | { kind: 'session'; session: SavedSession };
type Mode = 'browse' | 'creating' | 'renaming' | 'confirmDelFolder' | 'confirmDelSession' | 'moveTarget' | 'formatPick' | 'zipPrompt' | 'csvPrompt' | 'exporting';
interface Prog { done: number; total: number; log: string[]; finished: boolean; note?: string }
// What a pending zip export renders: a folder subtree, a ticked set of sessions, or CSV rows.
type PendingBatch =
  | { kind: 'folder'; folder: Folder }
  | { kind: 'sessions'; sessions: SavedSession[]; name: string }
  | { kind: 'csv'; rows: BatchRow[]; name: string };

export function Projects({ toolName, folderId, bridge, onOpen, onOpenFolder, onNav, onQuit }: {
  toolName: (id: string) => string;
  folderId: string | null;
  bridge: TuiBridge;
  onOpen: (s: SavedSession) => void;
  onOpenFolder: (id: string | null) => void;
  onNav: (t: NavTarget) => void;
  onQuit: () => void;
}) {
  const { cols, rows: termRows } = useTermSize();
  const [sessions, setSessions] = useState<SavedSession[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>('browse');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  // captured action targets
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameSlot, setRenameSlot] = useState<string | null>(null);
  const [delFolder, setDelFolder] = useState<Folder | null>(null);
  const [delSession, setDelSession] = useState<SavedSession | null>(null);
  const [moveSession, setMoveSession] = useState<SavedSession | null>(null);
  const [moveSel, setMoveSel] = useState(0);
  const [exportTarget, setExportTarget] = useState<Folder | null>(null);
  const [prog, setProg] = useState<Prog | null>(null);
  // Multiselect: ticked session slots (space), and the pending batch a zip export renders.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingBatch | null>(null);
  // Format step: declared formats per tool (catalog index), the staged batch's choices,
  // and the highlighted one. The chosen format is passed to the batch as opts.format.
  const [toolFormats, setToolFormats] = useState<Map<string, string[]>>(new Map());
  const [fmtChoices, setFmtChoices] = useState<string[]>([]);
  const [fmtSel, setFmtSel] = useState(0);

  const reload = async (): Promise<void> => {
    const s = await listSessions();
    await prune(s.map(x => x.slot));           // self-heal folder refs to deleted sessions
    const f = await listFolders();
    setSessions(s);
    setFolders(f);
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    // Declared formats from the generated catalog index (same source as the gallery) -
    // on any read failure the picker still offers svg + the html fallback.
    loadTools()
      .then(ts => setToolFormats(new Map(ts.map(t => [t.id, (t.formats ?? []).map(f => f.toLowerCase())]))))
      .catch(() => {});
  }, []);

  const fs = folders ?? [];
  const ss = sessions ?? [];
  const currentFolder = folderId != null ? fs.find(f => f.id === folderId) ?? null : null;

  // If we're pointed at a folder that no longer exists (deleted while viewing), pop to root.
  useEffect(() => {
    if (folders && folderId != null && !currentFolder) onOpenFolder(null);
  }, [folders, folderId, currentFolder, onOpenFolder]);

  const rows = useMemo<Row[]>(() => {
    const bySlot = new Map(ss.map(s => [s.slot, s]));
    const folderRows: Row[] = childFolders(fs, folderId).map(f => ({ kind: 'folder', folder: f }));
    let refs: string[];
    if (folderId == null) refs = uncategorisedRefs(fs, ss.map(s => s.slot));
    else refs = (currentFolder?.items ?? []).map(it => it.ref).filter(r => bySlot.has(r));
    const sessRows: Row[] = refs.map(r => ({ kind: 'session', session: bySlot.get(r)! }));
    return [...folderRows, ...sessRows];
  }, [folders, sessions, folderId, currentFolder]);

  const clamped = Math.min(Math.max(sel, 0), Math.max(0, rows.length - 1));

  // Flattened folder tree (indented) as move targets, plus an "uncategorised" option.
  const moveTargets = useMemo<Array<{ id: string | null; name: string; depth: number }>>(() => {
    const out: Array<{ id: string | null; name: string; depth: number }> = [{ id: null, name: '- Uncategorised (no folder) -', depth: 0 }];
    const walk = (parent: string | null, depth: number): void => {
      for (const f of childFolders(fs, parent)) { out.push({ id: f.id, name: f.name, depth }); walk(f.id, depth + 1); }
    };
    walk(null, 0);
    return out;
  }, [folders]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const submitCreate = (v: string): void => {
    const name = v.trim();
    setMode('browse'); setDraft('');
    if (!name) return;
    createFolder(name, folderId).then(() => reload().then(() => setStatus(`✓ Created folder “${name}”`))).catch(e => setStatus((e as Error).message));
  };
  const submitRename = (v: string): void => {
    const name = v.trim(); const id = renameId; const slot = renameSlot;
    setMode('browse'); setDraft(''); setRenameId(null); setRenameSlot(null);
    if (!name) return;
    const done = () => reload().then(() => setStatus(`✓ Renamed to “${name}”`));
    if (slot) renameSession(slot, name).then(done).catch(e => setStatus((e as Error).message));
    else if (id) renameFolder(id, name).then(done).catch(e => setStatus((e as Error).message));
  };
  const doDeleteFolder = (): void => {
    const f = delFolder; setDelFolder(null);
    if (!f) return;
    removeFolder(f.id).then(() => reload().then(() => setStatus(`✓ Deleted folder “${f.name}” (its projects kept)`))).catch(e => setStatus((e as Error).message));
  };
  const doDeleteSession = (): void => {
    const s = delSession; setDelSession(null);
    if (!s) return;
    deleteSession(s.slot).then(() => reload().then(() => setStatus(`✓ Deleted project “${s.label}”`))).catch(e => setStatus((e as Error).message));
  };
  const doMove = (): void => {
    const s = moveSession; const target = moveTargets[moveSel];
    setMode('browse'); setMoveSession(null);
    if (!s || !target) return;
    moveItem(s.slot, target.id).then(() => reload().then(() => setStatus(`✓ Moved “${s.label}” → ${target.id == null ? 'Uncategorised' : target.name}`))).catch(e => setStatus((e as Error).message));
  };

  // Stage a batch → the format step. Choices = the union of the batch's tools' declared
  // formats plus the universal html fallback, svg preselected (node-native first).
  const stageBatch = (batch: PendingBatch): void => {
    let ids: string[];
    if (batch.kind === 'csv') ids = batch.rows.map(r => r.toolId);
    else if (batch.kind === 'sessions') ids = batch.sessions.map(s => s.toolId);
    else {
      const bySlot = new Map(ss.map(s => [s.slot, s]));
      ids = planFolderRefs(batch.folder, fs).map(p => bySlot.get(p.ref)?.toolId).filter((id): id is string => Boolean(id));
    }
    const union = new Set<string>();
    for (const id of ids) for (const f of toolFormats.get(id) ?? ['svg']) union.add(f);
    if (union.size === 0) union.add('svg');
    union.add('html');
    const rank = (f: string): number => (f === 'svg' ? 0 : NODE_FORMATS.includes(f) ? 1 : f === 'png' ? 2 : 3);
    const choices = [...union].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    setPending(batch);
    setFmtChoices(choices);
    setFmtSel(Math.max(0, choices.indexOf('svg')));
    setDraft('');
    setMode('formatPick');
  };

  const submitZip = (v: string): void => {
    const password = v.trim();
    setDraft('');
    const batch = pending;
    if (!batch) { setMode('browse'); return; }
    setMode('exporting');
    setProg({ done: 0, total: 0, log: [], finished: false });
    const onProgress = (done: number, total: number, label: string): void =>
      setProg(p => ({ done, total, log: [...(p?.log ?? []), label], finished: false }));
    const common = { zipPassword: password || undefined, onProgress, format: fmtChoices[fmtSel] ?? 'svg' };
    const run =
      batch.kind === 'folder' ? exportFolder(bridge.host, bridge.dom, batch.folder, fs, common)
      : batch.kind === 'sessions' ? exportSessions(bridge.host, bridge.dom, batch.sessions, { ...common, name: batch.name })
      : exportBatchRows(bridge.host, bridge.dom, batch.rows, { ...common, name: batch.name });
    run
      .then(res => setProg(p => ({
        done: res.count, total: p?.total || res.count, log: p?.log ?? [], finished: true,
        note: `✓ wrote ${basename(res.zipPath)} (${res.count} file${res.count === 1 ? '' : 's'}) to ${dirname(res.zipPath)}${password ? '  (🔒 zip locked)' : ''}`,
      })))
      .catch(e => setProg(p => ({ done: p?.done ?? 0, total: p?.total ?? 0, log: p?.log ?? [], finished: true, note: `✗ ${(e as Error).message}` })));
  };
  // Read a CSV/TSV file of batch rows (engine parseBatchCsv) → stage a zip export of them.
  const submitCsv = (v: string): void => {
    const raw = v.trim();
    setDraft('');
    if (!raw) { setMode('browse'); return; }
    const path = raw.startsWith('~') ? resolve(homedir(), raw.slice(1).replace(/^\//, '')) : resolve(process.cwd(), raw);
    readFile(path, 'utf8')
      .then(text => {
        const rows = parseBatchCsv(text);
        if (!rows.length) { setMode('browse'); setStatus('No rows found (need a header row with a toolId column).'); return; }
        setStatus(`${rows.length} row${rows.length === 1 ? '' : 's'} loaded - pick the default format (rows with their own format column keep it).`);
        stageBatch({ kind: 'csv', rows, name: basename(path).replace(/\.[^.]+$/, '') });
      })
      .catch(e => { setMode('browse'); setStatus(`Couldn't read ${raw}: ${(e as Error).message}`); });
  };
  const dismissExport = (): void => { setMode('browse'); setProg(null); setExportTarget(null); setPending(null); setSelected(new Set()); void reload(); };

  // ── Input ──────────────────────────────────────────────────────────────────
  useInput((input, key) => {
    // Text-entry modes: the TextInput owns typing/submit; esc cancels (zipPrompt steps
    // back to the format picker - the batch is still staged).
    if (mode === 'creating' || mode === 'renaming' || mode === 'zipPrompt' || mode === 'csvPrompt') {
      if (key.escape) {
        if (mode === 'zipPrompt') { setDraft(''); setMode('formatPick'); return; }
        setMode('browse'); setDraft(''); setRenameId(null); setRenameSlot(null); setPending(null);
      }
      return;
    }
    if (mode === 'formatPick') {
      if (key.escape) { setMode('browse'); setPending(null); setExportTarget(null); setStatus(''); return; }
      if (key.upArrow || input === 'k') { setFmtSel(s => Math.max(0, s - 1)); return; }
      if (key.downArrow || input === 'j') { setFmtSel(s => Math.min(Math.max(0, fmtChoices.length - 1), s + 1)); return; }
      if (key.return || input === 'o' || input === 'l') { setDraft(''); setStatus(''); setMode('zipPrompt'); return; }
      return;
    }
    if (mode === 'exporting') {
      if (prog?.finished && (key.return || key.escape || input.length > 0)) dismissExport();
      return;
    }
    if (mode === 'confirmDelFolder') { if (input === 'y') doDeleteFolder(); setMode('browse'); return; }
    if (mode === 'confirmDelSession') { if (input === 'y') doDeleteSession(); setMode('browse'); return; }
    if (mode === 'moveTarget') {
      if (key.escape) { setMode('browse'); setMoveSession(null); return; }
      if (key.upArrow || input === 'k') { setMoveSel(s => Math.max(0, s - 1)); return; }
      if (key.downArrow || input === 'j') { setMoveSel(s => Math.min(moveTargets.length - 1, s + 1)); return; }
      if (key.return || input === 'o') { doMove(); return; }
      return;
    }

    // browse
    if (input === '1') return onNav('tools');
    if (input === '3') return onNav('profile');
    if (input === '4') return onNav('catalog');
    if (input === '5') return onNav('system');
    if (input === 'q') return onQuit();
    if ((key.leftArrow || key.escape || key.backspace || input === 'h') && folderId != null) {
      onOpenFolder(currentFolder?.parentId ?? null); setSel(0); setStatus(''); return;
    }
    if (key.upArrow || input === 'k') { setSel(s => Math.max(0, s - 1)); return; }
    if (key.downArrow || input === 'j') { setSel(s => Math.min(Math.max(0, rows.length - 1), s + 1)); return; }
    if (input === 'r') { void reload(); return; }
    if (input === 'n') { setDraft(''); setStatus(''); setMode('creating'); return; }
    // CSV/data batch (the same rows the CLI `batch` subcommand renders) → one zip.
    if (input === 'c') { setDraft(''); setStatus(''); setMode('csvPrompt'); return; }

    const row = rows[clamped];
    // Space ticks a session for the multiselect batch (b). Folders aren't tickable.
    if (input === ' ' && row?.kind === 'session') {
      const slot = row.session.slot;
      setSelected(prev => { const next = new Set(prev); next.has(slot) ? next.delete(slot) : next.add(slot); return next; });
      setSel(s => Math.min(Math.max(0, rows.length - 1), s + 1));   // advance so ticking a run is fast
      return;
    }
    // Batch the ticked sessions (across folders) → one zip.
    if (input === 'b') {
      const bySlot = new Map(ss.map(s => [s.slot, s]));
      const picked = [...selected].map(slot => bySlot.get(slot)).filter((s): s is SavedSession => Boolean(s));
      if (!picked.length) { setStatus('Tick projects with space first, then b to batch them into one zip.'); return; }
      setStatus('');
      stageBatch({ kind: 'sessions', sessions: picked, name: `selection-${picked.length}` });
      return;
    }
    if ((key.return || key.rightArrow || input === 'o' || input === 'l')) {
      if (row?.kind === 'folder') { onOpenFolder(row.folder.id); setSel(0); setStatus(''); return; }
      if (row?.kind === 'session') { onOpen(row.session); return; }
    }
    if (input === 'm' && row?.kind === 'session') {
      setMoveSession(row.session);
      setMoveSel(0);
      setStatus('');
      setMode('moveTarget');
      return;
    }
    if (input === 'R' && row?.kind === 'folder') {
      setRenameSlot(null); setRenameId(row.folder.id); setDraft(row.folder.name); setStatus(''); setMode('renaming'); return;
    }
    if (input === 'R' && row?.kind === 'session') {
      setRenameId(null); setRenameSlot(row.session.slot); setDraft(row.session.label); setStatus(''); setMode('renaming'); return;
    }
    if (input === 'd') {
      if (row?.kind === 'folder') { setDelFolder(row.folder); setMode('confirmDelFolder'); return; }
      if (row?.kind === 'session') { setDelSession(row.session); setMode('confirmDelSession'); return; }
    }
    if (input === 'e') {
      // Export the folder you're IN; at the top level, the highlighted folder row.
      const folder = currentFolder ?? (row?.kind === 'folder' ? row.folder : null);
      if (!folder) { setStatus('Open a folder (or highlight one) to export it as a zip.'); return; }
      setExportTarget(folder); setStatus('');
      stageBatch({ kind: 'folder', folder });
      return;
    }
  });

  // ── Layout ─────────────────────────────────────────────────────────────────
  const bodyH = Math.max(6, termRows - 5);                    // tabs(1)+subtitle(1)+prompt(1)+footer(2)
  const visible = Math.max(1, bodyH - 2);                     // panel border rows
  const startIdx = Math.max(0, Math.min(clamped, Math.max(0, rows.length - visible)));
  const windowed = rows.slice(startIdx, startIdx + visible);
  const range = rows.length > visible ? `  ${startIdx + 1}-${Math.min(startIdx + visible, rows.length)}/${rows.length}` : '';

  const crumb = folderId != null ? folderPath(fs, folderId) : [];
  const breadcrumb = 'Projects' + crumb.map(f => `  ›  ${f.name}`).join('');
  const topFolders = childFolders(fs, null).length;
  const uncat = uncategorisedRefs(fs, ss.map(s => s.slot)).length;
  const tickNote = selected.size > 0 ? `  ·  ✓ ${selected.size} ticked (b = batch)` : '';
  const subtitle = (folderId != null
    ? breadcrumb
    : `${topFolders} folder${topFolders === 1 ? '' : 's'} · ${uncat} uncategorised · ${configDir()}`) + tickNote;

  const panelTitle = (folderId != null ? (currentFolder?.name ?? 'Folder') : 'Projects') + range;

  // Move-target window.
  const mVisible = Math.max(1, bodyH - 2);
  const mStart = Math.max(0, Math.min(moveSel, Math.max(0, moveTargets.length - mVisible)));
  const mWindow = moveTargets.slice(mStart, mStart + mVisible);

  const listPanel = (
    <Panel title={panelTitle} width={cols} height={bodyH} active>
      {sessions === null || folders === null
        ? <Text color={theme.dim}>Loading…</Text>
        : rows.length === 0
          ? <Text color={theme.dim} wrap="wrap">{folderId != null
              ? 'Empty folder - press n for a sub-folder, or move a project in with m from the top level.'
              : 'No folders or projects yet - press n to make a folder, or open a tool and press s to save a project.'}</Text>
          : windowed.map((row, i) => {
            const active = startIdx + i === clamped;
            if (row.kind === 'folder') {
              const subCount = childFolders(fs, row.folder.id).length;
              const meta = `  · ${row.folder.items.length} project${row.folder.items.length === 1 ? '' : 's'}${subCount ? ` · ${subCount} folder${subCount === 1 ? '' : 's'}` : ''}`;
              return (
                <Text key={'f-' + row.folder.id} wrap="truncate-end">
                  <Text color={active ? theme.accentName : undefined}>{active ? '▸ ' : '  '}📁 {row.folder.name}</Text>
                  <Text color={theme.dim}>{meta}</Text>
                </Text>
              );
            }
            const s = row.session;
            const ticked = selected.has(s.slot);
            return (
              <Text key={'s-' + s.slot} wrap="truncate-end">
                <Text color={active ? theme.accentName : undefined}>{active ? '▸ ' : '  '}</Text>
                <Text color={theme.accentName}>{ticked ? '✓ ' : ''}</Text>
                <Text color={active ? theme.accentName : undefined}>{s.label}</Text>
                <Text color={theme.dim}>{'  · ' + toolName(s.toolId) + ' · ' + rel(s.updatedAt)}</Text>
              </Text>
            );
          })}
    </Panel>
  );

  const movePanel = (
    <Panel title={`Move “${moveSession?.label ?? ''}” into…`} width={cols} height={bodyH} active>
      {mWindow.map((t, i) => {
        const idx = mStart + i;
        const active = idx === moveSel;
        return (
          <Text key={t.id ?? '__none__'} wrap="truncate-end">
            <Text color={active ? theme.accentName : undefined}>{active ? '▸ ' : '  '}{'  '.repeat(t.depth)}{t.id == null ? '' : '📁 '}{t.name}</Text>
          </Text>
        );
      })}
    </Panel>
  );

  const batchName = pending?.kind === 'folder' ? pending.folder.name : pending ? pending.name : (exportTarget?.name ?? '');

  // Format step: node-native formats need nothing; png rasterises the tool's own SVG via
  // resvg when it has one; everything else needs the scoped Chromium (Tier B).
  const browserOk = browserInstalled();
  const tierNoteOf = (f: string): string => {
    if (NODE_FORMATS.includes(f)) return '';
    if (f === 'png') return browserOk ? 'browser tier for HTML-layout tools' : 'browser tier missing - HTML-layout tools fall back to HTML';
    return browserOk ? 'browser tier' : 'browser tier missing - falls back to HTML';
  };
  const fVisible = Math.max(1, bodyH - 2 - (pending?.kind === 'csv' ? 1 : 0));
  const fStart = Math.max(0, Math.min(fmtSel, Math.max(0, fmtChoices.length - fVisible)));
  const fWindow = fmtChoices.slice(fStart, fStart + fVisible);
  const formatPanel = (
    <Panel title={`Export format · ${batchName}`} width={cols} height={bodyH} active>
      {fWindow.map((f, i) => {
        const active = fStart + i === fmtSel;
        const tier = tierNoteOf(f);
        return (
          <Text key={f} wrap="truncate-end">
            <Text color={active ? theme.accentName : undefined}>{active ? '▸ ' : '  '}{f.toUpperCase()}</Text>
            {tier ? <Text color={theme.dim}>{'  · ' + tier}</Text> : null}
          </Text>
        );
      })}
      {pending?.kind === 'csv'
        ? <Text color={theme.dim} wrap="truncate-end">CSV rows with their own format column keep it - this picks the default.</Text>
        : null}
    </Panel>
  );

  const body = mode === 'exporting' && prog
    ? <Progress title={`Export · ${batchName}`} done={prog.done} total={prog.total} log={prog.log} width={cols} height={bodyH} active finished={prog.finished} note={prog.note} />
    : mode === 'moveTarget'
      ? movePanel
      : mode === 'formatPick'
        ? formatPanel
        : listPanel;

  const promptRow = (
    <Box height={1} paddingX={1}>
      {mode === 'creating'
        ? <Text><Text color={theme.accentName}>New folder name: </Text><TextInput value={draft} onChange={setDraft} onSubmit={submitCreate} /></Text>
        : mode === 'renaming'
          ? <Text><Text color={theme.accentName}>{renameSlot ? 'Rename project: ' : 'Rename folder: '}</Text><TextInput value={draft} onChange={setDraft} onSubmit={submitRename} /></Text>
          : mode === 'zipPrompt'
            ? <Text><Text color={theme.accentName}>ZIP password (blank = none): </Text><TextInput value={draft} onChange={setDraft} onSubmit={submitZip} mask="*" /></Text>
            : mode === 'csvPrompt'
              ? <Text><Text color={theme.accentName}>CSV/TSV path (header w/ toolId column): </Text><TextInput value={draft} onChange={setDraft} onSubmit={submitCsv} /></Text>
              : <Text color={status.startsWith('✓') ? theme.accentName : theme.dim} wrap="truncate-end">{status || ' '}</Text>}
    </Box>
  );

  return (
    <Box flexDirection="column" width={cols} height={termRows}>
      <Tabs active="projects" />
      <Box paddingX={1}>
        <Text color={theme.dim} wrap="truncate-end">{subtitle}</Text>
      </Box>
      {body}
      {promptRow}
      <Footer note={footerNote(mode, delFolder, delSession)} shortcuts={footerShortcuts(mode, folderId, prog)} />
    </Box>
  );
}

function footerNote(mode: Mode, delFolder: Folder | null, delSession: SavedSession | null): string | undefined {
  if (mode === 'confirmDelFolder') return `Delete folder “${delFolder?.name}” and its sub-folders? The saved projects survive as uncategorised.  y / n`;
  if (mode === 'confirmDelSession') return `Delete project “${delSession?.label}”?  y / n`;
  if (mode === 'zipPrompt') return 'This locks the .zip itself. Enter with a blank leaves it unlocked.';
  if (mode === 'formatPick') {
    return browserInstalled()
      ? 'j/k choose · ⏎ use format · esc cancel'
      : 'Browser tier not installed - run `lolly install-browser` once for raster/pdf/video; those rows fall back to HTML.';
  }
  if (mode === 'moveTarget') return 'j/k choose · ⏎ move here · esc cancel';
  return undefined;
}

function footerShortcuts(mode: Mode, folderId: string | null, prog: Prog | null): Array<{ key: string; label: string }> {
  if (mode === 'exporting') return prog?.finished ? [{ key: '⏎', label: 'close' }] : [{ key: '…', label: 'exporting - please wait' }];
  if (mode === 'formatPick') return [{ key: 'j/k', label: 'choose' }, { key: '⏎', label: 'use format' }, { key: 'esc', label: 'cancel' }];
  if (mode === 'moveTarget') return [{ key: 'j/k', label: 'choose' }, { key: '⏎', label: 'move here' }, { key: 'esc', label: 'cancel' }];
  return [
    { key: 'j/k', label: 'move' },
    { key: '⏎/o', label: 'open' },
    { key: 'spc', label: 'tick' },
    { key: 'b', label: 'batch ticked' },
    { key: 'c', label: 'CSV batch' },
    { key: 'n', label: 'new folder' },
    { key: 'm', label: 'file into' },
    { key: 'd', label: 'delete' },
    { key: 'e', label: 'export zip' },
    ...(folderId != null ? [{ key: '←/esc', label: 'up' }] : []),
    { key: 'q', label: 'quit' },
  ];
}

function rel(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
