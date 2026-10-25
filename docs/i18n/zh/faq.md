# 问答

常见问题，渲染为 `/info/start/faq.html` 上的折叠面板。

**维护方式：** 下面每个 `##` 标题都是一个问题；
它下方（直到下一个 `##`）的内容就是答案。答案使用与
本站其余部分相同的轻量 markdown，段落之间用空行分隔。
在此处增删或重排问题，然后重新运行 `pnpm run build:info`（或 `pnpm run dev:web`）。
第一个 `##` 之前的所有内容（本标题与这些说明）会被构建忽略。

顺序是初次使用者的顺序：先说关键所在，然后是你的文件，再是获取和运行 Lolly，
接着是组织，最后是它是如何做出来的。每个问题的锚点都由同一位置上的英文问题生成，
所以翻译保持英文的
顺序。

## 为什么是免费的？有什么附加条件？

**我们为自己构建了 Lolly。** SUSE 需要成千上万个符合品牌的文件，并且不把任何东西交给外部服务。所以我们构建了一个在设备上完成这一切的工具，并像我们做的其他一切那样，以开源形式发布。我们之所以继续维护，是因为我们每天都在使用它。**没有任何义务：**这里的一切无论有没有我们都能运作。

这条界线划在许可协议里，而不是承诺里：凡是在本地运行的，永远免费。已发布的版本所采用的许可协议使其无法被收回，也没有任何可能重新授权任何人作品的贡献者协议。

## SUSE 保留了多少不公开的东西？（也就是：什么时候会过河拆桥）

