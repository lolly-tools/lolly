// SPDX-License-Identifier: MPL-2.0
/** Selected DOCX property removal without reconstructing document content. */
import { readZipMembers, decodeZipMember, storeZipMembers, storeZip, type ZipRawMember } from './zip.ts';
import { readOfficeXml, officeNodes, officeText, type OfficeXmlNode } from './office-xml.ts';

const CP = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
const DC = 'http://purl.org/dc/elements/1.1/';
const TERMS = 'http://purl.org/dc/terms/';
const CUSTOM = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const EXTENDED = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const CORE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties';
const WORD_XML_RELATIONS = new Set(['officeDocument', 'header', 'footer', 'comments', 'footnotes', 'endnotes', 'glossaryDocument', 'styles', 'stylesWithEffects', 'numbering', 'settings', 'fontTable', 'webSettings', 'people']);
const MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const PARTS = {
  'docProps/core.xml': { namespace: CP, root: 'coreProperties', relation: CORE_REL, type: 'application/vnd.openxmlformats-package.core-properties+xml' },
  'docProps/custom.xml': { namespace: CUSTOM, root: 'Properties', relation: `${OFFICE}custom-properties`, type: 'application/vnd.openxmlformats-officedocument.custom-properties+xml' },
  'docProps/app.xml': { namespace: EXTENDED, root: 'Properties', relation: `${OFFICE}extended-properties`, type: 'application/vnd.openxmlformats-officedocument.extended-properties+xml' },
};
const CORE: Record<string, { namespace: string; label: string }> = {
  creator: { namespace: DC, label: 'Author' }, lastModifiedBy: { namespace: CP, label: 'Last saved by' },
  created: { namespace: TERMS, label: 'Created date' }, modified: { namespace: TERMS, label: 'Modified date' },
  lastPrinted: { namespace: CP, label: 'Last printed date' }, title: { namespace: DC, label: 'Title' },
  subject: { namespace: DC, label: 'Subject' }, keywords: { namespace: CP, label: 'Keywords' },
  description: { namespace: DC, label: 'Description' },
};
const EXTENDED_FIELDS: Record<string, string> = { Company: 'Company', Manager: 'Manager' };
const LIMITS = ['Only selected DOCX core/custom properties and Company/Manager extended properties can be removed. Comments, revisions, links, hidden content and embedded objects are retained.', 'Other properties, XML comments, package names and ZIP comments are retained. No result is certified free of private information.'];
export interface DocxMetadataProperty { id: string; part: string; label: string; location: string; value: string; offset: number }
export interface DocxMetadataInspection { supported: boolean; properties: DocxMetadataProperty[]; limitations: string[] }
interface PropertyRange extends DocxMetadataProperty { start: number; end: number }
interface PropertyPart { member: ZipRawMember; bytes: Uint8Array; text: string; properties: PropertyRange[] }
export interface DocxMetadataDocument extends DocxMetadataInspection { remove(ids: string[]): Uint8Array }

