# Lolly 與 Adobe

_最後核查：2026 年 9 月 28 日。_

Lolly 負責影象編輯與轉換、排版、可重複的品牌製作、印刷輸出和 Content Credentials。[lolly.work](https://lolly.work) 在這套創作工作流之上增加了組織身份、共享資產、審批和自動化的伺服器端製作。

## 重疊之處

兩者都支援調整影象尺寸、組合版面和匯出專業格式等工作。Lolly 支援 PDF/X、CMYK 和高位深柵格輸出，並附有[各格式的具體能力](/info/formats.html)。其裝置端實用工具無需上傳即可轉換和清理檔案。

Adobe 的專業應用覆蓋大量創意工作流。例如，[Photoshop](https://www.adobe.com/products/photoshop.html) 提供精細的照片編輯、選區、蒙版和合成工具。請將你的工作所需的編輯操作與 Lolly 的工具對照；反覆使用的品牌資產與複雜的修圖，需求可能各不相同。

## 創作與組織服務

獨立使用的 Lolly 無需 Adobe 賬號或 Lolly 賬號，在瀏覽器、桌面應用和 CLI 中使用同一個引擎。模板和設計令牌使輸出可重複，[帶規則分享](/info/create-a-tool.html)可將設計變成他人可填寫的工具。

lolly.work 是 Lolly 專案中的獨立服務，與創意應用一樣以 MPL-2.0 開源。它提供 SSO、SCIM、共享目錄與專案、審批、訪問策略、審計記錄和伺服器端渲染。組織可以自行執行這兩部分，並接入現有的資產庫。本地創作保留在裝置上；共享工作和伺服器任務使用已配置的服務。

## Content Credentials 與身份

Lolly 可在裝置上對受支援的匯出檔案簽名，Content Credentials 由使用者自行啟用。裝置生成的金鑰證明檔案簽名的完整性；驗證方仍需信任簽名者，才會顯示已驗證的身份。組織可以使用自己的證書頒發機構，並將其根證書分發給驗證方。lolly.work 還支援使用已配置的組織證書和金鑰進行伺服器端簽名。

這使個人簽名和組織簽名都能在 Lolly 方案中使用。請參閱 [Content Credentials 身份](/info/content-credentials-identity.html)、[lolly.work 簽名指南](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md)和[組合方案概覽](/info/compare.html)。裝置端轉換實用工具不會新增 Lolly 水印或溯源後設資料。

Adobe、Photoshop 和 Creative Cloud 是 Adobe 的商標。本頁說明各方案的重疊之處，與 Adobe 無關聯。
