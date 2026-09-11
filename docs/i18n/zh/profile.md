# 个人资料——创作时你的身份

**个人资料**是 Lolly 用以创建内容的工作身份。它是一小组工具可以调用的信息,让你不必每次都重新输入 - 你的姓名、联系方式、一张可选的头像照片、一些偏好设置 - 再加上你工作过程中积累的一切:已保存的会话、上传的图片以及本地活动统计。

个人资料中的一切都保存在**本地设备**上,存放在浏览器的本地数据库中(Web PWA 上使用 IndexedDB,Tauri 应用中使用文件系统)。没有账户,也不会上传任何内容。你可以在**个人资料**(图库右上角)中管理它;工具只会*读取*它,而且只读取它们被设计用来预填的特定字段。

> 个人资料关乎*你*(或任何在此创建内容的人)。它不同于**Platform** - 品牌的颜色、字体和全局设置 - 也不同于**Capabilities**,即应用能做什么的目录。参见文末的 [Profile vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities)。

## 个人资料中有什么

| 部分 | 内容说明 |
|---|---|
| **姓名** | 名和姓。 |
| **联系方式** | 邮箱和电话。 |
| **位置** | 城市和国家。 |
| **头像照片** | 一张可选照片,裁剪为正方形并保存为本地图片。供电子邮件签名、报价卡片、组织架构图和动态布局等工具使用。 |
| **Use my details to create** | 一个单一的选择加入开关(开启后显示为 **Using my details**)。它控制你的个人信息是否会作为**来源信息** - 嵌入导出文件中的作者/署名行 - 以及作为 **/pro** 批处理运行的作者信息一并附带。(它不影响预填充:参见 [工具如何使用你的个人资料](#how-tools-use-your-profile)。) |
| **偏好设置** | 你的主题(Light、Dark 或 Brand - 品牌主题会用你自己的调色板为应用上色)以及你通过**Feature flags** 启用的应用部分。 |
| **无障碍** | 四个舒适度开关 - *Reduce motion*、*Hide colourful previews*、*High contrast*、*Large text* - 保存在个人资料记录中,因此会随个人资料一起导出。参见 [无障碍](#accessibility)。 |
| **你的工作内容** | 已保存的会话(带缩略图) - 在 **[Projects](/info/using.html)** 中组织为嵌套文件夹 - 你的 **My images** 图库以及本地活动统计,全部与此个人资料关联。 |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![个人资料页面 - 姓名、联系方式、一张可选头像照片以及你的偏好设置](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

以上都不是必填项。一个空白的个人资料本身就是完全可用的;你只需填写能替你省去重复输入的部分。

这个页面很长,因此在侧边带有自己的**设置导航栏** - Your details、Appearance、Accessibility、Lolly instance、Your activity、Storage、Available offline、Feature flags、Content Credentials - 上方还有一个 **Search settings** 输入框,随着你的输入实时过滤列表。每个部分都可以通过 `#/profile?focus=<section-id>` 形成深层链接,打开该部分并将其滚动到可见位置(例如 `#/profile?focus=storage-section`、`?focus=feature-flags-section` 等),因此一个链接可以直接指向某一项设置,而不只是页面顶部。

![三张主题卡片,各自预览自身的字体和颜色,当前使用的那张会被标出](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## 个人资料是一种情境,而不仅仅是一个人

“个人资料”这个词让人联想到一个固定不变的人,但在 Lolly 中,它其实是一种**创作情境**——*你在制作这件作品时是谁*。这种情境可以呈现三种不同的形态,Lolly 对待它们的方式完全相同。

### 作为个人

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![头像控件,在你上传照片之前为空,上传后照片会保留在此设备上](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### 作为团队

个人资料不必对应单个人。它可以代表**组织内的一个团队或职能部门**:团队的共用名称、一个群组收件地址(`events@…`)、某个部门、团队的头像或标志。一个人设置好并导出它(见下文),团队其他成员加载同一个个人资料 - 这样团队产出的一切都携带一致的信息,而不需要任何人重新输入。共享的信息亭或借出的演示笔记本电脑可以运行同一个团队个人资料,让每个使用它的人都以此身份创建内容。

### 作为一种职能——你偶尔扮演的角色

这正是死板的“一人一份个人资料”模式所忽略的情况。你可能**一年中有三天是活动经理**,其余时间则完全是另一个身份。这三天里,你需要活动的详细信息、活动收件地址,或许还有一个活动子品牌来填充你的徽章和标识牌;其余 362 天,你想恢复平时的身份。

在 Lolly 中,这个角色只是**另一份随手可用的个人资料**——一个已保存的资料包(见下一节),你在活动时加载它,结束后放到一边。这个角色是一顶帽子,而不是一个新账户。需要时戴上,用完就摘下。

## 一次安装,一个活跃的个人资料——但你可以保留多份

在任意时刻,一个安装只有**一个活动个人资料** - 也就是工具此刻能看到的信息。应用内没有个人资料切换器;取而代之的是,每个个人资料都是一个**可移动的包**(一个 `.zip` 文件,参见[下文](#moving-a-profile-to-a-new-device))。这是刻意与迁移到新设备使用相同的机制 - 个人资料就是一个可以保存、复制和加载的文件。

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **最干净的切换方式:** **Profile → Storage → Clear all my data**,然后 **Import** 你即将进入的那个场景所对应的包。此后你就是纯粹以那个个人资料在创建。
- <!--i:layers--> **叠加:** 不先清空就导入会**合并** - 导入的个人资料、会话和图片会叠加在已有内容之上,覆盖同名的内容,保留其余部分。适合把某个团队已保存的会话拉进你自己的环境;但如果你需要一个干净的角色边界,这就不是你想要的做法。
- <!--i:monitor--> **并行共存:** 由于一切都限定在设备范围内,一个独立的浏览器 profile、一个独立的用户账户,或者第二个安装的 PWA,各自都会拥有自己独立的 Lolly 个人资料。你可以同时运行个人安装版和活动信息亭安装版,无需切换。

所以,如果你确实需要在多个情境之间切换(你自己、你的团队、活动经理这顶帽子),就保留多个资料包,需要哪个就加载哪个:

![存储用量表,将已保存的会话、图片和缓存与浏览器实际报告的用量进行对比拆分](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> 为每个情境保留一个资料包,并按其用途重命名文件(`LollyTools-events-2026.zip`、`LollyTools-me.zip`)。这个文件*就是*个人资料。

## 无障碍

**Profile → Accessibility** 中有四项舒适度设置,作用于你工作*周围*的应用界面。每一项在你开启之前都是关闭的,而且它们都不会深入到工具画布或导出文件内部 - 一个更平静的应用界面绝不能移动你交付文件中的任何一个像素。

- <!--i:film--> **Reduce motion** - 关闭应用中的过渡效果、滑动和动画点缀。你的工具画布以及任何动画导出仍会按设计效果运行。
- <!--i:image--> **Hide colourful previews** - 将图库预览图替换为平静的图标加文字卡片,并降低项目缩略图的颜色与对比度,使其在不刺眼的同时依然可辨识。在工具内部,一切仍以全彩显示。
- <!--i:sliders--> **High contrast** - 加强应用的边框、文本和焦点环。你的品牌颜色以及画布上的一切都保持你设定的样子不变。
- <!--i:font--> **Large text** - 放大应用文字:标签、菜单和按钮文本。控件本身的尺寸不变,只有其中的文字变大,你设计中的文字不受影响,因此导出内容不会重新排版。

这些设置保存在个人资料记录本身之中,因此它们会随个人资料一起导出,并在下一次安装时与你的姓名和会话一并落地。(设备上还保留一份小型本地镜像,以便设置能在首次绘制前就生效;这份镜像仅限本设备,不会随之迁移。)

## 你的 Lolly 实例

**Profile → Lolly instance** 说明此次安装从何处获取工具和目录 - 实例地址,或者当一切都随构建内置时显示为 *Bundled with this app*。如果某个部署提供了管理入口,**Instance console** 链接会打开其管理界面,**Change** / **Disconnect** 可以重新指向该安装或将其断开。

重新指向另一个实例需要使用**桌面应用**:浏览器会阻止页面跨源加载工具和资源,因此在网页版中,该部分只会显示你当前所在的位置,仅此而已。

## 离线可用

Lolly 会随着你的使用逐步缓存内容,但这种边用边缓存的方式只能覆盖你已经去过的地方。**Profile → Available offline** 是为你能预见到的行程准备的:比如登机前在机场 WiFi 下的一小时,而航班上则完全没有网络。下载你需要的部分,盯着一条进度条看完,断网之后你下载过的一切依然可以正常使用。

共有七个部分,每一项在你确认下载前都会先列出所需容量:

- <!--i:layout--> **The app** - 每一个视图、编辑器和字体,包括你还没打开过的那些。没有它,你在联网状态下从未访问过的界面在离线时也无法加载。
- <!--i:image--> **Catalogue** - 基础资源之外的品牌素材。可以全部下载,也可以打开 *Choose by tag*,只下载你会用到的标签。
- <!--i:book--> **Guides & docs** - 本文档站点,使用你的语言,含截图。
- <!--i:cpu--> **Speech voices** - Script 音频和旁白背后的语音模型。只需下载一次,之后在设备本地运行。
- <!--i:zap--> **Upscaling models** - AI 图像放大模型:照片、插画/动漫和人脸。
- <!--i:layers--> **Background removal** - *Remove background* 背后的设备本地抠图模型。
- <!--i:shield--> **Verify deep scan** - 设备本地的水印扫描器,用于在没有网络连接时检查 Content Credentials。

最后四项标注为**大型下载**,它们是刻意分开的独立选项:顶部的**下载全部**会一次性获取应用、你选择的目录范围、文档和所有工具,仅此而已。语音、放大工具、背景移除和深度扫描各自只有在你按名点选那一行时才会下载 - 把数百兆隐藏在一个按钮里是不诚实的。

在这些部分下方是逐工具列表:每个工具可单独下载(打勾表示可离线使用),或者用**全部下载**一次扫清。下载是可续传的 - 取消或断线后,下一次会从中断处继续,只补齐缺失的部分 - 并且在你重新联网时会自动刷新,只拉取新版本改动的内容。

如果浏览器尚未授予持久化存储权限,该区域会说明这一点,并提供**保护下载内容**按钮来申请权限 - 这是“已下载”与“下载但浏览器随时可能收回空间”之间的区别。

## 将个人资料迁移到新设备

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

由于个人资料完全保存在本地,要把它带到一次全新的安装——一台新笔记本电脑、一个刚重置的浏览器、同事的电脑、一台离线设备——唯一的方法就是**携带这个文件**。没有登录能替你恢复它,而这正是重点所在:从一开始就没有任何东西离开过你的设备。

- <!--i:download--> **导出我的数据**会下载一个 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - 以所属档案命名,并带有按日的序号,避免重复导出冲突(档案缺少的部分会在文件名中省略)。其中包含你的档案、每一个已保存的会话(含缩略图)、你上传的图片 - 你的品牌令牌和已安装字体也作为用户资产一并打包 - 以及你的偏好设置(主题、布局、本地活动统计)。
- <!--i:upload--> 在另一台设备上用**导入数据…**读取该文件,即可原样接续。
- <!--i:box--> **导出我的数据并渲染全部**会写出同样的备份,*外加*第二个 zip,其中把每个已保存的会话都渲染成最终输出文件,目录结构与你的项目一一对应。这是源文件与结果的完整离线归档 - 会话较多时可能体积大、速度慢。

![移动整个安装内容的两个按钮:导出我的数据写出一个 zip,导入数据将其读回](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

这个资料包是一个普通的、自包含的 zip 文件,因此可以通过**任何**方式传输——U 盘、AirDrop、网络共享、发邮件给自己——目标设备也可以完全离线。每个部分都经过校验,因此传输中损坏的文件会在导入时被发现,而不会以半损坏状态被恢复。导入会**合并**(同名的个人资料/会话/图片会被覆盖;其余全部保留),所以它绝不会清空一个已在使用中的目标设备。

不会随行的内容:目录缓存(会在新设备上自动重新下载)以及工具本身(假定已经存在)。

关于具体的包结构、版本策略和完整性规则,参见**[数据传输](/info/data-transfer.html)**;完整的操作步骤见**[使用 Lolly → 迁移到另一台设备](/info/using.html#moving-to-another-device)**。

## 工具如何使用你的个人资料

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

工具只会*预填*它被明确设计用来绑定的个人资料字段:

**可选项(来源信息)。**当你导出资产时,你的信息可以选择性地随附为**来源信息** - 一条嵌入文件元数据(PNG、PDF、SVG 等)的作者/署名行 - 让完成的资产能说明是谁制作的。**使用我的信息进行创建**管理的正是*这一项*:关闭它,导出仍会带有“Made with Lolly”的工具/平台署名,但不会嵌入个人作者/联系方式行。(同一开关也决定 **/pro** 批处理运行的作者信息。)(工具作者请参见[编写工具指南 → `bindToProfile`](/info/authoring-tools.html#bindtoprofile)和[Host API → `host.profile`](/info/host-api.html#host-profile)。)

![单个“使用我的信息进行创建”开关,位于保存档案旁,默认关闭直到你手动打开](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## 个人资料 vs 平台 vs 功能

界面中有三样东西彼此靠近,容易混淆:

- <!--i:people--> **档案** - *你*(或你的团队,或你所扮演的角色):姓名、联系方式、头像、你保存的作品。个人的、设备本地的、可作为一个包整体迁移。
- <!--i:palette--> **平台** - *品牌*:每个工具渲染所依据的颜色、字体和全局设置。共享且一致,不是个人的。
- <!--i:sliders--> **能力** - *应用能做什么*:完整功能集与你可用的工具。

个人资料决定一份资源*来自谁*;平台决定它*看起来是什么样*;功能决定*你能做出什么*。

### “个人资料”一词在别处另有两种含义——都不是这一种

这个词在整个项目中被反复借用。以下两者都不是本页所讲的个人资料:

- <!--i:box--> **内容配置文件** - `profiles.json` 中的一项构建期配置,将一组工具包绑定到某个品牌目录(例如 `suse`、`lolly-start`)。这是运营者部署时的选择,也是 `profile` **URL/CLI 参数**在导出时选择*颜色*变体的依据(ICC/CMYK 印刷条件 - 参见 [URL 模式](/info/url-mode.html))。二者都关乎*构建/输出*,而非*你本人*。参见[配置](/info/configuration.html)。
- <!--i:seal--> **身份档案** - 你可以选择注册的**已验证 Content Credentials 身份**(一份将你的邮箱与你签名的导出内容绑定的短期证书)。这是一种签名身份,与个人档案中的姓名/联系方式字段是分开的,不过**使用我的信息进行创建**决定二者是否被嵌入。参见 [Content Credentials 身份](/info/content-credentials-identity.html)。

![已验证身份卡片,手机宽度视图:证书有效期选择器及其下方的注册步骤 - 身份档案,与你的个人信息分开](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## 隐私

除了上面这项可选的身份注册(会把你注册用的邮箱发送给证书服务 - 参见[服务器层面](/info/server-surface.html))之外,档案信息永远不会被传输、上传或用于识别、追踪你 - 没有什么需要你同意,这里只是让你了解保存了什么。可随时用**档案 → 清除我的所有数据**将其全部清除。参见[隐私政策](/info/privacy.html)。
