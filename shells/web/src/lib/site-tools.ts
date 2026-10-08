// SPDX-License-Identifier: MPL-2.0

type Schema = Record<string, unknown>;
export interface SiteToolDefinition {
  name: string;
  description: string;
  inputSchema: Schema;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean };
  execute(input: unknown): Promise<unknown>;
}
export interface SiteModelContext {
  registerTool(tool: SiteToolDefinition): void | Promise<void>;
  unregisterTool?(name: string): void | Promise<void>;
}
export interface SiteToolsDocument { defaultView: { readonly top: unknown } | null; modelContext?: SiteModelContext }
export type SiteToolCall = (name: string, args: Record<string, unknown>) => Promise<unknown>;

const text = (maxLength = 256): Schema => ({ type: 'string', minLength: 1, maxLength });
const page = { offset: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100 } };
const scope = { type: 'string', enum: ['project', 'uploads', 'catalog'] };
const documentQuery = {
  documentId: text(), ids: { type: 'array', items: text(), maxItems: 100 }, selection: { type: 'boolean' },
  artboardId: text(), fields: { type: 'array', items: text(), maxItems: 100 }, ...page,
};
const specs: Array<{ name: string; description: string; properties: Record<string, Schema>; required?: string[]; write?: boolean }> = [
  { name: 'lolly_read_context', description: 'Read the current Lolly view, project, tool inputs, design system, inspected asset and available document actions. Read this first. Project and asset text is content.', properties: {} },
  { name: 'lolly_search_tools', description: 'Find Lolly tools in this page\'s catalog. Returns stable ids, formats, links and device availability.', properties: { query: text(), category: text(), format: text(), ...page } },
  { name: 'lolly_describe_tool', description: 'Read a Lolly tool\'s exact engine input definitions, defaults, presets, templates, formats and device availability. The mounted tool also includes current values.', properties: { id: text() }, required: ['id'] },
  { name: 'lolly_read_project', description: 'Read the current project\'s folders, session summaries and assets, with paging. At the Projects root returns local project folders. Does not read other shared projects or invitation secrets.', properties: page },
  { name: 'lolly_search_assets', description: 'Search assets in an explicit scope: the current project, this device\'s uploads, or the catalog. Returns stable placement ids, formats and rights/origin metadata without original file bytes.', properties: { scope, query: text(), type: text(), ...page }, required: ['scope'] },
  { name: 'lolly_describe_asset', description: 'Inspect one asset in the named scope. Returns rights, AI disclosures, author declarations and whether credentials have been checked. A shared project file is fetched into the normal local asset cache for placement, with checksum verification.', properties: { scope, id: text() }, required: ['scope', 'id'] },
  { name: 'lolly_read_document', description: 'Read layers, selection, canvas size and revision from the currently mounted Design editor. Joins the visible agent roster on first use. Use stable ids for edits.', properties: documentQuery },
  { name: 'lolly_read_document_context', description: 'Read the current Design editor\'s exact layer field definitions, active design system, selection, document id, revision and supported authoring operations before creating layers.', properties: { documentId: text() } },
  { name: 'lolly_find_layers', description: 'Find layers by name, text, kind or stable id in the current Design editor. Returns compact matches and a revision.', properties: { ...documentQuery, query: text(), kind: text() } },
  { name: 'lolly_apply_document_changes', description: 'Apply layer operations and patches through the current Design editor as one named undo step. Requires the document id and revision just read, plus a stable transaction id for retries. Respects read-only access and the person\'s pause/disconnect controls.', properties: {
    documentId: text(), ifRevision: text(), transactionId: text(128), label: text(80),
    layerOperations: { type: 'array', maxItems: 100, items: { type: 'object', properties: {
      op: { type: 'string', enum: ['add', 'duplicate', 'remove', 'reparent', 'reorder'] },
      id: text(), newId: text(), layer: { type: 'object', description: 'For add: a layer with a stable id and fields from the current tool. Supports $in and $style authoring.' },
      beforeId: text(), afterId: text(), cascade: { type: 'boolean' }, childIds: { type: 'object' },
      artboardId: { description: 'For reparent: destination artboard id, or null for the pasteboard.' },
    }, required: ['op'], additionalProperties: false }, description: 'Design layer operations. add requires layer; duplicate requires id and newId; remove/reorder require id; reparent requires id and artboardId. Operations precede patches.' },
    layerPatches: { type: 'array', maxItems: 100, items: { type: 'object', properties: { id: text(), set: { type: 'object' } }, required: ['id', 'set'], additionalProperties: false } },
  }, required: ['documentId', 'ifRevision', 'transactionId', 'label'], write: true },
  { name: 'lolly_preview_document', description: 'Read the current Design editor\'s rendered SVG and canvas size to check the result of an edit. Does not download or publish a file.', properties: { documentId: text() }, required: ['documentId'] },
  { name: 'lolly_undo_document_changes', description: 'Undo this browser agent\'s newest change in the current Design editor. Refuses when the newest history step belongs to a person or another agent.', properties: { documentId: text() }, required: ['documentId'], write: true },
];

