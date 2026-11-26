# 匯出檔案

按下 **Export**，也就是 **Export | Save** 膠囊的左半部，在檔名旁選擇格式，再按下 **Download**。檔案會在你的裝置上製作。

檔案包含你在畫布上看到的內容。格式選單只列出這個工具在這個瀏覽器中能製作的格式。

大多數工作只需要三種格式之一：

| 用途 | 選擇 | 原因 |
|---|---|---|
| 螢幕、訊息或投影片 | **PNG** | 每個應用程式都能開啟，工具提供透明背景時也能保留 |
| 完成的頁面，或任何列印內容 | **PDF** | 真實頁面尺寸，列印效果所見即所得；工具提供的 **Print PDF** 是供印刷機使用的 CMYK 版本 |
| 任何尺寸都必須保持清晰的圖稿 | **SVG** | 向量圖形 |

::: check 以實際使用的尺寸檢查檔案
傳送檔案前，請在預定使用的螢幕上開啟，或以實際尺寸列印。
:::

::: details 使用 Lolly Work 核准與交付（選用）
[執行 Lolly Work 的組織](/info/organisation.html)可以選擇成員看到的格式與匯出設定。需要核准時，**Request approval** 會取代 **Download**。請遵循你的實例顯示的政策。

Lolly Work 也能將檔案交付到已設定的 S3、WebDAV 與 HTTP 目的地，並附有核准步驟、交付回條與稽核記錄。這種交付會將檔案傳送到組織的服務。一般下載則留在你的裝置上。個人 Send 目的地與組織交付分別設定。

