# 导出文件

你做出了某样东西，它需要离开 Lolly：用于聊天的 PNG、给印刷厂的 PDF、同事要继续编辑的演示稿。按 **Export**，即 **Export | Save** 按钮的左半边。在文件名旁边选择一种格式，然后按 **Download**。文件在你的设备上生成。

你在画布上看到的就是文件所包含的内容。格式菜单只列出这个工具在这个浏览器中能制作的格式。

对大多数任务来说，三种格式中的一种就合适：

| 用途 | 选择 | 原因 |
|---|---|---|
| 屏幕、消息或幻灯片 | **PNG** | 每个应用都能打开，工具提供透明背景时也能保留 |
| 成品页面，或任何要打印的东西 | **PDF** | 真实的页面尺寸，打印效果所见即所得；工具提供时，**Print PDF** 是用于印刷机的 CMYK 版本 |
| 必须在任何尺寸下都保持清晰的美术作品 | **SVG** | 矢量图形，从徽章到横幅都清晰锐利 |

::: check 按实际使用的尺寸检查文件
发送之前，请在它要用于的屏幕上打开它，或按真实尺寸打印一次。
:::

::: details 使用 Lolly Work 的审批和交付（可选）
[运行 Lolly Work 的组织](/info/organisation.html)可以管控其成员能看到哪些格式和导出设置。在需要批准的地方，**Request approval** 取代 **Download**。请遵循你的实例显示的政策。

Lolly Work 还可以把文件交付到已配置的 S3、WebDAV 和 HTTP 目的地，带有审批步骤、交付回执和审计记录。为此工作流提交文件会把它发送到组织的服务；普通下载则留在你的设备上。个人 Send 目的地和组织交付是分别配置的。

