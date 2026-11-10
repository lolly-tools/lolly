# Plan a DAM transition without disrupting content teams

**Keep the existing library usable while you map its content, responsibilities and approval practices to the next arrangement.** Lolly Work can connect supported sources before an organisation decides whether to keep the DAM or move content into its own storage. A working connection creates time for adoption; it does not complete a migration.

[SUSE's Brandfolder experience](/info/suse-brandfolder.html) records that approach in use: successful integration supported administrator change management, with migration planned for the end of December 2026.

**A transition in four stages:**

::: steps
- <!--i:eti-clipboard--> **[Take inventory](#inventory-content-and-responsibility-together)** Files, metadata, approval, rights, access and history, each with an owner.
- <!--i:eti-link--> **[Connect first](#connect-before-replacing-daily-work)** One source slice and one real task, with the DAM still authoritative.
- <!--i:eti-copy--> **[Rehearse the copy](#rehearse-the-copy-and-verify-the-gaps)** Copy a permitted set and compare it with direct downloads.
- <!--i:eti-folder-move--> **[Cut over](#cut-over-with-a-recovery-decision)** Once people are ready and acceptance checks pass, keeping the source until the result is accepted.
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

Start with an administrator-only source slice, run the [tenant checks](/info/work-provider-tenant-check.html) and introduce one real production task. Keep the original source authoritative while administrators and creators learn where each action belongs.

Map current approval responsibilities explicitly. Decide which source approvals stay upstream, which contributions need Lolly Work catalog review and which destinations need final-byte approval. Lolly Work's current chains are ordered steps, so a branching or parallel workflow needs a separately agreed process. [Approvals](/info/work-approvals.html) describes the supported rules.

<!--i:eti-copy-->
## Rehearse the copy and verify the gaps

Choose the destination before copying. The [offboarding path chooser](/info/manage/leave-a-dam.html#choose-your-offboarding-path) starts with self-hosted Lolly Work, Nextcloud and Git, then offers a separate export-and-upload route for existing hosted drives. The [S3 storage strategy](/info/manage/leave-a-dam.html#self-host-lolly-work-with-s3-storage) connects the Lolly Work installation, PostgreSQL, private object storage and a restore rehearsal. Use the [per-DAM onboarding and offboarding guides](/info/manage/provider-guides.html#dam-onboarding-and-offboarding) to check the source's specific limits.

For a supported exit source, materialize a representative permitted set into the intended durable store. Compare originals with direct source downloads, including multi-attachment assets and files with important metadata. Record failures individually and check what the copy preserves.

Use provider drift reporting to identify changes after a copy, within its documented timestamp limits. Keep any required history or rights evidence through a separately verified export when the connector does not carry those records.

Orange Logic currently exposes renditions through its connector and refuses cutover; Optimizely CMP is a source to retain rather than an exit target. A connector's presence in the directory does not establish a complete migration path. [Leave a DAM](/info/work-offboarding.html) gives the per-source conditions and commands.

<!--i:eti-users-->
## Prepare people for the next arrangement

Have administrators perform their own recurring tasks: curate a source, review a submission, change access, replace an asset and explain an expiry. Give creators one clear place to start each task during coexistence. Record which system is authoritative at every stage, and who handles corrections.

Agree acceptance checks before setting a final date. These should include required content and metadata, working references, allowed and refused access, review responsibilities and a restore rehearsal. Treat the migration schedule as conditional on those results.

<!--i:eti-folder-move-->
## Cut over with a recovery decision

Supported Lolly Work cutover moves copied identities and creates aliases for old source addresses.

::: warning Cutover is not an undo button
Cutover changes authority and disables a database-managed source; it is not a universal undo button. Preserve the source, storage backups and the mapping evidence until the organisation has accepted the result and agreed its recovery procedure.
:::

After cutover, check old references, representative originals, permissions and approval operations again. Retire the old service only after its retention, contract and recovery requirements have been addressed. If the organisation instead keeps the DAM, [the connected production workflow](/info/use-with-dam.html) remains a supported destination for the project.
