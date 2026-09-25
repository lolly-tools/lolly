// SPDX-License-Identifier: MPL-2.0
/**
 * Every renovation stage registration, in one module (plan 274 section 9).
 *
 * This is the only file that calls registerStage for a real stage. Two importers
 * load it and nobody else should: stage-worker.ts, the worker entry, imports it
 * at the top of the worker realm, and stage-runner.ts reaches it through a
 * dynamic import when a realm has no Worker and has to run the stage in place.
 *
 * The renovation stages (census, first pass, renovated compile and faithful
 * compile) live in stage-rebrand.ts and are registered below under the names
 * `RebrandStageNameV1` lists. Keeping them behind this one module is what keeps
 * them out of the main chunk: nothing on the main thread imports this file at
 * module scope, so a stage's code is fetched by the worker, or by the fallback
 * when there is no worker to fetch it.
 */
import { ECHO_STAGE, echoStage, registerStage } from './stage-core.ts';
import { censusStage, compileStage, faithfulStage, planStage } from './stage-rebrand.ts';

registerStage<unknown, unknown>(ECHO_STAGE, echoStage);
registerStage('rebrand.census', censusStage);
registerStage('rebrand.plan', planStage);
registerStage('rebrand.compile', compileStage);
registerStage('rebrand.faithful', faithfulStage);

/** Nothing to call. The registrations above are the module's whole purpose. */
export const STAGES_LOADED = true;
