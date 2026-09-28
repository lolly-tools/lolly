# 品牌工作室

位于 `#/start` 的**品牌工作室**是你塑造品牌的唯一场所 - 它的标志、颜色、字体、其余的令牌以及它保存的文件。在这里设置一次,每个工具、页面和导出都会*天然*遵循它,而不是靠事后审查。

你所做的修改会**在整个应用中实时预览**,让你在提交之前就能看到某个颜色或字体落地到各处的效果。这一切都在设备本地完成:你的品牌文件和令牌永不离开你的机器(选择 Google 字体时,会在同意对话框之后从 Google 获取那一个字族,仅此一次),而品牌以单个[品牌包](#move-a-brand-between-devices)文件的形式携带。

> **这里是编辑器,仪表盘是镜子。**仪表盘(`#/d`)上的**设计系统**标签*只读展示*你的品牌;你在这里,即 `#/start`,进行*编辑*。之后想改一个颜色,回到品牌工作室来。

## 房间

工作室由侧栏中列出的一组**房间**组成 - 不是步骤。没有编号,彼此之间没有前置条件,从任意一个房间进入都是合理的:

- **Overview** - 中枢。一眼看清当前拥有什么，并有通往每个房间的入口。
- **Colours** - 逐个添加颜色，指定角色，或从一个颜色生成整套调色板。
- **Type** - 应用、你的工具及每次导出所读取的四种字体。
- **Logos** - 你的标志，涵盖每种方向和处理方式。
- **Tokens** - 圆角、间距、阴影及系统的其余部分。
- **Files** - 你的品牌保存的图像、音频和动效文件。

在手机上,同样的列表会变成固定在页头下方的横向标签条。切换房间从不会重新加载任何内容 - 编辑器把所有面板都保持挂载,只是显示你要求的那一个。

用 `#/start?area=<key>` **深链到某个房间**。键值有 `overview`、`color`(*注意 URL 中是美式拼写*)、`type`、`logos`、`tokens`、`catalogue`(即文件房间 - 面板键是永久性契约,所以 URL 沿用旧名)以及 `versions`。`?tab=` 是同一功能长期存在的别名,仍然有效,所以旧链接和书签能继续使用;无法识别的值会打开概览,而不是死路一条。

固定在**侧栏底部**的,是属于整个设计系统、而非某个房间的操作:

- **Add from…** - 来源选择器，用于从文件、PDF、图片、字体或网站导入品牌。见下方[导入品牌](#bring-a-brand-in)。
- **Tray** - 扫描找出但尚未提交的候选项。它默认隐藏，只有扫描确实保留了内容时才会出现，并显示数量；在你对该行按下 Add 之前，其中任何内容都不会改变你的品牌。
- **Export** - 将整个设计系统写成一个 `LollyBrand-….lolly`。
- **Tokens (.json)** - 单独的纯设计令牌文档，供仓库、构建步骤或其他令牌工具使用。
- **Restore brand settings** - 回到导入或替换品牌设置之前保存的检查点。
- **Versions** - 发布、启用并恢复设计系统的命名副本。在你有自己的内容可发布之前保持隐藏（或者有 `?area=versions` 链接按名请求它）。

![工作室房间侧栏 - Overview、Colours、Type、Logos、Tokens 和 Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## 概览

概览是你降落进入的房间，它有两副面孔。

**尚未设置任何内容**时，它写着 **Make it yours**。**Start from a reference** 打开来源选择器，可选标志、截图、网页或设计文件。**Pick a colour**、**Choose a face** 和 **Add a logo** 会直接打开各自的现有控件。每条路径都以一次选择开始；打开它并不会写入任何内容。**Explore the tools** 则随时可用。

一旦你拥有了自己的内容，同一个房间会显示**你已拥有的内容**，并以你做出的数量领头。Colours 读出设计系统所带颜色的数量，只有在存在继承颜色时才会加上一行淡淡的 `· N starter`；旁边的色带把你自己选的颜色排在前面，接一条细线，再是淡化的 starter 颜色。Type 按角色读出（*Inter for headings*，下面跟着 *Starter for the rest · SUSE, SUSE Mono*）。Logos 读出已填入多少个槽位，或者 **Not set**。Tokens 带出圆角值，在你移动它之前标为 *starter*。库为空时，Files 显示 **Nothing yet**。每个板块都是通往对应房间的入口。这里只有数量，从没有进度条，也从没有“完成”卡片 - 这个工作室不欠你任何东西。

## 标志

从把你文件夹里的标志一次性拖入顶部的放置区开始:“**把标志拖到这里,或一次选择多个**”一次能接收你拥有的所有文件。每个文件都会被读取其形状和用色,然后在**等待槽位**下排队,显示为一个说明其判断的芯片 - 例如“*看起来是水平主标志*”,附带它据以判断的度量,以及一个**放置**按钮(如果该槽位已被占用,则是**替换**)。当它不确定时,芯片会明确说明,并改为提供**更改槽位**按钮,列出全部八个槽位。在你点击之前,不会有任何内容被放置。

围绕这个队列会发生两件事。空白边距过多的标志会先收到**裁切建议**——回应它或按 Esc,原始文件都会原样放入。而当某个标志能够补全一个空着的兄弟槽位时,该房间会把派生出的**单色**或**反白**版本作为独立芯片提供,标注为*已生成*,如果你用别的方式填了那个槽位,它就会再次消失。

下方是每个标志最终归属的网格 - **方向 × 处理方式**的槽位:

- **方向:**水平(字标 + 图形并排)和垂直(堆叠,适合方形和竖直空间)。
- **处理方式:**主色、主色反白(用于深色背景)、单色(一种颜色)和单色反白。

这就是八个可选槽位。点击一个槽位可添加 PNG、SVG、JPEG 或 WebP;点击已填入的槽位可替换它。每个槽位都是可选的,一切都保留在本设备上。

![标志矩阵 - 顶部是各个方向,每种处理方式都是自己的虚线槽位,全部可选](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - 在 **Custom marks** 下添加你的品牌以自己方式命名的标志（图标、徽记、favicon）；命名并选择一个文件即可。
- **More identities** - 子品牌、产品或活动可以拥有自己完整的一套标志。使用 **+ Add another logo** 并命名；你的主标志集就是简单的 “Your logo”。
- **Upload an SVG and Lolly reads its colours.** 在全新安装上，它会悄悄地把你的主色设为标志中的颜色，并说明这一点。在已有品牌上，它会改为把该颜色作为建议提供 - *“Found in the logo: #…”* 旁边带一个 **Use as primary** 按钮 - 位于 Colours 房间中，你可以采纳或忽略它。

## 颜色

房间会随设计系统一同生长。尚未用到的内容不会出现在页面上，因此第一次到访只是一次决定，其余的随调色板一起到来。

### 第一个颜色

没有自己颜色的设计系统会打开在一列居中的内容上：**Start with one colour**，一个很大的实时色块、一个输入框，以及一行安静的说明，告诉你角色、色阶和印刷设置会随系统成长而到来。

- **色块就是选色器。** 按下它，工作室自己的 OKLCH 卡片就会在色块上打开，并以输入框当前的内容为种子：一个名称、色轮、四个拨盘、透明度和 **Stored as**，卡片下方是 **Cancel** 和 **Add colour**。拖动拨盘会给色块上色，并随之改写输入框，在你按下 **Add colour** 之前，什么都不会进入设计系统。
- **输入框接受任意表示法** - `#e0452b`、`rgb(224 69 43)`、`oklch(58% .19 32)` 或一个普通的颜色名称 - 粘贴一整份颜色*列表*，每个颜色都会变成一个可单独添加的色块。
- **旁边还有两扇门。** 取色器（在支持它的浏览器上）从屏幕上取一个颜色，**From an image** 读取此设备上的一张截图或照片，并给出它找到的颜色。
- **Add 永远不会被禁用。** 输入框里没有可读取的内容时，它会打开选色器，这通常就是一次空按所代表的意思；它无法解析的文本会在输入框下方显示一行说明，而不是一个死按钮。

第一个颜色会成为 **primary**，回应这次添加的色块会这样说明 - *“Primary is now Vivid Violet”* - 旁边带着 **Fine-tune**。

![尚未选择任何内容的 Colours 房间 - 一个很大的实时色块、一个输入框，以及一行关于后续内容的说明](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** 是对随应用一起到来、而非由你选择的一切内容的称呼。全新安装完全不带任何颜色：它只有一条中性色阶，从墨色到纸色，好让表面、文字和细线在任何人做出任何决定之前就能渲染出来。这些中性色只是脚手架，所以它们不计入颜色数量，也不会画在调色板面板里。它们存在于 [Tokens](#tokens) 房间中，标为 **Neutrals · starter · 9**，旁边的 **Open** 会把它们在 Colours 面板中显示为一个折叠的、带标签的分组（`#/start?area=color&group=neutral`）。

同一个词贯穿每个房间：一个落在 starter 颜色上的角色会读作 *“Starter Paper stands in”*，它的选色器提供 **Choose…**；一个 starter 字体带着 **Starter** 标签且没有色调；一个 starter 圆角会在 Overview 上被标出。继承而来的素材从不用虚线边框绘制，因为在这里虚线边框代表一个放置目标。

### 随调色板成长

你的颜色在宽屏幕上和一个 **In context** 预览并排，在较窄的屏幕上则堆叠在它上方。预览可以用你的调色板展示海报、图表或界面卡片。Starter 颜色留在自己可折叠的分组里，与你添加的颜色分开。

逐个添加颜色或一整组色阶，指定它们的角色，并在需要时展开高级区块。色彩图表、渐变和下载控件都留在调色板旁边。

![添加一个颜色后的 Colours 房间，带有它的调色板和一个实时的构图预览](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - 工具读取的是什么

**Roles** 是叠加在色块之上的一层：哪个颜色在每个工具和每次导出中扮演哪个部分。角色是可选的（一个只有三种松散颜色、没有任何角色的设计系统也完全没问题），任何色块都可以承担一个角色，对比度读数是相对于表面测量的，优先使用 APCA。

一行会以三种语域之一呈现，因此这条色带从不会声称一个没人做过的决定：

- 一个自有颜色承担该角色，处于全强度；
- **Starter *Paper* stands in** - 淡化显示，其选色器上带有 **Choose…**；
- **↳ follows Primary** - 该角色通过主色解析，而不是解析到属于自己的颜色。

一旦调色板有了色阶，色带就会扩展到工具能读取的全部七个槽位：Primary、Secondary、Surface、Text、Muted、Edge 和 On primary。On primary 是由 primary 派生的，读作 **Derived**，且没有选色器。

**应用自身的强调色是一个偏好设置，而不是一个令牌。** 默认情况下，界面跟随设计系统，铬件强调色采用主色。这是[你的 profile](/info/profile.html) 上的一个 Appearance 设置 - **Interface follows the design system** - 关闭它会让铬件保持中性。无论开关与否，工具、画布和导出都不受影响，字体和圆角则始终跟随设计系统。

### 专家侧翼

构图预览和颜色角色下方是四个折叠区块。展开你想要的那个；每个都可通过 `#/start?area=color&focus=<wing>` 深链访问，无论房间当前显示的是什么，都会打开它：

- **Explore shades & harmonies**（`focus=generate`） - 从一个颜色生成一整套色阶。见下文说明。
- **Shade curves**（`focus=curves`） - 逐点重塑一条色阶。明度、彩度和色相各自拥有自己的曲线，用 L / C / H 切换，拖动时下方的色阶会实时重新生成。
- **Contrast**（`focus=contrast`） - **Contrast-lock** 会重新调色一条色阶，使其相对于你选择的背景达到 APCA 目标值，每一级都保持自己的色相和彩度；**Rotate hue** 会让整条色阶在色轮上整体旋转，每一级都保持自己的明度和彩度。
- **Print**（`focus=print`） - 主色在印刷时会变成什么：其自动的屏幕值，或者固定的 CMYK 构建，或者一个指定的专色油墨。

### 一个颜色,一整套调色板

在 **Explore shades & harmonies** 中，选取一个 **Starting colour**。Lolly 会用引擎在别处统一采用的同一套感知颜色数学（OKLCH）来建议匹配的色阶。可调节建议的参数：

- **Scheme** - Mono、Complement、Analogous 或 Triad - 决定次色与主色的关系。
- **Shades** - 一个从 3 到 20 的滑块（默认 5），控制每条色阶生成多少级。
- **Fine-tune**（折叠） - **UI intensity**（Muted / Deep）、**Contrast**（Comfort / High）和 **Text on brand**（Auto / Light / Dark）。

更改起始颜色和控件只会改变建议内容。点击一个色阶即可添加该颜色，或按 **Add 5 shades** 添加一整组（数量跟随你的 Shades 设置）。已有的颜色和角色保持原位。Undo 会移除这次添加。

**Primary**、**Neutral** 和 **Secondary** 行显示建议的色阶。打开 **Theme preview** 可查看浅色和深色示例及其对比度读数。在那里选择一个 Neutral 或 Secondary 的级别，可以调整建议的主题锚点。重建整套调色板仍是下方一个单独的、需要确认的操作。

![三组建议的色阶，各自带有单独的添加控件，以及一个独立的 Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### 构建调色板（和谐生成器）

在 **Find matching colours** 中，和谐生成器会从主色建议匹配的强调色。挑一种 **Harmony** - **Complementary**、**Adjacent**、**Triad**、**Tetrad** 或 **Analogous**（后者自带 2 到 5 的 **Accents** 数量，以及 10° 到 45° 的色相 **Angle**） - 每个候选色都带有自动生成的、可读的名称和一个 **+ Add** 按钮。添加一个即可立即将该颜色纳入调色板，一次按下对应一个令牌。**In context** 会在示例构图上预览你添加的颜色。

![生成的强调色，每个都带有色块、自动生成的名称、十六进制值和一个 Add 按钮](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### 提交生成的调色板

添加一个建议的颜色或色阶组会保留你调色板的其余部分。如需彻底替换，请打开 **Rebuild the whole palette…** 并按下 **Preview full rebuild**。审阅界面会说明这些变化：有多少角色会保持你分配的样子、有多少你自己添加的颜色会被保留、有多少色阶曲线会重新锚定、有多少印刷锁定会重新固定、有多少隐藏色阶保持隐藏、有多少渐变节点保留其颜色。

该卡片上的 **Apply rebuilt palette** 会提交更改；**Cancel** 则退出且不做任何改动。运行完成后，卡片会提供 **Undo**，且焦点已经落在它上面 - 而且在替换*之前*会先对整个设计系统做一次检查点，所以“恢复原状”只是一次还原操作，而不会白白丢掉一个下午。

### 调色板、色轮图与每个色块

调色板以可折叠的分组列出设计系统的颜色，每组都有自己的 **+ Add** 控件。创建和重命名分组来组织你的工作。一个角色从不会生成第二个色块：一个令牌就是一个色块，一个角色所指向的色块只会多戴上一个小小的角标（**P**、**S**、**Su**、**T**）。色块下方，**Colour chart** 会展开成同一批色块的两种视图：**Wheel**（OKLCH 色轮 - 拖动一个点可为其重新上色，点击一个点可编辑它，或点击空白处添加一个新色块）和 **Gamut** 图，显示可显示范围实际终止的位置。`#/start?area=color&focus=chart` 会直接打开该卡片，`?wheel` 也一直如此。

![调色板面板，每组都可折叠，下载胶囊按钮固定在其底部边缘](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![OKLCH 色轮 - 角度代表色相，距中心的距离代表彩度，灰色沿侧边的明度轨道排列](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

点击任意色块以打开其编辑器:

- **重命名** 它。
- **设置颜色** - 拾色器以感知性的 **OKLCH** 滑块打开,并提供 **Hex**、**HSL**、**RGB** 和 **CMYK** 模式;数值输入框会以当前激活的空间进行读取 *和* 写入,因此你可以粘贴十六进制值或输入油墨百分比。请注意,输入 CMYK 是通过换算来设置 *屏幕* 颜色 - 若要固定精确的油墨值,请使用下方的印刷锁定。
- **存储为** - 选择色块的持久化方式:**LCH**(默认 - 感知性、广色域,是编辑时的最佳选择)、Hex、RGB 或 HSL。当你需要固定一个精确的旧版十六进制值或匹配 sRGB 值时可覆盖此设置。
- **用作** - 将此色块直接赋予某个品牌角色,无需返回角色面板。(角色本身的卡片不提供此选项 - 角色不能再取用角色。)
- **印刷替代**(折叠)- 锁定该颜色的印刷表现:
  - **CMYK** - 将其从 **自动** 切换为 **锁定**,以精确油墨值(C/M/Y/K,0-100)覆盖自动的 sRGB→CMYK 转换。
  - **专色** - 将其从 **无** 切换为 **设置**,以将色块锁定为专色;为其指定一个 **名称**(例如 `PANTONE 186 C`)、一个可选的 **色卡** 和一个可选的 **工艺**(默认为普通油墨),用于油墨根本不是油墨的情况 - 例如烫金、凹凸压印、局部上光、软触感涂层或模切、压痕或打孔。
- **在其他色彩空间中**(折叠)- 同一思路的扩展:每一行是该色块可以表达的一个色彩空间,要么由标准值推导而来,要么由你自行指定,导出时以你指定的值为准。

这些印刷锁定值就是印刷厂在你导出 CMYK PDF 或 TIFF 时所使用的值 - 参见[导出](/info/exporting.html#colour-profiles)。

**删除一个色块** 是安全的:派生的色阶步进和主题角色会被 *隐藏*(底层令牌仍会继续解析,因此下游不会出错),而你自行添加的颜色则会被彻底移除。

### 操作大量色块

每个色块都有一个独立的拖动手柄。拖动它可以在分组内重新排列颜色，或者聚焦它、按空格键、用方向键移动，再按一次空格键放下。Escape 取消。顺序会在重新打开工作室后保留，也可以撤销。要在分组之间移动颜色，使用色块编辑器的 **Group** 控件，或选中多个颜色后使用 **Move**。令牌名称和角色引用保持不变。

调色板面板中的选择是一个手势，而不是一种模式。没有需要先按下的按钮，选择栏随第一个选中的色块出现，随最后一个消失。

- **在面板的空白处拖动**画出一个矩形：它触及的每个色块都会加入选择，跨越分组边界。折叠的区块不会贡献任何内容，一次没有移动的拖动会清空选择。
- **Shift 点击**按阅读顺序选取一段范围；**Cmd/Ctrl 点击**切换单个色块；普通点击仍会打开该色块的编辑器。
- 每个分组标题都带有 **Select all**，聚焦某个色块后按 **Cmd-A** 会选中设计系统拥有的每一个颜色 - 但从不包括 starter 颜色。
- 网格只有一个 Tab 停靠点。方向键在其中移动，Shift + 方向键扩展选择，空格键切换一个色块，Delete 移除选择，Escape 清空选择。（方向键只移动焦点：要微调一个通道，请先按 `l`、`c` 或 `h`，如读数所示。）
- 在触屏设备上没有矩形选框。按住一个色块开始选择，然后点按以添加；每组的 **Select all** 承担其余部分。

选择栏本身会读作 **{n} selected**，接着是 **Move to**（一个已有分组，或在菜单内命名一个新分组）、**Give a role**（每个选中的颜色依次承担下一个角色，因此四个色块一次按下就能填满全部四个角色）、**Download**（以六种调色板格式之一下载所选内容）、**Copy values**（每个颜色一行，采用其存储时的表示法）和 **Delete**。Move to 和 Give a role 只有在调色板已有色阶可供移动时才会出现。一次 Ctrl/Cmd-Z 即可撤销整个批量操作 - 移动四十个、走一轮角色、一次删除 - 而删除会说明它实际保留了什么，因为一次选择可能触及这个房间不会移除的色块。

### 渐变

一个可选的 **Gradients** 面板会根据调色板为背景和强调色构建混合令牌。如果设计系统不使用渐变，可以完全跳过它。每个渐变都有一个预览、命名的节点（2-8 个）以及一个角度。关键行为是：**一个节点引用某个色块**，所以重新为该色块上色，渐变也会随之改变。插值在 OKLCH 中进行，以获得干净的混合效果。删除一个节点即可缩减渐变的走向。

### 将调色板用到别处

停靠在调色板面板底部边缘的浮动胶囊按钮可将整个调色板下载为 **Design tokens (JSON)**、**CSS variables**、**CSS classes**、**SCSS variables**、一个 **GIMP palette (.gpl)** 或一个 **Adobe Swatch Exchange (.ase)** - 使设计系统可以直接进入 Illustrator、Figma、GIMP 或一份样式表。它位于面板滚动区域之外，因此无论调色板滚动到多远，它都保持在原位，并且在调色板已有色阶后才会出现。（你也可以从[素材](/info/using.html#assets-your-library)下载调色板。）

## 字体

这个房间以同样的方式生长。在没有自己字体时，它只是一张卡片、一个决定：**Primary**，以今天服务它的那个字体按阅读大小显示，名称旁边是一个 **Starter** 标签，一个已填色的 **Choose a face**，以及一行*“Nothing installs until you choose one.”* 卡片下方是 *“Headings, code and italic follow the primary until you choose them”*，**Choose them separately** 会在本次到访的其余时间里展开另外三张卡片。

![尚未选择字体的 Type 房间 - 一张阅读大小的卡片，带有一个 Starter 标签，以及一个已填色的 Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

选择一个字体后，房间会展开为 **four role cards**、Fonts 列表和实时样张。这四种字体正是应用、你的工具以及每一次导出实际读取的字体：

- **主体** - 正文文案、按钮和所有工具。
- **标题** - `h1`/`h2` 使用的展示字体。
- **代码** - 用于代码和数据的等宽字体。
- **斜体** - 用于强调、引用和旁白的真正斜体配套字体。

标题、代码和斜体在你指定之前都会回退到主体字体，因此单字体的设计系统在这里完全不需要做任何决定。

**一个色调意味着你选择过它。** 只有你安装了那个字体的卡片才会带色调。一个 starter 字体带着与调色板中继承分组相同的 **Starter** 标签，处于淡化的语域中且没有色调；一个没人选择过的角色会读作 **↳ follows Primary**，而不是像被选过一样重复主色的名字。按钮在你自己的字体上写着 **Change**，其他地方则写着 **Choose a face**。卡片上没有任何东西会立即提交：按钮打开的是限定于该角色的 **compare stage**。

![四张角色卡揭开 - 每张都以服务它的字体呈现，没人选择的一张带着 Starter 标签，Italic 跟随主体](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### 对比舞台

![compare stage 在其卡片下方打开，带有搜索行、已固定的字体家族，以及折叠成一行的卡片](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

这个舞台**内嵌在房间里**打开，而不是弹出对话框，并且就在你按下的那张卡片正下方。它打开期间，卡片会折叠成一行角色和字体的条带，因此即便在手机上，舞台也在第一屏内。Escape 取消，并把键盘焦点交还给你用来打开它的那张卡片。

选择一个字体只需三次按下：

1. 在卡片上按 **Choose a face**。
2. 输入一个字体家族名称并按 **Preview** - 或者按输入框下方六个 **Pinned** 家族之一，一按即可。卡片会显示为已在加载，用一根骨架条占据样张的位置，而不是用界面字体来代替一个你还没见过的字体。
3. **Use this face**。

**同意只会在你按下的那一刻被询问一次。** 预览第一次要联系 Google Fonts 时，一个对话框会说明会发生什么：*Google 会得知字体家族名称和你的 IP 地址。此后该文件会保存在这台设备上并离线使用。这是工作室中唯一会联系第三方的一步。* **Fetch from Google** 会继续并被记住。**Cancel** 会让卡片显示 *“Not fetched. Nothing was sent to Google.”*，并带有它自己的实时 **Fetch from Google**，所以改变主意只需在卡片本身按一下。没有任何卡片会显示一个死按钮：无论处于什么状态，它唯一的主按钮都会说明下一步是什么。

**把字体文件拖到舞台上**，它会立即预览 - 来自你自己机器的 **TTF**、**OTF** 或 **WOFF**，这正是导入一款你已拥有授权的企业专属字体的方式。那个拖放区是这个房间里唯一的文件入口。

无论哪种方式，字体都会留在这台设备上，在应用中、在工具中以及每一次导出中渲染，永久离线可用，并随设计系统文件一同携带 - 渲染时不会获取任何内容。Google Fonts 上的一切均以开放许可证（OFL/Apache/UFL）发布。

### 本设备上的字体

**Fonts** 面板列出这台设备持有的每一种字体，以及它所服务的角色。你添加的字体排在 **In the design system** 之下，各自带有自己的角色和一个删除按钮，服务 Primary 的那个带有徽章。starter 字体跟在后面，折叠为一行 - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - 以淡化方式显示，没有删除，也没有可以升级的地方，因为这两者都不是任何人做出的决定。**Add a face** 会打开同一个未限定范围的 compare stage。

底部的 **Type roles** 面板展示每个角色的实时样张 - 以主体字体呈现的正文与界面文字、供顶部标题使用的可选展示字体、用于强调的斜体、用于代码和数据的等宽字体 - 每个旁边都标着字体家族及其状态（*Inter*、*SUSE · starter*、*SUSE · follows Primary*），让整套字体可以一次看清。

## 令牌

设计系统的其余部分,无需接触代码即可编辑:

![Tokens 房间 - 一个圆角滑块，加上间距、尺寸、阴影和系统的其余部分](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - 一个单一的半径滑块（0–1.5rem），应用中的卡片、按钮和面板都会跟随它。
- **Neutrals** - 全新安装自带的、从墨色到纸色的色阶，列为 **Neutrals · starter · 9**，带有它的九个级别和一个通往 Colours 面板的 **Open**。这是管理 starter 中性色的唯一场所，*starter* 标签只有在色阶被生成、而非继承而来时才会消失。
- **More tokens** - 添加和编辑 **spacing**、**sizing**、**stroke width**、**opacity**、**rotation**、普通的 **numbers** 和 **shadows**。选择一种类型，为其命名（*Gutter, Card shadow…*），然后设置其值。这些以标准[设计令牌](/info/design-tokens.html)（DTCG）形式存储，并随设计系统一同携带。

## 文件

在这里放置你的品牌所拥有的文件 - 标志除外：**vector**、**image**、**audio** 和 **motion**（视频、Lottie、动画）资源。它们会进入[素材](/info/using.html#assets-your-library)，按类别分组，并在每个工具的素材选择器中随时可用。所有内容都保留在此设备上。（侧边栏把该房间标为 **Files**；URL 键仍为 `catalogue`，因为面板键是永久约定。）

## 导入品牌

侧边栏底部的 **从…添加** 会打开一个两阶段选择器。第一阶段询问你 *拥有* 什么,而不是它是什么格式:

- **Design tokens or a design file** - DTCG 或 Tokens Studio JSON、一个 Penpot 项目、一个 **zip of token sets**、一个 Lolly 设计系统包或一个 SVG。
- **PDF** - 一份演示文稿或指南文件，在本设备上读取其颜色、标记和内嵌字体。
- **Logo or screenshot** - 一张图片会变成一份建议的调色板，在本设备上读取。不会上传任何内容。这只读取颜色，不读取图片中的字体或版面。
- **Saved web page** - 选择一个 HTML 文件及其 CSS 文件，或粘贴 HTML 或 CSS。最多 20 个文件，总计 2 MB。只会读取提供的文本；不会获取链接的资源，脚本也不会运行。这条路径在没有扩展或桌面应用时同样可用。
- **Font file** - TTF、OTF 或 WOFF。打开 Type 房间，字体在那里安装。
- **Website** - 一个页面，读取其颜色和字体。这块图块只会出现在真正能够读取页面的设备上，因为一个宣传着谁都按不了的功能的禁用图块，比根本没有图块更糟。它出现时会清楚说明用的是哪种读取方式：由本设备上的应用获取，或通过浏览器扩展在后台标签页中以你的登录身份读取。仅填入一个网址只会*预填*该字段 - 获取按钮才是同意操作，因此别人发给你的链接永远无法自行触发读取。

选择设计文件来源后,第二阶段就是下方这张卡片:可接受的格式以图标图块的形式按优先顺序排列,整张卡片都是一个放置目标 - 点击卡片任意位置或将文件拖到上面均可。你也可以直接将文件拖放到工作室上。

![导入卡片 - 可接受的格式以图标图块的形式排列在前,整张卡片是一个放置目标](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

每种设计文件能带给你什么:

- 一个 **Lolly design-system pack**（`.lolly`；仍接受旧版的 `.zip`） - 一步安装；
- 一个 **Penpot** 导出文件（`.penpot`） - 引入其设计令牌；
- 一个 **Design Tokens** 文件（`.json`） - W3C DTCG；
- 一个 **Tokens Studio** 文件（`.json`） - Tokens Studio；
- 一个**纯 SVG**（`.svg`） - Lolly 会扫描其颜色，让你选择要保留哪些，第一个会成为你的主色。

一个标志/截图、网站或已保存的页面会打开 **Your suggested design system**。用建议的颜色查看一个示例，如有需要可选择不同的 **Main colour**，并为该系统命名。**Use this design system** 会应用生成的浅色和深色调色板，并返回 Overview。现有字体保持不变。这会替换当前系统的颜色和其他令牌设置。检查点必须先成功；**Restore brand settings** 可恢复此前的设置。

**Source details and individual choices** 显示读取到的内容、检测到的字体名称，以及预览的文字/操作对比度。它还提供 **Choose individual items in the tray** 和 **Download design context**。JSON 报告带有观察结果、建议的令牌和来源信息；保存的 HTML/CSS 包含所提供文本的 SHA-256。它不包含原始页面文本，也不是一份签名的 Content Credential。字体名称只是建议：选择和安装字体的地方仍是 Type。

PDF 及其他设计文件的导入保留其现有的审阅控件。留在 **Tray** 中的项目不会改变任何内容，直到经由拥有该类素材的房间被添加。

`#/start?source=<kind>` 会在指定来源（`file`、`pdf`、`image`、`font`、`url`、`page`）上打开选择器，`?import` 则会打开纯列表视图。

## 在设备之间迁移品牌

侧边栏底部的 **Export** 写出单独一个 **`LollyBrand-….lolly`** - 你的令牌、字体、标志和主题偏好，并附带一份完整性清单，在重新导入时进行校验。1.0.7 之前的网页版把同一份内容命名为 `.zip`；这个旧版写法仍被接受。旁边的 **Tokens (.json)** 会单独写出纯设计令牌文档：不含字体，不含标志，只有令牌 - 这正是仓库、CI 步骤或其他令牌工具实际会读取的内容。

要将其导入回来,可使用 **从…添加 → 设计令牌或设计文件**(见上文),或直接拖放到工作室上。这是同事将品牌交给你,或你将品牌带到第二台设备安装的方式 - 无需账户,无需云端。若要改从命令行导入品牌,请参见 [`ingest:brand`](/info/configuration.html#brand-packs)。

## 恢复早期设置

在侧边栏底部选择 **Restore brand settings**，选取一个带日期的检查点，然后按 **Restore**。它会为当前品牌恢复颜色、字体设置和其他品牌令牌。字体和图片文件保持不变。

Lolly 会在应用检查点之前，把你当前的设置保存为 **Before restore**。选择那个检查点即可撤销这次恢复，即便在关闭并重新打开浏览器之后也是如此。这台设备上会保留最近 20 个检查点。如果无法读取存储空间，或无法保存当前设置，对话框会报告问题，以便你重试。

## 版本

边栏底部的 **Versions**(版本)面板,是设计系统不再是一个不断移动的目标的地方。发布一个版本,你就会得到一份保存在本设备上的**永久命名副本**:此后它永远不会改变,因此固定引用它的工具会一直绘制出同样的结果。该面板在你有自己的内容可以发布之前会保持隐藏,因此从不发布内容的工作室也就永远看不到这些控件。

在你按下任何按钮之前，有三件事需要了解，面板会在按下之前而不是之后说明这三点：

- **版本是永久的。** 目前还没有删除功能,因此面板只会说明哪些内容已被保留、并且会一直保留下去,而不是提供一个会说谎的按钮。
- **移除项排在兼容性卡片的最前面。** 新增和更改的令牌属于“新闻”;而*被移除*的令牌才是会破坏工具的那种变化,因此它会被排在最前面,并如实称呼它是什么。
- **发布无法撤销;恢复则可以。** *从此版本恢复到最新* 只是对头部的一次普通编辑,因此它会进入工作室的撤销栈,面板会立即为你提供 **Undo**(撤销)选项。

你可以**仅发布**，或**发布并设为活动版本** - 区别在于工具和应用今后是跟随该版本，还是继续跟随你最新的编辑。**再次跟随最新版本**会让每一次编辑一发生就立即上线。`#/start?area=versions` 可直接打开该面板。

## 品牌固定时

有些构建版本会附带**锁定的设计系统**，例如 SUSE Brand。打开它会看到一条只读说明，附有**编辑可复制**和**转换器**两个按钮。它原本的颜色、字体和令牌都保持不变。你自己的本地系统仍然可以编辑，即便锁定的系统是这台设备上的第一个。在 Profile 中，**打开**用来选择一个系统并打开它的工作室；**新建一个**会创建一个本地系统，并在 `#/start` 打开它，光标已定位在名称字段上。

## 接下来去哪里

- **[使用 Lolly](/info/using.html)** - 画布、保存、项目和素材。
- **[设计令牌](/info/design-tokens.html)** - 你的品牌所表达的令牌模型。
- **[导出与格式](/info/exporting.html)** - 印刷单位、CMYK 以及你的品牌可渲染成的格式。


## 查找并比较外观

从 Overview 或 Profile 上的设计系统列表打开 **Find a look**。浏览保存在这台设备上的系统，以及少量可复用的 Lolly 示例。按名称、颜色标签或声明的字体搜索。**Closest to my current palette** 按测得的颜色相似度排序，字体家族匹配时用于打破平局；这不是一个质量评分。

选中一个外观即可查看，选中两个即可比较。审阅按钮在小屏幕上依然可用。选中一个外观不会改变任何内容。**Use this saved system** 会在现有的设计系统列表中切换。**Use these colours** 会通过常规的检查点与安装流程应用一个示例，并保留当前字体。**Restore brand settings** 可以恢复此前的外观。

在 **Details and design context** 下，已保存的系统带有可编辑的 **Search tags** 和一个上下文下载。示例使用 Lolly 原创的配色方案；没有远程抓取的灵感库，也不需要账户。

![并排比较 Sunroom 和 Orchard，然后再决定采用哪一套配色系统。](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

比较会让两套调色板同时保持可见。查看一个外观不会改变任何内容，直到你选择 **Use these colours** 或 **Use this saved system**。

## 查看来源证据

来源审阅的可选详情会显示观察到的字体排印、间隙、内边距和圆角值。保存的 HTML/CSS 以及原生网站读取报告的是声明值，页面渲染时未必会用到它们。浏览器扩展可以从一个有限的可见元素样本中报告实测样式，并附带其视口和浏览器颜色偏好。较旧的扩展仍只能提供声明值。缺失的字段会显示 **Not observed**。

这些只是观察结果，不是自动的样式设置。参考扫描不会获取或安装字体文件，来源的间距也不会悄悄替换你自己的设置。计数描述的是样本中出现的次数，而不是置信度或质量。

## 对照设计系统检查一份作品

在 Design 中，打开 **Export**，然后打开 **Before you export**。这项检查使用与渲染相同的有效设计系统版本。它会比较作者设定的颜色、令牌别名、字体选择和图片素材 ID。自定义值可能是有意为之；一张不在声明品牌素材之内的图片是一个待复核项，而不是一张被禁止的图片。

当存在具体的颜色或字体建议时，其按钮只会更改那一个图层。普通的 **Undo** 会恢复原始值。已锁定或已更改的图层不会被一个旧的建议覆盖。缺失的来源证据与匹配是分开呈现的。渲染后的对比度和文字排版由现有的常驻检查负责。渐变、效果、嵌套的工具内容、权利和主观质量不在品牌比较的评估范围内。检查不会阻止 Download。

## 在本地使用设计上下文

**Download design context** 包含令牌文档、已解析的颜色、声明的字体家族、素材 ID、记录在案的来源证据、覆盖范围和明确规则。它不包含字体文件或所有权证明。参考审阅还会包含其建议的令牌和观察结果。

CLI 可以在不连接服务器的情况下读取这两种下载内容：

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` 接受带有 `boxes` 数组的 Design 输入，或一份已编译的 Design 文档。它会报告建议的修复方案，而不会修改这份作品。它无法测量浏览器布局或渲染后的对比度。现有的 MCP 资源 **lolly://design-context** 通过已配置的本地 MCP 进程公开当前有效系统的上下文；不需要新的托管服务或 API 密钥。
