# Set up and use the effective design system

Read the system used by the selected surface before choosing brand colours, type
or assets. Setup is optional for neutral exploration. A request to match an
identity needs evidence for that identity.

| Available material | Supported route |
| --- | --- |
| Active terminal system | `lolly system status`, then `lolly system context --json` |
| Lolly system pack, tokens, token ZIP, Penpot or SVG colours | `lolly system import <file>`, then inspect the imported context |
| One colour | `lolly system init --color=#7c3aed --name="My system"`; identify the result as derived |
| Logos, fonts or other source resources | `lolly system add <file...>`; retaining a resource does not prove a render uses that resource |
| Existing systems | `lolly system list`, then `lolly system use <id>` when switching is requested |
| Website or brand guide | Use an available Brand Studio source workflow or extract a candidate from supplied material; no CLI website-import command is implied |

CLI context resolves an explicit `--file`, then the active terminal system, then
the content profile's token document. A content profile chooses mounted packs;
an on-device system is a user's stored selection. A document may select a theme
or published version. Check the effective selection rather than assuming the
profile's head tokens describe a pinned render.

MCP `lolly://design-context` describes the connected server's profile. Live
`lolly_live_context` describes the actual open editor. A terminal import does not
change the browser's selected system. For concurrent terminal projects, an
isolated `LOLLY_STATE_DIR` keeps persistent selection scoped to the project.

Preserve declared token paths and aliases. Map observations to actual semantic
roles, separating source facts from derived suggestions. Exact white, square
corners and a single font family may be intentional. Read coverage: neutral or
derived sections are not proof of a client's approved system.

Inspect with `lolly system inspect`. Review candidate changes with `system diff`,
`generate` or `sync` before applying them through their documented options.
Retain source evidence and report a compact receipt: selected system/theme/version,
source material, declared versus derived roles, missing resources and checks run.
Verify fonts, weights and representative glyphs in an actual render; a requested
CSS family is not proof that the font resolved.

For handoff, `lolly system export --output=brand.lolly` writes a system pack.
Verify its resources and import on the receiving surface. A document `.lolly`
does not itself transport the design system; a plain share link does not carry
local uploads. Name the required system and package only permitted resources.
