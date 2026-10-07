// SPDX-License-Identifier: MPL-2.0
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

/** A failed acknowledgement may follow a committed Redis write. Never reset it. */
export function createWriteTracker() {
  let pending = 0,
    committed = 0,
    failedOrAmbiguous = 0;
  const increment = (value) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
  return {
    begin() {
      pending += 1;
      let ended = false;
      return (acknowledged) => {
        if (ended) return;
        ended = true;
        pending -= 1;
        if (acknowledged === true) committed = increment(committed);
        else failedOrAmbiguous = increment(failedOrAmbiguous);
      };
    },
    status: () => ({
      pendingWrites: pending,
      committedWrites: committed,
      failedOrAmbiguousWrites: failedOrAmbiguous,
    }),
  };
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function operatorOptions(env) {
  const token = env.LOLLY_OPERATOR_DRAIN_TOKEN;
  if (token === undefined || token === '') {
    if (env.LOLLY_OPERATOR_DRAIN_PORT)
      throw new Error('Operator drain port requires its own token');
    return null;
  }
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token))
    throw new Error('Operator drain token must be 32–256 ASCII token characters');
  for (const name of [
    'LOLLY_MCP_TOKEN',
    'LOLLY_MCP_SIGNING_SECRET',
    'CA_SERVICE_SECRET',
    'LOLLY_RATE_LIMIT_REST_TOKEN',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_TOKEN',
    'CA_RATE_LIMIT_REST_TOKEN',
  ]) {
    if (env[name] === token)
      throw new Error(
        'Operator drain token must be distinct from application and admission credentials'
      );
  }
  const port = Number(env.LOLLY_OPERATOR_DRAIN_PORT ?? 8792);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new Error('Operator drain port must be 1024–65535');
  return { tokenHash: createHash('sha256').update(token).digest(), port };
}

