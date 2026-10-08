// SPDX-License-Identifier: MPL-2.0
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
export type WriteObserver = () => (acknowledged: boolean) => void;
export interface WriteTracker {
  begin: WriteObserver;
  status(): { pendingWrites: number; committedWrites: number; failedOrAmbiguousWrites: number };
}
export interface DrainState {
  draining: boolean;
  beganAt: string | null;
  activeHandlers: number;
  activeJobs: number | null;
  queuedJobs: number | null;
  pendingWrites: number;
  committedWrites: number;
  failedOrAmbiguousWrites: number;
  handlerFailures: number;
  diagnosticFailures: number;
  finalAccountingFlush: 'not-started' | 'pending' | 'finished' | 'failed';
  workFinished: boolean;
  settled: boolean;
}
export function createWriteTracker(): WriteTracker;
export function createHttpLifecycle(options: {
  handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
  env?: NodeJS.ProcessEnv;
  writes?: WriteTracker;
  queueStatus?: () => { active: number; queued: number };
  flushAccounting?: () => Promise<void>;
  beforeClose?: () => void | Promise<void>;
  unmeteredHealthPaths?: string[];
  shutdownTimeoutMs?: number;
}): {
  server: Server;
  controlServer: Server | null;
  writes: WriteTracker;
  status(): DrainState;
  begin(): DrainState;
  isDraining(): boolean;
  waitForSettled(timeoutMs?: number): Promise<DrainState>;
  close(): Promise<void>;
  installSignalHandlers(): () => void;
};
