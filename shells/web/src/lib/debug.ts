// SPDX-License-Identifier: MPL-2.0
/**
 * Dev-only debug logging. No-ops in the production build so the shipped app keeps
 * a quiet console (only the one boot greeting, plus genuine warnings and errors,
 * ever show). Source keeps calling debug() freely: in a dev build it forwards to
 * console.log; in prod it is an empty function the bundler inlines away. For real
 * problems use console.warn / console.error directly, which are never silenced.
 */
export const debug: (...args: unknown[]) => void = import.meta.env.PROD
  ? () => {}
  : (...args: unknown[]) => console.log(...args);
