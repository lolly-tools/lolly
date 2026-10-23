# 使用 Lolly

你已經開啟了 Lolly，想製作東西、保存並送出去。本頁帶你走完這個循環：開啟工具、更改它讓你更改的部分、儲存結果，並以連結或檔案的形式分享。

這裡的一切都在你的裝置上執行，不需要帳號，並且在你需要的工具與素材下載之後，離線也能繼續運作。應用程式需要有 WebGPU 的瀏覽器或應用程式才能啟動；[支援的環境](/info/supported-environments.html)列出已測試的環境。

## 熟悉環境

::: figure using-app-map
首頁：頂端有四個分頁，底部有一條列。工具一旦開啟，其控制項會顯示在即時預覽旁邊。
:::

首頁頂端有四個分頁：**Tools**、**Utilities**、**Assets** 與 **Projects**。Tools 是你用來製作的工具，Utilities 是處理轉換、檢查或清理檔案等工作的工作台，Assets 是你的資料庫，Projects 則保存你儲存的內容。

底部的列包含 **Open**、**Settings**、搜尋欄位、**Verify** 與 **What?**。它顯示於 Tools、Utilities、Assets、Projects、Settings 以及你在應用程式中閱讀的指南，並在工具開啟後讓位。[搜尋](/info/search.html)從該欄位涵蓋你的工具、已儲存的作品、素材與設定。[Ask Lolly](/info/ask.html) 以這些指南中相符的章節回答你輸入的問題。

點擊卡片即可在該工具中開始新的作品。已儲存的作品則改從 **Projects** 重新開啟。

