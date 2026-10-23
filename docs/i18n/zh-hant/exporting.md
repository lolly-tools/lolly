# 匯出檔案

你做好了某樣東西，它需要離開 Lolly：給聊天用的 PNG、給印刷廠的 PDF、同事會繼續編輯的簡報。按下 **Export**，也就是 **Export | Save** 膠囊的左半部。在檔名旁選擇格式，然後按下 **Download**。檔案在你的裝置上製作。

你在畫布上看到的就是檔案所包含的內容。格式選單只列出這個工具在這個瀏覽器中能製作的格式。

對大多數工作而言，三種格式之一是正確的：

| 用途 | 選擇 | 原因 |
|---|---|---|
| 螢幕、訊息或投影片 | **PNG** | 每個應用程式都能開啟，工具提供透明背景時也能保留 |
| 成品頁面，或任何要印刷的東西 | **PDF** | 真實的頁面尺寸，印刷效果所見即所得；工具提供時，**Print PDF** 是用於印刷機的 CMYK 版本 |
| 必須在任何尺寸下都保持清晰的美術作品 | **SVG** | 向量圖形，從徽章到橫幅都清晰銳利 |

::: check 按實際使用的尺寸檢查檔案
傳送之前，請在它要用於的螢幕上開啟它，或按真實尺寸列印一次。
:::

::: details 使用 Lolly Work 的核准與交付（選用）
[運行 Lolly Work 的組織](/info/organisation.html)可以管轄其成員看到哪些格式與匯出設定。在需要核准之處，**Request approval** 取代 **Download**。請遵循你的實例所顯示的政策。

Lolly Work 也可以把檔案交付到已設定的 S3、WebDAV 與 HTTP 目的地，附有核准步驟、交付回條與稽核記錄。為此工作流程提交檔案，會把它傳送到組織的服務；一般的下載則留在你的裝置上。個人的 Send 目的地與組織交付是分開設定的。

