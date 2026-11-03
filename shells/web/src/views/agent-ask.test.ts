// SPDX-License-Identifier: MPL-2.0
/**
 * views/agent-ask.ts: the Ask an agent panel, against a fake app. Checks the gating
 * (policy, nothing found), the first-use notice per engine, and a run that applies
 * one change through live-v1. The menu row's own gating is pinned at the end.
 */
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="view"><div class="tool-stage"><div id="tool-canvas"></div></div></div></body>', { url: 'http://localhost/t/design', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, Node: dom.window.Node,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
});

const { openAgentAsk } = await import('./agent-ask.ts');
const { aiPolicy } = await import('../lib/ai-policy.ts');
const { forgetEngines, engineAllowed } = await import('../lib/device-agents.ts');
type LiveEditor = import('../lib/live-agent.ts').LiveEditor;

const tick = async (n = 3): Promise<void> => { for (let i = 0; i < n; i++) await new Promise(resolve => setImmediate(resolve)); };
const view = (): HTMLElement => document.getElementById('view')!;
const panel = (): HTMLElement | null => document.querySelector('.agent-connect');
const status = (): string => panel()?.querySelector('[role="status"]')?.textContent ?? '';
const buttonNamed = (name: RegExp): HTMLButtonElement | undefined => [...panel()!.querySelectorAll('button')].find(b => name.test(b.textContent ?? '') && !b.hidden);

afterEach(() => {
  // Close through the panel, so its timers and People entry go too.
  for (const button of document.querySelectorAll<HTMLButtonElement>('.script-audio-close')) button.click();
  aiPolicy.setManaged(false);
  forgetEngines();
});

function editor(): LiveEditor & { commits: string[] } {
  let rows: unknown[] = [{ id: 'title', kind: 'text', x: 0, y: 0, w: 100, h: 20, text: 'Hello' }];
  const commits: string[] = [];
  return {
    tool: 'design', engine: 'test', surface: 'desktop', rows: () => structuredClone(rows), size: () => ({ width: 100, height: 100 }), selection: () => [],
    fieldDefault: (_i, f) => f, async commit(next, note) { rows = structuredClone(next); commits.push(note); return { note }; },
    topEntry: () => null, undo() {}, look: async () => ({ svg: '<svg/>', width: 1, height: 1 }), commits,
  };
}

function app(found: unknown[], answer: unknown = { ok: true, output: { label: 'Bold title', patches: [{ id: 'title', set: [{ field: 'bold', value: true }] }], operations: [] } }) {
  const calls: string[] = [];
  return {
    calls,
    invoke: async (cmd: string): Promise<unknown> => {
      calls.push(cmd);
      if (cmd === 'agents_detect') return found;
      if (cmd === 'agents_run') return answer;
      return true;
    },
  };
}

const CLAUDE = { id: 'claude', kind: 'cli', label: 'Claude Code', path: '/Users/a/.local/bin/claude', version: '2.1.317', runnable: true };

test('a managed policy without agents shows the policy and looks for nothing', async () => {
  aiPolicy.apply({ version: 1, enabled: true, capabilities: ['speech'], maxAgeSeconds: 60 });
  const fake = app([CLAUDE]);
  openAgentAsk({ viewEl: view(), invoke: fake.invoke, editor: async () => editor });
  await tick();
  assert.match(status(), /policy does not allow AI agents/);
  assert.deepEqual(fake.calls, []);
  assert.equal(panel()!.querySelector('textarea')!.hidden, true);
});

test('nothing found says so and lets the menu stop offering the row', async () => {
  let nothing = false;
  openAgentAsk({ viewEl: view(), invoke: app([]).invoke, editor: async () => editor, onNothingFound: () => { nothing = true; } });
  await tick();
  assert.equal(nothing, true);
  assert.match(status(), /No agent was found/);
  assert.equal(buttonNamed(/^Ask$/), undefined);
});

