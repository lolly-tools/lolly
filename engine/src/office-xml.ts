// SPDX-License-Identifier: MPL-2.0
/** Small, bounded XML census tree. No DTD, custom entities or external resources. */
export interface OfficeXmlNode { name: string; attrs: Record<string, string>; children: OfficeXmlNode[]; text: string }
export interface OfficeXmlBudget { nodes: number }
export const OFFICE_MAX_XML_BYTES = 2 * 1024 * 1024;
const NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/;
const local = (name: string): string => name.slice(name.lastIndexOf(':') + 1);

function entities(value: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(value)) throw new Error('Unsupported XML entity.');
  return value.replace(/&([^;]*);/g, (_all, entity: string) => {
    const predefined: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (predefined[entity]) return predefined[entity]!;
    const point = /^#x[\da-f]+$/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : /^#\d+$/.test(entity) ? Number(entity.slice(1)) : NaN;
    if (!Number.isInteger(point) || point > 0x10ffff || point < 32 && ![9, 10, 13].includes(point) || point >= 0xd800 && point <= 0xdfff || point === 0xfffe || point === 0xffff) throw new Error('Unsupported XML entity.');
    return String.fromCodePoint(point);
  });
}

function attributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = Object.create(null);
  const pattern = /\s+([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(["'])(.*?)\2/sy;
  let offset = 0, count = 0;
  while (offset < raw.length) {
    if (/^\s*$/.test(raw.slice(offset))) break;
    if (++count > 128) throw new Error('XML attribute limit reached.');
    pattern.lastIndex = offset;
    const match = pattern.exec(raw);
    if (!match || match[3]!.includes('<') || Object.hasOwn(attrs, match[1]!)) throw new Error('Malformed XML attributes.');
    attrs[match[1]!] = entities(match[3]!);
    offset = pattern.lastIndex;
  }
  return attrs;
}

/** The parser deliberately accepts a limited XML subset used by OOXML. */
export function readOfficeXml(bytes: Uint8Array, budget: OfficeXmlBudget): OfficeXmlNode {
  if (bytes.length > OFFICE_MAX_XML_BYTES) throw new Error('XML part exceeds 2 MiB.');
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  const xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  for (const char of xml) if (char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0))) throw new Error('Invalid XML characters.');
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml)) throw new Error('XML declarations with entities are unsupported.');
  const declaration = /^\s*<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)/i.exec(xml)?.[1]?.toLowerCase();
  if (declaration && !['utf-8', 'utf-16', 'utf-16le', 'utf-16be'].includes(declaration)) throw new Error('Unsupported XML encoding.');
  let root: OfficeXmlNode | undefined, offset = 0, partNodes = 0, partTokens = 0;
  const stack: { raw: string; node: OfficeXmlNode }[] = [];
  const appendText = (text: string): void => {
    if (!stack.length) { if (text.trim()) throw new Error('Text outside XML root.'); return; }
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
      const name = tag.slice(1).trim();
      if (stack.pop()?.raw !== name) throw new Error('Mismatched XML tag.');
    } else {
      const name = NAME.exec(tag)?.[0];
      if (!name || ++partNodes > 40_000 || stack.length >= 96) throw new Error('XML structure limit reached.');
      const empty = /\/\s*$/.test(tag), rawAttrs = tag.slice(name.length).replace(/\/\s*$/, '');
      const node: OfficeXmlNode = { name: local(name), attrs: attributes(rawAttrs), children: [], text: '' };
      if (stack.length) stack[stack.length - 1]!.node.children.push(node);
      else { if (root) throw new Error('Multiple XML roots.'); root = node; }
      if (!empty) stack.push({ raw: name, node });
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
