// SPDX-License-Identifier: MPL-2.0
/** Incremental decoration ink, with a separate undecorated ground on each renderer. */
export interface DecorationRegion { id: string; x: number; y: number; w: number; h: number }
export interface DecorationInk { id: string; a: number; b: number; share: number; shift: number; dx: number; dy: number }

/** Runs in the owned browser fixture, independent of the drawing implementation. */
export async function decorationInk(reference: string, referenceGround: string, candidate: string, candidateGround: string,
  width: number, height: number, regions: DecorationRegion[]): Promise<DecorationInk[]> {
  const pixels = async (url: string) => {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const [a, ag, b, bg] = await Promise.all([reference, referenceGround, candidate, candidateGround].map(pixels));
  return regions.map((region) => {
    let ai = 0, bi = 0, ax = 0, ay = 0, bx = 0, by = 0;
    for (let y = Math.max(0, Math.floor(region.y)); y < Math.min(height, Math.ceil(region.y + region.h)); y++) {
      for (let x = Math.max(0, Math.floor(region.x)); x < Math.min(width, Math.ceil(region.x + region.w)); x++) {
        const at = (y * width + x) * 4;
        const da = Math.max(...[0, 1, 2].map((c) => Math.abs(a![at + c]! - ag![at + c]!))) / 255;
        const db = Math.max(...[0, 1, 2].map((c) => Math.abs(b![at + c]! - bg![at + c]!))) / 255;
        ai += da; ax += da * x; ay += da * y; bi += db; bx += db * x; by += db * y;
      }
    }
    const dx = ai && bi ? bx / bi - ax / ai : Infinity, dy = ai && bi ? by / bi - ay / ai : Infinity;
    return { id: region.id, a: ai, b: bi, share: ai ? Math.abs(ai - bi) / ai : Infinity, shift: Math.hypot(dx, dy), dx, dy };
  });
}
