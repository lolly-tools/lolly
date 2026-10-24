# 瀏覽器擴充功能

網頁無法讀取另一個網站的像素，所以 Lolly 網頁應用程式需要協助才能對頁面截圖。在 Chromium 系列瀏覽器（Chrome、Edge、Brave、Arc 或 Opera，Chrome 111 起）中，免費的 **Lolly URL Screenshot** 擴充功能提供這項協助，使用與桌面應用程式相同的擷取。安裝後：

- **[URL Screenshot](/t/url-shot)** 把你編排的頁面儲存為檔案；
- 貼進圖片欄位的網址，可以用 **Screenshot this page** 變成該頁面的螢幕截圖；
- [Design System Setup](/info/brand-studio.html) 中的 **Website** 來源可以讀取一個頁面來開始建立設計系統。

每個請求都由你核准，而桌面應用程式在沒有擴充功能的情況下也能完成相同的工作。

## 安裝之前

在安裝擴充功能之前，**URL Screenshot** 仍會開啟，所以你可以編排截圖。工具控制項頂端的備註會說明缺少什麼。

![URL Screenshot 工具的提示,提供擴充功能的安裝選項,會在擷取到檔案沒有可執行的主機時顯示](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

等待期間，每個控制項都能運作：目標 URL、捲動深度、穩定延遲、裁切內縮與重新著色。只有擷取本身需要擴充功能。

![URL Screenshot 的控制項,包含目標網址、捲動深度、穩定延遲與裁切內縮,在擴充功能存在之前全部都可以使用](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## 安裝

**從 Chrome 線上應用程式商店：**即將推出。擴充功能發布後，一鍵即可安裝。

**自行載入（開發者）。** 擴充功能位於儲存庫的 `shells/chrome-extension/`。該資料夾是正式版建置，僅適用於位於 `https://lolly.tools` 的 Lolly。

1. 開啟 `chrome://extensions`。
2. 開啟 **Developer mode**（右上角）。
3. 點擊 **Load unpacked** 並選擇 `shells/chrome-extension/` 資料夾。
4. 重新載入 Lolly 分頁。偵測在頁面載入時發生，所以「Get the extension」提示會消失。**URL Screenshot**（在 Utilities 下）隨後就能將擷取內容儲存到檔案，並可在 Batch 模式中使用。

如果要連接本機開發伺服器,請執行 `pnpm run pack:chrome-extension:dev`,改為載入 `dist/chrome-extension-dev`。該套件也接受 `http://localhost:5173`,其名稱中帶有 **Development**。

## Lolly 提出要求時會發生什麼

![Lolly 分頁要求一個頁面，你在擴充功能的核准視窗中按下 Approve once。背景分頁開啟、讀取頁面然後關閉。接著 Lolly 分頁得到結果。](/info/diagrams/concepts/extension-request.svg)

1. **Lolly 提出要求。** 一個小指令碼告訴 Lolly 擴充功能存在，所以不需要進一步設定就能開始擷取或讀取頁面。
2. **你核准。** 擴充功能開啟它自己的 **Approve page request** 視窗。它顯示提出請求的網站、它要的是螢幕截圖還是頁面內容，以及頁面位址。在你按下 **Approve once** 之前不會讀取任何內容。**Cancel** 或關閉視窗會結束請求。
3. **Chrome 每個網站詢問一次。** 你第一次核准某個網站的請求時，Chrome 也會詢問擴充功能是否可以存取該網站。一旦你允許，Chrome 就會保留該存取權，但之後的每個請求仍需要各自的 **Approve once**。
4. **頁面在背景分頁中讀取。** 擴充功能在背景分頁中開啟目標頁面，透過 DevTools Protocol 擷取它（與桌面應用程式使用的 `Page.captureScreenshot` 相同），關閉分頁，並把結果交還給提出要求的 Lolly 分頁。

一次核准涵蓋一個請求，並在 30 秒後過期。一次只能有一個請求等待或執行，而已核准的請求會在 55 秒後停止。如果 Lolly 頁面關閉或改變，或目標頁面移到另一個網站，請求就會被取消。

擷取在你的瀏覽器、你的網路上執行，所以 `localhost` 與內部網站可以使用。頁面以你的瀏覽器工作階段載入，所以你已登入的頁面可能在結果中顯示私人資訊。擷取內容不會上傳：唯一的網路流量是你自己的瀏覽器載入你所要求的頁面。

擷取執行時，你可能會在暫時分頁上短暫看到 *"…started debugging this browser"* 橫幅。那是 DevTools Protocol 在運作，橫幅會在截圖完成時消失。

## 為 Design System Setup 讀取網站

Design System Setup 中的 **Website** 來源會從你已有的網站開始建立設計系統。在 Chromium 瀏覽器中，由擴充功能讀取頁面。在桌面應用程式中，由應用程式自行擷取頁面。在沒有擴充功能的瀏覽器中，不提供 Website 圖塊。

- **一個位址，一個頁面。** 你核准之後，擴充功能會在同類的背景分頁中開啟該頁面，讀取渲染後的標記、樣式表文字，以及少數圖示與標誌圖片，然後關閉分頁。它不會跟隨連結或爬取網站。
- **託管在其他地方的樣式表**（CDN 或字型服務）也會被擷取，因為頁面的色彩與字型就在其中。跨來源請求不帶你的 Cookie；同源請求則使用它們，就像頁面本身一樣。
- **一切都有上限**，包括樣式表與圖片的數量以及位元組數，所以惡意或半壞的頁面只會回傳部分素材，而不會卡住。
- **解析在你的裝置上進行。** 位元組直接送回提出要求的 Lolly 分頁，由它轉成色彩、字型與標誌。

貼上位址只會填入欄位。在你開始讀取並按下 **Approve once** 之前不會讀取任何內容。

## 權限

擴充功能的 `manifest.json` 宣告了四項權限，外加一次對一個網站要求的網站存取。它設定 `minimum_chrome_version: 111`，目前版本為 0.4.0。

| 權限 | 用途 | 何時授予 |
|---|---|---|
| `debugger` | 透過 DevTools Protocol 驅動背景分頁，由它擷取螢幕截圖。 | 安裝時 |
| `tabs` | 開啟暫時的背景分頁並在事後關閉，並檢查自你核准後 Lolly 頁面與目標頁面是否都沒有移動。 | 安裝時 |
| `scripting` | 為 Website 來源，在你指定的網站內執行單頁讀取器。 | 安裝時 |
| `storage` | 只在工作階段儲存空間中記下它所開啟分頁的 id，讓瀏覽器在讀取中途暫停擴充功能時，該分頁仍會關閉。下次啟動時清除；不儲存任何關於你的資料。 | 安裝時 |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | 網站存取，安裝時不授予。當你按下 **Approve once** 時，擴充功能會向 Chrome 要求存取該請求中的那一個網站。 | 你第一次核准該網站的請求時，在 Chrome 詢問你之後 |

擴充功能只讀取你核准的那一個頁面。它不會讀取或傳送你的瀏覽資料，也不會上傳任何內容。

## 疑難排解

- **仍然看到「Get the extension」？** 重新載入 Lolly 分頁。
- **在這個網站上沒有反應？** 擴充功能只適用於 `https://lolly.tools`，以及開發套件中的 `http://localhost:5173`。其他來源（例如自行託管的 Lolly 副本）需要在 `manifest.json` 與 `policy.js` 中都列出該來源的擴充功能專屬建置版本。只編輯 manifest 是行不通的。
- **擷取失敗？** 請檢查 URL 是否可連線，並以 `http://` 或 `https://` 開頭。有些頁面會封鎖自動擷取。如果你按了 **Cancel**、關閉核准視窗，或等待超過 30 秒，請重新開始擷取。
