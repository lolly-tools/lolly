/**
 * Read a docs screenshot's OWN Content Credential at build time, so the credential
 * line each shot carries states what the file actually says rather than what the
 * site would like to claim.
 *
 * Every baseline under docs/shots/ is signed by scripts/build-docs-shots.ts (see
 * stampC2pa there): a C2PA 2.x manifest embedded in the SVG's <metadata> or in a
 * PNG/JPEG chunk, carrying a `c2pa.created` action, the claim generator, and a
 * `tools.lolly.export` assertion with the url-shot recipe. This module decodes that
 * and returns the handful of facts worth showing in one line.
 *
 * It deliberately does NOT verify signatures. Verification belongs in the browser,
 * on the reader's own machine, against the file they actually received - that is
 * what the line's "verify" link is for (#/verify?src=…). A build-time green tick
 * would be the site vouching for itself, which is precisely the claim a content
 * credential exists to replace. So: read the claims here, let the reader check them
 * there. A file with no readable credential returns null and gets no line at all,
 * rather than a line that quietly says less than it appears to.
 */
import { readFileSync, statSync } from 'node:fs';
import { extractC2paStore, parseC2paStore, decodeCbor, aiKind } from '../engine/src/c2pa-extract.ts';
import { parseCertificate } from '../engine/src/c2pa-verify.ts';

export interface ShotProvenance {
  /** Who signed it: the certificate's organisation, else its common name. */
  signer: string | null;
  /** Claim generator, e.g. "Lolly 1.90.0". */
  generator: string | null;
  /** When the claim was made, ISO-8601, from the c2pa.created action. */
  when: string | null;
  /** The tool named in the manifest, e.g. "URL Screenshot". */
  tool: string | null;
  /** Lolly's own export surface, e.g. "docs". */
  surface: string | null;
  /** Capture dimensions as the credential records them, e.g. "1440 × 1200 px". */
  dimensions: string | null;
  /** Set when the credential declares AI-generated or AI-composited content. */
  ai: 'generated' | 'composite' | undefined;
  /**
   * section 18.28 `c2pa.ai-disclosure` - the model the SIGNER named, e.g. "Claude Fable 5".
   * `modelName` when the disclosure carries one, else `modelIdentifier` (a PURL or
   * URI: uglier, and still the honest answer when it is all the file says).
   *
   * Self-asserted, like every other claim fact: it records what the writer declared,
   * not what a model actually did. Absent on every screenshot - a docs capture is
   * `digitalCreation` - and present on the banked mastheads/figures, which is what
   * it was added for (plan section 6: a model-name pill on the art's credential line).
   */
  model: string | null;
  /**
   * `contentProfile.humanOversightLevel` - fully_autonomous / prompt_guided /
   * human_validated (section 18.28.4). section 18.28.3 pairs it with digitalSourceType precisely
   * because the two answer different questions: "was a model involved" and "how
   * much of a human was". It stays out of the visible row (that row is width-bound
   * to one line) and rides in the credential trigger's accessible label.
   */
  oversight: string | null;
}

// A 27-locale build asks for the same ~155 files once per locale; the decode is
// cheap but re-reading 44 MB twenty-seven times is not. Keyed by mtime+size so a
// re-captured baseline is picked up within a watch session.
const cache = new Map<string, ShotProvenance | null>();

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const get = (m: unknown, k: string): unknown => (m instanceof Map ? m.get(k) : undefined);

/**
 * section 18.28's label, versions and repeats included - `c2pa.ai-disclosure`,
 * `c2pa.ai-disclosure.v2`, `c2pa.ai-disclosure__2`. Matched rather than compared
 * for the reason the engine's verifier matches it: a disclosure the spec renamed
 * by one version suffix would otherwise read as no disclosure at all.
 */
const AI_DISCLOSURE_LABEL = /^c2pa\.ai-disclosure(\.v\d+)?(__\d+)?$/;

export function readShotProvenance(path: string): ShotProvenance | null {
  let key: string;
  try {
    const st = statSync(path);
    key = `${path}:${st.size}:${st.mtimeMs}`;
  } catch {
    return null;
  }
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = decode(path);
  cache.set(key, out);
  return out;
}

