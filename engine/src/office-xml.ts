// SPDX-License-Identifier: MPL-2.0
/** Small, bounded XML census tree. No DTD, custom entities or external resources. */
export interface OfficeXmlNode {
  name: string; qname: string; namespace: string | undefined;
  attrs: Record<string, string>; attributeNamespaces: Record<string, string | undefined>;
  children: OfficeXmlNode[]; text: string; start: number; end: number;
}
export interface OfficeXmlBudget { nodes: number }
export const OFFICE_MAX_XML_BYTES = 2 * 1024 * 1024;
const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/;
const SPACE = /^[\t\n\r ]*$/;
const local = (name: string): string => name.slice(name.lastIndexOf(':') + 1);
interface Namespaces { parent?: Namespaces; values: Record<string, string> }
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
function namespace(frame: Namespaces, name: string, attribute = false): string | undefined {
  const pieces = name.split(':');
  if (pieces.length > 2 || pieces.some(p => !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(p))) throw new Error('Malformed qualified XML name.');
  if (attribute && pieces.length === 1) return '';
  const prefix = pieces.length === 2 ? pieces[0]! : '';
  if (prefix === 'xml') return XML_NAMESPACE;
  for (let current: Namespaces | undefined = frame; current; current = current.parent) {
    if (Object.hasOwn(current.values, prefix)) return current.values[prefix];
  }
  return prefix ? undefined : '';
}

function entities(value: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value)) throw new Error('Unsupported XML entity.');
  return value.replace(/&([^;]*);/g, (_all, entity: string) => {
    const predefined: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (predefined[entity]) return predefined[entity]!;
    const point = /^#x[\da-fA-F]+$/.test(entity) ? Number.parseInt(entity.slice(2), 16) : /^#\d+$/.test(entity) ? Number(entity.slice(1)) : NaN;
    if (!Number.isInteger(point) || point > 0x10ffff || point < 32 && ![9, 10, 13].includes(point) || point >= 0xd800 && point <= 0xdfff || point === 0xfffe || point === 0xffff) throw new Error('Unsupported XML entity.');
    return String.fromCodePoint(point);
  });
}

function attributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = Object.create(null);
  const pattern = /[\t\n\r ]+([A-Za-z_][A-Za-z0-9_.:-]*)[\t\n\r ]*=[\t\n\r ]*(["'])(.*?)\2/sy;
  let offset = 0, count = 0;
  while (offset < raw.length) {
    if (SPACE.test(raw.slice(offset))) break;
    if (++count > 128) throw new Error('XML attribute limit reached.');
    pattern.lastIndex = offset;
    const match = pattern.exec(raw);
    if (!match || match[3]!.includes('<') || Object.hasOwn(attrs, match[1]!)) throw new Error('Malformed XML attributes.');
    attrs[match[1]!] = entities(match[3]!.replace(/\r\n?/g, '\n').replace(/[\t\n]/g, ' '));
    offset = pattern.lastIndex;
  }
  return attrs;
}

/** The parser deliberately accepts a limited XML subset used by OOXML. */
export function readOfficeXml(bytes: Uint8Array, budget: OfficeXmlBudget): OfficeXmlNode {
  if (bytes.length > OFFICE_MAX_XML_BYTES) throw new Error('XML part exceeds 2 MiB.');
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  const xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  for (const char of xml) {
    const point = char.codePointAt(0)!;
    if (point < 32 && ![9, 10, 13].includes(point) || point >= 0xd800 && point <= 0xdfff || point === 0xfffe || point === 0xffff) throw new Error('Invalid XML characters.');
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error('XML declarations with entities are unsupported.');
  const declaration = /^\s*<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)/i.exec(xml)?.[1]?.toLowerCase();
  if (declaration && (encoding === 'utf-8' ? declaration !== 'utf-8' : !['utf-16', encoding].includes(declaration))) throw new Error('Unsupported XML encoding.');
  let root: OfficeXmlNode | undefined, offset = 0, partNodes = 0, partTokens = 0;
  const stack: { raw: string; node: OfficeXmlNode; namespaces: Namespaces }[] = [];
  const appendText = (text: string): void => {
    if (text.includes(']]>')) throw new Error('Malformed XML character data.');
    if (!stack.length) { if (!SPACE.test(text)) throw new Error('Text outside XML root.'); return; }
    const node = stack[stack.length - 1]!.node;
    node.text += entities(text);
  };
  while (offset < xml.length) {
    const start = xml.indexOf('<', offset);
    if (start < 0) { appendText(xml.slice(offset)); break; }
    if (++partTokens > 80_000 || ++budget.nodes > 200_000) throw new Error('XML structure limit reached.');
    appendText(xml.slice(offset, start));
    const ending = xml.startsWith('<!--', start) ? '-->' : xml.startsWith('<?', start) ? '?>' : xml.startsWith('<![CDATA[', start) ? ']]>' : '';
    if (ending) {
      const end = xml.indexOf(ending, start + 2);
      if (end < 0) throw new Error('Unterminated XML section.');
      if (ending === '-->' && (xml.slice(start + 4, end).includes('--') || xml.slice(start + 4, end).endsWith('-'))) throw new Error('Malformed XML comment.');
      if (ending === '?>') {
        const instruction = xml.slice(start + 2, end), target = NAME.exec(instruction)?.[0];
        if (!target || !/^(?:[\t\n\r ]|$)/.test(instruction.slice(target.length))) throw new Error('Malformed XML instruction.');
        if (target.toLowerCase() === 'xml' && (target !== 'xml' || start !== 0 || !/^xml[\t\n\r ]+version[\t\n\r ]*=[\t\n\r ]*(["'])1\.0\1(?:[\t\n\r ]+encoding[\t\n\r ]*=[\t\n\r ]*(["'])[A-Za-z][A-Za-z0-9._-]*\2)?(?:[\t\n\r ]+standalone[\t\n\r ]*=[\t\n\r ]*(["'])(?:yes|no)\3)?[\t\n\r ]*$/.test(instruction))) throw new Error('Malformed XML declaration.');
      }
      if (ending === ']]>') {
        if (!stack.length) throw new Error('CDATA outside XML root.');
        stack[stack.length - 1]!.node.text += xml.slice(start + 9, end);
      }
      offset = end + ending.length; continue;
    }
    let end = start + 1, quote = '';
    for (; end < xml.length; end++) {
      if (end - start > 64 * 1024) throw new Error('XML tag length limit reached.');
      const char = xml[end]!;
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === xml.length) throw new Error('Unterminated XML tag.');
    const tag = xml.slice(start + 1, end);
    if (tag.startsWith('/')) {
      const close = /^\/([A-Za-z_][A-Za-z0-9_.:-]*)[\t\n\r ]*$/.exec(tag);
      if (!close) throw new Error('Malformed closing tag.');
      const name = close[1]!;
      const opened = stack.pop();
      if (opened?.raw !== name) throw new Error('Mismatched XML tag.');
      opened.node.end = end + 1;
    } else {
      const name = NAME.exec(tag)?.[0];
      if (!name || ++partNodes > 40_000 || stack.length >= 96) throw new Error('XML structure limit reached.');
      const empty = tag.endsWith('/'), rawAttrs = tag.slice(name.length).replace(/\/$/, '');
      if (name === 'xmlns' || name.startsWith('xmlns:')) throw new Error('Reserved XML name.');
      const attrs = attributes(rawAttrs), declarations: Record<string, string> = Object.create(null);
      for (const [key, value] of Object.entries(attrs)) if (key === 'xmlns' || key.startsWith('xmlns:')) {
        const prefix = key === 'xmlns' ? '' : key.slice(6);
        if (prefix && !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(prefix) || prefix === 'xmlns' || value === XMLNS_NAMESPACE || prefix === 'xml' && value !== XML_NAMESPACE || prefix !== 'xml' && value === XML_NAMESPACE || prefix && !value) throw new Error('Invalid XML namespace declaration.');
        declarations[prefix] = value;
      }
      const frame: Namespaces = { parent: stack.at(-1)?.namespaces, values: declarations };
      const attributeNamespaces: Record<string, string | undefined> = Object.create(null), expanded = new Set<string>();
      for (const key of Object.keys(attrs)) {
        const uri = key === 'xmlns' || key.startsWith('xmlns:') ? XMLNS_NAMESPACE : namespace(frame, key, true);
        const identity = `${uri ?? key}:${local(key)}`;
        if (expanded.has(identity)) throw new Error('Duplicate qualified XML attribute.');
        expanded.add(identity); attributeNamespaces[key] = uri;
      }
      const node: OfficeXmlNode = { name: local(name), qname: name, namespace: namespace(frame, name), attrs, attributeNamespaces, children: [], text: '', start, end: end + 1 };
      if (stack.length) stack[stack.length - 1]!.node.children.push(node);
      else { if (root) throw new Error('Multiple XML roots.'); root = node; }
      if (!empty) stack.push({ raw: name, node, namespaces: frame });
    }
    offset = end + 1;
  }
  if (!root || stack.length) throw new Error('Incomplete XML document.');
  return root;
}

export function officeNodes(root: OfficeXmlNode): OfficeXmlNode[] {
  const nodes = [root];
  for (let i = 0; i < nodes.length; i++) nodes.push(...nodes[i]!.children);
  return nodes;
}
export function officeAttr(node: OfficeXmlNode, name: string): string | undefined {
  return Object.entries(node.attrs).find(([key]) => local(key) === name)?.[1];
}
export function officeText(root: OfficeXmlNode): string {
  let text = '';
  for (const node of officeNodes(root)) { text += `${node.text} `; if (text.length > 2048) return `${text.slice(0, 2048).trim()}…`; }
  return text.trim();
}
