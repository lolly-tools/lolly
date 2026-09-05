// SPDX-License-Identifier: MPL-2.0
/**
 * RPM v4 package writer - the container half of a `.rpm`. Given package metadata
 * and a set of files at absolute install paths, it emits an installable, noarch,
 * unsigned binary RPM: a 96-byte Lead, a Signature header, the Main header, and a
 * gzipped `cpio` payload (built by `cpio.ts`). The higher-level "make a GOOD font /
 * icon / wallpaper package" knowledge (layout, scriptlets, AppStream) lives in
 * `linux-pack.ts`; this module knows only the binary format, the way `tar.ts`
 * knows only USTAR.
 *
 * --- The four sections (in file order) ---
 *   Lead (96 bytes)      legacy, mostly ignored by modern rpm except the magic +
 *                        the binary/source flag; we still write a well-formed one.
 *   Signature header     integrity of what follows. Unsigned MVP: the SHA-256 of
 *                        the Main header (RPMSIGTAG_SHA256), and the byte size of
 *                        header+payload (RPMSIGTAG_SIZE). SUSE's rpm (4.14+)
 *                        verifies via the SHA-256 header digest, so no MD5 is
 *                        needed for the SUSE target (plan 197, D3).
 *   Main header          all package metadata + the parallel file-list arrays.
 *   Payload              gzip(cpio(files)).
 *
 * --- The header structure (shared by both headers) ---
 * An 8-byte magic (8E AD E8 01 + 4 reserved), then the index length `il` and the
 * data length `dl` (both u32 BE), then `il` 16-byte index entries (tag, type,
 * offset, count - all u32 BE), then the `dl`-byte data store. Numeric arrays are
 * aligned within the store (INT16→2, INT32→4). `encodeHeader` also writes the
 * immutable-region trailer (RPMTAG_HEADERIMMUTABLE / _HEADERSIGNATURES) that a
 * conforming rpm requires to treat the header as one signed, immutable region -
 * the part naive writers get wrong, so it is done explicitly and verified against
 * a real `rpm` in CI (plan 197 section 11).
 *
 * --- Determinism (plan 197 section 3) ---
 * Build time and every file mtime default to `buildEpoch` (0, or a passed
 * SOURCE_DATE_EPOCH); uid/gid are root/root; the payload gzip is reproducible.
 * A given input therefore yields a byte-identical `.rpm` - what a CI-driven
 * packager wants for cache keys and diffable rebuilds.
 *
 * --- Scope ---
 * noarch data packages (no ELF, no arch payload). DOM-free; async only because
 * file digests use WebCrypto SHA-256 (`bytes.ts`).
 */

import { sha256, sha256Hex, bytesToHex, concatBytes } from './bytes.ts';
import { gzip } from './gzip.ts';
import { packCpio, type CpioFile } from './cpio.ts';

// ── RPM tag numbers (main header) ─────────────────────────────────────────────
const TAG_HEADERI18NTABLE = 100;
const TAG_HEADERIMMUTABLE = 63;
const TAG_HEADERSIGNATURES = 62;
const TAG_NAME = 1000;
const TAG_VERSION = 1001;
const TAG_RELEASE = 1002;
const TAG_SUMMARY = 1004;
const TAG_DESCRIPTION = 1005;
const TAG_BUILDTIME = 1006;
const TAG_BUILDHOST = 1007;
const TAG_SIZE = 1009;
const TAG_VENDOR = 1011;
const TAG_LICENSE = 1014;
const TAG_GROUP = 1016;
const TAG_URL = 1020;
const TAG_OS = 1021;
const TAG_ARCH = 1022;
const TAG_PREIN = 1023;
const TAG_POSTIN = 1024;
const TAG_PREUN = 1025;
const TAG_POSTUN = 1026;
const TAG_FILESIZES = 1028;
const TAG_FILEMODES = 1030;
const TAG_FILERDEVS = 1033;
const TAG_FILEMTIMES = 1034;
const TAG_FILEDIGESTS = 1035;
const TAG_FILELINKTOS = 1036;
const TAG_FILEFLAGS = 1037;
const TAG_FILEUSERNAME = 1039;
const TAG_FILEGROUPNAME = 1040;
const TAG_PROVIDEFLAGS = 1112;
const TAG_PROVIDEVERSION = 1113;
const TAG_DIRINDEXES = 1116;
const TAG_BASENAMES = 1117;
const TAG_DIRNAMES = 1118;
const TAG_REQUIREFLAGS = 1048;
const TAG_REQUIRENAME = 1049;
const TAG_REQUIREVERSION = 1050;
const TAG_RPMVERSION = 1064;
const TAG_CHANGELOGTIME = 1080;
const TAG_CHANGELOGNAME = 1081;
const TAG_CHANGELOGTEXT = 1082;
const TAG_PROVIDENAME = 1047;
const TAG_FILEDEVICES = 1095;
const TAG_FILEINODES = 1096;
const TAG_FILELANGS = 1097;
const TAG_PAYLOADFORMAT = 1124;
const TAG_PAYLOADCOMPRESSOR = 1125;
const TAG_PAYLOADFLAGS = 1126;
const TAG_PREINPROG = 1085;
const TAG_POSTINPROG = 1086;
const TAG_PREUNPROG = 1087;
const TAG_POSTUNPROG = 1088;
const TAG_FILEDIGESTALGO = 5011;
const TAG_PAYLOADDIGEST = 5092;
const TAG_PAYLOADDIGESTALGO = 5093;

