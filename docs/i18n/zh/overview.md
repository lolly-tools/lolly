# 概述

![Lolly 图标 - 一支绿白相间的大棒棒糖](/info/icon.svg)

本文档记录了 Lolly 平台的目标、结构和架构决策,既反映了产品愿景,也反映了代码库的现状。

> **状态:** Lolly 目前是一个内部原型,处于**尚未完成的封闭试点**阶段。引擎是确定性且内部自洽的,但产品尚处早期 - SUSE 是第一号客户 - 其加密与文件解析引擎目前正在接受 SUSE 严格的基础设施加固,为企业级规模做准备(这方面我们非常擅长)。请将下文的架构视为正在接受检验的设计意图,而非一个已完成、已通过认证的产品。关于试点如何运作与衡量,参见[采用与治理](/info/adoption-governance.html#status)。

> **如何阅读本页。** 本页按顺序包含两类内容。前半部分是
> **为什么存在这个产品**:问题、定位以及单个素材所经历的生命周期。
> 从[全局视角](#the-big-picture-how-the-layers-fit)开始则是
> **各层如何衔接**:面向贡献者的架构文档,涵盖引擎/宿主/内容包的分层、
> 仓库结构、交付目标,以及约束平台每一次改动的各项承诺。如果你来这里是为了
> 修改代码库而非理解产品本身,请从全局视角开始阅读。
>
> 有两份配套文档比本页讲得更深入。仓库中的 [`engine/README.md`](../engine/README.md)
> 是引擎的逐模块地图,附有一张自动生成的表格,列出每个模块及其解析或写入的内容。
> [威胁模型与信任边界](/info/threat-model.html)
> 是从信任边界角度重新阅读的同一份架构,任何关于引擎将什么视为不可信输入的问题,
> 都应该看这一页。

---

## 为什么存在这个产品

团队常常面临一个反复出现的问题:重复性的创意和内容工作,可预测到不值得每次都动用专业人力,却又对质量敏感到不能在没有护栏的情况下随意外放。结果不是吞吐缓慢(专家成为瓶颈),就是不一致(人人各用手边的工具),要么就是被供应商锁定(一个掌控着你模板的 SaaS DAM)。

本平台正是对此的直接回应:

> **规模化的程序式创意与内容生产** - 面向员工、供应商和合作伙伴的零人力素材生成,规则则由中心统一掌控。

Lolly 不是设计系统被发明出来的地方——而是它被生产出来的地方。可以把它想象成一台设计自动售货机:做出选择,得到结果。每一次都是如此。引擎会为您眼前的硬件所能达到的每种格式的最高质量而运作,而且同一个引擎在它所支持的每个平台上都生成同一份文件。

由此带来的结果是**充裕**:每场活动都有正确的标识牌,每条 CVE 警报都符合公司风格,每张标签都印得干净利落,每个邮件签名都保持最新 - 全部无需提交设计工单。本平台处理的是可运营化的重复性创意工作,刻意不做定制化的创意工具 - 旗舰级作品仍然由设计师掌控。

### 概率式创新,确定性规模化

每一场关于 AI 在创意流程中角色的争论,最终都卡在同一个问题上:这其中哪部分该交给机器?这是个古老的问题,答案早已确定。抄写员和插画师早就在两种工具之间工作 - 一种是松散的草图,一切尚未固定,什么都可以尝试;另一种是印刷机,它令人生畏正是因为它是一锤定音的。草图是艺术发生的地方,印刷机则是作品得以传播的方式。从没有人把这两者混为一谈,而两者也都在不断进步 - 新的墨水、新的字体、新的印刷机 - 每一次进步都与它所服务的技艺和意图相协调。

Lolly 划的是同一条线。以概率的方式探索:一个模型、一位设计师、一个粗略的想法、一段走向无人预料之处的提示词。然后以确定性的方式规模化 - 能触达一万份产出的东西是一个*工具*,而工具每次都会从可读的输入出发,以同样的方式渲染。探索之所以能保持自由,是因为下游没有任何环节依赖它两次落地一致。产出之所以值得信任,是因为它不是一次猜测。把 AI 实验转化为可预测、可复现的结果,并不是什么新学科,它正是那种最初让印刷品值得信赖的同一种分工。

> 信任创意过程,以严谨实现规模化。

### 相较于其他方案

::: figure positioning-comparison
当前各类创意工具的能力完整度,调研于 2026 年 8 月。评分标准:0 分为不具备,25 分为需变通实现,50 分为具备但受限或部分实现,75 分为较强但有保留,100 分为核心能力。
:::

差距很明显:如今已经发布的产品中,没有一个能同时提供约束优先、可离线、低技能门槛、内部可及的产出。Lolly 甚至还包含一个开放画布 - **Design** - 其中颜色、字体和素材都遵循品牌全局设定,因此自由排版依然是约束优先的。它**不是**一套不受约束的设计套件:设计师制作定制化的旗舰内容时,仍然使用 Illustrator 和 Figma。用这个工具可以组合出各种排列。

![库中每个工具都是一张卡片,按类别分组,方便制作者挑选并直接开始](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**适用场景:** 快速生成可运营化的创意素材 - 活动方块图、姓名徽章、签名、CVE 警报、二维码、社交卡片、托运标签、结构化报告。

**不适用场景:** 定制化的主视觉内容。

---

## 一场活动的生命周期

要看清 Lolly 究竟是什么,最清楚的方式不是一份功能清单 - 而是跟随一个素材,看它如何在人与人之间传递。来看一张本地化活动卡片在组织内部的流转过程:

1. **创意人员制定规则。** 设计师在 Design 工具中编写基础模板,将品牌的排版和色彩变量硬编码进去。他们做的不是一张卡片 - 而是把基础工作做*一次*,从此再也不用手动本地化。
2. **开发者将其规模化。** 同一个模板通过 CLI 接入夜间流水线,于是新的图表或新的语言版本会自动生成 - 没有设计师需要重新打开文件。
3. **制作者直接使用它。** 一位在飞机上离线的销售代表打开同一个工具,为客户会议生成一份完全符合品牌规范的演示文稿。不需要设计技能,不需要联网,不需要等待。

第二步中提到的“新图表”,就是像下面这样的渲染结果 - 由一段数据字符串和几个参数生成,全程没有任何人打开设计文件:

![一张带标题的堆叠面积图,三个数据系列以冷色调分层显示,坐标轴、图例和标题均由模板自动排布,而非手动放置](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

重点不在于 Lolly 对设计师好用,*而且*对开发者好用,*而且*对销售也好用,三者各自孤立。它是一场**接力赛**:创意人员的初始工作被开发者放大规模,进而赋能制作者。飞机上那位非技术背景代表所体验到的毫不费力,*之所以可能*,正是因为设计师定下了严谨标准,开发者又将其部署落地。

这就是力量倍增器。Lolly 不是为不同角色准备的一堆各自独立的工具 - 而是一条每个角色都会经手的确定性素材生命周期,每经过一双手,前一步的价值就被再放大一次。

---

## 一次审批,万件素材

因为审批的对象是工具本身而非文件(参见[Lolly 与其他方案的比较](/info/positioning.html)),规模化就不再是审核难题。审批一次本地化社交卡片工具后,便可从一张电子表格生成**覆盖 12 种语言的 10,000 个素材** - 其中没有一个需要法务或品牌重新做合规审查,因为它们所出自的模板早已获得批准。

同一个确定性工具通过三种方式达到这一规模,产出的结果完全一致,且都已预先获批:

- <!--i:people--> **一个人,在应用内。** `/pro` 批量表格:粘贴或导入行数据,每行生成一个完整素材,下载 zip 包。不需要设计技能,不需要工单,不需要等待。
- <!--i:code--> **一位开发者,从命令行。** CLI 以无界面方式运行*同一个*引擎和*同一条*渲染路径,因此该工具可以在脚本或夜间流水线中依次处理全部 10,000 行数据。循环中的一句 `lolly <tool> --field=…` 调用就是全部集成工作。
- <!--i:cpu--> **一个系统或一个 AI 代理,通过 MCP。** 同一个工具以编程方式运行,保真度相同,规模甚至更大 - 因为当成千上万个文件持续涌入时,机器不会感到厌倦。

![全新安装下的批量模式:一行空白等待选择工具,整个表格界面及其 Render 按钮在任何数据到来之前就已就绪](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

一套由设计师一次性定下的品牌约束;三条通往同一份预先获批产出的路径 - 而机器路径的规模化能力最强,因为文件源源不断涌入时它永不疲倦。

---

## 全局视角:各层如何衔接

从这里往下的内容都是架构。这张图把整个系统一览无遗:工具在最上层
是数据,中间的引擎对任何平台都一无所知,它下方的宿主层
实现同一份契约,而目录则提供内容。

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### 仓库结构

内容以内容包的形式挂载:`community/`、`docs/`、每一个 `shells/*`、两个 `services/*` 以及 `brands/suse`,各自都是独立的仓库,以 git 子模块的形式检出到这个仓库中。父仓库拥有 `engine/`、`schemas/`、`scripts/`、`tests/`、`api/`、`brands/lolly-start/` 和 `profiles.json`。检出命令和跨仓库工作流程参见[构建指南 » 获取源码](/info/build-guide.html)。

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## 平台交付模型

本平台运行在多个界面之上 - web PWA、Tauri 桌面端/移动端、可脚本化的 CLI,以及交互式 TUI。它们全部使用同一个引擎和同一套工具文件。

### Web(PWA) - 主要分发渠道
托管在 SUSE 掌控的 URL 上。一旦 service worker 缓存了工具和素材,即可离线使用。大多数员工、供应商和合作伙伴将在此处使用本平台。无需账号 - 状态按设备存储在 IndexedDB 中。

web 宿主是基于单一布局的响应式设计。桌面端上,工具由一个可调整大小的控件侧栏和一个预览舞台组成,支持触控板原生的画布导航(Cmd/Ctrl+滚轮或双指缩放以光标为中心,空格键或中键拖动平移,`0`/`1`/`+`/`−` 按键,以及一个 Fit/% HUD)。移动端(≤640px)上,控件变为一个顶部锚定的面板,带有拖拽把手,可在窥视/半屏/全屏之间吸附(点击切换),覆盖在静态的全屏预览之上;一个悬浮的 **Render** 按钮会在底部弹出面板中打开 **Export** 控件。触控操作可在预览上双指缩放和拖动平移。两端的渲染路径和导出控件完全一致 - 只有外围界面会重新排布。

![桌面分栏视图 - 左侧是根据清单生成的控件,右侧是实时画布](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

同一个工具在手机宽度下,无需维护第二套布局:控件变成顶部的面板,预览占据整个屏幕,渲染按钮悬浮其上。

![430px 宽屏幕上的 Audiogram——上方是控制面板,下方是成品方形作品,还有浮动的渲染按钮](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**批处理模式(`/pro`)。** Web 端还提供一个电子表格式的批处理网格(`shells/web/src/pro/`),可跨一个或多个工具一次渲染多行。它支持 CSV/TSV 往返导入导出以及电子表格粘贴、按行设置模板/格式/尺寸/单位/dpi、带实时预览的区块编辑器侧边栏、可折叠的导出列、按行的"相关性"标签栏、左侧拖拽手柄行重排、两步删除确认、已保存的批处理会话和 `.zip` 下载。这就是"批量内容生成"定位背后的一对多界面。

### Tauri 桌面端 / 移动端
打包的原生应用(通过 Tauri 实现小体积)。提供完整的离线可用性、面向依赖 CLI 的工具(PDF Smasher、Font Outliner)的文件系统访问,以及摄像头访问。计划于 2026 年年中进行工具增强。

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

桌面用户可以从终端调用许多工具。CLI 端加载同一个引擎,创建一个 jsdom DOM,运行同一条渲染路径并写出文件。URL 模式就是传输方式 - CLI 不是一个独立的实现。这保证了 CLI 和 GUI 的输出完全一致。

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

CLI 的交互式对应物:一个全屏、以键盘为先的终端应用(基于 Ink 构建),用于浏览工具、填写输入、保存项目和导出 - 全程无需 GUI。它的宿主桥接层对无 DOM 的格式(SVG/EMF/EPS/HTML + 文本/数据)**复用了 CLI 的实现**,并在 `~/.lolly` 下增加了磁盘状态存储,以及一个可选的行内预览。除此之外,它还有一个**浏览器渲染层**:一个受限的无头 Chromium(与 MCP 服务器安装的是同一个),按需生成光栅图/PDF/视频以及实时 URL 抓取 - 驱动一份构建好的 Web 端副本,使输出保持一致,并且只在你首次导出此类格式时才启动。因此 `url-shot`(带裁剪 + 重新配色 + 矢量 PDF/SVG)以及每一个光栅/pdf 工具也都能在终端中运行。参见 [TUI 指南](/info/tui.html)。

无论你身处哪个端,仪表盘的"Capabilities"标签页都是该平台所声明能力的完整地图,已分组整理,无需打开任何一个工具即可阅读。

---

## 工具分类

工具在其清单中通过 `category` 标记,用于画廊分组。

各行按画廊分区顺序列出。`utility` 分区在画廊中始终**最后**渲染(排在所有其他分类之后,包括未来新增的分类)- 它是本地设备上的"离线工具"抽屉。

| 类别 | 示例 | 计划中 |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

这些单元格是**示例,而非清单**。存在哪些工具取决于你挂载的 profile,而不取决于本页面:品牌包可以添加自己的工具,也可以排除某个它不想发布的社区工具。`catalog/tools/index.json` - 由清单生成,也是画廊实际读取的注册表 - 才是权威列表;要统计某个 profile 挂载了多少工具,应统计清单文件本身(`ls community/*/tool.json brands/*/tools/*/tool.json`),而不要相信写在这里的数字。(同一个工具 id 若出现在两个包中,只会挂载一次,以胜出的包为准。)

工具还按状态分类:`official`(品牌已批准,无水印)、`community`(外部贡献)、`experimental`(导出带水印)。大部分工具库是 `official`;较新的工作室类工具和抓取类工具在稳定下来之前往往处于 `community` 或 `experimental` 状态。每个端都会显示该徽章,让读者在打开工具之前就知道自己拿到的是什么 - 而且,和上面的分类单元格一样,各状态下具体包含哪些工具变化太快,这里就不一一列举了。请以画廊或生成的索引为准。

**Design** 是第一个基于 `render.layout: "editor"` 自由画布模式构建的工具 - 一个无外壳、直接操作的界面,你可以拖动、缩放、旋转和吸附文本、形状和图片方框,然后通过与其他工具相同的渲染路径导出。

**Strip Hidden Data** 是第一个**本地设备工具**(`privacy: "on-device"`):这是一个内容转换工具,接收*你*提供的文件,完全在浏览器内处理,并返回一份干净的副本 - 从不上传、从不加水印、不打任何来源标记。**Text Helper** 是第二个 - 一个用于日常"粘贴到网站"类工作(JSON 格式化、JWT 解码、Base64、URL 编码/解码、SHA 哈希)的本地设备工作台。**Compress PDF** 是第三个 - 它通过重新压缩其中的图片来缩小 PDF 体积,同样完全在本地设备上完成。这个标记及其徽章文字"Runs on your device - nothing is uploaded(在你的设备上运行 - 不上传任何内容)"现在覆盖了整套转换工具:Strip Hidden Data、Text Helper、Compress PDF、**Convert Image**(HEIC/TIFF/AVIF → WebP/JPG/PNG)、**Convert Font**、**Redact**(销毁图片、SVG 或 PDF 中的某些区域)、**Prompt to Image**,以及在 profile 挂载了它的情况下的 **Rebrand a Deck**(原地重新主题化一个 `.pptx`)。这是一个隐私工具类别,用来取代把机密文件交给单一用途的网站处理。

!["工具"抽屉,其中每张卡片都是一个用来转换你已有文件的工具](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> 注:`category` 和 `status` 是从每个 `tool.json` 反规范化写入 `catalog/tools/index.json`(画廊读取的注册表)的。清单才是唯一真实来源 - 该索引由 `npm run build:catalog` **生成**,如果已提交的索引与清单发生偏差,`npm run validate:catalog` 会使 CI 失败。

---

## 架构承诺

这些决策已经确定。改变其中任何一项都是一项重大工程 - 它们塑造了代码库中的每一个其他决策。

### 1. 声明式工具,辅以命令式逃生舱

一个工具由一个清单(`tool.json`)+ 一个模板(`template.html`)+ 可选的 `hooks.js` 组成。

**输入由清单声明。** 而不是模板。输入不会从 Handlebars 标记中推断得出。清单是契约;模板通过 `{{id}}` 消费具名变量。

![Street Map 的控件堆栈 - 城市下拉菜单、主题选择、粗细滑块和颜色触发器,每一个都源自清单中的一行](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks 是可选的。** 大多数工具是纯声明式的 - 清单 + 模板就足够了。需要计算值的工具(QR 编码、图表数据整形)提供 `hooks.js`,暴露具名的生命周期函数(`onInit`、`onInput`、`onFrame` - 面向运动响应式工具的逐帧实时摄像头钩子 - `onLevel`、`beforeExport`、`afterExport`、`exportFile` - Strip Hidden Data 等本地设备工具使用的文件进/文件出转换路径 - 以及 `exportStill`,供拥有自己的深度光栅化流程的工具使用)。宿主通过 `new Function('host', …)` 加载 hooks,并将能力桥接层作为闭包作用域注入。这是一份**可移植性契约,而不是一个安全沙箱**:hooks 仍然运行在页面 realm 中,在浏览器端*可以*触及 `window`/`fetch`/`document` - `host.*` 是受支持的可移植接口,而不是强制边界。异步 hook 的结果有时间限制(`onInit` 5 秒、`onInput` 2 秒、`beforeExport`/`afterExport` 5 秒、`exportFile`/`exportStill` 10 秒),超时的结果会被丢弃;失控的*同步*钩子则无法被抢占。因此,不受信任的第三方 hook 代码在 Worker 隔离上线之前都不能安全运行。

这一点之所以重要,是因为:声明式工具可以由非开发者编写。如果每个工具都是一个 Web 应用,那么"创建/维护主力模板的技能有限"这条风险说明就会变成一个永久性瓶颈。

### 2. 工具和资产是数据,而不是打包代码

Web 和 Tauri 应用在启动时从已知 URL 拉取工具和资产目录,将其缓存到本地,并基于当地已有的内容运行。**添加一个新的活动图块或季节性资产不需要发布新版应用。**

资产字节通过 SHA-256 校验和来防止 CDN 投毒。资产的 `id` + `version` 驱动缓存失效。

### 3. 能力桥接层是工具所能看到的唯一 API

工具从不触及模板区域之外的 DOM,从不直接调用 `fetch`,也从不读取文件系统。它们调用带版本号的 `host.*` 方法。这份契约的权威定义位于 `packages/core/src/host-v1.ts` - 即工具作者 SDK `@lolly-tools/core`,因此第三方可以在不依赖引擎的情况下基于它构建;`engine/src/bridge/host-v1.ts` 是它的类型再导出,引擎/端代码仍从该路径不变地导入:

| 桥接 API | 作用 |
|---|---|
| `host.profile` | 用户的名字、邮箱、头像、城市等。通过 `bindToProfile` 预填输入。 |
| `host.assets` | 目录查询、资产解析、宿主提供的选择器 UI。 |
| `host.state` | 保存/加载输入槽位。Web 端用 IndexedDB,Tauri 端用文件系统,CLI 端用内存。 |
| `host.clipboard` | 将文本或图片写入剪贴板(带平台回退方案)。 |
| `host.export` | 光栅化或序列化渲染目标。对 experimental 状态的工具应用水印。 |
| `host.net` | 白名单内的 fetch - 仅在工具声明了 `"network"` 能力时可用。(目前没有任何已发布的工具使用它。) |

可选的、增量式接口只有在某个端提供它们时才会出现。其中一些是**受能力开关限制的**- 仅在工具声明了相应标志时才会暴露:`host.compose`(嵌入另一个工具的渲染 - `compose`)、`host.capture`(供 URL Screenshot 使用的页面抓取 - `capture`)以及 `host.recorder`(供录制类工具使用的麦克风/摄像头/屏幕捕获 - `microphone` / `camera` / `screen`)。其余的则是**特性检测式的**- 只要该端能够提供就会出现,工具会为不能提供的端保留一个回退方案。

这里列出少数几个代表性接口,展示其覆盖范围 - [Host API](/info/host-api.html) 记录了每一个,`packages/core/src/host-v1.ts` 就是契约本身:

| 接口 | 起始版本 | 提供的功能 |
|---|---|---|
| `host.tokens` | 1.0 | DTCG 设计令牌——品牌自身的基础元素 |
| `host.text` | 1.0 | 通过 HarfBuzz WASM 实现文本转路径(`wasm` 能力标记依赖它的工具) |
| `host.media` | 1.4 | 驱动 `onFrame` 钩子的实时摄像头帧。属于渐进增强,特意*不*受 `camera` 标志门控——这类工具在没有摄像头时仍能作为普通静态图像工具正常工作 |
| `host.color` | 1.40 | 感知色彩数学:ΔEOK、WCAG + APCA 对比度、OKLab 渐变、分级断点、分类调色板、和谐配色方案(1.60)、CSS Color 4 混色与渐变烘焙(1.68)。纯函数且同步——外壳只需接入引擎的 `makeColorApi()`,无需自行实现任何逻辑,因此不会产生偏差 |
| `host.images` | 1.60 | 在设备端解码 / 缩放 / 重新编码字节——即转换路径(HEIC → JPEG、压缩为 WebP、降采样)。在 Web 外壳中以惰性门面(lazy facade)形式提供,因此 HEIC 解码器永远不会进入启动分块 |
| `host.geom` | 1.64 | 精确的矢量几何运算:路径布尔运算、偏移、描边转填充、样条降阶、简化、命中检测。同样是纯函数、同步,并从引擎接入(`makeGeomApi()`);失败情况会被*返回*,而不是被抛出 |

其余接口遵循相同的规则,并与之一并记录:`pdf`(1.8)和 `pptx`(1.58)用于本地设备文档处理,`audio`(1.71)和 `speech`(1.96)用于片段分析和本地设备 TTS/转录,`viz`(1.72)用于 MilkDrop 占位契约,`codec`(1.100)和 `layers`(1.102)用于深位色和分层位图输出,`upscale`(1.101)和 `matte`(1.103)用于本地设备模型,`raster`(1.105)供自行处理像素的 hooks 使用,`connectors`(1.106)用于导出安全的箭头,`c2pa`(1.85)用于对最终字节签名。数量在增长;规则不会变。

可声明的能力有:`network`、`filesystem`、`clipboard`、`camera`、`microphone`、`screen`、`ffmpeg`、`wasm`、`capture`、`compose`。(`screen` 于 1.54 加入,是通过 `host.recorder` 进行的屏幕捕获 - 用户在浏览器原生 UI 中选择屏幕/窗口/标签页;这与 `capture` 不同,后者是对工具自己指定的 URL 进行光栅化。)

同一个工具能在浏览器、Tauri 和无头 CLI 中运行,是因为每个端都实现了这个接口 - 工具本身永远不知道自己身处哪一个端。

这个桥接层是带版本号的。新增方法属于次版本更新。移除或改变签名则需要主版本号升级。当 v2 发布时,v1 必须继续可用。

### 4. 资产 ID 是永久性的

`suse/logo/primary` 是一份契约。一旦发布:
- ID 永远不会更改,也不会被重复使用。
- 字节发生变化 → 在清单中升级 `version`。
- 被新资产取代 → 设置 `deprecated: true`,可选地设置 `replacedBy`。
- 现有引用永远能被解析。

这使得已保存的工具状态和通过 URL 分享的链接能够历经数年依然有效。

### 5. URL 模式是一等公民

每一个输入都必须能够表示为一个 URL 参数:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![仅凭这个链接本身,不需要其他任何东西,就是完成的成品资产](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI 模式就是换了一种传输方式的 URL 模式 - CLI 端从 argv 构建一个 URL 状态对象,并运行**同一条**引擎管线。只有一条渲染路径。CLI 不可能与 GUI 产生偏差,因为它根本不是一个独立的实现。

`url-mode.ts` 负责这个往返过程(解析与序列化)。有一组**保留参数**永远不会作为输入转发给工具:输出控制类(`format`、`export`、`copy`、`filename`、`width`/`w`、`height`/`h`、`unit`、`dpi`)、印刷与来源相关的旋钮(`bleed`、`marks`、`profile`、`password`、`c2pa`、`imprint`、`durable`、`meta`、`hdr`、`depth`、`cuts`),以及状态载体(`template`、`z` - "最短链接"打包令牌 - 和 `zx`,即同一令牌以密码加密后的版本)。`engine/src/url-mode.ts` 中的 `RESERVED` 集合是权威定义,并由一个测试固定住;[URL 模式](/info/url-mode.html) 记录了它们中的每一个,包括这里未列出的少数几个。URL 模式中的资产类输入以其 `id` 序列化;运行时会在填充之前通过 `host.assets.get()` 解析它们。`width`/`height` 是以 `unit` 为单位的数值(默认为 `px`,也可以是 `mm`/`cm`/`in`/`pt`/`pc`);使用物理单位时,`dpi` 决定光栅分辨率。它们设置画布文档尺寸,并预填导出尺寸面板。

因为每一个输入都随链接一起传递,参数的改变就意味着一份不同的成品资产。整个这套调色板,不过是一个种子色、一种和声方案和一个阶梯数量:

![四种色相下的九个色阶，皆由链接中携带的同一个种子颜色生长而来](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. 存储通过桥接层进行，而非直接访问

Web 端：IndexedDB。Tauri：文件系统。CLI：内存中。工具只能看到 `host.state.save(slot, data)` 和 `host.state.load(slot)`。不使用 `localStorage` - 它太小，无法存放二进制数据（blob）。

用户可以为每个工具保存多个具名的编辑槽位，之后再返回各个会话。无需创建账户；状态是按设备保存的。由于桥接层是唯一的接缝，这种按设备保存的状态也是*可移植的*：`shells/web/src/data-transfer.ts` 通过 `host.profile`/`host.state`/`host.assets` 把所有内容读出，打包成一个 `lolly-backup` 压缩包，可导入到任何其他安装环境中 - 这是无需服务器就能实现“迁移到新设备”的离线方案（完整规范见 `docs/data-transfer.md`）。SUSE ID 集成（多设备同步）是在此基础上的未来里程碑。

### 7. 成熟度标签从设计上解决了“品牌认可”风险

每个工具都在其清单中声明 `status: official | community | experimental`。图库按状态排序。实验性工具会自动为导出内容加水印 - 水印由 `host.export.render` 添加，而非工具本身，因此非官方工具作者无法选择关闭它。

这是对“使用任何工具都意味着品牌认可”这一感知风险的结构性回应。流程性的解决方案（审核队列、SUSE ID 门控）则叠加其上。

### 8. 工具输入通过清单进行类型化，资产也不例外

输入声明一个 `type`：`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table` 和 `file`。宿主环境会根据清单为每种类型渲染通用控件 - 工具本身不需要编写任何控件代码。（从用户资料预填不是一种类型 - 任何输入都可以携带 `bindToProfile`。）其中三种的分量比其余更重：

- **`asset`**（配合 `filter` 和 `allowUpload`）是通往全局资产系统的桥梁；`allowUpload: false` 是品牌强制执行的杠杆，用于赞助商图块徽标等只允许使用库内资产的场景。用户上传的资产与库内资产使用相同的 `AssetRef` 结构，因此工具能以相同方式处理它们。
- **`blocks`** 是一个可重复的字段组 - 一个输入内部的小型表格，在侧边面板中编辑，带有类型化/可区分的添加菜单以及每个块的资产字段。点击画布上渲染出的块会聚焦到该块所在的行。被 `meeting-planner`、`chart-creator`、`event-name-badge`、`wayfinding-signage`、`color-block` 和 `digi-ad` 使用。
- **`vector`** 把一组固定数量的数字（例如一个变换）归入一个复合控件；**`file`** 把用户自己的文件以字节形式保存在内存中，供设备端转换类工具使用（例如 `strip-data` 和 `compress-pdf`）。

### 9. 模板是无逻辑的（使用 Handlebars，而非 EJS）

选择 Handlebars 而非 EJS 是刻意为之：
- 无逻辑。模板可以由非开发人员编写。
- 默认安全。`{{x}}` 会进行 HTML 转义；`{{{x}}}` 是需要显式选用的原始输出。
- 模板中不允许任意 JS，意味着不存在逐模板的 XSS 审计面。

逻辑存放在 `hooks.js` 中，明确且可审查。可用的 Handlebars 辅助函数有：`{{default}}`、`{{upper}}`、`{{lower}}`、`{{eq}}`、`{{markdown}}`、`{{asset ref}}`、`{{asset ref "property"}}`（此外还有供同级 `.ics`/`.vcf`/`.csv` 模板使用的数据格式辅助函数 `icsStamp`/`rfcText`/`csvCell`）。

### 10. 工具可以组合其他工具

一个工具可以嵌入**另一个**工具的渲染结果，而无需工具间的相互导入 - 组合由引擎解析，而不是由工具代码解析。这有两种方式：

- **声明式清单** - `composes: [{ id, tool, inputs, format?, width?, height? }]`。引擎渲染指定的子工具，并将结果以 `{{asset <id>}}` 的形式放入无逻辑模板中。目前 `event-name-badge` 就以 SVG 形式组合了 `qr-code`。
- **可移植的嵌入 URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`。宿主环境会**在本地**渲染该子项（在本地渲染结果就绪之前会显示一个占位像素）；不会向 `lolly.tools` 发起任何请求。

可以组合任意工具的渲染结果：当父级导出为 SVG 或 PDF 时，**SVG** 子项仍保持真正的矢量形式，导出为 PNG 时则清晰栅格化；**PNG/JPG/WEBP** 子项以图像形式嵌入。需要 `compose` 能力。被组合的子项是中间产物 - 从不加水印或标注溯源信息 - 且组合过程会优雅降级：如果某个宿主环境无法渲染某个子项，就直接省略该槽位，父级仍然照常渲染。

---

## 我们明确选择不做的事

- **模板中没有 EJS,也没有任意 JS。** XSS 攻击面为零。逻辑都放在 `hooks.js` 中。
- **没有强制性的素材 CMS。** 个人可以直接在应用内把自己的创意文件导入目录(即 [目录](/info/using.html) 视图和品牌工作室)——无需服务器,无需管理后台。工作以**会话**的形式传递:一个分享链接携带全部状态,同一份会话也可以通过备份或协作会话传递。掌控该部署的人此后可以把一个共享会话锁定为**模板**——打开链接,把其中的值记录为品牌包中该工具目录下的一个模板条目并提交——之后它就会出现在该工具的“New from template”选择器中,并可通过 `?template=<id>` 深链访问。Git 是部署方的锁定步骤,而不是创作者的。若需要*共享且受治理*的目录,组织**可以**用同样的方式管理素材目录,并通过 PR 审查来把关更新——这是一种可选的治理模型,而不是应用的强制要求。
- **没有强制性的 RBAC。** 该开放应用默认公开访问;品牌风险通过成熟度标签与水印来管理。想要更严格控制的组织,可以在上述基础上叠加自己的身份验证以及经 Git 审查的目录。
- **没有中央数据库。** 所有用户状态都保存在本地设备上。SUSE ID 集成已列入路线图,但并非发布的前置条件。
- **没有共享的工具/引擎代码路径。** 引擎是开源的,`community/` 中与品牌无关的工具同样开源;而像私有的 `brands/suse/` 这样的品牌包,则按其自身条款携带自己的工具和目录。无论哪种情况,这种分离都被强制执行(`engine/` 不会反向导入工具内容),从而保持这种拆分的整洁。

---

## 端到端的生命周期

用户打开 `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`：

1. **启动。** Web 端打开 IndexedDB，构建能力桥接层，同步工具与资产目录（离线时则从缓存加载）。
2. **路由。** URL 哈希 → `tool` 视图，提取出 `qr-code` 及 URL 参数。
3. **加载。** `loadTool('qr-code', fetchFile)` 获取 `tool.json`，按 JSON Schema 校验，再获取 `template.html`、`styles.css` 和 `hooks.js` 源码。
4. **解析 URL 状态。** `parseUrlState` 把 URL 参数转换为初始输入值。资产引用（`?logo=suse/logo/primary`）被解析为轻量的 `{ id, _unresolved: true }` 对象。
5. **运行时。** `createRuntime(tool, host, initialValues)` 构建输入模型（合并资料数据、默认值和初始值），通过 `host.assets.get()` 解析资产引用，加载钩子（`host` 以闭包作用域注入，并非沙箱隔离），调用 `hooks.onInit`。
6. **渲染。** 宿主环境订阅运行时；每次状态变化都会收到 `{ model, hydrated }`。它据此渲染输入控件，并把注水后的模板 HTML 写入 `#tool-canvas`。
7. **交互。** 用户在某个输入中输入内容 → `runtime.setInput(id, value)` → 应用约束 → 调用 `hooks.onInput` → 重新注水 → 重新渲染。画布实时更新。
8. **导出。** 用户点击下载（PNG）→ `runtime.export(canvasNode, 'png')` → `host.export.render`（通过 dom-to-image-more 栅格化；SVG/PDF 则经过专门的 DOM 遍历矢量化器）→ blob → `host.export.download`。工具可选用的格式范围很广，具体以 `schemas/tool.schema.json` 中的 `render.formats` 枚举为准 - 位图与浮点位图、矢量与裁切文件、印刷/CMYK、动态影像、可编辑文档（`pptx`、`docx`、`odt`）、调色板与数据/文本输出、音频与字体文件。[URL 模式](/info/url-mode.html) 列出了每个 id 及其产出内容。音频与其他格式一样也在该枚举中（`wav`、`mp3`、`m4a`、`opus`，由音频图和录制类工具声明）；此外，录制类工具的 `render.capture` 模式会驱动 `host.recorder`，其录制结果以浏览器实际录制所用的容器格式，作为一个完成态的 Blob 送达。（设置了 `render.export: false` 的工具 - 例如 Color Palette、Countdown Timer、Strip Hidden Data、Text Helper、Compress PDF - 会隐藏下载/格式/尺寸控件。）物理单位在此按格式转换（PDF → 真实的页面点数，位图 → 按 DPI 转换为像素并带上 `pHYs` 数据块）。作者/溯源元数据（作者、工具、来源 - 由 `engine/src/metadata.ts` 构建）按格式嵌入：PNG iTXt、JPEG EXIF、PDF info 字典、SVG `<metadata>`、GIF 注释。实验性工具的水印由宿主环境插入，而非工具本身。

![`?options` 打开的导出面板：文件名与格式配对、输出尺寸，以及写入文件的控件](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

在 Tauri 中生命周期相同。在 CLI 中生命周期也相同 - jsdom 提供无头 DOM；输出写入文件或 stdout。

---

## 开源状态

**代码采用 MPL-2.0 许可。** `engine/`、`shells/*`、`services/*`、`schemas/` 和 `docs/` 均以 **MPL-2.0** 许可开源——这是一套面向品牌工具的、与厂商无关的脚手架平台,每个可交付单元都在 [github.com/lolly-tools](https://github.com/lolly-tools) 下拥有自己的仓库。

**工具内容以品牌包的形式发布**,每个品牌包都有自己的条款(见该包的 `NOTICE.md`)。`community/` 是公开的 [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) 仓库,其中与品牌无关的工具同样以 MPL-2.0 许可。`brands/suse/` 是私有的 `suse-lolly` 包:SUSE 的工具与 SUSE 目录,**为 SUSE 专有**,包括其已获授权的 PremiumBeat 音乐。`brands/lolly-start/` 是本仓库自有的空白入门品牌。字体以 **SIL Open Font License 1.1** 许可随品牌包发布——SUSE 包携带 SUSE 和 SUSE Mono 两款字体。

仓库根目录下的 `tools/` 和 `catalog/` 是被 Git 忽略的*视图*:某个配置文件会把它们从 `community/` 加上当前激活的品牌包组装而成,这也是为什么每个脚本和外壳读取的都是这两个路径,而从不直接读取某个品牌包。

这种拆分被强制执行——`engine/` 不会反向导入工具内容——因此平台与内容之间的边界始终保持整洁。

---

## 引擎的边界与宿主环境的起点

如果能用纯数据 + Handlebars 描述 → **引擎**。
如果涉及 DOM、文件系统、网络或任何浏览器/操作系统 API → **宿主环境**。

这条界线是刻意划清的。引擎是开源部分。任何了解 SUSE、特定平台或运行环境的内容都不会进入其中。

若要了解更深一层的细节，[`engine/README.md`](../engine/README.md) 列举了每个引擎模块及其职责，而[威胁模型与信任边界](/info/threat-model.html)则记录了这条界线同时作为信任边界的位置。
