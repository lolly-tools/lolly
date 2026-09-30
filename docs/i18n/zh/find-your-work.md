# 找回你的作品

你在 Lolly 中制作的一切都会留在你制作时所用的浏览器或应用里，留在那台设备上，除非你开启[同步](/info/sync.html)。已保存的作品在**项目**中。下载的文件会在你的浏览器或系统放置它的地方，通常也会有一份副本等在**素材**中。在大多数工具中，你从未保存过的作品也会被保留。本页会逐一介绍这些情况，此外还会涉及关闭的标签页、清除的浏览器数据、更早的版本、已删除的项目，以及移动到另一台设备。

| 你做了什么 | 该去哪里查看 |
|---|---|
| 按过**另存为**或**保存** | **项目** |
| 按过**下载** | 你浏览器的下载记录，以及**素材**中的一份副本 |
| 都没按过，且用的是[会随手保存的工具](#which-tools-save-as-you-work)之一 | **项目**和**History** |
| 都没按过，且用的是其他工具 | 只留在你操作时所在的那个标签页，直到你关闭它 |
| 在应用内删除了它 | **回收站**，位于**项目**、**素材**或**设置 → 存储空间**，保留 30 天 |

## 找到你保存的内容

1. 按工具左上角的**首页**。
2. 打开主屏幕顶部的**项目**标签页（在手机上是一个文件夹图标）。
3. 看第一屏。保存到**我的素材库**的作品就在那里，每个项目则是一个文件夹。要一次搜索所有文件夹，请在屏幕底部输入**搜索所有项目…**。

一个项目会以你在导出面板中输入的文件名命名，如果没有输入，则以它的工具命名，比如**QR Code**。打开这个项目，所有设置都会恢复，可以随时修改并再次导出。要以这种方式保留新作品，请见[保存与继续](/info/using.html#saving-continuing)。

::: note 不在项目里？
- 它可能在**回收站**中：见[找回你删除的内容](#get-back-something-you-deleted)。
- 另一个浏览器、隐私窗口或另一台设备都是从空白开始的，除非你使用[同步](/info/sync.html)或[移动你的作品](#move-your-work-to-another-device)。
- 如果你只按过**下载**，见[找到你下载的文件](#find-a-file-you-downloaded)。
:::

::: details 在项目中操作
你也可以从**设置 → 存储空间 → 已保存的会话 → 在项目中整理**打开**项目**。它的使用方式就像一个文件管理器：

![项目还没有任何保存内容时的样子：新建文件夹、新建素材和模板磁贴，右上角的 History 时钟按钮，以及底部的搜索所有项目栏](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **可嵌套的文件夹。** 把已保存的会话归入文件夹，文件夹里还能再建文件夹，层级不限。你可以新建文件夹、重命名，或把一个磁贴拖到另一个文件夹上来移动它；面包屑可带你逐层返回。未指定文件夹的已保存会话会直接显示在**项目**的根目录。
- <!--i:clock--> **按你自己的方式排序。** 右上角滑块按钮打开的**查看选项**提供**网格**或**列表**，并可按**名称**、**添加日期**、**最近修改**（默认）、**大小**，以及在文件夹内的**按工具**排序。无论使用哪种排序，文件夹总是排在最前面 - 排序只会在各自的分组内部为会话和文件夹排序。
- <!--i:document--> **新作品直接归档。** **新建素材**会打开共用选择器。选择**模板**即可从已保存的模板开始：打开模板进行编辑，或使用**+ 添加**立即保存一项新作品。
- <!--i:checklist--> **多选（桌面端）。** 勾选磁贴的复选框、在空白处拖出一个选框，或按 **Shift/Cmd 点击**；**右键点击**磁贴可打开它的上下文菜单。选择栏随后会提供**渲染所选内容**、**移动到…**、**新建文件夹**、**删除**（会移到回收站）、面向两到八个单工具会话的**一起编辑**（并排打开在一个侧边栏下），以及**以表格方式编辑**，它会把任意数量或任意混合的选中项作为行打开在批量网格里。
- <!--i:download--> **渲染整个文件夹或选中项。** **渲染文件夹**会把一个文件夹里的每个已保存会话 - 包括其子文件夹 - 导出为一个嵌套的 `.zip`。**渲染所选内容**对任意多选执行同样的操作，单个会话则直接渲染为它自己的文件。无需批量/Pro。
- <!--i:link--> **直接跳到某个工具的已保存作品。** 在工具库中勾选一个或多个工具，从选择栏选择**查看会话** - 项目会打开并只显示用这些工具做出的会话，用**清除**即可回到完整视图。
- <!--i:link--> **分享已保存的会话。** 右键点击一个会话（在手机上，按它磁贴上的 **•••**）→ **分享链接**，即可复制一个以相同设置重新打开它的链接；你设备上的图片不会随链接一起传递（完整的分享对话框见[分享你的作品](/info/using.html#sharing-your-work)）。
- <!--i:pentool--> **重命名或复制一个。** 右键点击一个会话（在手机上，按它磁贴上的 **•••**），可以选择**重命名**、**重复**（在同一文件夹内生成一份副本）和**移动到…**。

![项目中的查看选项弹层：布局提供网格和列表，排序方式设为最近修改，旁边是一个反转顺序的按钮](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## 如果你关闭了标签页或离开了工具

回来多少内容，取决于你是怎么离开的、用的是哪个工具：

- **你关闭了标签页，或过一段时间才回来。** 未保存的作品会丢失，除了[会随手保存的工具](#which-tools-save-as-you-work)：从**项目**中打开它们。
- **你在同一个标签页里重新加载了页面。** 你的设置会从页面地址中恢复。在不会随手保存的工具中，你从设备添加的图片和文件，以及长于 150 个字符的单行文本，都不会恢复，因为地址里不包含它们。
- **你按了首页，或左上角的返回按钮。** 如果你自上次保存、下载或复制以来又改动了什么，一个**未保存的更改**对话框会询问是否先保存。**保存并离开**会保存作品并带你前往**项目**，或返回到你打开这份作品时所在的项目文件夹。**不保存并离开**会丢弃你的更改：已保存过的项目会恢复到你上次保存时的样子，而你从未保存过的创作则会从**项目**中消失。**取消**会让你留在工具里。

只有当你按下工具里的**首页**或返回按钮时，Lolly 才会询问。关闭标签页、重新加载页面，以及浏览器自带的后退按钮，都不会触发询问。为保险起见，离开工具前请按**另存为**，或在导出面板中按**保存**。

::: note 不小心没保存就离开了？
在会随手保存的工具中，History 会保留一份被丢弃更改的副本。打开**History**页面，在**Changes** 下找到它们，然后按**作为副本打开**。在其他工具中，这些更改则不复存在。
:::

::: details 哪些工具会随手保存
在网页版应用中，每个用于制作文档的工具都会随手保存：Design、Chart、QR Code、Text、Sandbox 及其余的同类工具。以下这些工具则不会：

- 处理你带来的文件的工具，例如 Redact、Sign 或 Convert Image，因为 Lolly 从不保留那份文件的副本；
- 从你的摄像头、麦克风或屏幕录制的工具，例如 Record、Screen Capture 和 Voice Recorder；
- 3D 和 Darkroom，它们各自使用自己的文件；
- 没有什么可更改的工具，例如 Countdown。

在其他工具中，你的第一次更改就会把作品归档到**项目**中，就像你已经保存过一样，之后的更改也会在工具绘制完成后随手保存。因此，即便你关闭了标签页，一份未保存的创作仍然会留在项目中，重新打开时会标记为未保存的更改。**不保存并离开**仍然会丢弃这些更改，History 会把被丢弃的更改保留 30 天。从主屏幕重新打开该工具会开始一份新的创作；要打开之前那份，请从项目中打开。

开启[同步](/info/sync.html)后，以这种方式归档的创作会像项目中的其他内容一样，同步到你的其他设备。它的各个版本则留在制作它们的那台设备上。

如果一份创作在两个标签页中都打开，并且你在两边都保存了，最后一次保存会被保留。被替换的那份作品并未丢失：它会出现在该创作 History 中的**Protected drafts**下，并提供**Open draft as a copy**。

此功能仅在网页版应用中有效，桌面版和移动版应用不支持，与他人实时协作时也不支持。
:::

## 找到你下载的文件

在浏览器中，**下载**会把文件交给你的浏览器，由浏览器保存到它的下载文件夹（通常是 **Downloads**）中，或者询问你保存位置。Lolly 不会被告知文件去了哪里，所以请查看你浏览器的下载列表。

如果没有出现文件，请趁你还在工具中时查看导出面板。在**下载**下方，有一行会显示文件名和时间，并带有 **Retry download**；在 Chrome、Edge 等基于 Chromium 的浏览器中，还有 **Save file…** 可以让你自己选择文件夹。这一行及其文件会一直保留，直到你离开工具、重新加载或再次导出。

每次下载之后，Lolly 还会保留两样东西：

- **文件的一份副本**，存放在**素材**的**你的上传**下，前提是**设置 → 你的渲染结果**下的**将我的渲染结果保存到我的资料库**处于开启状态（**设置**在主屏幕底部）。该设置默认开启。视频，或超过 50 MB 的文件，会先询问，压缩包则不会被复制。
- **你用过的设置**，保留最近 24 次下载的设置。**项目**中已保存作品下方的**最近导出**，会用这些设置重新打开工具，方便你再次生成文件，不过你从设备添加的图片和文件不包含在内。同一份列表也在**设置 → 活动与统计 → 最新导出**下，以及 **History** 的 **Changes** 标签页中。这份列表保留的是设置，而不是文件本身。

::: details 在桌面和移动应用中
- **桌面应用：** **下载**会直接保存到你 **Downloads** 文件夹里的一个 **Lolly** 文件夹中，不会弹出对话框。**下载**下方的一行会说明保存的位置，例如"已保存到 Downloads/Lolly"，并带有**在文件夹中显示**。**Window** 或 **Exports** 菜单里的 **Open Exports Folder**，可以随时打开这个文件夹。和之前文件同名的文件，会保存为"name (1)"。
- **iPhone 和 iPad：** 文件会保存在 **Files** app 的 **Lolly** 下，并会打开分享面板，方便你转发出去。**下载**下方的一行会显示"已保存到 Files → Lolly"。
- **Android：** 会打开分享菜单，让你选择文件要去哪里。

在 iPhone、iPad 和 Android 上，新文件会替换掉之前同名的那一个。
:::

## 回到更早的版本

- **在本次访问期间：** **撤销**可以回退最近 100 次更改，直到你离开工具或重新加载。见[撤销与重做](/info/using.html#undo-and-redo)。
- **在[会随手保存的工具](#which-tools-save-as-you-work)中：** 每份创作的更早版本都会被保留。按下面的步骤操作。
- **设备上的一切：** 开启[同步](/info/sync.html)后，**设置 → 已连接的服务**下的 **Restore an earlier copy**（恢复更早的副本），可以恢复最近七份每日副本之一，或者你上次应用之前的那份副本。这样一来，这台设备上的一切都会与那份副本一致，而不只是某一份设计。

要打开更早的版本：

1. 按 **History**，也就是**撤销**和**重做**旁边的时钟按钮。在 Design 中，**History** 位于顶部栏；在手机上，按 **•••**，然后按 **History**。在没有**撤销**的工具中，例如 Text 和 Sandbox，**History** 位于左上角的**首页**旁边。
2. 按日期和时间找到相应版本。**Automatic checkpoint** 行是你操作过程中自动生成的；**Saved version** 行则是你保存的时刻。
3. 按 **Open as a copy**。该版本会作为一份新创作打开，而你原本打开的那一份保持不变。这份副本会出现在**项目**中，名称后面带有“(copy)”。

要按名称保留一个版本，请按 **Name version**，输入一个名称，然后按 **Keep milestone**。具名版本会列在 **History** 页面的 **Milestones** 下。

::: details History 面板与 History 页面
**History** 面板还会列出 **Recovered work** 行，**Protected drafts** 则保存着你在各检查点之间的最新更改，并提供 **Open draft as a copy**。**Compare** 和 **Check assets** 可以帮助你在打开一份副本之前先做判断。把 **This creation** 切换为 **All history on this device**，即可查看所有创作。

Automatic checkpoint 会随着时间推移而变得稀疏：最近一小时内每分钟一个，最近一天内每小时一个，30 天内每天一个，此后每周一个。已保存的版本和具名版本则全部保留。删除一份创作也会把它的版本移入**回收站**，**永久删除**则会将它们一并移除。

当 History 存储空间用满时，30 天内未打开过的创作，其最旧的 Automatic checkpoint 会最先被移除。保存的内容始终会被保留，即便如此：它会被写为当前作品，而 History 会说明这次保存并未作为一个版本保留。**设置 → 存储空间**会显示 History 用掉了多少空间。

**History** 页面（`#/history`，或面板里的 **Open app history**）涵盖了这个浏览器里的每一份创作。在电脑上，可以从主屏幕或**项目**右上角的时钟按钮打开这个页面。在手机上，前往主屏幕的工具库，按右上角的圆形徽标按钮，选择 **Saved sessions**，即可打开 History。从**项目**里点这一项目前还没有反应。

- **Recent** 列出你的创作，最新的排在最前，并带有**继续**。
- **Changes** 把检查点、下载记录和转换结果放在同一条时间线上。下载记录带有 **Reopen settings**。
- **Milestones** 列出具名的版本。

可以按项目、工具和日期筛选（在手机上收在**Filters**里）。History 页面没有删除按钮；要移除某一项，请使用项目。
:::

## 把你的作品移动到另一台设备

| 目的 | 方法 |
|---|---|
| 让你的设备保持同步 | **设置 → 已连接的服务**下的**跨设备同步**：见[同步你的设备](/info/sync.html) |
| 一次性移动全部内容 | **导出我的数据**和**导入数据…**，见下文 |
| 交出单份设计或单个项目 | 一个 `.lolly` 文件：**导出**，然后**分享**，然后**下载 .lolly**；要交出整个项目，则用文件夹菜单里的**下载项目 (.lolly)**。在另一台设备上按**打开**。见 [.lolly 文件](/info/using.html#the-lolly-file) |

分享链接会携带你的设置，但不会携带你从设备上添加的图片或文件。

::: note 导入只添加，不删除任何内容
文件里的文件夹、收藏和模板，会添加到另一台设备上已有的内容旁边。当一个已保存的项目两边都有时，会保留保存时间更近的那份副本。那台设备上你的详细信息和设置保持不变；空白的项会用文件里的内容填补。同步中的**将其带到此设备**，效果也是一样。
:::

要一次性移动全部内容：

1. 在旧设备上，打开**设置 → 存储空间**，在**移动到其他设备**下按**导出我的数据**。Lolly 会下载一个文件名以 `LollyTools-` 开头的 `.zip` 文件。
2. 通过 USB、发邮件给自己、AirDrop 或共享文件夹，把文件带到新设备上。
3. 在新设备上，打开**设置 → 存储空间**，按**导入数据…**，选择该文件，然后按**导入**。

::: note 会留在原地的内容
登录信息、密钥和同步密码短语都留在各自的设备上。最近下载记录、离线下载内容和 AI 模型不会通过任何途径传输。版本历史只会随**导出我的数据**文件传输，不会通过同步或 `.lolly` 传输。当历史记录太大、放不进一个文件时，最旧的 Automatic checkpoint 会被略去，导出结果会说明数量。同步保存在你存储空间里的那份副本，可以下载并打开，也可以像备份文件一样在**导入数据…**中选取；加密的副本会要求你输入密码短语。
:::

::: details 备份文件包含的内容
文件名为 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`（名称中的各部分来自你的个人资料，未设置时会省略；`<n>` 是按天计数的序号，避免同一天的导出互相冲突）。它包含你的个人资料，含文件夹、回收站、模板和收藏；每一个已保存的会话及其缩略图；你上传的图片、字体、徽标和下载内容的副本；你的设计系统；你的偏好设置（主题、侧边栏宽度、本地活动统计）；来自转换的已保存版本和结果；以及，仅限网页版应用，你创作内容的版本历史。

目录缓存不包含在内 - 它会在新设备上自行重新下载。每个部分都带有校验和，因此传输中损坏的文件会在导入时被发现，而不会被恢复成半坏的状态。已保存的会话会自动重新关联到你导入的图片。网页版、桌面版和移动版应用都读取同一个文件；终端应用则会写出它自己更简单的备份，本格式不会读取那种备份。**📦 Export my data & render everything** 会生成同一个文件，外加第二个压缩包，里面是每个已保存会话渲染出的输出结果。（完整格式规范见[数据迁移](/info/data-transfer.html)。）
:::

## 如果你清除了浏览器数据

在网页版应用中，Lolly 把一切都保存在你浏览器为这个网站分配的存储空间里：已保存的作品、图片、字体、设计系统、版本历史和离线下载内容。在浏览器中清除这个网站的数据会把这一切全部清除，Lolly 也无法把任何一项找回来。留下来的只有那些已经离开浏览器的东西：你下载的文件、一份**导出我的数据**文件、一份[同步](/info/sync.html)副本，以及你分享过的链接。

::: warning 清除浏览器数据之前
请按**设置 → 存储空间**下的**导出我的数据**，并把这个文件保存到别处。
:::

应用启动时，Lolly 会请求浏览器在设备空间不足时不要清除它的存储空间。但最终由浏览器决定。在**设置 → 可离线使用**下，如果有一行以 **Protected** 开头，说明浏览器同意了；如果显示的是"The browser may clear downloads if the device runs low on space"，说明浏览器没有同意，这时可以按**保护下载内容**再次请求。如果浏览器没有同意，那么在空间不足时，它可能不仅会清除下载内容，也会清除已保存的作品，所以请保留一份最近的**导出我的数据**文件。

**设置 → 存储空间**会显示每种数据各占用了多少空间。其中的 **History** 行统计 Automatic checkpoint、它们的预览及恢复草稿；**Remove automatic checkpoints older than 30 days**（移除 30 天前的自动检查点）会释放这部分空间，并保留已保存和具名的版本。**清除缓存**会丢弃已下载的目录文件，需要时会重新下载。**清除我的所有数据**会要求你输入一个词，关闭同步，然后清除 Lolly 在这个浏览器里保存的一切：你的个人资料和设置、已保存的会话及其历史记录和回收站、上传内容、字体和设计系统、下载记录、转换结果、已下载的 AI 模型和离线副本。你下载过的文件仍留在你保存它们的位置。之后应用会像首次访问一样重新启动。

![手机宽度屏幕上的存储卡片：设备上每一类数据都一一列出，底部是“清除我的所有数据”按钮](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

在桌面和移动应用中，已保存的会话是应用自己数据文件夹里的文件，其余内容则存放在应用自己的存储空间里，因此清除网页浏览器并不会影响它们。

::: details 桌面和移动应用把已保存的会话存放在哪里
每个已保存的会话都是 `saved-state` 文件夹中的一个文件：

- macOS：`~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows：`%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux：`~/.local/share/tools.lolly.Desktop/saved-state/`，或 `$XDG_DATA_HOME` 下的相同路径
- iPhone、iPad 和 Android：位于应用自己的存储空间内部，**Files** app 不会显示它

图片、设计系统和最近下载记录会留在应用的内部存储中，不在这些文件夹里。终端应用和命令行读取的是同一个 `saved-state` 文件夹：见[已保存的会话存放在哪里](/info/cli-reference.html#where-saved-sessions-live)。
:::

## 找回你删除的内容

在应用中删除一个已保存的会话、一个文件夹、一项你的上传内容或一款你的字体，都会把它移到**回收站**保留 30 天，无论你是在哪里删除的：**项目**、**素材**、**设置 → 存储空间**，还是某个工具的已保存会话列表。一个文件夹会连同其中的一切作为一个条目一起移入；一个会话在回收站期间仍保留它的版本历史。操作后马上会出现一条消息，提供**撤销**。之后：

1. 打开**回收站**：**项目**里的**回收站**磁贴、**素材 → 你的上传**里的**回收站**按钮，或**设置 → 存储空间**里的**回收站**行。三者打开的是同一个列表。
2. 按项目旁边的**还原**。它会回到原来的文件夹，字体也会恢复它在设计系统中原有的角色。

**永久删除**会立即彻底移除一个项目。**清空回收站**会先询问确认，然后移除回收站里的所有项目。超过 30 天的项目会被永久移除。

::: warning 部分删除会立即生效
删除一个设计系统、一个徽标或你的个人资料照片，不会进入回收站。命令行和终端应用也会立即删除。
:::

开启[同步](/info/sync.html)后，**Restore an earlier copy** 可以把整台设备恢复到更早某一天的状态，而一份**导出我的数据**文件则会带回该文件所保存的内容。
