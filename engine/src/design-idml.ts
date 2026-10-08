// SPDX-License-Identifier: MPL-2.0
/** Deterministic IDML for static Design text, rectangular/oval frames and still images. */
import type { AssetRef, ExportOpts, HostV1 } from './bridge/host-v1.ts';
import { parseColorToSrgb8 } from './css-color.ts';
import { colorToHex } from './tokens.ts';
import { parseDesignText } from './design-text.ts';
import { escapeAdobeXml as esc } from './adobe-xml.ts';
import { storeZip, type ZipStoreEntry } from './zip.ts';
import { imageDimensions } from './penpot-file.ts';
import { attributionCompanion } from './rights-attribution.ts';
import { checkCompanionReadback } from './rights-companion.ts';

type Box = Record<string, unknown>;
const num = (v: unknown, fallback = 0): number => v == null || v === '' ? fallback : Number.isFinite(Number(v)) ? Number(v) : fallback;
const yes = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';
const ns = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
const wrap = (kind: string, body: string) => xml(`<idPkg:${kind} xmlns:idPkg="${ns}" DOMVersion="16.0">${body}</idPkg:${kind}>`);
const number = (n: number) => String(Math.round(n * 1000000) / 1000000);
function pathPoints(w: number, h: number, oval: boolean): string {
  const cx = w / 2, cy = h / 2, kx = cx * 0.5522847498307936, ky = cy * 0.5522847498307936;
  const points = oval ? [
    [[cx, 0], [cx - kx, 0], [cx + kx, 0]], [[w, cy], [w, cy - ky], [w, cy + ky]],
    [[cx, h], [cx + kx, h], [cx - kx, h]], [[0, cy], [0, cy + ky], [0, cy - ky]],
  ] : [[0, 0], [w, 0], [w, h], [0, h]].map(point => [point, point, point]);
  return points.map(([anchor, left, right]) => `<PathPointType Anchor="${anchor!.map(number).join(' ')}" LeftDirection="${left!.map(number).join(' ')}" RightDirection="${right!.map(number).join(' ')}"/>`).join('');
}