// Signature header tag numbers.
const SIGTAG_SIZE = 1000;
const SIGTAG_PAYLOADSIZE = 1007;
const SIGTAG_SHA256 = 273; // == RPMTAG_SHA256HEADER: hex SHA-256 of the main header

// ── Header field types (rpm) ──────────────────────────────────────────────────
const T_INT16 = 3;
const T_INT32 = 4;
const T_STRING = 6;
const T_BIN = 7;
const T_STRING_ARRAY = 8;
const T_I18NSTRING = 9;

// ── Dependency sense flags ────────────────────────────────────────────────────
const SENSE_LESS = 0x02;
const SENSE_EQUAL = 0x08;
const SENSE_RPMLIB = 0x01000000; // 1 << 24
const RPMLIB_FLAGS = SENSE_RPMLIB | SENSE_LESS | SENSE_EQUAL;

// ── st_mode type bits ─────────────────────────────────────────────────────────
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;

const PGPHASHALGO_SHA256 = 8;
const HASH_SHA256 = 8;

/** One installed file (or owned directory) the package delivers. */
export interface RpmFileEntry {
  /** Absolute install path, e.g. "/usr/share/fonts/acme/Acme.ttf". */
  path: string;
  /** File contents. Ignored for a directory entry. */
  data?: Uint8Array;
  /** Permission bits (perms only, no type bits). Default 0644 file / 0755 dir. */
  mode?: number;
  /** Directory entry (the package owns this directory). */
  isDir?: boolean;
  /** RPMFILE_* flags (e.g. 2 = %doc, 128 = %license, 1 = %config). Default 0. */
  flags?: number;
}

/** A versioned dependency (Provides/Requires). */
export interface RpmDep {
  name: string;
  version?: string;
  /** RPMSENSE_* flags. Default RPMSENSE_EQUAL when a version is given, else 0. */
  flags?: number;
}

/** One changelog entry. */
export interface RpmChangelogEntry {
  /** Entry time (epoch seconds). Default = the package build epoch. */
  time?: number;
  /** Author line, e.g. "Andy Fitzsimon <andy@…>". A "- version-release" suffix
   *  is appended automatically so rpmlint sees a coherent version. */
  author: string;
  /** The entry body (one or more "- change" lines). */
  text: string;
}

/** Package metadata for {@link buildRpm}. */
export interface RpmMeta {
  name: string;
  version: string;
  /** Default "1". */
  release?: string;
  summary: string;
  /** Default = summary. */
  description?: string;
  /** SPDX license expression - required (rpmlint bounces a package with none). */
  license: string;
  group?: string;
  os?: string; // default "linux"
  arch?: string; // default "noarch"
  vendor?: string;
  url?: string;
  buildHost?: string; // default "lolly"
  /** SOURCE_DATE_EPOCH: build time + all file mtimes. Default 0 (reproducible). */
  buildEpoch?: number;
  /** Extra Requires beyond the automatic rpmlib() feature deps. */
  requires?: RpmDep[];
  /** Extra Provides beyond the automatic `name = version-release`. */
  provides?: RpmDep[];
  /** Scriptlets, stored in the header (run by /bin/sh). */
  prein?: string;
  postin?: string;
  preun?: string;
  postun?: string;
  /** Changelog, newest first. Defaults to a single generated entry (rpmlint
   *  requires at least one). */
  changelog?: RpmChangelogEntry[];
}

