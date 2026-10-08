// SPDX-License-Identifier: MPL-2.0
// The same analytic/oracle suite also qualifies the Rust/WASM geometry pilot.
import { nearestOnCubic } from '../engine/src/geom/bezier.ts';
import { registerNearestConformance } from './helpers/nearest-conformance.ts';

registerNearestConformance(nearestOnCubic);
