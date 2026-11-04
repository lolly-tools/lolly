// SPDX-License-Identifier: MPL-2.0
// Root component + routing across the four top-level sections (Tools · Projects ·
// Profile · Assets, switched with 1/2/3/4) plus the tool view opened from Tools, a
// saved Project, or a pasted lolly.tools URL. Each view owns its own keys; the app
// just swaps them.
import { useState } from 'react';
import { useApp } from 'ink';
import { importDesignFile, ImportReviewRequired } from './import-design.ts';
import type { ImportOptions, ImportResult } from './import-design.ts';
import { toolLinkRoute } from './engine-render.ts';
import { Gallery } from './views/Gallery.tsx';
import { Projects } from './views/Projects.tsx';
import { Profile } from './views/Profile.tsx';
import { Assets } from './views/Assets.tsx';
import { ToolView } from './views/ToolView.tsx';
import { BatchQueue } from './views/BatchQueue.tsx';
import { Prepare } from './views/Prepare.tsx';
import { Rebrand } from './views/Rebrand.tsx';
import { Start } from './views/Start.tsx';
import { System } from './views/System.tsx';
import type { SystemAction } from './views/System.tsx';
import type { SavedSession } from './store.ts';
import type { ToolEntry } from './catalog.ts';
import type { NavTarget } from './nav.ts';
import type { TuiBridge } from './bridge.ts';

type Route =
  | { name: 'batch' }
  | { name: 'prepare' }
  | { name: 'rebrand' }
  | { name: 'start' }
  | { name: 'gallery' }
  | { name: 'projects'; folderId: string | null }   // folderId === null → the top level
  | { name: 'profile' }
  | { name: 'catalog' }
  | { name: 'system'; action?: SystemAction }
  // `values` is a saved record's own input values - what reopens a session the desktop
  // app saved, which carries no URL-state (plans/202 WP3.1).
  // `fromLink`: the query came from a pasted link, so it may not point at local files.
  | { name: 'tool'; toolId: string; query?: string; values?: Record<string, unknown>; fromLink?: boolean; session?: SavedSession };

export function App({ tools, bridge, firstRun = false, catalogError }: { catalogError?: string; tools: ToolEntry[]; bridge: TuiBridge; firstRun?: boolean }) {
  const { exit } = useApp();
  const [route, setRoute] = useState<Route>(firstRun ? { name: 'start' } : { name: 'gallery' });
  const nameById = new Map(tools.map(t => [t.id, t.name] as const));
  const toolName = (id: string): string => nameById.get(id) ?? id;
  const quit = (): void => exit();
  const goNav = (t: NavTarget): void => {
    if (t === 'projects') setRoute({ name: 'projects', folderId: null });
    else if (t === 'profile') setRoute({ name: 'profile' });
    else if (t === 'catalog') setRoute({ name: 'catalog' });
    else if (t === 'system') setRoute({ name: 'system' });
    else setRoute({ name: 'gallery' });
  };

  // Open a tool from a pasted lolly.tools URL with its settings pre-filled - the same
  // parseToolUrl → mountTool(query) path the web share links use. Returns an error
  // string for the caller to surface, or null on success (navigated).
  // The link's state was written by someone else, so the route carries `fromLink`.
  const openToolUrl = (url: string): string | null => {
    const opened = toolLinkRoute(url, (id) => nameById.has(id));
    if ('error' in opened) return opened.error;
    setRoute({ name: 'tool', ...opened });
    return null;
  };

  // Import a PDF/.ai file → a saved Design session, then open it. Returns an error
  // string to surface, or null on success (navigated to the new session).
  const importFile = async (path: string, options?: ImportOptions): Promise<ImportResult | null> => {
    try {
      const s = await importDesignFile(path.trim(), bridge.host, options);
      setRoute({ name: 'tool', toolId: s.toolId, query: s.query, values: s.data, session: s });
      return null;
    } catch (e) { return e instanceof ImportReviewRequired ? { review: { warnings: e.warnings, page: e.page, pageCount: e.pageCount } } : { error: (e as Error).message }; }
  };

  switch (route.name) {
    case 'batch': return <BatchQueue onBack={() => setRoute({ name: 'gallery' })} />;
    case 'prepare':
      return <Prepare bridge={bridge} onBack={() => setRoute({ name: 'gallery' })} />;
    case 'rebrand':
      return <Rebrand onBack={() => setRoute({ name: 'gallery' })} />;
    case 'start':
      return <Start
        onSystem={action => setRoute({ name: 'system', action })}
        onQuickTool={toolId => setRoute(nameById.has(toolId) ? { name: 'tool', toolId } : { name: 'gallery' })}
        onExplore={() => setRoute({ name: 'gallery' })}
        onQuit={quit}
      />;
    case 'projects':
      return (
        <Projects
          toolName={toolName}
          folderId={route.folderId}
          bridge={bridge}
          onOpen={s => setRoute({ name: 'tool', toolId: s.toolId, query: s.query, values: s.data, session: s })}
          onOpenFolder={id => setRoute({ name: 'projects', folderId: id })}
          onNav={goNav}
          onQuit={quit}
        />
      );
    case 'profile':
      return <Profile bridge={bridge} onNav={goNav} onQuit={quit} />;
    case 'catalog':
      return <Assets onNav={goNav} onQuit={quit} onOpenTool={(toolId, query) => nameById.has(toolId) && setRoute({ name: 'tool', toolId, query })} />;
    case 'system':
      return <System onNav={goNav} onQuit={quit} initialAction={route.action} />;
    case 'tool':
      return <ToolView key={route.session?.slot ?? `${route.toolId}:${route.query ?? ''}`} session={route.session} toolId={route.toolId} query={route.query} values={route.values} fromLink={route.fromLink} bridge={bridge} onBack={() => setRoute({ name: 'gallery' })} />;
    default:
      return <Gallery onBatch={() => setRoute({ name: 'batch' })} catalogError={catalogError} onPrepare={() => setRoute({ name: 'prepare' })} onRebrand={() => setRoute({ name: 'rebrand' })} tools={tools} onOpen={id => setRoute({ name: 'tool', toolId: id })} onOpenUrl={openToolUrl} onImportFile={importFile} onNav={goNav} onQuit={quit} />;
  }
}
