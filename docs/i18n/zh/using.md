# 使用 Lolly

一份关于真正*使用*这个应用的实用指南——打开工具、操作画布、导出、保存和分享。这里的一切都在**你的设备上**运行：无需账号、无需上传，首次加载后无需联网。

> 初次使用？[快速入门](/info/quickstart.html)让你几分钟内就能开始创作，[Lolly 面向运营方](/info/operators.html)介绍应用的安装与部署；本页讲的是打开之后如何操作。

## 打开工具

主屏幕就是**工具库**——所有工具按类别分组。点击卡片即可打开工具；如果你之前用过它，**继续**按钮会恢复你最近的一次会话。用搜索框按名称筛选——或者从六个列表页（工具库、实用工具、项目、目录、控制台和个人资料）底部的栏里[搜索](/info/search.html)，它除了工具，还能找到你保存的作品、目录和设置。进入工具后，这条栏会让位给工具自己的界面。

![工具库——每个工具都是一张卡片，按类别分组](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

每个工具都是分屏视图：一侧是**控件**，另一侧是实时**预览**（画布）。更改任意控件，预览会立即更新。

![某工具的分栏视图——左侧是控制面板堆栈,右侧是它实时绘制的分组柱状图](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> 少数工具（例如 **Design**）会以**自由画布**的形式打开——一个没有多余界面、可直接操作的画面，你可以拖动、缩放、旋转并吸附文本、形状和图片方框，双击即可就地编辑文本。它通过与其他所有工具相同的渲染路径导出，因此画布本身*就是*文件。见下文[自由画布](#the-free-canvas-design)。

有两种方式，可以把这个网格本身调整成你想要的样子：

- <!--i:star--> **给常用的工具加星。** 给卡片点上 ★，它就会在网格上方的横排里获得一块属于自己的大磁贴——见[你的收藏](/info/favourites.html)。
- <!--i:eyeoff--> **隐藏你从不使用的工具。** 右键点击卡片（或选中若干张后使用选择栏）→ **隐藏工具**。它会从网格中消失，在网格里打字搜索时也找不到；网格最末尾有一块灰色的**显示隐藏的工具 (N)** 磁贴，可以把它们重新显示出来（呈暗色），每一个的菜单里都有**取消隐藏工具**。隐藏只关乎你自己的网格——该工具仍可从保存的链接或书签打开，对其他人来说也一切照旧。

![工具网格的末尾，隐藏的工具已显示出来：暗色的二维码生成器卡片，旁边是把它重新显示出来的那块灰色磁贴，此时显示为“隐藏已隐藏项”](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

当你不想翻找、只想直接问时，**Ask Lolly**（`#/ask`）接收你输入的问题，并**原文返回**本文档中匹配的那一节——是指南自己的措辞，既不是摘要也不是生成内容——同时注明它来自哪一页，旁边附有**在文档中打开**链接。答案下方是应用里与同一问题匹配的位置：一个工具、一项设置、一个已保存的项目，每一项都是一个直接跳转过去的按钮。

对话记录只是本次会话的记忆：接着追问，线程会一路累积；重新加载则从头开始。搜索结果底部会有一行 **Ask Lolly：*你的查询词***——排在其他分组找到的具体结果之下——它把问题直接转交过去，于是你可以从搜索栏开始，在这里收尾。

## 画布（预览）

预览始终精确显示导出后的结果。

**桌面端**

- **缩放：** Cmd/Ctrl + 滚动，或在触控板上双指捏合——缩放以指针位置为中心。
- **平移：** 按住**空格键**拖动，或用**鼠标中键**拖动。（普通点击仍留给点击设计中的元素。）
- **键盘：** `0` = 适应窗口 · `1` = 100% · `+` / `−` = 缩放。
- **缩放浮层：** 角落里的小控件 `−  NN%  +  Fit`。点击百分比可在“适应”与 100% 之间切换。

![画布角落的缩放浮层——减号、实时百分比、加号、Fit，然后是主题和声音开关](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**触控端**

- **双指捏合**缩放，**拖动**平移，**双击**重置为适应窗口。

**点击跳转到对应控件：** 点击设计中的任意元素，侧边栏中匹配的输入项会获得焦点并滚动到可见处——对于重复行组，它会展开你点击的那一行，于是编辑眼前所见只需一步。

更改尺寸时，视图总会自动回到整洁的适应状态。

### 自由画布（Design）

自由画布类工具会在画板*周围*增加一块工作区域，就像设计师的粘贴板：

- **画布外暂存。** 把方框拖出画框边缘，它仍然完全**可见且可选中**——排布构图时可以先把元素放到一边，需要时再拖回来。画框之外的一切都会**轻微淡化**，使导出区域始终一目了然，画框本身则保留阴影，清楚标示文件从哪里开始。
- **只有画框内的内容会被导出。** 导出的文件以画板为边界——留在画框外的任何内容（或方框悬出边缘的部分）都会直接从输出中裁掉，位图和矢量格式均是如此。
- **缩小到超过“适应”比例**（最小可到 20%），当你把元素暂存到离画框很远的地方时，可以借此看到整个粘贴板。
- **可调整大小的画板。** 更改导出尺寸会原地调整画框大小；方框保持原有位置，因此你可以围绕现有内容重新取景。

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**翻转所选内容。** 右键点击任意方框,选择 **Flip horizontal**(水平翻转)或 **Flip vertical**(垂直翻转)即可原地镜像,或按键盘上的 `Shift+H` / `Shift+V` - 之所以要加 Shift,是因为单独的 `V` 是 Pointer 工具。每个被选中的方框都沿自己的轴镜像,并作为一个撤销步骤记录;镜像是真正的变换,因此它会保留在导出的 SVG、PDF 和 PNG 中,而不只是停留在画布上。

### 绘制你自己的形状（钢笔）

方框、圆形和圆角框足以应付大多数版面。当你需要的形状不在其中时，就把它画出来：工具栏上的**钢笔**按钮（或 `P` 键）会让你进入绘制模式。三个单键在模式之间切换——**`V`** 回到指针，**`P`** 是钢笔，**`N`** 是节点工具（**编辑节点**）——而指针始终是从当前模式退出的出口。

![自由画布的工具栏：拖动把手、Lolly 菜单，然后是指针、添加方框、钢笔、编辑节点、线型、时间轴、画板和自动排列](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **点击**放置一个节点。在默认曲线类型下，**点击并拖动**会拉出该节点的手柄，这就是画出曲线而不是尖角的方法——点击时按住 **Alt** 则得到一个硬转角。（在其他曲线类型下，放置的每个节点都是尖角，拖动不起作用；见下文的**样条类型**。）
- 放置节点时会吸附到画板和你的其他方框上，画出与普通拖动相同的参考线。绘制过程中按 Alt 会屏蔽网格，之后拖动节点时按 Alt 则同时屏蔽网格和边缘。
- **点击第一个节点**即可闭合路径并一步完成。否则按 **Enter**、双击，或干脆切换工具——所绘内容会被保留，不会丢弃。
- **Escape** 一次退一级：第一次按下会放弃这次绘制、不写入任何内容，第二次按下则退出钢笔。
- 绘制过程中按 **Delete** 会删掉你最后放置的那个节点。

结果就是画布上的一个普通方框。移动它、缩放它、旋转它、编组它、对齐它、调整它的层级，给它填充、渐变、阴影或不透明度——路径的表现和其他每个方框一样，这些控件都不会区别对待它。

它一出现就带着颜色。你画的第一条路径会采用品牌为路径规定的填充和描边，此后每条新路径都采用**你上一次用过的设置**——设定一次填充就可以一路画下去，不必逐个形状重新上色。（在品牌对路径未作任何规定的工具里，画出的路径会用你绘制时看到的那个颜色描边，因此它绝不会是隐形的。）

**再次编辑节点。** 双击该形状（或使用对象栏上的**编辑节点**），节点就会回来。拖动节点可移动它，拖动手柄可改变它的朝向，在曲线上任意位置点击可插入节点，框选一组节点后按 Delete 可删除选中的节点。路径始终至少保留两个节点，因此你不会不小心把它整个删没。

**样条类型**决定穿过你这些节点的是哪一种曲线，这个选择值得弄明白：

| 类型 | 作用 |
|---|---|
| **平滑（自动）** | 默认选项。它自行算出手柄长度，因此单纯地点击、点击、再点击就能得到一条真正平滑的曲线，无需摆弄手柄。如果你确实设置了某个手柄，它会固定住*方向*，长度仍归曲线掌握。 |
| **贝塞尔手柄** | 经典钢笔。手柄就是控制点，插入节点绝不会移动曲线。 |
| **穿过节点** | 精确穿过你放置的每一个节点，没有手柄。 |
| **B 样条** | 从节点附近流过而不穿过它们，形状更柔和。 |
| **直线** | 折线。 |

把已有路径切换到自行计算手柄的类型时会先询问你，因为你设定的手柄长度无法恢复——切换到**贝塞尔手柄**则始终无损。绘制过程中不会有提示：切换直接作用于草稿，你此前拉出的手柄也随之而去。在自行掌握手柄的类型上，插入节点会让曲线形状略有变化；在**贝塞尔手柄**上则不会。

每个节点还带有一条连续性规则，在画布上以形状表示——方形代表**尖角**（手柄各自独立移动），圆形代表**平滑**（手柄保持共线），带圆环的圆形代表**对称**（共线且等长）。为任意选中的节点设定它，曲线会立即重新满足这条规则。

![直接由链接渲染出的两条钢笔路径：一条带描边的 S 形曲线和一个闭合的填充色块](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

画出的路径和其他一切一样会随链接传递，因此你画的形状可以从分享链接重新打开，也能由 CLI 渲染出完全相同的结果。它没有任何一处依赖编辑器。

### 组合形状（路径运算）

选中两个或更多形状，在画布上**右键点击**（触控设备用双指点按），菜单里就有你在绘图软件中会期待的那些运算：

- **并集**把它们合并为一个形状，保留最上层形状的颜色。
- **减去**从底层形状中减掉其上方的所有形状。
- **相交**只保留重叠的部分。
- **排除**保留重叠以外的所有部分。

另有三项作用于单个形状：**轮廓化描边…**把描边变成轮廓相同的填充形状（想把线宽精确保留成绘制时的样子就很有用），**偏移路径…**把外形向外扩张，填入负数则向内收缩，而**简化**会用更少的段数重建一条形状相同的路径。

![一个月牙形和一个带真实孔洞的圆环，都由“减去”运算生成](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

结果是一条新的路径，你可以继续用钢笔编辑它。孔洞是真正的孔洞——描边面板上的**填充规则**控件决定重叠的轮廓是被填充（*非零*）还是被镂空（*奇偶*）。

这些运算有两件事是刻意不做的。它们**宁可拒绝也不破坏**：让两个并不重叠的形状相交，它会告诉你没有可保留的部分，并且什么也不改。另外，文本框和图片框没有可用的轮廓，因此它们会被原样留下，而不是用外框近似代替。合并后的结果以普通贝塞尔曲线存储，绘图软件也是这么做的——原来的样条类型不会在运算后保留。

## 时间轴（Sequence Studio）

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** 为自由画布加上了*时间*。每个方框都可以在某个时刻开始、持续一段时长、带入场和出场动画，而停靠在画板下方的时间轴就是你排布它们的地方。打开它，已经有一段序列在播放——标题卡、一段片段、片尾卡、下三分之一字幕和一条背景音乐——因此在你动手改动之前，这套模型就已一目了然。

![Sequence Studio 的时间线:传输控制条、标尺、一条叠加轨道、带片段与接缝标记的吸附序列行,以及常驻的 Always on 条](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

轨道有两种，两者的区别正是整个想法的关键：

- **序列轨**是*磁性*的。片段一个接一个、彼此无缝相连，拖动其中一个会重新排列整条序列，而不是留下一个空洞。删掉一个片段，其余的会自动合拢。这是你的主干。
- **叠加轨**则是自由的。下三分之一字幕、Logo、字幕说明——任何按自己的时间浮在主干之上的东西——都有自己的轨道和自己的起点。
- 在这些之下，**始终显示**收纳完全没有时间设定的方框：全程都在画面里的布景。方框标记上的 `+` 可以把它提升到某条轨道上；**设为始终显示**则把它送回去。

![编辑舞台:居中的画板、左侧的工具栏,以及角落的缩放 HUD](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

打开时间轴会把键盘交给它，于是空格键和方向键驱动的是播放头而不是页面——而且由于面对已有时间设定的作品时它会自行打开，从 Sequence Studio 载入的那一刻起就是如此。

> **[序列编辑器](/info/sequence-editor.html)** 更深入地讲了决定按时间编辑是否可预期的四件事：画布上的一次点击编辑的是哪个片段、相邻片段的洋葱皮残影、拆分的作用范围与撤销剪切的合并，以及修剪（包括整套键盘操作）。让时间轴处于焦点状态时按 `?` 可查看快捷键表。

**编辑。** 拖动片段中部可移动或重新排序，拖动靠近两端几像素处可修剪，按**在播放头处拆分**（或 `S`）可把一个片段切成两个。拆分要求片段有真实的**时长**，且播放头位于其内部稍靠里的位置，因此没有结束时间的片段（比如背景音乐）无法拆分。**吸附到边缘**默认开启，会吸附到片段边缘、播放头和整秒处，按 Alt 可临时取消。每次拖动都是一步撤销，且拖动时的预览与最终提交采用同一套算法，所以拖动时看到的就是最终结果。

选中一个片段，检查器会以数值形式提供同样的编辑项：**时长**、**入点修剪**（从源素材的多久处开始）、**速度**（从 ×0.25 到 ×4 的一组固定倍率）、**入场动画** / **出场动画**及其时长，以及**将片段静音**。磁性轨上的片段刻意没有**开始**字段——顺序由轨道掌管，所以要移动它就靠拖动。

**转场**是预设，不是关键帧：淡入淡出、弹出、扩展、上升、下落、四种滑入、放大与缩小、倾斜、俯冲、旋转、漂移，或**硬切（无动画）**。位移距离会随对象大小缩放，因此同一个预设在整幅卡片和小小的徽标上都读得通。序列轨上相邻两个片段之间有一个**接缝标记**：点击它并选择**硬切**或**交叉淡化**，选择后立即生效并关闭。再次打开同一个标记可修改**时长（毫秒）**，然后按**完成**。交叉淡化会被存成前一个片段的淡出加后一个片段的淡入，导出时再由这一对推导出真正的叠化——这就是为什么交叉淡化在预览里看起来像两次淡变，在文件里却是一次真正的交接。

**声音。** 添加一个**音频**片段，它会像其他片段一样待在时间轴上：波形、修剪、静音。（默认会话自带的那条生成式背景音乐是唯一的例外——它在导出时才合成，所以在你渲染之前，它的条形一直是空白且无声的。）按下麦克风即可把**旁白录制**直接录到时间轴上，带有预备倒数和电平表，录下的这一条会作为你自己的素材，保存在你开始录制的位置。按下旁边的摄像头即可用同样的方式**录制视频**：拍摄过程中画面会按画板的导出尺寸裁切，因此这个小小的自拍预览显示的，正是会以满幅画面进入播放头处序列的内容——这也是从共享链接收集同事素材的方式。音乐、对白和片段自带的声音都会进入导出的混音。（导出面板里的**音轨**是另一回事：一条铺在整段成片下方的背景音乐，带淡变和自动闪避。两者可以并存。）

**渲染它。** 动态导出是一次**确定性合成**，不是屏幕录制——每一帧都在精确的时间点被解码、绘制和编码，因此文件不取决于你的机器跟不跟得上，MP4 或 WebM 也没有实际的帧数上限。除非你自己填写时长，否则时长由时间轴本身的长度决定。Content Credentials 会像其他任何导出一样被打上。静帧导出给你的是播放头处的那一帧，或者通过输出尺寸旁的**帧数**字段导出一整张连拍表——见[导出](/info/exporting.html#stills-from-a-timed-composition)。

有几条限制要记住：一段序列最长一小时；GIF 和动态 PNG 会把帧缓存起来，所以它们只能短；速度不是 ×1 的片段没有声音（目前还没有变速不变调）；**实时录制**在这里被隐藏，因为合成器是更好的路径。

**超越预设:关键帧、深度和镜头。** 转场会在一个片段进入和离开时为其添加动效。若要在一个片段*内部*摆出姿态——让它漂移、淡入淡出、模糊、从页面上升起再落回——就添加关键帧:选中片段,按下 **+Keyframe**(时间线工具组中的菱形图标、画布对象栏上的菱形图标,或按 `K`),播放头所在的位置将决定你下一次编辑写入的是哪个姿态。同一套关键帧系统还为每个带时间线的合成提供了**镜头**功能,可以推近、横移、拉焦,把一个平面的 SVG 变成一叠可以在其间穿梭飞行的图层。**[动画制作](/info/animating.html)** 是完整指南。

Design 工具拥有同一条时间轴，因此你不必换到另一个工具就能为版面设定时间，它同样可以导出动态。

## 演示

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

由多个**画板**组成的 Design 文档本身就是一套幻灯片。打开工具栏上的 **Lolly 菜单**并选择**演示**（最后一行），每个画板就会变成一张全屏幻灯片，顺序与画板在画布上的排列一致。演示运行在渲染后画板的副本上，因此底下的编辑器不会被碰到，退出后你会回到原来的位置。

- **前进(Advance)**:按 **Space** 键、`→`、**Page Down** 键,或点击屏幕右边缘的色带;按 `←`、**Page Up** 键或左边缘色带可返回上一步。**Home** 和 **End** 可跳转到第一张和最后一张画板。只要移动指针,一小条控制栏就会淡入显示,停止移动后又会自动隐藏。
- **总览(Overview)**(按 `O` 或点击网格按钮)会按您在画布上排定的布局,一次性展示所有画板;点击其中一个即可打开。
- **逐步显现。** 右键点击某个方框,选择 **Reveal at step 1**(第 1 步显现)、**2** 或 **3**,替代默认的 **Always visible**(始终可见)。该方框此后会一直等到您推进到对应步骤才会出现,幻灯片因此可以分批呈现;共用同一编号的方框会同时出现。
- **演讲者视图(Speaker view)**(`S`)会打开第二个窗口,显示当前幻灯片、下一张幻灯片、该画板的备注,以及一个持续运行的计时器。如果浏览器阻止了弹出窗口,则会退回为叠加在演示上方的面板。备注按画板逐一设置,绝不会出现在幻灯片本身上。
- `B` 会定格为黑屏(按任意键恢复幻灯片),`F` 返回全屏,**Escape** 则逐层退出:先从总览退回演示,再从演示退回编辑器。
- **展台模式(Kiosk)。** 为画板设置一个 **Length**(时长),演示就会在该画板停留相应时间,随后在一条细进度条的提示下自动前进;`K`(或暂停按钮,只有当某个画板设置了时长后才会出现)可以停止并重新开始该流程。在链接中加上 `kiosk`,演示到末尾就会循环播放,这正是它能用作数字标牌的原因。

演示本身也是一个链接。`?present` 直接进入演示，`s=` 指定幻灯片——序号、画板 id，或用 `id.step` 指定某个分步——而地址会随你翻页更新，所以你发出去的就是你正停在的那一张。工具作者请注意：这些参数记录在 [URL 模式](/info/url-mode.html#reserved-parameters)页面上。

## 在手机上

在窄屏幕上，布局会重排为单列：

- **控件变成顶部的一块面板**，下边缘有一个**拖动把手**。拖动把手可调整大小——它会吸附到**微露 / 半屏 / 全屏**——或**点按**把手在折叠 ↔ 展开之间切换。预览填满下方空间，并在你编辑时始终可见。
- 悬浮的**导出**按钮会打开导出面板——格式、尺寸、复制、保存和下载等控件全在一处。点按背景即可关闭它。

![手机宽度屏幕上的一个工具——顶部是面板形式的控件，下方预览中是生成的调色板，渲染胶囊按钮浮在底部中央](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## 控件（输入项）

工具只暴露那些本就该变化的输入项——其余的一切（颜色、布局、排版、逻辑）都由工具作者锁定，因此你做出来的东西始终符合作者设下的规则。输入项包括文本、滑块、颜色选择器、下拉菜单、日期、图片选择器和重复行组。有些会归入可折叠的分组中。

![工具的控件栏——一个文本框、几个颜色触发器和一个滑块，作者选择锁定的其余内容都不在这里](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**重置：** *清除更改*会把每个输入项恢复为默认值。

### 撤销与重做

**Cmd/Ctrl-Z** 后退一步，**Cmd/Ctrl-Shift-Z**（或 **Cmd/Ctrl-Y**）再向前一步。同样这一对以**撤销**和**重做**按钮的形式位于控件上方的一行——在自由画布上它们改放在工具栏上——当没有可收回的内容时各自变灰。每一步都会说明自己是什么：撤销一次改色，会有一条小提示写出它刚刚恢复的那个输入项，提示里还带一个**重做**按钮供你回去。

- **一次拖动就是一步。** 半秒之内对同一个控件的连续更改会合并在一起，因此把滑块从头拉到尾是一次撤销，而不是两百次。
- **保留最近 100 步**——更早的会从末端掉落。撤销之后再做新的编辑会清空前进栈，这一点和别处一样。
- **当光标停在文本框里时**，Cmd/Ctrl-Z 属于输入框本身，逐字符生效。Lolly 只接管那些自身没有可用撤销的控件：滑块、下拉菜单、颜色和开关。
- 在**文件**输入项中**选择文件**不算一步——那些字节只在本次会话中保留，因此也就没有什么可以放回去的。

在一次实时[协作](/info/collaborate.html)中,历史记录只属于你自己。来自另一台设备的更改永远不会进入你的撤销栈,因此撤销操作只能撤回你自己所做的更改。

## 你的详细信息与头像照片

**个人资料**（工具库右上角）保存你的姓名、联系方式和可选的**头像照片**。需要这些字段的工具会自动预填——设置一次，你的邮件签名、组合标识和徽章就会自行填好。你仍然可以在每次会话中单独覆盖任意字段。开启**使用我的资料创作**，你的信息就会作为作者随你导出的内容一同带上。

你的头像照片和详细信息**仅保存在本设备上**。一份个人资料不一定只代表你自己——也可以是一个团队，或你偶尔扮演的某个角色。完整说明见**[个人资料](/info/profile.html)**，包括如何保留多份。

## 保存与继续

点击**保存**可把当前的输入项存为该工具的一个会话。每个工具可以保留多个具名会话；每个工具的**继续**按钮会重新打开你最近的一个，而**历史记录按钮**（右上角，紧邻个人资料）会列出所有工具下的每一个已保存会话。会话保存在本机。要整理它们，请打开下方的**项目**。

![分成两半的渲染胶囊按钮——向上箭头打开导出面板，对勾就地保存会话](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## 项目

**项目**——可从**工具**旁边的**项目**标签页打开，也可从**个人资料 → 存储空间 → 在项目中整理**进入——是你所保存的一切的归处，用起来像一个文件管理器：

![项目——已保存的会话整理在可嵌套的文件夹中](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **可嵌套的文件夹。** 把已保存的会话归入文件夹，文件夹里还能再建文件夹，层级不限。你可以新建文件夹、重命名，或把一个磁贴拖到另一个文件夹上来移动它；面包屑可带你逐层返回。一个始终存在的**未分类**文件夹会存放尚未归档的内容。
- <!--i:clock--> **按你自己的方式排序。** **查看和排序**提供**名称**、**添加日期**、**最近修改**（默认）以及在文件夹内的**按工具**。无论使用哪种排序，文件夹总是排在前面——排序只在各自的分组内部为会话和文件夹排序。
- <!--i:document--> **新作品直接归档。** **新建素材**（在根目录是“开始一项新创作”，在文件夹内是“添加到*文件夹*”）会打开一个工具，并把它的首次保存自动归入该文件夹。
- <!--i:checklist--> **多选（桌面端）。** 勾选磁贴的复选框、在空白处拖出一个选框，或按 **Shift/Cmd 点击**；**右键点击**磁贴可打开它的上下文菜单。之后就能对整个选中范围一次性操作——同样的手势和同样的悬浮操作栏在工具库、实用工具、目录和项目中都适用，不只是这里。
- <!--i:download--> **渲染整个文件夹或选中项。** **渲染文件夹**会把一个文件夹里的每个已保存会话——包括其子文件夹——导出为一个嵌套的 `.zip`。**渲染所选内容**对任意多选执行同样的操作，单个会话则直接渲染为它自己的文件。无需批量/Pro。
- <!--i:link--> **直接跳到某个工具的已保存作品。** 在工具库中勾选一个或多个工具，从选择栏选择**查看会话**——项目会打开并只显示用这些工具做出的会话，用**清除**即可回到完整视图。
- <!--i:link--> **分享已保存的会话。** 右键点击一个会话 → **分享链接**，即可复制一个能以完全相同输入项重新打开它的链接（完整的分享对话框——见下文）。

![项目中打开的“查看和排序”弹层：一行主题、“预览或列表”的视图选择，以及排序下的名称、添加日期和最近修改](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**选择栏提供什么**在不同视图里略有差别，因为并非每个操作在所有地方都说得通：

- **工具 / 实用工具：** 收藏（或取消收藏）、隐藏（或取消隐藏）、可离线使用（或从离线中移除）、**查看会话**（上文说的那个跳转），以及在恰好只选中一张卡片时的复制链接。
- **目录：** 收藏和隐藏适用于任意选中范围；生成副本、下载和删除只有在选中的每一项都是你自己上传的内容时才出现——共享的设计系统素材是一份长期契约，因此即便批量操作，这三项也不会对它开放。
- **项目：** **渲染所选内容**、**移动到…**、**新建文件夹**、**删除**；当选中的是二到八个单工具会话时还有**一起编辑**（把它们并排打开在一个合并的侧边栏之下），以及**作为表格编辑**，它改为把整个选中范围作为行打开在批量网格里。后者**没有数量上限**，也不在乎这些会话是否来自同一个工具，因此当选中范围比“一起编辑”的二到八个更大或更混杂时，它就是那条退路。

> 有一个标签上的坑：**查看会话**只有在*选中*了东西之后才存在。右键点击一张未被选中的卡片，得到的是**N 个已保存的会话**，它打开的是该工具自己的历史记录对话框，而不是跳转到项目。

![Tools 图库中被勾选的两张工具卡片,浮动选择栏显示 2 selected,并提供 Available offline、View sessions、Favourite 和 Hide 选项](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## 分享你的作品

一份设计有两种送出方式：作为链接，或作为文件。分享对话框两者都提供。用导出控件中的**分享**打开它；项目中已保存会话上的**分享链接**会为该会话打开同一个对话框。

### 链接

每一个输入项都记录在页面 URL 中，因此一个链接*就是*这份设计。对话框顶部是可直接复制的链接，下面折叠着两个分区。

- **链接选项**里有**最短链接**（大的设计会产生很长的 URL，这一项把整个状态打包成一个紧凑的令牌，并告诉你省下了多少字符；可读形式也始终保留）、**为此链接设置密码**（对整个链接使用 AES-256，密码绝不会出现在链接里）和**锁定此工具版本**——即 `_v` 标记，把链接钉在你眼前的这个工具版本上，后来的更新就不会改变它渲染出的结果。
- **链接行为**是收件人打开它时会发生的事：全屏、导出面板已展开、用 `&export` 打开即下载，或用 `&copy` 打开即复制到剪贴板。

把链接粘贴给同事、加入书签，或提交到版本库。（完整说明：[URL 模式](/info/url-mode.html)。）

**有些工具会让链接本身成为完整的产品。** Jump Page 会把你的多个链接汇集到一个页面上分发出去——个人简介链接、会议演讲页、店铺主页。这背后无需托管,也无需账户:页面本身就是链接,因此它的打开速度就是网址传输的速度。在编辑器中,你可以在字段旁边看到成品页面;打开链接的访客会看到全宽显示的页面,随着滚动一屏一个链接依次展开。

![编辑器中的 Jump Page——标题、三个各自带有底色的链接场景,以及一个 Made with Lolly 页脚,在画布上排布成一整页](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**对话框会说明链接装不下什么。** 有三样东西放不进 URL：你从本设备添加的图片或文件、很长的文本值，以及很大的列表。构建链接时会逐一统计它们。如果有内容不得不被舍弃，对话框会点名说出，并把你引向下面的文件方案，而不是给你一个打开后图片缺失的链接。仅仅是*长*的链接只会收到一条较温和的提示并附上字符数，因为打包仍然可以救回长度。

### .lolly 文件

在你所用工具的分享对话框里，**下载 .lolly** 会把同一份设计写成一个文件。它带着已保存的会话，连同你从设备添加的图片和文件。设计所用到的目录素材也一并装在里面，因此这个文件在一台从未见过你品牌的机器上也能完整打开。如果你的设备有分享面板，**发送给…**会把该文件直接交给它（AirDrop、Android 的分享），而不是保存到磁盘。

`.lolly` 就是一个普通的 zip。把它改名为 `.zip` 再打开：你自己的图片在 `assets/uploads/` 下，目录素材在 `assets/catalog/` 下，各自带着真实的名称和扩展名，`manifest.json` 列出了每一个，顶层还有一个 README 说明这个文件是什么。

在它送出之前，有三件事由你决定：

- **你的姓名是否写入。** 只有当个人资料中的 **Use my details to create** 开启时,你的姓名、邮箱和组织才会写入文件。关闭时,文件只记录它是用 Lolly 制作的以及制作时间 - 不包含任何关于你的信息。
- **授权素材是否写入。** 已授权和品牌锁定的素材默认会被排除在外。如果设计中用到了这类素材,对话框会说明数量,并提供两个按钮 - *Download without them*(不含这些素材下载)或 *Include and download*(包含并下载) - 因为包含它们就相当于把实际文件交给了任何打开该 `.lolly` 文件的人。
- **工具本身是否写入。** **Include the tool** 会将工具自身的文件与设计一起打包,这样它就能在没有安装该工具的设备上打开。对于自定义工具 - 比如收件人不太可能拥有的分支或私有品牌工具 - 该选项默认勾选;对于签名目录中列出的工具则默认不勾选,因为对方的副本来自同一来源。(在没有签名目录的构建中,每个工具都算作自定义工具,该选项默认勾选。)

**打开一个文件。** 把一个 `.lolly` 文件拖放到应用上:素材会进入你的素材库,会话会进入 Projects,工具会随之打开。你已有的任何内容都不会被覆盖:会话会以一个新的已保存槽位形式到达,而设备上已存在的素材会通过校验和匹配并复用,而不是被重复创建。导入过程中的每个部分都会与文件自带的校验和进行核对,因此传输中损坏的副本会被拒绝,而不是被半途导入。

如果文件里带着一个你没有的工具，Lolly 会在该工具运行之前先问你：**信任此工具？**会写出它的名称和作者，并明白地说明打开它就是在你的设备上运行该工具自己的代码，**信任并安装**是继续的方式。拒绝的话，分享过来的作品仍会保存到你的项目中，等着你哪天补上这个工具。（有一类工具目前还无法侧载——代码以模块形式提供的那种——它会以同样的方式被挡在门外。）

链接和文件交出的都是一份快照。若要和别人*同时*处理同一个会话——两台设备、没有服务器，同处一个网络时甚至不需要联网——见[协同工作](/info/collaborate.html)。

## 实时摄像头（运动响应型工具）

每一个照片**滤镜**——半调、扫描线、色调分离、Voronoi 晶格、色彩处理、像素拉伸和瑕疵——在有可用摄像头时都会显示**开启实时**按钮。打开它，效果会逐帧跟踪你的摄像头画面，从而对动作作出反应；你可以把结果录制为 GIF、WebM 或 MP4。画面帧的读取和处理都在**你的设备上**完成，绝不会离开设备，一旦你停止或离开该工具，摄像头会立即释放。（任意图片选择器也都有**拍照**，可抓取单帧作为设备端图片。）

## 我的图片

当某个工具允许你从设备添加图片时，图片会被原封不动地保留——因此它上面的 Content Credential 仍然通得过校验——并保存到你个人的**我的图片**库中（位于**个人资料 → 存储空间**）。只有确实巨大的文件才会问你是保留还是缩小。你可以在任意工具中重复使用它。若想在图片进入时清除 EXIF/GPS，请在个人资料中开启**从上传内容中清除元数据**。没有容量上限：该库完全在本地，只受你设备存储空间的限制——可以在那里管理或删除图片。

## 目录——你的素材库

**目录**（`#/c`，或每个列表视图顶部“项目 · 工具 · 实用工具 · 目录”切换器中的**目录**那一段）汇集了你的工具可以调用的一切——品牌 Logo、图片、音频和动态素材，按类别分组——它也是你**自己的创意文件**的存放之处。没有服务器，没有管理控制台，没有 pull request：一切都在你的设备上。

![目录——品牌素材、色板和字体，以及你自己上传的内容](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **导入你的文件。** 将任意图像、SVG、音频片段、视频、Lottie、PDF 或 PowerPoint 文稿拖到上传区域——或点击进行选择——它会立即出现在你的目录中,并在每个工具的素材选择器里可用。多页 PDF 或 `.pptx` 会询问要保留哪些页面或幻灯片——每一页都会变成一个 SVG 素材。想导入多少都可以;它永远不会离开你的设备。
- <!--i:star--> **收藏你常用的素材。** 为一个素材(或一个品牌色板)标星 ★,它就会固定在每个选择器的顶部,让你常用的徽标或颜色一键可达。
- <!--i:folder--> **整理素材。** 把某个素材重新归类到另一个分组,隐藏你不用的共享品牌素材(可通过 **Show hidden**(显示隐藏项)重新找回),或者直接删除你自己上传的内容。这里同样支持与 Projects 相同的多选手势和浮动操作栏,因此以上操作都可以一次性应用到整批选中的内容。
- <!--i:layers--> **从视频中抠出背景。** 在任意素材选择器中打开某个视频的详情,或右键点击它的卡片,选择 **Remove background…**(移除背景…)即可保存一个带真实 alpha 通道的透明版本——一个动画 WebP 或 PNG。可选择一种 **Method**(方法):**On-device model**(设备端模型)会从繁杂的场景中把主体抠出来,或者用 **Colour key**(色键)从光照均匀的纯色背景(例如绿幕或素色墙面)中抠像,并通过 **Tolerance**(容差)、**Softness**(柔和度)和 **Spill removal**(溢色去除)来调整边缘效果。色键方式无需下载模型、也无需联网,因此任何视频都可以使用 **Remove background**(移除背景),在画面干净的素材上效果通常也更好。**Resolution**(分辨率)控件(360、480、720 或 1080p,且不会超过源素材)可以用细节换取更小、更快的文件。该过程在你的设备上以后台任务的形式运行。抠好的成品会作为独立素材保存在原素材旁边,源视频的 Content Credential 也会作为素材来源一并随行。(关于为什么移除背景仍属于一次普通编辑,参见[一次生成,渲染始终如一](/info/ai-features.html)。)

### 把你的调色板和字体带到任何地方

目录的**色板**面板不只是展示——点击某个颜色即可复制它，或以你其他工具所使用的格式**下载整套品牌调色板**：

- <!--i:code--> **设计令牌（JSON）**、**CSS 变量**或 **CSS 类**——把品牌直接放进样式表或构建流程；
- <!--i:palette--> **Adobe Swatch Exchange（.ase）**——载入 Illustrator 或 Photoshop；
- <!--i:pentool--> **GIMP 调色板（.gpl）**——用于 GIMP 或 Inkscape。

![色板面板——顶部一排五个调色板下载按钮，下面是每一种品牌色，均为可复制的色片](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

**字体**面板列出你的品牌字体，每种旁边都有**下载**，可在本地安装或交给印刷厂。（[品牌工作室](/info/brand-studio.html)的“颜色”室也提供同样的调色板下载。）

素材只是这条开放、自助路径的一半；另一半是**制作你自己的工具**——自由画布（即上文的 Design）让你无需写代码，就能可视化地搭出一个工具。

## 声音与无障碍

Lolly 力求让每个人用起来都舒适。界面支持键盘导航，自定义控件带有供屏幕阅读器使用的正确标签，每个工具的实时预览都作为一张带标签的图片呈现，描述它正在制作的内容。

一层轻柔的**辅助音效**会确认你的操作——进入工具库、Content Credentials 校验有效与无效、关闭面板、切换滤镜。它**默认关闭**：在开关出现的任意位置（各视图的选项弹层，或**个人资料**）打开**声音**即可，这个选择会被记住。

**个人资料 → 无障碍**下有四项需要你主动开启的舒适度设置：**减弱动效**（去掉应用的过渡和修饰动画）、**隐藏彩色预览**（工具库卡片变成素净的图标加文字，项目缩略图也更安静）、**高对比度**（更强的边框、文字和焦点框）以及**大号文字**（更大的应用字号——标签、菜单、按钮文字）。这四项都只让你工作*周围*的应用安静下来：它们绝不会伸进工具画布，也不会改变你导出内容的任何一个像素，而且在你打开之前都是关闭的。完整说明见[你的个人资料 → 无障碍](/info/profile.html#accessibility)。

“声音”开关旁边是 **Neurospicy 模式**——一段可选的、令人平静的背景专注音轨，会在你工作时轻声播放。开启它会在底部角落打开一个小巧的**播放器坞**，它会跟随你在应用中穿行；你可以在其中搜索并挑选音轨、前后切换、设置音量，以及把它最小化或关闭。音轨列表涵盖几个类别——程序化生成的 *Lolly Sings* 曲目、氛围循环与节拍、你自己上传的音频，以及少量实时网络**电台**（这些需要联网；其余内容均可离线播放）。它**默认关闭**，并且和“声音”一样，会跨会话、跨设备被记住。关掉“声音”也会同时静音这条专注音轨。

## 存储与隐私

一切都保存在浏览器的本地数据库（IndexedDB）中：你的个人资料、已保存的会话、上传的图片，以及已下载目录内容的缓存。**个人资料 → 存储空间**会显示占用情况，并让你可以：

- <!--i:box--> **清除缓存**——丢弃已下载的目录内容（下次加载时重新同步）。
- <!--i:trash--> **清除我的所有数据**——清空个人资料、会话和图片。*无法撤销。*

![手机宽度屏幕上的存储卡片：设备上每一类数据都一一列出，底部是“清除我的所有数据”按钮](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

这些本地数据不会被传输到任何地方——没有遥测，也没有云端渲染。应用会获取或发送的全部内容清单见[隐私政策](/info/privacy.html)，[服务器接触面](/info/server-surface.html)则清点了可选的服务器组件。

## 迁移到另一台设备

由于一切都保存在你的设备上，**个人资料 → 存储空间 → 移动到其他设备**可以让你把这一切带到第二个安装实例——无需账号，无需云端：

- <!--i:download--> **导出我的数据**会下载一个 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`（名称中的各部分取自你的个人资料，未设置时会略去；`<n>` 是按天计数的序号，避免同一天的多次导出撞名），其中包含你的个人资料、每一个已保存的会话（含缩略图）、你上传的图片，以及你的偏好设置（主题、侧边栏宽度、本地活动统计）。
- <!--i:upload--> 在另一个安装实例上用**导入数据…**把该文件读回来。它采用**合并**方式：任何同名内容（你的个人资料、某个会话槽位、某张图片）都会被导入的副本替换；该设备上的其他内容则保持不变。已保存的会话会自动重新关联到你导入的图片。

目录缓存不包含在内——它会在新设备上自行重新下载。这个包是一个普通的 zip（`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`，格式 id 为 `lolly-backup`），因此经电子邮件、U 盘或 AirDrop 传输后依然完整，并且是每个客户端都能读取的同一种格式。每个部分都带校验和，因此传输中损坏的文件会在导入时被发现，而不会被恢复成半坏的状态。（完整格式规范：[数据迁移](/info/data-transfer.html)。）

## 导入设计（Figma、Penpot、Illustrator、InDesign）

你可以把现有设计带进 Lolly 并继续在其中工作：打开 **Design**，在画布工具栏中点击**导入设计**，然后选择 Figma 的 **.fig** 或 SVG、Penpot 的 **.penpot**、Illustrator 的 **.ai** / **.pdf**，或 InDesign 的 **.idml**。图层会变成自由画布上可编辑的方框——文本仍可重新输入，图片落进**我的图片**，字体和颜色遵循品牌全局设置——之后的结果会像其他任何会话一样可以保存、分享和渲染。解析全过程都在你的设备上进行。完整说明：**[导入设计](/info/design-import.html)**。

## 导出

完整内容见**[导出与格式](/info/exporting.html)**——包括选择格式、输出尺寸与印刷单位、透明度、视频以及复制/分享。简而言之：选一种格式，需要时设置尺寸，然后**下载**（或**复制**到剪贴板）。

## 批量（Pro）模式

对高级用户而言，**批量**（从工具库中链接进入，由默认开启的 Pro 功能开关控制）可以一次渲染许多变体——一个网格，每一行是一组输入项，一起导出。非常适合把一张卡片本地化成十几种语言，或一次生成所有尺寸变体。可以手动输入、直接从电子表格粘贴，或导入 CSV（也可以导出一份）来填充各行，并为每一行分别设置格式、尺寸和输出文件名。整个网格可以存成一个具名的**批量会话**，从工具库重新打开，并把每一行下载为一个 `.zip`。

![批量工具栏——zip 文件名、单位、DPI,以及每一行都会继承的格式,右侧是 Sessions 和 Render](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

批量用于一次生成**同一个模板的许多变体**。若要重新渲染你**已经保存**的会话，请使用**项目 → 渲染文件夹 / 渲染所选内容**（见上文）——无需 Pro。

## 并排编辑（多重编辑）

Batch(批量)针对的是*同一个*设计的多种变体。**Multi-edit**(多重编辑)则解决另一半的工作:同时打开多个**不同**的已保存设计,让一次修改应用到所有设计上。在 **Projects** 中勾选**两到八个**已保存的会话,再从选择栏中选择 **Edit together**(一起编辑);它们会在 `#/multi?s=<slot>,<slot>…` 处以实时卡片并排打开。每张卡片都是该会话的真实渲染,而不是一张存储的缩略图,所以你看到的就是最终导出的样子。

一个侧边栏驱动全部：

- <!--i:sliders--> **共享**排在最前——凡是被两个或更多所选会话以*相同方式*声明的输入项（相同 id、相同类型、相同约束——与批量网格处理各列时用的是同一套合并规则）。改动一次共享控件，值就会散布到每一个声明了它的会话，在每张卡片上实时可见。同一个工具的两个会话共享一切；两个不同的工具则共享它们恰好共有的部分，仅此而已。
- <!--i:document--> 其下是**每个会话一张折叠卡片**，含该会话自己的全部输入项，精细程度与工具自身的侧边栏相同——素材选择器、重复行组、颜色字段——外加一个紧凑的导出区块：**格式**、**宽** / **高**、**单位**、**DPI** 和它自己的**下载**。这个下载会先保存会话，再通过普通的会话导出路径渲染它，因此文件带有的文件名、格式和 Content Credentials 与直接从工具导出时一致。
- <!--i:search--> 顶部的**筛选输入项…**会同时收窄*每一张*卡片上的控件——想在八个会话里找到“标题”而不必一路滚动，靠的就是它。

点击任意画布（或在其上按 Enter），该会话的侧边栏卡片就会展开并滚动到可见处。**全部保存**把每个会话写回它自己的槽位。**全部下载**会先保存，再通过与项目的**渲染所选内容**相同的流程渲染整组——打成一个 zip，过程中也会提供可选的密码加锁。

有两条如实说明的限制。二到八个的上限是真实的：每张卡片都会挂载自己的实时运行时，这个数量才能保持流畅——要求更多（或要求一个已不存在的会话）的链接会直说，而不是加载一半。另外，链接指的是*你自己*的保存槽位，因此它只在本设备上重新打开这一组；它不是分享链接。

当选中范围超过八个、混合了多种工具，或既有图片又有会话时，退路是同一条选择栏里的**作为表格编辑**：它把整个选中范围作为**批量网格里的行**打开（`#/pro?s=…`），没有数量上限，也没有同工具的要求。文件夹两者都不参与——它们有自己的在网格中打开的路径。（[搜索](/info/search.html)是目前唯一伸不进这里的东西：多重编辑是搜索栏唯一不知道的视图。）

## 离线与安装

Lolly 是一个 PWA。首次加载后即可**离线**使用——从浏览器地址栏安装它（或在移动设备上使用*添加到主屏幕*），即可获得类似原生应用的全屏体验。重新联网后它会自行更新。

关于更新:如果某个视图在更新后一时加载失败(出现空白面板,或角落里的“failed to fetch”提示),只需重新加载一次页面——应用会干净利落地切换到新版本,你的作品、会话和品牌都不会受到影响。它把一切都保存在你的设备上,而不是保存在页面里。
