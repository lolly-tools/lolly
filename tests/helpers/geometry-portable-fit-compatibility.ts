// SPDX-License-Identifier: MPL-2.0
/** Exact bit census records legacy rounding changes without declaring geometric equivalence. */
import type { GeometryOffsetPiece } from '../../packages/node-shell/src/geometry-fitting.ts';
import { floatBits } from './geometry-portable-math-cases.ts';
export function pieceBits(pieces: GeometryOffsetPiece[]) {
  return pieces.map((p) => [
    p.curve.map(floatBits),
    p.dirStart ? [floatBits(p.dirStart.x), floatBits(p.dirStart.y)] : null,
    p.dirEnd ? [floatBits(p.dirEnd.x), floatBits(p.dirEnd.y)] : null,
  ]);
}
export function fittingCompatibility(
  rows: {
    name: string;
    actual: GeometryOffsetPiece[];
    reference: GeometryOffsetPiece[];
  }[]
) {
  return rows.flatMap((row) => {
    if (JSON.stringify(pieceBits(row.actual)) === JSON.stringify(pieceBits(row.reference)))
      return [];
    const sameCount = row.actual.length === row.reference.length;
    let maxControlDifference = 0;
    if (sameCount)
      row.actual.forEach((piece, i) => {
        piece.curve.forEach((v, j) => {
          maxControlDifference = Math.max(
            maxControlDifference,
            Math.abs(v - row.reference[i]!.curve[j]!)
          );
        });
      });
    return [
      {
        name: row.name,
        canonicalPieces: row.actual.length,
        referencePieces: row.reference.length,
        maxControlDifference: sameCount ? maxControlDifference : null,
        canonicalBits: pieceBits(row.actual),
        referenceBits: pieceBits(row.reference),
      },
    ];
  });
}
