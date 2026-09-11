# 常见问题

在 `/info` 落地页折叠面板中展示的常见问题。

**维护方式：** 下面每个 `##` 标题都是一个问题；它下方（直到下一个 `##`）的内容
就是答案。答案使用与本站其余部分相同的轻量 markdown，段落之间用空行分隔。
在此处增删或重排问题，然后重新运行 `npm run build:info`（或 `npm run dev:web`）。
第一个 `##` 之前的所有内容（本标题与这些说明）会被构建忽略。

## 我在 /profile 页面选择加入后会发生什么？

初次使用 Lolly 时，你在任何地方输入的一切都完全私密，直到你主动希望这些信息通过媒体文件或分享链接（如果在线）传播出去。

选择加入后，你所选的个人资料信息会被封存进你制作的内容中，将你标注为来源。你没有勾选的内容一律不会写入。

Lolly 会产出大量内容。我们采取严格的数据最小化原则来防范风险。

## Lolly是用“氛围编程”做出来的吗?

Lolly的开发运用了AI辅助编码、AI辅助探索,许多地方还使用了AI辅助生成的内容,所用的模型与供应商多种多样,包括来自公有云前沿企业的模型。

截至本文撰写时,Lolly的供应链中不存在已知的安全漏洞,并承诺在CVE出现时采取快速的安全响应措施。

架构由人类设计,代码经过有意识的审慎筛选,体验则由人类进行艺术指导。

最重要的是,Lolly站在世界各地真正专家们数十年开源创新成果的肩膀之上。

Lolly的代码库中有一个确定性构建关卡,用来让代码和文档对普通读者保持连贯清晰,并为体验“去水”。这可能会让专有的合成式溯源枚举变得困难。这并非有意为之。

**生成式AI披露:**

- **LLM编写的代码:** Opus 4.8、Gemini 3.1、Qwen3-Coder-Next(此列表可能会扩展)
- **LLM探索:** Gemini 3.1、Fable
- **文档:** Sonnet 5
- **开源库:** 各自的作者,详见SBOM、注释与文件头

此列表不包括内嵌于Lolly中的模型。

**人类贡献:**

- **架构:** Andy Fitzsimon
- **艺术指导:** Andy Fitzsimon
- **人工编写代码:** Andy Fitzsimon
- **创意构思、评审与反馈:** Ravan Naidoo、Matthias Eckermann、Kelly Andrews、Ryan Kleeman、Peter Chamalian、Penpot社区(列表并不详尽)

## 什么是功能开关？

功能开关用于启用或关闭 Lolly 的各个部分。通常这些开关由管理员掌控，而在 Lolly 中，掌控权在你手里。

