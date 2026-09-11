# Lolly 建構者指南

技術文件 - 適合撰寫工具、將 Lolly 整合進工作流程、自行架設,或擴充這個平台的任何人。

**這對你有什麼好處。** 工具做一次,同樣的需求就不會再回頭找上你。那些吃掉你整個下午、不斷出現的「能不能幫我做一個……」,會變成一個範本,讓其他人自己動手填--而且做得正確,不需要你插手。你的成果是純粹的 HTML/CSS/JS:版本控管、可比對差異、可審查,並且執行在一個開放、沒有廠商綁定的引擎之上,所以它永遠屬於你。把量產流程自動化,你的時間就能花在有趣的問題上,而不是第一萬次的匯出。

Lolly 是一個與平台無關的引擎,能在多種殼層(web PWA、Tauri 桌面版/行動版、CLI、TUI)上執行同一套渲染流程。工具是資料,不是打包好的程式碼--由一份 manifest、一份 template,加上選用的 hooks 組成--因此新工具上線不需要更新應用程式。先讀[總覽](/info/overview.html)了解架構,再依你要打造的內容選擇合適的路徑。

第一次接觸這個平台?**[快速入門](/info/quickstart.html)** 能在你深入研究之前,先幫你把品牌和第一次渲染準備好。

## 了解架構



- **[總覽](/info/overview.html)** - Lolly 存在的原因、引擎/殼層/工具的分層方式、能力橋接層(capability bridge),以及已經拍板定案的架構決策。
- **[設計權杖](/info/design-tokens.html)** - 品牌所使用的 DTCG token 模型,以及工具如何運用這些權杖。

## 撰寫工具

下面每一個控制項都是由 `tool.json` 中宣告的輸入項目產生的。你寫下 manifest 裡的那一行，主機負責畫出控制項，而同一套模型也驅動著 CLI 與網址。

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

這套做法能撐的遠遠不只五個控制項。替一個輸入項目加上 `section`，主機就會把它摺疊收起，所以像 D3 Chart Studio 這種有五十個輸入項目的工具，打開時依然只是一小疊控制項，其餘的都收在具名分組後面。

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[撰寫工具指南](/info/authoring-tools.html)** - 完整指南:manifest、template、styles、hooks、組合方式與發布。
- **[撰寫素材指南](/info/authoring-assets.html)** - catalog 素材、分級、語系、色盤、可換色圖示,以及字型。
- **[主機 API](/info/host-api.html)** - 每個工具撰寫時,對象都是 `HostV1` 這個能力橋接層(也是工具唯一看得到的 API)。
- **[URL 模式](/info/url-mode.html)** - 每個輸入都能表示成一個 URL 參數;保留參數、精簡編碼、封裝連結。

## 執行與整合

- **[CLI](/info/cli.html)** - 無介面渲染;走的是和 GUI 相同的渲染路徑,由 `--foo=bar` 這類命令列參數驅動。
- **[TUI](/info/tui.html)** - 互動式終端機殼層。
- **[MCP 伺服器](/info/mcp.html)** - 讓 AI 代理程式得以探索並執行工具的原生端點。
- **[AI 代理程式](/info/ai-agents.html)** - 從模型端操作 Lolly:一個 URL 就是 API。
- **[Chrome 擴充功能](/info/extension.html)** - 把一個即時 URL 擷取成可重複使用的素材。

## 上線與維運

- **[建置指南](/info/build-guide.html)** - 建置每一種目標平台:CLI、TUI、桌面版、行動版。
- **[部署](/info/deployment.html)** - 網頁應用程式、各平台應用程式,以及後端服務;各部分分別跑在哪裡。
- **[設定](/info/configuration.html)** - profiles、brand packs、能力閘控、功能旗標,以及 catalog 驗證。

## 信任與資料

權利與署名資訊也跟其他輸入項目一樣。Embed & Track Image 宣告了創作者、版權、授權與聯絡方式等欄位，匯出時會把它們寫入檔案本身的中介資料，以及它的 C2PA manifest。

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials 身分](/info/content-credentials-identity.html)** - 針對裝置端 C2PA 的 CA 簽發簽章;引擎合約與維運手冊。
- **[資料傳輸](/info/data-transfer.html)** - `lolly-backup` 封裝包:envelope、完整性,以及跨殼層的保證。
- **[關於](/info/about.html)** - 這個專案、它的授權邊界,以及原始碼庫。
