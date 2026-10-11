// SPDX-License-Identifier: MPL-2.0
import type { LayoutAPI, TokensAPI } from '@lolly-tools/core/host-v1';
import {
  createDesignLayoutEvaluator,
  createDesignLayoutMeasurer,
  resolveDesignLayoutFonts,
} from '@lolly/engine';
import { createNodeTextShaper } from './text-measure.ts';
import { loadLayoutKernel } from './layout-kernel-node.ts';

export async function createNodeLayout(tokens?: TokensAPI): Promise<LayoutAPI> {
  const solve = await loadLayoutKernel();
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
      const revision = JSON.stringify(fonts);
      let evaluate = contexts.get(revision);
      if (!evaluate) {
        const shaper = createNodeTextShaper();
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
