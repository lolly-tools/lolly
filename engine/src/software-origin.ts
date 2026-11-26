// SPDX-License-Identifier: MPL-2.0
/** Software and rights declarations read from metadata, with their evidence kept alongside them. */
import type { MetaField } from './file-metadata.ts';
import { readXmpFields, type XmpFieldSpec } from './xmp-fields.ts';

export type SoftwareRole = 'authoring' | 'export' | 'history' | 'system';
export interface SoftwareEvidence {
  source: string;
  value: string;
  role: SoftwareRole;
  kind: 'metadata' | 'hint';
}
export interface SoftwareOrigin {
  name: string;
  role: SoftwareRole;
  evidence: SoftwareEvidence[];
}

// Specific products precede their parent brands. Unknown names in explicit
// software fields are retained, so recognition does not require a registry entry.
const SOFTWARE: Array<[string, RegExp, SoftwareRole?]> = [
  ['Affinity Publisher', /\bAffinity Publisher\b/i],
  ['Affinity Designer', /\bAffinity Designer\b/i],
  ['Affinity Photo', /\bAffinity Photo\b/i],
  ['Adobe InDesign', /\bInDesign\b/i],
  ['Adobe Illustrator', /\bIllustrator\b/i],
  ['Adobe Photoshop Lightroom', /\bLightroom\b/i],
  ['Adobe Photoshop', /\bPhotoshop\b/i],
  ['Adobe After Effects', /\bAfter Effects\b/i],
  ['Adobe Premiere Pro', /\bPremiere(?: Pro)?\b/i],
  ['Adobe Express', /\bAdobe Express\b/i],
  ['Adobe Firefly', /\bFirefly\b/i],
  ['Adobe Animate', /\bAdobe Animate\b/i],
  ['Adobe Acrobat', /\bAcrobat\b/i, 'export'],
  ['Adobe PDF Library', /\bAdobe PDF Library\b/i, 'export'],
  ['Adobe PDFL', /\bAdobe PDFL\b/i, 'export'],
  ['Affinity', /\bAffinity\b/i],
  ['Canva', /\bCanva\b/i], ['Figma', /\bFigma\b/i], ['Penpot', /\bPenpot\b/i],
  ['Sketch', /\bSketch\b/i], ['Inkscape', /\bInkscape\b/i], ['Scribus', /\bScribus\b/i],
  ['GIMP', /\bGIMP\b|GNU Image Manipulation Program/i], ['Krita', /\bKrita\b/i],
  ['CorelDRAW', /\bCorel ?DRAW\b/i], ['Corel PHOTO-PAINT', /\bPHOTO-PAINT\b/i],
  ['Corel Painter', /\bCorel Painter\b/i], ['PaintShop Pro', /\bPaintShop Pro\b/i],
  ['Clip Studio Paint', /\bCLIP STUDIO(?: PAINT)?\b/i], ['Procreate', /\bProcreate\b/i],
  ['Pixelmator', /\bPixelmator(?: Pro)?\b/i], ['Acorn', /\bAcorn\b/i],
  ['Paint.NET', /\bpaint\.net\b/i], ['Microsoft Paint', /\b(?:Microsoft Paint|mspaint)\b/i],
  ['Photopea', /\bPhotopea\b/i], ['darktable', /\bdarktable\b/i],
  ['RawTherapee', /\bRawTherapee\b/i], ['Capture One', /\bCapture One\b/i],
  ['DxO PhotoLab', /\b(?:DxO PhotoLab|DxO OpticsPro)\b/i], ['Luminar', /\bLuminar\b/i],
  ['Snapseed', /\bSnapseed\b/i], ['digiKam', /\bdigiKam\b/i],
  ['Blender', /\bBlender\b/i], ['Cinema 4D', /\bCinema ?4D\b/i],
  ['Autodesk Maya', /\b(?:Autodesk )?Maya\b/i], ['Autodesk 3ds Max', /\b3ds Max\b/i],
  ['Houdini', /\bHoudini\b/i], ['ZBrush', /\bZBrush\b/i],
  ['SketchUp', /\bSketchUp\b/i], ['AutoCAD', /\bAutoCAD\b/i],
  ['FreeCAD', /\bFreeCAD\b/i], ['Rhino', /\b(?:Rhinoceros|Rhino)\b/i],
  ['DaVinci Resolve', /\b(?:DaVinci Resolve|Blackmagic Design DaVinci)\b/i],
  ['Final Cut Pro', /\bFinal Cut(?: Pro)?\b/i], ['Apple Motion', /\bApple Motion\b/i],
  ['iMovie', /\biMovie\b/i], ['CapCut', /\bCapCut\b/i],
  ['Kdenlive', /\bKdenlive\b/i], ['Shotcut', /\bShotcut\b/i],
  ['OpenShot', /\bOpenShot\b/i], ['VEGAS Pro', /\b(?:VEGAS Pro|Sony Vegas)\b/i],
  ['Avid Media Composer', /\bAvid Media Composer\b/i], ['Nuke', /\bNuke\b/i],
  ['OBS Studio', /\bOBS(?: Studio)?\b/i], ['Camtasia', /\bCamtasia\b/i],
  ['Audacity', /\bAudacity\b/i], ['Adobe Audition', /\bAudition\b/i],
  ['Ableton Live', /\bAbleton(?: Live)?\b/i], ['Logic Pro', /\bLogic Pro\b/i],
  ['GarageBand', /\bGarageBand\b/i], ['REAPER', /\bREAPER\b/i],
  ['Pro Tools', /\bPro Tools\b/i], ['FL Studio', /\bFL Studio\b/i],
  ['MuseScore', /\bMuseScore\b/i], ['Dorico', /\bDorico\b/i],
  ['Microsoft PowerPoint', /\b(?:Microsoft(?:®|\u00ae)? )?PowerPoint\b/i],
  ['Microsoft Word', /\bMicrosoft(?:®)?(?: Office)? Word\b/i],
  ['Microsoft Publisher', /\bMicrosoft(?: Office)? Publisher\b/i],
  ['Microsoft Visio', /\bVisio\b/i], ['Keynote', /\bKeynote\b/i],
  ['Apple Pages', /\b(?:Apple )?Pages\b/i], ['LibreOffice', /\bLibreOffice\b/i],
  ['OpenOffice', /\bOpenOffice(?:\.org)?\b/i], ['QuarkXPress', /\bQuarkXPress\b/i],
  ['LaTeX', /\b(?:LuaLaTeX|XeLaTeX|pdfLaTeX|LaTeX)\b/i],
  ['Typst', /\bTypst\b/i], ['Google Slides', /\bGoogle Slides\b/i],
  ['Google Docs', /\bGoogle Docs\b/i], ['draw.io', /\b(?:draw\.io|diagrams\.net)\b/i],
  ['Lucidchart', /\bLucidchart\b/i], ['Mermaid', /\bMermaid\b/i],
  ['Matplotlib', /\bMatplotlib\b/i], ['Gnuplot', /\bGnuplot\b/i],
  ['Lolly', /\bLolly\b/i], ['Midjourney', /\bMidjourney\b/i],
  ['DALL·E', /\bDALL[·. -]?E\b/i], ['Stable Diffusion', /\bStable Diffusion\b/i],
  ['ComfyUI', /\bComfyUI\b/i], ['InvokeAI', /\bInvokeAI\b/i],
  ['NovelAI', /\bNovelAI\b/i], ['Gemini', /\bGemini\b/i], ['Imagen', /\bImagen\b/i],
  ['iLovePDF', /\biLovePDF\b/i, 'export'], ['Smallpdf', /\bSmallpdf\b/i, 'export'],
  ['Ghostscript', /\bGhostscript\b/i, 'export'], ['Cairo', /\bcairo\b/i, 'export'],
  ['Quartz', /\bQuartz\b/i, 'export'], ['Skia', /\bSkia(?:\/PDF)?\b/i, 'export'],
  ['pdf-lib', /\bpdf-lib\b/i, 'export'], ['jsPDF', /\bjsPDF\b/i, 'export'],
  ['PDFKit', /\bPDFKit\b/i, 'export'], ['ReportLab', /\bReportLab\b/i, 'export'],
  ['iText', /\biText(?:Sharp)?\b/i, 'export'], ['TCPDF', /\bTCPDF\b/i, 'export'],
  ['wkhtmltopdf', /\bwkhtmltopdf\b/i, 'export'], ['WeasyPrint', /\bWeasyPrint\b/i, 'export'],
  ['Prince', /\bPrince\b/i, 'export'], ['pdfTeX', /\bpdfTeX\b/i, 'export'],
  ['ImageMagick', /\bImageMagick\b/i, 'export'], ['GraphicsMagick', /\bGraphicsMagick\b/i, 'export'],
  ['FFmpeg', /\bFFmpeg\b|\bLav[fc](?=\d|\b)/i, 'export'], ['HandBrake', /\bHandBrake\b/i, 'export'],
  ['GStreamer', /\bGStreamer\b/i, 'export'], ['LAME', /\bLAME\b/i, 'export'],
  ['XMP Core', /\b(?:Adobe )?XMP Core\b|\bAdobe XMP Core\b/i, 'export'],
  ['iPadOS', /\biPadOS\b/i, 'system'], ['iOS', /\biOS\b/i, 'system'],
  ['macOS', /\b(?:macOS|Mac OS X)\b/i, 'system'], ['Android', /\bAndroid\b/i, 'system'],
  ['Windows', /\bWindows\b/i, 'system'],
];

