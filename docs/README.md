# Lolly documentation

Read the complete documentation at <https://lolly.tools/info>. This directory is the canonical source for Lolly and Lolly Work guides.

Edit page metadata and navigation in [manifest.json](manifest.json), then run `node scripts/sync-docs-navigation.ts` from the repository root. The generated declarations in `docs/build.ts`, this index, public search, Markdown and agent indexes all follow that manifest.

Lolly Work packages a generated, version-pinned subset for its existing console and offline installations. Update the source here; do not edit the generated Work copy. [The bundle instructions](work/README.md) describe the workflow.

Original Lolly prose is CC BY-SA 4.0; imported Work prose and screenshots retain their original MPL-2.0 terms and third-party notices. See [LICENSE](LICENSE) and [work/LICENSE](work/LICENSE). The generator and code examples remain MPL-2.0.

## Start here

| Guide | Source |
| --- | --- |
| Lolly: information and documentation | [site.md](site.md) |
| Quickstart | [quickstart.md](quickstart.md) |
| Make your first file | [make-something.md](make-something.md) |
| Questions & answers | [faq.md](faq.md) |
| Use Lolly at your organisation | [organisation.md](organisation.md) |
| Install Lolly | [install.md](install.md) |
| Supported environments | [supported-environments.md](supported-environments.md) |
| Glossary | [glossary.md](glossary.md) |
| About | [../README.md](../README.md) |
| What is Lolly? | [what-is-lolly.md](what-is-lolly.md) |
| Work status and roadmap | [work/status.md](work/status.md) |

## Create & use

| Guide | Source |
| --- | --- |
| Shared project assets | [project-asset-transfers.md](project-asset-transfers.md) |
| Create & use | [creators.md](creators.md) |
| Share a design with rules | [create-a-tool.md](create-a-tool.md) |
| Training courses | [training-creators.md](training-creators.md) |
| Using Lolly | [using.md](using.md) |
| Templates | [templates.md](templates.md) |
| The Brand Studio | [brand-studio.md](brand-studio.md) |
| 3D Studio | [3d-studio.md](3d-studio.md) |
| Profiles | [profile.md](profile.md) |
| Find and recover your work | [find-your-work.md](find-your-work.md) |
| Sync your devices | [sync.md](sync.md) |
| Import a design (Figma, Penpot, Illustrator, InDesign) | [design-import.md](design-import.md) |
| Rebrand a deck | [rebrand.md](rebrand.md) |
| Every format Lolly can open and make | [formats.md](formats.md) |
| Text in Design | [text-composition.md](text-composition.md) |
| Wide Colour and HDR | [hdr-editing.md](hdr-editing.md) |
| The sequence editor | [sequence-editor.md](sequence-editor.md) |
| Presenting with camera | [presenting.md](presenting.md) |
| Live pages that take the clicker | [interactive-pages.md](interactive-pages.md) |
| Agenda screens and programmes | [agenda.md](agenda.md) |
| Animating: keyframes, depth and a camera | [animating.md](animating.md) |
| Working together | [collaborate.md](collaborate.md) |
| Search | [search.md](search.md) |
| Ask Lolly | [ask.md](ask.md) |
| The Dashboard | [dashboard.md](dashboard.md) |
| Utility views | [utilities.md](utilities.md) |
| Your favourites | [favourites.md](favourites.md) |
| Exporting & Formats | [exporting.md](exporting.md) |
| How Lolly compares | [positioning.md](positioning.md) |
| Lolly compared, tool by tool | [compare.md](compare.md) |
| Lolly and Canva | [compare-canva.md](compare-canva.md) |
| Lolly and Adobe | [compare-adobe.md](compare-adobe.md) |
| Lolly and Figma | [compare-figma.md](compare-figma.md) |
| Lolly and rendering APIs | [compare-render-apis.md](compare-render-apis.md) |
| Lolly and online file converters | [compare-converters.md](compare-converters.md) |
| Lolly and Penpot | [compare-penpot.md](compare-penpot.md) |
| Lolly and brand portals | [compare-brand-portals.md](compare-brand-portals.md) |
| Browser Extension | [extension.md](extension.md) |
| Lolly for sales teams | [sales.md](sales.md) |
| Lolly for the newsroom | [press.md](press.md) |
| Lolly for marketing teams | [marketing.md](marketing.md) |
| Lolly for legal teams | [legal.md](legal.md) |