test('agents Lolly cannot ask are listed with the reason, and nothing can run', async () => {
  openAgentAsk({ viewEl: view(), invoke: app([
    { id: 'gemini', kind: 'cli', label: 'Gemini CLI', path: '/g', version: '0.9.0', runnable: false, note: 'detect-only' },
    { id: 'vscode', kind: 'app', label: 'Visual Studio Code', path: '/Applications/Visual Studio Code.app', version: null, runnable: false },
  ]).invoke, editor: async () => editor });
  await tick();
  const others = panel()!.querySelector('details')!;
  assert.equal(others.open, true);
  assert.match(others.textContent!, /Gemini CLI 0\.9\.0.*does not send requests/s);
  assert.match(others.textContent!, /Lolly cannot send requests to apps/);
  assert.match(status(), /none it can send requests to yet/);
});

test('the first use of an engine says where data goes and who pays, then a run applies one change', async () => {
  const doc = editor();
  const fake = app([CLAUDE]);
  openAgentAsk({ viewEl: view(), invoke: fake.invoke, editor: async () => () => doc });
  await tick();
  const notice = panel()!.querySelector('.agent-ask-notice')!;
  assert.match(notice.textContent!, /go to Anthropic through Claude Code, under the account Claude Code is signed in with/);
  assert.match(notice.textContent!, /Your plan with Anthropic pays/);
  assert.match(notice.textContent!, /no tools/);
  const request = panel()!.querySelector('textarea')!;
  const ask = buttonNamed(/^Ask$/)!;
  assert.equal(request.disabled, true, 'no request before the engine is allowed');
  assert.equal(ask.disabled, true);
  buttonNamed(/Allow Claude Code/)!.click();
  assert.equal(engineAllowed('claude'), true);
  assert.equal(buttonNamed(/Allow Claude Code/), undefined);
  request.value = 'Make the title bold';
  request.dispatchEvent(new dom.window.Event('input'));
  assert.equal(ask.disabled, false);
  ask.click();
  await tick(10);
  assert.deepEqual(doc.commits, ['Bold title']);
  assert.match(status(), /Done: Bold title\. Undo takes it back\./);
  assert.ok(fake.calls.includes('agents_run'));
});

test('a signed-out CLI is named with what to do, and its own words are shown as text', async () => {
  const doc = editor();
  const fake = app([CLAUDE], { ok: false, reason: 'not-signed-in', detail: '<b>Not logged in</b>' });
  openAgentAsk({ viewEl: view(), invoke: fake.invoke, editor: async () => () => doc });
  await tick();
  buttonNamed(/Allow Claude Code/)!.click();
  const request = panel()!.querySelector('textarea')!;
  request.value = 'Anything';
  request.dispatchEvent(new dom.window.Event('input'));
  buttonNamed(/^Ask$/)!.click();
  await tick(10);
  assert.match(status(), /Claude Code is not signed in/);
  const detail = panel()!.querySelector('.agent-ask-detail')!;
  assert.equal(detail.textContent, '<b>Not logged in</b>');
  assert.equal(detail.querySelector('b'), null, 'the CLI\'s words never become markup');
  assert.deepEqual(doc.commits, []);
});

test('the menu offers Ask an agent on the desktop only, and reads policy and detection when it opens', () => {
  const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const toolbox = read('./free-canvas/toolbox.ts');
  assert.match(toolbox, /actions\?\.askAgent && \(actions\.askAgentShown\?\.\(\) \?\? true\)/, 'the row is decided each time the menu opens');
  const session = read('./tool/session.ts');
  assert.match(session, /askAgent: toolId === 'design' && !isPresent && desktopAgents/);
  assert.match(session, /askAgentShown: \(\) => aiAllowed\('agents'\) && !askAgentNothingFound/);
  assert.match(session, /permitted: \(\) => aiAllowed\('agents'\)/, 'Allow AI control sits under the same policy');
});
