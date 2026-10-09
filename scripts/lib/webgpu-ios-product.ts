// SPDX-License-Identifier: MPL-2.0
/** Pure checks for the owned development app, before any device mutation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { productProbeIdentity } from '../../shells/tauri-shared/webgpu-product-probe.mjs';

export const IOS_REGISTRATIONS = ['CFBundleURLTypes', 'CFBundleDocumentTypes', 'UTExportedTypeDeclarations', 'UTImportedTypeDeclarations'] as const;
export const sha256 = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
/** Profiles contain Date and Data values, which plutil refuses to convert to JSON. */
export function parseApplePlist(xml: string): Record<string, unknown> {
  assert.ok(Buffer.byteLength(xml) <= 4 * 1024 * 1024, 'The plist exceeds its read bound.');
  const dom = new JSDOM(xml, { contentType: 'text/xml' });
  const parse = (node: Element): unknown => {
    const text = node.textContent ?? '';
    if (['string', 'date'].includes(node.tagName)) return text;
    if (node.tagName === 'data') {
      const value = text.replace(/\s/g, ''); assert.match(value, /^[A-Za-z0-9+/]*={0,2}$/); return value;
    }
    if (node.tagName === 'true' || node.tagName === 'false') return node.tagName === 'true';
    if (node.tagName === 'integer' || node.tagName === 'real') {
      const value = Number(text); assert.ok(Number.isFinite(value), 'Invalid plist number.'); return value;
    }
    if (node.tagName === 'array') return [...node.children].map(parse);
    assert.equal(node.tagName, 'dict', 'Unexpected plist value.');
    const children = [...node.children], entries: Array<[string, unknown]> = [];
    assert.equal(children.length % 2, 0, 'Malformed plist dictionary.');
    for (let i = 0; i < children.length; i += 2) {
      assert.equal(children[i]!.tagName, 'key');
      const key = children[i]!.textContent ?? ''; assert.ok(!entries.some(([prior]) => prior === key), 'Duplicate plist key.');
      entries.push([key, parse(children[i + 1]!)]);
    }
    return Object.fromEntries(entries);
  };
  try {
    const root = dom.window.document.documentElement;
    assert.equal(root.tagName, 'plist'); assert.equal(root.children.length, 1); assert.equal(root.children[0]!.tagName, 'dict');
    return parse(root.children[0]!) as Record<string, unknown>;
  } finally { dom.window.close(); }
}
export interface IosDevice {
  identifier: string; udid: string; productType: string; osVersion: string; osBuild: string;
}
export interface IosProductReceipt {
  version: 1; platform: 'ios'; runId: string; identifier: string; app: string; binary: string;
  binarySha256: string; appSha256: string; sources: Record<string, unknown>;
  signing: { profileSha256: string; identitySha1: string; expires: string; development: true };
}

export function requireSourceSha(expected: string, actual: string): void {
  assert.match(expected, /^[a-f0-9]{40}$/, 'An immutable reviewed source SHA is required.');
  assert.equal(actual, expected, 'The checked-out source differs from the reviewed SHA.');
}

export function completeIosRuntime(report: Record<string, unknown>): boolean {
  const rows = report.productStartup;
  if (report.engine !== 'tauri-product-ios' || report.status !== 'conformance passed' || !Array.isArray(rows)) return false;
  const ready = rows.filter(row => row && typeof row === 'object' && row.event === 'ready');
  return ready.length > 0 && ready.every(row => row.os === 'ios' && row.architecture === 'aarch64'
    && typeof row.runtime === 'string' && row.runtime.trim().length > 0 && !row.runtime.startsWith('unavailable:'));
}

export function ownedAppName(runId: string): string {
  return `LollyWebGpuProduct-${productProbeIdentity(runId).split('.r')[1]}.app`;
}

export function sanitizeIosInfo(info: Record<string, unknown>, runId: string): Record<string, unknown> {
  const result = { ...info, CFBundleIdentifier: productProbeIdentity(runId), CFBundleDisplayName: 'Lolly GPU Qualification' };
  for (const key of IOS_REGISTRATIONS) delete (result as Record<string, unknown>)[key];
  return result;
}

