# Plan a DAM transition without disrupting content teams

**Keep the existing library usable while you map its content, responsibilities and approval practices to the next arrangement.** Lolly Work can connect supported sources before an organisation decides to keep the DAM or move content into its own storage. A working connection gives time for adoption but does not complete a migration.

[SUSE's Brandfolder experience](/info/suse-brandfolder.html) records this approach in use. A successful integration supported administrator change management, and migration is planned for the end of December 2026.

**A transition in four stages:**

::: steps
- <!--i:eti-clipboard--> **[Take inventory](#inventory-content-and-responsibility-together)** Files, metadata, approval, rights, access and history, each with an owner.
- <!--i:eti-link--> **[Connect first](#connect-before-replacing-daily-work)** One source slice and one real task, with the DAM still authoritative.
- <!--i:eti-copy--> **[Rehearse the copy](#rehearse-the-copy-and-verify-the-gaps)** Copy a permitted set and compare it with direct downloads.
- <!--i:eti-folder-move--> **[Cut over](#cut-over-with-a-recovery-decision)** When people are ready and acceptance checks pass. Keep the source until the result is accepted.
:::

<!--i:eti-clipboard-->
## Inventory content and responsibility together

| Area | Record before changing systems |
|---|---|
| Originals | Asset and attachment identities, formats, checksums and permitted copies |
| Metadata | Fields, taxonomy, collections and which mappings need manual work |
| Approval | What was reviewed, who owns the decision and whether the review applies to a source or a finished output |
| Availability and rights | Release dates, expiry, restrictions and the evidence behind permissions |
| Access | Groups, service credentials, external audiences and revocation behaviour |
| Dependencies | Saved designs, links, fonts and tools that refer to the library |
| History | Which prior bytes, metadata revisions and review records must remain accessible |

Assign an owner to each area. Files, historical decisions and administrative responsibilities may need different migration paths. Materializing files does not recreate a vendor's full history or workflow configuration.

<!--i:eti-link-->
## Connect before replacing daily work

Start with an administrator-only source slice, run the [tenant checks](/info/work-provider-tenant-check.html) and add one real production task. Keep the original source authoritative while administrators and creators learn where each action belongs.

Map current approval responsibilities. Decide which source approvals stay upstream, which contributions need Lolly Work catalog review and which destinations need final-byte approval. Lolly Work's current chains are ordered steps. A branching or parallel workflow needs a separately agreed process. [Approvals](/info/work-approvals.html) describes the supported rules.

<!--i:eti-copy-->
## Rehearse the copy and verify the gaps

Choose the destination before you copy. The [offboarding path chooser](/info/manage/leave-a-dam.html#choose-your-offboarding-path) starts with self-hosted Lolly Work, Nextcloud and Git, then offers a separate export-and-upload route for existing hosted drives. The [S3 storage strategy](/info/manage/leave-a-dam.html#self-host-lolly-work-with-s3-storage) covers the Lolly Work installation, PostgreSQL, private object storage and a restore rehearsal. Use the [per-DAM onboarding and offboarding guides](/info/manage/provider-guides.html#dam-onboarding-and-offboarding) to check each source's limits.

For a supported exit source, materialize a representative permitted set into the intended durable store. Compare originals with direct source downloads, including multi-attachment assets and files with important metadata. Record each failure and check what the copy keeps.

Provider drift reporting shows changes after a copy, within its documented timestamp limits. When the connector does not carry required history or rights evidence, keep those records through a separately verified export.

Orange Logic currently exposes renditions through its connector and refuses cutover. Optimizely CMP is a source to keep, not an exit target. A connector in the directory does not prove a complete migration path. [Leave a DAM](/info/work-offboarding.html) gives the per-source conditions and commands.

<!--i:eti-users-->
## Prepare people for the next arrangement

Have administrators do their own recurring tasks: curate a source, review a submission, change access, replace an asset and explain an expiry. Give creators one place to start each task while both systems run. Record which system is authoritative at each stage and who handles corrections.

Agree acceptance checks before you set a final date. Include required content and metadata, working references, allowed and refused access, review responsibilities and a restore rehearsal. The migration schedule depends on those results.

<!--i:eti-folder-move-->
## Cut over with a recovery decision

Supported Lolly Work cutover moves copied identities and creates aliases for old source addresses.

::: warning Cutover is not an undo button
Cutover changes authority and disables a database-managed source. Keep the source, storage backups and mapping evidence until the organisation has accepted the result and agreed its recovery procedure.
:::

After cutover, check old references, representative originals, permissions and approval operations again. Retire the old service only after its retention, contract and recovery requirements are addressed. If the organisation keeps the DAM instead, [the connected production workflow](/info/use-with-dam.html) remains a supported destination for the project.
