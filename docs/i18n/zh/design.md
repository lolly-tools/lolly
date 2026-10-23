# Design：自由画布

Design 是用于没有模板可套用的版面的工具：从零开始的海报、一套幻灯片、带配乐的动态作品。你得到的不是一张控制项表单，而是一块画布，上面的方框可以拖动、缩放、旋转并输入文字。它通过与其他所有工具相同的渲染路径导出，所以画布上看到的就是你得到的文件。

本页带你从第一个方框走到完成的演示稿：窗口、塑造方框、绘制你自己的形状、放置 3D 场景和其他工具、加入时间、检查结果，以及演示完成的演示稿。[使用 Lolly](/info/using.html) 介绍了 Design 与每个工具共有的内容，例如保存和分享。

![Design 的自由画布 - 画板及其周围的粘贴板](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Design 窗口

**顶部栏**从 **Home**、**File menu** 和文档名称开始（点击名称可重命名文档）。中间有 **Undo**、**Redo**、**History**、缩放控制项（带 **Fit all** 和 **Fit artboard**），以及 **Timeline**、**Navigator** 和 **Inspector** 的开关。右侧是 **Share**、**Present** 和 **Export**。在手机上，较少使用的按钮会移入 **More actions**。

沿侧边排列的**工具栏**包含 Lolly 菜单和你绘制所用的工具：**Pointer**、**Add a box**、**Pen**、**Edit points**、**Line**，然后是 Timeline、Artboards 和 Auto-arrange 按钮。

![自由画布的工具栏：拖动把手、Lolly 菜单，然后是指针、添加方框、钢笔、编辑节点、线型、时间轴、画板和自动排列](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

画布就像设计师围绕画板的暂存区：

- **把方框停放在画板外。** 把方框拖过画框边缘，它仍然可见且可选中。画框之外的一切都会变淡，画框保留阴影，标记文件从哪里开始。
- **只有画板会导出。** 画框之外的任何内容，或方框悬在边缘外的部分，在栅格和矢量格式的输出中都会被裁掉。
- **缩小到超过 Fit**，最低 20%，可以看到你停放的所有内容。
- **调整画板大小**，方法是更改导出尺寸。方框保持原位，所以你可以围绕现有内容重新取景。

![编辑舞台：画板位于正中，工具栏在左侧，缩放 HUD 在角落](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator 和 Inspector

**Navigator** 把每个画板（标题为 **Artboards**，在演示稿中是 **Slides**）列为可折叠的 **Layers** 组。选择画板名称即可跳转到那里，展开它可选择或重新排列其图层，并用方向键在列表中移动；向左键返回画板标题。**Pages** 把画板归入具名页面，选择页面只会改变编辑器显示哪些画板。

**Inspector** 把所选对象的文字或图片控制项放在最前。选项芯片涵盖快速选择，**Advanced** 容纳样式细节。在手机上，Inspector 以面板形式从 **More actions** 打开；Escape 或返回键会关闭面板并保留你的选择。

![Inspector 的 Document 部分：Selection 和 Canvas 标签页，然后是 Dimensions 和 Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## 缩放、比例和旋转

选中一个对象，然后拖动手柄来更改其大小，或拖动选区下方的圆形手柄来旋转对象。拖动改变大小有两种模式：

- **Resize**（默认）只改变方框。文字会按新尺寸重新换行，字号、描边宽度、圆角半径和效果保持不变。
- **Scale** 会连同其内容一起放大或缩小整个对象：字号、描边、圆角半径、阴影、模糊、内边距和间距都按相同的比例变化。

按 `K` 可开启或关闭 Scale。没有键盘时，在 Lolly 菜单中选择 **Scale mode**，或按住工具栏上的 **Pointer** 按钮（或右键点击该按钮）并选择 **Scale**；在触摸屏上，对象栏也有 Scale 开关。Scale 开启时，Pointer 按钮显示 Scale 图标，每个手柄中间有一个圆点。`V` 或 **Escape** 会回到 Resize 并保留你的选择。每个文档打开时 Scale 都是关闭的，所以没有人会不小心缩放描边。

**按数值缩放。** 在 Scale 开启时，或选中了多个对象时，点击对象栏上的读数可打开 **Scale** 弹出框。输入百分比、宽度或高度，在 3 x 3 网格上选择保持不动的点，然后选择 **Apply**。每次缩放算一次撤销。

**多个对象。** 选中多个对象时，选区的边上和角上都有手柄。当每个对象都是正立的或旋转了整数个四分之一圈，并且选区中不含组或圆形时，拖动角手柄可以自由改变宽度和高度。否则选区会保持比例，读数中会加上 **Proportional**。拖动时，一个小标签会显示尺寸，在 Scale 模式下则显示百分比。

**翻转选区。** 右键点击并选择 **Flip horizontal** 或 **Flip vertical**，或按 `Shift+H` 或 `Shift+V`（要加 Shift，因为单独的 `V` 是 Pointer）。镜像是真正的变换，所以导出的 SVG、PDF 和 PNG 都保留翻转。

**拖动期间按住的按键**在你按下或松开的瞬间生效；快捷键面板（`?`）也列出了它们。

| 按住 | 缩放或调整大小 | 旋转 | 移动 |
|---|---|---|---|
| **Shift** | 保持比例（Scale 始终如此） | 以 15 度为步长旋转 | 无变化 |
| **Alt**（Option） | 从中心操作 | 自由旋转 | 关闭吸附和网格 |
| **Cmd/Ctrl** | 关闭吸附和网格 | 自由旋转 | 关闭吸附和网格 |

不按任何键时，旋转角度一旦接近 15 度的倍数，在 4 度以内就会被吸附到最近的 15 度。画板不会旋转，所以没有旋转手柄。

::: details 手柄、抓取区域和触摸
**沿边缘任意位置抓取。** 选区的每一边都是沿其全长的缩放条，使用鼠标或手写笔时，每个角的外侧有一个旋转区域。指针会显示拖动将做什么。在条或区域中按下，只有在你开始拖动后才会变成缩放或旋转，所以普通点击仍像以前一样选中。锁定的对象没有手柄、条或区域。

**小对象仍可移动。** 对于宽度在 25 个屏幕像素或以下的对象，中间的手柄会隐藏，其他手柄会向外移开轮廓一小段距离，所以在对象上按下会移动对象。在 10 像素或以下时，角手柄也会消失，细线则在两端各保留一个手柄。在细线或微小对象旁边、避开其手柄处按下，会移动该对象。

**大抓取区域。** 在触摸屏上，每个角区域是选区在屏幕上宽度和高度的四分之一，介于 24 到 44 像素之间，每个边区域覆盖两个角之间的部分。当选区小到不够用时，这些区域会移到其轮廓之外。指针或手指下的区域会被加上阴影。若要在鼠标或手写笔上获得同样的区域，请在 Lolly 菜单中开启 **Large grab areas**；该设置保留在这台设备上。

**选区上的两指操作。** 在触摸屏上，把两根手指放在选中的对象上：捏合缩放，扭转旋转，或同时移动两根手指来搬动选区，全部算作一次撤销。在 Scale 开启时，捏合会连同内容一起缩放；Scale 关闭时，则按比例调整大小。扭转在接近时会吸附到最近的 15 度，两指移动则从不吸附。第一根手指必须落在选区上，第二根必须很快跟上，落在选区上或其边缘外侧一点。在其他任何位置的两指操作会缩放和平移视图；两指落在包含画板或锁定对象、覆盖大部分视图或超出其边缘的选区上时也是如此。
:::

## 绘制你自己的形状

方框、圆形和圆角框涵盖了大多数版面。对于任何其他形状，请自己绘制：工具栏的 **Pen** 按钮（或 `P`）会让你进入绘制模式。三个单键在模式之间切换：`V` 是 Pointer，`P` 是 Pen，`N` 是 **Edit points**。Pointer 始终是退出的方式。

- **点击**放置一个点。在默认的曲线类型下，**点击并拖动**会拉出该点的手柄形成曲线；点击时按住 **Alt** 可得到尖角。（在其他曲线类型下，每个点都是尖角，拖动不起作用。）
- 放置点时，它们会吸附到画板和你的其他方框。绘制时 Alt 会暂时关闭网格，之后拖动某个点时则同时关闭网格和边缘吸附。
- **点击你的第一个点**可闭合形状。否则按 **Enter**、双击或切换工具，绘制的内容会被保留。
- **Escape** 一次作用一步：第一次按下放弃绘制，第二次离开钢笔。
- 绘制时按 **Delete** 会删掉最后一个点。

结果是一个普通的方框。你可以像移动其他方框一样移动、缩放、旋转、编组、对齐、重新叠放、填充、加阴影或淡化这条路径。第一条路径采用你的品牌为路径设定的填充和描边，之后每条新路径采用你最近一次使用的样式。在品牌没有为路径设定任何样式的工具中，新路径会以你绘制时所用的颜色描边，所以形状永远不会不可见。

**再次编辑点。** 双击形状，或使用对象栏上的 **Edit points**。拖动点可以移动它，拖动手柄可以重新调整曲线方向，点击曲线可插入一个点，或在几个点周围拖出选框并按 Delete。路径始终至少保留两个点。

**Spline type** 决定穿过你各个点的是哪一种曲线：

| 类型 | 作用 |
|---|---|
| **Smooth (auto)** | 默认值。自行计算手柄长度，所以普通点击就能得到平滑曲线。你设定的手柄会固定方向，长度仍由曲线自己决定。 |
| **Bezier handles** | 经典钢笔：每个手柄都由你控制，插入一个点绝不会移动曲线。 |
| **Through the points** | 精确穿过每个点，没有手柄。 |
| **B-spline** | 在点附近流动而不穿过它们，线条更柔和。 |
| **Straight lines** | 折线。 |

把现有路径切换到会自行计算手柄的类型之前会先询问，因为你设定的手柄长度无法恢复；切换到 **Bezier handles** 则始终无损。绘制过程中，切换会立即生效，你拉出的任何手柄都会被丢弃。

每个点还带有一条连续性规则，以其形状表示：方形表示 **Corner**（手柄独立移动），圆形表示 **Smooth**（手柄保持在一条线上），带圆环的圆形表示 **Symmetric**（在一条线上且长度相等）。为选中的点设定规则，曲线会立即跟随。

![直接由链接渲染出的两条钢笔路径：一条带描边的 S 形曲线和一个闭合的填充色块](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

绘制的路径像任何其他方框一样随分享链接传递，并且在命令行中渲染结果相同。

## 组合形状

选中两个或更多形状，右键点击画布（触摸屏上为双指轻点），然后选择：

- **Union** 将它们合并为一个形状，采用最上层形状的颜色。
- **Subtract** 从底部形状中切去上方的一切。
- **Intersect** 只保留重叠部分。
- **Exclude** 保留除重叠部分以外的一切。

另外三个操作作用于单个形状。**Outline stroke…** 把描边变成同样粗细的填充轮廓。**Offset path…** 向外扩大轮廓，取负数时则向内收缩。**Simplify** 用更少的线段重建路径，轮廓保持不变。

![一个新月形和一个带真实镂空的圆环，均由 Subtract 生成](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

结果是一条新路径，你可以继续用钢笔编辑，它以普通贝塞尔曲线存储，所以原来的样条类型不会保留。镂空是真正的镂空：描边面板上的 **Fill rule** 控制项决定重叠的轮廓是填充（*non-zero*）还是镂空（*even-odd*）。这些操作宁可拒绝也不破坏：要求对两个不重叠的形状求交集，什么都不会改变。文字和图片方框没有轮廓，所以不受影响。

## 设计中的 3D 场景和工具

一个方框可以容纳的不止是一张图片。下面两种都保存的是配方而不是渲染好的图像，所以它们会按文档要求的任何尺寸和时刻重新绘制，对源的更新会传到每一个使用该源的设计中。

### 3D 场景

从工具栏的添加菜单中选择 **3D scene** 并拖出一个框：3D Studio 会在新方框上打开，你在那里的设置会回到画布。之后，Inspector 的 **3D scene** 部分中的 **Edit in 3D Studio** 会重新打开工作室。[在 Design 中放置场景](/info/3d-studio.html#place-a-scene-in-design)介绍了海报、时间线、导出和分享。

### 设计中的工具

从工具栏的添加菜单中选择 **Image**，拖出一个框，并在选择器的 **Tools** 标签页上选一个工具。该工具以其默认值填满这个框，Inspector 会打开 **Tool** 部分，其中是该工具自己的控制项。更改一个字段，方框稍后就会更新，算作一次撤销。**Image fit** 和 **Image position** 的作用与任何图片相同，**Replace with another tool or image** 会替换方框的内容。

**会动的工具**在方框内播放：循环的插画会在画布上持续循环，时间线打开后会跟随播放头，并逐帧导出为 GIF、MP4 或 WebM。当工具说明了一次循环持续多久时，方框会得到恰好那么长的片段，所以视频包含完整的循环。你重新调整过时间的片段会保留你的时间设置，关闭工具的动态效果则会让方框重新变回静态图片。

## 时间轴（Sequence）

**Sequence** 是 Design 的时间线：它为画布增加时间。每个方框都可以在某个时刻开始，持续一段时长，并带有入场和出场动画，停靠在画板下方的时间线就是你排布它们的地方。从 Design 的 **Video** 模板开始，已经有一个简短的序列：序列行上有两张定时文字卡，下方是程序化生成的配乐，所以在你改动任何东西之前，就能看出时间线如何工作。

![Sequence 的时间轴：传输控制条、标尺、一条叠加轨道、带片段与接缝标记的磁性序列行，以及常驻的 Always on 条](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

有两种行：

- **序列行**具有磁性。片段首尾相接，拖动一个会重新排列整个序列，删除一个会合拢空隙。这是主干。
- **叠加轨道**是自由的。下三分之一字幕、徽标或字幕会在主干之上按自己的时间浮动，各占一条轨道。
- 在它们下方，**Always on** 容纳没有时间设置、全程存在的方框。色块上的 `+` 会把它移到一条轨道上；**Make always on** 会把它送回去。

打开时间线会让它获得键盘，所以空格键和方向键控制播放头。已经有时间设置的作品会自动打开时间线。

**编辑。** 拖动片段中间可移动它，拖动靠近任一端可修剪它，按 **Split at playhead**（或 `S`）可把它切成两段。拆分需要一个有真实 **Length** 的片段，并且播放头位于其内部稍远处，所以像配乐这样没有终点的片段不能拆分。**Snap to edges** 默认开启，会吸附到片段边缘、播放头和整秒；按住 Alt 可不吸附地拖动。每次拖动算一次撤销，拖动时的预览使用与最终结果相同的算法。

选中一个片段，检查器会以数字形式提供同样的编辑：**Length**、**Trim in**（片段从源的多深处开始）、从 ×0.25 到 ×4 的 **Speed**、带有各自时长的 **Animate in** 和 **Animate out**，以及 **Mute clip**。磁性行上的片段没有 **Start** 字段，因为顺序由该行决定。

**转场**是预设：Fade、Pop、Grow、Rise、Drop、四种 Slide、Zoom in and out、Tilt、Swoop、Spin、Drift 或 **Cut (no animation)**。距离会随对象缩放，所以同一个预设在满幅卡片和小徽章上看起来都合适。在序列行上相邻的两个片段之间，**接缝芯片**可选择 **Cut** 或 **Crossfade**；再次打开它可设置 **Length (ms)** 并按 **Done**。在交叉淡化中，第一个片段在切点之后继续播放并淡出，同时下一个淡入，预览和文件中都是如此。

**声音。** **Audio** 片段像其他片段一样位于时间线上，带有波形、修剪和静音。Video 模板生成的配乐在导出时合成，所以在你渲染之前，它的条保持平直且无声。按下麦克风即可直接在时间线上**录制旁白**，带倒计时和电平表；录音会作为你自己的素材保存在播放头位置。麦克风旁边的摄像头按钮以同样的方式**录制视频**，录制时裁切到画板，所以同事可以通过分享链接添加片段。选中任何带声音的片段，它的音轨条会在时间线下方展开，用于音量、声像、均衡、音高、标准化和 **Voice cleanup** 之类的效果；序列编辑器指南中的[声音](/info/sequence-editor.html#sound)介绍了该音轨条。导出面板的 **Audio track** 是另一回事：整个片段下方的一条配乐，带淡入淡出和闪避。

![选中了音乐片段的时间轴：底部控制条依次是速度、淡变、音量、平移、EQ、音高、标准化音量和效果插槽](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**渲染。** 动态导出会在精确的时刻绘制、解码并编码每一帧，所以文件不取决于你的机器能否跟上，MP4 和 WebM 没有实际的帧数上限。除非你手动输入，否则时间线的长度决定时长，Content Credentials 的标记与任何其他导出相同。静态导出会给出播放头处的帧，或根据 **Frames** 字段生成的联系表；参见[来自定时作品的静态图](/info/exporting.html#stills-from-a-timed-composition)。序列上限为一小时。GIF 和动画 PNG 会把每一帧都保存在内存中，所以适合短片段。**Record live** 在这里被隐藏，因为逐帧渲染是更好的路径。

**关键帧、景深和摄像机。** 转场让片段在进入和离开时产生动画。若要在片段内为方框摆姿势（漂移、淡化、模糊、让它离开页面再落回），请选中该片段并按 **+Keyframe**：时间线工具中的菱形、画布对象栏上的菱形，或时间线获得焦点时按 **Shift+K**。播放头的位置决定你下一次编辑写入哪个姿势。同样的关键帧还能给定时作品加上推近、平移和拉焦的摄像机。[动画](/info/animating.html)是完整指南，[序列编辑器](/info/sequence-editor.html)涵盖选择、洋葱皮、拆分、修剪和标记。

## 导出之前

Design 会在你发送文件之前检查你的文档。Inspector 的 **Document** 部分和导出面板中的 **Before you export** 卡片会读取已保存的图层结构，然后检查稳定后的画布是否有被裁切的文字和纯色对比度。它会向 SVG 和 PDF 转曲所用的同一个字体注册表询问，每段文字是否有可嵌入的字体字节。图片和渐变背景会作为视觉检查项列出，而不会给出臆造的对比度分数。

### 对照设计系统检查作品

导出面板的卡片还会把作品与你的设计系统进行比较，使用的设计系统版本与渲染所用的相同。它检查自行设定的颜色、令牌别名、字体选择和图片素材 ID。自定义值可能是有意为之，而不在声明的品牌素材内的图片是待审阅项，而不是被禁用的图片。

在存在具体的颜色或字体建议时，其按钮只会更改那一个图层，**Undo** 可恢复原样。被锁定的或此后已更改的图层绝不会被旧的建议覆盖。渐变、效果、嵌套的工具内容、权利和主观质量都不在这项比较的范围内，并且没有任何检查会阻止 Download。

### 内部规则与文字信号

导出面板的卡片还会逐图层检查你的设计系统自带的内部规则，例如文字字重和对齐、认可的配色组合，或每个界面使用的徽标。每个发现都是一条警告，规则上方是图层名称。此版本没有检查器的规则会被列为未检查，绝不会被当作已遵守。[用法与规则](/info/brand-studio.html#usage-rules)列出了这些规则，`lolly check` 会对已保存的文档应用同样的规则。

同一张卡片还会显示文档所绘制文字的写作信号：它的等级（无、弱、明显或强），然后是 Verify 自己的一句话，附有满分 100 的得分，以及最多三个被标记的短语，每个都标明包含它们的图层。**Open the text in Verify** 会把该文字带到 [Verify](/#/verify) 做完整解读；[Verify 中的 AI 证据](/info/verify-ai-evidence.html)解释了得分的权重。得分是一种信号，而不是裁决：它统计生成式文字中常见的模式，无法判断谁写了这些文字。隐藏的图层不参与这两项检查，卡片会说明有多少个。

内部规则的发现和强烈的写作信号会计入卡片的 “to fix” 总数，便于查找。它们只提供信息，绝不阻止：Download 始终可用，也没有什么需要忽略或记录为例外。在打开的文档中工作的代理会通过其站点工具获得同样的报告（[打开文档中的代理](/info/open-document-agents.html)）。

当你开启 **Settings → Feature flags → Print preflight** 时，印刷检查（出血、分辨率、墨量覆盖和印版数）会加入同一张卡片。在其他工具中，该标志决定卡片是否会显示；[导出文件](/info/exporting.html)介绍了印刷检查。

## 演示

由画板组成的 Design 文档已经是一套演示稿。按顶部栏中的 **Present**，每个画板都会变成全屏幻灯片，顺序与画板在画布上的排列一致。在文档的 **Design outcome** 变为 **Slides** 之前，该按钮显示为 **Preview**。演示稿在渲染后的画板副本上运行，所以退出后你会回到原来的位置。

**Present** 旁边的箭头会打开 **Present from this slide**、**Speaker view**、**Present with camera**、**Narrate**、**Auto-advance slides**、**Loop the deck (kiosk)** 和 **Export slides as video**。

| 按键 | 作用 |
|---|---|
| **Space**、`→`、**Page Down** | 下一步或下一张幻灯片（或点击右侧边缘的条） |
| `←`、**Page Up** | 返回（或点击左侧边缘的条） |
| **Home**、**End** | 第一张或最后一张幻灯片 |
| `O` | 概览：按你画布上的排布显示每个画板；点击一个即可打开 |
| `S` | 演讲者视图：当前幻灯片、下一张幻灯片、备注和时钟，位于第二个窗口 |
| `B` | 黑屏；按任意键让幻灯片回来 |
| `F` | 返回全屏 |
| `K` | 暂停或重启自动循环的演示稿 |
| **Escape** | 退回一层：从概览到演示稿，从演示稿到编辑器 |

当你移动指针时，一个小控制栏会淡入，停止时再次隐藏。如果浏览器阻止了演讲者弹出窗口，演讲者视图会作为一块面板在演示稿上方打开。备注属于每个画板，绝不会出现在幻灯片上。

- **分步显示。** 右键点击一个方框，选择 **Reveal at step 1**、**2** 或 **3** 而不是 **Always visible**，该方框会等到你前进到它的步骤才出现。编号相同的方框一起出现。
- **自动循环播放。** 给画板设置一个 **Length**，演示稿就会停留这么长时间，然后在一条细进度条后前进。在链接中加入 `kiosk`，演示稿结束时会回到开头，适合电子标牌。
- **子幻灯片堆叠。** 右键点击画板并选择 **Stack under the previous slide**，使其成为那张幻灯片的一个步骤。概览只显示一张卡片，检查器的 **Stack** 行会说明该画板属于哪张幻灯片。
- **变形。** 当相邻的幻灯片都有一个具有相同 **Morph match** 名称（比如 `hero`）的方框时，转场会移动、缩放并重新着色该方框，而不是直接切换。整套演示稿范围的 **Morph** 转场会对每一对匹配的方框执行同样的操作。
- **配音。** 每个画板的 **Speaker notes** 都可以被朗读出来。在 Inspector 的 **Document** 部分选择一个 **Voice**，还可以选择第二种声音来 **Blend with**，并设置 **Speed** 以及以毫秒计的 **Lead-in** 和 **Tail**；**Show captions when presenting** 会在朗读时显示文字。声音在你的设备上运行，同样的备注会成为视频导出的配乐、PowerPoint 导出中的幻灯片音频，以及 [SCORM 包](/info/create/exporting.html#scorm-course-packages)中的配音影片。

演示稿同样是一个链接。`?present` 会直接进入演示稿，`s=` 选择幻灯片（位置、画板 ID，或用于构建步骤的 `id.step`），地址会跟随你变化，所以你发送的就是你所在的那张幻灯片。[保留的 URL 参数](/info/url-parameters.html#what-happens-on-open)记录了这些参数。

**Present with camera** 会把你的摄像头、徽标和姓名字幕放在幻灯片之上，带有私密控制项和已保存的场景；参见[带摄像头演示](/info/presenting.html)。当你在 **Web page** 方框的检查器中开启 **Make interactive** 时，它可以在演讲期间接管翻页笔：在其 **Focus on click** 步骤，上下键控制页面，而 Next 继续演示稿。[响应翻页笔的实时页面](/info/interactive-pages.html)介绍了焦点样式、滚动停靠点和站点批准。

## 接下来去哪里

- **[Design 中的文字](/info/text-composition.html)**：在画布上编辑文字、让文章流经文本框，以及排版。
- **[动画](/info/animating.html)**：关键帧、景深、场景摄像机和 Lift 图层。
- **[导入设计](/info/design-import.html)**：把 Figma、Penpot、Illustrator 或 InDesign 文件作为可编辑方框打开。
- **[带规则分享设计](/info/create-a-tool.html)**：把 Design 文档变成只含你所选输入项的工具。
- **[导出文件](/info/exporting.html)**：格式、尺寸、印刷单位和视频。
