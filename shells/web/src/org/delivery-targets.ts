// SPDX-License-Identifier: MPL-2.0
/**
 * Organisation-owned delivery targets projected by the optional control plane.
 *
 * This adapter deliberately contains no provider credentials or provider
 * options. The shell receives only a safe fixed-target descriptor. Exports
 * carry signed bytes; shared originals use an explicit server-side selector. Personal
 * destinations stay in their existing device-owned drivers and coexist with
 * these targets even when both use the same provider kind.
 */
import { getSessionSource } from '../lib/session-source.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import {
  registerSendTarget,
  unregisterSendTarget,
  type SendOutcome,
  type SendPayload,
  type SendTarget,
  type ProjectFileSendSource,
} from '../lib/send-target.ts';

export interface OrgDeliveryDestination {
  id: string;
  kind: string;
  label: string;
  formats: string[];
  maxBytes: number;
  visibility: 'private' | 'public';
  projectFiles?: true;
}

interface DeliveryWire {
  id: string;
  destinationId: string;
  state: 'awaiting-approval' | 'queued' | 'delivering' | 'delivered' | 'failed' | 'rejected' | 'cancelled';
  approvalId?: string | null;
  url?: string | null;
  error?: string | null;
}

interface ErrorWire {
  error?: { message?: string; delivery?: DeliveryWire };
}

export type OrgDeliveryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const registryId = (destinationId: string): string => `org:${destinationId}`;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes: Uint8Array): Promise<string> {
  // Copy onto an ArrayBuffer-backed view: TS's generic Uint8Array may also be
  // SharedArrayBuffer-backed, which WebCrypto's BufferSource contract refuses.
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return hex(new Uint8Array(digest));
}

/** Stable across an explicit retry of the same bytes, but scoped to the fixed
 * target and filename so the server can reject accidental key reuse. */
export async function deliveryIdempotencyKey(
  destinationId: string,
  payload: Pick<SendPayload, 'bytes' | 'name' | 'format'>,
): Promise<string> {
  const bytesHash = await sha256(payload.bytes);
  const request = new TextEncoder().encode(
    `lolly-delivery-v1\0${destinationId}\0${payload.format.toLowerCase()}\0${payload.name}\0${bytesHash}`,
  );
  return `shell-v1-${await sha256(request)}`;
}

async function readWire(response: Response): Promise<DeliveryWire | ErrorWire | null> {
  try { return await response.json() as DeliveryWire | ErrorWire; }
  catch { return null; }
}

function errorMessage(response: Response, body: DeliveryWire | ErrorWire | null): string {
  const nested = body && 'error' in body && typeof body.error === 'object' ? body.error : undefined;
  const message = nested?.message;
  return message?.trim() || `Delivery failed (${response.status})`;
}

function outcome(destination: OrgDeliveryDestination, delivery: DeliveryWire): SendOutcome {
  return {
    ...(delivery.url ? { url: delivery.url } : {}),
    label: delivery.state === 'delivered'
      ? `Delivered to ${destination.label}`
      : delivery.state === 'awaiting-approval'
        ? `Approval requested for ${destination.label}`
        : `Delivery to ${destination.label} is queued`,
  };
}