/** The control listener is separate, fixed to loopback, and never a public route. */
export function createHttpLifecycle({
  handler,
  env = process.env,
  writes = createWriteTracker(),
  queueStatus = () => ({ active: 0, queued: 0 }),
  flushAccounting = async () => {},
  beforeClose = async () => {},
  unmeteredHealthPaths = [],
  shutdownTimeoutMs = 300_000,
}) {
  if (
    !Number.isSafeInteger(shutdownTimeoutMs) ||
    shutdownTimeoutMs < 1 ||
    shutdownTimeoutMs > 900_000
  )
    throw new Error('Invalid shutdown timeout');
  const operator = operatorOptions(env);
  let draining = false,
    activeHandlers = 0,
    handlerFailures = 0,
    diagnosticFailures = 0;
  let beganAt = null,
    shutdownPromise = null;
  let finalAccountingFlush = 'not-started';
  const healthPaths = new Set(unmeteredHealthPaths);

  function status() {
    let queue;
    try {
      queue = queueStatus();
      if (
        !queue ||
        !['active', 'queued'].every((k) => Number.isSafeInteger(queue[k]) && queue[k] >= 0)
      )
        throw new Error('Invalid queue diagnostic');
    } catch {
      diagnosticFailures = Math.min(Number.MAX_SAFE_INTEGER, diagnosticFailures + 1);
      queue = { active: null, queued: null };
    }
    const accounting = writes.status();
    const quiet =
      draining &&
      activeHandlers === 0 &&
      queue.active === 0 &&
      queue.queued === 0 &&
      accounting.pendingWrites === 0;
    if (quiet && finalAccountingFlush === 'not-started') {
      finalAccountingFlush = 'pending';
      // Flush CPU since the last request only after accepted work has finished.
      void Promise.resolve()
        .then(flushAccounting)
        .then(
          () => {
            finalAccountingFlush = 'finished';
          },
          () => {
            finalAccountingFlush = 'failed';
            handlerFailures = Math.min(Number.MAX_SAFE_INTEGER, handlerFailures + 1);
          }
        );
    }
    const workFinished =
      quiet && (finalAccountingFlush === 'finished' || finalAccountingFlush === 'failed');
    return {
      draining,
      beganAt,
      activeHandlers,
      activeJobs: queue.active,
      queuedJobs: queue.queued,
      ...accounting,
      handlerFailures,
      diagnosticFailures,
      finalAccountingFlush,
      workFinished,
      settled:
        workFinished &&
        accounting.failedOrAmbiguousWrites === 0 &&
        handlerFailures === 0 &&
        diagnosticFailures === 0,
    };
  }

  function begin() {
    if (!draining) {
      draining = true;
      beganAt = new Date().toISOString();
    }
    return status();
  }

  const server = createServer(async (req, res) => {
    let path;
    try {
      path = new URL(req.url || '/', 'http://internal').pathname;
    } catch {
      return json(res, 400, { error: 'invalid_request_target' });
    }
    const read = req.method === 'GET' || req.method === 'HEAD';
    if (read && path === '/readyz') return json(res, draining ? 503 : 200, { ready: !draining });
    if (read && path === '/healthz') return json(res, 200, { ok: true });
    // Existing CA health is configuration-only: preserve its original response
    // without adding probe requests to accepted work or touching admission.
    if (read && healthPaths.has(path)) {
      try {
        await handler(req, res);
      } catch {
        try {
          if (!res.headersSent) json(res, 500, { error: 'health_unavailable' });
          else res.end();
        } catch {
          /* A disconnected health probe has no admission or accounting. */
        }
      }
      return;
    }
    if (draining) {
      res.setHeader('retry-after', '5');
      res.setHeader('connection', 'close');
      return json(res, 503, { error: 'service_draining' });
    }
    // The Promise, not the socket, is the accounting boundary. Client aborts
    // do not release this count while renders or final Redis writes continue.
    activeHandlers += 1;
    try {
      await handler(req, res);
    } catch {
      handlerFailures = Math.min(Number.MAX_SAFE_INTEGER, handlerFailures + 1);
      try {
        if (!res.headersSent) json(res, 500, { error: 'internal_error' });
        else res.end();
      } catch {
        /* Client may already have disconnected; Promise count remains. */
      }
    } finally {
      activeHandlers -= 1;
    }
  });

  let controlServer = null;
  if (operator) {
    controlServer = createServer((req, res) => {
      const authorization = String(req.headers.authorization || '');
      const match =
        authorization.length <= 300 && /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(authorization);
      const given = createHash('sha256')
        .update(match ? match[1] : '')
        .digest();
      if (!timingSafeEqual(operator.tokenHash, given))
        return json(res, 401, { error: 'unauthorized' });
      if (req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) !== 0) {
        res.setHeader('connection', 'close');
        return json(res, 413, { error: 'control_body_not_allowed' });
      }
      if (req.url === '/status' && req.method === 'GET') return json(res, 200, status());
      if (req.url === '/begin' && req.method === 'POST') return json(res, 200, begin());
      return json(res, 404, { error: 'not_found' });
    });
    controlServer.maxHeadersCount = 16;
    controlServer.headersTimeout = 5_000;
    controlServer.requestTimeout = 5_000;
    controlServer.keepAliveTimeout = 1_000;
    controlServer.listen(operator.port, '127.0.0.1');
    // A requested operator boundary must be available, never silently absent.
    controlServer.on('error', () => {
      throw new Error('Operator drain listener could not start');
    });
  }

  async function waitForSettled(timeoutMs = shutdownTimeoutMs) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900_000)
      throw new Error('Invalid drain timeout');
    begin();
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const state = status();
      if (state.settled) return state;
      if (state.workFinished || Date.now() >= deadline) {
        throw Object.assign(
          new Error('Drain is not settled; preserve the writer fence and resolve accounting'),
          { state }
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now())))
      );
    }
  }

  async function close() {
    if (shutdownPromise) return shutdownPromise;
    begin();
    server.closeIdleConnections();
    shutdownPromise = (async () => {
      await waitForSettled();
      await beforeClose();
      await new Promise((resolve, reject) =>
        server.close((error) =>
          error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve()
        )
      );
      if (controlServer) await new Promise((resolve) => controlServer.close(resolve));
    })();
    return shutdownPromise;
  }

  function installSignalHandlers() {
    const stop = () => {
      void close().catch(() => {
        // Do not clear diagnostics, kill work, or announce a successful drain.
        process.stderr.write('Public service shutdown is not settled; operator review required.\n');
        process.exitCode = 1;
      });
    };
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
    return () => {
      process.off('SIGTERM', stop);
      process.off('SIGINT', stop);
    };
  }

  return {
    server,
    controlServer,
    writes,
    status,
    begin,
    waitForSettled,
    close,
    installSignalHandlers,
    isDraining: () => draining,
  };
}
