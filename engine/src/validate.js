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
import toolSchema from '../../schemas/tool.schema.json' with { type: 'json' };
import assetSchema from '../../schemas/asset.schema.json' with { type: 'json' };
import assetRefSchema from '../../schemas/asset-ref.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(toolSchema);
ajv.addSchema(assetSchema);
ajv.addSchema(assetRefSchema);

const validateTool = ajv.compile(toolSchema);
const validateAsset = ajv.compile(assetSchema);

export function validateManifest(manifest) {
  const ok = validateTool(manifest);
  return {
    valid: ok,
    errors: ok ? [] : validateTool.errors.map(formatError),
  };
}

export function validateAssetManifest(asset) {
  const ok = validateAsset(asset);
  return {
    valid: ok,
    errors: ok ? [] : validateAsset.errors.map(formatError),
  };
}

function formatError(err) {
  const path = err.instancePath || '/';
  let message = err.message ?? 'invalid';
  if (err.keyword === 'enum' && err.params?.allowedValues) {
    message += `: ${err.params.allowedValues.join(', ')}`;
  }
  if (err.keyword === 'required' && err.params?.missingProperty) {
    message = `missing required property "${err.params.missingProperty}"`;
  }
  if (err.keyword === 'additionalProperties' && err.params?.additionalProperty) {
    message = `unknown property "${err.params.additionalProperty}"`;
  }
  return { path, message };
}
