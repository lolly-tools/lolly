# 與夥伴合作

活動海報上的贊助商標誌、印在製造商名稱之下的經銷商優惠、一則聯合公告、與供應商共同撰寫的案例研究：許多作品都帶有兩個品牌。本頁面向雙方。內容包括：與夥伴分享你的品牌時要傳送什麼，如何在別人傳給你的品牌中工作，如何放置夥伴的標記，如何製作贊助商或活動的標誌牆，以及 Lolly 目前還不能做什麼。

本頁中有兩個詞始終意思相同。**主導品牌**是製作作品時所用設計系統所屬的品牌，**夥伴**是作品上的另一個品牌。任何一方都可以製作作品。[品牌架構](/info/brand-architectures.html#co-branding)說明了聯名品牌與組織安排品牌的其他方式有何關係。

## Lolly 目前如何處理兩個品牌

- **每件作品由一個設計系統繪製。** 適用主導品牌的顏色、字體和內部規則。夥伴的標記作為素材圖形放入：可以是來自 Assets 的圖片，也可以是保存在設計系統中的自訂標記。
- **品牌以檔案形式傳遞。** 設計系統檔案（`.lolly`）包含權杖、字體和標誌。用 **Share with rules** 製作的可重複使用工具包含一個完成的版面，以及你允許修改的輸入項。品牌技能則以各自獨立的檔案傳遞。
- **Lolly 只檢查主導品牌的規則。** 它不了解夥伴的規則，例如留白或最小尺寸，所以請對照夥伴自己的指南自行檢查。

## 與夥伴分享你的品牌

### 選擇要傳送的內容

| 傳送 | 方式 | 夥伴得到 | 適合 |
| --- | --- | --- | --- |
| 設計系統檔案 | 在 [Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) 頂端列中點選 **Export** | 你的權杖、字體、標誌和主題偏好，成為一個他們可以切換使用的設計系統 | 要用你的品牌製作大量作品的夥伴 |
| 可重複使用工具 | 在 Design 中點選 **Share with rules**（[分享附帶規則的設計](/info/create-a-tool.html)） | 一個完成的版面，以及你允許修改的輸入項，例如他們的名稱和標誌。檔案攜帶已確定的顏色、字體和圖片，因此他們自己的設計系統無法改變固定的圖稿樣式 | 每個夥伴各自填寫的聯名傳單、徽章或橫幅 |
| 品牌技能 | **Skills** 房間：**Download skill (.zip)** 或 **Copy as one file** | 你書面寫下的標準，供他們的團隊和 AI 代理使用 | 上述任一方式，當有一部分工作由 AI 代理完成時 |
| 權杖 | 工作室 **More** 選單中的 **Tokens (.json)** | 純粹的設計權杖文件，不含字體和標誌 | 夥伴自己的設計工具或建置流程 |

![Lolly Demo 上的 Design System Setup，開啟在 Skills 房間：頂端列有 Export，More 選單展開到 Tokens (.json)，所選技能旁邊是 Download skill (.zip) 和 Copy as one file](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

你加入的字體會隨設計系統檔案一起傳遞，因此請確認它們的授權允許你轉交這些字體檔案。如果某張圖片的授權限制了轉交，可重複使用工具在包含它之前會請你確認（[預覽與分享](/info/create-a-tool.html#preview-and-share)）。

### 製作聯名範本

可重複使用工具能讓每個夥伴的作品都保持你的版面，因為夥伴只能修改你允許的內容。

1. 在 Design 中，用你的設計系統製作作品。在放置夥伴標誌的位置畫一個圖片框，並在框周圍留出版面所需的空間。
2. 在 File 選單中選擇 **Share with rules**。選取圖片框並選擇 **Make editable**。在它的 **Rules** 中，允許上傳替換圖片，設定最小像素尺寸和你接受的上傳格式（盡量用 SVG）。把該框自己的 **Image fit** 設為 **Contain (fit inside)**，這樣無論寬標誌還是高標誌，都會保持在框內。
3. 也把夥伴的名稱或優惠設為可編輯，並設定字數上限。
4. 按下 **Preview**，試一試很寬的標誌、很高的標誌和很長的名稱。
5. 選擇 **Share .lolly**，並為夥伴寫好說明：請上傳他們標誌的哪個版本，例如適用於淺色背景的全彩橫式標誌。

![聯名活動卡片上的 Share with rules：夥伴的標誌框已選取並可編輯，它的 Rules 允許上傳至少 480 × 110 像素、格式為 PNG 或 SVG 的圖片](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

夥伴把檔案拖入 Lolly，查看信任提示，填寫輸入項，然後下載你允許的格式（[使用完成的工具](/info/create-a-tool.html#use-the-finished-tool)）。Lolly 會把標誌保持在你畫的框內。它不會讀取夥伴自己的留白規則，所以你在框周圍留出的空間，就是標誌得到的空間。

### 把你的品牌技能交給 AI 代理

技能是寫給人和 AI 代理的指引；Lolly 檢查的則是內部規則。

- 在 Design System Setup 中開啟 **Skills** 房間（`#/start?area=skills`），選擇一項技能，按下 **Download skill (.zip)**。資料夾中的目錄連結指向你的 Lolly，其中的 `lolly.json` 記錄了這份副本的來源。**Copy as one file** 會把同樣的文字放到剪貼簿，供貼到聊天視窗。
- 在終端機中，`lolly system skill <name> --into=<dir>` 會寫出同樣的資料夾（[放在本機 AI 代理工具的資料夾中](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)）。
- 標記為 `internal` 的技能和 `public` 的技能一樣會列在你自己的機器上，所以請選擇要傳送哪些（[公開與內部技能](/info/brand-skills.html#public-and-internal-skills)）。
- 沒有自己技能的設計系統會有一份基礎技能，由 Lolly 根據它的權杖和內部規則寫成，該房間同樣會列出這份基礎技能。
- 副本不會自行更新。技能發布新修訂後，請重新傳送資料夾。

## 在別人給你的品牌中工作

寫給收到設計系統檔案的夥伴。

1. **開啟檔案。** 把檔案拖到 Lolly 上，或按下 **Open**；Design System Setup 中的 **Add from…** 也可以接收這個檔案。寫入任何內容之前，預覽會列出檔案包含的內容。設計系統檔案會以主導品牌的名稱新增一個獨立的設計系統並將其設為使用中，你自己的設計系統仍保留在裝置上。如果檔案是讓應用程式連接到主導品牌自己的 Lolly，會先列出它對你整台裝置的影響；這類檔案請見[在你的組織中使用 Lolly](/info/organisation.html)。
2. **瀏覽品牌。** 在 Design System Setup 中，**Board** 顯示設計系統包含的內容，**Logos** 是它的標誌，**Rules** 列出 Lolly 檢查的內部規則。**Skills** 顯示 Lolly 根據權杖和規則寫成的基礎技能；主導品牌自己的技能如果寄來，會以獨立的檔案送達。
3. **在品牌之間切換。** **Settings → Preferences → Design systems** 會為整台裝置切換設計系統，**Settings → Design system** 中有一排封面可供切換。切換之前，請先完成一個品牌的作品。
4. **放置你自己的標記。** 把你的標誌上傳到 **Assets**，它在每個設計系統中都可使用；也可以把它作為**自訂標記**加入主導品牌的設計系統中（**Logos** 房間，**Custom marks**），這樣它會隨該設計系統的檔案一起傳遞。顯示鎖頭圖示的設計系統是唯讀的，在那裡請使用 Assets。檢查事項見[放置夥伴的標記](#place-a-partner-s-mark)。
5. **匯出之前先檢查。** 在 Design 中，匯出面板的 **Before you export** 卡片會逐圖層列出對照主導品牌內部規則的發現（[匯出之前](/info/design.html#before-you-export)）。**Design system** 卡片顯示檔案所記錄的設計系統。
6. **把成果寄回去。** 傳送匯出的檔案，或者以 `.lolly` 傳送可編輯的設計（[分享你的作品](/info/using.html#sharing-your-work)）。設計會在使用中的設計系統裡開啟，所以主導品牌開啟你的設計時，用的是他們自己正在使用的設計系統。

設計系統檔案是品牌在匯出當天的一份副本，不會有任何東西更新這份副本。主導品牌寄來更新的檔案時，用同樣的方式開啟新檔案。然後在 **Settings → Preferences → Design systems** 中檢查目前使用的是哪個設計系統，舊版本用完後，在那裡移除舊副本。

![Settings 中的設計系統：Lolly Demo 為使用中，Lolly Starter 有一個會為整台裝置切換的 Use 按鈕，Open or import a file 可接收設計系統檔案](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

## 放置夥伴的標記

| 方式 | 步驟 | 最適合 |
| --- | --- | --- |
| Assets 中的圖片 | 把檔案拖到 **Assets** 的上傳區，然後在工具的圖片欄位中選擇它，或在 Design 中透過側欄新增選單的 **Image** 選擇 | 一次性作品。上傳屬於這台裝置，所以無論使用中的是哪個設計系統都可用 |
| 自訂標記 | **Logos** 房間，**Custom marks**：輸入標記的名稱，然後按 **Choose file…** | 經常合作的夥伴。標記屬於該設計系統，並隨它的檔案一起傳遞 |
| 完成的組合標誌 | 在你的繪圖工具中用兩個標記做出組合標誌，再將它新增為自訂標記 | 反覆使用的「聯名」或「與……合作」組合標誌 |

匯出之前，請檢查這個標記：

- **檔案正確。** 使用夥伴提供的檔案，有 SVG 就用 SVG。從網頁或投影片複製的標誌，印刷時會變模糊。
- **版本與背景相配。** 在深色或雜亂的背景上，如果夥伴的指南提供反白版或單色版，就使用它。
- **比例。** 把圖片框的 **Image fit** 設為 **Contain (fit inside)**，標記就不會被拉伸。
- **留白和尺寸。** 在標記周圍留出夥伴指南要求的空間，並讓標記保持在他們規定的最小尺寸之上。Lolly 對這兩項都不測量。
- **哪個品牌居主導。** 按兩個品牌指南中關於誰居主導的要求，來決定兩個標記的大小。
- **權利。** Lolly 會顯示目錄素材所記錄的授權。你自己上傳的檔案沒有授權記錄，它的詳細資料會寫 *Licence not recorded*，所以請把夥伴同意你使用其標記的許可，連同你自己的記錄一起保存（[創作權益與署名](/info/creative-rights.html)）。

![聯名卡片上的 Before you export：設計系統是 Lolly Demo，夥伴的標誌被記為設計系統素材之外的圖片，四條內部規則沒有需要說明的內容](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

匯出檔案的[設計系統記錄](/info/exporting.html#the-design-system-record)會給出主導品牌的設計系統和配色方案。它不會記錄夥伴的品牌。

### 把各品牌的技能交給 AI 代理

由 AI 代理完成工作時，請把主導品牌的技能和夥伴的技能原樣交給 AI 代理，並告訴它哪個品牌居主導。每個品牌的技能保留各自的名稱和 id。Lolly 不會合併兩個品牌的技能，也不會決定哪個品牌優先，它只檢查主導品牌的內部規則。

## 贊助商與活動標誌牆

[標誌牆](/#/tool/logo-wall)工具會把一堆標誌排成整齊的格線，可用於贊助商看板、夥伴投影片或新聞背板。在活動中，主辦方通常是主導品牌：標誌牆用主辦方的設計系統製作，每位贊助商的標誌作為圖稿放在牆上。

![深綠色背景上分三層的贊助商牆，所有標誌都以白色繪製：兩個 Gold 夥伴、三個 Silver 夥伴和五個 Community 夥伴，每一層各有標題，較低的一層逐級縮小](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. 開啟標誌牆，把標誌拖到 **Logos** 上。每個標誌都有自己的一組控制項。
2. 給每個標誌設定一個 **Tier**，例如「金牌夥伴」。每個層級按首次出現的順序各占幾列，並有自己的標題；**Tier headings** 可關閉標題。把 **Tier sizes** 設為 **Step down** 後，每個較低層級每列多容納一個標誌，所以較高層級顯得更大。**Presence** 和 **Size %** 仍可在層級內微調單個標誌。
3. 保持 **Balance sizes** 開啟。標誌牆按視覺重量決定每個標誌的大小，所以視覺厚重的標誌會縮小，較輕的會放大，讓每一層看起來均衡。
4. **Trim margins** 會把每個標誌裁切到只剩圖稿。如果標誌檔案本身已包含其所有者要求的留白，請關閉該選項。
5. **Remove white backgrounds** 會去掉從投影片複製的標誌常帶的白色方框。
6. 在 **Layout** 下設定 **Columns**、間距和內距。**Background** 起初是你的設計系統的表面顏色。
7. 要做單色牆，請開啟 **Render all as vector** 並選擇 **Ink colour**，或把某個標誌的 **Filter** 設為 **Greyscale**。只有在各贊助商的指南允許單色版本時才使用。
8. 要做新聞背板，請在 **Step & repeat** 下選擇 **Grid**、**Brick** 或 **Checker**，並設定 **Rows** 的數量。

可將標誌牆匯出為 PNG、SVG、PDF，或用於印刷的 CMYK PDF。在匯出面板中設定其他尺寸和形狀，例如直式 1080 x 1920 的限時動態或 A4 頁面，畫布會顯示重新排布後填滿該形狀的標誌牆，每列的標誌會更少或更多。匯出的就是畫布上的標誌牆。要把標誌牆放到海報上，請在 Design 中透過側欄新增選單選擇 **Image**，畫一個框，然後在選擇器的 **Tools** 分頁中選取標誌牆（[設計中的工具](/info/design.html#tools-inside-a-design)）。如果要在標誌之間加說明文字，Design 中設為 **grid** 的 **Dynamic layout** 會為每個標誌提供一個圖片框（[Design 中的版面](/info/design-layout.html#dynamic-layouts)）。

在終端機中，`lolly run logo-wall logos/*.png --output=wall.svg` 會用一個圖片資料夾產生標誌牆，帶有 `logo` 和 `tier` 欄的 CSV 則產生分層的標誌牆。SVG 和 PNG 不需要瀏覽器（[分層的贊助商牆](/info/cli-rendering.html#a-sponsor-wall-with-tiers)）。

標誌牆不了解任何贊助商的規則。Tier 和 Presence 設定的是各標誌之間的相對大小，而不是贊助商的最小尺寸，也沒有任何檢查會核對相鄰標誌之間的留白。請按完成的標誌牆實際印刷或展示的尺寸，對照每位贊助商的指南檢查。

## Lolly 目前還不能做什麼

- 一件作品只在一個設計系統中繪製。夥伴的顏色、字體和規則不會成為作品內的設計系統，夥伴的標記只是一張圖片。
- 夥伴的規則不會被保存，也不會被檢查：留白、最小尺寸，以及單色或反白等允許的處理方式。Lolly 只檢查主導品牌的內部規則。
- 目前還沒有夥伴套件：一種輕量的包，用來保存夥伴的標誌、顏色和規則，以便在另一個品牌的作品中使用。
- Lolly 不會為「聯名」「與……合作」或「由……出品」這類安排，用兩個標記產生組合標誌。請把完成的組合標誌新增為自訂標記。
- 整台裝置同一時間只有一個設計系統處於使用狀態，所以無法並排開啟兩個品牌。
- 設計系統檔案是品牌在匯出時的一份副本，不會有任何東西更新這份副本。從應用程式匯出的設計系統檔案不含品牌技能，請把它們作為獨立的檔案傳送。
- 匯出檔案記錄的是主導品牌的設計系統和配色方案，而不是夥伴的品牌。

## 接下來往哪裡走

- **[品牌架構](/info/brand-architectures.html)**：聯名品牌、白標及其他安排，以及在 Lolly 中各自該怎麼做。
- **[分享附帶規則的設計](/info/create-a-tool.html)**：版面固定、輸入項由你選擇的可重複使用工具。
- **[品牌技能](/info/brand-skills.html)**：技能如何撰寫、閱讀並交給 AI 代理。
- **[Design System Setup](/info/brand-studio.html)**：標誌、自訂標記，以及在裝置之間搬移設計系統。
- **[創作權益與署名](/info/creative-rights.html)**：Lolly 對所繪作品記錄了哪些內容。
