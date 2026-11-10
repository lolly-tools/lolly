# What is content sovereignty?

**Content sovereignty means retaining control over how your content is created, governed, stored and moved across the systems you choose.** It includes the editable work, the tools and dependencies needed to make the next version, and the decisions about who may use or share the result.

Lolly is an open-source creative platform built around content sovereignty. People make files on their own devices; Lolly Work adds organisation-controlled services for shared assets, policy, review and delivery. An existing digital asset management system (DAM) can remain the source of record for approved assets.

<!--i:eti-shield-check-->
## What control means in practice

| Question | What to look for | What Lolly provides |
|---|---|---|
| Can we keep making the work? | Available software, tools, fonts and permitted source files | Local rendering with prepared resources, open-source software and portable tools |
| Who sets the rules? | Explicit responsibilities for source access, permitted edits and release | Design-system rules and tool inputs; Lolly Work adds groups, grants and approval chains |
| Where does processing happen? | A choice supported by the actual workflow | Local production, plus optional shared services and server renders on organisation infrastructure |
| Can we keep editing? | Editable source and dependencies, rather than only a flattened download | Saved sessions and portable `.lolly` packages, subject to dependency availability and redistribution rights |
| Can we change systems? | Documented exports, mappings and a tested transition | Connected sources, permitted materialization and supported cutover paths with old-address aliases |
| Can we check the result? | Evidence bound to the actual output | Content Credentials and optional production checks, with their coverage and limits recorded |

::: note These controls have different boundaries
A source licence may restrict copying. A downloaded file cannot be recalled by withdrawing a server link. A signature records a claim and its signer; it does not establish design approval or permission from a rights holder.
:::

<!--i:eti-globe-->
## How this relates to data sovereignty

Data sovereignty commonly concerns authority over data, including its storage, processing and jurisdiction. Content sovereignty adds the ability to keep producing, editing and handing on creative work. Locating a database in a chosen country does not by itself preserve an editable design or the fonts needed to reproduce the design.

Self-hosting is one useful mechanism. Open source, portable formats, available dependencies, clear access rules and demonstrated recovery each answer another part of the question. A deployment still needs an operator, backups and decisions about connected services.

The [sovereign creative production guide](/info/sovereign-production.html) explains the narrower technical case where production, signing and verification happen locally. The [security overview](/info/work-security-platform.html) explains what changes when shared services are enabled.

<!--i:eti-folder-shared-->
## Can an existing DAM stay?

Yes. A DAM can continue to hold the approved library and its source records while Lolly makes new content from the assets the organisation exposes. Choosing content sovereignty does not require a migration.

[Use Lolly with your existing DAM](/info/use-with-dam.html) explains the responsibilities. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) records how a working connection supported adoption before a planned transition.

<!--i:eti-unlink-->
## Does sovereignty mean everything stays offline?

No. A prepared local workflow can run offline; collaboration, new sign-ins, remote sources and server jobs need their services. The useful question is which operations need a connection, what they send and who controls each endpoint. [Privacy](/info/privacy.html) lists the data flows.

<!--i:eti-repeat-->
## Does it guarantee an exact future render?

No. Software revisions, fonts, source availability and encoders can change results. Keeping editable work and dependencies helps preserve the ability to continue; exact reproduction needs its own evidence. Read [Reproducibility](/info/reproducibility.html) and [Production checks](/info/production-checks.html).

<!--i:eti-checklist-->
## Evaluate with your own content

Choose one recurring file. Keep its editable source, record its dependencies, make a permitted variant and check the exported result. Then test reopening, access withdrawal and recovery. If a DAM is involved, qualify the exact source files and permissions before widening use. [The DAM workflow](/info/dam-production.html) gives a worked sequence.
