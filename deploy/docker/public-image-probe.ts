// SPDX-License-Identifier: MPL-2.0
/** Compatibility entry point; the image carries the maintained probe and helpers. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.LOLLY_IMAGE_ROOT || '/app');
await import(pathToFileURL(resolve(root, 'services/mcp/scripts/native-public-image-probe.ts')).href);
