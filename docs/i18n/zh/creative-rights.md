# 创作版权与署名

你应该能够使用他人制作的好作品，而不必成为许可协议专家，也不必悄悄抹去作品的创作者。所以 Lolly 记录它所用的每件作品的来源，读取为其记录的许可协议，推算该许可协议对你实际所做的使用有什么要求，完成程序能完成的部分，并告诉你只有你自己才能完成的部分。

这一切都不是法律意见，也不是对你项目的裁定。Lolly 记录事实，应用从许可协议自身法律文本中读出的一小套规则，并展示它的推理过程。带有条件的许可协议是正常的、被允许的选择，绝不会被呈现为有问题的素材。

## 你会在哪里遇到它

emoji 集是最常见的情形。Twemoji 采用 CC BY 4.0，所以带有 emoji 的标题导出时会署名该作品，不需要你做任何事。两个 OpenMoji 集都采用 CC BY-SA 4.0，所以用品牌处理方式给它们的字形重新着色属于改编，分享这个改编需要你选择一次兼容的许可协议。Fluent (MIT)、Noto 和 Blobmoji（两者均为 Apache 2.0）也已注册，各自按其经过审阅的许可协议处理。

选择某个集合从不会被阻止，集合控制项会在你选择的地方显示许可协议。对于目录插图、LUT、字体和任何其他已记录的作品，同样的规则同样适用。

## 三个彼此独立的事实

“CC BY 4.0”、“这次使用需要署名”和“署名已经在你刚下载的文件里”是三种不同的陈述，Lolly 会将它们分开处理：

- **证据**是来源所声明的内容，按发现时的原样记录，附带是谁说的、在哪里读到的。之后的导入绝不会覆盖较早的记录。
- **义务**是经过审阅的规则针对一次使用、一条交付路径和一类受众，从这些证据中得出的要求。分享时才适用的条件，在你私下工作期间保持为有条件的。
- **交付**是成品字节实际携带的内容，通过读回来衡量。只有当读取者在交付的文件中找到署名后，Lolly 才会说署名已包含。

![已记录的来源证据和所选的使用方式输入到经审阅的规则。导出准备署名，然后交付检查读取成品字节，报告找到了哪些署名或仍然需要哪些署名。](/info/diagrams/concepts/rights-evidence-to-delivery.svg)

## 你看到的内容，以及该做什么

同样的措辞出现在导出面板、Verify、命令行和机器结果中，大致按你遇到它们的频率排序。

| 你看到的内容 | 含义 |
|---|---|
| Source credits will be included. | 署名已准备好，并且该路径可以携带署名。尚未写入任何内容，所以这不是成功消息。 |
| Credits included in this file's metadata. | 交付的字节已被读回，凭据已验证，并且每个必需的来源都在凭据中找到。 |
| Credits and credentials are in the download package. | 署名以随附文件的形式与作品一起传递。转交时请把它们放在一起。 |
| If you share this adaptation, it needs a compatible licence. | 一个 ShareAlike 来源被改动，并且结果要去往私人使用之外的地方。选择只是一次操作，而不是每个放置位置一个对话框。 |
| Add this credit to the post description. | 所选路径既不携带凭据，也不携带可读的署名，所以署名文字需要由你粘贴。 |
| No required credit under the recorded CC0 dedication. | 该声明没有要求。仍会提供一条礼节性署名。 |
| Source licence not recorded. | 这个来源没有记录任何内容。这是需要补上的缺口，而不是对该作品的不利发现。它绝不是该作品可以自由转交的证据。 |
| Conditions recorded, not yet interpreted. | 标识符已被识别，其条件已列出，但这里没有任何规则解读它们。没有自动通过，也没有自动禁止。 |
| Two licence declarations disagree. | 两条记录指向不同的许可协议，没有任何东西选定适用哪个授权。 |
| The credits are not in the file that was delivered. | 署名曾被承诺，读回时没有找到，文件仍然是你的。请重新导出，或手动使用署名文字。 |

