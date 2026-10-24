# Lolly 逐工具对比

如果你已经在使用另一款产品，这些页面会说明 Lolly 是取代那款产品、与它并用，还是不适合你的工作。每一页都从另一款产品做得更好的地方开始。

_最后核查：2026 年 9 月 28 日。_

## 按产品对比

- [Lolly 与 Canva](/info/compare-canva.html) - 模板、日常设计和共享的品牌制作。
- [Lolly 与 Adobe](/info/compare-adobe.html) - 编辑、转换、专业输出和 Content Credentials。
- [Lolly 与 Figma](/info/compare-figma.html) - 设计、实时协作和可复用素材的制作。
- [Lolly 与 Penpot](/info/compare-penpot.html) - 开源设计、共享令牌和组织工作。
- [Lolly 与品牌门户](/info/compare-brand-portals.html) - 已批准的素材库、锁定的模板、身份、审阅和报告。
- [Lolly 与渲染 API](/info/compare-render-apis.html) - 在你的设备上、CI 中或 Lolly Work 服务器上自动生成。
- [Lolly 与在线文件转换器](/info/compare-converters.html) - 在你自己的设备上进行格式转换。

如需逐项能力对比，请参阅[Lolly 如何对比](/info/positioning.html)。每项对比均标注日期；若某项说法已不再符合任一产品的现状，则需要更正。

## 什么在哪里运行

每一项对比都涉及同一个开源项目的两个部分。**Lolly** 是引擎、应用和工具。**Lolly Work** 是组织服务器，在 [lolly-work 仓库](https://github.com/lolly-tools/lolly-work)中维护。两者都采用 MPL-2.0，组织自己决定开启哪些 Lolly Work 服务。

::: cols
## 在你的设备上：Lolly

- 独立使用无需账号
- 制作、编辑、转换和导出
- 所需的工具和素材保存后可离线使用
- 在设备上签名的 Content Credentials
- 两台设备之间的私密协作，无需服务器

## 在你所在组织的服务器上：Lolly Work

- 单点登录、SCIM 开通、角色和政策
- 共享目录、团队项目和工作协作
- 审批、使用情况报告和审计记录
- 服务器渲染、可恢复的作业和经批准的交付
- 使用组织身份的服务器签名
:::

独立使用让文件留在设备上。选择共享项目、工作协作、服务器渲染或交付，会把该功能所需的数据发送到你所在组织的服务器。

## 每项对比的前提

这些限制适用于这一组中的每个页面，所以在这里一次性说明：

- **Work 协作目前运行在单个服务器节点上。** 它们的规模和运营历史与长期存在的托管产品不同。[Work 状态与路线图](/info/work-status.html)记录了当前的限制。
- **[lolly.work](https://lolly.work) 上的站点是演示沙盒。** 持久的组织部署需要持久存储和一位运营者；[安装 Lolly Work](/info/work-install.html) 涵盖两者。
- **Lolly 或自托管的 Lolly Work 没有按席位收取的软件许可费用。** 托管、存储和运营仍然需要花钱。
- **签名不等于受信任的签名者。** 验证者必须先信任为文件签名的证书，才会把签名者显示为受信任；[Content Credentials 身份](/info/content-credentials-identity.html)解释了方法。
