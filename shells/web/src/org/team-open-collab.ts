// SPDX-License-Identifier: MPL-2.0
/** Join while the document is opening, before its editor and layout are built. */
import type { CollabConnection } from '../lib/collab-mount.ts';
import type { CollabSessionHandle } from '../lib/collab-session.ts';
import type { TeamSessionOriginInput } from './team-session-origin.ts';
import type { connectWorkCollabSession } from './collab-work-opener.ts';

export interface TeamOpenCollabDeps {
  canJoin: () => boolean;
  connect: typeof connectWorkCollabSession;
  arm: (connection: CollabConnection) => boolean;
  watch: (sessionId: string, handle: CollabSessionHandle) => void;
}

type Wiring = Omit<TeamOpenCollabDeps, 'canJoin'>;
let preparation: { canJoin: () => boolean; load: () => Promise<Wiring> } | null = null;

/** The member initializer registers lazy wiring before a team link can open. */
export function registerTeamOpenCollabPreparation(canJoin: () => boolean, load: () => Promise<Wiring>): () => void {
  const registered = { canJoin, load };
  preparation = registered;
  return () => { if (preparation === registered) preparation = null; };
}

export interface PreparedTeamCollab {
  /** Called immediately before the document's navigation. */
  mount(): boolean;
  close(): void;
}

export async function prepareTeamOpenCollab(
  origin: TeamSessionOriginInput,
  current: () => boolean,
  deps?: TeamOpenCollabDeps,
): Promise<PreparedTeamCollab | null> {
  if (!deps) {
    const registered = preparation;
    if (!registered?.canJoin() || !current()) return null;
    deps = { ...await registered.load(), canJoin: () => preparation === registered && registered.canJoin() };
  }
  const { canJoin, connect, watch, arm } = deps;
  if (!canJoin() || !current()) return null;
  const wanted = (): boolean => current() && canJoin();
  const connected = await connect(
    { toolId: origin.toolId, sessionId: origin.sessionId, baseParts: [] },
    { canJoin, stillWanted: wanted },
  );
  if (!connected.ok) return null;
  const { connection } = connected;
  let spent = false;
  const close = (): void => {
    if (spent) return;
    spent = true;
    connection.close();
  };
  if (!wanted()) { close(); return null; }
  return {
    close,
    mount() {
      if (spent) return false;
      // The open's beforeNavigate may close its dialog, so current() is checked
      // before that step. Policy is still checked at the final handover.
      if (!canJoin()) { close(); return false; }
      spent = true;
      if (!arm(connection)) return false;
      watch(origin.sessionId, connection.handle);
      return true;
    },
  };
}
