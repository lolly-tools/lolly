# Partners' agents

::: intro eti-sparkles
A partner can work through an AI agent too. A token you issue for the agent sees what that
company's people see: the same tools, files, templates, input rules, company details and licence
gate. It reads your brand guidance and its company's details over your organisation's MCP endpoint,
and the files it makes record the company and programme, never the agent.
:::

![The Agent tokens card for Northwind IT: Rita's agent with its limits, where each figure comes from, today's use and the expiry, then the form that mints a token with a label, a lifetime, what it may do and its limits](shots/partner-agent-tokens.svg)

This page is part of [Run a partner programme](run-a-partner-programme.md).

<!--i:eti-user-check-->
## Give an agent a token

On the programme's page, or a company's, the **Agent tokens** card mints a token for the agent,
for the programme or one company. **Mint token** takes a label, the
company, the scopes, the days until the token expires and any limits, then shows the secret once,
with **Copy**. Anyone with `programme.manage` for a programme issues its tokens; a grant of
`programme.manage` on `programme:<id>` covers only that programme's tokens, its usage report,
View as and template review. The
server sets what the request cannot: the `automation` role, the programme's and company's groups and
the `partner` group.

::: warning The secret is shown once
Copy the secret and hand it to the partner's agent before you close the card.
:::

- **Scopes.** `render` and `catalog.read` by default; `documents` and `files` may be added, and so
  may `approvals.request` ([Partner approvals](partner-approvals.md#requests-from-partners-agents)).
  `delivery` and `audit.read` are refused for programme tokens: a delivery sends to your own
  destinations, and the audit holds people's names.
- **Tools.** A list inside the programme's own.
- **Expiry.** 90 days by default, between 1 and 365. The list marks a token with under 14 days
  left as expiring; no notice is sent.
- **Revoke** on the card, in two steps. A programme token is never moved out of its programme,
  only revoked. Ending the programme or company revokes its tokens.

<!--i:eti-gauge-->
## Limits and usage

Every token placed in a programme meets three limits:

| Limit | Default |
| --- | --- |
| Calls a minute | 120 |
| Renders a day, in UTC | 2,000 |
| Renders a month, in UTC | No cap |

The **Agent tokens** card shows each limit with where the figure comes from and today's use
against it, with what a limit turned away this week and when. **Change limits** sets a token's own
figures; a blank field takes the programme's. **Change the programme's limits** sets the figures
every token there starts with. The token's own figure wins, then its programme's, then the instance
default. A token over a limit is refused with plain words and the time to try again, such as "This
token has used its 2,000 renders for today. The budget renews at 00:00 UTC." A render the budget
cannot hold is refused whole.

::: details The Agent tokens card on the Limits and quotas tab
![The Agent tokens card on the Limits and quotas tab: the default calls a minute and renders a day, their maxima and the token lifetime bounds, each with its source](shots/partner-limits-tokens.svg)
:::

**What agents did**, on the same page, totals what each token did over the last 4 weeks or the
last 7 days, and **Download CSV** gives the same counts week by week or day by day: calls, renders,
batches, deliveries, approval requests and refusals, with totals per company and for the programme.
The counts hold no input values, prompts, titles, file names or agent names.

![What agents did over the last 4 weeks: calls, renders, batches, deliveries, approvals and refusals for Rita's agent, for Northwind IT and for Resellers, EMEA, then renders by tool](shots/partner-agent-usage.svg)

<!--i:eti-eye-->
## What an agent reads

The organisation MCP endpoint offers resources to a service token, each read counted as one call:

- `lolly-work://me`: the token's programme, company, scopes, tools, expiry, limits and today's use.
- `lolly-work://brand`, with `DESIGN.md` and the design tokens: your brand guidance. A published
  [brand page](/info/brand-page.html) supplies these when you serve one; otherwise Lolly Work writes
  them from your design system. Brand skills reach a partner's agent only when marked `public`.
- `lolly-work://partner/company` and its logos: the token's own company, never another.
- `lolly-work://partner/kit` and its logos, `lolly-work://partner/kit/logo/{surface}`: the partner
  kit of the token's own company. Both need `catalog.read`.
- `lolly-work://partner/templates`: the templates in the token's feed, with what each leaves open,
  what it takes from the company and whether it is retired.

The same answers are at `GET /api/v1/context/*` for REST callers.

<!--i:eti-file-plus-->
## Templates by purpose

An agent can ask for a piece by what the piece is for, with `resolve_intent`, rather than by tool.
When the agent asks, your templates are offered where their purposes fit. Set a template's purposes
with **Purposes** on the programme's **Templates** card, which then reads, for example, "This
template is for: Promote · Banner, Social landscape". Inputs the company fills count as given, so an
agent for Northwind IT is never asked for the partner's mark or the company name. A retired
template is never offered.

<!--i:eti-map-pin-->
## Worked example: Northwind IT

The worked example on [Run a partner programme](run-a-partner-programme.md#set-up-a-programme)
follows Northwind IT, a reseller in Resellers, EMEA, through every subject. Its seventh step happens
here.

### 7. Give Rita's agent a token

**Console.** On Northwind IT's page, use the **Agent tokens** card. Give the label "Rita's agent",
keep the default scopes and the 90 days until the token expires, and press **Mint token**. Copy
the secret, which is shown this one time, press **I have copied it** and hand the secret to Rita.

**`lw`.**

```bash
lw tokens add --programme resellers-emea --company northwind-it --label "Rita's agent"
```

::: details Step 7 with the API
```
POST /api/v1/programmes/resellers-emea/tokens
{ "label": "Rita's agent", "company": "northwind-it" }
```

The answer is `201` with the token's `id` (`tok_…`), `label`, `company`, `scopes` (`render` and
`catalog.read` by default), `expiresAt` (90 days on), its limits and today's use, and `token`, the
secret (`lwt_…`). The secret appears in this answer only.
:::

**Rita's agent** connects to your organisation's MCP endpoint with the secret. It sees what Rita
sees, renders the data sheet with only the price, colourway and mode open, and its files record
Northwind IT, never the agent.

Next: [8. End the partnership on a date](partner-people.md#8-end-the-partnership-on-a-date).

<!--i:eti-sliders-->
## Every option

- Minting, scopes, expiry and placing an existing token: [Programme tokens](partner-programmes.md#programme-tokens)
- Every limit, its commands and the refusal codes: [Limits and usage](partner-programmes.md#limits-and-usage)
- Resources and their REST twins: [What an agent reads](partner-programmes.md#what-an-agent-reads)
- Purposes, and describing a render from a template: [Templates by purpose](partner-programmes.md#templates-by-purpose)
- Review requests and delivery: [Approvals for agents](partner-programmes.md#approvals-for-agents)
- The instance limits for every area: [Limits and quotas](partner-programmes.md#limits-and-quotas)
