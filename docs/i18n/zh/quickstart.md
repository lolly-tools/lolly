# 快速上手

Lolly 把你的规则（配色、字体、版式、逻辑）变成任何人都能用的工具：填几个字段，就能做出成品文件，包括图片、PDF、社交卡片和视频。几乎没有什么要学，也不用上传任何东西：制作和导出都在你的设备上运行，联网或离线都可以。

这是最先该读的一页。两件事让你上手：**把 Lolly 变成你自己的**，以及**把你已有的东西带进来**（你的设计文件和设计令牌）。其余内容都只在一个链接之外。

> 第一次用 Lolly，只想先做点东西出来？[60 秒做出一件作品](/info/make-something.html)会带你走完三个例子，或者[打开应用](/#/)，从图库里挑一个工具，把空格填好，按 **Export**。等你想让它穿上*你自己的*品牌时，再回到这一页。

![Utilities 视图：Strip Hidden Data、Compress PDF、Convert Image 这类在设备上干活的常用工具，全都集中在一处](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. 把它变成你的：配置你的设计系统

在 Lolly 里，你的品牌就是一份小小的**设计令牌**文档，包含配色、字体和几条规则，每个工具都按它来渲染。设置一次，之后做出来的每样东西从生成时就是合乎品牌的，而不是靠事后审核。有三条入口，挑一条和你的品牌现在所在之处相符的。

### 从零开始（设计系统构建器）

首次运行会把你带到**图库**，上面浮着一个简短的欢迎对话框，提供三条入口：**Make it yours**（位于 `#/start` 的 Brand Studio）、**Bring your design**（拖入一个 Figma、Penpot、InDesign 或 PDF 文件，它会作为可编辑的版面打开，这是通往下文[带入你已有的东西](#2-bring-in-what-you-already-have)最快的路径），以及 **Explore the community tools**，如果英语不是你的语言，下面还有一排语言可选。选第一张卡片，你就落到了[**Brand Studio**](/info/brand-studio.html)。给它起个名字、选一个主色，Lolly 就会由此*推导*出一整套无障碍调色板，包括明暗表面、文字和强调色，用的正是引擎在别处使用的同一套色彩数学。

![Brand Studio 的 Colours 房间：一个主色，以及 Lolly 由它推导出的无障碍调色板](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) 再选一款字体，不到一分钟你就有了一个能用的品牌。从这里开始，工作室的六个房间（Overview、Colours、Type、Logos、Tokens、Files）让你按任意顺序把它做到你想要的程度，随时回来继续打磨。仪表板的 **Design system** 标签页（`#/d`）以只读方式显示结果，并指回 `#/start`，编辑就发生在那里（除非你用的是品牌锁定版的 Lolly，那里的品牌是固定的，没有什么可改）。

### 导入你已有的品牌

如果你的品牌已经以设计令牌的形式存在，来自 **Penpot**、**Tokens Studio**（Figma）或任何普通的 **DTCG** 文件，那就整体带进来，不必重新录一遍。两条路径：

- <!--i:palette--> **在应用里：**[设计系统构建器：Brand Studio](/info/brand-studio.html)（`#/start`）通过房间导轨底部的 **Add from…** 接收它，可以是一个令牌文件、一份 Penpot 导出、一个 SVG 或一个 `LollyBrand` 包。拖进去，调色板就亮起来了。
- <!--i:code--> **从命令行**，用来搭起一个可复用的品牌包：

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` 接受 Penpot / Tokens Studio 导出同一份文档时用的全部三种容器：单个 `tokens.json`、一个目录（`$metadata.json` 加上每个集合的文件），或一个 `project.penpot` 归档。加上 `--activate`，它会把该品牌注册为一个配置档、切换过去并重建目录。品牌包和配置档如何配合，见[配置](/info/configuration.html)。

### 在应用里微调

品牌一旦启用，就继续在[**Brand Studio**](/info/brand-studio.html)（`#/start`）里塑造它：改一个颜色或一个角色，应用里的每个预览都会随你输入而更新。（仪表板 `#/d` 的 **Design system** 标签页只是以只读方式*显示*品牌；编辑在工作室里进行。）

![仪表板的 Design system 标签页：以只读方式显示当前启用的品牌](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) 同一个品牌也会在 **Profile → Your brand** 卡片上做概要展示。字体是真实的：从 Google Fonts 里挑一款，Lolly 会把文件作为品牌资产存**在你的设备上**，这样你的排版可以离线随行，渲染时不必去取任何东西。

满意之后，**把品牌导出为一个 `LollyBrand` 包**，同事导入这一个文件，就能得到完全相同的调色板、字体和规则。品牌就是这样在人和机器之间流转的，中间不需要服务器。

> **品牌令牌可以双向往返。**因为 Lolly 的品牌*就是* DTCG 令牌，也就是 Penpot 原生读写、Tokens Studio 带进 Figma 的那种格式，所以你*用来*设计的调色板和 Lolly *强制执行*的调色板是同一份文档，而不是两份要靠手工保持同步的清单。见[设计令牌](/info/design-tokens.html)。

## 2. 带入你已有的东西

你不必从一张白纸开始。Lolly 能打开你已经拥有的设计成果和开放格式。

### 开源设计文件

在 **Figma、Penpot、Illustrator、InDesign 或任何 SVG 应用**里完成的作品，不必被锁在你画它的那个应用里。打开 **Design**，点击 **Import a design**，文件就会作为一个*活的版面*打开，而不是一张压平的图片。每个图层都变成可编辑的框：文字仍然可以重新输入，形状仍然是形状，图片进入你的素材库，复杂的矢量图形被忠实保留。它到达时已经符合你的品牌字体和配色规则。

| 你有的 | 用什么方式带进来 |
|---|---|
| 一个 Figma 画框 | 原生 `.fig`（File → Save local copy），或一份 SVG 导出 |
| 一份 Penpot 设计 | 它的 `.penpot` 导出，或任何 SVG |
| 一个 Illustrator 文件 | 原生 `.ai`（PDF 兼容）或 `.pdf`，可直接打开 |
| 一份 InDesign 版面 | `.idml`（File → Export → InDesign Markup） |
| 其他任何东西 | **任何 SVG**，通用的入口 |

整个导入过程都发生**在你的设备上**：文件在你的浏览器里解析，不会上传任何东西。完整细节，以及究竟哪些内容会被带过来，见[导入设计](/info/design-import.html)。

手上是一份 **PowerPoint 演示文稿**？把 `.pptx` 拖到 **Deck Builder** 上，就能逐页编辑，而且已经贴合你的品牌；或者运行 **Rebrand a Deck**，把同一份演示文稿换上新主题拿回来，图表和动画都完好。

### 从一次性作品到模板

回报在这里：导入的版面就是一个普通的 Design 会话，所以你一**保存**，它就活在一个 URL 上。任何装有 Lolly 的人都能打开那个 URL，改文字、换图片、渲染出自己的版本，不需要设计软件，而且被锁住的部分仍然锁着。一次性的设计变成了可复用的工具。这就是全部想法，而且一行配置都不用写。

### 开放数据与开放工具

[社区工具集](/info/builders.html)是开源的，也与品牌无关，包括二维码、街道地图、滤镜和隐私工具，而在你启用品牌的那一刻，它们就按*你的*品牌来渲染。

也可以把你自己的开放数据喂给工具：粘贴或拖入一张 **CSV** 或 **JSON** 表格，工具的重复字段就会由它填充，每一行产出一件成品。

## 3. 做出东西，然后分享或自动化

品牌已启用、素材在手，每个工具都能产出一个成品文件：

- <!--i:download--> 把任何工具**渲染**成 **SVG、PDF、PNG、JPG、WebP、视频**等格式，需要时还能按真实印刷尺寸和物理单位输出。见[导出与格式](/info/exporting.html)。
- <!--i:link--> **分享一个链接。**每一个工具状态都是一个 URL，所以成品既可复现，又能按参数寻址：把链接提交进代码库，需要时再重新生成。
- <!--i:layers--> **批量来做。**在[批量表格](/info/exporting.html)里用一张电子表格驱动模板：每一行产出一件成品。
- <!--i:cpu--> **把它自动化。**同一套渲染既可以从 [CLI](/info/cli.html) 运行，也可以由 [AI 智能体](/info/ai-agents.html)运行，URL 就是 API。

“URL 就是 API”是字面意思。下面这张图表没有人画过：它的类型、标题和整张数据表都是敲进地址栏的，而同一个链接在任何设备上都会渲染出同一张图表。

![月度注册量面积图,图中的每个数值都以查询参数的形式传入,而非通过点击生成](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 接下来去哪里

三条路径，取决于你来这里是要做什么：

- <!--i:people--> **[Lolly 创作者指南](/info/creators.html)**：你负责做东西。这里讲优势，以及怎样把应用用到极致。
- <!--i:code--> **[Lolly 构建者指南](/info/builders.html)**：你负责编写工具、做集成和部署。这里是技术文档。
- <!--i:shieldcheck--> **[Lolly 运维者指南](/info/operators.html)**：你负责整个组织的品牌、安全和推广落地。
