// SPDX-License-Identifier: MPL-2.0
/**
 * The agent-facing set beside /info/llms.txt - pure builders, wired in docs/build.ts
 * and pinned by tests/docs-agents.test.ts without building the site:
 *
 *   llms-full.txt          every English docs page in one file, in llms.txt order
 *   agents.md              the short guide for a machine reader: entry points, the URL
 *                          grammar, the three ways to get bytes, the rules that save a
 *                          round trip
 *   openapi.json           the HTTP surface in OpenAPI 3.1: the public GET render route
 *                          with its refusals, the catalog and manifest reads, the MCP
 *                          endpoint's transport and the OAuth discovery documents
 *   well-known-lolly.json  the discovery record, served as /.well-known/lolly.json
 *
 * Each is written under /info/ (the build's one output dir) and aliased to the site
 * root by vercel.json rewrites (ROOT_ALIASES, which the test checks against the real
 * vercel.json). The render-route facts here mirror services/mcp/src/render-get.ts and
 * render.ts; the test holds the format and MIME lists to those modules so the
 * description cannot drift from the code that answers the requests.
 */
import { PENPOT_MIME } from '../engine/src/penpot-file.ts';

export type Pathway = 'quickstart' | 'creators' | 'builders' | 'operators' | 'trust';

export interface AgentPage {
  slug: string;
  title: string;
  pathway: Pathway;
  /** The doored path under /info/ without extension, e.g. `build/ai-agents`. */
  path: string;
  isLanding?: boolean;
}

export interface AgentDocsOpts {
  url: string;
  description: string;
  engineVersion: string;
  pages: AgentPage[];
  /** slug → the page's markdown twin, for every page that has one. */
  mdBySlug: Map<string, string>;
  /** llms.txt section order + labels (the top nav). */
  sections: Array<{ pathway: Pathway; label: string }>;
  /** The full-tier MCP endpoint (a headless browser behind it). */
  mcpFull?: string;
}

/** Output filenames under /info/. */
export const AGENT_FILES = {
  llmsFull: 'llms-full.txt',
  agents: 'agents.md',
  openapi: 'openapi.json',
  wellKnown: 'well-known-lolly.json',
} as const;

/** Root URLs → the /info/ file each serves. vercel.json must carry each as a rewrite. */
export const ROOT_ALIASES: ReadonlyArray<{ source: string; destination: string }> = [
  { source: '/agents.md', destination: `/info/${AGENT_FILES.agents}` },
  { source: '/llms.txt', destination: '/info/llms.txt' },
  { source: '/llms-full.txt', destination: `/info/${AGENT_FILES.llmsFull}` },
  { source: '/openapi.json', destination: `/info/${AGENT_FILES.openapi}` },
  { source: '/.well-known/lolly.json', destination: `/info/${AGENT_FILES.wellKnown}` },
];

const MCP_FULL_DEFAULT = 'https://mcp.lolly.tools/mcp';
const SOURCE_URL = 'https://github.com/lolly-tools/lolly';

/**
 * The browser-free formats the public GET render route serves - TIER_A in
 * services/mcp/src/render.ts, plus png for SVG-native tools. Held to that set by the
 * test.
 */
export const RENDER_GET_FORMATS: readonly string[] = [
  'svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'exr', 'hdr', 'penpot',
  'html', 'md', 'txt', 'json', 'csv', 'ics', 'vcf', 'png',
];

/** Content-Type per format - mimeForFormat in services/mcp/src/render.ts (test-pinned). */
export const RENDER_GET_MIME: Readonly<Record<string, string>> = {
  svg: 'image/svg+xml',
  emf: 'application/x-msmetafile',
  eps: 'application/postscript',
  'eps-cmyk': 'application/postscript',
  dxf: 'image/vnd.dxf',
  exr: 'image/x-exr',
  hdr: 'image/vnd.radiance',
  penpot: PENPOT_MIME,
  html: 'text/html',
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  csv: 'text/csv',
  ics: 'text/calendar',
  vcf: 'text/vcard',
  png: 'image/png',
};

