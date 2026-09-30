// SPDX-License-Identifier: MPL-2.0
/** Generate review examples with geometry labels and explicit authorship exclusions. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import { buildPptxParts, EMU_PER_PX, type PptxShape } from '../engine/src/pptx.ts';
import { sha256Hex } from '../engine/src/bytes.ts';
import { forensicDesignCases, forensicDesignSvg } from '../tests/fixtures/forensic-design.ts';
const output = resolve(process.argv[2] ?? 'plans/287-verify-forensics/design-review');
await mkdir(output, { recursive: true });
const records: {
  id: string;
  files: { name: string; sha256: string }[];
  expectedCards: number;
  expectedEyebrow: string;
  authorship: string;
  calibrationEligible: boolean;
}[] = [];
for (const example of forensicDesignCases) {
  const files: { name: string; sha256: string }[] = [];
  const save = async (extension: string, bytes: Uint8Array) => {
    const name = `${example.id}.${extension}`;
    await writeFile(join(output, name), bytes);
    files.push({ name, sha256: await sha256Hex(bytes) });
  };
  const svg = forensicDesignSvg(example),
    png = await sharp(Buffer.from(svg)).png().toBuffer();
  await save('svg', new TextEncoder().encode(svg));
  await save('png', png);
  const pdf = await PDFDocument.create(),
    image = await pdf.embedPng(png);
  pdf.addPage([500, 320]).drawImage(image, { x: 0, y: 0, width: 500, height: 320 });
  await save('pdf', await pdf.save());
  records.push({
    id: example.id,
    files,
    expectedCards: example.expectedCards,
    expectedEyebrow: example.expectedEyebrow,
    authorship: 'AI-assisted programmatic test fixture; not an independent authorship sample',
    calibrationEligible: false,
  });
}
const emu = (n: number) => Math.round(n * EMU_PER_PX);
const mixed = await PDFDocument.create();
const face = await mixed.embedFont(StandardFonts.Helvetica);
const card = await mixed.embedPng(await readPatternPng());
for (let i = 0; i < 8; i++) {
  const page = mixed.addPage([500, 320]);
  if (i % 2) page.drawImage(card, { x: 0, y: 0, width: 500, height: 320 });
  else {
    page.drawText('Growth strategy', { x: 65, y: 215, size: 14, font: face });
    page.drawText('Our growth strategy', { x: 65, y: 180, size: 30, font: face });
  }
}
await writeFile(join(output, 'mixed-pages.pdf'), await mixed.save());
async function readPatternPng(): Promise<Buffer> {
  return sharp(Buffer.from(forensicDesignSvg(forensicDesignCases[0]))).png().toBuffer();
}
const shapes: PptxShape[] = [
  {
    kind: 'rect',
    x: emu(40),
    y: emu(80),
    cx: emu(320),
    cy: emu(160),
    radius: emu(16),
    fill: { solid: '#20ba80' },
  },
  {
    kind: 'rect',
    x: emu(48),
    y: emu(80),
    cx: emu(312),
    cy: emu(160),
    radius: emu(16),
    fill: { solid: '#eeeeee' },
  },
  ...[
    { text: 'Growth strategy', y: 104, size: 10.5 },
    { text: 'Our growth strategy', y: 122, size: 22.5 },
    { text: '# 01 North', y: 260, size: 12 },
    { text: '# 02 South', y: 280, size: 12 },
  ].map((r) => ({
    kind: 'text' as const,
    x: emu(65),
    y: emu(r.y),
    cx: emu(400),
    cy: emu(35),
    paras: [{ runs: [{ text: r.text, sizePt: r.size, color: '#102d26' }] }],
  })),
];
const pptx = buildPptxParts([{ shapes, media: [] }], { emuW: emu(500), emuH: emu(320) });
await writeFile(
  join(output, 'native-patterns.pptx'),
  zipSync(
    Object.fromEntries(
      Object.entries(pptx).map(([name, data]) => [
        name,
        typeof data === 'string' ? strToU8(data) : data,
      ])
    )
  )
);
await sharp(join(output, 'accent-left.png')).withExif({
  IFD0: { Artist: 'Local test fixture' },
  IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '0/1 7/1 0/1' },
}).jpeg().toFile(join(output, 'location.jpg'));
await writeFile(join(output, 'numbering.txt'), '# 01 North\n# 02 South\n# 03 West\n');
await writeFile(
  join(output, 'manifest.json'),
  JSON.stringify(
    {
      profile: 'lolly/forensic-design-review-v1',
      purpose:
        'Review localization and negative controls. No authorship calibration labels are inferred from motifs.',
      examples: records,
      requiredReviewFields: [
        'reviewer',
        'patternPresent',
        'regionAccuracy',
        'functionalPurpose',
        'creationHistory',
        'rights',
        'humanAiMixedOrUnknown',
        'creatorGroup',
        'templateGroup',
        'generatorFamily',
        'approvedSplit',
      ],
    },
    null,
    2
  )
);
await writeFile(
  join(output, 'reviews.csv'),
  'id,reviewer,pattern_present,region_accuracy,functional_purpose,creation_history,rights,authorship,creator_group,template_group,generator_family,approved_split\n' +
    records.map((r) => `${r.id},,,,,,,synthetic-control,,,,development`).join('\n') +
    '\n'
);
await writeFile(
  join(output, 'index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Verify design review</title><style>body{font:16px system-ui;max-width:1100px;margin:3rem auto;padding:1rem;color:#172622}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:2rem}figure{margin:0;border:1px solid #bbb;padding:1rem}img{width:100%}figcaption{line-height:1.6}</style><h1>Verify design review</h1><p>These synthetic examples test pattern detection. They do not establish AI authorship accuracy. Review creation history separately before admitting real designs to calibration.</p><main>${records.map((r) => `<figure><img src="${r.id}.png" alt="${r.id}"><figcaption><strong>${r.id}</strong><br>Expected accent cards: ${r.expectedCards}<br>Heading: ${r.expectedEyebrow || 'none'}<br><a href="${r.id}.svg">SVG</a> · <a href="${r.id}.pdf">Flattened PDF</a></figcaption></figure>`).join('')}</main><p><a href="reviews.csv">Review worksheet</a> · <a href="manifest.json">Provenance manifest</a> · <a href="native-patterns.pptx">Native slide</a></p></html>`
);
console.log(
  `Prepared ${records.length} design controls and native-slide/text examples in ${output}`
);
