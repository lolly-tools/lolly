# 自行驗證

Lolly 的隱私與安全頁面提出了一些主張：沒有分析、沒有追蹤、檔案永不離開裝置、整個系統只有一個 cookie。這個頁面不一樣：它不會要求你相信這些說法。它是一份程序清單,每一項都附上確切的指令或點擊路徑,以及你會看到的輸出結果。這裡的每一項主張都能在幾分鐘內被證偽,多數甚至不需要安裝任何東西。

如果本頁的任何檢查沒有產生所示的結果,那不是臭蟲就是被打破的承諾。[請回報](#if-a-check-fails),無論是哪一種,我們都會以違背承諾應有的嚴重程度來處理。

## 十秒內親眼見證

在進入程序之前,先看看成果。開啟 [`/verify`](/#/verify),把一個檔案拖放到上面 - 不上傳、不需帳號、也不用等伺服器。這裡示範的是檢查來自我們 AI 立場頁面的[生成的 Queensland 風暴影像](/info/ai-stance.html)：一張由 Gemini 生成、經 Lolly 開啟、調整大小並匯出的影像。以下每個徽章,都是在裝置上根據檔案本身的位元組計算出來的。

![在手機寬度螢幕上的 Verify - 風暴影像、綠色的 Made with Lolly 判定,以及底下堆疊的憑證完整與位元組未變動徽章](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

這個判定結果並非單一徽章,而是一小疊徽章,各自代表一項獨立的事實：

- <!--i:lock--> **Made with Lolly** - 憑證完整,*而且*記錄了一次 Lolly 匯出。
- <!--i:seal--> **憑證完整** - 經簽署的 C2PA manifest 可以解析,而且其自身的宣告簽章驗證通過。
- <!--i:hash--> **位元組未曾變動** - 檔案的雜湊值仍與簽署時相符。改動一個像素,這個徽章就會翻轉。
- <!--i:sparkle--> **GEN AI** - 這些像素是機器生成的,而檔案本身也如實標示。Lolly 會把這項宣告原封不動地讀出來,而不是隱藏它。

而完整的歷史紀錄會隨著檔案一起移動。這裡保留了九個步驟 - 五個是 Google 在生成並為影像加上浮水印時記錄的,另外四個則是 Lolly 在開啟、標記並轉換此頁面上的複本時記錄的 - 直接從位元組中讀出,在你的裝置上完成,並以時間軸的形式呈現。這與[AI 立場頁面](/info/ai-stance.html)上的 C2PA 時間軸,是同一張影像,以相同方式驗證。

![Verify 從風暴影像讀回的變更歷史 - 五個步驟由 Google 記錄,接著四個由 Lolly 記錄,最終成為本頁上的 WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

不過,這些都不是信任聲明本身,而只是示範。這個頁面接下來的內容才是信任聲明:上面的每個徽章都是可重現的,以下是重現這些保證背後依據的方法。

## 在瀏覽器中,無需任何工具

**1. 觀察網路流量。** 開啟 [lolly.tools](https://lolly.tools),打開瀏覽器的開發人員工具(F12),切換到**網路(Network)**分頁,並使用某個工具 - 在[QR Code](/t/qr-code)輸入網址、更改顏色、匯出 PNG。每個請求都停留在 `lolly.tools` 上:應用程式殼層、工具本身的檔案、目錄資產。沒有分析主機、沒有 CDN 信標、沒有字型服務、沒有「錯誤回報」端點。你在工具中輸入的內容**完全不會出現在任何請求中** - 渲染是在本機進行的。

誠實的例外情況 - 每一項都是選擇性加入、由使用者發起,且在發生時同樣可在該網路分頁中看到:在品牌編輯器中新增 **Google Font** 會從 Google 擷取那一個字型家族,而且只會在第一次擷取前顯示一次明確告知的同意對話框;點選 **ICC 印刷描述檔預設集**會從 color.org 上 ICC 的公開登記處擷取該描述檔;播放內建的選用**廣播**功能會從電台串流播放;在**會議規劃工具(Meeting Planner)**中輸入地點,會向 open-meteo 的地理編碼服務查詢該地點的座標與時區,每個城市只查一次(結果會儲存在你的裝置上),而輸入欄位本身就標示了這項揭露;**URL 螢幕截圖**則勢必會載入你輸入的網址 - 這正是它的功能,而且你可以親眼看到過程。宣告網路存取能力的工具只能存取其清單所允許的主機,而且這項機制是預設失效關閉(fail-closed)的;目前沒有任何已發佈的工具宣告此能力,所以真正把上述清單限制在這些主機內的,是瀏覽器強制執行的內容安全政策(CSP)。[隱私政策](/info/privacy.html)保有所有這些項目的權威表格;其常設規則是:凡不在該表格中的網路連線都不會發生。

**2. 拔掉網路線。** 載入應用程式並開啟一兩個工具,然後離線 - 飛航模式,或開發人員工具 → 網路 → 離線。重新載入頁面。圖庫與你已開啟過的每個工具都仍可運作,包括你使用過的格式的渲染與匯出 - 工具的檔案與格式編碼器會在你第一次使用時被快取,所以測試離線前請先在線上使用過一次該工具。這是本頁最有力的單一檢驗:會回報資料的軟體撐不過被切斷連線。

**3. 數一數 Cookie。** 開發人員工具 → **應用程式(Application)**(Firefox:**儲存空間**)→ Cookie → `https://lolly.tools`。清單是空的 - 應用程式不設任何 Cookie。或者在主控台貼上 `document.cookie`:結果會是 `""`。(整個系統中唯一的一個 Cookie `lolly_ca_state`,只會在選用的身分登入期間存在最多十分鐘 - 登入完成的瞬間就會刪除 - 範圍限定於 `/api/ca` 且為 `HttpOnly`:[隱私政策](/info/privacy.html)有精確描述。)

**4. 讀取你自己的儲存內容。** 同樣是在應用程式面板:Lolly 保留的一切都可在你眼前檢視 - 大約二十來個一般的 `localStorage` 鍵值(主題、語言、側邊欄寬度、聲音與檢視設定,以及公開工具目錄索引的快取副本),以及儲存在 IndexedDB 中你自己的文件。每個值都是可讀的字串或 JSON - 沒有任何內容被混淆,也沒有任何內容被編碼以阻止你閱讀。**個人檔案 → 清除我的所有資料**會將其全部清除;清除瀏覽器的網站資料也一樣能達到相同效果,因為沒有伺服器端副本能夠留存下來。

**5. 確認揭露聯絡方式確實存在。** [`/.well-known/security.txt`](/.well-known/security.txt) 回應的是符合 [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) 規範的聯絡資訊區塊,而不是 HTML 頁面。

## 在終端機中

**6. 渲染端點只會回傳公開資料。** 唯一可能把使用者輸入的內容放進網址的伺服器功能 - 熱連結渲染(hot-link renders)- 在這裡是啟用的,[隱私政策](/info/privacy.html)說明了這對你放進連結中的輸入內容意味著什麼:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

這個開關是依部署而定的(`LOLLY_DISABLE_RENDER_GET=1`):在設定了此開關的站台上,同樣的探測會回傳 `404` - 這個差異正是該旗標在正常運作,而不是不一致。

**7. 伺服器介面可以被完整列舉。** [伺服器介面](/info/server-surface.html)列出了所有存在的伺服器端路由,其常設規則是:不在該頁面上的端點就不屬於 Lolly 的一部分。你可以用 `curl` 逐一驗證;找不到清單以外的其他東西。

## 在原始碼中

如果部署的程式碼與公開程式碼不同,以上這一切都可能只是表演。所以請直接檢查程式碼 - 此部署是從[公開儲存庫](https://github.com/lolly-tools/lolly)建置的:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. 沒有任何追蹤器,沒有任何分析 SDK。** 在所發佈的程式碼中搜尋 - 引擎、每個殼層(包括瀏覽器擴充功能、Tauri 橋接覆寫層與 Service Worker)、伺服器函式與工具包 - 尋找常見的可疑對象:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. 沒有第三方 DNS 解析器。** Verify 的 SEAL 檢查從不透過 DNS-over-HTTPS 提供者來路由查詢 - 這個網頁應用程式根本沒有解析器:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. 憑證服務不保留任何資料。** 身分憑證機構(CA)沒有核發紀錄 - 沒有你的電子郵件、沒有時間戳記、沒有 webhook。這項「不存在」是可以透過 grep 驗證的:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## 由測試強制執行,而非只憑承諾

以上三項原始碼檢查並非一次性稽核 - 它們被固定寫入測試套件中,所以無法悄悄地失效。如果發生以下情況,[`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) 就會讓建置失敗:

- 該測試掃描的已發佈原始碼中的任何地方 - 應用程式、引擎、伺服器、擴充功能與工具包程式碼皆然 - 出現任何分析或追蹤 SDK,
- 該原始碼中出現任何第三方 DNS-over-HTTPS 解析器,
- CA 的核發紀錄再度出現 - 無論是在原始碼中**或**在產生的伺服器封裝檔中,
- 隱私政策遺失了法律要求的必要聲明(具名的資料控管者、法律依據、申訴權)。

你可以在複製下來的儲存庫中自行執行(Node 22.18+;此檔案不需要 `npm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

完整套件(`npm install && npm test`)會再執行數千項測試,包括[安全性與驗證](/info/security.html)中所描述的對抗式密碼學測試。

## 你從外部無法驗證的部分 - 直說

像這樣的頁面要贏得信任,靠的是明白說出自身的侷限:

- **主機存取記錄。** 任何能回應請求的伺服器都能記錄該請求 - IP、路徑、時間戳記。你無法驗證某個主機保留或不保留哪些資料,除了主機提供商所記載的行為之外,我們也一樣無法驗證。這正是為什麼此架構把你的內容完全排除在網路傳輸之外:從未離開你裝置的東西,任何人都無法記錄。
- **部署所執行的就是這份程式碼。** 你可以驗證原始碼是乾淨的,也可以驗證部署後的行為與其相符(以上的檢驗涵蓋了這兩端),但網頁部署的二進位層級證明並不是網頁平台所能提供的東西。相應的緩解措施是公開的儲存庫、強制執行的測試,以及離線檢驗 - 一個會回報資料的遭竄改部署,會立即在檢驗 1 與 2 中失敗。
- **工具掛鉤(hooks)預設並未沙盒化。** 工具的選用邏輯是在該頁面自身的執行環境中經過審查後執行的;lolly.tools 上的每個工具都是第一方且在發佈前經過審查。Worker 隔離現在已作為逐工具選擇加入的功能提供 - 清單中設定 `isolate: true` 的工具會將其掛鉤放到獨立執行緒外執行 - 所以你無法從外部驗證的範圍正在縮小,但預設路徑仍是在同一執行環境內,而審查仍是把關的機制。這一點是明說出來的,並未隱藏 - 詳見[設計邊界](/info/security.html)一節,其中一直都是這麼說的。

## 若某項檢驗失敗

本頁所述與實際觀察到的行為之間如有出入,即為一項安全性回報,而我們確實寧可聽到也不願不知情:[fitzy+security@suse.com](mailto:fitzy+security@suse.com)、任何[lolly-tools 儲存庫](https://github.com/lolly-tools)上的**回報漏洞(Report a vulnerability)**按鈕,或是[`/.well-known/security.txt`](/.well-known/security.txt)中的聯絡方式。協調揭露與回報者致謝是常設政策 - 詳情請見 [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md)。
