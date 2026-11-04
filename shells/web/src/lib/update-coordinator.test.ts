// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { UpdateCoordinator, updatePreferences, type ShellUpdate, type UpdateEnvironment } from './update-coordinator.ts';

function fixture(raw: unknown = {}) {
  let now = 100_000_000, checks = 0, downloads = 0, installs = 0, notices = 0, closes = 0, permissions = 0, saves = 0;
  const finishes: boolean[] = [];
  let focused = false, protectedWork = true, newer = true, checkError = false, downloadError = false;
  let hold: Promise<void> | undefined;
  let env: UpdateEnvironment = { interactive: true, canInstall: true, reason: '', version: '1.1.3' };
  const update: ShellUpdate = { version: '1.1.4', currentVersion: '1.1.3', notes: '<script>hostile feed</script>',
    async download(progress) { downloads++; if (hold) await hold; if (downloadError) throw Error('offline'); progress(4, 4); },
    async install() { installs++; }, async close() { closes++; } };
  const coordinator = new UpdateCoordinator({ shell: {
    async environment() { return env; }, async focused() { return focused; },
    async notify() { notices++; }, async requestNotifications() { permissions++; },
    async onQuit() { return () => {}; }, async finish(restart) { finishes.push(restart); },
    async check() { checks++; if (hold) await hold; if (checkError) throw Error('offline'); return newer ? update : null; },
  }, read: () => raw, write: () => {}, now: () => now,
  protect: async () => { saves++; return protectedWork; }, notifyText: version => ({ title: 'Lolly', body: version }) });
  return { c: coordinator, counts: () => ({ checks, downloads, installs, notices, closes, permissions, saves }), finishes,
    time: (ms: number) => { now += ms; }, focus: (value: boolean) => { focused = value; },
    protect: (value: boolean) => { protectedWork = value; }, newer: (value: boolean) => { newer = value; },
    failCheck: (value: boolean) => { checkError = value; }, failDownload: (value: boolean) => { downloadError = value; },
    hold: (value?: Promise<void>) => { hold = value; }, env: (value: Partial<UpdateEnvironment>) => { env = { ...env, ...value }; } };
}

test('Notify discovery never downloads or installs; explicit download and restart share one state across subscriptions', async () => {
  const f = fixture(); await f.c.initialize(); await f.c.check();
  assert.equal(f.c.state.status, 'available'); await f.c.check(true); assert.equal(f.counts().downloads, 0);
  const off = f.c.subscribe(() => {}); off();
  await f.c.download(); assert.equal(f.c.state.status, 'ready');
  await f.c.quit(); assert.equal(f.counts().installs, 0); assert.deepEqual(f.finishes, [false]);
  await f.c.install(); assert.equal(f.counts().installs, 1); assert.deepEqual(f.finishes, [false, true]);
});

test('Automatic downloads but never restarts; quit installs without relaunch', async () => {
  const f = fixture({ mode: 'automatic' }); await f.c.initialize(); await f.c.check();
  assert.equal(f.c.state.status, 'ready'); assert.equal(f.counts().downloads, 1); assert.deepEqual(f.finishes, []);
  f.c.dismiss(); assert.equal(f.c.dismissed(), true);
  await f.c.quit(); assert.equal(f.counts().installs, 1); assert.deepEqual(f.finishes, [false]);
});

test('Off skips automatic discovery; manual check still works and native comparisons remain shell-owned', async () => {
  const f = fixture({ mode: 'off' }); await f.c.initialize(); await f.c.check(); assert.equal(f.counts().checks, 0);
  await f.c.check(true); assert.equal(f.counts().checks, 1); assert.equal(f.c.state.version, '1.1.4');
});

test('failed save vetoes both Restart now and install at quit', async () => {
  for (const restart of [true, false]) {
    const f = fixture({ mode: 'automatic' }); await f.c.initialize(); await f.c.check(); f.protect(false);
    if (restart) await f.c.install(); else await f.c.quit();
    assert.equal(f.counts().installs, 0); assert.deepEqual(f.finishes, []); assert.equal(f.c.state.status, 'ready');
  }
});

test('duplicate checks/downloads/installs cannot overlap', async () => {
  const f = fixture(); await f.c.initialize(); let release!: () => void;
  f.hold(new Promise<void>(resolve => { release = resolve; }));
  const checking = f.c.check(true); await f.c.check(true); assert.equal(f.counts().checks, 1); release(); await checking;
  f.hold(new Promise<void>(resolve => { release = resolve; }));
  const downloading = f.c.download(); await f.c.download(); await f.c.install(); assert.equal(f.counts().downloads, 1); release(); await downloading;
  await Promise.all([f.c.install(), f.c.install()]); assert.equal(f.counts().installs, 1);
});

