// SPDX-License-Identifier: MPL-2.0
export type UpdateMode = 'notify' | 'automatic' | 'off';
export interface ShellUpdate {
  version: string;
  currentVersion: string;
  notes: string;
  download(progress: (received: number, total: number) => void): Promise<void>;
  install(): Promise<void>;
  close(): Promise<void>;
}
export interface UpdateEnvironment { interactive: boolean; canInstall: boolean; reason: 'read-only' | 'managed' | 'unsupported' | ''; version: string }
export interface ShellUpdater {
  check(): Promise<ShellUpdate | null>;
  environment(): Promise<UpdateEnvironment>;
  focused(): Promise<boolean>;
  openDownload?(): Promise<void>;
  notify(title: string, body: string): Promise<void>;
  requestNotifications(): Promise<void>;
  onQuit(handler: () => void): Promise<() => void>;
  finish(restart: boolean): Promise<void>;
}
export interface UpdatePreferences {
  mode: UpdateMode; lastCheck: number; nextCheck: number; failures: number; dismissed: string[]; notified: string[]; notifications: boolean;
}
export interface UpdateState {
  status: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';
  mode: UpdateMode; version: string; notes: string; received: number; total: number; error: string; canInstall: boolean; reason: UpdateEnvironment['reason'];
}
export interface CoordinatorOptions {
  shell: ShellUpdater;
  read(): unknown;
  write(prefs: UpdatePreferences): void;
  protect(): Promise<boolean>;
  release?(): void;
  now?(): number;
  notifyText(version: string): { title: string; body: string };
}
const DAY = 24 * 60 * 60 * 1000;
const RETRIES = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const versions = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(-100) : [];
export function updatePreferences(raw: unknown): UpdatePreferences {
  const p = raw && typeof raw === 'object' ? raw as Partial<UpdatePreferences> : {};
  const time = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  return { mode: p.mode === 'automatic' || p.mode === 'off' ? p.mode : 'notify', lastCheck: time(p.lastCheck), nextCheck: time(p.nextCheck),
    failures: Math.min(4, Math.max(0, Math.floor(time(p.failures)))), dismissed: versions(p.dismissed), notified: versions(p.notified), notifications: p.notifications !== false };
}

