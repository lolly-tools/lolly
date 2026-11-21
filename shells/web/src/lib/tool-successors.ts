// SPDX-License-Identifier: MPL-2.0
/**
 * Where a retired tool's work continues. A retired tool keeps its id and keeps opening
 * (a tool id is a permanent contract), and its manifest gives its successor in
 * `replacedBy`. This module answers the address of that successor, with what the person
 * had in the old tool carried across where the two tools' inputs can be matched.
 *
 * A tool with no entry here opens its successor at the successor's own start.
 */

type Values = Record<string, unknown>;
type Carry = (values: Values) => Values;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Meeting Planner into Timezone: each teammate becomes a place labelled with their
 * name, the host city leads the list and is the clock the meeting time is read on,
 * and the early and late hours stay marked, as Meeting Planner always drew them.
 * Pure, exported for tests.
 */
export function meetingPlannerToTimezone(values: Values): Values {
  const host = text(values.city);
  const people = (Array.isArray(values.people) ? values.people : [])
    .map((row) => ({ label: text((row as Values | null)?.name), place: text((row as Values | null)?.city) }))
    .filter((row) => row.place);
  const locations = [
    ...(host && !people.some((row) => row.place.toLowerCase() === host.toLowerCase()) ? [{ label: '', place: host }] : []),
    ...people,
  ];
  const when = text(values.meetingTime);
  const live = values.liveClock === true || values.liveClock === 'true';
  return {
    ...(locations.length ? { locations } : {}),
    ...(text(values.eventName) ? { heading: text(values.eventName) } : {}),
    ...(when && !live ? { timeMode: 'fixed', eventTime: when } : {}),
    ...(host ? { referenceZone: host } : {}),
    showHourQuality: true,
    ...(typeof values.showNight === 'boolean' ? { showNight: values.showNight } : {}),
    ...(typeof values.showBorders === 'boolean' ? { showBorders: values.showBorders } : {}),
    ...(typeof values.showGraticule === 'boolean' ? { showGrid: values.showGraticule } : {}),
  };
}

const CARRY: Record<string, Carry> = {
  'meeting-planner': meetingPlannerToTimezone,
};

/** The successor's address for a document open in the retired tool `from`. Lists and
 *  tables travel as JSON, which every tool link accepts. */
export function successorHref(from: string, to: string, values: Values): string {
  const carried = CARRY[from]?.(values) ?? {};
  const params = new URLSearchParams();
  for (const [id, value] of Object.entries(carried)) {
    params.set(id, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));
  }
  const query = params.toString();
  return `#/tool/${encodeURIComponent(to)}${query ? `?${query}` : ''}`;
}
