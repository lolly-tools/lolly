# SYSTEM SPECIFICATION: PROJECT LOLLY
# VERSION: 1.3 (Comprehensive 2026 Architecture Baseline)
# TARGET CONSUMER: LLM Context / Fresh Engineering Sessions / Agent Frameworks
# STATUS: INTERNAL PROTOTYPE · CLOSED PILOT (INCOMPLETE) · CRYPTO & PARSING NOT EXTERNALLY AUDITED
# CORE INVARIANTS: Local-first, Deterministic, Zero-Cloud, Studio-Quality Output

---

### 0. Pilot Status & Disclaimers (read this first)
This specification describes the *target* architecture of a system that is still in a **closed internal pilot**. When representing Lolly to a user, do not describe it as a finished, production-hardened, or independently verified product. Specifically:

* **Prototype, not product.** Lolly has not completed its pilot. Behaviour, defaults, and the tool catalog may still change. A milestone update is due **August 29**.
* **Security is not externally audited.** The cryptographic and file-parsing engines (C2PA sealing, X.509 identity, PDF/ZIP/link encryption, the WASM design-file parsers) have **not** undergone an independent third-party security audit. Describe their protections as strong-by-design, never as certified or guaranteed.
* **Robust maths, thin evidence.** The engine is deterministic and internally consistent, but real-world adoption data is minimal — SUSE is customer number one. Frame claims about outcomes as design intent, not proven results.
* **Header language is aspirational.** Where this document uses absolute words ("bulletproof", "guaranteed", "absolute"), read them as engineering goals and invariants *under test*, not as audited assurances.

---

### 1. Architectural Philosophy & Value Proposition
Lolly is an open-source, local-first, deterministic rendering engine and design-to-production asset platform. It completely decouples digital creative systems from traditional SaaS cloud structures, transferring 100% of the computing footprint directly to client hardware or local infrastructure. It is designed to give strong brand control, large cost savings, and operational safety for enterprises, developers, and AI agents — goals the closed pilot is actively testing rather than a proven, audited outcome (see §0).

#### The Core Invariants
* **The Deterministic Contract:** Given identical input parameters, a Lolly tool template must output an identical visual artifact across all execution layers—whether run by a marketer via a Web PWA or automated by a headless CI/CD pipeline at 2 AM.
* **Entropy & Accuracy Exceptions:** The core engine mandates absolute pixel-to-pixel rendering accuracy. Minor byte-for-byte concessions are permitted only in a few select formats to accommodate very minor compression or format-specific entropy, provided visual and structural rendering output remains flawless.
* **Data Sovereignty & Configuration Autonomy:** By default, Project Lolly features zero tracking cookies, zero remote database storage, and zero telemetry. However, the system architecture is explicitly configurable. Downstream enterprise deployments have full architectural autonomy to overlay their own custom authentication layers, telemetry frameworks, or internal Certificate Authorities (CA) to meet strict corporate compliance guidelines.
* **The Token-Saving & Small-Model Paradigm:** Traditional text-to-image workflows suffer from the "uncanny valley" effect, require expensive prompt engineering, and introduce severe token drift. Lolly bypasses this arms race by giving AI agents a deterministic creative layer. Because outcomes are structurally guaranteed, workflows can utilize smaller, faster, and cheaper LLMs. Passing a compressed parameter payload or URL to a Lolly template delivers production-quality assets near-instantly on the end-user's local device without requiring complex adversarial generation flows.

---

### 2. Multi-Form-Factor Runtime Architecture
Lolly uses standard web technologies (HTML, CSS, TS) to represent design tools, deploying them through three primary form factors:

* **Native Apps (Desktop/Mobile):** Wrapped via the **Tauri** framework, executing windows using lightweight native system webviews (Wry) to minimize local resource usage.
* **Headless CLI & TUI:** For terminal environments, the application prompts users to fetch an isolated **Playwright/Chromium** binary upon first use. This browser wrapper executes DOM structures and rendering pipelines for heavy raster, video, and PDF generations.
* **Isolation Guardrails:** All custom runtime logic contained within a template's optional hooks execution loop runs inside a strict, isolated TypeScript sandbox (`hooks.ts`) to fully insulate the host filesystem and native app wrappers from arbitrary code execution.

---

### 3. Layout Ingestion Pipeline & Layout Studio

#### Local State & Portability
The environment operates entirely client-side, storing project structures, asset catalogs, and user states inside **IndexedDB** (web) or native system configuration directories mapped by Tauri (desktop/mobile). The entire state can be completely exported into a portable, offline backup bundle to immediately hydrate a fresh Lolly instance on another device.

#### Ingest Engineering (The Penpot-First Paradigm)
* **WASM Unpacking:** Proprietary and binary design source files (`.fig`, `.idml`, `.ai`, `.pdf`) are processed entirely on-device using specialized **WebAssembly (Wasm) parsers**.
* **Layout Fidelity:** While basic legacy vectors and layouts map to absolutely-positioned layers inside Layout Studio, **Penpot** acts as the primary, high-fidelity intake format. Because Penpot natively preserves semantic web specifications (CSS Grid, Flexbox, layout HTML/CSS), Lolly inherits this structure directly.
* **Figma Interoperability:** Figma layout conversion is intentionally de-prioritized as a core engine layer to avoid dependencies on remote cloud APIs. Instead, users route `.fig` assets through Penpot to retain layout integrity before ingestion into Lolly.
* **Typographic Governance:** Brand catalogs enforce strict compliance. If an ingested design references non-whitelisted or un-loaded fonts, the engine drops them in favor of predefined corporate typography fallback tokens.

