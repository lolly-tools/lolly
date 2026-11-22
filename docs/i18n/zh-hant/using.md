# 使用 Lolly

開啟工具、調整它開放的部分、儲存結果，再以連結或檔案分享。

所有功能都在你的裝置上執行，不需要帳號。下載所需工具與素材後，離線也能運作。啟動應用程式需要支援 WebGPU 的瀏覽器或應用程式。[支援的環境](/info/supported-environments.html)列出已通過測試的環境。

**操作循環**分為四個步驟：

::: steps
- <!--i:eti-home--> **[開啟工具](#find-your-way-around)** 點擊首頁上的卡片。控制項位於即時預覽旁。
- <!--i:eti-sliders--> **[更改輸入](#change-what-the-tool-lets-you-change)** 只更改作者開放的輸入。點擊設計即可找到對應控制項。
- <!--i:eti-folder-plus--> **[儲存作品](#saving-continuing)** **Save** 將作品保存在 My library，再從 Projects 重新開啟。
- <!--i:eti-link--> **[分享設計](#sharing-your-work)** 使用帶有每個輸入的連結，或單一 `.lolly` 檔案。
:::

<!--i:eti-home-->
## 熟悉環境

::: figure using-app-map
首頁頂端排列四個分頁，底部有一條列。開啟工具後，控制項會與即時預覽並排顯示。
:::

首頁頂端排列四個分頁：**Tools**、**Utilities**、**Assets** 與 **Projects**。Tools 是用來製作的工具。Utilities 用來轉換、檢查或清理檔案。Assets 是你的資料庫。Projects 保存已儲存的內容。

底部列提供 **Open**、**Settings**、搜尋欄位、前往 Lolly Verify 的 **Verify** 捷徑，以及開啟這些指南的 **Docs**。這條列會顯示在 Tools、Utilities、Assets、Projects、Settings 與應用程式內的指南中，開啟工具後便會隱藏。[Lolly Search](/info/search.html) 可從該欄位搜尋工具、已儲存的作品、素材與設定。[Ask Lolly](/info/ask.html) 則以指南中相符的章節回答你輸入的問題。

點擊卡片即可用該工具開始新作品。已儲存的作品可從 **Projects** 重新開啟。初次造訪時，工具庫頂端的歡迎橫幅會提供一個起始動作：在 Lolly Demo 下按 **Start making**，或按 **Make it yours** 設定自己的設計系統。

![提供範例導覽與 New 動作的工具庫卡片](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

每個工具都採用分割檢視：一側放置**控制項**，另一側顯示即時**預覽**。調整控制項時，預覽會隨即更新，看到的內容就是匯出的結果。

![工具的分割檢視：左側排列控制項，右側即時繪製分組長條圖](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** 則是例外：它提供自由畫布，上面的方塊可以拖曳、調整大小與輸入文字，另有專屬的頂端列、時間軸與簡報控制項。操作方式請見 [Lolly Design：自由畫布](/info/design.html)。

<!--i:eti-sliders-->
## 更改工具開放的部分

工具只顯示預定可變動的輸入。作者已固定色彩、版面、字型與邏輯，讓作品遵守其規則。輸入包含文字、滑桿、色彩選擇器、下拉選單、日期、圖片選擇器與重複的列群組。其中一些位於可摺疊的區段內。

![工具的控制項堆疊：文字欄位、色彩觸發器與滑桿，作者鎖定的其他項目都不會顯示](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**點擊設計，找到對應控制項。** 點擊預覽中的元素，對應控制項就會捲動到可見範圍並取得焦點。若是重複的列群組，點擊的那一列會展開。

**Clear changes** 位於控制項上方，會將所有輸入還原為預設值。

**設計系統選項。** 如果設計系統提供多種配色方案、淺色與深色外觀，或其他主題選項，這些選項會放在控制項下方的 **Design system** 區段。只有會影響此工具的選項才會出現，因此檔案工具不會顯示這個區段。各種配色方案以自身色彩的圓點呈現，淺色與深色是兩個按鈕，其他選項則列成清單。

選擇的設定屬於這件作品，會隨連結與已儲存的工作階段傳遞。連結到設計系統的所有色彩都會依選擇變化，應用程式本身的色彩則維持原樣。在 Lolly Design 中，同樣的選項位於 Inspector 的 **Canvas** 分頁。如果色彩本身就是工具的內容，工具可以維持標準配色方案，此時不會顯示配色方案圓點。[實際使用 Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work)展示配色方案在實際作品中的效果。若要讓應用程式與每件新作品都使用同一種配色方案，請在 **Settings → Appearance** 中選擇（[使用你選擇的配色方案](/info/colourways.html#make-a-colourway-your-own)）。

### 預覽的縮放與平移

- **縮放：** 按住 Cmd/Ctrl 捲動，或在觸控板上雙指縮放，中心位於指標處。使用鍵盤時，`0` 或 `Shift+1` 會符合全部內容大小，`1` 或 `Shift+0` 設為 100%，`Shift+2` 則符合選取範圍大小。指標在編輯區域上方時，`+` / `−` 以指標為中心縮放，否則以檢視中央為中心。
- **平移：** 按住 **Space** 拖曳，或按滑鼠中鍵拖曳。一般點擊仍可用來選取設計中的部分。
- **觸控：** 雙指縮放、拖曳平移，點兩下即可符合大小。
- **縮放 HUD：** 長按角落的 Lolly 漩渦圖示，即可展開 `−`、**Fit** 與 `+`。短按漩渦圖示仍會開啟個人資料選單。

在 Lolly Design 中，**Fit all** 會涵蓋畫板與獨立圖層。手動縮放可低於 20%，直到頁面佔據檢視的一半。縮放下限取一般 Fit 比例的 5% 與絕對縮放比例 2% 之中較小的值。

只要更改輸出尺寸，檢視就會立即回到符合大小的狀態。

![從畫布角落的漩渦圖示展開縮放 HUD：減號、Fit、加號，後方是主題與音效切換，以及移動用的把手](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### 復原與取消復原

**Cmd/Ctrl-Z** 退回一步，**Cmd/Ctrl-Shift-Z**（或 **Cmd/Ctrl-Y**）則往前一步。**Undo** 與 **Redo** 按鈕位於控制項上方，在 Lolly Design 中則位於頂端列。沒有可執行的步驟時，對應按鈕會變灰。訊息會指出每次復原還原的輸入，並提供 **Redo** 按鈕。

- **一次拖曳算一步。** 半秒內重複更改同一控制項，會合併為一步。
- **保留最近 100 步。** 復原後進行新的編輯，會清除往前的堆疊。
- **在文字方塊中**，Cmd/Ctrl-Z 由欄位逐字元處理。滑桿、下拉選單、色彩與開關則由 Lolly 處理。
- **選擇檔案**（使用檔案輸入）不算一步，因為這些位元組僅保留於本次工作階段。

即時[協作](/info/collaborate.html)時，另一部裝置的變更絕不會加入你的復原堆疊。復原功能會保留到你離開工具或重新載入為止。若要找更早的變更，會隨編輯自動儲存的工具會在 **History** 中保留較早的版本（[回到較早的版本](/info/find-your-work.html#go-back-to-an-earlier-version)）。

### 即時攝影機

有攝影機可用時，**Filter** 工具的效果（Halftone、Scanline、Posterize、Voronoi、Duotone、Stretch、Misprint、Dither、ASCII art 與 Glitch）會顯示 **Go live** 按鈕。開啟後，效果會隨網路攝影機的每個影格變化。動態匯出可將結果錄製為 GIF、WebM 或 MP4。影格都在你的裝置上處理。一旦停止或離開工具，就會釋放攝影機。每個圖片選擇器也都有 **Take a photo**，可擷取單一影格。

<!--i:eti-folder-plus-->
## 儲存 & 接續

要保留作品，請按渲染膠囊上 **Export** 旁的勾號 **Save**。新作品會存入 **My library**，已儲存的作品會在原處更新，不會下載任何檔案。匯出面板也提供相同的 **Save** 按鈕。

要指定儲存位置，請按匯出面板中 **Download** 旁的 **Save as**。在 **Save to a project** 下，保留 **My library** 的選取狀態，或選取一個專案（用 **＋ New project…** 建立），再按 **Save**。**Save as a template** 會將設計存成[範本](/info/templates.html)，用來開始新文件。在 Lolly Design 中，**Save as** 位於 Lolly 選單內。手機上則依序按 **•••**、**File menu** 和 **Save as**。

![渲染膠囊的兩個部分：Export 的向上箭頭可開啟匯出面板，Save 的勾號可在原處儲存](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> 按渲染膠囊上的 **Save**，或用 **Save as** 選取專案。
- <!--i:folder--> 項目會存入 **My library** 或你選取的專案。
- <!--i:home--> 之後按左上角的 **Home**，再開啟 **Projects** 分頁。
- <!--i:document--> 開啟項目。所有設定都會還原，讓你繼續更改並再次匯出。
:::

項目會使用你在匯出面板輸入的檔名；若未輸入，則使用工具名稱，例如 **QR Code**。透過 **Download** 取得的檔案是成品副本。日後若要修改，請從 Projects 開啟已儲存的項目。

::: note 儲存的內容留在這部裝置
除非開啟[同步](/info/sync.html)，否則個人儲存的內容會留在這部裝置上，存於當時使用的瀏覽器或應用程式中。
:::

若找不到預期的內容，[尋找並復原你的作品](/info/find-your-work.html)說明了各種情況的處理方式，包括關閉分頁和清除瀏覽器資料。

::: details Lolly Work 的團隊專案（選用）
若你的[組織使用 Lolly Work](/info/organisation.html)，請登入組織的實例，從 **Projects → Team projects** 查看與你共用的工作階段。組織負責設定存取與保留規則，其 Lolly Work 服務則儲存這些工作階段。組織允許即時編輯時，開啟共用工作階段就會加入該階段的即時協作。[一起協作](/info/collaborate.html#collabs-through-lolly-work-optional)說明操作步驟。

你的個人資料庫仍然獨立。在另一部裝置登入後，即可存取團隊作品。個人儲存的內容仍須透過同步或備份才能移過去。
:::

<!--i:eti-link-->
## 分享你的作品

設計可以分享為連結或檔案。匯出控制項的 **Share** 會開啟提供這兩種方式的對話框。在 Projects 中，已儲存工作階段的 **Share link** 會為該階段開啟同一個對話框。將檔案傳送至 Google Drive、Nextcloud、S3 儲存桶、Dropbox 或 OneDrive 後，對話框也能透過該服務建立連結（[匯出檔案](/info/exporting.html#how-export-works)）。

::: cols
## 連結

- 將所有輸入包含在位址中，讓連結重現設計。
- 不包含你從這部裝置加入的圖片與檔案、過長的文字和過大的清單。
- 任何瀏覽器都能開啟，因此連結可以加入書籤、貼上或提交。

## .lolly 檔案

- 包含已儲存的工作階段及這部裝置上的圖片與檔案，也可包含工具和設計系統。
- 除非你選擇納入檔案，否則不會包含授權的目錄圖稿。
- 可在 Lolly 中開啟：按兩下檔案、使用 **Open**，或拖放至應用程式。
:::

### 連結

連結位於對話框上方，旁邊有 **Copy** 和 **QR** 按鈕；後者會以該連結開啟 QR Code 工具。連結下方的 **Link options** 提供：

- **Open in the installed app** 會將連結改為供 Shortcuts、啟動器與自動化使用的 `lolly://` 位址，保留所有參數。
- **Shortest link** 會將較長的設計壓縮為精簡的 token，並顯示減少的字元數。可讀的版本仍可使用。
- **Password-protect this link** 會在你的裝置上用 AES-256 加密連結。密碼絕不會包含在連結中。
- **Pin this tool version** 會加入 `_v` 旗標，使日後的工具更新無法改變連結的渲染結果。
- **When the recipient opens the link…** 可選擇全螢幕、預先展開匯出面板、開啟時下載（`&export`）或複製到剪貼簿（`&copy`）。
- **Copy credit** 會複製附有連結的「Made with Lolly」說明文字，供貼文或投影片使用。

當工具含有姓名等個人欄位時，**Review personal fields** 會排除這些欄位，直到你逐一勾選才納入連結。[URL 模式](/info/url-mode.html)說明連結可包含的所有內容。

**對話框會列明連結無法包含的內容。** Lolly 建立連結時，會統計所有放不進位址的內容。若省略了任何內容，對話框會逐項列出，並引導你使用檔案選項。若連結只是較長，則會顯示較輕微的提示及字元數。

**有些工具以連結作為完整的產品。** Jump Page 將你的連結彙整為可分發的單一頁面，例如個人簡介連結、演講或店面。頁面本身就是連結，因此不需託管，也沒有背後的帳號。訪客會看到全寬頁面，捲動時每個場景呈現一個連結。

![編輯器裡的 Jump Page：頂端為標題場景，下方為各個連結場景](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details 透過 Lolly Work 由組織管理的連結
若分享需要到期日、撤銷功能或密碼，Lolly Work 可為共用工作階段、工具與目錄素材提供受管理的連結。連結會透過組織的服務解析，並遵守組織的存取規則。這些連結與前述自成一體的連結各自獨立。撤銷連結無法收回他人已下載的檔案。[渲染與分享](/info/manage/sharing.html)列出了連結類型和權限。
:::

### .lolly 檔案

**Download .lolly** 位於 Share 對話框的 **Editable file** 區段，會將目前的設計寫入單一檔案。一般的目錄圖稿會連同這部裝置的圖片與檔案一起納入。已過時或無法取得的檔案則保留為外部參照。儲存前，對話框會顯示檔案大小、內嵌與參照的檔案數，以及是否納入工具。若裝置提供分享表單，**Send to…** 會將檔案交給分享表單（AirDrop、Android 分享）。

**Projects** 的資料夾選單中，**Download project (.lolly)** 會將整個資料夾寫入檔案，讓別人接手其中的每個工作階段。Batch 工作階段會被排除，通知會列明排除數量。同一選單的 **Download originals** 會將每個項目各自寫成檔案，包成一般的 zip。

送出檔案前，你要決定三件事：

- **是否納入你的姓名。** 只有[你的個人資料](/info/profile.html)中開啟了 **Use my details to create**，才會寫入姓名、電子郵件與組織。關閉時，檔案只會記錄製作工具為 Lolly 及製作時間。
- **是否納入被保留的圖稿。** 授權圖稿和品牌鎖定的圖稿預設不會納入；已記錄授權但 Lolly 尚無法讀取的目錄作品也一樣。若設計使用了這些圖稿，對話框會顯示數量，並提供 *Download without them* 或 *Include and download*。選擇納入，就會將這些檔案交給開啟 `.lolly` 的人。未記錄任何權利資訊的目錄作品則會一併帶上，對話框會逐一列出，供你在送出前檢查。檔案的 `CREDITS.txt` 列出帶上與未帶上的內容及原因。[創作權利與署名](/info/creative-rights.html)說明相關規則。
- **是否納入工具。** **Include the tool** 會將工具本身的檔案打包，讓設計可在未安裝該工具的裝置開啟。fork 等自訂工具預設勾選，已簽署目錄中列出的工具則預設不勾選。若建置版本沒有已簽署目錄，所有工具都視為自訂工具。

**開啟檔案。** 在桌面與行動應用程式中，按兩下或點按 `.lolly`，選擇 **Open with Lolly**，或透過分享表單傳送給 Lolly。在網頁應用程式中，按 **Open** 或將檔案拖放至 Lolly。無論哪種方式，都會先讀取檔案的 manifest，在寫入任何內容前顯示大小、內容及接下來的動作。

::: warning 安裝工具會執行其程式碼
若檔案內含尚未安裝的工具，**Trust this tool?** 會列出工具及作者，並說明開啟工具會在你的裝置上執行其程式碼。按 **Trust & install** 即可繼續。
:::

若你拒絕，作品仍會存入 Projects，等你加入工具後再使用。目前尚無法用這種方式安裝以模組形式提供程式碼的工具，因此也會以相同方式拒絕安裝。

::: details .lolly 的內容與開啟方式
`.lolly` 是 Lolly 套件的副檔名，其 `format` 欄位位於 `manifest.json`，用來標明內容：

- **共用設計**（`lolly-share`）包含一個已儲存的工作階段、其內嵌檔案，以及仍須透過參照解析之內容的回條。也可能包含工具與設計系統。開啟時會新增專案，絕不覆寫工作階段。
- **共用專案**（`lolly-share`，kind 為 `project`）包含 Projects 中的一個資料夾：其子資料夾、其中每個工作階段及其圖塊，以及歸檔於其中的圖片。開啟時會新增該資料夾的副本。每個工作階段以 `sessions/<key>.json` 傳遞，其圖塊位於 `thumbs/`。早於專案檔案功能的 Lolly 版本會要求你更新。
- **設計系統套件**（`lolly-brand`）包含 token，也可能包含字型、標誌、已發佈版本與保留的資源。開啟套件會新增一個獨立且具名的設計系統，並將其設為使用中。
- **工作區或實例套件**是宣告了工具、目錄素材及選用實例位址的 `lolly-brand`。載入時會取代先前載入的單一工作區覆蓋層，預覽會列出這些影響整部裝置的變更。

完整的裝置備份不使用 `.lolly`，仍是 `LollyTools-….zip`（格式為 `lolly-backup`），並透過 **Settings → Storage → Import data…** 還原。壓縮的工具資料夾也仍使用 `.zip`。[資料傳輸](/info/data-transfer.html)提供格式參考。

`.lolly` 就是一般的 zip。將副檔名改成 `.zip` 即可查看內容。你自己的圖片位於 `assets/uploads/`，目錄圖稿則位於 `assets/catalog/`。`manifest.json` 列出所有檔案，README 則說明這是什麼檔案。

macOS、Windows、Linux、iOS 與 Android 都會註冊這種格式。桌面檔案管理員將其顯示為 Lolly 文件，GNOME Files 也能顯示已儲存工作階段本身的縮圖。從 Lolly Design System Setup 開啟時，若共用設計包含設計系統，會建議使用設計系統動作，但絕不隱藏 **Open shared design**。

在 iOS 或 Android 上，從其他應用程式傳入的文件上限為 48 MB，應用程式會提示這項限制。傳遞時會將位元組跨應用程式邊界複製。Lolly 內的 **Open** 沒有這個上限，較大的套件請使用此方式開啟。

確認後，Lolly 會一次解壓縮並驗證套件。素材存入你的資料庫，依檢查碼比對，讓裝置上已有的檔案直接重複使用。工作階段會以新 id 存入 Projects，因此同一個檔案可以開啟兩次。缺少工具的工作階段會留在那裡等待。超過 100 MB 的檔案會標示為大型檔案；若瀏覽器回報的可用儲存空間不足，預覽也會提出警告。在寫入任何內容前，會先檢查所有納入完整性驗證的部分。損壞的副本會被拒絕，不留下任何內容。
:::

連結和檔案交付的都是快照。若要即時編輯，[一起協作](/info/collaborate.html)介紹了兩部裝置間的私人協作，以及透過 Lolly Work 提供的選用工作協作。

<!--i:eti-images-->
## Assets - 你的資料庫

**Lolly Assets**（`#/a`）提供工具可使用的內容：依種類分組的品牌標誌、圖片、音訊與動態素材，以及你自己的檔案。上傳的內容會儲存在你的裝置。使用 Lolly Work 的組織也能提供遵循其存取規則的共用目錄（[在你的組織使用 Lolly](/info/organisation.html)）。

![Assets 中的品牌色票、字型及你上傳的檔案](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **匯入你的檔案。** 將圖片、SVG、音訊片段、影片、Lottie、PDF 或 PowerPoint 簡報拖放到上傳區，或點擊選取。檔案會立即出現在 Assets 和每個工具的素材選擇器。多頁 PDF 或 `.pptx` 會詢問要保留哪些頁面或投影片，並將每一頁轉成 SVG 素材。在工具內加入的圖片會原封不動地存入 **My images**，因此其 Content Credential 仍可通過驗證。只有非常大的檔案才會詢問是否調整大小。**Settings → Storage** 顯示 **My images** 佔用的空間。除了裝置的儲存容量外，沒有其他上限。要在上傳時移除 EXIF 與 GPS 資料，請在 **Settings → Feature flags** 開啟 **Strip metadata from uploads**。無論開關與否，都會保留 Content Credentials。
- <!--i:star--> **將常用素材加入最愛。** 為素材或品牌色票加上星號，就能將它固定在每個選擇器頂端。
- <!--i:folder--> **整理素材。** 將素材移到其他群組、隱藏不用的共用品牌素材（用 **Show hidden** 再次顯示），或刪除自己上傳的檔案。與 Projects 相同的選取列可對整個選取範圍操作。
- <!--i:layers--> **移除影片背景。** 開啟影片詳細資料，或在素材選擇器的卡片上按右鍵，選擇 **Remove background…**。**On-device model** 可從複雜場景中擷取主體。**Colour key** 可移除綠幕等光照均勻的背景，無須下載。用 **Tolerance**、**Softness** 與 **Spill removal** 調整邊緣。**Resolution**（360、480、720 或 1080p，絕不超過來源解析度）讓你在細節與速度之間取捨。去背結果為含透明度的動態 WebP 或 PNG，存於原檔旁。來源的 Content Credential 會以素材成分的形式隨去背結果保留。[生成一次，渲染一致](/info/ai-features.html)說明為何這仍屬一般編輯。

### 隨處使用你的色盤與字型

Assets 的 **Swatches** 面板顯示品牌的色彩：品牌色、你新增的色彩、色階與光譜。Lolly 為介面保留的角色色彩（文字、表面、邊緣、配色方案主色，以及品牌色的別名副本）收在面板底部的灰色 **Show colour roles** 卡片後。

每種色彩都像其他素材一樣，以卡片呈現。點擊可開啟詳細資料，選取幾種即可下載，或以其他工具可讀取的格式下載整個色盤：

- <!--i:code--> **Design tokens (JSON)**、**CSS variables** 或 **CSS classes**，供樣式表或建置使用。超出 sRGB 色域的色彩會保留廣色域值：CSS 將其設在十六進位值之後，JSON 則同時保留十六進位值、廣色域色彩、CMYK 組成與特別色油墨。
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**，供 Illustrator 或 Photoshop 使用。鎖定 CMYK 組成的色彩會以該 CMYK 色票傳入，特別色油墨會成為具名特別色色票，超出 sRGB 色域的色彩則以 Lab 傳入。
- <!--i:pentool--> **GIMP palette (.gpl)** 供 GIMP 或 Inkscape 使用，以及 **SCSS variables**，兩者都使用 sRGB。

![Swatches 面板：上方橫列五個色盤下載按鈕，下方每個品牌色都是可開啟詳細資料的色塊](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details 選取多種色彩，或查看單一色彩的詳細資料
用各張卡片上的圓點選取色彩：按住 Shift 點擊第二個圓點可選取兩者之間的全部色彩，也可在空隙拖出方框，或在卡片取得焦點時按 Cmd/Ctrl+A。選取列提供相同六種格式的 **Download as…**，以及 **Copy hex** 和 **Favourite**。選擇格式前，選單會列出任何格式都無法容納的色彩（Transparent 沒有色彩）、哪些格式會將廣色域色彩存為 sRGB 備用值（SCSS 與 GIMP），以及哪些格式保留 CMYK 與特別色值（JSON 與 .ase）。在卡片上按右鍵，即可對單一色彩執行相同操作。

色彩詳細資料會用該色填滿預覽，並展開 **Linked values**（CMYK 組成或特別色油墨、為特定色彩空間或印刷機設定的值，以及設計 token）、**Every notation**（十六進位、OKLCH、Display-P3 等表示法，各附複製按鈕）、**Plotted on a colour space**、**Tones** 與 **Readability**。方向鍵可逐一瀏覽色盤，**Copy link** 可分享色彩，**Open in Colour Lab** 則開啟色彩以繼續處理。
:::

**Fonts** 面板列出品牌字型，每款都有 **download**，可在本機安裝或交給印刷廠。

<!--i:eti-grid-->
## 自訂你的格線

- <!--i:star--> **將常用工具加入最愛。** 在卡片上按右鍵並選擇 **Add to favourites**。工具就會以大圖塊顯示在格線上方的橫列中。[你的最愛](/info/favourites.html)介紹這個橫列。
- <!--i:eyeoff--> **隱藏從不使用的工具。** 在卡片上按右鍵，或選取多張卡片，再選擇 **Hide tool**。工具會從格線和格線內的輸入搜尋結果中消失。工具離開格線後，在格線中輸入文字也不再會找到它。末端的灰色 **Show hidden tools (N)** 圖塊可再次顯示隱藏的工具，卡片呈暗淡狀態，各自的選單中都有 **Unhide tool**。隱藏只會改變你的格線，工具仍可透過連結或書籤開啟。
- <!--i:clock--> **優先顯示你的工具。** 當你在三個不同工具中儲存作品後，格線上方會出現 **Yours** 選項晶片列，優先列出你的最愛與最近使用的工具。
- <!--i:sliders--> **依喜好安排版面。** **View options** 可設定版面（**Grid**、**Card** 或 **List**）、卡片大小與密度、排序方式，以及類別篩選器。

![Tools 格線末端顯示出隱藏的工具：暗淡的 Wordmark 卡片旁，是讓它重新顯示的灰色圖塊，目前標示為 Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**同時操作多張卡片。** 勾選各張卡片的核取方塊、在空白處拖出選取方框，或按住 Shift/Cmd 點擊，就會出現列出該檢視可用操作的列：

- **Tools 與 Utilities：** Favourite、Hide、Available offline、**View sessions**（開啟 Projects，只顯示使用這些工具建立的工作階段），以及選取單張卡片時的 Copy link。
- **Assets：** 任何選取範圍都提供 Favourite 與 Hide。只有所有選取項目都是你上傳的檔案時，才會顯示 Duplicate、Download 與 Delete，因為共用設計系統素材有永久不變的約定。
- **Projects：** 請見[尋找並復原你的作品](/info/find-your-work.html#find-something-you-saved)。

![選取兩個工具時的工具庫選取列，提供 Available offline、View sessions、Favourite 與 Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

只有選取項目時才會顯示 **View sessions**。在單張未選取的卡片上按右鍵，可開啟 **N saved sessions**：列出該工具已儲存的工作階段，從中刪除工作階段會將其移到垃圾桶。

<!--i:eti-layers-->
## 在手機上

螢幕較窄時，版面會改為單欄：

- **控制項會變成面板**，位於頂端，下緣有拖曳把手。拖動把手可停在**窄條**、**半螢幕**或**全螢幕**，也可點按把手收合與展開。預覽填滿下方空間，編輯時持續可見。
- 浮動的 **Export** 按鈕會開啟匯出面板，內含格式、大小、複製、儲存與下載。點按背景即可關閉面板。

![手機寬度螢幕上的工具：頂端面板放置控制項，產生的色盤填滿下方預覽，渲染膠囊浮在底部中央](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## 摺疊裝置與 iPhone Duo

在摺疊裝置、iPhone Duo 或接近正方形的觸控螢幕上，Lolly 會將工具分成兩個窗格：

- **控制項在一側，畫布在另一側。** 控制項會放在繪圖手的另一側。在 **Settings → Accessibility** 選擇 **Dominant hand**，或按控制項頂端的 **Swap sides**。由右至左的語言會將兩側對調。
- **分隔線就是摺疊軸。** 裝置回報摺疊位置時，窗格會在摺疊處相接，避免控制項或圖稿落在摺痕上。在連續螢幕上，可將分隔線拖到寬度的三分之一、二分之一或三分之二。Lolly 會記住這部裝置上各個檢視的選擇。
- **放在桌上使用。** 裝置半開且摺痕橫向穿過螢幕時，畫布佔據上半部，控制項位於摺痕下方。進行簡報時，上方顯示投影片，下方則有你的備註、下一張投影片，以及 **Back** 和 **Next**。在 Sequence 中，預覽在上方，時間軸在下方。
- **Lolly Design、Design System Setup 與 Assets。** 在 Lolly Design 中，Inspector、圖層與匯出面板會以分頁形式排列在畫布旁。工具沿畫布外緣排列，位於繪圖手下方。若工具放不下，該欄可捲動，漸隱效果與箭頭會標示其餘工具所在的方向。放在桌上時，工具沿畫布底部排列。Lolly Design System Setup 將 Board 放在一側，你開啟的房間則在另一側。在 Assets 中，素材詳細資料會在資料庫旁開啟，所以下次點按時，下一個素材會顯示在同一位置。
- **摺痕上不放內容。** 裝置回報摺疊位置時，對話框會在控制項所在的那一頁開啟。首頁底部的搜尋欄與搜尋結果也一樣。平面螢幕則維持置中。
- **摺疊不會遺失內容。** 摺疊、展開或轉動裝置時，文件、選取範圍、縮放比例，以及正在輸入的欄位都會保留，游標位置也不變。

摺疊裝置的外側螢幕仍使用上述手機版面；位於分割螢幕其中一半的 Lolly 視窗也一樣。

<!--i:eti-smile-->
## 設定、音效與舒適度

首頁底部的 **Settings** 包含你的詳細資料、設計系統、無障礙功能、儲存空間與離線下載。[Lolly 設定](/info/dashboard.html)介紹各個分頁。

- **你的詳細資料與大頭照**會填入支援這些資訊的工具，例如電子郵件簽名檔或識別證。[個人資料](/info/profile.html)提供相關說明。
- **Accessibility** 有四個舒適度開關：**Reduce motion**、**Hide colourful previews**、**High contrast** 與 **Large text**。它們只改變作品周圍的應用程式介面，絕不影響工具畫布或匯出結果。旁邊的 **Dominant hand** 可選擇雙窗格中控制項所在的一側。
- **Sound** 會配合操作播放輕柔的輔助音效，**Neurospicy Mode** 則播放平靜的專注音樂。兩者預設關閉，需在 **Settings → Accessibility** 或個人資料選單開啟。Sound 開關下方的 **Sound shape** 滑桿，讓音效從柔和圓潤的水滴聲（Bouba）變為乾脆的滴答與刮擦聲（Kiki），中間則是 Lolly 的鈴聲。Neurospicy 的曲目包含 Lolly 的生成電台：**Lolly Sings** 及其曲風，以及三個 **Lofi stations**。電台會邊播放邊不斷產生音樂。每個電台都可調整鼓聲與質感（Lofi 另有情緒），並提供分享目前樂曲的連結，以及將樂曲存入素材的按鈕。[生成音樂](/info/generated-music.html)說明樂曲如何製作。Utilities 下的 **Music generator**（`#/music`）讓你自行調整樂曲。
- **Available offline** 可在斷線前下載應用程式的其餘部分、工具、目錄與指南。要將 Lolly 安裝為網頁應用程式，請使用瀏覽器的安裝按鈕，或手機上的 *Add to Home Screen*。安裝後的應用程式會以全螢幕執行，並在重新連線時自行更新。
- **Settings → Feature flags** 下的 **Performance UI** 會讓應用程式使用較簡單、繪製負擔較低的外觀。工具畫布與匯出結果維持原樣。裝置較慢時，Lolly 會自行啟用此外觀並說明原因，同時提供 **Undo** 與 **Keep**（[Performance UI](/info/configuration.html#curating-what-people-see)）。
- **Storage** 顯示 Lolly 在這部裝置儲存的內容。[清除瀏覽器資料時](/info/find-your-work.html#if-you-clear-your-browser-data)說明會移除哪些內容，[隱私權政策](/info/privacy.html)則列出應用程式會擷取或傳送的所有資料。

::: note 更新後若無法載入檢視
更新後立即出現的空白面板或「failed to fetch」訊息，通常重新載入一次就會消失。已儲存的作品、工作階段與設計系統都存在你的裝置上，因此不受影響。只有加入後從未儲存的圖片可能需要重新加入。
:::

<!--i:eti-map-pin-->
## 接下來看什麼

- **[Lolly Design：自由畫布](/info/design.html)**：畫布、圖形、時間軸與簡報播放。
- **[Batch 與 Lolly Multi-edit](/info/batch.html)**：製作同一設計的多個版本，或同時編輯數份已儲存的設計。
- **[匯出檔案](/info/exporting.html)**：選擇格式、大小、印刷單位、透明度與影片。
- **[匯入設計](/info/design-import.html)**：將 Figma、Penpot、Illustrator、InDesign、Affinity 或 DXF 檔案匯入 Lolly Design 並繼續編輯。
- **[範本](/info/templates.html)**：為工具儲存的起始設計。
- **[廣色域與 HDR](/info/hdr-editing.html)**：在 Lolly Design 與 Lolly Darkroom 中保留原始圖片精度。
- **[尋找並復原你的作品](/info/find-your-work.html)**：各項內容的位置，以及移至另一部裝置的方法。
