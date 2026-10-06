// SPDX-License-Identifier: MPL-2.0
/** PNG generator hints are scoped to creator and structured generation fields. */
const APP = /^(ChatGPT|OpenAI|DALL[ -]?E(?: 2| 3)?|Midjourney|Stable Diffusion|SDXL|ComfyUI|AUTOMATIC1111|Adobe Firefly|Google Gemini|Gemini|NovelAI|InvokeAI|Fooocus)(?:\s+v?\d[\w.-]*)?$/i;

export function pngGeneratorHint(keyword: string, value: string): string | null {
  if (/^(?:creator|generator|creator tool)$/i.test(keyword)) return APP.exec(value.trim())?.[1] ?? null;
  if (!/^parameters$/i.test(keyword)) return null;
  // Prompts alone are prose. Require numeric sampling settings before interpreting a model field.
  if (!/\bSteps:\s*\d+\b/i.test(value) || !/\b(?:Sampler|CFG scale|Seed):/i.test(value)) return null;
  const model = /(?:^|\n|,\s*)Model:\s*([^,\n]+)/i.exec(value)?.[1]?.trim();
  if (model && /^(?:sd[_ -]?xl|sd[_ -]?v?\d|stable[_ -]?diffusion)(?:\b|_)/i.test(model)) return 'Stable Diffusion';
  return null;
}
