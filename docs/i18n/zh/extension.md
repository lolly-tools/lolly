# 浏览器扩展

网页无法读取另一个网站的像素，所以 Lolly 网页应用需要帮助才能给网页截图。在基于 Chromium 的浏览器中（Chrome、Edge、Brave、Arc 或 Opera，从 Chrome 111 起），免费的 **Lolly URL Screenshot** 扩展提供这种帮助，使用与桌面应用相同的截取方式。安装它之后：

- **[URL Screenshot](/t/url-shot)** 把你构图的页面保存为文件；
- 粘贴到图片槽位的网址可以通过 **Screenshot this page** 变成该页面的截图；
- [Design System Setup](/info/brand-studio.html) 中的 **Website** 来源可以读取一个页面来创建设计系统。

每个请求都由你批准，没有扩展时，桌面应用也能完成同样的工作。

## 安装之前

在安装扩展之前，**URL Screenshot** 仍然可以打开，所以你可以构图。工具控制项顶部的提示会说明缺少什么。

![URL Screenshot 工具中提示安装扩展的说明,当抓取到文件没有可运行的宿主时显示](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

等待期间，每个控制项都可用：目标 URL、滚动深度、稳定延迟、裁切边距和重新着色。只有截取本身需要扩展。

![URL Screenshot 的控件,包括目标 URL、滚动深度、稳定延迟和裁切边距,在扩展存在之前均可使用](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## 安装

**从 Chrome 网上应用店：**即将推出。扩展发布后，你可以一键安装。

**自行加载（开发者）。** 扩展位于仓库的 `shells/chrome-extension/` 中。该文件夹是生产构建，只适用于 `https://lolly.tools` 上的 Lolly。

1. 打开 `chrome://extensions`。
2. 开启 **Developer mode**（右上角）。
3. 点击 **Load unpacked** 并选择 `shells/chrome-extension/` 文件夹。
4. 重新加载 Lolly 标签页。检测发生在页面加载时，所以 “Get the extension” 提示会消失。随后 **URL Screenshot**（位于 Utilities 下）可以把截图保存为文件，并可在 Batch 模式中使用。

如果要连接本地开发服务器,请运行 `pnpm run pack:chrome-extension:dev`,改为加载 `dist/chrome-extension-dev`。该软件包还接受 `http://localhost:5173`,其名称中带有 **Development**。

## Lolly 发出请求时会发生什么

![Lolly 标签页请求一个页面，你在扩展的批准窗口中按 Approve once。后台标签页打开、读取页面然后关闭。接着 Lolly 标签页得到结果。](/info/diagrams/concepts/extension-request.svg)

1. **Lolly 发出请求。** 一个小脚本告诉 Lolly 扩展已存在，所以截取或读取页面无需进一步设置即可开始。
2. **你批准。** 扩展打开它自己的 **Approve page request** 窗口。它显示发出请求的网站、它要的是截图还是页面内容，以及页面地址。在你按 **Approve once** 之前不会读取任何内容。**Cancel** 或关闭窗口会结束请求。
3. **Chrome 对每个网站询问一次。** 你第一次批准某个网站的请求时，Chrome 还会询问扩展是否可以访问该网站。你允许之后，Chrome 会保留该访问权限，但之后的每个请求仍需要各自的 **Approve once**。
4. **页面在后台标签页中读取。** 扩展在后台标签页中打开目标页面，通过 DevTools Protocol 截取（与桌面应用使用的相同 `Page.captureScreenshot`），关闭标签页，并把结果交还给发出请求的 Lolly 标签页。

一次批准只涵盖一个请求，并在 30 秒后过期。同一时间只能有一个请求在等待或运行，已批准的请求会在 55 秒后停止。如果 Lolly 页面关闭或改变，或目标页面跳转到另一个网站，请求就会被取消。

截取在你的浏览器中、通过你的网络运行，所以 `localhost` 和内部网站都可用。页面使用你的浏览器会话加载，所以你已登录的页面可能会在结果中显示私密信息。截图不会上传：唯一的网络流量是你自己的浏览器加载你所请求的页面。

截取运行时，你可能会在临时标签页上短暂看到 *"…started debugging this browser"* 横幅。那是 DevTools Protocol 在工作，截取完成后横幅就会消失。

## 为 Design System Setup 读取网站

Design System Setup 中的 **Website** 来源从你已有的网站开始创建设计系统。在 Chromium 浏览器中由扩展读取页面。在桌面应用中，应用自己获取页面。在没有扩展的浏览器中，不提供 Website 方块。

- **一个地址，一个页面。** 在你批准后，扩展在同样的后台标签页中打开页面，读取渲染后的标记、样式表文本以及少量图标和徽标图片，然后关闭标签页。它不会跟随链接或爬取。
- **托管在别处的样式表**（CDN 或字体服务）也会被获取，因为页面的颜色和字体就在其中。跨源请求不带你的 Cookie；同源请求会使用它们，就像页面本身那样。
- **一切都有上限**，对样式表和图片的数量以及字节数都有限制，所以恶意或半损坏的页面返回的是部分材料，而不会卡住。
- **解析在你的设备上进行。** 字节直接交还给发出请求的 Lolly 标签页，由它把它们变成颜色、字体和徽标。

粘贴地址只是填写输入框。在你开始读取并按 **Approve once** 之前，不会读取任何内容。

## 权限

扩展的 `manifest.json` 声明了四项权限，另有逐个网站请求的站点访问权限。它设置了 `minimum_chrome_version: 111`，当前版本是 0.4.0。

| 权限 | 用途 | 何时授予 |
|---|---|---|
| `debugger` | 通过 DevTools Protocol 驱动后台标签页，由它截图。 | 安装时 |
| `tabs` | 打开临时后台标签页并在之后关闭它，并检查自你批准后 Lolly 页面和目标页面都没有移动。 | 安装时 |
| `scripting` | 为 Website 来源，在你指定的网站内运行单页阅读器。 | 安装时 |
| `storage` | 仅在会话存储中记下它打开的标签页的 ID，这样即使浏览器在读取中途挂起扩展，该标签页仍会关闭。下次启动时清除；不存储任何有关你的信息。 | 安装时 |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | 站点访问权限，安装时不授予。当你按 **Approve once** 时，扩展会向 Chrome 请求该请求中那一个网站的访问权限。 | 你第一次批准该网站的请求时，在 Chrome 询问你之后 |

扩展只读取你批准的那一个页面。它不读取或发送你的浏览数据，也不上传任何内容。

## 故障排查

- **仍然看到 “Get the extension”？** 重新加载 Lolly 标签页。
- **在这个网站上没有反应？** 扩展只在 `https://lolly.tools` 上工作，开发版本包中还有 `http://localhost:5173`。其他来源，例如自托管的 Lolly 副本，需要自己的扩展构建，并在 `manifest.json` 和 `policy.js` 中都列出该来源。只编辑 manifest 是不行的。
- **截取失败？** 请检查 URL 是否可达，并以 `http://` 或 `https://` 开头。有些页面会阻止自动截取。如果你按了 **Cancel**、关闭了批准窗口，或等待超过 30 秒，请重新开始截取。
