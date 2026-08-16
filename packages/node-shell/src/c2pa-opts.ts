// SPDX-License-Identifier: MPL-2.0
/**
 * The shared Content-Credentials payload for a Node-shell export: the "what was this
 * made from / where / when / how big" record matching the web shell's
 * tools.lolly.export enrichment, so a CLI- or TUI-made asset inspects as richly as a
 * browser-made one. Author details ride along only with the profile's explicit
 * `useDetails` opt-in (same gate as the web shell).
 *
 * Signing: ephemeral on-device by default (verifiers report it unverified, which is
 * the honest posture for an anonymous key). Pass `signer` (from
 * `signing-identity.ts`) to sign with an enrolled identity instead; the engine then
 * puts that chain in the manifest's x5chain and a verifier pinning the issuing root
 * reads the file as trusted.
 */
import { summarizeInputs, ENGINE_VERSION } from '@lolly/engine';
import type { embedC2pa, C2paSigner } from '@lolly/engine';
import type { Profile } from '@lolly-tools/core/host-v1';

/** The (unexported-by-name) options bag `embedC2pa` accepts. */
export type ExportC2paOpts = NonNullable<Parameters<typeof embedC2pa>[2]>;

export interface BuildExportC2paOpts {
  /** Which shell/service produced the bytes - lands in the environment assertion.
   *  'build' covers the generated-media pipeline (OG cards, previews, thumbnails). */
  surface: 'cli' | 'tui' | 'mcp' | 'docs' | 'build';
  manifest: { id: string; name?: string };
  /** The runtime's input model (`runtime.getModel()`), digested via summarizeInputs. */
  model: Parameters<typeof summarizeInputs>[0];
  format: string;
  /** Requested output dimensions, if any (values in `unit`, px default). */
  dims?: { width?: number | null; height?: number | null; unit?: string | null; dpi?: number | null };
  /** Credential validity window in days (URL mode's `c2pa=N`; default 30). */
  days?: number | null;
  profile?: Profile;
  /**
   * An enrolled signing identity (key + x5chain). Absent = the ephemeral
   * self-signed on-device signer, byte-for-byte the behaviour that shipped before
   * identities existed. Present, it also fixes the credential's validity window to
   * the CERTIFICATE's own window: `days` cannot extend a certificate, and a
   * manifest claiming a window its certificate does not have is exactly the kind of
   * over-claim a credential must never make.
   */
  signer?: C2paSigner;
  /** The identity certificate's own validity window, when `signer` is an identity. */
  signerValidity?: { notBefore: Date; notAfter: Date };
  /** Source manifests to carry forward as ingredients, e.g. a genAI bitmap the
   *  captured page contains, so its AI origin verifies independently on the output
   *  (Verify walks every manifest in the store, ingredients included). */
  ingredients?: ExportC2paOpts['ingredients'];
  /** Optional extra provenance actions (e.g. a COMPOSITE c2pa.created when the framed
   *  page shows AI-generated imagery). Omit to keep embedC2pa's default created step. */
  actions?: ExportC2paOpts['actions'];
  /**
   * §18.28 `c2pa.ai-disclosure`: the model that produced the essence, its
   * identifier, and the human-oversight level. Node surfaces that KNOW a trained
   * model made the bytes (the docs art bank; later, a generative tool run from
   * the CLI) pass it; nothing infers it, and nothing defaults it, because a
   * disclosure nobody asserted is a claim about a pipeline we did not observe.
   * §18.28.3: with `digitalSourceType: digitalCreation` the assertion is *not*
   * attached. The caller decides; this only forwards.
   */
  aiDisclosure?: ExportC2paOpts['aiDisclosure'];
  /**
   * The C2PA spec version the manifest declares (`claim_generator_info.specVersion`,
   * §10.2.3.2). Opt-in per surface: declaring it asserts the whole manifest was
   * written to that version, and defaulting it would silently change the bytes of
   * every existing export. Engine's `C2PA_SPEC_VERSION` is the value to pass.
   */
  specVersion?: ExportC2paOpts['specVersion'];
}

/** Build the embedC2pa options for a shell export, INCLUDING author from the profile. */
export function buildExportC2paOpts(o: BuildExportC2paOpts): ExportC2paOpts {
  const { surface, manifest, model, format, dims = {}, profile = {} } = o;
  const days = o.days ?? 30;
  const name = manifest.name || manifest.id;
  const inputs = summarizeInputs(model);
  const unit = dims.unit || 'px';
  const sizeLine = (typeof dims.width === 'number' && dims.width > 0 && typeof dims.height === 'number' && dims.height > 0)
    ? (unit !== 'px' ? `${dims.width} × ${dims.height} ${unit} @ ${dims.dpi || 300} DPI` : `${dims.width} × ${dims.height} px`)
    : undefined;
  return {
    title: name,
    claimGenerator: 'Lolly lolly.tools',
    generatorInfo: { name: 'Lolly', version: ENGINE_VERSION },
    environment: {
      surface, engine: `node ${process.version}`, os: process.platform,
      format, tool: name,
      date: new Date().toISOString(),
      ...(sizeLine ? { dimensions: sizeLine } : {}),
      ...(Object.keys(inputs).length ? { inputs } : {}),
    },
    ...(profile.useDetails === true && profile.firstname
      ? { author: { name: [profile.firstname, profile.lastname].filter(Boolean).join(' '), ...(profile.email ? { email: profile.email } : {}) } }
      : {}),
    ...(o.signer ? { signer: o.signer } : {}),
    // With an identity, the dates ARE the certificate's. `dates` only ever fed the
    // ephemeral certificate generator, and an enrolled signer brings its own.
    dates: o.signer && o.signerValidity
      ? { notBefore: o.signerValidity.notBefore, notAfter: o.signerValidity.notAfter }
      : { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + days * 86_400_000) },
    // Carry a genAI source forward so the record stays accurate (default drops both).
    ...(o.ingredients?.length ? { ingredients: o.ingredients } : {}),
    ...(o.actions?.length ? { actions: o.actions } : {}),
    ...(o.aiDisclosure ? { aiDisclosure: o.aiDisclosure } : {}),
    ...(o.specVersion ? { specVersion: o.specVersion } : {}),
  };
}