## Build & automate

| Guide | Source |
| --- | --- |
| Build & automate | [builders.md](builders.md) |
| Design tool contract | [design-tool-contract.md](design-tool-contract.md) |
| Learning integration | [learning-integration.md](learning-integration.md) |
| Authored text composition | [../engine/text-composition.md](../engine/text-composition.md) |
| Lolly architecture | [overview.md](overview.md) |
| Design Tokens | [design-tokens.md](design-tokens.md) |
| Token workflows | [token-workflows.md](token-workflows.md) |
| Document model draft | [document-model.md](document-model.md) |
| Constraints | [constraints.md](constraints.md) |
| Determinism | [determinism.md](determinism.md) |
| Reproducibility | [reproducibility.md](reproducibility.md) |
| Authoring Tools | [authoring-tools.md](authoring-tools.md) |
| Tool Skills | [tool-skills.md](tool-skills.md) |
| Tool manifests | [tool-manifest.md](tool-manifest.md) |
| Tool inputs | [tool-inputs.md](tool-inputs.md) |
| Structured inputs and canvas controls | [tool-structured-inputs.md](tool-structured-inputs.md) |
| Assets and file utilities | [tool-files.md](tool-files.md) |
| Templates and rendering | [tool-rendering.md](tool-rendering.md) |
| Tool templates and presets | [tool-starters.md](tool-starters.md) |
| Tool hooks and host capabilities | [tool-hooks.md](tool-hooks.md) |
| Composition and brand overlays | [tool-composition.md](tool-composition.md) |
| Publish and localize a tool | [tool-publishing.md](tool-publishing.md) |
| Authoring Assets | [authoring-assets.md](authoring-assets.md) |
| Host API | [host-api.md](host-api.md) |
| URL Mode | [url-mode.md](url-mode.md) |
| Inputs in URLs | [url-inputs.md](url-inputs.md) |
| Reserved URL parameters | [url-parameters.md](url-parameters.md) |
| Export and presentation URLs | [url-export.md](url-export.md) |
| App links and deep links | [url-app-links.md](url-app-links.md) |
| lolly CLI: create and process files | [cli.md](cli.md) |
| Render with the CLI | [cli-rendering.md](cli-rendering.md) |
| CLI file and media utilities | [cli-files.md](cli-files.md) |
| Production checks | [production-checks.md](production-checks.md) |
| CLI batch and automation | [cli-automation.md](cli-automation.md) |
| CLI verification and configuration | [cli-reference.md](cli-reference.md) |
| Signing from the terminal | [cli-signing.md](cli-signing.md) |
| TUI | [tui.md](tui.md) |
| MCP Server | [mcp.md](mcp.md) |
| AI Agents | [ai-agents.md](ai-agents.md) |
| Contributing Setup | [contributing-setup.md](contributing-setup.md) |
| Build Guide | [build-guide.md](build-guide.md) |
| Build the CLI and TUI | [build-terminal.md](build-terminal.md) |
| Build the desktop app | [build-desktop.md](build-desktop.md) |
| Build the mobile apps | [build-mobile.md](build-mobile.md) |
| Build with Open Build Service | [build-obs.md](build-obs.md) |
| Build the web container and Helm chart | [build-kubernetes.md](build-kubernetes.md) |
| Building for iOS | [ios-build.md](ios-build.md) |
| Read verified catalog resources | [catalog-resource-reading.md](catalog-resource-reading.md) |
| Data Transfer | [data-transfer.md](data-transfer.md) |
| Invite an agent to a document | [work/document-agents.md](work/document-agents.md) |
| Lolly Work API | [work/api.md](work/api.md) |
| lw CLI: administer an instance | [work/cli.md](work/cli.md) |

