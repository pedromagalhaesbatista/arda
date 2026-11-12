import type { FrameGroup } from './dat';

/**
 * Flat index into FrameGroup.spriteIds for a specific frame. Matches the
 * OTClient DAT sprite layout (capitals are *counts*, lowercase are
 * *indices* — distinct in our parameter names too):
 *   index = (((((phase*numPatternZ + z)*numPatternY + patY)*numPatternX + patX)
 *               *layers + layer)*height + h)*width + w
 * z-pattern index is hardcoded to 0 — nothing in Tibia 7.6 .dat actually
 * varies along z. Used by both creature rendering (with patY=0, patX=
 * direction) and ground/item rendering (with patY=tile.y%numPatternY etc.).
 */
export function spriteIndex(
  fg: FrameGroup,
  phase: number,
  patX: number,
  patY: number,
  layer: number,
  h: number,
  w: number,
): number {
  const yComponent = phase * fg.numPatternZ * fg.numPatternY + patY;
  const xyComponent = yComponent * fg.numPatternX + patX;
  return ((xyComponent * fg.layers + layer) * fg.height + h) * fg.width + w;
}
