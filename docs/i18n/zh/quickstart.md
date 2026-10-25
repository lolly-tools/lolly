# 开始

读完本页，你的工具就会采用你自己的颜色和字体，你已有的作品也能随时复用。你不需要账号，制作和导出都在你的设备上完成。

::: timeline
- <!--i:sparkle--> **做出一个文件。** [制作你的第一个文件](/info/make-something.html)带你用几分钟做出一个二维码。
- <!--i:palette--> **导入你的品牌。** 从一种颜色、一个令牌文件或一份成品设计开始。
- <!--i:layers--> **批量做出更多同类文件。** 分享链接、填充电子表格，或通过脚本运行工具。
:::

对这个理念本身还不熟悉？[什么是 Lolly？](/info/what-is-lolly.html)是五分钟的入门介绍，[Lolly 如何工作](/info/how-lolly-works.html)展示了各方分别做什么。

## 导入你的品牌

lolly.tools 默认打开 **Lolly Demo**，即 Lolly 自己的示例设计系统；[认识 Lolly Demo](/info/lolly-demo.html)说明了你看到的是什么。你的设计系统会取代它：一小组设计令牌，也就是颜色、字体和几条规则，每个工具都用它来绘制。设置一次，之后你做的一切都从符合品牌的状态开始。

选择与你手头内容相符的路径：