## Manage an organisation

| Guide | Source |
| --- | --- |
| Manage an organisation | [operators.md](operators.md) |
| Profiles, brands and tool configuration | [configuration.md](configuration.md) |
| Adoption & Governance | [adoption-governance.md](adoption-governance.md) |
| Identity and sessions | [work/identity.md](work/identity.md) |
| Account data controls | [work/account-lifecycle.md](work/account-lifecycle.md) |
| Design-system administration | [work/design-system-administration.md](work/design-system-administration.md) |
| Roles and grants | [work/permissions.md](work/permissions.md) |
| Policy and governance | [work/governance.md](work/governance.md) |
| Catalog and content | [work/catalog.md](work/catalog.md) |
| Asset previews | [work/file-preview.md](work/file-preview.md) |
| Off-boarding a DAM | [work/offboarding.md](work/offboarding.md) |
| Approvals | [work/approvals.md](work/approvals.md) |
| Rendering and sharing | [work/sharing.md](work/sharing.md) |
| Recover and inspect render jobs | [work/renders.md](work/renders.md) |
| Organisation delivery destinations | [work/delivery.md](work/delivery.md) |
| Manage organisation AI policy | [work/ai-policy.md](work/ai-policy.md) |
| Provider guides | [work/providers/README.md](work/providers/README.md) |
| WebDAV / Nextcloud | [work/providers/webdav.md](work/providers/webdav.md) |
| S3 / S3-compatible | [work/providers/s3.md](work/providers/s3.md) |
| Git raw manifest | [work/providers/git.md](work/providers/git.md) |
| Brandfolder | [work/providers/brandfolder.md](work/providers/brandfolder.md) |
| Optimizely CMP | [work/providers/optimizely-cmp.md](work/providers/optimizely-cmp.md) |
| Image Relay | [work/providers/imagerelay.md](work/providers/imagerelay.md) |
| Canto | [work/providers/canto.md](work/providers/canto.md) |
| Acquia DAM / Widen | [work/providers/acquia-dam.md](work/providers/acquia-dam.md) |
| IntelligenceBank | [work/providers/intelligencebank.md](work/providers/intelligencebank.md) |
| Cloudinary | [work/providers/cloudinary.md](work/providers/cloudinary.md) |
| Orange Logic | [work/providers/orange-logic.md](work/providers/orange-logic.md) |
| Penpot | [work/providers/penpot.md](work/providers/penpot.md) |
| Dropbox | [work/providers/dropbox.md](work/providers/dropbox.md) |
| Google Drive | [work/providers/gdrive.md](work/providers/gdrive.md) |
| Microsoft 365 / SharePoint | [work/providers/o365.md](work/providers/o365.md) |
| Preview a project transfer | [work/project-portability.md](work/project-portability.md) |

## Deploy & operate

