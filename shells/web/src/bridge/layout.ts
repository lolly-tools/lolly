// SPDX-License-Identifier: MPL-2.0
import type { LayoutAPI, TextAPI, TokensAPI } from '@lolly-tools/core/host-v1';
import { createLayoutKernel } from '@lolly-tools/node-shell/layout-kernel';
import wasmUrl from '@lolly-tools/node-shell/layout-kernel.wasm?url';
import { createDesignLayoutEvaluator } from '../../../../engine/src/design-layout.ts';
import {
  createDesignLayoutMeasurer,
  resolveDesignLayoutFonts,
} from '../../../../engine/src/design-layout-resources.ts';
import {
  createHostTextShaper,
  sfntVerticalMetrics,
} from '../../../../engine/src/text-shaper-host.ts';
import { fontRegistryGeneration, resolveVectorFont } from './font-registry.ts';

export async function createWebLayout(text: TextAPI, tokens?: TokensAPI): Promise<LayoutAPI> {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error('The layout kernel could not be loaded.');
  const solve = await createLayoutKernel(new Uint8Array(await response.arrayBuffer()));
  const contexts = new Map<string, ReturnType<typeof createDesignLayoutEvaluator>>();
  return {
    evaluate: async (request) => {
      let fonts: Awaited<ReturnType<typeof resolveDesignLayoutFonts>>;
      try {
        fonts = await resolveDesignLayoutFonts(tokens);
      } catch (error) {
        return {
          boxes: request.boxes,
          findings: [
            {
              id: '',
              code: 'layout.resources',
              message: `Layout font tokens could not be resolved: ${(error as Error).message}`,
            },
          ],
          passes: 0,
          solved: 0,
          grids: [],
        };
      }
      const revision = JSON.stringify([fonts, fontRegistryGeneration()]);
      let evaluate = contexts.get(revision);
      if (!evaluate) {
        const metrics = new Map<string, Promise<ReturnType<typeof sfntVerticalMetrics>>>();
        const shaper = createHostTextShaper({
          toPath: async (options) => {
            const shaped = await text.toPath(options);
            if ((shaped.notdef ?? 0) > 0 && !text.characters)
              throw new Error(
                'The layout font contains missing glyphs and the host cannot report its character coverage.'
              );
            return shaped;
          },
          characters: text.characters ? (url) => text.characters!(url) : undefined,
          face: async (family, weight, italic, runText) => {
            const font = await resolveVectorFont(
              {
                fontFamily: JSON.stringify(family),
                fontWeight: String(weight),
                fontStyle: italic ? 'italic' : 'normal',
              },
              runText
            );
            if (font && (!font.face || font.face.family.toLowerCase() !== family.toLowerCase()))
              return null;
            return font ? { url: font.url, variations: font.variations } : null;
          },
          metrics: async (url) => {
            let hit = metrics.get(url);
            if (!hit) {
              hit = fetch(url).then(async (result) =>
                result.ok ? sfntVerticalMetrics(new Uint8Array(await result.arrayBuffer())) : null
              );
              metrics.set(url, hit);
              hit.catch(() => metrics.delete(url));
            }
            return (await hit) ?? undefined;
          },
        });
        evaluate = createDesignLayoutEvaluator(
          solve,
          createDesignLayoutMeasurer(shaper, fonts, revision)
        );
        if (contexts.size >= 2) contexts.delete(contexts.keys().next().value!);
        contexts.set(revision, evaluate);
      }
      return evaluate(request.boxes, request.tracks, revision);
    },
  };
}