引擎、外壳、模式定义和与品牌无关的工具都是开源的。SUSE 的商标和品牌工具是保持私有的部分，并且已经分离出来。[lolly.tools](https://lolly.tools) 上的公共实例运行的是 [Lolly Demo](/info/lolly-demo.html)，即 Lolly 自己的设计系统。

这里没有什么是建立在承诺之上的：每个已发布的版本都保持开源，唯一保留的是商标。2023 年另一家公司关闭其企业级 Linux 源代码时，SUSE 共同创立了 [OpenELA](https://openela.org) 来保持这些代码开放，本项目继承的正是同样的立场。

完整披露：SUSE *确实*在构建内部工具，把 Lolly 连接到自己的 IT 系统。那是 SUSE 的内部配置，而不是公开开发与私有开发的分裂。Lolly 还计划通过 [Open Build Service](https://openbuildservice.org/) 构建，并由 [SUSE Application Collection](https://apps.rancher.io/applications) 交付安全的供应链制品。

## 为什么叫 “Lolly Tools”？

**Lolly** 是因为自由是甜的，也因为在澳大利亚、新西兰和英国，lolly 就是糖果。

**Tools** 是因为工具在你拿起它之前一直静静待着。你不用它时它不运行，你用它时它也不盯着你。

## 为什么一切都是绿色的？

lolly.tools 默认打开 [Lolly Demo](/info/lolly-demo.html)，即 Lolly 自己的示例设计系统，其主色是绿色。它是示例，而不是规则。你可以在 [Settings → Design systems](/#/settings?focus=design-systems-section) 中切换到空白的设计系统 **Lolly Starter**，或切换到你自己的设计系统。

## 我可以使用自己的品牌吗？

可以。**Design System Setup**（`#/start`）可以从一种颜色、一个设计令牌文件或一份成品设计构建设计系统，之后每个工具都使用你的设计系统来绘制。[开始](/info/quickstart.html#put-your-brand-in)介绍了这三条路径。

由你的组织或你的构建版本提供的设计系统是受管理的：它显示一把锁并保持只读，你可以创建一个可编辑的副本来修改。

## 我昨天做的东西在哪里？

如果你按了 **Save as** 或 **Save**，它就在主屏幕的 **Projects** 中，位于你保存时所用的浏览器或应用里。如果你只按了 **Download**，文件就在浏览器或系统保存下载内容的位置，通常在 **Assets** 中也有一份副本。[边做边保存](/info/find-your-work.html#which-tools-save-as-you-work)的工具也会把未保存的作品保留在 **Projects** 中。[查找和恢复你的作品](/info/find-your-work.html)涵盖了所有情况。

## 我关掉了标签页。我的作品还在吗？

已保存的作品仍在**项目**中。未保存的作品会丢失，除了那些会随手保存的工具，它们同样会把作品保留在**项目**中。下次离开前，先按**另存为**。见[如果你关闭了标签页或离开了工具](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool)。

## 我可以用文件而不是链接来分享作品吗？

可以。当链接无法携带全部内容时，例如你自己的照片或长文本，Share 对话框会说明会缺少什么，并提供 **.lolly** 文件作为替代：一个文件包含设计、它使用的图片，以及（如果你选择）工具本身。

带走多少由你决定。只有当你的个人资料选择加入时，你的姓名和详细信息才会写入；除非你选择包含素材，否则有许可协议限制的素材会被扣留。任何打开携带工具的文件的人，在工具能够运行之前，都会被询问是否信任该工具。参见[分享你的作品](/info/using.html#sharing-your-work)。

## 我的个人资料详细信息有什么用？

你在 **Settings** 中的详细信息会预填到需要它们的工具中，例如证件上的姓名。它们留在这台设备上。如果你同时开启了选择加入，你选定的详细信息会被封入你制作的内容，注明你是来源。除非你选择包含你的详细信息，否则不会包含任何内容。

分享和同步只发送你选择的内容。在组织的 Lolly Work 实例上，共享会话和受管控的工作也会发送到那台服务器。参见[隐私](/info/privacy.html)。

## 我如何获取移动版或桌面版应用？

从[安装 Lolly](/info/install.html) 下载。该页面列出了 macOS、Windows、Linux 和 Android 的每个版本，并说明如何检查你下载的文件。iPhone 和 iPad 从 App Store 获取 **Lolly Tools**；[iPhone 和 iPad 部分](/info/install.html#iphone-and-ipad)有链接。

任何人也可以构建并分发自己的应用副本，带上他们的受众所需的工具和设置。[构建指南](/info/build-guide.html)说明了方法。

## Lolly 提示需要 WebGPU。我该怎么办？

网页应用使用 WebGPU 绘制，这是当前浏览器的一项图形功能，它会在打开工具之前检查。请按顺序尝试：

1. 把浏览器更新到当前版本。
2. 在浏览器设置中开启图形或硬件加速，然后重启浏览器。
3. 试试经过测试的浏览器：[支持的环境](/info/supported-environments.html)列出了它们。
4. 在 Mac、iPhone 或 iPad 上，请改为[安装应用](/info/install.html)。

## Lolly 能编辑和渲染我的 Figma、Penpot、Illustrator 或 InDesign 文件吗？

可以。打开 **Design** 并点击 **Import a design**：它接受原生的 Figma **.fig**（Save local copy）、Penpot **.penpot** 导出、Illustrator **.ai** 或 **.pdf**、InDesign **.idml**（File → Export → InDesign Markup）或**任何 SVG**。你不需要账号、插件或设计应用许可证。

![Design 的开放画布 - Import a design（导入设计）位于工具栏的 Lolly 菜单中](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

图层会作为可编辑的方框到达：文字仍可重新输入，形状仍是形状，图片并入你自己的库。保存后，**Share with rules** 可以把这个版面变成任何拥有 Lolly 的人都能重新填写的工具。参见[导入设计](/info/design-import.html)。

## 两个人可以在没有互联网的情况下协作同一份设计吗？

可以。一个人通过链接、二维码或短码分享邀请，另一个人接受。然后两台设备实时持有同一个会话，包括在线状态和焦点环。它在任何共享网络上都能工作，包括地下室里的手机热点，因为中间没有服务器。参见[一起工作](/info/collaborate.html)。对于处于不同网络的同事，组织的 Lolly Work 实例提供经过认证的工作协作。

## 什么是功能开关？

功能开关会开启或关闭 Lolly 的部分功能。在独立使用时，你自己选择个人设置。使用 Lolly Work 的组织可以在其政策下设置默认值或隐藏部分开关，受管理的控制项会有标注。参见[在你的组织中使用 Lolly](/info/organisation.html)。

![独立应用中的个人功能开关；组织政策可以管控部分开关](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## 实用工具（Utilities）与工具（Tools）有什么不同？

实用工具对你已有的文件做一件快速的事，例如压缩 PDF、转换照片或清除隐藏数据，其中许多在你的设备上运行，不上传任何内容。它们的存在，是为了让人们通常交给随便某个网站的工作留在 Lolly 内部。压缩合同、转换仍带有位置信息的假期照片，或把令牌粘贴到在线格式化工具里，都不该意味着把文件交给一个保留期限、司法辖区和商业模式都不明的网站。[实用工具](/info/utilities.html)列出了它们，[我们从未同意的交易](/info/status-quo.html)讲述了它们背后的故事。

![Utilities 视图：Strip Hidden Data、Compress PDF、Convert Image 以及其他设备端工作，全部集中在一处](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 我们的组织可以使用 SSO、共享项目和审批吗？

可以，使用 **Lolly Work**，即同一开源项目的组织服务器。它单独运行，并增加通过你的身份提供方的单点登录、SCIM 开通、组权限、共享项目和素材、实时工作协作、审批和审计记录。日常使用的应用仍可独立工作。

[在你的组织中使用 Lolly](/info/organisation.html)介绍了登录和查找共享作品，[部署](/info/deployment.html#organisation-services-with-lolly-work)介绍了如何设置。共享内容和组织记录遵循该实例的隐私和保留政策。

## 采用 Lolly 可能会遇到哪些障碍？

需要改变的多半是生产方面，而不是技术。想要一套受管控工具的团队，需要有人来创作其设计系统和最初的模板，不过任何人从第一天起就可以在 Design 中开始制作自己的工具，不需要 git。而且现有流程即使产出不符合品牌也会继续运转，所以把一个可见的产出做好，并把前后效果并排放在一起，比一份计划更快地说明问题。

[采用与治理](/info/adoption-governance.html)介绍了按角色上手、如何衡量试点，以及治理流程可以是什么样子。

## Lolly是用“氛围编程”做出来的吗?

Lolly 的开发使用了 AI 辅助编程、AI 辅助发现，以及在许多地方的 AI 辅助内容，使用了多种模型和供应商，包括来自公有云前沿公司的模型。架构由人创建，代码由人有意识地整理，体验由人进行艺术指导。

Lolly 依赖项中的高危或严重公告会阻止 CI。暂时无法修复的公告，只有作为附有书面理由的已批准例外才会被保留。[SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) 列出了目前保留的每个例外，[发布说明](https://github.com/lolly-tools/lolly/releases)列出了每个版本携带的例外。SECURITY.md 还说明了如何报告漏洞。

构建中的检查还会拒绝代码注释、应用和这些文档中读起来像机器写出的措辞，让文字对每位读者都保持平实。一个副作用是检测器可能更难判断哪些文字是模型写的。我们并非有意造成这一点。

最重要的是，Lolly 站在世界各地专家几十年开源工作的肩膀上。

**生成式AI披露:**

- **LLM 编写的代码：**Opus 4.8、Gemini 3.1、Qwen3-Coder-Next、Codex Sol（此列表可能扩充）
- **LLM 探索：**Gemini 3.1、Fable、Codex Astra
- **文档：**Sonnet 5
- **开源库：**其各自的作者，体现在 SBOM、注释和文件头中

此列表不包括内嵌于Lolly中的模型。

**人类的贡献：**
- **构思、审阅与反馈：**Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpot 社区、Tim Hildred（名单并不完整）
- **架构、艺术指导与清理粗制滥造内容的人：**Andy Fitzsimon

## SUSE 品牌的工具去哪了？

它们位于一个单独的私有仓库中。公开克隆完全不会获取 SUSE 品牌包，所以由此构建的版本使用中性的 `lolly-start` 配置文件，除非你选择别的：与品牌无关的社区工具，加上一个由你自己填写的空白品牌。[lolly.tools](https://lolly.tools) 使用 `lolly-demo` 配置文件构建，默认打开 [Lolly Demo](/info/lolly-demo.html)，即 Lolly 自己的设计系统。SUSE 运营自己的实例以保护其商标。

## Lolly 那个标志是什么口味的？

有人说是青柠，有人说是薄荷，有时又说是苹果；Lolly 负责带来甜味，口味由你来实现！
