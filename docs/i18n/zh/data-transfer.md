# 数据迁移：`lolly-backup` 包

Lolly 把你的个人库保存在设备上。备份包就是这个库迁移的方式：在一次安装上导出，用任何你喜欢的方式携带文件（USB、AirDrop、发邮件给自己或网络共享），再在另一次安装上导入。导出和导入都不需要服务器，目标设备可以离线。

本页是格式规范，面向围绕备份构建外壳、工具或脚本的人：zip 里有什么、版本如何把关、导入如何合并以及检查什么。面向迁移自己作品的人的步骤说明是[把你的作品迁移到另一台设备](/info/find-your-work.html#move-your-work-to-another-device)。

![迁移整个安装的两个按钮：Export my data 写出一个 zip，Import data 把它读回来](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **范围。** 包携带的是*用户数据*，而不是目录工具。目录工具和目录素材是单独同步的，假定目标设备上已存在，最坏的情况是版本更高。用户自己制作的工具放在 `profile.json` 内一起传递。导入绝不会安装或升级目录工具。

## 目标

- <!--i:box--> **一种格式，所有外壳。** 网页应用、桌面和移动应用以及未来的外壳共用同样的信封和各部分的模式定义。可选部分取决于每个外壳的能力，不受支持的部分会被报告。每个能力桥接提供自己的存储适配器。
- <!--i:shieldcheck--> **经得起传输。** 在传输中被损坏或截断的包会在导入时明确失败，绝不会只恢复一半。
- <!--i:clock--> **比当前版本更长寿。** 较旧的应用仍然可以导入较新包中它能识别的部分。真正破坏性的格式会被干净地拒绝。
- <!--i:check--> **可安全合并。** 导入到已在使用的安装上时，绝不会清除任何不在包中的内容。

## 外层封装

包是普通的 `.zip`，所以它在任何传输方式下都能完好无损，任何解压工具都可以检查其内容。

下载文件以其所属之人命名：`LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`，例如 `LollyTools-Ada-Lovelace-2026-06-26-1.zip`，这样存放备份的下载文件夹仍然易读。名和姓来自个人资料，未设置时会省略：没有个人资料时为 `LollyTools-2026-06-26-1.zip`，只有名时为 `LollyTools-Ada-2026-06-26-1.zip`。每个名称都会被简化为适合文件名的标记（保留 Unicode 字母和数字，去掉空格和标点，最多 32 个字符）。`<n>` 是按天、按设备的序号，所以同一天的重复导出不会冲突并保持顺序。`data-transfer.ts` 中的 `backupFilename()` 构建该名称，zip 的内容与它的名称无关，始终相同。

| 路径 | 是否必需 | 内容 |
|---|---|---|
| `manifest.json` | 是 | 格式 ID、版本、计数和各部分的完整性。读取者首先查看的内容。 |
| `profile.json` | 设置后 | 用户的完整 `me` 记录：姓名、联系方式、头像引用和标志，以及文件夹、回收站、项目蓝图、用户模板和用户自制的工具、收藏、隐藏的工具、语言和 emoji 选择。通过 `host.profile` 读取。 |
| `sessions.json` | 是 | 每个已保存的会话：槽位、工具 ID 和版本、标签、缩略图（data URL）和完整的输入数据。通过 `host.state` 读取。 |
| `assets.json` | 是 | 每个上传素材（图片、字体、品牌令牌、徽标、已保存的下载副本）的元数据，各自指向 `assets/blobs/` 下的字节。 |
| `assets/blobs/<n>.<ext>` | 每个素材 | 原始素材字节，以未压缩方式存储，因为大多数本来就是压缩格式。扩展名只是装饰；`assets.json` 中的 MIME 类型才是权威。 |
| `assets/blobs/<n>.c2pa` | 存在时 | 提取出的 Content Credentials，为精确的二进制字节，由素材记录中的 `_credentialFile` 引用。这些不是设备签名密钥。 |
| `design-systems.json` | 存在时 | 这次安装上制作或添加的设计系统，格式为 `{ active, records }`。参见[导入规则](#import-rules)。 |
| `file-history.json` | 可选 | 带版本的素材快照、已完成的文件操作报告和完整的批处理清单，有自己的版本。由外壳内部的 `fileHistory` 备份适配器提供。 |
| `revision-history.json` | 可选，手动备份 | 稳定的创作 ID、保留的检查点、缩略图和滚动恢复草稿。在支持的地方由 `host.state.history.backup` 提供。 |
| `file-history/versions/` | 每个快照 | 以前的素材字节和提取出的凭据，无论当前素材是否仍然存在。 |
| `file-history/results/` | 每个已完成的操作 | 精确的输出字节。不会保留或包含选来转换的原始文件。 |
| `prefs.json` | 是 | 用户拥有的本地偏好设置：`theme`、`sidebarWidth` 和 `ct-metrics` 活动统计。 |
| `lolly.txt` | 是 | 包的可读摘要（计数、个人资料、文件名），供没有 Lolly 而打开 zip 的人使用。每次导出时重新生成，导入时被识别，所以从不算作被跳过的部分。它在完整性映射之后写入，所以该映射不涵盖这个文件。 |

::: details 导出如何写入 zip
导出一次写入 zip 的一个部分（`shells/web/src/lib/zip-stream.ts`）。上传内容、保存的结果和保存的素材版本以 4 MiB 的片段读取，绝不整体读取，保存的结果和版本会先对照其记录的 SHA-256 进行检查。然后读取每个文件以获得其校验和与完整性摘要，zip 引用它原本所在的位置。

没有任何内容被重新编码，所以携带 Content Credentials 的文件保留其签名所覆盖的精确字节，每个部分都保留其精确的字节和摘要。对于相同的部分和时间，zip 与早期内存写入器写出的相同，只是超过 16 MiB 的历史文件会分块压缩。`tests/backup-streaming.test.ts` 对照记录的参考摘要检查这一点。

在 192 MiB 的合成库上，在 Node 中测量，完成备份在库之外大约需要 125 到 150 MiB，而内存写入器约需 850 MiB（`node scripts/bench-backup-finalise.ts`）。导入仍然把整个 zip 读入内存。
:::

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| 字段 | 含义 |
|---|---|
| `format` | 始终为 `lolly-backup`。没有它的文件会被拒绝，提示 “not a Lolly backup”。 |
| `formatVersion` | 此包**写入**时所用的布局。部分集合或形状的任何更改都会提升它。读取者**不**以该字段把关。 |
| `minReader` | 可以**安全地**导入此包的最低读取者版本。这是读取者用来把关的字段。 |
| `app` | 生成它的应用 ID，用于诊断。 |
| `exportedAt` | 包创建时的 ISO 时间戳。 |
| `counts` | 写入者放入了什么，用于显示和合理性检查。 |
| `integrity` | 可选。把除 `manifest.json` 之外的每个部分映射到其**未压缩**字节的 SRI 风格 `sha256-<base64>` 摘要。 |

## 版本策略

两个版本号让格式得以成长，而不会让较旧的安装被抛下。

![对包格式的更改要么是累加的，旧的读取者可以忽略；要么是破坏性的，错误的导入会造成损坏。累加更改会提升 formatVersion 并保持 minReader；破坏性更改会提升 formatVersion 并提高 minReader。读取者在 minReader 不高于自己的版本时导入。](/info/diagrams/concepts/backup-version-gate.svg)

- 当 `manifest.minReader` 不高于读取者自己的版本时，读取者导入包。只有当包要求更新的读取者时，它才会拒绝，并提示 “needs a newer version of the app”。
- **累加的**更改，例如新的可选部分或新的可选清单字段，会提升 `formatVersion` 并保持 `minReader` 不变。较旧的应用仍会导入它们识别的每个部分，不识别的部分会被报告为跳过，而不是悄悄丢弃。
- **破坏性的**更改，即对某个部分的错误导入会损坏数据，或可选部分变成必需，会提高 `minReader`。较旧的应用随后会干净地拒绝，而不是导入它们无法处理的东西。
- 如果未来的包设置了 `formatVersion` 却省略了 `minReader`，读取者会回退到依据 `formatVersion` 把关，并将该更改视为破坏性的。

> **给作者的经验法则：**如果每个现有的读取者忽略你的新增内容后仍能做对，那么这个更改就是累加的：提升 `formatVersion` 并保持 `minReader`。否则就提高 `minReader`。

## 完整性

当 `manifest.integrity` 存在时，读取者会在写入任何内容**之前**检查每个列出部分的 SHA-256。不匹配（“failed its integrity check”）或缺少部分（“incomplete”）会停止整个导入，所以不会有部分恢复。这能捕捉文件传输可能造成的损坏：被截断的 AirDrop、重新编码了附件的邮件网关、损坏的 USB 扇区。

完整性检查是尽力而为的。它只在 Web Crypto 可用的地方写入（每个安全的浏览器上下文和现代 Node），只有在映射和 Web Crypto 都存在时才检查。没有该映射的包，例如完整性出现之前的包，会原样导入：“cannot verify” 绝不算作 “corrupt”。

清单既不列出自身，也不列出重新生成的 `lolly.txt`。摘要涵盖清单所担保的各个部分。

## 导入规则

导入以两种模式之一运行。

- **Merge** 是 **Import data…** 所做的，也是同步首次加入 **Bring it to this device** 所做的。目标上的数据保留，不在包中的任何内容都不会被触碰：目标有而包里没有的会话在导入后依然存在。
- **Replace** 是设备同步用来让各设备保持一致的方式：它采用同步副本的个人资料记录、偏好设置、会话、图片和当前设计系统的选择，并且只移除自上次同步以来被另一台设备删除的项目。恢复更早的副本则更进一步，会让设备与该副本一致，移除副本中没有的一切，并先保存设备当前状态。[同步你的设备](/info/sync.html)介绍了用户看到的内容。

在合并中，只存在于目标上的任何内容都会保留，包中的每种数据与目标相遇时按下表处理：

| 数据 | 目标上已存在 | 仅在包中 |
|---|---|---|
| 会话（按槽位）和上传的图片（按 ID） | 保留保存时间较晚的副本，所以较旧的备份绝不会覆盖较新的作品。时间相等或未知时保留目标的副本。 | 添加 |
| 文件夹 | 保留目标的名称和父级，文件夹会获得包中它缺少的成员。在目标上归入某文件夹的会话仍留在那里。 | 添加 |
| 收藏（工具、目录素材和 Projects 项目） | 合并 | 添加 |
| 模板、Projects 模板和用户工具（按 ID） | 保留目标的记录。 | 添加 |
| 回收站条目 | 保留目标的条目。 | 添加，这样在任一安装上可以恢复的项目仍然可以恢复。如果条目的文件夹在目标上已被使用，或目标已经占用了它的回收站槽位，则该条目被舍弃。 |
| 其他个人资料字段（姓名、联系方式、语言、功能开关、隐藏的工具和其他设置） | 保留目标的值。 | 在目标字段为空的地方采用 |
| 偏好设置（`prefs.json`） | 保留目标的值。 | 在目标没有的地方写入 |
| 设计系统（按 ID） | 包的记录替换目标的记录。 | 添加。只有当目标没有自己的设计系统时，才应用包的活动选择。 |
| 创作历史 | 保存时间较晚的副本保持为当前，另一份作为受保护的草稿保留。 | 添加 |

**已保存的会话会自动重新关联到它们的图片。** 素材引用按 ID 保存，桥接会在图片恢复后重新解析它们，这本来也是必须做的，因为 `blob:` URL 无法在重新加载后保留。

**历史记录在写入后绝不会改变。** 重复导入素材版本和操作 ID 不会添加任何内容，已经指向不同字节或历史的 ID 会被拒绝，而不是被覆盖。重新导入完全相同的当前素材会保留其版本，更改过的当前素材必须带有不同的版本。

**创作历史还有几条规则。** 其槽位被目标用于另一个创作的创作，会作为单独的创作添加，位于目标回收站中的创作会留在那里。指向目标上不同内容的检查点 ID 保留目标的版本。未通过自身检查的存档会在任何个人资料、会话、素材或偏好设置更改之前停止导入，完全相同的重复导入不会增加存储。

**摘要报告发生了什么。** 每次导入都返回 `profile`、`sessions`、`userAssets`、`prefs`、`skipped` 和 `failedAssets`。

- `failedAssets` 统计无法恢复的上传素材，例如因为设备存储已满。
- `skipped` 统计来自较新写入者、此构建未识别的部分。应用会显示它（“… · N newer items skipped”），所以恢复会说明它留下了什么。
- 使用文件历史时，摘要会增加 `assetVersions`、`fileOperations`、`fileBatches` 和 `failedHistory`。存储耗尽或不可变 ID 冲突可能造成部分恢复，应用随后会告诉用户保留源备份。
- 使用创作历史时，它会增加 `revisions` 和 `recoveryDrafts`，只统计本次导入新增的内容，以及说明每个创作如何合并的 `added`、`kept`、`replaced`、`copies` 和 `hidden`。`skippedCheckpoints` 统计 ID 指向目标上不同内容的检查点，`historyLeftOut` 统计放不进设备历史空间的较旧检查点和草稿。
- 替换式导入会增加 `removed` 和 `failedRemovals`。

恢复不是跨越个人资料、会话、素材和历史存储的单个事务。云同步在部分恢复或不受支持的恢复之后**不会**推进它已应用的修订版本，所以副本仍然可用于重试。

## 不会随迁移包传输的内容

- **目录缓存**（已下载的素材元数据和 blob、工具索引），目标会免费重新同步它们。
- **目录工具和目录素材**，这不在范围之内，假定目标上已存在。用户添加的品牌令牌、字体和徽标是用户素材，所以它们会随包传递。
- **`blob:` 和对象 URL**，桥接会在加载时重新生成。
- **转换原件、有效的执行租约，以及机器本地的访问或签名机密。** 这些不是可迁移的历史。保存的结果是一份副本，并不承诺原始源文件已被备份。
- **导出序号计数器**，即 `localStorage` 中按天的下载命名计数器（`lolly-export-seq`）。它被排除在 `PREF_KEYS` 之外，所以绝不会进入包。

存储计量表显示同样的划分。已保存的会话、My images 以及 File results & versions 会进入包。其下的素材缓存、工具预览和离线固定项都可以重建，所以会被留下。

![存储计量表把这台设备的数据分为命名的类别，Saved sessions 和 My images 与 Asset cache 分开统计，这里是全新安装，每个类别仍然为空](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## 使用 Lolly Work 的组织数据

此包备份的是设备的个人库。它不是 **Lolly Work** 实例的备份：组织账号、访问政策、共享项目、目录版本、审批、渲染作业和审计记录由该服务持有。重新连接并登录即可重新获得对共享作品的访问；导入个人包不会授予该访问权限。

运营者使用 Lolly Work 自己的指南备份、保留和删除服务器数据：[备份与恢复](/info/work-operations.html#backup-and-restore)和 [Work 存储与数据生命周期](/info/work-data-lifecycle.html)。清除或导出设备并不会执行其中任何一项服务器操作。

## 跨外壳

`data-transfer.ts` 只通过能力桥接（`host.profile`、`host.state`、`host.assets`）和共享的 `localStorage` 偏好设置读写。同一个模块在网页以及桌面和移动应用中，基于 IndexedDB 或文件系统存储，读写通用的信封。可选的历史部分只在其适配器可用的地方出现，不受支持的部分在导入时被报告为跳过。无界面测试套件对内存桥接运行通用部分，历史事务也有真实浏览器测试。

有两个 shell 出于不同原因不在这个保证范围内:

- **一次性 CLI** 没有什么需要携带：它的状态在内存中，只持续一次调用。
- **TUI** 把状态保存在 `~/.lolly`（会话、文件夹、个人资料），它的 Profile 视图可以备份，但写出的是它自己较简单的存档：每个会话一个 `saved-state/<slot>.json`，外加 `profile.json` 和 `folders.json`，没有清单，没有 `formatVersion` 或 `minReader`，也没有完整性映射。此格式无法导入它（读取者会以 “not a Lolly backup” 拒绝它），而且它的名称容易混淆地相似（`lolly-backup-<stamp>.zip`）。统一两者是已知的缺口。

## 尚不可迁移

信封是一个清单加若干命名部分，所以新类型的可迁移数据以后可以作为累加的部分加入（新的 `formatVersion`，相同的 `minReader`），现在的读取者会跳过它们不识别的内容。设计系统已经以这种方式迁移，即 `design-systems.json` 加上它们的用户素材。

有两个名称保留给尚不能迁移的数据：

- **`tokens.json`** 将携带完整的 [W3C DTCG](https://tr.designtokens.org/format/) 设计令牌文档，包括其组、集合和主题，这是 [Penpot 导入和导出](https://help.penpot.app/user-guide/design-systems/design-tokens/)的格式。用户自己的品牌令牌已经以 `assets.json` 中的 `user/tokens/brand` 素材形式迁移，设计系统的令牌则随其记录一起迁移。
- **`penpot/`** 保留给已导入的 Penpot 文件，或其与 Lolly 相关的子集，作为工具呈现。

现在的读取者还不认识这两个名称。和上述各部分之外的任何其他内容一样，对它们而言每一个都是未知部分：保持原样，并计入 `skipped`。

## 历史部分

这两个历史部分是可选的，并有各自的版本。大多数读取者可以跳过本节。

::: details 创作历史（v3）
来自带有创作历史的网页安装的手动备份包含 `revision-history.json`，有自己的 `{ version: 1, documents, revisions, recoveries }` 模式定义。它携带保留的 ID、规范的输入快照、版本标记、栅格预览和独立的写入者草稿。历史适配器在一次读取事务中捕获当前会话及其头部，`sessions.json` 为较旧的读取者使用同样的当前快照。

恢复会先检查载荷的 SHA-256 和字节数、唯一标识、文档与头部的关系、祖先关系、时间戳、预览类型和限制，然后在一次事务中提交存档。精简过的父级引用可能缺失。现有的当前作品绝不会被悄悄替换：当某个创作在两侧都存在时，未被保留为当前的那一侧会变成受保护的草稿。

存档 384 MiB 的传输上限会被明确检查，存储限制会被强制执行，而不会截断保留的检查点。导出以分块方式写入 `revision-history.json` 和 `sessions.json`，字节与单次 `JSON.stringify` 得到的相同，所以文件文本从不整体保存在内存中。超过上限的历史文件会在越过限制的那一刻被丢弃，并仅从那时起计数。随后存档会在没有其最早自动检查点的情况下重新生成，导出摘要把它们统计为 `checkpointsLeftOut`，否则整个存档被拒绝。

没有这项能力的外壳会恢复普通会话，并把历史部分报告为跳过。原生文件系统历史在其适配器提供持久的历史事务之前保持不受支持。私密协作中的访客没有持久的历史或恢复存档。

个人快照同步不包含创作历史。把快照应用到带有历史的本地文档时，会将其之前的工作状态保留为单独的恢复草稿，并使任何打开的编辑器的写入令牌失效。它不可变的检查点保留在设备上。这在快照替换期间保护本地历史；它不会合并并发的设备历史。

历史的素材引用被保留，而渲染仍然通过目标设备现有的库来解析素材。此存档目前不保证旧素材字节或旧工具渲染结果的精确性。素材版本和文件结果的字节在它们自己的备份部分中传递。
:::

::: details 保存的版本和文件结果（v2）
可选的历史部分包含 `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`，读取者也接受没有批处理的早期 history-v1 形状。每个快照给出稳定的素材 ID 和精确版本、保存时间、字节长度和十六进制 SHA-256，以及一条素材记录，其 `_file` 和可选的 `_credentialFile` 指向二进制部分。操作携带原始文件的信息、请求、报告、时间戳和可选的结果 `_file`。存储后端名称、OPFS 句柄和执行租约不会传递。只认识 history v1 的读取者会在导入之前拒绝新的历史版本，而不是悄悄丢掉批处理成员关系。

批处理清单在处理之前记录每个选中的源，包括从未读取的文件、被取消的成员、预留结果空间的失败和被中断的工作。每个成员都有稳定的操作 ID、源引用和信息、请求的输出名称和最终报告。未读取的源有声明的信息，而不是臆造的摘要。导入会验证成员的身份，以及与所携带的任何操作报告的一致性。即使单个结果已被移除，批处理报告仍然可用，但回执并不意味着其输出字节仍被保存。

- **先验证。** 在任何个人资料或素材导入写入之前，每条已知的历史记录、报告和被引用的文件都会被验证。即使信封没有完整性映射，缺失的字节和不匹配的 SHA-256 也会失败。提取出的凭据保持为字节数组，包括来自把它们序列化为数字键对象的较旧写入者的导入。
- **运行中的工作。** 运行中的操作在备份中变成被中断的记录，带有解释性的失败报告，并且没有结果。恢复绝不会重新启动后台工作或导入活动的租约。重试意味着再次选择原始文件，并在可用时对照其记录的 SHA-256 进行检查。
- **存储。** 恢复的结果在 IndexedDB 中同时提交其字节和元数据。普通的新结果在可用时使用 OPFS，并有 IndexedDB 作为回退。现有的实时操作绝不会被导入替换。
- **备份限制。** 导出把这些字节流式写入存档，但恢复仍然把整个备份解压到内存中，所以限制依然存在：**256 MiB 的历史载荷**、**4 MiB 的历史元数据**，最多 **100 个操作**、**100 个批处理**和 **2,000 个快照**。导出会明确拒绝过大或不完整的历史，绝不悄悄遗漏。在移除较旧的本地副本之前，请逐一下载重要的版本和结果。这些限制并不是针对手机的实测峰值内存保证。
- **本地预算。** 本地结果历史有 512 MiB 的预算和 100 条记录的上限。素材快照有单独的 512 MiB 预算，每个素材最多 20 个历史版本，提取出的凭据字节也计入该预算。恢复遵守这些限制，绝不悄悄淘汰现有的用户数据。
- **批处理元数据。** 本地批处理元数据有单独的 4 MiB 预算，最多 100 份清单，每个批处理最多 20 个成员。待处理的成员会预留元数据容量，每个成员的报告上限为 32 KiB。这是一个逻辑预算，而不是浏览器磁盘空间保证：真实的配额失败会被显示，内存中的报告仍可下载。重试批处理成员会创建新的批处理，而不覆盖旧报告。移除批处理记录不会移除单个结果的字节或库素材。
- **库中的结果。** 转换后的结果可以不经规范化或重新编码添加到库中，附带源和输出的哈希以及操作关系。重复添加会复用未更改的副本，编辑过的副本绝不会被覆盖。栅格图像可以开始一个新的 Design 文档，它使用当前的库素材 ID；在整个 Design 运行时和 URL 路径中强制精确的版本固定是另一项工作。SVG、HTML、PDF 和 ZIP 结果作为不透明的文件素材保存，不会被提升为受信任的交互内容或矢量内容。
- **用户在哪里看到。** **Convert → Recent file operations** 显示历史用量、报告、下载和版本管理器，后者还可以找到已删除库素材的早期版本。恢复快照会创建新的当前版本，并保留所选快照。**Settings → Preferences → Storage** 把结果和版本与可丢弃的缓存分开统计。
- **清理。** 明确的临时文件清理只移除操作自有、未被引用的字节。当前记录保护其文件，最近的 OPFS 文件有一小时的宽限期。保存的结果和素材快照不会被自动清除。

较旧的读取者仍然接受 v2 信封（`minReader: 1`），并恢复它们认识的部分，把不受支持的历史部分统计为跳过。完整的历史恢复需要带有 `fileHistory` 适配器的外壳，这是外壳内部的接缝，而不是面向工具的新 `HostV1` 能力。真实的双设备恢复由本地 Chromium 关卡覆盖；已安装的桌面、iOS 和 Android 应用上的恢复仍有待单独验收。
:::

## 参考

- 模块：`shells/web/src/data-transfer.ts`（`exportBackup`、`importBackup`、`BACKUP_FORMAT`、`BACKUP_FORMAT_VERSION`、`BACKUP_READER_VERSION`；`backupFilename()` 命名器是内部的）。
- 契约测试：`tests/data-transfer.test.ts`，涵盖往返、合并、完整性、向前兼容和读取者把关。
- 历史契约测试：`tests/file-history-backup.test.ts`、`tests/file-batch-history.test.ts` 和 `tests/file-result-library.test.ts`。浏览器验收：`tests/file-history.browser.test.ts`、`tests/file-batch-history.browser.test.ts` 和 `tests/file-result-reuse.browser.test.ts`。
- 使用的桥接接口：`host.profile`、`host.state` 和 `host.assets`；参见 [Host API](/info/host-api.html)。
