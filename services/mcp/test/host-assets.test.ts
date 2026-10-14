// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createCliBridge } from '../../../shells/cli/src/bridge.ts';
import { withHost } from '../src/host.ts';

test('hosted source readers refuse non-public and file sources', async () => {
  await withHost({}, async (_dom, host) => {
    const source = 'https://192.0.2.1/image';
    await assert.rejects(host.assets.get(source), /not reachable/);
    await assert.rejects(host.codec!.decode!(source), /not reachable/);
    await assert.rejects(host.audio!.decode!(source), /not reachable/);
    if (host.raster) {
      await assert.rejects(host.raster.measure(source), /not reachable/);
      await assert.rejects(host.raster.decode({ url: source } as never), /not reachable/);
    }
    await assert.rejects(host.assets.bytes!('file:///unavailable-fixture'), /not available/);
    await assert.rejects(host.codec!.decode!('file:///unavailable-fixture'), /http/);
    await assert.rejects(host.audio!.decode!('file:///unavailable-fixture'), /http/);
  });
});

test('a local bridge can explicitly retain local image fetching', async () => {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'image/png');
    res.end(new Uint8Array([1, 2, 3]));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const dom = new JSDOM();
  try {
    const host = await createCliBridge({ dom: dom as never, publicOnlyAssets: false, aiEnabled: false });
    const port = (server.address() as { port: number }).port;
    const asset = await host.assets.get(`http://127.0.0.1:${port}/image`);
    assert.equal(asset.type, 'raster');
    assert.equal(asset.url, 'data:image/png;base64,AQID');
  } finally {
    dom.window.close();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