运营者按[组织交付指南](/info/work-delivery.html)进行设置。关于排队的服务器渲染和批处理，请参见 [CLI 批处理与自动化](/info/cli-automation.html#organisation-jobs-with-lolly-work)。
:::

## 导出的工作方式

导出时，工具的画布会渲染为你选择的格式，并作为下载交给你，或放入你的剪贴板。

有三条路径会生成文件。大多数工具**渲染画布**。文本和数据格式（HTML、Markdown、TXT、JSON、CSV、ICS、VCF）是**根据工具的内容生成**的，而不是从画面绘制的。像 *Strip Hidden Data* 这样的隐私实用工具会在你的设备上**转换你选择的文件**，并交还给你，没有画布、水印或附加的元数据，因为它本来就是你自己的文件。

![三条导出路径汇集到一个成品文件：渲染画布、根据内容生成文本或数据，或在设备上转换选中的文件。](/info/diagrams/concepts/three-export-paths.svg)

导出面板提供这些操作。工具的作者选择显示哪些；默认集合是 Copy、Download 和 Save。

- <!--i:download--> **Download** 保存文件。如果之后找不到，请参见[查找你下载的文件](/info/find-your-work.html#find-a-file-you-downloaded)。
- <!--i:photos--> **Copy** 把图片放入你的剪贴板，可以粘贴到聊天、电子邮件或文档中。在浏览器无法复制图片的地方，它会改为下载并告知你。
- <!--i:folder--> **Save** 一键把当前设计保存到 Projects，绝不下载文件。**Save as** 位于 **Download** 旁边，会询问存放位置（参见[保存与继续](/info/using.html#saving-continuing)）。
- <!--i:link--> **Share** 打开 Share 对话框：一个可复现设计的链接、访问时的开关（全屏、导出面板、打开时下载或复制），以及可选的 **Shortest link**，它把整个状态压缩成一个紧凑的令牌（参见 [URL 模式](/info/url-mode.html)）。

![导出面板 - 格式、尺寸以及复制/下载/保存/分享操作](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

当一个设计嵌入了另一个工具的渲染结果时，例如包含 QR Code 链接的 Design 图片框，嵌套的渲染结果会被绘制进父项的导出中。它在 SVG 和 PDF 中保持真正的矢量，在 PNG、JPG 和 WebP 中则清晰地栅格化。嵌入的渲染结果没有水印，也没有自己的出处信息；只有成品文件才有。HTML、Markdown 和 TXT 导出无法容纳组合的渲染结果。

## 选择格式

文件名和格式菜单会合并显示为一个 `name.format` 组合，位于**下载**下方。

![与格式选择器融合的文件名字段，使导出呈现为一个 name.format 组合](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

从文件的去向开始。每张卡片列出适合该目的地的格式；工具只显示它能制作的格式。

::: figure exporting-format-chooser
六个目的地，以及适合各自的格式。
:::

用设计系统字体排版的字标会导出为 SVG，每个字母都是转曲的路径，所以一个文件在名片尺寸和大楼外墙尺寸下都同样清晰。

![一个字距很宽的极细字标，写着 Aurora，这正是表格中 SVG 一行所说的纯矢量作品](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details 每种格式及其用途
| 你想要 | 使用 | 原因 |
|---|---|---|
| 可缩放的清晰徽标或作品 | **SVG** | 矢量：可缩放、体积小且可编辑；矢量导出无法绘制的效果会作为图片嵌入 |
| 用于 Office 和 Windows 应用的矢量 | **EMF** | 作为可编辑矢量粘贴到 PowerPoint 和 Word，文字是实时文字；Google Drive 用 Google Drawings 打开它 |
| 用于印刷和设计应用的矢量 | **EPS**，或 **EPS (CMYK)** | 面向 Illustrator 和印刷流程的 PostScript 矢量 |
| 用于切割机的矢量 | **DXF** | 激光切割机、刻字机和 CNC：以毫米为单位的轮廓路径 |
| 可编辑的幻灯片演示稿 | **PowerPoint** (PPTX) | 原生可编辑的文字和形状，图片和矢量保持可提取 |
| 可编辑的文本文档 | **Word** (DOCX) 或 **OpenDocument** (ODT) | 文字处理软件可以继续编辑的真正段落和标题（Doc Studio） |
| 用于 InDesign 的版面 | **InDesign IDML (static subset)** | 文字、矩形、椭圆和图片，每个画板一个跨页（Design） |
| 可编辑的 Penpot 文档 | **Penpot** | 画板、形状、文字和关联的令牌 |
| 照片或通用图像 | **PNG**（无损）或 **JPG**（更小） | 通用栅格图 |
| 更小的现代图像 | **WebP** 或 **AVIF** | 压缩更好，支持透明 |
| 印刷 | **PDF**，或 **Print PDF** (CMYK) | 真实页面尺寸；CMYK 用于印刷机 |
| 用于印刷机的栅格印刷 | **Print TIFF** (CMYK) | 供 RIP 使用的 DeviceCMYK 像素 |
| 用于网页的动画 | **GIF** | 到处都能播放；文件较大 |
| 全彩且带真实透明的动画 | **APNG** | 动画 PNG：没有调色板限制 |
| 动画，文件最小 | **Animated WebP** | 全彩和透明，比 GIF 或 APNG 更小 |
| 可缩放的动画矢量 | **Animated SVG** | 自包含；可在浏览器或 `<img>` 中循环播放，任意尺寸（Lottie Ad） |
| 仍可编辑的动画 | **dotLottie** | 来自 Design 时间线的形状、路径和外层变换关键帧 |
| 交给 Premiere | **Premiere XML + media** | 为 Premiere 准备的定时片段和原始媒体（Design） |
| 用于社交和分享的视频 | **MP4** 或 **WebM** | 相对于文件大小质量最佳（参见[视频](#video)） |
| 字幕 | **SRT** 或 **VTT** | 用于视频播放器的定时文字（Captions、Audiogram 和 Record） |
| 培训课程 | **SCORM (LMS)** | 带版本的网站、SCORM 或 xAPI 包（参见 [SCORM](#scorm-course-packages)） |
| 富文本或电子邮件签名 | **HTML** | 以格式化形式粘贴到邮件客户端 |
| 纯内容 | **MD** 或 **TXT** | 仅文字 |
| 日历事件 | **ICS** | 导入任何日历应用 |
| 联系人名片 | **VCF** | 导入通讯录 |
| 要重新导入的结构化数据 | **JSON** 或 **CSV** | 往返保留工具的内容 |
| 网站图标 | **ICO** | 多尺寸网站图标；**ZIP** 打包多种格式 |
:::

### 透明度

支持透明的工具提供透明背景开关，例如 **No BG**。PNG、WebP、AVIF、SVG、APNG 和 Animated WebP 保留透明度，GIF 保留硬边。JPG 和 PDF 始终不透明。TIFF 会拼合到白色上，在 [HDR](#hdr-bright-colours) 下所述的 HDR 路径中则拼合到黑色上。

## 尺寸与印刷单位

除非工具提供 **dimensions**，否则导出使用工具的原生像素尺寸。提供时，你可以设置宽度、高度和 **unit**：

- **px**（默认）是精确的像素。
- **mm、cm、in、pt** 和 **pc** 是物理尺寸。使用物理单位时，你还要设置 **DPI**（默认 300）。**PDF** 会按该尺寸成为真实页面，**栅格图**会得到该 DPI 对应的像素数并记录分辨率，**SVG** 则保留物理单位并带有像素 viewBox。

要获得更高分辨率的栅格图，请输入更大的宽度和高度，或选择物理单位并提高 DPI（像素 = 尺寸 × DPI）。宽度 `210`、高度 `297` 和单位 `mm` 构成 A4 页面。

![尺寸行设置为 210 x 297 mm，DPI 字段因单位为物理单位而显示出来](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## 从有时间线的作品中导出静帧

定时作品，例如 Design 中的 [Sequence](/info/sequence-editor.html) 时间线，是会动的，所以静态导出必须选择一个时刻：**播放头处的帧**。把播放头停在你想要的画面处再导出。

如果需要多个时刻，**Frames** 字段会出现在输出尺寸旁边。它只在定时作品和静态格式（PNG、JPG、WebP、SVG 或 PDF）下显示。保持 `1` 表示播放头处的帧。调高它，就会得到相应数量的静态图，均匀分布在整个序列上：

- PNG、JPG、WebP 和 SVG 作为一个 ZIP 返回：`<name>-01.png`、`-02.png` 等等。
- PDF 作为一份文档返回，页数与该数量相同。

每张静态图都取自其对应时间线片段的中间，所以第一帧绝不会是半淡入的入场，最后一帧也绝不会是所有片段结束后的空白时刻。

::: figure exporting-contact-sheet
Frames: 4 把序列切成四个相等的片段，并取每个片段的中间。
:::

可用于故事板、审阅用的联系表，或从视频剪辑中截取的社交媒体轮播图。数量上限为 64，字段中输入的其他任何内容都会回退为 `1`。每一帧都是普通的静态图，所以凭据、Imprint、物理单位和 DPI 的行为与单次导出相同。导出链接、CLI 和 MCP 用 `cuts=` 请求同样的联系表（参见[联系表](/info/url-export.html#contact-sheets)）。

## 一次处理多个文件

Lolly 有三种批量处理的方式，各自适用于不同的任务：

::: cols
## 一张表格变成一份文档
带有表格输入项的工具，例如 **Battlecards**，会把每一行变成一页。从你的电子表格粘贴一张表格，就得到一份 PDF。在电子表格中修正各行，再粘贴一次。
## 一份 CSV 变成每行一个文件
**Batch**（`#/batch`）读取 CSV，并为每一行渲染一次导出：姓名牌或证书，每人一个文件，以 ZIP 交付。参见 [Batch](/info/batch.html#make-many-versions-of-one-design)。
## 多个设计一次编辑
**Multi-edit** 把多个已保存的会话并排打开，对不同设计做同样的修饰。参见 [Multi-edit](/info/batch.html#edit-several-saved-designs-together)。
:::

在 **Projects** 中，**Render folder** 会把文件夹及其子文件夹中每个已保存的会话导出为一个嵌套的 ZIP，**Render selection** 对任何多选执行同样的操作；单个已保存的会话则渲染为它自己的文件。已保存的会话还可以在 Projects 中再次作为工具链接分享，它会用相同的设置重新打开。

## 在别处仍可编辑的文件

有些格式把你的作品作为可编辑的内容而不是图片交给另一个应用。

### PowerPoint (PPTX)

Design、Markdown Slides、Booklet、Doc Studio、Chart、Diagrams、Flow Chart 和 Agenda 会导出 PowerPoint 演示稿，每页一张幻灯片。每一页都被拆分为原生对象，这样同事可以编辑演示稿并从中取出素材：

- <!--i:font--> **文字**变成可编辑的 PowerPoint 文本框，保留版面的字号、颜色、字重、斜体和对齐。
- <!--i:pentool--> 徽标和图标等**矢量图**作为 SVG 图片嵌入；它们保持清晰，PowerPoint 可以对它们执行 *Convert to Shape*。
- <!--i:photos--> **图片**以原生分辨率作为各自的图片导出。裁切过的主图会在裁切之后保留完整的图像，其上的任何滤镜或混合都已烘焙进去。
- <!--i:layers--> **背景、边框和线条**变成矩形和线条形状。

![选中 PowerPoint 的导出面板:每页一张幻灯片,文字和形状保持可编辑](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

版面是近似的；目标是可复用的内容。遍历器无法原生表达的任何内容，例如带复杂滤镜或蒙版的区域，会作为图片嵌入，所以不会丢失任何东西。演示稿只有一种幻灯片尺寸，取自第一页。

PowerPoint 也是一个入口：[重塑演示稿品牌](/info/rebrand.html)把演示稿移到你的设计系统上，[导入设计](/info/design-import.html)则在 Design 中打开一份演示稿。

### Penpot

大多数导出 SVG 的工具也会导出 **Penpot 文件**（`.penpot`），可直接在 Penpot 中继续编辑。

| 你做的内容 | 在 Penpot 中 |
|---|---|
| 文字 | 可编辑的文本对象：修正错字或重新设置样式 |
| 形状、路径、渐变和图片 | 各自可编辑的矢量形状 |
| 来自设计系统令牌的颜色或字体 | 实时令牌链接：编辑令牌，所有继承它的形状都会跟随 |
| 整个设计 | Assets 面板中可复用的组件 |
| 复杂的插画或实时画布 | 单独作为图片嵌入，其周围的可编辑内容不受影响 |

从 Design 导出时，每个画框都变成一个 Penpot 画板。设计系统的颜色和字体样式进入 Assets 面板，其完整的令牌集合进入 Tokens 面板。Penpot 从此保留自己的副本：在 Penpot 中编辑的令牌会通过 [Design System Setup](/info/brand-studio.html) 中的导入回来。

![选中 Penpot 的导出面板:.penpot 文件,以及下载按钮旁的“发送到 Penpot”](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

要打开文件，启动 Penpot，选择一个项目并选择 **Import**。如果已从导出面板登录 Penpot，**Send to Penpot** 会替你完成这一步。

### Word、OpenDocument 和 InDesign

**Doc Studio** 导出带有真正段落和标题的 **Word** (DOCX) 和 **OpenDocument** (ODT)。

**Design** 导出 **InDesign IDML (static subset)**：文字、矩形、椭圆以及 PNG 或 JPEG 图片，每个画板一个跨页。支持的行内格式保持可编辑，图片放在 `Links` 中传递，坐标转换为 InDesign 点。重新链接、字体替换和换行变化可能需要留意。效果、动画、组合的文章和不支持的几何图形会让导出中止，并给出列出它们的报告。IDML 不保留原始文档，所以成品作品请发送 PDF。

### 时间线：dotLottie 和 Premiere

从 Design 的时间线，**dotLottie** 写出一个在 Lottie 工具中仍可编辑的动画；[Lottie 动画](/info/sequence-editor.html#lottie-animations)列出了它保留的内容。**Premiere XML + media** 把定时片段及其原始媒体打包给 Premiere；参见 [Premiere XML 交换](/info/sequence-editor.html#premiere-xml-exchange)。

### SCORM（课程包）

在你于 Settings → Preferences → Feature flags 下开启 **Training and courses** 之前，课程导出是关闭的。

然后从受支持的工具、项目文件夹或选区中选择 **Export course**。在 Design 中，选择 **SCORM (LMS)** 并 **Download** 会打开同一个课程工作流。Lolly 会保存作品，让你审阅课程内容和顺序，然后打开该模块及其导出对话框。

- <!--i:layers--> 为每个来源选择呈现形式：静态页面、作为视频的动态内容、音频或可下载的资源。在模块中添加课程文字和阅读替代内容。
- <!--i:clock--> 预览学习者播放器，并审阅说明和字幕。动态内容以视频形式包含，包括无声动画。
- <!--i:document--> 选择 Website、SCORM 1.2、SCORM 2004 4th Edition 或实验性的 xAPI 目标。检查内容和 ZIP 大小，然后保存并下载检查过的版本。
- <!--i:check--> 完成需要确认每个必修课程并选择 Finish。

![已选中 SCORM (LMS) 的 Design 演示文稿导出面板](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

该包包含其成品内容，不需要 Lolly 账号。把 Website ZIP 放在 HTTP(S) 主机上；LMS ZIP 则原样导入。分享课程之前请测试目标环境。对于由多个已保存创作构建的课程，请参见[创建培训课程](/info/training-creators.html)。

### DXF（切割文件）

Asset Export、Diagrams、Growth、Logo Wall、QR Code、Street Map、Wayfinding 和 Wordmark 会导出 **DXF**，即激光切割机、刻字机和 CNC 软件读取的 AutoCAD R12 交换格式。几何图形以毫米为单位的轮廓路径写出，文字被转曲，颜色映射到最接近的 AutoCAD 颜色索引，这通常决定切割机的操作。DXF 只有线稿：照片或带滤镜的区域没有切割路径，会被丢弃并给出警告。要保留栅格内容，请使用 SVG 或 PDF。

Street Map 是最清楚的例子。整个设计本来就是描边，所以每条道路和运河都变成一条切割路径。

::: showcase
![巴黎的 Street Map 渲染图,米色背景上的墨色线条 - 纯线条图形,因此每一笔描边都能完整传递到切割机](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

滚动查看,镜头会穿过实际的几何图形向后拉远:七条路径,没有任何像素,每一笔描边在任何缩放级别下都清晰如发丝。这正是切割机读取的同一份文件。
:::

## 印刷

**Print PDF** 针对具名的印刷条件写出 CMYK，默认为 **Coated FOGRA39**。带有实测油墨值的品牌色板会被精确转换；其他颜色使用标准的设备转换。**Print TIFF** 写出供 RIP 使用的 DeviceCMYK 像素，并在其 TIFF 元数据中记录同样的印刷条件。Colour profile 控制项同时作用于两者；详见[颜色配置文件](#colour-profiles)。

**Print marks & bleed** 在印刷格式上有自己的卡片：以毫米计的出血，以及 Crop、Registration、Bleed、Colour bars 和 Stamp details。

有些工具生成**多页 PDF**：封面、按需流动到任意页数的内容和封底，如 *Booklet* 工具。每页都是 A4、US Letter 或 A5 的真正竖版 PDF 页面，你可以强制任何块另起一页。这些是没有裁切或出血标记的 RGB 文档，那些标记属于单页 Print PDF。Design PDF 也可以是 **Notes handout**：每张幻灯片一个竖版页面，下方是其演讲者备注。

**导出之前。** 面板底部的 **Before you export** 卡片会说明印刷厂将看到什么：格式、尺寸和出血、裁切和出血区域、墨量覆盖、印版数和页数，标题旁有一个结论。它绝不会阻止导出。Design 总是显示这张卡片及其自己的检查，包括设计系统的内部规则（逐图层）和文档文字的写作信号（[导出之前](/info/design.html#before-you-export)），并在 **Print preflight** 开启时加入这些印刷检查。在其他工具中，请在 Settings → Preferences → Feature flags 下开启 **Print preflight**；它默认关闭，Lolly Work 部署可以为其成员开启它。

**导出之后。** 文件准备好后，Lolly 会把它读回来，并与你的选择比较：格式、像素或页面尺寸、片段长度、透明背景、CMYK 颜色、HDR、Content Credentials 以及 PDF 或 ZIP 密码。任何不同之处都会写在导出卡片上。每个测量值都来自文件，而不是设置，文件无法回答的属性不会被算作匹配。命令行用 `--export-report` 写出完整的比较（参见[用 CLI 渲染](/info/cli-rendering.html)）。

Design 检查器的检查和 Design System Setup 中的品牌比较是独立的检查：它们查看设计，而这两张卡片查看文件。

::: details 来自价目卡的成本
在预检下方，成本卡片会把同样的计数转换为金额，只使用有人提供的价格。即使预检卡片本身关闭，它也会读取这些计数。它需要两样东西：价目表可以定价的任务（印版、纸张、面积、页数、变体行数或输出文件，所以普通的徽标 PNG 从不显示它）和一张 **rate card**，即来自你的印刷商的 JSON 价目表。默认构建不附带任何价目卡，应用内也没有加载它的办法。价目卡以部署附带的目录素材形式到来，或通过自托管者或控制平面开启的可选价目卡扩展到来。没有价目卡时，什么都不会显示。

每个数字都是你提供的费率乘以 Lolly 统计的数量，例如 `4 plate × €35.00`，总额带有其来源：卡片的签发方和费率的日期。没有默认货币，也没有占位价格。文件对自己的描述始终属于转述：*"The file says: … Lolly has not verified this."*

当某个数字无法算出时，表格会被撤回而不是被填充：

- 价目卡未定价的行意味着**根本没有总额**，只有一个说明有多少行未定价的标题。
- 属于上限的数量会把 **"up to"** 带入其小计。
- 超过有效期的费率在你按 *Use these rates anyway* 之前**只显示数量**；此后到期日期会随数字一起显示。
- 通过**链接**打开时，金额保持隐藏，直到你在这台设备上要求显示。CLI 把 `--rate-card=<file.json>` 作为本地文件，绝不作为链接参数。

这张卡片会从每个导出阶段中剥离，所以它绝不会改变文件。它是算术，不是报价；只有你的印刷商才能报价。
:::

## 动态与声音

### 视频

动画工具导出 **MP4** 和 **WebM**。选择器只显示这个浏览器能制作的容器，请求了它无法制作的格式的分享 `?format=` 链接会回退到另一种，文件名也相应匹配。动画工具还提供 **Start after**，它会让画布静止片刻，使动画和字体在录制前稳定下来，以及 **Duration**，即成品片段的长度。**Motion blur**（Off、Draft quality、Standard 或 High，带 **Shutter angle**）会以渲染时间为代价模糊快速运动。在浏览器支持的地方，**Record live** 会改为通过屏幕共享实时录制屏幕上的预览。

![动画导出的时间设置：Start after、Duration、带 Shutter angle 的 Motion blur，以及 Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** 可选 Smaller file、Balanced 或 Best quality。**Advanced** 打开 **Codec**、**Frame rate**、**Rate mode** 和 **Hardware acceleration**。工具带有字幕时，**Captions** 选择 **Embedded track** 或视频旁的 **Sidecar .vtt + .srt**。链接以 `vq`、`codec`、`fps`、`seconds` 和 `wait` 携带质量、编解码器、帧率、时长和开始延迟（[URL 参数](/info/url-parameters.html)）。

视频导出会保留声音。工具可以在片段下铺一层**配乐**：一个循环播放或裁切到片段长度的音频素材，带有淡入淡出、音量，以及在画面自带声音下的闪避。录制类工具会把它们的实时音频带入文件。

保持点击翻页的 Design 演示稿仍然可以导出为视频。Present 菜单中的 **Export slides as video** 会在 MP4 上打开导出面板。每张幻灯片按自己的停留时间播放，没有时则按导出面板的 Duration，演示稿的幻灯片转场在它们之间以溶解方式播放。文档本身不会改变。

### 动画图像

**GIF** 到处都能播放，适合聊天和电子邮件；它比视频更大，颜色更少。**APNG** 和 **Animated WebP** 保留全彩和透明。**Lottie Ad** 还导出 **Animated SVG**：带有内嵌 CSS 关键帧的矢量帧，所以它可缩放到任何尺寸，并且无需编解码器就能在浏览器标签页或 `<img>` 中循环播放。它的文字被转曲，并使用较低的默认帧率，因为每一帧都比位图更重。所有这些都是无声的。

### 音频

有些工具单独导出声音。**Voice Recorder** 通过实时电平表录制麦克风录音，并保存为 **MP3**、**WAV**、**M4A (AAC)** 或 **Opus (WebM)**，在你的设备上编码。`wav`、`mp3`、`m4a` 和 `opus` 都是普通的格式 ID，所以音频导出像 PNG 一样可分享、可脚本化。

素材选择器接受范围很广的音频作为配乐，从 MP3 和 FLAC 到 MIDI 和 tracker 模块；[格式](/info/formats.html)列出了它们。[Rondocode 歌曲](/info/rondocode.html)会按其片段要求的任何长度播放。

## 颜色与 HDR

Lolly 读取每一种现代 CSS 颜色，以感知方式进行色彩运算，并在读者能打开的色彩空间中写出每个文件：屏幕用 sRGB，印刷用 CMYK，HDR 用 Rec.2100 PQ。[引擎中的颜色](/info/colour-engine.html)解释了方法。设置为 **Wide colour / HDR** 的 Design 文档遵循自己的规则，见[广色域与 HDR 编辑](/info/hdr-editing.html)。

### 颜色配置文件

导出会带有颜色配置文件标记，所以印刷厂、Photoshop 和浏览器等色彩管理应用读取到的颜色与你看到的一致。这是自动发生的；缩略图和预览为保持小巧而跳过该标记。

- **PNG 和 JPG** 嵌入 **sRGB** ICC 配置文件，即预览所用的色彩空间。像素是被标记的，而不是重新编码的。
- **Print PDF (CMYK)** 在其 *OutputIntent* 中声明其印刷条件，告诉印刷厂应如何读取其 CMYK 油墨。
- **Print TIFF (CMYK)** 写出未标记的 DeviceCMYK 像素，并在其 TIFF 元数据中记录印刷条件。TIFF 无法嵌入印刷配置文件，所以 **Embed** 行只记录该配置文件的名称。
- **TIFF (RGB)** 是未压缩的 sRGB 兄弟格式，用于存档或编辑器往返。它会把透明度拼合到白色上。两种 TIFF 都仅限桌面，因为浏览器无法预览 TIFF。
- **SVG**、**EMF**、**EPS** 和 **DXF** 是没有嵌入配置文件的矢量：SVG 的颜色是 sRGB，EMF 和 EPS 使用设备 RGB，**EPS (CMYK)** 写出 DeviceCMYK，DXF 使用 AutoCAD 颜色索引。SVG、EPS 和 DXF 会把文字转曲为路径。EMF 在 Office 和 Google Slides 中保持文字为实时可编辑的，只对格式无法表达的文字段才回退为轮廓；导出面板的 **Outline fonts** 选项会在所有地方强制转曲。SVG 还会重现 CSS 盒阴影，包括内阴影和外阴影。

::: details PDF/X-4 与你自己的印刷配置文件
Lolly 不附带任何 CMYK 配置文件。具名的印刷条件会写入输出意图，但不声称符合 PDF/X-4，因为 PDF/X-4 要求嵌入配置文件。

加载你自己的 CMYK 配置文件，并在 Colour profile 控制项中选择它的 **Embed** 行。它会作为文件的 *DestOutputProfile* 嵌入，只要文件的其余部分允许，PDF 就会声称符合 PDF/X-4。它声明的印刷条件是从该配置文件读出的：配置文件能证明时是已注册的名称，否则是以配置文件自己的名称标注的 `Custom`。

有三样东西会在保留输出意图的同时撤回该声明：CMYK 处理无法转换的 RGB 作品、`prov` 校样边距署名文字（以未嵌入的标准字体绘制）和 **Strong** 密码，因为 PDF/X-4 禁止加密。每个 PDF 还带有 PDF/X-4 元数据：页面框、XMP、文档 ID 以及带配置文件的 sRGB 输出意图。
:::

### HDR（明亮色彩）

这是导出面板的 **HDR** 卡片，它为 HDR 屏幕提亮普通作品。在编辑中保留 HDR 原件是另一项功能：[广色域与 HDR 编辑](/info/hdr-editing.html)。

普通导出是 sRGB：饱和的品牌色和屏幕的普通白色一样亮。HDR 显示器在此之上还有余量。**HDR** 卡片会把你的品牌色和白色文字朝峰值亮度提升，同时暗部保持黑暗，为光晕提供对比。

![导出面板中开启的 HDR 卡片,其下展开了 White / Reach / Dark lift / Focus 四个旋钮](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **格式。** PNG、JPG、AVIF 和 TIFF。WebP 是 8 位的，没有可用的 HDR 解码路径，矢量和 PDF 没有 HDR 模型。
- **默认关闭**，因为它会改变像素。勾选该卡片，或在分享链接中传入 `hdr=1`。
- **调节项。** **White**（峰值亮度上限，400 到 2000 尼特）、**Reach**（光晕向下扩散到多少色调）、**Dark lift**（暗部提亮多少；`0` 使它们保持黑暗）和 **Focus**（提亮保留多少色彩丰富度）。它们作为一个值传递：`hdr=1600-60-0-50` 表示 White 1600、Reach 60、Dark lift 0 和 Focus 50。
- **写出的内容。** PNG 得到带 `cICP` 块的 16 位 Rec.2100 PQ。JPG 是 ISO 21496-1 增益图 JPEG：一张普通的 SDR 图片加上附带的增益图。AVIF 得到重写的 `colr` 盒。TIFF 得到 PQ 像素和一个带 `cicp` 标签的生成的 ICC v4 配置文件，并拼合到黑色上，因为白色在 PQ 中是 10,000 尼特的编码，会在每条边缘周围产生光晕。提亮遵循感知（OKLab）明度并保持色相，所以品牌绿会变亮，而不会变成薄荷色。
- **光晕在哪里可见。** HDR 显示器上的色彩管理查看器：Apple 设备上的预览、快速查看和 Safari，或 HDR 显示器上的 Chrome。SDR 屏幕显示的是普通图像。
- **发布之前。** 许多平台会对上传内容重新编码并剥离 HDR 信号，这可能让图像变暗或发灰。请在你能控制目的地的地方使用 HDR，例如你自己的网站、视频墙或明亮屏幕上的演示稿。
- **在终端中。** 在 [CLI](/info/cli.html) 上，`--hdr=1` 加 `--export=png` 或 `--export=jpg` 会写出同样的 PNG 和增益图 JPEG，使用同样的引擎编码器，路径中没有浏览器。AVIF 和 TIFF 目前仍只能通过网页导出。

## 随文件传递的内容

成品文件除了画面之外还可以携带若干记录。有些随像素一起，在文件被重新保存或被剥离时消失；有两种标记存在于像素本身之中。

::: figure exporting-what-travels
每条记录存放在哪里、默认是否开启，以及哪个链接参数控制它。
:::

导出面板把 **Licence**、**Source credits**、*Password protect*、**C2PA Credentials**、**Lolly Imprint** 和 **Durable credential** 折叠为一个 **Content protection** 组，只显示所选格式可用的卡片。当链接或文档已经声明了许可协议，或某个来源需要你做决定时，它会自动展开。**Design system** 卡片留在这个组之外，在每次导出时都可见。

![在 PNG 导出上展开的内容保护分组,只显示适用于该格式的卡片](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 出处与水印

在格式有相应字段的地方，导出会携带**出处元数据**：软件、来源、工具名称和你的个人资料署名行，写入 PNG iTXt、JPEG EXIF、PDF 信息、SVG `<metadata>` 或 GIF 注释。它只记录作者身份，不上传任何内容。**Experimental** 工具还会盖上可见的水印，由宿主应用，所以编辑工具无法移除这个标记。

**Lolly Imprint** 是一种不可见的像素水印，**默认开启**。凭据和元数据随像素一起传递，在重新保存、截图或元数据剥离时丢失。Imprint 存在于像素之中，能经受重新压缩，所以副本仍可被识别为 Lolly 制作。它是一种提示，而不是加密保证，也不携带个人数据。它存在于 JPEG XL、PNG、JPG、WebP、AVIF、TIFF 和 BMP 中，以及 Lolly 渲染进 PDF 或 PPTX 的栅格图中，但绝不存在于你嵌入的图片中。取消勾选 **Lolly Imprint** 或传入 `imprint=0`，即可不加入 Imprint。AVIF 经过重新编码后的留存情况尚未校准。[Verify](/verify) 在你的设备上检测它；参见 [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)。

**Durable credential** 使用设备端神经网络模型，以 TrustMark 格式把 Lolly 的 ID 写入像素，所以 “made with Lolly” 的链接能经受元数据剥离和重新编码，并能被支持 TrustMark 的工具读取。它**默认关闭**，因为每次导出都需要一次神经网络处理，并且需要一次性下载模型。它涵盖 PNG、JPG、WebP、AVIF 和 TIFF；在面板中勾选它，或传入 `durable=1`。桌面和移动应用隐藏该卡片，因为它们离线时没有可获取模型的来源。

**Licence。** 选择他人可以如何使用你的作品：默认是 *None (all rights reserved)*，也可选 CC0 1.0、Public Domain Mark 1.0，或 Creative Commons 4.0 许可协议（BY、BY-SA、BY-NC、BY-NC-SA、BY-ND、BY-NC-ND）。许可协议名称和指向其条款页面的链接会写入文件的许可元数据（格式支持的 EXIF、XMP 和 RIFF）及其 Content Credential。该选择随文档保存，并在链接中以 `licence=` 传递。Lolly 写入你选择的许可协议；它不检查或强制执行条款。带有自己许可字段的工具，例如 Claim，则保留该字段。

### 设计系统记录

导出会记录制作文件的设计系统：它的名称、绘制所用的已发布版本（当它不是工作版本时），以及绘制所用的[配色方案](/info/colourways.html)。设计系统声明的任何其他主题选择，例如密度，也以同样方式记录。浅色或深色的选择不予记录，因为画面本身已经表明用的是哪一种。

**在写入任何内容之前，你会看到这条记录。** 默认勾选的 **Design system** 卡片会显示文件将携带的确切文字，例如 *Records: Acme · Colourway: Beach*，以及描述的最终措辞。设计系统的名称是其所有者输入的任何内容，所以卡片按原样显示。取消勾选卡片即可在该次导出中不加入该记录。Design 的文档面板在 *Embedded in exports* 下列出同样的文字。

**描述会在工具旁给出配色方案。** 勾选该卡片后，*"Made with https://lolly.tools : Chart"* 会变成 *"Made with https://lolly.tools : Chart (Beach colourway)"*。设计系统自己的名称保留在记录中，而不在描述中。没有工具名称的描述，或工具根据自己的输入写出的描述，保持原样。通过 `tokenAxes` 忽略配色方案的工具不记录配色方案，PDF 校样署名（`prov` 印刷标记）也遵循同样的规则。

**指导代理的品牌技能。** 当代理制作了作品并指明它读取并遵循的[品牌技能](/info/brand-skills.html)时，记录还会列出每项技能及其修订版本，例如 *Guided by: acme-brand 1.0*。这些字的意思是该技能指导了这项工作。它们不是检查：Lolly 不会对照技能测试作品。只有代理自己的声明才会加入该列表，目前这意味着 [MCP 服务器](/info/mcp.html)的 `lolly_render` 的 `brandSkills` 参数，所以在应用中或通过分享链接制作的作品不带这个列表。Content Credential 把该列表作为 `brandSkills` 保存，这是一个 JSON 值，包含每项技能的 ID、名称、修订版本和 SHA-256 哈希。XMP 数据包和 SVG 元数据以 `lolly:BrandSkills` 保存同一个值，由该记录写出的 PDF 每项技能增加一个关键词，描述保持原样。内部技能按其 ID、名称、修订版本和哈希记录，绝不记录其文本。同样的开关会连同记录的其余部分一起省略该列表：**Design system** 卡片、`_madewith=0`、`--no-madewith` 和 `madeWith: false`。当 MCP 服务器在浏览器中绘制文件时（PDF、JPEG 以及其无浏览器路径无法写出的其他格式），文件自己的元数据不含该列表，只有 Content Credential 可以保存。传入 `c2pa` 可保留记录；没有凭据时，渲染会警告品牌技能没有被记录。

**读回记录。** [Verify](/verify) 在文件的凭据详情中把该记录列为 **Design system**，把任何品牌技能列为 **Guided by**。*Recreate with these settings* 会在记录的版本和配色方案下重新打开工具。当这台设备持有具有相同 ID 和名称的设计系统时，链接会以记录的设计系统打开；否则会以你当前的设计系统打开。

::: details 什么写在哪里，以及哪些运行会省略记录
| 位置 | 写入的内容 |
|---|---|
| Content Credential | `tools.lolly.export` 断言中的 `designSystem`（ID）、`designSystemLabel`、`designVersion` 和 `themes`，每个都是纯文本值；`themes` 是选择的 JSON 列表 |
| PNG、JPEG、WebP 和 JXL | 与这四个相同的值，作为文件 XMP 数据包的 `lolly:` 属性，位于命名空间 `https://lolly.tools/ns/export/1.0/` |
| SVG | `<metadata>` 块内的相同 `lolly:` 属性 |
| PDF | 关键词，例如 *Design system: Acme* 和 *Colourway: Beach* |
| 每种带有描述字段的格式 | 描述，在工具旁带有配色方案 |

只有存在可记录的内容并且格式能容纳该记录时，才会出现这张卡片。CSV、JSON、日历文件和其他文本或数据格式不含元数据，EPS、EMF、DXF 和 BMP 没有用于该记录的字段。HTML、Markdown 和 CSS 只在其 Content Credential 中保存该记录，所以对它们而言，卡片不显示描述行，并且在 **C2PA Credentials** 关闭时隐藏。设计系统没有提供的字段不会写入文件。

分享链接用 `_madewith=0` 关闭该记录（[URL 参数](/info/url-parameters.html)）；命令行使用 `--no-madewith`，[MCP 服务器](/info/mcp.html)的 `lolly_render` 使用 `madeWith: false`，终端应用的导出面板有一个 **Design system** 行。命令行会在标准错误上打印成品文件所携带的文字，既针对工具渲染，也针对 `lolly run` 从已保存的 Design 会话导出的每个文件，MCP 渲染会把它们打印在文件旁，两者都是从文件读回的。命令行在没有浏览器的情况下绘制的 PNG 不携带文件元数据，所以它的记录只存在于凭据中。设备端实用工具完全不添加元数据。

没有 **Design system** 卡片的运行会省略该记录：Batch 运行、从 Projects 导出的文件夹和 3D 合集导出，以及在终端应用中的 CSV 批处理、Projects 文件夹或选区导出和渲染全部的视图。从工具中导出一个文件即可记录设计系统。
:::

### Content Credentials (C2PA)

导出可以携带 **Content Credentials**：一份签名的 [C2PA](https://c2pa.org) 清单，记录了是什么制作了文件、何时何地，并绑定到文件字节的哈希，因此任何后续编辑都可被检测。该规范由 C2PA 发布，Lolly 写出任何 C2PA 阅读器都能检查的标准清单。

![已勾选的 C2PA Credentials 卡片，复选框旁边是凭据有效期](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **默认开启。** **C2PA Credentials** 卡片对几乎每个工具都是预先选中的。可以在一次导出中取消勾选，或在链接中传入 `c2pa=off`。工具可以在其清单中选择退出。
- **格式。** PDF（RGB 和 Print）、PNG 和 APNG、JPG、GIF、SVG、TIFF（RGB 和 Print）、WebP（静态和动画）、AVIF、MP4、WebM，音频容器 MP3、WAV、M4A、OGG/Opus 和 FLAC，以及 HTML、Markdown 和 CSS。ZIP 会给每个受支持的成员盖章，Animated SVG 就是这样得到凭据的。MP4、AVIF 和 M4A 使用标准 BMFF 绑定，MP3 使用其 ID3v2 映射，所以 `c2patool` 和其他阅读器可以验证它们。WebM 和 OGG/Opus 暂时没有标准映射，所以 Lolly 将清单作为 Matroska 附件和 OpusTags 字段携带，由 Lolly 自己的验证器检查。ICO、EPS、EMF、DXF、BMP、PPTX、Office 格式和其他文本及数据格式没有 C2PA 容器。
- **记录什么。** 制作文件的工具和应用、签名时间、导出它的外壳、在 **Design system** 卡片勾选期间的[设计系统和配色方案](#the-design-system-record)，以及有效输入的指纹。输入文字、绑定到个人资料的字段、未启用的控制项、浏览器版本和操作系统详细信息都不包含在内。只有当 Settings → Preferences → Your details 下的 **Use my details to create** 开启时，你的姓名和电子邮件才会作为作者出现。导出所放置的来源会作为素材来源传递：[署名作品](#source-credits)，例如 emoji，以及视频或音频导出中的 [Rondocode 歌曲](/info/rondocode.html#songs-in-the-credential)。
- **接收者看到什么。** Adobe 应用、`c2patool` 和 contentcredentials.org/verify 等 C2PA 工具会读取清单并显示声明。Lolly 使用在你设备上生成的密钥签名，而不是来自信任列表的证书，所以查看器会报告凭据为 *unverified*：结构和篡改证据是真实的，签名者则没有被担保。要改变这一点，请在 Settings → Preferences → Content Credentials 下注册**已验证身份**；参见 [Content Credentials 身份](/info/content-credentials-identity.html)。
- **检查文件。** 把任何文件拖到 [Verify](/verify)，或运行 `lolly validate <file>`，即可得到设备端报告，开头说明文件是否由 Lolly 制作，以及此后是否有变化。Verify 也会查看凭据之外的内容；参见 [Verify 检查什么](/info/what-verify-checks.html)。
- **隐私。** 签名密钥是为该次导出生成的，绝不离开你的设备，声明只包含出处元数据已经携带的内容。转换你自己文件的隐私实用工具不添加凭据，*Strip Hidden Data* 会像移除其他元数据一样移除 C2PA 清单。Rondocode 实用工具制作新音频，所以它会为所写内容签名（[Rondocode 歌曲](/info/rondocode.html#files-from-the-rondocode-utility)）。
- **相互作用。** 设有密码的 PDF 无法携带 Content Credentials，两个等级皆然。凭据最后添加，覆盖完成的字节，位于 DPI、EXIF、颜色配置文件、PDF/X 元数据和印刷标记之后。

### 来源署名

放置他人作品的导出会在凭据中记录该来源。从所选 emoji 集绘制的 emoji 是最常见的情形：作品、其创作者、许可协议、确切字节的来源以及改动了什么，都随文件一起传递。模板为 SVG 的工具中的文字保留系统自己的 emoji，所以那里不署名任何来源。**Source credits** 行会在你下载前说明来源对交付有什么要求，下载之后，它会先读回交付的字节，再说署名已在文件中。需要你选择的许可协议，例如你即将分享的重新着色的 CC BY-SA 字形，会得到一张带选项的卡片；下载绝不会被阻止。[创作版权与署名](/info/creative-rights.html)介绍了措辞、已审阅的许可协议，以及什么仍归你所有。

## 密码保护

两种锁，都在你的设备上生成。导出面板的 *Password protect* 卡片同时控制这两种。

![PDF 导出中展开的密码保护卡片,显示密码字段和两个锁定级别](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDF 打开密码**在你输入密码后有两个等级：

- **Weak**：40 位 RC4，只是一种威慑而非保护。它的密码可以明文随分享链接传递。仅限 RGB `pdf`。
- **Strong**：AES-256（PDF 2.0）。在导出时输入，绝不放入链接。它也适用于 Print PDF 以及批量 ZIP 内的每个 PDF。使用 Strong 锁定的 Print PDF 保留其 CMYK、标记和输出意图，但放弃 PDF/X-4 声明。

**带锁的 ZIP** 涵盖 ZIP 导出、从 Projects 或批处理下载的文件夹，使用一个密码，分两个等级：**Weak**（ZipCrypto，只是威慑；可以随 `?password=` 链接传递）或 **Strong**（AES-256，在导出时输入，绝不放入链接）。密码保护每个成员，其中的任何 PDF 还会各自用 AES-256 单独加锁，所以 ZIP 解压之后它仍然是锁定的。提示在下载开始时出现；留空密码表示不加锁。

**密码保护的分享链接**会在打开之前向接收者索要密码。整个链接状态用由密码派生的密钥（PBKDF2）以 AES-256 加密，所以传递的只有密文，解密发生在接收者的浏览器中。提供链接的服务器永远看不到密码或设计。在 **Share** 对话框中开启它。加密的链接只能在 Lolly 中打开，绝不能作为嵌入图片。参见 [URL 模式](/info/url-mode.html)。

## 在手机上

导出控制项位于浮动的 **Export** 按钮之后，它会打开 **Export** 面板：同样的格式、尺寸、复制、下载和分享，针对触摸做了尺寸调整。

## 用于链接和 CLI 的格式 ID

这些是 URL 的 `format=` 参数和 CLI 的 `--export=` 标志的取值（参见 [URL 参数](/info/url-parameters.html)和 [CLI](/info/cli.html)）。工具的菜单只显示该工具能制作的格式，所以总是比这份列表短。

| 类型 | ID |
|---|---|
| 栅格 | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff`（RGB TIFF）· `cmyk-tiff`（Print TIFF）· `bmp` · `ico` |
| 矢量 | `svg` · `svgz`（gzip 压缩的 SVG）· `emf` · `wmf` · `eps` · `eps-cmyk`（EPS CMYK）· `dxf`（切割文件） |
| 页面与文档 | `pdf` · `pdf-cmyk`（Print PDF）· `pptx`（PowerPoint）· `docx`（Word）· `odt`（OpenDocument Text）· `idml`（InDesign）· `penpot`（Penpot 设计文件）· `scorm`（课程包，一个 ZIP） |
| 动态 | `gif` · `apng`（Animated PNG）· `webp-anim`（Animated WebP）· `svg-anim`（Animated SVG）· `webm` · `mp4` · `lottie`（dotLottie）· `premiere-xml`（Premiere XML + media） |
| 音频 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| 文本与数据 | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl`（GIMP palette） |
| 捆绑包与软件包 | `zip` · `rpm` 和 `tar.gz`（封入 Linux 软件包的渲染结果） |

有几个 ID 来自工具自己的导出代码：`ase`（Adobe Swatch Exchange，来自 Palette Lab）以及 `exr` 和 `hdr`（高动态范围栅格图，来自 Darkroom）。**Convert Font** 会根据你提供的字体文件写出 `ttf`、`otf` 和 `woff`，所以单独的链接没有什么可供它渲染。
