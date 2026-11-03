// SPDX-License-Identifier: MPL-2.0
/**
 * Design in two panes (lib/split-panes.ts).
 *
 * On a foldable or a near-square touch screen the right-hand column (lib/edge-dock.ts)
 * becomes the CONTROL PANE: the inspector, the layers list and the export sheet are
 * its tabs, the canvas takes the other side, and the hinge is the divider. The
 * navigator joins the column as the Layers tab only while it is open in two panes;
 * everywhere else it is the left sidebar it has always been. Moving it is a re-parent
 * of the same live element, so its scroll, its selection and a rename in progress
 * survive the fold (the column carries the person's place, lib/keep-place.ts).
 *
 * Design's panel coordinator (views/design-panels.ts) mounts this with live reads
 * of the navigator and the inspector, which stay the view's own.
 */
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { releaseDock, requestDock, setDockAccessory, showPanel } from '../lib/edge-dock.ts';
import { isSplitLayout, onLayoutChange } from '../lib/layout-posture.ts';
import { mountSplitView } from '../lib/split-panes.ts';
import { watchScrollCue } from '../lib/scroll-cue.ts';
import type { HandHost } from '../lib/hand-pref.ts';
import type { DesignNavigatorHandle } from './design-navigator.ts';
import type { DesignInspectorFloatHandle } from './design-inspector-float.ts';

export interface DesignSplitOptions {
  /** Persists Swap sides; lib/split-panes.ts falls back to the live host. */
  host?: HandHost;
  navigator(): DesignNavigatorHandle | null;
  inspector(): DesignInspectorFloatHandle | null;
  /** Open the inspector through the view's own door (it records the state). */
  openInspector(): void;
  /** Re-sync the panels' reserves after the layers list moves. */
  syncPanels(): void;
  /** The stage, whose tool rail stands on the canvas pane's outer edge in two panes. */
  stage?: HTMLElement;
}

export interface DesignSplitHandle {
  /** The panels' view of the navigator: while it is a tab it takes no stage band. */
  navigatorForPanels(nav: DesignNavigatorHandle): DesignNavigatorHandle;
  /** Follow the layout now; `reveal` brings the Layers tab forward (the person opened the list). */
  sync(reveal?: boolean): void;
  destroy(): void;
}

export function mountDesignSplit(opts: DesignSplitOptions): DesignSplitHandle {
  const view = mountSplitView({ id: 'design', dock: true, host: opts.host });
  const swapSides = view.swapButton();
  let navDocked = false;
  // The tool rail on the canvas pane's edge scrolls when it is taller than the pane,
  // and shows a fade with an arrow at each end that holds more (lib/scroll-cue.ts)
  // rather than cutting the last tools off.
  let cue: { toolbar: HTMLElement; stop: () => void } | null = null;
  const syncRailCue = (): void => {
    // On the edge in two columns, along the foot on a tabletop: both scroll with a cue.
    const dock = isSplitLayout() ? opts.stage?.querySelector<HTMLElement>('.fc-toolbar-dock') : null;
    const toolbar = dock?.querySelector<HTMLElement>(':scope > .fc-toolbar') ?? null;
    if (cue && cue.toolbar === toolbar) return;
    cue?.stop();
    cue = dock && toolbar ? { toolbar, stop: watchScrollCue(toolbar, dock) } : null;
  };

  const sync = (reveal = false): void => {
    const split = isSplitLayout();
    const nav = opts.navigator();
    syncRailCue();
    setDockAccessory(split ? swapSides : null);
    if (!split || !nav) {
      if (navDocked) releaseDock('layers', 'host');
      return;
    }
    // The control pane always has something in it: an inspector closed on the desk
    // (or floating) opens in the pane.
    const inspector = opts.inspector();
    if (!inspector?.isOpen()) opts.openInspector();
    else if (inspector.mode() !== 'edge') inspector.dock();
    if (nav.isOpen() && !navDocked) {
      navDocked = requestDock('layers', nav.el, {
        icon: icon('layers'),
        label: t('Layers'),
        // Restored at boot it joins quietly; opened by the person it is the tab shown.
        background: !reveal,
        onRelease: (reason) => {
          navDocked = false;
          // A person closing the tab closes the list; the app taking it back (leaving
          // two panes, a view change) leaves the list as it was.
          if (reason === 'user') opts.navigator()?.setOpen(false);
          opts.syncPanels();
        },
      });
    } else if (nav.isOpen() && navDocked && reveal) {
      showPanel('layers');
    } else if (!nav.isOpen() && navDocked) {
      releaseDock('layers', 'host');
    }
    opts.syncPanels();
  };

  const offLayout = onLayoutChange(() => sync());
  return {
    navigatorForPanels: (nav) => ({ ...nav, width: () => (navDocked ? 0 : nav.width()) }),
    sync,
    destroy(): void {
      offLayout();
      cue?.stop();
      cue = null;
      setDockAccessory(null);
      if (navDocked) releaseDock('layers', 'host');
      view.destroy();
    },
  };
}
