# Lolly and Figma

_Last checked: 28 September 2026._

Lolly supports design, live editing and reusable asset production. [lolly.work](https://lolly.work) adds the organisation services around that work: identity, shared projects, access controls and approvals.

## Where they overlap

Both let you arrange type, shapes and images on a canvas and work with other people. Lolly's [Import a design](/info/design-import.html) reads Figma files as editable layouts. Figma also covers template-based brand production: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) creates assets from templates and fills them from CSV or XLSX files.

Lolly turns a design into a [reusable tool with rules](/info/create-a-tool.html). That tool runs in the browser or CLI and accepts inputs from a URL, a script or the batch grid. The same template supports an individual editing one asset and a team producing many variants.

## Collaboration and product design

[Figma Design](https://www.figma.com/design/) brings together interface design, components, interactive prototypes and developer handoff. Its established product-design workflow and ecosystem are relevant when a team needs to design and specify a complete application.

Lolly offers two kinds of live collaboration. A [private collab](/info/collaborate.html) pairs two devices directly, with no account and no internet needed on a shared network. A work collab uses lolly.work for authenticated access, shared edits, live cursors and saved team sessions. Work collaboration is implemented in both the Lolly client and lolly.work server; its current single-node deployment does not establish parity with Figma's operating scale.

## Deployment and production

Lolly's creative apps and lolly.work are separately deployed parts of the same open-source project. Standalone Lolly can render offline without an account. lolly.work supplies SSO, SCIM, shared catalogues, project permissions, approvals, audit records and server rendering on infrastructure the organisation controls.

Team sessions and work collab edits reach that instance; local renders can stay on the device. Content Credentials are optional for supported exports, and server signing uses a configured organisation identity. See the [combined-solution overview](/info/compare.html) for the separation and [Content Credentials Identity](/info/content-credentials-identity.html) for how a verifier trusts the signer.

Figma is a trademark of its owner. This page describes where the two solutions overlap and is not affiliated with Figma.
