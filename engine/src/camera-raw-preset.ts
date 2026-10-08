// SPDX-License-Identifier: MPL-2.0
/** Explicit Camera Raw settings mapped to Darkroom's existing input values. */
import { readAdobeXml, type AdobeXmlParser } from './adobe-xml.ts';

const CRS = 'http://ns.adobe.com/camera-raw-settings/1.0/';
export interface CameraRawPreset {
  name: string; processVersion?: string; values: Record<string, number>;
  unmapped: string[]; notes: string[]; approximate: true;
}
const metadata = new Set(['Name', 'ShortName', 'UUID', 'ProcessVersion', 'Version', 'PresetType', 'SupportsAmount', 'SupportsColor', 'SupportsMonochrome', 'SupportsHighDynamicRange', 'SupportsNormalDynamicRange', 'SupportsSceneReferred', 'SupportsOutputReferred', 'CameraModelRestriction', 'AlreadyApplied', 'HasSettings']);
const mappings: Record<string, { id: string; lo: number; hi: number; offset?: number }> = {
  Exposure2012: { id: 'exposure', lo: -3, hi: 3 }, Contrast2012: { id: 'contrast', lo: -100, hi: 100 },
  Highlights2012: { id: 'highlights', lo: -100, hi: 100 }, Shadows2012: { id: 'shadows', lo: -100, hi: 100 },
  Saturation: { id: 'saturation', lo: 0, hi: 200, offset: 100 }, Vibrance: { id: 'vibrance', lo: -100, hi: 100 },
  Dehaze: { id: 'dehaze', lo: -100, hi: 100 },
};
/** Only explicitly present controls are mapped; Adobe's renderer remains different. */
export function readCameraRawPreset(source: string, parse: AdobeXmlParser): CameraRawPreset {
  if (!source.trimStart().startsWith('<')) throw new Error('Legacy .lrtemplate presets are unsupported. Export the preset as XMP; Lua is never executed.');
  const doc = readAdobeXml(source, parse), settings = new Map<string, string>();
  for (const el of [doc.documentElement, ...Array.from(doc.documentElement.getElementsByTagName('*'))]) {
    for (const attr of Array.from(el.attributes)) if (attr.namespaceURI === CRS) {
      if (settings.has(attr.localName)) throw new Error(`Repeated Camera Raw setting: ${attr.localName}`);
      settings.set(attr.localName, attr.value.trim());
    }
    if (el.namespaceURI === CRS) {
      if (settings.has(el.localName)) throw new Error(`Repeated Camera Raw setting: ${el.localName}`);
      settings.set(el.localName, (el.textContent ?? '').trim());
    }
  }
  if (!settings.size) throw new Error('This XMP contains no Camera Raw settings.');
  const notes = ['Imported settings approximate an Adobe look using Darkroom controls.'], values: Record<string, number> = {}, unmapped: string[] = [];
  for (const [key, raw] of settings) {
    const m = mappings[key];
    if (!m) { if (!metadata.has(key)) unmapped.push(key); continue; }
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) throw new Error(`Invalid Camera Raw number: ${key}`);
    const value = Number(raw) + (m.offset ?? 0), clipped = Math.max(m.lo, Math.min(m.hi, value));
    if (value !== clipped) notes.push(`${key} was clamped to Darkroom's range.`);
    values[m.id] = clipped;
  }
  if (/^true$/i.test(settings.get('AlreadyApplied') ?? '')) notes.push('AlreadyApplied marks the source image; importing the preset still applies the explicitly listed controls.');
  const processVersion = settings.get('ProcessVersion');
  if (processVersion) notes.push(`Adobe process ${processVersion} is not reproduced by Darkroom.`);
  if (unmapped.length) notes.push(`Unmapped settings: ${unmapped.join(', ')}.`);
  return { name: settings.get('Name') || settings.get('ShortName') || 'Camera Raw preset', ...(processVersion ? { processVersion } : {}), values, unmapped, notes, approximate: true };
}
