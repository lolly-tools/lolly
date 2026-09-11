// SPDX-License-Identifier: MPL-2.0
/**
 * penpot-api - a small pure client for the two Penpot RPC commands Lolly
 * uses (plans/178): list the user's projects, and import a `.penpot` archive
 * into one of them as a brand-new file.
 *
 * `import-binfile` replaced the old create-file + upload-file-media-object
 * pair, which was a no-op on Penpot 2.x: an `is-local=false` media row has no
 * library section to appear in since components-v2, so the render was orphaned
 * and the media trimmer collected it. An imported archive arrives on the canvas
 * as boards, with the brand's tokens and colours inside.
 *
 * The default base is NOT Penpot itself but the app-origin pass-through at
 * /api/penpot/rpc/<command>: Penpot's RPC answers cross-origin preflights with
 * a 401 and no Access-Control-Allow-Origin header, so a browser can never call
 * it directly - the proxy forwards the Authorization header and body verbatim
 * and stores nothing. Auth is a Personal Access Token sent as
 * `Authorization: Token <PAT>` on every call.
 *
 * Deliberately narrow: results are typed down to the fields the callers read,
 * get-all-projects POSTs JSON, import-binfile POSTs multipart and answers a
 * server-sent-event stream (parsed by the engine's `parsePenpotImportStream`),
 * and there are no retries - a failure surfaces as one thrown Error with the
 * status in it. Everything injectable (base, fetch) so tests run headless.
 */
import { parsePenpotImportStream } from '../../../../engine/src/penpot-file.ts';

export interface PenpotProject {
  id: string;
  name: string;
  /** The owning team, when the listing carried it - the workspace URL needs it. */
  teamId?: string;
  teamName?: string;
}
/** What one `import-binfile` call reports back. */
export interface PenpotImport { fileIds: string[]; sections: string[] }

export interface PenpotClientOpts {
  /** RPC base URL; defaults to the app-origin proxy. */
  base?: string;
  /** The user's Personal Access Token, forwarded as `Token <PAT>`. */
  token: string;
  /** Injectable fetch for tests / alternate shells. */
  fetchImpl?: typeof fetch;
}

export interface PenpotClient {
  listProjects(): Promise<PenpotProject[]>;
  /** Import one binfile-v3 archive as a NEW file in `projectId`. */
  importFile(name: string, projectId: string, file: Blob): Promise<PenpotImport>;
}

export const PENPOT_PROXY_BASE = '/api/penpot/rpc';

export function makePenpotClient({ base = PENPOT_PROXY_BASE, token, fetchImpl }: PenpotClientOpts): PenpotClient {
  const fetchFn = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const root = base.replace(/\/+$/, '');

  const post = (command: string, init: RequestInit, accept = 'application/json'): Promise<Response> =>
    fetchFn(`${root}/${command}`, {
      ...init,
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        // Penpot answers Transit by default; asking for plain JSON keeps the
        // narrow parse below honest. import-binfile answers SSE either way.
        Accept: accept,
        ...(init.headers ?? {}),
      },
    });

  const json = async (command: string, body: unknown): Promise<unknown> => {
    const res = await post(command, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Penpot ${command} failed (${res.status})`);
    return await res.json();
  };

  /** One project row, whichever key case the instance answers in. */
  const str = (row: Record<string, unknown>, ...keys: string[]): string | undefined => {
    for (const k of keys) { const v = row[k]; if (typeof v === 'string' && v) return v; }
    return undefined;
  };

  return {
    async listProjects() {
      const raw = await json('get-all-projects', {});
      if (!Array.isArray(raw)) throw new Error('Penpot get-all-projects returned an unexpected shape');
      return raw
        .filter((p): p is Record<string, unknown> =>
          !!p && typeof (p as { id?: unknown }).id === 'string' && typeof (p as { name?: unknown }).name === 'string')
        .map((p) => {
          const teamId = str(p, 'teamId', 'team-id');
          const teamName = str(p, 'teamName', 'team-name');
          return {
            id: p.id as string,
            name: p.name as string,
            ...(teamId ? { teamId } : {}),
            ...(teamName ? { teamName } : {}),
          };
        });
    },

    async importFile(name, projectId, file) {
      // The proven shape (plans/178 section 1): binfile v3, multipart, one archive.
      // No Content-Type header - FormData writes its own boundary.
      const form = new FormData();
      form.append('project-id', projectId);
      form.append('name', name);
      form.append('version', '3');
      form.append('file', file, `${name}.penpot`);
      const res = await post('import-binfile', { body: form }, 'text/event-stream');
      const text = await res.text();
      if (!res.ok) throw new Error(`Penpot import-binfile failed (${res.status})`);
      const out = parsePenpotImportStream(text);
      // Penpot streams progress per section and reports the outcome in the last
      // event: `end` carries the new file ids, `error` a hint worth showing.
      if (out.error) throw new Error(`Penpot refused the import: ${out.error}`);
      return { fileIds: out.fileIds, sections: out.sections };
    },
  };
}
