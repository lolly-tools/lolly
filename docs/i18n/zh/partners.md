# 與合作夥伴協作

許多作品會呈現兩個品牌，例如活動海報上的贊助商標誌、以製造商名義推出的經銷商優惠、聯合公告，或與供應商共同撰寫的案例研究。本頁適用於雙方。

在本頁中，**主導品牌**是作品採用其設計系統製作的品牌，**合作夥伴**則是作品上的另一個品牌。任何一方都可以製作作品。[品牌架構](/info/brand-architectures.html#co-branding)比較了聯名品牌與其他品牌安排。

<!--i:eti-info-->
## Lolly 目前如何處理兩個品牌

- **每件作品由一個設計系統繪製。** 採用主導品牌的色彩、字體排印與組織規則。合作夥伴的標誌以圖稿形式加入：來自 Assets 的圖片，或保存在設計系統中的自訂標誌。
- **品牌以檔案形式傳遞。** 設計系統檔案（`.lolly`）包含 token、字型與標誌。使用 **Share with rules** 製作的可重複使用工具，包含一個完成的版面與你允許的輸入。品牌技能則以各自的檔案傳遞。
- **品牌也可以有位址。** [品牌頁面](/info/brand-page.html)會發佈標誌、色彩、字體排印與規則供合作夥伴閱讀，並提供 token 與技能供其工具使用。
- **Lolly 只檢查主導品牌的規則。** Lolly 不知道合作夥伴的規則，例如淨空區或最小尺寸，因此請對照合作夥伴的規範檢查。在 Lolly Work 合作夥伴計畫中，公司的合作夥伴資料包包含其規則，Lolly Design 會對照資料包檢查該公司的標誌。
- **整套合作夥伴計畫在 Lolly Work 上運作。** 經銷商、分銷商或其他合作夥伴在你的 Lolly Work 上使用你的品牌製作作品時，合作夥伴計畫只會提供你選擇的工具、檔案與範本給各合作夥伴公司。計畫會保存公司的標誌與詳細資訊，將它們填入你的範本，並在每個檔案中記錄該公司。[經營合作夥伴計畫](/info/manage/run-a-partner-programme.html)是供營運團隊使用的指南。

<!--i:eti-folder-shared-->
## 與合作夥伴分享你的品牌

### 選擇要傳送的內容

| 傳送內容 | 方式 | 合作夥伴會取得 | 適用於 |
| --- | --- | --- | --- |
| 設計系統檔案 | [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) 頂端列中的 **Export** | 你的 token、字型、標誌與主題偏好設定，以可切換使用的設計系統提供 | 使用你的品牌製作大量作品的合作夥伴 |
| 可重複使用的工具 | Lolly Design 中的 **Share with rules**（[分享附有規則的設計](/info/create-a-tool.html)） | 一個完成的版面與你允許的輸入，例如對方的名稱與標誌。檔案包含解析後的色彩、字型與圖片，因此對方自己的設計系統無法更改固定圖稿的樣式 | 供各合作夥伴填寫的聯名傳單、徽章或橫幅 |
| 品牌技能 | **Skills** 工作區：**Download skill (.zip)** 或 **Copy as one file** | 你的書面規範，供對方的人員與代理程式使用 | 上述任一情況中，由代理程式負責部分工作時 |
| 品牌頁面 | Lolly Design System Setup 中的 **Publish a brand page**，或 `lolly system publish`，會寫出由你託管的資料夾（[品牌頁面](/info/brand-page.html)） | 在一個位址提供你目前的標誌、色彩、字體排印與規則，並提供 token 與技能供對方的工具使用。標誌與字型檔案會在權利允許時出現，頁面會列出未納入的內容 | 與你不會傳送檔案的對象分享 |
| Token | 工作室 **More** 選單中的 **Tokens (.json)** | 純設計 token 文件，不含字型或標誌 | 合作夥伴自己的設計工具或建置 |

![Lolly Demo 上的 Lolly Design System Setup，開啟 Skills 區域：列上有 Export，More 選單開啟並顯示 Tokens (.json)，所選技能旁有 Download skill (.zip) 與 Copy as one file](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning 你的字型會隨檔案傳遞
你新增的字型會包含在設計系統檔案中，因此請確認其授權允許你轉交這些檔案。
:::

可重複使用的工具在納入受授權限制的圖片之前，會要求你確認（[預覽與分享](/info/create-a-tool.html#preview-and-share)）。

### 製作聯名範本

可重複使用的工具會將每個合作夥伴的內容保留在你的版面中。合作夥伴只能更改你允許的部分。

1. 在 Lolly Design 中，使用你的設計系統製作作品。在合作夥伴標誌的位置畫一個圖片方塊，並在方塊周圍保留版面所需的空間。
2. 從 File 選單選擇 **Share with rules**。選取圖片方塊，然後選擇 **Make editable**。在其 **Rules** 中允許上傳替換圖片，設定最小像素尺寸與接受的上傳格式（盡可能使用 SVG）。將方塊的 **Image fit** 設為 **Contain (fit inside)**，讓寬形或高形標誌保持在方塊內。
3. 也讓合作夥伴的名稱或優惠內容可供編輯，並設定字元限制。
4. 按下 **Preview**，試用很寬的標誌、很高的標誌與很長的名稱。
5. 選擇 **Share .lolly**，並為合作夥伴寫下操作說明：應上傳哪個版本的標誌，例如適用於淺色背景的全彩橫式標誌。

![聯名活動卡片上的 Share with rules：合作夥伴的標誌方塊已選取且可編輯，其 Rules 允許上傳至少 480 乘 110 像素的 PNG 或 SVG 圖片](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

合作夥伴將檔案拖放到 Lolly，檢閱信任提示、填寫輸入欄位，並下載你允許的格式（[使用完成的工具](/info/create-a-tool.html#use-the-finished-tool)）。Lolly 會讓標誌保持在你畫的方塊內。Lolly 不會讀取合作夥伴的淨空區規範，因此標誌只有你在方塊周圍留下的空間。

### 將你的品牌技能交給代理程式

技能指引人員與代理程式。Lolly 檢查組織規範。

- 在 Lolly Design System Setup 中，開啟 **Skills** 區域（`#/start?area=skills`），選擇技能並按下 **Download skill (.zip)**。資料夾的目錄連結會指向你的 Lolly，其 `lolly.json` 則記錄這份副本的來源。**Copy as one file** 會將相同的文字放到剪貼簿，供貼入聊天視窗。
- 在終端機中，`lolly system skill <name> --into=<dir>` 會寫出相同的資料夾（[放在資料夾中供本機代理程式工具使用](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)）。
- 你自己的電腦會列出標記為 `internal` 與 `public` 的技能，因此請選擇要傳送哪些（[公開與內部技能](/info/brand-skills.html#public-and-internal-skills)）。
- 對於沒有自有技能的設計系統，Lolly 會依其 token 與組織規範撰寫基礎版本，並在該區域列出。
- 副本不會自行更新。發布技能的新修訂版本時，請再次傳送資料夾。

<!--i:eti-download-->
## 使用收到的品牌製作作品

本節適用於收到設計系統檔案的合作夥伴。如果主導品牌在自己的 Lolly Work 上執行合作夥伴計畫，你則改為在那裡登入：首頁會顯示你的公司卡片與向你發布的範本（[合作夥伴看到的內容](/info/manage/run-a-partner-programme.html#what-partners-see)）。

1. **開啟檔案。** 將檔案拖放到 Lolly，或按下 **Open**；Lolly Design System Setup 中的 **Add from…** 也能接收檔案。預覽會在寫入任何內容之前列出檔案內容。設計系統檔案會以主導品牌的名稱新增獨立的設計系統，並將其設為使用中。你自己的設計系統會留在裝置上。如果檔案的用途是將應用程式連接到主導品牌自己的 Lolly，則會先列出對整部裝置的影響；[在你的組織使用 Lolly](/info/organisation.html)說明這類檔案。
2. **認識品牌。** 在 Lolly Design System Setup 中，**Board** 顯示設計系統的內容，**Logos** 包含其標誌，**Rules** 列出 Lolly 檢查的組織規範。**Skills** 顯示 Lolly 依 token 與規範撰寫的基礎版本；主導品牌若傳送自己的技能，則會以獨立檔案提供。
3. **切換品牌。** **Settings → Preferences → Design systems** 可切換整部裝置的設計系統，**Settings → Design system** 則有一列封面可供切換。先完成一個品牌的作品再切換。
4. **放置你自己的標誌。** 將標誌上傳到 **Assets**，就能在每個設計系統中使用；或將它新增為主導品牌設計系統中的 **custom mark**（**Logos** 區域的 **Custom marks**），讓它隨該設計系統的檔案傳遞。顯示鎖頭的設計系統為唯讀，這時請使用 Assets。[放置合作夥伴的標誌](#place-a-partner-s-mark)列出了檢查項目。
5. **匯出前檢查。** 在 Lolly Design 中，匯出面板的 **Before you export** 卡片會逐圖層列出對照主導品牌組織規範的檢查結果（[匯出前](/info/design.html#before-you-export)）。**Design system** 卡片顯示檔案記錄的設計系統。
6. **傳回作品。** 傳送匯出的檔案，或將可編輯的設計以 `.lolly` 傳送（[分享你的作品](/info/using.html#sharing-your-work)）。設計會在目前使用中的設計系統下開啟，因此主導品牌開啟你的設計時，需使用自己的設計系統。

::: note 設計系統檔案不會更新
設計系統檔案是品牌在匯出當天的副本。這份副本不會有任何更新。
:::

主導品牌傳送較新的檔案時，以相同方式開啟。接著在 **Settings → Preferences → Design systems** 檢查哪個設計系統正在使用，並在不再需要舊副本時於該處移除。

![Settings 中的設計系統：Lolly Demo 正在使用，Lolly Starter 有可切換整部裝置的 Use 按鈕，Open or import a file 可接收設計系統檔案](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## 放置合作夥伴的標誌

| 方式 | 步驟 | 適用情況 |
| --- | --- | --- |
| Assets 中的圖片 | 將檔案拖放到 **Assets** 的上傳區域，再於工具的圖片欄位中選擇，或在 Lolly Design 工具列的新增選單中選擇 **Image** | 一次性作品。上傳內容屬於裝置，因此無論使用哪個設計系統都能使用 |
| 自訂標誌 | **Logos** 區域的 **Custom marks**：輸入標誌名稱，再按 **Choose file…** | 經常合作的夥伴。標誌屬於設計系統，並隨其檔案傳遞 |
| 完成的組合標誌 | 在你的繪圖工具中將兩個標誌組合，再新增為自訂標誌 | 重複使用的「與」或「合作夥伴」組合標誌 |

::: check 匯出前，檢查標誌
- **正確的檔案。** 使用合作夥伴提供的檔案，有 SVG 就使用 SVG。從網頁或投影片複製的標誌列印時會模糊。
- **適合背景的版本。** 在深色或複雜背景上，若合作夥伴的指南提供反白或單色版本，請使用該版本。
- **比例。** 將圖片方塊的 **Image fit** 設為 **Contain (fit inside)**，標誌就絕不會被拉伸。
- **淨空區與大小。** 在標誌周圍保留合作夥伴指南要求的空間，並讓標誌大於其最小尺寸。Lolly 不會測量這兩項。
- **哪個品牌主導。** 依兩個品牌關於主導關係的指南設定兩個標誌的大小。
- **權利。** Lolly 會顯示目錄素材記錄的授權。你自己上傳的檔案沒有授權記錄，其詳細資訊會顯示 *Licence not recorded*，因此請在自己的記錄中保留合作夥伴允許使用標誌的許可（[創作權利與署名](/info/creative-rights.html)）。
:::

![聯名卡片上的 Before you export：設計系統為 Lolly Demo，合作夥伴標誌被註記為設計系統素材以外的圖片，四項組織規範都沒有需要註記之處](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

匯出檔案的[設計系統記錄](/info/exporting.html#the-design-system-record)會列出主導品牌的設計系統與配色方案。它不會記錄合作夥伴的品牌，除非是在 Lolly Work 合作夥伴計畫中，這時也會列出作品所屬的合作夥伴公司與計畫。

### 將各品牌的技能交給代理程式

由代理程式製作作品時，將兩個品牌的技能原樣交給它，並告訴它哪個品牌主導。各品牌的技能保留自己的名稱與 id。Lolly 不會合併兩個品牌的技能，也不會決定哪個品牌優先。

<!--i:eti-grid-->
## 贊助商與活動標誌牆

[Lolly Logo Wall](/#/tool/logo-wall) 工具會將標誌排列成均勻的格線，用於贊助商看板、合作夥伴投影片或媒體背板。活動通常由主辦單位的品牌主導：標誌牆使用主辦單位的設計系統製作，各贊助商的標誌則作為圖稿放在牆上。

![深綠色背景的三級贊助商牆，所有標誌皆為白色：兩個金級合作夥伴、三個銀級合作夥伴與五個社群合作夥伴，各級都有自己的標題，級別每降低一級，標誌就縮小一級](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. 開啟 Lolly Logo Wall，將標誌拖放到 **Logos**。每個標誌都有自己的一組控制項。
2. 為每個標誌指定 **Tier**，例如「金級合作夥伴」。每個級別都有自己的列，依級別首次出現的順序排列在各自的標題下；**Tier headings** 可關閉標題。當 **Tier sizes** 設為 **Step down**，每降低一級，每列就多放一個標誌，因此較高級別看起來較大。**Presence** 與 **Size %** 可在級別內調整單一標誌。
3. 保持 **Balance sizes** 開啟。Lolly Logo Wall 會依視覺重量調整每個標誌的大小，較厚重的縮小、較輕盈的放大，讓每個級別看起來均衡。
4. **Trim margins** 會將每個標誌裁切到圖稿邊緣。如果標誌檔案已包含擁有者要求的淨空區，請關閉此選項。
5. **Remove white backgrounds** 會清除從投影片複製的標誌常帶有的白色方框。
6. 在 **Layout** 下設定 **Columns**、間距與內距。**Background** 的初始值是你設計系統的表面色彩。
7. 若要製作單色牆，開啟 **Render all as vector** 並選擇 **Ink colour**，或將單一標誌的 **Filter** 設為 **Greyscale**。只有各贊助商的指南允許時才使用單色版本。
8. 若要製作媒體背板，在 **Step & repeat** 下選擇 **Grid**、**Brick** 或 **Checker**，並設定 **Rows** 數量。

將標誌牆匯出為 PNG、SVG、PDF，或供印刷用的 CMYK PDF。在匯出面板設定不同的尺寸與形狀，例如 1080 x 1920 的直式限時動態或 A4 頁面，畫布就會重新排列標誌牆以填滿該形狀，每列的標誌數量會隨之增減。匯出結果與畫布一致。若要將標誌牆放到海報上，在 Lolly Design 工具列的新增選單中選擇 **Image**，畫一個框架，再於選擇器的 **Tools** 分頁選擇 Lolly Logo Wall（[設計中的工具](/info/design.html#tools-inside-a-design)）。若要在標誌之間放入說明文字，可在 Lolly Design 中將 **Dynamic layout** 設為 **grid**，讓每個標誌各佔一個圖片方塊（[Lolly Design 中的版面](/info/design-layout.html#dynamic-layouts)）。

在終端機中，`lolly run logo-wall logos/*.png --output=wall.svg` 會從一個圖片資料夾建立標誌牆，而含有 `logo` 與 `tier` 欄的 CSV 則會建立分級標誌牆。SVG 與 PNG 不需要瀏覽器（[分級贊助商牆](/info/cli-rendering.html#a-sponsor-wall-with-tiers)）。

當贊助商發布[品牌頁面](/info/brand-page.html)時，`lolly run logo-wall --logos-from=<address or folder>` 會取得目前適用於該表面色彩的標誌，並列印頁面上的使用說明。為每個贊助商重複指定此旗標。

Lolly Logo Wall 不知道任何贊助商的規範。Tiers 與 Presence 設定的是標誌彼此的相對大小，而非贊助商要求的最小尺寸，也不會檢查相鄰標誌之間的淨空區。請以實際列印或顯示的大小，對照各贊助商的指南檢查完成的標誌牆。

<!--i:eti-hammer-->
## Lolly 目前還做不到的事

- 作品只在一個設計系統中繪製。合作夥伴的色彩、字體與規範不會在作品內構成另一個設計系統，合作夥伴的標誌是一張圖片。
- 在 Lolly Work 合作夥伴計畫以外，應用程式不會儲存或檢查合作夥伴的規範：淨空區、最小尺寸，以及單色或反白等允許的處理方式。
- 合作夥伴套件是包含合作夥伴標誌、色彩與規範的輕量套件，供其他品牌的作品使用；只有透過 Lolly Work 合作夥伴計畫才能將它帶入應用程式。在其他情況下，套件檢查需從終端機執行：`lolly check --kit=<file>` 會測量 Lolly Design 文件中的合作夥伴標誌（[檢查重製結果](/info/cli-decks.html#check-the-recreation)）。
- Lolly 不會將兩個標誌自動組合成「與」、「合作夥伴」或「由」的配置。請將完成的組合標誌新增為自訂標誌。
- 整部裝置只使用一個設計系統，因此無法並排開啟兩個品牌。
- 從應用程式匯出的設計系統檔案不含品牌技能，因此請將技能作為獨立檔案傳送。
- 從品牌頁面取得的標誌只是該列中的圖片，該列不會記住來源頁面。沒有任何資訊顯示頁面發布者，因此請自行檢查位址。
- 託管的網頁應用程式無法擷取其他品牌的頁面，因為其 Content Security Policy 只允許指定的主機。請在終端機取得標誌，或儲存檔案後將它新增到 **Assets**。

<!--i:eti-map-pin-->
## 接下來看什麼

- **[品牌架構](/info/brand-architectures.html)**：聯名、白牌與其他安排，以及各種情況在 Lolly 中的做法。
- **[執行合作夥伴計畫](/info/manage/run-a-partner-programme.html)**：合作夥伴在你的 Lolly Work 上能取得什麼，以及如何設定與執行計畫。
- **[分享附有規則的設計](/info/create-a-tool.html)**：可重複使用的工具，具有固定版面與你選擇的輸入。
- **[品牌技能](/info/brand-skills.html)**：如何撰寫、閱讀技能並交給代理程式。
- **[Lolly Design System Setup](/info/brand-studio.html)**：標誌、自訂標誌，以及在裝置間移動設計系統。
- **[品牌頁面](/info/brand-page.html)**：在單一位址發布你的品牌，並從合作夥伴的頁面取得其標誌。
- **[創作權利與署名](/info/creative-rights.html)**：Lolly 為其繪製的作品記錄哪些資訊。
