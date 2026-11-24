# Lolly 架構

![Lolly 圖示 - 大型綠白棒棒糖](/info/icon.svg)

本頁寫給修改 Lolly 程式碼的人：引擎、外殼與工具套件如何搭配，各自位於儲存庫的何處，以及每項變更都必須遵守的承諾。若要了解 Lolly 的用途與使用者，請先閱讀 [Lolly 如何運作](/info/how-lolly-works.html)。

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) 逐一介紹引擎模組，由程式碼產生。[威脅模型與信任邊界](/info/threat-model.html)從信任邊界的角度解讀同一套架構，並說明引擎將哪些內容視為不可信。

<!--i:eti-layers-->
## 整體概觀

頂層的工具是資料。中間的引擎不依賴任何平台。底層的外殼實作同一份契約，目錄則提供內容。

![工具向共用引擎提供 manifest、範本與掛鉤。Web、Tauri 與終端機外殼實作 HostV1 能力橋接介面，並從目錄讀取工具與素材。](/info/diagrams/concepts/platform-layers.svg)

凡是能以純資料與 Handlebars 描述的內容，都屬於**引擎**。凡是接觸 DOM、檔案系統、網路或任何瀏覽器或作業系統 API 的內容，都屬於**主機**，也就是橋接介面中外殼的一側。引擎是開源的。任何涉及特定品牌的內容都不會放進引擎。

<!--i:eti-folder-shared-->
## 儲存庫結構

Lolly 使用單一儲存庫。以下每個目錄都是一般目錄，只有 `brands/suse` 例外：它是含有 SUSE 工具套件與目錄的**私人** git 子模組，複製公開儲存庫時不會取得。內容設定檔（`profiles.json`）設定建置版本讀取哪些套件。每個程序各自解析自己的設定檔，沒有全域切換。[建置指南](/info/build-guide.html)提供複製指令，以及如何在私人套件內提交變更。

| 目錄 | 內容 |
|---|---|
| `engine/` | 與平台無關的核心：載入器、執行環境、輸入、範本、URL 模式、單位與格式模組 |
| `shells/` | 網頁應用程式、Tauri 桌面與行動應用程式、CLI、TUI 與瀏覽器擴充功能 |
| `packages/` | 工具作者 SDK（`@lolly-tools/core`）、共用的 Node 外殼元件與文件渲染器等 |
| `community/` | 與品牌無關的工具，以及共用的 emoji 套件 |
| `brands/` | 品牌套件：`lolly-demo`（Lolly Demo，lolly.tools 使用的設計系統）、`lolly-start`（空白起始套件）與私人的 `suse` |
| `services/` | 選用的 MCP、憑證與 Penpot 服務，以及它們共用的伺服器程式碼 |
| `schemas/` | 工具 manifest、素材項目與素材參照的 JSON Schema |
| `scripts/`, `tests/`, `docs/`, `api/` | 建置與目錄指令碼、引擎測試套件、這些文件與產生的 serverless 套件 |

::: details 最先接觸的引擎與外殼檔案
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

::: note 儲存庫根目錄沒有 `tools/` 或 `catalog/` 目錄
`packages/node-shell/src/content-roots.ts` 根據 `profiles.json` 回答「工具 `<id>` 放在哪裡」與「目錄在哪裡」。只有建置輸出才會寫入實際的 `tools/` 與 `catalog/` 目錄組合，例如 `dist/`、RPM 套件內容或容器映像檔，因為瀏覽器會透過 HTTP 擷取這兩個路徑。
:::

<!--i:eti-monitor-->
## Lolly 在哪裡執行

每個介面都使用相同的引擎與工具檔案。

- **網頁應用程式。** 漸進式網頁應用程式。service worker 快取工具與素材後，即可離線運作。不需要帳號，狀態儲存在每部裝置的 IndexedDB 中。同一個響應式版面適用於桌面與手機。在手機上，控制項會變成面板，匯出控制項則從浮動膠囊開啟。
- **桌面與行動應用程式。** 以 Tauri 封裝的同一個網頁應用程式，提供原生檔案對話框、儲存在檔案系統中的狀態與完整離線使用。
- **CLI。** `lolly <tool-id> --input=value --output=file.png` 在無頭 DOM 中載入同一個引擎並寫出檔案。它是透過不同傳輸方式運作的 URL 模式。請見 [CLI](/info/cli.html)。
- **TUI。** 以鍵盤操作為主的全螢幕終端機應用程式。它重用 CLI 的橋接介面，並將已儲存的工作階段保留在磁碟上：若已安裝桌面應用程式，就存放在其資料夾中，否則存放在 `~/.lolly` 下。只有格式需要時，才會啟動限定作用範圍的無頭瀏覽器。請見 [TUI](/info/tui.html)。