- <!--i:palette--> **一种颜色。** 打开 **Design System Setup**（`#/start`），为你的设计系统命名并选一个主色。Lolly 会据此推导出完整且无障碍的调色板，包含浅色和深色表面、文字和强调色。再选一个字体，你就有了一个可用的品牌。
- <!--i:upload--> **一个令牌文件。** Design System Setup 中房间栏底部的 **Add from…** 接受 DTCG、Tokens Studio 或 Penpot 令牌文件、SVG，或 `LollyBrand` 包。拖进去，调色板就会填好。当设计系统仍然为空时，Overview 房间中的 **Start from a reference** 会打开同一个选择器。
- <!--i:pentool--> **一份成品设计。** 在 Design 中选择 **Import a design**，拖入 `.fig`、`.penpot`、`.ai`、`.idml` 或 SVG 文件。参见下文的[带入你已有的内容](#bring-in-what-you-already-have)。

你第一次打开图库时，会有一段简短的欢迎，提供同样的选择：**Make it yours** 打开 Design System Setup，**Bring your design** 打开设计文件选择器，**Explore the community tools** 关闭欢迎页。

![全新安装后 Design System Setup 的 Colours 房间：一个实时色块、一个字段，以及第一个决定的全部内容](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

从这里开始，七个房间可以按任意顺序，带你想走多远就走多远：**Overview**、**Colours**、**Type**、**Logos**、**Tokens**、**Files** 和 **Usage & rules**。应用中的每个预览都会随你输入而更新。[Design System Setup](/info/brand-studio.html) 介绍了每个房间。

字体保存在你的设备上。选一个 Google Font，Lolly 会把字体文件存为品牌素材，所以你的字体可以离线随身携带，工具绘制时不会获取任何内容。

### 查看、切换和分享设计系统

- **查看当前使用的。** **Settings → Design system** 以封面和页面的形式显示当前设计系统，只读。
- **在它们之间切换。** **Settings → Preferences → Design systems** 列出这台设备上的每个设计系统。一个组织可以运行多个设计系统，或一个带有多种配色方案的设计系统；[品牌架构](/info/brand-architectures.html)梳理了这些安排。
- **分享一个。** 把设计系统导出为 `LollyBrand` 包：一个同事导入后就能得到相同调色板、字体和规则的文件。

由你的构建版本或组织提供的设计系统是**受管理的**：它显示一把锁并保持只读。要更改，请在 **Settings → Preferences → Design systems** 中创建一个可编辑的副本。

![Settings 中的 Design system 标签页：以封面和页面形式显示的当前设计系统](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

你的设计系统就是 DTCG 令牌，Penpot 读写这种格式，Tokens Studio 把它带进 Figma，所以你设计时用的调色板和 Lolly 应用的调色板是同一份文档。[设计令牌](/info/design-tokens.html)有详细说明。

::: details 面向开发者：从命令行构建品牌包
要在检出的代码库中建立一个可复用的品牌包，`ingest:brand` 接受 Penpot 和 Tokens Studio 导出的三种容器：单个 `tokens.json`、带有 `$metadata.json` 的按集合拆分的文件目录，或 `project.penpot` 存档。

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` 会把品牌注册为配置文件，并构建和验证它的目录。它绝不会更改默认配置文件：运行时加上 `LOLLY_PROFILE=acme` 即可使用新的包。[配置](/info/configuration.html)说明了品牌包和配置文件如何配合。
:::

## 带入你已有的内容

你不必从空白页开始。

**设计文件。** 来自 Figma、Penpot、Illustrator、InDesign 或任何 SVG 应用的成品，会在 Design 中作为活的版面打开：文字仍可重新输入，形状仍是形状，图片进入你的素材库。文件在你的浏览器中读取，不会上传任何内容。[导入设计](/info/design-import.html)列出了每种格式及其保留的内容。

**演示稿。** 把 PowerPoint `.pptx` 拖到 Lolly 上，即可把其幻灯片归档为素材；在 **Markdown Slides** 中用 Markdown 写一份新演示稿；或使用[重塑演示稿品牌](/info/rebrand.html)，把整份演示稿移到你的设计系统上。

**数据。** 粘贴或拖入 CSV 或 JSON 表格，工具的重复字段就会据此填充；或者用[批量生成](/info/batch.html#make-many-versions-of-one-design)，为每一行生成一个成品文件。

### 从一次性作品到模板

导入的版面就是一个普通的 Design 会话。**Share with rules** 会把它变成一个工具：你选择其他人可以更改哪些部分，他们只填写这些部分。

![保留 Design 母版，在创作副本中选择输入项和限制，再分享一个收件人填写的可复用 .lolly 工具](/info/diagrams/concepts/share-with-rules.svg)

[带规则分享设计](/info/create-a-tool.html)逐步讲解每个步骤。

## 批量制作、分享和自动化

- <!--i:download--> **导出。** 工具可以生成 SVG、PDF、PNG、JPG、WebP、视频等，具体格式取决于每个工具提供的选项，需要时可以达到真实印刷尺寸。参见[导出文件](/info/exporting.html)。
- <!--i:link--> **分享链接。** 工具的设置随链接一起传递，所以这个链接在任何地方都能重新打开同一个文件。
- <!--i:layers--> **每行做一个。** 在[批量生成](/info/batch.html#make-many-versions-of-one-design)中用电子表格驱动工具。
- <!--i:cpu--> **自动化。** 同样的渲染可以通过 [CLI](/info/cli.html) 和 [AI 代理](/info/ai-agents.html)运行。

链接就是一个完整的请求。下面的图表不是任何人画的：它的类型、标题和整张数据表都是输入在地址栏里的，同一个链接在任何设备上都会画出同样的图表。

![月度注册量面积图,图中的每个数值都以查询参数的形式传入,而非通过点击生成](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 接下来去哪里

- <!--i:people--> **[创作](/info/creators.html)**：制作、动画、录制、分享和导出。
- <!--i:code--> **[自动化](/info/builders.html)**：设计系统、工具创作、命令行、链接和代理。
- <!--i:usercheck--> **[管理](/info/operators.html)**：用 Lolly Work 为团队运行 Lolly。
- <!--i:server--> **[部署](/info/operate.html)**：托管 Lolly 和 Lolly Work。
- <!--i:shieldcheck--> **[信任](/info/trust.html)**：隐私、安全，以及自己检查文件。
