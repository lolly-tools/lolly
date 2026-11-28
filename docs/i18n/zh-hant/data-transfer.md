# 資料移轉：`lolly-backup` 組合包

備份組合包可搬移 Lolly 保存在裝置上的個人資料庫：在一個安裝環境匯出，攜帶檔案（USB、AirDrop、寄電子郵件給自己或網路共用），再匯入另一個安裝環境。匯出與匯入不需要伺服器，目標裝置也可以離線。

這是供圍繞備份建置宿主程式、工具或指令碼的人使用的格式規格。若要搬移自己的作品，請閱讀[將作品移到另一部裝置](/info/find-your-work.html#move-your-work-to-another-device)。

![移轉整個安裝實例的兩個按鈕：Export my data 寫出一個 zip，Import data 將它讀回](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note 範圍
組合包攜帶的是*使用者資料*，不包含目錄工具。目錄工具與目錄素材會另外同步，並假定目標環境已有這些內容，至多是較高版本。使用者製作的工具會放在 `profile.json` 中傳遞。匯入絕不會安裝或升級目錄工具。
:::

<!--i:eti-badge-check-->
## 目標

- <!--i:box--> **一種格式，適用所有宿主程式。** 網頁應用程式、桌面與行動應用程式，以及未來的宿主程式，共用相同的封裝與部分結構描述。選用部分取決於各宿主程式的能力，不支援的部分會被回報。每個能力橋接層都提供自己的儲存介接器。
- <!--i:shieldcheck--> **完整移轉。** 傳輸中損壞或遭截斷的組合包，會在匯入時失敗並顯示錯誤，絕不會只還原一半。
- <!--i:clock--> **跨版本使用。** 舊版應用程式會匯入新版組合包中可辨識的部分。不相容的格式會被明確拒絕。
- <!--i:check--> **安全合併。** 匯入已在使用中的安裝環境，絕不會清除任何不在組合包中的內容。

<!--i:eti-package-->
## 封裝

組合包是一般的 `.zip`。它可透過任何方式完整傳輸，也可用任何解壓縮工具檢查內容。

下載檔案依擁有者命名：`LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`，例如 `LollyTools-Ada-Lovelace-2026-06-26-1.zip`。名字與姓氏取自個人資料，未設定時會省略：沒有個人資料時為 `LollyTools-2026-06-26-1.zip`，只有名字時則為 `LollyTools-Ada-2026-06-26-1.zip`。每個姓名部分都會轉成可安全用於檔名的 token（保留 Unicode 字母與數字，移除空格與標點，最多 32 個字元）。`<n>` 是每部裝置每天各自的序號，因此同一天重複匯出不會衝突，且會保持順序。`data-transfer.ts` 中的 `backupFilename()` 負責建立名稱。名稱不會改變 zip 的內容。

| 路徑 | 必要 | 內容 |
|---|---|---|
| `manifest.json` | 是 | 格式識別碼、版本、數量與各部分的完整性。讀取器會先讀取此檔案。 |
| `profile.json` | 有設定時 | 使用者的 `me` 記錄：姓名、聯絡資料、頭像參照與旗標，加上資料夾、Trash、專案藍圖、使用者範本與使用者製作的工具、我的最愛、隱藏的工具、語言與表情符號選擇。透過 `host.profile` 讀取。 |
| `sessions.json` | 是 | 每個已儲存的工作階段：儲存槽、工具識別碼與版本、標籤、縮圖（資料 URL）與完整輸入資料。透過 `host.state` 讀取。 |
| `assets.json` | 是 | 每個已上傳素材的中繼資料（圖片、字型、品牌 token、標誌、下載內容的已儲存副本），各自指向 `assets/blobs/` 下的位元組。 |
| `assets/blobs/<n>.<ext>` | 每個素材 | 素材的原始位元組，不經壓縮儲存，因為大多數已是壓縮格式。副檔名只供辨識；以 `assets.json` 中的 MIME 類型為準。 |
| `assets/blobs/<n>.c2pa` | 存在時 | 擷取出的 Content Credentials，保留確切的二進位位元組，由素材記錄中的 `_credentialFile` 參照。這些不是裝置簽署金鑰。 |
| `design-systems.json` | 存在時 | 在此安裝環境中製作或加入的設計系統，形式為 `{ active, records }`。請見[匯入規則](#import-rules)。 |
| `file-history.json` | 選用 | 具版本的素材快照、已完成的檔案操作報告，以及完整的批次 manifest，另有自己的版本。由宿主程式內部的 `fileHistory` 備份介接器提供。 |
| `revision-history.json` | 選用，手動備份 | 穩定的創作識別碼、保留的檢查點、縮圖與輪替的復原草稿。支援時由 `host.state.history.backup` 提供。 |
| `file-history/versions/` | 每個快照 | 過去的素材位元組與擷取出的憑證，無論目前的素材是否仍存在。 |
| `file-history/results/` | 每個已完成操作 | 確切的輸出位元組。不會保存或包含任何為轉換而選取的原始檔案。 |
| `prefs.json` | 是 | 屬於使用者的本機偏好設定：`theme`、`sidebarWidth` 與 `ct-metrics` 活動計數。 |
| `lolly.txt` | 是 | 組合包的易讀摘要（數量、個人資料、檔名），供未使用 Lolly 開啟 zip 的人閱讀。每次匯出都會重新產生，匯入時也能辨識，因此絕不會計為略過的部分。它在完整性對照表之後寫入，因此對照表不涵蓋此檔案。 |

::: details 匯出如何寫入 zip
匯出會逐一寫入 zip 的各部分（`shells/web/src/lib/zip-stream.ts`）。上傳內容、已儲存的結果與素材版本，會以 4 MiB 分片讀取，絕不整份讀入。已儲存的結果與版本會先與其記錄的 SHA-256 核對。接著讀取每個檔案，計算檢查碼與完整性摘要值，而 zip 會直接參照原位置的檔案。

不會重新編碼任何內容。每個部分都保留確切的位元組與摘要值，因此帶有 Content Credentials 的檔案會保留其簽章涵蓋的位元組。若各部分與時間相同，zip 會與先前記憶體內寫入器的結果完全一致，唯一例外是超過 16 MiB 的歷史檔案會分段壓縮。`tests/backup-streaming.test.ts` 會對照記錄的參考摘要值檢查這點。

在 Node 中以 192 MiB 的合成資料庫測量，完成備份所需的額外記憶體約為 125 至 150 MiB，記憶體內寫入器則約需 850 MiB（`node scripts/bench-backup-finalise.ts`）。匯入仍會將整個 zip 讀入記憶體。
:::

<!--i:eti-file-->
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
| `format` | 一律為 `lolly-backup`。缺少此值的檔案會以「不是 Lolly 備份」為由拒絕。 |
| `formatVersion` | 此組合包**寫入**時採用的結構配置。部分的集合或結構有任何變更時就會遞增。讀取器**不會**依此欄位判定是否接受。 |
| `minReader` | 能**安全**匯入此組合包的最低讀取器版本。讀取器以此欄位判定是否接受。 |
| `app` | 產生組合包的應用程式識別碼，供診斷使用。 |
| `exportedAt` | 組合包建立時的 ISO 時間戳記。 |
| `counts` | 寫入器放入的內容，供顯示與合理性檢查使用。 |
| `integrity` | 選用。將 `manifest.json` 以外的每個部分，對應至其**未壓縮**位元組的 SRI 風格 `sha256-<base64>` 摘要值。 |

<!--i:eti-tag-->
## 版本政策

兩個版本號碼讓格式能持續擴充，同時讓舊版安裝環境仍可使用。

![組合包格式的變更分為新增式與破壞式：新增式可由舊讀取器忽略，破壞式則會因錯誤匯入而損壞資料。新增式會遞增 formatVersion 並保留 minReader；破壞式會遞增 formatVersion 並提高 minReader。讀取器會在 minReader 不高於自身版本時匯入。](/info/diagrams/concepts/backup-version-gate.svg)

- 當 `manifest.minReader` 不高於讀取器自身版本時，讀取器就會匯入組合包。只有當組合包要求較新的讀取器時，才會以「需要較新版本的應用程式」為由拒絕。
- **新增式**變更，例如新的選用部分或新的選用 manifest 欄位，會遞增 `formatVersion`，並保持 `minReader` 不變。舊版應用程式仍會匯入每個可辨識的部分，無法辨識的部分會回報為已略過，不會默默捨棄。
- **破壞式**變更，例如錯誤匯入某個部分會損壞資料，或選用部分變成必要部分，會提高 `minReader`。舊版應用程式隨後會明確拒絕，而不會匯入無法處理的內容。舊版應用程式隨後會明確拒絕該組合包。
- 如果未來的組合包設定了 `formatVersion` 卻省略 `minReader`，讀取器會改以 `formatVersion` 判定，並將該變更視為破壞式變更。

::: note 給作者的判斷原則
如果所有現有讀取器忽略你新增的內容後，仍能正確運作，這就是新增式變更：遞增 `formatVersion`，保持 `minReader` 不變。否則就提高 `minReader`。
:::

<!--i:eti-shield-check-->
## 完整性

當 `manifest.integrity` 存在時，讀取器會在**寫入任何內容之前**，檢查每個列出部分的 SHA-256。不相符（「完整性檢查失敗」）或缺少部分（「不完整」）都會使匯入停止，因此不會有部分還原。這能偵測傳輸損壞：遭截斷的 AirDrop、重新編碼附件的電子郵件閘道，或 USB 的損壞磁區。

完整性採盡力而為方式。只有在 Web Crypto 可用時（所有安全的瀏覽器環境與現代 Node）才會寫入，且只有對照表與 Web Crypto 都存在時才會檢查。沒有對照表的組合包，例如完整性功能出現之前的備份，仍會照常匯入：「無法驗證」絕不等於「已損壞」。

manifest 不會列出自身，也不會列出重新產生的 `lolly.txt`。

<!--i:eti-download-->
## 匯入規則

匯入會以兩種模式之一執行。

- **Merge** 是 **Import data…** 與首次加入同步時的 **Bring it to this device** 所使用的模式。目標上的資料會保留，組合包以外的內容一律不動。
- **Replace** 是裝置同步用來讓各裝置保持一致的模式。它採用同步副本的個人資料記錄、偏好設定、工作階段、圖片與啟用的設計系統選擇。它只會移除另一部裝置自上次同步後刪除的項目。還原較早副本時，會先儲存裝置資料，再讓裝置與該副本一致，並移除副本未包含的所有內容。[同步你的裝置](/info/sync.html)說明使用者會看到的內容。

合併時會依下列方式處理各種資料：

| 資料 | 目標上已存在 | 只在組合包中 |
|---|---|---|
| 工作階段（依儲存槽）與上傳的圖片（依識別碼） | 保留較近期儲存的副本，因此舊備份絕不會覆寫較新的作品。時間相同或未知時，保留目標的副本。 | 加入 |
| 資料夾 | 保留目標的名稱與父資料夾，並將組合包中目標資料夾缺少的成員加入。已歸入目標資料夾的工作階段仍留在原處。 | 加入 |
| 我的最愛（工具、目錄素材與 Projects 項目） | 合併 | 加入 |
| 範本、Projects 範本與使用者工具（依識別碼） | 保留目標的記錄。 | 加入 |
| Trash 項目 | 保留目標的項目。 | 加入，讓在任一安裝環境中可還原的項目仍可還原。若項目的資料夾已在目標上恢復使用，或其 Trash 儲存槽已被目標使用，則省略該項目。 |
| 其他個人資料欄位（姓名、聯絡資料、語言、功能旗標、隱藏的工具與其他設定） | 保留目標的值。 | 目標欄位空白時採用 |
| 偏好設定（`prefs.json`） | 保留目標的值。 | 目標沒有時寫入 |
| 設計系統（依識別碼） | 組合包的記錄取代目標的記錄。 | 加入。只有當目標沒有自己的設計系統時，才會套用組合包所選的啟用項目。 |
| 創作歷史 | 較近期儲存的副本維持為目前版本，另一份則保留為受保護的草稿。 | 加入 |

**已儲存的工作階段會自動重新連結到其圖片。** 素材參照依識別碼保留。橋接層會在圖片還原後重新解析參照，因為 `blob:` URL 無法在重新載入後保留。

**歷史記錄寫入後絕不改變。** 重複匯入素材版本與操作識別碼不會加入任何內容，而已指向不同位元組或歷史記錄的識別碼會被拒絕，不會被覆寫。重新匯入完全相同的目前素材會保留其版本，變更後的目前素材則必須帶有不同版本。

**創作歷史還有幾項規則。** 如果某項創作的儲存槽已在目標上用於另一項創作，就會將它加入為獨立的創作；目標 Trash 中的創作則仍留在原處。如果某個檢查點識別碼在目標上指向不同內容，就保留目標的內容。封存檔若未通過自身檢查，會在更改任何個人資料、工作階段、素材或偏好設定之前停止匯入；重複匯入完全相同的內容不會增加儲存空間用量。

**摘要會回報發生的事。** 每次匯入都會回傳 `profile`、`sessions`、`userAssets`、`prefs`、`skipped` 與 `failedAssets`。

- `failedAssets` 計算無法還原的已上傳素材，例如因裝置儲存空間已滿。
- `skipped` 計算較新寫入器產生、但此建置版本無法辨識的部分。應用程式會顯示數量（「… · 已略過 N 個較新項目」）。
- 包含檔案歷史時，摘要會加入 `assetVersions`、`fileOperations`、`fileBatches` 與 `failedHistory`。儲存空間耗盡或不可變識別碼衝突，可能造成部分還原，應用程式這時會告知使用者保留來源備份。
- 包含創作歷史時，會加入 `revisions` 與 `recoveryDrafts`，只計算此次匯入新增的內容，並以 `added`、`kept`、`replaced`、`copies` 與 `hidden` 表示每項創作的合併方式。`skippedCheckpoints` 計算識別碼在目標上指向不同內容的檢查點，`historyLeftOut` 則計算裝置的歷史儲存空間容納不下的較舊檢查點與草稿。
- 取代匯入會加入 `removed` 與 `failedRemovals`。

還原並不是橫跨個人資料、工作階段、素材與歷史記錄儲存區的單一交易。在部分還原或不支援的還原之後，雲端同步**不會**推進已套用的修訂版本，因此副本會保留，供再次嘗試。

<!--i:eti-unlink-->
## 不會隨同移轉的內容

- **目錄快取**（已下載的素材中繼資料與二進位資料、工具索引），目標裝置會重新同步這些內容。
- **目錄工具與目錄素材**，假定目標裝置上已經存在。使用者新增的品牌 token、字型與標誌屬於使用者素材，會隨同移轉。
- **`blob:` 與物件 URL**，橋接層會在載入時重新產生。
- **轉換原始檔、有效的執行租約，以及機器本機的存取或簽署機密。** 這些不是可攜的歷史記錄。儲存的結果是一份副本，不代表原始來源已備份。
- **匯出序號計數器**，也就是 `localStorage` 中每天用於下載命名的計數器（`lolly-export-seq`）。它不列入 `PREF_KEYS`，因此絕不會隨套件移轉。

儲存空間計量表也顯示相同的區分。Saved sessions、My images 與 File results & versions 會納入套件。素材快取、工具預覽與離線固定項目可重新建立，會留在原裝置。

![儲存空間計量表將這部裝置的資料分成具名類別，Saved sessions 與 My images 和 Asset cache 分開計算；此處為剛安裝的狀態，每個類別仍是空的](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Lolly Work 的組織資料

這個套件備份裝置的個人資料庫。套件不是 **Lolly Work** 實例的備份。組織帳號、存取政策、共用專案、目錄版本、核准、渲染工作與稽核記錄都由該服務保存。重新連線並登入，即可再次存取共用作品。匯入個人套件並不會授予該存取權。

營運者依照 Lolly Work 自己的指南備份、保留與清除伺服器資料：[備份與還原](/info/work-operations.html#backup-and-restore)以及 [Lolly Work 儲存與資料生命週期](/info/work-data-lifecycle.html)。清除或匯出裝置資料都不會執行這些伺服器操作。

<!--i:eti-monitor-->
## 跨執行外殼

`data-transfer.ts` 只透過能力橋接層（`host.profile`、`host.state`、`host.assets`）與共用的 `localStorage` 偏好設定讀寫資料。同一個模組會在網頁、桌面與行動應用程式中，透過 IndexedDB 或檔案系統儲存讀寫共通的封裝格式。選用的歷史記錄部分只會在其配接器可用時出現。匯入會將不支援的部分回報為已略過。無介面測試套件使用記憶體內的橋接層測試共通部分，歷史記錄交易也有真實瀏覽器測試。

有兩種執行外殼不在這項保證範圍內：

- **單次執行的 CLI** 沒有需要攜帶的內容：其狀態位於記憶體中，只維持一次呼叫。
- **TUI** 將狀態保存在 `~/.lolly`（工作階段、資料夾、個人資料）。其 Profile 檢視會寫出自己較簡單的備份封存檔：每個工作階段各有 `saved-state/<slot>.json`，另加 `profile.json` 與 `folders.json`，沒有 manifest、`formatVersion`、`minReader` 或完整性對照表。本格式的讀取器會以「不是 Lolly 備份」拒絕該封存檔，雖然名稱相似（`lolly-backup-<stamp>.zip`）。兩者尚未統一是已知缺口。

<!--i:eti-clock-->
## 尚無法攜帶的內容

新的可攜資料種類日後可作為新增部分加入（新的 `formatVersion`、相同的 `minReader`）。設計系統已透過這種方式移轉，以 `design-systems.json` 加上其使用者素材的形式攜帶。

有兩個名稱保留給尚未隨同移轉的資料：

- **`tokens.json`** 預計攜帶一份 [W3C DTCG](https://tr.designtokens.org/format/) 設計 token 文件，包含其群組、集合與主題，也就是 [Penpot 匯入與匯出](https://help.penpot.app/user-guide/design-systems/design-tokens/)的格式。使用者自己的品牌 token 已以 `user/tokens/brand` 素材的形式，在 `assets.json` 中隨同移轉，設計系統的 token 則隨其記錄移轉。
- **`penpot/`** 保留給已匯入的 Penpot 檔案，或其中與 Lolly 相關的子集，並以工具的形式呈現。

<!--i:eti-history-->
## 歷史記錄部分

兩個歷史記錄部分都是選用的，各有自己的版本。

::: details 創作歷史記錄（v3）
具有創作歷史記錄的網頁安裝版本，其手動備份包含 `revision-history.json`，採用自己的 `{ version: 1, documents, revisions, recoveries }` 結構。它攜帶保留的 ID、標準化的輸入快照、版本戳記、點陣預覽與各寫入者獨立的草稿。歷史記錄配接器在一次讀取交易中擷取目前的工作階段及其最新修訂，而 `sessions.json` 會使用相同的目前快照，供舊版讀取器使用。

還原會先檢查負載的 SHA-256 與位元組數、識別碼的唯一性、文件與最新修訂的關係、祖先關係、時間戳記、預覽類型與限制，再以單一交易提交封存檔。已壓縮的父項參照可能不存在。現有的目前作品絕不會被悄悄取代：兩邊都有同一件創作時，未保留為目前版本的一邊會成為受保護的草稿。

封存檔的傳輸上限為 384 MiB。儲存限制的執行不會截斷保留的檢查點。匯出會分塊寫入 `revision-history.json` 與 `sessions.json`，產生的位元組與單次 `JSON.stringify` 相同，因此不會將整份檔案文字同時保存在記憶體中。歷史記錄檔一旦超過上限就會被捨棄，之後只繼續計算大小。接著會移除最舊的自動檢查點並重新製作封存檔，匯出摘要會將那些檢查點計入 `checkpointsLeftOut`，否則就拒絕產生封存檔。

沒有這項能力的執行外殼會還原一般工作階段，並將歷史記錄部分回報為已略過。在配接器提供持久的歷史記錄交易之前，原生檔案系統的歷史記錄仍不受支援。私人協作中的訪客沒有持久的歷史記錄或復原封存檔。

個人快照同步不包含創作歷史記錄。將快照套用至有歷史記錄的本機文件時，會將先前的工作狀態保留為獨立的復原草稿，並使所有已開啟編輯器的寫入 token 失效。其不可變的檢查點會留在裝置上。這會在快照取代時保護本機歷史記錄，但不會合併不同裝置同時產生的歷史記錄。

歷史素材參照會保留，而渲染仍會透過目的地現有的資料庫解析素材。這份封存檔尚不保證能取得完全相同的舊素材位元組或舊工具渲染結果。素材版本與檔案結果的位元組會透過各自的備份部分移轉。
:::

::: details 已儲存的版本與檔案結果（v2）
選用的歷史記錄部分保存 `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`，讀取器也接受較早、不含批次的 history-v1 結構。每個快照都提供穩定的素材 ID 與確切版本、儲存時間、位元組長度與十六進位 SHA-256，以及一筆素材記錄，其 `_file` 與選用的 `_credentialFile` 指向二進位部分。操作記錄攜帶原始檔案的資訊、請求、報告、時間戳記與選用的結果 `_file`。儲存後端名稱、OPFS 控制代碼與執行租約不會隨同移轉。只認得 history v1 的讀取器會在匯入前拒絕新的歷史記錄版本，因此批次成員關係絕不會被悄悄捨棄。

批次 manifest 會在處理前記錄每個選取的來源，包括從未讀取的檔案、已取消的成員、無法預留結果空間的情況與中斷的工作。每個成員都有穩定的操作 ID、來源參照與資訊、要求的輸出名稱以及最終報告。未讀取的來源只有宣告的資訊，不會捏造摘要值。匯入會驗證成員識別，以及與隨附操作報告的一致性。即使個別結果已移除，Lolly Batch 報告仍可取得，但回條並不代表輸出的位元組仍有儲存。

- **先驗證。** 在匯入個人資料或素材而寫入任何內容之前，會先驗證每筆已知的歷史記錄、報告與參照檔案。即使封裝中沒有完整性對照表，缺少位元組或 SHA-256 不符仍會導致失敗。擷取的憑證保持為位元組陣列，包括從舊版寫入器匯入、以數字鍵物件序列化的憑證。
- **執行中的工作。** 執行中的操作會在備份中成為中斷記錄，附有失敗報告且沒有結果。還原絕不會重新啟動背景工作或匯入有效租約。重試必須重新選取原始檔案，有已記錄的 SHA-256 時會進行比對。
- **儲存。** 還原的結果會在 IndexedDB 中一併提交位元組與中繼資料。一般的新結果在可用時使用 OPFS，否則使用 IndexedDB。匯入絕不會取代現有的進行中操作。
- **備份限制。** 匯出會將這些位元組以串流方式寫入封存檔，但還原仍會在記憶體中解壓縮整份備份，因此限制維持不變：**256 MiB 的歷史記錄負載**、**4 MiB 的歷史記錄中繼資料**，最多 **100 筆操作**、**100 個批次**與 **2,000 個快照**。匯出會明確拒絕過大或不完整的歷史記錄，絕不會悄悄略過。在移除較舊的本機副本前，請先逐一下載重要版本與結果。這些限制不是經實測得出的手機尖峰記憶體用量保證。
- **本機容量限額。** 本機結果歷史記錄的容量限額為 512 MiB，記錄數上限為 100 筆。素材快照另有 512 MiB 的容量限額，每個素材最多 20 個歷史版本，擷取的憑證位元組也計入該限額。還原會遵守這些限制，絕不會悄悄移除現有的使用者資料。
- **批次中繼資料。** 本機批次中繼資料另有 4 MiB 的容量限額，最多 100 份 manifest，每個批次最多 20 個成員。待處理成員會預留中繼資料容量，每個成員的報告上限為 32 KiB。這是邏輯限額，不是瀏覽器磁碟空間的保證：實際發生配額不足時會顯示錯誤，記憶體內的報告仍可下載。重試批次成員會建立新批次，不會覆寫舊報告。移除批次記錄不會移除個別結果的位元組或資料庫素材。
- **資料庫中的結果。** 轉換結果可直接加入資料庫，不經正規化或重新編碼，並附上來源與輸出的雜湊值以及操作關聯。重複加入時會重用未變更的副本，已編輯的副本絕不會被覆寫。點陣圖片可用來建立新的 Lolly Design 文件，使用目前的資料庫素材 ID。在 Lolly Design 的整個執行階段與 URL 路徑中強制鎖定確切版本，屬於另一項工作。SVG、HTML、PDF 與 ZIP 結果會保留為不解析內容的檔案素材，不會升格為受信任的互動或向量內容。
- **使用者在哪裡看到這些內容。** **Convert → Recent file operations** 顯示歷史記錄用量、報告、下載與版本管理員；版本管理員也能找出已刪除資料庫素材的較早版本。還原快照會建立新的目前版本，並保留所選快照。**Settings → Preferences → Storage** 會將結果與版本和可捨棄的快取分開計算。
- **清理。** 明確執行暫存檔清理時，只會移除操作所擁有、且未被參照的位元組。目前記錄會保護其檔案，近期的 OPFS 檔案則有一小時的寬限期。已儲存的結果與素材快照不會自動清除。

舊版讀取器仍接受 v2 封裝（`minReader: 1`），並還原它們認得的部分，將不支援的歷史記錄部分計為已略過。完整復原歷史記錄需要具有 `fileHistory` 配接器的執行外殼；這是執行外殼內部的銜接點，不是面向工具的 `HostV1` 能力。本機 Chromium 驗收關卡涵蓋真正的雙裝置還原。在已安裝的桌面、iOS 與 Android 應用程式上的復原，仍需分別驗收。
:::

<!--i:eti-code-->
## 參考資料

- 模組：`shells/web/src/data-transfer.ts`（`exportBackup`、`importBackup`、`BACKUP_FORMAT`、`BACKUP_FORMAT_VERSION`、`BACKUP_READER_VERSION`；`backupFilename()` 命名函式為內部使用）。
- 契約測試：`tests/data-transfer.test.ts`，涵蓋往返、合併、完整性、向前相容性與讀取器門檻。
- 歷史記錄契約測試：`tests/file-history-backup.test.ts`、`tests/file-batch-history.test.ts` 與 `tests/file-result-library.test.ts`。瀏覽器驗收：`tests/file-history.browser.test.ts`、`tests/file-batch-history.browser.test.ts` 與 `tests/file-result-reuse.browser.test.ts`。
- 使用的橋接介面：`host.profile`、`host.state` 與 `host.assets`；請見 [Host API](/info/host-api.html)。
