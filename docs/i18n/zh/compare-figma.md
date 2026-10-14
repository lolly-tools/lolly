# Lolly 与 Figma

_最后核查：2026 年 9 月 28 日。_

Lolly 支持设计、实时编辑和可复用的资产制作。[lolly.work](https://lolly.work) 在这些工作之外增加了组织服务：身份、共享项目、访问控制和审批。

## 重叠之处

两者都可以在画布上排布文字、形状和图像，并与他人协作。Lolly 的[导入设计](/info/design-import.html)可将 Figma 文件读取为可编辑的版面。Figma 同样涵盖基于模板的品牌制作：[Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) 根据模板创建资产，并从 CSV 或 XLSX 文件填充内容。

Lolly 将设计变成[带规则的可复用工具](/info/create-a-tool.html)。该工具可在浏览器或 CLI 中运行，并接受来自 URL、脚本或批量网格的输入。同一个模板既适用于个人编辑单个资产，也适用于团队制作大量变体。

## 协作与产品设计

[Figma Design](https://www.figma.com/design/) 汇集了界面设计、组件、交互原型和开发者交接。当团队需要设计并详细定义一个完整的应用时，其成熟的产品设计工作流和生态系统就很有参考价值。

Lolly 提供两种实时协作。[私有协作](/info/collaborate.html)将两台设备直接配对，无需账号，在共享网络上也无需互联网。工作协作通过 lolly.work 实现认证访问、共享编辑、实时光标和已保存的团队会话。工作协作在 Lolly 客户端和 lolly.work 服务器中均已实现；其当前的单节点部署并不能证明与 Figma 的运营规模相当。

## 部署与制作

Lolly 的创意应用和 lolly.work 是同一开源项目中独立部署的两个部分。独立使用的 Lolly 可以在无账号的情况下离线渲染。lolly.work 在组织自己掌控的基础设施上提供 SSO、SCIM、共享目录、项目权限、审批、审计记录和服务器端渲染。

团队会话和工作协作的编辑会发送到该实例；本地渲染可以留在设备上。Content Credentials 对受支持的导出文件是可选的，服务器端签名使用已配置的组织身份。关于这种分离，请参阅[组合方案概览](/info/compare.html)；关于验证方如何信任签名者，请参阅 [Content Credentials 身份](/info/content-credentials-identity.html)。

Figma 是其所有者的商标。本页说明两种方案的重叠之处，与 Figma 无关联。
