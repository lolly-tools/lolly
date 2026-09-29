# Use Lolly at your organisation

Your organisation can run its own Lolly: the same app, with the tools and design system it chose. For sign-in, shared work and organisation policies, it can add **lolly.work**, the Lolly project's optional organisation service. The app and service are maintained as parts of the same project, with separate repositories and deployments. A standalone Lolly needs neither a work account nor this service.

This page shows how to reach your organisation's instance and what changes once you do.

::: note What you need from your organisation
The web address of its Lolly, or a `.lolly` setup file your organisation made. lolly.tools on its own does not connect to an organisation.
:::

::: details What lolly.work adds (optional)
Your organisation hosts [lolly.work](https://github.com/lolly-tools/lolly-work) alongside Lolly and chooses which features to enable:

- **Sign-in and access.** Organisation SSO, group-based permissions and managed profile fields. Administrators can provision and deactivate accounts through SCIM.
- **Shared work.** Team projects, shared sessions and [work collabs](/info/collaborate.html#work-collabs-with-lolly-work-optional), with live editing through the organisation's server.
- **A shared asset library.** Uploaded assets, collections and connected libraries, with access rules, versions and review.
- **Review and delivery.** Approval steps, managed links with expiry or revocation, and delivery to destinations the organisation permits.
- **Administration.** Usage reporting under the instance's telemetry policy, plus an audit record of governed actions.

These features send data to your organisation's instance. Personal saves and personal [Sync](/info/sync.html) remain separate. See [Privacy](/info/privacy.html#organisation-services-with-lolly-work) for the stored data and its controller.

If you are setting up the service, start with [Deployment](/info/deployment.html#organisation-services-with-lolly-work). The public [lolly.work](https://lolly.work) site is a demonstration sandbox; use your organisation's own address for work you need to keep.
:::

## In a browser

Open the address your organisation gave you. If the page asks you to sign in, press **Sign in** and follow the sign-in page it opens. After that it works like any Lolly, with your organisation's tools and design system.

A browser has no setting to switch to another Lolly, so open your organisation's own address rather than lolly.tools.

## In the desktop or mobile app

The first time the app starts, it asks **Where should Lolly get its tools?**

1. Choose **Connect to a Lolly instance**.
2. Enter your organisation's web address and press **Check & connect**.
3. Press **Use this instance**. The next screen, **Import your data (optional)**, brings saved work across from a Lolly backup; press **Skip** if you have none.
4. Sign in if the app asks.

Tools from a connected instance run with the same trust as the app's own, so connect only to one you trust. Your organisation may instead send you a `.lolly` setup file that connects the app for you.

To switch later, open **Settings**: the **Lolly instance** card has **Change** and **Leave**.

## Signing in with a code

If signing in on this device is awkward and your organisation's Lolly offers it, press **Sign in with a code on another device**. Lolly shows a short code and an address: open the address on a phone or computer where you are already signed in, and enter the code there. The code lasts about ten minutes.

## What is different there

- **Some controls are set for you.** A control your organisation governs shows **Managed by** and the organisation's name, or **Managed by your organisation**. A fixed control cannot be changed, a menu may offer only some of its choices, and a line starting **Set by** can say which rule applies and why. Some controls are not shown at all.
- **Only its tools are listed.** A tool your organisation does not offer is not shown at all.
- **Shared projects.** If your organisation shares projects with you, **Projects** shows a **Team projects** tile. These sessions live on the organisation's server. Open one to work on it, or start a [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) from **Share** when available.
- **Some exports may need approval.** Where your organisation asks for approval, **Request approval** takes the place of **Download**, and a tool may offer fewer formats.
- **Your own saves** stay on this device unless you turn on [Sync](/info/sync.html), as anywhere in Lolly.

## Leaving

**Leave**, on the **Lolly instance** card in **Settings**, removes your organisation's design system, tools and catalogue. Your own work stays. Anything you made with its tools will not open again until you reconnect, and anything you saved to the organisation stays with the organisation under its access and retention policies. Leaving or clearing this device does not delete that server copy. In a browser at your organisation's own address there is nothing to leave: open a different address instead.

## Who to ask

What reaches your organisation's server, who can see its shared projects and which settings are fixed are your organisation's decisions. Ask whoever runs your organisation's Lolly. [Privacy](/info/privacy.html) covers what Lolly itself does with your data.
