// SPDX-License-Identifier: MPL-2.0
/**
 * An editing copy of what an instance serves, and what a send takes from that copy.
 *
 * A person edits in the ordinary studio, on a copy of their own. Only colours, colour
 * roles and the brand page address go back: the document sent is the instance's mounted
 * one with those parts taken from the copy, so a local font or logo stays on this device
 * and is named instead of refused. The instance checks the result again and has the last word.
 *
 * Pure apart from `startInstanceEdit`, which writes the copy.
 */
import { TOKEN_EXT } from '../../../../../engine/src/token-ext.ts';
import { readRecordedBrandPage, withRecordedBrandPage } from '../../../../../engine/src/brand-page-address.ts';
import { sha256Hex } from '../../../../../engine/src/bytes.ts';
import { installUserTokens } from '../../bridge/tokens.ts';
import { getInstanceBase } from '../instance.ts';
import type { BrandEditDocumentV1, BrandEditHostingV1 } from '../brand-page-hosting.ts';
import type { DesignSystemRecord } from './registry.ts';
import { createDesignSystem, type ManageHost } from './manage.ts';

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isRec(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const COLOUR_GROUP = 'colourway';
const isColourwaySet = (name: string): boolean => name.startsWith('colourway/');

function setNames(doc: Rec): string[] | null {
  const keys = Object.keys(doc).filter(key => !key.startsWith('$'));
  if (!keys.length) return null;
  if (Array.isArray(doc.$themes) && doc.$themes.length) return keys;
  const order = isRec(doc.$metadata) ? doc.$metadata.tokenSetOrder : null;
  return Array.isArray(order) && order.length ? keys : null;
}
const vendorOf = (doc: Rec): Rec | null => {
  const vendor = isRec(doc.$extensions) ? doc.$extensions[TOKEN_EXT] : null;
  return isRec(vendor) ? vendor : null;
};
const systemOf = (doc: Rec): Rec | null => {
  const system = vendorOf(doc)?.brandSystem;
  return isRec(system) ? system : null;
};
/** The groups a document's colourway themes belong to. */
function colourwayGroups(doc: Rec): Set<string> {
  const groups = new Set([COLOUR_GROUP]);
  for (const theme of Array.isArray(doc.$themes) ? doc.$themes : []) {
    const vendor = isRec(theme) && isRec(theme.$extensions) ? theme.$extensions[TOKEN_EXT] : null;
    const axis = isRec(vendor) ? vendor.axis : null;
    if (isRec(axis) && axis.kind === 'colourway' && typeof theme.group === 'string') groups.add(theme.group);
  }
  return groups;
}
const themeIdOf = (theme: unknown): string => isRec(theme) ? String(theme.id ?? theme.name ?? '') : '';

export interface InstanceEdit {
  /** The document to send: the mounted one, with this copy's colours, colour roles and address. */
  doc: Rec;
  /** The kinds of change in this copy that stay on this device. Never logos it merely borrowed. */
  staysHere: Array<'fonts' | 'logos' | 'other'>;
}

/** What a send takes from the copy, on top of the mounted document. */
export function buildInstanceEdit(base: Rec, copy: Rec): InstanceEdit {
  const doc = clone(base);
  const staysHere = new Set<InstanceEdit['staysHere'][number]>();
  const baseSets = setNames(base), copySets = setNames(copy);
  const noteOther = (key: string, from: unknown, to: unknown): void => {
    if (same(from, to)) return;
    staysHere.add(key === 'font' ? 'fonts' : key === 'asset' ? 'logos' : 'other');
  };
  const takeColours = (target: Rec, from: Rec, to: Rec): void => {
    if (to.color === undefined) delete target.color;
    else target.color = clone(to.color);
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) if (key !== 'color' && !key.startsWith('$')) noteOther(key, from[key], to[key]);
  };
  if (!baseSets || !copySets) {
    if (!baseSets && !copySets) takeColours(doc, base, copy);
    else staysHere.add('other');
  } else {
    for (const name of new Set([...baseSets, ...copySets])) {
      const from = base[name], to = copy[name];
      if (isRec(from) && isRec(to)) takeColours(doc[name] as Rec, from, to);
      else if (isRec(to) && isColourwaySet(name)) {
        doc[name] = to.color === undefined ? {} : { color: clone(to.color) };
        for (const key of Object.keys(to)) if (key !== 'color') staysHere.add('other');
      } else if (from !== undefined && to === undefined && isColourwaySet(name)) delete doc[name];
      else if (!same(from, to)) staysHere.add('other');
    }
    const groups = new Set([...colourwayGroups(base), ...colourwayGroups(copy)]);
    const isColourway = (theme: unknown): boolean => isRec(theme) && typeof theme.group === 'string' && groups.has(theme.group);
    const copyThemes = Array.isArray(copy.$themes) ? copy.$themes : [];
    const baseThemes = Array.isArray(base.$themes) ? base.$themes : [];
    // Gaining a first colourway notes which themes are light and dark; nothing else about them travels.
    const stripNote = (theme: unknown): unknown => {
      if (!isRec(theme) || !isRec(theme.$extensions)) return theme;
      const vendor = theme.$extensions[TOKEN_EXT];
      if (!isRec(vendor) || !isRec(vendor.axis) || vendor.axis.kind !== 'mode') return theme;
      const { axis: _axis, ...restVendor } = vendor;
      const { [TOKEN_EXT]: _vendor, ...restExt } = theme.$extensions;
      const ext = Object.keys(restVendor).length ? { ...restExt, [TOKEN_EXT]: restVendor } : restExt;
      const { $extensions: _ext, ...rest } = theme;
      return Object.keys(ext).length ? { ...rest, $extensions: ext } : rest;
    };
    const others = baseThemes.filter(theme => !isColourway(theme)).map(theme => {
      const mine = copyThemes.find(item => !isColourway(item) && themeIdOf(item) === themeIdOf(theme));
      return mine !== undefined && same(stripNote(mine), stripNote(theme)) ? clone(mine) : theme;
    });
    doc.$themes = [...others, ...clone(copyThemes.filter(isColourway))];
    if (isRec(doc.$metadata) && Array.isArray(doc.$metadata.tokenSetOrder)) {
      const copyOrder = isRec(copy.$metadata) && Array.isArray(copy.$metadata.tokenSetOrder) ? copy.$metadata.tokenSetOrder as string[] : [];
      doc.$metadata.tokenSetOrder = [...(doc.$metadata.tokenSetOrder as string[]).filter(name => !isColourwaySet(name)), ...copyOrder.filter(name => isColourwaySet(name) && isRec(doc[name]))];
    }
  }
  // Colour roles and their bindings; anything else in the record is the mounted one's.
  const copySystem = systemOf(copy), baseSystem = systemOf(base);
  const colourRoles = (system: Rec | null): Rec[] => (system && Array.isArray(system.roles) ? system.roles : []).filter((role): role is Rec => isRec(role) && role.group === COLOUR_GROUP);
  const mine = colourRoles(copySystem);
  if (baseSystem || mine.length) {
    const ids = new Set(mine.map(role => role.id));
    const keptRoles = (baseSystem && Array.isArray(baseSystem.roles) ? baseSystem.roles : []).filter(role => !(isRec(role) && role.group === COLOUR_GROUP));
    const baseColourIds = new Set(colourRoles(baseSystem).map(role => role.id));
    const keptBindings = (baseSystem && Array.isArray(baseSystem.bindings) ? baseSystem.bindings : []).filter(binding => isRec(binding) && !baseColourIds.has(binding.roleId));
    const myBindings = (copySystem && Array.isArray(copySystem.bindings) ? copySystem.bindings : []).filter(binding => isRec(binding) && ids.has(binding.roleId));
    const next: Rec = baseSystem ? clone(baseSystem) : { schemaVersion: 1, id: String(copySystem?.id ?? ''), label: String(copySystem?.label ?? ''), rules: [] };
    next.roles = [...clone(keptRoles), ...clone(mine)];
    next.bindings = [...clone(keptBindings), ...clone(myBindings)];
    if (baseSystem || mine.length) {
      const ext: Rec = isRec(doc.$extensions) ? doc.$extensions : {};
      const own: Rec = isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : {};
      own.brandSystem = next;
      ext[TOKEN_EXT] = own;
      doc.$extensions = ext;
    }
  }
  return { doc: withRecordedBrandPage(doc, readRecordedBrandPage(copy)) as Rec, staysHere: [...staysHere] };
}

