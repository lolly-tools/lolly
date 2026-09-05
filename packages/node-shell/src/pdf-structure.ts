// SPDX-License-Identifier: MPL-2.0
/**
 * PDF structural inspection - what a document CARRIES and what it DOES, as
 * opposed to what it says about itself.
 *
 * `analyzePdf` in ./pdf.ts reads the Info dictionary and the XMP packet: the
 * document's own description of itself. That is the small half of "what's hidden
 * in this file". The larger half is structural - payloads and behaviour that no
 * metadata field mentions:
 *
 *   • attachments - a PDF is a container; /EmbeddedFiles can hold anything
 *   • scripts - /JavaScript that runs when the document opens
 *   • outward actions - /Launch, /SubmitForm, /GoToR, /URI
 *   • form values - filled AcroForm fields (the classic accidental leak)
 *   • annotations - reviewer names and comment text left in the margins
 *   • hidden layers - optional-content groups shipped switched OFF
 *
 * All of it is pure pdf-lib object-graph work, so it lives here rather than in
 * the bridge: it can be unit-tested against in-memory documents without a
 * browser. ./pdf.ts loads this lazily, keeping pdf-lib off the startup path.
 *
 * MOVED here from `shells/web/src/bridge/pdf-structure.ts` (plans/202 WP1.1),
 * because ./pdf.ts moved and reaches this by a sibling dynamic import. The web
 * file stays as a re-export shim. The CLI gets the structural findings it was
 * already getting; nothing about the walk changed.
 *
 * Read-only by construction - nothing here mutates the document. Note that
 * `stripPdf` does NOT remove any of this; a "clean copy" still stays a
 * metadata-only operation, because dropping a script or an attachment changes
 * what the document IS, not merely what it discloses.
 *
 * The graph is hostile input: refs can be cyclic, arrays can be enormous, and
 * every dictionary is optional. Every walk is depth-capped, cycle-guarded via
 * ref tags, and output-capped, and every accessor swallows malformed objects
 * rather than throwing - a corrupt PDF must yield fewer findings, never an
 * error that costs the viewer the metadata panel too.
 */