/** Served with `; charset=utf-8` - isTextFormat in services/mcp/src/render.ts (test-pinned). */
export const RENDER_GET_TEXT: readonly string[] = ['svg', 'html', 'md', 'txt', 'json', 'csv', 'ics', 'vcf', 'eps', 'eps-cmyk', 'dxf'];

/**
 * Byte-stable on the render route - the set docs/mcp.md "Reproducibility" promises.
 * Not on the list: ics (a required DTSTAMP), penpot (the archive records its creation
 * time), and exr/hdr/html, which are deterministic in content but not promised byte
 * for byte.
 */
export const RENDER_GET_BYTE_STABLE: readonly string[] = ['svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'md', 'txt', 'json', 'csv', 'vcf', 'png'];

export const MCP_TOOLS: readonly string[] = [
  'lolly_compile', 'lolly_inspect', 'lolly_measure', 'lolly_validate', 'lolly_diff', 'lolly_package',
  'lolly_list_tools', 'lolly_describe_tool', 'lolly_build_url', 'lolly_render',
  'lolly_transform', 'lolly_redact', 'lolly_verify',
];

export const MCP_RESOURCES: readonly string[] = [
  'lolly://catalog', 'lolly://assets', 'lolly://tokens',
  'lolly://tool/{id}', 'lolly://tool/{id}/preview', 'lolly://asset/{id}',
];

/** The reserved query keys an agent meets first; the whole set is documented in url-mode. */
const RESERVED_SHORTLIST = [
  'format', 'export', 'copy', 'width', 'w', 'height', 'h', 'unit', 'dpi', 'profile',
  'bleed', 'marks', 'password', 'filename', 'output', '_v', 'slot', 'full', 'lang', 'z',
];

function pagePath(o: AgentDocsOpts, slug: string): string {
  return o.pages.find((p) => p.slug === slug)?.path ?? slug;
}

/** https://host/info/<path>.md for a docs page. */
function twinUrl(o: AgentDocsOpts, slug: string): string {
  return `${o.url}/info/${pagePath(o, slug)}.md`;
}

// ── llms-full.txt ─────────────────────────────────────────────────────────────

export function buildLlmsFullTxt(o: AgentDocsOpts): string {
  const ordered: AgentPage[] = [];
  const landing = o.pages.find((p) => p.isLanding && o.mdBySlug.has(p.slug));
  if (landing) ordered.push(landing);
  for (const { pathway } of o.sections) {
    for (const p of o.pages) {
      if (p.isLanding || p.pathway !== pathway || !o.mdBySlug.has(p.slug)) continue;
      ordered.push(p);
    }
  }
  const body = ordered.map((p) => {
    const md = o.mdBySlug.get(p.slug)!.trimEnd();
    // A twin opens with its own H1 (the page title); only a twin without one gets
    // the title added, so no page is headed twice.
    const heading = /^#\s/.test(md) ? [] : [`# ${p.title}`, ''];
    return [
      `Source: ${twinUrl(o, p.slug)}`,
      `Page: ${o.url}/info/${p.path}.html`,
      '',
      ...heading,
      md,
      '',
    ].join('\n');
  });
  return [
    '# Lolly - full documentation',
    '',
    `> ${o.description}`,
    '',
    `Every English docs page in one file, in the order ${o.url}/llms.txt lists them.`,
    'Each section opens with the page title, the URL of its markdown twin and the URL of',
    `the HTML page. Engine ${o.engineVersion}. The short guide for agents is ${o.url}/agents.md.`,
    '',
    '---',
    '',
    body.join('\n---\n\n'),
  ].join('\n');
}

// ── agents.md ─────────────────────────────────────────────────────────────────

export function buildAgentsMd(o: AgentDocsOpts): string {
  const u = o.url;
  const mcpFull = o.mcpFull ?? MCP_FULL_DEFAULT;
  const formats = RENDER_GET_FORMATS.filter((f) => f !== 'png').map((f) => `\`${f}\``).join(', ');
  return `# Lolly for agents

Lolly turns a URL into a finished, on-brand file. A tool is a manifest, a template and
optional hooks - data, not code - and every input a tool takes is a query parameter.
Build the URL and you have built the asset: the same parameters render the same file in
the browser, on the desktop, in the terminal and over MCP. Engine ${o.engineVersion}.

This page is the short version for a machine reader. The full docs live at ${u}/info/
and every page there has a markdown twin at the same path with \`.md\` in place of \`.html\`.

## Entry points

| What | Where |
|---|---|
| This page | ${u}/agents.md |
| Docs index (llms.txt) | ${u}/llms.txt |
| Every docs page in one file | ${u}/llms-full.txt |
| Discovery record (JSON) | ${u}/.well-known/lolly.json |
| HTTP surface (OpenAPI 3.1) | ${u}/openapi.json |
| Format claims | ${u}/info/capabilities.json |
| Tool catalog (generated index) | ${u}/catalog/tools/index.json |
| One tool's manifest | ${u}/tools/{id}/tool.json |
| Sitemap | ${u}/info/sitemap.xml |

Fetch the catalog index once to learn the tool ids, then a manifest for the inputs.
Do not guess parameter names.

## A URL is the API

\`\`\`
${u}/#/tool/{id}?{input}={value}&{input}={value}&format={ext}&export
\`\`\`

- Every key that is not reserved is a tool input, named by its manifest \`id\` (or its
  shorter \`urlKey\`).
- Reserved keys control output: ${RESERVED_SHORTLIST.map((k) => `\`${k}\``).join(', ')}.
  \`export\` and \`copy\` are presence flags (download or copy on load), \`_v\` pins the
  tool version and \`z\` is a packed query. The complete set with meanings:
  ${twinUrl(o, 'url-mode')}
- Unknown keys are ignored and bad values fall back to defaults, so validate against the
  manifest before you emit a link.

## Getting bytes

1. **Hot-link render, no auth.** \`GET ${u}/tool/{id}.{ext}?{inputs}\` answers with the
   file for the browser-free formats - ${formats} - plus \`png\` for SVG-native tools.
   Tools with status \`official\` or \`community\` only; Content Credentials are off so the
   bytes are cacheable (a strong ETag, a day at the CDN); renders are rate-limited per
   address. The route is per deployment: switched off on lolly.tools, live on
   https://lolly.art. A \`404\` means the tool is not public there or the route is off; a
   \`400\` names the reason (a browser-tier format, an output bound, a query over 4096
   characters). Full contract: ${u}/openapi.json
2. **MCP.** \`${mcpFull}\` renders every format a tool declares (a headless browser sits
   behind it); \`${u}/api/mcp\` is the browser-free tier with the same tools. Both take
   the same bearer token, or an OAuth 2.1 flow with dynamic client registration -
   discovery at \`${u}/.well-known/oauth-authorization-server\`. Tools:
   ${MCP_TOOLS.map((t) => `\`${t}\``).join(', ')}. Resources:
   ${MCP_RESOURCES.map((r) => `\`${r}\``).join(', ')}. The intended flow is list, describe,
   render, and verify when you need to prove a file is an untouched export.