![桌面分割檢視：左側是根據 manifest 產生的控制項，右側是即時畫布](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

在手機寬度下，控制項面板位於頂端，預覽則填滿螢幕。

![430px 寬螢幕上的音訊波形影片：上方是控制項面板，下方是完成的正方形圖稿，以及浮動匯出膠囊](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

網頁應用程式也附有 **Batch**（`#/batch`、`shells/web/src/pro/`），以試算表形式的格線，一次透過一個或多個工具渲染許多列。請見 [Batch 與 Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design)。**Settings → Capabilities** 列出平台宣告能做到的一切。

![全新安裝的 Batch：一個空白列等待選擇工具，在任何資料進來之前，試算表介面與 Render 按鈕就已就緒](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## 架構承諾

這些決策已經確定。程式碼庫中的其他每項決策都依賴它們，因此更改其中任何一項都是大工程。

### 1. 宣告式工具，保留命令式擴充途徑

工具由 manifest（`tool.json`）、範本（`template.html`）與選用的 `hooks.js` 組成。**manifest 宣告輸入**。絕不會從範本的 Handlebars token 推斷輸入。大多數工具只有 manifest 與範本，因此非開發者也能編寫。

![Street Map 的控制項堆疊：城市下拉選單、主題選擇器、粗細滑桿與色彩觸發器，每一項都來自 manifest 中的一行](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

需要計算值的工具，例如 QR 編碼或圖表成形，會加入掛鉤：由執行環境呼叫並注入能力橋接介面的具名生命週期函式。掛鉤是可攜性契約，不是安全沙箱。它們在時間預算內執行。若工具的掛鉤經證實不依賴頁面全域物件，就會標上 `isolate: true` 並在 Worker 中執行。[工具掛鉤](/info/tool-hooks.html)說明生命週期與預算。[威脅模型](/info/threat-model.html)說明頁面內執行器能限制與無法限制的範圍。

### 2. 工具與素材是資料，不是打包的程式碼

網頁與 Tauri 應用程式在啟動時擷取工具與素材目錄，將其快取，並使用快取中的內容運作。新增工具或素材不需要發布應用程式。素材的位元組以 SHA-256 校驗。素材的 `id` 與 `version` 決定快取何時失效。

### 3. 能力橋接介面是工具唯一能使用的 API

工具絕不接觸其範本以外的 DOM，絕不直接呼叫 `fetch`，也絕不讀取檔案系統。它們呼叫有版本的 `host.*` 方法。契約定義在工具作者 SDK `@lolly-tools/core` 中的 `packages/core/src/host-v1.ts`。第三方可依據 SDK 建置，不必依賴引擎。`engine/src/bridge/host-v1.ts` 會重新匯出其型別。

| 必要 API | 作用 |
|---|---|
| `host.profile` | 使用者的個人資料；透過 `bindToProfile` 預填輸入 |
| `host.assets` | 目錄查詢、素材解析與主機的選擇器 |
| `host.state` | 儲存與載入輸入槽位：網頁使用 IndexedDB，Tauri 使用檔案系統，CLI 使用記憶體 |
| `host.clipboard` | 將文字或圖片寫入剪貼簿，並提供平台備用方式 |
| `host.export` | 將渲染目標點陣化或序列化，以及裝置上的檔案轉換路徑 |
| `host.log` | 向主機寫入分級記錄 |

其他每個 API 都是選用的擴充：`tokens`、`text`、`color`、`geom`、`pdf`、`compose`、`media`、`recorder` 等等。manifest 的 `requires` 列出其掛鉤會直接呼叫、不先檢查的選用 API。主機缺少其中任何一項，就會拒絕掛載工具。其餘 API 則由掛鉤偵測是否可用。少數 API，例如 `recorder`，也需要工具宣告的裝置能力。`packages/core/src/host-v1/apis.ts` 列出全部 API，[Host API](/info/host-api.html) 則逐一說明。新增方法會升次版本。移除或更改方法會升主版本，而且 v2 發布時 v1 仍會繼續運作。

### 4. 素材 id 永久不變

`lolly/logo/primary` 是一份契約。id 一旦發布，就絕不更改，也絕不重複使用。位元組有變更，就會提升素材項目中的 `version`。替換素材時會設定 `deprecated: true`，並可選擇設定 `replacedBy`。現有參照永遠能解析，因此已儲存的工作階段與分享連結可以持續運作多年。

### 5. URL 模式是一級功能

每個輸入都能以 URL 參數表達，因此連結就是完成的檔案：

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![單憑這個連結，沒有其他內容，就是完成的檔案](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

更改一個參數，就會得到不同的檔案。這個色盤由一個種子色、一種調和方式與一個階數組成：

![四種色相各有九階，全部由連結中攜帶的單一種子色產生](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI 從引數建立相同的 URL 狀態，並執行相同的處理流程，因此 CLI 的行為不會偏離應用程式。`engine/src/url-mode.ts` 解析與序列化 URL 狀態。保留名稱（`format`、`width`、`dpi`、`c2pa`、`z` 等）絕不會傳給工具。[保留的 URL 參數](/info/url-parameters.html)列出所有名稱。素材輸入以 `id` 傳遞，並在填入範本前透過 `host.assets.get()` 解析。

### 6. 儲存透過橋接介面

網頁應用程式使用 IndexedDB，Tauri 使用檔案系統，CLI 使用記憶體。工具只能使用 `host.state.save(slot, data)` 與 `host.state.load(slot)`，絕不使用 `localStorage`。使用者不需要帳號，就能為每個工具保留數個具名工作階段。因為橋接介面是唯一的銜接點，狀態也能攜帶。`shells/web/src/data-transfer.ts` 將狀態匯出為單一 `lolly-backup` 檔案，可匯入任何其他安裝實例（[資料移轉](/info/data-transfer.html)）。[同步](/info/sync.html)將相同的套件傳送到使用者選擇的儲存空間。

### 7. 成熟度標籤說明工具的狀態

每個工具都宣告 `status: official | community | experimental`。工具庫依狀態排序。實驗性工具預設在匯出中加上浮水印：除非呼叫端傳入 `watermark: false`，否則執行環境會開啟浮水印。在裝置上處理檔案的工具不受此限。團隊自己的目錄流程以這些標籤為基礎。

### 8. 輸入的型別在 manifest 中宣告

輸入會宣告 `type`：`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table` 或 `file`。主機為每個型別渲染控制項，因此工具不必編寫控制項程式碼。任何輸入都能帶有 `bindToProfile`。其中三種型別最重要：

- **`asset`** 搭配 `filter` 與 `allowUpload`，是通往素材系統的橋接介面。`allowUpload: false` 將槽位限制為只能使用資料庫素材。使用者上傳的內容與資料庫共用 `AssetRef` 結構。
- **`blocks`** 是在側邊面板中編輯的重複欄位群組，供 Meeting Planner、Wayfinding、Diagrams 等工具使用。點擊渲染出的區塊，對應的列就會取得焦點。
- **`file`** 將使用者自己的檔案保存在記憶體中，供 Lolly Strip Hidden Data 與 Compress 等裝置上執行的 Utility 使用，而 **`vector`** 將一組固定的數字組成單一控制項。

### 9. 範本不含邏輯

範本使用 Handlebars，因此非開發者也能編寫。`{{x}}` 會跳脫內容，而 `{{{x}}}` 則是明確選擇不跳脫。邏輯放在 `hooks.js` 中，便於審閱。許多範本使用 `{{{` 放入掛鉤計算出的標記，因此每個掛鉤都必須跳脫它交出的內容。輔助函式有 `default`、`upper`、`lower`、`eq`、`markdown`、`asset`、`framing` 與 `media`，以及供配套的 `.ics`、`.vcf` 與 `.csv` 範本使用的 `icsStamp`、`rfcText`、`csvCell` 與 `arrow`。[範本與渲染](/info/tool-rendering.html)說明了這些函式。

### 10. 工具可以組合其他工具

工具可以嵌入另一個工具的渲染結果，不需要在工具之間匯入程式碼。引擎負責解析組合。manifest 可以宣告 `composes: [{ id, tool, inputs }]`，並用 `{{asset <id>}}` 放置子項。可攜式嵌入 URL（`https://lolly.tools/tool/<id>.svg?…`）會在本機渲染子項；Lolly Design 就是這樣放入即時 QR code 或圖表。SVG 子項在 SVG 或 PDF 父項中仍保持為向量。子項是中間產物，絕不會加上浮水印或印記。外殼若無法渲染子項，就會讓槽位保持空白，父項仍會渲染。[組合與品牌覆蓋設定](/info/tool-composition.html)提供詳細說明。

<!--i:eti-scissors-->
## 我們選擇不做的事

- **範本中不允許任意 JavaScript。** 邏輯放在 `hooks.js` 中。
- **不強制使用素材伺服器。** 使用者在應用程式的 Assets 中加入自己的檔案，並以工作階段交接作品：輸入與設定用分享連結，需要連同上傳內容一起交接時則用 `.lolly` 檔案。共用的工作階段可以成為工具選擇器中的範本。想要受管理目錄的組織可以使用 Lolly Work 的目錄、核准與政策，或在 git 中管理品牌套件並審閱變更。
- **不強制存取控制。** 開放的應用程式預設為公開。成熟度標籤與浮水印承擔品牌風險。團隊需要組織登入、角色與政策時，由 Lolly Work 提供。
- **沒有中央資料庫。** 使用者狀態保留在每部裝置上，選用的同步會將其複製到使用者選擇的儲存空間，絕不會放進 Lolly 資料庫。
- **工具與引擎不共用程式碼路徑。** 引擎與社群工具是開源的。像私人 `brands/suse/` 這樣的品牌套件，依其自己的條款帶有自己的工具與目錄。沒有工具會從 `engine/` 匯入，因此兩者始終明確分開。

<!--i:eti-refresh-->
## 一次渲染的生命週期

有人開啟 `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`：

1. **啟動。** 網頁應用程式開啟 IndexedDB，建立能力橋接介面並同步工具與素材目錄，離線時則從快取載入。
2. **路由。** 路徑選取 `qr-code` 的工具檢視，並以查詢參數作為初始值。
3. **載入。** `loadTool` 擷取 `tool.json`，依結構描述驗證它，並擷取範本、樣式與掛鉤。
4. **解析連結。** `parseUrlState` 將參數轉成輸入值。像 `?logo=lolly/logo/primary` 這樣的素材參照會變成尚未解析的 `{ id }`。
5. **啟動執行環境。** `createRuntime(tool, host, initialValues)` 根據個人資料、預設值與連結建立輸入模型，解析素材參照，載入掛鉤並呼叫 `onInit`。
6. **渲染。** 外殼訂閱執行環境，根據模型繪製控制項，並將填好的範本寫入 `#tool-canvas`。
7. **互動。** 輸入文字會呼叫 `runtime.setInput`，套用限制、呼叫 `onInput`、再次填入範本並重新繪製。
8. **匯出。** **Download** 呼叫 `runtime.export(node, format)`，外殼的 `host.export` 產生檔案：點陣圖、DOM walker 產生的向量、PDF、文件，或 `schemas/tool.schema.json` 中的其他格式。實體單位依格式轉換。在格式支援的情況下，會嵌入中繼資料與 Content Credentials。實驗性工具的浮水印由主機提供，不是工具。[範本與渲染](/info/tool-rendering.html)與[匯出檔案](/info/exporting.html)說明匯出步驟。

![?options 開啟的匯出面板：檔名與格式組合、輸出大小，以及寫出檔案的控制項](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tauri 執行相同的生命週期，CLI 則在無頭 DOM 中執行，並將結果輸出到檔案或 stdout。

<!--i:eti-stamp-->
## 授權

程式碼，包括 `engine/`、`shells/`、`services/`、`schemas/` 與文件產生器，皆採 MPL-2.0 授權，位於單一公開儲存庫 [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)。文件文字採 CC BY-SA 4.0 授權。品牌套件在各自的 `NOTICE.md` 中列有自己的條款：社群工具採 MPL-2.0 授權，私人 SUSE 套件則為 SUSE 專有。[關於](/info/about.html)提供完整授權說明。
