# 開始

將工具設定為你自己的色彩與字型，並重複使用現有作品。不需要帳號，製作與匯出都在你的裝置上進行。

::: steps
- <!--i:eti-sparkles--> **[製作一個檔案](/info/make-something.html)** 幾分鐘內完成 QR code，每個步驟都有示範。
- <!--i:eti-palette--> **[加入你的品牌](#put-your-brand-in)** 從一個色彩、token 檔案或完成的設計開始。
- <!--i:eti-folder-move--> **[帶入你的作品](#bring-in-what-you-already-have)** 在裝置上讀取你已有的設計、簡報與資料。
- <!--i:eti-repeat--> **[製作更多同類作品](#make-many-share-and-automate)** 分享連結、填寫試算表，或透過指令碼執行工具。
:::

[什麼是 Lolly？](/info/what-is-lolly.html)是一篇五分鐘的介紹。[Lolly 如何運作](/info/how-lolly-works.html)說明各方負責的工作。

<!--i:eti-palette-->
## 加入你的品牌

lolly.tools 開啟時使用 **Lolly Demo**，也就是 Lolly 自己的範例設計系統（[認識 Lolly Demo](/info/lolly-demo.html)）。你的設計系統會取代 Lolly Demo。它是一小組設計 token（色彩、字型與幾項規則），每個工具都用它來繪製。設定一次，之後製作的一切從一開始就符合品牌。

依你現有的內容選擇適合的方式：

- <!--i:palette--> **一個色彩。** 開啟 **Design System Setup** 檢視（`#/start`），為設計系統命名，並選擇主色。Lolly 會從該色彩產生符合無障礙需求的調色盤，包括淺色與深色表面、文字與強調色。再選擇字型，就有可用的品牌設定。
- <!--i:upload--> **token 檔案。** Lolly Design System Setup 頂端的 **Add from…** 接受 DTCG、Tokens Studio 或 Penpot token 檔案、SVG 或 `LollyBrand` 套件。調色盤會根據檔案填入。設計系統仍為空白時，Board 上的 **Start from a reference** 會開啟相同的選擇器。
- <!--i:pentool--> **完成的設計。** 在 Lolly Design 中選擇 **Import a design**，並拖入 Figma、Penpot、Illustrator、InDesign、Affinity、Photoshop、PowerPoint 或 SVG 檔案（[所有格式](/info/design-import.html#what-comes-in-from-each-app)）。請見下方的[帶入你現有的內容](#bring-in-what-you-already-have)。

第一次開啟工具庫時，頂端的歡迎訊息會提供一個下一步。在 lolly.tools 上，**Start making** 會開啟 Lolly Design 的 Launch 海報。全新安裝時，**Make it yours** 會開啟 Lolly Design System Setup。該按鈕下方的 **Bring a file** 會開啟設計檔案選擇器，而前述兩個選項中的另一個會顯示為連結。選擇其中任何一項，或按下關閉按鈕，都會永久關閉歡迎訊息。

![全新設計系統在 Lolly Design System Setup 中的 Colours 工作區：一個即時色票、一個欄位，就是第一個決定所需的一切](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

八個工作區可依任意順序使用，進一步完善設計系統：**Board**、**Colours**、**Type**、**Logos**、**Tokens**、**Files**、**Rules** 與 **Skills**。你輸入時，應用程式中的每個預覽都會更新。[Lolly Design System Setup](/info/brand-studio.html)說明了各個工作區。

字型保存在你的裝置上。你選擇的 Google Font 會儲存為品牌素材，因此字體可離線使用，工具繪製時也不會擷取任何內容。

### 查看、切換與分享設計系統

- **查看目前使用的設計系統。** **Settings → Design system** 會以封面與頁面呈現目前使用的設計系統，僅供閱讀。
- **在設計系統之間切換。** **Settings → Preferences → Design systems** 列出這部裝置上的每個設計系統。一個組織可以使用數個設計系統，或一個包含數種配色方案的設計系統。[品牌架構](/info/brand-architectures.html)說明這些配置。
- **分享設計系統。** 將設計系統匯出為 `LollyBrand` 套件：同事只需匯入這一個檔案，就能取得相同的調色盤、字型與規則。

建置版本或組織提供的設計系統屬於**受管理**的設計系統：會顯示鎖頭，並維持唯讀。若要更改，請從 **Settings → Preferences → Design systems** 建立可編輯的副本。

![Settings 中的 Design system 分頁：以封面與頁面呈現目前使用的設計系統](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

你的設計系統由 DTCG token 組成，這是 Penpot 讀寫的格式，Tokens Studio 也能將它帶入 Figma。你設計時使用的調色盤與 Lolly 套用的調色盤是同一份文件。[設計 token](/info/design-tokens.html)有詳細說明。

::: details 開發者適用：從命令列建立品牌套件
`ingest:brand` 會在簽出的程式碼中建立可重複使用的品牌套件。它接受 Penpot 與 Tokens Studio 匯出的三種容器：單一 `tokens.json`、含有 `$metadata.json` 並依集合分檔的目錄，或 `project.penpot` 封存檔。

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` 會將品牌註冊為設定檔，並建置及驗證其目錄。它絕不更改預設設定檔：執行時使用 `LOLLY_PROFILE=acme` 即可使用新套件。[設定](/info/configuration.html)說明品牌套件與設定檔如何配合。
:::

<!--i:eti-folder-move-->
## 匯入現有內容

**Lolly Design 檔案。** 在 Figma、Penpot、Illustrator、InDesign 或任何 SVG 應用程式中完成的作品，都能在 Lolly Design 中開啟為可編輯的版面。文字仍可修改，圖形仍是圖形，圖片則存入你的資料庫。檔案在瀏覽器中讀取，不會上傳任何內容。[匯入設計](/info/design-import.html)列出各種格式與保留的內容。

**簡報。** 將 PowerPoint `.pptx` 拖放到 Lolly 上，即可將其中的投影片存為素材。在 **Lolly Markdown Slides** 中以 Markdown 撰寫新簡報。[重塑簡報品牌](/info/rebrand.html)會將簡報改用你的設計系統。

**資料。** 貼上或拖放 CSV 或 JSON 表格，即可填入工具的重複欄位。[Lolly Batch](/info/batch.html#make-many-versions-of-one-design)會為每列製作一個完成的檔案。

### 從單次作品變成範本

匯入的版面是一般的 Lolly Design 工作階段。**Share with rules** 會將工作階段轉為工具。你決定其他人可以更改哪些部分，他們就只能填入那些部分。

![保留 Lolly Design 原稿，在編製工具的副本中選擇輸入與限制，再分享可重複使用的 .lolly 工具，讓收件者填寫](/info/diagrams/concepts/share-with-rules.svg)

[分享附有規則的設計](/info/create-a-tool.html)會帶你走過每個步驟。

<!--i:eti-repeat-->
## 大量製作、分享與自動化

- <!--i:download--> **匯出。** 工具可製作 SVG、PDF、PNG、JPG、WebP、影片等格式，需要時也能使用實際印刷尺寸。每個工具都有自己提供的格式。請見[匯出檔案](/info/exporting.html)。
- <!--i:link--> **分享連結。** 工具的設定隨連結傳遞，因此連結在任何地方都能重新開啟相同的檔案。
- <!--i:layers--> **每列製作一份。** 在 [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) 中以試算表驅動工具。
- <!--i:cpu--> **自動化。** 同樣的渲染可透過 [CLI](/info/cli.html) 與 [AI 代理](/info/ai-agents.html)執行。

一個連結就是完整的請求。下方圖表的類型、標題與資料表，都是在網址列中輸入的。

![以設計系統色彩呈現各管道每月註冊人數的長條圖，每個數值都透過查詢參數傳入，而非點擊輸入](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## 接下來看什麼

- <!--i:people--> **[創作](/info/creators.html)**：製作、動畫、錄製、分享與匯出。
- <!--i:code--> **[自動化](/info/builders.html)**：設計系統、工具編製、命令列、連結與代理。
- <!--i:usercheck--> **[管理](/info/operators.html)**：使用 Lolly Work 為團隊運行 Lolly。
- <!--i:server--> **[部署](/info/operate.html)**：託管 Lolly 與 Lolly Work。
- <!--i:shieldcheck--> **[信任](/info/trust.html)**：隱私、安全與自行檢查檔案。