![一張工具庫卡片，展示導覽範例與「新增」動作](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

每個工具都是分割檢視：一側是**控制項**，另一側是即時**預覽**。更改控制項，預覽立即跟著變化，你看到的就是匯出的結果。

![某個工具的分割檢視畫面：左側是控制項堆疊,右側是即時繪製的分組長條圖](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** 是例外。它以自由畫布的形式開啟，上面的方塊可拖曳、調整大小並輸入文字，並有自己的頂端列、時間軸與簡報控制項。[Design：自由畫布](/info/design.html)是它的指南。

## 更改工具讓你更改的部分

工具只顯示預計會變動的輸入。其作者已固定色彩、版面、字型與邏輯，因此你製作的任何內容都遵守他們的規則。輸入包括文字、滑桿、色彩選擇器、下拉選單、日期、圖片選擇器與重複的列群組，有些位於可摺疊的區段中。

![工具的控制項堆疊：一個文字欄位、幾個顏色觸發器與一支滑桿，作者選擇鎖定的其他一切都不在這裡](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**點擊設計即可找到它的控制項。** 點擊預覽中的任何元素，對應的控制項就會取得焦點並捲動到可見處。在重複的列群組中，你點擊的那一列會展開。

控制項上方的 **Clear changes** 會將每個輸入恢復為預設值。

**設計系統選項。** 當你的設計系統提供多種配色方案、淺色與深色外觀或其他主題選項時，控制項下方的 **Design system** 區段會保存它們。選項只有在改變這個工具時才會出現，因此檔案工具完全不會顯示該區段。每種配色方案是一個用自己色彩呈現的圓點，淺色與深色是兩個按鈕，其他選項則是清單。

這個選擇屬於這件作品。它隨連結與儲存的工作階段一起傳遞，每個連結到設計系統的色彩都會跟著它變化，而應用程式自己的色彩維持不變。Design 在 Inspector 的 **Canvas** 分頁顯示相同的選項。色彩本身就是內容的工具可以停留在標準配色方案上，這時就不會提供配色方案圓點。[實際使用 Lolly Demo](/info/lolly-demo-in-use.html#colourways-on-real-work)展示了在真實工作上的配色方案。

### 縮放與平移預覽

預覽永遠精確呈現匯出後的樣子。

- **縮放：** Cmd/Ctrl 加捲動，或在觸控板上雙指縮放，以你的指標為中心。在鍵盤上，`0` 符合視窗大小，`1` 為 100%，`+` / `−` 為縮放。
- **平移：** 按住 **Space** 並拖曳，或用滑鼠中鍵拖曳。單純的點擊保持空出，用來點擊設計中的各個部分。
- **觸控：** 雙指縮放、拖曳平移、點兩下符合大小。
- **縮放 HUD：** 在角落按住 Lolly 漩渦圖示，即可展開 `−`、**Fit** 與 `+`。輕點漩渦圖示仍會開啟你的個人資料選單。

輸出尺寸一有變動，檢視總會回到乾淨的符合大小狀態。

![從畫布角落的漩渦圖示展開的縮放 HUD：減號、Fit、加號，接著是主題與音效切換，以及用來移動它的把手](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### 復原與取消復原

**Cmd/Ctrl-Z** 往回一步，**Cmd/Ctrl-Shift-Z**（或 **Cmd/Ctrl-Y**）往前一步。同一組操作也以 **Undo** 與 **Redo** 按鈕的形式放在控制項上方（在 Design 中位於頂端列），沒有可復原的內容時各自會變灰。訊息會說明每次復原還原了哪個輸入，並在訊息中附有 **Redo** 按鈕。

- **一次拖曳算一步。** 半秒內對同一個控制項的重複變更會合併，因此把滑桿拉過整個範圍只算一次復原。
- **保留最近 100 步。** 復原之後的新編輯會清除往前的堆疊。
- **在文字方塊中**，Cmd/Ctrl-Z 屬於該欄位，一個字元一個字元地處理。Lolly 負責滑桿、下拉選單、色彩與開關。
- **選擇檔案**（在檔案輸入中）不算一步，因為這些位元組只在本次工作階段中保存。

在即時[協作](/info/collaborate.html)中，你的歷史仍屬於你自己：來自另一部裝置的變更絕不會進入你的堆疊。復原會持續到你離開工具或重新載入為止。至於更早的內容，隨工作自動儲存的工具會在 **History** 下保留較早的版本；請見[回到較早的版本](/info/find-your-work.html#go-back-to-an-earlier-version)。

### 即時攝影機

**Filter** 工具的效果（Halftone、Scanline、Posterize、Voronoi、Duotone、Stretch、Misprint、Dither、ASCII art 與 Glitch）在有攝影機可用時會顯示 **Go live** 按鈕。開啟後，效果會逐格跟隨你的網路攝影機，而動態匯出會把結果錄成 GIF、WebM 或 MP4。影格在你的裝置上處理，在你停止或離開工具的那一刻，攝影機就會釋放。任何圖片選擇器也都有 **Take a photo** 可拍下單一影格。

## 儲存與接續

若要保存你的作品，請按下 **Save**，也就是渲染膠囊上 **Export** 旁的勾號。新作品會進入 **My library**，你先前儲存的作品則就地更新，並且不會下載任何內容。匯出面板中也有相同的 **Save** 按鈕。

若要選擇存放位置，請按下匯出面板中 **Download** 旁的 **Save as**。在 **Save to a project** 下，讓 **My library** 保持選取，或選擇一個專案（**＋ New project…** 可建立一個），然後按下 **Save**；**Save as a template** 會把設計保存為[範本](/info/templates.html)，作為新文件的起點。在 Design 中，**Save as** 位於 Lolly 選單；在手機上，請按下 **•••**，然後 **File menu**，再按 **Save as**。

![分成兩半的渲染膠囊：Export，帶有開啟匯出面板的向上箭頭；以及 Save，帶有就地儲存的勾號](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> 按下渲染膠囊上的 **Save**，或按 **Save as** 選擇專案。
- <!--i:folder--> 該項目會進入 **My library**，或你選擇的專案。
- <!--i:home--> 之後，按下左上角的 **Home**，開啟 **Projects** 分頁。
- <!--i:document--> 開啟該項目。每項設定都回來了，可以再次更改與匯出。
:::

項目會以你在匯出面板中輸入的檔名命名，否則以其工具命名，例如 **QR Code**。以 **Download** 取得的檔案是完成的副本；若之後要更改，請在 Projects 中開啟已儲存的項目。

個人儲存的內容會留在這部裝置上，也就是你儲存時所用的瀏覽器或應用程式，除非你開啟[同步](/info/sync.html)。如果某樣東西不在你預期的位置，[尋找並復原你的作品](/info/find-your-work.html)涵蓋每一種情況，從關閉的分頁到清除的瀏覽器資料。

::: details 使用 Lolly Work 的團隊專案（選用）
如果你的[組織使用 Lolly Work](/info/organisation.html)，請登入其實例，並開啟 **Projects → Team projects** 查看與你共用的工作階段。組織設定存取與保留，其 Lolly Work 服務儲存這些工作階段。當你的組織允許即時編輯時，共用的工作階段在開啟時會加入其即時協作；[一起協作](/info/collaborate.html#work-collabs-with-lolly-work-optional)說明了步驟。

你的個人資料庫維持獨立。在另一部裝置上登入會讓你取得團隊的工作，而個人儲存的內容仍需要同步或備份才能移到另一部裝置。
:::

## 分享你的作品

設計可以用連結或檔案送出。匯出控制項中的 **Share** 會開啟一個同時提供兩者的對話框，而 Projects 中已儲存工作階段上的 **Share link** 會為該工作階段開啟相同的對話框。

::: cols
## 連結

- 在位址中帶有每個輸入，因此連結能重現設計。
- 不包含你從這部裝置新增的圖片與檔案、非常長的文字，以及非常大的清單。
- 可在任何瀏覽器中開啟，因此你可以加入書籤、貼上或提交該連結。

## .lolly 檔案

- 帶有已儲存的工作階段，以及這部裝置上的圖片與檔案，也可以連同工具與設計系統一起帶上。
- 除非你選擇納入檔案，否則會保留授權的目錄圖稿。
- 在 Lolly 中開啟：按兩下它、使用 **Open**，或將它拖放到應用程式上。
:::

### 連結

可直接複製的連結位於對話框頂端，旁邊有 **Copy** 以及在連結上開啟 QR Code 工具的 **QR** 按鈕。連結下方的 **Link options** 包含：

- **Open in the installed app** 將連結切換為供捷徑、啟動器與自動化使用的 `lolly://` 位址，每個參數都維持不變。
- **Shortest link** 將長的設計壓縮成精簡的 token，並顯示節省的字元數。可讀的形式也始終存在。
- **Password-protect this link** 在你的裝置上以 AES-256 加密連結。密碼絕不是連結的一部分。
- **Pin this tool version** 加入 `_v` 旗標，讓之後的工具更新無法改變連結所渲染的內容。
- **When the recipient opens the link…** 選擇全螢幕、已展開的匯出面板、開啟時下載（`&export`），或複製到剪貼簿（`&copy`）。
- **Copy credit** 複製一段「Made with Lolly」說明文字和連結，供貼文或投影片使用。

當工具包含個人欄位時（例如你的姓名），**Review personal fields** 會讓每個欄位都不放進連結，直到你勾選該欄位。[URL 模式](/info/url-mode.html)涵蓋連結能攜帶的一切。

**對話框會說明連結無法攜帶什麼。** 你從這部裝置新增的圖片或檔案、非常長的文字值，以及非常大的清單，都放不進一個位址。每一項在連結建立時都會被計算。如果有任何內容必須捨棄，對話框會列出它並指向檔案選項，而不是交給你一個開啟後少了圖片的連結。只是很長的連結則會得到較溫和的提示，附上其字元數。

**有些工具讓連結就是整個產品。** Jump Page 把你的連結集合成一個可分發的頁面：個人簡介連結、一場演講、一個店面。不託管任何內容，頁面背後也沒有帳號，因為頁面就是連結。訪客以全寬看到它，捲動時每個場景一個連結。

![編輯器中的 Jump Page：頁面頂部是標題場景，下方是連結場景](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details 由 Lolly Work 提供、組織管理的連結
對於需要到期、撤銷或密碼的分享，Lolly Work 為共用工作階段、工具與目錄素材提供受管理的連結。它們經由組織的服務解析，並遵循其存取規則。它們與上述自成一體的連結是分開的，撤銷其中一個無法收回別人已下載的檔案。[渲染與分享](/info/manage/sharing.html)列出連結類型與權限。
:::

### .lolly 檔案

在 Share 對話框 **Editable file** 區段中的 **Download .lolly**，會把目前的設計寫成一個檔案。它帶有已儲存的工作階段，以及這部裝置上的圖片與檔案，一般的目錄圖稿也一併帶上。過時或無法取得的檔案維持為外部參照，而不會消失。儲存之前，對話框會顯示檔案大小、內嵌了多少檔案、參照了多少檔案，以及是否包含工具。在你的裝置有分享表單的情況下，**Send to…** 會把檔案直接交給它（AirDrop、Android 分享）。

**Projects** 中資料夾選單裡的 **Download project (.lolly)** 會寫出整個資料夾，讓別人可以接續資料夾中的每個工作階段。Batch 工作階段不會帶上，通知會說明有多少個。同一個選單中的 **Download originals** 會把每個項目各自寫成檔案，打包成一般的 zip。

檔案送出之前，有三件事由你決定：

- **你的姓名是否寫入。** 只有在[你的個人資料](/info/profile.html)中開啟 **Use my details to create** 時，才會寫入你的姓名、電子郵件與組織。關閉時，檔案只記錄它是用 Lolly 製作的，以及時間。
- **被保留的圖稿是否放入。** 授權圖稿、品牌鎖定的圖稿，以及從未記錄授權的目錄作品預設不放入。如果設計用到其中任何一項，對話框會說明有多少個，並提供 *Download without them* 或 *Include and download*，因為納入它們等於把檔案交給開啟該 `.lolly` 的人。檔案的 `CREDITS.txt` 會列出帶上與未帶上的內容，以及原因；[創作權利與署名](/info/creative-rights.html)說明了規則。
- **工具是否放入。** **Include the tool** 會打包工具本身的檔案，讓設計能在沒有該工具的裝置上開啟。對自訂工具（例如 fork）預設為勾選，對已簽署目錄所列的工具則為未勾選。在沒有已簽署目錄的建置版本上，每個工具都算自訂。

**開啟檔案。** 在桌面與行動應用程式中，按兩下或點一下 `.lolly`，選擇 **Open with Lolly**，或從分享表單把它傳給 Lolly。在網頁應用程式中，按下 **Open** 或將檔案拖放到 Lolly 上。每條路徑都會先讀取檔案的 manifest，並在寫入任何內容之前顯示其大小、內容與將會發生的事。

如果檔案帶有你沒有的工具，**Trust this tool?** 會顯示該工具與其作者，並說明開啟它會在你的裝置上執行工具自己的程式碼。**Trust & install** 會繼續。拒絕的話，作品仍會儲存到 Projects，等待你加入該工具的那一天。以模組形式提供程式碼的工具目前還無法用這種方式安裝，並會以同樣的方式被擋下。

::: details .lolly 裝了什麼，以及開啟時如何運作
`.lolly` 是 Lolly 的套件副檔名，其 `manifest.json` 中的 `format` 說明裡面是什麼：

- **共用設計**（`lolly-share`）包含一個儲存的工作階段、其內嵌的檔案，以及仍以參照解析之內容的收據。它也可以帶有工具與設計系統。開啟它會新增一個 Project，絕不會覆寫工作階段。
- **共用專案**（`lolly-share`，種類為 `project`）包含 Projects 中的一個資料夾：其子資料夾、其中每個工作階段連同它的圖塊，以及歸檔在那裡的圖片。開啟它會新增整個資料夾的副本。每個工作階段以 `sessions/<key>.json` 傳遞，其圖塊放在 `thumbs/` 下。在專案檔案出現之前的 Lolly 會要求你更新。
- **設計系統套件**（`lolly-brand`）包含 token，也可以包含字型、標誌、已發布的版本與保留的資源。開啟套件會新增一個獨立命名的設計系統，並將該系統設為使用中。
- **工作區或實例套件**是帶有宣告的工具、目錄素材與選擇性實例位址的 `lolly-brand`。載入一個會取代先前載入的單一工作區覆疊，而預覽會列出這些裝置範圍的影響。

完整的裝置備份不是 `.lolly`。它仍然是 `LollyTools-….zip`（格式為 `lolly-backup`），並透過 **Settings → Storage → Import data…** 還原。壓縮的工具資料夾也仍然是 `.zip`。[資料轉移](/info/data-transfer.html)是格式參考。

`.lolly` 是一般的 zip。把它改名為 `.zip` 就能看裡面：你自己的圖片在 `assets/uploads/` 下，目錄圖稿在 `assets/catalog/` 下，`manifest.json` 列出每個檔案，而 README 說明這個檔案是什麼。

macOS、Windows、Linux、iOS 與 Android 都註冊了這種格式，桌面檔案管理員將它顯示為 Lolly 文件，GNOME Files 則可以顯示已儲存工作階段自己的縮圖。從 Design System Setup 開啟時，若共用設計帶有設計系統動作，會推薦該動作，但絕不隱藏 **Open shared design**。

從 iOS 或 Android 上的另一個應用程式交給 Lolly 的文件上限為 48 MB，因為交接會將其位元組複製過應用程式邊界，應用程式也會說明這一點。Lolly 內的 **Open** 沒有這項上限，因此較大的套件請使用它。

你確認之後，Lolly 會一次性解壓縮並驗證套件。素材進入你的資料庫，並依校驗碼比對，因此裝置上已有的檔案會被重複使用。工作階段以新的 ID 進入 Projects，所以同一個檔案可以開啟兩次；缺少工具的工作階段會在那裡等候。超過 100 MB 的檔案會標示為大型，而當瀏覽器儲存空間回報的可用空間少於檔案所需時，預覽會發出警告。在任何內容提交之前，每個受完整性涵蓋的部分都會被檢查，受損的副本會被拒絕，且不留下任何東西。
:::

連結與檔案都交出一份快照。若要即時編輯，[一起協作](/info/collaborate.html)涵蓋兩部裝置之間的私人協作，以及透過 Lolly Work 的選用工作協作。

## 素材 - 你的資料庫

**Assets**（`#/a`）彙集了你的工具可以取用的一切：品牌標誌、圖片、音訊與動態，依種類分組，連同你自己的檔案。你的上傳內容儲存在你的裝置上。使用 Lolly Work 的組織也可以在自己的存取規則下提供共用目錄；請見[在你的組織使用 Lolly](/info/organisation.html)。

![素材 - 品牌的色票與字體，以及你自己上傳的檔案](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **帶入你的檔案。** 將圖片、SVG、音訊片段、影片、Lottie、PDF 或 PowerPoint 簡報拖放到上傳區，或點擊選擇。它會立即出現在 Assets 與每個工具的素材選擇器中。多頁的 PDF 或 `.pptx` 會詢問要保留哪些頁面或投影片，每一個都成為 SVG 素材。你在工具內新增的圖片會以原樣保存在 **My images** 中，因此其上的 Content Credential 仍可驗證，只有非常大的檔案才會詢問是否要縮小。**Settings → Storage** 顯示 **My images** 佔用多少。除了你裝置的儲存空間外沒有上限。若要在圖片進來時清除 EXIF 與 GPS 資料，請開啟 **Settings → Feature flags** 下的 **Strip metadata from uploads**；無論如何都會保留 Content Credentials。
- <!--i:star--> **把常用的設為最愛。** 為素材或品牌色票加星號，它就會固定在每個選擇器的頂端。
- <!--i:folder--> **整理。** 將素材移到另一個群組、隱藏你不用的共用品牌素材（**Show hidden** 可讓它回來），或刪除你自己的上傳內容。與 Projects 相同的選取列可對整個選取範圍動作。
- <!--i:layers--> **把影片從背景中分離出來。** 開啟影片的詳細資料，或在素材選擇器中以右鍵點擊其卡片，並選擇 **Remove background…**。**On-device model** 可從雜亂的場景中去背出主體；**Colour key** 可移除光線均勻的背景，例如綠幕，並提供 **Tolerance**、**Softness** 與 **Spill removal** 處理邊緣，且不需下載。**Resolution**（360、480、720 或 1080p，絕不超過來源）以細節換取速度。去背後的結果是具有真正透明度的動態 WebP 或 PNG，會儲存在原檔旁邊，來源的 Content Credential 也會作為素材一併帶上。[生成一次，渲染相同](/info/ai-features.html)說明了為什麼這仍是一般的編輯。

### 把你的色盤與字體帶著走

Assets 中的 **Swatches** 面板顯示你的品牌由哪些色彩組成：品牌色彩、你新增的色彩、它的漸層色階與它的光譜。Lolly 為介面保留的角色色彩（文字、表面、邊緣、配色方案主色，以及以另一個名稱存在的品牌色彩副本）則收在面板底部的灰色 **Show colour roles** 卡片後面。

每個色彩都是和任何其他素材一樣的卡片。點擊其中一個即可開啟詳細資料，選取幾個可以只下載這些，或以你其他工具能讀取的格式下載整個調色盤：

- <!--i:code--> **Design tokens (JSON)**、**CSS variables** 或 **CSS classes**，供樣式表或建置使用。比 sRGB 更廣的色彩會保留其廣色域值：CSS 在十六進位值之後設定它，而 JSON 保留十六進位值，並附上廣色域色彩、CMYK 組成與特別色油墨。
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**，供 Illustrator 或 Photoshop 使用。鎖定為 CMYK 組成的色彩會以該 CMYK 色票呈現，特別色油墨以具名特別色色票呈現，比 sRGB 更廣的色彩則以 Lab 呈現。
- <!--i:pentool--> **GIMP palette (.gpl)**，供 GIMP 或 Inkscape 使用，以及 **SCSS variables**，兩者皆為 sRGB。

![Swatches 面板：頂端是五個調色盤下載按鈕，接著每個品牌色彩都是一個可開啟其詳細資料的色塊](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

用每張卡片上的圓點選取色彩：按住 Shift 點擊第二個圓點可選取兩者之間的全部，拖曳方框穿過間隔，或在卡片取得焦點時按 Cmd/Ctrl+A。選取列提供以相同六種格式 **Download as…**、**Copy hex** 與 **Favourite**。在你選擇格式之前，選單會列出任何格式都無法容納的色彩（Transparent 完全沒有色彩）、哪些格式會把廣色域色彩存成其 sRGB 後備值（SCSS 與 GIMP），以及哪些格式帶有 CMYK 與特別色值（JSON 與 .ase）。在卡片上按右鍵，可對單一色彩執行相同的動作。

色彩的詳細資料會以該色彩填滿預覽，並展開 **Linked values**（其 CMYK 組成或特別色油墨、為特定色彩空間或印刷機撰寫的任何值，以及其設計 token）、**Every notation**（十六進位、OKLCH、Display-P3 等，每一種都有複製按鈕）、**Plotted on a colour space**、**Tones** 與 **Readability**。方向鍵可逐一瀏覽調色盤，**Copy link** 分享色彩本身，**Open in Colour Lab** 則可進一步處理。

**Fonts** 面板列出你的品牌字型，每個都有 **download**，可在本機安裝或交給印刷廠。

## 讓網格屬於你

- <!--i:star--> **把常用的設為最愛。** 在卡片上按右鍵並選擇 **Add to favourites**，它就會在網格上方的長條中得到一個大圖塊。[你的最愛](/info/favourites.html)涵蓋這個長條。
- <!--i:eyeoff--> **隱藏你從不使用的工具。** 在卡片上按右鍵，或選取數個，然後選擇 **Hide tool**。它會從網格中，以及在網格中輸入時的搜尋結果中消失。結尾處的灰色 **Show hidden tools (N)** 圖塊會讓它們以暗淡的樣子重新顯示，每個的選單中都有 **Unhide tool**。隱藏只會改變你的網格：工具仍可從連結或書籤開啟。
- <!--i:clock--> **你的工具優先。** 一旦你在三個不同的工具中儲存過作品，網格上方會出現 **Yours** 這一列晶片，以你的最愛與最近使用的工具領頭。
- <!--i:sliders--> **以你的方式排版。** **View options** 設定版面（**Grid**、**Card** 或 **List**）、卡片大小與密度、排序方式與類別篩選。

![Tools 網格的結尾，已顯示隱藏的工具：暗淡的 Wordmark 卡片，以及它旁邊用來切換回顯示狀態的灰色圖塊，現在寫著 Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**一次對多張卡片動作。** 勾選每張卡片的核取方塊、在空白處拖曳選取框，或按住 Shift/Cmd 點擊，就會出現一個列，提供該檢視允許的動作：

- **Tools 與 Utilities：** Favourite、Hide、Available offline、**View sessions**（Projects，只顯示以這些工具製作的工作階段），以及針對單張卡片的 Copy link。
- **Assets：** 任何選取範圍都可使用 Favourite 與 Hide。只有當每個選取的項目都是你自己的上傳內容時，才會出現 Duplicate、Download 與 Delete，因為共用的設計系統素材是永久的契約。
- **Projects：** 請見[尋找並復原你的作品](/info/find-your-work.html#find-something-you-saved)。

![兩個工具被選取時的工具庫選取列，提供可離線使用、檢視工作階段、收藏與隱藏](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** 只有在選取了東西之後才會出現。改為在單張未選取的卡片上按右鍵，它會提供 **N saved sessions**，也就是該工具已儲存工作階段的清單，其中的刪除會把工作階段移到垃圾桶。

## 在手機上

在窄螢幕上，版面會變成單欄：

- **控制項變成頂端的面板**，下緣有拖曳把手。拖曳把手可貼齊 **peek**、**half** 或 **full**，或點擊它來收合與展開。預覽填滿下方的空間，並在你編輯時保持在視野中。
- 浮動的 **Export** 按鈕會開啟匯出面板：格式、大小、複製、儲存與下載都在同一處。點擊背景即可關閉面板。

![手機寬度螢幕上的工具：控制項是頂端的面板，生成的色盤填滿下方預覽，算圖膠囊浮在底部中央](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## 設定、聲音與舒適度

首頁底部的 **Settings** 包含你的詳細資料、設計系統、無障礙、儲存空間與離線下載。[Settings](/info/dashboard.html) 對應每個分頁。

- **你的詳細資料與大頭照**會填入任何設計為使用它們的工具，例如電子郵件簽名檔或名牌。[個人資料](/info/profile.html)涵蓋它們。
- **無障礙**有四個舒適度開關：**Reduce motion**、**Hide colourful previews**、**High contrast** 與 **Large text**。它們改變的是你作品周圍的應用程式，絕不改變工具畫布或匯出內容。
- **Sound** 會為你的操作播放柔和的輔助音效，**Neurospicy Mode** 則播放平靜的專注曲目。兩者在你於 **Settings → Accessibility** 或個人資料選單開啟之前都是關閉的。
- **Available offline** 會在你失去連線之前，下載應用程式的其餘部分、你的工具、目錄與指南。Lolly 是可以安裝的網頁應用程式：使用瀏覽器的安裝按鈕，或在手機上選擇*加入主畫面*，就能得到在你重新上線時自行更新的全螢幕應用程式。
- **Storage** 顯示 Lolly 在這部裝置上保存了什麼。[如果你清除瀏覽器資料](/info/find-your-work.html#if-you-clear-your-browser-data)說明清除會移除什麼，[隱私政策](/info/privacy.html)則列出應用程式擷取或傳送的一切。

::: note 如果更新後檢視無法載入
更新後立即出現空白面板或「failed to fetch」訊息，通常重新載入一次就會恢復。你儲存的作品、工作階段與設計系統不受影響，因為它們存放在你的裝置上。只有你新增但從未儲存的圖片可能需要重新加入。
:::

## 接下來往哪裡走

- **[Design：自由畫布](/info/design.html)**：畫布、圖形、時間軸，以及簡報一份投影片。
- **[Batch 與 Multi-edit](/info/batch.html)**：同一份設計的許多版本，或一起編輯數個已儲存的設計。
- **[匯出檔案](/info/exporting.html)**：選擇格式、大小、列印單位、透明度與影片。
- **[匯入設計](/info/design-import.html)**：將 Figma、Penpot、Illustrator 或 InDesign 檔案帶入 Design 並繼續編輯。
- **[範本](/info/templates.html)**：工具已儲存的起點。
- **[廣色域與 HDR](/info/hdr-editing.html)**：在 Design 與 Darkroom 中保留圖片原有的精度。
- **[尋找並復原你的作品](/info/find-your-work.html)**：一切在哪裡，以及如何移到另一部裝置。