/** Input to {@link buildRpm}. */
export interface RpmSpec {
  meta: RpmMeta;
  files: RpmFileEntry[];
}

// ── big-endian integer writers ────────────────────────────────────────────────
function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}
function u16(n: number): Uint8Array {
  return Uint8Array.of((n >>> 8) & 0xff, n & 0xff);
}

const enc = new TextEncoder();
const cstr = (s: string): Uint8Array => concatBytes([enc.encode(s), Uint8Array.of(0)]);

// ── header index entries ──────────────────────────────────────────────────────
interface HdrEntry { tag: number; type: number; count: number; data: Uint8Array; align: number }

const eString = (tag: number, s: string): HdrEntry => ({ tag, type: T_STRING, count: 1, data: cstr(s), align: 1 });
const eI18n = (tag: number, s: string): HdrEntry => ({ tag, type: T_I18NSTRING, count: 1, data: cstr(s), align: 1 });
function eStringArray(tag: number, arr: string[]): HdrEntry {
  return { tag, type: T_STRING_ARRAY, count: arr.length, data: concatBytes(arr.map(cstr)), align: 1 };
}
function eInt32(tag: number, nums: number[]): HdrEntry {
  return { tag, type: T_INT32, count: nums.length, data: concatBytes(nums.map(u32)), align: 4 };
}
function eInt16(tag: number, nums: number[]): HdrEntry {
  return { tag, type: T_INT16, count: nums.length, data: concatBytes(nums.map(u16)), align: 2 };
}

/**
 * Serialize a header (index + data store) with the immutable-region trailer.
 * `regionTag` is RPMTAG_HEADERIMMUTABLE (main) or RPMTAG_HEADERSIGNATURES (sig).
 * The region entry is index[0]; its 16-byte trailer is the last thing in the data
 * store and back-references the whole index via a negative offset.
 */
function encodeHeader(entries: HdrEntry[], regionTag: number): Uint8Array {
  const index: Uint8Array[] = [];
  const body: Uint8Array[] = [];
  let dl = 0;
  const il = entries.length + 1; // + the region entry (index[0])

  const indexEntry = (tag: number, type: number, offset: number, count: number): Uint8Array =>
    concatBytes([u32(tag), u32(type), u32(offset), u32(count)]);

  for (const e of entries) {
    if (dl % e.align !== 0) {
      const pad = e.align - (dl % e.align);
      body.push(new Uint8Array(pad));
      dl += pad;
    }
    index.push(indexEntry(e.tag, e.type, dl, e.count));
    body.push(e.data);
    dl += e.data.length;
  }
  // Region trailer: an entryInfo pointing back over the whole index (negative).
  const trailerOffset = dl;
  body.push(concatBytes([u32(regionTag), u32(T_BIN), u32((-(il * 16)) >>> 0), u32(16)]));
  dl += 16;

  const magic = Uint8Array.of(0x8e, 0xad, 0xe8, 0x01, 0, 0, 0, 0);
  const regionIndex = indexEntry(regionTag, T_BIN, trailerOffset, 16);
  return concatBytes([magic, u32(il), u32(dl), regionIndex, ...index, ...body]);
}

/** Split an absolute path into a dir (with trailing "/") and a basename. */
function splitPath(path: string): { dir: string; base: string } {
  const i = path.lastIndexOf('/');
  return { dir: path.slice(0, i + 1), base: path.slice(i + 1) };
}


/**
 * Build an installable, unsigned, noarch binary RPM from `spec`. Deterministic:
 * a given spec yields byte-identical output. Async because file digests use
 * WebCrypto SHA-256.
 */
