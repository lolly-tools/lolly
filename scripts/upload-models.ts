#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Compatibility entry point. Immutable publication and full-byte verification
 * live in publish-models.ts; replacement of published keys is forbidden. */
import { publishModelsCli } from './publish-models.ts';
await publishModelsCli();
