// SPDX-License-Identifier: MPL-2.0
/** Read-only OOXML package census with shared ZIP, XML and nested-package budgets. */
import { decodeZipMember, readZipMembers, type ZipRawMember } from './zip.ts';
import { OFFICE_MAX_XML_BYTES, officeAttr, officeNodes, officeText, readOfficeXml, type OfficeXmlNode } from './office-xml.ts';

export interface OfficeCensusFinding { category: string; label: string; value: string; location: string }
export interface OfficeCensusPart {
  path: string; format: string; status: 'inspected' | 'partial' | 'uninspected'; limitations: string[]; findings: OfficeCensusFinding[];
}
export interface OfficeCensus { format: string; limitations: string[]; parts: OfficeCensusPart[]; expandedBytes: number }
export interface OfficeCensusOptions { maxParts?: number; maxExpandedBytes?: number }
const OFFICE = /\.(docx|pptx|xlsx|docm|pptm|xlsm|dotx|dotm|potx|potm|xltx|xltm|xlsb|doc|ppt|xls)$/i;
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const READ_ONLY = 'Office inspection is read-only. Properties and document content are retained unchanged; no cleaned copy is available.';
const COVERAGE = 'This package census checks supported properties, relationships, comments, notes and hidden-content markers. Visible text, formulas, rendered appearance and arbitrary binary content are not fully inspected.';
interface CensusBudget { parts: number; expanded: number; nodes: number; findings: number; maxParts: number; maxExpanded: number }
function packageFormat(names: string[]): string | undefined {
  if (names.includes('word/document.xml')) return 'docx';
  if (names.includes('ppt/presentation.xml')) return 'pptx';
  if (names.includes('xl/workbook.xml')) return 'xlsx';
  return undefined;
}
export function isOfficeSource(bytes: Uint8Array, name: string): boolean {
  if (OFFICE.test(name) || OLE.every((byte, index) => bytes[index] === byte)) return true;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  try {
    // Accept every directory the generic ZIP preparation path can expose.
    // The census can decline large members after the package is protected.
    const names = readZipMembers(bytes, { maxInputBytes: 32 * 1024 * 1024, maxEntries: 300, maxEntryBytes: 64 * 1024 * 1024, maxTotalBytes: 64 * 1024 * 1024 }).map(member => member.name);
    return names.includes('[Content_Types].xml') && packageFormat(names) !== undefined;
  } catch { return false; }
}
function enabled(value: string | undefined): boolean { return value === undefined || !['0', 'false', 'off'].includes(value.toLowerCase()); }