3. **CLI.** \`lolly {id} --{input}={value} --export={ext} --output={file}\` is the same
   parameter table with \`--\` in front; in a source checkout, \`pnpm run cli {id} ...\`.
   Vector and data formats need nothing installed. Raster, PDF and video run in a scoped
   headless browser (\`lolly install-browser\`), one render path with the app.

## Rules that save a round trip

- Read the manifest. Formats are per tool; only request one the tool declares.
- Asset inputs take catalog ids. Read \`lolly://assets\` (or the catalog index) first and
  never invent an id.
- Pin \`_v\` in automation so a tool update cannot change your output.
- Byte-stable: ${RENDER_GET_BYTE_STABLE.filter((f) => f !== 'png').map((f) => `\`${f}\``).join(', ')} and
  \`png\` from an SVG-native tool. Not byte-stable: \`pdf\` (creation dates), \`ics\` (a
  required DTSTAMP), \`penpot\` (the archive records its creation time), everything the browser tier paints (\`jpg\`, \`webp\`, HTML-layout
  \`png\`, \`gif\`, \`apng\`, \`webm\`, \`mp4\`) and anything carrying a Content Credential,
  which is signed with a fresh timestamp each time.
- Exports from the app and from \`lolly_render\` carry Content Credentials (C2PA) by
  default; the hot-link route never does. \`lolly_verify\` and \`lolly validate --json\`
  read them back with one shared verdict vocabulary.
- Tools with status \`experimental\` watermark their exports.
- A link's inputs are public by construction. Put no secrets in one.
- Uploads never travel in a URL. Device-local files are for the app, \`lolly_transform\`
  and the CLI.

## Read next

- Driving Lolly from an agent: ${twinUrl(o, 'ai-agents')}
- The MCP server: ${twinUrl(o, 'mcp')}
- URL mode, the whole parameter table: ${twinUrl(o, 'url-mode')}
- The CLI: ${twinUrl(o, 'cli')}
- Formats, one page each: ${u}/info/formats/
- Author a tool: ${twinUrl(o, 'authoring-tools')}
- Source: ${SOURCE_URL} (MPL-2.0)
`;
}

