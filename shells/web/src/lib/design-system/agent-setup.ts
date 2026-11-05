// SPDX-License-Identifier: MPL-2.0
/**
 * Paste-ready MCP settings for the common clients. A setting refers to an environment
 * variable and never holds a token: nothing here is given one to hold.
 */

export const PUBLIC_MCP_URL = 'https://lolly.tools/api/mcp';
/** The one design system the public server draws with (docs/mcp.md). */
export const PUBLIC_SERVER_SYSTEM = 'Lolly Demo';
/** The variable an instance's settings read, the same one `lw mcp config` names. */
export const TOKEN_ENV = 'LW_TOKEN';

export type AgentClient = 'claude' | 'cursor' | 'vscode';

/** What to paste into a client, and where. `tokenEnv` is a variable's name and never a token. */
export function clientSetup(client: AgentClient, name: string, url: string, tokenEnv?: string): { where: string; text: string } {
  const header = (reference: string): { headers: Record<string, string> } => ({ headers: { Authorization: `Bearer ${reference}` } });
  if (client === 'claude') {
    return {
      where: 'Terminal',
      text: `claude mcp add --transport http ${name} ${url}${tokenEnv ? ` --header "Authorization: Bearer \${${tokenEnv}}"` : ''}`,
    };
  }
  if (client === 'cursor') {
    return {
      where: '.cursor/mcp.json',
      text: JSON.stringify({ mcpServers: { [name]: { url, ...(tokenEnv ? header(`\${env:${tokenEnv}}`) : {}) } } }, null, 2),
    };
  }
  return {
    where: '.vscode/mcp.json',
    text: JSON.stringify({ servers: { [name]: { type: 'http', url, ...(tokenEnv ? header(`\${env:${tokenEnv}}`) : {}) } } }, null, 2),
  };
}
