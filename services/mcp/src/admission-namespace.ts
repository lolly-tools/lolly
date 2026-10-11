// SPDX-License-Identifier: MPL-2.0
/** Separate gateway counters on one admission store; this is not caller identity. */
export function admissionNamespace(env: NodeJS.ProcessEnv): string {
  const value = env.LOLLY_MCP_ADMISSION_NAMESPACE ?? 'mcp';
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(value)) {
    throw new Error('LOLLY_MCP_ADMISSION_NAMESPACE must be 1-64 lowercase ASCII letters, digits, underscores or hyphens, starting with a letter');
  }
  return value;
}
