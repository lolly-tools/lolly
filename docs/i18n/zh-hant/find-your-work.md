# 尋找並復原你的作品

尋找你從未儲存的設計、已下載的檔案、上週的版本，或在瀏覽器資料被清除後找回作品。從下表開始。

個人作品會留在你製作時使用的裝置及其瀏覽器或應用程式中，除非你開啟[同步](/info/sync.html)。使用選用服務 Lolly Work 的組織也會在伺服器上保留 **Team projects**。

| 你做了什麼 | 到哪裡找 |
|---|---|
| 按下 **Save as** 或 **Save** | **Projects** |
| 按下 **Download** | 瀏覽器的下載項目，另有副本存放在 **Assets** |
| 兩者皆無，但使用[隨工作自動儲存的工具](#which-tools-save-as-you-work) | **Projects** 與 **History** |
| 兩者皆無，且使用不會自動儲存的工具 | 只有當時工作的分頁中，直到你關閉分頁為止 |
| 在應用程式中刪除了它 | **Projects**、**Assets** 或 **Settings → Storage** 中的 **Trash**，保留 30 天 |

::: figure find-your-work-places
作品的存放位置：瀏覽器自己的儲存空間存放 Projects、History 與 Trash；下載的檔案放到裝置的資料夾中；同步與備份檔案則是在瀏覽器外的副本。
:::

::: details 在 Lolly Work 尋找共用的作品（選用）
開啟組織的 Lolly，登入並查看 **Projects → Team projects**。該實例存有共用工作階段，並顯示你有權存取的項目。在另一部裝置上登入可以恢復對這些工作階段的存取。登入不會還原你的個人資料庫或裝置備份。

在[工作協作](/info/collaborate.html#collabs-through-lolly-work-optional)中，請等到出現 **Saved to work** 再離開。如果找不到共用專案，請確認你已連到正確的實例，並向其營運者詢問存取權限或保留期限。清除瀏覽器資料會移除本機副本，不會移除組織的伺服器副本。請見[在你的組織使用 Lolly](/info/organisation.html)。
:::

<!--i:eti-search-->
## 尋找已儲存的內容

1. 按下工具左上角的 **Home**。
2. 開啟首頁頂端的 **Projects** 分頁（手機上的資料夾圖示）。
3. 你儲存到 **My library** 的所有內容都在第一個畫面。每個專案都是一個資料夾。若要搜尋所有資料夾，請在畫面底部的 **Search all projects…** 輸入。

項目會使用你在匯出面板輸入的檔名。沒有檔名時，會使用其工具的名稱，例如 **QR Code**。開啟項目會還原每項設定。若要儲存新的作品，請見[儲存與接續](/info/using.html#saving-continuing)。

::: note 不在 Projects 中？
- 它可能在 **Trash**：請見[找回已刪除的內容](#get-back-something-you-deleted)。
- 另一個瀏覽器、私密視窗或另一部裝置一開始都是空的，除非你使用[同步](/info/sync.html)或[搬移作品](#move-your-work-to-another-device)。
- 如果你只按了 **Download**，請見[尋找已下載的檔案](#find-a-file-you-downloaded)。
:::

::: details 使用 Projects
你也可以從 **Settings → Storage → Saved sessions → Organise in Projects** 開啟 **Projects** 檢視。它的運作方式類似檔案管理員：

![尚未儲存任何內容的 Projects：New folder、New asset 與 Templates 方塊，右上角的 History 時鐘，以及底部的 Search all projects 列](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **可巢狀排列的資料夾。** 將儲存的工作階段放入資料夾，也可將資料夾放進資料夾，層數不限。建立或重新命名資料夾，或將方塊拖到資料夾上來移動它。階層導覽列可帶你回到上層。儲存時未指定資料夾的工作階段位於 **Projects** 根目錄。
- <!--i:clock--> **依你的方式排序。** 右上角的滑桿按鈕 **View options** 提供 **Grid** 或 **List**，並可依 **Name**、**Date added**、**Last modified**（預設）、**Size** 排序，在資料夾內也可選 **By tool**。資料夾永遠在最前面。工作階段與資料夾各自在自己的群組內排序。
- <!--i:document--> **直接存入新作品。** **New asset** 會開啟共用的選擇器。選擇 **Templates** 可從已儲存的範本開始。開啟範本來編輯，或按下 **+ Add** 立即儲存新的作品。
- <!--i:checklist--> **多重選取（桌面）。** 勾選方塊的核取方塊、在空白處拖出選取框，或 **Shift/Cmd-click**。若要開啟方塊的快顯選單，請在方塊上**按右鍵**。選取列提供 **Render selection**、**Move to…**、**New folder** 與 **Delete**（移至 Trash）。其中的 **Edit together** 可在同一個側邊欄下並排開啟二到八個單一工具工作階段。**Edit as sheet** 則將任意數量或組合的選取項目開啟為批次格線中的各列。
- <!--i:download--> **渲染整個資料夾或選取範圍。** **Render folder** 會將資料夾及其子資料夾中的每個已儲存工作階段匯出成一個巢狀 `.zip`。**Render selection** 對多重選取做同樣的事。單一工作階段會渲染成自己的檔案。
- <!--i:link--> **直接跳到工具已儲存的作品。** 在 Tools 工具庫中勾選一個或多個工具，並從選取列選擇 **View sessions**。Projects 就只會顯示以這些工具製作的工作階段。**Clear** 可恢復完整檢視。
- <!--i:link--> **分享已儲存的工作階段。** 在工作階段上按右鍵（手機上則按方塊上的 **•••**），並選擇 **Share link**。連結會以相同設定重新開啟該工作階段。裝置上的圖片不會隨連結傳遞。完整的 Share 對話框說明請見[分享你的作品](/info/using.html#sharing-your-work)。
- <!--i:pentool--> **重新命名或複製。** 同一個選單中有 **Rename**、**Duplicate**（在同一資料夾中建立副本）與 **Move to…**。

![Projects 的 View options 彈出視窗：Layout 提供 Grid 與 List，Sort by 設為 Last modified，旁邊有反轉順序的按鈕](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

<!--i:eti-refresh-->
## 如果你關閉了分頁或離開了工具

能還原哪些內容，取決於你如何離開以及使用哪個工具：

- **你關閉了分頁，或之後才回來。** 未儲存的作品會消失，除非使用[隨工作自動儲存的工具](#which-tools-save-as-you-work)。從 **Projects** 開啟該作品。
- **你在同一分頁重新載入頁面。** 設定會從頁面位址還原。在不會隨工作自動儲存的工具中，位址不含裝置上的圖片與檔案，也不含超過 150 個字元的單行文字，因此這些內容不會還原。
- **你按下 Home 或左上角的返回按鈕。** 如果自上次儲存、下載或複製後有任何變更，**Unsaved edits** 對話框會詢問是否先儲存。**Save & leave** 會儲存作品並帶你前往 **Projects**，或回到你開啟作品時所在的專案資料夾。**Leave anyway** 會捨棄變更。已儲存的項目會回到上次儲存的狀態，從未儲存的作品則會從 **Projects** 移除。**Cancel** 會讓你留在工具中。

::: warning 關閉分頁不會先詢問
關閉分頁、重新載入與瀏覽器本身的返回按鈕都不會詢問。保險起見，離開工具前請按下 **Save as**，或匯出面板中的 **Save**。
:::

無法自動復原時，編輯控制項旁會有說明，告訴你需要保留什麼：

- 在處理你帶入檔案的工具中，請儲存設定，也保留原始檔案。
- 在錄製工具或沒有 Save 動作的實用工具中，請在離開前儲存或下載結果。
- 桌面與行動應用程式會說明何時需要手動儲存。
- 在私人協作中，邀請者保留文件及其歷史，包括對方的變更。加入者是在暫存副本上工作，應在工作階段結束前另存一份副本。

::: note 不小心未儲存就離開了？
在隨工作自動儲存的工具中，History 會將捨棄編輯的副本保留 30 天。開啟 **History** 頁面，在 **Changes** 下找到它們，然後按下 **Open as a copy**。在其他工具中，變更已經消失。
:::

::: details 哪些工具會隨工作自動儲存
在網頁應用程式中，每個製作文件的工具都會隨工作自動儲存，例如 Lolly Design、Lolly Chart、QR Code、Text 與 Lolly Sandbox。以下工具不會：

- 處理你帶入檔案的工具，例如 Redact、Sign 或 Convert Image，因為 Lolly 絕不保留該檔案的副本；
- 從攝影機、麥克風或螢幕錄製的工具，例如 Record、Lolly Screen Capture 與 Lolly Voice Recorder；
- 沒有可變更內容的工具，例如 Countdown。

在其他工具中，你的第一次變更就會將作品存入 **Projects**，如同你已儲存。後續變更會在工具完成繪製後保存。未儲存的作品在關閉分頁後仍會留在 Projects 中，重新開啟時，其變更會標記為未儲存。

**Leave anyway** 仍會捨棄這些變更。從首頁再次開啟工具會開始新的作品；請從 Projects 開啟先前的作品。

3D 與 Lolly Darkroom 會隨工作自動儲存，但不會保留你載入的檔案，例如 3D 模型或 LUT。History 與 **Save** 會保留檔案的名稱、類型與大小，不會保留檔案本身。再次開啟作品時，會有說明指出是哪個檔案，工具會在沒有該檔案的情況下運作，直到你重新載入它。請保留原始檔案。

開啟[同步](/info/sync.html)時，以此方式存入的作品會傳到你的其他裝置。其版本會留在建立該版本的裝置上。

如果同一作品在兩個分頁中開啟，而且你在兩邊都儲存，會保留最後一次儲存。被取代的作品會放在該作品 History 的 **Protected drafts** 下，並提供 **Open draft as a copy**。

此功能僅適用於網頁應用程式，不適用於桌面或行動應用程式，也不適用於你與他人即時協作時。
:::

<!--i:eti-download-->
## 尋找已下載的檔案

在瀏覽器中，**Download** 會將檔案交給瀏覽器。瀏覽器會將檔案儲存到其下載資料夾（通常是 **Downloads**），或詢問你存放位置。Lolly 不會得知檔案存到哪裡，因此請查看瀏覽器的下載清單。

如果沒有出現檔案，請在仍處於工具中時查看匯出面板。**Download** 下方會有一行顯示檔名與時間，並提供 **Retry download**。在 Chrome、Edge 與其他 Chromium 瀏覽器中，該行也提供 **Save file…**，可選擇資料夾。這一行與檔案會保留到你離開工具、重新載入或再次匯出為止。

Lolly 也會在每次下載後保留兩樣內容：

- **檔案的副本**，存放在 **Assets** 的 **Your uploads** 下，前提是 **Settings → Your renders** 中的 **Save my renders to my library** 已開啟（**Settings** 位於首頁底部）。此設定預設開啟。影片或超過 50 MB 的檔案會先詢問，zip 則不會複製。
- **你使用的設定**，保留最近 24 次下載的設定。**Projects** 中已儲存作品下方的 **Recent exports** 會以這些設定重新開啟工具。不包含你從裝置加入的圖片與檔案。相同清單也位於 **Settings → Activity & stats → Latest exports**，以及 **History** 的 **Changes** 分頁。

::: details 在桌面與行動應用程式中
- **桌面應用程式：** **Download** 會儲存到 **Downloads** 資料夾中的 **Lolly** 資料夾，不會出現對話框。**Download** 下方的一行會說明檔案存到哪裡，例如「Saved to Downloads/Lolly」，並提供 **Show in folder**。**Window** 或 **Exports** 選單中的 **Open Exports Folder** 可隨時開啟該資料夾。若檔名與先前的檔案相同，會儲存為「name (1)」。
- **iPhone 與 iPad：** 檔案會儲存在 **Files** 應用程式中的 **Lolly** 下，並開啟分享表單。**Download** 下方的一行會顯示「Saved to Files → Lolly」。
- **Android：** 分享選單會開啟。選擇檔案的存放位置。

在 iPhone、iPad 與 Android 上，新檔案會取代先前同名的檔案。
:::

<!--i:eti-history-->
## 回到較早的版本

- **這次使用期間：** **Undo** 可逐步退回最近 100 次變更，直到你離開工具或重新載入為止。請見[復原與取消復原](/info/using.html#undo-and-redo)。
- **在[隨工作自動儲存的工具](#which-tools-save-as-you-work)中：** 會保留每件作品的較早版本。
- **裝置上的所有內容：** 開啟[同步](/info/sync.html)時，**Settings → Connected services** 下的 **Restore an earlier copy** 可還原最近七份每日副本之一，或上次套用前的副本。這部裝置上的所有內容隨後都會與該副本一致。

若要開啟較早的版本：

1. 按下 **History**，也就是 **Undo** 與 **Redo** 旁的時鐘按鈕。在 Lolly Design 中，**History** 位於頂端列。在手機上，先按 **•••**，再按 **History**。在沒有 **Undo** 的工具中，例如 Text 與 Lolly Sandbox，**History** 位於左上角的 **Home** 旁。
2. 依日期與時間尋找版本。**Automatic checkpoint** 列是在你工作時記錄的；**Saved version** 列則是你儲存時的記錄。
3. 按下 **Open as a copy**。該版本會以新作品開啟，原先開啟的作品維持原樣。副本會出現在 **Projects**，名稱後附有「(copy)」。

若要以名稱保留版本，請按下 **Name version**，輸入名稱，再按下 **Keep milestone**。已命名的版本會列在 **History** 頁面的 **Milestones** 下。

::: details History 面板與 History 頁面
在 **History** 面板中也會列出 **Recovered work** 列，而 **Protected drafts** 會保存檢查點之間的最新編輯，並提供 **Open draft as a copy**。**Lolly Compare** 與 **Check assets** 可在你開啟副本前協助選擇。將 **This creation** 切換為 **All history on this device**，即可查看每件作品。

自動檢查點會隨時間減少保留密度：最近一小時每分鐘一份，最近一天每小時一份，30 天內每天一份，之後每週一份。所有已儲存與已命名的版本都會保留。刪除作品也會將其版本移至 **Trash**，而 **Delete forever** 會將它們移除。

History 儲存空間用盡時，會先移除你 30 天未開啟作品中最舊的自動檢查點。即使如此，儲存的內容仍一定會保留。它會寫入為目前作品，History 則會說明此次儲存未保留為版本。**Settings → Storage** 會顯示 History 使用多少空間。

在 **History** 頁面（`#/history`）可查看此瀏覽器中的每件作品。若要開啟該頁面，請按首頁或 **Projects** 右上角的時鐘按鈕、在個人資料選單中選擇 **Saved sessions**（手機上為右上角的圓形標誌按鈕），或在工具的 History 面板中按下 **Open app history**。桌面與行動應用程式沒有 History 頁面。在這些應用程式中，首頁的時鐘按鈕與 **Saved sessions** 會開啟 **Your recent work**：顯示你最近儲存的工作階段與匯出項目，並附有前往 Projects 的連結。

- **Recent** 列出你的作品，最新的在前，並提供 **Resume**。
- **Changes** 將檢查點、下載項目與 Convert 結果放在同一條時間軸上。下載項目提供 **Reopen settings**。
- **Milestones** 列出已命名的版本。

每件作品都是附有圖片的方塊。**Grid** 或 **List** 可切換版面。依專案、工具與日期篩選（手機上位於 **Filters** 內）。方塊的選單（按右鍵或長按）提供 **Resume**、**Versions**、**Show in Projects** 與 **Move to Trash**。若要移除多個項目，請選取它們，再選擇 **Move to Trash**，之後可使用 Undo。
:::

<!--i:eti-folder-move-->
## 將作品搬移到另一部裝置

| 目的 | 使用方式 |
|---|---|
| 讓裝置保持同步 | **Settings → Connected services** 下的 **Sync across devices**：請見[同步你的裝置](/info/sync.html) |
| 一次搬移所有內容 | 下方的 **Export my data** 與 **Import data…** |
| 交接一份設計或一個專案 | `.lolly` 檔案：先按 **Export**，再按 **Share**，接著按 **Download .lolly**；整個專案則使用資料夾選單中的 **Download project (.lolly)**。在另一部裝置按下 **Open**。請見[.lolly 檔案](/info/using.html#the-lolly-file) |

分享連結會攜帶你的設定，但不含你從裝置加入的圖片或檔案。

::: note 匯入會新增內容，不會刪除任何內容
檔案中的資料夾、最愛與範本會加入另一部裝置原有的內容。若兩邊都有同一個已儲存項目，則保留較近儲存的副本。該裝置上的個人資料與設定維持原樣。空白的部分會從檔案填入。同步中的 **Bring it to this device** 也以相同方式運作。
:::

若要一次搬移所有內容：

1. 在舊裝置上，開啟 **Settings → Storage**，並在 **Move to another device** 下按 **Export my data**。Lolly 會下載一個檔名以 `LollyTools-` 開頭的 `.zip` 檔案。
2. 透過 USB、寄給自己的電子郵件、AirDrop 或共用資料夾傳送檔案。
3. 在新裝置上，開啟 **Settings → Storage**，按下 **Import data…**，選擇檔案並按下 **Import**。

::: note 哪些內容會留在原處
登入狀態、金鑰與同步通關密語會留在各自的裝置上。最近下載清單、離線下載內容與 AI 模型不會透過任何方式傳送。版本歷史只能透過 **Export my data** 檔案傳送，無法透過同步或 `.lolly` 傳送。歷史太大而無法放入單一檔案時，會略過最舊的自動檢查點，匯出列會說明略過多少個。你可以下載並開啟同步保存在儲存空間中的副本，或像備份檔案一樣，在 **Import data…** 中選擇該副本。加密的副本會要求輸入通關密語。
:::

::: details 備份檔案包含什麼
檔案名稱為 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`。名稱中的姓名部分來自你的個人資料，未設定則省略。`<n>` 是當天匯出的次數。檔案包含你的個人資料，以及資料夾、Trash、範本與最愛；每個已儲存的工作階段及其縮圖；你上傳的圖片、字型、標誌與下載項目的副本；你的設計系統；偏好設定（主題、側邊欄寬度、本機活動統計）；Convert 的已儲存版本與結果；以及網頁應用程式中作品的版本歷史。

不包含目錄快取。新裝置會重新下載快取。每個部分都有總和檢查碼，因此匯入時能偵測到傳輸途中損毀的檔案。已儲存的工作階段會重新連結至匯入的圖片。網頁、桌面與行動應用程式讀取相同的檔案。終端機應用程式會寫出自己的簡易備份，此格式無法讀取該備份。**Export my data & render everything** 會製作相同的檔案，另外再產生一個 zip，將每個已儲存的工作階段渲染為輸出檔案。完整格式請見[資料傳輸](/info/data-transfer.html)。
:::

<!--i:eti-globe-->
## 如果你清除瀏覽器資料

在網頁應用程式中，Lolly 將所有內容保存在瀏覽器供此網站使用的儲存空間：已儲存的作品、圖片、字型、設計系統、版本歷史與離線下載內容。在瀏覽器中清除此網站的資料會移除這一切，Lolly 無法找回其中任何內容。剩下的只有已經離開瀏覽器的內容：你下載的檔案、**Export my data** 檔案、[同步](/info/sync.html)副本與你分享的連結。

::: warning 清除瀏覽器資料之前
按下 **Settings → Storage** 下的 **Export my data**，並將檔案保存在其他地方。
:::

應用程式啟動時，Lolly 會要求瀏覽器在裝置空間不足時不要清除它的儲存空間，由瀏覽器決定是否同意。在 **Settings → Available offline** 下，以 **Protected** 開頭的一行表示瀏覽器已同意。「The browser may clear downloads if the device runs low on space」表示它未同意，**Protect downloads** 可再次提出要求。

如果瀏覽器未同意，可能會在空間不足時清除已儲存的作品與下載內容，因此請保留近期的 **Export my data** 檔案。

**Settings → Storage** 會顯示每類資料使用多少空間。其中的 **History** 列統計自動檢查點、其預覽與復原草稿。**Remove automatic checkpoints older than 30 days** 會釋放該空間，並保留已儲存與已命名的版本。**Clear cache** 會移除已下載的目錄檔案，需要時會重新下載。**Clear all my data** 會要求你輸入一個字詞，關閉同步，然後移除 Lolly 在此瀏覽器保存的一切：個人資料與設定、已儲存的工作階段及其歷史與 Trash、上傳項目、字型與設計系統、下載記錄、Convert 結果、已下載的 AI 模型與離線副本。你下載的檔案會留在原先儲存的位置。之後應用程式會像初次使用時一樣啟動。

![手機寬度畫面上的儲存空間卡片：列出裝置端資料的每個類別名稱，底部有 Clear all my data 按鈕](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

在桌面與行動應用程式中，已儲存的工作階段是應用程式專用資料夾中的檔案，其他內容則存放在應用程式自己的儲存空間。清除網頁瀏覽器資料不會影響這些內容。

::: details 桌面與行動應用程式將已儲存的工作階段放在哪裡
每個已儲存的工作階段各有一個檔案，放在 `saved-state` 資料夾中：

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`，或 `$XDG_DATA_HOME` 下的相同路徑
- iPhone、iPad 與 Android：位於應用程式自己的儲存空間，Files 應用程式不會顯示

圖片、設計系統與最近下載清單會留在應用程式的內部儲存空間，不在這些資料夾中。終端機應用程式與命令列會讀取同一個 `saved-state` 資料夾：請見[已儲存工作階段的存放位置](/info/cli-reference.html#where-saved-sessions-live)。
:::

<!--i:eti-trash-->
## 找回已刪除的內容

在應用程式中刪除已儲存的工作階段、資料夾、上傳項目或字型時，都會將其移至 **Trash** 保留 30 天，無論你從哪裡刪除：**Projects**、**Assets**、**Settings → Storage** 或工具的已儲存工作階段清單。資料夾及其內所有內容會作為一個項目移入 Trash。工作階段在 Trash 中會保留其版本歷史。刪除後會立即出現訊息，提供 **Undo**。之後則可：

1. 開啟 **Trash**：**Projects** 中的 **Trash** 方塊、**Assets → Your uploads** 中的 **Trash** 按鈕，或 **Settings → Storage** 中的 **Trash** 列。三者都會開啟相同的清單。
2. 按下項目旁的 **Restore**。它會回到原本的資料夾，字型也會恢復其在設計系統中原有的角色。

**Delete forever** 會永久移除一個項目。**Empty Trash** 會先詢問，再移除 Trash 中的所有項目。超過 30 天的項目會永久移除。

::: warning 有些刪除會立即生效
刪除設計系統、標誌或個人資料照片時，不會移至 Trash。命令列與終端機應用程式也會立即刪除。
:::

開啟[同步](/info/sync.html)時，**Restore an earlier copy** 可還原整部裝置在較早某天的狀態，而 **Export my data** 檔案可還原檔案包含的內容。