const tidy = (value: string): string => value.slice(0, 2048).replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 2048);
const matchSoftware = (value: string) => SOFTWARE.find(([, pattern]) => pattern.test(value));

export function softwareName(value: string): string {
  const clean = tidy(value);
  return matchSoftware(clean)?.[0] ?? clean;
}

/** Explicit software fields accept any app; free text needs an authoring statement. */
export function softwareOrigins(fields: readonly MetaField[]): SoftwareOrigin[] {
  const apps = new Map<string, SoftwareOrigin>();
  for (const field of fields.slice(0, 128)) {
    const value = tidy(field.value);
    if (!value || /^(?:unknown|none|null|n\/a|unspecified|compressed text chunk)$/i.test(value)) continue;
    const versionOnly = /^v?\d+(?:\.\d+)*(?:\s*\([\w.-]+\))?$/i.test(value);
    const camera = fields.find((f) => f.group === 'device' && /camera|model|device/i.test(f.label))?.value ?? '';
    const system = versionOnly && /^(software|created with)$/i.test(field.label)
      ? /\biPad\b/i.test(camera) ? 'iPadOS' : /\biPhone\b|\biPod\b/i.test(camera) ? 'iOS' : undefined : undefined;
    if (versionOnly && !system) continue;
    const explicit = field.group === 'software' && /software|created with|creator.?tool|producer|encoder|encoded|writing app|muxing app|generator|toolkit/i.test(field.label);
    const statement = /(?:^|[\n.;])\s*(?:created|made|generated|exported|saved|rendered|written|encoded)\s+(?:with|by|using|in)\s+(.+)/i.exec(field.value);
    const comment = /comment|description/i.test(field.label) && statement ? matchSoftware(statement[1]!) : undefined;
    if (!explicit && !comment) continue;
    const known = comment ?? matchSoftware(value);
    const name = system ? `${system} ${value}` : known?.[0] ?? value;
    const kind = field.signal === 'hint' || !explicit ? 'hint' : 'metadata';
    const role: SoftwareRole = system ? 'system' : /history/i.test(field.label) ? 'history'
      : known?.[2] ?? (/producer|encoder|encoded|writing app|muxing app|toolkit/i.test(field.label) ? 'export' : 'authoring');
    const key = name.toLowerCase();
    const app = apps.get(key) ?? { name, role, evidence: [] };
    if (role === 'authoring' || (role === 'export' && app.role === 'history')) app.role = role;
    const source = field.source ?? field.label;
    if (!app.evidence.some((e) => e.source === source && e.value === value)) app.evidence.push({ source, value, role, kind });
    apps.set(key, app);
  }
  const order: Record<SoftwareRole, number> = { authoring: 0, export: 1, history: 2, system: 3 };
  return [...apps.values()].sort((a, b) => order[a.role] - order[b.role]);
}

