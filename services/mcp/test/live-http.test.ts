// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveHttpServer } from '../src/live-http.ts';

test('the standalone relay serves health and invitations without the public gateway', async () => {
  const server = createLiveHttpServer({});
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    for (const path of ['/mcp', '/tool/design.svg', '/.well-known/oauth-authorization-server']) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    const invitation = await fetch(`${base}/live/invitations`, {
      method: 'POST', headers: { origin: 'https://lolly.tools', 'content-type': 'application/json' },
      body: JSON.stringify({ documentId: 'doc:production', permission: 'edit' }),
    });
    assert.equal(invitation.status, 201);
    assert.equal(invitation.headers.get('access-control-allow-origin'), 'https://lolly.tools');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
