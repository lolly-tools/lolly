# Lolly 与渲染 API

_最后核查：2026 年 11 月 5 日。_

如果你今天通过 API 根据模板生成图像，本页会说明：如果由你自己来运行这项制作，也就是在你自己的设备上、CI 中或你控制的服务器上，会有什么变化。[从托管的渲染 API 迁移](/info/work-move-from-render-api.html)讲的是具体做法。

## 托管渲染 API 做得更好的地方

[Bannerbear](https://www.bannerbear.com/) 和 [Placid](https://placid.app/) 是托管服务，这是一项真正的优势。你发送请求，由别人运行服务器、保持其在线并处理负载。

- **无需运维。** 没有服务器、数据库、存储、更新或容量规划。
- **托管的模板编辑器**，带有可直接改用的现成模板。
- **一个 API 提供更多输出类型。** 两者都提供视频和 PDF 端点，Bannerbear 还记录了动画输出、WebP 和 AVIF、截图以及 AI 背景移除。
- **它们自己的集成和支持。**

如果这正是你想要的安排，这些服务是可靠的选择。

## 自托管能给你什么

- **你的内容留在你的系统上。** 输入、素材和输出都存放在你选择的基础设施上。在设备上或 CI 中渲染完全不需要任何服务。
- **规则存在于工具中。** 颜色、字体、徽标和锁定的输入来自你的[设计系统](/info/brand-studio.html)，所以调用方只能更改你允许的内容。[Lolly Work](/info/compare.html#what-runs-where) 对每个请求应用工具可见性和输入政策。
- **各处都是同一个工具。** 同一个工具可以用相同的输入在笔记本电脑上、CI 作业中或服务器上渲染，人们也可以在应用中编辑同一个工具。
- **你持有的记录。** [渲染回执](/info/work-renders.html#evidence-and-identity)、审计轨迹，以及你配置了签名身份时的 Content Credentials。
- **开源，没有计量。** 代码由你运行，你付费的只是你自己的基础设施。

你要承担那些服务原本替你做的工作。持久的服务器需要持久的数据库和输出存储，需要浏览器的工具需要 Chromium 工作进程。[安装 Lolly Work](/info/work-install.html) 介绍了这两者。

## 各项工作如何对应

| 工作 | 托管的渲染 API | Lolly |
|---|---|---|
| 根据数据填充模板 | 指明模板及其图层的 API 请求 | 指明工具及其输入的 [URL](/info/url-mode.html)、[CLI](/info/cli.html) 或[服务器 API](/info/work-automation-api.html) |
| 根据表格生成多个文件 | 批处理和集合 | 在你设备上的 [Batch](/info/batch.html)，或服务器上的[渲染批处理](/info/work-renders.html#batches-with-durable-rows) |
| 等待或轮询结果 | 轮询，或同步选项 | 你来轮询的持久渲染，或即时渲染 |
| 完成时调用 webhook | 支持 | 发往你允许的来源的[签名回调](/info/work-renders.html) |
| 动态图像 URL | 支持 | [分享链接和 `/render` URL](/info/url-mode.html) |
| 编辑模板 | 托管的编辑器 | 在你设备上的 [Design](/info/using.html) |
| 智能体 | 两者都提供 MCP 服务器 | [MCP](/info/mcp.html)，在 Lolly Work 上，组织端点受令牌的政策约束 |

Lolly 自己的输出类型列在[导出](/info/exporting.html)中。目前在 Work 服务器上，持久渲染生成 SVG、PNG、JPG 和 PDF，而[视频留在设备、CLI 和 MCP 上](/info/work-renders.html#production-still-checks-and-permitted-repairs)。

## 什么会带过去，什么不会

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| 你的请求 | Work 的迁移 API 接受相同的格式 | 相同 | 相同 |
| 你的模板 | **导入**为可编辑的文档，没有已确认结构的图层类型除外 | 只有字段名称和预览。需要逐个重建 | 只有字段名称和预览。需要逐个重建 |
| 现有的动态 URL | 不支持 | 不支持 | 更换主机后，签名 URL 仍可用你原来的私有令牌继续工作 |
| Webhook | 不支持已注册的 webhook | `webhook_url` 可用 | `webhook_success` 可用 |
| WebP 和 AVIF 输出 | 按名称拒绝 | 不提供 | WebP 按名称拒绝 |
| 动画、视频、集合、截图 | 不在迁移 API 上 | 不在迁移 API 上 | 不在迁移 API 上 |

这一切都是根据各厂商的公开文档构建的，尚未在真实账号上运行过。如果你持有账号，[迁移指南](/info/work-move-from-render-api.html#check-it-on-your-own-account)中有一份简短的核对清单。

迁移不是全有或全无。你可以迁移一个模板，把其余的留在原处，而[离开 Lolly](/info/work-move-from-render-api.html#leave-lolly-too) 同样是开放的：工具是纯文件，CLI 无需服务器即可渲染它们。

## 谁来运行服务

使用 Lolly，个人在本地渲染，或者团队在自己的基础设施上运行 Lolly Work。提交服务器作业会把它的输入和所需素材发送到该实例，这与设备端路径不同。

Bannerbear 和 Placid 是其所有者的商标。本页根据它们的公开文档，描述这些产品重叠的地方，与它们均没有关联。
