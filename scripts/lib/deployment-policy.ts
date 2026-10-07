// SPDX-License-Identifier: MPL-2.0
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// These instance targets moved to operator-managed UpCloud releases. Optional
// Vercel adapters must use an independently configured project and domain.
const RETIRED_PROJECTS = new Set([
  'prj_13zlzrov2vhek0cgucyhgx4cplu7',
  'prj_v86nfwz1ls7v4svsqfpjxuqzyrmw',
  'prj_35famwkpiv5twrdgslwkzy7mfhig',
]);
const MANAGED_DOMAINS = [
  'lolly.tools', 'lolly.ing', 'lolly.work', 'lolly.art', 'lolly.free', 'lolly.to', 'lolly.sh', 'vml.ai',
];

interface DeploymentTarget {
  domain: string;
  project: string;
}

/** Accept a bare DNS hostname; URLs, ports and whitespace within names fail. */
export function normalizedDeploymentDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (domain.length > 253 || !domain.includes('.')) return null;
  return domain.split('.').every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ? domain : null;
}

/** Refuse current instance domains and the projects that previously served them. */
export function legacyDeploymentError(target: DeploymentTarget): string | null {
  if (typeof target.domain !== 'string' || typeof target.project !== 'string') {
    return 'deployment requires an explicit domain and project';
  }
  const domain = normalizedDeploymentDomain(target.domain);
  if (!domain) return 'deployment domain must be a bare DNS hostname';
  const project = target.project.trim().toLowerCase();
  if (RETIRED_PROJECTS.has(project)) {
    return 'this project is retired from legacy deployment; use the instance Kubernetes release runbook';
  }
  if (MANAGED_DOMAINS.some((owned) => domain === owned || domain.endsWith(`.${owned}`))) {
    return `${domain} is managed by the UpCloud Kubernetes release runbook; legacy deployment is disabled`;
  }
  return null;
}

export function vercelDeploymentError(target: DeploymentTarget, team: string): string | null {
  const reason = legacyDeploymentError(target);
  if (reason) return reason;
  if (!/^prj_[a-z0-9]+$/i.test(target.project.trim())) {
    return 'Vercel deployment requires an explicit project ID';
  }
  if (!/^team_[a-z0-9]+$/i.test(team)) return 'Vercel deployment requires an explicit team ID';
  return null;
}

function main(): void {
  const [domain, project, team] = process.argv.slice(2);
  const reason = !domain || !project || !team
    ? 'set an explicit separate domain, VERCEL_PROJECT_ID and VERCEL_ORG_ID'
    : vercelDeploymentError({ domain, project }, team);
  if (reason) {
    process.stderr.write(`Vercel deployment refused: ${reason}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) main();
