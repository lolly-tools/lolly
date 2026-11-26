# Lolly 與各項工具的比較

這些頁面說明 Lolly 能否取代另一項產品、能否與它搭配使用，或是否不適合你的工作。每頁都先說明另一項產品做得更好的地方。

_最後查核：2026 年 9 月 28 日。_

<!--i:eti-grid-->
## 依產品比較

- [Lolly 與 Canva](/info/compare-canva.html) - 範本、日常設計與共用品牌製作流程。
- [Lolly 與 Adobe](/info/compare-adobe.html) - 編輯、轉換、專業輸出與 Content Credentials。
- [Lolly 與 Figma](/info/compare-figma.html) - 設計、即時協作與可重複使用的素材製作。
- [Lolly 與 Penpot](/info/compare-penpot.html) - 開源設計、共用 token 與組織工作。
- [Lolly 與品牌入口網站](/info/compare-brand-portals.html) - 已核准的資料庫、鎖定的範本、身分、審閱與報表。
- [Lolly 與渲染 API](/info/compare-render-apis.html) - 在你的裝置、CI 或自己的伺服器上自動生成，以及[如何從 Bannerbear 或 Placid 遷移](/info/work-move-from-render-api.html)。
- [Lolly 與線上檔案轉換器](/info/compare-converters.html) - 在你自己的裝置上轉換格式。

[Lolly 功能比較](/info/positioning.html)提供逐項功能的比較。每份比較都標有日期。若某項陳述不再符合任一產品的現況，就需要更正。

<!--i:eti-map-pin-->
## 各部分在哪裡執行

每份比較都涵蓋同一個開源專案的兩個部分。**Lolly** 是引擎、應用程式與工具。**Lolly Work** 是組織伺服器，在 [lolly-work 儲存庫](https://github.com/lolly-tools/lolly-work)中維護。兩者皆採用 MPL-2.0，組織可決定開啟哪些 Lolly Work 服務。

::: cols
## 在你的裝置上：Lolly

- 獨立使用不需要帳號
- 製作、編輯、轉換與匯出
- 所需工具與素材儲存後即可離線運作
- 在裝置上簽署 Content Credentials
- 兩部裝置之間的私人協作，不需要伺服器

## 在你組織的伺服器上：Lolly Work

- 單一登入、SCIM 佈建、角色與政策
- 共用目錄、團隊專案與工作協作
- 核准、使用情況報表與稽核記錄
- 伺服器渲染、可復原的工作與經核准的交付
- 以組織身分在伺服器上簽署
:::

獨立使用時，檔案保留在裝置上。選擇共用專案、工作協作、伺服器渲染或交付時，該功能所需的資料會傳送到你組織的伺服器。

<!--i:eti-info-->
## 每份比較的前提

以下限制適用於這一系列的每個頁面：

- **Lolly Work 協作目前在單一伺服器節點上執行。** 其規模與運作歷史和經營多年的託管產品不同。[Lolly Work 現況與路線圖](/info/work-status.html)記錄了目前的限制。
- **[lolly.work](https://lolly.work) 網站是示範沙箱。** 可長期運作的組織部署需要持久儲存與營運人員。[安裝 Lolly Work](/info/work-install.html)涵蓋這兩項。
- **Lolly 與自行託管的 Lolly Work 都不收取按人數計費的軟體授權費。** 託管、儲存與營運仍有成本。
- **有簽章不代表簽署者受信任。** 只有在驗證器信任簽署檔案的憑證時，才會將簽署者顯示為受信任。[Content Credentials 身分](/info/content-credentials-identity.html)說明了運作方式。
