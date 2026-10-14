# Lolly 与 Adobe

_最后核查：2026 年 9 月 28 日。_

Lolly 负责图像编辑与转换、排版、可重复的品牌制作、印刷输出和 Content Credentials。[lolly.work](https://lolly.work) 在这套创作工作流之上增加了组织身份、共享资产、审批和自动化的服务器端制作。

## 重叠之处

两者都支持调整图像尺寸、组合版面和导出专业格式等工作。Lolly 支持 PDF/X、CMYK 和高位深栅格输出，并附有[各格式的具体能力](/info/formats.html)。其设备端实用工具无需上传即可转换和清理文件。

Adobe 的专业应用覆盖大量创意工作流。例如，[Photoshop](https://www.adobe.com/products/photoshop.html) 提供精细的照片编辑、选区、蒙版和合成工具。请将你的工作所需的编辑操作与 Lolly 的工具对照；反复使用的品牌资产与复杂的修图，需求可能各不相同。

## 创作与组织服务

独立使用的 Lolly 无需 Adobe 账号或 Lolly 账号，在浏览器、桌面应用和 CLI 中使用同一个引擎。模板和设计令牌使输出可重复，[带规则分享](/info/create-a-tool.html)可将设计变成他人可填写的工具。

lolly.work 是 Lolly 项目中的独立服务，与创意应用一样以 MPL-2.0 开源。它提供 SSO、SCIM、共享目录与项目、审批、访问策略、审计记录和服务器端渲染。组织可以自行运行这两部分，并接入现有的资产库。本地创作保留在设备上；共享工作和服务器任务使用已配置的服务。

## Content Credentials 与身份

Lolly 可在设备上对受支持的导出文件签名，Content Credentials 由用户自行启用。设备生成的密钥证明文件签名的完整性；验证方仍需信任签名者，才会显示已验证的身份。组织可以使用自己的证书颁发机构，并将其根证书分发给验证方。lolly.work 还支持使用已配置的组织证书和密钥进行服务器端签名。

这使个人签名和组织签名都能在 Lolly 方案中使用。请参阅 [Content Credentials 身份](/info/content-credentials-identity.html)、[lolly.work 签名指南](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md)和[组合方案概览](/info/compare.html)。设备端转换实用工具不会添加 Lolly 水印或溯源元数据。

Adobe、Photoshop 和 Creative Cloud 是 Adobe 的商标。本页说明各方案的重叠之处，与 Adobe 无关联。
