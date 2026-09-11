# 数据迁移 - `lolly-backup` 包

Lolly 用户积累的一切都保存**在自己的设备上** - 没有账号,没有云端。数据迁移包就是这些数据移动的方式:在一个安装实例上导出它,通过任何方式携带该文件(USB、AirDrop、发送给自己的邮件、网络共享),再在另一个实例上导入。文件*本身*就是传输媒介。目标设备是否联网都无所谓,因为整个过程从不与任何服务器通信。

![移动整个安装内容的两个按钮:导出我的数据写出一个 zip,导入数据将其读回](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

本页是格式规范。终端用户的操作说明参见 [使用 Lolly → 迁移到另一台设备](/info/using.html)。实现代码见 [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts),[`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) 固定了往返转换的约定。

> **范围。** 迁移包携带的是*用户数据*,而非工具。工具和目录资源是单独同步的,并假定目标设备上已经存在(最坏情况下版本更高)。导入操作绝不会安装或升级工具。

## 目标

- <!--i:box--> **一种格式,适配所有 shell。** Web PWA、Tauri 桌面/移动应用以及未来的任何 shell 生成和读取的都是相同的字节。迁移包就是约定本身,每个 shell 的能力桥接层是其背后各平台的适配器。
- <!--i:shieldcheck--> **经得起传输。** 传输过程中被损坏或截断的迁移包会在导入时明确报错,绝不会部分恢复。
- <!--i:clock--> **比当前版本更长久。** 较旧的应用仍能导入较新迁移包中可识别的部分。真正不兼容的格式会被干净地拒绝。
- <!--i:check--> **可安全合并。** 导入到一个已在使用中的安装实例时,绝不会清除迁移包中没有的任何内容。

## 外层封装

备份包是一个普通的 `.zip`。下载文件以所属者命名 - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`（例如 `LollyTools-Ada-Lovelace-2026-06-26-1.zip`）- 这样下载文件夹里的一堆备份仍然清晰可辨。名和姓来自个人资料,未设置时会省略。没有个人资料时得到 `LollyTools-2026-06-26-1.zip`,只有名字时得到 `LollyTools-Ada-2026-06-26-1.zip`。每一部分都会被清理为文件名安全的标记(保留 Unicode 字母/数字,去除空格/标点,上限 32 个字符)。`<n>` 是按设备、按天递增的序号,所以同一天多次导出不会冲突,并保持顺序。[`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) 中的 `backupFilename()` 负责生成这个名称。压缩包内容与名称无关,始终一致。内容包括:

| 路径 | 是否必需 | 内容 |
|---|---|---|
| `manifest.json` | 是 | 格式 id、版本、数量以及各部分的完整性校验。读取者最先查看的内容。 |
| `profile.json` | 设置时 | 用户的 `me` 记录(姓名、联系方式、头像引用、标志位)。通过 `host.profile` 读取。 |
| `sessions.json` | 是 | 每个已保存的会话:插槽、工具 id/版本、标签、缩略图(data-URL)和完整的输入数据。通过 `host.state` 读取。 |
| `assets.json` | 是 | 每个已上传资源(图片、字体、品牌令牌)的元数据,各自指向 `assets/blobs/` 下的字节内容。 |
| `assets/blobs/<n>.<ext>` | 按资源计 | 原始资源字节(图片和字体文件)。未压缩存储(已经是压缩格式)。扩展名仅作外观标识,以 `assets.json` 中的 MIME 为准。 |
| `prefs.json` | 是 | 用户自有的本地偏好设置:`theme`、`sidebarWidth` 以及 `ct-metrics` 活动统计。 |
| `lolly.txt` | 是 | 迁移包的人类可读摘要(数量、个人资料、文件名),供未使用 Lolly 打开压缩包的人查看。每次导出都会重新生成,导入时可被识别,因此从不计入被跳过的部分。它是在完整性映射*之后*写入的,因此不在该映射范围内。 |

迁移包特意采用普通的压缩包格式:它能完好经受任何传输方式,任何解压工具都能查看它。

`profile.json` 是最小的一部分,也是应用中读取者最先看到的部分:制作者只需填写一次的详细信息,以及允许工具使用这些信息的选择开关。

![成为 profile.json 的个人资料详情表单 - 姓名、联系方式、头像以及旁边的选择开关](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| 字段 | 含义 |
|---|---|
| `format` | 恒为 `lolly-backup`。没有该字段的文件会被拒绝,提示“不是 Lolly 备份”。 |
| `formatVersion` | 该迁移包**写入**时所用的布局。对部分集合或结构的任何更改都会使其递增。读取者**不会**以此作为判断依据。 |
| `minReader` | **安全**导入该迁移包所需的最低读取器版本。读取者正是以此字段作为判断依据。 |
| `app` | 生成该包的应用 id,用于诊断。 |
| `exportedAt` | 迁移包创建时的 ISO 时间戳。 |
| `counts` | 写入者放入的内容数量,用于显示和合理性检查。 |
| `integrity` | 可选。将除 `manifest.json` 外的每个部分映射为其**未压缩**字节的 SRI 风格 `sha256-<base64>` 摘要。 |

## 版本策略(向前兼容)

`formatVersion` 与 `minReader` 之间的区分,正是让该格式得以演进而不至于抛弃旧版安装的关键:

- 只要 `manifest.minReader ≤` 自身的读取器版本,读取者就会导入该迁移包。只有当迁移包明确要求更新的读取器时,它才会拒绝导入(提示“需要更新版本的应用”)。
- **累加式**更改 - 新增一个*可选*部分,或新增一个可选的清单字段 - 会使 `formatVersion` 递增,但 `minReader` 保持不变。较旧的应用仍会导入它们能识别的每个部分。无法识别的部分会被跳过(见下文),而不是被悄悄丢弃。
- **破坏性**更改 - 错误导入某部分会破坏数据,或原本可选的部分变为必需 - 会提高 `minReader`。较旧的应用随后会干净地拒绝导入,而不是尝试处理它无法应付的内容。
- 如果未来的迁移包设置了 `formatVersion` 但省略了 `minReader`,读取者会保守地退回到以 `formatVersion` 作为判断依据(将该更改视为破坏性的)。

> **给作者的经验法则:** 如果现有的每个读取者在忽略你新增内容的情况下仍能正确工作,那这项更改就是累加式的 - 递增 `formatVersion`,保持 `minReader` 不变。否则就提高 `minReader`。

## 完整性

当 `manifest.integrity` 存在时,读取者会在**写入任何内容之前**验证列出的每个部分的 SHA-256。不匹配(“未通过完整性检查”)或缺失某个部分(“不完整”)都会中止整个导入 - 不存在部分恢复。这能捕获文件传输过程中可能引入的损坏(被截断的 AirDrop 传输、重新编码附件的邮件网关、损坏的 USB 扇区)。

完整性校验在设计上是尽力而为的:只有在 Web Crypto 可用时(每个安全浏览器上下文和现代 Node)才会写入,只有当映射和 Web Crypto 同时存在时才会验证。没有该映射的迁移包 - 例如完整性机制出现之前生成的包 - 会照常导入。“无法验证”永远不会被当作“已损坏”处理。

清单既不会列出自身,也不会列出重新生成的 `lolly.txt` 说明文件。摘要只覆盖清单所担保的那些部分。

## 导入语义

导入是**合并覆盖**,绝不会全部替换:

- 目标设备上已有的数据保持原样。
- 任何发生冲突的键 - 个人资料、某个会话插槽、已上传图片的 id - 都会被导入的副本替换。
- 迁移包中没有的内容不会被触碰。目标设备原有但迁移包中没有的会话在导入后依然存在。

已保存的会话会自动重新关联其图片:资源引用以 id 保留,桥接层会在已上传图片恢复后重新解析它们(无论如何都必须如此,因为 `blob:` URL 无法在重新加载后存活)。

导入摘要会报告 `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`。`failedAssets` 统计无法恢复的已上传资源数量(例如设备存储已满)。它与 `skipped` 不同,后者统计的是当前版本无法识别的、来自向前兼容的更新写入者的部分。界面会展示 `skipped`(“… · N 项较新内容已跳过”),因此恢复过程会如实说明遗漏了什么。

## 不会随迁移包传输的内容

- **目录缓存**(已下载的资源元数据和二进制数据、工具索引) - 会在目标设备上免费重新同步。
- **工具和品牌资源** - 超出范围,假定目标设备上已经存在。
- **`blob:` / 对象 URL** - 由桥接层在加载时重新生成。
- **导出序号计数器** - 按天计算的下载命名计数器(`localStorage` 键 `lolly-export-seq`)只是本地命名的便利机制。它被排除在 `PREF_KEYS` 之外,因此从不会包含在迁移包中。

存储用量表列出的正是同样的划分。已保存的会话和“我的图片”会包含在迁移包中。它们下方的资源缓存、工具预览和离线固定项都是可重新生成的,因此不会包含在内。

![存储用量表将本设备的数据划分为若干命名类别,已保存的会话和我的图片与资源缓存分开统计,此处为全新安装、每个类别仍为空的状态](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## 跨 shell 保证

`data-transfer.ts` 只通过能力桥接层(`host.profile`、`host.state`、`host.assets`)以及共享的 `localStorage` 偏好设置进行读写。由于桥接层是唯一的接口,即使底层存储不同(web 上是 IndexedDB,Tauri 上是文件系统),*同一个*模块在每个 shell 上都会产生字节级一致的包。Tauri shell 复用这个模块,不做任何改动,只有它们的 `host.state` 实现不同。无头测试针对内存桥接层执行了完整的往返流程,这也是它能代表所有场景的原因。

有两个 shell 出于不同原因不在这个保证范围内:

- **一次性 CLI** 没有需要携带的东西 - 它的状态是内存中的,每次调用后即消失。
- **TUI** 确实会持久化状态(`~/.lolly`:会话、文件夹、个人资料),它的 Profile 视图可以备份这些状态,但写出的是它*自己更简单*的归档:每个会话一个 `sessions/<slot>.json`,加上 `profile.json` 和 `folders.json`,没有清单、没有 `formatVersion`/`minReader`,也没有完整性映射。这种格式**不能**被本格式导入 - 读取器会将其识别为“不是 Lolly 备份”并拒绝 - 而且令人困惑的是它使用了相似的名称(`lolly-backup-<stamp>.zip`)。统一这两者是一个已知的缺口。

## 预留扩展点

这个信封结构在设计上就是一份清单加上一组具名部分,这样新类型的可移植数据以后就能**在不引入破坏性变更的情况下**搭载进来。它们会以附加部分的形式插入(新的 `formatVersion`,相同的 `minReader`),而当前版本的读取器会跳过它不认识的内容。这些内容在[路线图](/info/overview.html#roadmap)上,尚未实现。这里先预留这些名称,以便这些功能落地时格式仍保持一致。

- **`tokens.json` - 设计令牌(design tokens)。** 一份 [W3C DTCG](https://tr.designtokens.org/format/) 设计令牌文档(即 [Penpot 导入和导出](https://help.penpot.app/user-guide/design-systems/design-tokens/)所用的格式 - 带有 `$value`/`$type`/`$description` 的令牌,按组、集合和主题组织)。归档中的一个令牌集合让用户可以把自己的品牌基元连同会话一起在不同安装之间迁移。从长远看,被摄入的令牌集合会成为工具和调色板资源据以解析的一等来源。
- **`penpot/` - 已摄入的 Penpot 文件。** 为一个 Penpot 文件(或其提取出来的、与 Lolly 相关的子集)预留的目录,该文件被导入并*作为工具*呈现。归档会携带这份摄入后的定义,让它随用户的其余数据一起迁移。

除了这些预留名称和上面列出的部分之外的任何内容,对读取器来说都是未知部分:保持原样不动,并计入 `skipped`。

## 参考

- 模块:[`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts)(`exportBackup`、`importBackup`、`BACKUP_FORMAT`、`BACKUP_FORMAT_VERSION`、`BACKUP_READER_VERSION` - `backupFilename()` 命名函数是内部使用的)。
- 契约测试:[`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - 涵盖往返、合并、完整性、向前兼容和读取器门控的用例。
- 使用的桥接面:`host.profile`、`host.state`、`host.assets` - 参见 [Host API](/info/host-api.html)。
