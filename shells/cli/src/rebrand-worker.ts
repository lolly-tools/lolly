// SPDX-License-Identifier: MPL-2.0
/**
 * The worker thread `lolly rebrand --jobs=N` runs each deck in (plan 274 section
 * 5). Everything it does lives in rebrand.ts, `serveRebrandWorker`: this file is
 * only the entry a `Worker` is started from, so the main thread's claims, run
 * record and report stay in one module.
 */

import { parentPort } from 'node:worker_threads';

import { serveRebrandWorker } from './rebrand.ts';

if (parentPort) serveRebrandWorker(parentPort);
