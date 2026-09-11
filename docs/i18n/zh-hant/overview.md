# 概覽

![Lolly 圖示 - 大型綠白色棒棒糖](/info/icon.svg)

本文件記錄了 Lolly 平台的目的、結構與架構決策，同時反映了產品願景與程式碼庫的現況。

> **狀態：** Lolly 目前是內部原型，處於**尚未完成的封閉試辦**階段。引擎具確定性且內部一致，但產品仍屬早期階段 - SUSE 是第一號客戶 - 其加密與檔案解析引擎目前正接受 SUSE 嚴格的基礎架構強化，為企業規模做準備（這方面我們相當在行）。請將以下架構視為正在測試中的設計意圖，而非已完成、經過認證的產品。試辦計畫如何執行與評估，詳見[採用與治理](/info/adoption-governance.html#status)。

> **這一頁怎麼讀。** 內容按順序分成兩類。前半部是
> **為什麼會有這個平台**：問題所在、定位，以及單一素材所經歷的
> 生命週期。從[全局觀](#the-big-picture-how-the-layers-fit)開始則是
> **各層如何組成**：給貢獻者看的架構文件，涵蓋 engine/shell/pack
> 的分工、儲存庫配置、交付目標，以及限制平台每一次變更的承諾。如果你來這裡是要
> 修改程式碼庫而非了解產品，請從全局觀開始讀起。
>
> 有兩份輔助文件比本頁更深入。儲存庫中的 [`engine/README.md`](../engine/README.md)
> 是引擎逐模組的地圖，附有自動產生的表格，列出每個模組
> 解析或寫入的內容。[威脅模型與信任邊界](/info/threat-model.html)
> 則是以信任邊界角度重新閱讀同一份架構，任何關於
> 引擎將什麼視為不受信任的問題，都應該去看這一頁。

---

## 為什麼會有這個平台

團隊經常面臨一個反覆出現的問題：可重複的創意與內容工作，規律性高到不值得每次都動用專業人力，但對品質的要求又高到無法在沒有防護機制的情況下隨意外包。結果不是產能低落（專家成為瓶頸）、就是品質不一（每個人用手邊有的工具湊合），不然就是被供應商綁死（由 SaaS DAM 掌控你的範本）。

這個平台就是直接的解答：

> **規模化的程式化創意與內容產出** - 零人力的素材生成，規則由中央集中控管，供員工、供應商與合作夥伴使用。

Lolly 不是設計系統誕生的地方 - 而是它被產出的地方。把它想成一台設計自動販賣機:選好項目,拿到成品。每次都是如此。引擎會為眼前的硬體,盡力產出每種格式所能達到的最高品質,而且同一套引擎在其發行的每個平台上,都會產出相同的檔案。

結果就是**豐足**：每一場活動都有正確的標示、每一則 CVE 警示都符合公司風格、每一張標籤都印刷乾淨、每一個電子郵件簽名檔都是最新的 - 而且完全不需要送設計工單。這個平台處理的是重複、可作業化的創意工作，刻意不做成客製化的創意工具 - 旗艦作品仍由設計師掌控。

### 機率性創新，確定性擴展

每一場關於 AI 在創意流程中該扮演什麼角色的爭論，最後都卡在同一個問題：哪一部分該交給機器？這其實是個老問題，而且早有定論。抄寫員與泥金裝飾畫師早已在兩種工具之間工作 - 一邊是隨手的草稿，什麼都還沒定案、什麼都能嘗試；另一邊是印刷機，之所以令人望而生畏，正是因為它一旦付印就無法更改。藝術發生在草稿裡，而讓作品觸及所有人的則是印刷機。沒有人會把兩者混為一談，而兩者也都持續進步 - 新的墨水、新的字體、新的印刷機 - 每一項進步都與其所服務的技藝與意圖相輔相成。

Lolly 也劃出同樣的界線。以機率性的方式探索：一個模型、一位設計師、一個粗略的想法、一個走向沒人預料到之處的提示詞。接著以確定性的方式擴展 - 能觸及一萬份輸出的，是一個*工具*，而工具每次都會依可讀的輸入，以相同方式算繪。探索可以保持自由，因為下游沒有任何東西仰賴它每次都得出相同結果。輸出之所以值得信任，是因為它不是猜測。讓 AI 的實驗轉化為可預測、可重現的成果，並不是什麼新的學問；這正是當初讓印刷品值得信賴的那套分工方式。

> 信任創意過程，以嚴謹擴展規模。

### 與其他替代方案相比

::: figure positioning-comparison
現今各創意工具的功能完整度，調查於 2026 年 8 月。評分標準：0 分表示不具備，25 分表示需以變通方式達成，50 分表示有實際功能但受限或不完整，75 分表示強大但有但書，100 分表示核心能力。
:::

差距很明顯：目前已上市的產品，沒有一個能同時做到以限制為先、可離線使用、低技術門檻、內部就能取得的輸出。Lolly 甚至包含一個開放式畫布 - **Design** - 其中的色彩、字體與素材都遵循品牌全域設定，因此自由排列仍然維持以限制為先。它**不是**一套不受限制的設計套件：設計師仍會使用 Illustrator 與 Figma 來製作客製化的旗艦作品。各種排列組合則可以用這個工具來組裝。

![工具庫中每個工具都以卡片呈現，依類別分組，方便製作人選擇並開始使用](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**適用情境：** 快速產生可作業化的創意素材 - 活動版塊、姓名識別證、簽名檔、CVE 警示、QR code、社群卡片、託運標籤、結構化報告。

**不適用情境：** 客製化的主視覺內容。

---

## 一場活動的生命週期

要看清 Lolly 究竟是什麼，最清楚的方式不是看功能清單 - 而是跟著一份素材，看它如何在不同人手中流轉。以下追蹤一張在地化的活動卡片如何在組織中傳遞：

1. **創意人員訂下規則。** 設計師在 Design 工具中製作基礎範本，將品牌的字體排版與色彩變數寫死進去。他們製作的不是一張卡片 - 而是*一次性*完成基礎工作，從此再也不必手動在地化。
2. **開發人員將它規模化。** 同一個範本透過 CLI 接入夜間排程管線，自動產生最新的圖表或新的語言版本 - 沒有設計師需要重新開啟檔案。
3. **製作人直接使用它。** 一位在飛機上離線的業務代表，開啟同一個工具，為客戶會議產生一份完全符合品牌規範的簡報。不需要設計技能、不需要網路、不需要等待。

第二步中的「最新圖表」就像這樣的算繪結果，由一段資料字串與少數幾個參數產生，完全沒有人開啟設計檔案：

![一張附標題的堆疊區域圖,三個資料序列以冷色調色盤呈現,座標軸、圖例與標題皆由範本自動排版,而非手動配置](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

重點不在於 Lolly 分別對設計師好、對開發人員好、對業務人員也好，各自獨立不相干。而是一場**接力賽**：創意人員最初的成果由開發人員加以規模化，進而賦能給製作人。飛機上那位非技術背景業務代表所享有的毫不費力的體驗，*之所以可能*，正是因為設計師訂下的嚴謹規範以及開發人員的部署工作。

這就是力量倍增器。Lolly 不是一個裝著各種角色專用工具的抽屜 - 而是一條確定性的素材生命週期，每個角色都會參與其中，每經過一雙手，前一份成果的價值就會被放大。

---

## 一次核准，萬份素材

因為核准的對象是工具本身，而不是檔案（詳見[Lolly 與其他方案的比較](/info/positioning.html)），規模化就不再是審核上的難題。核准一個在地化的社群卡片工具一次，之後就能從一份試算表產生**橫跨 12 種語言的 10,000 份素材** - 而且沒有一份需要法務或品牌再次進行合規檢查，因為它們共同的範本早已通過核准。

同一個確定性工具能以三種方式達到這樣的規模，而且都會產出完全相同、已預先核准的結果：

- <!--i:people--> **一個人，在應用程式中操作。** `/pro` 批次網格：貼上或匯入資料列，每一列產出一份完成的素材，下載為 zip 檔。不需要設計技能、不需要工單、不需要等待。
- <!--i:code--> **一位開發人員，透過命令列。** CLI 以無頭模式執行*相同*的引擎與*相同*的算繪路徑，因此可以在腳本或夜間管線中對全部 10,000 列依序執行該工具。在迴圈中呼叫 `lolly <tool> --field=…` 就是整個整合工作。
- <!--i:cpu--> **一個系統或 AI 代理，透過 MCP。** 同一個工具以程式化方式操作，保持相同的精確度，甚至能達到更大的規模 - 因為機器不會在數千份檔案陸續產生時感到厭倦。

![全新安裝後的批次模式:一列空白等待選擇工具,整個試算表介面與「算繪」按鈕在任何資料到來之前就已就緒](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

一套品牌限制，由設計師一次訂定；三條路徑通往完全相同、已預先核准的輸出 - 而機器這條路徑能擴展得最遠，因為它在檔案陸續產生時永遠不會疲倦。

---

## 全局觀：各層如何組成

從這裡開始的內容全部屬於架構層面。這張圖以單一視角呈現整個系統：最上層的工具是
資料，中間的引擎對任何平台都一無所知，其下的殼層則
實作同一份合約，而目錄提供內容。

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### 儲存庫配置

內容以套件形式掛載：`community/`、`docs/`、每個 `shells/*`、兩個 `services/*` 以及 `brands/suse`，各自都是獨立的儲存庫，以 git submodule 的形式簽出到這個主儲存庫中。主儲存庫本身擁有 `engine/`、`schemas/`、`scripts/`、`tests/`、`api/`、`brands/lolly-start/` 與 `profiles.json`。取得原始碼的簽出指令與跨儲存庫工作流程，詳見[建置指南 » 取得原始碼](/info/build-guide.html)。

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## 平台交付模型

這個平台可在多個介面上運作 - web PWA、Tauri 桌面/行動版、可腳本化的 CLI，以及互動式 TUI。它們全部使用相同的引擎與相同的工具檔案。

### Web (PWA) - 主要發布管道
託管於 SUSE 控管的網址。一旦 service worker 快取了工具與素材，即可離線運作。大多數員工、供應商與合作夥伴都會在這裡使用這個平台。不需要帳號 - 狀態會依裝置儲存在 IndexedDB 中。

web 殼層採用單一版面配置做響應式設計。在桌面版上，工具是一個可調整大小的控制項側邊欄，搭配一個預覽舞台，並具備原生觸控板式的畫布導覽（Cmd/Ctrl + 滾輪或雙指縮放以游標為中心縮放、按住 Space 或中鍵拖曳平移、`0`/`1`/`+`/`−` 按鍵，以及 Fit/% HUD）。在行動裝置上（≤640px）控制項會變成一個上方固定的面板，附有可拖曳的把手，可吸附至窺視/半展開/全展開三種狀態（點擊可切換），覆蓋在靜態的全螢幕預覽上，而浮動的 **Render** 按鈕會以底部彈出面板開啟 **Export** 控制項。觸控操作可在預覽上進行雙指縮放與拖曳平移。兩者的算繪路徑與匯出控制項完全相同 - 只有介面外框會重新排版。

![桌面版分割檢視 - 左側是從 manifest 產生的控制項，右側是即時畫布](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

同一個工具在手機寬度下，不需要維護第二種版面：控制項變成頂端的表單頁，預覽佔滿整個畫面，輸出按鈕則浮在其上。

![在 430px 寬螢幕上顯示的音頻圖——上方為控制項面板,下方為完成的方形作品,以及浮動的算繪標籤](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**批次模式（`/pro`）。** Web shell 也提供一個試算表風格的批次網格（`shells/web/src/pro/`），可一次跨一個或多個工具算繪多列。它支援 CSV/TSV 雙向轉換與試算表貼上、逐列的樣板/格式/尺寸/單位/dpi、附即時預覽的 blocks 編輯側欄、可收合的輸出欄、逐列「相關性」標籤列、左側拖曳把手可重新排序、兩階段刪除確認、已儲存的批次工作階段，以及 `.zip` 下載。這就是「大量內容產出」定位背後的一對多介面。

### Tauri 桌面版／行動版
打包好的原生應用程式（透過 Tauri 保持小體積）。提供完整離線可用性、供仰賴 CLI 的工具（PDF Smasher、Font Outliner）使用的檔案系統存取，以及相機存取。預計 2026 年年中進行工具強化。

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

桌面版使用者可以從終端機呼叫許多工具。CLI shell 載入同一個引擎、建立一個 jsdom DOM、執行同一條算繪路徑，並寫出檔案。URL 模式就是傳輸方式 - CLI 並非另一套實作。這確保 CLI 與 GUI 的輸出完全一致。

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

CLI 的互動版對應物：一個以鍵盤操作為主的全螢幕終端機應用程式（以 Ink 打造），可瀏覽工具、填寫輸入、儲存專案並輸出 - 全程不需要 GUI。其 host bridge 針對無 DOM 的格式（SVG/EMF/EPS/HTML + 文字/資料）**重用 CLI 的實作**，並加上 `~/.lolly` 底下的磁碟狀態，以及可選擇啟用的行內預覽。除此之外，它還有一個**瀏覽器算繪層**：一個範圍受限的無頭 Chromium（與 MCP 伺服器安裝的是同一套），可依需求產生點陣圖／PDF／影片與即時 URL 擷取 - 驅動一份已建置好的 web shell 副本，因此輸出完全一致，並且只在你首次輸出這類格式時才啟動。因此 `url-shot`（含裁切、重新上色與向量 PDF/SVG）以及每個點陣圖／pdf 工具，也都能在終端機中執行。詳見 [TUI 指南](/info/tui.html)。

無論你在哪個介面，儀表板的 Capabilities 分頁都是平台宣告自身能力的完整地圖，依分類整理，不需要開啟任何一個工具就能閱讀。

---

## 工具分類

工具在其 manifest 中以 `category` 標記，用於藝廊分組。

各列依藝廊區塊順序列出。`utility` 區塊在藝廊中永遠**最後**呈現（排在所有其他分類之後，包括未來新增的分類）- 它是裝置端的「離線工具」抽屜。

| 分類 | 範例 | 規劃中 |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | 員工形象套版素材 |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | 字型外框工具 |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | 活動文具、批次姓名識別證、會議室議程卡 |
| `product` | - | CVE 警示、產品發布公告、部落格 OG 圖片 |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | 單位/格式轉換工具、更多裝置端隱私公用程式 |

這些欄位是**範例，不是完整清單**。哪些工具存在，取決於你所掛載的 profile，而不是這個頁面 - 品牌套件會加入自己的工具，也可以排除某個它不想提供的社群工具。`catalog/tools/index.json` - 由 manifest 產生，也是藝廊實際讀取的登錄檔 - 才是權威清單；要計算某個 profile 掛載了多少工具，應清點 manifest（`ls community/*/tool.json brands/*/tools/*/tool.json`），而不是信任這裡寫下的數字。（同一個工具 id 若出現在兩個套件中，只會掛載一次，以優先的套件為準。）

工具也依狀態分類：`official`（品牌核准，無浮水印）、`community`（外部貢獻）、`experimental`（輸出加浮水印）。函式庫中大多數是 `official`；較新的工作室與擷取類工具在穩定下來前，通常會落在 `community` 或 `experimental`。每個介面都會顯示徽章，讓讀者在開啟工具之前就知道自己拿到的是什麼 - 而且，就像上方的分類欄位一樣，各狀態下的工具成員異動太快，無法在此列舉。請以藝廊或產生的索引為準。

**Design** 是第一個建立在 `render.layout: "editor"` 自由畫布模式上的工具 - 一個無外框、直接操作的介面，你可以拖曳、縮放、旋轉並吸附文字、形狀與圖片方塊，再透過與其他所有工具相同的算繪路徑輸出。

**Strip Hidden Data** 是第一個**裝置端工具**（`privacy: "on-device"`）：這是一個內容轉換工具，接收*你*提供的檔案、完全在瀏覽器內處理，再交還一份乾淨的副本 - 從不上傳、從不加浮水印、不蓋任何來源標記。**Text Helper** 是第二個 - 一個處理日常「貼上網站」工作的裝置端工具台（JSON 格式化、JWT 解碼、Base64、URL 編碼／解碼、SHA 雜湊）。**Compress PDF** 是第三個 - 它透過重新壓縮 PDF 中的圖片來縮小檔案，同樣完全在裝置端進行。這個標記與其徽章文字「在你的裝置上執行 - 不會上傳任何內容」，如今涵蓋整個轉換工具集：Strip Hidden Data、Text Helper、Compress PDF、**Convert Image**（HEIC/TIFF/AVIF → WebP/JPG/PNG）、**Convert Font**、**Redact**（銷毀圖片、SVG 或 PDF 中的區域）、**Prompt to Image**，以及在該 profile 有掛載的情況下的 **Rebrand a Deck**（就地重新套用 `.pptx` 的主題）。這是一個隱私工具分類，用來取代把機密檔案交給單一用途的網站處理。

![工具抽屜，其中每張卡片都是可轉換你既有檔案的工具](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> 注意：`category` 與 `status` 是從各自的 `tool.json` 反正規化寫入 `catalog/tools/index.json`（藝廊實際讀取的登錄檔）。manifest 才是唯一真實來源 - 索引由 `npm run build:catalog` **產生**，若已提交的索引與 manifest 出現偏差，`npm run validate:catalog` 會讓 CI 失敗。

---

## 架構承諾

以下決策已經定案。更動其中任何一項都是重大工程 - 它們塑造了程式碼庫中的其他每一項決策。

### 1. 宣告式工具，搭配命令式逃生艙

一個工具是一份 manifest（`tool.json`）+ 一份樣板（`template.html`）+ 選用的 `hooks.js`。

**輸入由 manifest 宣告。** 而非樣板。輸入不是從 Handlebars 標記推斷出來的。manifest 是合約；樣板透過 `{{id}}` 使用具名變數。

![Street Map 的控制項堆疊 - 一個城市下拉選單、一個主題選擇器、粗細滑桿與色彩觸發器，每一項都繪製自 manifest 的一行設定](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks 是選用的。** 大多數工具是純宣告式的 - manifest + 樣板就已足夠。需要計算值的工具（QR 編碼、圖表資料整形）提供 `hooks.js`，公開具名的生命週期函式（`onInit`、`onInput`、`onFrame` - 供動態反應相機工具使用的逐幀即時相機掛鉤 - `onLevel`、`beforeExport`、`afterExport`、`exportFile` - Strip Hidden Data 等裝置端工具使用的檔案輸入／檔案輸出轉換路徑 - 以及 `exportStill`，供自行掌管深度點陣算繪的工具使用）。host 透過 `new Function('host', …)` 載入 hooks，並以閉包範圍注入能力橋接（capability bridge）。這是一份**可攜性合約，而非安全沙箱**：hooks 仍在頁面 realm 中執行，在瀏覽器 shell 中*可以*存取 `window`／`fetch`／`document` - `host.*` 是受支援的可攜介面，而非強制邊界。非同步 hook 結果有時間限制（`onInit` 5 秒、`onInput` 2 秒、`beforeExport`／`afterExport` 5 秒、`exportFile`／`exportStill` 10 秒），逾時結果會被捨棄；失控的*同步* hook 則無法被中斷。因此，在 Worker 隔離上線之前，執行不受信任的第三方 hook 程式碼並不安全。

這點之所以重要：宣告式工具可以由非開發者撰寫。如果每個工具都是一個網頁應用程式，「創建／維護核心樣板的技能有限」這項風險就會變成永久的瓶頸。

### 2. 工具與資產是資料，不是綁定的程式碼

Web 與 Tauri 應用程式會在啟動時，從已知的 URL 擷取工具與資產目錄，在本機快取後，依當下所有的內容運作。**新增一張活動版型或季節性資產，不需要發布新版應用程式。**

資產位元組經過 SHA-256 校驗，以防止 CDN 遭下毒。資產的 `id` + `version` 驅動快取失效。

### 3. 能力橋接是工具唯一能看見的 API

工具永遠不會在其樣板區域之外碰觸 DOM，不會直接呼叫 `fetch`，也不會讀取檔案系統。它們呼叫已版本化的 `host.*` 方法。此合約的權威定義位於 `packages/core/src/host-v1.ts` - 也就是工具作者 SDK `@lolly-tools/core`，讓第三方無需依賴引擎就能據此開發；`engine/src/bridge/host-v1.ts` 是它的型別重新匯出，引擎／shell 的程式碼仍照舊從該路徑匯入：

| 橋接 API | 功能 |
|---|---|
| `host.profile` | 使用者的名字、電子郵件、大頭照、城市等。透過 `bindToProfile` 預先填入輸入欄位。 |
| `host.assets` | 目錄查詢、資產解析、host 提供的選取器 UI。 |
| `host.state` | 儲存／載入輸入欄位槽。Web 版用 IndexedDB，Tauri 用檔案系統，CLI 用記憶體。 |
| `host.clipboard` | 將文字或圖片寫入剪貼簿（並提供平台備援方案）。 |
| `host.export` | 將算繪目標點陣化或序列化。對 experimental 工具套用浮水印。 |
| `host.net` | 允許清單內的 fetch - 僅在工具宣告 `"network"` 能力時才可用。（目前沒有已上線的工具使用它。） |

選用、可疊加的介面只會在某個 shell 提供時出現。有些是**依能力閘控**的 - 僅在工具宣告對應旗標時才會公開：`host.compose`（嵌入另一個工具的算繪結果 - `compose`）、`host.capture`（供 URL Screenshot 使用的頁面擷取 - `capture`），以及 `host.recorder`（供錄製類工具使用的麥克風／相機／畫面擷取 - `microphone` / `camera` / `screen`）。其餘則是**特徵偵測式**的 - 只要 shell 能提供就會出現，工具則為無法提供的 shell 保留備援方案。

以下列出幾個代表性介面，用以說明其涵蓋範圍 - [Host API](/info/host-api.html) 記載了每一個項目，而 `packages/core/src/host-v1.ts` 本身就是合約：

| 介面 | 自 | 新增內容 |
|---|---|---|
| `host.tokens` | 1.0 | DTCG 設計權杖——品牌自己的基本元素 |
| `host.text` | 1.0 | 透過 HarfBuzz WASM 將文字轉換為路徑(`wasm` 能力旗標會標記依賴此功能的工具) |
| `host.media` | 1.4 | 即時攝影機畫格驅動 `onFrame` 掛鉤。屬於漸進式增強功能,刻意*不*受 `camera` 旗標限制——這類工具在沒有攝影機時仍可作為一般靜態圖片工具運作 |
| `host.color` | 1.40 | 知覺色彩運算:ΔEOK、WCAG + APCA 對比度、OKLab 漸層、分級斷點、類別調色盤、和諧配色方案(1.60)、CSS Color 4 混色與漸層烘焙(1.68)。純函式且同步執行——殼層是掛接引擎的 `makeColorApi()`,而非自行實作,因此不會產生落差 |
| `host.images` | 1.60 | 在裝置端解碼/縮放/重新編碼位元組——即轉換路徑(HEIC → JPEG、壓縮為 WebP、縮小尺寸)。在網頁殼層中以延遲載入的外觀模式提供,因此 HEIC 解碼器永遠不會進入開機區塊 |
| `host.geom` | 1.64 | 精確向量幾何運算:路徑布林運算、偏移、筆畫轉填色、雲形線降階、簡化、命中測試。同樣是純函式、同步執行,並由引擎掛接(`makeGeomApi()`);失敗會以*回傳值*表示,而非拋出例外 |

其餘部分遵循相同規則，並在其旁一併記載：`pdf`（1.8）與 `pptx`（1.58）用於裝置端文件加工，`audio`（1.71）與 `speech`（1.96）用於片段分析與裝置端 TTS／轉錄，`viz`（1.72）用於 MilkDrop 佔位合約，`codec`（1.100）與 `layers`（1.102）用於深位元與分層點陣輸出，`upscale`（1.101）與 `matte`（1.103）用於裝置端模型，`raster`（1.105）供自行處理像素運算的 hooks 使用，`connectors`（1.106）用於輸出安全的箭頭，以及 `c2pa`（1.85）用於為完成的位元組簽章。數量會持續增加；規則不會。

可宣告的能力有：`network`、`filesystem`、`clipboard`、`camera`、`microphone`、`screen`、`ffmpeg`、`wasm`、`capture`、`compose`。（`screen` 於 1.54 新增，是透過 `host.recorder` 的畫面擷取 - 使用者在瀏覽器原生 UI 中選取螢幕／視窗／分頁；與 `capture` 不同，後者是將工具自行指定的某個 URL 點陣化。）

同一個工具能在瀏覽器、Tauri 與無頭 CLI 中執行，是因為每個 shell 都實作了這個介面 - 工具本身並不知道自己身處哪一個環境。

這個橋接是有版本的。新增方法屬於次版號更新。移除或變更簽章屬於主版號更新。當 v2 上線時，v1 必須持續可用。

### 4. 資產 ID 永遠不變

`suse/logo/primary` 是一份合約。一旦發布：
- ID 永遠不會變更，也不會被重複使用。
- 位元組內容變更 → 在 manifest 中提升 `version`。
- 被新資產取代 → 設定 `deprecated: true`，並可選擇性設定 `replacedBy`。
- 既有的參照永遠能被解析。

這讓已儲存的工具狀態與 URL 分享連結，能夠歷經多年依然可用。

### 5. URL 模式屬於一等公民

每個輸入都必須能以 URL 參數表達：

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![那個連結本身，不含其他任何東西，就是完成的成品](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI 模式就是換了一種傳輸方式的 URL 模式 - CLI shell 會從 argv 建構一個 URL 狀態物件，並執行**同一條**引擎管線。只有一條算繪路徑。CLI 不可能與 GUI 出現偏差，因為它並非另一套實作。

`url-mode.ts` 負責處理往返轉換（解析與序列化）。有一組**保留參數**永遠不會以輸入形式轉發給工具：輸出控制項（`format`、`export`、`copy`、`filename`、`width`/`w`、`height`/`h`、`unit`、`dpi`）、印刷與來源標記旋鈕（`bleed`、`marks`、`profile`、`password`、`c2pa`、`imprint`、`durable`、`meta`、`hdr`、`depth`、`cuts`），以及狀態載體（`template`、`z` - 也就是「最短連結」封裝權杖 - 與 `zx`，即以密碼加密後的同一種權杖）。`engine/src/url-mode.ts` 中的 `RESERVED` 集合是權威來源，並由測試釘住；[URL Mode](/info/url-mode.html) 記載了其中每一個項目，包括這裡未列出的少數幾個。URL 模式下的資產輸入以其 `id` 序列化；執行環境會在生成前透過 `host.assets.get()` 解析它們。`width`／`height` 是以 `unit` 為單位的數值（預設 `px`，也可用 `mm`/`cm`/`in`/`pt`/`pc`）；使用實體單位時，`dpi` 會設定點陣解析度。它們會設定畫布的文件尺寸，並預先填入輸出尺寸面板。

由於每個輸入都會隨連結一起傳遞，參數一變，就是不同的成品。以下整個調色盤，就只是一個種子色、一種調和方式與一個階數：

![四種色相中的九個階段,全部從連結中攜帶的單一種子色衍生而來](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. 儲存透過橋接層進行,而非直接存取

Web shell:IndexedDB。Tauri:檔案系統。CLI:記憶體內。工具只能看到 `host.state.save(slot, data)` 和 `host.state.load(slot)`。不使用 `localStorage` - 它太小,也無法儲存 blob。

使用者可以為每個工具儲存多個具名編輯槽,之後回到各個工作階段。不需要建立帳號;狀態是以裝置為單位的。由於橋接層是唯一的介面,這種以裝置為單位的狀態也是*可攜的*:`shells/web/src/data-transfer.ts` 透過 `host.profile`/`host.state`/`host.assets` 讀出所有內容,整合成單一 `lolly-backup` 壓縮檔,可在任何其他安裝中匯入 - 這是不需要伺服器就能解決「移到新裝置」問題的離線方案(完整規格見 `docs/data-transfer.md`)。SUSE ID 整合(多裝置同步)是建立在此之上的未來里程碑。

### 7. 成熟度標籤透過設計解決「品牌核准」的風險

每個工具都在其清單中宣告 `status: official | community | experimental`。圖庫依狀態排序。實驗性工具的匯出會自動加上浮水印 - 浮水印由 `host.export.render` 套用,而非由工具本身套用,因此非官方工具作者無法選擇退出。

這是對「使用任何工具即代表獲得品牌核准」這種觀感風險的結構性解答。流程性解答(審核佇列、SUSE ID 閘控)則疊加於其上。

### 8. 工具輸入透過清單定型,資產也不例外

輸入項宣告一個 `type`:`text`、`longtext`、`number`、`boolean`、`color`、`select`、`asset`、`date`、`time`、`datetime-local`、`url`、`blocks`、`vector`、`table` 和 `file`。主機會依清單中的類型渲染通用控制項 - 工具本身不需要撰寫任何控制項程式碼。(從使用者個人檔案預先填入不算是一種類型 - 任何輸入都可以帶有 `bindToProfile`。)其中有三種份量特別重:

- **`asset`**(搭配 `filter` 和 `allowUpload`)是連接全域資產系統的橋接;`allowUpload: false` 是品牌強制執行的槓桿,適用於贊助方塊標誌之類只允許使用圖庫資產的情況。使用者上傳的檔案使用與圖庫資產相同的 `AssetRef` 格式,因此工具能以相同方式處理它們。
- **`blocks`** 是一種重複的欄位群組 - 一個輸入內的迷你表格,在側邊面板中編輯,附有已定型/可判別的新增選單以及每個區塊的資產欄位。點擊畫布上渲染出的區塊,會聚焦該區塊對應的列。用於 `meeting-planner`、`chart-creator`、`event-name-badge`、`wayfinding-signage`、`color-block` 和 `digi-ad`。
- **`vector`** 將一組固定的數值(例如一個變形)歸為一個複合控制項;**`file`** 將使用者自己的檔案以位元組形式保存在記憶體中,供裝置端轉換工具使用(例如 `strip-data` 和 `compress-pdf`)。

### 9. 模板不含邏輯(Handlebars,而非 EJS)

刻意選擇 Handlebars 而非 EJS:
- 不含邏輯。模板可以由非開發人員撰寫。
- 預設安全。`{{x}}` 會進行 HTML 逸出;`{{{x}}}` 則是選擇性的原始輸出。
- 模板中沒有任意 JS,代表不需要逐模板進行 XSS 稽核。

邏輯存在於 `hooks.js` 中,明確且可審閱。可用的 Handlebars 輔助函式:`{{default}}`、`{{upper}}`、`{{lower}}`、`{{eq}}`、`{{markdown}}`、`{{asset ref}}`、`{{asset ref "property"}}`(還有並列的 `.ics`/`.vcf`/`.csv` 模板所用的資料格式輔助函式 `icsStamp`/`rfcText`/`csvCell`)。

### 10. 工具組合工具

一個工具可以嵌入**另一個**工具的渲染結果,而不需要工具對工具的匯入 - 組合是由引擎解析的,絕不是由工具程式碼解析。有兩種介面:

- **宣告式清單** - `composes: [{ id, tool, inputs, format?, width?, height? }]`。引擎渲染指定的子工具,並將結果以 `{{asset <id>}}` 的形式放入不含邏輯的模板中。`event-name-badge` 目前以 SVG 形式組合了 `qr-code`。
- **可攜式嵌入網址** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`。Shell 會在**本機**渲染該子項(在本機渲染完成前顯示佔位像素);絕不會從 `lolly.tools` 取得任何內容。

組合任何工具的渲染結果:當父項匯出為 SVG 或 PDF 時,**SVG** 子項仍保持真正的向量狀態,匯出為 PNG 時則精確點陣化;**PNG/JPG/WEBP** 子項則以圖片形式內嵌。需要 `compose` 能力。被組合的子項屬於中介產物 - 絕不加上浮水印或來源標記 - 而且組合會優雅降級:無法渲染子項的 shell 只會省略該槽位,父項仍會正常渲染。

---

## 我們明確選擇不做的事

- **範本中沒有 EJS,也沒有任意 JS。** XSS 攻擊面為零。邏輯全部放在 `hooks.js` 中。
- **沒有強制性的素材 CMS。** 個人可以直接在應用程式內,將自己的創意檔案匯入自己的目錄中([目錄](/info/using.html)檢視畫面與 Brand Studio) - 不需要伺服器,也不需要管理主控台。作品是以**工作階段(session)**的形式交接:分享連結攜帶完整狀態,同一個工作階段也能透過備份或協作工作階段傳遞。部署的掌控者可以將某個已分享的工作階段鎖定為**範本(template)** - 開啟連結、將其數值記錄為該工具在品牌包目錄下的範本項目,再提交(commit) - 之後它便會出現在該工具的「New from template」選單中,並可透過 `?template=<id>` 深層連結存取。Git 是部署擁有者的鎖定步驟,絕非創作者的步驟。若要打造*共享且受管理*的目錄,組織**可以**以相同方式管理素材目錄,並透過 PR 審查來把關更新 - 這是一種可選的治理模式,而非應用程式的強制要求。
- **沒有強制性的 RBAC。** 開放版應用程式預設為公開存取;品牌風險透過成熟度標籤與浮水印來管理。若組織需要更嚴格的控管,可在其上疊加自己的驗證機制,以及上述經 Git 審查的目錄。
- **沒有中央資料庫。** 所有使用者狀態皆以裝置為單位儲存。SUSE ID 整合已列入路線圖,但並非上線的先決條件。
- **沒有共用的工具/引擎程式碼路徑。** 引擎是開放原始碼,`community/` 中與品牌無關的工具也是;像私有的 `brands/suse/` 這樣的品牌包,則依其自身條款攜帶自己的工具與目錄。無論哪種情況,這種區隔都是強制執行的(`engine/` 絕不會反向匯入工具內容),以確保此區分維持乾淨。

---

## 完整生命週期

使用者開啟 `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **啟動。** Web shell 開啟 IndexedDB,建構能力橋接層,同步工具與資產目錄(離線時則從快取載入)。
2. **路由。** URL 雜湊 → `tool` 檢視畫面,並取出 `qr-code` 與 URL 參數。
3. **載入。** `loadTool('qr-code', fetchFile)` 取得 `tool.json`,依 JSON Schema 驗證,並取得 `template.html`、`styles.css` 和 `hooks.js` 原始碼。
4. **解析 URL 狀態。** `parseUrlState` 將 URL 參數轉譯為初始輸入值。資產參照(`?logo=suse/logo/primary`)會被解析為輕量的 `{ id, _unresolved: true }` 物件。
5. **執行環境。** `createRuntime(tool, host, initialValues)` 建構輸入模型(合併個人檔案資料、預設值和初始值)、透過 `host.assets.get()` 解析資產參照、載入 hooks(以閉包範圍存取 `host`,而非沙盒),呼叫 `hooks.onInit`。
6. **渲染。** Shell 訂閱執行環境;每次狀態變更都會收到 `{ model, hydrated }`。它依模型渲染輸入控制項,並將水合後的模板 HTML 寫入 `#tool-canvas`。
7. **互動。** 使用者在輸入欄輸入內容 → `runtime.setInput(id, value)` → 套用限制條件 → 呼叫 `hooks.onInput` → 重新水合 → 重新渲染。畫布即時更新。
8. **匯出。** 使用者點擊下載(PNG)→ `runtime.export(canvasNode, 'png')` → `host.export.render`(透過 dom-to-image-more 點陣化;SVG/PDF 則透過專用的 DOM 走訪向量化器)→ blob → `host.export.download`。工具可選用的格式範圍相當廣泛,`schemas/tool.schema.json` 中的 `render.formats` 列舉是這方面的權威定義 - 點陣圖與浮點點陣圖、向量與裁切檔案、印刷/CMYK、動態影像、可編輯文件(`pptx`、`docx`、`odt`)、調色盤與資料/文字輸出,以及音訊和字型檔案。[URL 模式](/info/url-mode.html)列出了每個 ID 及其產出的內容。音訊也和其他項目一樣屬於這個列舉(`wav`、`mp3`、`m4a`、`opus`,由 audiogram 和錄製工具所宣告);另外,錄製工具的 `render.capture` 模式會驅動 `host.recorder`,其成品會以瀏覽器錄製時所用的容器格式,以完成的 Blob 形式送達。(設定 `render.export: false` 的工具 - 例如 Color Palette、Countdown Timer、Strip Hidden Data、Text Helper、Compress PDF - 會隱藏下載/格式/尺寸控制項。)實體單位會在這個階段依格式進行轉換(PDF → 真實頁面點數,點陣圖 → 依 DPI 換算的像素,並帶有 `pHYs` 區塊)。作者/來源元資料(作者、工具、來源 - 由 `engine/src/metadata.ts` 建構)會依格式內嵌:PNG iTXt、JPEG EXIF、PDF info 字典、SVG `<metadata>`、GIF 註解。實驗性工具的浮水印是由主機插入,而非由工具本身插入。

![`?options` 開啟的匯出面板:檔名與格式配對、輸出尺寸,以及寫入檔案的控制項](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Tauri 中的生命週期相同。CLI 中的生命週期也相同 - jsdom 提供無頭 DOM;輸出寫入檔案或標準輸出。

---

## 開放原始碼狀態

**程式碼採用 MPL-2.0 授權。** `engine/`、`shells/*`、`services/*`、`schemas/` 與 `docs/` 皆以 **MPL-2.0** 授權開放原始碼 - 這是一個廠商中立的品牌工具腳手架平台,每個可發行的單元都各自置於 [github.com/lolly-tools](https://github.com/lolly-tools) 下的獨立版本庫中。

**工具內容以品牌包的形式發行**,各自附有自己的條款(詳見該包的 `NOTICE.md`)。`community/` 是公開的 [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) 版本庫,其中與品牌無關的工具同樣採用 MPL-2.0 授權。`brands/suse/` 是私有的 `suse-lolly` 包:SUSE 的工具與 SUSE 的目錄,**為 SUSE 所專有**,包括其已授權使用的 PremiumBeat 音樂。`brands/lolly-start/` 是本版本庫所擁有的空白入門品牌。字體則以 **SIL Open Font License 1.1** 授權隨包發行 - SUSE 包附帶 SUSE 與 SUSE Mono 字體。

版本庫根目錄下的 `tools/` 與 `catalog/` 是 Git 忽略的*檢視畫面*:設定檔會從 `community/` 加上目前啟用的品牌包組合出這兩者,因此每個指令碼與殼層讀取的都是這兩條路徑,而絕不會直接讀取某個品牌包。

此區隔是強制執行的 - `engine/` 絕不會反向匯入工具內容 - 因此平台與內容之間的界線始終維持乾淨。

---

## 引擎在哪裡結束,主機從哪裡開始

如果可以用純資料 + Handlebars 描述 → **引擎**。
如果涉及 DOM、檔案系統、網路或任何瀏覽器/作業系統 API → **主機**。

這條界線是刻意畫得清楚的。引擎是開放原始碼的部分。任何知道 SUSE、特定平台或執行環境細節的東西,都不會放進引擎。

想了解更深一層的細節,[`engine/README.md`](../engine/README.md) 列出了每個引擎模組及其職責,而[威脅模型與信任邊界](/info/threat-model.html)則記錄了這條界線同時作為信任邊界的位置。
