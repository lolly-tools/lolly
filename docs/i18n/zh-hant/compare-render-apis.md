# Lolly 與渲染 API

_最後核查：2026 年 11 月 5 日。_

如果你目前透過 API 從範本生成圖片，本頁說明如果由你自己運行這項製作會有什麼改變：在你自己的裝置上、CI 中，或你所控制的伺服器上。[從託管的渲染 API 遷移](/info/work-move-from-render-api.html)則說明做法。

## 託管渲染 API 做得更好的地方

[Bannerbear](https://www.bannerbear.com/) 與 [Placid](https://placid.app/) 是託管服務，這是真正的優勢。你送出請求，由別人運行伺服器、維持它們運作並處理負載。

- **無需營運。** 沒有伺服器、資料庫、儲存、更新或容量規劃。
- **託管的範本編輯器**，附有可直接改編的範本。
- **一個 API 提供更多輸出類型。** 兩者都提供影片與 PDF 端點，Bannerbear 還記載了動畫輸出、WebP 與 AVIF、螢幕截圖與 AI 背景移除。
- **他們自己的整合與支援。**

如果這就是你想要的安排，這些服務是穩妥的選擇。

## 自行代管能給你什麼

- **你的內容留在你的系統上。** 輸入、素材與輸出都放在你所選擇的基礎架構上。在裝置或 CI 中渲染完全不需要任何服務。
- **規則存在於工具中。** 色彩、字型、標誌與鎖定的輸入來自你的[設計系統](/info/brand-studio.html)，所以呼叫者只能更改你允許的部分。[Lolly Work](/info/compare.html#what-runs-where) 對每個請求套用工具可見度與輸入政策。
- **同一個工具，到處都一樣。** 同一個工具以相同的輸入在筆記型電腦、CI 工作或伺服器上渲染，人們也可以在應用程式中編輯同一個工具。
- **由你持有的記錄。** [渲染回條](/info/work-renders.html#evidence-and-identity)、稽核軌跡，以及在你設定簽署身分之處提供的 Content Credentials。
- **開源，沒有計量。** 程式碼由你運行，你付費的是你自己的基礎架構。

你要接手這些服務原本替你做的工作。持久的伺服器需要持久的資料庫與輸出儲存，而需要瀏覽器的工具需要 Chromium worker。[安裝 Lolly Work](/info/work-install.html) 說明了兩者。

## 各項工作如何對應

| 工作 | 託管渲染 API | Lolly |
|---|---|---|
| 從資料填入範本 | 指名範本及其圖層的 API 請求 | 指名工具及其輸入的 [URL](/info/url-mode.html)、[CLI](/info/cli.html) 或[伺服器 API](/info/work-automation-api.html) |
| 從表格產生許多檔案 | 批次與集合 | 在你裝置上的 [Batch](/info/batch.html)，或在伺服器上的[渲染批次](/info/work-renders.html#batches-with-durable-rows) |
| 等待或輪詢結果 | 輪詢，或同步選項 | 你輪詢的可復原渲染，或立即渲染 |
| 完成時呼叫 webhook | 有 | 傳送到你允許的來源的[簽署回呼](/info/work-renders.html) |
| 動態圖片 URL | 有 | [分享連結與 `/render` URL](/info/url-mode.html) |
| 編輯範本 | 託管編輯器 | 在你裝置上的 [Design](/info/using.html) |
| 代理程式 | 兩者都提供 MCP 伺服器 | [MCP](/info/mcp.html)，在 Lolly Work 上有受權杖政策管轄的組織端點 |

Lolly 自己的輸出類型列在[匯出](/info/exporting.html)中。目前在 Work 伺服器上，可復原的渲染產出 SVG、PNG、JPG 與 PDF，而[影片則留在裝置、CLI 與 MCP 上](/info/work-renders.html#production-still-checks-and-permitted-repairs)。

## 什麼會帶過去，什麼不會

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| 你的請求 | Work 的遷移 API 接受相同的格式 | 相同 | 相同 |
| 你的範本 | **匯入**為可編輯的文件，但沒有已確認結構描述的圖層類型除外 | 只有欄位名稱與預覽。每個都要重建 | 只有欄位名稱與預覽。每個都要重建 |
| 現有的動態 URL | 不支援 | 不支援 | 簽署的 URL 在更換主機後仍可運作，使用你舊的私人權杖 |
| Webhook | 不支援已註冊的 webhook | `webhook_url` 可運作 | `webhook_success` 可運作 |
| WebP 與 AVIF 輸出 | 依名稱拒絕 | 未提供 | WebP 依名稱拒絕 |
| 動畫、影片、集合、螢幕截圖 | 不在遷移 API 上 | 不在遷移 API 上 | 不在遷移 API 上 |

這一切都是依各供應商的公開文件建立的，尚未在實際帳號上執行過。如果你持有帳號，[遷移指南](/info/work-move-from-render-api.html#check-it-on-your-own-account)有一份簡短的檢查清單。

遷移不是全有或全無。你可以只遷移一個範本，其餘留在原處，而且[離開 Lolly](/info/work-move-from-render-api.html#leave-lolly-too) 同樣開放：工具是純檔案，CLI 不需要伺服器就能渲染。

## 誰來執行服務

使用 Lolly，個人在本機渲染，或團隊在自己的基礎架構上運行 Lolly Work。提交伺服器工作會把它的輸入與必要的素材傳送到該實例，這與裝置端路徑不同。

Bannerbear 與 Placid 是其擁有者的商標。本頁從它們的公開文件描述產品重疊之處，與兩者皆無關聯。
