// SPDX-License-Identifier: MPL-2.0
/**
 * Pages output read back by an independent reader. The PDF fixture is written
 * by hand below (not by pdf-lib, which the operations use), and every result
 * is opened with pdf.js, which shares no code with either. Page identity comes
 * from each fixture page's distinct size.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packPng } from '@lolly/engine';
import { createPdfAPI } from './pdf.ts';

/** A minimal PDF 1.4 file with one page per size and a filled square on each. */
function handWrittenPdf(sizes: Array<[number, number]>, rotate: number[] = []): Uint8Array {
  const objects: string[] = [];
  const kids = sizes.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${sizes.length} >>`);
  sizes.forEach(([w, h], i) => {
    const content = `0.2 0.4 0.8 rg 1 1 ${Math.min(w, h) / 2} ${Math.min(w, h) / 2} re f`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Rotate ${rotate[i] ?? 0} /Contents ${4 + i * 2} 0 R /Resources << >> >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, 'latin1'));
}

// A 16 x 8 baseline JPEG, red on the left half and blue on the right. Synthetic.
const JPEG = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAcI/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABUBAQEAAAAAAAAAAAAAAAAAAAcI/8QAGBEAAgMAAAAAAAAAAAAAAAAAAAhFg8P/2gAMAwEAAhEDEQA/AM6IEBwWWYo2KNYaKuyP/9k=', 'base64'));

/** The fixture JPEG with an Exif orientation of 6 and an XMP packet before its JFIF header. */
function orientedJpeg(): Uint8Array {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0];
  const exif = [...Buffer.from('Exif\0\0', 'latin1'), ...tiff];
  const xmp = [...Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>GPS 51,30N</x:xmpmeta>', 'latin1')];
  const app1 = (body: number[]) => [0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
  return new Uint8Array([...JPEG.subarray(0, 2), ...app1(exif), ...app1(xmp), ...JPEG.subarray(2)]);
}

interface ReadPage { size: [number, number]; rotate: number; images: Array<{ matrix: number[] | null; width: number; height: number; at: (x: number, y: number) => number[] }> }

async function readWithPdfJs(bytes: Uint8Array): Promise<ReadPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  try {
    const pages: ReadPage[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const ops = await page.getOperatorList();
      const images: ReadPage['images'] = [];
      let matrix: number[] | null = null;
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjs.OPS.transform) matrix = [...ops.argsArray[i]];
        if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
        const image = await new Promise<{ width: number; height: number; data: Uint8ClampedArray }>((resolve) => page.objs.get(ops.argsArray[i][0], resolve));
        const channels = image.data.length / (image.width * image.height);
        images.push({ matrix, width: image.width, height: image.height,
          at: (x, y) => [...image.data.slice((y * image.width + x) * channels, (y * image.width + x) * channels + 3)] });
      }
      pages.push({ size: [page.view[2]! - page.view[0]!, page.view[3]! - page.view[1]!], rotate: page.rotate, images });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

const SIZES: Array<[number, number]> = [[101, 201], [102, 202], [103, 203], [104, 204], [105, 205]];
const close = (rgb: number[], want: number[]) => rgb.every((v, i) => Math.abs(v - want[i]!) <= 24);

test('page operations keep the requested pages, in order, readable by pdf.js', async () => {
  const api = createPdfAPI();
  const src = handWrittenPdf(SIZES, [0, 90, 0, 0, 0]);
  const sizes = async (bytes: Uint8Array) => (await readWithPdfJs(bytes)).map(p => p.size);

  assert.deepEqual(await sizes((await api.organize!(src, { operation: 'reorder', pages: '5,1-2,4,3' })).bytes!),
    [[105, 205], [101, 201], [102, 202], [104, 204], [103, 203]]);
  assert.deepEqual(await sizes((await api.organize!(src, { operation: 'extract', pages: '4,2' })).bytes!), [[104, 204], [102, 202]]);
  assert.deepEqual(await sizes((await api.organize!(src, { operation: 'delete', pages: '1,3-4' })).bytes!), [[102, 202], [105, 205]]);
  const split = await api.organize!(src, { operation: 'split', pages: '1-2,5-4' });
  assert.deepEqual(await Promise.all(split.files!.map(f => sizes(f.bytes))), [[[101, 201], [102, 202]], [[105, 205], [104, 204]]]);
  const rotated = await readWithPdfJs((await api.organize!(src, { operation: 'rotate', pages: '1-2', rotation: 90 })).bytes!);
  assert.deepEqual(rotated.map(p => p.rotate), [90, 180, 0, 0, 0], 'rotation adds to the page\'s own turn');
});

test('images and PDF pages combine into one PDF that pdf.js reads and decodes', async () => {
  const api = createPdfAPI();
  const photo = await api.fromImages!([{ bytes: orientedJpeg() }]);
  const png = packPng(new Uint8Array(4 * 2 * 4).map((_, i) => (i % 4 === 1 || i % 4 === 3 ? 255 : 0)), { width: 4, height: 2, dpi: 96 });
  const graphic = await api.fromImages!([{ bytes: png }], { pageSize: 'a4' });
  const res = await api.organize!(handWrittenPdf([[300, 400]]), { operation: 'reorder', pages: '3,1,2', extras: [photo.bytes, graphic.bytes] });
  assert.equal(Buffer.from(res.bytes!).includes(Buffer.from('GPS 51')), false, 'the XMP packet is not in the PDF');

  const pages = await readWithPdfJs(res.bytes!);
  assert.deepEqual(pages.map(p => p.size.map(v => Math.round(v * 100) / 100)), [[841.89, 595.28], [300, 400], [6, 12]]);

  // The A4 page: a landscape 4 x 2 green image scaled to fill the page width.
  const [green] = pages[0]!.images;
  assert.deepEqual([green!.width, green!.height], [4, 2]);
  assert.ok(close(green!.at(0, 0), [0, 255, 0]));
  const want = [841.89, 0, 0, 420.945, 0, 87.1675];
  assert.ok(green!.matrix!.every((v, i) => Math.abs(v - want[i]!) < 0.05), `fitted and centred, got ${green!.matrix}`);

  // The photo page: the stored 16 x 8 JPEG decodes red then blue, turned a quarter clockwise onto a 6 x 12 page.
  const [jpeg] = pages[2]!.images;
  assert.deepEqual([jpeg!.width, jpeg!.height], [16, 8]);
  assert.ok(close(jpeg!.at(1, 4), [255, 0, 0]), `left half is red, got ${jpeg!.at(1, 4)}`);
  assert.ok(close(jpeg!.at(14, 4), [0, 0, 255]), `right half is blue, got ${jpeg!.at(14, 4)}`);
  assert.deepEqual(jpeg!.matrix, [0, -12, 6, 0, 0, 12]);
});