export function validateIosInfo(info: Record<string, unknown>, runId: string, normalScene: unknown): void {
  assert.equal(info.CFBundleIdentifier, productProbeIdentity(runId), 'The generated app must have its unique test ID.');
  for (const key of IOS_REGISTRATIONS) assert.ok(!Object.hasOwn(info, key), 'Qualification must not register Lolly links or document types.');
  assert.deepEqual(info.UIApplicationSceneManifest, normalScene, 'The ordinary mobile scene must remain unchanged.');
  assert.ok(typeof info.CFBundleExecutable === 'string' && /^[A-Za-z0-9_. -]+$/.test(info.CFBundleExecutable)
    && info.CFBundleExecutable !== '.' && info.CFBundleExecutable !== '..', 'The owned executable name is invalid.');
}

export function developmentEntitlements(profile: Record<string, unknown>, identifier: string): Record<string, unknown> {
  const entitlements = profile.Entitlements as Record<string, unknown> | undefined;
  const team = entitlements?.['com.apple.developer.team-identifier'];
  assert.ok(typeof team === 'string' && /^[A-Z0-9]{10}$/.test(team), 'The development profile team is invalid.');
  assert.equal(entitlements?.['get-task-allow'], true, 'An existing development profile is required.');
  const allowed = entitlements?.['application-identifier'];
  const exact = `${team}.${identifier}`;
  assert.ok(typeof allowed === 'string' && (allowed === exact || allowed === `${team}.*`), 'The profile does not authorize this separate app.');
  return { 'application-identifier': exact, 'com.apple.developer.team-identifier': team,
    'get-task-allow': true, 'keychain-access-groups': [exact] };
}

export function validateProfile(profile: Record<string, unknown>, identifier: string, udid?: string, now = Date.now()): Record<string, unknown> {
  const entitlements = developmentEntitlements(profile, identifier);
  const expires = Date.parse(String(profile.ExpirationDate));
  assert.ok(Number.isFinite(expires) && expires > now, 'The development profile has expired.');
  assert.ok(Array.isArray(profile.Platform) && profile.Platform.includes('iOS'), 'An iOS development profile is required.');
  assert.ok(Array.isArray(profile.ProvisionedDevices) && profile.ProvisionedDevices.every(value => typeof value === 'string'), 'The profile must list its development devices.');
  if (udid) assert.ok(profile.ProvisionedDevices.includes(udid), 'The selected physical device is absent from the profile.');
  assert.ok(Array.isArray(profile.DeveloperCertificates) && profile.DeveloperCertificates.length > 0, 'The profile has no development certificate.');
  return entitlements;
}

export function validateSignedEntitlements(actual: Record<string, unknown>, profile: Record<string, unknown>, runId: string, udid?: string): void {
  assert.deepEqual(actual, validateProfile(profile, productProbeIdentity(runId), udid), 'The signed app entitlements differ from the minimal development grant.');
}

export async function appDigest(app: string): Promise<string> {
  const entries: Array<[string, string]> = [];
  const walk = async (dir: string): Promise<void> => {
    for (const name of (await readdir(dir)).sort()) {
      const path = join(dir, name), stat = await lstat(path);
      assert.ok(!stat.isSymbolicLink(), 'The qualification app may not contain external or ambiguous links.');
      if (stat.isDirectory()) await walk(path);
      else { assert.ok(stat.isFile(), 'The app contains an unexpected resource.'); entries.push([relative(app, path), sha256(await readFile(path))]); }
    }
  };
  await walk(app);
  return sha256(JSON.stringify(entries));
}

