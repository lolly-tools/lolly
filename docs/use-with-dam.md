# Use Lolly with your existing DAM

**Your digital asset management system can remain the source of record while Lolly helps people make new content from its approved assets.** Lolly Work connects a selected part of the library to Lolly tools, applies organisation access rules and adds shared review and delivery. Migration is optional.

This suits teams with a curated library and administrators who own its approval practices. They add production tools and keep those responsibilities visible.

<!--i:eti-link-->
## Choose your DAM integration

Each supported DAM has a guide with onboarding and offboarding sections. Each guide describes the implemented connector and the checks you still need on your tenant.

| DAM | Integration guide |
|---|---|
| Brandfolder | [Brandfolder integration with Lolly](/info/manage/provider-brandfolder.html) |
| Image Relay | [Image Relay integration with Lolly](/info/manage/provider-imagerelay.html) |
| Canto | [Canto integration with Lolly](/info/manage/provider-canto.html) |
| Acquia DAM / Widen | [Acquia DAM / Widen integration with Lolly](/info/manage/provider-acquia-dam.html) |
| IntelligenceBank | [IntelligenceBank integration with Lolly](/info/manage/provider-intelligencebank.html) |
| Cloudinary | [Cloudinary integration with Lolly](/info/manage/provider-cloudinary.html) |
| Orange Logic | [Orange Logic integration with Lolly](/info/manage/provider-orange-logic.html) |
| Optimizely CMP | [Optimizely CMP integration with Lolly](/info/manage/provider-optimizely-cmp.html) |

The [source directory](/info/manage/provider-guides.html#dam-onboarding-and-offboarding) links to both sections for each DAM. Drives, buckets and design sources have their own guides there.

<!--i:eti-sliders-->
## Which system controls each decision?

![Who decides what while a DAM stays the source: the source DAM keeps records and approval, Lolly Work's governed catalog sets exposure and dates, the Lolly tool sets what may change, with the rights process deciding whether a use is permitted, the finished output can pass Lolly Work's review, and an explicit delivery sends it to the chosen destination. Shaded steps are decided in Lolly and Lolly Work.](/info/diagrams/work-integrations/dam-decisions.svg)

Shaded steps are decided in Lolly and Lolly Work. The dashed line is the rights decision.

| Decision | Responsibility |
|---|---|
| Source record, current files and upstream approval | The connected DAM, within the selected connector's supported API |
| Which part of that library reaches Lolly | Lolly Work's provider configuration, exposure rules and mapped availability |
| What a person can change in a design | The Lolly tool and design system, plus Lolly Work input policies for governed operations |
| Who can review a submission or delivery | Lolly Work's configured approval chain and grants |
| Whether a particular use is licensed | The rights holder's permission and the organisation's rights process; source approval alone does not answer this |
| What leaves through an organisation destination | The explicit delivery action, its permission checks and any configured final-byte review |

The flow is: **source DAM → governed catalog → Lolly tool → finished output → chosen destination**. A source connection normally reads references and files. Outbound delivery has its own credentials and permissions.

<!--i:eti-flask-->
## Start with one workflow

1. Choose one recurring output, such as an event card, and identify its source assets and administrators.
2. Use the [provider guide](/info/work-provider-guides.html) to connect a narrow slice of the library. Preview the listing before you enable access.
3. Map approval, group exposure and availability where the connector supports them. Compare an original's checksum with a direct download from the source.
4. Open the assets in a tool, make a permitted variant and review its finished output. Test with a member who should have access and one who should not.
5. Change or withdraw a source upstream, refresh the connection and check listings, previews and new file reads.

[Create on-brand content from approved DAM assets](/info/dam-production.html) turns those checks into a campaign workflow. [SUSE's Brandfolder account](/info/suse-brandfolder.html) describes the adoption and change management behind this approach.

<a id="does-work-preserve-each-person-s-dam-permissions"></a>
<!--i:eti-user-check-->
## Does Lolly Work preserve each person's DAM permissions?

Current providers generally use one shared credential that an administrator configures. They do not sign each member into the source under that member's upstream identity.

::: warning Set exposure rules for the shared credential
Lolly Work exposure rules must restrict the credential's wider view to the intended audience. A successful connection does not prove the access configuration is correct.
:::

<!--i:eti-clock-->
## What happens when an asset expires?

Supported upstream availability windows combine with local lifecycle rules. The more restrictive rule wins. Approval filtering depends on the provider's signal and mapping. Some sources have no native approval or expiry field.

Listings can be cached. Upstream changes depend on refresh and file-access behaviour.

::: note A downloaded copy stays downloaded
Lolly Work cannot erase a copy someone already downloaded.
:::

Agree an acceptable refresh delay and test withdrawal for your workflow. [Catalog and content](/info/work-catalog.html) describes these boundaries.

<!--i:eti-badge-check-->
## Does an approved source make an approved export?

No. Source approval, permission for the proposed use, creative review and approval of finished bytes are separate decisions. Lolly Work supports review of exact owned source files and optional approval of staged organisation deliveries. Ordinary exports are not generally bound to reviewed final bytes. [Approvals](/info/work-approvals.html) explains the supported paths.

<!--i:eti-upload-->
## Can finished files go back to the DAM?

Only through a supported, explicitly configured write path. Brandfolder and Cloudinary have organisation delivery adapters; Optimizely CMP has a separate opt-in publish path. Source credentials never grant write authority automatically. Test the destination, readback and retry behaviour on your own tenant. See [Organisation delivery destinations](/info/work-delivery.html).

<!--i:eti-folder-move-->
## What if we later decide to move?

Keep the connection working while you plan. Supported materialization copies files into organisation storage. Cutover can move supported identities and keep aliases for old addresses. Neither promises a complete transfer of upstream history, rights records or workflows. [Plan a DAM transition](/info/dam-transition.html) covers the people and evidence; [Leave a DAM](/info/work-offboarding.html) covers the commands.

The [self-hosting strategy with S3 storage](/info/manage/leave-a-dam.html#self-host-lolly-work-with-s3-storage) explains how Lolly, Lolly Work, PostgreSQL and an organisation-controlled object store work together. It separates a writable migration destination from a read-only S3 source and from a destination for finished exports.

Use the [offboarding path chooser](/info/manage/leave-a-dam.html#choose-your-offboarding-path) to compare that route with Nextcloud, a self-hosted Git catalog or a separate export and upload to Google Drive, OneDrive / SharePoint or Dropbox. Open-source services you can run come first. Each path lists its transfer and connector limits.
