# 使用 Lolly

你打开了 Lolly，想做点东西，把它保存下来再发出去。本页带你走完这个循环：打开工具，更改它允许你更改的内容，保存结果，并以链接或文件的形式分享。

这里的一切都在你的设备上运行，无需账号，并且在你需要的工具和素材下载完成后可以继续离线使用。应用需要支持 WebGPU 的浏览器或应用才能启动；[支持的环境](/info/supported-environments.html)列出了经过测试的环境。

## 熟悉环境

::: figure using-app-map
主屏幕：顶部有四个标签页，底部有一条栏。工具一旦打开，其控制项会显示在实时预览旁边。
:::

主屏幕顶部有四个标签页：**Tools**、**Utilities**、**Assets** 和 **Projects**。Tools 是用来制作的工具，Utilities 是处理转换、检查或清理文件等事务的工作台，Assets 是你的素材库，Projects 保存你存下来的内容。

底部栏包含 **Open**、**Settings**、一个搜索框、**Verify** 和 **What?**。它显示在 Tools、Utilities、Assets、Projects、Settings 以及你在应用中阅读的指南上，工具打开后则会让位。[搜索](/info/search.html)可以通过该输入框找到你的工具、已保存的作品、素材和设置。[Ask Lolly](/info/ask.html) 会用这些指南中匹配的章节回答你输入的问题。

点击卡片，即可在该工具中开始新的内容。已保存的作品则从 **Projects** 重新打开。

