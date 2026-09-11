# Lolly 面向构建者

技术文档--面向编写工具、将 Lolly 集成到工作流程中、自行部署，或扩展该平台的任何人。

**这对你有什么好处。** 工具只需构建一次，之后同样的需求就不会再找上你。那些占用你整个下午、不断重复的"能不能帮我做一个…"，会变成一个模板，让其他人自己填写就能正确完成，不用你插手。你的工作成果就是普通的 HTML/CSS/JS：可版本控制、可比对差异、可审查，运行在一个开放的引擎之上，没有供应商锁定，因此始终属于你。把生产流程自动化之后，你的时间就能花在有意思的问题上，而不是第一万次导出。

Lolly 是一个与平台无关的**引擎**，在多个**壳层**（web PWA、Tauri 桌面/移动端、CLI、TUI）中运行同一条渲染路径。工具是**数据，而非打包的代码**--由一个清单、一个模板加上可选的 hooks 组成--因此新工具无需应用更新即可发布。先阅读[概览](/info/overview.html)了解架构，再根据你要构建的内容选择合适的路线。

刚接触这个平台？**[快速入门](/info/quickstart.html)**能在你深入了解之前，先帮你搭建好一个品牌并完成第一次渲染。

## 理解架构



- **[概览](/info/overview.html)** - Lolly 存在的原因、引擎/壳层/工具的分离方式、能力桥接（capability bridge），以及已经确定下来的架构承诺。
- **[设计令牌](/info/design-tokens.html)** - 品牌所使用的 DTCG 令牌模型，以及工具如何使用这些令牌。

## 编写工具

下面每一个控件都是由 `tool.json` 中声明的输入项生成的。你写下清单里的那一行，宿主负责画出控件，而同一个模型也驱动着 CLI 和 URL。

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

这套做法远不止能撑起五个控件。给一个输入项加上 `section`，宿主就会把它折叠收起，所以像 D3 Chart Studio 这样有五十个输入项的工具，打开时依然只是一小叠控件，其余的都归到具名分组之后。

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[编写工具指南](/info/authoring-tools.html)** - 完整指南：清单、模板、样式、hooks、组合方式与发布流程。
- **[编写素材指南](/info/authoring-assets.html)** - 目录素材、层级、语言区域、调色板、可主题化图标与字体。
- **[Host API](/info/host-api.html)** - 每个工具都基于其编写的 `HostV1` 能力桥接（这是工具唯一可见的 API）。
- **[URL 模式](/info/url-mode.html)** - 将每个输入都表示为 URL 参数；保留参数、紧凑编码、打包链接。

## 运行与集成

- **[CLI](/info/cli.html)** - 无界面渲染；与图形界面走相同的渲染路径，由 `--foo=bar` 形式的命令行参数驱动。
- **[TUI](/info/tui.html)** - 交互式终端壳层。
- **[MCP 服务器](/info/mcp.html)** - 让 AI 代理能够发现并运行工具的原生端点。
- **[AI 代理](/info/ai-agents.html)** - 由模型驱动 Lolly：一个 URL 就是一个 API。
- **[Chrome 扩展](/info/extension.html)** - 将实时 URL 捕获为可复用的素材。

## 发布与运维

- **[构建指南](/info/build-guide.html)** - 构建所有目标平台：CLI、TUI、桌面端、移动端。
- **[部署](/info/deployment.html)** - web 应用、各端应用与后端服务；每个部分各自运行在哪里。
- **[配置](/info/configuration.html)** - 配置文件（profiles）、品牌包、能力开关、功能标志与目录校验。

## 信任与数据

权利与署名信息也和其他输入项一样。Embed & Track Image 声明了创作者、版权、许可与联系方式等字段，导出时会把它们写入文件自身的元数据以及它的 C2PA 清单。

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials Identity](/info/content-credentials-identity.html)** - 面向设备端 C2PA 的 CA 签发签名；引擎契约与运维手册。
- **[数据传输](/info/data-transfer.html)** - `lolly-backup` 包：信封结构、完整性与跨壳层保证。
- **[关于](/info/about.html)** - 项目介绍、许可边界与代码仓库。
