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
 * GITHUB_OUTPUT is set, the checked pin is written there as `pin`.
 */
import { createPublicKey } from 'node:crypto';
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

/** Returns the pin as one line of JSON, or throws. */
export function checkSigningScope(input: { environment?: string; pin?: string; releasePin?: string }): string {
  const { environment, pin, releasePin } = input;
  if (!environment || !SIGNING_ENVIRONMENTS.includes(environment)) throw new Error(`Unknown signing environment ${JSON.stringify(environment)}`);
  const release = readPin(releasePin, 'The release pin (LOLLY_RELEASE_PUBLIC_KEY_JWK)');
  const chosen = readPin(pin, environment === PREVIEW_ENVIRONMENT ? 'The preview pin (LOLLY_PREVIEW_PUBLIC_KEY_JWK)' : 'The build pin');
  const same = chosen.x === release.x && chosen.y === release.y;
  if (environment === RELEASE_ENVIRONMENT && !same) throw new Error('The release environment may sign only for the release pin');
  if (environment === PREVIEW_ENVIRONMENT && same) throw new Error('The preview environment may never sign for the release pin');
  return JSON.stringify(JSON.parse(pin!));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const pin = checkSigningScope({
      environment: process.env.SIGNING_ENVIRONMENT, pin: process.env.PIN, releasePin: process.env.RELEASE_PIN,
    });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `pin=${pin}\n`);
    console.log(`Signing scope ok: ${process.env.SIGNING_ENVIRONMENT}`);
  } catch (error) {
    console.error(`::error title=Signing scope::${(error as Error).message}`);
    process.exit(1);
  }
}
