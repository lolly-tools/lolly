// SPDX-License-Identifier: MPL-2.0
/** Offline high-precision scalar fixtures; mpmath is needed only to regenerate these vectors. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { floatBits, type FittingMathCase } from '../tests/helpers/geometry-portable-math-cases.ts';

const cases: FittingMathCase[] = [];
const add = (name: FittingMathCase['name'], ...args: number[]) =>
  cases.push({ name, args: args.map(floatBits) });
for (const x of [
  Number.MIN_VALUE,
  1e-300,
  0.1,
  -0.1,
  0.5,
  1,
  -1,
  Math.PI / 2,
  Math.PI,
  1e100,
  1e308,
  Number.MAX_VALUE,
]) {
  add('sin', x);
  add('cos', x);
  add('cbrt', x);
}
for (const x of [
  -1,
  -1 + Number.EPSILON / 2,
  -0.99,
  -0.5,
  0,
  0.1,
  0.5,
  0.99,
  1 - Number.EPSILON / 2,
  1,
])
  add('acos', x);
for (const [y, x] of [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1e-300, 1e300],
  [1e300, 1e-300],
  [Number.MIN_VALUE, 1],
  [1, Number.MIN_VALUE],
  [-24.424515795650784, 74.4002939718329],
  [16.459300463011267, 47.13093516961589],
])
  add('atan2', y!, x!);
const source = `
import json, struct, sys, mpmath as mp
assert mp.__version__ == '1.3.0'
cases = json.load(sys.stdin)
def decode(h): return struct.unpack('>d', bytes.fromhex(h))[0]
def encode(v): return struct.pack('>d', float(v)).hex()
def calculate(row, digits):
    with mp.workdps(digits):
        args = [mp.mpf(decode(h)) for h in row['args']]
        if row['name'] == 'cbrt':
            x = args[0]
            value = -mp.root(-x, 3) if x < 0 else mp.root(x, 3)
        else: value = getattr(mp, row['name'])(*args)
        return encode(value)
rows = []
for row in cases:
    low, high = calculate(row, 450), calculate(row, 650)
    assert low == high, row
    rows.append(dict(row, expected=high))
print(json.dumps(dict(generator='mpmath 1.3.0; exact binary64 inputs; 450 and 650 decimal digits agree after binary64 rounding', rows=rows), indent=2))
`;
const text = execFileSync('python3', ['-c', source], {
  input: JSON.stringify(cases),
  encoding: 'utf8',
});
assert.equal(JSON.parse(text).rows.length, cases.length);
const directory = new URL('../tests/fixtures/geometry-math/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('portable-vectors.json', directory), text);
console.log(`Wrote ${cases.length} high-precision scalar vectors.`);
