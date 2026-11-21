# How Lolly works

A Lolly tool holds the rules for one kind of file: the layout, the type, the colours and which parts other people may change. You, a colleague, a script or an AI agent fill in the fields, and every file follows those rules.

<!--i:eti-repeat-->
## One tool, your rules, many files

The brand rules live in the tool. Set up the tool once and every output gets the same type, colour and spacing, from one card to a spreadsheet of rows in a dozen languages.

![A wordmark tool with one field filled in: type, colour and spacing were settled when the tool was made](/info/shots/aud-rules-in-the-tool.svg)

The person making the hundredth file only types the words. You decide how the work is checked and who checks the work. Lolly leaves less to check and makes the next file faster.

<!--i:eti-users-->
## Who touches a tool

Three roles in an organisation work on one campaign card.

![A designer sets the rules once in a tool; a developer runs it from a script and anyone can fill in its fields; both make finished files](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **A designer sets the rules.** They lay out the card in Lolly Design with the brand's type and colours, then choose which fields stay open. They do this once, so nobody hand-localises the card again.
- <!--i:code--> **A developer scales the tool.** The same tool runs in a nightly script through the command line. A fresh chart or a new language version arrives without anyone reopening the design.
- <!--i:people--> **Anyone fills it in.** A sales rep on a plane, with no network and no design training, opens the tool and makes the card for tomorrow's meeting.
:::

The developer's fresh chart is a render like this one, made from a data string and a few settings:

![A titled stacked area chart, its three series banded in a cool palette, with axes, legend and title all placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

The rep's quick minute depends on the designer's rules and the developer's script. Every role works with the same tool.

<!--i:eti-train-->
## Four routes to a file

Every route runs the same engine on the same tool, so the file a script makes matches the one you preview in the app.

![URL parameters and command-line arguments become the same input model, run through one shared runtime and export bridge](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **In the app, one at a time.** Open a tool, fill in the fields and press **Export**. [Make your first file](/info/make-something.html) walks you through one.
- <!--i:layers--> **In the app, many at once.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) takes a pasted or imported table and renders one finished file per row.
- <!--i:cpu--> **From a script or an AI agent.** The [CLI](/info/cli.html) runs a tool headless, and the [MCP server](/info/mcp.html) lets an agent discover and run tools. A link to a tool carries its inputs too, so a link is a complete request.
- <!--i:server--> **Through your organisation's server.** [Lolly Work](/info/organisation.html) renders on the server under your organisation's sign-in and tool policy, keeps jobs it can resume and holds the output for download or approved delivery.

Which route a job can use depends on the tool's formats and what the host can do. Some formats need a browser, so the command line hands them to a browser tier. [Render with the CLI](/info/cli-rendering.html) lists which formats render where.

<!--i:eti-monitor-->
## What runs where

Making, editing and exporting run on your device, with no account. A feature that needs a server, such as Sync or sending a file to a connected service, connects only when you use that feature. With Lolly Work, shared projects, live team editing, approvals and server jobs use your organisation's server. [What runs where](/info/compare.html#what-runs-where) sets the two parts side by side.

<!--i:eti-graduation-cap-->
## Read next

- [Make your first file](/info/make-something.html), to try it now.
- [Start](/info/quickstart.html), to put your own design system in.
- [Automate](/info/builders.html), for the command line, links and agents.
- [Lolly architecture](/info/overview.html), for contributors: the engine, the shells and the rules that hold them together.
