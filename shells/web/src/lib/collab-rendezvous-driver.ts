// SPDX-License-Identifier: MPL-2.0
/**
 * collab-rendezvous-driver (plans/138 Tier C, WP3) - bridges a plans/100 ceremony
 * to the shared-store signalling rendezvous, so two people who share a cloud can
 * pair without the QR/blob dance.
 *
 * It uses ONLY the ceremony's PUBLIC surface (`send`/`subscribe`/`state`) and the
 * existing token codec (`inviteFromToken`/`answerFromToken`) - it never reaches into
 * ceremony internals and adds no new ceremony effect. The invite/answer tokens are
 * exactly the strings the QR/link carry (`CollabInvite.signal` / `CollabAnswer.signal`
 * ARE the tokens), so the human path is untouched and cannot regress; a session uses
 * one channel or the other. All identity/op-guard checks stay where they are - this
 * only moves the two signalling blobs the humans would otherwise carry.
 *
 * The caller creates the ceremony with the real RTC effects and its role, then calls
 * the matching driver. The rendezvous carries only ciphertext at a hashed path (see
 * collab-rendezvous.ts).
 */

import {
  isCeremonyTerminal, type CeremonyMachine, type CeremonyState, type CollabAnswer,
} from '../collab/ceremony.ts';
import { inviteFromToken, answerFromToken } from '../collab/rtc-transport.ts';
import type { CodecResult } from '../collab/sdp-codec.ts';
import type { DecodedInvite } from '../collab/rtc-transport.ts';
import {
  publishOfferAwaitAnswer, awaitOfferPublishAnswer, type PathStore, type RendezvousOpts,
} from './collab-rendezvous.ts';

/** Injectable codecs (default to the real ones) so the driver tests without SDP. */
export interface RendezvousCodec {
  decodeInvite?(token: string): CodecResult<DecodedInvite>;
  decodeAnswer?(token: string): CodecResult<CollabAnswer>;
}
export type DriverOpts = RendezvousOpts & RendezvousCodec;

/** Resolve once the ceremony state satisfies `pick`, or reject if it goes terminal
 *  (or is aborted) first. Checks the current state immediately, then on each change. */
function waitForState<T>(machine: CeremonyMachine, pick: (s: CeremonyState) => T | undefined, opts: RendezvousOpts): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void): void => { if (done) return; done = true; off(); fn(); };
    const check = (s: CeremonyState): void => {
      const v = pick(s);
      if (v !== undefined) finish(() => resolve(v));
      else if (isCeremonyTerminal(s.phase)) finish(() => reject(new Error(s.detail || 'The collab ceremony ended before pairing.')));
    };
    const off = machine.subscribe(check);
    opts.signal?.addEventListener('abort', () => finish(() => reject(new Error('Rendezvous cancelled.'))), { once: true });
    check(machine.state); // in case it is already satisfied/terminal
  });
}

/**
 * INVITER: mint the offer, publish it to the rendezvous, wait for the joiner's
 * answer there, and feed it into the ceremony. Resolves once the answer is applied
 * (the ceremony then drives to connected on its own); rejects on timeout, a bad
 * answer token, cancel, or a terminal ceremony.
 */
export async function driveRendezvousInviter(
  machine: CeremonyMachine, store: PathStore, code: string, opts: DriverOpts = {},
): Promise<void> {
  const decodeAnswer = opts.decodeAnswer ?? ((t: string) => answerFromToken(t));
  machine.send({ type: 'invite' });                        // mint the offer
  const invite = await waitForState(machine, (s) => s.invite, opts);
  const answerToken = await publishOfferAwaitAnswer(store, code, invite.signal, opts);
  const parsed = decodeAnswer(answerToken);
  if (!parsed.ok) throw new Error(parsed.reason);          // retryable at the ceremony layer
  machine.send({ type: 'answer', answer: parsed.value });
}

/**
 * JOINER: wait for the inviter's offer on the rendezvous, hand it to the ceremony
 * (which probes the tool and mints the answer), then publish that answer back.
 * Resolves once the answer is published; rejects on timeout, a bad invite token,
 * cancel, or a terminal ceremony (e.g. a missing tool).
 */
export async function driveRendezvousJoiner(
  machine: CeremonyMachine, store: PathStore, code: string, opts: DriverOpts = {},
): Promise<void> {
  const decodeInvite = opts.decodeInvite ?? ((t: string) => inviteFromToken(t));
  await awaitOfferPublishAnswer(store, code, async (offerToken) => {
    const dec = decodeInvite(offerToken);
    if (!dec.ok) throw new Error(dec.reason);
    machine.send({ type: 'accept', invite: dec.value.invite });
    const answer = await waitForState(machine, (s) => s.answer, opts);
    return answer.signal;
  }, opts);
}
