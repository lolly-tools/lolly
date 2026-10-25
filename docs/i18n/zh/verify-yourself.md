# 自行验证

本站的每一项承诺都可以在没有账号的情况下检验。大多数检查只需要浏览器；其余需要终端和一份源代码。如果下面的某项检查没有得到所示的结果，那就是一个缺陷或一项被打破的承诺，我们希望听到你的反馈：参见[如果检查失败](#if-a-check-fails)。

从最快的开始：把文件拖到 Verify 上。然后再深入一步：使用工具时观察网络，拔掉网线继续工作，数一数 Cookie，阅读源代码。

这些检查针对的是 Lolly 本身。如果你所在组织运行 Lolly Work，它会增加登录、共享内容、已配置的遥测和审计记录；请对照[服务器层面](/info/server-surface.html)和[隐私政策的组织部分](/info/privacy.html#organisation-services-with-lolly-work)检查这些内容。

## 十秒钟看它如何运作

打开 [`/verify`](/#/verify) 并把文件拖到页面上。没有上传，没有账号，也无需等待服务器。这里检查的是我们 AI 立场中的[生成的昆士兰风暴](/info/ai-stance.html)：一张由 Gemini 生成、再经 Lolly 打开、标记并转换的图像。每个徽章都是在设备上根据文件自己的字节得出的。

![手机宽度屏幕上的 Verify - 风暴图像、绿色的 Made with Lolly 判定,以及下方叠放的凭证完整和字节未变徽章](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

结论是一小堆徽章，每个都是独立的事实：

- <!--i:lock--> **Made with Lolly**：凭据完好，*并且*记录了 Lolly 的导出。
- <!--i:seal--> **The credential is intact**：签名的 C2PA 清单可解析，且其自身的声明签名验证通过。
- <!--i:hash--> **The bytes have not changed**：文件的哈希仍与签名时一致。改动一个像素，这个徽章就会翻转。
- <!--i:sparkle--> **GEN AI**：这些像素由机器制作，文件也这样声明。Lolly 会把该声明读回来，而不是隐藏这一事实。

完整的历史随文件一起传递。这里保留了九个步骤：Google 在生成并为图像加水印时记录的五步，以及 Lolly 在这个页面上打开、标记并转换副本时记录的四步。Verify 直接从字节中读出它们，并画成时间线。

![Verify 从风暴图像中读回的变更历史 - 五个步骤由 Google 记录,随后四个由 Lolly 记录,最终形成本页面中的 WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

这就是演示。下面的检查是它背后的保证，每一项都可以复现。[Content Credentials](/info/content-credentials-identity.html)解释了每一个结论。

## 在浏览器中,无需任何工具

::: timeline
- <!--i:globe--> **1. 观察网络。** 打开 [lolly.tools](https://lolly.tools)，打开浏览器的 DevTools（F12），切换到 **Network** 并使用一个工具：在 [QR Code](/t/qr-code) 中输入网址、更改颜色、导出 PNG。每个请求都留在 `lolly.tools` 上：应用外壳、工具自己的文件和目录素材。没有分析主机，没有 CDN 信标，没有字体服务，也没有错误上报端点。你在工具中输入的内容**不会出现在任何请求中**，因为渲染是在本地进行的。
- <!--i:eyeoff--> **2. 拔掉网线。** 加载应用并打开一两个工具，然后断开网络（飞行模式，或 DevTools → Network → Offline）并重新加载。图库和你打开过的每个工具都继续工作，包括你用过的格式的渲染和导出。工具的文件和格式的编码器会在你第一次使用时缓存，所以在离线测试之前，请先在联网时使用一次该工具。这是本页上最有力的单项检查：向外回传数据的软件，被切断连线后就活不下去。
- <!--i:check--> **3. 数一数 Cookie。** DevTools → **Application**（Firefox：**Storage**）→ Cookies → `https://lolly.tools`。列表是空的：应用不设置 Cookie。把 `document.cookie` 粘贴到控制台，得到的是 `""`。可选的 CA 注册会设置一个短期的 `HttpOnly` Cookie `lolly_ca_state`，范围限定为 `/api/ca`，`document.cookie` 看不到它。Lolly Work 实例使用它自己的登录 Cookie；请与[隐私](/info/privacy.html#organisation-services-with-lolly-work)对照。
- <!--i:layers--> **4. 读取你自己的存储。** 在同一个面板中，Lolly 保存的一切都摆在你面前：二十几个普通的 `localStorage` 键（主题、语言、侧栏宽度、声音和视图设置，以及公共工具目录索引的缓存副本）和你在 IndexedDB 中的文档。每个值都是可读的字符串或 JSON，没有任何混淆。清除网站数据会移除这些本地记录，但不会移除 Sync 备份或 Lolly Work 实例持有的记录。**Settings → Storage → Clear all my data** 在应用内部做同样的事，你可以看着存储和缓存被清空。
- <!--i:lock--> **5. 检查披露联系方式存在。** [`/.well-known/security.txt`](/.well-known/security.txt) 返回的是 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 联系信息块，而不是 HTML 页面。
:::

::: details 你在 Network 标签页中还可能看到什么
有些功能只在你使用时才访问网络，每一项在同一个标签页中都可见：

- 在 Design System Setup 中添加 **Google Font** 时，会在首次获取之前出现一个说明此事的同意对话框，然后只从 Google 获取那一个字体家族；
- 点击 **ICC press-profile preset** 会从 ICC 位于 color.org 的公开注册库获取该配置文件；
- 播放可选的内置**电台**会从电台串流；
- 在 **Meeting Planner** 中输入地点，会向 open-meteo 的地理编码服务查询该地点的坐标和时区，每个城市一次（答案保存在你的设备上），输入框在你输入的地方也这样说明；
- **URL Screenshot** 会加载你输入的地址，因为这就是它的工作，你可以看着它发生。

声明了网络能力的工具只能从其清单允许列表中的主机获取，该检查失败时会安全关闭。目前出货的工具没有一个声明此能力，所以由浏览器强制执行的 Content-Security-Policy 把上面的列表限制在它的主机上。[隐私政策](/info/privacy.html)保存着所有这些的规范表格，包括受管理实例的流量，例如策略刷新和已启用的报告。
:::

## 在终端中

**6. 渲染端点只返回公开数据。** 唯一把输入的内容放进 URL 的服务器功能，即热链接渲染，在这里是启用的。[隐私政策](/info/privacy.html)说明了这对你放进链接的输入意味着什么。

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

每个部署各自选择（`LOLLY_DISABLE_RENDER_GET=1`）：在设置了它的实例上，同样的探测返回 `404`。这个差异是该设置在起作用，而不是不一致。

**7. 检查你的部署启用了哪些服务。** [服务器层面](/info/server-surface.html)列出了可选服务并链接到它们的详细参考。对于 Lolly Work，请包括它的认证 API、协作连接、存储和已配置的提供方。对公开的 lolly.tools 的探测不能测试私有的组织实例。

如果你运行自己的实例，[交付部署](/info/deploy-delivery.html)提供了针对它的发布检查：模型完整性、边缘探测及其样本列表、展示用渲染版本、私密下载网关，以及浏览器中的签名目录。


## 在源代码中

如果部署的代码与公开的代码不同，以上所有检查仍可能只是做做样子。所以请检查代码。部署是从[公共仓库](https://github.com/lolly-tools/lolly)构建的：

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 任何地方都没有跟踪器，也没有分析 SDK。** 在发布的代码（引擎、包括浏览器扩展在内的每个外壳、Tauri 桥接覆盖层和 service worker、服务器函数以及工具包）中搜索常见的嫌疑对象：

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

这次扫描查找的是第三方跟踪 SDK。它并不表明不存在第一方使用情况报告：Lolly Work 支持组织遥测和单独的审计日志，它们有各自的政策和测试。

**9. 没有第三方 DNS 解析器。** Verify 的 SEAL 检查从不通过 DNS-over-HTTPS 提供方发送查询，因为应用没有解析器：

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 证书服务不保留签发日志。** 身份 CA 不记录它签发了什么，也没有身份清单：没有 stdout 行，没有 webhook，没有证书存储。这种缺失可以搜索到：

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA 确实保留短期的工作状态：限速桶在其窗口内保存哈希后的 IP 和电子邮件键，受管理部署的准入存储最多十分钟保存一个带密钥的标识符和请求摘要。[Content Credentials 工程](/info/content-credentials-engineering.html#protocol)有详细说明。

## 由测试强制执行

上面的源码检查不是一次性的审计：它们被固定在测试套件中，所以不会悄悄失效。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) 检查的跟踪器名称列表比上面的扫描更长，并在以下情况下让构建失败：

- 任何分析或跟踪 SDK 出现在它扫描的发布源码的任何位置，涵盖应用、引擎、服务器、扩展和工具包代码；
- 任何第三方 DNS-over-HTTPS 解析器出现在该源码中；
- CA 签发日志重新出现，无论是在源码中**还是**生成的服务器包中；
- 隐私政策失去其法律要求的声明（具名的控制者、法律依据、投诉权）。

在克隆中自己运行它们（Node 22.18 或更高版本；此文件无需 `pnpm install`）：

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

完整测试套件(`pnpm install && pnpm test`)会额外运行数千个测试,包括[安全与验证](/info/security.html)中描述的对抗性密码学测试。

## 你无法从外部验证的内容

- **托管访问日志。** 任何响应请求的服务器都可以记录它：IP 地址、路径和时间。外部探测无法确定日志保留多久。运营方控制日志记录、轮转和导出，并且必须披露这些选择。本地渲染让普通编辑留在你的设备上；可选的服务器渲染和共享工作区服务有隐私政策所述的单独数据流。
- **部署运行的是否就是这份代码。** 你可以检查源码是干净的，也可以检查部署的行为与之相符，上面的检查两者都做到了。对网页部署进行二进制层面的证明，不是网页平台提供的东西。缓解办法是公共仓库、强制执行的测试和离线检查：被篡改而向外回传数据的部署会同时无法通过检查 1 和 2。
- **工具钩子。** 内置工具的可选逻辑是经过审阅而不是沙盒化的：除非工具选择使用 Worker，否则它在页面中运行。lolly.tools 上的每个工具都是第一方的，并在发布之前经过审阅。[威胁模型](/info/threat-model.html#trust-boundaries)说明了钩子在哪里运行以及什么限制它们。

## 如果某项检查失败

本页与你所观察到的情况之间的任何差异都是一份安全报告。请通过[安全与验证](/info/security.html#reporting-a-vulnerability)上的私密渠道发送。我们实行协调披露，并对报告者致谢。
