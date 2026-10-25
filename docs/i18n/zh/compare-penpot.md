# Lolly 与 Penpot

_最后核查：2026 年 9 月 28 日。_

如果你的团队在 Penpot 中设计，Lolly 与 Penpot 并行工作：两者都是开源的，也都读取同样的设计令牌。本页说明各自适用于哪项工作。

## Penpot 做得更好的地方

[Penpot](https://penpot.app/) 提供界面设计、组件、灵活的布局、交互原型和开发者检查，以及实时编辑和实时光标。它提供托管和自托管的部署，带有 [Docker 和 Kubernetes 安装选项](https://help.penpot.app/technical-guide/getting-started/)。设计应用，Penpot 就是那个工具。

## 重叠之处

[Penpot 的设计令牌](https://help.penpot.app/user-guide/design-systems/design-tokens/)使用 DTCG 格式，Lolly 也读取该格式，所以颜色、字体和其他令牌值可以在两者之间移动。Lolly 的[导入设计](/info/design-import.html)把 `.penpot` 导出作为可编辑的版面打开，Lolly 中的 **Send to Penpot** 则把设计作为 `.penpot` 存档送回去。Lolly 还维护着 [Penpot 的 Lolly Export 插件](https://github.com/lolly-tools/lolly-plugins-penpot-export)，它使用 Lolly 的引擎在设备上添加选择加入的 Content Credentials。

## Lolly 如何完成重叠的工作

Lolly 的 Design 画布制作可编辑的素材，并可以把版面变成[带规则的工具](/info/create-a-tool.html)。同一个工具在浏览器、桌面应用或 CLI 中渲染，并根据数据生成变体。独立使用的 Lolly 在设备上渲染和签名，无需账号或服务器。[私密协作](/info/collaborate.html)把两台设备直接配对。

## 与组织一起

Lolly Work 增加单点登录、SCIM 开通、共享目录和项目、角色、审批、审计记录、工作协作和服务器渲染。两个仓库都采用 MPL-2.0，组织可以两者都运行。[什么在哪里运行](/info/compare.html#what-runs-where)把这两部分并排对比。

你可以两者并用：Penpot 用于界面设计和原型制作，Lolly 用于可重复的文件，通过共享令牌和导入的设计相连。

Penpot 是其所有者的商标。本页描述的是这两款产品重叠的地方，与 Penpot 没有关联。