export function createOrgDeliveryTarget(
  destination: OrgDeliveryDestination,
  instanceName: string,
  fetcher: OrgDeliveryFetch = instanceFetch,
): SendTarget {
  const complete = async (response: Response, assertCurrent?: () => void): Promise<SendOutcome> => {
    const body = await readWire(response);
    if (!response.ok) throw new Error(errorMessage(response, body));
    if (!body || !('state' in body) || typeof body.id !== 'string') throw new Error('The delivery service returned an unreadable receipt');
    if (body.state === 'rejected' || body.state === 'cancelled') throw new Error(body.error || `This delivery was ${body.state}`);
    if (body.state !== 'failed') return outcome(destination, body);
    assertCurrent?.();
    const retried = await fetcher(instancePath(`/api/v1/deliveries/${encodeURIComponent(body.id)}/retry`), { method: 'POST' });
    const retryBody = await readWire(retried);
    if (!retried.ok) throw new Error(errorMessage(retried, retryBody));
    if (!retryBody || !('state' in retryBody) || retryBody.state === 'failed' || retryBody.state === 'rejected' || retryBody.state === 'cancelled') {
      throw new Error(retryBody && 'state' in retryBody && retryBody.error ? retryBody.error : 'Delivery retry failed');
    }
    return outcome(destination, retryBody);
  };
  return {
    id: registryId(destination.id),
    kind: destination.kind,
    scope: 'organization',
    label: destination.label,
    formats: destination.formats.map((format) => format.toLowerCase()),
    sources: destination.projectFiles ? ['export', 'asset'] : ['export'],
    ...(destination.projectFiles ? { sendProjectFile: async (source: ProjectFileSendSource) => {
      if (!source.projectId || !source.fileId || !/^[a-f0-9]{64}$/.test(source.checksum)) throw new Error('Open the shared original again before sending');
      const base = getInstanceBase(), workspace = getSessionSource();
      const assertCurrent = () => {
        if (base !== getInstanceBase() || workspace !== getSessionSource()) throw new Error('The connected workspace changed. Open the file again.');
      };
      const query = new URLSearchParams({ projectId: source.projectId, fileId: source.fileId, checksum: source.checksum });
      const key = `project-v1-${await sha256(new TextEncoder().encode(JSON.stringify([destination.id, source.projectId, source.fileId, source.checksum, source.name ?? null])))}`;
      assertCurrent();
      return complete(await fetcher(`${instancePath(`/api/v1/destinations/${encodeURIComponent(destination.id)}/deliveries`)}?${query}`, {
        method: 'POST', headers: { 'idempotency-key': key },
      }), assertCurrent);
    } } : {}),
    requiresCredential: true,
    hint: destination.projectFiles
      ? `Send a shared original or signed export through ${instanceName}. The destination's access rules apply separately.`
      : `A signed Lolly export is sent through ${instanceName} to this organisation-managed destination. Personal destinations stay separate.`,
    available: () => true,
    async send(payload) {
      if (payload.bytes.byteLength > destination.maxBytes) {
        throw new Error(`${destination.label} accepts files up to ${destination.maxBytes} bytes`);
      }
      const path = `/api/v1/destinations/${encodeURIComponent(destination.id)}/deliveries`;
      const url = `${instancePath(path)}?name=${encodeURIComponent(payload.name)}&format=${encodeURIComponent(payload.format.toLowerCase())}`;
      const key = await deliveryIdempotencyKey(destination.id, payload);
      const response = await fetcher(url, {
        method: 'POST',
        headers: {
          'content-type': payload.mime || 'application/octet-stream',
          'idempotency-key': key,
        },
        body: payload.bytes.slice().buffer as ArrayBuffer,
      });
      return complete(response);
    },
  };
}

let activeIds: string[] = [];

/** Replace the active instance projection atomically from the registry's point
 * of view. Malformed descriptors are ignored; the server remains authoritative. */
export function applyOrgDeliveryTargets(
  destinations: readonly OrgDeliveryDestination[] | null | undefined,
  instanceName = 'your organisation',
): void {
  for (const id of activeIds) unregisterSendTarget(id);
  activeIds = [];
  if (!Array.isArray(destinations)) return;
  for (const destination of destinations) {
    if (!destination || !/^[a-z0-9][a-z0-9-]*$/i.test(destination.id)
      || !destination.label?.trim()
      || !Array.isArray(destination.formats) || !destination.formats.length
      || !Number.isFinite(destination.maxBytes) || destination.maxBytes <= 0) continue;
    const id = registryId(destination.id);
    registerSendTarget(createOrgDeliveryTarget(destination, instanceName));
    activeIds.push(id);
  }
}

export function clearOrgDeliveryTargets(): void {
  applyOrgDeliveryTargets(null);
}
