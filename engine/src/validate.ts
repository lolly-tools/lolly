// SPDX-License-Identifier: MPL-2.0
/**
 * Validates a tool manifest against the JSON Schema.
 *
 * Used at:
 *   - tool catalog build time (CI rejects bad manifests)
 *   - host shell load time (defensive — never trust the network)
 *   - dev mode (live feedback while authoring)
 */

import Ajv from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import toolSchema from '../../schemas/tool.schema.json' with { type: 'json' };
import assetSchema from '../../schemas/asset.schema.json' with { type: 'json' };
import assetRefSchema from '../../schemas/asset-ref.schema.json' with { type: 'json' };

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

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(toolSchema);
ajv.addSchema(assetSchema);
ajv.addSchema(assetRefSchema);

const validateTool = ajv.compile(toolSchema);
const validateAsset = ajv.compile(assetSchema);

export function validateManifest(manifest: unknown): ValidationResult {
  const ok = validateTool(manifest);
  return {
    valid: ok,
    errors: ok ? [] : (validateTool.errors ?? []).map(formatError),
  };
}

export function validateAssetManifest(asset: unknown): ValidationResult {
  const ok = validateAsset(asset);
  return {
    valid: ok,
    errors: ok ? [] : (validateAsset.errors ?? []).map(formatError),
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
