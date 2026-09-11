// SPDX-License-Identifier: MPL-2.0
/**
 * Native app-menu bridge (Tauri shells only) - ONE tiny JS surface both
 * native menu implementations drive, so the iPad menu bar and the macOS menu
 * can never disagree about what an action does:
 *
 *   iOS/iPadOS  gen/apple Sources/lolly-mobile/MenuBar.mm pulls `data()` via
 *               callAsyncJavaScript and fires `open()`/`setTheme()` from
 *               UIMenu actions. iPadOS 26+ shows the system menu bar; older
 *               iPadOS shows the keyed items in the hold-Cmd shortcut HUD
 *               (hardware keyboard only) and otherwise nothing - graceful.
 *   macOS       src-tauri/src/menu.rs builds a real NSMenu from the same data
 *               (pushed to the `set_menu_data` command below) and drives
 *               `open()`/`setTheme()` through webview eval.
 *   Web build   initAppMenu returns immediately (no __TAURI_INTERNALS__).
 *
 * Data is deliberately small and re-pushed lazily: at boot, once the catalog
 * has had a moment to sync, after every in-menu theme change, and (debounced)
 * on navigation - folder edits happen in the projects view, so the next nav
 * refreshes the Projects submenu.
 */
import { LEAD_TOOL_ORDER } from './lead-tools.ts';
import { currentTheme } from '../theme.ts';
import { setTheme, type SetThemeHost } from './set-theme.ts';
import { createFolderStore, type FolderHost } from '../folders.ts';

interface MenuEntry { id: string; name: string }
export interface AppMenuData {
  theme: string;
  tools: MenuEntry[];
  utilities: MenuEntry[];
  folders: MenuEntry[];
}

type MenuHost = SetThemeHost & FolderHost;
type IndexTool = { id: string; name: string; category?: string };
type TauriWindow = Window & {
  __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> };
  __lollyMenu?: unknown;
};

const UTILITIES_MAX = 14;
const FOLDERS_MAX = 12;

export function initAppMenu(host: MenuHost): void {
  const win = window as TauriWindow;
  if (!win.__TAURI_INTERNALS__) return;

  const data = async (): Promise<AppMenuData> => {
    // Same source the gallery reads - the synced index global (localized
    // names). Its global type keeps most fields unknown, so normalize here.
    const raw = (window as Window & { __toolIndex?: { tools?: ReadonlyArray<Record<string, unknown> & { id: string }> } })
      .__toolIndex?.tools ?? [];
    const tools: IndexTool[] = raw
      .filter(t => t.listed !== false)
      .map(t => ({
        id: t.id,
        name: typeof t.name === 'string' ? t.name : t.id,
        ...(typeof t.category === 'string' ? { category: t.category } : {}),
      }));
    const byId = new Map<string, IndexTool>(tools.map(t => [t.id, t]));
    let folders: MenuEntry[] = [];
    try {
      folders = (await createFolderStore(host).list())
        .filter(f => !f.parentId)
        .slice(0, FOLDERS_MAX)
        .map(f => ({ id: f.id, name: f.name }));
    } catch { /* fresh profile or private mode - the menu just omits folders */ }
    return {
      theme: currentTheme(),
      tools: LEAD_TOOL_ORDER
        .map(id => byId.get(id))
        .filter((t): t is IndexTool => !!t)
        .map(t => ({ id: t.id, name: t.name })),
      utilities: tools
        .filter(t => t.category === 'utility')
        .slice(0, UTILITIES_MAX)
        .map(t => ({ id: t.id, name: t.name })),
      folders,
    };
  };

  // Desktop only: seed/refresh the Rust-built menu. The command is not
  // registered in the mobile shell, so the rejection there is just swallowed.
  const push = (): void => {
    void data()
      .then(d => win.__TAURI_INTERNALS__?.invoke?.('set_menu_data', { data: d }))
      .catch(() => { /* no desktop menu host */ });
  };

  win.__lollyMenu = {
    /** Navigate to an in-app hash route ('#/u', '#/tool/design', ...). */
    open(hash: string): void {
      if (typeof hash === 'string' && hash.startsWith('#/')) window.location.hash = hash;
    },
    /** Switch the app theme through the real path (profile persist + mirror). */
    setTheme(theme: string): void {
      void setTheme(host, theme).then(push);
    },
    data,
    push,
  };

  push();
  setTimeout(push, 6000); // catalog sync has usually finished by now
  let navTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('hashchange', () => {
    clearTimeout(navTimer);
    navTimer = setTimeout(push, 1500);
  });
}
