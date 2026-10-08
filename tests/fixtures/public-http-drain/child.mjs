// SPDX-License-Identifier: MPL-2.0
import {
  createHttpLifecycle,
  createWriteTracker,
} from '../../../services/shared/http-lifecycle.mjs';

const writes = createWriteTracker();
let release;
const work = new Promise((done) => {
  release = done;
});
const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');
const lifecycle = createHttpLifecycle({
  env: {},
  writes,
  handler: async (_req, res) => {
    send({ event: 'accepted' });
    await work;
    const done = writes.begin();
    await Promise.resolve();
    done(true);
    res.end('complete');
  },
  beforeClose: () => {
    send({ event: 'settled', ...lifecycle.status() });
    process.stdin.destroy();
  },
});
lifecycle.installSignalHandlers();
process.once('SIGTERM', () => send({ event: 'draining', ...lifecycle.status() }));
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (chunk.trim() === 'release') release();
});
lifecycle.server.listen(0, '127.0.0.1', () =>
  send({ event: 'listening', port: lifecycle.server.address().port })
);
