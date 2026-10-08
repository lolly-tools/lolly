// SPDX-License-Identifier: MPL-2.0
/** Independently authored IDML parts: a grouped card and a separate accent. */
export function groupedIdmlParts(): Record<string, Uint8Array> {
  const geometry = (w: number, h: number) => `<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray><PathPointType Anchor="0 0"/><PathPointType Anchor="${w} 0"/><PathPointType Anchor="${w} ${h}"/><PathPointType Anchor="0 ${h}"/></PathPointArray></GeometryPathType></PathGeometry></Properties>`;
  const parts = {
    'designmap.xml': '<Document xmlns:p="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"><p:Graphic src="Resources/Graphic.xml"/><p:Story src="Stories/card.xml"/><p:Spread src="Spreads/layout.xml"/></Document>',
    'Resources/Graphic.xml': '<Graphic><Color Self="Ink" Space="RGB" ColorValue="20 50 80"/><Color Self="Paper" Space="RGB" ColorValue="240 230 210"/></Graphic>',
    'Stories/card.xml': '<Story Self="card"><ParagraphStyleRange Justification="LeftAlign"><CharacterStyleRange PointSize="24" FontStyle="Bold" FillColor="Ink"><Properties><AppliedFont>Studio Sans</AppliedFont></Properties><Content>Keep the look</Content></CharacterStyleRange></ParagraphStyleRange></Story>',
    'Spreads/layout.xml': `<Spread><Page GeometricBounds="0 0 360 640"/><Group ItemTransform="1 0 0 1 80 90"><Rectangle FillColor="Paper">${geometry(300, 140)}</Rectangle><TextFrame ParentStory="card" ItemTransform="1 0 0 1 24 24">${geometry(252, 80)}</TextFrame></Group><Oval FillColor="Ink" ItemTransform="1 0 0 1 460 90">${geometry(80, 80)}</Oval></Spread>`,
  };
  return Object.fromEntries(Object.entries(parts).map(([path, source]) => [path, new TextEncoder().encode(source)]));
}
