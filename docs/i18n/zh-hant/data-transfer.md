# 資料轉移：`lolly-backup` 套件

Lolly 把你的個人資料庫保存在裝置上。備份套件就是這個資料庫移動的方式：在一個安裝上匯出，用你喜歡的任何方式攜帶檔案（USB、AirDrop、寄給自己的電子郵件或網路共享），然後在另一個安裝上匯入。匯出與匯入不需要伺服器，目標也可以離線。

本頁是格式規格，寫給圍繞備份建置外殼、工具或指令碼的人：zip 裡有什麼、版本如何把關、匯入如何合併，以及檢查什麼。給搬移自己作品的人的逐步說明是[將你的作品移到另一部裝置](/info/find-your-work.html#move-your-work-to-another-device)。

![搬移整個安裝的兩個按鈕：Export my data 寫出一個 zip，Import data 讀回它](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **範圍。** 套件攜帶的是*使用者資料*，不是目錄工具。目錄工具與目錄素材是另外同步的，並假設目標上已經存在，最差也是較高的版本。使用者自己製作的工具則包含在 `profile.json` 中傳遞。匯入絕不安裝或升級目錄工具。

## 目標

- <!--i:box--> **一種格式，每個外殼。** 網頁應用程式、桌面與行動應用程式以及未來的外殼共用相同的封套與部分結構描述。選用部分取決於各外殼的能力，不支援的部分會被回報。每個能力橋接提供自己的儲存配接器。
- <!--i:shieldcheck--> **能撐過旅程。** 在傳輸中被破壞或截斷的套件在匯入時會明確失敗，絕不會只還原一半。
- <!--i:clock--> **比這個版本活得更久。** 較舊的應用程式仍可匯入較新套件中它認得的部分。真正破壞性的格式則會被乾淨地拒絕。
- <!--i:check--> **可安全合併。** 匯入到已在使用的安裝上，絕不會抹除不在套件中的任何東西。

## 封裝格式

套件是普通的 `.zip`，所以能在任何傳輸中完整保存，任何解壓縮工具都能檢查其內容。

下載檔以它所屬的人命名：`LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`，例如 `LollyTools-Ada-Lovelace-2026-06-26-1.zip`，讓放滿備份的 Downloads 資料夾保持可讀。名與姓來自個人資料，未設定時省略：沒有個人資料時為 `LollyTools-2026-06-26-1.zip`，只有名時為 `LollyTools-Ada-2026-06-26-1.zip`。每個名稱會被簡化為檔名安全的 token（保留 Unicode 字母與數字，去掉空格與標點，最多 32 個字元）。`<n>` 是每天、每部裝置的序號，所以同一天重複匯出不會衝突並保持順序。`data-transfer.ts` 中的 `backupFilename()` 建立這個名稱，而無論名稱為何，zip 的內容都相同。

| 路徑 | 必要 | 內容 |
|---|---|---|
| `manifest.json` | 是 | 格式 id、版本、計數與各部分的完整性。讀取者首先看的東西。 |
| `profile.json` | 有設定時 | 使用者完整的 `me` 記錄：姓名、聯絡資料、大頭照參照與旗標，加上資料夾、垃圾桶、專案藍圖、使用者範本與使用者自製的工具、最愛、隱藏的工具、語言與表情符號選擇。透過 `host.profile` 讀取。 |
| `sessions.json` | 是 | 每個已儲存的工作階段：欄位、工具 id 與版本、標籤、縮圖（資料 URL）與完整的輸入資料。透過 `host.state` 讀取。 |
| `assets.json` | 是 | 每個上傳素材（圖片、字型、品牌 token、標誌、下載內容的儲存副本）的中繼資料，各自指向 `assets/blobs/` 下的位元組。 |
| `assets/blobs/<n>.<ext>` | 每個素材 | 原始素材位元組，不壓縮儲存，因為大多數已經是壓縮格式。副檔名只是外觀；以 `assets.json` 中的 MIME 類型為準。 |
| `assets/blobs/<n>.c2pa` | 存在時 | 以精確的二進位位元組擷取的 Content Credentials，由素材記錄中的 `_credentialFile` 參照。這些不是裝置簽署金鑰。 |
| `design-systems.json` | 存在時 | 在這個安裝上製作或新增的設計系統，格式為 `{ active, records }`。請見[匯入規則](#import-rules)。 |
| `file-history.json` | 選用 | 有版本的素材快照、完成的檔案操作報告與完整的批次 manifest，具有自己的版本。由外殼內部的 `fileHistory` 備份配接器提供。 |
| `revision-history.json` | 選用，手動備份 | 穩定的創作 ID、保留的檢查點、縮圖與滾動的復原草稿。在支援之處由 `host.state.history.backup` 提供。 |
| `file-history/versions/` | 每個快照 | 先前的素材位元組與擷取的憑證，無論目前的素材是否仍存在。 |
| `file-history/results/` | 每個完成的操作 | 精確的輸出位元組。為轉換而選取的原始檔案不會被保留或包含。 |
| `prefs.json` | 是 | 使用者擁有的本機偏好設定：`theme`、`sidebarWidth` 與 `ct-metrics` 活動統計。 |
| `lolly.txt` | 是 | 套件的可讀摘要（計數、個人資料、檔名），供沒有 Lolly 而開啟 zip 的人使用。每次匯出都會重新產生，並在匯入時被辨識，所以從不算作略過的部分。它在完整性對照表之後寫入，所以對照表不涵蓋這個檔案。 |

::: details 匯出如何寫入 zip
匯出一次寫入 zip 的一個部分（`shells/web/src/lib/zip-stream.ts`）。上傳內容、儲存的結果與儲存的素材版本以 4 MiB 的片段讀取，絕不整個讀入，而儲存的結果與版本會先對照其記錄的 SHA-256 檢查。然後讀取每個檔案以取得其校驗碼與完整性摘要，zip 就在原處參照它。

不會重新編碼任何東西，所以帶有 Content Credentials 的檔案保留其簽章涵蓋的確切位元組，每個部分也保留其確切位元組與摘要。對於相同的部分與時間，zip 與較早的記憶體內寫入器產生的相同，只是超過 16 MiB 的歷史檔案會分段壓縮。`tests/backup-streaming.test.ts` 對照記錄的參考摘要檢查這一點。

在 192 MiB 的合成資料庫上，於 Node 中測量，完成備份在資料庫之外額外用了約 125 到 150 MiB，而記憶體內寫入器約為 850 MiB（`node scripts/bench-backup-finalise.ts`）。匯入仍會把整個 zip 讀入記憶體。
:::

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| 欄位 | 意義 |
|---|---|
| `format` | 一律為 `lolly-backup`。沒有它的檔案會被拒絕，並顯示「not a Lolly backup」。 |
| `formatVersion` | 這個套件**寫出**時使用的版面。部分組合或結構有任何更動時就提高。讀取者**不**以此欄位把關。 |
| `minReader` | 能**安全**匯入這個套件的最低讀取者版本。這是讀取者據以把關的欄位。 |
| `app` | 產生的應用程式 id，供診斷使用。 |
| `exportedAt` | 套件建立的 ISO 時間戳記。 |
| `counts` | 寫入器放入了什麼，供顯示與合理性檢查。 |
| `integrity` | 選用。將除 `manifest.json` 之外的每個部分，對應到其**未壓縮**位元組的 SRI 風格 `sha256-<base64>` 摘要。 |

## 版本政策

兩個版本號讓格式能成長，而不會讓較舊的安裝被擱置。

![套件格式的變更不是累加式（舊讀取者可以忽略），就是破壞性（錯誤的匯入會造成損毀）。累加式會提高 formatVersion 並保持 minReader；破壞性會提高 formatVersion 並提高 minReader。當 minReader 不超過讀取者自己的版本時，讀取者就會匯入。](/info/diagrams/concepts/backup-version-gate.svg)

- 當 `manifest.minReader` 不超過讀取者自己的版本時，讀取者就會匯入套件。只有當套件要求更新的讀取者時，它才會拒絕，並顯示「needs a newer version of the app」。
- **累加式**變更，例如新的選用部分或新的選用 manifest 欄位，會提高 `formatVersion` 並保持 `minReader` 不變。較舊的應用程式仍會匯入它們認得的每個部分，而不認得的部分會被回報為略過，而不是悄悄捨棄。
- **破壞性**變更，也就是對某個部分的錯誤匯入會損毀資料，或選用部分變成必要時，會提高 `minReader`。較舊的應用程式隨後會乾淨地拒絕，而不是匯入它們無法處理的東西。
- 如果未來的套件設定了 `formatVersion` 但省略了 `minReader`，讀取者會退而以 `formatVersion` 把關，並將該變更視為破壞性。

> **給作者的經驗法則：**如果每個現有的讀取者忽略你的新增後仍會做對的事，該變更就是累加式：提高 `formatVersion` 並保持 `minReader`。否則就提高 `minReader`。

## 完整性

當 `manifest.integrity` 存在時，讀取者會在**寫入任何內容之前**檢查每個列出部分的 SHA-256。不相符（「failed its integrity check」）或缺少部分（「incomplete」）會讓整個匯入停止，所以不會有部分還原。這能抓出檔案傳輸可能造成的損壞：被截斷的 AirDrop、重新編碼附件的電子郵件閘道、壞掉的 USB 磁區。

完整性檢查是盡力而為。它只在有 Web Crypto 的地方寫入（每個安全的瀏覽器環境與現代 Node），並且只在對照表與 Web Crypto 都存在時才檢查。沒有對照表的套件（例如完整性出現之前的套件）會原樣匯入：「無法驗證」絕不算作「已損毀」。

manifest 既不列出它自己，也不列出重新產生的 `lolly.txt`。摘要涵蓋 manifest 所擔保的部分。

## 匯入規則

匯入以兩種模式之一執行。

- **Merge** 是 **Import data…** 所做的，也是同步首次加入 **Bring it to this device** 所做的。目標上的資料會保留，也不會動到任何不在套件中的東西：目標有而套件沒有的工作階段會在匯入後保留下來。
- **Replace** 是裝置同步用來讓裝置保持一致的方式：它取用同步副本的個人資料記錄、偏好設定、工作階段、圖片與使用中設計系統的選擇，並且只移除自上次同步以來其他裝置刪除的項目。還原較早的副本更進一步，會讓裝置與該副本相符，在先儲存裝置之後，移除副本不含的所有東西。[同步你的裝置](/info/sync.html)涵蓋人們看到什麼。

在合併中，只存在於目標上的任何東西都會保留，而套件中的每種資料以如下方式與目標會合：

| 資料 | 目標上已存在 | 僅在套件中 |
|---|---|---|
| 工作階段（依欄位）與上傳的圖片（依 id） | 保留較近期儲存的副本，所以較舊的備份絕不會覆寫較新的作品。時間相同或未知時，保留目標的副本。 | 加入 |
| 資料夾 | 保留目標的名稱與上層，資料夾並取得套件中它所缺少的成員。在目標上歸檔於某資料夾的工作階段仍歸檔在那裡。 | 加入 |
| 最愛（工具、目錄素材與 Projects 項目） | 合併 | 加入 |
| 範本、Projects 範本與使用者工具（依 id） | 保留目標的記錄。 | 加入 |
| 垃圾桶項目 | 保留目標的項目。 | 加入，所以在任一個安裝上可還原的項目仍然可以還原。若項目的資料夾在目標上已被重新使用，或目標已使用其垃圾桶欄位，則省略該項目。 |
| 其他個人資料欄位（姓名、聯絡資料、語言、功能旗標、隱藏的工具與其他設定） | 保留目標的值。 | 在目標欄位為空處採用 |
| 偏好設定（`prefs.json`） | 保留目標的值。 | 在目標沒有之處寫入 |
| 設計系統（依 id） | 套件的記錄取代目標的。 | 加入。只有在目標沒有自己的設計系統時，套件的使用中選擇才會套用。 |
| 創作歷史 | 較近期儲存的副本維持為目前版本，另一份保留為受保護的草稿。 | 加入 |

**已儲存的工作階段會自動重新連結到其圖片。** 素材參照以 id 保存，橋接在圖片還原後重新解析它們，這本來就必須這麼做，因為 `blob:` URL 無法撐過重新載入。

**歷史記錄在寫入後絕不改變。** 重複匯入素材版本與操作 ID 不會增加任何東西，而已經指向不同位元組或歷史的 ID 會被拒絕，而不是被覆寫。重新匯入相同的目前素材會保留其版本，而更改過的目前素材必須帶有不同的版本。

**創作歷史還有幾條規則。** 目標已用於不同創作的欄位所屬的創作，會作為獨立的創作加入，而在目標垃圾桶中的創作留在那裡。指向目標上不同內容的檢查點 id 保留目標的。未通過自身檢查的封存檔會在任何個人資料、工作階段、素材或偏好設定改變之前讓匯入停止，而完全相同的重複匯入不會增加儲存空間。

**摘要回報發生了什麼。** 每次匯入都會回傳 `profile`、`sessions`、`userAssets`、`prefs`、`skipped` 與 `failedAssets`。

- `failedAssets` 計算無法還原的上傳素材，例如因為裝置儲存空間已滿。
- `skipped` 計算來自較新寫入者、這個建置版本不認得的部分。應用程式會顯示它（「… · N newer items skipped」），所以還原會說明它留下了什麼。
- 有檔案歷史時，摘要會加入 `assetVersions`、`fileOperations`、`fileBatches` 與 `failedHistory`。儲存空間耗盡或不可變 ID 衝突可能造成部分還原，此時應用程式會告訴人們保留來源備份。
- 有創作歷史時，它會加入 `revisions` 與 `recoveryDrafts`，只計算這次匯入加入的內容，以及說明每個創作如何合併的 `added`、`kept`、`replaced`、`copies` 與 `hidden`。`skippedCheckpoints` 計算 id 指向目標上不同內容的檢查點，`historyLeftOut` 則計算放不進裝置歷史空間的較舊檢查點與草稿。
- 取代式匯入會加入 `removed` 與 `failedRemovals`。

還原不是橫跨個人資料、工作階段、素材與歷史儲存的單一交易。雲端同步在部分或不支援的還原之後**不會**推進其已套用的修訂版，所以副本仍可重試。

## 不會被傳輸的內容

- **目錄快取**（已下載的素材中繼資料與 blob、工具索引），目標會免費重新同步。
- **目錄工具與目錄素材**，不在範圍內，並假設目標上已存在。使用者新增的品牌 token、字型與標誌是使用者素材，所以會隨之傳遞。
- **`blob:` 與物件 URL**，橋接在載入時重新產生。
- **轉換原件、執行中的即時租約，以及機器本機的存取或簽署密鑰。** 這些不是可攜的歷史。儲存的結果是副本，不保證原始來源有被備份。
- **匯出序號計數器**，也就是 `localStorage` 中每日下載命名的計數器（`lolly-export-seq`）。它被排除在 `PREF_KEYS` 之外，所以絕不會隨套件傳遞。

儲存量表顯示相同的區分。Saved sessions、My images 與 File results & versions 會進入套件。其下的素材快取、工具預覽與離線固定項目都可以重建，所以留在原處。

![儲存量表將這部裝置的資料分成具名類別，Saved sessions 與 My images 與 Asset cache 分開追蹤，此處是每個類別仍為空的全新安裝](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## 使用 Lolly Work 的組織資料

這個套件備份的是裝置的個人資料庫。它不是 **Lolly Work** 實例的備份：組織帳號、存取政策、共用專案、目錄版本、核准、渲染工作與稽核記錄由該服務保存。重新連線並登入即可重新取得對共用工作的存取；匯入個人套件不會授予該存取權。

營運者以 Lolly Work 自己的指南備份、保留與清除伺服器資料：[備份與還原](/info/work-operations.html#backup-and-restore)以及 [Work 儲存與資料生命週期](/info/work-data-lifecycle.html)。清除或匯出裝置並不會執行任何這些伺服器操作。

## 跨外殼

`data-transfer.ts` 只透過能力橋接（`host.profile`、`host.state`、`host.assets`）與共用的 `localStorage` 偏好設定讀寫。同一個模組在網頁與桌面及行動應用程式中，經由 IndexedDB 或檔案系統儲存，讀寫共通的封套。選用的歷史部分只在其配接器可用之處出現，而不支援的部分在匯入時會被回報為略過。無頭測試套件針對記憶體內橋接測試共通的部分，歷史交易也有真實瀏覽器的測試。

有兩個殼層基於不同原因不在此保證範圍內：

- **單次執行的 CLI** 沒有東西可攜帶：它的狀態在記憶體中，只持續一次呼叫。
- **TUI** 將狀態保存在 `~/.lolly`（工作階段、資料夾、個人資料），其 Profile 檢視可以備份它，但它寫出自己較簡單的封存檔：每個工作階段一個 `saved-state/<slot>.json`，加上 `profile.json` 與 `folders.json`，沒有 manifest，沒有 `formatVersion` 或 `minReader`，也沒有完整性對照表。這個格式無法匯入它（讀取者會以「not a Lolly backup」拒絕），而且它的名稱容易令人混淆地相似（`lolly-backup-<stamp>.zip`）。統一兩者是已知的缺口。

## 尚無法攜帶

封套是 manifest 加上具名的部分，所以新種類的可攜資料之後可以作為累加式部分加入（新的 `formatVersion`，相同的 `minReader`），而今日的讀取者會略過它們不認得的部分。設計系統已經以這種方式傳遞，作為 `design-systems.json` 加上其使用者素材。

有兩個名稱保留給尚無法傳遞的資料：

- **`tokens.json`** 會攜帶完整的 [W3C DTCG](https://tr.designtokens.org/format/) 設計 token 文件，包含其群組、集合與主題，也就是 [Penpot 匯入與匯出](https://help.penpot.app/user-guide/design-systems/design-tokens/)的格式。使用者自己的品牌 token 已經以 `assets.json` 中的 `user/tokens/brand` 素材傳遞，而設計系統的 token 隨其記錄傳遞。
- **`penpot/`** 保留給被攝取的 Penpot 檔案，或其與 Lolly 相關的子集，並以工具的形式呈現。

今日的讀取者兩個名稱都還不認得。就像上述部分之外的任何其他東西，對它們而言，兩者都是未知的部分：原封不動，並計入 `skipped`。

## 歷史部分

這兩個歷史部分是選用的，並有各自的版本。大多數讀取者可以略過本節。

::: details 創作歷史（v3）
來自具有創作歷史的網頁安裝的手動備份包含 `revision-history.json`，具有自己的 `{ version: 1, documents, revisions, recoveries }` 結構描述。它帶有保留的 ID、標準輸入快照、版本戳記、點陣預覽與獨立的寫入者草稿。歷史配接器在一次讀取交易中擷取目前的工作階段及其頭部，而 `sessions.json` 為較舊的讀取者使用相同的目前快照。

還原會在以單一交易提交封存檔之前，檢查酬載 SHA-256 與位元組數、唯一識別、文件與頭部關係、祖先關係、時間戳記、預覽類型與限制。壓縮的上層參照可能遺失。現有的目前作品絕不會被悄悄取代：當創作在兩邊都有時，未被保留為目前版本的那一邊會成為受保護的草稿。

封存檔的 384 MiB 傳輸限制會被明確檢查，儲存限制也會在不截斷保留的檢查點的情況下強制執行。匯出以區塊寫入 `revision-history.json` 與 `sessions.json`，位元組與單一 `JSON.stringify` 所給的相同，所以檔案文字絕不會整個持有。將超過限制的歷史檔案會在超過的那一刻被捨棄，並從那裡開始只計數。封存檔隨後會在沒有其最舊的自動檢查點的情況下重新製作，而匯出摘要將這些計為 `checkpointsLeftOut`，否則封存檔會整個被拒絕。

沒有此能力的外殼會還原一般的工作階段，並將歷史部分回報為略過。原生檔案系統歷史在其配接器提供持久的歷史交易之前仍不受支援。私人協作中的訪客沒有持久的歷史或復原封存檔。

個人快照同步會省略創作歷史。將快照套用到有歷史的本機文件，會把其先前的工作狀態保留為獨立的復原草稿，並使任何開啟中的編輯器的寫入權杖失效。其不可變的檢查點留在裝置上。這在快照取代期間保護本機歷史；它不會合併並行的裝置歷史。

歷史素材參照會被保留，而渲染仍透過目的地現有的資料庫解析素材。這個封存檔尚不保證確切的舊素材位元組或舊的工具渲染。素材版本與檔案結果的位元組在它們自己的備份部分傳遞。
:::

::: details 已儲存的版本與檔案結果（v2）
選用的歷史部分包含 `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`，讀取者也接受沒有批次的較早 history-v1 形狀。每個快照給出穩定的素材 ID 與確切版本、其儲存時間、位元組長度與十六進位 SHA-256，加上一個素材記錄，其 `_file` 與選用的 `_credentialFile` 指向二進位部分。操作帶有原始檔案事實、請求、報告、時間戳記與選用的結果 `_file`。儲存後端名稱、OPFS 控制代碼與執行租約不會傳遞。只認得 history v1 的讀取者會在匯入之前拒絕新的歷史版本，而不是悄悄捨棄批次成員。

批次 manifest 在處理之前記錄每個選取的來源，包括從未讀取的檔案、取消的成員、保留結果空間失敗以及中斷的工作。每個成員有穩定的操作 ID、來源參照與事實、要求的輸出名稱與最終報告。未讀取的來源有宣告的事實，而不是捏造的摘要。匯入會驗證成員身分，以及與任何攜帶的操作報告的一致性。個別結果被移除後批次報告仍然可用，但回條並不表示其輸出位元組仍被儲存。

- **先驗證。** 每個已知的歷史記錄、報告與被參照的檔案，都會在任何個人資料或素材匯入寫入之前驗證。即使封套沒有完整性對照表，缺少位元組與不相符的 SHA-256 仍會失敗。擷取的憑證保持為位元組陣列，包括來自把它們序列化為數字鍵物件的較舊寫入者的匯入。
- **執行中的工作。** 備份中執行中的操作會成為中斷的記錄，附有說明性的失敗報告，且沒有結果。還原絕不重新啟動背景工作，也不匯入使用中的租約。重試意味著再次選取原始檔案，並在可行時對照其記錄的 SHA-256 檢查。
- **儲存。** 還原的結果將其位元組與中繼資料一起提交到 IndexedDB。一般的新結果在可用時使用 OPFS，並有 IndexedDB 後備。現有的執行中操作絕不會被匯入取代。
- **備份限制。** 匯出將這些位元組以串流方式寫入封存檔，但還原仍會把整個備份解壓縮到記憶體中，所以限制依舊：**256 MiB 的歷史酬載**、**4 MiB 的歷史中繼資料**、最多 **100 個操作**、**100 個批次**與 **2,000 個快照**。匯出會明確拒絕過大或不完整的歷史，絕不悄悄省略它。在移除較舊的本機副本之前，請逐一下載重要的版本與結果。這些限制並不是對手機峰值記憶體的實測保證。
- **本機預算。** 本機結果歷史有 512 MiB 的預算與 100 筆記錄的上限。素材快照有獨立的 512 MiB 預算，每個素材最多 20 個歷史版本，而擷取的憑證位元組計入該預算。還原會遵守這些限制，絕不悄悄逐出現有的使用者資料。
- **批次中繼資料。** 本機批次中繼資料有獨立的 4 MiB 預算，最多 100 個 manifest，每個批次最多 20 個成員。待處理的成員會保留中繼資料容量，每個成員的報告上限為 32 KiB。這是邏輯預算，而不是瀏覽器磁碟空間的保證：真正的配額失敗會被顯示，記憶體中的報告仍可下載。重試批次成員會建立新的批次，而不覆寫舊的報告。移除批次記錄不會移除個別結果位元組或資料庫素材。
- **資料庫中的結果。** 轉換後的結果可以在不經正規化或重新編碼的情況下加入資料庫，並附上來源與輸出雜湊以及操作關係。重複加入會重複使用未更動的副本，而編輯過的副本絕不會被覆寫。點陣圖可以開始新的 Design 文件，它使用目前的資料庫素材 ID；在整個 Design 執行階段與 URL 路徑中強制精確版本固定則是另外的工作。SVG、HTML、PDF 與 ZIP 結果被保存為不透明的檔案素材，不會被升格為受信任的互動或向量內容。
- **人們在哪裡看到這些。** **Convert → Recent file operations** 顯示歷史用量、報告、下載與版本管理員，後者也能找到已刪除資料庫素材的較早版本。還原快照會建立新的目前版本，並保留選取的快照。**Settings → Preferences → Storage** 將結果與版本和可拋棄的快取分開計算。
- **清理。** 明確的暫存檔案清理只移除操作擁有且未被參照的位元組。目前的記錄保護其檔案，近期的 OPFS 檔案有一小時的寬限期。已儲存的結果與素材快照不會被自動清除。

較舊的讀取者仍接受 v2 封套（`minReader: 1`）並還原它們認得的部分，將不支援的歷史部分計為略過。完整的歷史復原需要具有 `fileHistory` 配接器的外殼，這是外殼內的接縫，而不是新的面向工具的 `HostV1` 能力。真實的雙裝置還原由本機 Chromium 關卡涵蓋；在已安裝的桌面、iOS 與 Android 應用程式上的復原仍待另行驗收。
:::

## 參考

- 模組：`shells/web/src/data-transfer.ts`（`exportBackup`、`importBackup`、`BACKUP_FORMAT`、`BACKUP_FORMAT_VERSION`、`BACKUP_READER_VERSION`；`backupFilename()` 命名器屬內部）。
- 契約測試：`tests/data-transfer.test.ts`，涵蓋往返、合併、完整性、向前相容性與讀取者關卡。
- 歷史契約測試：`tests/file-history-backup.test.ts`、`tests/file-batch-history.test.ts` 與 `tests/file-result-library.test.ts`。瀏覽器驗收：`tests/file-history.browser.test.ts`、`tests/file-batch-history.browser.test.ts` 與 `tests/file-result-reuse.browser.test.ts`。
- 使用的橋接介面：`host.profile`、`host.state` 與 `host.assets`；請見 [Host API](/info/host-api.html)。
