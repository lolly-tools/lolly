// SPDX-License-Identifier: MPL-2.0
import { zipSync, strToU8 } from 'fflate';
import { writeDocx } from '../../engine/src/docx.ts';
const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const relNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const docxFixture = (blocks: readonly string[]): Uint8Array => writeDocx({ title: 'Comparison fixture', blocks: blocks.map(text => ({ type: 'paragraph', text })) });
export function xlsxFixture(sheets: readonly { name: string; rows: readonly (readonly string[])[] }[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="${relNs}"><sheets>${sheets.map((sheet, i) => `<sheet name="${esc(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${sheets.map((_sheet, i) => `<Relationship Id="rId${i + 1}" Type="${relNs}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<worksheet><sheetData>${sheet.rows.map((row, r) => `<row r="${r + 1}">${row.map(value => `<c t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`);
  });
  return zipSync(files);
}
export function pptxFixture(slides: readonly { id: number; text: string }[]): Uint8Array {
  const p = 'http://schemas.openxmlformats.org/presentationml/2006/main', a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const files: Record<string, Uint8Array> = {
    'ppt/presentation.xml': strToU8(`<p:presentation xmlns:p="${p}" xmlns:r="${relNs}"><p:sldIdLst>${slides.map((slide, i) => `<p:sldId id="${slide.id}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`),
    'ppt/_rels/presentation.xml.rels': strToU8(`<Relationships>${slides.map((_slide, i) => `<Relationship Id="rId${i + 1}" Type="${relNs}/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  slides.forEach((slide, i) => {
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(`<p:sld xmlns:p="${p}" xmlns:a="${a}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>${esc(slide.text)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  });
  return zipSync(files);
}
