// SPDX-License-Identifier: MPL-2.0
/** Add synthetic extended properties to the maintained authored Writer fixture. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readZipMembers, decodeZipMember, storeZip, storeZipMembers } from '../../../engine/src/zip.ts';
import { readOfficeXml } from '../../../engine/src/office-xml.ts';

const EXTENDED = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';

export function withExtendedFixtureProperties(bytes: Uint8Array): Uint8Array {
  const members = readZipMembers(bytes), app = members.find(member => member.name === 'docProps/app.xml');
  if (!app) throw new Error('The Writer fixture has no extended property part.');
  const decoded = decodeZipMember(app), root = readOfficeXml(decoded, { nodes: 0 });
  if (root.name !== 'Properties' || root.namespace !== EXTENDED) throw new Error('The Writer fixture has unexpected extended properties.');
  const prefix = root.qname.includes(':') ? `${root.qname.slice(0, root.qname.indexOf(':'))}:` : '';
  const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
  const closing = `</${root.qname}>`, end = text.lastIndexOf(closing);
  if (end < 0 || root.children.some(node => node.namespace === EXTENDED && ['Company', 'Manager'].includes(node.name))) throw new Error('Regenerate from metadata.docx before seeding extended properties.');
  const fields = `<${prefix}Company>Private fixture company</${prefix}Company><${prefix}Manager>Private fixture manager</${prefix}Manager>`;
  const output = new TextEncoder().encode(text.slice(0, end) + fields + text.slice(end));
  readOfficeXml(output, { nodes: 0 });
  const replacement = readZipMembers(storeZip([{ name: app.name, bytes: output }]))[0]!;
  return storeZipMembers(members.map(member => member.name === app.name ? replacement : member));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const base = new Uint8Array(readFileSync(new URL('./metadata.docx', import.meta.url)));
  writeFileSync(new URL('./extended-properties.docx', import.meta.url), withExtendedFixtureProperties(base));
}
