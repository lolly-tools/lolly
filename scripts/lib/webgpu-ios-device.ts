// SPDX-License-Identifier: MPL-2.0
/** Device changes are confined to a freshly installed UUID qualification app. */
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { closeSync, fsyncSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installedAppUrl, ownedAppName, ownedProcesses, physicalDevice, requireAbsentApp, type IosDevice, type IosProductReceipt } from './webgpu-ios-product.ts';

export interface DeviceCommands {
  read(args: string[]): unknown;
  change(args: string[]): void;
  launch(args: string[], env: NodeJS.ProcessEnv): ChildProcessWithoutNullStreams;
}
export class DeviceMutationError extends Error {
  readonly cliSucceeded: boolean;
  constructor(cliSucceeded: boolean) {
    super('Device mutation response is incomplete; inspect the recorded ownership state.'); this.cliSucceeded = cliSucceeded;
  }
}
export interface InstallOwnership {
  state: 'not-started' | 'install-attempted' | 'install-uncertain' | 'installed-unverified' | 'installed-verified' | 'cleanup-blocked' | 'remove-attempted' | 'removed-unverified' | 'removed-verified';
  cliSucceeded: boolean; appUrl: string | null; needsInspection: boolean;
}
export interface IosInstallLease {
  version: 1; runId: string; identifier: string; appSha256: string; device: IosDevice;
  installed: boolean; appUrl: string | null; ownership: InstallOwnership;
}
/** Persist each ownership boundary before another device change may start. */
export function installJournal(path: string, receipt: IosProductReceipt, device: IosDevice, owned: OwnedIosDevice): (state: InstallOwnership) => void {
  const snapshot = (ownership: InstallOwnership): string => JSON.stringify({ version: 1, runId: receipt.runId,
    identifier: receipt.identifier, appSha256: receipt.appSha256, device, installed: owned.ownsInstall,
    appUrl: ownership.appUrl, ownership } satisfies IosInstallLease, null, 2) + '\n';
  const persist = (file: string, content: string) => {
    const fd = openSync(file, 'wx', 0o600);
    try { writeFileSync(fd, content); fsyncSync(fd); } finally { closeSync(fd); }
  };
  persist(path, snapshot(owned.ownership));
  return state => {
    const temporary = path + '.next';
    persist(temporary, snapshot(state));
    try { renameSync(temporary, path); } finally { rmSync(temporary, { force: true }); }
  };
}

export function devicectlCommands(): DeviceCommands {
  const command = (args: string[], mutation = false): unknown => {
    const dir = mkdtempSync(join(tmpdir(), 'lolly-ios-read-')), output = join(dir, 'reply.json');
    let succeeded = false;
    try {
      const run = spawnSync('xcrun', ['devicectl', ...args, '--timeout', '20', '--json-output', output], { encoding: 'utf8', timeout: 25_000, maxBuffer: 1024 * 1024 });
      succeeded = !run.error && run.status === 0;
      assert.ok(!run.error && run.status === 0, 'The bounded devicectl operation failed; device state requires inspection.');
      const reply = JSON.parse(readFileSync(output, 'utf8'));
      assert.equal(reply.info?.outcome, 'success', 'The command did not report successful completion.');
      return reply;
    } catch (error) {
      if (mutation) throw new DeviceMutationError(succeeded);
      throw error;
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  return { read: command, change(args) { command(args, true); }, launch(args, env) {
    return spawn('xcrun', ['devicectl', ...args], { env, stdio: 'pipe' });
  } };
}

export function consoleEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'DEVELOPER_DIR', 'LANG', 'LC_ALL']) if (env[key]) result[key] = env[key];
  return result;
}

