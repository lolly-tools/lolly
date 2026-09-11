// SPDX-License-Identifier: MPL-2.0
/**
 * One-time export secrets supplied by an owning automation context (currently
 * the MCP browser tier). They deliberately do not participate in URL state,
 * history, share links, or saved sessions.
 */

export type AutomationExportSecretKind = 'pdf-password';

declare global {
  interface Window {
    __lollyTakeExportSecret?: (kind: AutomationExportSecretKind) => Promise<unknown>;
  }
}

/** Prefer an explicit URL value for normal interactive links. Otherwise, only
 * an immediate automation export may consume the browser-context binding. */
export async function takeAutomationExportPassword(
  autoExport: boolean,
  urlPassword: string | null | undefined,
): Promise<string | undefined> {
  if (!autoExport || urlPassword || typeof window === 'undefined') return undefined;
  const take = window.__lollyTakeExportSecret;
  if (typeof take !== 'function') return undefined;
  try {
    const value = await take('pdf-password');
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
