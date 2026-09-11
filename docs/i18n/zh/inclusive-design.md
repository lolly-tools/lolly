# Lolly 包容性设计政策

*最后更新：2026 年 7 月 30 日*

> **我们的理念。** 开源社区容纳我们每一个人。任何人都能阅读、运行和修改的软件，
> 只有当任何人都能真正使用它时，才配得上这份开放，无论一个人看到什么、听到什么、
> 如何处理信息、说什么语言、抱有什么信念。因此，我们把每一项适配都视为一种庆祝，
> 而绝非妥协：一项让 Lolly 对某个人来说更平静、更响亮、更大或更熟悉的偏好设置，
> 并不是产品的降级模式。它就是产品本身，在那个人所在的地方，接住了我们中的又一位。

## 本政策涵盖的内容

Lolly 是一款创意工具：人们来这里创作代表自己的作品。这一点以一种具体的方式塑造了
下面的每一项适配：**调整应用，绝不调整你的作品**。无障碍偏好设置只会重新装点
Lolly 自己的界面：菜单、卡片、导航、字体。它们经过专门设计，绝不触及工具画布或
导出管线，并且只要某项偏好可能让导出文件移动哪怕一个像素，自动化测试就会让我们的
构建失败。你永远不必在一个舒适的应用和一次忠实的渲染之间做选择。

## 无障碍

![The Accessibility card on the profile page: four plain switches - Reduce motion, Hide colourful previews, High contrast and Large text - each with a help tip](/t/url-shot?url=%2F%23%2Fprofile&width=430&height=900&dpi=192&waitMs=2000&scrollDepth=1300&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.profile-card--a11y&dark=1&filename=incl-a11y-card)

除了跟随平台自身的信号（系统深色模式、操作系统的减弱动效偏好）之外，Lolly 还在
你的个人资料中提供明确的、需自行开启的无障碍偏好设置：

- <!--i:pause--> **减弱动效** 关闭应用中的过渡、滑动和动画装饰，并与操作系统的
  设置叠加生效（绝不覆盖它）。动画导出仍会完全按设计继续运动。
- <!--i:sunburst--> **高对比度** 加强你作品周围的边框、文字和焦点环。你的品牌
  颜色和画布保持与你设定的完全一致。
- <!--i:font--> **大号文字** 放大应用的文字和图标字形，而不会让你的设计重新排版，
  因此你导出的内容逐字节相同。
- <!--i:eyeoff--> **隐藏彩色预览** 把图库的预览图换成平静的图标加文字卡片，并
  柔化项目缩略图，将其颜色和对比度减半，让它们在没有色彩噪音的情况下依然可以辨认。
  一旦你进入某个工具，完整色彩立即恢复，于是高刺激图像出现的唯一场合，就是你主动
  选择处理它的场合。

除这些偏好设置之外：控件带有无障碍名称和按下状态，变化会向屏幕阅读器播报，浮层
可按 Escape 关闭，键盘焦点清晰可见并在高对比度下进一步加强，而且每一个开关都是
个人资料页上一张朴素、始终可见的卡片，即使是几乎无法阅读当前页面的人也能找到它，
而那正是它最重要的时刻。

## 降低与增强刺激

![The Neurospicy player docked over the app: track title and transport, separate Music and Effects volumes, and the Atmosphere mixer with Wind, Birdsong and Crickets raised](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dplayer&width=1440&height=1000&dpi=192&waitMs=3200&css=%5Bdata-dock-viz-slot%5D%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23neuro-dock&dark=1&filename=incl-neuro-player)

![The visualiser open over the app, painting the music as a full-motion field, with its own transport and volume controls](/t/url-shot?url=%2F%23%2F%3Fneuro%3Dviz&width=1440&height=900&dpi=96&waitMs=2000&waitSelector=.audio-dock%5Bdata-demo-settled%5D&walker=1&format=svg&cropSelector=.audio-dock&css=.audio-dock%20*%7Bbackdrop-filter%3Anone%21important%7D&dark=1&filename=incl-neuro-viz)

![A utility card on a phone-width screen: a calm icon and text tile that keeps its favourite, pin and info actions](/t/url-shot?url=%2F%23%2Fu&width=430&height=900&dpi=192&waitMs=2400&scrollDepth=900&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D.gtile%7Bcontent-visibility%3Avisible%7D&format=svg&walker=1&cropSelector=.gtile--utility%5Bdata-tool-id%5D&dark=1&filename=incl-utility-card)

神经多样性人群不是只有一种需求的单一群体。同一个大脑，在艰难的一天会被满墙的
彩色缩略图压垮，在另一天却可能寻求强烈的感官输入，因此 Lolly 在两个方向上都提供
适配，并且始终由你自行开启：

