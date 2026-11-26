# 自行驗證

這個網站上的每項承諾都能檢查，不需要帳號。大多數檢查只需瀏覽器，其餘則需要終端機與一份原始碼。如果下列檢查沒有得到所示結果，那就是錯誤或未履行的承諾，我們希望知道：請見[檢查失敗時](#if-a-check-fails)。

這些檢查涵蓋 Lolly 本身。如果你的組織運行 Lolly Work，它會加入登入、共用內容、已設定的遙測與稽核記錄；請對照[伺服器介面](/info/server-surface.html)與[隱私政策的組織章節](/info/privacy.html#organisation-services-with-lolly-work)檢查這些項目。

<!--i:eti-clock-->
## 十秒內看看它如何運作

開啟 [`/verify`](/#/verify)，將檔案拖放到頁面上。不需上傳、不需帳號，也不需等待伺服器。這裡檢查的是〈我們對 AI 的立場〉中的[生成的昆士蘭風暴圖片](/info/ai-stance.html)：由 Gemini 生成，再由 Lolly 開啟、標記與轉換的圖片。每個徽章都在裝置上，從檔案本身的位元組計算得出。

![手機寬度螢幕上的 Lolly Verify：風暴圖片、綠色的 Made with Lolly 判定，以及下方堆疊的憑證完整與位元組未變更徽章](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

判定由幾個徽章組成，每個都是一項獨立的事實：

- <!--i:lock--> **Made with Lolly**：憑證完整，*而且*記錄了 Lolly 匯出。
- <!--i:seal--> **The credential is intact**：已簽署的 C2PA manifest 可解析，且其宣告本身的簽章通過驗證。
- <!--i:hash--> **The bytes have not changed**：檔案的雜湊值仍與簽署時相符。只要改動一個像素，這個徽章就會改變。
- <!--i:sparkle--> **GEN AI**：這些像素由機器製作，檔案也如此宣告。Lolly 會讀出這項宣告，而非隱藏這個事實。

完整歷史記錄會隨檔案傳遞。這裡保留了九個步驟：先是 Google 在生成圖片與加入浮水印時記錄的五個步驟，再是 Lolly 在開啟、標記與轉換本頁副本時記錄的四個步驟。Lolly Verify 直接從位元組讀取它們，並繪成時間軸。

![Lolly Verify 從風暴圖片讀出的變更歷史記錄：先是 Google 記錄的五個步驟，再是 Lolly 的四個，最後成為本頁的 WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

下列檢查是這個示範背後的保證，每一項都可重現。[Content Credentials](/info/content-credentials-identity.html) 說明每種判定。

<!--i:eti-globe-->
## 在瀏覽器中，不需其他工具

::: timeline
- <!--i:globe--> **1. 觀察網路。** 開啟 [lolly.tools](https://lolly.tools)，開啟瀏覽器的 DevTools（F12），切換到 **Network** 並使用工具：在 [Lolly QR Code](/t/qr-code) 輸入網址、更改色彩、匯出 PNG。每個請求都送到 `lolly.tools`：應用程式外殼、工具自己的檔案與目錄素材。沒有分析主機、CDN 信標、字型服務或錯誤回報端點。你在工具中輸入的內容**不會出現在任何請求中**，因為渲染在本機進行。
- <!--i:eyeoff--> **2. 切斷連線。** 載入應用程式並開啟一兩個工具，接著離線（飛航模式，或 DevTools → Network → Offline）並重新載入。工具庫與你開啟過的每個工具都能繼續運作，包括以你使用過的格式渲染與匯出。工具的檔案與格式的編碼器會在第一次使用時快取，因此請先在線上使用工具一次，再測試離線。這是本頁最有力的單一檢查：需要回傳資料的軟體，在連線切斷後就無法照常運作。
- <!--i:check--> **3. 計算 cookie。** DevTools → **Application**（Firefox：**Storage**）→ Cookies → `https://lolly.tools`。清單是空的：應用程式不設定 cookie。將 `document.cookie` 貼到主控台，會得到 `""`。選用的 CA 註冊會設定短效的 `HttpOnly` cookie，名稱為 `lolly_ca_state`，範圍限定於 `/api/ca`，`document.cookie` 無法顯示它。Lolly Work 實例使用自己的登入 cookie；請與[隱私](/info/privacy.html#organisation-services-with-lolly-work)比對。
- <!--i:layers--> **4. 讀取自己的儲存資料。** 在同一個面板中，Lolly 保存的所有內容都在眼前：約二十多個一般的 `localStorage` 鍵（主題、語言、側邊欄寬度、音效與檢視設定，以及公開工具目錄索引的快取副本），還有你在 IndexedDB 中的文件。每個值都是可讀的字串或 JSON，沒有任何混淆處理。清除網站資料會移除這些本機記錄，但不會移除 Sync 備份或 Lolly Work 實例儲存的記錄。**Settings → Storage → Clear all my data** 可在應用程式內執行相同操作，你可以看著儲存區與快取清空。
- <!--i:lock--> **5. 檢查漏洞揭露聯絡方式是否存在。** [`/.well-known/security.txt`](/.well-known/security.txt) 會回傳 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 聯絡資訊區塊，而非 HTML 頁面。
:::

::: details Network 分頁中還可能看到什麼
有些功能只在你使用時才會連上網路，每項都能在同一個分頁中看到：

- 在 Lolly Design System Setup 中新增 **Google Font** 時，會從 Google 擷取該字型家族；第一次擷取前會顯示一次同意對話框，說明此事；
- 點擊 **ICC 印刷設定檔預設集**時，會從 color.org 的 ICC 公開登錄庫擷取該設定檔；
- 播放選用的內建**廣播**時，會從電台串流播放；
- 在 **Meeting Planner** 中輸入地點時，會向 open-meteo 的地理編碼服務查詢該地點的座標與時區，每個城市查詢一次（結果儲存在你的裝置上），輸入欄位也會在你輸入的位置說明；
- **Lolly URL Screenshot** 會載入你輸入的網址，你可以看到這個過程。

宣告網路能力的工具，只能從其 manifest 允許清單中的主機擷取資料，且這項檢查在失敗時會拒絕存取。目前發布的工具沒有任何一個宣告網路能力，因此瀏覽器強制執行的 Content-Security-Policy 將上述清單限制在其主機範圍內。[隱私政策](/info/privacy.html)提供所有這些流量的正式對照表，包括政策更新與已啟用回報等受管理實例流量。
:::

<!--i:eti-code-->
## 從終端機檢查

**6. 渲染端點只回傳公開資料。** 唯一會將輸入內容放入 URL 的伺服器功能，也就是熱連結渲染，已在這裡啟用。[隱私政策](/info/privacy.html)說明這對你放入連結的輸入內容有何意義。

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

每個部署自行選擇（`LOLLY_DISABLE_RENDER_GET=1`）：在設有此變數的實例上，相同的探測會回傳 `404`。這個差異表示設定正在生效，並非不一致。

**7. 檢查部署啟用的服務。** [伺服器介面](/info/server-surface.html)列出選用服務，並連結至詳細參考資料。對 Lolly Work，請納入需要驗證身分的 API、協作連線、儲存與已設定的供應商。對公開 lolly.tools 的探測，不會測試私人組織實例。

如果你運行自己的實例，[交付部署](/info/deploy-delivery.html)提供發布檢查：模型完整性、邊緣探測及其樣本清單、顯示用衍生版本、私人下載閘道，以及瀏覽器中的已簽署目錄。


<!--i:eti-search-->
## 在原始碼中檢查

如果部署的程式碼與公開程式碼不同，以上一切仍可能只是假象。所以請檢查程式碼。部署是從[公開儲存庫](https://github.com/lolly-tools/lolly)建置的：

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 任何地方都沒有追蹤器或分析 SDK。** 在發布的程式碼中搜尋常見的可疑項目（引擎、每個執行外殼，包括瀏覽器擴充功能、Tauri 橋接覆寫與 service worker、伺服器函式及工具套件）：

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

這項掃描尋找的是第三方追蹤 SDK，並不證明沒有第一方使用情況回報：Lolly Work 支援組織遙測與獨立的稽核記錄，各有自己的政策與測試。

**9. 沒有第三方 DNS 解析器。** Lolly Verify 的 SEAL 檢查絕不會透過 DNS-over-HTTPS 供應商傳送查詢，因為應用程式沒有解析器：

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 憑證服務不保留簽發記錄。** 身分 CA 不會記錄已簽發的內容，也沒有身分清冊：沒有 stdout 輸出行、webhook 或憑證儲存區。可以透過搜尋確認這些內容不存在：

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA 確實會保留短效的工作狀態：速率限制儲存桶會在其時間窗內保存經雜湊處理的 IP 與電子郵件鍵，而受管理部署的准入儲存區會保存以金鑰產生的識別碼與請求摘要，最長十分鐘。[Content Credentials 工程](/info/content-credentials-engineering.html#protocol)提供詳細說明。

<!--i:eti-flask-->
## 透過測試強制維持

上述原始碼檢查並非一次性的稽核：它們已固定在測試套件中，因此無法悄悄失效。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) 檢查的追蹤器名稱清單比上述掃描更長，若有以下情況就會使建置失敗：

- 它掃描的已發布原始碼中，任何地方出現分析或追蹤 SDK，包括應用程式、引擎、伺服器、擴充功能與工具套件程式碼；
- 該原始碼中出現任何第三方 DNS-over-HTTPS 解析器；
- CA 簽發記錄重新出現在原始碼**或**產生的伺服器套件中；
- 隱私政策缺少法律要求的聲明（具名的資料控管者、法律依據、申訴權）。

在複製的儲存庫中自行執行這些測試（Node 22.18 或更新版本；此檔案不需要 `pnpm install`）：

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

完整套件（`pnpm install && pnpm test`）還會執行數千項測試，包括[安全與驗證](/info/security.html)所述的對抗性密碼學測試。

<!--i:eti-eye-off-->
## 無法從外部驗證的事項

- **託管服務的存取記錄。** 任何伺服器都能記錄它回應的請求：IP 位址、路徑與時間。外部探測無法確定記錄保留多久。營運者控制記錄、輪替與匯出，且必須揭露這些選擇。本機渲染讓一般編輯留在你的裝置上；選用的伺服器渲染與共用工作空間服務，則有隱私政策所述的獨立資料流。
- **部署是否執行這份程式碼。** 你可以檢查原始碼是否乾淨，以及部署後的行為是否符合原始碼，上述檢查兩者都有涵蓋。網頁平台不提供網頁部署的二進位層級證明。緩解措施是公開儲存庫、強制執行的測試與離線檢查：遭竄改且會回傳資料的部署，會立即在檢查 1 與 2 失敗。
- **工具掛鉤。** 內建工具的選用邏輯經過審查，而非置於沙箱：除非工具選擇使用 Worker，否則會在頁面中執行。lolly.tools 上的每個工具都是第一方工具，發布前都經過審查。[威脅模型](/info/threat-model.html#trust-boundaries)說明掛鉤在哪裡執行，以及受到哪些限制。

<!--i:eti-warning-->
## 檢查失敗時

本頁與你觀察到的情況若有差異，就值得提出安全報告。請透過[安全與驗證](/info/security.html#reporting-a-vulnerability)上的私人管道傳送。我們採取協調揭露，並為回報者署名致謝。
