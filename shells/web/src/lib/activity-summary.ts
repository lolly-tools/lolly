// SPDX-License-Identifier: MPL-2.0
/**
 * "Your activity" - the read-only, local-only usage summary (files rendered,
 * favourite formats, favourite tool, "creating since"). Extracted from the
 * Profile view so the Dashboard (#/d) can show the same figures without the two
 * drifting. Data comes from metrics.ts (getMetrics); this module only renders.
 *
 * The markup uses `.activity-*` / `.fmt-*` classes. The declarations that were
 * byte-identical between the two hosts now live once in components.css, scoped
 * to both `.profile-view`/`.dashboard-view` roots in one selector list
 * (component audit rec 13); each host's own CSS file (profile.css / dashboard.css)
 * keeps only its real size/spacing deltas, so the same fragment still reads
 * correctly wherever it's dropped, without the two copies drifting apart again.
 */

import { escape } from '../utils.ts';
import type { MetricsSnapshot } from '../metrics.ts';

/** True when there is at least one recorded action worth showing. */
export function hasActivity(m: MetricsSnapshot): boolean {
  return !!(m.filesRendered || m.toolOpens || m.linksCopied || m.imagesCopied || m.batchRuns);
}

/**
 * The activity body: stat tiles + a favourite-formats leaderboard + a meta line.
 * `tools` is the current catalogue (to resolve the favourite tool to a live
 * link); a favourite that's since been removed is shown as plain text, never a
 * dead link. Returns an empty-state line when nothing has been recorded yet.
 */
export function renderActivity(
  m: MetricsSnapshot,
  tools: Array<{ id: string } & Record<string, unknown>>,
): string {
  if (!hasActivity(m)) {
    return `<p class="storage-hint-text">Nothing here yet - open a tool and make something. It all gets counted right here on your device.</p>`;
  }

  const num = (n: number) => Number(n).toLocaleString();
  const stat = (n: number, label: string) =>
    `<div class="activity-stat"><span class="activity-num">${num(n)}</span><span class="activity-label">${label}</span></div>`;
  const tiles = [
    stat(m.filesRendered, 'files rendered'),
    stat(m.toolOpens, 'tools opened'),
    stat(m.linksCopied, 'links copied'),
    stat(m.imagesCopied, 'images copied'),
  ];
  if (m.batchRuns) tiles.push(stat(m.batchFiles, 'files batched'));

  // Format leaderboard as proportional bars (most-used first; top one accented).
  const formats = Object.entries(m.formats).sort((a, b) => b[1] - a[1]);
  const max = formats.length ? formats[0]![1] : 1;
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
    favTool ? `Favourite tool <a class="activity-fav" href="#/tool/${encodeURIComponent(favTool.id)}" aria-label="Open ${escape(String(favTool.name ?? favTool.id))}">${escape(String(favTool.name ?? favTool.id))}</a>` : '',
    m.batchRuns ? `<strong>${m.batchRuns}</strong> batch run${m.batchRuns === 1 ? '' : 's'}${m.biggestBatch > 1 ? ` (biggest ${num(m.biggestBatch)})` : ''}` : '',
    `<strong>0</strong> uploaded - all on your device`,
  ].filter(Boolean).join(' <span class="dot" aria-hidden="true">·</span> ');

  // Stat tiles sit beside the format leaderboard on desktop (split), and stack
  // on mobile. With no formats the grid keeps the full card width on its own.
  const stats = `<div class="activity-grid">${tiles.join('')}</div>`;
  const body = bars ? `<div class="activity-split">${stats}${bars}</div>` : stats;

  return `${body}<p class="activity-meta">${meta}</p>`;
}