- <!--i:moon--> **调低。** 减弱动效和隐藏彩色预览把界面精简为图标、文字和一种
  强调色。对于 ADHD 人群、自闭谱系人群，以及觉得密集、高变化图像难以浏览的阅读
  障碍人群，导航保持清爽；在更平静的呈现中，你需要的一切（收藏、置顶、操作）都
  不会被拿走。
- <!--i:neurobeat--> **调高。** Neurospicy 模式是一层刻意打造的感官体验：专注
  循环、带有可逐项调节音量的环境音床的氛围混音台、程序生成的音乐，以及界面音效，
  为那些在丰富输入下最能专注的人准备。它默认关闭，在你主动要求之前绝不自动播放。
- <!--i:sliders--> **声音可以单独控制。** 每一层可听内容都有自己的开关，所以
  “视觉平静、声音丰富”及其反向组合都是真实可用的配置，而不是别人替你打包好的
  单一无障碍方案。

## 语言与本地化优先级

![The appearance settings rendered in Arabic on a phone-width screen: a fully right-to-left layout, not a mirrored afterthought](/t/url-shot?url=%2F%23%2Fprofile%3Flang%3Dar&width=430&height=900&dpi=192&waitMs=2200&scrollDepth=950&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=incl-profile-rtl)

- <!--i:globe--> Lolly 的界面和文档被翻译成超过 25 种语言，并且我们**按使用
  人数排定语言的优先级**，而不是按市场收入：印地语、孟加拉语、乌尔都语和印尼语
  与法语、德语在同一批次到来。
- <!--i:convert--> 从右到左的文字是一等公民：阿拉伯语带有完整的 RTL 布局，而
  不是事后镜像的敷衍处理。
- <!--i:layers--> 语言各自独立，不可互换：印尼语和马来语是彼此独立的翻译目录，
  繁体中文和简体中文是彼此独立的翻译目录，并且语言属性在首次绘制之前就已设置，
  使汉字和文字回退能按你的语言正确渲染，而不是渲染成一个相似的语言。
- <!--i:checklist--> 语言菜单以每种语言自己的名称和文字列出所有语言，并可按
  使用人口排序，因此找到你的语言从不需要知道它的英文名。

## 文化包容

- <!--i:palette--> 中性的初始品牌不对你是谁做任何假设；Lolly 存在的意义，就是
  让你自己的身份、配色和字体在几分钟内取代我们的。
- <!--i:pentool--> 字体被当作一种文化表面来对待：上传的字体和 Google 字体在
  各种文字系统中都经过正确的文本整形，因此姓名、变音符号和非拉丁文字会导出为
  绘制正确的轮廓，而不是豆腐块或替换字形。
- <!--i:people--> 文案避免使用难以翻译的习语和依赖特定文化的典故，并且译者拿到
  的是干净、纯粹的字符串，而不是夹杂标记片段的句子。

## 伦理承诺

- <!--i:lock--> **以架构保障隐私。** 你的作品留在你的设备上。代码库中没有任何
  跟踪器或分析组件，为数不多的网络触点全部列举在[隐私政策](/info/privacy.html)
  中。无障碍和语言偏好保存在你自己的个人资料里、你自己的设备上：残障或语言永远
  不会成为遥测数据。
- <!--i:shieldcheck--> **诚实的来源。** 导出内容可以携带 Content Credentials，
  AI 生成的内容会如实标注。我们相信受众有权知道媒体是如何制作的，创作者也应当
  拥有能够证明作品归属于自己的工具。
- <!--i:check--> **不搞诱导性设计。** 偏好设置是言行一致的朴素开关，默认项在你
  选择之前保持休眠，平台惯例（原生滚动、浏览器快捷键、标准对话框）得到尊重而
  不是被劫持。
- <!--i:code--> **开源。** 引擎、各个 shell 和社区工具都是公开的。本文档中的
  每一项主张都可以在源代码中查证，其中若干项由测试强制执行，一旦被破坏构建就会
  失败：无障碍属性默认叠加的规则、禁止偏好设置触及导出的规则，以及应用中每项
  偏好的两份副本保持同步的规则。

## 我们如何兑现承诺

在这里，包容性设计是工程意义上的政策：有测试守护的不变量，而不是堆砌形容词的
愿景。当一项适配与一项功能冲突时，我们重新设计功能（当“隐藏预览”设置连带隐藏
了实用工具卡片上的操作图标时，修复方式是保留这些操作，而不是为损失找借口）。
如果 Lolly 中有什么把你排除在外：缺失的语言、令人不堪重负的瞬间、我们无意间
埋下的假设，那就是一个 bug。请告诉我们：[fitzy@suse.com](mailto:fitzy@suse.com)。