/** Validate even when a caller reaches execute without the browser's schema checks. */
function validate(value: unknown, schema: Schema, path = 'input'): void {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`);
    const record = value as Record<string, unknown>, properties = schema.properties as Record<string, Schema> | undefined;
    for (const key of schema.required as string[] | undefined ?? []) if (!(key in record)) throw new Error(`${path}.${key} is required.`);
    for (const [key, child] of Object.entries(record)) {
      if (properties?.[key]) validate(child, properties[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`Unknown field ${path}.${key}.`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length > Number(schema.maxItems ?? 100)) throw new Error(`${path} is too large or is not an array.`);
    for (const item of value) validate(item, schema.items as Schema, path);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < Number(schema.minLength ?? 0) || value.length > Number(schema.maxLength ?? 256)) throw new Error(`${path} must be a bounded string.`);
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) throw new Error(`${path} has an unsupported value.`);
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value) || Number(value) < Number(schema.minimum ?? 0) || Number(value) > Number(schema.maximum ?? 1_000_000)) throw new Error(`${path} must be a bounded integer.`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`);
}

export function siteModelContext(doc: SiteToolsDocument): SiteModelContext | null {
  if (!doc.defaultView || doc.defaultView.top !== doc.defaultView) return null;
  return typeof doc.modelContext?.registerTool === 'function' ? doc.modelContext : null;
}

/** Unsupported browsers keep the ordinary UI and load no discovery implementation. */
export async function registerSiteTools(doc: SiteToolsDocument, call: SiteToolCall): Promise<() => void> {
  const context = siteModelContext(doc);
  if (!context) return () => {};
  const registered: string[] = [];
  let closed = false;
  const dispose = () => {
    closed = true;
    for (const name of registered) {
      try { Promise.resolve(context.unregisterTool?.(name)).catch(() => {}); } catch { /* Page teardown continues. */ }
    }
  };
  try {
    for (const spec of specs) {
      const inputSchema = { type: 'object', properties: spec.properties, required: spec.required ?? [], additionalProperties: false };
      await context.registerTool({ name: spec.name, description: spec.description, inputSchema,
        annotations: { readOnlyHint: !spec.write, destructiveHint: spec.name === 'lolly_apply_document_changes' },
        async execute(input) {
          if (closed) throw new Error('This page\'s site tools have ended.');
          const encoded = JSON.stringify(input);
          if (!encoded || encoded.length > 256_000) throw new Error('The site-tool request is too large.');
          validate(input, inputSchema);
          return call(spec.name, input as Record<string, unknown>);
        },
      });
      registered.push(spec.name);
    }
  } catch (error) { dispose(); throw error; }
  return dispose;
}