function inspectXml(part: OfficeCensusPart, root: OfficeXmlNode, format: string, budget: CensusBudget): void {
  const nodes = officeNodes(root), path = part.path.split('!/').pop()!;
  const add = (category: string, label: string, value: string, location = label): void => {
    if (budget.findings >= 2000) { part.status = 'partial'; if (!part.limitations.includes('The 2,000-finding census limit was reached.')) part.limitations.push('The 2,000-finding census limit was reached.'); return; }
    if (!value) return;
    budget.findings++; part.findings.push({ category, label, value: value.slice(0, 2048), location: location.slice(0, 512) });
  };
  if (/^docProps\/(?:core|app|custom)\.xml$/.test(path)) {
    for (const node of root.children) {
      const name = officeAttr(node, 'name') ?? node.name;
      add('office-properties', 'Document property', officeText(node), `Property: ${name}`);
    }
  }
  if (path.endsWith('.rels')) {
    for (const node of nodes.filter(n => n.name === 'Relationship')) {
      if (officeAttr(node, 'TargetMode')?.toLowerCase() === 'external') add('office-links', 'External relationship (not fetched)', officeAttr(node, 'Target') ?? '', `Relationship: ${officeAttr(node, 'Id') ?? '?'}`);
    }
  }
  if (format === 'docx' && path.startsWith('word/')) {
    for (const node of nodes) {
      if (node.name === 'comment') add('office-comments', 'Comment and author', `${officeAttr(node, 'author') ?? ''} ${officeAttr(node, 'initials') ?? ''} ${officeText(node)}`.trim(), `Comment: ${officeAttr(node, 'id') ?? '?'}`);
      if (['ins', 'del', 'moveFrom', 'moveTo'].includes(node.name) || node.name.endsWith('PrChange')) add('office-revisions', 'Tracked change (accept/reject policy required)', `${officeAttr(node, 'author') ?? ''} ${officeAttr(node, 'date') ?? ''} ${officeText(node)}`.trim() || node.name, `Tracked change: ${officeAttr(node, 'id') ?? '?'}`);
      if (node.name === 'r' && officeNodes(node).some(n => ['vanish', 'webHidden'].includes(n.name) && enabled(officeAttr(n, 'val')))) add('office-hidden', 'Hidden text run', officeText(node) || 'Hidden run without text preview');
    }
    if (/comments(?:Extended|Extensible|Ids)\.xml$/.test(path)) add('office-comments', 'Comment identity or thread data', officeText(root) || 'Comment thread and identity records');
  }
  if (format === 'pptx' && path.startsWith('ppt/')) {
    if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)) add('office-notes', 'Speaker notes', officeText(root) || 'Speaker notes part');
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path) && !enabled(officeAttr(root, 'show'))) add('office-hidden', 'Hidden slide', officeText(root) || 'Hidden slide without text preview');
    if (/comments|commentAuthors/.test(path)) {
      for (const node of nodes.filter(n => ['cm', 'comment', 'cmAuthor', 'author'].includes(n.name))) add('office-comments', 'Slide comment or author', `${officeAttr(node, 'name') ?? ''} ${officeAttr(node, 'authorId') ?? ''} ${officeText(node)}`.trim() || 'Comment identity record');
    }
  }
  if (format === 'xlsx' && path.startsWith('xl/')) {
    for (const node of nodes) {
      if (['comment', 'threadedComment', 'author', 'person'].includes(node.name)) add('office-comments', 'Cell comment, note or author', `${officeAttr(node, 'displayName') ?? ''} ${officeAttr(node, 'personId') ?? ''} ${officeText(node)}`.trim() || 'Comment identity record', `Cell or identity: ${officeAttr(node, 'ref') ?? officeAttr(node, 'id') ?? '?'}`);
      if (node.name === 'sheet' && ['hidden', 'veryHidden'].includes(officeAttr(node, 'state') ?? '')) add('office-hidden', 'Hidden sheet (may feed formulas)', officeAttr(node, 'name') ?? 'Hidden sheet');
      if (['row', 'col'].includes(node.name) && officeAttr(node, 'hidden') !== undefined && enabled(officeAttr(node, 'hidden'))) add('office-hidden', `Hidden ${node.name === 'row' ? 'row' : 'column'} (may feed formulas)`, node.name === 'row' ? officeAttr(node, 'r') ?? '?' : `${officeAttr(node, 'min') ?? '?'}:${officeAttr(node, 'max') ?? '?'}`);
      if (node.name === 'definedName') add('office-names', 'Defined name (may feed formulas)', `${officeAttr(node, 'name') ?? ''}: ${officeText(node)}`);
      if (['connection', 'dbPr', 'webPr', 'olapPr'].includes(node.name)) add('office-links', 'Data connection (not opened)', Object.values(node.attrs).join(' ') || officeText(node) || 'Data connection record');
    }
    if (/^xl\/(externalLinks|pivotCache)\//.test(path) && !path.endsWith('.rels')) add('office-caches', 'External-link or pivot cached data', officeText(root) || 'Cached workbook data surface');
  }
}

