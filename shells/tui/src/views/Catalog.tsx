// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog - browse the SAME on-disk asset registry the web catalog view shows
 * (catalog/assets/index.json). A searchable, windowed list with a live detail line;
 * keyboard-first (j/k move, / search, 1–4 switch section). Favourite (f) and hide (d)
 * assets - persisted on the profile like the web catalog; favourites sort to the top and
 * lead the asset picker, hidden assets drop out of the picker. To USE an asset, open a
 * tool and press ⏎ on an `asset` input - the picker there reads this same catalog.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { loadAssets } from '../catalog.ts';
import type { AssetRow } from '../catalog.ts';
import { getProfile, setProfile } from '../store.ts';
import { filterAssets, assetEmoji, assetDetail } from '../lib/asset-list.ts';
import { loadFavourites, loadHidden, withFavouriteToggled, withHiddenToggled, sortFavouritesFirst } from '../lib/asset-favourites.ts';
import type { NavTarget } from '../nav.ts';
import { useTermSize } from '../hooks.ts';
import { theme } from '../theme.ts';
import { Tabs } from '../components/Tabs.tsx';
import { Footer } from '../components/Footer.tsx';

export function Catalog({ onNav, onQuit, onOpenTool }: { onNav: (t: NavTarget) => void; onQuit: () => void; onOpenTool?: (toolId: string, query: string) => void }) {
  const { cols, rows } = useTermSize();
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [profile, setProf] = useState<Record<string, unknown>>({});
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState(0);

  useEffect(() => { void loadAssets().then(setAssets).catch(() => setAssets([])); }, []);
  useEffect(() => { void getProfile().then(setProf); }, []);

  const favs = useMemo(() => loadFavourites(profile), [profile]);
  const hidden = useMemo(() => loadHidden(profile), [profile]);

  // Filter by search, then float favourites to the top. Hidden assets stay visible here
  // (marked) so they can be un-hidden - only the picker drops them.
  const filtered = useMemo(
    () => (assets ? sortFavouritesFirst(filterAssets(assets, query), favs) : []),
    [assets, query, favs],
  );
  const clamped = Math.min(Math.max(sel, 0), Math.max(0, filtered.length - 1));

  // Windowed edge-scroll so the list never reflows (fixed-height body).
  const listH = Math.max(3, rows - 8);
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    setScroll(s => {
      let n = s;
      if (clamped < n) n = clamped;
      else if (clamped >= n + listH) n = clamped - listH + 1;
      return Math.min(Math.max(0, n), Math.max(0, filtered.length - listH));
    });
  }, [clamped, listH, filtered.length]);
  const windowed = filtered.slice(scroll, scroll + listH);
  const current = filtered[clamped];

  // Persist a profile change (favourite/hide toggle) - update the view immediately, write in the background.
  function persist(next: Record<string, unknown>): void { setProf(next); void setProfile(next); }

  useInput((input, key) => {
    if (searching) { if (key.escape) setSearching(false); return; }
    if (input === '1') return onNav('tools');
    if (input === '2') return onNav('projects');
    if (input === '3') return onNav('profile');
    if (input === '5') return onNav('system');
    if (input === 'q') return onQuit();
    if (input === '/') { setSearching(true); return; }
    if (input === 'f' && current) { persist(withFavouriteToggled(profile, current.id)); return; }
    if (input === 'd' && current) { persist(withHiddenToggled(profile, current.id)); return; }
    // e → render THIS asset to any format: open the asset-export tool seeded with it.
    if (input === 'e' && current && onOpenTool) { onOpenTool('asset-export', 'src=' + encodeURIComponent(current.id)); return; }
    setSel(s => {
      let n = Math.min(Math.max(s, 0), Math.max(0, filtered.length - 1));
      if (key.downArrow || input === 'j') n += 1;
      else if (key.upArrow || input === 'k') n -= 1;
      else if (input === 'g') n = 0;
      else if (input === 'G') n = filtered.length - 1;
      return Math.min(Math.max(0, n), Math.max(0, filtered.length - 1));
    });
  });

  const favCount = favs.size, hidCount = hidden.size;

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <Box justifyContent="space-between">
        <Tabs active="catalog" />
        <Box paddingX={1}>
          <Text color={theme.dim}>
            {filtered.length} asset{filtered.length === 1 ? '' : 's'}
            {assets && assets.length !== filtered.length ? ` / ${assets.length}` : ''}
            {favCount ? `  ·  ★${favCount}` : ''}{hidCount ? `  ·  ${hidCount} hidden` : ''}
          </Text>
        </Box>
      </Box>

      <Box paddingX={1}>
        {searching
          ? (<><Text color={theme.accentName}>Search: </Text><TextInput value={query} onChange={setQuery} onSubmit={() => { setSearching(false); setSel(0); }} /></>)
          : (<Text color={theme.dim}>{query ? `Filter: ${query}  (/ to change)` : 'Press / to search  ·  f favourite · d hide'}</Text>)}
      </Box>

      <Box flexDirection="column" paddingX={1} flexGrow={1} overflow="hidden">
        {assets === null
          ? <Text color={theme.dim}>Loading catalog…</Text>
          : filtered.length === 0
            ? <Text color={theme.dim}>No assets match “{query}”.</Text>
            : windowed.map((a, i) => {
                const active = scroll + i === clamped;
                const isFav = favs.has(a.id), isHid = hidden.has(a.id);
                return (
                  <Text key={a.id} wrap="truncate-end" color={active ? theme.accentName : isHid ? theme.dim : undefined}>
                    {active ? '▸ ' : '  '}{isFav ? '★ ' : '  '}{assetEmoji(a.type)} {a.id}
                    <Text color={theme.dim}>{'   ' + (isHid ? '(hidden) ' : '') + a.name}</Text>
                  </Text>
                );
              })}
      </Box>

      {current
        ? (
          <Box paddingX={1} flexDirection="column" flexShrink={0}>
            <Text color={theme.dim} wrap="truncate-end">{assetDetail(current)}</Text>
          </Box>
        )
        : null}

      <Footer
        note={current ? `${favs.has(current.id) ? '★ favourite' : 'f: favourite'} · ${hidden.has(current.id) ? 'd: un-hide' : 'd: hide'} · “${current.id}”` : undefined}
        shortcuts={[
          { key: 'j/k', label: 'move' },
          { key: '/', label: 'search' },
          ...(onOpenTool ? [{ key: 'e', label: 'export asset' }] : []),
          { key: 'f', label: 'favourite' },
          { key: 'd', label: 'hide' },
          { key: '1/2/3', label: 'tools/proj/profile' },
          { key: 'q', label: 'quit' },
        ]}
      />
    </Box>
  );
}
