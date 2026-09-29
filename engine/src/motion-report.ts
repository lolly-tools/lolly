// SPDX-License-Identifier: MPL-2.0
/** Measured delivery facts remain separate from candidates for human review. */
export interface MotionTarget { width?: number; height?: number; seconds?: number; fps?: number; audio?: boolean; loudness?: number; truePeakMax?: number }
export interface MotionCheck { id: string; status: 'pass' | 'fail' | 'review' | 'not-run'; measured?: unknown; target?: unknown; reason?: string }
export interface MotionReport { version: 1; checks: MotionCheck[]; ok: boolean | null }
export interface MotionFacts { width?: number; height?: number; seconds?: number; fps?: number; audio?: boolean; loudness?: number | null; truePeak?: number | null }
export function motionReport(facts: MotionFacts, target: MotionTarget = {}, extra: MotionCheck[] = []): MotionReport {
  if (!target || typeof target !== 'object' || Array.isArray(target)) throw new Error('Motion targets must be an object.');
  for (const [key, value] of Object.entries(target)) {
    if (key === 'audio' && typeof value === 'boolean') continue;
    if (!['width', 'height', 'seconds', 'fps', 'loudness', 'truePeakMax'].includes(key) || typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid motion target: ${key}`);
    if (['width', 'height', 'seconds', 'fps'].includes(key) && value <= 0) throw new Error(`Motion target ${key} must be positive.`);
  }
  const checks: MotionCheck[] = [];
  for (const id of ['width', 'height', 'seconds', 'fps', 'audio', 'loudness', 'truePeak'] as const) {
    const measured = facts[id], want = id === 'truePeak' ? target.truePeakMax : target[id];
    if (measured === undefined) { checks.push({ id, status: 'not-run', target: want, reason: 'No measurement from this decoder.' }); continue; }
    const tolerance = id === 'seconds' ? 1 / (facts.fps || 30) + 0.005 : id === 'fps' ? 0.02 : id === 'loudness' ? 0.5 : 0;
    const pass = want === undefined || (measured !== null && (id === 'truePeak' ? Number(measured) <= Number(want) : typeof want === 'number' ? Math.abs(Number(measured) - want) <= tolerance : measured === want));
    checks.push({ id, status: pass ? 'pass' : 'fail', measured, ...(want === undefined ? {} : { target: want }) });
  }
  checks.push(...extra, { id: 'rendered-layout', status: 'not-run', reason: 'Encoded pixels do not establish source font resolution or text overflow; review the mounted document.' }, { id: 'creative-review', status: 'not-run', reason: 'Message, legibility and intentional holds require human review.' });
  return { version: 1, checks, ok: checks.some(check => check.status === 'fail') ? false : checks.every(check => check.status === 'not-run') || checks.some(check => check.status === 'not-run' && check.target !== undefined) ? null : true };
}