![每个功能开关都归你所有，位于你自己的个人资料页中，而不是管理员的控制台里](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## 我如何获取移动版或桌面版应用？

任何人都可以分发自己的应用，这些应用的工具和配置会因面向的受众不同而差别很大。所以并不存在唯一的一个应用，除非是你自己做的，或者由相关的人交给你。

## 为什么叫 “Lolly Tools”？

**Lolly** 是因为自由是甜的，也因为在澳大利亚、新西兰和英国，lolly 就是糖果。

**Tools** 是因为工具在你拿起它之前一直静静待着。你不用它时它不运行，你用它时它也不盯着你。

## 采用 Lolly 可能会遇到哪些障碍？

Lolly 可以嵌入你现有的任何文件生成环节，CLI 与应用使用同一套引擎，所以凌晨两点跑的流水线
不会与有人在浏览器里预览到的结果产生偏差。采用的阻力很少来自技术，而是来自组织。
可以预期以下几点：

**需要有人编写一份经过策划的品牌资产目录。** Lolly 是一个平台，而不是一套做好的模板包。
若要做*受治理的推广*，需要有人定义共享的资产目录（徽标、色板、字体，都以永久 ID 存在），
并为每种输出类型编写清单和模板。不过个人用户不必等这一步：在开放的应用中，任何人从第一天起
就可以把自己的文件导入目录，并在 Design 中构建工具。

**参与贡献不需要 git。** 设计师在应用里制作自己的工具和模板，然后分享给同事，
或提交给部署的负责人，以纳入默认集合。

**它是有意做窄的，请按这个定位来介绍它。** Lolly 不适合定制内容或主视觉大片。它*就是*你的
个人 DAM，由你的设计系统、工具和资产目录注入内容并全面加持；它*确实*有一块自由画布
（Design），但即便在那里，颜色、字体和资产也都遵循当前的设计全局设定，因此自由排布仍然
处在系统之内。拿它和 Figma 或 Canva 相比，会显得功能有限。按它本来的定位来看，也就是
可运营、可重复、超大规模的资产生成，它没有对手。定位讲错是最常见的挫折来源。

**生产侧的变更管理。** 现有流程今天照样能跑，哪怕产出并不符合品牌规范。把它们改接到引擎上
意味着重新测试、重新学习，而“我们本来就能出文件”就成了不迁移的借口。可以先转换一个高曝光、
生产级质量的产出，把前后效果并排展示出来。

Lolly 让一切水涨船高。


## 实用工具（Utilities）与工具（Tools）有什么不同？

**简短回答 →** 实用工具不一定需要渲染，因此可以有不同的使用体验。 

**真正的回答 →** 之所以让实用工具能托管在 Lolly Tools 内部，是为了再加一道“便利层”防线，削弱数据外泄的动机。 

为什么？因为众所周知，每天都有人把**自己手上的机密内容**交给一个随手找来的网站，
只为完成一个小小的机械操作：

- “**压缩这个 PDF**” → 把合同 / 工资单 / 董事会材料上传给不明主体。
- “**把 HEIC 转成 JPG**” → 把个人照片（含 GPS EXIF）上传到靠广告盈利的主机
- “**裁剪 / 缩放这张图片**” → 上传产品截图或未发布的素材
- “**格式化这段 JSON**” / “解码这个 JWT” → 把 API 响应、令牌、密钥粘贴进一个格式化工具
- “**合并这些 PDF**” → 上传**两份本不该出现在同一台服务器上的文档**

这些网站以及它们数量庞大的克隆长尾**默认不可信**：留存策略不明、司法管辖不明、次级处理方不明，
加上广告/推广分成的商业模式，让它们有充分动机把你交出去的东西留下来。操作本身微不足道，
**代价在于内容。** 

我们靠出色的便利性和服务，赢得这场治理之战。 

![Utilities 视图汇集了人们通常会交给某个随手找来的网站去做的机械任务，如今它们全部在 Lolly 内部运行](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Lolly 能编辑和渲染我的 Figma、Penpot、Illustrator 或 InDesign 文件吗？

可以。打开 **Design**，点击 **Import a design**（导入设计）：它接受 Figma 原生的 **.fig**（Save local copy）、Penpot 导出的 **.penpot**、Illustrator 的 **.ai** 或 **.pdf**、InDesign 的 **.idml**（File → Export → InDesign Markup），或者**任意 SVG**（这是最宽的一道门，几乎所有设计软件都能导出）。不需要账号、不需要插件，也不需要设计软件的授权。

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

图层会以可编辑的方框出现在自由画布上：文字仍可重新输入，形状仍是形状，图片进入你自己的图片库，字体和颜色遵循品牌全局设定。保存之后，这个版式就成为一个可复用、可用 URL 寻址的模板，任何用 Lolly 的人都能重新填充内容，你还可以混入在加载时重新渲染的实时工具（二维码、图表）。之后它就和 Lolly 里的其他东西一样渲染：SVG、PDF、PNG 等等，都可以从它的 URL 复现。参见[导入设计](/info/design-import.html)。

## 我可以用文件而不是链接来分享作品吗？

可以。当链接装不下全部内容（你自己的照片、长文本）时，Share 对话框会明确说明哪些内容会丢失，并改为提供一个 **.lolly** 文件：单个文件里装着设计稿、它用到的图片，以及（如果你愿意）工具本身。带走多少由你决定：只有在你的个人资料选择加入时，你的姓名和信息才会写入；有授权限制的素材除非你主动包含，否则会被留在外面；而打开一个带工具的文件的人，在工具能运行之前会被问及是否信任它。参见[分享你的作品](/info/using.html#sharing-your-work)。

## 两个人可以在没有互联网的情况下协作同一份设计吗？

可以。一个人发出邀请（链接、二维码或一段短代码），另一个人接受，两台设备就实时共享同一个会话，在线状态、焦点框等一应俱全。它在任何共享网络上都能工作，包括地下室里的手机热点，因为中间没有服务器。参见[协同工作](/info/collaborate.html)。

## SUSE 品牌的工具去哪了？

它们已经放在一个独立的私有仓库里。公开克隆根本不会拉取 SUSE 品牌包，所以公开构建运行的是中性的 `lolly-start` 配置：与品牌无关的社区工具，加上一个由你自己填充的空白品牌。SUSE 运营自己的实例，以保护其商标。

## 为什么是免费的？有什么附加条件？

**我们是为自己做的 Lolly。** SUSE 需要成千上万份符合品牌规范的文件，每一份内部都封存着自己的名字，而且制作过程中不把任何东西交给外部服务。于是我们做了一个全部在设备上完成这些工作的工具，并像我们做的其他所有东西一样开源发布。我们持续维护它，因为我们每天都在用。**这不附带任何义务：** 这里的一切，有没有我们都照样运行。

这条界线画在许可证里，而不是画在一句承诺上：凡是在本地运行的部分，永远免费。已经发布的版本，其许可方式决定了它无法被收回；也不存在任何能对他人的贡献重新授权的贡献者协议。完整表述参见[定位](/info/positioning.html)。

## SUSE 保留了多少不公开的东西？（也就是：什么时候会过河拆桥）

引擎、外壳、schema 以及与品牌无关的工具都是开源的；保持私有的是 SUSE 的商标和品牌工具，它们已经被拆分出去。公开实例 [lolly.tools](https://lolly.tools) 运行在空白品牌上。

这条边界是结构性的，而不是靠承诺。每一个发布出去的版本都是开源的，且无法撤回发布；不存在任何能对他人的贡献重新授权的贡献者协议；唯一保留的只有商标。2023 年另一家公司关闭其企业级 Linux 源代码时，SUSE 参与共同创立了 [OpenELA](https://openela.org)，让那部分代码保持开放，本项目继承的正是同样的立场。

完全公开地说：SUSE *确实*在建设内部工具，把 Lolly 集成进自己的 IT 系统，但那关乎 SUSE 的内部部署，而不是公开开发与私有开发之分。Lolly 还计划通过 [Open Build Service](https://openbuildservice.org/) 构建，由 [SUSE Application Collection](https://apps.rancher.io/applications) 提供安全供应链制品。

## Lolly 那个标志是什么口味的？

有人说是青柠，有人说是薄荷，有时又说是苹果；Lolly 负责带来甜味，口味由你来实现！