營運者以[組織交付指南](/info/work-delivery.html)設定。至於排入佇列的伺服器渲染與批次，請見 [CLI 批次與自動化](/info/cli-automation.html#organisation-jobs-with-lolly-work)。
:::

## 匯出如何運作

匯出時，工具的畫布會被渲染成你選擇的格式，並以下載的方式交給你，或放到你的剪貼簿。

有三條路徑會產生檔案。大多數工具**渲染畫布**。文字與資料格式（HTML、Markdown、TXT、JSON、CSV、ICS、VCF）是**由工具的內容產生**，而不是從圖片繪製。像 *Strip Hidden Data* 這樣的隱私 Utility 則**轉換你挑選的檔案**，在你的裝置上進行，並在沒有畫布、浮水印或附加中繪資料的情況下交還，因為它本來就是你自己的檔案。

![三條匯出路徑匯聚成一個完成的檔案：渲染畫布、由內容產生文字或資料，或在裝置上轉換挑選的檔案。](/info/diagrams/concepts/three-export-paths.svg)

匯出面板提供這些動作。工具的作者挑選哪些出現；預設組合是 Copy、Download 與 Save。

- <!--i:download--> **Download** 儲存檔案。如果之後找不到它，請見[尋找你下載的檔案](/info/find-your-work.html#find-a-file-you-downloaded)。
- <!--i:photos--> **Copy** 把圖片放到你的剪貼簿，可直接貼到聊天、電子郵件或文件中。在瀏覽器無法複製圖片之處，它會改為下載並告知你。
- <!--i:folder--> **Save** 一鍵把目前的設計保存在 Projects 中，並絕不下載檔案。**Save as**（在 **Download** 旁）會詢問位置（請見[儲存與繼續](/info/using.html#saving-continuing)）。
- <!--i:link--> **Share** 開啟 Share 對話框：重現設計的連結、開啟時的切換（全螢幕、匯出面板、開啟時下載或複製），以及選用的 **Shortest link**，它會把整個狀態壓縮成精簡的 token（請見 [URL 模式](/info/url-mode.html)）。

![匯出面板 - 格式、尺寸以及 Copy / Download / Save / Share 動作](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

當設計嵌入另一個工具的渲染結果時，例如 Design 的圖片方塊中放著 QR Code 連結，巢狀的渲染會被繪入父項的匯出中。它在 SVG 與 PDF 中仍是真正的向量，在 PNG、JPG 和 WebP 中則清晰地點陣化。嵌入的渲染沒有浮水印，也沒有自己的來源證明；只有完成的檔案有。HTML、Markdown 與 TXT 匯出無法容納組合的渲染結果。

## 挑選格式

檔案名稱和格式選單會合併顯示為一個 `name.format` 組合，位於**下載**下方。

![與格式選擇器融合的檔名欄位，讓匯出讀起來像一組 name.format 配對](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

從檔案要去的地方開始。每張卡片列出適合該目的地的格式；工具只顯示它能製作的那些。

::: figure exporting-format-chooser
六個目的地，以及適合各自的格式。
:::

以你設計系統的字型排版的字標，會匯出為 SVG，每個字母都是轉外框的路徑，所以一個檔案在名片大小與建築外牆大小都保持清晰。

![一個細線體、字距寬的字標，寫著 Aurora，也就是表格中 SVG 一列所談論的那種純向量圖稿](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details 每種格式及其用途
| 你想要 | 使用 | 原因 |
|---|---|---|
| 可縮放的清晰標誌或圖稿 | **SVG** | 向量：可縮放、體積小且可編輯；向量匯出無法繪製的效果會以圖片嵌入 |
| 供 Office 與 Windows 應用程式使用的向量 | **EMF** | 以可編輯的向量貼入 PowerPoint 與 Word，文字為即時文字；Google Drive 以 Google Drawings 開啟 |
| 供印刷與設計應用程式使用的向量 | **EPS**，或 **EPS (CMYK)** | 供 Illustrator 與印刷流程使用的 PostScript 向量 |
| 供切割機使用的向量 | **DXF** | 雷射切割機、割字機與 CNC：以公釐為單位的輪廓路徑 |
| 可編輯的投影片簡報 | **PowerPoint**（PPTX） | 原生可編輯的文字與圖形，圖片與向量仍可取出 |
| 可編輯的文字文件 | **Word**（DOCX）或 **OpenDocument**（ODT） | 文書處理器可繼續編輯的真正段落與標題（Doc Studio） |
| 供 InDesign 使用的版面 | **InDesign IDML (static subset)** | 文字、矩形、橢圓與圖片，每個畫板一個跨頁（Design） |
| 可編輯的 Penpot 文件 | **Penpot** | 看板、圖形、文字與連結的 token |
| 照片或通用圖片 | **PNG**（無損）或 **JPG**（較小） | 通用點陣圖 |
| 較小的現代圖片 | **WebP** 或 **AVIF** | 壓縮更好，並支援透明度 |
| 列印 | **PDF**，或 **Print PDF**（CMYK） | 真實頁面大小；CMYK 供印刷機使用 |
| 供印刷機使用的點陣圖 | **Print TIFF**（CMYK） | 供 RIP 使用的 DeviceCMYK 像素 |
| 供網頁使用的動畫 | **GIF** | 隨處可播放；檔案較大 |
| 全彩且具真正透明度的動畫 | **APNG** | 動態 PNG：沒有色盤限制 |
| 檔案最小的動畫 | **Animated WebP** | 全彩且支援透明度，比 GIF 或 APNG 小 |
| 可縮放的動畫向量 | **Animated SVG** | 自成一體；在瀏覽器或 `<img>` 中循環，任何大小皆可（Lottie Ad） |
| 保持可編輯的動畫 | **dotLottie** | 來自 Design 時間軸的圖形、路徑與外層變形關鍵影格 |
| 交給 Premiere 的交接檔 | **Premiere XML + media** | 供 Premiere 使用的定時片段與原始媒體（Design） |
| 供社群與分享的影片 | **MP4** 或 **WebM** | 以檔案大小而言品質最佳（請見[影片](#video)） |
| 字幕 | **SRT** 或 **VTT** | 供影片播放器使用的定時文字（Captions、Audiogram 與 Record） |
| 訓練課程 | **SCORM (LMS)** | 有版本的網站、SCORM 或 xAPI 套件（請見 [SCORM](#scorm-course-packages)） |
| 富文字或電子郵件簽名檔 | **HTML** | 以格式化的方式貼入郵件用戶端 |
| 純內容 | **MD** 或 **TXT** | 僅文字 |
| 行事曆活動 | **ICS** | 匯入任何行事曆應用程式 |
| 聯絡人名片 | **VCF** | 匯入通訊錄 |
| 要重新匯入的結構化資料 | **JSON** 或 **CSV** | 往返保存工具的內容 |
| favicon | **ICO** | 多尺寸網站圖示；**ZIP** 打包多種格式 |
:::

### 透明度

支援透明度的工具會提供透明背景切換，例如 **No BG**。PNG、WebP、AVIF、SVG、APNG 與 Animated WebP 保留透明度，GIF 則保留硬邊緣。JPG 與 PDF 一律不透明。TIFF 會壓平到白色上，在 [HDR](#hdr-bright-colours) 之下所述的 HDR 路徑上則壓平到黑色上。

## 尺寸與列印單位

除非工具提供 **dimensions**，否則匯出使用工具原生的像素大小。這時你設定寬度、高度與 **unit**：

- **px**（預設）是精確的像素。
- **mm、cm、in、pt** 與 **pc** 是實體大小。使用實體單位時，你還要設定 **DPI**（預設 300）。**PDF** 會成為該大小的真實頁面，**點陣圖**會得到該 DPI 對應的像素數並記錄解析度，**SVG** 則保留實體單位與像素 viewBox。

若要更高解析度的點陣圖，請輸入更大的寬度與高度，或選擇實體單位並提高 DPI（像素 = 大小 × DPI）。寬度 `210`、高度 `297` 與單位 `mm` 會得到 A4 頁面。

![尺寸列設定為 210 乘 297 mm，因單位為實體單位而顯示出 DPI 欄位](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## 從計時合成中擷取靜態畫面

定時的作品，例如 Design 中的 [Sequence](/info/sequence-editor.html) 時間軸，是會動的，所以靜態匯出必須挑選一個時刻：**播放頭所在的影格**。把播放頭停在你想要畫面的位置，然後匯出。

若要多於一個時刻，**Frames** 欄位會出現在輸出大小旁邊。它只在定時作品與靜態格式（PNG、JPG、WebP、SVG 或 PDF）時顯示。保持 `1` 即為播放頭影格。提高它，你就會得到那麼多張靜態圖，均勻分布在整個序列上：

- PNG、JPG、WebP 與 SVG 以一個 ZIP 回傳：`<name>-01.png`、`-02.png` 依此類推。
- PDF 以一份有那麼多頁的文件回傳。

每張靜態圖都取自其時間軸切片的中間，所以第一格絕不是半淡入的入場，最後一格也絕不是所有片段結束之後的空白時刻。

::: figure exporting-contact-sheet
Frames: 4 把序列切成四個相等的切片，並取每個切片的中間。
:::

可用於分鏡腳本、審閱用的接觸印樣，或從影片剪輯切出的社群輪播。數量上限為 64，欄位中輸入的其他任何內容都會退回 `1`。每個影格都是一般的靜態圖，所以憑證、Imprint、實體單位與 DPI 的行為與單一匯出相同。匯出連結、CLI 與 MCP 以 `cuts=` 要求相同的接觸印樣（請見[接觸印樣](/info/url-export.html#contact-sheets)）。

## 一次許多檔案

Lolly 有三種大量處理的方式，各有不同用途：

::: cols
## 表格變成一份文件
有表格輸入的工具（例如 **Battlecards**）會把每一列變成一頁。從你的試算表貼上表格，就得到一份 PDF。在試算表中修正列，再貼上一次。
## CSV 變成每列一個檔案
**Batch**（`#/batch`）接受 CSV 並為每一列渲染一個匯出：名牌或證書，每個一個檔案，以 ZIP 交付。請見 [Batch](/info/batch.html#make-many-versions-of-one-design)。
## 數份設計一次編輯
**Multi-edit** 並排開啟數個已儲存的工作階段，對不同設計進行相同的修飾。請見 [Multi-edit](/info/batch.html#edit-several-saved-designs-together)。
:::

在 **Projects** 中，**Render folder** 會把資料夾及其子資料夾中的每個已儲存工作階段匯出為一個巢狀 ZIP，**Render selection** 對任何多重選取做同樣的事；單一已儲存的工作階段則渲染成它自己的檔案。已儲存的工作階段也可以從 Projects 再次以工具連結分享，以相同設定重新開啟它。

## 在其他地方仍可編輯的檔案

有些格式把你的作品以可編輯的內容而非圖片的形式交給另一個應用程式。

### PowerPoint (PPTX)

Design、Markdown Slides、Booklet、Doc Studio、Chart、Diagrams、Flow Chart 與 Agenda 會匯出 PowerPoint 簡報，每頁一張投影片。每一頁都被拆解成原生物件，所以同事可以編輯簡報並從中取出素材：

- <!--i:font--> **文字**成為可編輯的 PowerPoint 文字方塊，帶有版面的字型大小、顏色、粗細、斜體與對齊。
- <!--i:pentool--> **向量**（例如標誌與圖示）會以 SVG 圖片嵌入；它們保持清晰，而 PowerPoint 可以對它們執行 *Convert to Shape*。
- <!--i:photos--> **圖片**以原生解析度作為各自的圖片進來。裁切過的主視覺會在裁切後保留完整圖片，其上的任何濾鏡或混合都已烘焙進去。
- <!--i:layers--> **背景、邊框與線條**成為矩形與線條圖形。

![已選擇 PowerPoint 的匯出面板:每頁一張投影片,文字與圖形保持可編輯](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

版面是近似的；目標是可重複使用的內容。walker 無法以原生方式表達的任何東西（例如複雜的濾鏡或遮罩區域）會以圖片嵌入，因此不會遺失任何東西。簡報只有一種投影片大小，取自第一頁。

PowerPoint 也是一條進入的路：[重塑簡報品牌](/info/rebrand.html)把簡報移到你的設計系統上，[匯入設計](/info/design-import.html)則在 Design 中開啟一份簡報。

### Penpot

大多數能匯出 SVG 的工具也能匯出 **Penpot 檔案**（`.penpot`），可直接在 Penpot 中繼續編輯。

| 你製作的內容 | 在 Penpot 中 |
|---|---|
| 文字 | 可編輯的文字物件：修正錯字或重新設計樣式 |
| 圖形、路徑、漸層與圖片 | 各自可編輯的向量圖形 |
| 來自設計系統 token 的色彩或字型 | 即時的 token 連結：編輯 token，繼承它的每個圖形都會跟著變 |
| 整份設計 | Assets 面板中可重複使用的元件 |
| 複雜的插圖或即時畫布 | 單獨以圖片嵌入，周圍可編輯的內容不受影響 |

從 Design 匯出時，每個框架都成為 Penpot 看板。設計系統的色彩與字體排印進入 Assets 面板，其完整 token 集合進入 Tokens 面板。Penpot 從那裡保有自己的副本：在 Penpot 中編輯的 token 會經由 [Design System Setup](/info/brand-studio.html) 的匯入帶回來。

![已選擇 Penpot 的匯出面板:.penpot 檔案,以及下載按鈕旁的 Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

要開啟檔案，請啟動 Penpot、挑選專案並選擇 **Import**。如果已在匯出面板登入 Penpot，**Send to Penpot** 會替你完成那個步驟。

### Word、OpenDocument 與 InDesign

**Doc Studio** 匯出 **Word**（DOCX）與 **OpenDocument**（ODT），具有真正的段落與標題。

**Design** 匯出 **InDesign IDML (static subset)**：文字、矩形、橢圓與 PNG 或 JPEG 圖片，每個畫板一個跨頁。受支援的行內格式保持可編輯，圖片放在 `Links` 中傳遞，座標則轉成 InDesign 點。重新連結、字型替換與改變的換行可能需要注意。效果、動畫、組合的故事與不支援的幾何會讓匯出停止，並附上列出它們的報告。IDML 不保留原始文件，所以完稿請送 PDF。

### 時間軸：dotLottie 與 Premiere

從 Design 的時間軸，**dotLottie** 會寫出在 Lottie 工具中仍可編輯的動畫；[Lottie 動畫](/info/sequence-editor.html#lottie-animations)列出它保留的內容。**Premiere XML + media** 為 Premiere 打包定時片段與其原始媒體；請見 [Premiere XML 交換](/info/sequence-editor.html#premiere-xml-exchange)。

### SCORM（課程套件）

在你於 Settings → Preferences → Feature flags 下開啟 **Training and courses** 之前，課程匯出是關閉的。

然後從支援的工具、專案資料夾或選取範圍選擇 **Export course**。在 Design 中，選擇 **SCORM (LMS)** 並按 **Download** 會開啟相同的課程工作流程。Lolly 會儲存作品，讓你審閱課程內容與順序，然後開啟該模組及其匯出對話框。

- <!--i:layers--> 為每個來源選擇呈現方式：靜態頁面、作為影片的動態、音訊，或可下載的資源。在模組中加入課文與閱讀替代內容。
- <!--i:clock--> 預覽學習者播放器，並審閱描述與字幕。動態以影片形式納入，包括無聲動畫。
- <!--i:document--> 選擇 Website、SCORM 1.2、SCORM 2004 4th Edition 或實驗性的 xAPI 目標。檢查內容與 ZIP 大小，然後儲存並下載檢查過的版本。
- <!--i:check--> 完成需要確認每個必修課程單元並選擇 Finish。

![Design 簡報上已選擇 SCORM (LMS) 的匯出面板](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

套件包含它完成的內容，不需要 Lolly 帳號。將 Website ZIP 放到 HTTP(S) 主機上；LMS ZIP 則原封不動匯入。在分享課程之前先測試目的地。至於由數個已儲存創作組成的課程，請見[建立訓練課程](/info/training-creators.html)。

### DXF（切割檔案）

Asset Export、Diagrams、Growth、Logo Wall、QR Code、Street Map、Wayfinding 與 Wordmark 匯出 **DXF**，這是雷射切割機、割字機與 CNC 軟體讀取的 AutoCAD R12 交換格式。幾何以公釐為單位的輪廓路徑寫出，文字會轉外框，色彩對應到最接近的 AutoCAD Color Index，這通常決定切割機的操作。DXF 只有線條圖：照片或套用濾鏡的區域沒有切割路徑，會被捨棄並附上警告。要保留點陣內容，請使用 SVG 或 PDF。

Street Map 是最清楚的例子。整份設計本來就是筆畫，所以每條道路和運河都成為切割路徑。

::: showcase
![以奶油色底、墨色線條呈現的巴黎 Street Map 渲染圖 - 純線稿,因此每一筆線條都能完整傳遞給切割機](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

往下捲動,鏡頭會拉遠穿過實際的幾何圖形:七條路徑,完全沒有像素,每一筆線條在任何縮放比例下都毛髮般銳利。這就是切割機讀取的同一份檔案。
:::

## 列印

**Print PDF** 對照具名的印刷條件寫出 CMYK，預設為 **Coated FOGRA39**。有測量油墨值的品牌色票會精確轉換；其他色彩使用標準的裝置轉換。**Print TIFF** 為 RIP 寫出 DeviceCMYK 像素，並在其 TIFF 中繼資料中記錄相同的印刷條件。Colour profile 控制項驅動兩者；[色彩描述檔](#colour-profiles)有詳細說明。

**Print marks & bleed** 在列印格式上有自己的卡片：以公釐計的出血，加上 Crop、Registration、Bleed、Colour bars 與 Stamp 詳細資料。

有些工具會建立**多頁 PDF**：封面、依需要流到多頁的內容與封底，如 *Booklet* 工具。每頁都是 A4、US Letter 或 A5 的真正直式 PDF 頁面，你可以強制任何區塊另起一頁。這些是沒有裁切或出血標記的 RGB 文件，那些標記屬於單頁的 Print PDF。Design PDF 也可以是 **Notes handout**：每張投影片一個直式頁面，下方附有講者備忘稿。

**匯出之前。** 面板底部的 **Before you export** 卡片說明印刷廠即將看到什麼：格式、大小與出血、裁切與出血區域、油墨覆蓋量、色版數量與頁數，標題旁附有判定。它絕不阻擋匯出。Design 一律以自己的檢查顯示該卡片，包括逐層的設計系統內部規範，以及文件文字的寫作訊號（[匯出之前](/info/design.html#before-you-export)），並在 **Print preflight** 開啟時加入這些列印檢查。在其他工具中，請在 Settings → Preferences → Feature flags 下開啟 **Print preflight**；它預設為關閉，而 Lolly Work 部署可以為其成員開啟它。

**匯出之後。** 檔案就緒後，Lolly 會讀回它，並與你的選擇比較：格式、像素或頁面大小、片段長度、透明背景、CMYK 色彩、HDR、Content Credentials，以及 PDF 或 ZIP 密碼。任何不同之處都會寫在匯出卡片上。每項測量都來自檔案，絕不來自設定，而檔案無法回答的屬性不會被算作相符。命令列以 `--export-report` 寫出完整的比較（請見[用 CLI 渲染](/info/cli-rendering.html)）。

Design 的 inspector 檢查與 Design System Setup 中的品牌比較是獨立的檢查：它們檢視設計，而這兩張卡片檢視檔案。

::: details 來自價目表的成本
在 preflight 之下，成本卡片會把相同的計數轉成金額，只使用有人提供的價格。即使 preflight 卡片本身是關閉的，它也會讀取這些計數。它需要兩樣東西：價目表能定價的工作（色版、紙張、面積、頁數、變體列或輸出檔案，所以單純的標誌 PNG 絕不會顯示它）以及 **rate card**，也就是你的印刷廠提供的 JSON 價目表。預設的建置版本沒有任何價目表，也沒有應用程式內載入的方式。價目表以部署附帶的目錄素材形式出現，或透過自行託管者或控制平面開啟的選用價目表擴充功能出現。沒有價目表時，不會顯示任何東西。

每個數字都是你提供的費率乘以 Lolly 計算的數量，例如 `4 plate × €35.00`，而總額帶有其來源：卡片上的簽發者與費率的日期。沒有預設貨幣，也沒有佔位價格。檔案對自身的說法仍屬轉述：*"The file says: … Lolly has not verified this."*

當某個數字無法算出時，表格會被撤下，而不是硬填：

- 卡片未定價的項目表示**完全沒有總額**，只有一則說明有多少項未定價的標題。
- 作為上限的數量會把 **"up to"** 帶入其小計。
- 超過有效期限的費率只顯示**計數**，直到你按下 *Use these rates anyway*；到期日期隨後會附在數字旁。
- 透過**連結**開啟時，在你於這部裝置上要求之前，金額都保持隱藏。CLI 以本機檔案的形式接受 `--rate-card=<file.json>`，絕不作為連結參數。

該卡片會從每個匯出階段中移除，所以絕不會改變檔案。它是算術，不是報價；只有你的印刷廠能報價。
:::

## 動態與聲音

### 影片

動畫工具匯出 **MP4** 與 **WebM**。選擇器只顯示這個瀏覽器能製作的容器，而要求它無法製作者的分享 `?format=` 連結會退回另一種，並附上相符的檔名。動畫工具也提供 **Start after**，它讓畫布靜止片刻，讓動畫與字型在錄製前穩定下來，以及 **Duration**，也就是完成片段的長度。**Motion blur**（Off、Draft quality、Standard 或 High，附有 **Shutter angle**）以渲染時間為代價模糊快速的移動。在瀏覽器支援之處，**Record live** 改為透過螢幕分享即時錄製螢幕上的預覽。

![動畫匯出的時間設定：Start after、Duration、附有 Shutter angle 的 Motion blur，以及 Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** 選擇 Smaller file、Balanced 或 Best quality。**Advanced** 開啟 **Codec**、**Frame rate**、**Rate mode** 與 **Hardware acceleration**。在工具有字幕之處，**Captions** 選擇 **Embedded track**，或影片旁的 **Sidecar .vtt + .srt**。連結以 `vq`、`codec`、`fps`、`seconds` 與 `wait` 攜帶品質、編解碼器、影格率、時長與開始延遲（[URL 參數](/info/url-parameters.html)）。

影片匯出會保留聲音。工具可以在片段下鋪一段**背景音樂**：循環或修剪到片段長度的音訊素材，附有淡入淡出、音量，以及在影片本身聲音下的閃避。錄製工具會把它們的即時音訊帶入檔案。

仍是點擊式簡報的 Design 簡報也可以輸出為影片。Present 選單中的 **Export slides as video** 會在 MP4 上開啟匯出面板。每張投影片依其自己的停留時間播放，若沒有，則依匯出面板的 Duration，而簡報的投影片轉場會在它們之間以溶解方式播放。文件本身不會改變。

### 動態圖片

**GIF** 隨處可播放，適合聊天與電子郵件；它比影片大，色彩也較少。**APNG** 與 **Animated WebP** 保留全彩與透明度。**Lottie Ad** 也匯出 **Animated SVG**：帶有內嵌 CSS 關鍵影格的向量影格，所以可縮放到任何大小，並在瀏覽器分頁或 `<img>` 中不需編解碼器就能循環。它的文字會轉外框，並使用較低的預設影格率，因為每個影格比點陣圖更重。這些全都是無聲的。

### 音訊

有些工具單獨匯出聲音。**Voice Recorder** 以即時音量表擷取麥克風錄音，並存為 **MP3**、**WAV**、**M4A (AAC)** 或 **Opus (WebM)**，在你的裝置上編碼。`wav`、`mp3`、`m4a` 與 `opus` 是普通的格式 id，所以音訊匯出就像 PNG 一樣可分享、可用指令碼處理。

素材選擇器接受各種背景音樂用的音訊，從 MP3 與 FLAC 到 MIDI 與 tracker 模組；[格式](/info/formats.html)列出它們。[Rondocode 歌曲](/info/rondocode.html)會依其片段要求的任何長度播放。

## 色彩與 HDR

Lolly 讀取每種現代 CSS 色彩，以感知方式進行色彩運算，並以讀取者能開啟的色彩空間寫出每個檔案：螢幕用 sRGB、列印用 CMYK、HDR 用 Rec.2100 PQ。[引擎中的色彩](/info/colour-engine.html)說明了做法。設為 **Wide colour / HDR** 的 Design 文件遵循它自己的規則，說明於[廣色域與 HDR 編輯](/info/hdr-editing.html)。

### 色彩描述檔

匯出內容會標記色彩描述檔，讓印刷廠、Photoshop 與瀏覽器等有色彩管理的應用程式，以你看到的樣子讀取色彩。這會自動發生；縮圖與預覽為了保持小巧而略過標記。

- **PNG 與 JPG** 帶有內嵌的 **sRGB** ICC 描述檔，也就是預覽所繪製的色彩空間。像素被標記，而非重新編碼。
- **Print PDF (CMYK)** 在其 *OutputIntent* 中宣告其印刷條件，告訴印刷廠它的 CMYK 油墨應如何解讀。
- **Print TIFF (CMYK)** 寫出未標記的 DeviceCMYK 像素，並在其 TIFF 中繼資料中記錄印刷條件。TIFF 無法嵌入印刷描述檔，所以 **Embed** 列只記錄該描述檔的名稱。
- **TIFF (RGB)** 是供封存或編輯器往返使用的未壓縮 sRGB 同類格式。它會把透明度壓平到白色上。兩種 TIFF 都僅限桌面，因為瀏覽器無法預覽 TIFF。
- **SVG**、**EMF**、**EPS** 與 **DXF** 是沒有內嵌描述檔的向量：SVG 的色彩是 sRGB，EMF 與 EPS 使用裝置 RGB，**EPS (CMYK)** 寫出 DeviceCMYK，DXF 使用 AutoCAD Color Index。SVG、EPS 與 DXF 會把文字轉成路徑外框。EMF 讓文字在 Office 與 Google Slides 中保持即時且可編輯，只有該格式無法表達的區段才退回外框；匯出面板的 **Outline fonts** 選項則強制到處都使用路徑。SVG 也會重現 CSS 方塊陰影，包括內陰影與外陰影。

::: details PDF/X-4 與你自己的印刷描述檔
Lolly 不附帶任何 CMYK 描述檔。具名的印刷條件會寫出輸出意圖，但不宣稱符合 PDF/X-4，因為 PDF/X-4 要求內嵌描述檔。

載入你自己的 CMYK 描述檔，並在 Colour profile 控制項中選擇它的 **Embed** 列。它會作為檔案的 *DestOutputProfile* 內嵌，而只要檔案的其餘部分允許，PDF 就宣稱符合 PDF/X-4。它宣告的印刷條件是從該描述檔讀出的：描述檔能證明時是已登記的名稱，否則是以描述檔自己名稱表示的 `Custom`。

有三件事會在保留輸出意圖的同時撤回該宣稱：CMYK 流程無法轉換的 RGB 圖稿、`prov` 打樣邊界署名文字（以未內嵌的標準字型繪製），以及 **Strong** 密碼，因為 PDF/X-4 禁止加密。每個 PDF 也都帶有 PDF/X-4 中繼資料：頁面方框、XMP、文件 ID，以及附有其描述檔的 sRGB 輸出意圖。
:::

### HDR（明亮色彩）

這是匯出面板的 **HDR** 卡片，它會為 HDR 螢幕提亮一般圖稿。在編輯過程中保留 HDR 原件則是另一項功能：[廣色域與 HDR 編輯](/info/hdr-editing.html)。

一般的匯出是 sRGB：飽和的品牌色彩與螢幕正常的白色一樣亮。HDR 顯示器在此之上還有餘裕。**HDR** 卡片會把你的品牌色彩與白色文字推向峰值亮度，而暗部保持暗，為光暈提供對比。

![匯出面板中已開啟的 HDR 卡片,底下展開了白點/延伸範圍/暗部提升/聚焦這幾個轉盤](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **格式。** PNG、JPG、AVIF 與 TIFF。WebP 是 8 位元，沒有可用的 HDR 解碼路徑，而向量與 PDF 沒有 HDR 模型。
- **預設關閉**，因為它會改變像素。勾選卡片，或在分享連結中傳入 `hdr=1`。
- **轉盤。** **White**（峰值亮度上限，400 到 2000 尼特）、**Reach**（光暈沿色調向下擴散多遠）、**Dark lift**（暗部提亮多少；`0` 讓它們保持暗）以及 **Focus**（提亮保留多少色彩豐富度）。它們以一個值傳遞：`hdr=1600-60-0-50` 表示 White 1600、Reach 60、Dark lift 0 與 Focus 50。
- **寫出什麼。** PNG 得到帶有 `cICP` 區塊的 16 位元 Rec.2100 PQ。JPG 是 ISO 21496-1 增益圖 JPEG：一張普通的 SDR 圖片，加上附加的增益圖。AVIF 得到改寫的 `colr` 方塊。TIFF 得到 PQ 像素，並附有帶 `cicp` 標籤的產生式 ICC v4 描述檔，且壓平到黑色上，因為白色在 PQ 中是 10,000 尼特的代碼，會讓每個邊緣出現光暈。提亮依循感知（OKLab）明度並保留色相，所以品牌綠色會變亮，而不會變成薄荷色。
- **光暈在哪裡顯示。** 在 HDR 顯示器上有色彩管理的檢視器：Apple 裝置上的 Preview、Quick Look 與 Safari，或 HDR 螢幕上的 Chrome。SDR 螢幕顯示的是一般圖片。
- **發布之前。** 許多平台會重新編碼上傳的內容並去除 HDR 訊號，這可能讓圖片變暗或變得褪色。請在你控制目的地的地方使用 HDR，例如你自己的網站、影片牆或明亮面板上的簡報。
- **從終端機。** `--hdr=1` 搭配 `--export=png` 或 `--export=jpg`，在 [CLI](/info/cli.html) 上以相同的引擎編碼器寫出相同的 PNG 與增益圖 JPEG，路徑中沒有瀏覽器。AVIF 與 TIFF 目前仍是網頁匯出。

## 隨檔案傳遞什麼

完成的檔案除了圖片，還可以帶有數種記錄。有些附在像素旁邊，在檔案重新儲存或被去除時消失；有兩種標記存在於像素本身。

::: figure exporting-what-travels
每種記錄存在何處、是否預設開啟，以及哪個連結參數控制各自。
:::

匯出面板把 **Licence**、**Source credits**、*Password protect*、**C2PA Credentials**、**Lolly Imprint** 與 **Durable credential** 摺疊成一個 **Content protection** 群組，只顯示所選格式能用的卡片。當連結或文件已宣告授權，或來源需要你做決定時，它會自動展開。**Design system** 卡片留在群組之外，在每個匯出上都看得見。

![在 PNG 匯出中展開的內容保護群組,僅顯示適用於該格式的卡片](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### 來源證明與浮水印

在格式有欄位之處，匯出內容帶有**來源證明中繼資料**：軟體、來源、工具名稱與你的個人資料署名行，寫入 PNG iTXt、JPEG EXIF、PDF info、SVG `<metadata>` 或 GIF 註解。它只記錄作者身分，不會上傳任何內容。**Experimental** 工具還會蓋上可見的浮水印，由主機套用，所以編輯工具無法移除該標記。

**Lolly Imprint** 是隱形的像素浮水印，**預設開啟**。憑證與中繼資料附在像素旁邊，會因重新儲存、螢幕截圖或中繼資料去除而遺失。Imprint 存在於像素中，並能在重新壓縮後存活，所以副本仍可被辨識為 Lolly 製作。它是提示而非密碼學保證，也不帶任何個人資料。它存在於 JPEG XL、PNG、JPG、WebP、AVIF、TIFF 與 BMP，以及 Lolly 渲染進 PDF 或 PPTX 的點陣圖中，絕不存在於你嵌入的圖片中。取消勾選 **Lolly Imprint**，或傳入 `imprint=0`，即可省略 Imprint。AVIF 在重新編碼後的存活率尚未校準。[Verify](/verify) 在你的裝置上偵測它；請見 [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint)。

**Durable credential** 以 TrustMark 格式的裝置端神經模型將 Lolly 的 ID 寫入像素，使「made with Lolly」連結能在中繼資料被去除和重新編碼後存活，並可由支援 TrustMark 的工具讀取。它**預設關閉**，因為每次匯出都要多一次神經運算，並需一次性下載模型。它涵蓋 PNG、JPG、WebP、AVIF 與 TIFF；在面板中勾選，或傳入 `durable=1`。桌面與行動應用程式隱藏這張卡片，因為它們離線時沒有來源可從中擷取模型。

**Licence。** 選擇其他人可以如何使用你的作品：預設為 *None (all rights reserved)*，或 CC0 1.0、Public Domain Mark 1.0，或 Creative Commons 4.0 授權（BY、BY-SA、BY-NC、BY-NC-SA、BY-ND、BY-NC-ND）。授權名稱及其條款說明的連結會寫入檔案的授權中繼資料（格式有的話，包括 EXIF、XMP 與 RIFF）及其 Content Credential。這項選擇隨文件儲存，並以 `licence=` 隨連結傳遞。Lolly 寫入你選擇的授權；它不檢查也不強制條款。有自己授權欄位的工具（例如 Claim）則保留該欄位。

### 設計系統記錄

匯出會記錄製作該檔案的設計系統：它的名稱、所依據的已發布版本（當它不是工作版本時），以及所用的[配色方案](/info/colourways.html)。設計系統宣告的任何其他主題選擇（例如密度）也以相同方式記錄。淺色或深色的選擇被省略，因為圖片本身已經顯示用的是哪一個。

**在寫入任何內容之前，你會先看到這份記錄。** 預設勾選的 **Design system** 卡片會顯示檔案將帶有的確切文字，例如 *Records: Acme · Colourway: Beach*，以及描述將顯示的樣子。設計系統的名稱是其擁有者輸入的任何內容，所以卡片依原樣顯示。取消勾選卡片，即可在該匯出中省略這份記錄。Design 的文件面板在 *Embedded in exports* 下列出相同的文字。

**描述會在工具旁給出配色方案。** 卡片勾選時，*"Made with https://lolly.tools : Chart"* 會變成 *"Made with https://lolly.tools : Chart (Beach colourway)"*。設計系統自己的名稱留在記錄中，而不在描述裡。沒有工具名稱的描述，或由工具根據自己的輸入寫成的描述，則維持原樣。透過 `tokenAxes` 忽略配色方案的工具不會記錄任何配色方案，而 PDF 打樣署名（`prov` 列印標記）遵循相同的規則。

**引導代理的品牌技能。** 當代理製作作品並指名它讀取並遵循的[品牌技能](/info/brand-skills.html)時，記錄還會列出每個技能及其修訂版，例如 *Guided by: acme-brand 1.0*。這些文字的意思是該技能引導了這項工作。它們不是檢查：Lolly 不會對照技能測試作品。只有代理自己的陳述才會加入這份清單，目前指的是 [MCP 伺服器](/info/mcp.html)的 `lolly_render` 的 `brandSkills` 引數，所以在應用程式中或從分享連結製作的作品不帶任何技能。Content Credential 將該清單保存為 `brandSkills`，一個 JSON 值，包含每個技能的 id、名稱、修訂版與 SHA-256 雜湊。XMP 封包與 SVG 中繼資料以 `lolly:BrandSkills` 保存相同的值，從記錄寫出的 PDF 每個技能增加一個關鍵字，描述則維持原樣。內部技能以其 id、名稱、修訂版與雜湊記錄，絕不記錄其文字。相同的開關會連同記錄的其餘部分一起省略該清單：**Design system** 卡片、`_madewith=0`、`--no-madewith` 與 `madeWith: false`。當 MCP 伺服器在瀏覽器中繪製檔案時（PDF、JPEG 與其無瀏覽器路徑無法寫出的其他格式），檔案自己的中繼資料不含清單，只有 Content Credential 能保存。傳入 `c2pa` 以保留記錄；沒有憑證時，渲染會警告品牌技能未被記錄。

**讀回記錄。** [Verify](/verify) 在檔案的憑證詳細資料中將記錄列為 **Design system**，並將任何品牌技能列為 **Guided by**。*Recreate with these settings* 會在記錄的版本與配色方案中重新開啟工具。當這部裝置保有相同 id 與名稱的設計系統時，連結會以記錄的設計系統開啟；否則以你目前使用的設計系統開啟。

::: details 寫入什麼、寫在哪裡，以及哪些匯出會省略記錄
| 位置 | 寫入的內容 |
|---|---|
| Content Credential | `tools.lolly.export` 斷言中的 `designSystem`（id）、`designSystemLabel`、`designVersion` 與 `themes`，各為純文字值；`themes` 是選擇的 JSON 清單 |
| PNG、JPEG、WebP 與 JXL | 相同的四個值，作為檔案 XMP 封包的 `lolly:` 屬性，位於命名空間 `https://lolly.tools/ns/export/1.0/` |
| SVG | `<metadata>` 區塊內相同的 `lolly:` 屬性 |
| PDF | 關鍵字，例如 *Design system: Acme* 與 *Colourway: Beach* |
| 每種有描述欄位的格式 | 描述，並在工具旁附上配色方案 |

只有在有東西可記錄且格式能容納記錄時，卡片才會出現。CSV、JSON、行事曆檔案與其他文字或資料格式沒有中繼資料，而 EPS、EMF、DXF 與 BMP 沒有記錄用的欄位。HTML、Markdown 與 CSS 只在其 Content Credential 中保存記錄，所以對它們而言，卡片不顯示描述行，並在 **C2PA Credentials** 關閉時隱藏。設計系統沒有提供的欄位不會出現在檔案中。

分享連結以 `_madewith=0` 關閉記錄（[URL 參數](/info/url-parameters.html)）；命令列接受 `--no-madewith`，[MCP 伺服器](/info/mcp.html)的 `lolly_render` 接受 `madeWith: false`，而終端機應用程式的匯出面板有一個 **Design system** 列。命令列會在標準錯誤輸出上印出完成檔案所帶的文字，對工具渲染以及 `lolly run` 從已儲存 Design 工作階段匯出的每個檔案皆然，而 MCP 渲染會在檔案旁印出它們，兩者都是從檔案讀回的。命令列在沒有瀏覽器的情況下繪製的 PNG 不帶檔案中繼資料，所以其記錄只隨憑證傳遞。裝置端 Utility 完全不加中繼資料。

沒有 **Design system** 卡片的執行會省略記錄：Batch 執行、從 Projects 匯出的資料夾與 3D 集合匯出，以及在終端機應用程式中的 CSV 批次、Projects 資料夾或選取範圍匯出與全部渲染檢視。從工具匯出一個檔案即可記錄設計系統。
:::

### Content Credentials (C2PA)

匯出內容可以帶有 **Content Credentials**：已簽署的 [C2PA](https://c2pa.org) manifest，記錄是什麼製作了檔案、何時與何地，並綁定到檔案位元組的雜湊，因此任何之後的編輯都能被偵測到。規格由 C2PA 發布，而 Lolly 寫出任何 C2PA 讀取器都能檢查的標準 manifest。

![已勾選的 C2PA Credentials 卡片，核取方塊旁邊是憑證有效期](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **預設開啟。** **C2PA Credentials** 卡片對幾乎每個工具都預先選取。對單次匯出取消勾選，或在連結中傳入 `c2pa=off`。工具可以在其 manifest 中選擇不啟用。
- **格式。** PDF（RGB 與 Print）、PNG 與 APNG、JPG、GIF、SVG、TIFF（RGB 與 Print）、WebP（靜態與動態）、AVIF、MP4、WebM、音訊容器 MP3、WAV、M4A、OGG/Opus 與 FLAC，以及 HTML、Markdown 與 CSS。ZIP 會為每個支援的成員蓋印，Animated SVG 就是這樣取得憑證的。MP4、AVIF 與 M4A 使用標準的 BMFF 綁定，MP3 使用其 ID3v2 對應，所以 `c2patool` 與其他讀取器可以驗證它們。WebM 與 OGG/Opus 目前沒有標準對應，所以 Lolly 把 manifest 放在 Matroska 附件與 OpusTags 欄位中，由 Lolly 自己的驗證器檢查。ICO、EPS、EMF、DXF、BMP、PPTX、Office 格式以及其他文字與資料格式沒有 C2PA 容器。
- **記錄什麼。** 製作檔案的工具與應用程式、簽署時間、匯出它的外殼、在 **Design system** 卡片勾選時的[設計系統與配色方案](#the-design-system-record)，以及使用中輸入的指紋。輸入文字、綁定個人資料的欄位、非使用中的控制項、瀏覽器版本與作業系統詳細資料都會被省略。只有在 Settings → Preferences → Your details 下開啟 **Use my details to create** 時，你的姓名與電子郵件才會作為作者出現。匯出放置的來源以素材成分的形式傳遞：[具名作品](#source-credits)（例如表情符號），以及影片或音訊匯出中的 [Rondocode 歌曲](/info/rondocode.html#songs-in-the-credential)。
- **接收者看到什麼。** Adobe 應用程式、`c2patool` 與 contentcredentials.org/verify 等 C2PA 工具會讀取 manifest 並顯示聲明。Lolly 以你裝置上產生的金鑰簽署，而不是來自信任清單的憑證，所以檢視器會回報*未驗證*的憑證：結構與防竄改證據是真實的，簽署者則沒有被擔保。若要改變這一點，請在 Settings → Preferences → Content Credentials 下註冊**已驗證身分**；請見 [Content Credentials 身分](/info/content-credentials-identity.html)。
- **檢查檔案。** 將任何檔案拖放到 [Verify](/verify)，或執行 `lolly validate <file>`，即可在裝置上得到報告，首先說明檔案是否由 Lolly 製作，以及之後是否有更動。Verify 也會檢查憑證之外的內容；請見 [Verify 檢查什麼](/info/what-verify-checks.html)。
- **隱私。** 簽署金鑰是為這次匯出產生的，絕不離開你的裝置，而聲明只包含來源證明中繼資料已經帶有的內容。轉換你自己檔案的隱私 Utility 不加憑證，而 *Strip Hidden Data* 會像移除任何其他中繼資料一樣移除 C2PA manifest。Rondocode Utility 製作新的音訊，所以它會簽署它寫出的內容（[Rondocode 歌曲](/info/rondocode.html#files-from-the-rondocode-utility)）。
- **交互作用。** 受密碼保護的 PDF 在任一層級都無法帶有 Content Credentials。憑證是最後加入的，覆蓋在完成的位元組上，在 DPI、EXIF、色彩描述檔、PDF/X 中繼資料與列印標記之後。

### 來源署名

放置他人作品的匯出，會把該來源記錄在憑證中。從所選表情符號組繪製的表情符號是最常見的情況：作品、其創作者、授權、確切位元組的來源，以及更動了什麼，全都隨檔案傳遞。範本為 SVG 的工具中的文字會保留系統自己的表情符號，所以那裡不會註明任何來源。**Source credits** 列在你下載之前說明來源對交付有什麼要求，而下載之後，它會先讀回交付的位元組，才說署名已在檔案中。要求你做選擇的授權（例如你即將分享的重新著色的 CC BY-SA 字符）會得到一張附有選項的卡片；下載絕不會被阻擋。[創作權利與署名](/info/creative-rights.html)有措辭、已審閱的授權，以及哪些仍歸你所有。

## 密碼保護

兩種鎖，都在你的裝置上製作。匯出面板的 *Password protect* 卡片驅動兩者。

![在 PDF 匯出中展開的密碼保護卡片，內含密碼欄位與兩種鎖定等級](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**PDF 開啟密碼**在你輸入密碼後有兩個層級：

- **Weak**：40 位元 RC4，是嚇阻而非保護。其密碼可以明文隨分享連結傳遞。僅限 RGB `pdf`。
- **Strong**：AES-256（PDF 2.0）。在匯出時輸入，絕不放進連結。它也適用於 Print PDF，以及批次 ZIP 內的每個 PDF。Strong 鎖定的 Print PDF 保留其 CMYK、標記與輸出意圖，但放棄 PDF/X-4 的宣稱。

**上鎖的 ZIP** 涵蓋 ZIP 匯出、從 Projects 下載的資料夾或批次，以一個密碼提供兩個層級：**Weak**（ZipCrypto，是嚇阻；可以隨 `?password=` 連結傳遞）或 **Strong**（AES-256，在匯出時輸入，絕不放進連結）。密碼保護每個成員，而其中的任何 PDF 也單獨以 AES-256 上鎖，所以 ZIP 解壓縮後它仍是鎖定的。提示在下載開始時出現；空白密碼表示不上鎖。

**以密碼把關的分享連結**在開啟之前會向接收者索取密碼。整個連結狀態以由密碼衍生的金鑰（PBKDF2）用 AES-256 加密，所以只有密文會傳遞，解密在接收者的瀏覽器中進行。提供連結的伺服器絕不會看到密碼或設計。在 **Share** 對話框中開啟它。加密的連結只能在 Lolly 中開啟，絕不能作為嵌入的圖片。請見 [URL 模式](/info/url-mode.html)。

## 在手機上

匯出控制項位於浮動的 **Export** 按鈕之後，它會開啟 **Export** 面板：相同的格式、大小、複製、下載與分享，尺寸針對觸控調整。

## 供連結與 CLI 使用的格式 id

這些是 URL `format=` 參數與 CLI `--export=` 旗標的值（請見 [URL 參數](/info/url-parameters.html)與 [CLI](/info/cli.html)）。工具的選單只顯示該工具能製作的格式，所以永遠比這份清單短。

| 種類 | Id |
|---|---|
| 點陣圖 | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff`（RGB TIFF） · `cmyk-tiff`（Print TIFF） · `bmp` · `ico` |
| 向量 | `svg` · `svgz`（gzip 壓縮的 SVG） · `emf` · `wmf` · `eps` · `eps-cmyk`（EPS CMYK） · `dxf`（切割檔案） |
| 頁面與文件 | `pdf` · `pdf-cmyk`（Print PDF） · `pptx`（PowerPoint） · `docx`（Word） · `odt`（OpenDocument Text） · `idml`（InDesign） · `penpot`（Penpot 設計檔案） · `scorm`（課程套件，一個 ZIP） |
| 動態 | `gif` · `apng`（Animated PNG） · `webp-anim`（Animated WebP） · `svg-anim`（Animated SVG） · `webm` · `mp4` · `lottie`（dotLottie） · `premiere-xml`（Premiere XML + media） |
| 音訊 | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| 文字與資料 | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl`（GIMP 調色盤） |
| 套件與封裝 | `zip` · `rpm` 與 `tar.gz`（封入 Linux 套件的渲染結果） |

有幾個 id 來自工具自己的匯出程式碼：`ase`（Adobe Swatch Exchange，來自 Palette Lab）以及 `exr` 與 `hdr`（高動態範圍點陣圖，來自 Darkroom）。**Convert Font** 從你提供的字型檔案寫出 `ttf`、`otf` 與 `woff`，所以單純的連結沒有東西可供它渲染。
