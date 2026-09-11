// SPDX-License-Identifier: MPL-2.0
/**
 * The deploy targets, read from scripts/data/ship-targets.json.
 *
 * `SHIP_TARGETS` used to be a bash array in scripts/subrepo/config.sh, sourced by
 * the gate and by `loldev ship`. The subrepo collapse (plan 244) moved the data into
 * JSON so both TypeScript consumers read one file: scripts/gate.ts builds and
 * validates each target profile's catalog, and scripts/ship.ts deploys each target
 * and asserts the brand it serves afterwards.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { repoRoot } from '../../packages/node-shell/src/repo-root.ts';

export interface ShipTarget {
  /** Short name used in logs, e.g. 'bt'. */
  name: string;
  /** The host project id the driver scopes to. */
  project: string;
  /** A key in profiles.json: the brand this target serves. */
  profile: string;
  /** The production domain, e.g. 'lolly.tools'. */
  domain: string;
  /** Deploy adapter; 'vercel' when unset. */
  driver?: string;
}

interface ShipTargetsFile {
  team: string;
  targets: ShipTarget[];
}

let memo: ShipTargetsFile | null = null;

function load(): ShipTargetsFile {
  if (memo) return memo;
  const path = join(repoRoot(), 'scripts/data/ship-targets.json');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ShipTargetsFile;
  if (!Array.isArray(parsed.targets) || !parsed.targets.length) {
    throw new Error(`${path} declares no targets`);
  }
  memo = parsed;
  return parsed;
}

/** Every deploy target, in file order. */
export function shipTargets(): ShipTarget[] {
  return load().targets;
}

/** The team/organisation id the vercel driver scopes to. */
export function shipTeam(): string {
  return load().team;
}

/** The distinct profiles the targets serve, first-seen order. Two targets may
 *  share a brand, and the gate builds each catalog once. */
export function shipProfiles(): string[] {
  return [...new Set(shipTargets().map((t) => t.profile))];
}
