# 開始

讀完這一頁，你的工具就會穿上你自己的色彩與字型，你現有的作品也能準備好重複使用。你不需要帳號，製作與匯出都在你的裝置上執行。

::: timeline
- <!--i:sparkle--> **做出一個檔案。** [製作你的第一個檔案](/info/make-something.html)會帶你在幾分鐘內做出一個 QR 碼。
- <!--i:palette--> **放入你的品牌。** 從一種顏色、一個 tokens 檔案或一份完成的設計開始。
- <!--i:layers--> **做出更多同類作品。** 分享連結、填寫試算表，或從指令碼執行工具。
:::

想法本身對你還很陌生嗎？[Lolly 是什麼？](/info/what-is-lolly.html)是五分鐘的簡介，[Lolly 如何運作](/info/how-lolly-works.html)則說明誰負責什麼。

## 放入你的品牌

lolly.tools 會在 **Lolly Demo** 中開啟，這是 Lolly 自己的範例設計系統；[認識 Lolly Demo](/info/lolly-demo.html)說明你看到的是什麼。你的設計系統會取代它：一小組設計 token，也就是色彩、字型與少數規則，每個工具都以它來繪製。設定一次，你製作的一切從一開始就符合品牌。

選擇與你手上現有內容相符的路線：

- <!--i:palette--> **一種顏色。** 開啟 **Design System Setup**（`#/start`），為你的設計系統命名並選擇主色。Lolly 會由此衍生出完整且可存取的調色盤，包含淺色與深色表面、文字與強調色。再選一種字型，你就有一個可用的品牌。
- <!--i:upload--> **一個 tokens 檔案。** Design System Setup 房間列底部的 **Add from…** 接受 DTCG、Tokens Studio 或 Penpot 的 tokens 檔案、SVG，或 `LollyBrand` 套件。放進去，調色盤就會填入。在設計系統仍為空時，Overview 房間中的 **Start from a reference** 會開啟相同的選擇器。
- <!--i:pentool--> **一份完成的設計。** 在 Design 中選擇 **Import a design**，然後放入 `.fig`、`.penpot`、`.ai`、`.idml` 或 SVG 檔案。請見下方的[帶入你已有的東西](#bring-in-what-you-already-have)。

你第一次開啟圖庫時，簡短的歡迎畫面會提供相同的選項：**Make it yours** 開啟 Design System Setup，**Bring your design** 開啟設計的檔案選擇器，**Explore the community tools** 則關閉歡迎畫面。

![全新安裝的 Design System Setup 中的 Colours 房間：一個即時色塊、一個欄位，以及第一個決定的全部](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

從這裡開始，七個房間可依任意順序帶你走到你想要的程度：**Overview**、**Colours**、**Type**、**Logos**、**Tokens**、**Files** 與 **Usage & rules**。你輸入時，應用程式中的每個預覽都會更新。[Design System Setup](/info/brand-studio.html) 涵蓋每個房間。

字型保存在你的裝置上。選擇 Google Font 後，Lolly 會將檔案存為品牌素材，因此你的字型可以離線攜帶，工具繪製時也不會擷取任何內容。

### 檢視、切換與分享設計系統

- **檢視目前使用的。** **Settings → Design system** 以封面與頁面的形式顯示目前使用的設計系統，唯讀。
- **在它們之間切換。** **Settings → Preferences → Design systems** 列出這部裝置上的每個設計系統。一個組織可以運行多個設計系統，或一個帶有多種配色方案的設計系統；[品牌架構](/info/brand-architectures.html)對應了這些安排。
- **分享一個。** 將設計系統匯出為 `LollyBrand` 套件：一個檔案，同事匯入後即可得到相同的調色盤、字型與規則。

由你的建置或組織提供的設計系統是**受管理**的：它會顯示鎖頭並保持唯讀。若要變更，請從 **Settings → Preferences → Design systems** 建立一份可編輯的副本。

![Settings 中的 Design system 分頁：目前使用的設計系統，以封面與頁面呈現](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

你的設計系統就是 DTCG token，這是 Penpot 讀寫、Tokens Studio 帶進 Figma 的格式，因此你用來設計的調色盤與 Lolly 套用的調色盤是同一份文件。[設計 Token](/info/design-tokens.html) 有詳細說明。

::: details 給開發者：從命令列建立品牌套件
若要在 checkout 中建立可重複使用的品牌套件，`ingest:brand` 接受 Penpot 與 Tokens Studio 匯出的三種容器：單一的 `tokens.json`、含有 `$metadata.json` 的各集合檔案目錄，或 `project.penpot` 封存檔。

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` 會將品牌註冊為設定檔，並建置與驗證其目錄。它絕不更動預設設定檔：請以 `LOLLY_PROFILE=acme` 執行來使用新套件。[設定](/info/configuration.html)說明品牌套件與設定檔如何搭配。
:::

## 帶入你已有的東西

你不必從空白頁開始。

**設計檔案。** 來自 Figma、Penpot、Illustrator、InDesign 或任何 SVG 應用程式的完成作品，會在 Design 中以活的版面開啟：文字仍可重新輸入，圖形仍是圖形，圖片會進入你的資料庫。檔案在你的瀏覽器中讀取，不會上傳任何內容。[匯入設計](/info/design-import.html)列出每種格式以及會帶過來的內容。

**簡報。** 將 PowerPoint `.pptx` 拖放到 Lolly，即可把它的投影片歸檔為素材；也可以在 **Markdown Slides** 中以 Markdown 撰寫新簡報，或用[重塑簡報品牌](/info/rebrand.html)，把整份簡報移到你的設計系統上。

**資料。** 貼上或放入 CSV 或 JSON 表格，工具的重複欄位就會由它填入，或用 [Batch](/info/batch.html#make-many-versions-of-one-design) 為每一列產生一個完成的檔案。

### 從一次性作品變成範本

匯入的版面就是一般的 Design 工作階段。**Share with rules** 會把它變成工具：由你選擇其他人可以更改的部分，他們只填寫那些部分。

![保留 Design 母版，在製作副本中選擇輸入與限制，然後分享可重複使用的 .lolly 工具，由收件者填寫](/info/diagrams/concepts/share-with-rules.svg)

[分享附規則的設計](/info/create-a-tool.html)會逐步帶你操作。

## 大量製作、分享與自動化

- <!--i:download--> **匯出。** 工具可製作 SVG、PDF、PNG、JPG、WebP、影片等，依各工具提供的格式，並在你需要時採用真實的列印尺寸。請見[匯出檔案](/info/exporting.html)。
- <!--i:link--> **分享連結。** 工具的設定隨連結傳遞，因此連結在任何地方都會重新開啟同一個檔案。
- <!--i:layers--> **每列做一個。** 在 [Batch](/info/batch.html#make-many-versions-of-one-design) 中以試算表驅動工具。
- <!--i:cpu--> **自動化。** 相同的渲染可從 [CLI](/info/cli.html) 與 [AI 代理](/info/ai-agents.html)執行。

連結就是一份完整的請求。下方的圖表不是任何人畫的：它的類型、標題與整個資料表都是輸入在網址列中，同一個連結在任何裝置上都會畫出相同的圖表。

![月度註冊人數的區域圖,其中每個數值都是以查詢參數傳入,而非透過點擊產生](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## 接下來往哪裡走

- <!--i:people--> **[創作](/info/creators.html)**：製作、動畫、錄製、分享與匯出。
- <!--i:code--> **[自動化](/info/builders.html)**：設計系統、工具撰寫、命令列、連結與代理。
- <!--i:usercheck--> **[管理](/info/operators.html)**：以 Lolly Work 為團隊運行 Lolly。
- <!--i:server--> **[部署](/info/operate.html)**：託管 Lolly 與 Lolly Work。
- <!--i:shieldcheck--> **[信任](/info/trust.html)**：隱私、安全，以及自行檢查檔案。
