// SPDX-License-Identifier: MPL-2.0
/** Pattern fixtures have geometry labels, never inferred human/AI authorship labels. */
export const forensicDesignCases = [
  {
    id: 'accent-left',
    radius: 16,
    edge: 'left',
    eyebrow: 'Growth strategy',
    heading: 'Our growth strategy',
    expectedCards: 1,
    expectedEyebrow: 'redundant-eyebrow',
  },
  {
    id: 'accent-top',
    radius: 16,
    edge: 'top',
    eyebrow: 'Growth strategy',
    heading: 'Our growth strategy',
    expectedCards: 1,
    expectedEyebrow: 'redundant-eyebrow',
  },
  {
    id: 'square-panel',
    radius: 0,
    edge: 'left',
    eyebrow: '',
    heading: 'Quarterly findings',
    expectedCards: 0,
    expectedEyebrow: '',
  },
  {
    id: 'complete-border',
    radius: 16,
    edge: 'full',
    eyebrow: '',
    heading: 'Quarterly findings',
    expectedCards: 0,
    expectedEyebrow: '',
  },
  {
    id: 'plain-panel',
    radius: 16,
    edge: 'none',
    eyebrow: '',
    heading: 'Quarterly findings',
    expectedCards: 0,
    expectedEyebrow: '',
  },
  {
    id: 'useful-category',
    radius: 16,
    edge: 'none',
    eyebrow: 'NEWS',
    heading: 'Quarterly findings',
    expectedCards: 0,
    expectedEyebrow: 'eyebrow-heading',
  },
] as const;
export function forensicDesignSvg(c: (typeof forensicDesignCases)[number]): string {
  const base = `<rect x="40" y="80" width="320" height="160" rx="${c.radius}" fill="#eee"${c.edge === 'full' ? ' stroke="#20ba80" stroke-width="8"' : ''}/>`;
  const card =
    c.edge === 'left' || c.edge === 'top'
      ? `<rect x="40" y="80" width="320" height="160" rx="${c.radius}" fill="#20ba80"/><rect x="${c.edge === 'left' ? 48 : 40}" y="${c.edge === 'top' ? 88 : 80}" width="${c.edge === 'left' ? 312 : 320}" height="${c.edge === 'top' ? 152 : 160}" rx="${c.radius}" fill="#eee"/>`
      : base;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320" viewBox="0 0 500 320"><rect width="500" height="320" fill="#fff"/>${card}${c.eyebrow ? `<text x="65" y="118" font-size="14" font-family="sans-serif">${c.eyebrow}</text>` : ''}<text x="65" y="152" font-size="30" font-family="sans-serif">${c.heading}</text></svg>`;
}
