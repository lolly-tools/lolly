# 自行驗證

本網站上的每一項承諾都可以檢查，不需要帳號。大多數檢查只需要瀏覽器；其餘的需要終端機和原始碼副本。如果下方的檢查沒有得到所示的結果，那就是錯誤或違反承諾，我們想知道：請見[如果檢查失敗](#if-a-check-fails)。

從最快的開始：把檔案拖放到 Verify 上。然後更進一步：使用工具時觀察網路、拔掉網路線繼續工作、數一數 Cookie，並閱讀原始碼。

這些檢查涵蓋 Lolly 本身。如果你的組織運行 Lolly Work，它會增加登入、共用內容、已設定的遙測與稽核記錄；請對照[伺服器面](/info/server-surface.html)與[隱私政策的組織章節](/info/privacy.html#organisation-services-with-lolly-work)來檢查這些。

## 十秒內親眼見證

開啟 [`/verify`](/#/verify)，把檔案拖放到頁面上。沒有上傳、沒有帳號，也不必等待伺服器。這裡它檢查的是 Our AI Stance 中[生成的昆士蘭風暴](/info/ai-stance.html)：一張由 Gemini 生成、Lolly 開啟、標記並轉換的圖片。每個徽章都在裝置上根據檔案本身的位元組算出。

![在手機寬度螢幕上的 Verify - 風暴影像、綠色的 Made with Lolly 判定,以及底下堆疊的憑證完整與位元組未變動徽章](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

判定是一小堆徽章，各自是獨立的事實：

- <!--i:lock--> **Made with Lolly**：憑證完整，*而且*記錄了 Lolly 的匯出。
- <!--i:seal--> **The credential is intact**：已簽署的 C2PA manifest 可解析，且其自身的聲明簽章驗證通過。
- <!--i:hash--> **The bytes have not changed**：檔案的雜湊仍與簽署時相符。改動一個像素，這個徽章就會翻轉。
- <!--i:sparkle--> **GEN AI**：這些像素是機器製作的，檔案也這麼說。Lolly 把該聲明讀回來，而不是隱藏這項事實。

完整的歷史隨檔案傳遞。這裡留存了九個步驟：Google 在生成並加浮水印時記錄的五個，以及 Lolly 在這個頁面上開啟、標記並轉換副本時記錄的四個。Verify 直接從位元組中讀出它們，並繪製成時間軸。

![Verify 從風暴影像讀回的變更歷史 - 五個步驟由 Google 記錄,接著四個由 Lolly 記錄,最終成為本頁上的 WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

這就是示範。下方的檢查是其底層的保證，每一項都可重現。[Content Credentials](/info/content-credentials-identity.html)說明每個判定。

## 在瀏覽器中,無需任何工具

::: timeline
- <!--i:globe--> **1. 觀察網路。** 開啟 [lolly.tools](https://lolly.tools)，開啟瀏覽器的 DevTools（F12），切換到 **Network** 並使用工具：在 [QR Code](/t/qr-code) 中輸入網址、更改色彩、匯出 PNG。每個請求都留在 `lolly.tools`：應用程式外殼、工具自己的檔案與目錄素材。沒有分析主機、沒有 CDN 信標、沒有字型服務，也沒有錯誤回報端點。你在工具中輸入的內容**完全不會出現在任何請求中**，因為渲染是在本機進行的。
- <!--i:eyeoff--> **2. 拔掉網路線。** 載入應用程式並開啟一兩個工具，然後離線（飛航模式，或 DevTools → Network → Offline）並重新載入。圖庫與你開啟過的每個工具都繼續運作，包括你用過的格式的渲染與匯出。工具的檔案與格式的編碼器在你第一次使用時快取，所以在離線測試之前，請先在線上使用一次工具。這是本頁上最有力的單一檢查：會回報的軟體，被切斷網路線後無法存活。
- <!--i:check--> **3. 數一數 Cookie。** DevTools → **Application**（Firefox：**Storage**）→ Cookies → `https://lolly.tools`。清單是空的：應用程式不設定 Cookie。把 `document.cookie` 貼到主控台，你會得到 `""`。選用的 CA 註冊會設定一個短效的 `HttpOnly` Cookie `lolly_ca_state`，範圍限於 `/api/ca`，`document.cookie` 無法顯示它。Lolly Work 實例使用自己的登入 Cookie；請對照[隱私](/info/privacy.html#organisation-services-with-lolly-work)。
- <!--i:layers--> **4. 讀取你自己的儲存空間。** 在同一個面板中，Lolly 保存的一切都在你眼前：二十幾個純 `localStorage` 鍵（主題、語言、側邊欄寬度、音效與檢視設定，以及公開工具目錄索引的快取副本），以及你在 IndexedDB 中自己的文件。每個值都是可讀的字串或 JSON，沒有任何混淆。清除網站資料會移除這些本機記錄，但不會移除同步備份或 Lolly Work 實例所保存的記錄。**Settings → Storage → Clear all my data** 在應用程式內做同樣的事，你可以看著儲存與快取被清空。
- <!--i:lock--> **5. 檢查揭露聯絡方式是否存在。** [`/.well-known/security.txt`](/.well-known/security.txt) 回應的是 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 聯絡區塊，而不是 HTML 頁面。
:::

::: details 你在 Network 分頁中可能看到的其他內容
有些功能只有在你使用時才會連上網路，而且每一項在同一個分頁中都看得到：

- 在 Design System Setup 加入 **Google Font** 時，會在首次擷取之前出現一次同意對話框，說明此事，然後從 Google 擷取該字型家族；
- 點擊 **ICC press-profile preset** 會從 color.org 的 ICC 公開登錄處擷取該描述檔；
- 播放選用的內建**電台**會從電台串流；
- 在 **Meeting Planner** 中輸入地點，會向 open-meteo 的地理編碼服務查詢該地點的座標與時區，每個城市一次（答案儲存在你的裝置上），而且欄位會在你輸入之處說明這一點；
- **URL Screenshot** 載入你輸入的位址，因為這是它的工作，你可以看著它發生。

宣告網路能力的工具，只能從其 manifest 允許清單中的主機擷取，而且該檢查會安全失效。目前出貨的工具沒有宣告這項能力，所以是瀏覽器強制執行的 Content-Security-Policy 把上述清單限制在其主機。[隱私政策](/info/privacy.html)保有所有這些的標準表格，包括受管理實例的流量，例如政策更新與已啟用的回報。
:::

## 在終端機中

**6. 渲染端點只回應公開資料。** 唯一把輸入的內容放進 URL 的伺服器功能，也就是熱連結渲染，在這裡是運作中的。[隱私政策](/info/privacy.html)說明這對你放進連結的輸入意味著什麼。

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

每個部署各自選擇（`LOLLY_DISABLE_RENDER_GET=1`）：在設定了它的實例上，相同的探測會回傳 `404`。這個差異是設定在發揮作用，不是不一致。

**7. 檢查你的部署啟用的服務。** [伺服器面](/info/server-surface.html)列出選用服務並連結其詳細參考。對於 Lolly Work，請包含其經過驗證的 API、協作連線、儲存與已設定的提供者。對公開的 lolly.tools 做探測，無法測試私人的組織實例。

如果你運行自己的實例，[交付部署](/info/deploy-delivery.html)有它的發行檢查：模型完整性、邊緣探測及其樣本清單、顯示用轉譯版本、私人下載閘道，以及瀏覽器中已簽署的目錄。


## 在原始碼中

如果部署的程式碼與公開的程式碼不同，以上一切仍可能只是做戲。所以請檢查程式碼。部署是從[公開儲存庫](https://github.com/lolly-tools/lolly)建置的：

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 任何地方都沒有追蹤器和分析 SDK。** 在出貨的程式碼（引擎、包括瀏覽器擴充功能在內的每個外殼、Tauri 橋接覆寫與 service worker、伺服器函式，以及工具套件）中搜尋常見的嫌疑對象：

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

這項掃描尋找的是第三方追蹤 SDK。它並不顯示沒有第一方的使用情況回報：Lolly Work 支援組織遙測與獨立的稽核記錄，並有自己的政策與測試。

**9. 沒有第三方 DNS 解析器。** Verify 的 SEAL 檢查絕不會透過 DNS-over-HTTPS 提供者發送查詢，因為應用程式沒有解析器：

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 憑證服務不保留簽發記錄。** 身分 CA 不保留它簽發了什麼的記錄，也沒有身分清冊：沒有 stdout 行、沒有 webhook、沒有憑證儲存。這種「不存在」可以被搜尋出來：

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA 確實保留短效的工作狀態：限流儲存桶在其期間內保存雜湊的 IP 與電子郵件鍵，而受管理部署的准入儲存最多保存十分鐘的金鑰式識別碼與請求摘要。[Content Credentials 工程](/info/content-credentials-engineering.html#protocol)有詳細說明。

## 由測試強制執行

上述的原始碼檢查不是一次性的稽核：它們被固定在測試套件中，所以不會悄悄腐壞。[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) 檢查的追蹤器名稱清單比上面的掃描更長，並在以下情況讓建置失敗：

- 任何分析或追蹤 SDK 出現在它所掃描的出貨原始碼中的任何地方，涵蓋應用程式、引擎、伺服器、擴充功能與工具套件的程式碼；
- 任何第三方 DNS-over-HTTPS 解析器出現在該原始碼中；
- CA 簽發記錄回來了，無論是在原始碼**或**產生的伺服器套件中；
- 隱私政策失去其法律要求的陳述（具名控制者、法律依據、申訴權）。

請在 clone 中自行執行它們（Node 22.18 或更新版本；這個檔案不需要 `pnpm install`）：

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

完整測試套件(`pnpm install && pnpm test`)會再執行數千項測試,包括[安全性與驗證](/info/security.html)中所描述的對抗式加密測試。

## 你無法從外部驗證的事

- **託管存取記錄。** 任何回應請求的伺服器都可以記錄它：IP 位址、路徑與時間。外部探測無法確定記錄保留多久。營運者控制記錄、輪替與匯出，並且必須揭露這些選擇。本機渲染讓一般編輯留在你的裝置上；選用的伺服器渲染與共用工作區服務有隱私政策所述的獨立資料流。
- **部署是否運行這份程式碼。** 你可以檢查原始碼是否乾淨，以及部署的行為是否與之相符，而上述檢查兩者都做。網頁部署的二進位層級證明不是網頁平台所提供的。緩解措施是公開儲存庫、強制執行的測試與離線檢查：被竄改而會回報的部署，會同時通不過檢查 1 和 2。
- **工具 hooks。** 內建工具的選用邏輯是經過審閱而非沙箱化的：除非工具選擇使用 Worker，否則它在頁面中執行。lolly.tools 上的每個工具都是第一方的，並在出貨前經過審閱。[威脅模型](/info/threat-model.html#trust-boundaries)說明 hooks 在哪裡執行，以及什麼限制它們。

## 若某項檢驗失敗

本頁與你的觀察之間的差異就是安全報告。請透過[安全與驗證](/info/security.html#reporting-a-vulnerability)上的私人管道送出。我們實行協調式揭露，並致謝回報者。
