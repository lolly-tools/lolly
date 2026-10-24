# 个人资料

设置一次你的姓名、联系方式和头像，每个设计为使用它们的工具都会替你填好：电子邮件签名、证件、演讲者卡片。这条小小的记录就是你的**个人资料**，它存放在你的设备上。

你的个人资料还保存着你工作时积累的内容：已保存的会话、上传的图片和本地活动统计。你在 **Settings → Preferences** 下管理它；工具只会读取它们设计为预填的字段。独立使用不需要账号，可选的同步、分享和组织服务各有自己的数据流，下文有述。

## 个人资料中有什么

| 部分 | 它是什么 |
|---|---|
| **Name** | 名和姓。 |
| **Contact** | 电子邮件和电话。 |
| **Location** | 城市和国家。 |
| **Headshot** | 可选的照片，裁剪为方形并作为本地图片保存，供电子邮件签名、引语卡片和组织架构图等工具使用。 |
| **Use my details to create** | 一个选择加入的开关（开启后显示为 **Using my details**）。它决定你的详细信息是否作为作者署名随导出的文件和 Batch 运行一起传出。它不影响预填；参见[工具如何使用你的个人资料](#how-tools-use-your-profile)。 |
| **Preferences** | 你的主题、无障碍设置，以及你在 **Feature flags** 中开启了应用的哪些部分。 |
| **Your work** | 已保存的会话及其缩略图，整理在 [Projects](/info/find-your-work.html) 中，还有你上传的图片和本地活动统计。 |

这些都不是必需的。空白的个人资料也能用；只填写能让你少打字的内容。

![Preferences 标签页上的 Settings：设置栏，以及带有 Use my details to create 开关和姓名、联系方式、位置字段的 Your details](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[设置](/info/dashboard.html)梳理了 Preferences 下的其他一切，从外观和 emoji 到存储和离线下载。

## 你、团队或角色

“个人资料”这个词暗示着一个固定的人。在 Lolly 中，它更接近一种创作情境：你制作这件东西时是谁。它可以有三种形态，Lolly 对每一种都以同样的方式处理。

::: cols
## 以你自己

默认形态。你的姓名、电子邮件、头像。设置一次，你的签名、证件和会议标识就会自动填好。

## 以团队

团队共用的名称、`events@…` 这样的群组收件箱、部门和团队标志。一个人设置并导出，其他人加载同一个个人资料，所以团队的文件携带一致的详细信息。共用的展台或演示笔记本电脑可以运行一个团队个人资料。

## 以角色

活动经理一年有三天需要活动收件箱和活动子品牌出现在证件和标牌上，之后再换回平常的身份。把这个角色保存为一个个人资料文件，活动期间加载它，之后收起来。
:::

![头像控件,在你上传照片之前为空,上传后照片会保留在此设备上](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details 使用 Lolly Work 的组织中的个人资料
当你登录[组织的 Lolly](/info/organisation.html)时，Lolly Work 可以从其身份提供方提供经过验证的个人资料字段，并按组织政策固定某些字段或偏好设置。受管理的字段在应用中会有标注。

该登录同时也控制对共享项目和素材的访问。团队个人资料文件仍然只是本地文件：它不授予组织成员身份，也不能取代工作账号。**Use my details to create** 控制的是你导出内容中的署名，而不是组织的登录或审计记录。参见[隐私](/info/privacy.html#organisation-services-with-lolly-work)。
:::

## 保存多个，使用一个

一次安装在同一时间只有一个活动的个人资料，应用内没有切换器。取而代之的是，每个个人资料都是一个可迁移的文件，就是你迁移到新设备时所用的同一个备份文件。要进入另一个情境：

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device** 下的 **Export my data** 会把当前个人资料保存为一个 `.zip`。
- <!--i:trash--> **Clear all my data** 清空这次安装。
- <!--i:upload--> **Import data…** 加载你要进入的情境所对应的个人资料文件。
:::

不先清空就导入会改为**合并**。导入的会话和图片会被添加；两份副本都存在时，保留保存时间较晚的那份。文件夹、收藏和模板会添加在你的旁边，你自己的详细信息保持不变，空字段除外，它们会采用文件中的值。这适合把某个团队的会话拉进你自己的环境，但不适合在不同角色之间做干净的切换。

若要同时使用两个情境，请使用单独的浏览器个人资料、单独的用户账号或网页应用的第二个已安装副本：每一个都有自己独立的 Lolly 个人资料。

![迁移整个安装的两个按钮：Export my data 写出一个 zip，Import data 把它读回来](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> 每个情境保留一个文件，并按其用途命名，例如 `LollyTools-events-2026.zip` 和 `LollyTools-me.zip`。这个文件就是个人资料。

[把你的作品迁移到另一台设备](/info/find-your-work.html#move-your-work-to-another-device)介绍了文件包含什么、什么会留下，以及包括同步在内的其他迁移方式。

## 工具如何使用你的个人资料

**预填。** 工具作者把某个输入项标记为取自你的个人资料（`bindToProfile: "firstname"`、`"email"`、`"headshot"` 等）。工具打开时，该输入项会从你的个人资料填充，你可以在一次会话中覆盖它而不更改个人资料，除非组织政策锁定了该输入项。预填是本地的便利功能，无论 **Use my details** 是否开启都会发生。

**署名。** 导出时，你的详细信息可以作为作者署名写入文件的元数据（PNG、PDF、SVG 等），这样成品文件可以说明是谁做的。**Use my details to create** 控制这一点，以及 Batch 运行中的作者。关闭后，导出仍会说明它是用 Lolly 制作的，但不带个人作者或联系方式。

工具作者：参见 [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) 和 [`host.profile`](/info/host-api.html#host-profile)。

![唯一的 Use my details to create 开关，标记为选择加入，在你开启之前处于关闭状态](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## 个人资料、设计系统和能力

有三样东西在 Settings 中彼此相邻，很容易混淆：

- <!--i:people--> **Profile** - 你、你的团队或你所处的角色：姓名、联系方式、头像和已保存的作品。个人的，保存在设备上，可作为文件迁移。
- <!--i:palette--> **Design system** - 品牌：每个工具渲染所用的颜色、字体和设置。共享且一致，而不是个人的；参见 [Design System Setup](/info/brand-studio.html)。
- <!--i:sliders--> **Capabilities** - 应用能做什么：提供给你的功能和工具。

个人资料改变文件来自谁；设计系统改变文件看起来如何；能力是你可以制作什么。

这个词在 Lolly 中还有另外三个含义。**内容配置文件**是一个构建设置，选择某个部署附带哪些工具和目录；[术语表](/info/glossary.html)定义了这个术语。`profile` 链接参数为导出选择颜色配置文件，例如 CMYK 印刷条件；参见[保留的 URL 参数](/info/url-parameters.html#print)。**已验证身份**是可选的签名证书，把你的电子邮件与你签名的导出绑定，与这些详细信息是分开的，不过是否嵌入其中任何一个由 **Use my details to create** 决定；参见 [Content Credentials](/info/content-credentials-identity.html)。

![已验证身份卡片,手机宽度视图:证书有效期选择器及其下方的注册步骤 - 身份档案,与你的个人信息分开](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## 隐私

你的个人资料存储在本地。你的详细信息可以出现在备份或同步副本中、你分享或导出的内容中，以及可选的 Content Credentials 注册过程中。在 Lolly Work 实例上，登录、共享作品、遥测政策和审计记录与这份本地个人资料是分开的。**Settings → Preferences → Clear all my data** 会清除这台设备；它不会删除你的存储提供方或组织持有的副本。参见[隐私政策](/info/privacy.html)。