export async function buildRpm(spec: RpmSpec): Promise<Uint8Array> {
  const m = spec.meta;
  const release = m.release ?? '1';
  const epoch = m.buildEpoch ?? 0;
  const arch = m.arch ?? 'noarch';
  const nevra = `${m.name}-${m.version}-${release}`;

  // Deterministic file order: as given (BASENAMES order == cpio order == inodes).
  const files = spec.files;

  // ── payload ──
  const cpioFiles: CpioFile[] = files.map((f) => ({
    name: '.' + f.path,
    data: f.isDir ? new Uint8Array(0) : (f.data ?? new Uint8Array(0)),
    mode: (f.isDir ? S_IFDIR : S_IFREG) | (f.mode ?? (f.isDir ? 0o755 : 0o644)),
    mtime: epoch,
  }));
  const payloadRaw = packCpio(cpioFiles);
  const payload = gzip(payloadRaw);

  // ── file-list arrays ──
  const dirNames: string[] = [];
  const dirIndex = new Map<string, number>();
  const baseNames: string[] = [];
  const dirIndexes: number[] = [];
  const fileSizes: number[] = [];
  const fileModes: number[] = [];
  const fileDigests: string[] = [];
  const fileFlags: number[] = [];
  const fileMtimes: number[] = [];
  const fileInodes: number[] = [];
  let sizeTotal = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const { dir, base } = splitPath(f.path);
    if (!dirIndex.has(dir)) { dirIndex.set(dir, dirNames.length); dirNames.push(dir); }
    dirIndexes.push(dirIndex.get(dir)!);
    baseNames.push(base);
    const bytes = f.isDir ? new Uint8Array(0) : (f.data ?? new Uint8Array(0));
    fileSizes.push(bytes.length);
    sizeTotal += bytes.length;
    fileModes.push(((f.isDir ? S_IFDIR : S_IFREG) | (f.mode ?? (f.isDir ? 0o755 : 0o644))) & 0xffff);
    fileDigests.push(f.isDir ? '' : bytesToHex(await sha256(bytes)));
    fileFlags.push(f.flags ?? 0);
    fileMtimes.push(epoch);
    fileInodes.push(i + 1);
  }
  const nfiles = files.length;

  // ── dependencies ──
  const provNames = [m.name, ...(m.provides ?? []).map((d) => d.name)];
  const provVers = [`${m.version}-${release}`, ...(m.provides ?? []).map((d) => d.version ?? '')];
  const provFlags = [SENSE_EQUAL, ...(m.provides ?? []).map((d) => d.flags ?? (d.version ? SENSE_EQUAL : 0))];

  const reqNames = ['rpmlib(CompressedFileNames)', 'rpmlib(FileDigests)', 'rpmlib(PayloadFilesHavePrefix)'];
  const reqVers = ['3.0.4-1', '4.6.0-1', '4.0-1'];
  const reqFlags = [RPMLIB_FLAGS, RPMLIB_FLAGS, RPMLIB_FLAGS];
  for (const d of m.requires ?? []) {
    reqNames.push(d.name);
    reqVers.push(d.version ?? '');
    reqFlags.push(d.flags ?? (d.version ? SENSE_EQUAL : 0));
  }

  // ── main header entries ──
  const entries: HdrEntry[] = [];
  entries.push(eStringArray(TAG_HEADERI18NTABLE, ['C']));
  entries.push(eString(TAG_NAME, m.name));
  entries.push(eString(TAG_VERSION, m.version));
  entries.push(eString(TAG_RELEASE, release));
  entries.push(eI18n(TAG_SUMMARY, m.summary));
  entries.push(eI18n(TAG_DESCRIPTION, m.description ?? m.summary));
  entries.push(eInt32(TAG_BUILDTIME, [epoch]));
  entries.push(eString(TAG_BUILDHOST, m.buildHost ?? 'lolly'));
  entries.push(eInt32(TAG_SIZE, [sizeTotal]));
  if (m.vendor) entries.push(eString(TAG_VENDOR, m.vendor));
  entries.push(eString(TAG_LICENSE, m.license));
  if (m.group) entries.push(eI18n(TAG_GROUP, m.group));
  if (m.url) entries.push(eString(TAG_URL, m.url));
  entries.push(eString(TAG_OS, m.os ?? 'linux'));
  entries.push(eString(TAG_ARCH, arch));
  entries.push(eString(TAG_RPMVERSION, '4.18.0'));

  // scriptlets
  const addScript = (tag: number, progTag: number, body?: string): void => {
    if (!body) return;
    entries.push(eString(tag, body));
    entries.push(eStringArray(progTag, ['/bin/sh']));
  };
  addScript(TAG_PREIN, TAG_PREINPROG, m.prein);
  addScript(TAG_POSTIN, TAG_POSTINPROG, m.postin);
  addScript(TAG_PREUN, TAG_PREUNPROG, m.preun);
  addScript(TAG_POSTUN, TAG_POSTUNPROG, m.postun);

  // changelog (rpmlint requires at least one entry). rpm renders the date from
  // CHANGELOGTIME itself, so CHANGELOGNAME carries only "author - version-release".
  const changelog = m.changelog ?? [{ author: m.vendor ?? 'Lolly', text: '- Package generated by Lolly.' }];
  entries.push(eInt32(TAG_CHANGELOGTIME, changelog.map((c) => c.time ?? epoch)));
  entries.push(eStringArray(TAG_CHANGELOGNAME, changelog.map((c) => `${c.author} - ${m.version}-${release}`)));
  entries.push(eStringArray(TAG_CHANGELOGTEXT, changelog.map((c) => c.text)));

  // dependencies
  entries.push(eStringArray(TAG_PROVIDENAME, provNames));
  entries.push(eInt32(TAG_PROVIDEFLAGS, provFlags));
  entries.push(eStringArray(TAG_PROVIDEVERSION, provVers));
  entries.push(eStringArray(TAG_REQUIRENAME, reqNames));
  entries.push(eInt32(TAG_REQUIREFLAGS, reqFlags));
  entries.push(eStringArray(TAG_REQUIREVERSION, reqVers));

  // file list (only when the package ships files)
  if (nfiles > 0) {
    entries.push(eInt32(TAG_FILESIZES, fileSizes));
    entries.push(eInt16(TAG_FILEMODES, fileModes));
    entries.push(eInt16(TAG_FILERDEVS, fileSizes.map(() => 0)));
    entries.push(eInt32(TAG_FILEMTIMES, fileMtimes));
    entries.push(eStringArray(TAG_FILEDIGESTS, fileDigests));
    entries.push(eStringArray(TAG_FILELINKTOS, fileSizes.map(() => '')));
    entries.push(eInt32(TAG_FILEFLAGS, fileFlags));
    entries.push(eStringArray(TAG_FILEUSERNAME, fileSizes.map(() => 'root')));
    entries.push(eStringArray(TAG_FILEGROUPNAME, fileSizes.map(() => 'root')));
    entries.push(eInt32(TAG_FILEDEVICES, fileSizes.map(() => 1)));
    entries.push(eInt32(TAG_FILEINODES, fileInodes));
    entries.push(eStringArray(TAG_FILELANGS, fileSizes.map(() => '')));
    entries.push(eInt32(TAG_DIRINDEXES, dirIndexes));
    entries.push(eStringArray(TAG_BASENAMES, baseNames));
    entries.push(eStringArray(TAG_DIRNAMES, dirNames));
    entries.push(eInt32(TAG_FILEDIGESTALGO, [PGPHASHALGO_SHA256]));
  }

  entries.push(eString(TAG_PAYLOADFORMAT, 'cpio'));
  entries.push(eString(TAG_PAYLOADCOMPRESSOR, 'gzip'));
  entries.push(eString(TAG_PAYLOADFLAGS, '9'));
  entries.push(eStringArray(TAG_PAYLOADDIGEST, [await sha256Hex(payload)]));
  entries.push(eInt32(TAG_PAYLOADDIGESTALGO, [HASH_SHA256]));

  const mainHeader = encodeHeader(entries, TAG_HEADERIMMUTABLE);

  // ── signature header (unsigned: main-header digest + sizes) ──
  // RPMSIGTAG_SHA256 is a STRING: the hex SHA-256 of the main header bytes.
  const sigEntries: HdrEntry[] = [
    eString(SIGTAG_SHA256, await sha256Hex(mainHeader)),
    eInt32(SIGTAG_SIZE, [mainHeader.length + payload.length]),
    eInt32(SIGTAG_PAYLOADSIZE, [payloadRaw.length]),
  ];
  const sigHeader = encodeHeader(sigEntries, TAG_HEADERSIGNATURES);
  // Pad the signature header to an 8-byte boundary so the main header (the signed
  // region) starts aligned.
  const sigPad = (8 - (sigHeader.length % 8)) % 8;

  // ── lead (96 bytes) ──
  const lead = new Uint8Array(96);
  lead.set([0xed, 0xab, 0xee, 0xdb], 0); // magic
  lead[4] = 3; // major
  lead[5] = 0; // minor
  // type (0 = binary) at 6..7 already zero; archnum at 8..9
  lead[9] = 1;
  const nameBytes = enc.encode(nevra).subarray(0, 65);
  lead.set(nameBytes, 10); // name (66 bytes, NUL-padded)
  lead[76] = 0; lead[77] = 1; // osnum = 1 (linux)
  lead[78] = 0; lead[79] = 5; // signature type = 5 (RPMSIGTYPE_HEADERSIG)
  // reserved (80..95) already zero

  return concatBytes([lead, sigHeader, new Uint8Array(sigPad), mainHeader, payload]);
}
