# 匯出與格式

如何從工具中取得完成的檔案 - 選擇正確的格式、設定輸出尺寸，以及每個選項的作用。如同其他一切，**匯出都在你的裝置上進行**；不會上傳任何東西。

## 匯出如何運作

預覽畫面*就是*檔案本身。當你匯出時，主機會將該畫布轉譯成你選擇的格式，並提供下載（或放到你的剪貼簿）。工具只會提供作者宣告過的格式，選擇器會隱藏你的瀏覽器無法產生的格式（參見[Video](#video)）。

有三種路徑可以產生檔案。大多數工具會將畫布**轉譯**成所選格式。文字與資料格式（HTML、MD、TXT、JSON、CSV、ICS、VCF）則是**從工具的內容產生**，而非從畫面點陣化而來。而隱私工具（例如 *Strip Hidden Data*）使用第三種路徑：*你*選擇的檔案會在裝置上逐位元組轉換，然後直接交還給你 - 不經過畫布、不加浮水印、也不加入來源中繼資料，因為那本來就是你自己的檔案。

匯出控制項中的動作：

- <!--i:download--> **Download**（下載）- 儲存檔案（主要動作）。
- <!--i:photos--> **Copy**（複製）- 把圖片放到剪貼簿，直接貼到 Slack、電子郵件或文件中。若瀏覽器無法複製圖片，會改為下載並告知你。
- <!--i:folder--> **Save**（儲存）- 將目前的設計保存為你資源庫中的一個已儲存工具作業階段。
- <!--i:link--> **Share**（分享）- 開啟**Share dialog**（分享對話框）：一個可複製的連結，能重現此設計，附有造訪時的切換選項（全螢幕、匯出面板、開啟時下載或複製），以及可選的 **Shortest link**（最短連結），能將整個狀態封裝成一個精簡權杖（參見 [URL Mode](/info/url-mode.html)）。

（工具作者會選擇顯示哪些選項；預設集合是 Copy、Download 與 Save。）

![匯出面板 - 格式、尺寸以及 Copy / Download / Save / Share 動作](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share（分享）會在工具上方開啟，連結已經建立完成，造訪時的切換選項則列在下方。

### 一次轉譯多個檔案

單次匯出是一個檔案，但你可以一次轉譯**多個**檔案 - 每次都會以一個 `.zip` 交付：

- <!--i:folder--> **Projects → Render folder**（專案 → 轉譯資料夾）會將資料夾（及其子資料夾）中每個已儲存的作業階段，匯出為一個巢狀 zip；**Render selection**（轉譯所選項目）對任何多選項目也是如此；單一已儲存作業階段則直接轉譯成它自己的檔案。不需要 Batch/Pro - 參見 [Using Lolly → Projects](/info/using.html)。
- <!--i:layers--> **Batch (Pro)**（批次（Pro））會轉譯一個輸入集合的網格 - 一次產生同一份範本的每個變體。

已儲存的作業階段也可以從 Projects 重新分享為工具連結（它會從已儲存的輸入重建工具網址），因此連結會以完全相同的設定重新開啟它。

## 選擇格式

檔名與格式選擇器位於面板頂端，合併成一組 `name.format` 配對，選擇器只會列出此工具作者宣告過的格式。

![與格式選擇器融合的檔名欄位，讓匯出讀起來像一組 name.format 配對](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| 你想要… | 使用 | 原因 |
|---|---|---|
| 清晰、可縮放的標誌／美術作品 | **SVG** | 向量 - 可無限縮放、檔案小、可編輯 |
| 適用於 Office／Windows 應用程式的向量 | **EMF** | 貼入 PowerPoint／Word 後仍是可編輯的向量;文字保持即時可編輯,Google 雲端硬碟則會用 Google 繪圖開啟供 Slides 使用 |
| 適用於印刷／設計應用程式的向量 | **EPS**,或 **EPS (CMYK)** | 供 Illustrator／印刷工作流程使用的 PostScript 向量 |
| 適用於切割／CAD 機器的向量 | **DXF** | 雷射切割機、割字機、CNC - 以毫米為單位的輪廓路徑 |
| 可編輯的投影片簡報 | **PowerPoint**(PPTX) | 原生可編輯文字與圖形,圖片與向量皆可取出使用 |
| 可供 LMS 匯入的課程 | **SCORM**(LMS) | 一個 zip 檔,內含清單檔、啟動頁面、投影片,以及附字幕的旁白影片 - 來自 Design 簡報 |
| 可編輯的文字文件 | **Word**(DOCX)或 **OpenDocument**(ODT) | 真正的段落與標題,文書處理軟體可繼續編輯(Doc Studio) |
| 相片或一般用途影像 | **PNG**(無損)或 **JPG**(較小) | 通用點陣圖 |
| 更小的現代影像格式 | **WebP** / **AVIF** | 壓縮效果更佳,支援透明度 |
| 印刷 | **PDF**,或 **Print PDF**(CMYK) | 真實頁面尺寸;CMYK 供印刷使用 |
| 供印刷廠使用的點陣圖 | **Print TIFF**(CMYK) | 供 RIP 使用的 DeviceCMYK 像素 |
| 網頁用動畫 | **GIF** | 各處皆可使用,檔案較大 |
| 全彩且具真實透明度的動畫 | **APNG** | Animated PNG - 無調色盤限制,真正透明 |
| 檔案最小的動畫 | **Animated WebP** | 全彩加透明度,壓縮效果優於 GIF 或 APNG |
| 可縮放的向量動畫 | **Animated SVG** | 自成一體;可在瀏覽器或 `<img>` 中循環播放,無需編解碼器,任何尺寸皆可 |
| 社群／分享用影片 | **MP4** 或 **WebM** | 每位元組畫質最佳(見下文) |
| 富文字／電子郵件簽名 | **HTML** | 貼入郵件用戶端時保留格式 |
| 純內容 | **MD** / **TXT** | 純文字 |
| 行事曆活動 | **ICS** | 可匯入任何行事曆應用程式 |
| 聯絡人名片 | **VCF** | 可匯入聯絡人／通訊錄 |
| 可重新匯入的結構化資料 | **JSON** / **CSV** | 可完整往返該工具的內容 |
| 網站圖示 | **ICO** | 多尺寸的網站圖示(**ZIP** 內含多種格式) |

第一列是最常見的情況。以你的品牌字體排版的品牌字標，會匯出成 SVG，其中每個字母都是輪廓路徑而非像素，因此同一個檔案在名片尺寸與建築外牆尺寸下都能保持清晰。

![一個細線、寬字距、寫著 Aurora 的品牌字標，正是表格中 SVG 那一列所指的純向量美術稿](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## 尺寸與列印單位

預設情況下，匯出會使用工具原生的像素尺寸。若工具開放**尺寸**設定，你可以設定寬 × 高與**單位**：

- **px**（預設）- 精確像素。
- **mm · cm · in · pt · pc** - 實體／列印尺寸。使用實體單位時，你還需要設定 **DPI**（列印預設為 **300**）；引擎會依格式正確轉換 - **PDF** 會變成該尺寸的真實頁面，**點陣圖**會依 DPI 轉譯成正確的像素數（並嵌入解析度資訊），**SVG** 會保留實體單位並附上以 px 為單位的 viewBox。

若要取得更高解析度的點陣圖，請輸入更大的寬／高，或選擇實體單位並提高 DPI（像素數 = 尺寸 × DPI）。目前沒有一鍵縮放的切換選項。

範例：寬度 `210`、高度 `297`、單位 `mm` → 一張 A4 頁面。

![尺寸列設定為 210 乘 297 mm，因單位為實體單位而顯示出 DPI 欄位](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## 從計時合成中擷取靜態畫面

**具時間軸的合成內容** - 也就是 Design 中的 [Sequence](/info/using.html#timeline-sequence) 時間軸,或任何以時間軸驅動的畫板 - 本身是會變動的,因此匯出靜態影像時必須回答「哪一刻?」。規則正如你所預期:**播放頭所在的畫格**。將播放頭移到你想要的畫面位置再匯出;你看到的就是匯出的結果。

當你想要不只一個時刻時，**Frames**（畫格數）欄位會出現在輸出尺寸旁邊（僅適用於計時合成，且僅適用於靜態格式 - PNG、JPG、WebP、SVG 或 PDF）。將其保留為 `1` 即為播放頭所在畫格。調高數值，你就會得到該數量的靜態畫面，以等間隔取樣自整段序列：

- **點陣圖與 SVG** 會以一個 **zip** 傳回 - `<name>-01.png`、`-02.png` 依此類推。
- **PDF** 會傳回一份**含有相同頁數的單一文件**。

適用於分鏡腳本、縮圖表、審閱用的樣張，或直接從影片剪輯中截取的社群輪播圖。

取樣是在每個區間的**中點**進行，而非邊緣，因為序列的第一個瞬間通常是尚未淡入完成的進場轉場，而最後一個瞬間則是所有片段結束後的狀態 - 若在端點取樣，會把兩個畫格浪費在近乎空白的畫面上。數量上限為 **64**（樣張是給人看的），欄位中輸入任何不合理的內容都會退回到 `1`，而不會讓匯出失敗。每個畫格都是一般的靜態畫面，因此 Content Credentials、印記、實體單位與 DPI 的行為都與單次匯出完全相同。

**Frames**（畫格數）欄位是目前取得樣張的方法。引擎保留了對應的 `cuts` 網址參數，但目前還沒有任何殼層會從連結中讀取它，因此分享出去的連結一律會以播放頭畫格重新開啟 - 參見 [URL Mode](/info/url-mode.html#contact-sheets-cuts)。

## 多頁 PDF

有些工具產生的是**多頁 PDF 文件**,而非單一美術作品 - 封面、依內容需要延展至多頁的內文,以及封底,全部收在同一個檔案中(參見 *Booklet* 工具)。每一頁都是依該頁面框尺寸產生的**真正 PDF 頁面**,因此讀者與印刷廠拿到的是真實的多頁,而非一張長條圖片。

- **由內容產生頁面。** 加入文字與圖片區塊；當區塊填滿時會自動建立新頁面，你也可以強制任何區塊另起新頁。
- **真實頁面尺寸。** 選擇 A4、US Letter 或 A5（直向 - 雙欄版面就是為此而設計）- 每一頁，以及匯出的 PDF，都會依該尺寸精確轉譯。

多頁 PDF 是 RGB 文件,不含裁切線／出血線標記 - 這些屬於上方單頁的 **Print PDF** 路徑。它們確實帶有與每個 PDF 匯出相同的 **PDF/X-4 中繼資料**(頁面框、XMP、文件 ID、內嵌描述檔的 sRGB 輸出意圖),並提供 **Content Credentials**(見下文) - 在 *Booklet* 工具中此選項預設已勾選。

## 一次製作多個項目

Lolly 有三種不同的方式可用來大量處理，各自解決不同的工作 - 批次編輯是平台的一級功能，而不是每個工具各自重新發明的東西：

- <!--i:document--> **一份設計 × 一個資料列表格 → 一份多頁文件。** 具有 `table` 輸入的工具（例如 *Battlecards*）會自動將每一列轉成一頁 - 從你的試算表貼上表格，即可得到簡報大小的 PDF。你真正的批次編輯器仍然是那份試算表：在那裡修正十列，再貼上一次即可。工具本身完全不管理頁面。
- <!--i:layers--> **一份設計 × 一個資料檔 → 多個獨立檔案。** `/pro` 批次網格會讀取一個 CSV，並且*每一列*轉譯成一次匯出 - 姓名識別證、證書，各自一個檔案。
- <!--i:sliders--> **多個不同的資產並排編輯。** *Multi-edit*（多重編輯）在同一個檢視中開啟數個已儲存的作業階段，方便對不同設計進行協調一致的細部調整。

經驗法則：屬於同一設計、應放入**一份文件**的資料列 → 使用表格驅動的工具；必須以**獨立檔案**形式交付的資料列 → 使用 `/pro`；需要相同微調的**不同設計** → 使用多重編輯。（一項規劃中的「combine media」轉譯選項，將會銜接前兩者 - 把同格式的匯出結果串接成一份 PDF、一支影片，或一張校對用樣張。）

## PowerPoint（PPTX）

Design、Markdown Slides、Booklet、Doc Studio、Chart 與 Diagrams 都能匯出**PowerPoint 簡報** - 每頁一張投影片。重點不在於像素級精準的截圖,而是要交給同事一份他們真的能夠**編輯、並從中取出素材**的簡報。因此每一頁都會拆解為原生物件:

- <!--i:font--> **文字**會變成真正、**可編輯的 PowerPoint 文字方塊** - 保留版面配置的字型大小、顏色、粗細、斜體與對齊方式 - 讓你能在 PowerPoint 中修正錯字或重新調整樣式。
- <!--i:pentool--> **向量圖**(標誌、圖示、SUSE 標記)會以**真正的 SVG 圖片**內嵌 - 在任何尺寸下都保持清晰銳利,PowerPoint 甚至能對其執行*轉換成圖形*。
- <!--i:photos--> **圖片**會以原生解析度、作為可獨立擷取的圖片呈現(以 `cover` 裁切的主圖會保留裁切範圍外的完整影像,方便你重新取景),圖片上的任何處理效果(濾鏡、混合)都會忠實烘焙進去。
- <!--i:layers--> **背景、邊框與分隔線**會變成真正的矩形/線條圖形。

![已選擇 PowerPoint 的匯出面板:每頁一張投影片,文字與圖形保持可編輯](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

版面配置是刻意近似的 - 目標是忠實、可重複使用的**內容**,而不是鎖死的螢幕截圖。任何走查器無法原生表達的內容(複雜的濾鏡或遮罩區域)都會以圖片形式內嵌,以免流失內容。一份簡報只有單一投影片尺寸,取自第一頁。

PowerPoint 也是一個**匯入**管道。將 `.pptx` 拖放到任何上傳區域,選取想要的投影片 - 每一張都會成為可放置、調色或延伸製作的素材。**Markdown Slides** 會依 Markdown 內容產生全新簡報(並附上具品牌樣式的 `.pptx` 範本),而 **Rebrand** 工具則會原地為既有簡報換上新主題 - 主題色盤、寫死的顏色與字型 - 但不動其圖表、SmartArt 或動畫,並以 `.pptx` 交回成果。詳見 [匯入設計 → 簡報與文件](/info/design-import.html#decks-and-documents)。

## Penpot

任何能匯出 SVG 的工具,也都能匯出 **Penpot 檔案**(`.penpot`) - 這是可以在 Penpot 中繼續編輯的文件,而不只是用來檢視。

- <!--i:layout--> 從**Design**匯出時,每個畫框都會變成 Penpot 的**board**,其上每個方框都會各自轉換為可編輯的形狀 - 矩形、橢圓、文字、圖片或路徑 - 結果會以可重複使用的**component**形式出現在 Assets 面板中,隨時可以再次拖出使用。
- <!--i:pentool--> 對於算繪結果是**單純幾何圖形**的工具 - 例如 QR Code、Street Map、Wordmark 與 Palette Lab 等向量工具 - 每個路徑、矩形、文字段落與漸層都會以相同方式轉換為各自可編輯的形狀。
- <!--i:font--> 對於以**HTML**排版算繪的工具,**文字仍然是文字** - 每一行都是一個可編輯的 Penpot 文字物件,而非外框路徑,也不是扁平圖片。Penpot 沒有對應結構可承載的美術內容 - 複雜的插畫、即時畫布 - 會單獨以圖片形式保留,因此絕不會把它周圍的文字與方框一併壓平。若整個版面 Penpot 無法忠實拆解,仍會以一張完整保真的圖片呈現,絕不會遺漏任何內容。
- <!--i:palette--> 形狀若**繼承自品牌 token** 的顏色或字型,在檔案中會保持與該 token 的**連結**:在 Penpot 的 Tokens 面板中修改 token,所有繼承它的形狀都會一起重新上色,而一次性寫死的顏色則會維持原樣不變。品牌的顏色與字體排印也會出現在 **Assets** 面板中,完整的設計 token 組則會出現在 **Tokens** 面板中 - 與 Lolly 自身色盤使用的是同一套 DTCG token 組。Penpot 從此保有自己的一份副本:在其 Tokens 面板中所做的編輯,需透過 [Brand Studio 的匯入功能](/info/design-import.html) 才會回到品牌中,不會自動同步。

| 你製作的內容 | 在 Penpot 中 |
|---|---|
| 文字 | 可編輯的文字物件 - 可修正錯字或重新設定樣式 |
| 形狀、路徑、漸層、圖片 | 各自可編輯的向量形狀 |
| 來自品牌 token 的顏色或字型 | 即時的 token 連結 - 編輯 token,所有繼承它的形狀都會隨之更新 |
| 整個設計 | Assets 面板中可重複使用的 component |
| 複雜插畫或即時畫布 | 單獨以圖片形式內嵌,周圍的可編輯內容則不受影響 |

![已選擇 Penpot 的匯出面板:.penpot 檔案,以及下載按鈕旁的 Send to Penpot](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

要開啟它,啟動 Penpot、選擇一個專案,然後選擇 **Import**。若已在匯出面板中登入 Penpot,**Send to Penpot** 會替你完成這個步驟 - 在那裡選擇專案,檔案就會直接進入該專案。

## SCORM(課程套件)

Design 簡報可以匯出為**SCORM package** - 也就是學習管理系統(LMS)可匯入的 zip 檔,無論是 Moodle、Canvas、Blackboard 或企業自有的 LMS 皆可。在格式選擇器中選取 **SCORM (LMS)**,匯出就會產生:

- <!--i:layout--> **投影片**,每個畫板一張圖片,畫板允許的話以向量呈現,只有在無法向量化時才使用點陣圖。
- <!--i:play--> **旁白影片**及其字幕軌 - 由裝置端語音朗讀的講者備忘稿,與 [Presenting](/info/create/using.html#presenting) 播放的內容完全一致。
- <!--i:file--> **一個啟動頁面**,會依序播放投影片、播放影片,並透過每個 LMS 都接受的 SCORM 1.2 執行環境,將完成狀態回報給 LMS。
- <!--i:font--> 簡報所使用的字型,讓啟動頁面離線時也能呈現相同效果。

![Design 簡報上已選擇 SCORM (LMS) 的匯出面板](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

套件中沒有任何內容會對外連線回報:它只是 zip 中的檔案,在 LMS 內執行時不需要打包工具、CDN 或帳號。網頁版與桌面版應用程式可以產生它;CLI 則不行,因為拍攝畫板與編碼影片都需要瀏覽器。

## DXF(切割檔)

向量工具(Brand Lockup、QR Code、Street Map、Wayfinding Signage、Pose Geeko、標誌組合、Diagram Builder)可以匯出 **DXF**——雷射切割機、貼紙繪圖機與 CNC/CAD 軟體都能讀取的 AutoCAD R12 交換格式。幾何圖形會以**毫米為單位的外框路徑**寫入(曲線會以精細的容許誤差攤平),文字會轉換為外框路徑,色彩則對應到最接近的 AutoCAD 色彩索引(通常用來驅動切割機上的工具/作業)。DXF 僅支援線稿——照片或套用濾鏡的區域沒有可供切割的路徑形式,會被捨棄(Lolly 會提出警告),因此若需要保留點陣內容,請改用 SVG/PDF。

Street Map 是最清楚的例子:整個設計本來就都是線條,因此每一條道路與運河都能變成切割路徑,沒有任何東西需要捨棄。

::: showcase
![以奶油色底、墨色線條呈現的巴黎 Street Map 渲染圖 - 純線稿,因此每一筆線條都能完整傳遞給切割機](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

往下捲動,鏡頭會拉遠穿過實際的幾何圖形:七條路徑,完全沒有像素,每一筆線條在任何縮放比例下都毛髮般銳利。這就是切割機讀取的同一份檔案。
:::

## 動態 SVG

動態工具(Animated Ad、Lottie Ad)可匯出**動態 SVG** - 一種自成一體的*向量*動畫。與 GIF/APNG/WebP(逐格取樣為像素)不同,動態 SVG 是以內嵌 CSS 關鍵影格堆疊向量快照,因此**可縮放至任意尺寸,不需要編解碼器,也不需要外部執行環境** - 在瀏覽器分頁或 `<img>` 中即可循環播放。文字仍保持輪廓化,因此在任何地方都能正常呈現。它沿用動態格式共通的**時長**/影格率控制項,且(因每格比點陣圖更重)預設影格率較低。

## 透明度

支援透明度的工具會提供**透明背景**切換開關(例如*無背景*)。PNG、WebP、AVIF、SVG(靜態與動態)、APNG 與 Animated WebP 都能保留透明度。JPG 與 PDF 一律不透明,TIFF 則會壓平為白底(在 HDR 路徑下為黑底 - 見下文)。

## 色彩空間

這是兩個不同的問題,值得分開來看:Lolly 能**讀取並用以思考**的色彩空間,以及它實際**寫出**的色彩空間。

**讀取。**無論顏色寫在何處 - 工具的樣式表、匯入 SVG 的填色、設計權杖的值,或 CSS 簡寫中的陰影或漸層 - Lolly 都能讀取完整的 **CSS Color 4** 詞彙:`#hex`、`rgb()`、`hsl()`、`hwb()`、`lab()`、`lch()`、`oklab()`、`oklch()`、CSS 具名顏色,以及預定義色彩空間中的 `color()` - `srgb`、`srgb-linear`、`display-p3`、`a98-rgb`、`prophoto-rgb`、`rec2020`、`xyz-d50`、`xyz-d65` - 包括以 `none` 關鍵字寫出的分量。整個平台由同一套剖析器處理,因此瀏覽器與每個匯出走查器對顏色字串的解讀完全一致。

這一點的重要性超乎表面,因為瀏覽器會把現代 CSS 解析成現代 CSS。寫下 `color-mix(in oklab, …)`,Chrome 就會計算出 `oklab(…)`;以 `oklch()` 儲存的品牌權杖,匯出走查器看到的就是這個字面值。這些形式的顏色會被正確讀取,而不是遭到捨棄 - 過去只認得 `rgb()` 的走查器就會把品牌色文字匯出成黑色、遺失帶色調的面板與表格線,並把 `oklch(0.7 0.1 200) 0px 2px 4px` 誤讀成 0.7 乘 0.1 的陰影偏移。

**運作原理。** 色彩運算是以知覺方式進行,而非直接處理原始色版。調色盤推導、漸層、和諧配色與對比度計算都在 **OKLCH/OKLab** 空間中執行,超出色域的色彩會透過 CSS Color 4 自身的色域對應演算法——以知覺距離檢查為基礎的彩度縮減——拉回範圍內,而不是直接裁切色版,因此鮮豔的色彩會落在你實際能接受的最接近色彩上,而不是被壓平的顏色。漸層會在你選擇的色彩空間中插值(預設為 OKLab,亦可選 `oklch`、`lab`、`lch`、`srgb`、`srgb-linear`、`hsl`,極座標色彩空間還可指定色相方向),混色則採用**預乘**方式,因此漸淡至透明時色彩仍會保持正確,而不會在過程中逐漸偏暗至黑色。預覽與匯出的算繪路徑共用同一套插值器——這正是為何錐形漸層不會在螢幕上與匯出檔案中呈現不同的混色結果。

**寫出。**輸出刻意比輸入窄,因為檔案必須能被開啟它的軟體正確讀取,而色彩空間只有在數值真正轉換過去時,才會在輸出中被*宣告*。螢幕與網頁格式會寫成 **sRGB** 並標記為 sRGB;印刷格式會以命名的印刷條件(見下文)寫成 **CMYK**;HDR 路徑則是 **Rec.2100 PQ**(見上文)。廣色域的顏色若匯出,會被對映進 sRGB,而不是被錯誤標記 - 把 `color(display-p3 …)` 原封不動帶入向量檔是規劃中的擴充功能,並非目前匯出流程宣稱能做到的事。以 OKLab 編寫的漸層在輸出時會被*烘焙*成純 sRGB 色標,只有在 sRGB 會明顯偏離知覺曲線之處才插入額外色標,因為 SVG 的 `<linearGradient>` 與 PDF 的軸向網紋都沒有可以承載內插空間意圖的設定。同一組編寫的值,三種渲染器,結果毫無偏差。

## 色彩設定檔

為了讓顏色在具色彩管理的應用程式(印刷廠、Photoshop、瀏覽器)中忠實重現,匯出檔案會**標記色彩設定檔**:

- **PNG / JPG** 內嵌 **sRGB** ICC 設定檔 - 也就是預覽實際渲染所用的色彩空間 - 因此不需要猜測。(僅為標記;像素本身不會重新編碼。)
- **印刷用 PDF(CMYK)**會在其 *OutputIntent* 中宣告目標**印刷條件**(預設為 *Coated FOGRA39*),告知 RIP/印刷廠應如何解讀其 CMYK 油墨。具有實測油墨值的品牌色票會精確轉換;其他顏色則使用標準裝置轉換。這項宣告只是一個*名稱*:Lolly 本身不隨附任何 CMYK 設定檔,而 PDF/X-4 要求內嵌設定檔,因此命名的印刷條件只會寫出輸出意圖,而不會宣稱符合 PDF/X-4 規範。若你自行載入 CMYK 設定檔,並在色彩設定檔控制項中選擇其**內嵌**選項,該設定檔就會作為檔案的 *DestOutputProfile* 內嵌其中 - 此時 PDF 才能真正符合 PDF/X-4,並在檔案其餘部分允許的情況下加以宣稱。有三種情況會保留輸出意圖(RIP 仍需要它)但撤回這項宣稱:CMYK 轉換流程無法轉換的 RGB 美術稿、`prov` 校樣邊界的信用文字(以未內嵌的標準字型繪製,而 X-4 對此並無例外),以及**強式**密碼(因為 X-4 禁止加密)。它所宣告的條件,便是從該設定檔讀出:設定檔能證明的情況下用一個已註冊的名稱,無法證明時則以該設定檔自身的名稱標為 `Custom`,因此檔案絕不會標榜某一種印刷條件,實際承載的卻是另一種的測量值。
- **印刷用 TIFF(CMYK)**寫出未標記的 **DeviceCMYK** 像素,並在其 TIFF 中繼資料(*ImageDescription*)中以出處形式記錄相同的印刷條件,而非內嵌設定檔。同一個色彩設定檔控制項驅動這兩種 CMYK 格式 - TIFF 完全無法內嵌印刷設定檔,因此**內嵌**選項只會在此記錄該設定檔本身的名稱,僅此而已。
- **TIFF(RGB)**是純粹、未壓縮的 sRGB 版本 - 以所選 DPI 提供無失真點陣圖,供封存或編輯軟體來回使用,出處記錄在同一份 TIFF 中繼資料中。任何透明度都會壓平為白底(此設定檔不帶 alpha)。與 CMYK TIFF 一樣僅限桌面版,因為瀏覽器無法預覽 TIFF,行動裝置下載也會卡住。
- **SVG**、**EMF**、**EPS** 與 **DXF** 是與解析度、設定檔無關的向量格式,不內嵌設定檔 - SVG 的顏色是純 sRGB,EMF 與 EPS 的則是裝置 RGB(**EPS(CMYK)**寫出的是原始 DeviceCMYK),**DXF** 則對應至最接近的 AutoCAD 色彩索引。(SVG、EPS 與 DXF 和 PDF 一樣,都會把文字輪廓化為向量路徑,因此即使未安裝該字型,結果仍能正常呈現。EMF 則預設保持文字為「即時」狀態 - 真正的中繼檔文字記錄,在 Office 與 Google 簡報中仍可選取、可編輯,只有格式無法表達的文字才會退回輪廓;匯出面板的「文字轉外框」選項會強制所有文字都轉為路徑。)**SVG** 也會重現 HTML 中的 CSS `box-shadow` - 每個外陰影都繪製在方塊後方,依偏移/擴散並套用高斯模糊以符合瀏覽器呈現,內陰影則以相同方式繪製在方塊內側。

這是自動進行的 - 沒有可調整的設定。縮圖與預覽會略過此標記以保持檔案輕巧。有一種設定檔*是*需要選擇的,因為它會改變像素本身而不只是標記 - 見下方**HDR**。

## HDR(高亮色彩)

一般匯出是 sRGB:白色就是白色,飽和的品牌色亮度也僅止於螢幕一般白色的亮度。在支援 HDR 的螢幕上,這之上還有很大的餘裕空間,匯出面板中的 **HDR** 卡片正是運用這點 - 你的品牌色與白色文字會被提升至接近峰值亮度,讓它們真正*發光*,同時暗部維持深沉,為這種光暈提供對比。

![匯出面板中已開啟的 HDR 卡片,底下展開了白點/延伸範圍/暗部提升/聚焦這幾個轉盤](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **格式。** 具備承載訊號能力的點陣格式:**PNG**、**JPG**、**AVIF** 與 **TIFF**。(不含 WebP - 它是 8 位元格式,沒有可用的 HDR 解碼路徑,PQ WebP 只會顯得偏暗。向量與 PDF 則完全沒有 HDR 模型。)
- **預設關閉**,與色彩標記不同 - 它會改變像素本身,因此屬於選擇性加入。勾選該卡片,或在分享連結中加上 `hdr=1`。
- **實際寫入的內容。** 像素會重新編碼為 **Rec.2100 PQ** - 採用 BT.2020 原色與 SMPTE ST 2084(PQ)轉換曲線 - 容器同時帶有相符的訊號,讓具色彩管理能力的應用程式知道該以此方式讀取:產生一份**內含 `cicp` 標籤的 ICC v4 描述檔**(JPG、TIFF)、一個 **`cICP` 區塊**(PNG),或改寫過的 `colr` box(AVIF)。此增強效果以**感知(OKLab)明度**為閘門,因此中間至偏亮的顏色會被推向峰值,暗部則是被緩和而非過曝,並且會保留色相 - 品牌綠色只會變得更亮,不會偏向薄荷色。
- **可調參數。** 卡片開啟後會顯示四個:**White**(峰值亮度上限,400–2000 nits)、**Reach**(光暈向暗部延伸的程度)、**Dark lift**(暗部提亮的幅度 - `0` 表示維持暗部不變)與 **Focus**(增強效果保留的色彩豐富度)。這些會併入同一個參數,以精簡的調校值表示 - `hdr=1600-60-0-50` 即 White 1600、Reach 60、Dark lift 0、Focus 50 - 因此調校好的效果可直接從連結重現。
- **可以看到效果的地方。** HDR 顯示器上具色彩管理能力的檢視器:Apple 裝置上的 Preview／Quick Look／Safari,或 HDR 螢幕上的 Chrome。在一般 SDR 螢幕上,檔案仍會顯示為普通影像。
- **上線前應了解的事。** 許多平台會**重新編碼**你上傳的內容並剝除 HDR 訊號 - 社群網路、通訊應用程式、部分 CMS - 這可能讓影像看起來偏暗或褪色。請在你能掌控輸出端的情境下使用 HDR(自建網站、影音牆、明亮面板上的簡報),而非當作所有情況的預設值。
- **透明度。** PNG 與 AVIF 會保留 alpha;JPG 則一如既往不透明。**TIFF** 路徑會以**黑色**做為平面化背景,而非 SDR 路徑所用的白色 - 在 PQ 中,白色對應的是 10,000 nit 的編碼值,若以此平面化,每個邊緣都會出現刺眼的暈光。
- **從終端機輸出相同的位元組。** 在 [CLI](/info/cli.html) 中搭配 `--export=png` 或 `--export=jpg` 使用 `--hdr=1`,同樣會寫出 16 位元的 Rec.2100 PQ PNG,以及符合 ISO 21496-1 的增益圖(gain-map)JPEG,兩者都出自同一套引擎編碼器而非瀏覽器 - 因此一個原生 `<svg>` 工具能在完全不經過 Chromium 的情況下產生 HDR 檔案,且此 PNG 與網頁版輸出的位元組完全相同。AVIF 與 TIFF 目前仍僅限網頁版匯出。

## 影片

動態工具會以 **MP4**、**WebM** 或 **GIF** 匯出動態內容 - 若有提供的話,也包括 **APNG**、**Animated WebP** 或前述的向量**動態 SVG**。你看到哪些影片容器,取決於你的瀏覽器 - 選單只會顯示它實際能錄製的格式:

| 瀏覽器 | 顯示 |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 與 WebM** |
| 較舊版 Chrome | **WebM** |

GIF 在任何地方都能運作(很適合聊天/電子郵件用途;檔案較大且色彩數較低於影片)。動態工具還提供**等待**(錄製前讓動畫穩定下來的秒數)與**時長**(片段長度)選項。

> 若分享的 `?format=…` 連結要求的容器格式是你的瀏覽器無法錄製的,會自動改用另一種格式,並依此為檔案命名。

**聲音。**影片匯出並非無聲。工具可以在片段下方鋪上**配樂**(catalogue 中的音訊素材,循環或裁剪至片段長度,並可設定漸入/漸出、音量,以及在畫面自帶聲音時自動閃避降低配樂音量) - 錄製類工具也會將其畫面的即時音訊原封不動帶入檔案。**MP4** 與 **WebM** 會保留混音後的音軌;GIF 與動態圖片格式(APNG、Animated WebP、動態 SVG)本質上是無聲的。

## 音訊

部分工具可**單獨匯出音訊**,不只是作為影片音軌。**Voice Recorder** 會透過即時電平表與溫和的引導錄下麥克風錄音,再儲存為 **MP3**(預設,於瀏覽器中轉碼)或其原生容器格式 - **M4A**(AAC)、**OGG** 或 **WebM**(Opus),依你瀏覽器錄製的格式而定。與其他一切相同,編碼過程都在你的裝置上進行 - 不會上傳任何內容。

你*匯入*的音訊涵蓋範圍同樣廣泛。素材選取器接受 **MP3**、**WAV**、**OGG**/**Opus**、**M4A**/**AAC** 與 **FLAC**(逐位元組保留並於裝置端解碼)、**MIDI**(`.mid` - 匯入時會轉換為裝置端小型合成器音軌)以及**追蹤器模組(tracker modules)** - **MOD**、**XM**、**IT**、**S3M**、**STM**、**MTM**(由內建播放器於裝置端解碼,曲目資料僅數 KB)。以上任一種都可作為影片匯出的**配樂**,或在 Neurospicy Mode 的環境音樂播放器中播放。

音訊確實是下方 `format=` / `--export=` 流程的一部分:`wav`、`mp3`、`m4a` 與 `opus` 都是一般的格式 id,因此純音訊匯出與 PNG 一樣易於分享、易於腳本化。輸出的只有聲音,沒有畫面。

## 出處與浮水印

只要格式支援,匯出檔案就會攜帶**出處中繼資料** - 軟體、來源、工具名稱與你的個人資料署名 - 以原生方式內嵌(PNG iTXt、JPEG EXIF、PDF info、SVG `<metadata>`、GIF comment)。這僅涉及著作權歸屬,不會上傳任何內容。**實驗性**工具還會額外加蓋可見浮水印,由主機端套用,因此無法透過編輯工具本身來移除。

**Lolly Imprint。**點陣圖匯出還會攜帶 Lolly 自家的**隱形像素浮水印** - *Lolly Imprint* - 與 Content Credentials 一樣**預設開啟**。憑證與出處中繼資料是隨像素一起*附帶*傳遞,一旦重新儲存、截圖或剝除中繼資料就會遺失,而 Imprint 則存在於像素*本身*之中,能挺過重新壓縮 - 因此影像的副本日後仍可被辨識出是 Lolly 製作。這是一種持久的線索,而非密碼學上的保證,且僅代表「存在與否」(不攜帶任何個人資料)。它適用於 **PNG、JPG、WebP、AVIF、TIFF 與 BMP**,以及合成進 **PDF 或 PPTX** 中由 Lolly 渲染的點陣圖 - 絕不會出現在*你*自行內嵌的圖片中,只會出現在 Lolly 自身渲染的內容裡。在匯出面板取消勾選 **Lolly Imprint** 卡片即可略過此步驟,或在分享連結中傳入 `imprint=0`。(AVIF 在重新編碼後的存活率尚未經過校準;PDF/PPTX 偵測涵蓋內嵌的 Lolly 點陣圖。)[/verify](/verify) 可在裝置端偵測它 - 參見 [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint)。

**持久憑證。**在 Imprint 之外,還有第二種較重的標記:**Durable credential(持久憑證)**,它使用裝置端的神經網路模型(TrustMark 格式)將 Lolly 的 id 寫入像素本身,讓「以 Lolly 製作」這個連結能挺過剝除中繼資料、重新編碼,並可被支援 TrustMark 的工具(不只是 Lolly 自己)重新讀出。它**預設關閉** - 與純 JavaScript 實作的 Imprint 不同,每次匯出都需要一次神經網路運算,加上一次性的模型下載,因此屬於刻意選擇加入,而非默默增加的成本。僅限點陣格式(**PNG、JPG、WebP、AVIF、TIFF**),可在匯出面板中勾選,或於分享連結中傳入 `durable=1`。在桌面版與行動版應用程式中,由於離線時沒有來源可下載模型,這張卡片會直接隱藏,而不是顯示成一個無作用的選項。

**內容保護。**在匯出面板中,*密碼保護*、**C2PA Credentials**、**Lolly Imprint** 與 **Durable credential** 會摺疊進同一個依格式而定、預設收合的**內容保護**群組,讓檔案的出處與保護選項集中於一處 - 該群組只會顯示適用於所選格式的卡片,若沒有任何一項適用則整個群組都會隱藏。印刷標記刻意*不*放在其中:它們屬於印前製作的幾何資訊,而非保護機制,因此**印刷標記與出血**——以毫米為單位的出血量,加上裁切線、對位線、出血、色彩導表與印刷說明——在印刷格式上仍保有自己獨立的頂層卡片。

![在 PNG 匯出中展開的內容保護群組,僅顯示適用於該格式的卡片](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**匯出前(印前檢查)。**在你個人資料的功能旗標中開啟**印前檢查**(`export-preflight`) - 它**預設關閉**,因此僅是想匯出一張 PNG 用於聊天訊息的個人使用者,絕不會被印前檢查的結果嚇到;而部署端的控制平面([lolly.work](https://lolly.work))則可為其成員將此功能預設開啟 - 只要印刷規則對這項工作有具體意見要說,面板底部、按鈕正上方就會出現一張**匯出前**卡片:格式、尺寸與出血,接著是裁切與出血區域、油墨覆蓋率、印版數量與頁數,標題旁附上結論。它排在所有設定之下,因為它是針對這些設定的一段*陳述*,而不是另一項設定本身 - 而且它從不會阻擋匯出。它只是告訴你,印刷廠即將看到什麼。

**成本,依你的價目表算出。**在印前檢查卡片下方——所有卡片中的最後一個,仍位於按鈕上方——有一張卡片會把同樣的計數換算成金額,而且僅會使用他人提供給它的價格。它會讀取印前檢查流程所計算出的一切,無論印前檢查卡片本身是否開啟,並且需要兩個條件同時成立:這項工作有價目表能夠計價的內容(印版、印張、面積、頁數、變體列或輸出檔案——因此一張單純的標誌 PNG 絕不會顯示這張卡片),**而且**存在一份**價目表**。價目表是一份來自你印刷廠的 JSON 價格清單。預設建置版本不隨附任何價目表,應用程式內也沒有載入方式:它只能透過部署所提供的目錄素材,或透過自架站或控制平面所啟用的選用價目表擴充功能取得。若沒有價目表,就什麼都不會顯示——不會出現提示,也不會出現空白表格。

整個機制所依循的原則是它**絕不憑空生出金額**。每個數字都是你提供的單價乘以 Lolly 計算出的數量 - `4 個印版 × €35.00` - 而總額會在同一句話中說明其自身來源:價目表所標示的發行者,以及該價目表宣稱的價格日期。沒有預設幣別,沒有佔位符,也沒有以零代替缺漏的價格。檔案自身所陳述的內容,始終以轉述語氣呈現:*「檔案表示:… Lolly 尚未驗證此資訊。」*

當它無法誠實算出結果時,運算表格會**直接消失**,而不會退化成灰階或填入湊數的數字:

- 卡片無法計價的項目代表**完全沒有總額** - 只會顯示一則標題,說明有多少項目未計價。部分加總並不是一個較小的答案,而是一個錯誤的答案。
- 屬於上限而非精確計數的數量,會將**「最多」**帶入其小計中,因此一個範圍上限絕不會被漂白成一個確切的數字。
- 已過有效期限的價格只會顯示**數量**,直到你按下*仍要使用這些價格*為止——按下後,到期日會與該數字一同顯示,因此過期的總額不會被誤讀成當前有效的金額。
- 透過**連結**開啟時,金額會保持隱藏,直到你在這台裝置上主動要求顯示為止。無論是卡片本身,還是這個顯示動作,都絕不會透過網址傳遞——這也是為什麼 CLI 是以 `--rate-card=<file.json>` 這種本機檔案旗標接收價目表,而不是作為連結參數。

這張卡片屬於介面元件,絕非內容本身:它會從每個匯出階段中被剝除,因此不會影響你下載檔案中的任何一個像素。它是算術結果,不是報價——只有你的印刷廠才能給你真正的報價。

**合成渲染。**當一個工具內嵌另一個工具的輸出(例如 *Event Name Badge* 內嵌一個 *QR Code*)時,巢狀渲染會被內嵌進母項的匯出結果中 - 在 SVG 與 PDF 中仍保持**真正的向量**形式,在 PNG/JPG/WebP 中則清晰地點陣化。被內嵌的子項只是一個中介產物:它*不會*帶有自己的浮水印,也*不會*帶有自己的出處資訊;只有最終完成的母項素材才會有。(合成功能涵蓋 SVG 與點陣格式;HTML/MD/TXT 無法被合成。)

## 密碼保護

兩種各自獨立的鎖定機制，皆完全在裝置端進行。

**PDF 開啟密碼** - 匯出面板的 *密碼保護* 卡片提供兩種等級：

![在 PDF 匯出中展開的密碼保護卡片，內含密碼欄位與兩種鎖定等級](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - 基本的 40 位元鎖定 (RC4)。可在*任何* PDF 應用程式中開啟，且 - 因為只是輕度嚇阻，並非真正的保護 - 它可能出現在分享連結中（依設計以明文形式傳送）。僅限 RGB `pdf`。
- **Strong** - AES-256（PDF 2.0）。其密碼於匯出時輸入，**絕不會**放入連結中；僅能在較新版的 PDF 應用程式中開啟（Acrobat / Preview 約 2018 年後的版本），較舊的應用程式可能會回報檔案已損壞。Strong 也適用於**印刷用／CMYK PDF**以及**批次 zip 內的每個 PDF**（批次確認對話框會收集密碼）。由於 PDF/X-4 禁止加密，以 Strong 鎖定的印刷用 PDF 會保留其 CMYK、印刷標記與輸出意圖，但會失去 PDF/X-4 合規聲明。

任一等級皆與 Content Credentials 互斥（加密的 PDF 無法附加憑證）。

**鎖定下載（整個 zip ＋縱深防禦）** - **ZIP** 匯出（匯出面板的 *ZIP* 格式，會將工具的多種格式打包在一起）、**資料夾**下載（Projects → Download）或**批次網格**都可用單一密碼鎖定整個 zip，分為兩種等級：

- **Standard** - 傳統的 **ZipCrypto**：可在*任何*解壓縮工具中開啟，包括 Windows 檔案總管內建的解壓縮功能，但強度較弱（僅作嚇阻）。其密碼可能出現在 `?password=` 分享連結中。
- **Strong** - **AES-256**（WinZip AE-2）：強度高，但**無法**在 Windows 檔案總管內建的解壓縮功能中開啟 - 收件者需要 7-Zip / WinZip / Keka / macOS。於匯出時輸入，絕不會放入連結中。

匯出面板中同一張 *密碼保護* 卡片同時驅動 PDF 與 ZIP 的鎖定，會依所選格式改變措辭。同一組密碼會保護**所有**成員 - 圖片、SVG、一切內容，包括 PDF（只有 zip 容器能保護非 PDF 檔案，因為它們本身並無鎖定機制）。而且這是**縱深防禦**：其中任何 PDF *也會*以相同密碼個別以 AES-256 鎖定，因此即使 zip 被解開，PDF 仍保持鎖定狀態。此提示會在你開始下載時出現；密碼留空即代表不鎖定。

**密碼保護的分享連結** - 任何分享連結都可以加密，讓開啟連結時要求收件者輸入密碼。整個連結狀態會以由密碼衍生（PBKDF2）的金鑰進行 AES-256 加密；只有密文會被傳送，因此**密碼絕不會出現在連結中**，且解密發生在**收件者的瀏覽器內** - 提供此連結的伺服器只會看到 URL 中的密文，永遠看不到密碼，也看不到解密後的設計內容。可在**Share**對話框中開啟此功能。加密連結只能在 Lolly 中*開啟*（無法嵌入為圖片，因為該路徑無法提示輸入密碼）。詳見 [URL Mode → Encrypted links](/info/url-mode.html)。

## Content Credentials (C2PA)

匯出檔案可以攜帶**Content Credentials** - 一份內嵌於檔案中、經過簽署的 [C2PA](https://c2pa.org) 資訊清單，以防篡改的方式記錄此檔案是由 Lolly 製作，且自此之後未曾遭到變更。這是上述來源中繼資料的標準化版本：一項密碼學宣告（何物製作了此檔案、何時、由誰、於何處）與檔案位元組的雜湊值綁定，因此任何後續編輯都能被支援 C2PA 的檢視工具偵測出來。此標準由 [Content Authenticity Initiative](https://contentauthenticity.org)（Adobe、BBC、Microsoft、Nikon 等）主持，因此 Lolly 所寫入的憑證，正是相機、新聞編輯室與創意軟體套件正在採用的同一套憑證。

![已預先勾選的 C2PA Credentials 卡片，旁邊顯示憑證有效期限](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **格式。** 所有支援 C2PA 內嵌的容器：**PDF**（RGB 與印刷版皆可）、**PNG／動態 PNG**、**JPG**、**GIF**、**SVG**、**TIFF**（RGB 與印刷版）、**WebP**（靜態與動態）、**AVIF**、**MP4**、**WebM**，以及音訊容器 **MP3**、**WAV**、**M4A** 與 **OGG/Opus** - 因此錄製或合成的語音檔案，也能與圖片一樣攜帶相同的憑證。**ZIP** 打包檔會為每個支援的成員個別加註標記，**動態 SVG** 也是透過這個方式取得憑證的（其底層本質上是一般的 SVG 文件；直接匯出動態 SVG 並無專屬卡片）。MP4、AVIF 與 M4A 使用規格中的 BMFF 綁定，MP3 則使用其 ID3v2 對應方式，因此 `c2patool` 及其他支援 C2PA 的檢視工具可以驗證它們；**WebM** 與 **OGG/Opus** 目前尚無標準化的 C2PA 對應方式，因此 Lolly 分別以 Matroska 附件與 OpusTags 欄位承載資訊清單，並由 Lolly 自身的驗證工具（以及 CLI）進行檢查。（`ico`、`eps`、`emf`、`dxf`、`bmp`、`pptx`、Office 格式以及文字／資料格式皆無 C2PA 容器。）
- **預設開啟。** 匯出面板中的 **C2PA Credentials** 卡片，在幾乎所有工具中都會預先勾選 - 取消勾選即可在單次匯出中略過憑證（或在分享連結中加上 `c2pa=off`）。工具也可以在其資訊清單中完全選擇不採用。
- **記錄的內容。** 製作此檔案的工具與應用程式、簽署時間、匯出環境（瀏覽器引擎家族＋作業系統家族 - 刻意保持粗略，絕非指紋辨識），以及 - 僅在*Profile → Use my details* 開啟時 - 你的姓名與電子郵件，作為此作品的作者。
- **收件者看到的內容。** 具備檢視 Content Credentials 功能的工具（Adobe 應用程式、`c2patool`、contentcredentials.org/verify）會讀取資訊清單並顯示相關宣告。由於 Lolly 使用**在你裝置上**產生的金鑰進行簽署 - 而非來自信任清單的憑證 - 檢視工具會將其回報為*未經驗證*的憑證。其結構與防篡改機制皆為真實，只是簽署者身分未經權威機構背書。若要升級這一點，你可以註冊**已驗證身分**（Profile → Content Credentials）：Lolly CA 核發的短效憑證會將你的電子郵件與你的匯出檔案綁定，而簽署金鑰依然永遠不會離開你的裝置 - 詳見 [Content Credentials Identity](/info/content-credentials-identity.html)。
- **檢查檔案。** Lolly 也會驗證自己所發出的憑證：將任何檔案拖放至 [/verify](/verify)（或在 CLI 中執行 `lolly validate <file>`），即可取得裝置端報告 - 首要呈現此檔案是否確實由 Lolly 製作、且自此之後未曾變更。網頁版 Verify 檢視畫面所讀取的內容遠不止憑證本身：它會標記**AI 生成內容**、偵測 **Lolly Imprint**、檢查 **SEAL** 簽章與（選擇性開啟的）第三方像素浮水印，並揭露**隱藏資料** - 全部皆在裝置端進行，不會上傳任何內容。詳見 [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows)。
- **隱私。** 一切都在你的裝置上完成：簽署金鑰是為此次匯出而產生，且永遠不會離開瀏覽器，不會上傳任何內容，而且此宣告只包含來源中繼資料原本就攜帶的資訊。隱私工具（對*你自己*檔案進行的裝置端轉換）絕不會加入憑證，而*Strip Hidden Data* 會像移除其他內嵌中繼資料一樣，移除 C2PA 資訊清單。
- **互動關係。** 對於 PDF 而言，Content Credentials 與**密碼保護**（任一等級 - 見上文）互斥（加密的 PDF 無法附加憑證）。憑證會在完成的位元組上以最後一個步驟加入 - 於 DPI／EXIF／色彩描述檔標記、PDF/X 中繼資料與印刷標記之後。

## 在手機上

匯出控制項位於浮動的 **Render** 按鈕之後，點選後會開啟 **Export** 面板 - 同樣的格式、尺寸、複製、下載與分享選項，尺寸則為觸控操作而設計。

## 格式參考

依類別列出主機可以轉譯的每一個 id。這些同時也是 URL `format=` 參數以及 CLI `--export=` 旗標的可用值 - 詳見 [URL Mode](/info/url-mode.html) 與 [CLI](/info/cli.html)。每個工具只會提供其作者所宣告的子集，因此選單一定會比這份清單短。

| 類型 | 識別碼 |
|---|---|
| 點陣圖 | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff`(RGB TIFF)· `cmyk-tiff`(Print TIFF)· `bmp` · `ico` |
| 向量 | `svg` · `svgz`(gzipped SVG)· `emf` · `wmf` · `eps` · `eps-cmyk`(EPS CMYK)· `dxf`(切割檔) |
| 頁面與文件 | `pdf` · `pdf-cmyk`(Print PDF)· `pptx`(PowerPoint)· `scorm`(SCORM 課程套件,為 zip 檔)· `penpot`(Penpot 設計檔)· `docx`(Word)· `odt`(OpenDocument Text) |
| 動態 | `gif` · `apng`(Animated PNG)· `webp-anim`(Animated WebP)· `svg-anim`(Animated SVG)· `webm` · `mp4` |
| 音訊 | `wav` · `mp3` · `m4a` · `opus` |
| 文字與資料 | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl`(GIMP 色盤) |
| 套件包 | `zip` |

還有少數幾個 id 是來自**工具自身的匯出掛鉤**，而非共用的轉譯路徑：`ase`（Adobe Swatch Exchange，來自 Palette Lab）、`exr` 與 `hdr`（Darkroom 的高動態範圍點陣圖），以及 `ttf` / `otf` / `woff`（Font Convert）。它們選取格式的方式相同 - 選單、`format=`、`--export=` - 只是其位元組由該工具自行建立。Font Convert 是唯一的例外：它轉換的是*你*提供的字型檔案，因此單純的 URL 沒有任何內容可供轉譯。
