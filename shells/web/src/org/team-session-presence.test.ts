// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTeamSessionPresence } from './team-session-presence.ts';
import { sessionTile } from '../folder-tiles.ts';

test('session activity refreshes badges without replacing cards, clears stale peers and stops on disposal or access loss', async () => {
  const tile = sessionTile({ slot: 's1', label: 'Shared deck' }, { selectable: true, selected: true, shared: { subtitle: 'Team session', openLabel: 'Open shared deck' } });
  const dom = new JSDOM(`<body><div id="grid">${tile}</div></body>`, { url: 'https://instance.test', pretendToBeVisual: true });
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location });
  let refresh: (() => void) | undefined, requests = 0, status = 200;
  dom.window.setInterval = ((fn: () => void) => { refresh = fn; return 1; }) as typeof dom.window.setInterval;
  dom.window.clearInterval = () => { refresh = undefined; };
  let sessions = [{ sessionId: 's1', peers: [{ id: 'u1', name: 'Ravan', color: '#009966', role: 'observer', away: false }] }];
  globalThis.fetch = (async (url: string | URL | Request) => {
    assert.equal(String(url), '/api/v1/projects/p1/presence'); requests++;
    return Response.json({ sessions }, { status });
  }) as typeof fetch;
  const grid = dom.window.document.querySelector<HTMLElement>('#grid')!, card = grid.firstElementChild!, primary = card.querySelector('.tile-primary'), selection = card.querySelector('.tile-check');
  const tick = () => new Promise<void>(resolve => setImmediate(resolve));
  const dispose = mountTeamSessionPresence(grid, 'p1', () => true);
  try {
    await tick();
    assert.equal(card.querySelector('.collab-tile-avatar')?.getAttribute('title'), 'Ravan');
    assert.equal((card.querySelector('.collab-tile-avatar') as HTMLElement).style.getPropertyValue('--collab-color'), '#009966');
    assert.match(card.querySelector('[role="status"]')!.getAttribute('aria-label')!, /person here/);
    assert.equal(card.querySelector('.tile-primary'), primary); assert.equal(card.querySelector('.tile-check'), selection); assert.equal(selection?.getAttribute('aria-pressed'), 'true');
    assert.equal(card.querySelectorAll('.collab-tile-badge').length, 1);
    sessions = []; refresh!(); await tick(); assert.equal(card.querySelector('.collab-tile-badge'), null);
    status = 403; refresh!(); await tick(); const stoppedAt = requests; refresh!(); await tick(); assert.equal(requests, stoppedAt);
    dispose(); assert.equal(refresh, undefined); assert.equal(card.querySelector('.tile-primary'), primary);
  } finally { dispose(); globalThis.fetch = originalFetch; dom.window.close(); }
});
