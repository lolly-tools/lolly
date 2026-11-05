// SPDX-License-Identifier: MPL-2.0
/** Explicit Camera Raw settings mapped to Darkroom's existing input values. */
import { readAdobeXml, type AdobeXmlParser } from './adobe-xml.ts';

const CRS = 'http://ns.adobe.com/camera-raw-settings/1.0/';
export interface CameraRawPreset {
  name: string; processVersion?: string; values: Record<string, number | boolean>;
  unmapped: string[]; notes: string[]; approximate: true;
}
const metadata = new Set(['Name', 'ShortName', 'UUID', 'ProcessVersion', 'Version', 'PresetType', 'SupportsAmount', 'SupportsColor', 'SupportsMonochrome', 'SupportsHighDynamicRange', 'SupportsNormalDynamicRange', 'SupportsSceneReferred', 'SupportsOutputReferred', 'CameraModelRestriction', 'AlreadyApplied', 'HasSettings', 'AsShotTemperature', 'AsShotTint']);
/** Settings that mapWhiteBalance, the grayscale flag or the vignette reader consume themselves. */
const handled = new Set(['Temperature', 'Tint', 'WhiteBalance', 'ConvertToGrayscale', 'PostCropVignetteAmount']);
function number(key: string, raw: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) || !Number.isFinite(Number(raw))) throw new Error(`Invalid Camera Raw number: ${key}`);
  return Number(raw);
}
const mappings: Record<string, { id: string; lo: number; hi: number; offset?: number; scale?: number }> = {
  Exposure2012: { id: 'exposure', lo: -3, hi: 3 }, Contrast2012: { id: 'contrast', lo: -100, hi: 100 },
  Highlights2012: { id: 'highlights', lo: -100, hi: 100 }, Shadows2012: { id: 'shadows', lo: -100, hi: 100 },
  Saturation: { id: 'saturation', lo: 0, hi: 200, offset: 100 }, Vibrance: { id: 'vibrance', lo: -100, hi: 100 },
  Dehaze: { id: 'dehaze', lo: -100, hi: 100 },
  // Relative white balance: the scale Darkroom's own sliders use.
  IncrementalTemperature: { id: 'temperature', lo: -100, hi: 100 }, IncrementalTint: { id: 'tint', lo: -100, hi: 100 },
  // Adobe's Sharpness runs 0 to 150 and Darkroom's sharpen 0 to 100.
  Sharpness: { id: 'sharpen', lo: 0, hi: 100, scale: 100 / 150 },
  GrainAmount: { id: 'grain', lo: 0, hi: 100 },
  // Adobe's grain size runs 0 to 100 and Darkroom's 1 to 4 pixels.
  GrainSize: { id: 'grainSize', lo: 1, hi: 4, scale: 0.03, offset: 1 },
};
// Adobe names eight colour families and Darkroom's mixer uses the same eight, in the same words.
for (const band of ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta']) {
  mappings[`HueAdjustment${band}`] = { id: `hslHue${band}`, lo: -100, hi: 100 };
  mappings[`SaturationAdjustment${band}`] = { id: `hslSat${band}`, lo: -100, hi: 100 };
  mappings[`LuminanceAdjustment${band}`] = { id: `hslLum${band}`, lo: -100, hi: 100 };
}
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
  const notes = ['Imported settings approximate an Adobe look using Darkroom controls.'], values: Record<string, number | boolean> = {}, unmapped: string[] = [];
  for (const [key, raw] of settings) {
    const m = mappings[key];
    if (!m) { if (!metadata.has(key) && !handled.has(key)) unmapped.push(key); continue; }
    number(key, raw);
    const value = Number(raw) * (m.scale ?? 1) + (m.offset ?? 0), clipped = Math.max(m.lo, Math.min(m.hi, value));
    if (value !== clipped) notes.push(`${key} was clamped to Darkroom's range.`);
    values[m.id] = clipped;
  }
  mapWhiteBalance(settings, values, unmapped, notes);
  const gray = settings.get('ConvertToGrayscale');
  if (gray !== undefined) {
    if (!/^(true|false)$/i.test(gray)) throw new Error('Invalid Camera Raw flag: ConvertToGrayscale');
    values.bwMode = /^true$/i.test(gray);
  }
  const vignette = settings.get('PostCropVignetteAmount');
  if (vignette !== undefined) {
    const v = number('PostCropVignetteAmount', vignette);
    // Darkroom's vignette only darkens; a lightening (positive) vignette has no equivalent.
    if (v > 0) unmapped.push('PostCropVignetteAmount'); else values.vignette = Math.min(100, -v);
  }
  const order = Array.from(settings.keys());
  unmapped.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (/^true$/i.test(settings.get('AlreadyApplied') ?? '')) notes.push('AlreadyApplied marks the source image; importing the preset still applies the explicitly listed controls.');
  const processVersion = settings.get('ProcessVersion');
  if (processVersion) notes.push(`Adobe process ${processVersion} is not reproduced by Darkroom.`);
  if (unmapped.length) notes.push(`Unmapped settings: ${unmapped.join(', ')}.`);
  return { name: settings.get('Name') || settings.get('ShortName') || 'Camera Raw preset', ...(processVersion ? { processVersion } : {}), values, unmapped, notes, approximate: true };
}

/**
 * Adobe writes Temperature in Kelvin and Tint on a -150 to 150 scale. Darkroom's sliders are relative (-100 to 100),
 * so a Kelvin value only means something against the as-shot white stored with the preset. The shift is the mired
 * difference on Darkroom's own scale (0.8 mired per step around 6500 K, the scale lightcraft documents). With no
 * as-shot reference the Kelvin value is reported as unmapped rather than guessed.
 */
function mapWhiteBalance(settings: Map<string, string>, values: Record<string, number | boolean>, unmapped: string[], notes: string[]): void {
  const mode = settings.get('WhiteBalance');
  if (mode !== undefined && !/^(as shot|custom)$/i.test(mode)) unmapped.push('WhiteBalance');
  const temperature = settings.get('Temperature'), tint = settings.get('Tint'), asShotT = settings.get('AsShotTemperature'), asShotTint = settings.get('AsShotTint');
  const relative = values.temperature !== undefined || values.tint !== undefined;
  if (temperature !== undefined) {
    const kelvin = number('Temperature', temperature);
    if (relative) unmapped.push('Temperature');
    else if (asShotT === undefined || kelvin <= 0 || number('AsShotTemperature', asShotT) <= 0) unmapped.push('Temperature');
    else {
      const shift = (1e6 / number('AsShotTemperature', asShotT) - 1e6 / kelvin) / 0.8, clipped = Math.max(-100, Math.min(100, shift));
      if (shift !== clipped) notes.push("Temperature was clamped to Darkroom's range.");
      values.temperature = Math.round(clipped * 100) / 100;
    }
  }
  if (tint !== undefined) {
    const raw = number('Tint', tint);
    if (relative || asShotTint === undefined) unmapped.push('Tint');
    else {
      const shift = (raw - number('AsShotTint', asShotTint)) * (100 / 150), clipped = Math.max(-100, Math.min(100, shift));
      if (shift !== clipped) notes.push("Tint was clamped to Darkroom's range.");
      values.tint = Math.round(clipped * 100) / 100;
    }
  }
}
