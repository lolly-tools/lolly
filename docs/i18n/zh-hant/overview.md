# Lolly 架構

![Lolly 圖示 - 大型綠白色棒棒糖](/info/icon.svg)

本頁寫給更動 Lolly 程式碼的人：引擎、外殼與工具套件如何組合在一起、各自位於儲存庫的何處，以及約束每項變更的承諾。如果你想知道 Lolly 做什麼、誰在使用它，請先閱讀 [Lolly 如何運作](/info/how-lolly-works.html)。

有兩份配套文件講得更深。[`engine/README.md`](../engine/README.md) 是引擎逐模組的地圖，由程式碼產生。[威脅模型與信任邊界](/info/threat-model.html)將同一個架構解讀為信任邊界，凡是關於引擎將什麼視為不受信任的問題，都應看這一頁。

## 整體圖像

工具是頂層的資料。中間的引擎對任何平台一無所知。底部的外殼實作同一份契約，而目錄提供內容。

![工具向共用的引擎提供 manifest、範本與 hooks。網頁、Tauri 與終端機外殼實作 HostV1 能力橋接，並從目錄讀取工具與素材。](/info/diagrams/concepts/platform-layers.svg)

如果你能以純資料與 Handlebars 描述它，它就屬於**引擎**。如果它接觸 DOM、檔案系統、網路或任何瀏覽器或作業系統 API，它就屬於**主機**，也就是橋接中外殼的那一側。引擎是開源的，凡是知道特定品牌或平台的東西，都不會進入引擎。

## 儲存庫配置

Lolly 是一個儲存庫。下方的每個目錄都是其中的一般目錄，唯獨 `brands/suse` 是**私有**的 git 子模組，保存 SUSE 工具套件與目錄，公開的 clone 不會擷取它。建置讀取哪些套件，由內容設定檔（`profiles.json`）決定，依程序解析而非全域切換。[建置指南](/info/build-guide.html)有 clone 指令，以及如何提交私有套件內的變更。

| 目錄 | 內容 |
|---|---|
| `engine/` | 與平台無關的核心：載入器、執行階段、輸入、範本、URL 模式、單位與格式模組 |
| `shells/` | 網頁應用程式、Tauri 桌面與行動應用程式、CLI、TUI 與瀏覽器擴充功能 |
| `packages/` | 工具作者 SDK（`@lolly-tools/core`）、共用的 Node 外殼元件與文件渲染器等 |
| `community/` | 不特定品牌的工具，加上共用的表情符號組 |
| `brands/` | 品牌套件：`lolly-demo`（Lolly Demo，lolly.tools 運行的設計系統）、`lolly-start`（空白起始套件）與私有的 `suse` |
| `services/` | 選用的 MCP、憑證與 Penpot 服務，以及它們共用的伺服器程式碼 |
| `schemas/` | 工具 manifest、素材項目與素材參照的 JSON Schema |
| `scripts/`、`tests/`、`docs/`、`api/` | 建置與目錄指令碼、引擎測試套件、這些文件，以及產生的 serverless 套件 |

::: details 你最先會遇到的引擎與外殼檔案
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

儲存庫根目錄沒有 `tools/` 或 `catalog/` 目錄。`packages/node-shell/src/content-roots.ts` 在被詢問時，依 `profiles.json` 回答「工具 `<id>` 在哪裡」和「目錄在哪裡」。只有在建置輸出（例如 `dist/`、RPM 內容或容器映像）中，才會寫入真正的 `tools/` 與 `catalog/` 目錄對，因為瀏覽器要透過 HTTP 擷取這兩個路徑。

## Lolly 在哪裡執行

每個介面都使用相同的引擎與相同的工具檔案。

- **網頁應用程式。** 一個漸進式網頁應用程式，在 service worker 快取了工具與素材之後可離線運作。不需要帳號；狀態存放在每部裝置的 IndexedDB。一個響應式版面同時服務桌面與手機：在手機上控制項變成面板，匯出控制項則從浮動膠囊開啟。
- **桌面與行動應用程式。** 同一個網頁應用程式的 Tauri 封裝，具有原生檔案對話框、檔案系統狀態與完整的離線使用。
- **CLI。** `lolly <tool-id> --input=value --output=file.png` 在無頭 DOM 中載入相同的引擎並寫出檔案。這是在不同傳輸方式上的 URL 模式，而不是獨立的實作。請見 [CLI](/info/cli.html)。
- **TUI。** 全螢幕、鍵盤優先的終端機應用程式，重複使用 CLI 的橋接，將已儲存的工作階段保存在磁碟上（安裝了桌面應用程式時存放在其自己的資料夾，否則在 `~/.lolly` 下），並只在格式需要時才啟動範圍受限的無頭瀏覽器。請見 [TUI](/info/tui.html)。