import {
  PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString, PDFNumber, PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import type { PDFContext, PDFDocument, PDFObject } from 'pdf-lib';
import type { PdfFinding } from '@lolly-tools/core/host-v1';

// Walk limits. A name tree or field tree deeper than this, or wider than this,
// is either pathological or an attack; we report what we found and stop.
const MAX_DEPTH = 32;
const MAX_ITEMS = 500;
/** How many names a single finding lists before it summarises the tail. */
const LIST_CAP = 8;
/** Longest detail string we hand to the viewer - scripts especially can be huge. */
const DETAIL_CAP = 400;

// ── object access ─────────────────────────────────────────────────────────────
// Deliberately duplicated from ../lib/pdf-objects.ts rather than imported: that
// module pulls in the shading/PostScript decoders, which this has no use for.

type Ref = PDFObject | null | undefined;

function look(ctx: PDFContext, o: Ref): PDFObject | undefined {
  try { return ctx.lookup(o as PDFObject | undefined); } catch { return undefined; }
}

function dictOf(ctx: PDFContext, o: Ref): PDFDict | null {
  const v = look(ctx, o);
  return v instanceof PDFRawStream ? v.dict : (v instanceof PDFDict ? v : null);
}

function get(ctx: PDFContext, o: Ref, key: string): PDFObject | undefined {
  const d = dictOf(ctx, o);
  return d ? d.get(PDFName.of(key)) : undefined;
}

function nameOf(ctx: PDFContext, o: Ref): string | null {
  const v = look(ctx, o);
  return v instanceof PDFName ? v.asString().replace(/^\//, '') : null;
}

function numOf(ctx: PDFContext, o: Ref): number | null {
  const v = look(ctx, o);
  return v instanceof PDFNumber ? v.asNumber() : null;
}

function arrOf(ctx: PDFContext, o: Ref): PDFObject[] | null {
  const v = look(ctx, o);
  return v instanceof PDFArray ? v.asArray() : null;
}

/** A text string object → its decoded text. PDF strings are PDFDocEncoded or
 *  UTF-16BE; pdf-lib's decodeText handles both, but throws on malformed bytes. */
function strOf(ctx: PDFContext, o: Ref): string | null {
  const v = look(ctx, o);
  if (!(v instanceof PDFString) && !(v instanceof PDFHexString)) return null;
  try { return v.decodeText(); } catch { try { return v.asString(); } catch { return null; } }
}

/** A /JS entry is either a string or a stream - both carry the same program. */
function scriptText(ctx: PDFContext, o: Ref): string | null {
  const s = strOf(ctx, o);
  if (s != null) return s;
  const v = look(ctx, o);
  if (v instanceof PDFRawStream) {
    // getContents() hands back the RAW bytes - still Flate/LZW-encoded as they
    // sit in the file. decodePDFRawStream applies the /Filter chain.
    try { return new TextDecoder('utf-8').decode(decodePDFRawStream(v).decode()); } catch { return null; }
  }
  return null;
}

/** Cycle guard key. Only indirect references can form a cycle, so a direct
 *  object simply has no tag and is always walked. */
function refTag(o: Ref): string | null {
  // `tag` is a PROPERTY ("5 0 R"), not a method - calling it throws, and a throw
  // here would take out a whole finding category via the caller's catch.
  return o instanceof PDFRef ? o.tag : null;
}

// ── formatting ────────────────────────────────────────────────────────────────

function clip(s: string, cap = DETAIL_CAP): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > cap ? `${t.slice(0, cap - 1)}…` : t;
}

/** "a, b, c +4 more" - a bounded rendering of an unbounded list. */
function list(items: string[], cap = LIST_CAP): string {
  const seen = items.map((s) => s.trim()).filter(Boolean);
  if (!seen.length) return '';
  const head = seen.slice(0, cap).join(', ');
  return seen.length > cap ? `${head} +${seen.length - cap} more` : head;
}

function uniq(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function bytesLabel(n: number): string {
  if (!isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** "3 items" / "1 item" - findings lead with a count so the panel scans. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ── name trees (section 7.9.6) ───────────────────────────────────────────────────────

/**
 * Flatten a name tree - /Names pairs at the leaves, /Kids in the interior - into
 * [key, value] entries. Used for both /EmbeddedFiles and /JavaScript, which share
 * the structure and differ only in what the values mean.
 */
function walkNameTree(
  ctx: PDFContext,
  node: Ref,
  out: Array<[string, PDFObject]>,
  seen: Set<string> = new Set(),
  depth = 0,
): Array<[string, PDFObject]> {
  if (depth > MAX_DEPTH || out.length >= MAX_ITEMS) return out;
  const tag = refTag(node);
  if (tag) {
    if (seen.has(tag)) return out;
    seen.add(tag);
  }
  const d = dictOf(ctx, node);
  if (!d) return out;

  const names = arrOf(ctx, d.get(PDFName.of('Names')));
  if (names) {
    for (let i = 0; i + 1 < names.length && out.length < MAX_ITEMS; i += 2) {
      out.push([strOf(ctx, names[i]) ?? '', names[i + 1]!]);
    }
  }
  const kids = arrOf(ctx, d.get(PDFName.of('Kids')));
  if (kids) for (const k of kids) walkNameTree(ctx, k, out, seen, depth + 1);
  return out;
}

// ── attachments ───────────────────────────────────────────────────────────────

interface Attachment {
  name: string;
  bytes: number | null;
  /** Where it was found - a name-tree attachment vs a page annotation. */
  via: 'names' | 'annot' | 'af';
}

/**
 * Read one /Filespec (section 7.11.3) → a named, sized attachment. /UF is the Unicode
 * filename and wins over the legacy /F; the embedded stream's /Length is the
 * compressed size, so /Params /Size (the true uncompressed size) is preferred.
 */
function readFilespec(ctx: PDFContext, spec: Ref, via: Attachment['via'], fallbackName = ''): Attachment | null {
  const d = dictOf(ctx, spec);
  if (!d) return null;
  const name = strOf(ctx, d.get(PDFName.of('UF')))
    || strOf(ctx, d.get(PDFName.of('F')))
    || strOf(ctx, d.get(PDFName.of('Desc')))
    || fallbackName;
  const ef = dictOf(ctx, d.get(PDFName.of('EF')));
  // /EF is keyed by the same names as the filespec (/F, /UF); any of them is the
  // same bytes. Without one this is a LINK to an external file, not a payload - 
  // still worth reporting, since it points off-device.
  const stream = ef ? (ef.get(PDFName.of('UF')) ?? ef.get(PDFName.of('F'))) : undefined;
  const size = stream
    ? (numOf(ctx, get(ctx, get(ctx, stream, 'Params'), 'Size')) ?? numOf(ctx, get(ctx, stream, 'Length')))
    : null;
  if (!name && !stream) return null;
  return { name: name || '(unnamed)', bytes: size, via };
}

function collectAttachments(ctx: PDFContext, doc: PDFDocument, pages: PDFDict[]): Attachment[] {
  const out: Attachment[] = [];

  // 1. The catalog's /Names → /EmbeddedFiles tree: the normal attachment path.
  const tree = get(ctx, doc.catalog.get(PDFName.of('Names')), 'EmbeddedFiles');
  for (const [key, val] of walkNameTree(ctx, tree, [])) {
    const a = readFilespec(ctx, val, 'names', key);
    if (a) out.push(a);
  }

  // 2. /AF associated files (PDF 2.0) on the catalog or on a page. This is how a
  //    C2PA manifest rides along, and also how some tools smuggle sidecars.
  const afRoots: Ref[] = [doc.catalog.get(PDFName.of('AF')), ...pages.map((p) => p.get(PDFName.of('AF')))];
  for (const root of afRoots) {
    for (const spec of arrOf(ctx, root) ?? []) {
      const a = readFilespec(ctx, spec, 'af');
      if (a) out.push(a);
    }
  }

  // 3. /FileAttachment annotations - a paperclip pinned to a page. Same payload,
  //    entirely different place in the graph, so a names-tree-only scan misses it.
  for (const annot of eachAnnot(ctx, pages)) {
    if (nameOf(ctx, annot.get(PDFName.of('Subtype'))) !== 'FileAttachment') continue;
    const a = readFilespec(ctx, annot.get(PDFName.of('FS')), 'annot');
    if (a) out.push(a);
  }

  // The same file can appear both in the tree and as an annotation; de-dupe on
  // name+size so the count reflects distinct payloads.
  const seen = new Set<string>();
  return out.filter((a) => {
    const k = `${a.name}\u0000${a.bytes ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── annotations ───────────────────────────────────────────────────────────────

/** Every annotation dictionary across every page, bounded. */
function* eachAnnot(ctx: PDFContext, pages: PDFDict[]): Generator<PDFDict> {
  let n = 0;
  for (const page of pages) {
    for (const ref of arrOf(ctx, page.get(PDFName.of('Annots'))) ?? []) {
      if (n++ >= MAX_ITEMS) return;
      const d = dictOf(ctx, ref);
      if (d) yield d;
    }
  }
}

/** Annotation subtypes that are pure page furniture, not authored commentary. */
const NON_MARKUP = new Set(['Link', 'Widget', 'Popup', 'FileAttachment']);

// ── actions (section 12.6) ───────────────────────────────────────────────────────────

interface ActionSink {
  /** Distinct JavaScript program texts, in discovery order. */
  scripts: string[];
  /** Outbound /URI targets. */
  uris: string[];
  /** /Launch targets - an external program or file the document asks to open. */
  launches: string[];
  /** /SubmitForm endpoints - where filled values would be POSTed. */
  submits: string[];
  /** /GoToR + /GoToE - jumps into another document. */
  remotes: string[];
}

function emptySink(): ActionSink {
  return { scripts: [], uris: [], launches: [], submits: [], remotes: [] };
}

/**
 * Walk one action dictionary and its /Next chain, recording what it does.
 *
 * An action is a small state machine: /S names the type, the type-specific keys
 * carry the payload, and /Next is zero or more actions to run afterwards. The
 * chain is the part naive scanners miss - a benign-looking /GoTo can chain into
 * a /JavaScript.
 */
function walkAction(ctx: PDFContext, action: Ref, sink: ActionSink, seen: Set<string>, depth = 0): void {
  if (depth > MAX_DEPTH) return;
  const tag = refTag(action);
  if (tag) {
    if (seen.has(tag)) return;
    seen.add(tag);
  }
  const d = dictOf(ctx, action);
  if (!d) return;

  switch (nameOf(ctx, d.get(PDFName.of('S')))) {
    case 'JavaScript': {
      const js = scriptText(ctx, d.get(PDFName.of('JS')));
      if (js && js.trim()) sink.scripts.push(js);
      break;
    }
    case 'URI': {
      const u = strOf(ctx, d.get(PDFName.of('URI')));
      if (u) sink.uris.push(u);
      break;
    }
    case 'Launch': {
      // /F is a filespec (dict) or a bare string path.
      const f = d.get(PDFName.of('F'));
      const target = strOf(ctx, f) || strOf(ctx, get(ctx, f, 'UF')) || strOf(ctx, get(ctx, f, 'F'))
        || strOf(ctx, get(ctx, d.get(PDFName.of('Win')), 'F'));
      sink.launches.push(target || '(unnamed target)');
      break;
    }
    case 'SubmitForm': {
      const f = d.get(PDFName.of('F'));
      const target = strOf(ctx, f) || strOf(ctx, get(ctx, f, 'UF')) || strOf(ctx, get(ctx, f, 'F'));
      sink.submits.push(target || '(unnamed endpoint)');
      break;
    }
    case 'GoToR':
    case 'GoToE': {
      const f = d.get(PDFName.of('F'));
      const target = strOf(ctx, f) || strOf(ctx, get(ctx, f, 'UF')) || strOf(ctx, get(ctx, f, 'F'));
      sink.remotes.push(target || '(unnamed document)');
      break;
    }
  }

  // /Next is one action or an array of them.
  const next = d.get(PDFName.of('Next'));
  const arr = arrOf(ctx, next);
  if (arr) for (const a of arr) walkAction(ctx, a, sink, seen, depth + 1);
  else if (next) walkAction(ctx, next, sink, seen, depth + 1);
}

/** Every value of an /AA additional-actions dictionary is itself an action. */
function walkAdditionalActions(ctx: PDFContext, aa: Ref, sink: ActionSink, seen: Set<string>): void {
  const d = dictOf(ctx, aa);
  if (!d) return;
  for (const [, v] of d.entries()) walkAction(ctx, v, sink, seen);
}

function collectActions(ctx: PDFContext, doc: PDFDocument, pages: PDFDict[], fields: FormField[]): ActionSink {
  const sink = emptySink();
  const seen = new Set<string>();

  // Document open + document-level additional actions (/WillClose, /WillSave, …).
  walkAction(ctx, doc.catalog.get(PDFName.of('OpenAction')), sink, seen);
  walkAdditionalActions(ctx, doc.catalog.get(PDFName.of('AA')), sink, seen);

  // The catalog's /Names → /JavaScript tree: document-level scripts that run at
  // open time without any /OpenAction pointing at them.
  const jsTree = get(ctx, doc.catalog.get(PDFName.of('Names')), 'JavaScript');
  for (const [, val] of walkNameTree(ctx, jsTree, [])) walkAction(ctx, val, sink, seen);

  // Page-level open/close actions, then every annotation's /A and /AA.
  for (const page of pages) walkAdditionalActions(ctx, page.get(PDFName.of('AA')), sink, seen);
  for (const annot of eachAnnot(ctx, pages)) {
    walkAction(ctx, annot.get(PDFName.of('A')), sink, seen);
    walkAdditionalActions(ctx, annot.get(PDFName.of('AA')), sink, seen);
  }
  // Form fields carry their own actions (validate/format/calculate scripts).
  for (const f of fields) {
    walkAction(ctx, f.dict.get(PDFName.of('A')), sink, seen);
    walkAdditionalActions(ctx, f.dict.get(PDFName.of('AA')), sink, seen);
  }
  return sink;
}

// ── AcroForm ──────────────────────────────────────────────────────────────────

interface FormField {
  dict: PDFDict;
  /** Fully-qualified name - parent /T values joined with '.', per section 12.7.3.2. */
  name: string;
  /** Field type: Tx (text), Btn (button), Ch (choice), Sig (signature). */
  type: string | null;
  /** The field's value as text, when it has one. */
  value: string | null;
}

/** A field /V is a string, a name (checkbox/radio state), or a number. */
function fieldValue(ctx: PDFContext, v: Ref): string | null {
  const s = strOf(ctx, v);
  if (s != null) return s;
  const n = nameOf(ctx, v);
  // /Off is the unchecked state - the absence of a value, not a value.
  if (n != null) return n === 'Off' ? null : n;
  const num = numOf(ctx, v);
  if (num != null) return String(num);
  // A multi-select choice field holds an array of selected strings.
  const arr = arrOf(ctx, v);
  if (arr) return list(arr.map((x) => strOf(ctx, x) ?? '')) || null;
  return null;
}

/**
 * Flatten the AcroForm field tree. Fields inherit /FT and /V from ancestors, so
 * both are threaded down; a node is a real field when it has a type, and an
 * interior node with /Kids is a container whose children carry the leaves.
 */
function walkFields(
  ctx: PDFContext,
  node: Ref,
  out: FormField[],
  seen: Set<string>,
  prefix = '',
  inheritedType: string | null = null,
  depth = 0,
): void {
  if (depth > MAX_DEPTH || out.length >= MAX_ITEMS) return;
  const tag = refTag(node);
  if (tag) {
    if (seen.has(tag)) return;
    seen.add(tag);
  }
  const d = dictOf(ctx, node);
  if (!d) return;

  const partial = strOf(ctx, d.get(PDFName.of('T')));
  const name = partial ? (prefix ? `${prefix}.${partial}` : partial) : prefix;
  const type = nameOf(ctx, d.get(PDFName.of('FT'))) ?? inheritedType;

  const kids = arrOf(ctx, d.get(PDFName.of('Kids')));
  // A widget kid with no /T of its own is the field's own appearance, not a
  // child field - such a node still terminates here.
  const childFields = (kids ?? []).filter((k) => {
    const kd = dictOf(ctx, k);
    return kd ? (kd.get(PDFName.of('T')) != null || kd.get(PDFName.of('Kids')) != null) : false;
  });

  if (childFields.length) {
    for (const k of childFields) walkFields(ctx, k, out, seen, name, type, depth + 1);
    return;
  }
  if (!type && !partial) return;
  out.push({ dict: d, name, type, value: fieldValue(ctx, d.get(PDFName.of('V'))) });
}

function collectFields(ctx: PDFContext, doc: PDFDocument): FormField[] {
  const acro = doc.catalog.get(PDFName.of('AcroForm'));
  const out: FormField[] = [];
  const seen = new Set<string>();
  for (const f of arrOf(ctx, get(ctx, acro, 'Fields')) ?? []) walkFields(ctx, f, out, seen);
  return out;
}

// ── optional content (layers) ─────────────────────────────────────────────────

interface Layers {
  names: string[];
  /** Layers the default configuration ships switched OFF - hidden content. */
  hidden: string[];
}

function collectLayers(ctx: PDFContext, doc: PDFDocument): Layers {
  const ocp = doc.catalog.get(PDFName.of('OCProperties'));
  const byTag = new Map<string, string>();
  const names: string[] = [];
  for (const g of arrOf(ctx, get(ctx, ocp, 'OCGs')) ?? []) {
    const n = strOf(ctx, get(ctx, g, 'Name')) ?? '(unnamed layer)';
    names.push(n);
    const tag = refTag(g);
    if (tag) byTag.set(tag, n);
  }
  // /D is the default configuration; its /OFF array lists the groups that start
  // invisible. Content on those layers is in the file but not on screen.
  const hidden: string[] = [];
  for (const g of arrOf(ctx, get(ctx, get(ctx, ocp, 'D'), 'OFF')) ?? []) {
    const tag = refTag(g);
    hidden.push((tag && byTag.get(tag)) || strOf(ctx, get(ctx, g, 'Name')) || '(unnamed layer)');
  }
  return { names, hidden };
}

// ── the scan ──────────────────────────────────────────────────────────────────

function pageDicts(doc: PDFDocument): PDFDict[] {
  try { return doc.getPages().map((p) => p.node as unknown as PDFDict); } catch { return []; }
}

/**
 * Inspect a loaded document's object graph and report what it carries and does.
 *
 * Findings are ordered by how much a viewer should care: payloads and executable
 * behaviour first, disclosure second, inventory last. Never throws - a graph too
 * broken to walk yields an empty array.
 */
export function scanPdfStructure(doc: PDFDocument): PdfFinding[] {
  const out: PdfFinding[] = [];
  const add = (label: string, detail: string, tone: PdfFinding['tone'] = ''): void => {
    const d = clip(detail);
    if (d) out.push({ label, detail: d, tone });
  };

  let ctx: PDFContext;
  try { ctx = doc.context; } catch { return out; }
  const pages = pageDicts(doc);

  // ── payloads ────────────────────────────────────────────────────────────────
  try {
    const files = collectAttachments(ctx, doc, pages);
    if (files.length) {
      const shown = files.map((f) => (f.bytes ? `${f.name} (${bytesLabel(f.bytes)})` : f.name));
      add('Attachments', `${count(files.length, 'embedded file')} - ${list(shown)}`, 'warn');
    }
  } catch { /* unwalkable name tree - report nothing rather than fail the panel */ }

  // ── behaviour ───────────────────────────────────────────────────────────────
  let fields: FormField[] = [];
  try { fields = collectFields(ctx, doc); } catch { /* malformed AcroForm */ }

  try {
    const act = collectActions(ctx, doc, pages, fields);

    const scripts = uniq(act.scripts);
    if (scripts.length) {
      // The first script's opening line is usually enough to tell a form
      // calculation from something that reaches for the network.
      add('JavaScript', `${count(scripts.length, 'script')} - runs when the document is opened or used · ${clip(scripts[0]!, 160)}`, 'warn');
    }
    if (act.launches.length) {
      add('Launch actions', `${count(act.launches.length, 'action')} that opens an external program or file - ${list(uniq(act.launches))}`, 'warn');
    }
    if (act.submits.length) {
      add('Form submission', `Sends filled values to ${list(uniq(act.submits))}`, 'warn');
    }
    if (act.remotes.length) {
      add('Remote documents', `Jumps into ${list(uniq(act.remotes))}`, 'warn');
    }
    if (act.uris.length) {
      const urls = uniq(act.uris);
      // Hosts are the scannable summary; the URLs themselves are the evidence.
      const hosts = uniq(urls.map((u) => { try { return new URL(u).host; } catch { return ''; } }));
      add('Links', hosts.length
        ? `${count(urls.length, 'outbound link')} to ${list(hosts)}`
        : `${count(urls.length, 'outbound link')} - ${list(urls)}`);
    }
  } catch { /* malformed action graph */ }

  // ── disclosure ──────────────────────────────────────────────────────────────
  try {
    const filled = fields.filter((f) => f.type !== 'Sig' && f.value);
    if (filled.length) {
      add('Form values', `${count(filled.length, 'filled field')} - ${list(filled.map((f) => `${f.name || '(unnamed)'}: ${f.value}`))}`, 'warn');
    }
    const signatures = fields.filter((f) => f.type === 'Sig' && f.dict.get(PDFName.of('V')) != null);
    if (signatures.length) {
      // A signature is evidence, not a leak - but it also means any re-save
      // (including our own strip/compress) invalidates it, so say it plainly.
      add('Digital signature', `${count(signatures.length, 'signed field')} - re-saving this file invalidates it`);
    }
    if (get(ctx, doc.catalog.get(PDFName.of('AcroForm')), 'XFA')) {
      add('XFA form', 'Carries an XFA form definition - an XML form layer beyond the visible page');
    }
  } catch { /* malformed field values */ }

  try {
    const markup = [...eachAnnot(ctx, pages)].filter((a) => {
      const sub = nameOf(ctx, a.get(PDFName.of('Subtype')));
      return sub != null && !NON_MARKUP.has(sub);
    });
    const authors = uniq(markup.map((a) => strOf(ctx, a.get(PDFName.of('T'))) ?? ''));
    const comments = markup.map((a) => strOf(ctx, a.get(PDFName.of('Contents'))) ?? '').filter(Boolean);
    if (markup.length) {
      const parts = [count(markup.length, 'annotation')];
      if (authors.length) parts.push(`by ${list(authors)}`);
      if (comments.length) parts.push(`· ${clip(comments[0]!, 120)}`);
      add('Annotations', parts.join(' '), authors.length || comments.length ? 'warn' : '');
    }
  } catch { /* malformed annots */ }

  try {
    const { names, hidden } = collectLayers(ctx, doc);
    if (hidden.length) {
      add('Hidden layers', `${count(hidden.length, 'layer')} present but switched off - ${list(hidden)}`, 'warn');
    } else if (names.length) {
      add('Layers', `${count(names.length, 'layer')} - ${list(names)}`);
    }
  } catch { /* malformed OCProperties */ }

  // ── inventory ───────────────────────────────────────────────────────────────
  if (pages.length) add('Pages', count(pages.length, 'page'));

  return out;
}
