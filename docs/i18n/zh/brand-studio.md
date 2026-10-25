# Design System Setup

你的徽标、颜色和字体应该放在同一个地方，让每个工具、页面和导出都用它们来绘制。这个地方就是位于 `#/start` 的 **Design System Setup**，它的标语说明了用途：*Make it yours*。

从你手头有的东西开始。放入一个徽标，Lolly 就会读取它的颜色。选择一种字体，或放入你公司授权的字体文件。每次更改都会立即显示在整个应用中。你的徽标、字体和令牌留在这台设备上。选择 Google Font 是唯一会向外联系的一步：Lolly 会先询问，然后只获取一次该字体家族。

外观满意之后，给设计系统起个名字并按 **Export**。你会得到一个 `.lolly` 文件，可以保留、在另一台设备上打开或交给同事。[设置](/info/dashboard.html#design-system)以只读方式显示当前系统，其封面会链接回这里进行编辑。

## 五分钟让它成为你的

::: timeline
- <!--i:upload--> **放入你的徽标**，拖到 **Logos** 中的放置区。Lolly 会读取它的形状和颜色。
- <!--i:palette--> **使用这些颜色。** 徽标的主色成为你的主色，徽标中的深色中性色成为你的文字颜色。
- <!--i:font--> **选择字体**，在 **Type** 中：一个 Google Font，或你拥有的字体文件。
- <!--i:pentool--> **给系统命名。** 你的第一次编辑会创建你自己的设计系统，Lolly 会询问一次它的名称。
- <!--i:download--> **Export** 把整个系统写成一个 `LollyBrand-….lolly` 文件。
:::

页头显示你正在 **Editing** 哪个设计系统，它的名称是一个可以随时更改的字段。当你的第一次编辑询问 **What is this design system called?** 时，如果徽标上写出了文字，这些文字会自动填入。**Save name** 保留名称；**Not now** 保留占位名称，直到你在页头输入名称。名称会在 Settings 中以及切换时标记该系统，也会成为 **Export** 所写文件的名称。

## 房间

工作室是侧边栏中的一组房间，没有固定顺序：没有编号，也没有什么要等其他东西。在手机上，侧栏变成页头下方的一排芯片。

![工作室的房间栏：Overview、Colours、Type、Logos、Tokens、Files 和 Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| 房间 | 你在那里做什么 | 链接键 |
|---|---|---|
| **Overview** | 查看系统包含什么，每个房间都有入口 | `overview` |
| **Colours** | 添加颜色、赋予角色、构建色阶和调色板 | `color` |
| **Type** | 选择应用、工具和每个导出所读取的四种字体 | `type` |
| **Logos** | 以每种方向和处理方式放置你的标志 | `logos` |
| **Tokens** | 圆角、间距、阴影以及所有其他命名值 | `tokens` |
| **Files** | 你的品牌保存的图片、音频和动态文件 | `catalogue` |
| **Usage & rules** | 你的品牌应用的规则，在真实示例上检查 | `usage` |

用 `#/start?area=<key>` 链接到某个房间。Files 房间保留键 `catalogue`，因为房间键是永久性约定，`?tab=` 仍作为旧别名可用。未知的键会打开 Overview。

**侧栏底部**放的是针对整个系统而非某个房间的操作。**Add from…** 导入一个品牌（[导入品牌](#bring-a-brand-in)），**Tray** 存放扫描发现但你尚未添加的内容。**Export**、**Tokens (.json)**、**Fonts for Linux (.rpm)**、**Versions** 和 **Restore brand settings** 用于保存和迁移系统（[保存并迁移你的设计系统](#keep-and-move-your-design-system)）。每一项只有在有对象可作用时才会出现。

## 概览

在尚未选择任何内容时，Overview 提供四种起步方式。**Start from a reference** 打开徽标、截图、网页或设计文件的来源选择器，**Pick a colour**、**Choose a face** 和 **Add a logo** 直接打开对应的控制项。打开它们不会写入任何内容，并且 **Explore the tools** 从一开始就在那里。

一旦有任何东西属于你自己，Overview 就会显示你拥有什么，你自己的计数排在前面。Colours 给出颜色数量，在显示继承颜色的地方带有淡化的 `· N starter`；它的色带先放你的颜色，然后是一条细线，再是淡化的起步颜色。Type 按角色读出（*Inter for headings*，下一行是 *Starter for the rest*）。Logos 说明已填充多少个槽位（或 **Not set**），Tokens 显示圆角半径，库为空时 Files 显示 **Nothing yet**。每个区块都会打开对应的房间。

### Starter 与你的

**Starter** 指的是应用自带而不是你选择的任何东西。全新安装不带任何颜色，只有一个从墨色到纸色的中性色阶，这样在任何人做决定之前，表面、文字和细线就能渲染。同一个词在每个房间里都标记继承的内容。

::: cols
## Starter

- 应用自带：从墨色到纸色的中性色、起步字体、默认圆角半径。
- 淡化，带有 **Starter** 标签，没有色调。
- 不计入你的颜色。中性色位于 **Tokens** 中，名为 **Neutrals · starter · 9**，**Open** 会在 Colours 中以一个折叠的组显示它们（`#/start?area=color&group=neutral`）。
- 站在起步颜色上的角色显示 *"Starter Paper stands in"*，其选择器上有 **Choose…**。

## 你的

- 由你选择或安装。
- 全强度显示，你安装了字体的地方有带色调的卡片。
- 计入 Overview 和 Tokens。
- 跟随另一个角色的角色显示 **↳ follows Primary**，而不是重复主色的名称。
:::

继承的内容绝不会用虚线边框绘制，因为在这里虚线边框表示放置目标。

## 标志

把你装标志的文件夹清空到顶部的放置区：**"Drop marks here, or choose several at once"** 接受任意多个文件。每个文件都会被读取其形状和墨色，然后作为一个芯片在 **Waiting for a slot** 下等待，芯片说明它看起来像什么，例如 *"Looks like the Horizontal primary"*，并附上所用的测量值和一个 **Place** 按钮（槽位已填充时为 **Replace**）。不确定时，芯片会说明并提供 **Change slot**，列出全部八个槽位。在你按下任何按钮之前，不会放置任何内容。

边缘空白过多的标志会先收到裁切建议；接受它，或按 Escape，原件将原封不动放入。当某个标志可以填充空着的相邻槽位时，房间会以标记为 *Generated* 的芯片提供派生的 **mono** 或 **reverse** 版本。

每个标志最终都放入由八个可选槽位组成的网格，每个槽位对应一种**方向**和**处理方式**：

- **方向：**Horizontal（字标和符号排成一行）和 Vertical（堆叠，适合方形和高的空间）。
- **处理方式：**Primary、Primary reverse（用于深色背景）、Mono（单色）和 Mono reverse。

还没有标志的组会折叠成一行；展开可看到它的槽位。点击槽位可添加 PNG、SVG、JPEG 或 WebP，点击已填充的槽位可替换标志。一切都留在这台设备上。

![展开了 Horizontal 和 Vertical 的徽标槽位：每种处理方式都是自己的槽位，每个槽位都是可选的](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** 是你的品牌用自己的名称称呼的标志，例如图标、徽章或网站图标。
- **更多标识。** 子品牌、产品或活动可以有自己的完整一套：**+ Add another logo** 并给这一套命名。你的主套是 “Your logo”。[品牌架构](/info/brand-architectures.html)说明了什么时候徽标标识是合适的构件。
- **Lolly 读取徽标的颜色。** 放置区下方的一张卡片，以及 Colours 顶部的同一张卡片，会列出徽标的颜色并询问 **Which is the main colour?**，已选中最强的颜色（绝不是导出时所用的白色底）。**Use these colours** 会把它们加入你的调色板，使主色成为你的主色，并且当徽标有一个能在纸色上阅读的深色中性色时，把它作为文字颜色。**Not now** 把它们留在 Tray 中。在全新安装上，最可能的答案会立即应用，卡片提供 **Undo** 或另选主色。SVG 能给出精确的颜色；PNG、JPEG 或 WebP 给出覆盖标志相当大比例的颜色。

## 颜色

房间会随设计系统而成长：第一次访问只需做一个决定，其余的随调色板一起到来。

### 第一个颜色

没有自己颜色的系统打开时只有一个大色块和一个输入框，并有一行说明：角色、色阶和印刷设置会随系统的成长而出现。

- **色块就是选择器。** 按 **Pick a colour**，工作室的 OKLCH 卡片就会打开，以输入框中的内容为初始值：名称、色轮、四个转盘、透明度和 **Stored as**，底部有 **Cancel** 和 **Add colour**。在你按 **Add colour** 之前，不会有任何内容进入系统。
- **输入框接受任何表示法**：`#e0452b`、`rgb(224 69 43)`、`oklch(58% .19 32)` 或颜色名称。粘贴一个列表，它会变成一排芯片，可逐个添加或用 **Add all** 全部添加。
- **另外两种方式。** **Pick a colour from the screen** 在浏览器支持的地方使用吸管，**Take colours from an image** 读取这台设备上的截图或照片。
- **Add 永远不会被禁用。** 输入框为空时它会打开选择器；无法读取的文字会在输入框下得到一行说明。

你的第一个颜色成为**主色**，一个芯片会确认这一点，例如 *"Primary is now Vivid Violet"*，并带有 **Fine-tune** 来调整颜色。


### 随调色板成长

在宽屏上，你的颜色位于 **In context** 预览旁边，在较小的屏幕上则位于其上方。预览以你的调色板显示海报、图表或界面卡片。起步颜色留在它们自己的折叠组中。

![Lolly Demo 上的 Colours 房间：折叠组中的调色板，每个颜色带有名称和十六进制值，底部是下载按钮](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![添加一个颜色后的 Colours 房间，带有它的调色板和一个实时的构图预览](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### 角色：工具读取什么

**角色**说明了哪种颜色在每个工具和导出中承担哪个部分。它们是可选的（三个没有角色的零散颜色也是一个完全合格的系统），任何颜色都可以担任一个角色，对比度读数是针对表面测量的，优先使用 APCA。每个角色行显示的是全强度的自有颜色、顶替的起步颜色，或 **↳ follows Primary**。

当调色板有了色阶后，色带会显示工具可以读取的全部七个角色：Primary、Secondary、Surface、Text、Muted、Edge 和 On primary。On primary 由主色派生，显示为 **Derived**，没有选择器。

应用自己的强调色默认跟随设计系统。这就是 **Settings → Appearance** 中的 **Interface follows the design system** 设置；关闭该设置会让应用的外壳保持中性，而工具、画布和导出无论如何都跟随设计系统。

**配色方案。** 设计系统可以包含多个主色，每件作品各自选择。Lolly 保留每种配色方案，但这个房间目前还无法创作它：配色方案写在令牌文件中。在有配色方案的系统上，每种配色方案都需要自己的主色和次色，当配色方案给背景着色时还需要自己的表面色，所以这些角色在色板编辑器中保持设定。[实际使用 Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work)展示了真实作品上的配色方案，[为设计系统添加配色方案](/info/colourways.html#add-colourways-to-a-design-system)介绍了格式。

### 寻找更多颜色

有三个工具以你的主色为基础。前两个只提供建议，第三个会在你审阅更改后替换调色板。

::: cols
## Explore shades & harmonies

选择一个 **Starting colour**、一个 **Scheme**（Mono、Complement、Analogous 或 Triad）以及 **Shades** 的数量（3 到 20，默认 5）。**Fine-tune** 设置界面强度、对比度和品牌上的文字。点击一个色阶即可添加，或用 **Add 5 shades** 添加一组。你的颜色和角色保持不变。

## Find matching colours

选择一个 **Harmony**：Complementary、Adjacent、Triad、Tetrad 或 Analogous（**Accents** 从 2 到 5，**Angle** 从 10° 到 45°）。每个候选项都有生成的名称和 **+ Add**，每次按一下添加一种颜色。

## Rebuild the whole palette

在审阅将更改和保留的内容之后，从一个起始颜色替换调色板。先创建一个检查点，之后提供 **Undo**。
:::

这三者使用的都是与引擎相同的感知色彩数学（OKLCH）。在 **Explore shades & harmonies** 中，**Primary**、**Neutral** 和 **Secondary** 行显示建议的色阶，**Theme preview** 显示浅色和深色示例及其对比度读数。

![三组建议的色阶，各自带有单独的添加控件，以及一个独立的 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![生成的强调色，每个都带有色块、自动生成的名称、十六进制值和一个 Add 按钮](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 提交生成的调色板

打开 **Rebuild the whole palette…** 并按 **Preview full rebuild**。审阅会统计有多少个角色保持你指定的样子、保留了多少你自己的颜色，以及有多少条色阶曲线、印刷锁定、隐藏的色阶和渐变色标被重新锚定或保留。**Apply rebuilt palette** 提交；**Cancel** 不做任何更改。之后卡片会提供焦点在其上的 **Undo**，替换之前创建的检查点可以恢复整个系统。

带有配色方案的系统在重建后会保留每种配色方案。标准配色方案跟随新的起始颜色，其他每种配色方案保留自己的颜色、名称、顺序和设置。审阅会列出哪种配色方案跟随、哪些保留其颜色。Lolly 不会重建以它无法编辑的方式编码配色方案的系统；卡片会说明原因，并且不会更改任何内容。

### 专家部分

预览和角色下方有四个折叠的部分。每一个都可以通过 `#/start?area=color&focus=<name>` 直接打开：

- **Explore shades & harmonies**（`focus=generate`），如上所述。
- **Shade curves**（`focus=curves`）逐点重塑一条色阶，分别有明度、色度和色相曲线（L / C / H），拖动时色阶会重新绘制。
- **Contrast**（`focus=contrast`）：**Contrast-lock** 针对你选择的背景，将色阶重新调整以达到 APCA 目标，**Rotate hue** 则让整条色阶绕色轮旋转。
- **Print**（`focus=print`）设定主色在印刷机上变成什么：它的自动值、固定的 CMYK 配方或具名的专色油墨。

### 调色板和每个色板

调色板把你的颜色列在折叠组中，每组都有自己的 **+ Add**。可以随意创建和重命名组。角色绝不会产生第二个方块：角色所指向的方块会改戴一个小标记（**P**、**S**、**Su**、**T**）。方块下方的 **Colour chart** 把同样的颜色显示在 OKLCH 的 **Wheel** 上（拖动圆点可重新着色，点击空白处可添加色板）以及 **Gamut** 图上，后者显示可显示范围在哪里结束。`#/start?area=color&focus=chart` 会直接打开该图表。

![调色板面板，每组都可折叠，下载胶囊按钮固定在其底部边缘](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 色轮 - 角度代表色相，距中心的距离代表彩度，灰色沿侧边的明度轨道排列](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

点击色板可打开其编辑器：

- **Rename** 色板。
- 在 OKLCH 滑块上，或在 **Hex**、**HSL**、**RGB** 或 **CMYK** 中**设置颜色**。数值字段在当前色彩空间中读取和写入。这里的 CMYK 是通过转换来设置屏幕颜色的；要固定精确的油墨，请使用 **Print substitutes**。
- **Stored as** 选择色板的保存方式：**LCH**（默认，感知均匀且广色域）、Hex、RGB 或 HSL。
- **Use as** 直接给色板一个角色。再次按下高亮的角色可清除该角色。
- **Print substitutes**（折叠）：将 **CMYK** 从 **Auto** 锁定为精确的油墨值，或设置带有 **Name**（例如 `PANTONE 186 C`）、可选的 **Book** 和 **Finish** 的 **Spot colour**，Finish 可以是烫金、压凸、压凹、局部上光、柔触或模切、压痕或穿孔。导出 CMYK PDF 或 TIFF 时，印刷机会使用这些锁定值；参见[颜色配置文件](/info/exporting.html#colour-profiles)。
- **In other spaces**（折叠）：每个色彩空间一个值，由推导得出或由你设定，设定的值在导出时优先。

**删除色板**是安全的。派生的色阶和主题角色会被隐藏，所以读取它们的任何东西都不会损坏，而你添加的颜色则会被移除。

::: details 处理大量色板
每个色板都有一个拖动手柄。拖动可在组内重新排序，或让手柄获得焦点，按空格键，用方向键移动，再按空格键放下；Escape 取消。要在组之间移动颜色，请使用编辑器的 **Group** 控制项，或选择多个并使用 **Move to**。

选择不需要模式。栏随第一个选中的方块出现，随最后一个离开。

- **在空白处拖动**画出矩形；它碰到的每个方块都会加入选区，可跨组。折叠的部分不会添加任何内容。
- **Shift 点击**按阅读顺序选取一个范围，**Cmd/Ctrl 点击**切换单个方块，普通点击打开编辑器。
- 每个组标题都有 **Select all**，方块获得焦点时按 **Cmd-A** 会选中你拥有的每个颜色，绝不包含起步颜色。
- 网格只有一个 Tab 停靠点：方向键移动，Shift 加方向键扩展，空格键切换，Delete 移除，Escape 清除。要微调某个通道，请先按 `l`、`c` 或 `h`。
- 在触摸屏上，按住方块开始选择，然后轻点添加。

栏上显示 **{n} selected**，然后是 **Move to**、**Give a role**（每个颜色依次取下一个角色）、**Download**（以六种调色板格式中的任意一种下载选区）、**Duplicate**（每个的副本，放在原件之后）、**Copy values** 和 **Delete**。一个副本会直接在编辑器中打开；多个则保持选中。一次 Cmd/Ctrl-Z 即可撤销整个批量操作。
:::

### 渐变

可选的 **Gradients** 面板根据调色板构建渐变令牌。每个渐变有预览、2 到 8 个命名色标和一个角度。色标指向一个色板，所以给色板重新着色，渐变也会随之变化。渐变在 OKLCH 中混合。

调色板有了色阶之后，调色板下载（设计令牌、CSS、SCSS、GIMP 和 Adobe Swatch Exchange）会出现在调色板底部的一个按钮组中。[随处携带你的调色板和字体](/info/using.html#take-your-palette-and-fonts-anywhere)介绍了每种格式。

## 字体

在没有自己的字体时，这个房间只有一张卡片：**Primary**，以阅读尺寸用目前所用的字体显示，带有 **Starter** 标签、一个 **Choose a face** 按钮和一行 *"Nothing installs until you choose one."* Headings、code 和 italic 在你选择它们之前都跟随 primary；**Choose them separately** 会显示它们的卡片。

![尚未选择字体的 Type 房间 - 一张阅读大小的卡片，带有一个 Starter 标签，以及一个已填色的 Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

选择一种字体后，房间会展开为四张角色卡片、Fonts 列表和一个实时样张：

- **Primary**：正文、按钮和每个工具。
- **Headings**：用于 `h1` 和 `h2` 的展示字体。
- **Code**：用于代码和数据的等宽字体。
- **Italic**：用于强调、引文和旁白的真正斜体。

只有你安装了该字体的卡片才会带色调，其按钮在你自己的字体上显示 **Change**，其他地方都显示 **Choose a face**。卡片上没有任何内容会提交任何更改：按钮会为该角色打开对比台。

![四张角色卡揭开 - 每张都以服务它的字体呈现，没人选择的一张带着 Starter 标签，Italic 跟随主体](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 对比舞台

对比台在房间内、你按下的卡片下方打开，卡片会折叠成一行条带，这样对比台能出现在手机的第一屏。Escape 取消并把焦点还给卡片。

1. 按卡片上的 **Choose a face**。
2. 输入字体家族名称并按 **Preview**，或按输入框下方六个 **Pinned** 家族之一。
3. 按 **Use this face**。

![compare stage 在其卡片下方打开，带有搜索行、已固定的字体家族，以及折叠成一行的卡片](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**只询问一次同意。** 第一次预览需要访问 Google Fonts 时，会有一个对话框解释：*Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** 继续并会被记住。**Cancel** 会让卡片显示 *"Not fetched. Nothing was sent to Google."*，并带有它自己的 **Fetch from Google**。

**把字体文件拖到对比台上**（TTF、OTF 或 WOFF），即可预览你已拥有授权的字体。无论哪种方式，字体都留在这台设备上，在应用、工具和每个导出中离线渲染，并随设计系统文件一起传递。Google Fonts 上的所有内容都采用开放许可协议（OFL、Apache 或 UFL）。

### 本设备上的字体

**Fonts** 面板列出这台设备上的每种字体及其担任的角色。你添加的字体在 **In the design system** 下排在最前，各带其角色和删除按钮。起步字体随后排成一行淡化的折叠行。**Add a face** 为任何角色打开对比台。**Type roles** 面板显示每个角色的实时样张，带有其字体家族和状态，例如 *Inter* 或 *Inter · follows Primary*。

## 令牌

令牌是设计系统背后的命名值：颜色、字体、徽标、圆角和间距。工具按名称读取它们，所以在这里的更改会一次到达每个工具。

![Tokens 房间：带有系统示例和文件操作的页头、统计每种令牌的方块，然后是带有对比度读数的颜色配对](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **页头**给出你自己系统中的一个示例（*Primary is Spearmint, #033633*）以及文件操作：**Download**（整个系统作为设计令牌，或调色板的其他五种格式）、**Copy CSS** 和用于读回 JSON 文件的 **Add from…**。
- **方块**统计每种令牌并跳转到对应部分：Colours、Type、Logos、Shape and spacing、More 和 All tokens。它们统计的是你自己的，与 Overview 相同。在手机上，方块可以横向滚动。
- **Colours** 先是工具搭配使用的配对（表面上的文字、主色上的文字、表面上的弱化文字），带有浅色和深色下的 APCA 读数，并在配对不足时标记 **Weak contrast**。然后是每个颜色组：色阶作为一行色块，其他颜色带有其值和工具使用的引用，例如 `{color.brand.spearmint}`。按下引用即可复制该引用。**Edit in Colours** 在 Colours 房间中打开一个组。
- **Type** 和 **Logos** 列出每个角色和每个徽标槽位的字体，当你有自己的之后会带有 **Edit in Type** 和 **Edit in Logos**。
- **Shape and spacing** 包含 **Rounded corners**（`shape.radius`）和 **Spacing rhythm**（`space.base`）。每一项在你移动滑块之前显示 *Lolly default*，之后显示 *Yours*，立即保存且可以撤销。
- **More tokens** 增加间距、尺寸、描边宽度、不透明度、旋转、普通数字和阴影，存储为标准的[设计令牌](/info/design-tokens.html)。
- **App appearance (advanced)** 列出 Lolly 自己的界面使用的颜色、尺寸和阴影，**Inspect every token (advanced)** 可搜索和编辑任何存储的值，并先显示每个更改以供审阅。

空白的部分会提供填补空缺的方式：**Pick a colour**、**Choose a face** 或 **Add a logo**。

## 文件

放入你的品牌保存的文件（徽标除外）：**vector**、**image**、**audio** 和 **motion** 文件（视频、Lottie 和动画）。它们会出现在 [Assets](/info/using.html#assets-your-library) 中，分门别类，并在每个工具的素材选择器中就绪，它们留在这台设备上。

## Usage & rules

**Usage & rules** 让你品牌的选择发挥作用：人们可以更改什么、什么保持固定，以及 Lolly 可以检查什么。

![Lolly Demo 上的 Usage & rules：一张空的 Brand rules 卡片和 Add your first rule，然后是 Try your brand in use，其示例已准备好渲染](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** 列出你的规则。**Add rule**（或 **Add your first rule**）会打开一个简短的表单：

- 用你自己的话写的 **Rule name**，例如 *Beacon accents*；
- **Check**：**Colour choices**、**Font choices**、**Fixed artwork** 或 **Text length**，以及它所用的品牌角色，使用你自己为该角色起的名称；
- 它所适用的 **Example**（Poster、Title slide、Content slide 或 Chart）、**Mode**，以及它是 **Required** 还是 **Advisory**；
- **Reviewed by**，然后是 **Save draft** 或 **Approve & save**。

批准记录的是你在这台设备上自己的决定。已批准的必需规则会约束可复用的海报，检查只涵盖示例 PNG；它们不会改变任何其他工具。

设计系统在其令牌文件中自带的规则，例如认可的配色组合、文字字重和对齐，或每个界面使用的徽标，在这里列为 **Checked in Design**。Design 会在导出面板的 **Before you export** 卡片中逐图层检查它们，`lolly check` 对已保存的 Design 文档做同样的事（[导出之前](/info/design.html#before-you-export)）。此版本没有检查器的规则会按提供的原样保留，并标记为 **Unchecked**。

**Try your brand in use** 用 **Render & check examples** 从当前修订渲染四个示例。选择一个 **Brand mode** 和 **Try your own text** 来输入标题、辅助文字和幻灯片文字。每个示例都会报告测量到的内容，带有 **See checks & sources** 和 **Download check report**，**Make reusable poster** 会下载一个 `.lolly`，其固定版面和已批准的输入选择随文件一起传递。示例是本地的：运行检查不会发布或批准任何内容。

带有固定品牌的构建版本会在 *This brand is set* 下以只读方式显示同样的规则和示例。

## 导入品牌

侧栏底部的 **Add from…** 打开一个选择器，它问的是你有什么，而不是它是什么格式：

- **Design tokens or a design file**：DTCG 或 Tokens Studio JSON、Penpot 项目、令牌集合的 zip、Lolly 设计系统包或 SVG。
- **PDF**：演示稿或指南文件，在这台设备上读取其颜色、标志和嵌入字体。
- **Logo or screenshot**：图片变成建议的调色板，在这台设备上读取。它读取的是颜色，而不是字体或版面。
- **Saved web page**：一个 HTML 文件及其 CSS 文件，或粘贴的 HTML 或 CSS，最多 20 个文件和 2 MB。只读取你提供的文本：不会获取链接的资源，脚本也不会运行。
- **Font file**：TTF、OTF 或 WOFF。打开 Type 房间，字体在那里安装。
- **Website**：一个页面，读取其颜色和字体。这个方块只出现在能读取页面的设备上，并说明它使用哪种读取器：这台设备上的应用，或以你的身份登录、在后台标签页中运行的浏览器扩展。指定 URL 只是填写输入框；按下获取才算同意。

选择设计文件来源后，下一张卡片会以图标方块列出接受的格式，整张卡片就是一个放置目标。你也可以直接把文件拖到工作室上。

![导入卡片 - 可接受的格式以图标图块的形式排列在前,整张卡片是一个放置目标](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Lolly 设计系统包**（`.lolly`，或旧版 `.zip`）一步安装。
- **Penpot** 导出（`.penpot`）会带入其设计令牌。
- **Design Tokens**（W3C DTCG）或 **Tokens Studio** 文件（`.json`）会带入其令牌。
- **普通 SVG** 会被扫描颜色供你挑选，第一个成为你的主色。

### 审阅参考

徽标、截图、网站或保存的页面会打开 **Try these colours**：一个采用建议颜色的示例、一个你可以更改的 **Main colour**，以及新系统的名称。一个方框说明应用会做什么：它会用生成的调色板和默认样式**替换**当前的令牌设置，**保留**你的字体和库文件，并且之前的系统可以被**恢复**。**Apply suggested settings** 会在检查点之后应用浅色和深色调色板，**Restore brand settings** 可以找回旧设置。**Change reference** 选择另一个来源。

**Palette, source details and individual choices** 显示读取到的内容、发现的任何字体名称，以及预览的对比度。字体名称只是建议；安装字体仍要在 Type 中进行。来源详情可以包含观察到的排版、间距、内边距和圆角值，未观察到时标记为 **Not observed**。保存的页面或原生网站读取会报告声明的样式，页面可能并未使用它们，而浏览器扩展可以报告从可见元素样本中测量到的样式。这些是观察结果：不会安装任何东西，来源的间距也绝不会替换你自己的。**Choose individual items in the tray** 只保留单项，**Download design context** 会保存一份 JSON 报告，包含观察结果、建议的令牌和来源信息（以及所提供的任何 HTML 或 CSS 的 SHA-256）。该报告不含原始页面文本，也不是签名的 Content Credential。

PDF 和设计文件导入有自己的审阅控制项。**Tray** 中的项目在你把它们添加到拥有该类材料的房间之前不会改变任何内容。`#/start?source=<kind>` 会在某个来源上打开选择器（`file`、`pdf`、`image`、`font`、`url`、`page`），`?import` 打开普通列表。

### 查找并比较外观

从 Overview 或 Settings 中的设计系统列表打开 **Find a look**。浏览保存在这台设备上的系统和几个可复用的 Lolly 示例，并按名称、颜色标签或声明的字体搜索。**Closest to my current palette** 按测量到的颜色相似度排序，字体匹配用于打破平局；它不是质量评分。

选择一个外观进行审阅，或选择两个并排比较。选择不会更改任何内容。**Use this saved system** 切换到它，**Use these colours** 通过常规检查点应用示例的颜色，同时保留你的字体。**Restore brand settings** 找回之前的外观。已保存的系统在 **Details and design context** 下有可编辑的 **Search tags**。这些示例是 Lolly 原创的配色方案，没有抓取的合集，也不需要账号。

![并排比较 Sunroom 和 Orchard，然后再决定采用哪一套配色系统。](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## 保存并迁移你的设计系统

### 在设备之间迁移品牌

**Export** 写出一个 **`LollyBrand-….lolly`** 文件：你的令牌、字体、徽标和主题偏好，带有一份在导回时会被检查的完整性清单。1.0.7 之前的网页版本把同一个文件命名为 `.zip`，这种写法仍被接受。**Tokens (.json)** 单独写出普通的设计令牌文档，不含字体或徽标，供仓库、构建步骤或其他令牌工具使用。

要导回一个，请使用 **Add from… → Design tokens or a design file**，或把文件拖到工作室上。同事就是这样把品牌交给你的，你也是这样把品牌带到第二次安装的，无需账号，也无需云。要从命令行导入品牌，请参见 [`ingest:brand`](/info/configuration.html#brand-packs)。

**Fonts for Linux (.rpm)** 把你添加的字体打包成可安装的 RPM。如果其中任何字体是你自己上传的，Lolly 会先要求你确认你有权再分发它们。

### 恢复早先的设置

选择 **Restore brand settings**，选中一个带日期的检查点并按 **Restore**。它会恢复当前品牌的颜色、字体设置和其他令牌；字体和图片文件保持不变。Lolly 会先把你当前的设置保存为 **Before restore**，所以即使在关闭浏览器之后，你也可以撤销恢复。最近的 20 个检查点保存在这台设备上。

### 版本

已发布的版本是保存在这台设备上的**永久命名副本**。它永不改变，所以固定了它的工具或链接（通过 `designv`）会一直画出同样的东西。含有你自己内容的系统会在侧栏底部显示一个低调的 **Versions & publishing** 链接；首次发布后它变为 **Versions** 条目。`#/start?area=versions` 会直接打开它。

- **版本是永久的。** 目前还不能删除，面板也这样说明。
- **移除项排在兼容性卡片的最前面**，因为被移除的令牌会破坏工具。
- **发布无法撤销；恢复可以。** *Restore latest from this version* 是一次普通的编辑，立即提供 **Undo**。

**Publish only** 保留一个版本，而不改变工具跟随的内容；**Publish and make active** 让工具和应用跟随该版本。**Follow the latest again** 让你每次编辑后立即生效。

## 管理你的设计系统

打开 **Settings → Preferences → Design systems** 来切换、添加或移除系统。**Open** 选中一个系统并在这里打开它；**Make a new one** 创建本地系统并打开它，名称字段已就绪。同一时间在整台设备上有一个系统处于活动状态。[品牌架构](/info/brand-architectures.html)有助于判断品牌何时需要自己的设计系统。

**系统来自哪里。** 部署的目录所提供的系统显示为 **Came with this app**，在连接到某个实例的应用中则显示 **From this instance**。展开 **Catalogue source** 可以看到由谁提供、它的令牌素材和命名空间，以及已知的版本或校验和；如果刷新失败，缓存的内容会有标注。

**受管理的系统是只读的。** 当其目录锁定系统时，系统显示 **Managed by this instance**（在没有实例的桌面应用中为 **Managed by this app**）。你可以使用并下载它，在这里打开它会显示一条只读提示，带有 **Make an editable copy** 和 **Switch**。你自己的本地系统保持可编辑，即使受管理的系统先出现。带有一个固定品牌的构建版本会让 Design System Setup 打开 *This brand is set*，供你阅读该品牌的令牌和使用规则。

**其他每个提供的系统都归你**隐藏、编辑和重置，包括 lolly.tools 上的 Lolly Demo 和 Lolly Starter。编辑其中一个会保留其名称并把该行标记为 **Edited here**，其菜单中的 **Reset to original** 会丢弃在这台设备上所做的更改。空白的 Starter 是例外：在那里的第一次更改会开始你自己的设计系统，所以 Lolly 会询问一次新系统叫什么。[实际使用 Lolly Demo](/info/lolly-demo-in-use.html#switch-to-your-own)展示了你自己的系统取代了什么。

### 移除设计系统

从系统菜单中选择 **Remove**；确认框会说明之后哪个系统将处于活动状态。已保存的会话、上传内容和与另一个系统共享的素材都会保留。

移除提供的系统只是隐藏它：它的目录素材保留，**Bring back** 会再次显示它，而且如果你移除了其他所有系统，它会自行回来。移除导入的或编辑过的副本不会移除提供的系统、它的徽标或字体，如果该副本是活动的，提供的系统会再次成为活动系统。移除活动的托管副本只会清除该副本的连接；单独选择的实例保持选中。

更改服务器提供的内容是管理员的任务：其运营方更改源目录并重新部署，或由 Lolly Work 管理员审阅并应用服务器的更改。这里的编辑只保留在本地。参见[移除目录设计系统](/info/configuration.html#removing-a-catalogue-design-system)和[配置](/info/configuration.html#supplied-and-local-design-systems)。

## 在应用之外使用设计上下文

**Download design context** 会保存令牌文档、解析后的颜色、声明的字体家族、素材 ID、已记录的来源证据、覆盖范围和明确的规则，不含字体文件，也不含所有权证明。命令行无需服务器即可读取该文件：`lolly system import` 把它设为终端的设计系统，`lolly system check` 对照已保存的上下文检查 Design 的输入。[导入你的设计系统](/info/cli.html#bring-your-design-system)介绍了导入，[命令使用哪个设计系统](/info/cli-decks.html#which-design-system-a-command-uses)介绍了检查，MCP 客户端则从 `lolly://design-context` 读取同样的简报（[MCP 服务器](/info/mcp.html)）。

## 接下来去哪里

- **[使用 Lolly](/info/using.html)**：工具、保存、分享和 Assets。
- **[品牌架构](/info/brand-architectures.html)**：部门、产品、背书品牌、客户和季节如何对应到设计系统、配色方案和徽标标识。
- **[设计令牌](/info/design-tokens.html)**：你的品牌所采用的令牌模型。
- **[导出文件](/info/exporting.html)**：印刷单位、CMYK，以及你的品牌渲染成的格式。
