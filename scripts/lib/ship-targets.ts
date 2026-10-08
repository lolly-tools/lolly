// SPDX-License-Identifier: MPL-2.0
/**
 * The deploy targets, read from scripts/data/ship-targets.json.
 *
 * `SHIP_TARGETS` used to be a bash array in scripts/subrepo/config.sh, sourced by
 * the gate and by `loldev ship`. The subrepo collapse (plan 244) moved the data into
 * JSON so both TypeScript consumers read one file: scripts/gate.ts builds and
 * validates each target profile's catalog. scripts/ship.ts deploys explicitly
 * configured legacy adapters and refuses operator-managed K3s targets.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { repoRoot } from '../../packages/node-shell/src/repo-root.ts';
import { legacyDeploymentError, vercelDeploymentError } from './deployment-policy.ts';

export interface ShipTarget {
  /** Short name used in logs. */
  name: string;
  /** The host project id the driver scopes to. */
  project: string;
  /** A key in profiles.json: the brand this target serves. */
  profile: string;
  /** The production domain, e.g. 'lolly.tools'. */
  domain: string;
  /** Explicit deploy adapter. k3s targets use their operator-managed release runbook. */
  driver: string;
  /** Hosted document invitation relay, pinned into the web build. */
  liveRelay?: string;
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

/** Validate all targets before the gate, credential setup or any upload runs. */
export function shipTargetError(target: ShipTarget, team: string): string | null {
  if (target.driver === 'k3s') {
    return `${target.domain} uses operator-managed K3s releases; follow deploy/helm/profiles/sovereign/README.md`;
  }
  if (target.driver !== 'vercel' && target.driver !== 'internal_it') {
    return 'set an explicit supported deployment driver (vercel or internal_it)';
  }
  // Check reserved targets for every legacy adapter, including internal_it.
  return target.driver === 'vercel'
    ? vercelDeploymentError(target, team)
    : legacyDeploymentError(target);
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
