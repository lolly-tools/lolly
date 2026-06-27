// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — wait-time quips.
 *
 * Short, cheeky two-line lines shown while a batch renders, to entertain during
 * a big job. `[Count]` is replaced with the number of renders in flight; the two
 * lines are split on the newline. Pure data + one formatter — the run loop in
 * index.js shuffles and rotates them. Delete this file + its call sites to drop
 * the whole bit.
 *
 * Voice: first-person, confident, self-deprecating. Themes to keep hitting —
 * local compute / privacy, free vs. an agency, open-source ribbing, raw speed,
 * "this is the most powerful way", and the sheer busywork of a batch.
 */

export const QUIPS = [
  // ── local compute / privacy ────────────────────────────────────────────────
  "Do you know where your data is going? Nowhere! it stays here.",
  "Your data's whole journey:\nthis device, then this device.",
  "[Count] to go, and they could be anything.\nYour well, specific things too.",
  "All of this is running on your machine.\nYes, that machine. Showoff.",
  "Somewhere a datacentre sits idle,\nfuming that you didn't call",
  "Someone else's datacentre is experiencing a lack of this app.",

  // ── free / vs. an agency ────────────────────────────────────────────────────
  "Relax, you have time, and I have [Count] hungry customers.",
  "If you had patience, you'd have hired an agency - wait that's budget.",
  "An agency would bill a week.\nI'm doing [Count] before your coffee's cold.",
  "[Count] files, one invoice: zero.\nTry not to make it weird.",
  "If this takes more than 20 seconds, you get 3 extra months free.",

  // ── open source ─────────────────────────────────────────────────────────────
  "This open source project can't cry\nWe're lacking in volun-tears.",
  "[Count] renders, zero license fees.\nA maintainer out there just nodded a confusing nod.",

  // ── raw speed / vs. AI ──────────────────────────────────────────────────────
  "Spitting out [Count] assets\nin the time it takes AI to ruin one.",
  "You think human designers are lazy?\nI literally do nothing when you're not around.",
  "I'm not imagining anything, I'm running a whole game here.",

  // ── on-brand / quality ──────────────────────────────────────────────────────
  "Did you want these marked -final-final-v8 ?\nOr am I still on v7?",
  "If any of these [Count] look less than perfect, I know the author's address.",

  // ── cheeky / killing time ───────────────────────────────────────────────────
  "I'm not burning many calories here, do you mind doing starjumps?",
  "You, me, a bag of mixed crayons, who's quickest?",
  "How many cups of water have you had today? I'm about to have almost none.",
];

/** Substitute [Count] and split into its (up to two) lines. */
export function quipLines(quip, count) {
  return String(quip).replace(/\[Count\]/g, String(count)).split('\n');
}
