// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation stage WORKER ENTRY, and nothing else (plan 274 section 9,
 * "Work scheduling").
 *
 * stage-runner.ts names this file in `new URL('./stage-worker.ts', import.meta.url)`
 * and never imports it, so Vite emits it as a worker chunk on its own. The
 * protocol, the registry and the message loop live in stage-core.ts, which both
 * realms import; the registrations live in stages.ts, which this entry loads for
 * its side effect. That is why census, plan and compile do not land in the main
 * bundle when milestone 3 adds them.
 *
 * The guard below is what keeps an accidental main-thread import harmless: the
 * loop installs only when this module is evaluated inside a worker.
 */
import { installStageWorker, workerScope } from './stage-core.ts';
import './stages.ts';

const scope = workerScope();
if (scope) installStageWorker(scope);
