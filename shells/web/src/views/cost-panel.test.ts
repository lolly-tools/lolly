// SPDX-License-Identifier: MPL-2.0
/**
 * views/cost-panel.ts - the export panel's "Cost, worked out from your rate card".
 *
 * Run directly:  node --test shells/web/src/views/cost-panel.test.ts
 *
 * The pure half is tested - the working → view mapping, where every honesty rule
 * lives. The essential one is the DEGRADE: a mount reached via a link may never
 * render a money figure, even when a full working is in hand, until an explicit
 * per-device reveal. `cannot render money from a link` proves that the figure is
 * structurally unreachable from a link-provenance context, not merely hidden by CSS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { costView, costBodyHtml, costPanelHtml, applyCostPanel } from './cost-panel.ts';
import type { CostView, CostPanelContext } from './cost-panel.ts';
import type { CostWorking, CostRow, CostAdjustment } from '@lolly/engine';
import { monetaryFigure } from '@lolly-tools/core';
import type { MoneyContext } from '@lolly-tools/core';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = dom.window.document;

// ─── builders ────────────────────────────────────────────────────────────────

const EUR = 'EUR';

const row = (over: Partial<CostRow> = {}): CostRow => ({
  lineId: 'plate-setup', kind: 'perPlate', quantityKind: 'processPlates',
  quantity: 4, bound: 'ceiling', unit: 'plate', unitRate: 3500,
  subtotal: 14000, subtotalBound: 'ceiling', ...over,
});

const working = (over: Partial<CostWorking> = {}): CostWorking => {
  const rows = over.rows ?? [row(), {
    lineId: 'artwork', kind: 'perJob', quantityKind: 'job', quantity: 1,
    bound: 'exact', unitRate: 8000, subtotal: 8000, subtotalBound: 'exact',
  } as CostRow];
  const adjustments = over.adjustments ?? [];
  const subtotalOfCovered = rows.reduce((s, r) => s + r.subtotal, 0);
  const headline = subtotalOfCovered + adjustments.reduce((s, a) => s + a.delta, 0);
  return {
    currency: EUR, expired: false, rows, adjustments, uncosted: [],
    coveredLines: 2, totalLines: 2, subtotalOfCovered, bound: 'ceiling',
    estimatedTotal: monetaryFigure(headline, EUR), ...over,
  };
};

const money = (over: Partial<MoneyContext> = {}): MoneyContext => ({
  hasCard: true, selectionFromUrl: false, revealedThisSession: false,
  cardConfidential: false, expired: false, useExpiredAnyway: false, ...over,
});

const ctx = (over: Partial<CostPanelContext> = {}): CostPanelContext => ({
  costable: true, money: money(), issuerName: 'Acme Print', issued: '2026-02-14',
  validUntil: '2026-12-31', ...over,
});

/** Any currency figure - a symbol, an ISO code, or a `NN.NN` amount. If this matches
 *  a suppressed/no-card body, money leaked. (A bare date year is not a figure.) */
const CURRENCY = /[€$£¥]|EUR|\d+[.,]\d{2}/;

// ─── not costable / no card ────────────────────────────────────────────────────

test('a job with no priceable count renders nothing', () => {
  const v = costView(working(), ctx({ costable: false }));
  assert.equal(v.show, false);
});

test('rule 1: no card on this device hides the panel (no in-app card loading yet)', () => {
  const v = costView(null, ctx({ money: money({ hasCard: false }) }));
  assert.equal(v.show, false, 'nothing to load a card with → no clutter on every export');
  assert.equal(v.mode, 'no-card');
  assert.equal(v.total, undefined);
});

// ─── the degrade: a link cannot render money ───────────────────────────────────

test('cannot render money from a link: link provenance suppresses the figure', () => {
  // A full working, complete coverage, a real total - everything needed to show
  // money - but the mount was reached via a link and not revealed on this device.
  const v = costView(working(), ctx({ money: money({ selectionFromUrl: true, revealedThisSession: false }) }));
  assert.equal(v.mode, 'suppressed', 'a link-reached mount degrades to counts');
  assert.equal(v.total, undefined, 'no total object exists on the suppressed view');
  assert.equal(v.rows, undefined, 'no working rows are built');
  const body = costBodyHtml(v);
  assert.ok(!CURRENCY.test(body), `suppressed body leaked a figure: ${body}`);
  assert.match(body, /Show costs/, 'it offers the explicit per-device reveal instead');
});

test('a confidential card reached via a link stays suppressed until the reveal', () => {
  const linked = money({ selectionFromUrl: true, cardConfidential: true, revealedThisSession: false });
  assert.equal(costView(working(), ctx({ money: linked })).mode, 'suppressed');
  // The explicit per-device reveal (device-local memory, never a URL) opens it.
  const revealed = money({ selectionFromUrl: true, cardConfidential: true, revealedThisSession: true });
  assert.equal(costView(working(), ctx({ money: revealed })).mode, 'working');
});

