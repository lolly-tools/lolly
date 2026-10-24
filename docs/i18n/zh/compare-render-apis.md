# Lolly 与渲染 API

_最后核查：2026 年 9 月 28 日。_

如果你今天通过 API 根据模板生成图像，本页会说明 Lolly 如何在你自己的设备上、CI 中或你自己的服务器上完成同样的工作。

## 托管渲染 API 做得更好的地方

[Bannerbear](https://www.bannerbear.com/) 和 [Placid](https://placid.app/) 把渲染打包成托管服务，有自己的基础设施、集成和支持。你发送请求，由别人运行服务器。

## 重叠之处

两者都把模板加输入变成媒体。Lolly 的输入来自[链接](/info/url-mode.html)、[CLI](/info/cli.html)、批量网格或服务器端点。

## Lolly 如何完成重叠的工作

同一个工具可以在笔记本电脑、CI 作业或服务器上用同样的输入渲染。本地和 CI 渲染根本不需要任何服务。

![Batch 导出设置：文件名、默认格式、单位、DPI 和要渲染的行数](/info/shots/use-batch-toolbar.svg)

在服务器上，[Lolly Work](/info/compare.html#what-runs-where) 在 API 后面运行 Lolly 引擎，并应用工具可见性和输入政策。它的[可恢复渲染服务](/info/work-renders.html)支持单个作业和批处理、幂等提交、状态、有限次重试、取消和保留的输出，并且当配置了持久存储时，被中断的工作会在重启后恢复。

服务器有快速的 SVG 和 PNG 路径，以及供需要浏览器的工具使用的可选 Chromium 工作进程。自动化使用服务令牌登录，完成的输出可以通过[经批准的交付](/info/work-delivery.html)送到组织的目的地，已配置的签名身份会为受支持的输出添加 Content Credentials。

## 谁来运行服务

使用 Lolly，个人在本地渲染，或者团队在自己的基础设施上运行 Lolly Work。提交服务器作业会把它的输入和所需素材发送到该实例，这与设备端路径不同。持久的服务需要持久的数据库和输出存储，依赖浏览器的工具需要 Chromium 工作进程；[安装 Lolly Work](/info/work-install.html) 介绍了这两者。

Bannerbear 和 Placid 是其所有者的商标。本页描述的是这些产品重叠的地方，与它们均没有关联。
