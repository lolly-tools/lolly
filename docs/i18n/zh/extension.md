# 瀏覽器擴充功能

網頁無法讀取其他網站的像素。在 Chromium 系列瀏覽器（Chrome、Edge、Brave、Arc 或 Opera，從 Chrome 111 起）中，免費的 **Lolly URL Screenshot** 擴充功能讓 Lolly 網頁應用程式使用與桌面應用程式相同的擷取方式擷取網頁。安裝擴充功能後：

- **[Lolly URL Screenshot](/t/url-shot)** 會將你構圖完成的網頁儲存為檔案；
- 貼入圖片欄位的網址可透過 **Screenshot this page** 變成該頁面的螢幕擷取畫面；
- [Lolly Design System Setup](/info/brand-studio.html) 中的 **Website** 來源可讀取一個頁面，用來建立設計系統。

每個請求都由你核准，桌面應用程式不需要擴充功能就能執行相同工作。

<!--i:eti-checklist-->
## 安裝之前

沒有擴充功能時，**Lolly URL Screenshot** 仍可開啟，你也能安排擷取畫面的構圖。工具控制項頂端的提示會說明缺少什麼。

![URL Screenshot 工具提供擴充功能的提示，當沒有可執行擷取為檔案的宿主時顯示](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

沒有擴充功能時，每個控制項都能使用：目標 URL、捲動深度、穩定等待時間、裁切內縮與重新上色。只有擷取需要擴充功能。

![Lolly URL Screenshot 的控制項，包括目標 URL、捲動深度、穩定等待時間與裁切內縮，在尚未安裝擴充功能前就都能使用](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## 安裝

**從 Chrome Web Store 安裝：** 即將推出。發布後，按一下就能安裝擴充功能。

**自行載入（開發者）。** 擴充功能的原始碼位於儲存庫的 `shells/chrome-extension/`。封裝步驟會從該資料夾建置正式套件。該套件僅適用於 `https://lolly.tools` 上的 Lolly。

1. 執行 `pnpm run pack:chrome-extension`。它會將套件建置到 `dist/chrome-extension/`。
2. 開啟 `chrome://extensions`。
3. 開啟 **Developer mode**（右上角）。
4. 點擊 **Load unpacked**，選擇 `dist/chrome-extension/` 資料夾。
5. 重新載入 Lolly 分頁。Lolly 會在頁面載入時偵測擴充功能，而「Get the extension」提示會消失。之後 **Lolly URL Screenshot**（位於 Utilities 下）即可將擷取畫面儲存為檔案，也能在 Lolly Batch 模式中運作。

::: details 用於本機開發伺服器或原始碼資料夾
若要用於本機開發伺服器，請執行 `pnpm run pack:chrome-extension:dev`，並改為載入 `dist/chrome-extension-dev`。該套件也接受 `http://localhost:5173`，名稱中帶有 **Development**。

直接載入 `shells/chrome-extension/` 資料夾也能擷取 PNG。該資料夾沒有頁面遍歷功能；這項功能會在封裝步驟中建置進去。從該資料夾產生的 SVG 內含螢幕擷取畫面，而非圖形。
:::

<!--i:eti-user-check-->
## Lolly 提出請求時會發生什麼

![Lolly 分頁請求讀取一個頁面，你在擴充功能的核准視窗中按下 Approve once。背景分頁開啟、讀取頁面後關閉。接著 Lolly 分頁取得結果。](/info/diagrams/concepts/extension-request.svg)

1. **Lolly 提出請求。** 一個小型指令碼會告知 Lolly 擴充功能已存在，因此擷取或讀取頁面不需進一步設定就能開始。
2. **你核准。** 擴充功能會開啟自己的 **Approve page request** 視窗，顯示提出請求的網站、要求的是擷取畫面還是頁面內容，以及頁面網址。在你按下 **Approve once** 之前，不會讀取任何內容。**Cancel** 或關閉視窗都會結束請求。
3. **Chrome 對每個網站詢問一次。** 第一次核准某個網站的請求時，Chrome 也會詢問是否允許擴充功能存取該網站。允許後，Chrome 會保留該存取權，但之後的每個請求仍各自需要按下 **Approve once**。
4. **在背景分頁中讀取頁面。** 擴充功能在背景分頁開啟目標頁面，透過 DevTools Protocol 擷取它（與桌面應用程式使用的 `Page.captureScreenshot` 相同），關閉分頁，再將結果交回提出請求的 Lolly 分頁。

::: details SVG 擷取如何運作
對於 **SVG**，擴充功能會遍歷頁面，而非拍下螢幕畫面。隨擴充功能封裝的指令碼會在背景分頁讀取頁面版面，將頁面轉為圖形與轉外框的文字。檔案在任何尺寸下都保持清晰，每個部分都能繼續編輯。頁面上的圖片仍是圖片。頁面以畫布、影片或 SVG 無法表達的效果繪製的內容，會從同一時刻的螢幕擷取畫面中複製。Lolly 會將結果與該擷取畫面比對。兩者差異過大時，SVG 會改為包含螢幕擷取畫面。

為了以頁面自己的字型將文字轉外框，擴充功能會把頁面載入的字型檔交給 Lolly。Chrome 不會將字型位元組保存在擴充功能能讀取的位置，因此擴充功能會再次向頁面請求每個字型。瀏覽器通常會從快取回應，而頁面自己的安全政策仍適用於該請求。
:::

一次核准只涵蓋一個請求，並在 30 秒後到期。同一時間只能有一個請求等待或執行，已核准的請求會在 55 秒後停止。如果 Lolly 頁面關閉或變更，或目標頁面移至另一個網站，請求就會取消。

::: warning 擷取會使用你的瀏覽器工作階段
頁面會使用你的瀏覽器工作階段載入，因此你已登入的頁面可能在結果中顯示私人資訊。
:::

擷取在你的瀏覽器與網路上執行，因此 `localhost` 與內部網站都能使用。擷取結果不會上傳。唯一的網路流量是瀏覽器載入你要求的頁面，以及在擷取 SVG 時再次載入該頁面的字型檔。

擷取執行時，你可能會在暫時分頁上短暫看到 *「…started debugging this browser」* 橫幅。橫幅來自 DevTools Protocol，擷取完成後就會消失。

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## 為 Lolly Design System Setup 讀取網站

Lolly Design System Setup 中的 **Website** 來源會從你現有的網站建立設計系統。在 Chromium 瀏覽器中，由擴充功能讀取頁面。在桌面應用程式中，由應用程式自行擷取頁面。在沒有擴充功能的瀏覽器中，不會提供 Website 方塊。

- **一個網址，一個頁面。** 核准後，擴充功能會在同樣的背景分頁中開啟頁面，讀取渲染後的標記、樣式表文字與少量圖示和標誌圖片，然後關閉分頁。擴充功能不會追蹤連結或爬取網站。
- **託管在其他地方的樣式表**（CDN 或字型服務）也會被擷取，因為其中包含頁面的色彩與字型。跨來源請求不會附帶你的 cookie。同來源請求會像頁面本身一樣使用你的 cookie。
- **所有內容都有上限**，樣式表與圖片的數量及位元組數都有限制，因此惡意或部分故障的頁面會傳回部分素材，而不會卡住。
- **解析在你的裝置上進行。** 位元組會直接傳回提出請求的 Lolly 分頁，由該分頁將它們轉為色彩、字型與標誌。

貼上網址只會填入欄位。在你開始讀取並按下 **Approve once** 之前，不會讀取任何內容。

<!--i:eti-lock-->
## 權限

擴充功能的 `manifest.json` 宣告四項權限，另外還會逐一網站請求存取權。它設定 `minimum_chrome_version: 111`，目前版本為 0.5.0。

| 權限 | 用途 | 授予時間 |
|---|---|---|
| `debugger` | 透過 DevTools Protocol 操作背景分頁，以擷取畫面，並在擷取 SVG 時執行頁面遍歷。 | 安裝時 |
| `tabs` | 開啟暫時的背景分頁並在完成後關閉，同時檢查 Lolly 頁面與目標頁面自你核准後都沒有移至其他網址。 | 安裝時 |
| `scripting` | 在你指定的網站內執行單頁讀取器，供 Website 來源使用。 | 安裝時 |
| `storage` | 只在工作階段儲存空間中記下所開分頁的 ID，讓瀏覽器即使在讀取途中暫停擴充功能，該分頁仍能關閉。下次啟動時清除；不儲存任何關於你的資料。 | 安裝時 |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | 網站存取權，安裝時不會授予。按下 **Approve once** 時，擴充功能會向 Chrome 請求存取該次請求中的單一網站。 | 你第一次核准該網站的請求，且 Chrome 詢問你之後 |

擴充功能只會讀取你核准的頁面，不會讀取或傳送你的瀏覽資料。

<!--i:eti-help-->
## 疑難排解

- **仍看到「Get the extension」？** 重新載入 Lolly 分頁。
- **在這個網站上沒有反應？** 擴充功能只適用於 `https://lolly.tools`，開發套件另支援 `http://localhost:5173`。其他來源，例如自行託管的 Lolly 副本，需要專屬的擴充功能建置版本，在 `manifest.json` 與 `policy.js` 中都列出該來源。只編輯 manifest 並無法運作。
- **擷取失敗？** 檢查 URL 是否可連線，且以 `http://` 或 `https://` 開頭。有些頁面會封鎖自動擷取。如果你按下了 **Cancel**、關閉了核准視窗，或等待超過 30 秒，請重新開始擷取。