export async function validateReceiptFiles(receipt: IosProductReceipt, output: string): Promise<void> {
  assert.equal(receipt.version, 1); assert.equal(receipt.platform, 'ios');
  assert.equal(receipt.identifier, productProbeIdentity(receipt.runId));
  assert.equal(resolve(receipt.app), join(resolve(output), ownedAppName(receipt.runId)), 'Only the prepared owned app may be installed.');
  assert.equal(resolve(receipt.binary).startsWith(resolve(receipt.app) + '/'), true, 'The product binary must belong to its app.');
  assert.equal(sha256(await readFile(receipt.binary)), receipt.binarySha256, 'The source-bound binary changed.');
  assert.equal(await appDigest(receipt.app), receipt.appSha256, 'The signed qualification app changed.');
  assert.equal(receipt.signing.development, true, 'Only a development-signed qualification may run.');
}

function result(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Malformed devicectl reply.');
  const row = value as { info?: { outcome?: unknown }; result?: Record<string, unknown> };
  assert.equal(row.info?.outcome, 'success', 'The device read did not succeed.');
  assert.ok(row.result && typeof row.result === 'object' && !Array.isArray(row.result), 'The device result is absent.');
  return row.result;
}

export function physicalDevice(value: unknown, identifier: string): IosDevice {
  const devices = result(value).devices;
  assert.ok(Array.isArray(devices), 'The device inventory is absent.');
  const matches = devices.filter((row: Record<string, unknown>) => row.identifier === identifier);
  assert.equal(matches.length, 1, 'Select one exact connected device identifier.');
  const row = matches[0], hardware = row.hardwareProperties, software = row.deviceProperties;
  assert.equal(hardware?.platform, 'iOS'); assert.equal(hardware?.reality, 'physical');
  assert.equal(hardware?.deviceType, 'iPhone', 'This lane qualifies a physical iPhone.');
  assert.equal(row.connectionProperties?.pairingState, 'paired');
  assert.equal(software?.developerModeStatus, 'enabled'); assert.equal(software?.ddiServicesAvailable, true, 'Standard developer services must already be available.');
  for (const field of [hardware?.udid, hardware?.productType, software?.osVersionNumber, software?.osBuildUpdate]) assert.ok(typeof field === 'string' && field, 'Device runtime identity is incomplete.');
  return { identifier, udid: hardware.udid, productType: hardware.productType, osVersion: software.osVersionNumber, osBuild: software.osBuildUpdate };
}

export function requireAbsentApp(value: unknown): void {
  const apps = result(value).apps;
  assert.ok(Array.isArray(apps), 'The exact app inventory is absent.');
  assert.equal(apps.length, 0, 'The qualification ID is already installed; refuse to replace or reuse it.');
}

export function installedAppUrl(value: unknown, appName: string): string {
  const apps = result(value).apps;
  assert.ok(Array.isArray(apps) && apps.length === 1, 'The owned installed app must appear exactly once.');
  const valueUrl = apps[0].url;
  assert.ok(typeof valueUrl === 'string', 'The installed app URL schema is absent; no launch is permitted.');
  const url = new URL(valueUrl);
  assert.equal(url.protocol, 'file:'); assert.equal(url.hostname, '');
  assert.ok(url.pathname.endsWith(`/${appName}/`) || url.pathname.endsWith(`/${appName}`), 'The installed app directory differs from its unique artifact.');
  return url.href.endsWith('/') ? url.href : url.href + '/';
}

export function ownedProcesses(value: unknown, appUrl: string): number[] {
  const processes = result(value).runningProcesses;
  assert.ok(Array.isArray(processes), 'The process inventory schema is absent; no process may be terminated.');
  const prefix = new URL(appUrl);
  assert.equal(prefix.protocol, 'file:'); assert.ok(prefix.pathname.endsWith('/'), 'The installed app URL is incomplete.');
  const matches = processes.filter((row: Record<string, unknown>) => {
    assert.ok(typeof row.executable === 'string', 'Process executable identity is incomplete.');
    const path = row.executable.startsWith('file:') ? new URL(row.executable).pathname : row.executable;
    return path.startsWith(prefix.pathname);
  });
  return matches.map((row: Record<string, unknown>) => {
    assert.ok(Number.isSafeInteger(row.processIdentifier) && Number(row.processIdentifier) > 0, 'The owned process ID is invalid.');
    return Number(row.processIdentifier);
  });
}
