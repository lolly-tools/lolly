# Lolly 逐工具对比

Lolly 覆盖的创意工作，小到单次设备端格式转换，大到受治理的组织级资产生产。这些页面对比了各产品所支持的工作流、部署方式，以及选型时需要关注的限制。

_最后核查：2026 年 9 月 28 日。_

## 一个项目，两个独立部署的部分

**Lolly** 是用于创建、编辑、转换和导出的引擎、应用和工具。它在你的设备上运行，所需资源就绪后可离线工作，独立使用时无需账号。

**[lolly.work](https://lolly.work)** 是本项目的组织服务，维护于 [lolly-work 仓库](https://github.com/lolly-tools/lolly-work)。它提供 SSO、SCIM 预配、角色与策略、共享目录与项目、审批、工作协作、使用情况报告、审计记录和服务器端渲染。两部分均以 MPL-2.0 开源。组织将 lolly.work 与 Lolly 一同托管，并自行决定启用哪些服务。

这些对比涵盖 **Lolly + lolly.work**。需要组织服务的功能会明确标出。独立使用时文件保留在设备上；选择共享项目、工作协作、服务器端渲染或交付时，相关数据会发送到已配置的服务。公共 lolly.work 站点是沙盒环境；组织部署请参阅[部署指南](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md)和[当前状态](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md)。

## 按工作流对比

- [Lolly 与 Canva](/info/compare-canva.html) - 模板、日常设计和共享的品牌制作。
- [Lolly 与 Adobe](/info/compare-adobe.html) - 编辑、转换、专业输出和 Content Credentials。
- [Lolly 与 Figma](/info/compare-figma.html) - 设计、实时协作和可复用的资产制作。
- [Lolly 与 Penpot](/info/compare-penpot.html) - 开源设计、共享令牌和组织工作流。
- [Lolly 与品牌门户](/info/compare-brand-portals.html) - 已批准的素材库、锁定的模板、身份、审核和报告。
- [Lolly 与渲染 API](/info/compare-render-apis.html) - 在你的设备上、CI 中或通过 lolly.work 自动生成。
- [Lolly 与在线文件转换器](/info/compare-converters.html) - 在你自己的设备上进行格式转换。

如需逐项能力对比，请参阅[Lolly 如何对比](/info/positioning.html)。每项对比均标注日期；若某项说法已不再符合任一产品的现状，则需要更正。