Lolly 从不说 “copyright verified”、“legally safe”、“fully cleared” 或 “rights cleared”，产品中任何地方也没有单一的绿色许可协议徽章。这些说法会声称某种任何程序都无法检查的东西。

## 始终归你所有的部分

- **你的许可协议选择归你。** Claim 把过去合为一体的三种状态分开：没有声明公开许可协议、明确的保留所有权利声明，以及真正的公开许可协议授权。Lolly 只为后两者写入权利说明行，并且从不取自你的个人资料。
- **你的作品不会被替你重新授权。** 来源的条款和你自己的输出声明是分开的记录。ShareAlike 条件适用于它所约束的改编，而不会自动适用于你制作的其他一切。
- **私人作品仍然可用。** 分享时才适用的条件，在涉及分享时才会提出。这里没有任何内容会变成导入禁令，也没有许可协议问卷横在你和你自己的文件之间。
- **决定是针对其自身的事实被记住的。** 你记录的每个选择都会盖上一个指纹，对应它所针对的作品、使用方式、路径和受众。更改集合、处理方式、格式或受众，问题就会再次被问。没有一个笼统的 “ignore licences” 开关，因为把警告点掉既不能交付署名，也不能授予许可。
- **你的详细信息与第三方的署名是分开的。** 移除你自己的个人元数据不会移除被署名的艺术家，必需的署名也绝不是导出你的联系方式的借口。

## Lolly 在每个位置做什么

- **在目录中。** 作品的页面显示其来源和创作者、规范的许可协议名称（原始标签保留在下方）、已记录时可复制的署名，以及一行说明使用它有什么要求。方块陈述要求；它从不声称导出已经完成。
- **在导出面板中。** 一旦渲染使用了已记录的作品，Content protection 内就会出现 Source credits 卡片，位于你为自己的导出选择的 Licence 旁边。它显示状态、位于 Details 之后的署名文字、一个 Copy credit 按钮，以及在需要决定时出现的内联卡片。决定从不是阻止性的对话框：还剩一项操作的下载仍会继续。
- **在文件中。** 放置了已记录作品的导出，会为每件不同的作品写入一个 Content Credentials 来源素材，绑定到其公开地址上的原始字节，并携带创作者、许可协议及其链接、来源、修订版本和改动。Lolly 为它所观察到的内容签名。它绝不代表上游艺术家签署声明，Verify 会说明发生的是这两者中的哪一种。
- **在软件包中。** 无法容纳凭据的下载，例如 `.lottie` 动画，会把署名作为 `CREDITS.txt` 和 `credits.json` 放在包内。这些在写入后会被读回，并且不声称它们有签名的凭据。
- **写入之后。** 在任何内容说署名已包含之前，会先读回交付的字节。未通过验证的凭据不算作已交付的署名。
- **在可编辑的 `.lolly` 文件中。** 只有当经过审阅的许可协议记录了允许转交来源时，字节才会随之传递。包的 `CREDITS.txt` 列出哪些随包传递、在哪种许可协议下，以及哪些被扣留及原因。未记录的许可协议会被扣留。你仍然可以有意包含被扣留的内容，署名文件会记录那是你的选择。
- **在 Verify 中。** Sources 面板列出文件记录的每个来源，附带计算出的摘要、署名、Copy credit 按钮、只有在你要求时才会打开的 Open source 链接，以及所检查内容的明确限制。只有当你选择某种使用方式时才会出现 Check for this use 问题，并且不会为了回答这个问题而获取任何内容。
- **当你移除元数据时。** 清除会告诉你文件不再携带多少来源署名，提供署名文字，并提供一份干净的文件，署名放在单独的文件里。被清除的字节绝不会被重新盖章。

::: details Lolly 已审阅的许可协议
规则版本 `rights-rules-2026-09-13.2`。每条规则都是从许可协议自己的法律文本中读出的，它来自哪一节在这里和 `engine/src/rights-profiles.ts` 中规则旁边都有引用。版本和移植版本按记录的样子保留：CC BY 3.0 声明保留它自己的版本，而不会因为应用的选择器偏好 4.0 就被报告为 4.0。

