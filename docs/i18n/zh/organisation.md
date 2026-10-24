# 在你的组织中使用 Lolly

你的组织可以运行自己的 Lolly：同一个应用，使用它选定的工具和设计系统。本页介绍如何访问它、如何登录，以及登录后有什么变化。

::: note 你需要从组织获取的信息
它的 Lolly 网址，或者你的组织制作的 `.lolly` 设置文件。lolly.tools 本身不会连接到某个组织。
:::

## 在浏览器中

打开你的组织给你的地址。如果页面要求你登录，请按 **Sign in**，并按它打开的登录页面操作。之后它就像任何 Lolly 一样运作，使用你所在组织的工具和设计系统。

你也可以从 lolly.tools 开始：打开 **Settings**，在 **Lolly instance** 卡片上按 **Open a workspace**，输入地址并按 **Open this instance**。浏览器会前往你所在组织自己的地址，因为浏览器无法从 lolly.tools 加载另一个 Lolly 的工具。

![Settings 中的 Lolly instance 卡片，你可以在这里打开所在组织的工作区，或更改应用获取工具的来源](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## 在桌面版或移动版应用中

应用启动时使用其内置工具。要连接，请打开 **Settings**，在 **Lolly instance** 卡片上按 **Change**。弹出的面板会问 **Where should Lolly get its tools?**

1. 选择**连接到 Lolly 实例**。
2. 输入你的组织的网址，然后按**检查并连接**。
3. 按**使用此实例**。接下来的界面**导入你的数据（可选）**会把已保存的作品从 Lolly 备份中带过来；如果没有，按**跳过**。
4. 如果应用要求，请登录。

来自已连接实例的工具，运行时享有和应用自带工具同样的信任级别，因此只连接你信任的实例。你的组织也可能改为向你发送一个 `.lolly` 设置文件，替你完成应用的连接。

之后要切换，再次使用 **Change**，或使用同一张卡片上的 **Leave**。

### 使用验证码登录

在桌面和移动应用中，如果你所在组织的 Lolly 支持验证码登录，登录屏幕还会提供一个简短的验证码。按 **Open sign-in in browser**，在那里登录并批准验证码。或者在你已登录的手机或电脑上打开它显示的地址，输入验证码。验证码大约十分钟有效。

## 那里有什么不同

- **有些控制项已为你设定。** 由你所在组织管控的控制项会显示 **Managed by** 和组织名称，或 **Managed by your organisation**。固定的控制项不能更改，菜单可能只提供其部分选项，以 **Set by** 开头的一行可以说明适用哪条规则及原因。有些控制项根本不显示。
- **有些设计系统被锁定。** 由你所在组织提供的设计系统会显示一把锁并保持只读。要尝试更改，请在 **Settings → Preferences → Design systems** 中创建一个可编辑的副本。
- **只列出它的工具。** 你所在组织不提供的工具根本不显示。
- **共享项目。** 如果你所在组织与你共享项目，**Projects** 会显示一个 **Team projects** 方块。这些会话存放在组织的服务器上。打开其中一个即可在上面工作，或在可用时从 **Share** 发起一个[工作协作](/info/collaborate.html#work-collabs-with-lolly-work-optional)。
- **有些导出可能需要批准。** 在你所在组织要求批准的地方，**Request approval** 会取代 **Download**，工具提供的格式也可能更少。

### 什么留在哪里

::: cols
## 在这台设备上

- 你自己的保存内容，除非你开启[同步](/info/sync.html)
- 你自己创建的设计系统
- 你制作并下载的一切

## 在你所在组织的服务器上

- 你的登录身份和设备信息
- 团队项目、共享会话以及工作协作中的实时编辑
- 你上传到共享库的素材
- 审批请求和已批准的交付
- 使用事件，如果你所在组织开启了它们
:::

[隐私](/info/privacy.html#organisation-services-with-lolly-work)列出了服务器存储什么，以及谁控制这些数据。

## Lolly Work 增加了什么

你所在组织的服务器运行 **Lolly Work**，这是同一开源项目的组织版软件。你自己使用应用时，既不需要工作账号，也不需要 Lolly Work。

::: details Lolly Work 可以增加什么
你的组织在 Lolly 旁边托管 [Lolly Work](https://github.com/lolly-tools/lolly-work)，并选择开启哪些功能：

- **登录与访问。** 组织单点登录、基于组的权限和受管理的个人资料字段。管理员可以通过 SCIM 开通和停用账号。
- **共享作品。** 团队项目、共享会话和[工作协作](/info/collaborate.html#work-collabs-with-lolly-work-optional)，通过组织的服务器进行实时编辑。
- **共享素材库。** 上传的素材、集合和已连接的库，带有访问规则、版本和审阅。
- **审阅与交付。** 审批步骤、带有效期或可撤销的受管理链接，以及交付到组织允许的目的地。
- **管理。** 按实例的遥测政策进行使用情况报告，外加受管控操作的审计记录。

如果你正在设置该服务，请从[部署](/info/deployment.html#organisation-services-with-lolly-work)开始。[lolly.work](https://lolly.work) 上的公开演示是一个沙盒；对于需要保留的工作，请使用你所在组织自己的地址。
:::

## 离开

**Settings** 中 **Lolly instance** 卡片上的 **Leave** 会移除你所在组织的设计系统、工具和目录。你自己的作品会保留。用它的工具制作的任何内容，在你重新连接之前都无法再打开。

你保存到组织的任何内容都留在组织那里，适用其访问和保留政策。离开或清除这台设备不会删除服务器上的那份副本。在你所在组织自己地址的浏览器中，没有什么可以离开：请改为打开另一个地址。

## 该问谁

什么内容会到达你组织的服务器、谁能看到其共享项目、哪些设置是固定的，这些都由你的组织决定。请询问负责运行你组织的 Lolly 的人。[隐私](/info/privacy.html)说明了 Lolly 本身如何处理你的数据。