| Guide | Source |
| --- | --- |
| Configure connector origins | [connector-origins.md](connector-origins.md) |
| Choose a deployment | [deployment.md](deployment.md) |
| CI qualification | [ci-qualification.md](ci-qualification.md) |
| Delivery deployment | [deploy-delivery.md](deploy-delivery.md) |
| Sovereign creative production | [sovereign-production.md](sovereign-production.md) |
| Deploy & operate | [operate.md](operate.md) |
| Run your own server | [work/self-host.md](work/self-host.md) |
| Release 1.1.1 | [work/release-1-1-1.md](work/release-1-1-1.md) |
| Release 1.1.0 (historical record) | [work/release-1-1-0.md](work/release-1-1-0.md) |
| Lolly Work architecture | [work/overview.md](work/overview.md) |
| Install Lolly Work | [work/install.md](work/install.md) |
| Official installation routes | [work/official-installations.md](work/official-installations.md) |
| Set up enterprise identity | [work/enterprise-identity.md](work/enterprise-identity.md) |
| Configure your first Work instance | [work/customer-setup.md](work/customer-setup.md) |
| Lolly Work deployment options | [work/deployment.md](work/deployment.md) |
| UpCloud, Evroc and fewer hosting services | [work/cloud-deployment.md](work/cloud-deployment.md) |
| Deploy with your platform team | [work/platform-deployment.md](work/platform-deployment.md) |
| WebAssembly and Kubewarden choices | [work/wasm-deployment.md](work/wasm-deployment.md) |
| Work instance configuration | [work/configuration.md](work/configuration.md) |
| Configure Work export signing | [work/c2pa.md](work/c2pa.md) |
| Cloudinary tenant verification | [work/providers/cloudinary-live-verify.md](work/providers/cloudinary-live-verify.md) |
| Orange Logic tenant verification | [work/providers/orange-logic-live-verify.md](work/providers/orange-logic-live-verify.md) |
| WebDAV live-verify runbook | [work/providers/webdav-live-verify.md](work/providers/webdav-live-verify.md) |
| Canto live-verify runbook | [work/providers/canto-live-verify.md](work/providers/canto-live-verify.md) |
| Image Relay live-verify runbook | [work/providers/imagerelay-live-verify.md](work/providers/imagerelay-live-verify.md) |
| IntelligenceBank live-verify runbook | [work/providers/intelligencebank-live-verify.md](work/providers/intelligencebank-live-verify.md) |
| Acquia DAM live-verify runbook | [work/providers/acquia-dam-live-verify.md](work/providers/acquia-dam-live-verify.md) |
| Operations runbook | [work/operations.md](work/operations.md) |
| Fast frontend updates | [work/frontend-updates.md](work/frontend-updates.md) |
| Public model verification reuse | [work/public-model-proof-reuse.md](work/public-model-proof-reuse.md) |
| Build a verified instance pack | [work/instance-pack-production.md](work/instance-pack-production.md) |
| Production evidence | [work/production-readiness.md](work/production-readiness.md) |
| Application release classification | [work/application-release-classification.md](work/application-release-classification.md) |
| Shell deployment workflow | [work/shell-deployment-workflow.md](work/shell-deployment-workflow.md) |
| Telemetry and dashboards | [work/telemetry.md](work/telemetry.md) |
| Audit log | [work/audit.md](work/audit.md) |

## Trust & security

| Guide | Source |
| --- | --- |
| Trust & security | [trust.md](trust.md) |
| The trade we never agreed to | [status-quo.md](status-quo.md) |
| Tenets | [tenets.md](tenets.md) |
| Input, not impersonation | [input-not-impersonation.md](input-not-impersonation.md) |
| Creative rights and credits | [creative-rights.md](creative-rights.md) |
| Content Credentials Identity | [content-credentials-identity.md](content-credentials-identity.md) |
| Content Credentials - Engineering | [content-credentials-engineering.md](content-credentials-engineering.md) |
| Security & Verification | [security-verification.md](security-verification.md) |
| Threat Model & Trust Boundaries | [threat-model.md](threat-model.md) |
| Parser Inventory | [parser-inventory.md](parser-inventory.md) |
| Server Surface | [server-surface.md](server-surface.md) |
| Verify It Yourself | [verify-yourself.md](verify-yourself.md) |
| AI evidence in Verify | [verify-ai-evidence.md](verify-ai-evidence.md) |
| Privacy Policy | [privacy.md](privacy.md) |
| Inclusive Design | [inclusive-design.md](inclusive-design.md) |
| Our AI Stance | [ai-stance.md](ai-stance.md) |
| Generated once, rendered the same | [ai-features.md](ai-features.md) |
| AI marking and the EU AI Act | [eu-ai-act.md](eu-ai-act.md) |
| Beatrice Warde | [beatrice-warde.md](beatrice-warde.md) |
| Shoulders of giants | [shoulders-of-giants.md](shoulders-of-giants.md) |
| Where work happens and what crosses the network | [work/security-platform.md](work/security-platform.md) |
| Work storage and data lifecycle | [work/data-lifecycle.md](work/data-lifecycle.md) |