| 许可协议 | 对 Lolly 可做的使用有什么要求 | 出处 |
|---|---|---|
| CC BY 4.0 | 创作者、标题、版权声明、许可协议名称和链接、来源链接和改动说明，每一项在来源提供时才需要。不排除任何使用，包括商业使用。 | [法律文本](https://creativecommons.org/licenses/by/4.0/legalcode.en)，第 2(a)(1) 和 3(a) 节 |
| CC BY-SA 4.0 | 同样的署名。此外，如果你分享改编作品，它要以兼容的许可协议发布：CC BY-SA 4.0、Free Art License 1.3 或 GPL-3.0-or-later，这是单向的。这三者作为数据取自 Creative Commons 列表，绝不按名称匹配。 | [法律文本](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)，第 3(a) 和 3(b) 节；[兼容许可协议列表](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | 无。该声明不带任何条件，所以 Lolly 提供礼节性署名，绝不将其呈现为必需。 | [该声明](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en)，第 2 和 3 节；[CC FAQ](https://creativecommons.org/faq/) 中关于署名的部分 |
| CC-PDDC | 无。记录的是断言本身以及是谁作出的，因为认证是一方的陈述，而不是证明。 | [该声明和认证](https://creativecommons.org/licenses/publicdomain/)的各段 |
| Apache License 2.0 | 来源的声明和 NOTICE 文件的署名文字随分发的作品一起传递。运行时使用不要求任何东西。要求提供声明文字的许可协议，如果作品没有携带任何声明文字，会被报告为缺口。 | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)，第 4 节，条件 1 至 4 |
| MIT | 版权行和许可声明随副本和实质性部分一起传递。运行时和参考性使用不要求任何东西。 | [MIT](https://opensource.org/license/mit)，许可声明条件 |
| SIL OFL 1.1 | 使用该字体渲染文字，对文字没有任何要求。转交字体文件则要携带许可协议、版权声明和保留名称规则。 | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/)，条件 2、3 和 5；[OFL FAQ](https://openfontlicense.org/ofl-faq/) 中关于文档的部分 |

**已记录，未解读。** CC BY-NC、CC BY-ND 以及 NC-SA 和 NC-ND 组合都可识别，其条件已列出，但这里没有任何规则解读它们。它们报告 `licence.unknown`，并附一行说明条件。商业情境无法从价格或账号中读出，每个组合文本在规则读取该文本之前都需要自己的审阅。

还有三种同样诚实的回答，但它们都不代表许可：

- `LicenseRef-` 标识符原样返回。它指向一个存储的定义，绝不会因为拼写而被视为专有。
- 没有任何东西能识别的声明会以未解析的形式返回，原始文本被保留。
- `A OR B` 是权利人提供的选择，所以每个备选项都会返回，且都不被选定。`A AND B` 是累加的，这些规则记录它，而不是把两个配置放在一起解读。
:::

::: details 在命令行和 MCP 上
当评估存在必需的署名或问题时，渲染会向标准错误打印一个 `Rights:` 块。它包含状态、每个问题一行（格式为 `code - summary`）、交付的文件被读回为什么，以及供粘贴的署名文字。

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

这里署名在文件中，分享文件之前仍需要作出许可协议决定。无论哪种情况，文件都会写出。

| 状态 | 含义 | 退出码 |
|---|---|---|
| `ready` | 没有任何事项需要人工处理。 | 0 |
| `actions-required` | 在文件被分享之前，仍有一项决定尚待做出。文件依然会被写入。 | 4 |
| `use-not-covered` | 一条经过审核的规则判定，该许可证不涵盖这一次使用。 | 4 |
| `unknown` | 唯一的问题是空白：一份未被记录的许可证，或是尚未被解读的条件。 | 0 |
| `delivery-failed` | 由回执设置，而不是由评估设置：承诺提供的署名没有在交付的字节中被找到。导出面板会显示这一状态；命令行则会在其回读那一行报告同样的事实。 | 不打印 |

退出码 4 是此 CLI 在保护性检查说不时已经给出的代码。它不是 3，后者的意思是“在另一个运行器上重试”，因为许可协议决定在每一个运行器上都在等着。

`--rights=private` 表示这次渲染不会交付给任何人。这个区块依然会打印，署名依然可以复制；退让的只是那条以分享为前提的条件，同时也不会记录任何交付声明。这里没有用来忽略某项条件的标志：`--rights=ignore` 属于用法错误。

问题代码是稳定的、机器可读的，与翻译后的文案无关：`attribution.source-missing`、`attribution.delivery-missing`、`licence.adaptation-choice`、`licence.use-not-covered`、`licence.grant-conflict`、`licence.unknown`、`source.redistribution-unknown`、`credential.ingredient-missing`。

通过 MCP，`lolly_verify` 返回一个 `rights` 载荷，包含摘要、每个已记录来源一行以及明确的限制。无浏览器的 `lolly_render` 返回 `status`、`issues`、`credits`、`fingerprint` 以及通过读回字节测得的 `creditsInFile` 标志。
:::

::: details 规则存放在哪里
五个引擎模块，全部是纯的：没有网络，没有时钟，没有文件系统。规则数据带有版本并存放在仓库中，从不通过网络获取。

| 模块 | 包含内容 |
|---|---|
| `engine/src/rights-profiles.ts` | 标识符表、最小的 SPDX 表达式读取器、带引用的经审阅配置，以及署名可以打印的链接所遵循的那一条规则。 |
| `engine/src/rights-evaluate.ts` | 分类、问题、署名计划和指纹。具有确定性：相同的事实以不同的顺序给出相同的答案。 |
| `engine/src/rights-attribution.ts` | 可读的署名、随附文件、来源素材和写入后测得的回执。 |
| `engine/src/rights-companion.ts` | 对软件包署名（基于 ZIP 的下载内的 `CREDITS.txt` 和 `credits.json`）的读回，它确认署名，但不声称有签名的凭据。 |
| `engine/src/rights-report.ts` | 将已验证的凭据读回为 Verify 所问的三个问题。 |

`tests/fixtures/rights/` 中的预期文件是根据许可协议文本编写的，而不是根据评估器的输出，其 README 引用了每项预期背后的条款。
:::

## 目前尚未做到的

- **没有确认任何目的地。** Lolly 准备一段说明文字。连接器接受请求并不能证明署名到达了读者，这里也没有任何内容承诺以后的上传、截图或转码会保留隐藏的元数据。
- **原生元数据署名字段不是根据计划写入的。** 署名通过 Content Credentials 和可读文字传递。IPTC 和 XMP 的逐来源署名字段目前还不是根据署名计划填写的。
- **更正和撤回尚未构建。** 为已记录的作品补充缺失的创作者或做本地更正，以及撤回记录，都没有界面。
- **尚未构建已连接的提供方。** 购买的素材、自定义许可和提供方账号没有导入路径，所以它们的授权只能作为你自己的陈述来记录。
- **组织政策没有与这些结果合并。** 导出政策和许可协议条件目前是分开的，组织的批准不等于权利人的许可。
- **若干交付路径尚未纳入这条路径。** 下载目录原件、批量 ZIP、Send 和 Copy image 目前还不会评估或携带这些署名。裁切、调色、加框的副本、Download as 转换和视频编辑则会：带有已记录许可协议、自身没有 Content Credentials 的来源，会作为未签名的来源素材连同其署名一起传递；LUT 按它自己的许可协议署名，绝不按图片的许可协议；无法携带其来源所要求的署名的文件不会被保存。目前没有任何东西会读回这些文件，所以它们的署名是已写入，而不是已确认。Retouch、单张图像的背景移除和放大，以及音频提取，只保留来源自己的凭据。