test('own-session selection shows money immediately (no link, no reveal needed)', () => {
  const v = costView(working(), ctx());   // selectionFromUrl: false
  assert.equal(v.mode, 'working');
  assert.ok(v.total, 'a full-coverage own-session view carries a total');
});

// ─── expiry ────────────────────────────────────────────────────────────────────

test('expired rates suppress money and show the expiry reason; no figure', () => {
  const v = costView(working({ expired: true }), ctx({ money: money({ expired: true }) }));
  assert.equal(v.mode, 'suppressed');
  const body = costBodyHtml(v);
  assert.ok(!CURRENCY.test(body), 'expired body must carry no figure');
  assert.match(body, /expired/i);
});

test('opting in to expired rates shows the working, stamped with the expiry date (section 5)', () => {
  const v = costView(working({ expired: true }), ctx({ money: money({ expired: true, useExpiredAnyway: true }) }));
  assert.equal(v.mode, 'working');
  // The figure must carry the expiry caveat WITH it - a lapsed total never reads as current.
  assert.ok(v.expiredNote, 'the opted-in figure is stamped as computed from lapsed rates');
  assert.match(v.expiredNote!, /expired/i);
  assert.match(costBodyHtml(v), /expired/i, 'the stamp is rendered beside the total');
});

// ─── full coverage total, with source inline + ceiling ─────────────────────────

test('full coverage renders the total WITH its source inline and an up-to bound', () => {
  const v = costView(working(), ctx());
  assert.equal(v.mode, 'working');
  // €250-ish (14000 + 8000 = 22000 minor = €220.00), ceiling → "up to".
  assert.ok(v.total, 'a total is present');
  assert.match(v.total!, /up to/, 'a ceiling total is qualified, never a bare figure');
  assert.match(v.total!, /Acme Print/, 'the source is inline with the figure');
  assert.match(v.total!, /220[.,]00/, 'the figure is the formatted headline');
  assert.ok(v.disclaimer, 'the rule-6 disclaimer rides under the total');
});

test('the minimum charge is a visible adjustment row; rows + delta sum to the total', () => {
  const adj: CostAdjustment = { lineId: 'minimum-charge', kind: 'adjustment', reason: 'minimumCharge', from: 22000, to: 25000, delta: 3000 };
  const v = costView(working({ adjustments: [adj] }), ctx());
  assert.equal(v.adjustments?.length, 1);
  assert.match(v.adjustments![0]!.amount, /30[.,]00/, 'the visible +delta is €30.00');
  assert.match(v.total!, /250[.,]00/, '22000 + 3000 = 25000 minor = €250.00 headline');
});

// ─── partial coverage: no scalar total ─────────────────────────────────────────

test('rule 2: any uncosted line means NO scalar total; the gap is the headline', () => {
  const w = working({
    rows: [row()],
    coveredLines: 1, totalLines: 3,
    uncosted: [
      { lineId: 'run', reason: 'no-sheet-count' },
      { lineId: 'variant', reason: 'quantity-not-produced' },
    ],
    estimatedTotal: null,
  });
  const v = costView(w, ctx());
  assert.equal(v.total, null, 'no scalar total exists on partial coverage');
  assert.ok(v.headline, 'the gap is the headline');
  assert.match(v.headline!, /2 of 3/);
  assert.match(v.headline!, /including the press run/, 'a no-sheet-count line names the press run');
  // Per-line arithmetic still shows (the priced line's own amount), but nothing sums.
  assert.equal(v.rows?.length, 1);
});

test('the press-run clause is dropped when no sheet line is the cause', () => {
  const w = working({
    rows: [row()], coveredLines: 1, totalLines: 2,
    uncosted: [{ lineId: 'variant', reason: 'quantity-not-produced' }],
    estimatedTotal: null,
  });
  const v = costView(w, ctx());
  assert.doesNotMatch(v.headline!, /including the press run/);
});

// ─── DOM writer ────────────────────────────────────────────────────────────────

test('applyCostPanel writes a real <details> and never opens it', () => {
  const host = dom.window.document.createElement('div');
  host.innerHTML = costPanelHtml();
  applyCostPanel(host, costView(working(), ctx()));
  const card = host.querySelector('[data-cost-section]') as HTMLElement;
  assert.equal(card.tagName.toLowerCase(), 'details');
  assert.equal(card.hasAttribute('open'), false, 'the card is never opened');
  assert.equal(card.hasAttribute('data-export-hide'), true, 'it is chrome, hidden from every export');
  assert.equal(card.style.display, 'flex');
});

test('applyCostPanel hides the card when there is nothing to say', () => {
  const host = dom.window.document.createElement('div');
  host.innerHTML = costPanelHtml();
  applyCostPanel(host, costView(working(), ctx({ costable: false })));
  const card = host.querySelector('[data-cost-section]') as HTMLElement;
  assert.equal(card.style.display, 'none');
});
