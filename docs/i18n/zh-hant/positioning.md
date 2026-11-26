# Lolly 與其他產品的比較

Lolly 在你自己的裝置上製作符合品牌規範的檔案，不需帳號。**Lolly Work** 是供團隊使用的伺服器：在組織運行的機器上提供登入、共用專案、核准與伺服器渲染。兩者都以 MPL-2.0 授權開放原始碼。

大多數團隊會保留現有工具。設計應用程式提供設計，DAM 維持為權威資料來源，Lolly 則將已核准的輸入轉成完成的檔案。[搭配現有 DAM 使用 Lolly](/info/use-with-dam.html) 說明這種組合。這個組合背後的理念是[內容主權](/info/content-sovereignty.html)。

<!--i:eti-gauge-->
## 今日的工具

每個圓環顯示一類產品能多完整地滿足某項需求。按下列旁的 **?** 可查看證據，按下圖例旁的 **?** 可查看評分方式。

::: figure positioning-comparison
能力比較。競爭產品研究依據供應商文件，期間為 2026 年 8 月至 11 月 21 日。Lolly 與 Lolly Work 於 2026 年 11 月 21 日審查。評分：0 不具備、25 可透過變通方式達成、50 確實具備但受限或僅部分支援、75 功能強但有限制、100 核心能力。
:::

