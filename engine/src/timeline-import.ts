// SPDX-License-Identifier: MPL-2.0
/** One entry point for every timeline interchange text format Sequence can open. */
import type { AdobeXmlParser } from './adobe-xml.ts';
import type { InterchangeRate, InterchangeSequence } from './premiere-xml.ts';
import { readPremiereXml } from './premiere-xml.ts';
import { readEdl } from './timeline-edl.ts';
import { readFcpxml } from './timeline-fcpxml.ts';
import { readOtio } from './timeline-otio.ts';

export type TimelineFormat = 'xmeml' | 'fcpxml' | 'otio' | 'edl';
/** Name the format from content, never from the file name. Returns null for anything else. */
export function detectTimelineFormat(text: string): TimelineFormat | null {
  const head = text.replace(/^\uFEFF/, '').slice(0, 4096);
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE\s+xmeml\s*>\s*)?<xmeml[\s>]/i.test(head)) return 'xmeml';
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE\s+fcpxml\s*>\s*)?<fcpxml[\s>]/i.test(head)) return 'fcpxml';
  if (/^\s*\{/.test(head) && /"OTIO_SCHEMA"\s*:\s*"(?:Timeline|Stack)\.\d+"/.test(text.slice(0, 65536))) return 'otio';
  if (/^\s*(?:TITLE:|FCM:|\d{1,6}\s+\S+\s+\S+\s+\S+\s)/m.test(head) && /^\s*\d{1,6}\s+\S+\s+\S+\s+\S+.*\d:\d\d:\d\d[:;.,]\d\d/m.test(text.slice(0, 65536))) return 'edl';
  return null;
}
export interface TimelineReadOptions { parse?: AdobeXmlParser; rate?: InterchangeRate; width?: number; height?: number }
/** Read any supported timeline. XML formats need the shell's parser. */
export function readTimeline(text: string, options: TimelineReadOptions = {}): { format: TimelineFormat; sequence: InterchangeSequence } {
  const format = detectTimelineFormat(text);
  if (!format) throw new Error('This is not a timeline Lolly can read. Use Final Cut Pro 7 XML, FCPXML 1.8 to 1.11, OpenTimelineIO JSON or a CMX 3600 EDL.');
  if ((format === 'xmeml' || format === 'fcpxml') && !options.parse) throw new Error('An XML parser is required to read this timeline.');
  if (format === 'xmeml') return { format, sequence: readPremiereXml(text, options.parse!) };
  if (format === 'fcpxml') return { format, sequence: readFcpxml(text, options.parse!) };
  if (format === 'otio') return { format, sequence: readOtio(text, options) };
  return { format, sequence: readEdl(text, options) };
}
