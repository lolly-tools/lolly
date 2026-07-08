// SPDX-License-Identifier: MPL-2.0
/**
 * Validate a `tool.json` manifest against the bundled JSON Schema — the
 * authoritative manifest contract. This is the SAME check Lolly runs at
 * catalog-build time and at host load time, so a manifest that passes here will
 * load in any Lolly shell. The bundled schema is kept byte-identical to the
 * platform's `schemas/tool.schema.json` by a drift-guard test.
 */
import Ajv from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import toolSchema from '../schema/tool.schema.json' with { type: 'json' };
import assetSchema from '../schema/asset.schema.json' with { type: 'json' };
import assetRefSchema from '../schema/asset-ref.schema.json' with { type: 'json' };

/** One human-readable schema violation. */
export interface ValidationIssue {
  /** JSON pointer to the offending location, e.g. `/inputs/0/type` (`/` = root). */
  path: string;
  message: string;
}

/** Outcome of validating a manifest: valid, or a list of formatted issues. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

// Ajv ships as CJS; under some TS module-interop configs the default import isn't
// seen as constructable (TS2351). It IS a class at runtime — cast the ctor so
// every toolchain agrees. (Mirrors engine/src/validate.ts.)
const ajv = new (Ajv as any)({ allErrors: true, strict: false });
ajv.addSchema(toolSchema);
ajv.addSchema(assetSchema);
ajv.addSchema(assetRefSchema);

const validate = ajv.compile(toolSchema);

/** Validate a `tool.json` manifest object against the bundled schema. */
export function validateTool(manifest: unknown): ValidationResult {
  const ok = validate(manifest);
  return {
    valid: Boolean(ok),
    errors: ok ? [] : ((validate.errors ?? []) as ErrorObject[]).map(formatError),
  };
}

function formatError(err: ErrorObject): ValidationIssue {
  const path = err.instancePath || '/';
  let message = err.message ?? 'invalid';
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
