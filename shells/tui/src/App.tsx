// SPDX-License-Identifier: MPL-2.0
// Root component + routing across the four top-level sections (Tools · Projects ·
// Profile · Catalog, switched with 1/2/3/4) plus the tool view opened from Tools, a
// saved Project, or a pasted lolly.tools URL. Each view owns its own keys; the app
// just swaps them.
import { useState } from 'react';
import { useApp } from 'ink';
import { parseToolUrl } from '@lolly/engine';
import { importDesignFile } from './import-design.ts';
import { Gallery } from './views/Gallery.tsx';
import { Projects } from './views/Projects.tsx';
import { Profile } from './views/Profile.tsx';
import { Catalog } from './views/Catalog.tsx';
import { ToolView } from './views/ToolView.tsx';
import { Prepare } from './views/Prepare.tsx';
import { Start } from './views/Start.tsx';
import { System } from './views/System.tsx';
import type { SystemAction } from './views/System.tsx';
import type { ToolEntry } from './catalog.ts';
import type { NavTarget } from './nav.ts';
import type { TuiBridge } from './bridge.ts';

type Route =
  | { name: 'prepare' }
  | { name: 'start' }
  | { name: 'gallery' }
  | { name: 'projects'; folderId: string | null }   // folderId === null → the top level
  | { name: 'profile' }
  | { name: 'catalog' }
  | { name: 'system'; action?: SystemAction }
  // `values` is a saved record's own input values - what reopens a session the desktop
  // app saved, which carries no URL-state (plans/202 WP3.1).
  | { name: 'tool'; toolId: string; query?: string; values?: Record<string, unknown> };

export function App({ tools, bridge, firstRun = false }: { tools: ToolEntry[]; bridge: TuiBridge; firstRun?: boolean }) {
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
  const openToolUrl = (url: string): string | null => {
    const ref = parseToolUrl(url);
    if (!ref) return 'Not a recognised lolly.tools URL';
    if (!nameById.has(ref.toolId)) return `This build has no tool “${ref.toolId}”`;
    setRoute({ name: 'tool', toolId: ref.toolId, query: ref.query });
    return null;
  };

  // Import a PDF/.ai file → a saved Design session, then open it. Returns an error
  // string to surface, or null on success (navigated to the new session).
  const importFile = async (path: string): Promise<string | null> => {
    try {
      const s = await importDesignFile(path.trim(), bridge.host);
      setRoute({ name: 'tool', toolId: s.toolId, query: s.query });
      return null;
    } catch (e) { return (e as Error).message; }
  };

  switch (route.name) {
    case 'prepare':
      return <Prepare bridge={bridge} onBack={() => setRoute({ name: 'gallery' })} />;
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
          onOpen={s => setRoute({ name: 'tool', toolId: s.toolId, query: s.query, values: s.data })}
          onOpenFolder={id => setRoute({ name: 'projects', folderId: id })}
          onNav={goNav}
          onQuit={quit}
        />
      );
    case 'profile':
      return <Profile bridge={bridge} onNav={goNav} onQuit={quit} />;
    case 'catalog':
      return <Catalog onNav={goNav} onQuit={quit} onOpenTool={(toolId, query) => nameById.has(toolId) && setRoute({ name: 'tool', toolId, query })} />;
    case 'system':
      return <System onNav={goNav} onQuit={quit} initialAction={route.action} />;
    case 'tool':
      return <ToolView toolId={route.toolId} query={route.query} values={route.values} bridge={bridge} onBack={() => setRoute({ name: 'gallery' })} />;
    default:
      return <Gallery onPrepare={() => setRoute({ name: 'prepare' })} tools={tools} onOpen={id => setRoute({ name: 'tool', toolId: id })} onOpenUrl={openToolUrl} onImportFile={importFile} onNav={goNav} onQuit={quit} />;
  }
}
