// SPDX-License-Identifier: MPL-2.0
/** Reuse a lazy module load, including its preload work; failed loads can retry. */
export function lazyModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= Promise.resolve().then(load).catch(error => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}
