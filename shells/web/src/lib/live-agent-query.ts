// SPDX-License-Identifier: MPL-2.0

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Bounded, explicit queries over the editor's admitted rows. */
export function queryLiveRows(rows: unknown[], params: Record<string, unknown>, selection: readonly string[], find = false): { rows: unknown[]; total: number; nextOffset?: number } {
  const allowed = ['documentId', 'ids', 'artboardId', 'selection', 'fields', 'limit', 'offset', ...(find ? ['query', 'kind'] : [])];
  const extra = Object.keys(params).find(key => !allowed.includes(key));
  if (extra) throw new Error(`Unknown field "${extra}".`);
  for (const key of ['query', 'kind', 'artboardId']) if (params[key] !== undefined && (typeof params[key] !== 'string' || params[key].length > 256)) throw new Error(`${key} must be a string of at most 256 characters.`);
  for (const key of ['ids', 'fields']) if (params[key] !== undefined && (!Array.isArray(params[key]) || params[key].length > 100 || params[key].some(value => typeof value !== 'string' || value.length > 256))) throw new Error(`${key} must contain at most 100 strings.`);
  if (params.selection !== undefined && typeof params.selection !== 'boolean') throw new Error('selection must be a boolean.');
  for (const key of ['limit', 'offset']) if (params[key] !== undefined && (!Number.isSafeInteger(params[key]) || Number(params[key]) < (key === 'limit' ? 1 : 0))) throw new Error(`${key} must be a positive integer${key === 'offset' ? ' or zero' : ''}.`);
  if (Number(params.limit) > 500) throw new Error('limit cannot exceed 500.');
  const ids = Array.isArray(params.ids) ? new Set(params.ids) : null;
  const selected = new Set(selection);
  const query = typeof params.query === 'string' ? params.query.toLocaleLowerCase() : '';
  const matches = rows.filter(raw => {
    const row = record(raw);
    return (!ids || ids.has(row.id)) && (!params.selection || selected.has(String(row.id)))
      && (params.artboardId === undefined || row.frame === params.artboardId || row.id === params.artboardId)
      && (params.kind === undefined || row.kind === params.kind)
      && (!query || ['id', 'name', 'text'].some(key => typeof row[key] === 'string' && row[key].toLocaleLowerCase().includes(query)));
  });
  const offset = Number(params.offset) || 0;
  const limit = Number(params.limit) || (find ? 50 : matches.length);
  const fields = Array.isArray(params.fields) ? ['id', ...params.fields.filter(field => field !== 'id')] : null;
  const page = matches.slice(offset, offset + limit).map(raw => {
    const row = record(raw);
    if (fields) return Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]));
    if (!find) return raw;
    return Object.fromEntries(['id', 'kind', 'name', 'text', 'frame', 'x', 'y', 'w', 'h'].filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]]));
  });
  return { rows: page, total: matches.length, ...(offset + page.length < matches.length ? { nextOffset: offset + page.length } : {}) };
}

/** Shared by all agent connections to one mounted runtime. */
const queues = new WeakMap<object, { tail: Promise<void>; pending: number }>();
export function scheduleLive<T>(owner: object, work: () => Promise<T>): Promise<T> {
  let queue = queues.get(owner);
  if (!queue) { queue = { tail: Promise.resolve(), pending: 0 }; queues.set(owner, queue); }
  if (queue.pending >= 64) return Promise.reject(new Error('The editor already has 64 requests waiting.'));
  queue.pending++;
  const result = queue.tail.then(work);
  queue.tail = result.then(() => {}, () => {}).finally(() => { queue.pending--; });
  return result;
}

export function livePayloadKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(livePayloadKey).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${livePayloadKey(record(value)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export async function livePayloadDigest(value: unknown): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(livePayloadKey(value)));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
