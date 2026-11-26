# Lolly 與渲染 API

_最後查核：2026 年 11 月 5 日。_

如果你透過 API 從範本生成圖片，本頁會說明將製作流程移到你自己的裝置、CI 或你掌控的伺服器上時，有哪些改變。[從託管渲染 API 遷移](/info/work-move-from-render-api.html)提供操作步驟。

<!--i:eti-award-->
## 託管渲染 API 做得更好的地方

[Bannerbear](https://www.bannerbear.com/) 與 [Placid](https://placid.app/) 是代管服務：你送出請求，伺服器由他人營運。

- **不必負責營運。** 不必管理伺服器、資料庫、儲存、更新或容量規劃。
- **託管的範本編輯器**，附有可直接修改的範本。
- **一個 API 提供更多輸出類型。** 兩者都發布影片與 PDF 端點，Bannerbear 的文件也涵蓋動畫輸出、WebP 與 AVIF、截圖及 AI 去背。
- **各自提供整合與支援。**

如果這正是你想要的安排，這些服務都是可靠的選擇。

<!--i:eti-home-->
## 自行託管帶來什麼

- **內容留在你的系統中。** 輸入、素材與輸出存放在你選擇的基礎設施上。在裝置或 CI 中渲染不需要服務。
- **規則內建於工具。** 色彩、字型、標誌與鎖定的輸入來自你的[設計系統](/info/brand-studio.html)，因此呼叫端只能更改你允許的部分。[Lolly Work](/info/compare.html#what-runs-where) 會對每個請求套用工具可見性與輸入政策。
- **到處都是同一個工具。** 工具可在筆記型電腦、CI 工作或伺服器上根據相同輸入渲染。使用者也可以在應用程式中編輯同一個工具。
- **記錄由你持有。** [渲染回條](/info/work-renders.html#evidence-and-identity)、稽核軌跡，以及在你設定簽署身分時加入的 Content Credentials。
- **開源且不按用量計費。** 你執行程式碼，只需支付自己的基礎設施費用。

你需要承擔這些服務原本替你做的工作。可長期運作的伺服器需要持久資料庫與輸出儲存。需要瀏覽器的工具也需要 Chromium 工作程序。[安裝 Lolly Work](/info/work-install.html)說明了這兩項。

<!--i:eti-table-->
## 各項工作的對照

| 工作 | 託管渲染 API | Lolly |
|---|---|---|
| 從資料填入範本 | 指定範本與其圖層的 API 請求 | 指定工具與其輸入的 [URL](/info/url-mode.html)、[CLI](/info/cli.html) 或[伺服器 API](/info/work-automation-api.html) |
| 從表格製作多個檔案 | 批次與集合 | 裝置上的 [Batch](/info/batch.html)，或伺服器上的[渲染批次](/info/work-renders.html#batches-with-durable-rows) |
| 等待或輪詢結果 | 輪詢或同步選項 | 可輪詢的持久化渲染，或立即渲染 |
| 完成時呼叫 webhook | 支援 | [簽署回呼](/info/work-renders.html)，傳送至你允許的來源 |
| 動態圖片 URL | 支援 | [分享連結與 `/render` URL](/info/url-mode.html) |
| 編輯範本 | 託管編輯器 | 裝置上的 [Design](/info/using.html) |
| 代理 | 兩者都發布 MCP 伺服器 | [MCP](/info/mcp.html)，在 Lolly Work 上提供受 token 政策管轄的組織端點 |

Lolly 自身的輸出類型列於[匯出檔案](/info/exporting.html)。目前 Work 伺服器上的持久化渲染可製作 SVG、PNG、JPG 與 PDF，而[影片仍由裝置、CLI 與 MCP 處理](/info/work-renders.html#production-still-checks-and-permitted-repairs)。

<!--i:eti-folder-move-->
## 哪些能移轉，哪些不能

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| 你的請求 | Work 的遷移 API 接受相同結構 | 相同 | 相同 |
| 你的範本 | 使用 **Import** 匯入為可編輯文件，但尚無已確認結構定義的圖層類型除外 | 僅有欄位名稱與預覽。每個範本都需重建 | 僅有欄位名稱與預覽。每個範本都需重建 |
| 既有動態 URL | 不支援 | 不支援 | 更換主機後，簽署的 URL 仍可使用舊的私密 token 繼續運作 |
| Webhook | 不支援已登錄的 webhook | 可使用 `webhook_url` | 可使用 `webhook_success` |
| WebP 與 AVIF 輸出 | 依格式名稱明確拒絕 | 未提供 | 依格式名稱明確拒絕 WebP |
| 動畫、影片、集合、截圖 | 遷移 API 不提供 | 遷移 API 不提供 | 遷移 API 不提供 |

::: note 依公開文件建置
此功能依各供應商的公開文件建置，尚未使用實際帳號執行。若你持有帳號，[遷移指南](/info/work-move-from-render-api.html#check-it-on-your-own-account)提供一份簡短的檢查清單。
:::

你可以只移轉一個範本，其他範本留在原處。[離開 Lolly](/info/work-move-from-render-api.html#leave-lolly-too)也同樣開放：工具是一般檔案，CLI 不需要伺服器就能渲染它們。

<!--i:eti-building-->
## 誰負責營運服務

使用 Lolly 時，個人可在本機渲染，團隊則可在自己的基礎設施上執行 Lolly Work。伺服器工作會將輸入與所需素材傳送到該實例。裝置上的處理路徑不會。

Bannerbear 與 Placid 是各自擁有者的商標。本頁依據兩者的公開文件，說明產品功能重疊之處，與兩者均無關聯。
