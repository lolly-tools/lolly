# Lolly 與 Figma

_最後核查：2026 年 9 月 28 日。_

Lolly 支援設計、實時編輯和可複用的資產製作。[lolly.work](https://lolly.work) 在這些工作之外增加了組織服務：身份、共享專案、訪問控制和審批。

## 重疊之處

兩者都可以在畫布上排布文字、形狀和影象，並與他人協作。Lolly 的[匯入設計](/info/design-import.html)可將 Figma 檔案讀取為可編輯的版面。Figma 同樣涵蓋基於模板的品牌製作：[Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) 根據模板建立資產，並從 CSV 或 XLSX 檔案填充內容。

Lolly 將設計變成[帶規則的可複用工具](/info/create-a-tool.html)。該工具可在瀏覽器或 CLI 中執行，並接受來自 URL、指令碼或批次網格的輸入。同一個模板既適用於個人編輯單個資產，也適用於團隊製作大量變體。

## 協作與產品設計

[Figma Design](https://www.figma.com/design/) 彙集了介面設計、元件、互動原型和開發者交接。當團隊需要設計並詳細定義一個完整的應用時，其成熟的產品設計工作流和生態系統就很有參考價值。

Lolly 提供兩種實時協作。[私有協作](/info/collaborate.html)將兩臺裝置直接配對，無需賬號，在共享網路上也無需網際網路。工作協作透過 lolly.work 實現認證訪問、共享編輯、實時游標和已儲存的團隊會話。工作協作在 Lolly 客戶端和 lolly.work 伺服器中均已實現；其當前的單節點部署並不能證明與 Figma 的運營規模相當。

## 部署與製作

Lolly 的創意應用和 lolly.work 是同一開源專案中獨立部署的兩個部分。獨立使用的 Lolly 可以在無賬號的情況下離線渲染。lolly.work 在組織自己掌控的基礎設施上提供 SSO、SCIM、共享目錄、專案許可權、審批、審計記錄和伺服器端渲染。

團隊會話和工作協作的編輯會傳送到該例項；本地渲染可以留在裝置上。Content Credentials 對受支援的匯出檔案是可選的，伺服器端簽名使用已配置的組織身份。關於這種分離，請參閱[組合方案概覽](/info/compare.html)；關於驗證方如何信任簽名者，請參閱 [Content Credentials 身份](/info/content-credentials-identity.html)。

Figma 是其所有者的商標。本頁說明兩種方案的重疊之處，與 Figma 無關聯。