export async function exportDesignIdml(opts: ExportOpts, host: HostV1): Promise<Blob> {
  if (opts.sourceDocument?.toolId !== 'design') throw new Error('IDML export needs an authored Design document.');
  if (opts.watermark) throw new Error('IDML export cannot carry the requested visible watermark.');
  const values = structuredClone(opts.sourceDocument.values);
  if (values.customCss || values.textDocument) throw new Error('IDML export supports ordinary Design boxes. Composed stories and custom CSS require PDF export.');
  const boxes = (Array.isArray(values.boxes) ? values.boxes : []) as Box[];
  if (boxes.length > 10000) throw new Error('IDML export exceeds the item limit.');
  const visible = boxes.filter(b => !yes(b.hidden)), frames = visible.filter(b => b.kind === 'frame');
  const pages = frames.length ? frames : [{ id: '', w: num(opts.width, 1920), h: num(opts.height, 1080), x: 0, y: 0, bg: values.background }];
  if (pages.length > 256) throw new Error('IDML export exceeds the spread limit.');
  const entries: ZipStoreEntry[] = [], encoder = new TextEncoder(); let bytesTotal = 0;
  const add = (name: string, content: string | Uint8Array) => {
    const bytes = typeof content === 'string' ? encoder.encode(content) : content;
    bytesTotal += bytes.length; if (bytesTotal > 128 * 1024 * 1024) throw new Error('IDML export exceeds 128 MB.');
    entries.push({ name, bytes });
  };
  const colors = new Map<string, string>(), notes = ['Supported static subset. Canvas coordinate units are written as InDesign points. Text layout can change when InDesign resolves fonts.'];
  async function familyOf(box: Box): Promise<string> {
    const font = String(box.font || 'sans');
    if (!['sans', 'display', 'mono'].includes(font)) return font;
    const resolved = await host.tokens?.resolve(`{font.${font === 'sans' ? 'brand' : font}}`) ?? (font === 'display' ? await host.tokens?.resolve('{font.brand}') : undefined);
    if (typeof resolved === 'string' && resolved.trim()) return resolved;
    if (Array.isArray(resolved) && typeof resolved[0] === 'string') return resolved[0];
    if (box.fontFamily) return String(box.fontFamily);
    notes.push(`${String(box.id)}: the ${font} font role was unavailable; an ordinary fallback family was used.`);
    return font === 'mono' ? 'Courier New' : 'Arial';
  }
  async function paint(value: unknown): Promise<string> {
    let s = String(value ?? '');
    if (!s || s === 'transparent' || s === 'none') return 'Swatch/None';
    if (s.startsWith('{')) s = colorToHex(await host.tokens?.resolve(s)) ?? '';
    const variable = /^var\(--brand-(primary|on-primary|secondary|surface|text|muted|edge)\s*(?:,\s*(.+))?\)$/.exec(s);
    if (variable) s = colorToHex(await host.tokens?.resolve(`{color.semantic.${variable[1]}}`)) ?? variable[2] ?? '';
    const rgba = parseColorToSrgb8(s);
    if (rgba?.[3] !== 1) throw new Error(`IDML requires a solid opaque paint: ${String(value)}.`);
    const key = rgba.slice(0, 3).join(' '); if (!colors.has(key)) colors.set(key, `Color/lolly-${colors.size}`);
    return colors.get(key)!;
  }
  function guard(box: Box): void {
    const name = String(box.name || box.id || 'Layer');
    for (const key of ['grad', 'clip', 'path', 'pathPaint', 'keys', 'cls', 'imageFraming']) if (box[key]) throw new Error(`${name}: ${key} is unsupported in IDML export.`);
    for (const key of ['blur', 'bgBlur', 'rx', 'ry', 'z']) if (num(box[key])) throw new Error(`${name}: ${key} is unsupported in IDML export.`);
    for (const key of ['shadow', 'blend', 'enter', 'exit', 'hold']) if (box[key] && !['none', 'normal'].includes(String(box[key]))) throw new Error(`${name}: ${key} is unsupported in IDML export.`);
    if (yes(box.flipH) || yes(box.flipV) || num(box.opacity, 100) !== 100) throw new Error(`${name}: mirroring or transparency is unsupported in IDML export.`);
    if (box.start !== undefined && box.start !== '') throw new Error(`${name}: timed content needs timeline or video export.`);
    if (box.group) notes.push(`${name}: group flattened into independent page items.`);
  }
  let item = 0, story = 0, image = 0;
  const spreadRefs: string[] = [], storyRefs: string[] = [];
  add('mimetype', 'application/vnd.adobe.indesign-idml-package');
  for (const [pageIndex, frame] of pages.entries()) {
    const width = num(frame.w, 1920), height = num(frame.h, 1080);
    if (width <= 0 || height <= 0 || width > 300000 || height > 300000) throw new Error('IDML page dimensions are invalid.');
    const content = visible.filter(b => b.kind !== 'frame' && (!frames.length || String(b.frame ?? '') === String(frame.id)));
    if (frames.length && pageIndex === 0 && visible.some(b => b.kind !== 'frame' && !b.frame)) notes.push('Items outside artboards were omitted.');
    const bg = await paint(frame.bg ?? values.background);
    if (bg !== 'Swatch/None') content.unshift({ kind: 'box', id: 'Background', x: num(frame.x), y: num(frame.y), w: width, h: height, bg: frame.bg ?? values.background, shape: 'rect' });
    let body = '';
    for (const box of content) {
      opts.signal?.throwIfAborted(); guard(box);
      const kind = String(box.kind || 'box'); if (!['box', 'text', 'image'].includes(kind)) throw new Error(`${String(box.id)}: ${kind} is unsupported in IDML export.`);
      const w = num(box.w, 320), h = num(box.h, 180), x = num(box.x) - num(frame.x), y = num(box.y) - num(frame.y);
      if (w <= 0 || h <= 0 || w > 300000 || h > 300000) throw new Error('IDML item dimensions are invalid.');
      const angle = num(box.rot) * Math.PI / 180, a = Math.cos(angle), b = Math.sin(angle);
      const e = x + w / 2 - a * w / 2 + b * h / 2, f = y + h / 2 - b * w / 2 - a * h / 2;
      const transform = [a, b, -b, a, e, f].map(number).join(' ');
      const shape = String(box.shape || 'rect'); if (!['rect', 'ellipse', 'circle', ''].includes(shape)) throw new Error(`${String(box.id)}: shape ${shape} is unsupported in IDML export.`);
      let tag = shape === 'ellipse' || shape === 'circle' ? 'Oval' : 'Rectangle', extra = '', inside = '';
      if (kind === 'text') {
        tag = 'TextFrame'; const id = `story-${++story}`, path = `Stories/Story_${id}.xml`; extra = ` ParentStory="${id}" PreviousTextFrame="n" NextTextFrame="n"`;
        const color = await paint(box.fg ?? '#000000'), size = num(box.fontSize, 48), weight = num(box.weight, num(box.fontWeight, 500));
        const family = await familyOf(box), align = box.align === 'left' ? 'LeftAlign' : box.align === 'right' ? 'RightAlign' : 'CenterAlign';
        if (![400, 700].includes(weight)) notes.push(`${String(box.id)}: font weight ${weight} uses ${weight >= 600 ? 'Bold' : 'Regular'}; choose the exact face in InDesign.`);
        const paras: string[] = [];
        for (const line of parseDesignText(String(box.text ?? ''))) {
          if (line.list) notes.push(`${String(box.id)}: list marker exported as literal text.`);
          let runs = '';
          const prefix = line.list === 'bullet' ? '• ' : line.list === 'number' ? `${line.number}. ` : '';
          for (const [index, run] of line.runs.entries()) {
            const fontStyle = `${run.bold || (run.weight ?? weight) >= 600 ? 'Bold' : 'Regular'}${run.italic ? ' Italic' : ''}`;
            const runColor = run.color ? await paint(run.color) : color;
            runs += `<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]" PointSize="${number(size)}" FontStyle="${fontStyle}" FillColor="${runColor}" Underline="${!!run.underline}" StrikeThru="${!!run.strike}"><Properties><AppliedFont type="string">${esc(run.font === 'mono' ? 'Courier New' : family)}</AppliedFont></Properties><Content>${esc((index === 0 ? prefix : '') + run.text)}</Content></CharacterStyleRange>`;
          }
          paras.push(`<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" Justification="${align}">${runs || '<CharacterStyleRange><Content/></CharacterStyleRange>'}<CharacterStyleRange><Br/></CharacterStyleRange></ParagraphStyleRange>`);
        }
        add(path, wrap('Story', `<Story Self="${id}"><StoryPreference StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection" FrameType="TextFrameType"/>${paras.join('')}</Story>`)); storyRefs.push(path);
        inside += '<TextFramePreference TextColumnCount="1" VerticalJustification="TopAlign"><Properties><InsetSpacing type="list"><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem><ListItem type="unit">0</ListItem></InsetSpacing></Properties></TextFramePreference>';
        if (box.valign && box.valign !== 'top' || num(box.pad)) notes.push(`${String(box.id)}: text padding and vertical alignment use IDML defaults.`);
      } else if (kind === 'image') {
        const ref = box.image as AssetRef | undefined;
        if (ref?.type !== 'raster' || !host.assets.bytes) throw new Error(`${String(box.id)}: IDML image export requires stored raster bytes.`);
        const bytes = await host.assets.bytes(ref), format = ref.original?.format ?? ref.format;
        const ext = ['jpg', 'jpeg', 'image/jpeg'].includes(format) ? 'jpg' : ['png', 'image/png'].includes(format) ? 'png' : '';
        const size = imageDimensions(bytes, ext === 'jpg' ? 'image/jpeg' : 'image/png');
        if (!size || !ext) throw new Error(`${String(box.id)}: use PNG or JPEG for IDML.`);
        const path = `Links/image-${++image}.${ext}`; add(path, bytes);
        const scale = box.fit === 'cover' ? Math.max(w / size.w, h / size.h) : Math.min(w / size.w, h / size.h);
        inside += `<Image Self="image-${image}" ItemTransform="${[scale, 0, 0, scale, (w - size.w * scale) / 2, (h - size.h * scale) / 2].map(number).join(' ')}"><Properties><GraphicBounds Left="0" Top="0" Right="${size.w}" Bottom="${size.h}"/></Properties><Link Self="link-${image}" LinkResourceURI="${path}" LinkResourceFormat="$ID/${ext === 'jpg' ? 'JPEG' : 'PNG'}" StoredState="Normal" LinkClassID="35906" LinkClientID="257" ShowInUI="true" CanEmbed="true" CanPackage="true" ImportPolicy="NoAutoImport" ExportPolicy="NoAutoExport"/></Image>`;
        notes.push(`${String(box.id)}: image bytes are bundled in Links; InDesign may ask to relink that folder.`);
      }
      const fill = await paint(box.bg), stroke = num(box.strokeW) ? await paint(box.stroke) : 'Swatch/None';
      const points = pathPoints(w, h, tag === 'Oval');
      body += `<${tag} Self="item-${++item}" Name="${esc(String(box.name || box.id || 'Layer'))}" ItemLayer="layer-1" Visible="true" ContentType="${kind === 'text' ? 'TextType' : kind === 'image' ? 'GraphicType' : 'Unassigned'}" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="${transform}" FillColor="${fill}" StrokeColor="${stroke}" StrokeWeight="${number(num(box.strokeW))}"${extra}><Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>${points}</PathPointArray></GeometryPathType></PathGeometry></Properties>${inside}</${tag}>`;
    }
    const path = `Spreads/Spread_${pageIndex + 1}.xml`; spreadRefs.push(path);
    add(path, wrap('Spread', `<Spread Self="spread-${pageIndex + 1}" PageCount="1" BindingLocation="0" ItemTransform="1 0 0 1 0 0"><Page Self="page-${pageIndex + 1}" Name="${pageIndex + 1}" AppliedMaster="n" GeometricBounds="0 0 ${number(height)} ${number(width)}" ItemTransform="1 0 0 1 0 0"/>${body}</Spread>`));
  }
  add('Resources/Graphic.xml', wrap('Graphic', `<Swatch Self="Swatch/None" Name="$ID/None"/>${[...colors].map(([rgb, id]) => `<Color Self="${id}" Name="${id}" Model="Process" Space="RGB" ColorValue="${rgb}"/>`).join('')}`));
  add('Resources/Styles.xml', wrap('Styles', '<RootParagraphStyleGroup><ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]"/></RootParagraphStyleGroup><RootCharacterStyleGroup><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/></RootCharacterStyleGroup><RootObjectStyleGroup><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]"/></RootObjectStyleGroup>'));
  add('Resources/Preferences.xml', wrap('Preferences', `<DocumentPreference PageWidth="${number(num(pages[0]?.w, 1920))}" PageHeight="${number(num(pages[0]?.h, 1080))}" FacingPages="false"/>`));
  add('designmap.xml', xml(`<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="16.0(0)"?><Document xmlns:idPkg="${ns}" DOMVersion="16.0" Self="lolly-document" Name="Lolly.indd" ActiveLayer="layer-1" ZeroPoint="0 0" StoryList="${Array.from({ length: story }, (_, i) => `story-${i + 1}`).join(' ')}"><idPkg:Graphic src="Resources/Graphic.xml"/><idPkg:Styles src="Resources/Styles.xml"/><idPkg:Preferences src="Resources/Preferences.xml"/><Layer Self="layer-1" Name="Lolly" Visible="true" Locked="false" Printable="true"/>${spreadRefs.map(p => `<idPkg:Spread src="${p}"/>`).join('')}${storyRefs.map(p => `<idPkg:Story src="${p}"/>`).join('')}</Document>`));
  const report = [...new Set(notes)]; host.log('warn', report.join(' '));
  add('lolly-interchange.json', JSON.stringify({ format: 'idml', subset: 'static-text-shape-raster', notes: report }));
  if (opts.rights) for (const file of attributionCompanion(opts.rights.plan).files) add(file.name, file.text);
  if (opts.meta) add('lolly-metadata.json', JSON.stringify(opts.meta));
  const bytes = storeZip(entries, { mimetypeFirst: true });
  if (opts.rights?.onReceipt) opts.rights.onReceipt(await checkCompanionReadback(bytes, opts.rights.plan, opts.rights.fingerprint));
  return new Blob([bytes as BlobPart], { type: 'application/vnd.adobe.indesign-idml-package' });
}
