# Lolly 如何運作

Lolly 工具保存一種檔案的規則：版面、字型、色彩，以及其他人可以更改的部分。你、同事、指令碼或 AI 代理填入欄位，每個檔案都會遵守這些規則。

<!--i:eti-repeat-->
## 一個工具，依你的規則製作多個檔案

品牌規則就在工具裡。工具設定一次，每份輸出都會採用相同的字型、色彩與間距，從一張卡片到試算表中十幾種語言的多列資料都一樣。

![填好一個欄位的字標工具：字型、色彩與間距在製作工具時就已決定](/info/shots/aud-rules-in-the-tool.svg)

製作第一百個檔案的人只需輸入文字。你決定如何檢查作品，以及由誰檢查。Lolly 減少需要檢查的內容，讓下一個檔案做得更快。

<!--i:eti-users-->
## 哪些人會使用工具

組織中的三種角色共同製作一張活動卡片。

![設計師在工具中設定一次規則；開發者以指令碼執行工具，任何人也能填入欄位；兩種方式都能製作完成的檔案](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **設計師設定規則。** 他們在 Lolly Design 中以品牌的字型與色彩排好卡片，再選擇開放哪些欄位。只需做一次，之後就不必再手動將卡片在地化。
- <!--i:code--> **開發者擴大工具的使用規模。** 同一個工具透過命令列在每晚的指令碼中執行。不必有人重新開啟設計，就能產生最新圖表或新的語言版本。
- <!--i:people--> **任何人都能填寫。** 飛機上的業務代表即使沒有網路，也沒受過設計訓練，仍能開啟工具，製作明天會議要用的卡片。
:::

開發者產生的最新圖表就像這張渲染結果，由一段資料字串與幾個設定製作而成：

![有標題的堆疊區域圖，三個資料序列以冷色調分帶呈現，座標軸、圖例與標題皆由範本定位，無須手動擺放](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

業務代表能在一分鐘內完成，靠的是設計師的規則與開發者的指令碼。每個角色都使用同一個工具。

<!--i:eti-train-->
## 製作檔案的四種途徑

每種途徑都以相同的引擎執行相同的工具，因此指令碼製作的檔案會與你在應用程式中預覽的結果一致。

![URL 參數與命令列引數轉成同一個輸入模型，經由共用的執行環境與匯出橋接層處理](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **在應用程式中，一次一個。** 開啟工具、填入欄位，再按下 **Export**。[製作你的第一個檔案](/info/make-something.html)會帶你做一遍。
- <!--i:layers--> **在應用程式中，一次多個。** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design)（`#/batch`）接受貼上或匯入的表格，為每列渲染一個完成的檔案。
- <!--i:cpu--> **透過指令碼或 AI 代理。** [CLI](/info/cli.html) 以無介面模式執行工具，[MCP 伺服器](/info/mcp.html)則讓代理探索與執行工具。工具連結也帶有其輸入，因此一個連結就是完整的請求。
- <!--i:server--> **透過組織的伺服器。** [Lolly Work](/info/organisation.html) 依組織的登入與工具政策在伺服器上渲染，保留可接續執行的工作，並保存輸出以供下載或經核准的交付。

工作能使用哪種途徑，取決於工具的格式與主機的能力。有些格式需要瀏覽器，因此命令列會將它們交給瀏覽器層處理。[使用 CLI 渲染](/info/cli-rendering.html)列出各種格式在哪裡渲染。

<!--i:eti-monitor-->
## 各項功能在哪裡執行

製作、編輯與匯出都在你的裝置上執行，不需要帳號。需要伺服器的功能，例如同步或將檔案傳送到已連接的服務，只在你使用該功能時才連線。使用 Lolly Work 時，共用專案、團隊即時編輯、核准與伺服器工作都會使用組織的伺服器。[各項功能在哪裡執行](/info/compare.html#what-runs-where)並列比較這兩個部分。

<!--i:eti-graduation-cap-->
## 接著閱讀

- [製作你的第一個檔案](/info/make-something.html)，立即動手試試。
- [開始使用](/info/quickstart.html)，加入你自己的設計系統。
- [自動化](/info/builders.html)，了解命令列、連結與代理。
- [Lolly 架構](/info/overview.html)，供貢獻者了解引擎、外殼，以及將它們整合在一起的規則。