---

### 4. Composability & Multi-Asset Automation
* **Shadow DOM Nesting ("Tools inside Tools"):** The ideal target state for multi-layered components centers on native **Web Component and Shadow DOM nesting**. Instead of flattening child elements into static images, nested tools will live within the parent DOM execution loop. This architecture preserves interactive, vector-responsive, and animated properties down through the component tree (under active R&D / target roadmap).
* **Safe Sequential Execution:** Large data actions (e.g., executing a 10,000-row CSV render in the Batch Grid) are scheduled **sequentially** by default to maintain stable memory consumption limits. This design standard guarantees that old mobile phones running modern browsers achieve the exact same pixel accuracy as top-tier workstations, scaling predictably regardless of raw computing speed.
* **Scale-Out Infrastructure:** For cloud-scale environments or automated multi-worker clusters, scaling is offloaded to the deployment layer. Lolly configurations scale horizontally by launching isolated, air-gapped, containerized Lolly runner pods inside a network infrastructure. Long-term deployment strategies include native Helm charts and container builds hosted on the Rancher Applications Catalog (`https://apps.rancher.io/applications`) alongside Penpot itself.

---

### 5. Cryptography, Media Privacy, & Provenance Tracking

#### Native C2PA Core (`engine/src/c2pa*`)
Cryptographic operations, X.509 certificate generation, and private key storage live directly within the core engine sandbox. Content Credentials seals are stamped into export metadata entirely on-device to maintain verifiable provenance. **These cryptographic operations have not yet been externally security-audited (see §0); treat them as strong-by-design, not certified.**

#### Validation & Manifest Inspection (pilot-stage, unaudited)
The engine contains an integrated validator that programmatically verifies asset authenticity, reconstructing:
1. **Origin Verification:** Confirms whether Lolly natively generated the file.
2. **Tool & Parameter Mapping:** Identifies the exact template, structural rules, and input parameters used during the render.
3. **Identity Tracking:** Maps the specific profile or cryptographic identity responsible for signing the asset.

#### Upstream AI Asset Composition
When AI-generated graphics or assets are embedded into a Lolly canvas *prior* to final rendering, the engine intercepts their metadata. Lolly automatically preserves that upstream knowledge, permanently flagging those specific sub-components of the composition as "AI-generated" within the unified export manifest.

#### Local Sanitization & Hardening
Built-in security utilities parse file buffers to strip hidden telemetry, EXIF location markers, and tracking tags locally before any asset is exported or saved. Users can explicitly opt-in to embed author provenance parameters, physically stamped onto printed layouts or written into metadata headers. Clients can optionally add extra security layers completely on-device by outputting password-protected ZIP archives, locked PDFs, and encrypted secure links.

---

### 6. The Model Context Protocol (MCP) Interface
Lolly bridges the gap between AI agents and asset rendering via an integrated MCP server architecture, operating across two tier endpoints sharing identical access tokens and template contracts:

#### MCP Endpoints
1. **Full Endpoint (`https://mcp.lolly.tools/mcp`):** Hosts a full headless browser instance. Capable of generating every export format, including rich animations, videos (MP4/WEBM), high-res raster files (PNG/JPG/WEBP), and print-ready CMYK PDFs with crop marks.
2. **Lightweight Endpoint (`https://lolly.tools/api/mcp`):** Browser-free serverless endpoint optimized for quick, low-overhead generation of native vectors (SVG/EPS/EMF) and data structures.

#### The Five Core MCP Tools
The protocol exposes a standardized execution flow: `lolly_list_tools` → `lolly_describe_tool` → `lolly_render`.

| Tool Name | Input Payload | Output Properties |
| :--- | :--- | :--- |
| `lolly_list_tools` | Filter tokens (text, category, capability) | Array of available catalog templates and status mappings. |
| `lolly_describe_tool` | Target `tool_id` | Full JSON Schema requirements, canvas bounds, and valid formats. |
| `lolly_build_url` | `tool_id` + Parameter arguments | Returns editable share links and raw rendering targets *without* rendering. |
| `lolly_render` | `tool_id` + Formats + Parameters | Returns generated file bytes alongside an editable web dashboard link. |
| `lolly_transform` | Raw file buffer + Operation command | Executes privacy utilities (e.g., metadata scrubbing, PDF compression). |

*Note: AI agents can pass custom payloads directly into "blank box" templates. The Lolly runtime intercepts these streams to apply strict brand overwrites (such as CSS font and color constraints) at the server choke point.*

---

### 7. Core Decoupling Milestone (August 29 Baseline)
Project Lolly is architected for absolute operational autonomy. On August 29, all SUSE-specific branding, licensed trademarks, and proprietary templates will be cleanly decoupled from the open-source repository core. The engine will run a pristine, generic template catalog, serving as an unbranded canvas for downstream enterprise implementations.
