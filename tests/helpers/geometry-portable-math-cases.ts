// SPDX-License-Identifier: MPL-2.0
/** Binary scalar transport preserves zero signs, infinities and finite boundary neighbours. */
export const fittingMathNames = ['sin', 'cos', 'acos', 'cbrt', 'atan2'] as const;
export type FittingMathName = (typeof fittingMathNames)[number];
export interface FittingMathCase {
  name: FittingMathName;
  args: string[];
}
export function floatBits(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, '0');
}
export function bitsFloat(bits: string): number {
  if (bits === 'NaN') return NaN;
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt('0x' + bits), false);
  return view.getFloat64(0, false);
}
export function portableMathCases(): FittingMathCase[] {
  const boundaries = [
    0,
    -0,
    Number.MIN_VALUE,
    -Number.MIN_VALUE,
    2 ** -1022,
    -(2 ** -1022),
    1e-300,
    -1e-300,
    1e-20,
    -1e-20,
    0.5,
    -0.5,
    1,
    -1,
    1 - Number.EPSILON / 2,
    1 + Number.EPSILON,
    -1 + Number.EPSILON / 2,
    -1 - Number.EPSILON,
    Math.PI / 2,
    -Math.PI / 2,
    Math.PI,
    -Math.PI,
    2 * Math.PI,
    1e100,
    -1e100,
    1e308,
    -1e308,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity,
    -Infinity,
    NaN,
  ];
  const result: FittingMathCase[] = [];
  const add = (name: FittingMathName, ...args: number[]) =>
    result.push({ name, args: args.map(floatBits) });
  for (const value of boundaries) for (const name of fittingMathNames.slice(0, 4)) add(name, value);
  for (const y of boundaries) for (const x of boundaries) add('atan2', y, x);
  let seed = 0x295e3;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let i = 0; i < 512; i++) {
    const angle = (random() - 0.5) * 100;
    add('sin', angle);
    add('cos', angle);
    add('acos', random() * 2 - 1);
    add('cbrt', (random() - 0.5) * 10 ** ((i % 601) - 300));
    add('atan2', (random() - 0.5) * 1e9, (random() - 0.5) * 1e9);
  }
  return result;
}
export async function probePortableMath(bytes: BufferSource, cases: FittingMathCase[]) {
  const compiled = await WebAssembly.compile(bytes);
  if (WebAssembly.Module.imports(compiled).length)
    throw new Error('Portable maths must have no host imports.');
  const instance = await WebAssembly.instantiate(compiled);
  const functions = instance.exports as Record<string, (...args: number[]) => number>;
  return cases.map((row) =>
    floatBits(functions['geom_math_' + row.name]!(...row.args.map(bitsFloat)))
  );
}
