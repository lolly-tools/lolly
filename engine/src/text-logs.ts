// SPDX-License-Identifier: MPL-2.0
/** Log text retains source offsets even when an event cannot be classified. */
export interface TextLogEvent {
  id: number;
  line: number;
  lastLine: number;
  start: number;
  end: number;
  timestamp: string;
  severity: string;
  source: string;
  message: string;
  fields: Record<string, unknown>;
  raw: string;
}
export interface TextLogReport {
  events: TextLogEvent[];
  counts: Record<string, number>;
  sources: string[];
}
export const LOG_MAX_BYTES = 4 * 1024 * 1024;
const PRIORITIES = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'notice',
  'info',
  'debug',
];
const PREFIX =
  /^(?:(?<time>\d{4}-\d\d-\d\d[T ][\d:.]+(?:Z|[+-]\d\d:?\d\d)?|[A-Z][a-z]{2}\s+\d{1,2}\s+\d\d:\d\d:\d\d)\s+)?(?:\[(?<level1>TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\]|(?<level2>TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b)[:\s-]*/i;
function level(value: unknown): string {
  if (typeof value === 'number' || /^\d$/.test(String(value)))
    return PRIORITIES[Number(value)] ?? 'unclassified';
  const s = String(value ?? '').toLowerCase();
  return (
    (
      { warn: 'warning', fatal: 'critical', err: 'error', information: 'info' } as Record<
        string,
        string
      >
    )[s] ?? (PRIORITIES.includes(s) || s === 'trace' ? s : 'unclassified')
  );
}
function stringField(fields: Record<string, unknown>, names: string[]): string {
  for (const name of names)
    if (typeof fields[name] === 'string' || typeof fields[name] === 'number')
      return String(fields[name]);
  return '';
}
export function parseTextLogs(text: string): TextLogReport {
  if (new TextEncoder().encode(text).length > LOG_MAX_BYTES)
    throw new Error('Open a log excerpt of 4 MiB or less.');
  const events: TextLogEvent[] = [];
  let at = 0,
    line = 0;
  for (const match of text.matchAll(/[^\n]*\n|[^\n]+$/g)) {
    const raw = match[0];
    line++;
    const body = raw.replace(/\r?\n$/, '');
    const last = events[events.length - 1];
    if (
      last &&
      (/^\s+(?:at\s|File\s|\S)/.test(body) ||
        /^(?:Caused by:|During handling|Traceback|\.{3} \d+ more)/.test(body))
    ) {
      last.raw += raw;
      last.message += `\n${body}`;
      last.end += raw.length;
      last.lastLine = line;
      at += raw.length;
      continue;
    }
    let fields: Record<string, unknown> = {};
    if (body.trimStart().startsWith('{')) {
      try {
        const v: unknown = JSON.parse(body);
        if (v && typeof v === 'object' && !Array.isArray(v)) fields = v as Record<string, unknown>;
      } catch {
        /* Keep malformed input as raw text. */
      }
    }
    const priority = /^<(\d{1,3})>/.exec(body);
    const content = priority ? body.slice(priority[0].length) : body;
    const prefix = PREFIX.exec(content);
    const journalTime =
      typeof fields.__REALTIME_TIMESTAMP === 'string' && /^\d+$/.test(fields.__REALTIME_TIMESTAMP)
        ? Number(fields.__REALTIME_TIMESTAMP) / 1000
        : NaN;
    const journalIso =
      Number.isFinite(journalTime) && Number.isFinite(new Date(journalTime).getTime())
        ? new Date(journalTime).toISOString()
        : '';
    const time =
      /^(?:\[)?(\d{4}-\d\d-\d\d[T ][\d:.]+(?:Z|[+-]\d\d:?\d\d)?|[A-Z][a-z]{2}\s+\d{1,2}\s+\d\d:\d\d:\d\d)/.exec(
        content
      );
    const syslog =
      /^(?:[A-Z][a-z]{2}\s+\d{1,2}\s+[\d:]+|\d{4}-\d\d-\d\d[T ][\d:.Z+-]+)\s+\S+\s+([^ :]+)(?:\[\d+\])?:\s*(.*)$/.exec(
        content
      );
    events.push({
      id: line,
      line,
      lastLine: line,
      start: at,
      end: at + raw.length,
      raw,
      fields,
      timestamp:
        journalIso ||
        stringField(fields, ['timestamp', 'time', '@timestamp']) ||
        prefix?.groups?.time ||
        time?.[1] ||
        '',
      severity: level(
        fields.level ??
          fields.severity ??
          fields.PRIORITY ??
          (priority ? Number(priority[1]) % 8 : undefined) ??
          prefix?.groups?.level1 ??
          prefix?.groups?.level2
      ),
      source:
        stringField(fields, [
          'service',
          'source',
          'logger',
          '_SYSTEMD_UNIT',
          'SYSLOG_IDENTIFIER',
          '_COMM',
        ]) ||
        syslog?.[1] ||
        '',
      message:
        stringField(fields, ['message', 'msg', 'MESSAGE']) ||
        syslog?.[2] ||
        content.slice(prefix?.[0].length ?? 0),
    });
    at += raw.length;
    if (events.length > 50_000) throw new Error('Open a log excerpt with 50,000 events or fewer.');
  }
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.severity] = (counts[event.severity] ?? 0) + 1;
  return {
    events,
    counts,
    sources: [...new Set(events.map((e) => e.source).filter(Boolean))].sort(),
  };
}
export interface LogFilter {
  query?: string;
  severity?: string;
  source?: string;
  from?: string;
  until?: string;
  exact?: boolean;
}
export function filterTextLogs(events: TextLogEvent[], filter: LogFilter): TextLogEvent[] {
  const query = filter.query?.toLowerCase() ?? '';
  if (
    (filter.from && !Number.isFinite(Date.parse(filter.from))) ||
    (filter.until && !Number.isFinite(Date.parse(filter.until)))
  )
    throw new Error('Enter valid ISO dates for the time range.');
  if (filter.from && filter.until && Date.parse(filter.from) > Date.parse(filter.until))
    throw new Error('The end of the time range must follow its start.');
  return events.filter((e) => {
    if (
      filter.severity === 'important' &&
      !['emergency', 'alert', 'critical', 'error', 'warning'].includes(e.severity)
    )
      return false;
    if (
      filter.severity &&
      filter.severity !== 'all' &&
      filter.severity !== 'important' &&
      e.severity !== filter.severity
    )
      return false;
    if (filter.source && e.source !== filter.source) return false;
    if (
      query &&
      !(filter.exact ? e.message.toLowerCase() === query : e.raw.toLowerCase().includes(query))
    )
      return false;
    if (filter.from || filter.until) {
      const time = /^\d{4}-\d\d-\d\d[T ]/.test(e.timestamp) ? Date.parse(e.timestamp) : NaN;
      if (!Number.isFinite(time)) return false;
      if (filter.from && time < Date.parse(filter.from)) return false;
      if (filter.until && time > Date.parse(filter.until)) return false;
    }
    return true;
  });
}
export function groupTextLogs(events: TextLogEvent[]): TextLogEvent[][] {
  const groups: TextLogEvent[][] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    const first = last?.[0];
    if (
      first &&
      last!.at(-1)!.lastLine + 1 === event.line &&
      first.message === event.message &&
      first.source === event.source &&
      first.severity === event.severity
    )
      last!.push(event);
    else groups.push([event]);
  }
  return groups;
}
