// SPDX-License-Identifier: MPL-2.0
/**
 * Validates a tool manifest against the JSON Schema.
 *
 * Used at:
 *   - tool catalog build time (CI rejects bad manifests)
 *   - host shell load time (defensive - never trust the network)
 *   - dev mode (live feedback while authoring)
 */

import Ajv from 'ajv/dist/2020.js';
import { assetOpenErrors, type AssetOpenIntentV1 } from '@lolly-tools/core/asset-open-v1';
import type { Ajv2020, ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import toolSchema from '../../schemas/tool.schema.json' with { type: 'json' };
import assetSchema from '../../schemas/asset.schema.json' with { type: 'json' };
import assetRefSchema from '../../schemas/asset-ref.schema.json' with { type: 'json' };
import rateCardSchema from '../../schemas/ratecard.schema.json' with { type: 'json' };

/** One human-readable schema violation. */
export interface ValidationIssue {
  path: string;
  message: string;
}

/** Outcome of validating a manifest: valid, or a list of formatted issues. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

// Ajv ships as CJS; under some TS module-interop configs (e.g. Vercel's
// function compiler) the default import isn't seen as constructable (TS2351).
// It IS a class at runtime - cast the ctor so every toolchain agrees.
let ajv: Ajv2020 | undefined;
function schemas(): Ajv2020 {
  if (!ajv) {
    // The large manifest schema compiles faster without Ajv's code optimizer.
    // Validators stay cached, and schema validation keeps its default checks.
    const instance: Ajv2020 = new (Ajv as any)({ allErrors: true, strict: false, code: { optimize: false } });
    instance.addSchema(toolSchema);
    instance.addSchema(assetSchema);
    instance.addSchema(assetRefSchema);
    ajv = instance;
  }
  return ajv;
}
let validateTool: ValidateFunction | undefined;

// The rate-card shape validator, injected into `parseRateCard` (engine/src/rate-card.ts)
// so the web drop path and the CLI `--rate-card` path share ONE compiled schema - the
// same single-source-of-truth `validate-catalog.ts` gets from its own Ajv instance.
// Proves shape only; `parseRateCard` owns the extra-schema invariants a valid card can
// still violate (ISO 4217, break ordering, unique ids, breakMode-with-breaks).
let rateCardValidator: ValidateFunction | undefined;

/** True when `doc` satisfies `schemas/ratecard.schema.json`. Shape only - pass this to
 *  `parseRateCard` as its injected validator. */
export const validateRateCard = (doc: unknown): boolean => {
  if (!rateCardValidator) rateCardValidator = schemas().compile(rateCardSchema);
  return rateCardValidator(doc) as boolean;
};

export function validateManifest(manifest: unknown): ValidationResult {
  if (!validateTool) validateTool = schemas().compile(toolSchema);
  const ok = validateTool(manifest);
  const errors = ok ? [] : (validateTool.errors ?? []).map(formatError);
  if (ok) for (const [index, input] of ((manifest as { inputs?: { type: string; tokenBindingsField?: string; fields?: { id: string; type?: string }[] }[] }).inputs ?? []).entries()) {
    if (input.tokenBindingsField && (input.type !== 'blocks' || !input.fields?.some(field => field.id === input.tokenBindingsField && (field.type ?? 'text') === 'text'))) errors.push({ path: `/inputs/${index}/tokenBindingsField`, message: 'must name a declared text sub-field of this blocks input' });
  }
  if (ok) errors.push(...assetOpenErrors(manifest as { id: string; openWith?: AssetOpenIntentV1[]; inputs?: { id: string; type: string; multiple?: boolean }[] }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function formatError(err: ErrorObject): ValidationIssue {
  const path = err.instancePath || '/';
  let message = err.message ?? 'invalid';
  // ajv types `params` per keyword as Record<string, any>; treat it as unknown
  // and narrow each field we read.
  const params: Record<string, unknown> = err.params ?? {};
  const allowedValues = params.allowedValues;
  if (err.keyword === 'enum' && Array.isArray(allowedValues)) {
    message += `: ${allowedValues.join(', ')}`;
  }
  const missingProperty = params.missingProperty;
  if (err.keyword === 'required' && typeof missingProperty === 'string') {
    message = `missing required property "${missingProperty}"`;
  }
  const additionalProperty = params.additionalProperty;
  if (err.keyword === 'additionalProperties' && typeof additionalProperty === 'string') {
    message = `unknown property "${additionalProperty}"`;
  }
  return { path, message };
}
