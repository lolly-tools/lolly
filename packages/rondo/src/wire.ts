// SPDX-License-Identifier: MPL-2.0
/**
 * The JSON boundary between the vm and the trusted realm.
 *
 * Staged data carries Maps, typed arrays (wavetable frames, sample slices) and the
 * odd non-finite number, none of which survive JSON.stringify unchanged. The
 * replacer tags them inside the vm; the reviver untags them on the trusted side.
 *
 * The reviver is the half that matters. Its input is untrusted, so it only ever
 * builds a constructor from a closed list, only accepts the three non-finite
 * spellings, and refuses a key that would reach an object's prototype.
 */

export function replacer(_key: string, value: unknown): unknown {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return { __ta: value.constructor.name, d: Array.from(value as unknown as ArrayLike<number>) };
  }
  if (value instanceof Map) return { __map: [...value] };
  if (typeof value === 'number' && !Number.isFinite(value)) return { __num: String(value) };
  return value;
}

const TYPED: Readonly<Record<string, (d: number[]) => ArrayBufferView>> = Object.freeze({
  Float32Array: (d) => Float32Array.from(d),
  Float64Array: (d) => Float64Array.from(d),
  Int8Array: (d) => Int8Array.from(d),
  Int16Array: (d) => Int16Array.from(d),
  Int32Array: (d) => Int32Array.from(d),
  Uint8Array: (d) => Uint8Array.from(d),
  Uint16Array: (d) => Uint16Array.from(d),
  Uint32Array: (d) => Uint32Array.from(d),
});

const NON_FINITE: Readonly<Record<string, number>> = Object.freeze({
  Infinity: Number.POSITIVE_INFINITY,
  '-Infinity': Number.NEGATIVE_INFINITY,
  NaN: Number.NaN,
});

export class WireError extends Error {
  override name = 'WireError';
}

const own = (o: object, k: string): boolean => Object.hasOwn(o, k);

export function reviver(key: string, value: unknown): unknown {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    throw new WireError(`staged data used the reserved key "${key}"`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const v = value as Record<string, unknown>;
  if (own(v, '__ta')) {
    const make = typeof v.__ta === 'string' && own(TYPED, v.__ta) ? TYPED[v.__ta] : undefined;
    if (!make || !Array.isArray(v.d)) throw new WireError('staged data held an unknown typed array');
    for (const n of v.d) if (typeof n !== 'number') throw new WireError('a typed array held a non-number');
    return make(v.d as number[]);
  }
  if (own(v, '__map')) {
    if (!Array.isArray(v.__map)) throw new WireError('a staged map was not a list of pairs');
    for (const pair of v.__map) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') {
        throw new WireError('a staged map entry was not a [name, value] pair');
      }
    }
    return new Map(v.__map as [string, unknown][]);
  }
  if (own(v, '__num')) {
    if (typeof v.__num !== 'string' || !own(NON_FINITE, v.__num)) throw new WireError('a staged number was malformed');
    return NON_FINITE[v.__num];
  }
  return value;
}
