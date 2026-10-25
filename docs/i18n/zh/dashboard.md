# 设置

Settings 是你更改 Lolly 如何为你工作的地方：你的详细信息、你使用的设计系统、无障碍、这台设备上存储了什么，以及哪些内容可离线使用。通过主屏幕底部栏中的 **Settings** 或你的头像菜单打开它。它默认打开 **Preferences**，旁边还有另外四个标签页。

| 标签页 | 地址 | 包含内容 |
|---|---|---|
| **Preferences** | `#/settings` | 你的详细信息、设计系统、外观、emoji、无障碍、连接、存储和离线下载 |
| **This device** | `#/settings?tab=device` | 这个浏览器和机器的实时读数，以及声音和只读的存储视图 |
| **Design system** | `#/settings?tab=brand` | 以封面和页面形式显示的当前设计系统，以及用于切换系统的封面条 |
| **Capabilities** | `#/settings?tab=caps` | Lolly 能做的一切，以可搜索卡片的形式呈现 |
| **Activity & stats** | `#/settings?tab=activity` | 目录、你的本地计数器和最近的作品 |

每个标签页都有自己的地址，旧的 `#/profile` 和 `#/d` 链接仍会打开正确的位置，精确到单项设置。

## Preferences

Preferences 是一个长页面，侧边有一条**设置栏**，栏上方的 **Search settings** 输入框会随你输入进行筛选。每个部分都可以通过形如 `#/settings?focus=<section-id>` 的链接直接打开，例如 `#/settings?focus=storage-section`。

