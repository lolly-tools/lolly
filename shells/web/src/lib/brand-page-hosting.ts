// SPDX-License-Identifier: MPL-2.0
/**
 * Publishing a brand page to the connected instance, as a seam the organisation
 * layer fills. A shell with no instance, or an instance that has not turned brand
 * pages on, has no hosting here, and Download stays the way out.
 *
 * The org module registers the instance here and the Design System Setup sheets read
 * the report. Neither imports the other, and the organisation layer never imports a view.
 */

/** What publishing did. An instance with an approval chain holds a revision until it is approved. */
export interface BrandPagePublishedV1 {
  url: string;
  state: 'live' | 'pending' | 'unchanged';
}

export interface BrandPageHostingV1 {
  /** The instance's host name, for the button: "Publish to work.example.com". */
  host: string;
  /** The address pages are served from, with no trailing slash. */
  base: string;
  /** A chain must approve each revision before it goes live. */
  approval: boolean;
  /** The largest bundle the instance takes, in bytes. */
  maxBundleBytes: number;
  /** One explicit act: upload this folder. The instance serves it under the manifest's id. */
  publish(input: { bundle: Uint8Array }): Promise<BrandPagePublishedV1>;
}

/** The connected instance's address and offer, for an agent's setup. Never a token. */
export interface ConnectedInstanceV1 {
  host: string;
  mcpUrl: string;
  /** Present when this instance serves brand pages and this caller may publish one. */
  brandPages: BrandPageHostingV1 | null;
}

let current: ConnectedInstanceV1 | null = null;

/** The organisation layer's report. Null when no instance is connected. */
export function setConnectedInstance(instance: ConnectedInstanceV1 | null): void {
  current = instance;
}

export function connectedInstance(): ConnectedInstanceV1 | null {
  return current;
}