/** One native update resource and one operation survive every Settings mount. */
export class UpdateCoordinator {
  readonly prefs: UpdatePreferences;
  readonly state: UpdateState;
  private pending: ShellUpdate | null = null;
  private listeners = new Set<() => void>();
  private busy = false;
  private disposed = false;
  private quitting = false;
  private interactive = false;
  private now: () => number;
  private options: CoordinatorOptions;
  constructor(options: CoordinatorOptions) {
    this.options = options;
    let raw: unknown;
    try { raw = options.read(); } catch { /* Storage may be unavailable. */ }
    this.prefs = updatePreferences(raw);
    this.now = options.now ?? Date.now;
    this.state = { status: 'idle', mode: this.prefs.mode, version: '', notes: '', received: 0, total: 0, error: '', canInstall: false, reason: '' };
  }
  async initialize(): Promise<void> {
    const env = await this.options.shell.environment();
    if (this.disposed) return;
    this.interactive = env.interactive;
    this.state.canInstall = env.canInstall; this.state.reason = env.reason;
    this.state.mode = !env.canInstall && this.prefs.mode === 'automatic' ? 'notify' : this.prefs.mode;
    this.emit();
  }
  interactiveApp(): boolean { return this.interactive; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); listener(); return () => { this.listeners.delete(listener); }; }
  private emit(): void { if (!this.disposed) for (const fn of this.listeners) fn(); }
  private persist(): void { try { this.options.write(this.prefs); } catch { /* Retain this session's choice. */ } this.emit(); }
  setMode(mode: UpdateMode): void {
    this.prefs.mode = mode; this.state.mode = !this.state.canInstall && mode === 'automatic' ? 'notify' : mode; this.persist();
    if (mode === 'automatic' && this.state.status === 'available') void this.download(false);
    else if (mode !== 'off') void this.check();
  }
  async setNotifications(enabled: boolean): Promise<void> {
    this.prefs.notifications = enabled; this.persist();
    if (enabled) { try { await this.options.shell.requestNotifications(); } catch { /* Permission denial leaves the in-app notice. */ } }
  }
  dismissed(): boolean { return this.prefs.dismissed.includes(this.state.version); }
  dismiss(): void { this.prefs.dismissed = [...this.prefs.dismissed.filter(v => v !== this.state.version), this.state.version].slice(-100); this.persist(); }
  delay(): number {
    if (this.prefs.mode === 'off' || !this.interactive || (this.pending && (this.prefs.mode !== 'automatic' || !this.prefs.failures || !this.state.canInstall))) return DAY;
    return Math.max(1000, Math.min(DAY, (this.prefs.failures ? this.prefs.nextCheck : this.prefs.lastCheck + DAY) - this.now()));
  }
  private due(): boolean {
    if (this.prefs.failures > 0) return this.now() >= this.prefs.nextCheck;
    return !this.prefs.lastCheck || this.now() >= this.prefs.lastCheck + DAY;
  }
  async check(manual = false): Promise<void> {
    if (!this.interactive || this.disposed || this.busy || this.quitting || (!manual && (this.prefs.mode === 'off' || !this.due()))) return;
    if (this.pending && this.state.status === 'ready') return;
    const previous = this.pending;
    this.busy = true; this.state.status = 'checking'; this.state.error = ''; this.emit();
    try {
      const found = await this.options.shell.check();
      if (this.disposed) { if (found !== this.pending) await found?.close(); return; }
      this.pending = found;
      if (previous && previous !== found) await previous.close().catch(() => {});
      this.prefs.lastCheck = this.now(); this.prefs.nextCheck = 0; this.prefs.failures = 0;
      this.state.status = found ? 'available' : manual ? 'current' : 'idle';
      this.state.version = found?.version ?? ''; this.state.notes = found?.notes ?? '';
      this.persist();
      if (found) await this.notify(found.version);
    } catch {
      this.prefs.failures = Math.min(4, this.prefs.failures + 1);
      this.prefs.nextCheck = this.now() + (RETRIES[this.prefs.failures - 1] ?? DAY);
      this.pending = previous;
      this.state.status = previous ? 'available' : manual ? 'error' : 'idle';
      this.state.error = manual ? 'fetch' : ''; this.persist();
    } finally { this.busy = false; this.emit(); if (this.disposed) await this.pending?.close(); }
    if (!this.disposed && !this.prefs.failures && this.prefs.mode === 'automatic' && this.state.status === 'available') await this.download(false);
  }
  private async notify(version: string): Promise<void> {
    if (this.prefs.notified.includes(version) || !this.prefs.notifications) return;
    try { if (await this.options.shell.focused()) return; } catch { return; }
    this.prefs.notified = [...this.prefs.notified, version].slice(-100); this.persist();
    const text = this.options.notifyText(version);
    try { await this.options.shell.notify(text.title, text.body); } catch { /* The in-app notice remains. */ }
  }
  async download(manual = true): Promise<void> {
    if (this.busy || this.quitting || this.disposed || !this.pending || !this.state.canInstall || this.state.status === 'ready') return;
    this.busy = true; this.state.status = 'downloading'; this.state.error = ''; this.emit();
    try {
      await this.pending.download((received, total) => { this.state.received = received; this.state.total = total; this.emit(); });
      this.state.status = 'ready'; this.prefs.failures = 0; this.prefs.nextCheck = 0;
    } catch {
      this.state.status = 'available'; this.state.error = manual ? 'download' : '';
      this.prefs.failures = Math.min(4, this.prefs.failures + 1);
      this.prefs.nextCheck = this.now() + (RETRIES[this.prefs.failures - 1] ?? DAY);
    } finally { this.busy = false; this.persist(); if (this.disposed) await this.pending?.close(); }
  }
  async install(restart = true): Promise<void> {
    if (this.busy || this.quitting || this.disposed || !this.interactive || !this.pending || this.state.status !== 'ready') return;
    this.busy = true; this.state.error = ''; this.emit();
    try {
      const env = await this.options.shell.environment();
      if (!env.interactive) return;
      if (!env.canInstall) {
        this.state.canInstall = false; this.state.reason = env.reason;
        this.state.mode = this.prefs.mode === 'automatic' ? 'notify' : this.prefs.mode;
        if (!restart && await this.options.protect()) await this.options.shell.finish(false);
        return;
      }
      if (!(await this.options.protect())) { this.state.error = 'cancelled'; return; }
      if (this.disposed) return;
      this.state.status = 'installing'; this.emit();
      await this.pending.install();
      await this.options.shell.finish(restart);
    } catch { this.state.status = 'ready'; this.state.error = 'install'; }
    finally { this.options.release?.(); this.busy = false; this.emit(); }
  }
  async quit(): Promise<void> {
    if (this.quitting || !this.interactive || this.disposed || this.state.status === 'installing') return;
    if (this.state.status === 'ready' && this.prefs.mode === 'automatic' && this.state.canInstall) { await this.install(false); return; }
    this.quitting = true;
    try { if (await this.options.protect()) await this.options.shell.finish(false); }
    catch { this.state.error = 'save'; }
    finally { this.options.release?.(); this.quitting = false; this.emit(); }
  }
  async dispose(): Promise<void> { this.disposed = true; this.listeners.clear(); if (!this.busy) await this.pending?.close(); }
}