- <!--i:usercheck--> **Your details** - 你的姓名、联系方式和头像，以及 **Use my details to create** 开关。[个人资料](/info/profile.html)解释了工具如何使用它们。
- <!--i:seal--> **Content Credentials** - 为你的导出签名的可选已验证身份。参见 [Content Credentials](/info/content-credentials-identity.html)。
- <!--i:palette--> **Design systems** - 切换、添加、隐藏或移除设计系统。[Design System Setup](/info/brand-studio.html#manage-your-design-systems) 介绍了每个操作。
- <!--i:moon--> **Appearance** - 主题（Light、Dark 或用你的调色板为应用着色的 Brand）和 **Interface follows the design system**。
- <!--i:sparkle--> **Emoji** - 你开始新作品时 emoji 所取自的集合及其素材许可协议，以及你的调色板为它们重新着色的强度（**Off**、**Subtle**、**Strong**、**Full**、**Mono** 或 **Duotone**）。**Keep skin tones and flags** 让这些保持自己的颜色。你已经完成的作品保留制作时所用的集合。
- <!--i:eyeoff--> **Accessibility** - 四个舒适度开关，外加 Sound 和 Neurospicy Mode。参见[无障碍](#accessibility)。
- <!--i:link--> **Connected services** - 你连接的存储，例如 Dropbox、Google Drive、OneDrive、Nextcloud 或 S3，以及 **Sync across devices**。参见[同步你的设备](/info/sync.html)。
- <!--i:globe--> **Trusted sites** - Design 网页方框或 Sandbox 演示可以不经询问就联系的网站，以及在服务器提供时的 **Allow pages from any site**。[隐私政策](/info/privacy.html)列出了每个请求发送的内容。
- <!--i:download--> **Your renders** - **Save my renders to my library** 会把你下载的每张图片、音频片段和视频的副本保存在 Assets 中，带有 Renders 标签。
- <!--i:database--> **Storage** - Lolly 在这台设备上保存的内容，以及清除或携带你的数据的按钮。参见[存储](#storage)。
- <!--i:cpu--> **Available offline** - 在失去连接之前下载你需要的内容。参见[离线可用](#available-offline)。
- <!--i:folder--> **Hot folder** - 在桌面应用中监视一个文件夹，并把丢入其中的任何内容通过与拖放相同的选择器拉入 Lolly。
- <!--i:clock--> **Your activity** - 你在这台设备上制作了什么，在本地统计。
- <!--i:sliders--> **Feature flags** - 开启或关闭应用的部分功能，例如 **Print preflight** 或 **Strip metadata from uploads**。
- <!--i:server--> **Lolly instance** - 这次安装从哪里获取工具和目录。参见 [Lolly instance](#lolly-instance)。

主题卡片是实时预览，选中的瞬间就会应用，仅限这台设备。

![三张主题卡片,各自预览自身的字体和颜色,当前使用的那张会被标出](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### 无障碍

**Settings → Preferences → Accessibility** 包含围绕你的作品的应用的四项舒适度设置。每一项在你开启之前都是关闭的，没有任何一项会作用到工具画布或导出内容里面，所以更平静的应用绝不会移动你所交付文件的一个像素。

- <!--i:pause--> **Reduce motion** 关闭应用的过渡、滑动和装饰动画。你的画布和任何动画导出仍按设计运动。
- <!--i:photos--> **Hide colourful previews** 把图库的预览图换成平静的图标加文字卡片，并让项目缩略图安静下来，使它们仍然可辨认而不喧闹。
- <!--i:sliders--> **High contrast** 加强应用的边框、文字和焦点环。你的品牌颜色和画布保持你设定的样子。
- <!--i:font--> **Large text** 放大应用的标签、菜单和按钮文字。你设计内部的文字不受影响，所以你导出的内容不会重新排版。

这些设置保存在你的个人资料上，所以它们随个人资料导出一起传递，并连同你的姓名和会话一起到达下一次安装。一小份仅限设备的副本会在首次绘制之前应用它们。

同一张卡片还包含 **Sound**，为你的操作提供一层柔和的辅助音效（进入图库、Content Credentials 结果、关闭面板），以及 **Neurospicy Mode**，一首平静的专注曲目。开启 Neurospicy 会在角落打开一个小播放器，并在整个应用中跟随你。在那里你可以选择曲目、跳过、设置音量，以及最小化或关闭播放器。曲目包括程序化的 *Lolly Sings* 曲调、环境循环和节拍、你自己的音频，以及需要联网的网络电台。两者默认都是关闭的，并且会被记住，关闭 Sound 也会让专注曲目静音。个人资料菜单和 **This device** 带有同样的开关。

界面可以用键盘导航，自定义控制项带有供屏幕阅读器使用的标签，每个工具的实时预览都作为一张带标签的图片暴露出来，描述它显示的内容。

### 存储

存储计量表按类别逐一统计这次安装持有的每一个字节，并与浏览器报告的数值对照。

![存储计量表，把已保存的会话、图片和缓存分项列出，并与浏览器实际报告的数值对照](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

计量表下方：

- **Move to another device** 包含 **Export my data**、**Import data…** 和 **Export my data & render everything**。[把你的作品迁移到另一台设备](/info/find-your-work.html#move-your-work-to-another-device)逐一介绍了它们。
- **Clear cache** 会清除已下载的目录文件，需要时它们会再次下载。
- **Remove automatic checkpoints older than 30 days** 会释放 History 空间，并保留已保存和已命名的版本。
- **Clear all my data** 会在你输入一个词确认后，移除 Lolly 在这个浏览器中保存的一切。[如果你清除了浏览器数据](/info/find-your-work.html#if-you-clear-your-browser-data)列出了会丢失什么。

### 离线可用

Lolly 会在你访问时缓存界面，但这只涵盖你已经去过的地方。**Available offline** 适用于你能预见的行程：下载你将需要的部分，看着一条进度条，你带走的一切在没有网络时都能继续工作。

- <!--i:monitor--> **App, catalogue and guides** - **The app**（每个视图、编辑器和字体，包括你从未打开过的界面）、**Catalogue**（全部，或 **Choose by tag**）以及 **Guides & docs**（你所用语言的本文档，包括截图）。
- <!--i:cpu--> **AI models** - 每个设备端模型各占一行并标有大小：Speech voices、Upscaling models、Background removal、Text recognition、Verify deep scan、Durable credential、Rewriter model、Ask matching model、AI text detector 和 Singing voices。超过 50 MB 的模型会标记为 **large download**。
- <!--i:wrench--> **Tools** - 每个工具单独下载，或用 **Download all** 获取所有工具。打钩表示已可离线使用。

顶部的 **Download everything** 会获取应用、你选择的目录范围、指南和所有工具。勾选 **Include all the AI models** 可加入模型，也可以在模型自己的那一行下载；歌声只能从其自己的那一行下载。组织的政策可以关闭 AI 下载，此时这些行会告诉你。

如果你取消或失去连接，下载会从中断处恢复，并在你重新联网时自动刷新，只获取某个版本更改过的内容。如果浏览器没有授予持久存储，**Protect downloads** 会请求它：这就是“已下载”与“已下载，直到浏览器要收回空间”之间的区别。

### Lolly instance

**Lolly instance** 说明这次安装从哪里获取工具和目录：某个实例的地址，或者当一切都内置在构建中时显示 *Bundled with this app*。

- **Design-system source** 显示所提供的设计系统来自哪里。
- **Instance console** 打开部署的管理页面（如果部署提供的话）。
- **Change** 让桌面应用指向另一个实例。浏览器无法跨源加载工具和素材，所以在网页上该部分提供 **Open a workspace**。
- **Leave** 会移除该实例的设计系统、工具和目录，你自己的作品保留。参见[在你的组织中使用 Lolly](/info/organisation.html#leaving)。
- 当你登录到某个组织时，**Sign out** 结束本次会话，**Sign out everywhere** 结束你在每台设备（包括这一台）上的会话。

## This device

- <!--i:monitor--> **This Machine** - 屏幕、输入、图形、内存、编解码器、存储后端等，从当前会话实时读取。不存储任何内容，也不发送任何内容。在宽屏上它会自动展开，这时该标签页以两列排布。
- <!--i:neurobeat--> **Sound** - 界面音效和 Neurospicy 专注循环，是该标签页上唯一会写入任何内容的开关。
- <!--i:database--> **Storage** - [Preferences](#storage) 中计量表的只读视图，清除或携带你的数据要在那里进行。

## Design system

当前的设计系统，排版得便于阅读。当这个浏览器持有两个或更多设计系统时，顶部的一条小封面条会列出它们：选择一个使其成为当前系统，随后通知中的 **Undo** 会恢复之前的那个。

![Lolly Demo 上的 Design system 标签页：用于切换系统的封面条，然后是带有徽标、名称、说明和可打开各页面的计数的封面](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

该标签页以一张用系统自己的颜色绘制的封面打开，上面有它的徽标、以展示字体书写的名称，以及其作者写的说明。封面上的一行计数链接到每个页面：

- <!--i:palette--> **Colour** - 浅色和深色外观的表面、文字、主色和次色，每个命名颜色都是带名称和十六进制值的色块，每条色调渐变各占一条带，图表色谱，以及折叠中的颜色角色。选择一个值即可复制十六进制值。
- <!--i:font--> **Type** - Headings、Text、Emphasis 和 Code，各自使用自己的字体书写。
- <!--i:photos--> **Logos** - 每个徽标文件，放在它所设计的底色上。
- <!--i:layers--> **Colourways** - 当系统有多个配色方案时，每种配色方案的浅色与深色一对。
- <!--i:sliders--> **Tokens** - 圆角、间距、效果和渐变。
- <!--i:document--> **Print & CMYK** - 锁定为确切油墨的颜色，以及 CMYK PDF 可以声明的印刷条件。

切换是这个标签页唯一会做的更改。你在 `#/start` 的 [Design System Setup](/info/brand-studio.html) 中编辑设计系统，封面链接到那里。只读系统会在封面上注明；你创建的本地系统保持可编辑。`/b` 和 `/brand` 是直达这个标签页的短链接。

## Capabilities

平台的每个部分都写成一张卡片，分为十二组：Experiences、Platforms & runtimes、Accessibility & languages、Export formats、Import formats、Print production、Automation & AI、Determinism & reproducibility、Brand & design system、Privacy & data ownership、Security & access control 和 Architecture (for builders)。每一组都可以折叠，并显示其卡片数量。卡片会展开为一个对话框，列出该能力的功能，其中约一半还附有本文档使用的截图。

各组上方的搜索框会随你输入筛选卡片，并展开仍有匹配项的各组。它会说明正在搜索多少项能力，没有匹配的查询则会用文字说明。

这个标签页是对 Lolly 能做什么的书面文档，与这些指南保持同步。它不会探测你所用的机器；那是 **This device** 的工作。

## Activity & stats

先是构建本身：加载了多少工具、有多少导出格式、平台运行在多少个界面上，以及目录携带了多少品牌素材，另有一个 **Catalogue** 面板，分项说明这个构建中附带的内容。

然后是你自己这一侧：**Your activity** 统计你在这台设备上制作了什么，**Recent creations** 和 **Latest exports** 是可以滑动浏览的堆叠，各自在有内容可显示时才出现。两者都会按原样打开某个项目。这些计数器留在设备上；可选的 Lolly Work 实例保存自己的[组织遥测和审计记录](/info/privacy.html#organisation-services-with-lolly-work)。

## 深度链接

Settings 的每个标签页和部分都有自己的链接，你可以收藏或粘贴。[搜索](/info/search.html)把其 **Settings** 结果指向与 Settings 渲染所用的同一份注册表，所以某个部分不会在搜索结果底下被改名。

::: details 链接的所有形式

- **一个标签页：**`#/settings?tab=brand`、`#/settings?tab=caps`、`#/settings?tab=device`、`#/settings?tab=activity`。
- **一个 Preferences 部分：**`#/settings?focus=<section-id>`，例如 `#/settings?focus=offline-section`。
- **精确指向一个部分：**将其 ID 作为裸标志，例如 `#/settings?dash-storage`、`#/settings?dash-logos`、`#/settings?dash-colourways` 或 `#/settings?cap-formats`。较旧的 `#/settings?dash-lock` 和 `#/settings?dash-palette-wheel` 链接会打开封面和 Colour 页面。
- **按关键词指向一个部分：**`#/settings?print`、`#/settings?formats`、`#/settings?palette`（Colour 页面）或 `#/settings?tokens`。关键词可以共用：`print` 同时属于品牌标签页的印刷参考和 Print production 组，页面顺序靠前者优先。如果需要明确指向哪一个，请使用 ID。

深度链接会切换到拥有目标的标签页，打开它所在的任何折叠组，然后滚动到它，并在其上方各部分完成布局时稍作停留。已停用的 `#/platform` 和 `#/capabilities` 地址会并入 Settings，并保留其深度链接标志。
:::

---

**相关内容：**[个人资料](/info/profile.html)，了解你的详细信息以及你创作时所处的情境。[Design System Setup](/info/brand-studio.html)，用于编辑 Design system 标签页所显示的内容。[查找和恢复你的作品](/info/find-your-work.html)，了解存储、备份和更换设备。
