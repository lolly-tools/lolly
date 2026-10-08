// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parse } from 'yaml';
import { androidNativeSettings, androidQualificationPort, androidQualificationSource, androidWebViewProvider, cleanAndroidQualification, installAndroidQualification, launchAndroidQualification } from '../scripts/verify-webgpu-android.ts';

const actor = 'bd9c28e6-2059-4d05-a11b-45745e2784dd';
const url = `http://127.0.0.1:49215/?qualification=${actor}`;
const fixture = (name: string) => readFileSync(new URL(`fixtures/webgpu-android/${name}`, import.meta.url), 'utf8');
const own = { installed: true, ports: [], portCreated: (_port: number) => {} };

test('qualification binds a full reviewed main SHA and refuses ambiguous, changed or unrelated source', () => {
  const sha = 'a'.repeat(40), calls: string[][] = [];
  const git = (args: string[]) => { calls.push(args); return args[0] === 'rev-parse' ? `${sha}\n` : ''; };
  assert.equal(androidQualificationSource(sha, git), sha);
  assert.deepEqual(calls, [['rev-parse', 'HEAD'], ['status', '--porcelain', '--untracked-files=no'], ['merge-base', '--is-ancestor', sha, 'origin/main']]);
  for (const bad of [undefined, 'main', 'A'.repeat(40), `${sha}; echo bad`]) {
    assert.throws(() => androidQualificationSource(bad, () => { throw new Error('must not execute'); }), /reviewed full main SHA/);
  }
  assert.throws(() => androidQualificationSource('b'.repeat(40), git), /checked-out source/);
  assert.throws(() => androidQualificationSource(sha, args => args[0] === 'rev-parse' ? sha : ' M tests/webgpu-lut.browser.test.ts'), /tracked changes/);
  assert.throws(() => androidQualificationSource(sha, args => { if (args[0] === 'merge-base') throw new Error('not a main ancestor'); return args[0] === 'rev-parse' ? sha : ''; }), /not a main ancestor/);
});

test('installation refuses an existing fixture and never requests replacement', () => {
  const calls: string[][] = [];
  assert.throws(() => installAndroidQualification('/owned/test.apk', args => { calls.push(args); return 'package:tools.lolly.webgpuqualification\n'; }), /pre-existing qualification fixture/);
  assert.deepEqual(calls, [['shell', 'pm', 'list', 'packages', 'tools.lolly.webgpuqualification']]);
  calls.length = 0;
  installAndroidQualification('/owned/test.apk', args => { calls.push(args); return args[0] === 'install' ? 'Success' : ''; });
  assert.deepEqual(calls[1], ['install', '-t', '/owned/test.apk']);
  assert.throws(() => installAndroidQualification('/owned/test.apk', args => args[0] === 'install' ? 'Failure [INSTALL_FAILED_ALREADY_EXISTS]' : ''), /install successfully/);
});

test('the adb launcher accepts only its exact local actor URL and touches only its owned app and reverse port', () => {
  const calls: string[][] = [];
  const created: number[] = [];
  assert.equal(launchAndroidQualification(url, args => { calls.push(args); return args[1] === '--list' ? '' : 'Status: ok'; }, { ...own, portCreated: port => created.push(port) }), 49215);
  assert.deepEqual(created, [49215]);
  assert.deepEqual(calls, [
    ['reverse', '--list'], ['reverse', '--no-rebind', 'tcp:49215', 'tcp:49215'],
    ['shell', 'am', 'force-stop', 'tools.lolly.webgpuqualification'],
    ['shell', 'am', 'start', '-W', '-n', 'tools.lolly.webgpuqualification/.QualificationActivity', '--es', 'qualification_url', url],
  ]);
  for (const bad of ['https://127.0.0.1:49215/', `http://localhost:49215/?qualification=${actor}`,
    `http://127.0.0.1:49215/?qualification=${actor}&extra=$(touch%20/tmp/x)`, `${url}\n`, `${url}#x`,
    `http://user@127.0.0.1:49215/?qualification=${actor}`, 'http://127.0.0.1:49215/?qualification=------------------------------------']) {
    assert.throws(() => androidQualificationPort(bad), /owned loopback|unsafe qualification/);
  }
  assert.throws(() => launchAndroidQualification(url, args => args[1] === '--list' ? '' : 'Error: Activity not found', own), /native qualification activity/);
});

test('launch refuses borrowed forwards and install claims but can reuse its own forward for the timing page', () => {
  const calls: string[][] = [];
  const adb = (args: string[]) => { calls.push(args); return args[1] === '--list' ? 'UsbFfs tcp:49215 tcp:49215\n' : ''; };
  assert.throws(() => launchAndroidQualification(url, adb, { ...own, installed: false }), /successfully installed owned/);
  assert.equal(calls.length, 0);
  assert.throws(() => launchAndroidQualification(url, adb, own), /pre-existing reverse/);
  assert.deepEqual(calls, [['reverse', '--list']]); calls.length = 0;
  launchAndroidQualification(url, adb, { ...own, ports: [49215] });
  assert.ok(calls.some(args => args[1] === 'am' && args[2] === 'start'));
  assert.ok(!calls.some(args => args[1] === '--no-rebind'));
  assert.throws(() => launchAndroidQualification(url, () => 'UsbFfs tcp:49215 tcp:5037\n', { ...own, ports: [49215] }), /pre-existing reverse/);
  const created: number[] = []; calls.length = 0;
  assert.throws(() => launchAndroidQualification(url, args => { calls.push(args); if (args[1] === '--no-rebind') throw new Error('binding raced'); return ''; }, { ...own, portCreated: port => created.push(port) }), /binding raced/);
  assert.deepEqual(created, []);
  assert.ok(!calls.some(args => args[1] === 'am'));
});

