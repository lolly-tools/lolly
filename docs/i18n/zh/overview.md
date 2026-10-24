# Lolly 架构

![Lolly 图标 - 一支绿白相间的大棒棒糖](/info/icon.svg)

本页面向修改 Lolly 代码的人：引擎、外壳和工具包如何组合在一起，它们各自在仓库中的位置，以及约束每一次更改的承诺。如果你想知道 Lolly 做什么、谁在使用它，请先阅读 [Lolly 如何工作](/info/how-lolly-works.html)。

有两份配套文档讲得更深。[`engine/README.md`](../engine/README.md) 是引擎逐个模块的地图，由代码生成。[威胁模型与信任边界](/info/threat-model.html)把同样的架构当作信任边界来解读，凡是有关引擎把什么视为不受信任的问题，都以它为准。

## 总体图景

工具是顶层的数据。中间的引擎对任何平台一无所知。底部的外壳实现同一份契约，目录提供内容。

![工具向共享引擎提供清单、模板和钩子。网页、Tauri 和终端外壳实现 HostV1 能力桥接，并从目录读取工具和素材。](/info/diagrams/concepts/platform-layers.svg)

如果能用纯数据和 Handlebars 描述，它就属于**引擎**。如果它涉及 DOM、文件系统、网络或任何浏览器或操作系统 API，它就属于**宿主**，也就是桥接中外壳的一侧。引擎是开源的，任何了解特定品牌或平台的内容都不会进入引擎。

## 仓库布局

Lolly 是一个仓库。下面的每个目录都是其中的普通目录，只有 `brands/suse` 例外，它是一个**私有**的 git 子模块，存放 SUSE 工具包和目录，公开克隆不会获取它。构建读取哪些包由内容配置文件（`profiles.json`）决定，按进程解析，而不是全局切换。[构建指南](/info/build-guide.html)给出了克隆命令，以及如何提交私有包内的更改。

| 目录 | 存放内容 |
|---|---|
| `engine/` | 与平台无关的核心：加载器、运行时、输入项、模板、URL 模式、单位和各格式模块 |
| `shells/` | 网页应用、Tauri 桌面和移动应用、CLI、TUI 和浏览器扩展 |
| `packages/` | 工具作者 SDK（`@lolly-tools/core`）、共享的 Node 外壳组件和文档渲染器等 |
| `community/` | 与品牌无关的工具，以及共享的 emoji 包 |
| `brands/` | 品牌包：`lolly-demo`（Lolly Demo，即 lolly.tools 运行的设计系统）、`lolly-start`（空白起步包）和私有的 `suse` |
| `services/` | 可选的 MCP、证书和 Penpot 服务，以及它们共享的服务器代码 |
| `schemas/` | 工具清单、素材条目和素材引用的 JSON Schema |
| `scripts/`、`tests/`、`docs/`、`api/` | 构建和目录脚本、引擎测试套件、这些文档，以及生成的无服务器打包文件 |

::: details 你最先接触的引擎和外壳文件
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

仓库根目录没有 `tools/` 或 `catalog/` 目录。`packages/node-shell/src/content-roots.ts` 会在被问到时，根据 `profiles.json` 回答“工具 `<id>` 在哪里”和“目录在哪里”。只有在构建输出中才会写入真正的 `tools/` 和 `catalog/` 目录对，例如 `dist/`、RPM 载荷或容器镜像，因为浏览器是通过 HTTP 获取这两个路径的。

## Lolly 在哪里运行

每个界面都使用同一个引擎和同样的工具文件。

- **网页应用。** 一个渐进式网页应用，在其 service worker 缓存了工具和素材后可离线使用。它不需要账号；状态保存在每台设备的 IndexedDB 中。一个响应式布局同时适用于桌面和手机：在手机上控制项变成一张面板，导出控制项从一个浮动按钮中打开。
- **桌面和移动应用。** 同一个网页应用的 Tauri 打包，带有原生文件对话框、文件系统状态和完整的离线使用。
- **CLI。** `lolly <tool-id> --input=value --output=file.png` 在无界面 DOM 中加载同一个引擎并写出文件。它是通过另一种传输方式实现的 URL 模式，而不是单独的实现。参见 [CLI](/info/cli.html)。
- **TUI。** 一个全屏、以键盘为先的终端应用，复用 CLI 的桥接，把已保存的会话保存在磁盘上（安装桌面应用时在其自己的文件夹中，否则在 `~/.lolly` 下），并且只有在某种格式需要时才启动受限范围的无界面浏览器。参见 [TUI](/info/tui.html)。

