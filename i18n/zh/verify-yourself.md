# 自行验证

Lolly 的隐私和安全页面做出了一些声明:没有分析统计、没有跟踪、文件永远不离开设备、整个系统只有一个 Cookie。这个页面不同:它不要求你相信这些说法中的任何一条。它是一份步骤清单,每一步都给出确切的命令或点击路径,以及你将看到的输出。这里的每一项声明都可以在几分钟内被证伪,大多数甚至不需要安装任何东西。

如果这个页面上的任何检查没有产生所展示的结果,那要么是一个 bug,要么是一个未兑现的承诺。无论是哪种情况,都请[报告它](#if-a-check-fails),我们会以未兑现承诺应有的严重程度来对待它。

## 十秒钟看它如何运作

在讲步骤之前,先看结果。打开 [`/verify`](/#/verify),把一个文件拖放上去 - 无需上传、无需账号、无需等待服务器。这里展示的是它在检查我们 AI 立场页面中的[生成的 Queensland 风暴图](/info/ai-stance.html):一张由 Gemini 生成、经 Lolly 打开、调整大小并导出的图像。下面的每一个徽章都是在设备上根据文件自身的字节计算出来的。

![手机宽度屏幕上的 Verify - 风暴图像、绿色的 Made with Lolly 判定,以及下方叠放的凭证完整和字节未变徽章](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

这个判定并不是单一一个徽章,而是一小堆徽章,每一个都是一个独立的事实:

- <!--i:lock--> **Made with Lolly** - 凭证完整*且*记录了一次 Lolly 导出。
- <!--i:seal--> **凭证完整** - 已签名的 C2PA 清单可以解析,且其自身的声明签名可以验证。
- <!--i:hash--> **字节未发生变化** - 文件的哈希值仍然与签名时一致。改动一个像素,这个徽章就会翻转。
- <!--i:sparkle--> **GEN AI** - 这些像素由机器生成,文件本身也这么说。Lolly 把这条声明原样读出来,而不是隐藏它。

而整段历史都会随文件一起传播。这里保留了九个步骤 - 五个是 Google 在生成并为图像加水印时记录的,另外四个是 Lolly 在打开、标记并转换这份副本时记录的 - 直接从字节中读出,在你的设备上完成,并渲染为一条时间线。这与 [AI 立场页面](/info/ai-stance.html)上的 C2PA 时间线是同一张图像,以同样的方式验证。

![Verify 从风暴图像中读回的变更历史 - 五个步骤由 Google 记录,随后四个由 Lolly 记录,最终形成本页面中的 WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

不过,那些都不是信任声明本身 - 那只是演示。本页剩下的内容才是信任声明:上面的每个徽章都是可复现的,下面说明如何复现这些保证背后的实际依据。

## 在浏览器中,无需任何工具

**1. 观察网络请求。** 打开 [lolly.tools](https://lolly.tools),打开浏览器的开发者工具(F12),切换到 **Network** 标签,然后使用一个工具 - 在 [QR Code](/t/qr-code) 中输入一个网址、更改颜色、导出 PNG。每一次请求都停留在 `lolly.tools` 上:应用外壳、工具自身的文件、目录资产。没有分析统计主机,没有 CDN 信标,没有字体服务,没有“错误上报”端点。你在工具中输入的内容**完全不会出现在任何请求中** - 渲染是在本地完成的。

这里坦诚列出的例外情况 - 每一项都是可选的、由用户主动触发的,并且发生时同样能在该 Network 标签里看到:在品牌编辑器中添加一款 **Google 字体**会从 Google 获取那一个字体家族,前提是先弹出一次同意对话框明确告知这一点,且只在首次请求前出现;点击一个 **ICC 印刷配置文件预设**会从 ICC 在 color.org 的公开注册表获取该配置文件;播放可选的内置**电台**会从该电台流式传输;在 **Meeting Planner** 中输入一个地点,会向 open-meteo 的地理编码服务查询该地点的坐标和时区,每个城市只查询一次(结果保存在你的设备上),而且输入框旁就写明了这一点;**URL Screenshot** 则必然会加载你输入的那个网址 - 这是它的本职工作,而且你能亲眼看着它发生。声明了网络能力的工具,只能向其清单中列入白名单的主机发起请求,且这一机制是失败即关闭的;目前发布的工具中没有一个声明过这项能力,所以浏览器强制执行的内容安全策略(Content-Security-Policy)才是真正把上面这份清单限制在这些主机内的边界。[隐私政策](/info/privacy.html)保留着这一切的权威表格;其一贯规则是:不在该表格中的网络访问就不会发生。

**2. 拔掉网线。** 加载应用,打开一两个工具,然后断网 - 飞行模式,或者开发者工具 → Network → Offline。刷新页面。图库以及你打开过的每个工具都会继续正常工作,包括用你用过的格式进行渲染和导出 - 一个工具的文件和一种格式的编码器会在你首次使用时被缓存,所以测试离线状态前请先在联网时用过一次该工具。这是本页中最有说服力的单项检验:会“回传数据”的软件,在被切断网络后是活不下去的。

**3. 数一数 Cookie。** 开发者工具 → **Application**(Firefox 中为 **Storage**)→ Cookies → `https://lolly.tools`。列表是空的 - 该应用不设置任何 Cookie。或者在控制台粘贴 `document.cookie`:得到的是 `""`。(整个系统中唯一的一个 Cookie,`lolly_ca_state`,在一次可选的身份登录期间最多存在十分钟 - 登录一完成就立即删除 - 作用域限定在 `/api/ca`,且带有 `HttpOnly` 属性:[隐私政策](/info/privacy.html)对它有精确描述。)

**4. 读一读自己的存储空间。** 同样在 Application 面板中:Lolly 保存的一切都能在你眼前直接查看 - 大约二十来个明文的 `localStorage` 键(主题、语言、侧边栏宽度、声音和视图设置,以及公开工具目录索引的一份缓存副本),以及你自己存放在 IndexedDB 中的文档。每个值都是可读的字符串或 JSON - 没有任何混淆,也没有任何编码是为了阻止你阅读它。**Profile → Clear all my data** 会清空这些内容;清除浏览器的站点数据同样能做到这一点,因为根本没有服务器端副本能在此之后留存下来。

**5. 确认披露联系方式确实存在。** [`/.well-known/security.txt`](/.well-known/security.txt) 返回的是一个符合 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 的联系信息区块,而不是一个 HTML 页面。

## 在终端中

**6. 渲染端点只会返回公开数据。** 唯一一个可能把用户输入的内容放进 URL 的服务端功能 - 热链渲染 - 在这里是启用的,[隐私政策](/info/privacy.html)说明了这对你放进链接里的输入内容意味着什么:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

这个开关是按部署实例配置的(`LOLLY_DISABLE_RENDER_GET=1`):在设置了该开关的实例上,同样的探测会返回 `404` - 这个差异正是该开关在正常工作的体现,而不是不一致。

**7. 服务器暴露面是可枚举的。** [Server Surface](/info/server-surface.html) 列出了所有存在的服务端路由,并以此为一贯规则:不在该页面上的端点就不属于 Lolly。用 `curl` 去逐一验证;不会再有别的东西可找。

## 在源代码中

如果部署的代码与公开代码不一致,以上所有内容都可能只是表演。所以要检查代码 - 该部署构建自[公开仓库](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 没有任何追踪器,也没有任何分析 SDK。** 在所发布的代码中搜索 - 引擎、每一个宿主壳(包括浏览器扩展、Tauri 桥接覆盖层和 service worker)、服务器函数以及工具包 - 查找常见的可疑对象:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. 没有第三方 DNS 解析器。** Verify 的 SEAL 校验从不通过某个 DNS-over-HTTPS 提供方来路由查询 - 这个网页应用根本没有解析器:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 证书服务不保留任何记录。** 身份 CA 没有签发日志 - 没有你的邮箱,没有时间戳,也没有 webhook。这种“不存在”是可以用 grep 验证的:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## 由测试强制保证,而非承诺

上面这三项源代码检查并不是一次性审计 - 它们被固定在测试套件里,因此不会悄悄地失效。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) 会在以下情况下让构建失败:

- 在它扫描的已发布源代码中的任意位置出现了任何分析或追踪 SDK - 应用、引擎、服务器、扩展和工具包代码都不例外,
- 该源代码中出现了任何第三方 DNS-over-HTTPS 解析器,
- CA 签发日志重新出现 - 无论是在源代码中**还是**在生成的服务器打包产物中,
- 隐私政策丢失了其法律要求必须包含的声明(指定的数据控制者、法律依据、投诉权)。

你可以在克隆下来的仓库中自行运行(Node 22.18+;这个文件不需要 `npm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

完整套件(`npm install && npm test`)还会再运行数千项测试,其中包括 [Security & Verification](/info/security.html) 中描述的对抗性密码学测试。

## 你在外部无法验证的部分 - 直说了

一个像这样的页面靠明确说出自身局限来赢得信任:

- **托管方的访问日志。** 任何回应请求的服务器都能记录该请求 - IP、路径、时间戳。你无法验证某个托管方保留或不保留什么,除了我们的服务提供方所记录的行为之外,我们自己也无法验证。这正是本架构把你的内容完全排除在网络传输之外的原因:从未离开过你设备的东西,任何人都无法记录。
- **部署运行的就是这份代码。** 你可以验证源代码是干净的,也可以验证部署后的实际行为与之相符(以上检查两端都验证了),但网页部署层面的二进制级证明,是 Web 平台本身并不提供的能力。缓解措施是公开仓库、强制执行的测试以及离线检查 - 一个会“回传数据”的被篡改部署,会立即在检查 1 和检查 2 上失败。
- **工具钩子默认并未沙箱化。** 工具的可选逻辑是经过审查后在页面自身的运行环境中执行的;lolly.tools 上的每个工具都是第一方的,并在发布前经过审查。Worker 隔离现已作为按工具选择启用的功能上线 - 清单中设置了 `isolate: true` 的工具会在线程外运行其钩子 - 所以你在外部无法验证的范围正在缩小,但默认路径仍然是在同一运行环境中执行,审查仍然是主要的控制手段。这一点是明说出来的,并未隐瞒 - 参见[设计边界](/info/security.html)一节,那里一直都是这么写的。

## 如果某项检查失败

本页描述与实际观察到的行为之间的任何差异都算是一份安全报告,我们是真心希望听到而不是听不到:[fitzy+security@suse.com](mailto:fitzy+security@suse.com)、任意一个 [lolly-tools 仓库](https://github.com/lolly-tools)上的 **Report a vulnerability** 按钮,或 [`/.well-known/security.txt`](/.well-known/security.txt) 中的联系方式。协调披露与报告者署名是一贯政策 - 详情见 [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md)。
