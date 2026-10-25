# Lolly 與渲染 API

_最後核查：2026 年 9 月 28 日。_

如果你目前透過 API 從範本生成圖片，本頁說明 Lolly 如何在你自己的裝置上、CI 中或你自己的伺服器上完成同樣的工作。

## 託管渲染 API 做得更好的地方

[Bannerbear](https://www.bannerbear.com/) 與 [Placid](https://placid.app/) 把渲染包裝成託管服務，擁有自己的基礎架構、整合與支援。你送出請求，伺服器由別人運行。

## 重疊之處

兩者都把範本加輸入變成媒體。Lolly 從[連結](/info/url-mode.html)、[CLI](/info/cli.html)、批次格線或伺服器端點取得輸入。

## Lolly 如何完成重疊的工作

同一個工具以相同的輸入在筆記型電腦、CI 工作或伺服器上渲染。本機與 CI 渲染完全不需要任何服務。

![Batch 匯出設定：檔名、預設格式、單位、DPI 與要渲染的列數](/info/shots/use-batch-toolbar.svg)

在伺服器上，[Lolly Work](/info/compare.html#what-runs-where) 在 API 後方運行 Lolly 引擎，並套用工具可見度與輸入政策。其[可復原的渲染服務](/info/work-renders.html)支援單一工作與批次、冪等提交、狀態、有上限的重試、取消與保留的輸出，而在設定了持久儲存時，中斷的工作會在重新啟動後繼續。

伺服器有快速的 SVG 與 PNG 路徑，以及供需要瀏覽器的工具使用的選用 Chromium worker。自動化以服務權杖登入，完成的輸出可以經由[核准的交付](/info/work-delivery.html)送到組織的目的地，而已設定的簽署身分會為支援的輸出加入 Content Credentials。

## 誰來執行服務

使用 Lolly，個人在本機渲染，或團隊在自己的基礎架構上運行 Lolly Work。提交伺服器工作會把它的輸入與必要的素材傳送到該實例，這與裝置端路徑不同。持久的服務需要持久的資料庫與輸出儲存，而依賴瀏覽器的工具需要 Chromium worker；[安裝 Lolly Work](/info/work-install.html) 說明了兩者。

Bannerbear 與 Placid 是其擁有者的商標。本頁描述產品重疊之處，與兩者皆無關聯。
