# 找回你的成果

你在 Lolly 中做出的一切都會留在你製作時所用的瀏覽器或應用程式裡，留在那台裝置上，除非你開啟[同步](/info/sync.html)。已儲存的作品在**專案**裡。下載的檔案會在你的瀏覽器或系統放置它的地方，通常也會有一份副本等在**素材**裡。在九個工具中，你從未儲存過的作品也會被保留。本頁會逐一說明這些情況，此外還會談到關閉的分頁、清除的瀏覽器資料、較早的版本、已刪除的項目，以及移到另一台裝置。

| 你做了什麼 | 該去哪裡查看 |
|---|---|
| 按過**另存為**或**儲存** | **專案** |
| 按過**下載** | 你瀏覽器的下載記錄，以及**素材**中的一份副本 |
| 都沒按過，且用的是[會隨手儲存的九個工具](#the-nine-tools-that-save-as-you-work)之一 | **專案**和 **History** |
| 都沒按過，且用的是其他工具 | 只留在你操作時所在的那個分頁，直到你關閉它 |
| 移到了垃圾桶 | **專案**裡的**垃圾桶**方塊，保留 30 天 |

## 找到你儲存的內容

1. 按工具左上角的**首頁**。
2. 開啟首頁頂端的**專案**分頁（在手機上是一個資料夾圖示）。
3. 看第一個畫面。儲存到**我的資料庫**的作品就在那裡，每個專案則是一個資料夾。要一次搜尋所有資料夾，請在畫面底部輸入**搜尋所有專案…**。

一個項目會以你在匯出面板中輸入的檔案名稱命名，如果沒有輸入，則以它的工具命名，例如**QR Code**。開啟這個項目，所有設定都會恢復，可以隨時修改並再次匯出。要以這種方式保留新作品，請見[儲存與接續](/info/using.html#saving-continuing)。

::: note 不在專案裡？
- 它可能在**垃圾桶**中：見[找回你刪除的內容](#get-back-something-you-deleted)。
- 另一個瀏覽器、隱私視窗或另一台裝置都是從空白開始的，除非你使用[同步](/info/sync.html)或[移動你的作品](#move-your-work-to-another-device)。
- 如果你只按過**下載**，見[找到你下載的檔案](#find-a-file-you-downloaded)。
:::

::: details 在專案中操作
你也可以從**設定 → 儲存空間 → 已儲存的工作階段 → 在專案中整理**開啟**專案**。它的使用方式就像一個檔案管理員：

![專案還沒有任何已儲存內容時的樣子：新增資料夾、新增資產和範本方塊，右上角的 History 時鐘按鈕，以及底部的搜尋所有專案欄](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **可巢狀的資料夾。** 把已儲存的工作階段分到資料夾裡，資料夾裡還能再放資料夾，想放多深都行。建立資料夾、重新命名，或把方塊拖到另一個資料夾上以移動它；麵包屑可帶你走回上層。未指定資料夾的已儲存工作階段會直接顯示在**專案**的最上層。
- <!--i:clock--> **依你的方式排序。** 右上角滑桿按鈕開啟的**檢視選項**提供**格線**或**清單**，並可依**名稱**、**加入日期**、**最後修改**（預設）、**大小**，以及在資料夾內的**依工具**排序。不論使用哪種排序，資料夾一律排在最前面 - 排序只會在各自的群組內排列工作階段與資料夾。
- <!--i:document--> **新作品直接歸檔。** **新增資產**會開啟共用選擇器。選擇**範本**即可從已儲存的範本開始：開啟範本進行編輯，或使用**+ 新增**立即儲存一項新作品。
- <!--i:checklist--> **多選（桌機）。** 勾選方塊上的核取方塊、在空白處拖出選取框，或用 **Shift/Cmd 點按**；在方塊上**按右鍵**可叫出快捷選單。選取列隨後會提供**算繪選取範圍**、**移至…**、**新增資料夾**、**刪除**（會移到垃圾桶）、針對二到八個單一工具工作階段的**一起編輯**（並排開啟在一個側邊欄下），以及**以試算表編輯**，它會把任意數量或任意混合的選取項目以列的形式開在批次格線中。
- <!--i:download--> **整個資料夾或選取範圍一起算圖。** **算圖資料夾**會把資料夾中每一個已儲存的工作階段 - 包含子資料夾 - 匯出成一個巢狀的 `.zip`。**算繪選取範圍**對任何多重選取做同樣的事，而單一工作階段則直接算成它自己的檔案。不需要 Batch/Pro。
- <!--i:link--> **直接跳到某個工具的已儲存成果。** 在工具庫上勾選一個或多個工具，從選取列選**檢視工作階段** - 專案就會只顯示用那些工具做的工作階段，並附一個**清除**讓你回到完整檢視。
- <!--i:link--> **分享已儲存的工作階段。** 在工作階段上按右鍵（在手機上，按方塊上的 **•••**）→ **分享連結**，即可複製一個以相同設定重新開啟它的連結；你裝置上的圖片不會隨連結一起傳遞（完整的分享對話框見[分享你的作品](/info/using.html#sharing-your-work)）。
- <!--i:pentool--> **重新命名或複製一個。** 在工作階段上按右鍵（在手機上，按方塊上的 **•••**），可以選擇**重新命名**、**重複**（在同一資料夾內產生一份副本）與**移至…**。

![專案中的檢視選項彈出視窗：版面配置提供格線和清單，排序依據設為最後修改，旁邊是一個反向排序的按鈕](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

## 如果你關閉了分頁或離開了工具

回來多少內容，取決於你是怎麼離開的、用的是哪個工具：

- **你關閉了分頁，或過一段時間才回來。** 未儲存的作品會消失，除了[九個工具](#the-nine-tools-that-save-as-you-work) - 它們會隨操作儲存你的更改：從**專案**中開啟它們。
- **你在同一個分頁裡重新載入了頁面。** 你的設定會從頁面地址中恢復。在這九個工具之外的工具中，你從裝置加入的圖片和檔案，以及長於 150 個字元的單行文字，都不會恢復，因為地址裡不包含它們。
- **你按了首頁，或左上角的返回按鈕。** 如果你自上次儲存、下載或複製以來又改動了什麼，一個**未儲存的變更**對話框會詢問是否先儲存。**儲存並離開**會儲存作品並帶你前往**專案**，或回到你開啟這份作品時所在的專案資料夾。**不儲存並離開**會直接離開；在這九個工具中，你的更改已經儲存好了，會留在專案中。**取消**會讓你留在工具裡。

只有當你按下工具裡的**首頁**或返回按鈕時，Lolly 才會詢問。關閉分頁、重新載入頁面，以及瀏覽器自帶的上一頁按鈕，都不會觸發詢問。為求保險，離開工具前請按**另存為**，或在匯出面板中按**儲存**。

::: note 不小心沒儲存就離開了？
在這九個工具之外的工具中，請立刻按瀏覽器的上一頁按鈕。頁面地址中的設定會恢復，但你從裝置加入的圖片不會。然後在做任何其他事情之前，先按**另存為**和**儲存**：這一次 Lolly 在你離開前不會再詢問。
:::

::: details 會隨手儲存的九個工具
[Design](/#/tool/design)、[Chart](/#/tool/chart)、[QR Code](/#/tool/qr-code)、[Gradient](/#/tool/gradient)、[Snippet](/#/tool/snippet)、[Flow Chart](/#/tool/org-chart)、[Pricing](/#/tool/pricing-table)、[Wordmark](/#/tool/wordmark) 和 [Text](/#/tool/text-helper)。隨著更多工具具備自動儲存能力，這份清單還會持續增加。

在這些工具中，你的第一次更改就會把作品歸檔到**專案**中，就像你已經儲存過一樣，之後的更改也會在幾秒內被保留。因此，即使你關閉了分頁，一份未儲存的創作仍然會留在專案中，**不儲存並離開**也不會捨棄你的更改。從首頁重新開啟該工具會開始一份新的創作；要開啟先前那份，請從專案中開啟。

此功能僅在網頁版應用程式中有效，桌面版和行動版應用程式不支援，與他人即時協作時也不支援。
:::

## 找到你下載的檔案

在瀏覽器中，**下載**會把檔案交給你的瀏覽器，由瀏覽器儲存到它的下載資料夾（通常是 **Downloads**）中，或者詢問你儲存位置。Lolly 不會被告知檔案去了哪裡，所以請查看你瀏覽器的下載清單。

如果沒有出現檔案，請趁你還在工具中時查看匯出面板。在**下載**下方，有一列會顯示檔名和時間，並附有 **Retry download**；在 Chrome、Edge 等以 Chromium 為基礎的瀏覽器中，還有 **Save file…** 可以讓你自行選擇資料夾。這一列及其檔案會一直保留，直到你離開工具、重新載入或再次匯出。

每次下載之後，Lolly 還會保留兩樣東西：

- **檔案的一份副本**，存放在**素材**的**你的上傳項目**下，前提是**設定 → 你的算圖**下的**將我的算繪結果存到我的資料庫**處於開啟狀態（**設定**在首頁底部）。此設定預設開啟。影片，或超過 50 MB 的檔案，會先詢問，zip 則不會被複製。
- **你用過的設定**，保留最近 24 次下載的設定。**專案**中已儲存作品下方的**最近匯出**，會用這些設定重新開啟工具，方便你再次產生檔案，不過你從裝置加入的圖片和檔案不包含在內。同一份清單也在**設定 → 活動與統計 → 最新匯出**下，以及 **History** 的 **Changes** 分頁中。這份清單保留的是設定，而不是檔案本身。

::: details 在桌面和行動應用程式中
- **桌面應用程式：** **下載**會直接儲存到你 **Downloads** 資料夾裡的一個 **Lolly** 資料夾中，不會彈出對話框。一則訊息會確認儲存，並提供**顯示**來查看檔案。**Window** 或 **Exports** 選單裡的 **Open Exports Folder**，可以隨時開啟這個資料夾。和先前檔案同名的檔案，會儲存為「name (1)」。
- **iPhone 和 iPad：** 檔案會儲存在 **Files** app 的 **Lolly** 底下，並會開啟分享面板，方便你轉發出去。
- **Android：** 會開啟分享選單，讓你選擇檔案要去哪裡。

在 iPhone、iPad 和 Android 上，新檔案會取代先前同名的那一個。
:::

## 回到較早的版本

- **在這次造訪期間：** **復原**可以回退最近 100 次更改，直到你離開工具或重新載入。見[復原與取消復原](/info/using.html#undo-and-redo)。
- **在那九個會隨手儲存的工具中：** 每份創作的較早版本都會被保留。按下面的步驟操作。
- **裝置上的一切：** 開啟[同步](/info/sync.html)後，**設定 → 已連接的服務**下的 **Restore an earlier copy**，可以復原最近七份每日副本之一，或是你上次套用之前的那份副本。這樣一來，這台裝置上的一切都會與那份副本一致，而不只是某一份設計。

要在這九個工具之一中開啟較早的版本：

1. 按 **History**，也就是**復原**和**取消復原**旁邊的時鐘按鈕。在 Design 中，**History** 位於頂端列；在手機上，按 **•••**，然後按 **History**。
2. 依日期和時間找到相應版本。**Automatic checkpoint** 列是你操作過程中自動產生的；**Saved version** 列則是你儲存的時刻。
3. 按 **Open as a copy**。該版本會作為一份新創作開啟，而你原本開啟的那一份保持不變。這份副本會出現在**專案**中，名稱後面帶有「(copy)」。

要依名稱保留一個版本，請按 **Name version**，輸入一個名稱，然後按 **Keep milestone**。具名版本會列在 **History** 頁面的 **Milestones** 底下。

::: details History 面板與 History 頁面
**History** 面板還會列出 **Recovered work** 列，**Protected drafts** 則保存著你在各檢查點之間的最新更改，並提供 **Open draft as a copy**。**Compare** 和 **Check assets** 可以幫助你在開啟一份副本之前先做判斷。把 **This creation** 切換為 **All history on this device**，即可查看所有創作。

**Automatic checkpoint** 會隨著時間推移而變得稀疏：最近一小時內每分鐘一個，最近一天內每小時一個，30 天內每天一個，此後每週一個。已儲存的版本則全部保留。從**設定 → 儲存空間**刪除一份創作，也會一併刪除它的所有版本。

**History** 頁面（`#/history`，或面板裡的 **Open app history**）涵蓋了這個瀏覽器裡的每一份創作。在電腦上，可以從首頁或**專案**右上角的時鐘按鈕開啟這個頁面。在手機上，前往首頁的工具庫，按右上角的圓形標誌按鈕，選擇 **Saved sessions**，即可開啟 History。從**專案**裡點這一項目前還沒有反應。

- **Recent** 列出你的創作，最新的排在最前，並附有**繼續**。
- **Changes** 把檢查點、下載記錄和轉換結果放在同一條時間軸上。下載記錄附有 **Reopen settings**。
- **Milestones** 列出具名的版本。

可以依專案、工具和日期篩選（在手機上收在**Filters**裡）。History 頁面沒有刪除按鈕；要移除某一項，請使用專案。
:::

## 把你的作品移到另一台裝置

| 目的 | 方法 |
|---|---|
| 讓你的裝置保持同步 | **設定 → 已連接的服務**下的**跨裝置同步**：見[同步你的裝置](/info/sync.html) |
| 一次性移動全部內容 | **匯出我的資料**和**匯入資料…**，見下文 |
| 交出單一設計或單一專案 | 一個 `.lolly` 檔案：**匯出**，然後**分享**，然後**下載 .lolly**；要交出整個專案，則用資料夾選單裡的**下載專案 (.lolly)**。在另一台裝置上按**開啟**。見 [.lolly 檔案](/info/using.html#the-lolly-file) |

分享連結會攜帶你的設定，但不會攜帶你從裝置上加入的圖片或檔案。

::: warning 匯入會取代你的資料夾
如果另一台裝置上已經有作品，請先讀這一段。匯入會加入檔案裡保存的內容，更新相符的項目，且不會刪除任何已儲存的項目。不過，個人檔案是單一記錄，所以那台裝置上的資料夾、我的最愛、範本和詳細資訊，會被檔案裡的內容取代。只存在於那台裝置上的已儲存項目會被保留，出現在**專案**的頂層。同步中的 **Bring it to this device**，效果也是一樣的。
:::

要一次性移動全部內容：

1. 在舊裝置上，開啟**設定 → 儲存空間**，在**移動到其他裝置**底下按**匯出我的資料**。Lolly 會下載一個檔名以 `LollyTools-` 開頭的 `.zip` 檔案。
2. 透過 USB、寄電子郵件給自己、AirDrop 或共用資料夾，把檔案帶到新裝置上。
3. 在新裝置上，開啟**設定 → 儲存空間**，按**匯入資料…**，選擇該檔案，然後按**匯入**。

::: note 留在原地的內容
登入資訊、金鑰和同步複雜密碼都留在各自的裝置上。最近下載記錄、離線下載內容和 AI 模型不會透過任何途徑傳輸。版本歷史只會隨**匯出我的資料**檔案傳輸，不會透過同步或 `.lolly` 傳輸。同步保存在你儲存空間裡的那些副本，只能透過同步開啟，無法用**匯入資料…**或**開啟**開啟。
:::

::: details 備份檔案包含的內容
檔案名為 `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`（名稱中的各部分來自你的個人檔案，未設定時會省略；`<n>` 是按天計數的序號，避免同一天的匯出互相衝突）。它包含你的個人檔案，含資料夾、垃圾桶、範本和我的最愛；每一個已儲存的工作階段及其縮圖；你上傳的圖片、字型、標誌和下載內容的副本；你的設計系統；你的偏好設定（主題、側邊欄寬度、本機活動統計）；來自轉換的已儲存版本與結果；以及，僅限網頁版應用程式，你創作內容的版本歷史。

目錄快取不包含在內 - 它會在新裝置上自行重新下載。每個部分都帶有檢查碼，因此傳輸中損壞的檔案會在匯入時被抓出來，而不會被還原成半殘的狀態。已儲存的工作階段會自動重新連結到你匯入的圖片。網頁版、桌面版和行動版應用程式都讀取同一個檔案；終端機應用程式則會寫出它自己較簡單的備份，本格式不會讀取那種備份。**📦 Export my data & render everything** 會產生同一個檔案，外加第二個 zip，裡面是每個已儲存工作階段算繪出的輸出結果。（完整格式規格見[資料傳輸](/info/data-transfer.html)。）
:::

## 如果你清除了瀏覽器資料

在網頁版應用程式中，Lolly 把一切都保存在你瀏覽器為這個網站分配的儲存空間裡：已儲存的作品、圖片、字型、設計系統、版本歷史與離線下載內容。在瀏覽器中清除這個網站的資料，會把這一切全部清除，Lolly 也無法把任何一項找回來。留下來的只有那些已經離開瀏覽器的東西：你下載的檔案、一份**匯出我的資料**檔案、一份[同步](/info/sync.html)副本，以及你分享過的連結。

::: warning 清除瀏覽器資料之前
請按**設定 → 儲存空間**下的**匯出我的資料**，並把這個檔案保存到別處。
:::

應用程式啟動時，Lolly 會請求瀏覽器在裝置空間不足時不要清除它的儲存空間。但最終由瀏覽器決定。在**設定 → 可離線使用**底下，如果有一行以 **Protected** 開頭，代表瀏覽器同意了；如果顯示的是「The browser may clear downloads if the device runs low on space」，代表瀏覽器沒有同意，這時可以按**保護下載內容**再次請求。如果瀏覽器沒有同意，那麼在空間不足時，它可能不只會清除下載內容，也會清除已儲存的作品，所以請保留一份最近的**匯出我的資料**檔案。

**設定 → 儲存空間**會顯示每種資料各佔用了多少空間。**清除快取**會捨棄已下載的目錄檔案，需要時會重新下載。**清除我的所有資料**會要求你輸入一個詞，然後清除你的個人檔案、已儲存的工作階段、上傳的圖片和素材快取。其他資料會保留，包括版本歷史、最近下載記錄、轉換結果、設計系統與已下載的 AI 模型。要清除全部內容，請在瀏覽器中清除這個網站的資料。

![手機寬度螢幕上的儲存空間卡片：裝置上每一類資料都列出名稱，底部是「清除我的所有資料」按鈕](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

在桌面和行動應用程式中，已儲存的工作階段是應用程式自己資料資料夾裡的檔案，其餘內容則存放在應用程式自己的儲存空間裡，因此清除網頁瀏覽器並不會影響它們。

::: details 桌面和行動應用程式把已儲存的工作階段存放在哪裡
每個已儲存的工作階段都是 `saved-state` 資料夾中的一個檔案：

- macOS：`~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows：`%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux：`~/.local/share/tools.lolly.Desktop/saved-state/`，或 `$XDG_DATA_HOME` 下的相同路徑
- iPhone、iPad 和 Android：位於應用程式自己的儲存空間內部，**Files** app 不會顯示它

圖片、設計系統和最近下載記錄會留在應用程式的內部儲存空間中，不在這些資料夾裡。終端機應用程式和命令列讀取的是同一個 `saved-state` 資料夾：見[已儲存的工作階段存放在哪裡](/info/cli-reference.html#where-saved-sessions-live)。
:::

## 找回你刪除的內容

在**專案**中，**移到垃圾桶**會把一個項目保留 30 天。一個資料夾連同裡面的一切會作為一個條目移入垃圾桶。操作後馬上會出現一則訊息，提供大約十秒鐘的**復原**。之後：

1. 開啟**專案**，按**垃圾桶**方塊。這個方塊只有在垃圾桶裡有內容時才會出現。
2. 按項目旁邊的**還原**。

**永久刪除**和**清空垃圾桶**會立即移除項目，不會再詢問。超過 30 天的項目，會在你下次開啟專案時被永久移除。

::: warning 其他刪除是永久性的
在**設定 → 儲存空間**底下刪除一個已儲存的工作階段，或者從圖庫中某個工具的已儲存工作階段清單裡刪除（在工具卡片上按右鍵，然後選擇**N 個已儲存的工作階段**），都會連同其版本歷史一起永久移除該工作階段。從**我的圖片**中刪除一張圖片則會立即移除，不會再詢問。
:::

開啟[同步](/info/sync.html)後，**Restore an earlier copy** 可以把整台裝置復原到較早某一天的狀態，而一份**匯出我的資料**檔案則會帶回該檔案所保存的內容。
