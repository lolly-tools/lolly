# 快速上手

Lolly 把你的規範（色彩、字體、版面、邏輯）變成任何人都能使用的工具，只要填幾個欄位就能做出成品檔案：圖片、PDF、社群圖卡、影片。幾乎沒什麼要學，也不必上傳任何東西：製作與匯出都在你的裝置上執行，連線或離線都一樣。

這是最該先讀的一頁。兩件事能讓你真正上手：**讓 Lolly 成為你的**，以及**把你既有的資產帶進來**（你的設計檔與 tokens）。其餘一切都只隔著一個連結。

> 剛接觸 Lolly，只想先做點東西？[60 秒做出一件作品](/info/make-something.html) 會帶你走過三個例子；或是[開啟應用程式](/#/)，從工具庫挑一個工具，把空格填一填，然後按 **Export**。等你想讓成品換上*你自己的*品牌時，再回到這一頁。

![Utilities 檢視畫面：Strip Hidden Data、Compress PDF、Convert Image 這些在裝置上完成工作的實用工具，全都集中在一處](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. 讓它成為你的：設定你的設計系統

你的品牌在 Lolly 裡就是一份小小的 **design-tokens** 文件（色彩、字型和少數幾條規則），每個工具都依它算圖。設定一次，之後做出來的東西就是從結構上符合品牌，而不是靠事後審查。有三條路可以進來；挑一條符合你品牌目前所在位置的。

### 從零開始（設計系統建構器）

首次啟動會直接把你帶到**工具庫**，上面疊著一個簡短的歡迎對話框，提供三條入口：**Make it yours**（位於 `#/start` 的 Brand Studio）、**Bring your design**（丟進 Figma、Penpot、InDesign 或 PDF 檔案，它會以可編輯的版面打開，這是通往下方[把你既有的資產帶進來](#2-bring-in-what-you-already-have)最快的路徑），以及 **Explore the community tools**；如果英文不是你的語言，還有一排語言可選。選第一張卡，你會來到 [**Brand Studio**](/info/brand-studio.html)。給它一個名字和一個主色，Lolly 就會從中*推導*出一整套無障礙色盤（淺色／深色底、文字、強調色），用的是引擎在其他地方所用的同一套色彩運算。

![Brand Studio 的色彩區：一個主色，以及 Lolly 從它推導出的無障礙色盤](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) 挑一個字型，不到一分鐘你就有一套可用的品牌。接下來工作室的六個區域（總覽、色彩、字體、標誌、Tokens、檔案）讓你想做多深就做多深、順序隨你，之後任何時候回來都能再修改。儀表板的 **Design system** 分頁（`#/d`）以唯讀方式呈現結果，並指回 `#/start`，編輯是在那裡進行（除非你用的是品牌鎖定版的 Lolly，此時品牌是固定的，沒有東西可改）。

### 匯入你已經有的品牌

如果你的品牌已經以 design tokens 的形式存在，來自 **Penpot**、**Tokens Studio**（Figma）或任何一般的 **DTCG** 檔案，那就整包帶進來，不必重打一次。有兩條路：

- <!--i:palette--> **在應用程式裡：**[設計系統建構器：Brand Studio](/info/brand-studio.html)（`#/start`）透過區域導覽列底部的 **Add from…** 接收它：一份 token 檔案、一份 Penpot 匯出檔、一個 SVG，或一個 `LollyBrand` 套件。丟進去，色盤就會亮起來。
- <!--i:code--> **從命令列**，建立一個可重複使用的品牌套件：

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` 接受 Penpot／Tokens Studio 匯出同一份文件時所用的三種容器：單一 `tokens.json`、一個目錄（`$metadata.json` 加上各集合檔案），或一個 `project.penpot` 壓縮檔。加上 `--activate`，它會把該品牌註冊為一個 profile、切換過去，並重建目錄。品牌套件與 profile 如何搭配，請見[設定](/info/configuration.html)。

### 在應用程式裡微調

品牌啟用之後，就在 [**Brand Studio**](/info/brand-studio.html)（`#/start`）裡繼續形塑它：改一個顏色或一個角色，全應用程式的每個預覽都會隨你輸入即時更新。（儀表板位於 `#/d` 的 **Design system** 分頁只是以唯讀方式*呈現*品牌；編輯是在 Studio 裡進行。）

![儀表板的設計系統分頁：以唯讀方式呈現目前啟用的品牌](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) 同一個品牌也摘要在 **Profile → Your brand** 卡片上。字型是真的字型：從 Google Fonts 挑一個，Lolly 會把檔案當作品牌資產存**在你的裝置上**，所以你的排版可以離線帶著走，算圖時不會再去抓任何東西。

滿意之後，**把品牌匯出成 `LollyBrand` 套件**：一個檔案，同事匯入就能拿到完全相同的色盤、字型與規則。品牌就是這樣在人與機器之間流動，中間不需要任何伺服器。

> **品牌 tokens 可以雙向來回。**因為 Lolly 的品牌*就是* DTCG tokens，也就是 Penpot 原生讀寫、Tokens Studio 帶進 Figma 的那個格式，所以你用來設計的色盤和 Lolly 實際強制執行的色盤是同一份文件，不是兩份要你手動同步的清單。請見 [Design Tokens](/info/design-tokens.html)。

## 2. 把你既有的資產帶進來

你不必從一張白紙開始。Lolly 打得開你已經擁有的設計成果與開放格式。

### 開源設計檔案

在 **Figma、Penpot、Illustrator、InDesign 或任何 SVG 應用程式**裡完成的作品，不必被鎖在你當初繪製它的那個軟體裡。打開 **Design**，點 **Import a design**，檔案就會以*活的版面*打開，而不是一張壓平的圖。每個圖層都成為可編輯的方塊：文字仍可重新輸入、形狀仍是形狀、圖片進到你的素材庫，複雜的向量圖也會忠實保留。它一進來就已經套上你的品牌字體與色彩規則。

| 你手上有 | 這樣帶進來 |
|---|---|
| 一個 Figma frame | 原生 `.fig`（File → Save local copy），或 SVG 匯出檔 |
| 一份 Penpot 設計 | 它的 `.penpot` 匯出檔，或任何 SVG |
| 一個 Illustrator 檔案 | 原生 `.ai`（相容 PDF）或 `.pdf`，可直接開啟 |
| 一份 InDesign 版面 | `.idml`（File → Export → InDesign Markup） |
| 其他任何東西 | **任何 SVG**，通用的入口 |

整個匯入過程都發生**在你的裝置上**：檔案在你的瀏覽器裡解析，不會上傳任何東西。完整細節，以及究竟有哪些內容會被帶過來，請見[匯入設計](/info/design-import.html)。

手上是 **PowerPoint 簡報**？把 `.pptx` 丟到 **Deck Builder**，就能一頁一頁編輯，而且已經對齊你的品牌；或是執行 **Rebrand a Deck**，拿回同一份簡報換上新主題，圖表與動畫都完好。

### 從一次性作品變成範本

這就是回報：匯入的版面就是一個普通的 Design 工作階段，所以只要你**儲存**它，它就存在於一個 URL 上。任何有 Lolly 的人都能打開那個 URL，改文字、換圖片，算出自己的版本，不需要設計軟體，而鎖定的部分依然鎖著。一次性的設計就此變成可重複使用的工具。整個構想就是這樣，而且不用寫一行設定。

### 開放資料與開放工具

[社群工具集](/info/builders.html)是開源且與品牌無關的，包含 QR code、街道地圖、濾鏡、隱私工具，而且只要你啟用品牌，它們就會依*你的*品牌算圖。

也可以餵給工具你自己的開放資料：貼上或拖進一份 **CSV** 或 **JSON** 表格，工具的重複欄位就會依它填入，一列產出一份成品。

## 3. 做出東西，然後分享或自動化

品牌已啟用、素材也在手上之後，每個工具都能產出成品檔案：

- <!--i:download--> 把任何工具**算圖**成 **SVG、PDF、PNG、JPG、WebP、影片**等格式，需要時還能用真實的印刷尺寸與物理單位。請見[匯出與格式](/info/exporting.html)。
- <!--i:link--> **分享一個連結。**每一個工具狀態都是一個 URL，所以成品是可重現、可用參數定址的：把連結存進版控，需要時再重新產生。
- <!--i:layers--> **批次處理。**在[批次表格](/info/exporting.html)裡用一份試算表驅動範本：一列產出一份成品。
- <!--i:cpu--> **自動化。**同一套算圖也能從 [CLI](/info/cli.html) 和 [AI 代理程式](/info/ai-agents.html)執行，URL 就是 API。

「URL 就是 API」是字面意思。下面這張圖表不是任何人畫出來的：它的類型、標題和整份資料表都是打進網址列的，而同一個連結在任何裝置上都會算出同一張圖表。

![月度註冊人數的區域圖,其中每個數值都是以查詢參數傳入,而非透過點擊產生](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 接下來往哪裡走

三條路徑，看你來這裡是要做什麼：

- <!--i:people--> **[Lolly 給創作者](/info/creators.html)**：你負責做東西。這裡談它的優勢，以及如何把這個應用程式用到最好。
- <!--i:code--> **[Lolly 給建構者](/info/builders.html)**：你負責撰寫工具、整合與部署。這裡是技術文件。
- <!--i:shieldcheck--> **[Lolly 給維運者](/info/operators.html)**：你負責整個組織的品牌、安全與推行。
