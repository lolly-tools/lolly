// SPDX-License-Identifier: MPL-2.0
/**
 * The address of a design system's published brand page, as an export may record it
 * (plan 351 B5, approved 2026-11-05: the design-system record gains the address only when
 * the publisher opts in per brand, off until a page is published).
 *
 * The opt-in lives in the design system's own tokens document, so every shell reads the
 * same setting. A document that never opted in holds no key at all, and removing the
 * setting prunes what it added, so such a document stays byte-identical.
 *
 * The setting does not travel. A record in a signed file reads as that signer's, so the
 * address must never switch itself on for someone who never chose the address, and a hostile
 * pack must not be able to point other people's files at a page of its choosing. Every
 * write of a head goes through `settleBrandPageWrite`, so an address enters a head in two
 * ways only: the publisher's own switch, and a managed system's sync from its manager's
 * source. Any other write keeps what this head already held, or clears the setting.
 *
 * The same check runs on the way in from a person and on the way back from a file. A
 * credential is arbitrary bytes, and this value becomes something a person can click, so
 * anything that is not a plain `https` address on a named host is refused rather than
 * repaired. The result is the origin plus the path, in ASCII, so a look-alike host in
 * another script reads as its `xn--` form.
 *
 * Pure: no DOM, no network and no clock. Nothing here fetches the address.
 */
import { TOKEN_EXT } from './token-ext.ts';

type Rec = Record<string, unknown>;

/** Bounded, because the address is written into every export's metadata. */
export const BRAND_PAGE_ADDRESS_MAX = 512;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The address in its recorded form, or null when it cannot be recorded: anything other
 * than `https`, credentials, a query or fragment, a host with no dot, `localhost`, an IP
 * address, whitespace, a control or format character, or more than 512 characters.
 */
export function brandPageAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || raw.length > BRAND_PAGE_ADDRESS_MAX) return null;
  if (/[\p{Cc}\p{Cf}\s\\]/u.test(raw) || !/^https:\/\//i.test(raw)) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
  if (/[?#]/.test(raw)) return null;
  const host = url.hostname;
  if (!host.includes('.') || host.endsWith('.') || host.endsWith('.localhost')) return null;
  if (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const address = `${url.origin}${url.pathname}`;
  return address.length <= BRAND_PAGE_ADDRESS_MAX ? address : null;
}

/** The host a person reads ("acme.example"), or null when the address cannot be recorded. */
export function brandPageHost(value: unknown): string | null {
  const address = brandPageAddress(value);
  return address ? new URL(address).host : null;
}

/** The address this document's publisher chose to record on exports, or null. */
export function readRecordedBrandPage(doc: unknown): string | null {
  if (!isRec(doc) || !isRec(doc.$extensions)) return null;
  const vendor = doc.$extensions[TOKEN_EXT];
  const record = isRec(vendor) ? vendor.exportRecord : null;
  return isRec(record) ? brandPageAddress(record.brandPage) : null;
}

/** True when the document holds the setting in any form, even one that reads as off. */
export function carriesRecordedBrandPage(doc: unknown): boolean {
  if (!isRec(doc) || !isRec(doc.$extensions)) return false;
  const vendor = doc.$extensions[TOKEN_EXT];
  const record = isRec(vendor) ? vendor.exportRecord : null;
  return isRec(record) && 'brandPage' in record;
}

/** `doc` with the setting gone. The same object when it holds none, so nothing else changes. */
export function withoutRecordedBrandPage<T>(doc: T): T {
  return carriesRecordedBrandPage(doc) ? withRecordedBrandPage(doc, null) as T : doc;
}

/**
 * How a write of a head treats the setting. `publisher` is the person's own switch and
 * `manager` a managed system's sync from its manager's source: both write the document as
 * given. `replaced` is material arriving from elsewhere over this head, which clears the
 * setting. With none of these the write is an edit of this head, so the head's own setting
 * stands, whatever the incoming document holds.
 */
export type BrandPageWrite = 'publisher' | 'manager' | 'replaced';

/** `doc` as a device may keep it over `currentHead`. The same object when nothing changes. */
export function settleBrandPageWrite<T>(doc: T, currentHead: unknown, how?: BrandPageWrite): T {
  if (how === 'publisher' || how === 'manager') return doc;
  if (how === 'replaced') return withoutRecordedBrandPage(doc);
  const kept = readRecordedBrandPage(currentHead);
  if (!kept) return withoutRecordedBrandPage(doc);
  return readRecordedBrandPage(doc) === kept ? doc : withRecordedBrandPage(doc, kept) as T;
}

/**
 * `doc` with the setting written, as a deep clone. `null` turns the setting off and prunes
 * the containers it emptied, so a document that opts out returns to the bytes it had.
 * An address that cannot be recorded throws: a setting is either a good address or off.
 */
export function withRecordedBrandPage(doc: unknown, address: string | null): unknown {
  const next: Rec = isRec(doc) ? JSON.parse(JSON.stringify(doc)) as Rec : {};
  const ext = isRec(next.$extensions) ? next.$extensions : null;
  const vendor = ext && isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] as Rec : null;
  if (address === null) {
    if (!ext || !vendor) return next;
    const record = isRec(vendor.exportRecord) ? vendor.exportRecord : null;
    if (record) delete record.brandPage;
    if (record && Object.keys(record).length === 0) delete vendor.exportRecord;
    if (Object.keys(vendor).length === 0) delete ext[TOKEN_EXT];
    if (Object.keys(ext).length === 0) delete next.$extensions;
    return next;
  }
  const recorded = brandPageAddress(address);
  if (!recorded) throw new Error('A brand page address has to be a plain https address on a named host.');
  const extensions = ext ?? {};
  const own = vendor ?? {};
  own.exportRecord = { ...(isRec(own.exportRecord) ? own.exportRecord : {}), brandPage: recorded };
  extensions[TOKEN_EXT] = own;
  next.$extensions = extensions;
  return next;
}
