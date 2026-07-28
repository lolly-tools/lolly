// SPDX-License-Identifier: MPL-2.0
/**
 * Registers the stylesheet-import stub for the test run — see css-stub-hooks.mjs
 * for why it exists. Wired in via `--import` on the `test` script, so every
 * suite gets it without each file opting in.
 */
import { register } from 'node:module';

register('./css-stub-hooks.mjs', import.meta.url);