/** XMP/RDF authoring, editing history and rights declarations, including attribute forms. */
export function xmlProvenanceFields(input: string): MetaField[] {
  const specs: XmpFieldSpec[] = [
    ['x', 'adobe:ns:meta/', 'xmptk', 'software', 'Metadata toolkit'],
    ['xmp', 'http://ns.adobe.com/xap/1.0/', 'CreatorTool', 'software', 'Created with'],
    ['pdf', 'http://ns.adobe.com/pdf/1.3/', 'Producer', 'software', 'PDF producer'],
    ['tiff', 'http://ns.adobe.com/tiff/1.0/', 'Software', 'software', 'Software'],
    ['stEvt', 'http://ns.adobe.com/xap/1.0/sType/ResourceEvent#', 'softwareAgent', 'software', 'Software history'],
    ['dc', 'http://purl.org/dc/elements/1.1/', 'rights', 'authorship', 'Rights'],
    ['xmpRights', 'http://ns.adobe.com/xap/1.0/rights/', 'UsageTerms', 'authorship', 'Usage terms'],
    ['xmpRights', 'http://ns.adobe.com/xap/1.0/rights/', 'WebStatement', 'authorship', 'Rights statement'],
    ['cc', 'http://creativecommons.org/ns#', 'license', 'authorship', 'Licence'],
    // The namespace Creative Commons used before 2008; older Inkscape files carry this form.
    ['cc', 'http://web.resource.org/cc/', 'license', 'authorship', 'Licence'],
    // A flag and a contact address, not licence statements: each keeps a label of its own.
    ['xmpRights', 'http://ns.adobe.com/xap/1.0/rights/', 'Marked', 'authorship', 'Rights marked'],
    ['plus', 'http://ns.useplus.org/ldf/xmp/1.0/', 'LicensorURL', 'authorship', 'Licensor URL'],
    ['dc', 'http://purl.org/dc/elements/1.1/', 'source', 'description', 'Source'],
    ['dc', 'http://purl.org/dc/elements/1.1/', 'relation', 'description', 'Related resource'],
    ['cc', 'http://creativecommons.org/ns#', 'attributionName', 'authorship', 'Attribution name'],
    ['cc', 'http://creativecommons.org/ns#', 'attributionURL', 'authorship', 'Attribution URL'],
    ['dc', 'http://purl.org/dc/elements/1.1/', 'creator', 'authorship', 'Creator'],
    ['Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'CiEmailWork', 'authorship', 'Contact email'],
    ['Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'CiTelWork', 'authorship', 'Contact phone'],
    ['Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'CiUrlWork', 'authorship', 'Contact website'],
    ['Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'CiAdrExtadr', 'authorship', 'Contact address'],
    ['Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'CiAdrCity', 'authorship', 'Contact city'],
    ['Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'CiAdrCtry', 'authorship', 'Contact country'],
    ['xmp', 'http://ns.adobe.com/xap/1.0/', 'CreateDate', 'timestamps', 'Created'],
    ['xmp', 'http://ns.adobe.com/xap/1.0/', 'ModifyDate', 'timestamps', 'Modified'],
  ];
  return readXmpFields(input, specs);
}
