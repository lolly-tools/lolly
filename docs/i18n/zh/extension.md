# 浏览器扩展

**Lolly URL Screenshot** 扩展让 web 应用可以从你的浏览器内部截取任意网页的屏幕截图。没有它,抓取 URL 就需要桌面应用 - 浏览器页面本身无法读取另一个站点的像素。这个扩展可以做到,使用的是桌面应用所用的同一套抓取机制。

它还以同样的方式完成另一项工作:读取你指定的某个页面,让 Brand Studio 能够从一个实际存在的网站中提取出品牌信息。下文会介绍这两者。

它运行在基于 Chromium 的浏览器上:**Chrome、Edge、Brave、Arc、Opera** - Chrome 111 或更新版本。

在安装它之前,**URL Screenshot** 仍然可以打开,让你先构图,工具控件顶部会有一条提示说明缺少了什么。

![URL Screenshot 工具中提示安装扩展的说明,当抓取到文件没有可运行的宿主时显示](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

在你等待期间,每个控件都是可用的:目标 URL、滚动深度、稳定延迟、裁切边距和重新配色。只有抓取本身需要一个宿主。

![URL Screenshot 的控件,包括目标 URL、滚动深度、稳定延迟和裁切边距,在扩展存在之前均可使用](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## 安装

### 从 Chrome 网上应用店

*即将推出。* 一旦发布,你只需一次点击即可安装,然后重新加载 Lolly。

### 自行加载(开发者)

这个扩展位于代码仓库中的 `shells/chrome-extension/`。

1. 打开 `chrome://extensions`。
2. 打开右上角的**开发者模式**。
3. 点击**加载已解压的扩展程序**,选择 `shells/chrome-extension/` 文件夹。
4. 重新加载 Lolly - **URL Screenshot** 现在可以在浏览器中使用了。

## 工作原理

- 一段小脚本告诉 Lolly 扩展已存在,于是 **URL Screenshot** 工具会自动切换启用 - 无需设置。
- 当你渲染时,扩展会在后台标签页中打开目标页面,通过 DevTools 协议抓取(与桌面应用所用的同一个 `Page.captureScreenshot`),然后关闭该标签页并把图像交回来。
- 它完全在你的浏览器中、在你的网络上运行 - 所以抓取 `localhost` 或内部站点也能正常工作。抓取内容本身从不会被上传到任何地方;唯一的网络流量就是你自己的浏览器加载你要求截取的页面。

在抓取运行期间,你可能会在临时标签页上短暂看到一条“……已开始调试此浏览器”的提示条。这是 DevTools 协议在起作用;截图完成后它会自动消失。

## 为 Brand Studio 读取网站

Brand Studio 中的**网站**来源可以从你已有的站点着手创建品牌。在基于 Chromium 的浏览器上,读取工作由扩展完成;在桌面应用上,由原生抓取完成同样的工作;而在没有安装扩展的普通浏览器上,这个选项根本不会提供。

按下按钮后会发生什么:

- 一个地址,一个页面。扩展在同类型的后台标签页中打开它,读取渲染后的标记、样式表文本以及少量图标和 Logo 图片,然后关闭该标签页。它不会跟随链接,也不会爬取。
- 托管在别处的样式表和字体(CDN、字体服务)也会被抓取,因为页面的颜色和字体信息就存在其中。跨源请求不会携带你的 Cookie;同源请求会携带,与页面本身的行为完全一致。
- 一切都有上限 - 样式表、图片和字节数都是有限的 - 这样一个恶意或半失效的页面只会返回部分素材,而不会导致挂起。
- 字节数据直接返回给发起请求的 Lolly 标签页。解析为颜色、字体和 Logo 的过程在你的设备上进行;没有任何内容被上传。

在你按下按钮之前不会读取任何内容。粘贴地址只是填入字段而已。

## 安装之后

重新加载 Lolly 标签页。“获取扩展”提示会消失,**URL Screenshot** 会在图库和批处理模式中变为可用。

## 权限

它的 `manifest.json` 声明了四项权限外加主机访问权限:

- `debugger` - 通过 DevTools 协议驱动后台标签页。截图正是靠这个权限完成的。
- `tabs` - 打开临时后台标签页,并在之后将其关闭。
- `scripting` - 在你指定的站点内运行单页读取器,供 Brand Studio 的网站来源使用。
- `storage` - 只在会话存储中记录它打开的标签页的 id,这样即使浏览器在读取过程中挂起了扩展,该标签页仍能被关闭。下次启动时会被清除;不存储任何关于你的信息。
- `host_permissions: ["<all_urls>"]` - 对*所有*站点的主机访问权限,因为你可以把它指向你选择的任意 URL。Chrome 会在安装时把这项权限显示为一条宽泛的“读取和更改你在所有网站上的所有数据”警告。

尽管有这条警告,它实际上只会读取你要求它抓取或导入的那一个页面,不会读取或传输你的浏览数据 - 没有任何内容会被上传到任何地方。

清单文件还设置了 `minimum_chrome_version: 111`。当前版本是 0.2.1。

## 故障排查

- **仍然看到“获取扩展”?** 重新加载 Lolly 标签页 - 检测发生在页面加载时。
- **在这个站点上没有反应?** 扩展只在 Lolly 自己的域上激活。你在另一个域上运行自定义构建版本?把它加入扩展 `manifest.json` 中的 `content_scripts.matches`。
- **抓取失败?** 检查该 URL 是否可访问,并以 `http://` 或 `https://` 开头。有些页面会主动阻止自动化抓取。