export type InstanceEditHost = Parameters<typeof installUserTokens>[0] & ManageHost;

/** This device's editing copy for an instance's source, if it has one. */
async function existingCopy(host: InstanceEditHost, instance: string, sourceId: string): Promise<DesignSystemRecord | null> {
  const records = await host.designSystems.list();
  return records.find(record => record.instanceEdit?.instance === instance && record.instanceEdit.sourceId === sourceId) ?? null;
}

/** Write what the instance serves into a copy, with the address it records, which an ordinary copy leaves behind. */
async function seedCopy(host: InstanceEditHost, record: DesignSystemRecord, document: BrandEditDocumentV1): Promise<DesignSystemRecord> {
  const served = JSON.parse(document.served) as Rec;
  const address = readRecordedBrandPage(served);
  if (address) {
    const head = await host.assets._getBlob(record.headId);
    const doc = head ? JSON.parse(await head.text()) : served;
    // The manager's own source: the one write of a head that may set the address.
    await installUserTokens(host, withRecordedBrandPage(doc, address), { system: record.id, brandPage: 'manager' });
  }
  const next: DesignSystemRecord = { ...record, instanceEdit: { ...record.instanceEdit!, servedDigest: await sha256Hex(new TextEncoder().encode(document.served)) } };
  await host.designSystems.put(next);
  return next;
}

