// SPDX-License-Identifier: MPL-2.0
/** Anonymous model access and the stricter, constant public cache boundary. */
export const PUBLIC_MODEL_CORS_ORIGINS = ['null', 'https://lolly.tools', 'https://lolly.ing', 'https://example.net'] as const;

/** Accept serialized web origins only; credentials and path values are never sent. */
export function modelCorsOrigins(origins: readonly string[] = PUBLIC_MODEL_CORS_ORIGINS): string[] {
  if (!origins.length || origins.length > 8) throw new Error('Configure between one and eight model CORS origins');
  for (const origin of origins) {
    if (origin === 'null') continue;
    const parsed = new URL(origin);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) throw new Error('Model CORS checks require serialized origins without credentials');
  }
  return [...new Set(origins)];
}

/** Reflection permits an anonymous fetch, but is not Plan 300's path-only cache
 * policy. Keep that failure distinct from an origin that cannot read at all. */
export function modelCorsFailures(headers: Headers, origin: string | null, exposedHeaders: readonly string[] = []): string[] {
  const allowed = headers.get('access-control-allow-origin');
  const vary = (headers.get('vary') ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
  const failures: string[] = [];
  if (allowed !== '*' && (origin === null || allowed !== origin)) failures.push('cors-origin');
  if (headers.has('access-control-allow-credentials')) failures.push('cors-credentials');
  if (headers.has('set-cookie')) failures.push('cors-set-cookie');
  if (origin !== null && allowed !== '*' && allowed === origin) {
    if (!vary.includes('origin')) failures.push('cors-reflection-missing-vary');
    failures.push('cors-nonconstant-origin');
  }
  if (vary.some(value => value !== 'accept-encoding')) failures.push('cors-vary');
  const exposed = (headers.get('access-control-expose-headers') ?? '').toLowerCase().split(',').map(value => value.trim());
  if (!exposed.includes('*')) for (const header of exposedHeaders) if (!exposed.includes(header.toLowerCase())) failures.push(`cors-expose-${header.toLowerCase()}`);
  return failures;
}