![桌面分割檢視：左側是依 manifest 產生的控制項，右側是即時畫布](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

同一個工具在手機寬度下不需要第二套版面：控制項變成頂端的面板，預覽佔滿螢幕。

![430px 寬螢幕上的音訊可視化：上方是控制項面板，下方是完成的方形作品，以及浮動的匯出膠囊](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

網頁應用程式也附有 **Batch**（`#/batch`、`shells/web/src/pro/`），這是試算表風格的格線，可跨一個或多個工具一次渲染許多列；[Batch 與 Multi-edit](/info/batch.html#make-many-versions-of-one-design)涵蓋 Batch。**Settings → Capabilities** 對應平台宣告它能做的一切。

![全新安裝上的 Batch：一個空列等待工具，在任何資料進來之前，試算表介面與其 Render 按鈕已就位](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## 架構承諾

這些決定已經定案。更改其中任何一項都是重大工程，因為它們塑造了程式碼庫中的其他每項決定。

### 1. 宣告式工具，搭配命令式逃生艙

工具是一個 manifest（`tool.json`）、一個範本（`template.html`）與選用的 `hooks.js`。**manifest 宣告輸入**，而不是範本：輸入不是從 Handlebars token 推斷出來的。大多數工具只有 manifest 與範本，這正是讓非開發者能夠撰寫它們的原因。

![Street Map 的控制項堆疊：城市下拉選單、主題選單、粗細滑桿與色彩觸發器，每一個都由 manifest 中的一行繪製而成](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

需要計算值的工具（例如 QR 編碼或圖表塑形）會加入 hooks：執行階段在注入能力橋接的情況下呼叫的具名生命週期函式。Hooks 是可攜性的契約，而不是安全沙箱，並且在時間預算內執行。hooks 被證明不含頁面全域變數的工具帶有 `isolate: true`，並在 Worker 中執行。[工具 hooks](/info/tool-hooks.html)有生命週期與預算，[威脅模型](/info/threat-model.html)則說明頁面內執行器包含與不包含什麼。

### 2. 工具與資產是資料，不是綁定的程式碼

網頁與 Tauri 應用程式在啟動時擷取工具與素材目錄、快取它們，並使用現有的內容運作，所以新工具或素材不需要發行應用程式。素材位元組附有 SHA-256 校驗碼，而素材的 `id` 與 `version` 驅動快取失效。

### 3. 能力橋接是工具看得到的唯一 API

工具絕不碰觸其範本之外的 DOM，絕不直接呼叫 `fetch`，也絕不讀取檔案系統。它們呼叫有版本的 `host.*` 方法。契約的標準定義是 `packages/core/src/host-v1.ts`，也就是工具作者 SDK `@lolly-tools/core`，因此第三方可以在不依賴引擎的情況下對照它建置；`engine/src/bridge/host-v1.ts` 重新匯出它的型別。

| 必要的 API | 作用 |
|---|---|
| `host.profile` | 使用者的詳細資料；透過 `bindToProfile` 預先填入輸入 |
| `host.assets` | 目錄查詢、素材解析與主機的選擇器 |
| `host.state` | 儲存與載入輸入欄位：網頁上用 IndexedDB，Tauri 用檔案系統，CLI 用記憶體 |
| `host.clipboard` | 將文字或圖片寫入剪貼簿，附有各平台的後備方案 |
| `host.export` | 點陣化或序列化渲染目標，以及裝置端檔案轉換路徑 |
| `host.log` | 對主機的分級記錄 |

其他每個 API 都是選用且累加的：`tokens`、`text`、`color`、`geom`、`pdf`、`compose`、`media`、`recorder` 等許多項目。工具的 manifest 會在 `requires` 下列出其 hooks 不先檢查就呼叫的選用 API，缺少其中任何一項的主機會拒絕掛載該工具；hooks 對其餘的進行功能偵測。少數幾個（例如 `recorder`）還需要工具宣告的裝置能力。`packages/core/src/host-v1/apis.ts` 列出全部，[Host API](/info/host-api.html) 記載每一個。新增方法屬於次要版本；移除或更改方法屬於主要版本，而 v2 發布時 v1 仍然可用。

### 4. 素材 ID 是永久的

`lolly/logo/primary` 是一份契約。一旦發布，ID 絕不更改，也絕不重複使用。位元組的更改會提高素材項目中的 `version`，替代品則設定 `deprecated: true`，並可選擇設定 `replacedBy`，讓現有的參照始終能解析。這正是讓已儲存的工作階段與分享連結能運作多年的原因。

### 5. URL 模式屬於一等公民

每個輸入都能以 URL 參數表達，所以連結就是完成的檔案：

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![光是那個連結，其中沒有任何其他東西，就是完成的檔案](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

改變一個參數，你就得到不同的檔案。整個調色盤只是一個種子色、一個和諧規則和一個階數：

![四種色相中的九個階段,全部從連結中攜帶的單一種子色衍生而來](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

CLI 從它的引數建立相同的 URL 狀態並執行相同的管線，所以 CLI 不會偏離應用程式。`engine/src/url-mode.ts` 負責解析與序列化；一組保留名稱（`format`、`width`、`dpi`、`c2pa`、`z` 等）絕不會傳給工具，[保留的 URL 參數](/info/url-parameters.html)列出了全部。素材輸入以 `id` 傳遞，並在範本填入之前透過 `host.assets.get()` 解析。

### 6. 儲存經由橋接

網頁應用程式使用 IndexedDB，Tauri 使用檔案系統，CLI 使用記憶體。工具只看得到 `host.state.save(slot, data)` 與 `host.state.load(slot)`，絕不碰 `localStorage`。人們可以為每個工具保存多個具名的工作階段，不需要帳號。由於橋接是唯一的接縫，該狀態也是可攜的：`shells/web/src/data-transfer.ts` 把它讀回成一個 `lolly-backup` 檔案，可匯入任何其他安裝（[資料轉移](/info/data-transfer.html)），而[同步](/info/sync.html)會把同一個套件傳到人們選擇的儲存空間。

### 7. 成熟度標籤依設計說明工具是什麼

每個工具都宣告 `status: official | community | experimental`。圖庫依狀態排序，而實驗性工具預設會為其匯出加上浮水印：除非呼叫者傳入 `watermark: false`，否則執行階段會開啟浮水印，裝置端工具則不在此限。團隊圍繞目錄設置的任何流程，都建立在這之上。

### 8. 輸入在 manifest 中有型別

輸入宣告一個 `type`：`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table` 或 `file`。主機為每種型別渲染一個控制項，所以工具不需撰寫控制項程式碼，而任何輸入都可以帶有 `bindToProfile`。其中三種分量最重：

- **`asset`**，搭配 `filter` 與 `allowUpload`，是通往素材系統的橋樑。`allowUpload: false` 會把欄位限制為資料庫素材，而使用者上傳的內容與資料庫共用 `AssetRef` 形狀。
- **`blocks`** 是在側邊面板中編輯的重複欄位群組，被 Meeting Planner、Wayfinding、Diagrams 等使用。點擊已渲染的區塊會聚焦其列。
- **`file`** 在記憶體中保存使用者自己的檔案，供 Strip Hidden Data 與 Compress 等裝置端 Utility 使用，而 **`vector`** 將一組固定的數字歸成一個控制項。

### 9. 範本不含邏輯

範本是 Handlebars，選它是為了讓非開發者也能撰寫：`{{x}}` 會跳脫，`{{{x}}}` 是明確的選擇加入。邏輯存在於 `hooks.js` 中，在那裡它是明確且可審閱的。許多範本對 hook 計算出的標記使用 `{{{`，所以每個 hook 都必須跳脫它交出的內容。輔助函式有 `default`、`upper`、`lower`、`eq`、`markdown`、`asset`、`framing` 與 `media`，另有供同層 `.ics`、`.vcf` 與 `.csv` 範本使用的 `icsStamp`、`rfcText`、`csvCell` 與 `arrow`。[範本與渲染](/info/tool-rendering.html)涵蓋它們。

### 10. 工具組合工具

工具可以嵌入另一個工具的渲染結果，而不需要工具之間的匯入；組合由引擎解析。manifest 可以宣告 `composes: [{ id, tool, inputs }]` 並以 `{{asset <id>}}` 放置子項，而可攜的嵌入 URL（`https://lolly.tools/tool/<id>.svg?…`）會在本機渲染子項，Design 就是這樣放置即時的 QR 碼或圖表。SVG 子項在 SVG 或 PDF 父項中仍保持向量。子項是中間產物，絕不加浮水印或蓋印，而無法渲染子項的外殼會讓欄位保持空白，同時父項仍會渲染。[組合與品牌覆疊](/info/tool-composition.html)有詳細說明。

## 我們選擇不做的事

- **範本中沒有任意 JavaScript。** 邏輯存在於 `hooks.js` 中。
- **沒有強制的素材伺服器。** 人們在應用程式中把自己的檔案加到 Assets，並以工作階段的形式傳遞作品：輸入與設定用分享連結，上傳內容也要一起傳時用 `.lolly` 檔案。共用的工作階段可以成為工具選擇器中的範本。想要受管轄目錄的組織可以使用 Lolly Work 的目錄、核准與政策，或在 git 中管理品牌套件並在那裡審閱變更。
- **沒有強制的存取控制。** 開放的應用程式預設是公開的，而成熟度標籤與浮水印承擔品牌風險。當團隊需要時，組織登入、角色與政策來自 Lolly Work。
- **沒有中央資料庫。** 使用者狀態存放在每部裝置上，而選用的同步會把它複製到人們選擇的儲存空間，絕不複製到 Lolly 的資料庫。
- **工具與引擎之間沒有共用的程式碼路徑。** 引擎與社群工具是開源的，而 `brands/suse/` 這類私有品牌套件在自己的條款下帶有自己的工具與目錄。沒有任何工具從 `engine/` 匯入，所以這種切分保持乾淨。

## 一次算繪的完整生命週期

有人開啟 `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`：

1. **啟動。** 網頁應用程式開啟 IndexedDB、建立能力橋接，並同步工具與素材目錄，離線時則從快取載入。
2. **路由。** 路徑選擇 `qr-code` 的工具檢視，以查詢作為其初始值。
3. **載入。** `loadTool` 擷取 `tool.json`、對照結構描述驗證，並擷取範本、樣式與 hooks。
4. **解析連結。** `parseUrlState` 把參數轉成輸入值。像 `?logo=lolly/logo/primary` 這樣的素材參照會變成未解析的 `{ id }`。
5. **啟動執行階段。** `createRuntime(tool, host, initialValues)` 由個人資料、預設值與連結建立輸入模型、解析素材參照、載入 hooks 並呼叫 `onInit`。
6. **渲染。** 外殼訂閱執行階段，由模型繪製控制項，並把填好的範本寫入 `#tool-canvas`。
7. **互動。** 輸入會呼叫 `runtime.setInput`，它套用限制、呼叫 `onInput`、再次填入範本並重繪。
8. **匯出。** **Download** 呼叫 `runtime.export(node, format)`，而外殼的 `host.export` 產生檔案：點陣圖、來自 DOM walker 的向量、PDF、文件，或 `schemas/tool.schema.json` 中的其他格式之一。實體單位依格式轉換，而中繼資料與 Content Credentials 會嵌入格式能容納它們之處。實驗性工具的浮水印來自主機，而非工具。[範本與渲染](/info/tool-rendering.html)與[匯出檔案](/info/exporting.html)涵蓋匯出步驟。

![?options 開啟的匯出面板：檔名與格式組合、輸出尺寸，以及寫出檔案的控制項](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

同樣的生命週期在 Tauri 中執行，也在使用無頭 DOM 的 CLI 中執行，其輸出會送到檔案或 stdout。

## 授權

程式碼，包括 `engine/`、`shells/`、`services/`、`schemas/` 與文件產生器，採用 MPL-2.0，位於一個公開儲存庫 [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly)。文件文字採用 CC BY-SA 4.0。品牌套件在各自套件的 `NOTICE.md` 中載明自己的條款：社群工具為 MPL-2.0，私有的 SUSE 套件則是 SUSE 專有的。[關於](/info/about.html)有完整的授權說明。
