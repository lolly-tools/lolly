// SPDX-License-Identifier: MPL-2.0
import { DesignHierarchyError, designHierarchyIndex, designHierarchyAncestors, designHierarchyDescendants, designHierarchyBounds, designHierarchyFlags, migrateDesignHierarchy, validateDesignHierarchy, type DesignHierarchyRow } from '../../engine/src/design-hierarchy.ts';
import { applyLayerOperations, applyLayerPatches } from '../../engine/src/design-layer-ops.ts';
const encoder = new TextEncoder();
export class DesignHierarchyRefusal extends Error {}
export function hierarchyInvariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new WebAssembly.RuntimeError(`Design hierarchy invariant: ${message}`);
}
/** Controlled validation refusals stay distinct from unexpected output failures. */
export function invokeDesignHierarchy(bytes: Uint8Array): void {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); }
  catch (error) { if (error instanceof SyntaxError) throw new DesignHierarchyRefusal(error.message); throw error; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DesignHierarchyRefusal('Expected a document record.');
  const wire = value as Record<string, unknown>;
  if (!Array.isArray(wire.boxes) || !Array.isArray(wire.pages)) throw new DesignHierarchyRefusal('Expected layer and page arrays.');
  const boxes = wire.boxes as DesignHierarchyRow[], pages = wire.pages;
  const findings = validateDesignHierarchy(boxes, pages);
  if (findings.length) throw new DesignHierarchyRefusal(findings[0]!.message);
  const index = designHierarchyIndex(boxes, pages);
  hierarchyInvariant(index === designHierarchyIndex(boxes, pages), 'revision index was rebuilt');
  for (const [id] of index.byId) {
    const ancestors = designHierarchyAncestors(index, id), scope = designHierarchyDescendants(index, new Set([id]));
    hierarchyInvariant(!ancestors.includes(id) && new Set(ancestors).size === ancestors.length && ancestors.length <= 64, 'invalid ancestry');
    hierarchyInvariant(scope.has(id) && [...scope].every(child => index.pageById.get(child) === index.pageById.get(id)), 'subtree changed page');
    const bounds = designHierarchyBounds(index, scope);
    hierarchyInvariant(!bounds || Object.values(bounds).every(Number.isFinite), 'non-finite bounds');
    const flags = designHierarchyFlags(index, id);
    hierarchyInvariant(typeof flags.hidden === 'boolean' && typeof flags.locked === 'boolean', 'invalid flags');
  }
  let migrated: ReturnType<typeof migrateDesignHierarchy>;
  try { migrated = migrateDesignHierarchy(boxes, pages); }
  catch (error) { if (error instanceof DesignHierarchyError) throw new DesignHierarchyRefusal(error.message); throw error; }
  if (migrated.findings.length) throw new DesignHierarchyRefusal(migrated.findings[0]!.message);
  hierarchyInvariant(validateDesignHierarchy(migrated.boxes, migrated.pages).length === 0, 'migration produced an invalid graph');
  const operations = wire.operations ?? (boxes.length ? [{op:'remove',id:String(boxes[0]!.id),cascade:true}] : []);
  let edited: unknown[];
  try {
    edited = applyLayerOperations(boxes,operations,undefined,{pages});
    if (wire.patches !== undefined) edited = applyLayerPatches(edited,wire.patches,{pages});
  } catch (error) {
    if (error instanceof Error && /^(?:\/?layerOperations|\/layerPatches)/.test(error.message)) throw new DesignHierarchyRefusal(error.message);
    throw error;
  }
  hierarchyInvariant(validateDesignHierarchy(edited as DesignHierarchyRow[],pages).length===0,'agent operations produced an invalid graph');
  const canonical = JSON.stringify(migrated), restored = JSON.parse(canonical) as { boxes: DesignHierarchyRow[]; pages: DesignHierarchyRow[] };
  hierarchyInvariant(validateDesignHierarchy(restored.boxes, restored.pages).length === 0, 'canonical reparse failed');
  const rebuilt = designHierarchyIndex(restored.boxes, restored.pages);
  hierarchyInvariant([...rebuilt.byId.keys()].join('|') === [...designHierarchyIndex(migrated.boxes, migrated.pages).byId.keys()].join('|'), 'identity changed');
}
/** Seeds derive from the real migration writer and canonical document JSON. */
export async function designHierarchySeeds(): Promise<Uint8Array[]> {
  const box = (id: string, patch: DesignHierarchyRow = {}): DesignHierarchyRow => ({id,kind:'box',x:10,y:20,w:30,h:40,rot:0,...patch});
  const pages = [{id:'p1',name:'Drafts'}, {id:'p2',name:'Final'}];
  const legacy = migrateDesignHierarchy([box('a',{group:'old-tag'}),box('b',{group:'old-tag',x:80})]);
  const nested = { operations:[{op:'duplicate',id:'g',newId:'copy',childIds:{inner:'copy-inner',leaf:'copy-leaf'}},{op:'remove',id:'copy',cascade:true},{op:'reparent',id:'g',parentId:null,pageId:'p2',afterId:'other'}], patches:[{id:'g',set:{name:'Renamed'}}], boxes: [box('f',{kind:'frame',pageId:'p1'}),box('g',{kind:'group',frame:'f'}),box('inner',{kind:'group',group:'g',locked:true}),box('leaf',{group:'inner'}),box('other',{pageId:'p2'})], pages };
  const deep = { boxes: Array.from({length:65},(_,n)=>box(`g${n}`,{kind:'group',group:n?`g${n-1}`:''})), pages:[] };
  return [JSON.stringify({boxes:[],pages:[]}),JSON.stringify(legacy),JSON.stringify(nested),JSON.stringify(deep),JSON.stringify({boxes:[box('a',{group:'old-tag'}),box('b',{group:'old-tag',rot:90})],pages:[]})].map(wire=>encoder.encode(wire));
}
