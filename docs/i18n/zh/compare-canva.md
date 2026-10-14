# Lolly 与 Canva

_最后核查：2026 年 9 月 28 日。_

Lolly 在浏览器中制作符合品牌规范的图形、社交媒体帖子、演示文稿和版面。与 [lolly.work](https://lolly.work) 配合，它还支持共享项目、实时工作协作、已批准的资产和组织策略。

## 重叠之处

两者都能让人从模板起步，不必是设计师也能做出成品图形。两者都支持团队工作流和品牌控制：[Canva 将这些功能打包在其商业方案中](https://www.canva.com/canva-business/)；Lolly 则把创意应用与组织服务分开。

Lolly 在你的设备上独立运行，无需账号。当组织需要时，lolly.work 提供 SSO、SCIM 预配、角色、共享目录、审批和使用情况报告。它属于 Lolly 项目，独立部署，与 Lolly 本身一样以 MPL-2.0 开源。

## 模板与团队协作

Canva 将大型模板与图库、应用和托管的团队工作流整合在一个服务中。在挑选起点时，这些现成内容和托管体验可能很有用。参见 [Canva 的模板](https://www.canva.com/templates/)和[应用市场](https://www.canva.com/apps/)。

Lolly 的工具将允许的修改编码在内，可在浏览器、桌面应用或 CLI 中重复使用。一个设计可以成为[带规则的工具](/info/create-a-tool.html)，同一个工具可以根据一张数值表生成多个输出。lolly.work 围绕这些工具管理访问、共享工作和策略。

实时编辑有两种方式：直接连接两台设备的[私有协作](/info/collaborate.html)，以及通过组织的 lolly.work 实例进行的工作协作。工作协作包括共享编辑、光标和已保存的团队会话。当前的服务器部署使用单个协作节点；其规模和运行历史与 Canva 成熟的服务不同。

## 工作存放在哪里

独立使用的 Lolly 将创作和导出保留在设备上，资源就绪后可离线工作。工作协作、团队存储和服务器端渲染使用组织已配置的服务。这种部署选择正是区别所在：组织可以自行运营 Lolly 的两个部分，没有按席位计算的软件许可费用，但需要为自己的托管和管理付费。

Content Credentials 对受支持的导出文件是可选的。lolly.work 可以使用已配置的组织身份对服务器输出签名；验证方必须信任该身份，才会将签名者显示为可信。参见 [Content Credentials 身份](/info/content-credentials-identity.html)和[组合方案概览](/info/compare.html)。

Canva 是其所有者的商标。本页说明两种方案的重叠之处，与 Canva 无关联。