test('the recorded provider uses the selected runtime rather than the name/version heading', () => {
  assert.deepEqual(androidWebViewProvider('Current WebView package (name, version): (com.google.android.webview, 139.0.7258.143)\nFallback logic enabled: false'),
    { name: 'com.google.android.webview', version: '139.0.7258.143' });
  assert.throws(() => androidWebViewProvider('Current WebView package (name, version): null'), /actual selected WebView/);
  assert.throws(() => androidWebViewProvider('Current WebView package (name, version)'), /actual selected WebView/);
});

test('teardown attempts every owned resource after a failure and refuses invalid port arguments', () => {
  const calls: string[][] = [];
  const errors = cleanAndroidQualification(args => { calls.push(args); if (calls.length === 1) throw new Error('fixture already stopped'); return args[1] === '--list' ? 'UsbFfs tcp:49215 tcp:49215' : ''; }, [49215, 49215], true);
  assert.equal(errors.length, 1);
  assert.deepEqual(calls, [['shell', 'am', 'force-stop', 'tools.lolly.webgpuqualification'],
    ['reverse', '--list'], ['reverse', '--remove', 'tcp:49215'], ['uninstall', 'tools.lolly.webgpuqualification']]);
  assert.throws(() => cleanAndroidQualification(() => { throw new Error('must not execute'); }, [NaN], true), /Invalid owned reverse/);
  assert.deepEqual(cleanAndroidQualification(() => { throw new Error('must not execute'); }, [49215], false), []);
  calls.length = 0;
  const changed = cleanAndroidQualification(args => { calls.push(args); return args[1] === '--list' ? 'UsbFfs tcp:49215 tcp:5037' : ''; }, [49215], true);
  assert.equal(changed.length, 1); assert.ok(!calls.some(args => args[1] === '--remove'));
  assert.ok(calls.some(args => args[0] === 'uninstall'));
});

test('runtime evidence belongs to this run and requires each actual loaded provider and settings', () => {
  const provider = { name: 'com.google.android.webview', version: '139.0.7258.143' };
  const record = { actor, package: provider.name, version: provider.version, javascriptEnabled: true, hardwareAccelerated: true };
  const log = `10-08 10:45:00 I LollyWebGpuQualification: ${JSON.stringify(record)}\n`;
  assert.deepEqual(androidNativeSettings(log, [actor], provider), [record]);
  assert.throws(() => androidNativeSettings(log, ['00000000-0000-0000-0000-000000000000'], provider), /Every launched native/);
  assert.throws(() => androidNativeSettings(log, [actor], { ...provider, version: '140.0.0.0' }), /loaded WebView version/);
  assert.throws(() => androidNativeSettings(JSON.stringify({ ...record, hardwareAccelerated: false }), [actor], provider));
});

test('the native fixture is test-only, keeps GPU defaults and limits cleartext to the collector', () => {
  const manifest = fixture('AndroidManifest.xml');
  const dom = new JSDOM();
  const xml = new dom.window.DOMParser().parseFromString(manifest, 'application/xml');
  assert.equal(xml.documentElement.tagName, 'manifest');
  dom.window.close();
  assert.match(manifest, /android:testOnly="true"/); assert.match(manifest, /android:hardwareAccelerated="true"/);
  const policy = fixture('res/xml/network_security_config.xml');
  assert.match(policy, /base-config cleartextTrafficPermitted="false"/);
  assert.match(policy, /<domain includeSubdomains="false">127\.0\.0\.1<\/domain>/);
  assert.doesNotMatch(policy, /localhost|includeSubdomains="true"/);
  const activity = fixture('QualificationActivity.java');
  assert.doesNotMatch(activity, /addJavascriptInterface|setWebViewDebuggingEnabled|enable-unsafe-webgpu|setDomStorageEnabled|setMixedContentMode/);
  assert.match(activity, /WebView\.getCurrentWebViewPackage\(\)/);
  assert.match(activity, /getJavaScriptEnabled\(\)/); assert.match(activity, /getMixedContentMode\(\)/);
});

test('the emulator workflow is manual, retains failures and cannot publish or claim a physical result', () => {
  const source = readFileSync(new URL('../.github/workflows/android-webgpu-qualification.yml', import.meta.url), 'utf8');
  const workflow = parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.source_sha, { description: 'Reviewed main commit (40 lowercase hexadecimal characters)', required: true, type: 'string' });
  const checkout = workflow.jobs['native-webview'].steps.find((step: { uses?: string }) => step.uses?.startsWith('actions/checkout@'));
  assert.match(checkout.with.ref, /^\$\{\{ inputs\.source_sha \}\}$/); assert.equal(checkout.with['fetch-depth'], 0);
  assert.equal(checkout.with['persist-credentials'], false);
  assert.equal(workflow.jobs['native-webview'].env.LOLLY_WEBGPU_SOURCE_SHA, checkout.with.ref);
  assert.match(source, /\^\[a-f0-9\]\{40\}\$/); assert.match(source, /git merge-base --is-ancestor "\$LOLLY_WEBGPU_SOURCE_SHA" origin\/main/);
  assert.doesNotMatch(source, /continue-on-error|secrets\.|enable-unsafe-webgpu|disable-web-security|git push|supported-environments\.md/);
  assert.match(source, /node scripts\/verify-webgpu-android\.ts/);
  assert.match(source, /if: always\(\)/); assert.match(source, /Physical Android .*unqualified/);
});
