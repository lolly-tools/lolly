# Lolly 与渲染 API

_最后核查：2026 年 9 月 28 日。_

Lolly 可在你的设备上、CI 中或通过 [lolly.work](https://lolly.work) 的服务器 API，根据模板和数据生成资产。该组合方案既涵盖自动化渲染，也涵盖围绕组织制作任务的身份、策略和交付。

## 重叠之处

[Bannerbear](https://www.bannerbear.com/) 和 [Placid](https://placid.app/) 通过 API 和集成，根据模板生成图像和其他媒体。Lolly 采用同样的“模板加输入”方式，并提供 [URL 模式](/info/url-mode.html)、[CLI](/info/cli.html)、批量网格和服务器端点作为提交任务的途径。

## lolly.work 提供什么

lolly.work 是 Lolly 项目中独立部署的组织服务。它在 API 之后运行 Lolly 引擎，应用工具可见性和输入策略，并提供渲染后的文件和签名的分享链接。其[可恢复渲染服务](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md)支持单个任务和批量任务、幂等提交、状态、有限次重试、取消以及保留输出。配置了持久化存储时，中断的任务可在服务器重启后继续。

服务器使用快速的 SVG/PNG 渲染路径，以及供需要浏览器的工具使用的可选 Chromium 工作进程。自动化通过服务令牌认证，完成的输出可经[受治理的交付](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md)发送到组织的目的地。配置签名身份后，即可对受支持的服务器输出进行 C2PA 签名。

## 谁来运行服务

Bannerbear 和 Placid 将渲染打包为托管服务，使用各自的基础设施和集成。使用 Lolly 时，个人可以在本地渲染，团队也可以在自己的基础设施上运行 lolly.work。Lolly 的两个仓库均以 MPL-2.0 开源；自托管没有按渲染次数计算的软件许可费用，但计算、存储和运维仍是需要规划的成本。

公共 lolly.work 站点是评估用的沙盒环境，并非生产托管承诺。长期运行的服务需要持久化的数据库和输出存储；依赖浏览器的工具需要 Chromium 工作进程。[安装指南](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md)和[状态页](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)说明了这些要求和当前的限制。

本地渲染和 CI 渲染无需组织服务即可使用。提交服务器任务会将其输入和所需资产发送到该实例；这与设备端路径不同。参见[组合方案概览](/info/compare.html)。

Bannerbear 和 Placid 是其各自所有者的商标。本页说明各方案的重叠之处，与两者均无关联。
