// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { homeHref, navigateHome, setHomeDestination, validHomeUrl } from './home-destination.ts';

test('Home uses the instance view, with a validated custom URL taking precedence', () => {
  setHomeDestination(); assert.equal(homeHref(), '/#/');
  setHomeDestination('projects'); assert.equal(homeHref(), '/#/p');
  setHomeDestination('tools'); assert.equal(homeHref(), '/#/tools');
  for (const url of ['/#/p?team=prj_demo', '/portal', 'https://company.example/teams/home']) {
    setHomeDestination('projects', url); assert.equal(homeHref(), url);
  }
  setHomeDestination('projects', 'javascript:alert(1)'); assert.equal(homeHref(), '/#/p');
  setHomeDestination();
});

test('Home refuses executable, credentialed and ambiguous URLs', () => {
  for (const url of ['', '//evil.test', 'javascript:alert(1)', 'data:text/html,hello', 'http://company.example/', 'https://user:secret@company.example/', '/\\evil.test', '/\nportal', '/portal\u007f', 1]) {
    assert.equal(validHomeUrl(url), null, String(url));
  }
});

test('Home from a tool uses the Projects router destination', () => {
  const dom = new JSDOM('', { url: 'https://lolly.ing/t/design' });
  globalThis.window = dom.window as unknown as typeof window;
  setHomeDestination('projects');
  const calls: string[] = [];
  navigateHome(href => calls.push(href));
  assert.deepEqual(calls, ['/#/p']);
  setHomeDestination('tools', '/#/p?team=prj_demo');
  navigateHome(href => calls.push(href));
  assert.equal(calls[1], '/#/p?team=prj_demo');
  setHomeDestination(); dom.window.close();
});
