// SPDX-License-Identifier: MPL-2.0
/**
 * Which press profile a print export separates through. Shared by the web and
 * Node shells; no files, network or DOM here, so the browser imports it too.
 *
 * One CMYK profile ships with Lolly: a CC0 profile fitted to the FOGRA39
 * characterisation data (`packages/node-shell/icc/`, README there). It drives
 * the separation whenever the export's press condition resolves to Coated
 * FOGRA39, which includes the default and an unrecognised or opted-out value
 * (`cmykCondition` falls back to the default condition for those). A user's own
 * profile is resolved by the web shell before this rule is asked. Every other
 * named condition keeps the device formula, because no licence-clean profile
 * for it can ship.
 */
import { cmykCondition, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION } from '@lolly/engine';

/** The bundled profile: where it lives and what its bytes hash to. */
export const BUNDLED_PRESS_PROFILE = Object.freeze({
  condition: 'fogra39' as const,
  file: 'craft-coated-fogra39.icc',
  bytes: 712_888,
  sha256: 'be2d6bdad6e0508f3a486659893748eebc7063933e53dbb917da8cfa8028f20e',
});

/** True when an export with this `colorProfile` value separates through the bundled profile. */
export function usesBundledPressProfile(colorProfile: string | null | undefined): boolean {
  const wanted = CMYK_CONDITIONS[BUNDLED_PRESS_PROFILE.condition];
  const value = colorProfile ?? DEFAULT_CMYK_CONDITION;
  return cmykCondition(value).identifier === wanted.identifier;
}