function decode(path: string): ShotProvenance | null {
  try {
    const found = extractC2paStore(new Uint8Array(readFileSync(path)));
    if (!found) return null;
    const parts = parseC2paStore(found.store);
    const claim = decodeCbor(parts.claimBytes);

    // Claim generator. C2PA 2.x carries a claim_generator_info map ({name, version});
    // 1.x carried a free-text claim_generator string. Read both so a re-signed older
    // baseline still names its writer.
    const genInfo = get(claim, 'claim_generator_info');
    const genName = str(get(genInfo, 'name'));
    const genVer = str(get(genInfo, 'version'));
    const generator = genName ? (genVer ? `${genName} ${genVer}` : genName) : str(get(claim, 'claim_generator'));

    let when: string | null = null;
    let ai: ShotProvenance['ai'];
    let tool: string | null = null;
    let surface: string | null = null;
    let dimensions: string | null = null;
    let model: string | null = null;
    let oversight: string | null = null;

    for (const a of parts.assertions) {
      if (a.label.startsWith('c2pa.actions')) {
        const actions = get(decodeCbor(a.content), 'actions');
        const first = Array.isArray(actions) ? actions[0] : undefined;
        when ??= str(get(first, 'when'));
        // aiKind reads the IPTC digitalSourceType vocabulary: a docs screenshot is
        // digitalCreation, so this is normally undefined. It is read anyway - if a
        // shot ever captures AI-generated artwork, the line must say so rather than
        // the site deciding the distinction does not matter here.
        ai ??= aiKind(get(first, 'digitalSourceType'));
      } else if (a.label === 'tools.lolly.export') {
        const m = decodeCbor(a.content);
        tool = str(get(m, 'tool'));
        surface = str(get(m, 'surface'));
        dimensions = str(get(m, 'dimensions'));
        when ??= str(get(m, 'date'));
      } else if (AI_DISCLOSURE_LABEL.test(a.label)) {
        // section 18.28. Read LIBERALLY and never as a failure - the same posture the
        // engine's verifier takes (engine/src/c2pa-verify.ts): the CDDL requires
        // modelType, but a writer that omits it must not turn a good file into a
        // silent one. FIRST disclosure wins: section 1558 labels repeats `__1`, `__2` for
        // a multi-model pipeline, and one pill cannot honestly stand for two
        // models - /verify is where the full list belongs (report.aiDisclosures).
        if (model || oversight) continue;
        const m = decodeCbor(a.content);
        model = str(get(m, 'modelName')) ?? str(get(m, 'modelIdentifier'));
        const profile = get(m, 'contentProfile');
        oversight = str(get(profile, 'humanOversightLevel'));
      }
    }

    // Signer: the leaf of the COSE x5chain. Header 33 is the registered x5chain
    // label; older writers used the text label, in either header bucket.
    let signer: string | null = null;
    try {
      const cose = decodeCbor(parts.signatureBytes) as { tag?: unknown; value?: unknown };
      const [protBytes, unprotected] = (cose?.value ?? []) as unknown[];
      const prot = decodeCbor(protBytes as Uint8Array);
      const unprot = unprotected as Map<unknown, unknown> | null | undefined;
      const chain = get(prot, '33') ?? (prot instanceof Map ? prot.get(33) : undefined)
        ?? get(prot, 'x5chain') ?? unprot?.get(33) ?? unprot?.get('x5chain');
      const leaf = (Array.isArray(chain) ? chain[0] : chain) as unknown;
      if (leaf instanceof Uint8Array) {
        const cert = parseCertificate(leaf);
        signer = str(cert.subject.organization) ?? str(cert.subject.commonName);
      }
    } catch { /* an unreadable signature leaves signer null; the rest of the line stands */ }

    if (!signer && !generator && !when) return null;   // nothing worth a line
    return { signer, generator, when, tool, surface, dimensions, ai, model, oversight };
  } catch {
    return null;
  }
}