test('no-newer checks throttle foreground for 24 hours; manual checks bypass the deadline', async () => {
  const f = fixture(); f.newer(false); await f.c.initialize(); await f.c.check(); await f.c.check();
  assert.equal(f.counts().checks, 1); f.time(24 * 60 * 60_000); await f.c.check(); await f.c.check(true);
  assert.equal(f.counts().checks, 3); assert.equal(f.c.state.status, 'current');
});

test('automatic fetch failures stay quiet, back off, and recover', async () => {
  const f = fixture(); f.failCheck(true); await f.c.initialize(); await f.c.check();
  assert.equal(f.c.state.status, 'idle'); assert.equal(f.c.state.error, ''); assert.equal(f.c.delay(), 300_000);
  await f.c.check(); assert.equal(f.counts().checks, 1); f.time(300_000); f.failCheck(false); await f.c.check();
  assert.equal(f.c.state.status, 'available'); assert.equal(f.c.prefs.failures, 0);
});

test('interrupted download can retry, and a mode change to Notify prevents an install at quit', async () => {
  const f = fixture({ mode: 'automatic' }); f.failDownload(true); await f.c.initialize(); await f.c.check();
  assert.equal(f.c.state.status, 'available'); f.failDownload(false); await f.c.download();
  assert.equal(f.c.state.status, 'ready'); f.c.setMode('notify'); await f.c.quit(); assert.equal(f.counts().installs, 0);
});

test('read-only AppImages and managed installs only notify and do not download', async () => {
  const f = fixture({ mode: 'automatic' }); f.env({ canInstall: false, reason: 'read-only' }); await f.c.initialize(); await f.c.check(); await f.c.download();
  assert.equal(f.counts().downloads, 0); assert.equal(f.c.state.reason, 'read-only');
});

test('headless and secondary contexts do not check, notify, save or install', async () => {
  const f = fixture({ mode: 'automatic' }); f.env({ interactive: false }); await f.c.initialize(); await f.c.check(true); await f.c.quit();
  assert.equal(f.counts().checks, 0); assert.equal(f.counts().notices, 0); assert.equal(f.counts().saves, 0);
});

test('notifications use focus across windows, never request at startup, and deduplicate per version', async () => {
  const f = fixture(); await f.c.initialize(); await f.c.check();
  assert.equal(f.counts().notices, 1); assert.equal(f.counts().permissions, 0);
  await f.c.check(); assert.equal(f.counts().notices, 1);
  const focused = fixture(); focused.focus(true); await focused.c.initialize(); await focused.c.check(); assert.equal(focused.counts().notices, 0);
  await focused.c.setNotifications(true); assert.equal(focused.counts().permissions, 1);
});

test('dispose closes native handles including a late check result', async () => {
  const f = fixture(); await f.c.initialize(); await f.c.check(); await f.c.dispose(); assert.equal(f.counts().closes, 1);
  const late = fixture(); await late.c.initialize(); let release!: () => void;
  late.hold(new Promise<void>(resolve => { release = resolve; })); const checking = late.c.check(); await late.c.dispose(); release(); await checking;
  assert.equal(late.counts().closes, 1); assert.equal(late.counts().notices, 0);
});

test('invalid chrome preferences fall back safely', () => {
  assert.equal(updatePreferences({ mode: 'surprise', lastCheck: -1, failures: Infinity }).mode, 'notify');
  assert.equal(updatePreferences(null).lastCheck, 0);
});

test('quit during a download protects work and exits without waiting for the download or installing', async () => {
  const f = fixture(); await f.c.initialize(); await f.c.check(); let release!: () => void;
  f.hold(new Promise<void>(resolve => { release = resolve; }));
  const downloading = f.c.download(); await f.c.quit();
  assert.equal(f.counts().installs, 0); assert.equal(f.counts().saves, 1); assert.deepEqual(f.finishes, [false]);
  release(); await downloading;
});

test('Off and pending Notify updates do not create a rapid maintenance timer', async () => {
  const off = fixture({ mode: 'off' }); await off.c.initialize(); assert.equal(off.c.delay(), 24 * 60 * 60_000);
  const notify = fixture(); await notify.c.initialize(); await notify.c.check(); notify.time(2 * 24 * 60 * 60_000);
  assert.equal(notify.c.delay(), 24 * 60 * 60_000);
});

test('an image becoming read-only after download still permits a protected ordinary quit', async () => {
  const f = fixture({ mode: 'automatic' }); await f.c.initialize(); await f.c.check();
  f.env({ canInstall: false, reason: 'read-only' }); await f.c.quit();
  assert.equal(f.counts().installs, 0); assert.deepEqual(f.finishes, [false]); assert.equal(f.c.state.mode, 'notify');
});

test('manual checks refresh a pending Notify offer and clear a withdrawn release without downloading', async () => {
  const f = fixture(); await f.c.initialize(); await f.c.check(); f.newer(false); await f.c.check(true);
  assert.equal(f.counts().checks, 2); assert.equal(f.counts().downloads, 0); assert.equal(f.counts().closes, 1);
  assert.equal(f.c.state.status, 'current'); assert.equal(f.c.state.version, '');
});