![一张工具库卡片，展示了导航示例和“新建”操作](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

每个工具都是分栏视图：一侧是**控制项**，另一侧是实时**预览**。更改一个控制项，预览立即跟着变化，所见即所导出。

![某工具的分栏视图——左侧是控制面板堆栈,右侧是它实时绘制的分组柱状图](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** 是个例外。它打开为一块自由画布，上面是可以拖动、缩放和输入文字的方框，并有自己的顶部栏、时间线和演示控制项。[Design：自由画布](/info/design.html)是它的指南。

## 更改工具允许你更改的内容

工具只显示打算让你改变的输入项。作者已经固定了颜色、版面、字体和逻辑，所以你做的一切都遵守他们的规则。输入项包括文字、滑块、取色器、下拉菜单、日期、图片选择器和重复的行组，有些位于可折叠的分区中。

![工具的控件栏——一个文本框、几个颜色触发器和一个滑块，作者选择锁定的其余内容都不在这里](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**点击设计即可找到它的控制项。** 点击预览中的任意元素，对应的控制项就会获得焦点并滚动到视野内。在重复的行组中，你点击的那一行会展开。

控制项上方的 **Clear changes** 会把每个输入项恢复为默认值。

**设计系统选项。** 当你的设计系统提供多种配色方案、浅色和深色外观或其他主题选择时，控制项下方的 **Design system** 分区会容纳它们。只有当某个选项会改变这个工具时才会出现，所以文件实用工具根本不显示这个分区。每种配色方案是一个用其自身颜色绘制的圆点，浅色和深色是两个按钮，其他选项则是一个列表。

这个选择属于当前这件作品。它随链接和已保存的会话一起传递，所有关联到设计系统的颜色都会跟随它，而应用自己的颜色保持不变。Design 在检查器的 **Canvas** 标签页中显示同样的选项。颜色本身就是内容的工具可以保持在标准配色方案上，这时它不提供配色方案圆点。[实际使用 Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work)展示了真实作品上的配色方案。

### 缩放和平移预览

预览始终精确显示导出后的结果。

- **缩放：** Cmd/Ctrl 加滚动，或在触控板上双指捏合，以指针为中心。在键盘上，`0` 或 `Shift+1` 适应全部内容，`1` 或 `Shift+0` 设为 100%，`Shift+2` 适应选区。指针在编辑区域上方时，`+` / `−` 以指针为中心缩放，否则以视图中心缩放。
- **平移：** 按住 **Space** 并拖动，或用鼠标中键拖动。普通点击仍可用于点击设计的各个部分。
- **触摸：** 双指捏合缩放，拖动平移，双击适应窗口。
- **缩放 HUD：** 按住角落里的 Lolly 旋涡标志，展开 `−`、**Fit** 和 `+`。短按旋涡标志仍会打开你的个人资料菜单。

在 Design 中，**Fit all** 包括画板和独立图层。手动缩小可以低于 20%，直到整个页面占据视图的一半。最低限度取普通 Fit 比例的 5% 与绝对缩放比例 2% 中较小的值。

更改输出尺寸总会让视图恢复到整洁的适应状态。

![从画布角落的旋涡标志展开的缩放 HUD：减号、Fit、加号，然后是主题和声音开关，以及用来移动它的拖柄](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### 撤销与重做

**Cmd/Ctrl-Z** 后退一步，**Cmd/Ctrl-Shift-Z**（或 **Cmd/Ctrl-Y**）前进一步。同一对操作也以 **Undo** 和 **Redo** 按钮的形式位于控制项上方（在 Design 中位于顶部栏），没有可撤回的内容时各自变灰。一条消息会说明每次撤销恢复了哪个输入项，消息中带有 **Redo** 按钮。

- **一次拖动算一步。** 半秒内对同一控制项的重复更改会合并，所以把滑块拉过整个范围只算一次撤销。
- **保留最近 100 步。** 撤销后做出新的编辑会清除前进栈。
- **在文本框中**，Cmd/Ctrl-Z 属于该输入框，逐字符撤销。滑块、下拉菜单、颜色和开关则由 Lolly 接管。
- **选择文件**（文件输入项）不算一步，因为这些字节只在本次会话中保留。

在实时[协作](/info/collaborate.html)中，你的历史只属于你：来自另一台设备的更改绝不会进入你的栈。撤销会持续到你离开工具或重新加载为止。对于更早的内容，边做边保存的工具会在 **History** 下保留更早的版本；参见[回到更早的版本](/info/find-your-work.html#go-back-to-an-earlier-version)。

### 实时摄像头

**Filter** 工具的效果（Halftone、Scanline、Posterize、Voronoi、Duotone、Stretch、Misprint、Dither、ASCII art 和 Glitch）在有摄像头的地方会显示 **Go live** 按钮。开启后，效果会逐帧跟随你的网络摄像头，动态导出会把结果录制为 GIF、WebM 或 MP4。帧在你的设备上处理，你一停止或离开工具，摄像头就会立即释放。任何图片选择器也都有 **Take a photo**，用于单帧。

## 保存与继续

要保留你的作品，请按 **Save**，即渲染按钮上 **Export** 旁边的对勾。新作品进入 **My library**，之前保存的作品就地更新，不会下载任何内容。导出面板中有同样的 **Save** 按钮。

要选择存放位置，请按导出面板中 **Download** 旁边的 **Save as**。在 **Save to a project** 下，保持选中 **My library** 或选择一个项目（**＋ New project…** 可新建），然后按 **Save**；**Save as a template** 会把设计保存为[模板](/info/templates.html)，作为新文档的起点。在 Design 中，**Save as** 位于 Lolly 菜单；在手机上，依次按 **•••**、**File menu**、**Save as**。

![分成两半的渲染按钮：Export，带向上箭头，打开导出面板；Save，带对勾，就地保存](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> 按渲染按钮上的 **Save**，或按 **Save as** 选择一个项目。
- <!--i:folder--> 该项目进入 **My library**，或你选择的项目。
- <!--i:home--> 之后，按左上角的 **Home**，打开 **Projects** 标签页。
- <!--i:document--> 打开该项目。所有设置都回来了，可以更改并再次导出。
:::

项目以你在导出面板中输入的文件名命名，否则以其工具命名，例如 **QR Code**。通过 **Download** 得到的文件是成品副本；以后要更改，请在 Projects 中打开已保存的项目。

个人保存的内容留在这台设备上，也就是你保存时所用的浏览器或应用中，除非你开启[同步](/info/sync.html)。如果某样东西不在你预期的位置，[查找和恢复你的作品](/info/find-your-work.html)涵盖了所有情况，从关闭的标签页到被清除的浏览器数据。

::: details 使用 Lolly Work 的团队项目（可选）
如果你的[组织使用 Lolly Work](/info/organisation.html)，请登录其实例，打开 **Projects → Team projects** 查看与你共享的会话。访问和保留由组织设定，其 Lolly Work 服务存储这些会话。当你的组织允许实时编辑时，共享会话在打开时就会加入其实时协作；[一起工作](/info/collaborate.html#work-collabs-with-lolly-work-optional)说明了具体步骤。

你的个人库保持独立。在另一台设备上登录能让你得到团队的作品，而个人保存的内容仍需要同步或备份才能跨设备移动。
:::

## 分享你的作品

设计可以链接或文件的形式发出。导出控制项中的 **Share** 会打开一个同时提供两者的对话框，Projects 中已保存会话上的 **Share link** 则会为该会话打开同一个对话框。

::: cols
## 链接

- 地址中携带每个输入项，所以链接可以复现设计。
- 不包含你从这台设备添加的图片和文件、特别长的文字和特别大的列表。
- 在任何浏览器中都能打开，因此你可以收藏、粘贴或提交这个链接。

## .lolly 文件

- 携带已保存的会话以及这台设备上的图片和文件，还可以携带工具和设计系统。
- 除非你选择包含这些文件，否则会扣留有许可协议限制的目录素材。
- 在 Lolly 中打开：双击它，使用 **Open**，或把它拖到应用上。
:::

### 链接

可直接复制的链接位于对话框顶部，旁边有 **Copy** 和一个用链接打开 QR Code 工具的 **QR** 按钮。链接下方的 **Link options** 包含：

- **Open in the installed app** 会把链接切换为 `lolly://` 地址，供快捷指令、启动器和自动化使用，所有参数保持不变。
- **Shortest link** 会把较长的设计压缩成紧凑的令牌，并显示节省的字符数。可读形式也始终存在。
- **Password-protect this link** 在你的设备上用 AES-256 加密链接。密码绝不会成为链接的一部分。
- **Pin this tool version** 添加 `_v` 标记，这样以后工具更新就不会改变链接渲染的结果。
- **When the recipient opens the link…** 可选择全屏、已展开的导出面板、打开时下载（`&export`）或复制到剪贴板（`&copy`）。
- **Copy credit** 复制一条带链接的 “Made with Lolly” 说明，用于帖子或幻灯片。

当工具包含个人字段（例如你的姓名）时，**Review personal fields** 会让每个字段都不进入链接，直到你勾选该字段。[URL 模式](/info/url-mode.html)涵盖了链接可以携带的一切。

**对话框会说明链接无法携带什么。** 你从这台设备添加的图片或文件、特别长的文字值和特别大的列表，都放不进地址里。构建链接时会逐一计数。如果有任何内容不得不被舍弃，对话框会列出它们，并引导你使用文件选项，而不是给你一个打开后缺少图片的链接。只是比较长的链接，则会得到一条较轻的提示，并附上字符数。

**有些工具让链接成为整个产品。** Jump Page 把你的链接汇集成一个页面来分发：个人简介链接、一场演讲、一个店铺门面。不托管任何内容，页面背后也没有账号，因为页面本身就是链接。访客看到的是全宽页面，滚动时每个场景一个链接。

![编辑器中的 Jump Page：页面顶部是标题场景，下方是链接场景](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Lolly Work 的组织受管理链接
对于需要有效期、撤销或密码的分享，Lolly Work 为共享会话、工具和目录素材提供受管理的链接。它们通过组织的服务解析，并遵循其访问规则。它们与上面自包含的链接是分开的，撤销一个链接无法召回别人已经下载的文件。[渲染与分享](/info/manage/sharing.html)列出了链接类型和权限。
:::

### .lolly 文件

分享对话框 **Editable file** 部分中的 **Download .lolly** 会把当前设计写成一个文件。它携带已保存的会话以及这台设备上的图片和文件，普通目录素材也会随附。过时或不可用的文件仍作为外部引用保留，而不是消失。保存前，对话框会显示文件大小、嵌入多少个文件、引用多少个文件以及是否包含工具。在你的设备有分享面板的地方，**Send to…** 会把文件直接交给它（AirDrop、Android 分享）。

**Projects** 中文件夹菜单里的 **Download project (.lolly)** 会写入整个文件夹，让别人可以接着处理文件夹中的每个会话。批量会话不包含在内，提示会说明有多少个。同一菜单里的 **Download originals** 会写出一个普通的 zip，其中每个项目作为独立文件。

文件发出之前，有三件事由你决定：

- **是否写入你的姓名。** 只有在[你的个人资料](/info/profile.html)中开启 **Use my details to create** 时，才会写入你的姓名、电子邮件和组织。关闭后，文件只记录它是用 Lolly 制作的，以及制作时间。
- **是否包含被扣留的素材。** 有许可协议限制的素材、被品牌锁定的素材，以及从未记录过许可协议的目录作品，默认不包含。如果设计用到其中任何一项，对话框会说明数量，并提供 *Download without them* 或 *Include and download*，因为包含它们就等于把这些文件交给打开 `.lolly` 的人。文件的 `CREDITS.txt` 会列出哪些随文件传出、哪些没有，并说明原因；[创作版权与署名](/info/creative-rights.html)解释了规则。
- **是否包含工具。** **Include the tool** 会打包工具自己的文件，这样设计可以在没有该工具的设备上打开。对于自定义工具（例如分支版本），它默认勾选；对于已签名目录中列出的工具，它默认不勾选。在没有已签名目录的构建版本中，每个工具都算自定义工具。

**打开一个文件。** 在桌面和移动应用中，双击或点按 `.lolly`，选择 **Open with Lolly**，或通过分享面板把它发送到 Lolly。在网页应用中，按 **Open** 或把文件拖到 Lolly 上。每条途径都会先读取文件的清单，在写入任何内容之前显示其大小、内容和将要发生的事。

如果文件携带了你没有的工具，**Trust this tool?** 会显示该工具及其作者，并说明打开它会在你的设备上运行该工具自己的代码。**Trust & install** 会继续。拒绝的话，作品仍会保存到 Projects，等你日后添加该工具。代码以模块形式提供的工具暂时无法用这种方式安装，也会以同样的方式被拒绝。

::: details .lolly 包含什么，以及打开一个 .lolly 的方式
`.lolly` 是 Lolly 的打包扩展名，其 `manifest.json` 中的 `format` 说明里面是什么：

- **共享设计**（`lolly-share`）包含一个已保存的会话、其嵌入的文件，以及对仍按引用解析的任何内容的回执。它还可以携带工具和设计系统。打开它会新增一个 Project，绝不会覆盖会话。
- **共享项目**（`lolly-share`，类型为 `project`）包含 Projects 中的一个文件夹：其子文件夹、其中每个会话及其方块，以及归档在那里的图片。打开它会添加整个文件夹的副本。每个会话以 `sessions/<key>.json` 传递，其方块位于 `thumbs/` 下。在项目文件出现之前的 Lolly 版本会要求你更新。
- **设计系统包**（`lolly-brand`）包含令牌，还可以包含字体、徽标、已发布的版本和保留的资源。打开该包会添加一个独立命名的设计系统，并使其成为当前使用的设计系统。
- **工作区或实例包**是一个带有声明的工具、目录素材，也可以带实例地址的 `lolly-brand`。加载一个会替换此前加载的唯一的工作区覆盖层，预览会列出这些设备范围内的影响。

完整的设备备份不是 `.lolly`。它仍是 `LollyTools-….zip`（格式为 `lolly-backup`），通过 **Settings → Storage → Import data…** 还原。压缩的工具文件夹也仍是 `.zip`。[数据迁移](/info/data-transfer.html)是格式参考。

`.lolly` 就是普通的 zip。把它重命名为 `.zip` 就能查看里面：你自己的图片在 `assets/uploads/` 下，目录素材在 `assets/catalog/` 下，`manifest.json` 列出每个文件，还有一个 README 说明这个文件是什么。

macOS、Windows、Linux、iOS 和 Android 都会注册该格式，桌面文件管理器会把它显示为 Lolly 文档，GNOME Files 可以显示已保存会话自己的缩略图。当共享设计带有设计系统操作时，从 Design System Setup 打开会推荐该设计系统操作，但绝不会隐藏 **Open shared design**。

在 iOS 或 Android 上从另一个应用交给 Lolly 的文档上限为 48 MB，因为交接会把其字节复制到应用边界另一侧，应用也会这样告知。Lolly 内部的 **Open** 没有这样的上限，所以较大的包请用它。

你确认后，Lolly 会展开并验证一次该包。素材进入你的库，按校验和匹配，所以设备上已有的文件会被复用。会话以新 ID 进入 Projects，所以同一个文件可以打开两次；工具缺失的会话会在那里等待。超过 100 MB 的文件会被标注为大文件，当浏览器存储报告的剩余空间少于文件所需时，预览会发出警告。在提交任何内容之前，每个受完整性覆盖的部分都会被检查，损坏的副本会被拒绝，不会留下任何东西。
:::

链接和文件交出的都是快照。若要实时编辑，[一起工作](/info/collaborate.html)介绍了两台设备之间的私密协作，以及通过 Lolly Work 的可选工作协作。

## 素材 - 你的素材库

**Assets**（`#/a`）汇集了你的工具可以使用的一切：品牌徽标、图片、音频和动态，按类型分组，另有你自己的文件。你的上传存放在你的设备上。使用 Lolly Work 的组织还可以在自己的访问规则下提供共享目录；参见[在你的组织中使用 Lolly](/info/organisation.html)。

![素材 - 品牌的色板与字体，以及你自己上传的内容](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **导入你的文件。** 把图片、SVG、音频片段、视频、Lottie、PDF 或 PowerPoint 演示稿拖到上传区，或点击选择。它会立即出现在 Assets 以及每个工具的素材选择器中。多页 PDF 或 `.pptx` 会询问保留哪些页面或幻灯片，每一页都会成为一个 SVG 素材。你在工具内添加的图片会按原样保存在 **My images** 中，所以其上的 Content Credential 仍可验证，只有特别大的文件才会询问是否缩小尺寸。**Settings → Storage** 会显示 **My images** 占用了多少。除设备存储外没有其他上限。若要在图片导入时清除 EXIF 和 GPS 数据，请在 **Settings → Feature flags** 下开启 **Strip metadata from uploads**；无论开启与否，Content Credentials 都会保留。
- <!--i:star--> **收藏你常用的。** 给素材或品牌色板加星，它就会固定在每个选择器的顶部。
- <!--i:folder--> **整理。** 把素材移到另一组，隐藏你不用的共享品牌素材（**Show hidden** 可以让它回来），或删除你自己的上传。与 Projects 相同的选择栏可以作用于整个选区。
- <!--i:layers--> **把视频从背景中抠出来。** 打开视频的详情，或在素材选择器中右键点击它的卡片，选择 **Remove background…**。**On-device model** 可以从杂乱的场景中抠出主体；**Colour key** 可以去除光线均匀的背景，例如绿幕，并提供 **Tolerance**、**Softness** 和 **Spill removal** 来处理边缘，无需下载。**Resolution**（360、480、720 或 1080p，绝不超过源）在细节与速度之间取舍。抠出的结果是带真实透明度的动画 WebP 或 PNG，保存在原文件旁边，源文件的 Content Credential 作为素材来源随之保留。[一次生成，渲染一致](/info/ai-features.html)解释了为什么这仍然只是一次普通的编辑。

### 把你的调色板和字体带到任何地方

Assets 中的 **Swatches** 面板显示构成你品牌的颜色：品牌色、你添加的颜色、它的渐变色阶和色谱。Lolly 为界面保留的角色颜色（文字、表面、边缘、配色方案主色，以及以另一个名称保存的品牌色副本）收在面板底部灰色的 **Show colour roles** 卡片之后。

每种颜色都是一张和其他素材一样的卡片。点击一个可打开其详情，选择几个可只下载这些，或者以你其他工具能读取的格式下载整个调色板：

- <!--i:code--> **Design tokens (JSON)**、**CSS variables** 或 **CSS classes**，用于样式表或构建。比 sRGB 更宽的颜色会保留其宽色域值：CSS 在十六进制值之后设置它，JSON 则在保留十六进制值的同时附上宽色域颜色、CMYK 配方和专色油墨。
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**，用于 Illustrator 或 Photoshop。锁定为 CMYK 配方的颜色会作为该 CMYK 色板到达，专色油墨作为命名的专色色板，比 sRGB 更宽的颜色则作为 Lab。
- <!--i:pentool--> **GIMP palette (.gpl)**，用于 GIMP 或 Inkscape，以及 **SCSS variables**，两者都是 sRGB。

![Swatches 面板：顶部是五个调色板下载按钮，下面每种品牌色都是一个可打开其详情的色块](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

用每张卡片上的圆点选择颜色：按住 Shift 点击第二个圆点可选中两者之间的所有颜色，拖出选框可框住中间的空隙，或在卡片获得焦点时按 Cmd/Ctrl+A。栏中提供 **Download as…**（同样是这六种格式）、**Copy hex** 和 **Favourite**。在你选择格式之前，菜单会列出任何没有格式能容纳的颜色（Transparent 根本没有颜色）、哪些格式会把宽色域颜色保存为其 sRGB 回退值（SCSS 和 GIMP），以及哪些格式带有 CMYK 和专色值（JSON 和 .ase）。右键点击卡片，可对单个颜色执行同样的操作。

颜色的详情会用该颜色填满预览，并展开 **Linked values**（其 CMYK 配方或专色油墨、为特定色彩空间或印刷机设定的任何值，以及它的设计令牌）、**Every notation**（十六进制、OKLCH、Display-P3 等，每个都带复制按钮）、**Plotted on a colour space**、**Tones** 和 **Readability**。方向键可以在调色板中逐个切换，**Copy link** 分享颜色本身，**Open in Colour Lab** 带你进一步深入。

**Fonts** 面板列出你的品牌字体，每个都带有 **download**，可以安装到本地或交给印刷厂。

## 让网格按你的方式呈现

- <!--i:star--> **收藏你常用的。** 右键点击卡片并选择 **Add to favourites**，它就会在网格上方的一条带中得到一个大方块。[你的收藏](/info/favourites.html)介绍了这条带。
- <!--i:eyeoff--> **隐藏你从不使用的工具。** 右键点击卡片，或选择多个，然后选择 **Hide tool**。它会从网格中消失，也不会出现在网格中输入时的搜索结果里。末尾灰色的 **Show hidden tools (N)** 方块可以把它们重新显示出来，呈暗淡状态，每个的菜单中都有 **Unhide tool**。隐藏只会改变你的网格：该工具仍可从链接或书签打开。
- <!--i:clock--> **你的工具优先。** 当你在三个不同的工具中保存过作品后，网格上方会出现一行 **Yours** 色块，以你的收藏和最近使用的工具打头。
- <!--i:sliders--> **按你的方式布局。** **View options** 设置布局（**Grid**、**Card** 或 **List**）、卡片大小和密度、排序方式和分类筛选。

![Tools 网格的末尾，已显示隐藏的工具：变暗的 Wordmark 卡片，以及旁边那个把它切换回视野的灰色方块，现在显示为 Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**一次对多张卡片操作。** 勾选每张卡片的复选框，在空白处拖出选框，或按 Shift/Cmd 点击，就会出现一条栏，提供该视图允许的操作：

- **Tools 和 Utilities：** Favourite、Hide、Available offline、**View sessions**（Projects，只显示用这些工具创建的会话），以及单张卡片的 Copy link。
- **Assets：** 任何选区都可 Favourite 和 Hide。只有当所选的每一项都是你自己的上传时，才会出现 Duplicate、Download 和 Delete，因为共享的设计系统素材是永久性约定。
- **Projects：** 参见[查找和恢复你的作品](/info/find-your-work.html#find-something-you-saved)。

![两个工具被选中时的工具库选择栏，提供可离线使用、查看会话、收藏和隐藏](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** 只有在选中某项之后才会出现。如果右键点击单张未选中的卡片，它会提供 **N saved sessions**，即该工具已保存会话的列表，其中的删除会把会话移入回收站。

## 在手机上

在窄屏上，布局会变成单列：

- **控制项变成顶部的一张面板**，其下边缘有一个拖动把手。拖动把手可以吸附到 **peek**、**half** 或 **full**，或点按它来折叠和展开。预览填满下方的空间，并在你编辑时保持可见。
- 浮动的 **Export** 按钮会打开导出面板：格式、尺寸、复制、保存和下载都在一处。点按背景可关闭面板。

![手机宽度屏幕上的一个工具——顶部是面板形式的控件，下方预览中是生成的调色板，渲染胶囊按钮浮在底部中央](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## 设置、声音和舒适度

主屏幕底部的 **Settings** 包含你的详细信息、设计系统、无障碍、存储和离线下载。[设置](/info/dashboard.html)梳理了每个标签页。

- **你的详细信息和头像**会填入任何设计为使用它们的工具，例如电子邮件签名或证件。[个人资料](/info/profile.html)介绍了它们。
- **无障碍**有四个舒适度开关：**Reduce motion**、**Hide colourful previews**、**High contrast** 和 **Large text**。它们改变的是你作品周围的应用，绝不会改变工具画布或导出内容。
- **声音**会为你的操作播放柔和的辅助音效，**Neurospicy Mode** 会播放平静的专注曲目。两者在你开启之前都是关闭的，可在 **Settings → Accessibility** 或个人资料菜单中开启。
- **Available offline** 会在你失去连接之前下载应用的其余部分、你的工具、目录和指南。Lolly 是可以安装的网页应用：使用浏览器的安装按钮，或在手机上使用 *Add to Home Screen*，就能得到一个全屏应用，在你重新联网时自动更新。
- **Storage** 显示 Lolly 在这台设备上保存的内容。[如果你清除了浏览器数据](/info/find-your-work.html#if-you-clear-your-browser-data)解释了清除会移除什么，[隐私政策](/info/privacy.html)则列出了应用获取或发送的一切。

::: note 如果更新后某个视图无法加载
更新后立刻出现空白面板或 “failed to fetch” 消息，通常重新加载一次就会消失。你已保存的作品、会话和设计系统不受影响，因为它们存储在你的设备上。只有你添加过但从未保存的图片可能需要重新添加。
:::

## 接下来去哪里

- **[Design：自由画布](/info/design.html)**：画布、形状、时间线和演示稿的演示。
- **[批量生成与多重编辑](/info/batch.html)**：同一个设计的多个版本，或同时编辑多个已保存的设计。
- **[导出文件](/info/exporting.html)**：选择格式、尺寸、印刷单位、透明度和视频。
- **[导入设计](/info/design-import.html)**：把 Figma、Penpot、Illustrator 或 InDesign 文件带入 Design 并继续编辑。
- **[模板](/info/templates.html)**：工具的已保存起点。
- **[广色域与 HDR](/info/hdr-editing.html)**：在 Design 和 Darkroom 中保持图像的原始精度。
- **[查找和恢复你的作品](/info/find-your-work.html)**：一切在哪里，以及如何把它迁移到另一台设备。