function inspectPackage(bytes: Uint8Array, prefix: string, declared: string, depth: number, budget: CensusBudget, result: OfficeCensus): void {
  let members: ZipRawMember[];
  try { members = readZipMembers(bytes, { maxInputBytes: 32 * 1024 * 1024, maxEntries: budget.maxParts - budget.parts, maxEntryBytes: 32 * 1024 * 1024, maxTotalBytes: budget.maxExpanded - budget.expanded }); }
  catch { result.limitations.push('A package is malformed, encrypted, unsupported or exceeds the part/expansion limits; it was retained without package inspection.'); return; }
  if (members.some(m => /(^\/|\\|\0|(?:^|\/)\.\.?\/)/.test(m.name)) || new Set(members.map(m => m.name.toLowerCase())).size !== members.length) {
    result.limitations.push('Ambiguous, duplicate or unsafe package part names prevent reliable inspection.'); return;
  }
  const format = packageFormat(members.map(m => m.name));
  if (!format || !members.some(m => m.name === '[Content_Types].xml')) { result.limitations.push('The archive does not contain a supported DOCX, PPTX or XLSX package structure.'); return; }
  if (!prefix) result.format = format;
  if (declared && declared !== format) result.limitations.push('The filename denotes a different or unsupported Office variant. Only a read-only package census was performed.');
  if (members.some(m => /vbaProject\.bin$/i.test(m.name))) result.limitations.push('Macro content was identified and retained without execution or inspection.');
  if (members.some(m => m.name.startsWith('_xmlsignatures/'))) result.limitations.push('Package signature parts are retained unchanged. Signatures were not verified.');
  budget.parts += members.length;
  budget.expanded += members.reduce((total, member) => total + member.size, 0);
  for (const member of members) {
    const part: OfficeCensusPart = { path: `${prefix}${member.name}`, format: 'office-part', status: 'uninspected', limitations: [], findings: [] };
    result.parts.push(part);
    if (member.flags & 1) { part.limitations.push('Encrypted part retained without decryption.'); continue; }
    if (![0, 8].includes(member.method)) { part.limitations.push('Unsupported part compression; content retained without inspection.'); continue; }
    const xml = /\.(xml|rels)$/i.test(member.name), embedded = /\/(embeddings|activeX)\//.test(member.name);
    if (!xml && !embedded) { part.limitations.push('Binary or unrecognized part retained without content inspection.'); continue; }
    if (xml && member.size > OFFICE_MAX_XML_BYTES) { part.limitations.push('XML part exceeds the 2 MiB census limit; content retained without inspection.'); continue; }
    let decoded: Uint8Array;
    try { decoded = decodeZipMember(member); }
    catch { part.limitations.push('Part failed decompression or integrity checks; retained without inspection.'); continue; }
    if (embedded) {
      if (budget.findings < 2000) { budget.findings++; part.findings.push({ category: 'office-embedded', label: 'Embedded object (retained)', value: member.name, location: 'Embedded object' }); }
      if (decoded[0] === 0x50 && decoded[1] === 0x4b && depth < 2 && budget.parts < budget.maxParts) {
        part.status = 'partial'; part.limitations.push('Nested package inspected within the shared budgets; the embedded object remains unchanged.');
        inspectPackage(decoded, `${part.path}!/`, '', depth + 1, budget, result);
      } else part.limitations.push(depth >= 2 ? 'Nested objects beyond two levels are retained without inspection.' : 'Embedded binary or active content retained without execution or content inspection.');
      continue;
    }
    try {
      const root = readOfficeXml(decoded, budget);
      part.status = 'inspected'; inspectXml(part, root, format, budget);
      part.limitations.push('Read-only package census; arbitrary text and dependency semantics were not inspected.');
    } catch { part.status = 'uninspected'; part.findings = []; part.limitations.push('XML is malformed, unsupported or exceeds the structure budget; retained without inspection.'); }
  }
}

export function inspectOfficePackage(bytes: Uint8Array, name: string, options: OfficeCensusOptions = {}): OfficeCensus {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  const result: OfficeCensus = { format: extension, limitations: [READ_ONLY, COVERAGE], parts: [], expandedBytes: 0 };
  if (OLE.every((byte, index) => bytes[index] === byte)) {
    result.format = 'office-container';
    result.limitations.push('Legacy binary or encrypted Office container. Its content is not inspected or decrypted.'); return result;
  }
  if (['doc', 'ppt', 'xls', 'xlsb'].includes(extension)) { result.limitations.push('Legacy binary Office formats and XLSB are unsupported; content is retained without inspection.'); return result; }
  const budget: CensusBudget = { parts: 0, expanded: 0, nodes: 0, findings: 0, maxParts: Math.min(300, Math.max(0, options.maxParts ?? 300)), maxExpanded: Math.min(64 * 1024 * 1024, Math.max(0, options.maxExpandedBytes ?? 64 * 1024 * 1024)) };
  inspectPackage(bytes, '', extension, 0, budget, result);
  result.expandedBytes = budget.expanded;
  result.limitations = [...new Set(result.limitations)];
  return result;
}
