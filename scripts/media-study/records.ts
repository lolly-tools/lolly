// SPDX-License-Identifier: MPL-2.0
/** Local study records. These are evidence, not a published brand or campaign contract. */
export interface CostEntry {
  id: string;
  attemptId: string;
  category: 'labour' | 'compute' | 'service' | 'promotion';
  phase: 'setup' | 'production' | 'correction';
  basis: 'cash' | 'allocation';
  certainty: 'actual' | 'assumed' | 'unknown';
  currency: string;
  tax: 'gross' | 'net' | 'unspecified';
  quantity: number | null;
  unit: string;
  unitRate: number | null;
  note: string;
}

export interface StudyAttempt {
  id: string;
  editionId: string;
  outputId: string;
  operation: string;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  condition: 'first-in-process' | 'warm' | 'not-applicable';
  outcome: 'running' | 'succeeded' | 'failed';
  findings: string[];
  artifacts: Array<{ path: string; sha256: string; bytes: number }>;
}

export interface StudyLedger {
  version: 1;
  runId: string;
  startedAt: string;
  environment: Record<string, unknown>;
  attempts: StudyAttempt[];
  costs: CostEntry[];
  /** Only recorded decisions count. A successful render grants no approval. */
  decisions: Array<{
    outputId: string;
    artifactSha256: string;
    state: 'approved' | 'rejected';
    reviewer: string;
    at: string;
    evidence: string;
  }>;
  publications: Array<{
    editionId: string;
    artifactSha256: string[];
    state: 'published';
    destination: string;
    observedAt: string;
    evidence: string;
  }>;
}

function nonnegative(value: number | null, name: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0))
    throw new Error(`${name} must be a finite nonnegative number or null.`);
}

export function costSummary(ledger: StudyLedger, amortiseOver: number[] = [3, 12, 52]) {
  const attemptIds = new Set(ledger.attempts.map((a) => a.id));
  if (attemptIds.size !== ledger.attempts.length) throw new Error('Attempt IDs must be unique.');
  const seen = new Set<string>();
  const groups = new Map<
    string,
    {
      currency: string;
      tax: CostEntry['tax'];
      basis: CostEntry['basis'];
      certainty: CostEntry['certainty'];
      setup: number;
      production: number;
      promotion: number;
      missing: string[];
    }
  >();
  for (const entry of ledger.costs) {
    if (seen.has(entry.id)) throw new Error(`Duplicate cost ID: ${entry.id}`);
    seen.add(entry.id);
    if (!attemptIds.has(entry.attemptId))
      throw new Error(`Unknown cost attempt: ${entry.attemptId}`);
    if (!/^[A-Z]{3}$/.test(entry.currency)) throw new Error(`Invalid currency: ${entry.currency}`);
    nonnegative(entry.quantity, 'Quantity');
    nonnegative(entry.unitRate, 'Unit rate');
    const key = [entry.currency, entry.tax, entry.basis, entry.certainty].join('/');
    const group = groups.get(key) ?? {
      currency: entry.currency,
      tax: entry.tax,
      basis: entry.basis,
      certainty: entry.certainty,
      setup: 0,
      production: 0,
      promotion: 0,
      missing: [],
    };
    groups.set(key, group);
    if (entry.certainty === 'unknown' || entry.quantity === null || entry.unitRate === null)
      group.missing.push(entry.id);
    else {
      const amount = entry.quantity * entry.unitRate;
      if (!Number.isFinite(amount)) throw new Error(`Cost overflow: ${entry.id}`);
      if (entry.phase === 'setup') group.setup += amount;
      else if (entry.category === 'promotion') group.promotion += amount;
      else group.production += amount;
    }
  }
  for (const n of amortiseOver)
    if (!Number.isSafeInteger(n) || n < 1)
      throw new Error('Amortisation horizons must be positive integers.');
  const successfulOutputs = new Set(
    ledger.attempts.filter((a) => a.outcome === 'succeeded').map((a) => a.outputId)
  );
  const decisions = new Map(ledger.decisions.map((d) => [`${d.outputId}/${d.artifactSha256}`, d]));
  for (const d of ledger.decisions) {
    const artifact = ledger.attempts.some(
      (a) =>
        a.outcome === 'succeeded' &&
        a.outputId === d.outputId &&
        a.artifacts.some((f) => f.sha256 === d.artifactSha256)
    );
    if (!artifact || !d.reviewer.trim() || !d.evidence.trim() || !Number.isFinite(Date.parse(d.at)))
      throw new Error('A review needs an exact successful artifact, reviewer, date and evidence.');
  }
  for (const p of ledger.publications) {
    const artifacts = ledger.attempts
      .filter((a) => a.editionId === p.editionId && a.outcome === 'succeeded')
      .flatMap((a) => a.artifacts.map((f) => f.sha256));
    if (
      !p.artifactSha256.length ||
      p.artifactSha256.some((d) => !artifacts.includes(d)) ||
      !p.destination.trim() ||
      !p.evidence.trim() ||
      !Number.isFinite(Date.parse(p.observedAt))
    )
      throw new Error(
        'Publication needs exact artifacts, destination, observation date and evidence.'
      );
  }
  const approved = [...decisions.values()].filter((d) => d.state === 'approved').length;
  const published = new Set(ledger.publications.map((p) => p.editionId)).size;
  return {
    successfulOperations: successfulOutputs.size,
    approvedAssets: approved,
    publishedEditions: published,
    failedAttempts: ledger.attempts.filter((a) => a.outcome === 'failed').length,
    uncostedAttempts: ledger.attempts
      .filter((a) => !ledger.costs.some((c) => c.attemptId === a.id))
      .map((a) => a.id),
    groups: [...groups.values()].map((g) => ({
      ...g,
      knownProductionPerApproved: approved && !g.missing.length ? g.production / approved : null,
      knownTotalPerPublished:
        published && !g.missing.length ? (g.production + g.promotion) / published : null,
      setupPerEdition: amortiseOver.map((editions) => ({
        editions,
        amount: g.missing.length ? null : g.setup / editions,
      })),
    })),
  };
}

/** Missing costs remain missing; wall-clock runtime never substitutes for active labour. */
export function unknownCosts(attempt: StudyAttempt): CostEntry[] {
  return (['labour', 'compute'] as const).map((category) => ({
    id: `${attempt.id}-${category}`,
    attemptId: attempt.id,
    category,
    phase: attempt.operation === 'setup' ? 'setup' : 'production',
    basis: 'allocation',
    certainty: 'unknown',
    currency: 'GBP',
    tax: 'unspecified',
    quantity: category === 'compute' ? attempt.elapsedMs / 3_600_000 : null,
    unit: 'hour',
    unitRate: null,
    note:
      category === 'labour'
        ? 'Active human time and rate have not been measured.'
        : 'Local runtime measured; machine, energy and capacity rate not assigned. No API charge inferred.',
  }));
}
