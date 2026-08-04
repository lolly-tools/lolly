// SPDX-License-Identifier: MPL-2.0
/**
 * canShowMoney — the pure decide-money-or-counts predicate (Phase 5 degrade).
 * No figures, no arithmetic: it only answers "worked cost, or counts alone?".
 * plans/65-preflight-and-cost.md §5 + Phase 5.
 *
 * Run: node --test "tests/money-policy.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canShowMoney, type MoneyContext } from '../packages/core/src/money-policy.ts';

/** A permissive baseline: own-session, in-date, non-confidential, has a card. */
function ctx(over: Partial<MoneyContext> = {}): MoneyContext {
  return {
    hasCard: true,
    selectionFromUrl: false,
    revealedThisSession: false,
    cardConfidential: false,
    expired: false,
    useExpiredAnyway: false,
    ...over,
  };
}

// ── rule 1: possession is necessary ───────────────────────────────────────────

test('no card on this device → counts only, whatever else is true', () => {
  assert.equal(canShowMoney(ctx({ hasCard: false })), false);
  // even an explicit reveal cannot conjure money without a card
  assert.equal(canShowMoney(ctx({ hasCard: false, revealedThisSession: true })), false);
});

// ── own session shows money immediately ────────────────────────────────────────

test("the user's own in-app selection this session shows money", () => {
  assert.equal(canShowMoney(ctx()), true);
});

// ── reached via link opens on counts until an explicit per-device reveal ────────

test('a selection that arrived in the URL is withheld until revealed this session', () => {
  assert.equal(canShowMoney(ctx({ selectionFromUrl: true })), false);
  assert.equal(canShowMoney(ctx({ selectionFromUrl: true, revealedThisSession: true })), true);
});

// ── the confidential case: reached via link is the real threat ─────────────────

test('a confidential card reached via link is counts-only (protects trade rates)', () => {
  assert.equal(
    canShowMoney(ctx({ cardConfidential: true, selectionFromUrl: true })),
    false,
    'a client always arrives via the link; money must not auto-show',
  );
});

test('a confidential card reached via link CAN be revealed by the explicit per-device action', () => {
  assert.equal(
    canShowMoney(ctx({ cardConfidential: true, selectionFromUrl: true, revealedThisSession: true })),
    true,
  );
});

// ── expiry suppresses money unless explicitly overridden ───────────────────────

test('expired rates suppress money unless the user opts in this session', () => {
  assert.equal(canShowMoney(ctx({ expired: true })), false);
  assert.equal(canShowMoney(ctx({ expired: true, useExpiredAnyway: true })), true);
});

test('expiry wins over an own-session selection', () => {
  // own session (selectionFromUrl:false) would show money, but expiry suppresses first
  assert.equal(canShowMoney(ctx({ expired: true, useExpiredAnyway: false })), false);
});

// ── purity: same inputs → same answer, no hidden state ─────────────────────────

test('the predicate is pure and side-effect free', () => {
  const c = ctx({ selectionFromUrl: true, revealedThisSession: true });
  const a = canShowMoney(c);
  const b = canShowMoney(c);
  assert.equal(a, b);
  // the context object is not mutated
  assert.deepEqual(c, {
    hasCard: true,
    selectionFromUrl: true,
    revealedThisSession: true,
    cardConfidential: false,
    expired: false,
    useExpiredAnyway: false,
  });
});