/** The copy to edit: the one this device already has for this source, or a new one of what is served now. */
export async function startInstanceEdit(host: InstanceEditHost, hosting: BrandEditHostingV1): Promise<DesignSystemRecord> {
  const document = await hosting.read();
  const instance = getInstanceBase();
  const existing = await existingCopy(host, instance, document.sourceId);
  if (existing) return existing;
  const record = await createDesignSystem(host, {
    label: `${document.label} (${hosting.host})`,
    seedDoc: JSON.parse(document.served) as Record<string, unknown>,
  });
  const marked: DesignSystemRecord = { ...record, instanceEdit: { instance, host: hosting.host, sourceId: document.sourceId, servedDigest: '' } };
  return seedCopy(host, marked, document);
}

/** The whole record behind what a view holds, so a write keeps every field it does not name. */
async function fullRecord(host: InstanceEditHost, id: string): Promise<DesignSystemRecord> {
  const record = await host.designSystems.get(id);
  if (!record) throw new Error('This copy is no longer on this device.');
  return record;
}

/** Start the copy again from what the instance serves now, dropping what it held. */
export async function restartInstanceEdit(host: InstanceEditHost, held: Pick<DesignSystemRecord, 'id'>, document: BrandEditDocumentV1): Promise<DesignSystemRecord> {
  const record = await fullRecord(host, held.id);
  const { withDesignSystemIdentity } = await import('../../../../../engine/src/design-system.ts');
  await installUserTokens(host, withDesignSystemIdentity(JSON.parse(document.served), { id: record.id, label: record.label }), { system: record.id, label: record.label });
  host.tokens?.bust?.();
  return seedCopy(host, record, document);
}

/** After a send: the copy matches what the instance serves. */
export async function noteInstanceEditSent(host: InstanceEditHost, held: Pick<DesignSystemRecord, 'id'>, sent: string): Promise<DesignSystemRecord> {
  const record = await fullRecord(host, held.id);
  const next: DesignSystemRecord = { ...record, instanceEdit: { ...record.instanceEdit!, servedDigest: await sha256Hex(new TextEncoder().encode(sent)) } };
  await host.designSystems.put(next);
  return next;
}
