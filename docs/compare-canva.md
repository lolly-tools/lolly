# Lolly and Canva

_Last checked: 28 September 2026._

Lolly makes on-brand graphics, social posts, presentations and layouts in the browser. Together with [lolly.work](https://lolly.work), it also supports shared projects, live work collaboration, approved assets and organisation policies.

## Where they overlap

Both let someone start from a template and produce a finished graphic without being a designer. Both support team workflows and brand controls: [Canva packages these in its business plans](https://www.canva.com/canva-business/); Lolly separates the creative apps from the organisation service.

Lolly runs standalone on your device with no account. lolly.work adds SSO, SCIM provisioning, roles, shared catalogues, approvals and usage reporting when your organisation needs them. It is part of the Lolly project, separately deployed and open source under MPL-2.0, like Lolly itself.

## Templates and teamwork

Canva combines a large template and stock library, apps and hosted team workflows in one service. That ready-made content and managed experience can be useful when choosing a starting point. See [Canva's templates](https://www.canva.com/templates/) and [apps marketplace](https://www.canva.com/apps/).

Lolly's tools encode permitted changes and can be reused in the browser, desktop app or CLI. A design can become a [tool with rules](/info/create-a-tool.html), and the same tool can produce many outputs from a table of values. lolly.work manages access, shared work and policy around those tools.

Live editing is available through both [private collabs](/info/collaborate.html), which connect two devices directly, and work collabs through an organisation's lolly.work instance. Work collabs include shared edits, cursors and saved team sessions. The current server deployment uses a single collaboration node; its scale and operating history differ from Canva's established service.

## Where the work lives

Standalone Lolly keeps creation and export on the device and can work offline once its assets are available. Work collaboration, team storage and server rendering use the organisation's configured services. This choice of deployment is the distinction: an organisation can operate both parts of Lolly itself, with no per-seat software licence charge, while paying for its own hosting and administration.

Content Credentials are optional for supported exports. lolly.work can sign server output with a configured organisation identity; a verifier must trust that identity before showing the signer as trusted. See [Content Credentials Identity](/info/content-credentials-identity.html) and the [combined-solution overview](/info/compare.html).

Canva is a trademark of its owner. This page describes where the two solutions overlap and is not affiliated with Canva.