export class OwnedIosDevice {
  readonly receipt: IosProductReceipt;
  readonly deviceId: string;
  readonly commands: DeviceCommands;
  private installed = false;
  private checked = false;
  private consoleAllowed = false;
  private appUrl: string | null = null;
  private launching = false;
  private state: InstallOwnership['state'] = 'not-started';
  private installCliSucceeded = false;
  private observer?: (state: InstallOwnership) => void;
  constructor(receipt: IosProductReceipt, deviceId: string, commands: DeviceCommands = devicectlCommands()) {
    assert.ok(deviceId && /^[A-Za-z0-9-]+$/.test(deviceId), 'Use an exact device identifier, not a device name or URL.');
    this.receipt = receipt; this.deviceId = deviceId; this.commands = commands;
  }
  preflight(): IosDevice {
    this.checked = false;
    const device = physicalDevice(this.commands.read(['list', 'devices']), this.deviceId);
    requireAbsentApp(this.commands.read(['device', 'info', 'apps', '--device', this.deviceId, '--include-all-apps', '--bundle-id', this.receipt.identifier]));
    this.checked = true;
    return device;
  }
  install(): void {
    assert.equal(this.installed, false, 'The owned app may only be installed once.');
    assert.equal(this.state, 'not-started', 'A previous install attempt must be inspected before another mutation.');
    assert.equal(this.checked, true, 'A successful device and collision preflight is required.');
    requireAbsentApp(this.commands.read(['device', 'info', 'apps', '--device', this.deviceId, '--include-all-apps', '--bundle-id', this.receipt.identifier]));
    this.transition('install-attempted');
    try { this.commands.change(['device', 'install', 'app', '--device', this.deviceId, this.receipt.app]); }
    catch (error) {
      this.installCliSucceeded = error instanceof DeviceMutationError && error.cliSucceeded;
      this.installed = this.installCliSucceeded;
      this.transition(this.installCliSucceeded ? 'installed-unverified' : 'install-uncertain');
      throw error;
    }
    this.installed = true; this.installCliSucceeded = true; this.transition('installed-unverified');
    this.appUrl = this.freshAppUrl(); this.transition('installed-verified');
  }
  get ownsInstall(): boolean { return this.installed; }
  get installedUrl(): string | null { return this.appUrl; }
  get ownership(): InstallOwnership {
    return { state: this.state, cliSucceeded: this.installCliSucceeded, appUrl: this.appUrl,
      needsInspection: !['not-started', 'installed-verified', 'removed-verified'].includes(this.state) };
  }
  observeOwnership(observer: (state: InstallOwnership) => void): void { this.observer = observer; observer(this.ownership); }
  private transition(state: InstallOwnership['state']): void { this.state = state; this.observer?.(this.ownership); }
  private freshAppUrl(): string {
    return installedAppUrl(this.commands.read(['device', 'info', 'apps', '--device', this.deviceId, '--include-all-apps', '--bundle-id', this.receipt.identifier]), ownedAppName(this.receipt.runId));
  }
  private requireSameApp(): void {
    const fresh = this.freshAppUrl();
    if (this.appUrl) assert.equal(fresh, this.appUrl, 'The installed app URL changed; refuse to delete or control its replacement.');
    else this.appUrl = fresh;
  }
  allowInstalledConsole(lease: { runId: string; identifier: string; appSha256: string; installed: boolean; appUrl: string }): void {
    assert.equal(lease.installed, true); assert.equal(lease.runId, this.receipt.runId);
    assert.equal(lease.identifier, this.receipt.identifier); assert.equal(lease.appSha256, this.receipt.appSha256);
    this.appUrl = lease.appUrl; this.requireSameApp();
    this.consoleAllowed = true;
  }
  private processes(): number[] {
    assert.ok(this.appUrl, 'The exact installed app URL is required for process ownership.');
    return ownedProcesses(this.commands.read(['device', 'info', 'processes', '--device', this.deviceId]), this.appUrl);
  }
  launch(output: string, env = process.env): ChildProcessWithoutNullStreams {
    assert.ok(this.installed || this.consoleAllowed, 'A successful owned-install lease is required for console launch.');
    assert.equal(this.launching, false, 'The previous owned app must stop before another launch.');
    this.requireSameApp();
    assert.equal(this.processes().length, 0, 'The owned app is already running; no attachment or takeover is allowed.');
    const child = this.commands.launch(['device', 'process', 'launch', '--device', this.deviceId, '--console', '--json-output', output,
      '--environment-variables', JSON.stringify({ LOLLY_WEBGPU_PRODUCT_PROBE: this.receipt.runId, LOLLY_WEBGPU_QUALIFICATION_BUILD: '1' }),
      this.receipt.identifier], consoleEnvironment(env));
    this.launching = true;
    return child;
  }
  async closeConsole(child: ChildProcessWithoutNullStreams): Promise<void> {
    const waitExit = () => new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
      let exitTimer: ReturnType<typeof setTimeout>;
      const finish = () => { clearTimeout(exitTimer); child.off('exit', finish); resolve(); };
      exitTimer = setTimeout(finish, 3000); child.once('exit', finish);
    });
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await waitExit(); }
    try {
      // A stopped Mac console is not evidence that the device app exited.
      this.requireSameApp();
      for (const pid of this.processes()) {
        assert.ok(this.processes().includes(pid), 'The owned process changed before termination.');
        this.commands.change(['device', 'process', 'terminate', '--device', this.deviceId, '--pid', String(pid)]);
      }
      assert.equal(this.processes().length, 0, 'The owned device process did not stop.');
    } finally {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await waitExit(); }
      assert.ok(child.exitCode !== null || child.signalCode !== null, 'The owned console did not exit after bounded teardown.');
      this.launching = false;
    }
  }
  cleanup(): void {
    if (!this.installed) return;
    try {
      this.requireSameApp();
      for (const pid of this.processes()) {
        assert.ok(this.processes().includes(pid), 'The process identity changed before cleanup.');
        this.commands.change(['device', 'process', 'terminate', '--device', this.deviceId, '--pid', String(pid)]);
      }
      assert.equal(this.processes().length, 0, 'The owned app still has a running process.');
      // Recheck immediately before uninstall, after process inspection and termination.
      this.requireSameApp(); this.transition('remove-attempted');
      this.commands.change(['device', 'uninstall', 'app', '--device', this.deviceId, this.receipt.identifier]);
      this.installed = false; this.transition('removed-unverified');
      requireAbsentApp(this.commands.read(['device', 'info', 'apps', '--device', this.deviceId, '--include-all-apps', '--bundle-id', this.receipt.identifier]));
      this.transition('removed-verified');
    } catch (error) {
      if (error instanceof DeviceMutationError && error.cliSucceeded && this.state === 'remove-attempted') {
        this.installed = false; this.transition('removed-unverified');
      } else if (this.installed) this.transition('cleanup-blocked');
      throw new AggregateError([error], 'Owned iOS qualification cleanup needs inspection; no uncertain replacement is deleted.');
    }
  }
}
