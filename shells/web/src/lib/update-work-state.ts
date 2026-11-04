// SPDX-License-Identifier: MPL-2.0
export interface UpdateDocument {
  unsaved(): boolean;
  choose?(): Promise<boolean>;
  saveFailed?(): boolean;
  recover?(): Promise<void>;
  busy(): boolean;
  save(): Promise<boolean>;
  discard(): Promise<void>;
  flush(): Promise<boolean>;
}
export const documents = new Set<UpdateDocument>();
const pending = new Set<Promise<unknown>>();
const failures = new Map<string, number>();
const generations = new Map<string, number>();
let activeWork = 0;
let writesLocked = false;
export const updateWritesLocked = (): boolean => writesLocked;
export const lockUpdateWrites = (locked: boolean): void => { writesLocked = locked; };
export const hasActiveUpdateWork = (): boolean => activeWork > 0;

export function registerUpdateDocument(doc: UpdateDocument): () => void { documents.add(doc); return () => { documents.delete(doc); }; }
export function holdUpdateWork(): () => void {
  activeWork++;
  let done = false;
  return () => { if (!done) { done = true; activeWork--; } };
}
export async function trackUpdateWrite<T>(key: string, operation: Promise<T> | (() => Promise<T>)): Promise<T> {
  if (writesLocked && typeof operation === 'function') throw new Error('Update installation is in progress');
  const write = typeof operation === 'function' ? operation() : operation;
  const generation = (generations.get(key) ?? 0) + 1;
  generations.set(key, generation); pending.add(write);
  try {
    const value = await write;
    if (generations.get(key) === generation) failures.delete(key);
    return value;
  } catch (error) { failures.set(key, generation); throw error; }
  finally { pending.delete(write); }
}
export async function drainUpdateWrites(): Promise<boolean> {
  while (pending.size) await Promise.allSettled([...pending]);
  return !failures.size;
}
export interface WorkProtection {
  documents(): readonly UpdateDocument[];
  busy(): boolean;
  drain(): Promise<boolean>;
  choose(doc: UpdateDocument): Promise<boolean>;
}
/** A false save, discard, flush or durable receipt always vetoes replacement. */
export async function settleUpdateWork(work: WorkProtection): Promise<'ready' | 'busy' | 'save' | 'cancelled'> {
  if (work.busy()) return 'busy';
  const mounted = work.documents();
  await work.drain();
  for (const doc of mounted) {
    if (doc.busy()) return 'busy';
    if (doc.unsaved() && !(await work.choose(doc))) return doc.saveFailed?.() ? 'save' : 'cancelled';
    if (!(await doc.flush())) return 'save';
  }
  if (!(await work.drain())) return 'save';
  if (work.busy() || work.documents().some(doc => doc.busy())) return 'busy';
  if (work.documents().some(doc => !mounted.includes(doc))) return 'cancelled';
  if (mounted.some(doc => doc.unsaved())) return 'save';
  return 'ready';
}
