// SPDX-License-Identifier: MPL-2.0
/**
 * Tool gallery - the terminal analogue of the web gallery grid. Responsive: it packs
 * as many fixed-width cards per row as the terminal is wide (desktop grid), collapsing
 * to a single column on a narrow terminal (mobile). Keyboard-first: arrows or hjkl to
 * move, `/` to search, Enter to open, `q` to quit.
 */
import { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ToolEntry } from '../catalog.ts';
import type { NavTarget } from '../nav.ts';
import { getProfile, setProfile } from '../store.ts';
import { loadToolFavourites, withToolFavouriteToggled, sortTools, TOOL_SORTS, TOOL_SORT_LABEL } from '../lib/tool-favourites.ts';
import type { ToolSort } from '../lib/tool-favourites.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { Footer } from '../components/Footer.tsx';
import { Tabs } from '../components/Tabs.tsx';
import { fmtEmoji, catEmoji, toolIcon } from '../emoji.ts';
import { isBrowserOnly } from '../tool-support.ts';

const CARD_W = 26;
const CARD_H = 4;   // border(2) + name(1) + subtitle(1) - cards never shrink below this

export function Gallery({ tools, onOpen, onOpenUrl, onImportFile, onNav, onQuit, onPrepare }: { tools: ToolEntry[]; onPrepare: () => void; onOpen: (id: string) => void; onOpenUrl: (url: string) => string | null; onImportFile: (path: string) => Promise<string | null>; onNav: (t: NavTarget) => void; onQuit: () => void }) {
  const { cols, rows } = useTermSize();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Paste a lolly.tools URL to open that tool with its settings pre-filled (`u`).
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlErr, setUrlErr] = useState('');
  // Import a PDF/.ai file → Design session (`i`).
  const [importMode, setImportMode] = useState(false);
  const [importDraft, setImportDraft] = useState('');
  const [importErr, setImportErr] = useState('');
  const [sel, setSel] = useState(0);
  // Star tools (persisted to profile.favourites), sort, and a favourites-only filter - parity
  // with the web gallery's ★ favourites + sort control.
  const [profile, setProf] = useState<Record<string, unknown>>({});
  const [sortMode, setSortMode] = useState<ToolSort>('catalog');
  const [favOnly, setFavOnly] = useState(false);
  const [catIdx, setCatIdx] = useState(0);   // 0 = All; else index into `categories`
  useEffect(() => { void getProfile().then(setProf); }, []);
  const favs = useMemo(() => loadToolFavourites(profile), [profile]);

  // Turn off tools this Node shell can't run (browser-only raster/video capture - e.g.
  // URL Screenshot, video recorders). Everything that renders svg/html/text/data, plus the
  // file-transform utilities, stays. See tool-support.ts.
  const usable = useMemo(() => tools.filter(t => !isBrowserOnly(t)), [tools]);
  const hidden = tools.length - usable.length;

  // Category filter - the distinct categories present, in catalog order (`c` cycles them).
  const categories = useMemo(() => [...new Set(usable.map(t => t.category).filter((c): c is string => !!c))], [usable]);
  const catFilter = catIdx > 0 ? categories[(catIdx - 1) % Math.max(1, categories.length)] : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = favOnly ? usable.filter(t => favs.has(t.id)) : usable;
    if (catFilter) list = list.filter(t => t.category === catFilter);
    if (q) list = list.filter(t => `${t.name} ${t.id} ${t.description ?? ''} ${t.category ?? ''}`.toLowerCase().includes(q));
    return sortTools(list, sortMode, favs);
  }, [usable, query, favOnly, favs, sortMode, catFilter]);

  const gridCols = Math.max(1, Math.min(Math.max(filtered.length, 1), Math.floor((cols - 2) / CARD_W)));
  const isMobile = gridCols <= 1;
  const compactHeader = cols < 92;
  const clamped = Math.min(Math.max(sel, 0), Math.max(0, filtered.length - 1));

  // Windowed SCROLL (not squish): show only the card-rows that fit, and edge-scroll the
  // window so the selection stays visible on a short terminal. Cards keep their full
  // CARD_H (flexShrink:0 below) so the name line can never collapse into the format line.
  const [scrollRow, setScrollRow] = useState(0);
  const visibleCardRows = Math.max(1, Math.floor((rows - 5) / CARD_H));   // tabs+search+footer
  const totalRows = Math.max(1, Math.ceil(filtered.length / gridCols));
  const selRow = Math.floor(clamped / gridCols);
  useEffect(() => {
    setScrollRow(s => {
      const maxStart = Math.max(0, totalRows - visibleCardRows);
      let n = s;
      if (selRow < n) n = selRow;
      else if (selRow >= n + visibleCardRows) n = selRow - visibleCardRows + 1;
      return Math.min(Math.max(0, n), maxStart);
    });
  }, [selRow, visibleCardRows, totalRows]);
  const start = scrollRow * gridCols;
  const pageItems = filtered.slice(start, start + visibleCardRows * gridCols);
  const moreAbove = scrollRow > 0;
  const moreBelow = scrollRow + visibleCardRows < totalRows;

  useInput((input, key) => {
    if (urlMode) {
      if (key.escape) { setUrlMode(false); setUrlErr(''); }
      return; // TextInput owns the rest
    }
    if (importMode) {
      if (key.escape) { setImportMode(false); setImportErr(''); }
      return; // TextInput owns the rest
    }
    if (searching) {
      if (key.escape) setSearching(false);
      return; // TextInput owns the rest
    }
    if (input === 'p') return onPrepare();
    if (input === 'q') return onQuit();
    if (input === '2') return onNav('projects');
    if (input === '3') return onNav('profile');
    if (input === '4') return onNav('catalog');
    if (input === '5') return onNav('system');
    if (input === '/') { setSearching(true); return; }
    if (input === 'u') { setUrlMode(true); setUrlDraft(''); setUrlErr(''); return; }
    if (input === 'i') { setImportMode(true); setImportDraft(''); setImportErr(''); return; }
    if (input === 'f') { const t = filtered[clamped]; if (t) { const next = withToolFavouriteToggled(profile, t.id); setProf(next); void setProfile(next); } return; }
    if (input === 'F') { setFavOnly(v => !v); setSel(0); return; }
    if (input === 'o') { setSortMode(m => TOOL_SORTS[(TOOL_SORTS.indexOf(m) + 1) % TOOL_SORTS.length]!); setSel(0); return; }
    if (input === 'c') { setCatIdx(i => (i + 1) % (categories.length + 1)); setSel(0); return; }
    if (key.return) { const t = filtered[clamped]; if (t) onOpen(t.id); return; }
    // Functional updater so held-key repeats accumulate (don't all read one stale value).
    setSel(s => {
      let n = Math.min(Math.max(s, 0), Math.max(0, filtered.length - 1));
      if (key.downArrow || input === 'j') n += gridCols;
      else if (key.upArrow || input === 'k') n -= gridCols;
      else if (key.rightArrow || input === 'l') n += 1;
      else if (key.leftArrow || input === 'h') n -= 1;
      else if (input === 'g') n = 0;
      else if (input === 'G') n = filtered.length - 1;
      return Math.min(Math.max(n, 0), Math.max(0, filtered.length - 1));
    });
  });

  const rowsOfCards: ToolEntry[][] = [];
  for (let i = 0; i < pageItems.length; i += gridCols) rowsOfCards.push(pageItems.slice(i, i + gridCols));

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Box justifyContent="space-between">
        <Tabs active="tools" />
      <Text dimColor>P Prepare for sharing</Text>
        {compactHeader ? null : <Box paddingX={1}>
          <Text color={theme.dim}>
            {favOnly ? '★ ' : ''}{filtered.length} tool{filtered.length === 1 ? '' : 's'}
            {moreAbove ? ' ▲' : ''}{moreBelow ? ' ▼' : ''}
            {catFilter ? `  ·  ${catFilter}` : ''}
            {`  ·  ${TOOL_SORT_LABEL[sortMode]}`}
            {favs.size ? `  ·  ★${favs.size}` : ''}
            {hidden ? `  ·  ${hidden} desktop-only` : ''}
            {isMobile ? '  ·  mobile' : ''}
          </Text>
        </Box>}
      </Box>

      {compactHeader ? <Box paddingX={1}><Text color={theme.dim}>
        {filtered.length} tool{filtered.length === 1 ? '' : 's'}
        {hidden ? ` · ${hidden} unavailable` : ''}
        {catFilter ? ` · ${catFilter}` : ''}
        {` · ${TOOL_SORT_LABEL[sortMode]}`}
      </Text></Box> : null}

      <Box paddingX={1}>
        {urlMode
          ? (<><Text color={theme.accentName}>Open URL: </Text><TextInput value={urlDraft} onChange={v => { setUrlDraft(v); setUrlErr(''); }} onSubmit={v => { const err = onOpenUrl(v.trim()); if (err) { setUrlErr(err); } else { setUrlMode(false); } }} /></>)
          : importMode
            ? (<><Text color={theme.accentName}>Import PDF/.ai path: </Text><TextInput value={importDraft} onChange={v => { setImportDraft(v); setImportErr(''); }} onSubmit={v => { setImportErr('Importing…'); void onImportFile(v.trim()).then(err => { if (err) setImportErr(err); else setImportMode(false); }); }} /></>)
            : searching
              ? (<><Text color={theme.accentName}>Search: </Text><TextInput value={query} onChange={setQuery} onSubmit={() => { setSearching(false); setSel(0); }} /></>)
              : (<Text color={theme.dim}>{query ? `Filter: ${query}  (press / to change)` : 'Press / to search  ·  u open a URL  ·  i import a PDF'}</Text>)}
      </Box>

      {filtered.length === 0
        ? <Box paddingX={1} paddingY={1}><Text color={theme.dim}>No tools match “{query}”.</Text></Box>
        : (
          <Box flexDirection="column" paddingX={1} flexShrink={0}>
            {rowsOfCards.map((rowItems, ri) => (
              <Box key={ri} flexShrink={0}>
                {rowItems.map((t, ci) => {
                  const idx = start + ri * gridCols + ci;
                  const active = idx === clamped;
                  const fmt = t.formats?.[0];
                  return (
                    <Box
                      key={t.id}
                      width={CARD_W}
                      height={CARD_H}
                      flexShrink={0}
                      overflow="hidden"
                      borderStyle={active ? 'round' : 'single'}
                      borderColor={active ? theme.accentName : theme.border}
                      paddingX={1}
                      flexDirection="column"
                    >
                      <Text bold wrap="truncate-end" color={active ? theme.accentName : undefined}>{favs.has(t.id) ? '★' : toolIcon(t.id, t.category)} {t.name}</Text>
                      <Text color={theme.dim} wrap="truncate-end">
                        {fmtEmoji(fmt)} {fmt ? String(fmt).toUpperCase() : '-'} · {catEmoji(t.category)} {t.category ?? 'tool'}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        )}

      <Footer
        note={importErr ? (importErr === 'Importing…' ? importErr : `⚠ ${importErr}`) : importMode ? 'Type a path to a PDF or .ai file, ⏎ to import as an editable Design project' : urlErr ? `⚠ ${urlErr}` : urlMode ? 'Paste a lolly.tools tool link, ⏎ to open · esc cancels' : filtered[clamped]?.description}
        shortcuts={[
          { key: 'hjkl', label: 'move' },
          { key: '⏎', label: 'open' },
          { key: '/', label: 'search' },
          { key: 'f', label: 'star' },
          { key: 'o', label: 'sort' },
          { key: 'c', label: 'category' },
          { key: 'F', label: 'favs' },
          { key: 'u', label: 'url' },
          { key: 'i', label: 'import' },
          { key: '2/3/4/5', label: 'proj/prof/cat/sys' },
          { key: 'q', label: 'quit' },
        ]}
      />
    </Box>
  );
}