function validateXml(bytes: Uint8Array, budget: { nodes: number }): OfficeXmlNode {
  const root = readOfficeXml(bytes, budget);
  for (const node of officeNodes(root)) if (node.namespace === undefined || Object.values(node.attributeNamespaces).some(uri => uri === undefined)) throw new Error('Unbound XML namespace.');
  return root;
}
function propertyText(bytes: Uint8Array): string {
  return new TextDecoder(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8', { fatal: true }).decode(bytes);
}
function encodePropertyText(text: string, original: Uint8Array): Uint8Array {
  const utf16 = original[0] === 0xff && original[1] === 0xfe || original[0] === 0xfe && original[1] === 0xff;
  if (utf16) {
    const output = new Uint8Array(2 + text.length * 2), view = new DataView(output.buffer);
    output.set(original.subarray(0, 2));
    for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), original[0] === 0xff);
    return output;
  }
  const body = new TextEncoder().encode(text);
  if (original[0] !== 0xef || original[1] !== 0xbb || original[2] !== 0xbf) return body;
  const output = new Uint8Array(body.length + 3); output.set(original.subarray(0, 3)); output.set(body, 3); return output;
}
function zipComment(bytes: Uint8Array, members: ZipRawMember[]): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  for (let end = bytes.length - 22; end >= Math.max(0, bytes.length - 65557); end--) {
    if (view.getUint32(end, true) !== 0x06054b50 || end + 22 + view.getUint16(end + 20, true) !== bytes.length) continue;
    if (view.getUint16(end + 10, true) !== members.length || view.getUint32(end + 12, true) !== members.reduce((n, m) => n + m.central.length, 0) || view.getUint32(end + 16, true) + view.getUint32(end + 12, true) !== end) continue;
    return bytes.slice(end + 22);
  }
  throw new Error('Unsupported ZIP trailer.');
}
function target(value: string): string {
  const path = value.startsWith('/') ? value.slice(1) : value;
  if (!path || /[\\\0?#%]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsupported package target.');
  return path;
}
function wordXmlTarget(path: string, value: string, mode: string | undefined, members: Set<string>): boolean {
  if (mode || !value || /[\\\0?#%]/.test(value) || !/\.(?:xml|rels)$/i.test(value)) return false;
  const source = path === '_rels/.rels' ? '' : /^(.*)\/_rels\/[^/]+\.rels$/i.exec(path)?.[1];
  if (source === undefined) return false;
  const pieces = value.startsWith('/') ? [] : source.split('/').filter(Boolean);
  for (const piece of value.replace(/^\//, '').split('/')) {
    if (!piece || piece === '.') continue;
    if (piece === '..') { if (!pieces.length) return false; pieces.pop(); }
    else pieces.push(piece);
  }
  return members.has(pieces.join('/'));
}

/** A failed guard leaves the Office census available and exposes no edit handles. */
export function openDocxMetadata(bytes: Uint8Array, name: string, limits: { maxParts?: number; maxExpandedBytes?: number } = {}): DocxMetadataDocument {
  const unsupported = (reason: string): DocxMetadataDocument => ({ supported: false, properties: [], limitations: [reason, ...LIMITS], remove: () => { throw new Error('DOCX metadata cleanup is unavailable for this file.'); } });
  if (!/\.docx$/i.test(name)) return unsupported('Metadata cleanup supports DOCX files only; this Office file remains inspect-only.');
  try {
    const members = readZipMembers(bytes, { maxInputBytes: 32 * 1024 * 1024, maxEntries: Math.min(300, limits.maxParts ?? 300), maxEntryBytes: 32 * 1024 * 1024, maxTotalBytes: Math.min(64 * 1024 * 1024, limits.maxExpandedBytes ?? 64 * 1024 * 1024) });
    if (new Set(members.map(m => m.name.toLowerCase())).size !== members.length || members.some(m => /(^\/|\\|\0|(?:^|\/)\.\.?\/)/.test(m.name))) throw new Error('Ambiguous package names.');
    if (members.some(m => /(?:vba|macro|_xmlsignatures)(?:[^/]*\/|[^/]*$)/i.test(m.name))) return unsupported('Macro or signature parts were identified. This file remains inspect-only.');
    if (members.some(m => m.flags & 1 || ![0, 8].includes(m.method))) return unsupported('Encrypted or unsupported ZIP members prevent DOCX metadata cleanup.');
    const comment = zipComment(bytes, members), budget = { nodes: 0 }, trees = new Map<string, OfficeXmlNode>(), propertyParts = new Map<string, PropertyPart>();
    const memberNames = new Set(members.map(member => member.name));
    for (const member of members) {
      const decoded = decodeZipMember(member);
      if (!/\.(?:xml|rels)$/i.test(member.name)) continue;
      const root = validateXml(decoded, budget);
      if (/\.rels$/i.test(member.name)) for (const node of officeNodes(root).filter(node => node.namespace === RELS && node.name === 'Relationship')) {
        const type = node.attrs.Type ?? '';
        if (/macro|vba|signature/i.test(type)) return unsupported('Macro or signature relationships prevent DOCX metadata cleanup.');
        if ((type.startsWith(OFFICE) || type.startsWith('http://purl.oclc.org/ooxml/officeDocument/relationships/')) && WORD_XML_RELATIONS.has(type.slice(type.lastIndexOf('/') + 1)) && !wordXmlTarget(member.name, node.attrs.Target ?? '', node.attrs.TargetMode, memberNames)) return unsupported('A Word XML relationship target cannot be safely inspected. This file remains inspect-only.');
      }
      if (member.name === '[Content_Types].xml' || member.name === '_rels/.rels' || member.name === 'word/document.xml' || Object.hasOwn(PARTS, member.name)) trees.set(member.name, root);
      const nodes = officeNodes(root).filter(n => n.namespace === WORD).sort((a, b) => a.start - b.start);
      if (nodes.some(node => node.name === 'dataBinding')) return unsupported('XML-bound content controls can display document properties. Metadata cleanup is unavailable for this file; the properties and bound content are retained.');
      const instructions = nodes.filter(n => n.name === 'instrText').map(n => n.text).join('') + nodes.filter(n => n.name === 'fldSimple').map(n => Object.entries(n.attrs).filter(([key]) => key.endsWith(':instr') && n.attributeNamespaces[key] === WORD).map(([, value]) => value).join('')).join('');
      if (/(?:DOCPROPERTY|AUTHOR|TITLE|SUBJECT|KEYWORDS|COMMENTS|CREATEDATE|SAVEDATE|PRINTDATE|LASTSAVEDBY|REVNUM)/i.test(instructions)) return unsupported('Document fields can display document properties. Metadata cleanup is unavailable for this file; the properties and field content are retained.');
      if (Object.hasOwn(PARTS, member.name)) propertyParts.set(member.name, { member, bytes: decoded, text: propertyText(decoded), properties: [] });
    }
    const types = trees.get('[Content_Types].xml'), relationships = trees.get('_rels/.rels'), doc = trees.get('word/document.xml');
    if (types?.name !== 'Types' || types.namespace !== TYPES || relationships?.name !== 'Relationships' || relationships.namespace !== RELS || doc?.name !== 'document' || doc.namespace !== WORD) throw new Error('Unsupported DOCX structure.');
    const overrides = types.children.filter(n => n.namespace === TYPES && n.name === 'Override');
    const defaults = types.children.filter(n => n.namespace === TYPES && n.name === 'Default');
    const rels = relationships.children.filter(n => n.namespace === RELS && n.name === 'Relationship');
    if (new Set(overrides.map(n => n.attrs.PartName)).size !== overrides.length || new Set(defaults.map(n => n.attrs.Extension?.toLowerCase())).size !== defaults.length || new Set(rels.map(n => n.attrs.Id)).size !== rels.length) throw new Error('Ambiguous package declarations.');
    const xmlType = (type: string): boolean => /(?:\+xml|^(?:application|text)\/xml)(?:\s*;|$)/i.test(type);
    if (overrides.some(n => xmlType(n.attrs.ContentType ?? '') && !/\.(?:xml|rels)$/i.test(n.attrs.PartName ?? '')) || defaults.some(n => xmlType(n.attrs.ContentType ?? '') && !/^(?:xml|rels)$/i.test(n.attrs.Extension ?? ''))) return unsupported('XML parts with unconventional filename extensions are not supported for DOCX metadata cleanup. This file remains inspect-only.');
    if (types.children.some(n => /macro|vba|signature/i.test(n.attrs.ContentType ?? ''))) return unsupported('Macro-enabled or signed package declarations prevent DOCX metadata cleanup.');
    const main = rels.filter(n => n.attrs.Type === `${OFFICE}officeDocument`);
    if (main.length !== 1 || main[0]!.attrs.TargetMode || target(main[0]!.attrs.Target ?? '') !== 'word/document.xml' || overrides.find(n => n.attrs.PartName === '/word/document.xml')?.attrs.ContentType !== MAIN_TYPE) throw new Error('Unsupported main document declaration.');
    for (const [path, spec] of Object.entries(PARTS)) {
      const matching = rels.filter(n => n.attrs.Type === spec.relation);
      const part = propertyParts.get(path), root = trees.get(path);
      if (!part) { if (matching.length) throw new Error('Missing property part.'); continue; }
      if (matching.length !== 1 || matching[0]!.attrs.TargetMode || target(matching[0]!.attrs.Target ?? '') !== path || overrides.find(n => n.attrs.PartName === `/${path}`)?.attrs.ContentType !== spec.type || root?.name !== spec.root || root.namespace !== spec.namespace) throw new Error('Unsupported property declaration.');
      if (path === 'docProps/app.xml' && (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(matching[0]!.attrs.Id ?? '') || matching[0]!.attrs.TargetMode !== undefined)) throw new Error('Unsupported extended property relationship.');
      if (path === 'docProps/app.xml' && root.children.some(node => node.namespace === EXTENDED && node.name === 'DigSig')) return unsupported('Extended digital-signature data prevents DOCX metadata cleanup. This file remains inspect-only.');
      const seen = new Set<string>(), customNames = new Set<string>();
      for (const node of root.children) {
        let id: string, label: string, location: string;
        if (path === 'docProps/core.xml') {
          const field = CORE[node.name];
          if (!field || node.namespace !== field.namespace) continue;
          if (node.children.length) throw new Error('Unsupported core property value.');
          id = `core:${node.name}`; label = field.label; location = `Property: ${node.name}`;
        } else if (path === 'docProps/app.xml') {
          if (node.namespace !== EXTENDED || !Object.hasOwn(EXTENDED_FIELDS, node.name)) continue;
          if (node.children.length || Object.keys(node.attrs).some(key => key !== 'xmlns' && !key.startsWith('xmlns:'))) throw new Error('Unsupported extended property value.');
          id = `app:${node.name}`; label = EXTENDED_FIELDS[node.name]!; location = `Property: ${node.name}`;
        } else {
          if (node.namespace !== CUSTOM || node.name !== 'property') continue;
          if (!/^\d{1,10}$/.test(node.attrs.pid ?? '') || Number(node.attrs.pid) < 2 || Number(node.attrs.pid) > 2147483647 || !node.attrs.name || node.attrs.name.length > 256 || node.attrs.fmtid?.toUpperCase() !== '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}') throw new Error('Unsupported custom property identity.');
          if (customNames.has(node.attrs.name)) throw new Error('Ambiguous custom property name.');
          customNames.add(node.attrs.name);
          id = `custom:${Number(node.attrs.pid)}`; label = 'Custom property'; location = `Custom property: ${node.attrs.name}`;
        }
        if (seen.has(id)) throw new Error('Ambiguous property identity.');
        seen.add(id); part.properties.push({ id, part: path, label, location, value: officeText(node), offset: node.start, start: node.start, end: node.end });
        if ([...propertyParts.values()].reduce((n, p) => n + p.properties.length, 0) > 2000) throw new Error('Property count limit reached.');
      }
    }
    const properties = [...propertyParts.values()].flatMap(p => p.properties.map(({ start: _start, end: _end, ...property }) => property));
    const remove = (ids: string[]): Uint8Array => {
      if (!Array.isArray(ids) || ids.length > 2000 || new Set(ids).size !== ids.length || ids.some(id => !properties.some(p => p.id === id))) throw new Error('Invalid DOCX property choice. Inspect again.');
      if (!ids.length) return bytes;
      const selected = new Set(ids), replacements = new Map<string, ZipRawMember>();
      for (const [path, part] of propertyParts) {
        const edits = part.properties.filter(p => selected.has(p.id));
        if (!edits.length) continue;
        let text = part.text;
        for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + text.slice(edit.end);
        const output = encodePropertyText(text, part.bytes); validateXml(output, { nodes: 0 });
        replacements.set(path, readZipMembers(storeZip([{ name: path, bytes: output }]))[0]!);
      }
      const output = storeZipMembers(members.map(m => replacements.get(m.name) ?? m));
      const copied = new Uint8Array(output.length + comment.length); copied.set(output); copied.set(comment, output.length); new DataView(copied.buffer).setUint16(output.length - 2, comment.length, true);
      if (copied.length > 32 * 1024 * 1024) throw new Error('DOCX result exceeds the size limit.');
      const after = openDocxMetadata(copied, name, limits);
      const identity = (items: DocxMetadataProperty[]): unknown => items.map(({ offset: _offset, ...property }) => property);
      if (!after.supported || JSON.stringify(identity(after.properties)) !== JSON.stringify(identity(properties.filter(p => !selected.has(p.id))))) throw new Error('DOCX property removal could not be verified.');
      return copied;
    };
    return { supported: true, properties, limitations: LIMITS, remove };
  } catch { return unsupported('This DOCX package is malformed, unsupported or exceeds the cleanup limits. It remains inspect-only.'); }
}