// ── openapi.json ──────────────────────────────────────────────────────────────

export function buildOpenApi(o: AgentDocsOpts): Record<string, unknown> {
  const u = o.url;
  const mcpFull = o.mcpFull ?? MCP_FULL_DEFAULT;
  const renderContent: Record<string, unknown> = {};
  for (const f of RENDER_GET_FORMATS) {
    const mime = RENDER_GET_MIME[f]!;
    renderContent[mime] ??= { schema: RENDER_GET_TEXT.includes(f) ? { type: 'string' } : { type: 'string', format: 'binary' } };
  }
  const errorResponse = (description: string) => ({
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  });
  const dim = (name: string, description: string) => ({
    name, in: 'query', required: false, description, schema: { type: 'number', exclusiveMinimum: 0 },
  });
  const renderParameters = [
    { name: 'id', in: 'path', required: true, description: 'The tool id, as listed in /catalog/tools/index.json.', schema: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$' } },
    { name: 'ext', in: 'path', required: true, description: 'The output format. png is served for SVG-native tools only.', schema: { type: 'string', enum: [...RENDER_GET_FORMATS] } },
    dim('width', 'Output width in `unit` (alias `w`). Physical units convert at `dpi`; the result may not exceed 10000 px.'),
    dim('height', 'Output height in `unit` (alias `h`).'),
    { name: 'unit', in: 'query', required: false, description: 'The unit width and height are given in.', schema: { type: 'string', enum: ['px', 'mm', 'cm', 'in', 'pt'], default: 'px' } },
    { name: 'dpi', in: 'query', required: false, description: 'Raster resolution for physical units.', schema: { type: 'number', minimum: 1, maximum: 1200, default: 300 } },
    { name: 'profile', in: 'query', required: false, description: 'Colour profile: `srgb`, `none` or a CMYK press condition such as `fogra39`.', schema: { type: 'string' } },
    { name: '_v', in: 'query', required: false, description: 'Pin the tool version so a tool update cannot change the output.', schema: { type: 'string' } },
    { name: 'lang', in: 'query', required: false, description: 'Locale for a tool that localises its output.', schema: { type: 'string' } },
    { name: 'z', in: 'query', required: false, description: 'A packed query (the compressed form the app mints for long links). Expanded server-side before the other keys are read.', schema: { type: 'string' } },
  ];
  return {
    openapi: '3.1.0',
    info: {
      title: 'Lolly',
      version: o.engineVersion,
      summary: 'Render on-brand files from URL parameters.',
      description: `${o.description}\n\nEvery key that is not reserved is a tool input, named by its manifest id. Read the manifest at /tools/{id}/tool.json (or call lolly_describe_tool over MCP) before building a request; the whole reserved set is documented at ${twinUrl(o, 'url-mode')}. Short guide: ${u}/agents.md`,
      license: { name: 'MPL-2.0', identifier: 'MPL-2.0' },
      contact: { url: SOURCE_URL },
    },
    externalDocs: { description: 'The docs, as markdown twins', url: `${u}/llms.txt` },
    servers: [
      { url: u, description: 'The reference instance. The hot-link render route is switched off here (404).' },
      { url: 'https://lolly.art', description: 'The public demo instance. The hot-link render route is live.' },
    ],
    tags: [
      { name: 'render', description: 'Files from URL parameters' },
      { name: 'catalog', description: 'What this deployment offers' },
      { name: 'mcp', description: 'The Model Context Protocol endpoint and its OAuth discovery' },
    ],
    paths: {
      '/tool/{id}.{ext}': {
        get: {
          tags: ['render'],
          operationId: 'renderTool',
          summary: 'Render a tool to a file (browser-free formats, no auth)',
          description: 'The canonical embed URL served for real: the query is the tool\'s inputs plus the reserved output keys. Public tool and catalog data only, nothing stored per request. Content Credentials are always off here, which is what makes the response deterministic for its URL and therefore cacheable; a credentialed render is one lolly_render call away. Self-hosters disable the route with LOLLY_DISABLE_RENDER_GET=1, after which every such URL returns 404.',
          parameters: renderParameters,
          'x-lolly-inputs': 'Any other query key is a tool input by manifest id (or urlKey); see /tools/{id}/tool.json.',
          responses: {
            '200': {
              description: 'The rendered file. Text formats carry `; charset=utf-8`.',
              headers: {
                ETag: { description: 'Strong: engine version, catalog build and the canonical URL.', schema: { type: 'string' } },
                'Cache-Control': { description: 'public, s-maxage=86400, stale-while-revalidate=604800', schema: { type: 'string' } },
                'Content-Security-Policy': { description: 'Always `sandbox`, so tool-authored markup never executes in the origin when navigated to directly.', schema: { type: 'string' } },
                'Content-Disposition': { description: 'inline; filename="{id}.{ext}"', schema: { type: 'string' } },
                'X-Robots-Tag': { description: 'noindex', schema: { type: 'string' } },
              },
              content: renderContent,
            },
            '304': { description: 'If-None-Match matched the ETag.' },
            '400': errorResponse('A format that needs the browser tier, png for a tool that is not SVG-native, an output bound exceeded (10000 px edge, dpi 1..1200) or a query over 4096 characters. The body names the reason.'),
            '404': errorResponse('Unknown tool, a tool whose status is not official or community, or a deployment with the route switched off. The same answer for all three.'),
            '429': { description: 'Too many renders from this address.', headers: { 'Retry-After': { schema: { type: 'integer' } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '500': errorResponse('The render failed.'),
          },
        },
        head: {
          tags: ['render'],
          operationId: 'renderToolHead',
          summary: 'Headers only, same status codes as GET',
          parameters: renderParameters,
          responses: { '200': { description: 'Headers as for GET, no body.' }, '304': { description: 'Not modified.' }, '400': { description: 'See GET.' }, '404': { description: 'See GET.' }, '429': { description: 'See GET.' } },
        },
      },
      '/catalog/tools/index.json': {
        get: { tags: ['catalog'], operationId: 'listTools', summary: 'The generated tool index for this deployment', responses: { '200': { description: 'Every tool with id, name, status, formats and version.', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/tools/{id}/tool.json': {
        get: { tags: ['catalog'], operationId: 'getToolManifest', summary: "One tool's manifest: inputs, defaults, formats, canvas size", parameters: [renderParameters[0]], responses: { '200': { description: 'The manifest, validated against schemas/tool.schema.json.', content: { 'application/json': { schema: { type: 'object' } } } }, '404': { description: 'No such tool.' } } },
      },
      '/info/capabilities.json': {
        get: { tags: ['catalog'], operationId: 'getCapabilities', summary: 'Format claims: reads, writes, round trips and metadata per format', responses: { '200': { description: 'The claims file.', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/.well-known/lolly.json': {
        get: { tags: ['catalog'], operationId: 'getDiscovery', summary: "This deployment's discovery record", responses: { '200': { description: 'Where the catalog, manifests, render route, MCP endpoints and agent files live.', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/api/mcp': {
        post: {
          tags: ['mcp'],
          operationId: 'mcp',
          summary: 'MCP over Streamable HTTP (JSON-RPC 2.0, POST)',
          description: `The browser-free tier. The full tier, with a headless browser behind it, is ${mcpFull}; same tools, same token. Tools: ${MCP_TOOLS.join(', ')}. Resources: ${MCP_RESOURCES.join(', ')}. Notifications are answered 202 with no body. Without a valid token the answer is 401 with a WWW-Authenticate header pointing at the protected-resource metadata.`,
          security: [{ bearer: [] }, { oauth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/JsonRpcRequest' } } } },
          responses: {
            '200': { description: 'A JSON-RPC response.', content: { 'application/json': { schema: { type: 'object' } } } },
            '202': { description: 'A notification was accepted.' },
            '401': { description: 'Missing or invalid token.', headers: { 'WWW-Authenticate': { schema: { type: 'string' } } } },
            '404': { description: 'MCP is not configured on this deployment.' },
          },
        },
      },
      '/.well-known/oauth-authorization-server': {
        get: { tags: ['mcp'], operationId: 'oauthServerMetadata', summary: 'OAuth 2.1 authorization server metadata (RFC 8414)', responses: { '200': { description: 'Issuer, endpoints, PKCE S256, dynamic client registration.', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
      '/.well-known/oauth-protected-resource': {
        get: { tags: ['mcp'], operationId: 'oauthResourceMetadata', summary: 'OAuth protected resource metadata (RFC 9728)', responses: { '200': { description: 'The resource and its authorization servers.', content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
    },
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', description: 'The instance access token, held by the operator.' },
        oauth: { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: `${u}/api/mcp/authorize`, tokenUrl: `${u}/api/mcp/token`, scopes: {} } }, description: 'Stateless OAuth 2.1 with PKCE and dynamic client registration at /api/mcp/register.' },
      },
      schemas: {
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
        JsonRpcRequest: { type: 'object', required: ['jsonrpc', 'method'], properties: { jsonrpc: { type: 'string', const: '2.0' }, id: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] }, method: { type: 'string' }, params: { type: 'object' } } },
      },
    },
  };
}

// ── well-known-lolly.json ─────────────────────────────────────────────────────

export function buildWellKnown(o: AgentDocsOpts): Record<string, unknown> {
  const u = o.url;
  return {
    name: 'Lolly',
    description: o.description,
    url: u,
    license: 'MPL-2.0',
    engine: o.engineVersion,
    source: SOURCE_URL,
    agents: `${u}/agents.md`,
    llms: `${u}/llms.txt`,
    llms_full: `${u}/llms-full.txt`,
    openapi: `${u}/openapi.json`,
    docs: `${u}/info/`,
    docs_markdown: `${u}/info/{path}.md`,
    sitemap: `${u}/info/sitemap.xml`,
    capabilities: `${u}/info/capabilities.json`,
    catalog: `${u}/catalog/tools/index.json`,
    tool_manifest: `${u}/tools/{id}/tool.json`,
    app: `${u}/#/tool/{id}?{query}`,
    render: {
      url: `${u}/tool/{id}.{ext}?{query}`,
      auth: 'none',
      formats: [...RENDER_GET_FORMATS],
      content_credentials: false,
      note: 'Per deployment: 404 where the route is switched off (lolly.tools), live on https://lolly.art. png only for SVG-native tools.',
    },
    mcp: {
      full: o.mcpFull ?? MCP_FULL_DEFAULT,
      light: `${u}/api/mcp`,
      auth: ['bearer', 'oauth2.1'],
      oauth_authorization_server: `${u}/.well-known/oauth-authorization-server`,
      oauth_protected_resource: `${u}/.well-known/oauth-protected-resource`,
      tools: [...MCP_TOOLS],
      resources: [...MCP_RESOURCES],
    },
  };
}

/** Every agent file, filename → text, ready to write under /info/. */
export function buildAgentDocs(o: AgentDocsOpts): Record<string, string> {
  return {
    [AGENT_FILES.llmsFull]: buildLlmsFullTxt(o),
    [AGENT_FILES.agents]: buildAgentsMd(o),
    [AGENT_FILES.openapi]: JSON.stringify(buildOpenApi(o), null, 2) + '\n',
    [AGENT_FILES.wellKnown]: JSON.stringify(buildWellKnown(o), null, 2) + '\n',
  };
}
