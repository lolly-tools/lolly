# Lolly 与 Penpot

_最后核查：2026 年 9 月 28 日。_

Lolly 与 Penpot 都提供开源设计工具、共享设计令牌和实时协作。Lolly 将设备端创作与独立部署的组织服务 [lolly.work](https://lolly.work) 结合在一起。

## 共同的设计基础

[Penpot 的设计令牌](https://help.penpot.app/user-guide/design-systems/design-tokens/)使用 DTCG 格式，Lolly 同样可以读取。颜色、字体和其他令牌值可以在两种工作流之间共享。Lolly 的[导入设计](/info/design-import.html)可将 `.penpot` 导出文件打开为可编辑的版面。

适用于 Penpot 的 Lolly Export 插件由 Lolly 维护。它使用 Lolly 的引擎在设备上提供需主动启用的 C2PA Content Credentials。签名完整性与对签名者的信任是两回事：验证方需要一个自己信任的身份，详见 [Content Credentials 身份](/info/content-credentials-identity.html)。

## 设计与团队工作流

[Penpot](https://penpot.app/) 提供界面设计、组件、灵活的布局、交互原型和开发者检查。它提供托管和自托管两种部署，并有 [Docker 和 Kubernetes 安装选项](https://help.penpot.app/technical-guide/getting-started/)。

Lolly 的设计画布可创建可编辑的资产，并能将版面变成[带规则的工具](/info/create-a-tool.html)。同一个工具可在浏览器、桌面应用或 CLI 中渲染，并能根据数据生成变体。在团队协作方面，Lolly 既有直接连接两台设备的[私有协作](/info/collaborate.html)，也有通过 lolly.work 进行的工作协作，支持共享编辑、光标和已保存的团队会话。

## 部署方式有何不同

独立使用的 Lolly 在设备上渲染和签名，无需账号或服务器。lolly.work 增加了 SSO、SCIM 预配、共享目录与项目、角色、审批、审计记录和服务器端渲染。两个仓库均以 MPL-2.0 开源，均可由组织自行运营。共享工作使用已配置的实例；本地创作仍可独立使用。

如何选择取决于工作内容：Penpot 的界面设计与原型工作流、Lolly 的可重复资产制作，或是利用共享令牌和导入设计的组合方式。Lolly 的工作协作目前运行在单个服务器节点上，其[部署状态](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)应纳入组织的评估。

Penpot 是其所有者的商标。上文的插件属于 Lolly。更广泛的对比请参阅[Lolly 如何对比](/info/positioning.html)和[组合方案概览](/info/compare.html)。
