# Lolly 逐工具對比

如果你已經在使用其他產品，這些頁面會說明 Lolly 是取代那個產品、與它並用，還是不適合你的工作。每一頁都從另一個產品做得更好的地方開始。

_最後核查：2026 年 9 月 28 日。_

## 依產品比較

- [Lolly 與 Canva](/info/compare-canva.html) - 範本、日常設計與共用的品牌製作。
- [Lolly 與 Adobe](/info/compare-adobe.html) - 編輯、轉換、專業輸出與 Content Credentials。
- [Lolly 與 Figma](/info/compare-figma.html) - 設計、即時協作與可重複使用的素材製作。
- [Lolly 與 Penpot](/info/compare-penpot.html) - 開源設計、共用 token 與組織工作。
- [Lolly 與品牌入口網站](/info/compare-brand-portals.html) - 核准的資料庫、鎖定的範本、身分、審閱與報告。
- [Lolly 與渲染 API](/info/compare-render-apis.html) - 在你的裝置上、CI 中或 Lolly Work 伺服器上的自動化生成。
- [Lolly 與線上檔案轉換器](/info/compare-converters.html) - 在你自己的裝置上轉換格式。

如需逐項能力對比，請參閱[Lolly 如何對比](/info/positioning.html)。每項對比均標註日期；若某項說法已不再符合任一產品的現狀，則需要更正。

## 什麼在哪裡執行

每項比較都涵蓋同一個開源專案的兩個部分。**Lolly** 是引擎、應用程式與工具。**Lolly Work** 是組織伺服器，維護於 [lolly-work 儲存庫](https://github.com/lolly-tools/lolly-work)。兩者都採用 MPL-2.0，而組織決定要開啟哪些 Lolly Work 服務。

::: cols
## 在你的裝置上：Lolly

- 單機使用不需要帳號
- 製作、編輯、轉換與匯出
- 在所需的工具與素材儲存後可離線運作
- Content Credentials 在裝置上簽署
- 兩部裝置之間的私人協作，沒有伺服器

## 在你組織的伺服器上：Lolly Work

- 單一登入、SCIM 佈建、角色與政策
- 共用目錄、團隊專案與工作協作
- 核准、使用情況回報與稽核記錄
- 伺服器渲染、可復原的工作與核准的交付
- 以組織身分進行伺服器簽署
:::

單機使用將檔案留在裝置上。選擇共用專案、工作協作、伺服器渲染或交付，會把該功能所需的資料傳送到你組織的伺服器。

## 每項比較的共同假設

這些限制適用於這個系列中的每一頁，所以在這裡說明一次：

- **工作協作目前在單一伺服器節點上運行。** 它們的規模與營運歷史不同於歷史悠久的託管產品。[Work 狀態與路線圖](/info/work-status.html)記錄了目前的限制。
- **[lolly.work](https://lolly.work) 上的網站是示範沙箱。** 持久的組織部署需要持久的儲存與營運者；[安裝 Lolly Work](/info/work-install.html) 涵蓋兩者。
- Lolly 或自行託管的 Lolly Work **沒有每個席位的軟體授權費**。託管、儲存與營運仍然需要花錢。
- **簽章不等於受信任的簽署者。** 驗證者必須信任簽署檔案的憑證，才會把簽署者顯示為受信任；[Content Credentials 身分](/info/content-credentials-identity.html)說明了做法。