營運者依[組織交付指南](/info/work-delivery.html)設定。關於排入佇列的伺服器渲染與批次，請見 [CLI 批次與自動化](/info/cli-automation.html#organisation-jobs-with-lolly-work)。
:::

<!--i:eti-cpu-->
## 匯出如何運作

檔案有三種產生方式。大多數工具**渲染畫布**。文字與資料格式（HTML、Markdown、TXT、JSON、CSV、ICS、VCF）**由工具內容產生**。*Lolly Strip Hidden Data* 等隱私工具會在你的裝置上**轉換你選取的檔案**。結果沒有畫布、浮水印或附加的中繼資料。

![三種匯出方式產生完成的檔案：渲染畫布、由內容產生文字或資料，或在裝置上轉換選取的檔案。](/info/diagrams/concepts/three-export-paths.svg)

工具作者決定匯出面板提供哪些動作。預設為 Copy、Download 與 Save。

- <!--i:download--> **Download** 儲存檔案。若之後找不到，請見[尋找你下載的檔案](/info/find-your-work.html#find-a-file-you-downloaded)。
- <!--i:photos--> **Copy** 將圖片放到剪貼簿。瀏覽器無法複製圖片時，Copy 會改為下載檔案並告知你。
- <!--i:folder--> **Save** 將目前的設計保存在 Projects 中，絕不下載檔案。**Download** 旁的 **Save as** 會詢問存放位置（請見[儲存與接續](/info/using.html#saving-continuing)）。
- <!--i:link--> **Share** 開啟 Share 對話框：重現設計的連結、開啟時的切換選項（全螢幕、匯出面板、開啟時下載或複製），以及選用的 **Shortest link**，將狀態打包成精簡的 token（請見 [URL 模式](/info/url-mode.html)）。

**Send to** 是匯出面板中的卡片，會將檔案傳送到你連接的服務。傳送到 Google Drive、Nextcloud、S3 儲存貯體、Dropbox 或 OneDrive 後，**Create a share link** 可在該處建立連結，無須再次上傳。Share 對話框的 **Share through your cloud** 區段可一步完成 `.lolly` 檔案的傳送與連結建立。連結面板顯示誰能開啟連結、檔案存放位置與連結到期時間。Share 對話框中的 **Links you've shared** 可讓你停止分享。Nextcloud 連結可設定密碼與到期日。S3 連結有效期為 1 到 7 天，無法提前停止。Lolly 不會在伺服器上保留檔案副本或登入 token。[隱私](/info/privacy.html#every-network-request-the-app-can-make)列出各服務收到的資訊。

![匯出面板：格式、尺寸與 Copy / Download / Save / Share 動作](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

設計嵌入另一個工具的渲染結果時，例如 Lolly Design 的圖片方塊中包含 QR Code 連結，父項的匯出會繪製巢狀渲染結果。在 SVG 與 PDF 中仍保留向量，在 PNG、JPG 與 WebP 中則轉為點陣圖。嵌入的渲染結果沒有自己的浮水印或來源證明；只有完成的檔案才有。HTML、Markdown 與 TXT 匯出無法容納組合的渲染結果。

<!--i:eti-file-->
## 挑選格式

檔名與格式選單合併為一組 `name.format`，位於 **Download** 下方。

![檔名欄位與格式選擇器合併，讓匯出顯示為一組 name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

先考慮檔案要用在哪裡。每張卡片會列出適合該目的地的格式。

::: figure exporting-format-chooser
六個目的地與各自適合的格式。
:::

使用設計系統字型排版的字標會匯出為 SVG，每個字母都是轉外框的路徑。檔案在任何尺寸下都保持清晰。

其他語言的文字取決於你擁有的字型。設計系統的字型包含所需字元時，SVG 與 PDF 會將它們繪製為外框，完成字形塑形並依閱讀順序排列，也包含由右至左的行。若都沒有，Lolly 會使用[備用字型](/info/fallback-fonts.html)，匯出卡片會顯示該字型。沒有任何備用字型涵蓋的文字會在 SVG 中保留為即時文字，由檢視器自己的字型繪製。在 PDF、EPS 或 WMF 中，以及開啟 **Outline fonts** 的 EMF 中，這些文字會轉為圖片。這些字看起來與頁面上相同，但無法選取或搜尋。匯出卡片會列出這些文字系統。加入含有所需字元的字型，即可保留為向量文字。

![以細線體和寬字距呈現 Aurora 的字標，正是表格中 SVG 一列所指的純向量圖稿](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details 各種格式及其用途
| 你需要 | 使用 | 原因 |
|---|---|---|
| 縮放後仍清晰的標誌或圖稿 | **SVG** | 向量：可縮放、體積小且可編輯；向量匯出無法繪製的效果會嵌入為圖片 |
| 用於 Office 與 Windows 應用程式的向量 | **EMF** | 貼入 PowerPoint 與 Word 後是可編輯的向量，文字保持即時文字；Google Drive 會用 Google Drawings 開啟 |
| 用於印刷與設計應用程式的向量 | **EPS**，或 **EPS (CMYK)** | 用於 Illustrator 與印刷流程的 PostScript 向量 |
| 用於切割機的向量 | **DXF** | 雷射切割機、割字機與 CNC：以公釐表示的輪廓路徑 |
| 可編輯的投影片簡報 | **PowerPoint**（PPTX） | 原生可編輯的文字與圖形，圖片與向量仍可擷取 |
| 可編輯的文字文件 | **Word**（DOCX）或 **OpenDocument**（ODT） | 文書處理器可接續編輯的段落與標題（Lolly Doc Studio） |
| 用於 InDesign 的版面 | **InDesign IDML (static subset)** | 文字、矩形、橢圓與圖片，每個畫板對應一個跨頁（Lolly Design） |
| 可編輯的 Penpot 文件 | **Penpot** | 看板、圖形、文字與連結的 token |
| 照片或一般用途圖片 | **PNG**（無損）或 **JPG**（較小） | 通用點陣圖 |
| 體積較小的現代圖片 | **WebP** 或 **AVIF** | 壓縮效果更好，支援透明度 |
| 列印 | **PDF**，或 **Print PDF**（CMYK） | 真實頁面尺寸；CMYK 用於印刷機 |
| 印刷機用的點陣圖 | **Print TIFF**（CMYK） | 提供給 RIP 的 DeviceCMYK 像素 |
| 網頁動畫 | **GIF** | 隨處可播放；檔案較大 |
| 全彩且具有真正透明度的動畫 | **APNG** | 動態 PNG：不受色盤限制 |
| 檔案最小的動畫 | **Animated WebP** | 全彩與透明度，體積小於 GIF 或 APNG |
| 可縮放的向量動畫 | **Animated SVG** | 自成一體；在瀏覽器或 `<img>` 中以任何尺寸循環播放（Lottie Ad） |
| 保持可編輯的動畫 | **dotLottie** | Lolly Design 時間軸中的圖形、路徑與外層變形關鍵影格 |
| 交付給 Premiere 的檔案 | **Premiere XML + media** | 提供給 Premiere 的定時片段與原始媒體（Lolly Design） |
| 社群與分享用的影片 | **MP4** 或 **WebM** | 相同檔案大小下品質最佳（請見[影片](#video)） |
| 字幕 | **SRT** 或 **VTT** | 影片播放器用的定時文字（Captions、Audiogram 與 Record） |
| 廣播字幕 | **TTML** 或 **SCC** | IMSC1.1 定時文字或 CEA-608 pop-on 字幕（Captions；請見[廣播字幕](#broadcast-captions)） |
| 訓練課程 | **SCORM (LMS)** | 具版本的網站、SCORM 或 xAPI 套件（請見 [SCORM](#scorm-course-packages)） |
| 富文字或電子郵件簽名檔 | **HTML** | 以格式化內容貼入郵件用戶端 |
| 在瀏覽器播放的動畫 | **HTML** | 由 Lolly Design 時間軸或 Snippet 產生的單檔播放器（請見[影片](#video)） |
| 純內容 | **MD** 或 **TXT** | 只有文字 |
| 行事曆活動 | **ICS** | 可匯入任何行事曆應用程式 |
| 聯絡人名片 | **VCF** | 可匯入通訊錄 |
| 供重新匯入的結構化資料 | **JSON** 或 **CSV** | 完整往返保留工具內容 |
| favicon | **ICO** | 多尺寸網站圖示；**ZIP** 可打包多種格式 |
:::

### 透明度

支援透明度的工具會提供透明背景切換，例如 **No BG**。PNG、WebP、AVIF、SVG、APNG 與 Animated WebP 保留透明度，GIF 則保留硬邊緣。JPG 與 PDF 一律不透明。TIFF 會壓平到白底上；走 [HDR](#hdr-bright-colours) 路徑時則壓平到黑底上。

<!--i:eti-crop-->
## 尺寸與列印單位

匯出使用工具原生的像素尺寸，除非工具提供 **dimensions**。這時可設定寬度、高度與 **unit**：

- **px**（預設）是精確像素。
- **mm, cm, in, pt** 與 **pc** 是實體尺寸。使用實體單位時，也要設定 **DPI**（預設為 300）。**PDF** 會成為該尺寸的真實頁面。**點陣圖**會依該 DPI 取得對應的像素數，並記錄解析度。**SVG** 會保留實體單位與像素 viewBox。

若要提高點陣圖的解析度，輸入更大的寬度與高度，或選擇實體單位並提高 DPI（像素 = 尺寸 × DPI）。寬度 `210`、高度 `297`、單位 `mm` 會產生 A4 頁面。

![尺寸列設為 210 乘 297 mm，因使用實體單位而顯示 DPI 欄位](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## 從定時合成擷取靜態圖

從定時合成，例如 Lolly Design 中的 [Sequence](/info/sequence-editor.html) 時間軸匯出靜態圖時，會擷取**播放頭所在的影格**。將播放頭停在想要的畫面位置，再匯出。

若要擷取多個時刻，使用輸出尺寸旁的 **Frames** 欄位。它只會在定時合成搭配靜態格式（PNG、JPG、WebP、SVG 或 PDF）時顯示。`1` 會擷取播放頭影格。較大的數字會產生對應數量的靜態圖，平均分布於整個序列：

- PNG、JPG、WebP 與 SVG 以一個 ZIP 回傳：`<name>-01.png`、`-02.png`，依此類推。
- PDF 則以具有對應頁數的單一文件回傳。

每張靜態圖都取自各自時間軸片段的中間，因此第一張不會是只淡入一半的入場畫面，最後一張也不會是片段結束後的空白時刻。

::: figure exporting-contact-sheet
Frames: 4 會將序列均分為四段，並擷取每段的中間。
:::

使用 Frames 製作分鏡腳本、審閱用接觸印樣，或從影片剪輯擷取社群輪播。數量上限為 64。在欄位中輸入其他內容都會回復為 `1`。每個影格都是一般靜態圖，因此憑證、Imprint、實體單位與 DPI 的行為都與單次匯出相同。匯出連結、CLI 與 MCP 可使用 `cuts=` 要求相同的接觸印樣（請見[接觸印樣](/info/url-export.html#contact-sheets)）。

<!--i:eti-copy-->
## 一次處理多個檔案

Lolly 提供三種大量處理方式：

::: cols
## 表格變成一份文件
能將輸入表格分頁的工具會把每列轉成一頁。從試算表貼上表格，就能取得一份 PDF。若要修正資料列，請編輯試算表後重新貼上。Battlecards 是參考工具，位於開源的 `community` 資料夾中，未列於 lolly.tools。
## CSV 每列變成一個檔案
**Batch**（`#/batch`）接收 CSV，為每列渲染一個匯出檔案，例如名牌或證書，並以 ZIP 交付。請見 [Lolly Batch](/info/batch.html#make-many-versions-of-one-design)。
## 對數份設計進行同一項編輯
**Lolly Multi-edit** 並排開啟多個已儲存的工作階段，讓你對各個設計做相同更改。請見 [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together)。
:::

多頁工具，例如 Booklet、Print Sheet、Lolly Doc Studio 或 Lolly Markdown Slides，匯出 PNG、JPG、WebP、SVG 與其他單張圖片格式時，每頁會產生一個檔案，多個檔案則打包成 ZIP。Print Sheet 會以選定的 DPI 保留完整版面與裁切標記。

在 **Projects** 中，**Render folder** 會將資料夾及其子資料夾中的所有已儲存工作階段匯出成一個巢狀 ZIP。**Render selection** 會對多重選取執行相同操作。單一已儲存工作階段會渲染成自己的檔案。Projects 也可將已儲存工作階段再次以工具連結分享，以相同設定重新開啟。

<!--i:eti-pen-->
## 在其他應用程式中仍可編輯的檔案

有些格式會將作品以可編輯內容的形式交給另一個應用程式，而非圖片。

### PowerPoint (PPTX)

Lolly Design、Lolly Markdown Slides、Booklet、Lolly Doc Studio、Lolly Chart、Diagrams、Flow Chart 與 Agenda 可匯出 PowerPoint 簡報，每頁對應一張投影片。每頁會拆分成同事可編輯與擷取的原生物件：

- <!--i:font--> **文字**會轉成可編輯的 PowerPoint 文字方塊，保留版面的字型大小、色彩、粗細、斜體與對齊。Lolly Design 簡報會為每個文字片段設定品牌字型，即使沒有投影片母片也一樣。
- <!--i:pentool--> **向量**，例如標誌與圖示，會嵌入為 SVG 圖片，PowerPoint 可對其執行 *Convert to Shape*。
- <!--i:photos--> **圖片**會以原生解析度各自保留。裁切的主視覺會在裁切範圍後保留完整圖片。圖片上的濾鏡或混合效果都會直接套用到圖片中。
- <!--i:layers--> **背景、邊框與線條**會轉成矩形與線條圖形。Lolly Design 中的圓形、橢圓與膠囊形仍是可編輯的原生圖形。

![匯出面板選擇 PowerPoint：每頁對應一張投影片，文字與圖形保留為可編輯內容](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

版面為近似呈現。walker 無法原生表達的內容，例如複雜濾鏡或遮罩區域，會嵌入為圖片。一份簡報只有一種投影片尺寸，取自第一頁。

PowerPoint 也可用於匯入：[重塑簡報品牌](/info/rebrand.html)將簡報移到你的設計系統，[匯入設計](/info/design-import.html)則在 Lolly Design 中開啟簡報。

### Penpot

多數能匯出 SVG 的工具也能匯出 **Penpot 檔案**（`.penpot`）。

| 製作的內容 | 在 Penpot 中 |
|---|---|
| 文字 | 可編輯的文字物件 |
| 圖形、路徑、漸層與圖片 | 可編輯的向量圖形 |
| 來自設計系統 token 的色彩或字型 | 即時 token 連結：編輯 token，所有繼承它的圖形都會跟著變動 |
| 整份設計 | Assets 面板中的可重複使用元件 |
| 複雜插圖或即時畫布 | 嵌入的圖片；周圍內容仍可編輯 |

從 Lolly Design 匯出時，每個框架會轉成 Penpot 看板。設計系統的色彩與字體排印會進入 Assets 面板，完整的 token 集合則進入 Tokens 面板。Penpot 會保留自己的副本。在 Penpot 編輯的 token 可透過 [Lolly Design System Setup](/info/brand-studio.html) 的匯入帶回。

![匯出面板選擇 Penpot：.penpot 檔案，以及下載旁的 Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

若要開啟檔案，啟動 Penpot、挑選專案，再選擇 **Import**。若從匯出面板登入 Penpot，**Send to Penpot** 會為你匯入檔案。

### Word、OpenDocument 與 InDesign

**Lolly Doc Studio** 可匯出 **Word**（DOCX）與 **OpenDocument**（ODT），保留可編輯的段落與標題。Word 檔案透過文件樣式設定品牌字型與文字色彩，採用你選擇的頁面尺寸，並在 SVG 標誌旁附上 PNG，供無法繪製 SVG 的應用程式使用。

**Lolly Design** 可匯出 **InDesign IDML (static subset)**：文字、矩形、橢圓與 PNG 或 JPEG 圖片，每個畫板對應一個跨頁。支援的行內格式仍可編輯，圖片包含在 `Links` 中，座標則轉為 InDesign 點數。重新連結、字型替換與換行變化可能需要處理。效果、動畫、組合文章與不支援的幾何圖形會使匯出停止，並在報告中列出。IDML 不會保留原始文件。完成的圖稿請以 PDF 傳送。

### 時間軸：dotLottie 與 Premiere

從 Lolly Design 的時間軸匯出時，**dotLottie** 會寫出可在 Lottie 工具中繼續編輯的動畫；[Lottie 動畫](/info/sequence-editor.html#lottie-animations)列出保留的內容。**Premiere XML + media** 則將定時片段與原始媒體打包供 Premiere 使用；請見 [Premiere XML 交換](/info/sequence-editor.html#premiere-xml-exchange)。

### SCORM（課程套件）

課程匯出預設關閉，需在 Settings → Preferences → Feature flags 中開啟 **Training and courses**。

接著從支援的工具、專案資料夾或選取範圍選擇 **Export course**。在 Lolly Design 中，選擇 **SCORM (LMS)** 與 **Download** 會開啟相同的課程流程。Lolly 會儲存作品，顯示課程內容與順序供檢閱，再開啟模組與匯出對話框。

- <!--i:layers--> 為每個來源選擇呈現方式：靜態頁面、以影片呈現的動態內容、音訊或可下載的資源。在模組中加入課程文字與供閱讀的替代內容。
- <!--i:clock--> 預覽學員播放器，檢閱說明與字幕。動態內容，包括無聲動畫，都會以影片納入。
- <!--i:document--> 選擇 Website、SCORM 1.2、SCORM 2004 4th Edition 或實驗性的 xAPI 目標。檢查內容與 ZIP 大小，再儲存並下載已檢查的版本。
- <!--i:check--> 必須確認每一個必修單元並選擇 Finish，才能完成。

![Lolly Design 簡報的匯出面板，已選擇 SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

套件包含完成的內容，不需要 Lolly 帳號。將 Website ZIP 放到 HTTP(S) 主機；LMS ZIP 則原樣匯入。分享課程前，先測試目的地。若要從多份已儲存的作品建立課程，請見[建立訓練課程](/info/training-creators.html)。

### 廣播字幕

Captions 工具也能匯出 **TTML** 與 **SCC**。兩者與 SRT、VTT 檔案都從同一份字幕提示清單產生，因此文字與時間一致。

- **TTML** 採用 IMSC1.1 Text Profile，使用媒體時間基準的時鐘時間與單一底部中央區域。它不包含各則字幕的色彩、字型或位置，因為 Lolly 字幕只有開始、結束與文字。
- **SCC** 以每秒 29.97 個影格與丟格時間碼，在通道 1 傳送 CEA-608 pop-on 字幕。支援北美基本字元，以及特殊與擴充字元。若字幕含有字元集以外的字元，匯出會停止並指出該字元。每則字幕以 32 欄換行，最多 15 列。無法在開始時間前載入的字幕會延後幾個影格。
- 不會寫出捲動式與逐字顯示式字幕。

::: note SCC 尚未經廣播工具檢查
也尚未在硬體解碼器上試用。交付前，請在自己的流程中測試檔案。
:::

### DXF（切割檔案）

Lolly Asset Export、Diagrams、Growth、Lolly Logo Wall、QR Code、Street Map、Wayfinding 與 Wordmark 可匯出 **DXF**，也就是雷射切割機、割字機與 CNC 軟體能讀取的 AutoCAD R12 交換格式。幾何圖形會寫成以公釐為單位的輪廓路徑，文字則轉為外框。色彩對應到最接近的 AutoCAD Color Index，通常用來控制切割機的操作。DXF 只有線條圖：照片或套用濾鏡的區域沒有切割路徑，會被捨棄並顯示警告。若要保留點陣內容，請使用 SVG 或 PDF。若文字沒有任何字型涵蓋，連[備用字型](/info/fallback-fonts.html)也沒有，匯出會停止，並在訊息中引用該文字。

Street Map 設計全由筆畫組成，因此每條道路與運河都會變成切割路徑。

::: showcase
![Street Map 渲染的巴黎地圖，以墨色繪於奶油色背景：純線條圖，因此每個筆畫都能完整送到切割機](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

捲動時，鏡頭穿過幾何圖形向後拉遠：七條路徑，沒有像素。切割機讀取的是同一個檔案。
:::

<!--i:eti-stamp-->
## 印刷

**Print PDF** 依具名印刷條件寫出 CMYK，預設為 **Coated FOGRA39**。具有實測油墨值的品牌色票會保留那些值。其他色彩則透過印刷色彩描述檔轉換：預設使用 Lolly 自有的 Coated FOGRA39 描述檔，或在選擇你自己描述檔的 **Embed** 列後使用該描述檔。灰色與黑色只留在黑版上，讓小字不會套印錯位。FOGRA51、SWOP 與 GRACoL 使用標準裝置轉換。黑字也會疊印在下方色彩上，因此印刷機即使稍微偏移，字緣也不會露白。**Print TIFF** 會為 RIP 寫出 DeviceCMYK 像素。Colour profile 控制項會控制這兩種格式（[色彩描述檔](#colour-profiles)）。Print TIFF 與 **EPS (CMYK)** 使用和 Print PDF 相同的印刷色彩描述檔進行分色。

**Print marks & bleed** 在印刷格式中有獨立的卡片：以公釐表示的出血，以及 Crop、Registration、Bleed、Colour bars 與 Stamp details。Stamp details 會在邊界印上日期、工具與你的姓名。若姓名或工具名稱包含邊界字型沒有的字元，例如阿拉伯文、中文、西里爾字母或 emoji，則會以相同的灰色繪成圖片。匯出卡片會列出這些文字系統。

有些工具，例如 *Booklet*，會建立**多頁 PDF**：封面、依需要延伸到多頁的內容，以及封底。每頁都是真正的 A4、US Letter 或 A5 直式 PDF 頁面。你可以強制任何區塊另起新頁。這些是沒有裁切或出血標記的 RGB 文件；那些標記屬於單頁 Print PDF。Lolly Design PDF 也能成為 **Notes handout**：每張投影片各佔一張直式頁面，下方附有講者備註。

**匯出前。** 面板底部的 **Before you export** 卡片顯示印刷廠會看到的資訊：格式、尺寸與出血、裁切與出血區域、油墨覆蓋率、色版數與頁數，標題旁附有判定結果。卡片絕不會阻止匯出。Lolly Design 一律顯示這張卡片，包含自己的檢查項目，例如逐圖層檢查設計系統的組織規範，以及文件文字的寫作訊號（[匯出前](/info/design.html#before-you-export)）。開啟 **Print preflight** 時，Lolly Design 會加入這些印刷檢查。其他工具則需在 Settings → Preferences → Feature flags 中開啟 **Print preflight**。此功能預設關閉，Lolly Work 部署可為成員開啟。

**匯出後。** Lolly 會讀回完成的檔案，並與你的選擇比較：格式、像素或頁面尺寸、片段長度、透明背景、CMYK 色彩、HDR、Content Credentials，以及 PDF 或 ZIP 密碼。所有差異都會寫在匯出卡片上。每項測量都來自檔案，絕不取自設定。檔案無法確認的屬性不會被算作相符。命令列可透過 `--export-report` 寫出完整比較（請見[使用 CLI 渲染](/info/cli-rendering.html)）。

::: details 從命令列執行 PDF 無障礙檢查
**PDF 無障礙檢查。** 對於 PDF，命令列也會在 `--export-report` 檔案的 `pdfAccessibility` 下列出 32 項無障礙檢查。每項檢查都有 id、簡明說明、結果，以及在檔案中發現問題的位置：

- **Passed**：檢查已查看內容，未發現問題。
- **Failed**：檢查發現問題。會列出相關頁碼或標籤。
- **Not applicable**：檔案沒有該類內容可供檢查，例如對沒有表格的檔案進行表格檢查。這不代表對檔案做出任何判斷。
- **Needs a person**：有六項檢查無法由程式判斷（閱讀順序、色彩對比、閃爍、指令碼、時間限制與重複連結）。

這份清單不是判定結果。它不表示 PDF 符合 PDF/UA，也不表示使用輔助技術的人能使用該 PDF。仍需有人以螢幕閱讀器檢查檔案。目前 Lolly 自己的 PDF 也無法通過標記檢查，因為匯出器還不會寫入標籤。檢查會在你的裝置上讀取檔案，不做任何更改。需要密碼的檔案會標示為未檢查，而非通過。若要檢查收到的 PDF，將它拖放到 [Lolly Strip Hidden Data](/info/utilities.html)，即可在 **PDF accessibility checks** 下看到相同清單。
:::

Lolly Design 的 Inspector 檢查與 Lolly Design System Setup 的品牌比較針對設計。這兩張卡片則針對檔案。

::: details 依費率表計算成本
預檢下方的成本卡片會將相同的計數換算成金額，即使預檢卡片已關閉也一樣。它需要兩樣東西：價目表能定價的工作（色版、紙張、面積、頁數、變體列或輸出檔案，因此單純的標誌 PNG 絕不會顯示這張卡片），以及**費率表**，也就是印刷廠提供的 JSON 價目表。預設建置版本不附費率表，應用程式內也沒有載入方式。費率表會作為部署隨附的目錄素材提供，或透過自行託管者或控制平面啟用的選用費率表擴充功能提供。沒有費率表時，不會顯示任何內容。

每個金額都是你提供的費率乘以 Lolly 計數的數量，例如 `4 plate × €35.00`。總額會顯示來源：費率表上的發行者與費率日期。沒有預設貨幣，也沒有佔位價格。檔案對自身的說明會保留為轉述：*「檔案表示：… Lolly 尚未驗證此資訊。」*

若無法計算某個金額，表格會隱藏，而不會填入數字：

- 費率表未定價的項目意味著**完全沒有總額**，只會以標題顯示有多少項未定價。
- 若數量是上限，小計會帶有**「最多」**。
- 費率超過有效期限時，會**只顯示數量**，直到你按下 *Use these rates anyway*；之後到期日仍會與金額一起顯示。
- 透過**連結**開啟時，金額會保持隱藏，直到你在這部裝置上要求顯示。CLI 的 `--rate-card=<file.json>` 接受本機檔案，絕不接受作為連結參數。

這張卡片會從每個匯出階段移除，絕不更改檔案。這是算術計算，不是報價。只有你的印刷廠能報價。
:::

<!--i:eti-film-->
## 動態與聲音

### 影片

動畫工具可匯出 **MP4** 與 **WebM**。分享的 `?format=` 連結若指定瀏覽器無法製作的容器格式，會改用另一種，並使用相符的檔名。**Start after** 會讓畫布保持靜止，使動畫與字型在錄製前穩定下來。**Duration** 設定成品片段的長度。**Motion blur**（Off、Draft quality、Standard 或 High，搭配 **Shutter angle**）會模糊快速動作，並使渲染變慢。瀏覽器支援時，**Record live** 會透過螢幕分享即時錄製螢幕上的預覽。

![動畫匯出的時間設定：Start after、Duration、Motion blur 及其 Shutter angle，以及 Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** 可選擇 Smaller file、Balanced 或 Best quality。**Advanced** 會開啟 **Codec**、**Frame rate**、**Rate mode** 與 **Hardware acceleration**。工具有字幕時，**Captions** 可選擇 **Embedded track**，或放在影片旁的 **Sidecar .vtt + .srt**。連結會以 `vq`、`codec`、`fps`、`seconds` 與 `wait` 帶入品質、編解碼器、影格率、長度與開始延遲（[URL 參數](/info/url-parameters.html)）。

影片匯出會保留聲音。工具可在片段下加入**背景配樂**：將音訊素材循環播放或裁切至片段長度，並設定淡入淡出、音量，以及在原始影片聲音播放時自動降低音量。錄製工具會將即時音訊帶入檔案。

Lolly Design 的點擊式簡報也能匯出成影片。Present 選單中的 **Export slides as video** 會開啟匯出面板並選定 MP4。每張投影片會依自己的停留時間播放；未設定時，則使用匯出面板的 Duration。簡報的投影片轉場會以溶接方式在投影片間播放。文件不會改變。

**HTML** 若由定時 Lolly Design 文件或 Snippet 匯出，就是單檔播放器：在動畫上提供播放、跳轉與聲音控制，並嵌入支援的字型、圖片與聲音。檔案可離線播放。具有場景的 Lolly Design 影片會加入場景選單。含有影片、Lottie 或 3D 片段的序列目前還無法匯出為 HTML；請將序列匯出為影片。

### 動態圖片

**GIF** 隨處可播放，適合聊天與電子郵件；比影片大，色彩也較少。**APNG** 與 **Animated WebP** 保留全彩與透明度。**Lottie Ad** 也能匯出 **Animated SVG**：嵌入 CSS 關鍵影格的向量影格，可縮放至任何尺寸，在瀏覽器分頁或 `<img>` 中循環播放，不需要編解碼器。文字會轉為外框。因為每個影格比點陣圖更大，預設影格率較低。這些格式都沒有聲音。

### 音訊

有些工具可單獨匯出聲音。**Lolly Voice Recorder** 以即時音量表擷取麥克風錄音，並在你的裝置上編碼，儲存為 **MP3**、**WAV**、**M4A (AAC)** 或 **Opus (WebM)**。`wav`、`mp3`、`m4a` 與 `opus` 都是一般格式 id，因此音訊匯出和 PNG 一樣，可分享也可用指令碼操作。

素材選擇器接受多種音訊格式作為背景配樂，從 MP3、FLAC 到 MIDI 與 tracker 模組；[格式](/info/formats.html)列出了完整清單。[Lolly Rondocode 歌曲](/info/rondocode.html)會依片段要求的長度播放。

<!--i:eti-palette-->
## 色彩與 HDR

Lolly 能讀取所有現代 CSS 色彩，以感知方式進行色彩運算，並將各檔案寫入讀取端能開啟的色彩空間：螢幕使用 sRGB、印刷使用 CMYK、HDR 使用 Rec.2100 PQ（[引擎中的色彩](/info/colour-engine.html)）。設為 **Wide colour / HDR** 的 Lolly Design 文件有自己的規則：請見[廣色域與 HDR 編輯](/info/hdr-editing.html)。

### 色彩描述檔

匯出檔案會標記色彩描述檔，讓印刷廠使用的軟體、Photoshop 與瀏覽器等具有色彩管理的應用程式，能依你看到的樣子讀取色彩。縮圖與預覽不加此標記，以保持較小的體積。

- **PNG 與 JPG** 內嵌 **sRGB** ICC 描述檔，這也是繪製預覽所用的色彩空間。像素只加上標記，不會重新編碼。
- **Print PDF (CMYK)** 在其 *OutputIntent* 中宣告印刷條件，告訴印刷廠應如何解讀其中的 CMYK 油墨。
- **Print TIFF (CMYK)** 寫出未標記的 DeviceCMYK 像素，並在 TIFF 中繼資料中記錄印刷條件。TIFF 無法嵌入印刷色彩描述檔，因此 **Embed** 列只記錄該描述檔的名稱。
- **TIFF (RGB)** 是未壓縮的 sRGB 版本，供封存或往返編輯器使用。兩種 TIFF 都只限桌面版，因為瀏覽器無法預覽 TIFF。
- **SVG**、**EMF**、**EPS** 與 **DXF** 都是沒有內嵌描述檔的向量：SVG 的色彩為 sRGB，EMF 與 EPS 使用裝置 RGB，**EPS (CMYK)** 寫出 DeviceCMYK，DXF 則使用 AutoCAD Color Index。SVG、EPS 與 DXF 會將文字轉為外框路徑。EMF 在 Office 與 Google Slides 中保留可編輯的即時文字，只將格式無法表達的文字片段轉為外框。匯出面板的 **Outline fonts** 選項會強制全部使用路徑，如同連結中的 `_text=outline` 與命令列中的 `--text=outline`。SVG 也會重現 CSS 方塊內外的陰影。

::: details PDF/X-4 與你自己的印刷色彩描述檔
Lolly 隨附一個 CMYK 描述檔，依 Fogra 的 FOGRA39 特性化資料擬合，以 CC0 發布，並在預設印刷條件下透過它轉換色彩。這個描述檔不會內嵌，因為其 ICC 版本是 4.3，而 PDF/X-4 最高只接受 4.2。因此，具名印刷條件會寫入輸出意圖，但不宣告符合 PDF/X-4。

載入你自己的 CMYK 描述檔，並在 Colour profile 控制項中選擇其 **Embed** 列。該描述檔會內嵌為檔案的 *DestOutputProfile*，只要檔案其餘內容允許，PDF 就會宣告符合 PDF/X-4。宣告的印刷條件取自該描述檔：描述檔能證明註冊名稱時使用該名稱，否則在描述檔自己的名稱下使用 `Custom`。

三種情況會保留輸出意圖，但不做符合性宣告：CMYK 處理無法轉換的 RGB 圖稿、`prov` 校樣邊界署名文字（以未內嵌的標準字型繪製），以及 **Strong** 密碼，因為 PDF/X-4 禁止加密。每份 PDF 也都包含 PDF/X-4 中繼資料：頁面邊界框、XMP、文件 ID，以及附有描述檔的 sRGB 輸出意圖。
:::

### 專色油墨轉為四色印刷

設計系統可以為某個色彩指定專色油墨，例如 Pantone 或 HLC 色彩。**Print PDF** 就會以獨立的印版印出該色彩。Lolly Demo 除了白色 Sugar 與 Daylight，以及黑色 Void 之外，每個色彩都指定了專色油墨。以 Lolly Demo 製作的 Print PDF 會將大多數色彩印在專色版上，黑色則印在黑版上。

若要一般的四色檔案，請勾選匯出面板 Profile 卡片中的 **Print spot inks as process**。每種專色油墨就會依設計系統為該色彩指定的 CMYK 配方，以青、洋紅、黃與黑印出。沒有專屬配方的色彩會採用印刷色彩描述檔的轉換方式，與圖稿中的其他色彩相同。這樣檔案就只有四色印版。此選項預設關閉。面板只在選擇 **Print PDF**，且設計系統為某個色彩指定了專色油墨時，才會顯示此核取方塊。

加工不是油墨。燙箔、凸壓、凹壓、局部上光、柔觸、模切、壓線與打孔在勾選後仍保留各自的具名印版，因為以四色印刷呈現加工，會把它的黑色遮罩印到頁面上。

**Before you export** 卡片與 `lolly preflight` 會計算檔案將包含的印版。勾選後，會計算四色印版與所有加工版，並說明專色油墨會以四色印刷，不增加印版。未勾選時，設計系統指定的每種專色油墨最多會計入一塊專色版。價目表依這些數量計價，因此絕不會對檔案中沒有的專色版收費。

**Print TIFF** 與 **EPS (CMYK)** 沒有具名印版，因此無論是否勾選，都會以四色印刷呈現所有油墨。對這兩種格式，卡片與 `lolly preflight` 會計算四色印版，絕不計入專色版或加工版。加工會以黑色遮罩的形式進入黑版，卡片會將此情況回報為錯誤。

連結以 `_spots=process` 要求相同的檔案，命令列使用 `--spots=process`，[MCP 伺服器](/info/mcp.html)使用 `spots: "process"`，終端機應用程式則使用 **Spot inks** 列。此選項本身不會寫入檔案：只有油墨會改變。

### HDR（明亮色彩）

匯出面板的 **HDR** 卡片會為 HDR 螢幕提亮一般圖稿。若要在編輯過程中保留 HDR 原始素材，請見[廣色域與 HDR 編輯](/info/hdr-editing.html)。

一般匯出採用 sRGB：飽和的品牌色彩亮度與螢幕的一般白色相同。HDR 顯示器可以更亮。**HDR** 卡片會將你的品牌色彩與白色文字提升至接近峰值亮度。暗部仍保持暗色。

![匯出面板中的 HDR 卡片已開啟，下方顯示 White / Reach / Dark lift / Focus 旋鈕](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **格式。** PNG、JPG、AVIF 與 TIFF。WebP 是 8 位元，沒有可用的 HDR 解碼路徑，而向量與 PDF 沒有 HDR 模型。
- **預設關閉**，因為它會改變像素。勾選卡片，或在分享連結中傳入 `hdr=1`。
- **旋鈕。** **White**（峰值亮度上限，400 至 2000 尼特）、**Reach**（亮光向較暗色調延伸的範圍）、**Dark lift**（暗部提亮的程度；`0` 讓暗部保持暗色）與 **Focus**（提亮時保留的色彩濃郁程度）。它們以單一值傳遞：`hdr=1600-60-0-50` 代表 White 1600、Reach 60、Dark lift 0 與 Focus 50。
- **寫入的內容。** PNG 會使用 16 位元 Rec.2100 PQ，帶有 `cICP` 區塊。JPG 是 ISO 21496-1 增益圖 JPEG：一般的 SDR 圖片加上附加的增益圖。AVIF 的 `colr` 方塊會被重寫。TIFF 會使用 PQ 像素，搭配產生的 ICC v4 色彩描述檔，其中帶有 `cicp` 標籤。TIFF 會壓平到黑色上，因為白色在 PQ 中的編碼代表 10,000 尼特，會讓每個邊緣周圍都出現光暈。提亮依循感知（OKLab）明度並保留色相，因此品牌綠色會變亮，而不會變成薄荷綠。
- **亮光顯示的位置。** HDR 顯示器上支援色彩管理的檢視器：Apple 裝置上的 Preview、Quick Look 與 Safari，或 HDR 螢幕上的 Chrome。SDR 螢幕會顯示一般圖片。
- **從終端機。** 在 [CLI](/info/cli.html) 上，`--hdr=1` 搭配 `--export=png` 或 `--export=jpg`，會使用相同引擎的編碼器寫出相同的 PNG 與增益圖 JPEG，不需要瀏覽器。AVIF 與 TIFF 目前只支援網頁匯出。

::: warning 許多平台會移除 HDR 訊號
會重新編碼上傳內容的平台，可能讓圖片變暗或色彩變淡。請在你能控制目的地的地方使用 HDR，例如自己的網站、電視牆，或在高亮度面板上播放的簡報。
:::

<!--i:eti-badge-check-->
## 隨檔案傳遞的內容

完成的檔案可以帶有數種記錄。有些記錄位於像素之外，重新儲存、擷取螢幕畫面或清除資料後就會消失。有兩種標記存在於像素之中。

::: figure exporting-what-travels
每種記錄的位置、是否預設開啟，以及各自由哪個連結參數控制。
:::

匯出面板將 **Licence**、**Source credits**、**Password**、**C2PA Credentials**、**Lolly Imprint** 與 **Durable credential** 放在同一個 **Content protection** 群組中，只顯示所選格式適用的卡片。當連結或文件已宣告授權，或某個來源需要你決定時，群組會自行展開。**Design system** 卡片仍在群組之外，每次匯出時都看得到。

![PNG 匯出的 Content protection 群組已展開，只顯示適用的卡片](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 來源證明 & 浮水印

格式有對應欄位時，匯出會帶有**來源證明中繼資料**：軟體、來源、工具名稱與你的個人資料署名行，寫入 PNG iTXt、JPEG EXIF、PDF info、SVG `<metadata>` 或 GIF 註解。它只記錄作者身分。不會上傳任何內容。**Experimental** 工具也會加上可見的浮水印。浮水印由宿主套用，因此編輯工具無法移除該標記。

**Lolly Imprint** 是隱形的像素浮水印，**預設開啟**。它能在重新壓縮後保留，因此副本仍可被辨識為以 Lolly 製作。它只是提示，不是密碼學保證，也不帶有個人資料。它會寫入 JPEG XL、PNG、JPG、WebP、AVIF、TIFF 與 BMP，以及 Lolly 渲染到 PDF 或 PPTX 中的點陣圖，絕不寫入你嵌入的圖片。取消勾選 **Lolly Imprint** 或傳入 `imprint=0`，即可不加入 Imprint。AVIF 經重新編碼後的保留能力尚未校準。[Lolly Verify](/#/verify) 會在你的裝置上偵測 Imprint；請見 [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)。

**Durable credential** 使用裝置上的神經模型，以 TrustMark 格式將 Lolly 的識別碼寫入像素，讓「以 Lolly 製作」的連結在中繼資料被清除與重新編碼後仍能保留，並可由支援 TrustMark 的工具讀取。它**預設關閉**，因為每次匯出都需要執行一次神經模型，並且首次需要下載模型。它支援 PNG、JPG、WebP、AVIF 與 TIFF。在面板中勾選它，或傳入 `durable=1`。桌面與行動應用程式會隱藏此卡片，因為它們在離線時沒有可取得模型的來源站點。

**Licence。** 選擇其他人可以如何使用你的作品：預設為 *None (all rights reserved)*，也可選 CC0 1.0、Public Domain Mark 1.0 或 Creative Commons 4.0 授權（BY、BY-SA、BY-NC、BY-NC-SA、BY-ND、BY-NC-ND）。授權名稱與授權摘要的連結會寫入檔案的授權中繼資料（格式支援時為 EXIF、XMP 與 RIFF）及其 Content Credential。選擇會隨文件儲存，並以 `licence=` 隨連結傳遞。Lolly 會寫入你選擇的授權。Lolly 不會檢查或強制執行條款。具有自己授權欄位的工具，例如 Claim，則保留該欄位。

### 設計系統記錄

匯出會記錄製作檔案的設計系統：名稱、繪製時採用的已發布版本（當該版本不是工作版本時），以及繪製時使用的[配色方案](/info/colourways.html)。設計系統宣告的其他主題選項，例如密度，也會以相同方式記錄。淺色或深色的選擇不會記錄，因為圖片已顯示使用了哪一種。

**寫入任何內容之前，你就能看到記錄。** 預設勾選的 **Design system** 卡片會顯示檔案將帶有的確切文字，例如 *Records: Acme · Colourway: Beach*，以及描述。設計系統的名稱由其擁有者輸入，卡片會原樣顯示該名稱。取消勾選卡片，就不會在該次匯出中加入記錄。Lolly Design 的文件面板會在 *Embedded in exports* 下列出相同文字。

**描述會在工具名稱旁列出配色方案。** 勾選卡片後，*「Made with https://lolly.tools : Chart」* 會變成 *「Made with https://lolly.tools : Chart (Beach colourway)」*。設計系統本身的名稱保留在記錄中，不會放入描述。沒有工具名稱的描述，或工具依自己的輸入寫出的描述，都維持不變。透過 `tokenAxes` 忽略配色方案的工具不會記錄配色方案，PDF 校樣署名（`prov` 印刷標記）也遵循相同規則。

::: details 記錄中的品牌技能、品牌頁面與合作夥伴公司
**指導代理程式的品牌技能。** 當代理程式製作了作品，並列出它讀取且遵循的[品牌技能](/info/brand-skills.html)時，記錄也會列出每個技能及其修訂版，例如 *Guided by: acme-brand 1.0*。這段文字代表該技能指導了這項工作。Lolly 不會對照技能檢驗作品。只有代理程式自己的聲明才會加入清單。目前這是 [MCP 伺服器](/info/mcp.html) `lolly_render` 的 `brandSkills` 引數，因此在應用程式中或從分享連結製作的作品不會帶有清單。Content Credential 以 `brandSkills` 保存清單，這是一個 JSON 值，包含每個技能的識別碼、名稱、修訂版與 SHA-256 雜湊值。XMP 封包與 SVG 中繼資料以 `lolly:BrandSkills` 保存相同的值。根據記錄寫出的 PDF 會為每個技能加入一個關鍵字。描述維持不變。內部技能的文字絕不會被記錄。相同的開關會讓清單與其餘記錄一起省略：**Design system** 卡片、`_madewith=0`、`--no-madewith` 與 `madeWith: false`。當 MCP 伺服器在瀏覽器中繪製檔案時（PDF、JPEG，以及不經瀏覽器的路徑無法寫出的其他格式），檔案本身的中繼資料不會帶有清單。這時只有 Content Credential 能保存清單。傳入 `c2pa` 即可保留記錄。沒有憑證時，渲染會警告品牌技能未被記錄。

**發布者選擇加入時的品牌頁面。** 設計系統的發布者可以選擇在匯出中記錄其[品牌頁面](/info/brand-page.html#lead-back-from-your-files)的位址。此設定依設計系統分別設定，預設關閉。卡片隨後會將位址加入同一行，例如 *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*。取消勾選卡片，會將位址與其餘記錄一併移除。記錄只保存位址，不包含頁面的其他資訊。檔案中的其他內容不變。沒有位址的設計系統會寫出與先前相同的檔案。

**位址不會隨套件傳遞。** 已簽署檔案中的記錄會被視為簽署者自己的記錄。對於未選擇該位址的人，位址不得自行啟用，套件也不得將別人的檔案指向它自行選擇的頁面。`.lolly` 套件、設計系統的副本或 fork、**Try these colours**、還原的備份，以及供單次執行使用的 token 檔案，帶入時此設定都為關閉。你可以自行開啟設定，並輸入位址。受管理的設計系統是唯一例外：它會保留管理者在來源 token 中設定的位址。[從檔案連回品牌頁面](/info/brand-page.html#lead-back-from-your-files)有詳細說明。

**Lolly Work 合作夥伴計畫中的合作夥伴公司。** 為合作夥伴公司製作的作品會在同一行記錄公司及其計畫，例如 *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*，並在檔案中記錄公司資料的修訂版。記錄不包含任何個人、聯絡資料、地址或貨幣。附上公司的合作夥伴套件時，該行會加入套件的修訂版，例如 *、套件修訂版 2*，憑證則保存套件的識別碼與修訂版，絕不保存其色彩或規則。取消勾選卡片，會將合作夥伴與其餘記錄一併移除。PDF 會加入關鍵字 *Partner: Northwind IT*，而 [Lolly Verify](/info/what-verify-checks.html#partner) 會將記錄顯示為 **Partner**（[檔案中的合作夥伴記錄](/info/manage/partner-programmes.html#the-partner-record-in-files)）。
:::

**讀回記錄。** [Lolly Verify](/#/verify) 會在檔案的憑證詳細資料中，以 **Design system** 列出記錄，並以 **Guided by** 列出所有品牌技能。品牌頁面會單獨顯示，作為[簽署者對位址的記錄](/info/what-verify-checks.html#brand-page)。*Recreate with these settings* 會以記錄的版本與配色方案重新開啟工具。當這部裝置上有相同識別碼與名稱的設計系統時，連結會以記錄的設計系統開啟；否則使用你目前啟用的設計系統。

::: details 各處寫入的內容，以及哪些執行方式會省略記錄
| 位置 | 寫入的內容 |
|---|---|
| Content Credential | `tools.lolly.export` 聲明中的 `designSystem`（識別碼）、`designSystemLabel`、`designVersion` 與 `themes`，各為純文字值；`themes` 是選項的 JSON 清單。發布者選擇加入時，也會有 `brandPage` |
| PNG、JPEG、WebP 與 JXL | 相同的值，作為檔案 XMP 封包的 `lolly:` 屬性，使用 `https://lolly.tools/ns/export/1.0/` 命名空間。發布者選擇加入時，也會有 `lolly:BrandPage` |
| SVG | `<metadata>` 區塊中相同的 `lolly:` 屬性 |
| PDF | 關鍵字，例如 *Design system: Acme*、*Colourway: Beach*，以及發布者選擇加入時的 *Brand page: https://acme.example/brand/acme/* |
| 每種有描述欄位的格式 | 描述，配色方案列在工具名稱旁 |

只有在有內容可記錄，且格式能容納記錄時，卡片才會出現。CSV、JSON、行事曆檔案與其他文字或資料格式不帶中繼資料，EPS、EMF、DXF 與 BMP 則沒有可放入記錄的欄位。HTML、Markdown 與 CSS 只在 Content Credential 中保存記錄，因此對這些格式，卡片不會顯示描述行，並在 **C2PA Credentials** 關閉時隱藏。設計系統未提供的欄位不會寫入檔案。

分享連結以 `_madewith=0` 關閉記錄（[URL 參數](/info/url-parameters.html)）。命令列接受 `--no-madewith`，[MCP 伺服器](/info/mcp.html)的 `lolly_render` 接受 `madeWith: false`，終端機應用程式的匯出面板則有 **Design system** 列。對工具渲染，以及 `lolly run` 從已儲存的 Lolly Design 工作階段匯出的每個檔案，命令列會將完成檔案帶有的文字輸出至標準錯誤。MCP 渲染會在檔案旁輸出這段文字。兩者都會從檔案讀回文字。命令列不經瀏覽器繪製的 PNG 不帶檔案中繼資料，因此其記錄只會隨憑證傳遞。裝置上的工具程式不會加入中繼資料。

沒有 **Design system** 卡片的執行方式會省略記錄：Lolly Batch 執行、從 Projects 匯出的資料夾與 3D 集合匯出，以及終端機應用程式中的 CSV 批次、Projects 資料夾或選取範圍匯出，以及渲染全部內容的檢視。從工具匯出單一檔案，才能記錄設計系統。
:::

### Content Credentials (C2PA)

匯出可以帶有 **Content Credentials**：一份已簽署的 [C2PA](https://c2pa.org) manifest，記錄檔案由什麼製作、何時及何地製作，並繫結至檔案位元組的雜湊值，因此可偵測之後的任何編輯。Lolly 會寫入任何 C2PA 閱讀器都能檢查的標準 manifest。

![已勾選的 C2PA Credentials 卡片，核取方塊旁顯示憑證有效期](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **預設開啟。** 幾乎每個工具的 **C2PA Credentials** 卡片都已勾選。可為單次匯出取消勾選，或在連結中傳入 `c2pa=off`。檔案就不會帶有憑證，而內嵌帶憑證圖稿（例如目錄中的標誌）的 SVG，也會失去該圖稿的憑證。Lolly Imprint 與檔案的其他中繼資料會保留。工具可以在自己的 manifest 中選擇不加入。
- **格式。** PDF（RGB 與 Print）、PNG 與 APNG、JPG、GIF、SVG 與 SVGZ、TIFF（RGB 與 Print）、WebP（靜態與動畫）、AVIF、MP4、WebM、HTML、Markdown、CSS，以及音訊容器 MP3、WAV、M4A、OGG/Opus 與 FLAC。ZIP 會為每個支援的成員加上憑證，Animated SVG 就是以這種方式取得憑證。MP4、AVIF 與 M4A 使用標準 BMFF 繫結，MP3 使用其 ID3v2 對應方式，因此 `c2patool` 與其他閱讀器都能驗證。WebM 與 OGG/Opus 尚無標準對應方式，因此 Lolly 以 Matroska 附件與 OpusTags 欄位攜帶 manifest，由 Lolly 自己的驗證器檢查。SVGZ 是壓縮的 SVG。C2PA 規範未定義壓縮形式，因此憑證會在壓縮前寫入 SVG。Lolly 的驗證器會直接讀取檔案；`c2patool` 則在檔案解壓縮（`gunzip`）後讀取相同的憑證。ICO、EPS、EMF、DXF、BMP、PPTX、Office 格式，以及其他文字與資料格式都沒有 C2PA 容器。
- **記錄的內容。** 製作檔案的工具與應用程式、簽署時間，以及匯出檔案的宿主環境。對於匯出為圖片、SVG 或 PDF 的 Lolly Design 頁面，會記錄繪製頁面的渲染器（`tools.lolly.export` 聲明中的 `route`：`gpu` 代表 GPU 頁面渲染器，`operations` 代表以向量寫出的繪圖操作，`compatibility` 代表瀏覽器自己的渲染器），以及該渲染器的版本（`renderer`：GPU 配方、`design-draw-v` 及其版本，或 `dom-to-image` 與 `dom-walker`）。勾選 **Design system** 卡片時的[設計系統與配色方案](#the-design-system-record)。目前啟用的設定：選單選項、數值、開關與色彩會原樣記錄，所有輸入的文字（標題、姓名、備註、連結與日期）則只記錄指紋，因此檔案中不會有這些文字。繫結至個人資料的欄位、未啟用的控制項、瀏覽器版本與作業系統詳細資料都不會加入。只有在 Settings → Preferences → Your details 下開啟 **Use my details to create** 時，你的姓名與電子郵件才會以作者資料顯示。匯出中放入的來源會作為素材成分隨檔案傳遞。頁面上每張本身帶有 Content Credential 的圖片，都會被記錄為頁面的組成部分，連同該憑證與它宣告的任何 AI 來源類型。PNG、JPEG、WebP、AVIF、TIFF、SVG 或 PDF 都是如此；對於 GIF、APNG、動畫 WebP、MP4 或 WebM，只要圖片被繪入匯出範圍內至少一個影格，也是一樣。Darkroom、Filter 或 Asset Export 這類工具修改的那一張圖片，則會被記錄為檔案的父項，先記錄開啟圖片，再記錄工具對圖片做了什麼。其他素材成分包括表情符號這類[已署名作品](#source-credits)、影片或音訊匯出中的 [Lolly Rondocode 歌曲](/info/rondocode.html#songs-in-the-credential)，以及影片或音訊匯出中的[已儲存曲調](/info/generated-music.html#what-a-track-records)。每首已儲存曲調都有名稱、曲調記錄的授權（如果有）、配方的 SHA-256、引擎版本，以及演算法媒體標記。已儲存曲調的製作者（儲存時使用的個人資料名稱）與你的姓名一樣，只有在開啟 **Use my details to create** 時才會加入。也只有這時，匯出面板才會在匯出前顯示製作者。
- **已記錄的核准。** 透過 [Lolly Work](/info/work-approvals.html#review-an-exported-file) 核准的檔案，可以在此憑證之上帶有第二份已簽署記錄：核准識別碼、決定日期，以及受審閱檔案的摘要值。它不包含姓名、電子郵件、群組、留言或核准鏈名稱。請求對話框預設勾選此選項，可為單次請求取消勾選，也可為整個實例關閉。它記錄簽署者曾聲明一項決定，不代表作品符合任何標準。
- **從[意圖](/info/visual-intent.html#what-goes-in-the-file)製作的檔案所接到的要求。** 用途、呈現介面、工具、語言、規則與詞彙版本，以及意圖摘要值。場合、受眾、地區與提示詞只記錄指紋，除非執行該次渲染的人或代理程式要求記錄提示詞的文字。只有從意圖開始的渲染會帶有這項記錄。執行時會說明記錄了什麼，也可以選擇不加入記錄。
- **收件者看到的內容。** Adobe 應用程式、`c2patool` 與 contentcredentials.org/verify 等 C2PA 工具會讀取 manifest 並顯示聲明。Lolly 使用在你的裝置上建立的金鑰簽署，而非信任清單中的憑證，因此檢視器會回報為*未驗證*的憑證。其結構與竄改偵測資訊有效，但沒有任何人為簽署者背書。若要改變這點，請在 Settings → Preferences → Content Credentials 下註冊**已驗證身分**；請見 [Content Credentials 身分](/info/content-credentials-identity.html)。
- **檢查檔案。** 將任何檔案拖放到 [Lolly Verify](/#/verify)，或執行 `lolly validate <file>`，即可在裝置上取得報告，首先說明檔案是否由 Lolly 製作，以及之後是否被更改。Lolly Verify 也會檢查憑證以外的內容；請見 [Lolly Verify 檢查什麼](/info/what-verify-checks.html)。
- **隱私。** 簽署金鑰為此次匯出建立，絕不離開你的裝置。聲明只包含來源證明中繼資料已帶有的內容。轉換你自己檔案的隱私工具程式不會加入憑證，而 *Lolly Strip Hidden Data* 會像移除其他中繼資料一樣移除 C2PA manifest。Rondocode 工具程式會製作新音訊，因此會簽署它寫出的內容（[Lolly Rondocode 歌曲](/info/rondocode.html#files-from-the-rondocode-utility)）。音樂產生器會簽署每個 WAV 或 M4A 下載。憑證會記錄音軌由 Lolly 的音樂產生器製作，以及音樂適用的授權 CC BY 4.0，並附上署名（[音軌記錄的內容](/info/generated-music.html#what-a-track-records)）。
- **相互影響。** 密碼保護的 PDF 無論使用哪個層級，都無法帶有 Content Credentials。憑證最後才會加入，在 DPI、EXIF、色彩描述檔、PDF/X 中繼資料與印刷標記之後，對完成的位元組進行簽署。

### 來源署名

匯出中放入別人的作品時，會在憑證中記錄該來源。常見的例子是所選表情符號集中的表情符號：作品、創作者、授權、實際位元組的來源，以及所做的變更，都會隨檔案傳遞。以 SVG 為範本的工具，其文字會保留系統自己的表情符號，因此不會為此署名。下載前，**Source credits** 列會說明來源對交付內容的要求。下載後，該列會先讀回已交付的位元組，才會告知署名已包含在檔案中。需要你做選擇的授權，例如即將分享、已重新上色的 CC BY-SA 字形，會顯示列有選項的卡片。下載絕不會被阻擋。[創作權利與署名](/info/creative-rights.html)說明了措辭、已審查的授權，以及哪些內容仍屬於你。

<!--i:eti-lock-->
## 密碼保護

Lolly 提供兩種鎖定，都在你的裝置上完成。匯出面板的 **Password** 卡片可設定兩者。

![PDF 匯出中展開的 Password 卡片，包含密碼欄位與兩個鎖定層級](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDF 開啟密碼**在你輸入密碼後有兩個層級：

- **Weak**：40 位元 RC4，適用於沒有印刷標記或出血的 RGB `pdf`，且密碼只包含一般 ASCII 字元。含有其他字元的密碼會改用 Strong，因為閱讀器無法開啟在此層級以這類密碼鎖定的檔案。只有前 32 個字元有效。
- **Strong**：AES-256（PDF 2.0）。也適用於 Print PDF 與批次 ZIP 中的每份 PDF。以 Strong 鎖定的 Print PDF 會保留 CMYK、標記與輸出意圖，但會移除 PDF/X-4 聲明。

::: warning Weak 只能阻嚇，無法提供保護
機密檔案請使用 **Strong**。
:::

**鎖定的 ZIP** 適用於 ZIP 匯出、從 Projects 下載的資料夾或批次，以一組密碼提供兩個層級：**Weak**（ZipCrypto，只能阻嚇）或 **Strong**（AES-256）。密碼會保護每個成員。其中的任何 PDF 也會另外以 AES-256 鎖定，因此 ZIP 解壓縮後，PDF 仍保持鎖定。下載開始時會出現提示。密碼留白代表不鎖定。

**兩個層級都不會將輸入的密碼放入連結。** 如果檔案透過 `?password=` 連結傳入，Lolly 會讀取其值，並立即從位址中移除。如果連結要求的鎖定方式不受檔案支援，就不會寫出檔案，並會說明原因（請見 [`password`](/info/url-parameters.html)）。

**受密碼保護的分享連結**會在開啟前要求收件者輸入密碼。連結狀態以從密碼衍生的金鑰（PBKDF2）進行 AES-256 加密。只有密文會傳遞，解密則在收件者的瀏覽器中進行。提供連結的伺服器絕不會看到密碼或設計。在 **Share** 對話框中開啟此功能。加密連結只能在 Lolly 中開啟，不能作為嵌入圖片。請見 [URL 模式](/info/url-mode.html)。

<!--i:eti-monitor-->
## 在手機上

匯出控制項位於浮動的 **Export** 按鈕後方，按下即可開啟 **Export** 面板：相同的格式、尺寸、複製、下載與分享，大小適合觸控操作。

<!--i:eti-code-->
## 連結與 CLI 使用的格式識別碼

以下是 URL `format=` 參數與 CLI `--export=` 旗標使用的值（請見 [URL 參數](/info/url-parameters.html)與 [CLI](/info/cli.html)）。工具的選單只顯示該工具能製作的格式。

| 種類 | 識別碼 |
|---|---|
| 點陣圖 | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff`（RGB TIFF）· `cmyk-tiff`（Print TIFF）· `bmp` · `ico` |
| 向量 | `svg` · `svgz`（以 gzip 壓縮的 SVG）· `emf` · `wmf` · `eps` · `eps-cmyk`（EPS CMYK）· `dxf`（切割檔案） |
| 頁面與文件 | `pdf` · `pdf-cmyk`（Print PDF）· `pptx`（PowerPoint）· `docx`（Word）· `odt`（OpenDocument Text）· `idml`（InDesign）· `penpot`（Penpot 設計檔案）· `scorm`（課程套件，一個 ZIP） |
| 動態 | `gif` · `apng`（Animated PNG）· `webp-anim`（Animated WebP）· `svg-anim`（Animated SVG）· `webm` · `mp4` · `lottie`（dotLottie）· `premiere-xml`（Premiere XML + media） |
| 音訊 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid`（MIDI 音符，來自 Lolly Rondocode） |
| 文字與資料 | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl`（GIMP 色盤） |
| 組合包與套件 | `zip` · `rpm` 與 `tar.gz`（將渲染結果封裝到 Linux 套件中） |

有些識別碼來自工具自己的匯出程式碼：`ase`（Adobe Swatch Exchange，來自 Lolly Palette Lab），以及 `exr` 與 `hdr`（高動態範圍點陣圖，來自 Lolly Darkroom）。**Convert Font** 會從你提供的字型檔案寫出 `ttf`、`otf` 與 `woff`，因此單憑連結，工具沒有可渲染的內容。
