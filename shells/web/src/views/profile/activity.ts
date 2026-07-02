// SPDX-License-Identifier: MPL-2.0
/**
 * Activity rendering — the "Your activity" section's local usage stats.
 *
 * All derived from a tiny localStorage blob (metrics.ts); nothing here is
 * recorded remotely — hence the "0 uploaded" line.
 */

import { escape } from '../../utils.ts';
import type { MetricsSnapshot } from '../../metrics.ts';

/** A catalog-index tool entry as this view reads it (window.__toolIndex). */
export interface IndexedTool {
  id: string;
  name: string;
}

// Local-only usage stats. All derived from a tiny localStorage blob (metrics.js);
// nothing here is recorded remotely — hence the "0 uploaded" line. Returns the
// section's inner content (the heading lives in the collapsible summary).
export function renderActivity(m: MetricsSnapshot, tools: readonly IndexedTool[]): string {
  const hasAny = m.filesRendered || m.toolOpens || m.linksCopied || m.imagesCopied || m.batchRuns;
  if (!hasAny) {
    return `<p class="storage-hint-text">Nothing here yet — open a tool and make something. It all gets counted right here on your device.</p>`;
  }

  const num = (n: number) => Number(n).toLocaleString();
  const stat = (n: number, label: string) => `<div class="activity-stat"><span class="activity-num">${num(n)}</span><span class="activity-label">${label}</span></div>`;
  const tiles = [
    stat(m.filesRendered, 'files rendered'),
    stat(m.toolOpens, 'tools opened'),
    stat(m.linksCopied, 'links copied'),
    stat(m.imagesCopied, 'images copied'),
  ];
  if (m.batchRuns) tiles.push(stat(m.batchFiles, 'files batched'));

  // Format leaderboard as proportional bars (most-used first; top one accented).
  const formats = Object.entries(m.formats).sort((a, b) => b[1] - a[1]);
  const max = formats.length ? (formats[0]?.[1] ?? 1) : 1;
  const bars = formats.length ? `
    <div class="activity-block">
      <h3 class="activity-h3">Your Favourite Formats</h3>
      <ul class="fmt-bars">
        ${formats.map(([f, n], i) => `<li class="fmt-row${i === 0 ? ' is-top' : ''}">
          <span class="fmt-name">${escape(f.toUpperCase())}</span>
          <span class="fmt-track"><span class="fmt-fill" style="width:${Math.max(6, Math.round((n / max) * 100))}%"></span></span>
          <span class="fmt-count">${num(n)}</span>
        </li>`).join('')}
      </ul>
    </div>` : '';

  // Resolve against the current catalog. A favourite tool that's since been
  // removed (new deploy without it) is dropped rather than linked, so the pill
  // never navigates to a tool route that can't mount.
  const favTool = m.favTool ? tools.find(t => t.id === m.favTool) : null;
  const since = new Date(m.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const meta = [
    `Creating since <strong>${escape(since)}</strong>`,
    favTool ? `Favourite tool <a class="activity-fav" href="#/tool/${encodeURIComponent(favTool.id)}" aria-label="Open ${escape(favTool.name)}">${escape(favTool.name)}</a>` : '',
    m.batchRuns ? `<strong>${m.batchRuns}</strong> batch run${m.batchRuns === 1 ? '' : 's'}${m.biggestBatch > 1 ? ` (biggest ${num(m.biggestBatch)})` : ''}` : '',
    `<strong>0</strong> uploaded — all on your device`,
  ].filter(Boolean).join(' <span class="dot" aria-hidden="true">·</span> ');

  // Stat tiles sit beside the format leaderboard on desktop (split), and stack
  // on mobile. With no formats the grid keeps the full card width on its own.
  const stats = `<div class="activity-grid">${tiles.join('')}</div>`;
  const body = bars ? `<div class="activity-split">${stats}${bars}</div>` : stats;

  return `${body}<p class="activity-meta">${meta}</p>`;
}
