// SPDX-License-Identifier: MPL-2.0
/**
 * Which catalog key may sign for which public pin.
 *
 * release-frontend.yml signs inside one of two GitHub environments. The release
 * environment holds the release key and may sign only for the release pin. The
 * preview environment holds a separate key and may sign only for its own pin,
 * which must never equal the release pin. This check runs inside the signing
 * jobs before any key is used, and sign-catalog.ts then refuses a key whose
 * thumbprint differs from the pin it was given. It uses only Node built-ins so a
 * signing job needs no installed dependencies.
 *
 * Environment: SIGNING_ENVIRONMENT, PIN (the pin this run builds for) and
 * RELEASE_PIN (the repository variable LOLLY_RELEASE_PUBLIC_KEY_JWK). When
 * GITHUB_OUTPUT is set, the checked pin is written there as `pin`, byte for byte as
 * given, in the delimited form so a pin that spans lines survives. With `--same-key` it instead compares RELEASE_PIN with NATIVE_PIN.
 */
import { createPublicKey, randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RELEASE_ENVIRONMENT = 'release-catalog-signing';
export const PREVIEW_ENVIRONMENT = 'preview-catalog-signing';
export const SIGNING_ENVIRONMENTS: readonly string[] = [RELEASE_ENVIRONMENT, PREVIEW_ENVIRONMENT];

interface PublicPin { kty: string; crv: string; x: string; y: string }

function readPin(text: string | undefined, label: string): PublicPin {
  if (!text?.trim()) throw new Error(`${label} is not set`);
  let key: Record<string, unknown>;
  try { key = JSON.parse(text) as Record<string, unknown>; } catch { throw new Error(`${label} is not JSON`); }
  if (key.kty !== 'EC' || key.crv !== 'P-256' || typeof key.x !== 'string' || !key.x || typeof key.y !== 'string' || !key.y) {
    throw new Error(`${label} is not an EC P-256 public key`);
  }
  if (key.d !== undefined) throw new Error(`${label} carries private key material`);
  const pin = { kty: key.kty, crv: key.crv, x: key.x, y: key.y };
  createPublicKey({ key: pin, format: 'jwk' });
  return pin;
}

/** Returns the caller's pin string unchanged (after validating it), or throws. */
export function checkSigningScope(input: { environment?: string; pin?: string; releasePin?: string }): string {
  const { environment, pin, releasePin } = input;
  if (!environment || !SIGNING_ENVIRONMENTS.includes(environment)) throw new Error(`Unknown signing environment ${JSON.stringify(environment)}`);
  const release = readPin(releasePin, 'The release pin (LOLLY_RELEASE_PUBLIC_KEY_JWK)');
  const chosen = readPin(pin, environment === PREVIEW_ENVIRONMENT ? 'The preview pin (LOLLY_PREVIEW_PUBLIC_KEY_JWK)' : 'The build pin');
  const same = chosen.x === release.x && chosen.y === release.y;
  if (environment === RELEASE_ENVIRONMENT && !same) throw new Error('The release environment may sign only for the release pin');
  if (environment === PREVIEW_ENVIRONMENT && same) throw new Error('The preview environment may never sign for the release pin');
  return pin!;
}

/**
 * True when two public pins name the same key (kty, crv, x and y), whatever their
 * whitespace or member order. Throws when either is not a valid public pin.
 */
export function pinsMatch(a: string | undefined, b: string | undefined): boolean {
  const left = readPin(a, 'The first pin'), right = readPin(b, 'The second pin');
  return left.kty === right.kty && left.crv === right.crv && left.x === right.x && left.y === right.y;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--same-key') {
  // Used by release-pin-sync.yml: LOLLY_RELEASE_PUBLIC_KEY_JWK (release builds) and
  // VITE_CATALOG_PUBLIC_KEY_JWK (native callers) must name the same key.
  try {
    if (!pinsMatch(process.env.RELEASE_PIN, process.env.NATIVE_PIN)) throw new Error('LOLLY_RELEASE_PUBLIC_KEY_JWK and VITE_CATALOG_PUBLIC_KEY_JWK name different keys; native releases would fail at plan');
    console.log('Release and native pins name the same key');
  } catch (error) {
    console.error(`::error title=Release pin sync::${(error as Error).message}`);
    process.exit(1);
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const pin = checkSigningScope({
      environment: process.env.SIGNING_ENVIRONMENT, pin: process.env.PIN, releasePin: process.env.RELEASE_PIN,
    });
    // A pin variable may span lines, so use the delimited output form. It keeps the bytes exact.
    const end = `pin_${randomUUID()}`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `pin<<${end}\n${pin}\n${end}\n`);
    console.log(`Signing scope ok: ${process.env.SIGNING_ENVIRONMENT}`);
  } catch (error) {
    console.error(`::error title=Signing scope::${(error as Error).message}`);
    process.exit(1);
  }
}