![桌面分栏视图：左侧是由清单生成的控制项，右侧是实时画布](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

同一个工具在手机宽度下不需要第二套布局：控制项变成顶部的面板，预览占据屏幕。

![430px 宽屏幕上的音频图：上方是控制项面板，下方是完成的方形作品，以及浮动的导出按钮](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

网页应用还附带 **Batch**（`#/batch`，`shells/web/src/pro/`），一个电子表格式的网格，可以跨一个或多个工具一次渲染多行；[批量生成与多重编辑](/info/batch.html#make-many-versions-of-one-design)介绍了 Batch。**Settings → Capabilities** 梳理了平台声明自己能做的一切。

![全新安装后的 Batch：一个空行在等待工具，电子表格界面和它的 Render 按钮在任何数据到来之前就已就位](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## 架构承诺

这些决定已经敲定。更改其中任何一条都是一项重大工程，因为它们塑造了代码库中的所有其他决定。

### 1. 声明式工具,辅以命令式逃生舱

工具由清单（`tool.json`）、模板（`template.html`）和可选的 `hooks.js` 组成。**清单声明输入项**，而不是模板：输入项不是从 Handlebars 标记推断出来的。大多数工具只有清单和模板，这正是非开发者也能创作它们的原因。

![Street Map 的控制项堆栈：城市下拉菜单、主题选择、粗细滑块和颜色触发器，每一个都来自清单中的一行](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

需要计算值的工具，例如二维码编码或图表整形，会添加钩子：运行时在注入能力桥接后调用的具名生命周期函数。钩子是一份可移植性契约，而不是安全沙盒，并且它们在时间预算内运行。钩子经证明不使用页面全局对象的工具带有 `isolate: true`，在 Worker 中运行。[工具钩子](/info/tool-hooks.html)介绍了生命周期和预算，[威胁模型](/info/threat-model.html)说明了页内执行器能包含和不能包含什么。

### 2. 工具和资产是数据,而不是打包代码

网页和 Tauri 应用在启动时获取工具和素材目录，缓存它们，并使用现有的内容工作，所以新工具或新素材无需发布应用。素材字节有 SHA-256 校验和，素材的 `id` 和 `version` 驱动缓存失效。

### 3. 能力桥接是工具能看到的唯一 API

工具绝不在模板之外接触 DOM，绝不直接调用 `fetch`，也绝不读取文件系统。它们调用带版本的 `host.*` 方法。契约的规范定义位于 `packages/core/src/host-v1.ts`，即工具作者 SDK `@lolly-tools/core`，所以第三方可以在不依赖引擎的情况下基于它构建；`engine/src/bridge/host-v1.ts` 重新导出其类型。

| 必需的 API | 作用 |
|---|---|
| `host.profile` | 用户的详细信息；通过 `bindToProfile` 预填输入项 |
| `host.assets` | 目录查询、素材解析和宿主的选择器 |
| `host.state` | 保存和加载输入槽位：网页上用 IndexedDB，Tauri 中用文件系统，CLI 中用内存 |
| `host.clipboard` | 将文本或图片写入剪贴板，带有平台回退 |
| `host.export` | 栅格化或序列化渲染目标，以及设备端文件转换路径 |
| `host.log` | 向宿主输出分级日志 |

其他每个 API 都是可选且可累加的：`tokens`、`text`、`color`、`geom`、`pdf`、`compose`、`media`、`recorder` 等等。工具的清单在 `requires` 下列出其钩子不经检查就调用的可选 API，缺少其中任何一个的宿主会拒绝挂载该工具；钩子对其余的进行特性检测。少数 API（例如 `recorder`）还需要工具声明的设备能力。`packages/core/src/host-v1/apis.ts` 列出了全部，[Host API](/info/host-api.html) 记录了每一个。添加方法属于次版本；删除或更改方法属于主版本，v2 发布后 v1 仍可继续使用。

### 4. 素材 ID 永远不变

`lolly/logo/primary` 是一份契约。一旦发布，ID 就永远不变，也绝不复用。字节发生变化时会提升素材条目中的 `version`，替代品会设置 `deprecated: true` 以及可选的 `replacedBy`，所以现有的引用始终可以解析。这正是已保存的会话和分享链接能多年持续可用的原因。

### 5. URL 模式是一等公民

每个输入项都可以表示为 URL 参数，所以链接就是一个成品文件：

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![仅凭这个链接本身，里面没有其他任何东西，就是成品文件](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

改变一个参数，就得到另一个文件。整个调色板就是一个种子颜色、一种和谐关系和一个步数：

![四种色相下的九个色阶，皆由链接中携带的同一个种子颜色生长而来](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI 根据其参数构建同样的 URL 状态并运行同一条管线，所以 CLI 不会与应用产生偏差。`engine/src/url-mode.ts` 负责解析和序列化；一组保留名称（`format`、`width`、`dpi`、`c2pa`、`z` 等）绝不会传给工具，[保留的 URL 参数](/info/url-parameters.html)列出了全部。素材输入项通过 `id` 传递，并在模板填充之前通过 `host.assets.get()` 解析。

### 6. 存储经由桥接

网页应用使用 IndexedDB，Tauri 使用文件系统，CLI 使用内存。工具只能看到 `host.state.save(slot, data)` 和 `host.state.load(slot)`，看不到 `localStorage`。人们可以为每个工具保存多个命名会话，无需账号。因为桥接是唯一的接缝，所以这些状态也是可迁移的：`shells/web/src/data-transfer.ts` 会把它们读出到一个 `lolly-backup` 文件中，可以导入到任何其他安装（[数据迁移](/info/data-transfer.html)），[同步](/info/sync.html)则把同样的包发送到此人选择的存储。

### 7. 成熟度标签按设计说明工具是什么

每个工具都声明 `status: official | community | experimental`。图库按状态排序，实验性工具默认在其导出内容上加水印：除非调用方传入 `watermark: false`，否则运行时会开启水印，设备端工具则不受影响。团队在目录之外加的任何流程，都建立在这之上。

### 8. 输入项在清单中带类型

输入项声明一个 `type`：`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table` 或 `file`。宿主为每种类型渲染一个控制项，所以工具无需编写控制项代码，任何输入项都可以带有 `bindToProfile`。其中三种分量最重：

- **`asset`**，带有 `filter` 和 `allowUpload`，是通往素材系统的桥梁。`allowUpload: false` 把一个槽位限制为库中的素材，用户上传与库共用 `AssetRef` 形状。
- **`blocks`** 是在侧面板中编辑的重复字段组，Meeting Planner、Wayfinding、Diagrams 等工具都在使用。点击渲染出的块会聚焦到它的行。
- **`file`** 在内存中保存用户自己的文件，供 Strip Hidden Data 和 Compress 之类的设备端实用工具使用，**`vector`** 则把一组固定的数字归为一个控制项。

### 9. 模板没有逻辑

模板是 Handlebars，选它是为了让非开发者也能编写：`{{x}}` 会转义，`{{{x}}}` 是显式选择加入。逻辑位于 `hooks.js` 中，在那里它是明确且可审阅的。许多模板对钩子计算出的标记使用 `{{{`，所以每个钩子都必须对交出的内容进行转义。辅助函数有 `default`、`upper`、`lower`、`eq`、`markdown`、`asset`、`framing` 和 `media`，以及用于配套 `.ics`、`.vcf` 和 `.csv` 模板的 `icsStamp`、`rfcText`、`csvCell` 和 `arrow`。[模板与渲染](/info/tool-rendering.html)介绍了它们。

### 10. 工具可以组合其他工具

一个工具可以嵌入另一个工具的渲染结果，而无需工具之间互相导入；由引擎解析这种组合。清单可以声明 `composes: [{ id, tool, inputs }]`，并用 `{{asset <id>}}` 放置子项，可移植的嵌入 URL（`https://lolly.tools/tool/<id>.svg?…`）会在本地渲染子项，Design 就是这样放置实时二维码或图表的。SVG 子项在 SVG 或 PDF 父项中保持矢量。子项是中间产物，绝不加水印或盖章，无法渲染子项的外壳会让该槽位留空，而父项仍会渲染。[组合与品牌叠加](/info/tool-composition.html)有详细说明。

## 我们选择不做什么

- **模板中没有任意 JavaScript。** 逻辑位于 `hooks.js` 中。
- **没有强制的素材服务器。** 人们在应用中把自己的文件添加到 Assets，并以会话的形式传递作品：分享链接承载输入项和设置，上传内容也要一起传递时则用 `.lolly` 文件。共享会话可以成为工具选择器中的模板。想要受管控目录的组织可以使用 Lolly Work 的目录、审批和政策，或者在 git 中管理品牌包并在那里审阅更改。
- **没有强制的访问控制。** 开放的应用默认是公开的，成熟度标签和水印承担品牌风险。当团队需要时，组织登录、角色和政策来自 Lolly Work。
- **没有中央数据库。** 用户状态保存在每台设备上，可选的同步把它复制到此人选择的存储，绝不会复制到 Lolly 的数据库。
- **工具与引擎之间没有共享代码路径。** 引擎和社区工具是开源的，而像私有的 `brands/suse/` 这样的品牌包按自己的条款携带自己的工具和目录。没有任何工具从 `engine/` 导入，所以这种划分保持清晰。

## 一次渲染的完整生命周期

有人打开 `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`：

1. **启动。** 网页应用打开 IndexedDB，构建能力桥接，并同步工具和素材目录，离线时则从缓存加载。
2. **路由。** 路径选中 `qr-code` 的工具视图，以查询参数作为其初始值。
3. **加载。** `loadTool` 获取 `tool.json`，按模式定义验证，并获取模板、样式和钩子。
4. **解析链接。** `parseUrlState` 把参数变成输入值。诸如 `?logo=lolly/logo/primary` 的素材引用会变成未解析的 `{ id }`。
5. **启动运行时。** `createRuntime(tool, host, initialValues)` 根据个人资料数据、默认值和链接构建输入模型，解析素材引用，加载钩子并调用 `onInit`。
6. **渲染。** 外壳订阅运行时，根据模型绘制控制项，并把填好的模板写入 `#tool-canvas`。
7. **交互。** 输入会调用 `runtime.setInput`，它应用约束，调用 `onInput`，再次填充模板并重绘。
8. **导出。** **Download** 调用 `runtime.export(node, format)`，外壳的 `host.export` 生成文件：栅格图、由 DOM 遍历器生成的矢量图、PDF、文档，或 `schemas/tool.schema.json` 中的其他格式之一。物理单位按格式转换，元数据和 Content Credentials 会嵌入到格式能容纳的地方。实验性工具的水印由宿主而不是工具添加。[模板与渲染](/info/tool-rendering.html)和[导出文件](/info/exporting.html)介绍了导出这一步。

![?options 打开的导出面板：文件名和格式对、输出尺寸，以及写出文件的控制项](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

同样的生命周期在 Tauri 中运行，也在带无界面 DOM 的 CLI 中运行，输出写入文件或标准输出。

## 许可协议

代码（包括 `engine/`、`shells/`、`services/`、`schemas/` 和文档生成器）采用 MPL-2.0，位于一个公共仓库 [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly) 中。文档正文采用 CC BY-SA 4.0。品牌包在各自的 `NOTICE.md` 中带有自己的条款：社区工具采用 MPL-2.0，私有的 SUSE 包是 SUSE 专有的。[关于](/info/about.html)有完整的许可说明。
