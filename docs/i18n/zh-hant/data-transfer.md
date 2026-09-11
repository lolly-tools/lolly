# 資料傳輸 - `lolly-backup` 打包檔

Lolly 使用者累積的一切都存放在**自己的裝置上** - 沒有帳號，沒有雲端。資料傳輸打包檔就是搬移這些資料的方式：在一台裝置上匯出，透過任何方式攜帶該檔案（USB、AirDrop、寄給自己的電子郵件、網路共用），再匯入另一台裝置。檔案本身*就是*傳輸方式。目標裝置可以離線或連線，兩者沒有差別，因為整個過程完全不會與任何伺服器通訊。

![搬移整個安裝環境的兩個按鈕:匯出我的資料寫入一個 zip,匯入資料再讀回](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

本頁面是格式規格說明。若需終端使用者的操作說明，請見 [Using Lolly → Moving to another device](/info/using.html)。實作程式碼位於 [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts)，而 [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) 則固定了往返（round-trip）的契約。

> **範圍。** 打包檔攜帶的是*使用者資料*，而非工具。工具與目錄資產是另外同步的，並假設目標裝置上已經存在（最壞情況下版本較新）。匯入絕不會安裝或升級任何工具。

## 目標

- <!--i:box--> **一種格式，通用於所有殼層。** 網頁版 PWA、Tauri 桌面／行動應用程式，以及未來任何殼層，產生與讀取的都是同一份位元組。打包檔就是契約，每個殼層的能力橋接層則是背後的平台專屬轉接器。
- <!--i:shieldcheck--> **經得起旅途考驗。** 傳輸過程中損毀或截斷的打包檔，會在匯入時明確失敗，絕不會只還原一半。
- <!--i:clock--> **比目前版本活得更久。** 較舊版本的應用程式仍可匯入較新打包檔中可辨識的部分。真正不相容的格式則會被乾淨地拒絕。
- <!--i:check--> **可安全合併。** 匯入到已在使用中的安裝環境時，絕不會清除打包檔中未包含的任何資料。

## 封裝格式

打包檔是一個單純的 `.zip` 檔。下載檔案會以其所屬的人命名 - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`(例如 `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - 讓下載資料夾中的備份檔保持可辨識。名字與姓氏這兩部分來自個人檔案，未設定時則省略。沒有個人檔案時會產生 `LollyTools-2026-06-26-1.zip`，只有名字時則產生 `LollyTools-Ada-2026-06-26-1.zip`。每個部分都會被清理為檔名安全的字串（保留 Unicode 文字／數字，移除空格與標點，上限 32 個字元）。`<n>` 是同一天、同一裝置下的序號，因此同一天重複匯出不會互相衝突，並維持順序。[`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) 中的 `backupFilename()` 負責建立此名稱。無論檔名為何，zip 的內容都是相同的。內容如下：

| 路徑 | 是否必要 | 內容 |
|---|---|---|
| `manifest.json` | 是 | 格式 id、版本、數量與各部分的完整性資訊。是讀取端最先查看的內容。 |
| `profile.json` | 有設定時 | 使用者的 `me` 記錄（姓名、聯絡方式、大頭照參照、旗標）。透過 `host.profile` 讀取。 |
| `sessions.json` | 是 | 每一個已儲存的工作階段：欄位、工具 id／版本、標籤、縮圖（data-URL）與完整輸入資料。透過 `host.state` 讀取。 |
| `assets.json` | 是 | 每個已上傳資產（圖片、字型、品牌 token）的中繼資料，各自指向 `assets/blobs/` 下的位元組。 |
| `assets/blobs/<n>.<ext>` | 依資產而定 | 原始資產位元組（圖片與字型檔案）。以未壓縮方式儲存（本身已是壓縮格式）。副檔名僅供辨識參考，`assets.json` 中的 MIME 才是權威依據。 |
| `prefs.json` | 是 | 使用者自有的本機偏好設定：`theme`、`sidebarWidth`，以及 `ct-metrics` 活動統計。 |
| `lolly.txt` | 是 | 打包檔的人類可讀摘要（數量、個人檔案、檔名），供未使用 Lolly 開啟 zip 的人參考。每次匯出都會重新產生，且匯入時會被辨識，因此絕不會被算作跳過的部分。它是在完整性對照表*之後*才寫入的，因此不包含在其中。 |

打包檔刻意採用單純的 zip 格式：無論透過何種方式傳輸都能保持完整，且任何解壓縮工具都能檢視其內容。

`profile.json` 是最小的一部分，也是在應用程式中最先被讀取端看到的部分：由製作者填寫一次的詳細資料，以及讓工具得以使用這些資料的選擇性開啟設定。

![會轉換成 profile.json 的個人檔案詳細資料表單 - 姓名、聯絡方式、大頭照，以及旁邊的選擇性開啟設定](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| 欄位 | 意義 |
|---|---|
| `format` | 恆為 `lolly-backup`。沒有此欄位的檔案會被拒絕，回報「不是 Lolly 備份檔」。 |
| `formatVersion` | 此打包檔**寫入**時所採用的版面配置。只要部分項目集合或結構有任何變動就會遞增。讀取端**不會**以此欄位作為判斷依據。 |
| `minReader` | **安全**匯入此打包檔所需的最低讀取端版本。讀取端就是以此欄位作為判斷依據。 |
| `app` | 產生此打包檔的應用程式 id，供診斷用途。 |
| `exportedAt` | 打包檔建立時的 ISO 時間戳記。 |
| `counts` | 寫入端放入了哪些內容，供顯示與合理性檢查之用。 |
| `integrity` | 選填。將除 `manifest.json` 以外的每個部分，對應到其**未壓縮**位元組的 SRI 風格 `sha256-<base64>` 摘要值。 |

## 版本政策（向前相容性）

`formatVersion` 與 `minReader` 之間的區分，正是讓此格式得以演進、同時不會拋棄較舊安裝環境的關鍵：

- 當 `manifest.minReader ≤` 讀取端自身的版本時，讀取端就會匯入該打包檔。只有在打包檔明確要求更新版本的讀取端時，才會拒絕匯入（顯示「需要更新版本的應用程式」）。
- **新增式**變動 - 例如新增一個*選填*的部分，或新增一個選填的資訊清單欄位 - 會使 `formatVersion` 遞增，但 `minReader` 保持不變。較舊版本的應用程式仍會匯入它們所能辨識的每一個部分；無法辨識的部分則會被跳過（見下文），而非無聲丟棄。
- **破壞性**變動 - 例如錯誤匯入某個部分會導致資料損毀，或原本選填的部分變成必要 - 會提高 `minReader`。較舊版本的應用程式便會乾淨地拒絕匯入，而不會嘗試處理它無法應付的內容。
- 若未來的打包檔設定了 `formatVersion` 卻省略了 `minReader`，讀取端會保守地退回以 `formatVersion` 作為判斷依據（將此變動視為破壞性變動）。

> **給作者的經驗法則：** 如果每個現有的讀取端，即使忽略你新增的內容，仍能表現正確，那就是新增式變動 - 遞增 `formatVersion`，`minReader` 保持不變。否則就要提高 `minReader`。

## 完整性

當 `manifest.integrity` 存在時，讀取端會在**寫入任何內容之前**，驗證所列出每個部分的 SHA-256。若不相符（「未通過完整性檢查」）或缺少某個部分（「不完整」），整個匯入程序就會中止 - 不會有部分還原的情況。這能捕捉檔案傳輸過程中可能造成的損毀（例如中斷的 AirDrop、重新編碼附件的電子郵件閘道、損壞的 USB 磁區）。

完整性檢查在設計上是盡力而為：只有在 Web Crypto 可用時（所有安全的瀏覽器情境與現代 Node）才會寫入，也只有在對照表與 Web Crypto 皆存在時才會進行驗證。沒有對照表的打包檔 - 例如完整性機制出現之前建立的打包檔 - 會照常匯入，不受影響。「無法驗證」絕不會被視為「已損毀」。

資訊清單既不會列出自己，也不會列出重新產生的 `lolly.txt` 說明檔。摘要值涵蓋的是資訊清單所擔保的各個部分。

## 匯入語意

匯入採**合併覆寫**方式，絕不會全部取代：

- 目標裝置上既有的資料維持原狀。
- 任何發生衝突的鍵值 - 個人檔案、工作階段欄位、已上傳圖片的 id - 都會被匯入的版本取代。
- 打包檔中未包含的內容一律不會被觸動。目標裝置原有、但打包檔中沒有的工作階段，會在匯入後依然存在。

已儲存的工作階段會自動重新連結到其圖片：資產參照是以 id 保留的，橋接層會在已上傳圖片還原之後重新解析它們（無論如何都必須這麼做，因為 `blob:` URL 無法在重新載入後保留）。

匯入摘要會回報 `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`。`failedAssets` 計算的是無法還原的已上傳資產（例如裝置儲存空間已滿）。這與 `skipped` 不同，後者計算的是來自向前相容的較新寫入端、但此版本無法辨識的部分。使用者介面會呈現 `skipped`（「…‧N 個較新的項目已跳過」），讓還原結果誠實地呈現遺漏的內容。

## 不會被傳輸的內容

- **目錄快取**（已下載的資產中繼資料與位元組、工具索引） - 會在目標裝置上免費重新同步。
- **工具與品牌資產** - 不在範圍內，並假設目標裝置上已經存在。
- **`blob:` ／物件 URL** - 由橋接層在載入時重新產生。
- **匯出序號計數器** - 用於每日下載檔名編號的計數器（`localStorage` 鍵值 `lolly-export-seq`）只是本機命名的便利機制。它不列於 `PREF_KEYS` 中，因此絕不會出現在打包檔內。

儲存空間計量表會列出相同的分類。已儲存的工作階段與「我的圖片」會被納入打包檔中；資產快取、工具預覽以及下方的離線固定項目，皆可重新產生，因此不會被納入。

![儲存空間計量表將此裝置的資料分成具名類別，其中「已儲存的工作階段」與「我的圖片」與「資產快取」分開追蹤，此處為全新安裝、每個類別皆尚未有內容的畫面](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## 跨殼層保證

`data-transfer.ts` 只透過能力橋接（`host.profile`、`host.state`、`host.assets`）與共用的 `localStorage` 偏好設定來讀寫。因為橋接是唯一的接縫，即使底層儲存不同 - 網頁版是 IndexedDB，Tauri 是檔案系統 - *同一個*模組仍會在每個殼層產生位元組完全相同的輸出。Tauri 殼層原封不動地重用這個模組，只有它們的 `host.state` 實作不同。無頭測試針對記憶體內的橋接執行完整的往返測試，因此它可以代表所有殼層。

有兩個殼層基於不同原因不在此保證範圍內：

- **一次性 CLI** 沒有東西要保留 - 它的狀態存在記憶體中，每次呼叫後即消失。
- **TUI** 確實會保留狀態（`~/.lolly`：sessions、folders、profile），其 Profile 畫面也能備份它，但寫出的是它*自己較簡單*的封存格式：每個 session 一個 `sessions/<slot>.json`，再加上 `profile.json` 和 `folders.json`，沒有 manifest、沒有 `formatVersion`/`minReader`，也沒有完整性對照表。這個格式**無法**用本文的方式匯入 - 讀取器會拒絕它，判定為「不是 Lolly 備份」 - 而且容易混淆的是它用了類似的名稱（`lolly-backup-<stamp>.zip`）。統一這兩者是已知的落差。

## 保留的擴充點

信封格式設計上是一份 manifest 加上一組具名的部分，讓日後新型態的可攜資料能**不需破壞性變更**就搭上這個格式。它們會以附加部分的形式加入（新的 `formatVersion`，相同的 `minReader`），而目前的讀取器會跳過它不認得的內容。這些項目在[路線圖](/info/overview.html#roadmap)上，尚未實作。之所以在此保留這些名稱,是為了讓格式在它們到位時仍保持一致。

- **`tokens.json` - 設計權杖（design tokens）。** 一份 [W3C DTCG](https://tr.designtokens.org/format/) 設計權杖文件（[Penpot 匯入匯出](https://help.penpot.app/user-guide/design-systems/design-tokens/)所用的格式 - 帶有 `$value`/`$type`/`$description` 的權杖,並組織成群組、集合與主題）。封裝中的權杖集合可讓使用者在安裝之間連同 session 一起搬移品牌基本元素。長期來看,匯入的權杖集合會成為工具與調色盤資產所依循解析的第一等來源。
- **`penpot/` - 匯入的 Penpot 檔案。** 為匯入並*以工具形式*呈現的 Penpot 檔案（或其擷取出的、與 Lolly 相關的子集）保留的目錄。封裝將會攜帶這個匯入定義,讓它與使用者其餘的資料一起移動。

對讀取器而言,任何不在這些保留名稱與上述部分之列的內容,都是未知部分：原封不動地保留,並計入 `skipped`。

## 參考

- 模組：[`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts)（`exportBackup`、`importBackup`、`BACKUP_FORMAT`、`BACKUP_FORMAT_VERSION`、`BACKUP_READER_VERSION` - 命名用的 `backupFilename()` 為內部函式）。
- 合約測試：[`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - 涵蓋往返、合併、完整性、向前相容與讀取器把關等案例。
- 使用的橋接介面：`host.profile`、`host.state`、`host.assets` - 詳見 [Host API](/info/host-api.html)。