::: details 2026 年 11 月評分變更的來源
- Canva：[API 變更記錄](https://www.canva.dev/docs/apps/rest-apis/changelog/)、[服務應用程式](https://www.canva.dev/blog/developers/canva-service-accounts/)、[Brand Controls 說明](https://www.canva.com/help/brand-control/)
- Adobe：[InDesign API 變更記錄](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/)、[Adobe Express 定價](https://www.adobe.com/express/pricing)
- Figma：[代理與 AI 點數](https://help.figma.com/hc/en-us/articles/42614902212887)、[MCP 伺服器](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify 與 Bynder：[Frontify 2026 年 10 月版本說明](https://news.frontify.com/163371-what-s-new-in-october-2026)、[Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear 與 Placid：[Bannerbear 定價](https://www.bannerbear.com/pricing/)、[Bannerbear 變更記錄](https://www.bannerbear.com/changelog/)、[Placid 定價](https://placid.app/pricing)
- Penpot：[自行託管定價](https://penpot.app/pricing/self-host)、[發布版本](https://github.com/penpot/penpot/releases)
- Cloudinary：[內容來源證明](https://cloudinary.com/documentation/content_provenance_and_authenticity)、[定價](https://cloudinary.com/pricing)
:::

功能與實績分列呈現。Lolly 首次公開發布的是 1.0.1 版本，日期為 2026 年 8 月 30 日；其安全性尚未經過獨立稽核，採用證據也只有幾個月的歷史。[採用與治理](/info/adoption-governance.html#status)提供目前狀態。

<!--i:eti-hammer-->
## 何時選用 Lolly

::: cols
## 這些情況適合選用 Lolly

- 反覆需要同一類檔案：活動圖卡、徽章、證書、通知、社群圖卡
- 在 [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) 或 CLI 中，從一份範本與一張數值表產生許多檔案
- 即使在自由畫布上，色彩、字型與素材也必須維持在設計系統內
- 已完成的 Figma、Penpot、Illustrator、InDesign、Affinity 或 PDF 設計，需要變成可編輯且可重複製作的內容（[匯入設計](/info/design-import.html)）
- 檔案必須在你自己的裝置或伺服器上製作

## 這些情況適合選用其他工具

- 工作是精細的照片修飾或插畫
- 你正在設計應用程式介面並製作原型
- 你需要從第一天起就有大量圖庫與範本可用
- 你需要具備長期大規模運作實績的代管服務
:::

匯入的設計與共用設計 token，讓團隊能將 Lolly 與專業應用程式結合，而 Lolly Work 負責管理共用素材、審閱與交付。

已有妥善整理 DAM 的團隊，應先保留該資料庫與其管理員。[SUSE 的 Brandfolder 經驗](/info/suse-brandfolder.html)記錄了整合如何支援採用，以及核准流程的變更管理。DAM 供應商與導入合作夥伴可透過[合作夥伴工作流程](/info/dam-partners.html)評估相同安排。

在 **Lolly Markdown Slides** 中，整份簡報以資料形式撰寫，即時排版，並匯出為原生、可編輯的 PowerPoint 檔案。

![分割檢視中的 Lolly Markdown Slides：左側以區塊列出簡報的投影片，右側渲染排版完成的簡報](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## 規則就在工具裡

Lolly 將可重複使用的品牌規則放進工具：色彩、字型、出血邊界、間距與允許的輸入。範本固定收件者不得變更的部分。Lolly Work 圍繞該範本加入群組存取與輸入政策，並為目錄提交與交付提供核准鏈。

檢查工具一次，就能讓重複製作更容易，因為每份輸出都會繼承其版面規則。文案、上傳的圖片與使用權仍可能需要檢查，Lolly Work 為此提供共用目錄與核准步驟。對創作團隊來說，工具是一道護欄：資料、文案與圖片仍由你提供，工具則確保每個結果都符合品牌規範。

![製作者的全部工作：輸入文字。字型、色彩與間距在製作工具時就已確定](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

另外三項差異：

- **從輸入直接產生最終檔案。** 提供輸入，就得到完成的檔案，不需要「現在從設計工具另存，再修整一下」。
- **工具組合工具。** 一個工具可將另一個工具的渲染結果嵌入同一份完成的檔案，兩者之間不需程式碼耦合。
- **開放原始碼。** 引擎是開放原始碼，工具、素材與設計 token 則是檔案，可納入版本控制或在 Lolly Work 中管理，而非別人資料庫裡的資料列。

有護欄也能做出大膽的設計。這張海報等級的城市地圖，以真正的向量路徑呈現道路與水域，只需一個下拉選單與兩個無法選到設計系統範圍外的色彩欄位：

![以設計系統自己的色彩滿版繪製阿姆斯特丹的環狀運河與道路網，每一筆都由範本定位，無需手動放置](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## 用機率探索創新，用確定性擴大製作規模

大多數「AI 創作」提案，把模型放在一條古老分界的錯誤一側。抄寫員與彩飾手稿畫師早已確立這條分界。畫草稿時可以自由發揮，什麼都能試，什麼都還沒定案。接著交給印刷機，將它定稿。藝術在草稿中成形，透過印刷機傳播；印出的作品之所以值得信任，是因為印刷機每次運作都信守承諾。

Lolly 就是印刷機。構思時可以帶入任何你喜歡的東西：模型、設計師或粗略的草圖。但當構想必須變成許多檔案時，就要經過每次都以相同方式渲染的系統，輸入內容也必須讓任何人都能讀回。上面的比較，實際上是在看誰能讓這個定稿步驟重複執行。

> 信任創作過程，以嚴謹擴大規模。

<!--i:eti-tag-->
## 永久免費

**只要在你的裝置上渲染，就永久免費。** 引擎、執行外殼、工具與格式都是開放原始碼，已發布的版本無法收回。Lolly Work 也開放原始碼。組織只需支付自己選擇的基礎設施與營運費用，自行託管不收取按席次或按渲染次數計算的軟體授權費。[問與答](/info/faq.html)說明這項承諾背後的故事。

<!--i:eti-map-pin-->
## 你的內容存放在哪裡

Lolly 的創作工作可在你擁有的硬體上執行，其設計 token、字型、標誌與工具都是你能保留的檔案。使用 Lolly Work 時，共用專案、素材、政策與稽核記錄都存放在組織設定的儲存空間中。[信任](/info/trust.html)說明這為何重要，而[隱私政策](/info/privacy.html)與[自行驗證](/info/verify-yourself.html)讓你能檢查這項聲明，無需只憑我們的一面之詞。

<!--i:eti-grid-->
## 逐一比較工具

[逐一比較 Lolly 與其他工具](/info/compare.html)以每類一頁的方式，將 Lolly 與 Canva、Adobe、Figma、Penpot、品牌入口網站、渲染 API 及線上轉換器比較，並列出[各項功能在哪裡執行](/info/compare.html#what-runs-where)。
