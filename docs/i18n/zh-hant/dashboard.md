# Settings

Settings 是你更改 Lolly 如何為你運作的地方：你的詳細資料、你使用的設計系統、無障礙、這部裝置上儲存了什麼，以及離線準備好了什麼。用首頁底部列中的 **Settings** 或你的頭像選單開啟它。它會在 **Preferences** 開啟，旁邊另有四個分頁。

| 分頁 | 位址 | 內容 |
|---|---|---|
| **Preferences** | `#/settings` | 你的詳細資料、設計系統、外觀、表情符號、無障礙、連線、儲存空間與離線下載 |
| **This device** | `#/settings?tab=device` | 這個瀏覽器與機器的即時讀數，加上聲音與唯讀的儲存檢視 |
| **Design system** | `#/settings?tab=brand` | 目前使用的設計系統，以封面與頁面呈現，並有一排可切換系統的封面 |
| **Capabilities** | `#/settings?tab=caps` | Lolly 能做的一切，以可搜尋的卡片呈現 |
| **Activity & stats** | `#/settings?tab=activity` | 目錄、你的本機計數器與近期的作品 |

每個分頁都有自己的位址，而舊的 `#/profile` 與 `#/d` 連結仍會開啟正確的地方，細到個別設定。

## Preferences

Preferences 是一個長頁面，側邊有**設定列**，列上方有 **Search settings** 欄位，會隨你輸入進行篩選。每個區段都可從形如 `#/settings?focus=<section-id>` 的連結直接開啟，例如 `#/settings?focus=storage-section`。

- <!--i:usercheck--> **Your details** - 你的姓名、聯絡資料與大頭照，以及 **Use my details to create** 開關。[個人資料](/info/profile.html)說明工具如何使用它們。
- <!--i:seal--> **Content Credentials** - 為你的匯出簽署的選用已驗證身分。請見 [Content Credentials](/info/content-credentials-identity.html)。
- <!--i:palette--> **Design systems** - 切換、新增、隱藏或移除設計系統。[Design System Setup](/info/brand-studio.html#manage-your-design-systems) 涵蓋每個動作。
- <!--i:moon--> **Appearance** - 主題（Light、Dark 或 Brand，後者以你的調色盤繪製應用程式），以及 **Interface follows the design system**。
- <!--i:sparkle--> **Emoji** - 你開始新作品時用來繪製表情符號的組合及其圖稿授權，以及你的調色盤為它們重新著色的強度（**Off**、**Subtle**、**Strong**、**Full**、**Mono** 或 **Duotone**）。**Keep skin tones and flags** 讓這些保持自己的顏色。你已經做好的作品會保留製作時所用的組合。
- <!--i:eyeoff--> **Accessibility** - 四個舒適度開關，加上 Sound 與 Neurospicy Mode。請見[無障礙](#accessibility)。
- <!--i:link--> **Connected services** - 你連接的儲存空間，例如 Dropbox、Google Drive、OneDrive、Nextcloud 或 S3，以及 **Sync across devices**。請見[同步你的裝置](/info/sync.html)。
- <!--i:globe--> **Trusted sites** - Design 網頁方塊或 Sandbox 示範可以不經詢問就連絡的網站，以及在伺服器提供時的 **Allow pages from any site**。[隱私政策](/info/privacy.html)列出每個請求會傳送什麼。
- <!--i:download--> **Your renders** - **Save my renders to my library** 會把你下載的每個圖片、音訊片段與影片複製一份到 Assets，並加上 Renders 標籤。
- <!--i:database--> **Storage** - Lolly 在這部裝置上保存了什麼，以及清除或攜帶你資料的按鈕。請見[儲存空間](#storage)。
- <!--i:cpu--> **Available offline** - 在你失去連線之前下載你需要的東西。請見[離線可用](#available-offline)。
- <!--i:folder--> **Hot folder** - 在桌面應用程式中，監看一個資料夾，並把放入其中的任何東西經由與拖放相同的選擇器拉進 Lolly。
- <!--i:clock--> **Your activity** - 你在這部裝置上製作了什麼，於本機計算。
- <!--i:sliders--> **Feature flags** - 開啟或關閉應用程式的各個部分，例如 **Print preflight** 或 **Strip metadata from uploads**。
- <!--i:server--> **Lolly instance** - 這個安裝從哪裡取得工具與目錄。請見 [Lolly instance](#lolly-instance)。

主題卡片是即時預覽，一選就會套用，僅限這部裝置。

![三張主題卡片，各自預覽自己的字型與顏色，目前使用中的那張會被標示出來](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### 無障礙

**Settings → Preferences → Accessibility** 為你作品周圍的應用程式提供四個舒適度設定。每一項在你開啟之前都是關閉的，而且沒有一項會觸及工具畫布或匯出內容，所以更平靜的應用程式絕不會移動你送出的檔案的任何一個像素。

- <!--i:pause--> **Reduce motion** 會關閉應用程式的轉場、滑動與裝飾動畫。你的畫布與任何動態匯出仍照設計移動。
- <!--i:photos--> **Hide colourful previews** 將圖庫的預覽圖稿換成平靜的圖示加文字卡片，並讓專案縮圖安靜下來，既保持可辨識又不喧鬧。
- <!--i:sliders--> **High contrast** 加強應用程式的邊框、文字與焦點框。你的品牌色彩與畫布維持你設定的樣子。
- <!--i:font--> **Large text** 放大應用程式的標籤、選單與按鈕文字。你設計內的字型不受影響，所以你匯出的內容不會重新排版。

這些設定存放在你的個人資料中，所以會隨個人資料匯出一起帶走，並與你的姓名和工作階段一起出現在下一個安裝上。裝置專用的小型副本會在第一次繪製之前套用它們。

同一張卡片包含 **Sound**，這是為你的操作（進入圖庫、Content Credentials 結果、關閉面板）提供的一層柔和輔助音效，以及 **Neurospicy Mode**，一首平靜的專注曲目。開啟 Neurospicy 會在角落開啟一個小型播放器，跟著你跨越整個應用程式。你可以在那裡挑選曲目、跳過、設定音量，以及最小化或關閉播放器。曲目包括程序式生成的 *Lolly Sings* 曲調、環境循環與節拍、你自己的音訊，以及需要連線的網路電台。兩者預設都是關閉的並會被記住，關閉 Sound 也會讓專注曲目靜音。個人資料選單與 **This device** 帶有相同的開關。

介面可用鍵盤操作，自訂控制項帶有供螢幕閱讀器使用的標籤，而每個工具的即時預覽會以一張帶標籤的圖片呈現，描述它顯示的內容。

### 儲存空間

儲存量表依類別逐項計算這個安裝所保存的每一個位元組，並對照瀏覽器回報的數值。

![儲存量表，將已儲存的工作階段、圖片與快取，對照瀏覽器實際回報的數值逐項列出](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

量表下方：

- **Move to another device** 有 **Export my data**、**Import data…** 與 **Export my data & render everything**。[將你的作品移到另一部裝置](/info/find-your-work.html#move-your-work-to-another-device)逐一說明。
- **Clear cache** 會捨棄已下載的目錄檔案，需要時會再次下載。
- **Remove automatic checkpoints older than 30 days** 會釋放 History 的空間，並保留已儲存與已命名的版本。
- **Clear all my data** 會在你輸入一個字確認後，移除 Lolly 在這個瀏覽器中保存的一切。[如果你清除瀏覽器資料](/info/find-your-work.html#if-you-clear-your-browser-data)列出會消失的內容。

### 離線可用

Lolly 會在你造訪畫面時快取它們，但這只涵蓋你已去過的地方。**Available offline** 是為你預見的旅程準備的：下載你會需要的部分，看著一條進度條，你帶走的一切在沒有連線時也能繼續運作。

- <!--i:monitor--> **App, catalogue and guides** - **The app**（每個檢視、編輯器與字型，包括你從未開啟過的畫面）、**Catalogue**（全部，或 **Choose by tag**）與 **Guides & docs**（你所用語言的本文件，包括螢幕截圖）。
- <!--i:cpu--> **AI models** - 每個裝置端模型各佔一列並附其大小：Speech voices、Upscaling models、Background removal、Text recognition、Verify deep scan、Durable credential、Rewriter model、Ask matching model、AI text detector 與 Singing voices。超過 50 MB 的模型會標示為 **large download**。
- <!--i:wrench--> **Tools** - 每個工具各自下載，或用 **Download all** 取得所有工具。打勾表示已可離線使用。

頂端的 **Download everything** 會取得應用程式、你選擇的目錄範圍、指南與所有工具。勾選 **Include all the AI models** 可加入模型，或從各自的列下載單一模型；歌聲只會從它們自己的列下載。組織的政策可以關閉 AI 下載，而這些列會告訴你。

如果你取消或失去連線，下載會從中斷之處繼續，並在你重新上線時自行更新，只擷取發行版本更動的部分。如果瀏覽器尚未授予持續性儲存空間，**Protect downloads** 會要求它：這就是「已下載」與「已下載，直到瀏覽器要回空間為止」的差別。

### Lolly instance

**Lolly instance** 說明這個安裝從哪裡取得工具與目錄：某個實例的位址，或當一切都隨建置版本出貨時的 *Bundled with this app*。

- **Design-system source** 顯示提供的設計系統來自何處。
- **Instance console** 在部署提供時，開啟其管理頁面。
- **Change** 讓桌面應用程式指向另一個實例。瀏覽器無法跨來源載入工具與素材，所以在網頁上，這一區段改為提供 **Open a workspace**。
- **Leave** 會移除該實例的設計系統、工具與目錄，而你自己的作品會保留。請見[在你的組織使用 Lolly](/info/organisation.html#leaving)。
- 當你登入組織時，**Sign out** 會結束這個工作階段，**Sign out everywhere** 則結束你在每部裝置上的工作階段，包括這一部。

## 這部裝置

- <!--i:monitor--> **This Machine** - 螢幕、輸入、圖形、記憶體、編解碼器、儲存後端等，從本次工作階段即時讀取。不儲存任何內容，也不傳送任何內容。在寬螢幕上它會自動開啟，該分頁會以兩欄排列。
- <!--i:neurobeat--> **Sound** - 介面音效與 Neurospicy 專注循環，是這個分頁上唯一會寫入任何內容的開關。
- <!--i:database--> **Storage** - [Preferences](#storage) 中量表的唯讀檢視，清除或攜帶資料要到那裡進行。

## 設計系統

目前使用的設計系統，整理成便於閱讀的樣子。當這個瀏覽器保存了兩個或更多設計系統時，頂端的一排小封面會列出它們：選擇其一即可設為使用中，而隨後通知中的 **Undo** 會放回先前的那個。

![Lolly Demo 上的 Design system 分頁：用於切換系統的一排封面，接著是帶有標誌、名稱、備註與可開啟各頁面之計數的封面](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

該分頁以系統自己的色彩繪製的封面開啟，帶有它的標誌、以其展示字體顯示的名稱，以及作者寫下的備註。封面上的一行計數連結到每一頁：

- <!--i:palette--> **Colour** - 淺色與深色外觀的表面、文字、主色與次要色，每個具名色彩以附有名稱與十六進位值的色塊呈現，每條色調漸層與圖表光譜各一條色帶，以及收在摺疊中的色彩角色。選取一個值即可複製十六進位值。
- <!--i:font--> **Type** - Headings、Text、Emphasis 與 Code，各以自己的字型排版。
- <!--i:photos--> **Logos** - 每個標誌檔案放在它設計時所對應的底色上。
- <!--i:layers--> **Colourways** - 在系統有多種配色方案時，每種配色方案的淺色與深色成對呈現。
- <!--i:sliders--> **Tokens** - 圓角、間距、效果與漸層。
- <!--i:document--> **Print & CMYK** - 鎖定為確切油墨的色彩，以及 CMYK PDF 可以宣告的印刷條件。

切換是這個分頁唯一做的更動。你在 `#/start` 的 [Design System Setup](/info/brand-studio.html) 編輯設計系統，封面上有連結。唯讀的系統會在封面上說明；你建立的本機系統則保持可編輯。`/b` 與 `/brand` 是直達這個分頁的短連結。

## Capabilities

平台的每個部分都寫成一張卡片，分成十二個群組：Experiences、Platforms & runtimes、Accessibility & languages、Export formats、Import formats、Print production、Automation & AI、Determinism & reproducibility、Brand & design system、Privacy & data ownership、Security & access control 與 Architecture (for builders)。每個群組可摺疊並顯示其卡片數量。卡片會展開成對話框，列出該能力的功能，其中約有一半附有本文件所用的螢幕截圖。

群組上方的搜尋欄位會隨你輸入篩選卡片，並開啟仍有相符項目的群組。它會說明正在搜尋多少項能力，而沒有相符項目的查詢會用文字說明。

這個分頁是對 Lolly 能做什麼的書面文件，與這些指南保持同步。它不會探測你所使用的機器；那是 **This device** 的工作。

## Activity & stats

先看建置版本：載入了多少工具、有多少匯出格式、平台在多少個介面上執行，以及目錄帶有多少品牌素材，並有一個 **Catalogue** 面板分項列出這個建置版本附帶的內容。

然後是你自己這一側：**Your activity** 計算你在這部裝置上做了什麼，**Recent creations** 與 **Latest exports** 是你可以滑動瀏覽的堆疊，每個在有東西可顯示時才會出現。兩者都會開啟項目原本的樣子。這些計數器留在裝置上；選用的 Lolly Work 實例則保存自己的[組織遙測與稽核記錄](/info/privacy.html#organisation-services-with-lolly-work)。

## 深層連結

Settings 的每個分頁和區段都有自己的連結，你可以加入書籤或貼上。[搜尋](/info/search.html)將其 **Settings** 結果指向 Settings 渲染時所用的同一個登記簿，所以區段不可能在搜尋結果底下被改名。

::: details 每一種連結形式

- **分頁：**`#/settings?tab=brand`、`#/settings?tab=caps`、`#/settings?tab=device`、`#/settings?tab=activity`。
- **Preferences 區段：**`#/settings?focus=<section-id>`，例如 `#/settings?focus=offline-section`。
- **精確的區段：**以其 id 作為單純旗標，例如 `#/settings?dash-storage`、`#/settings?dash-logos`、`#/settings?dash-colourways` 或 `#/settings?cap-formats`。較舊的 `#/settings?dash-lock` 與 `#/settings?dash-palette-wheel` 連結會開啟封面與 Colour 頁面。
- **以關鍵字指定區段：**`#/settings?print`、`#/settings?formats`、`#/settings?palette`（Colour 頁面）或 `#/settings?tokens`。關鍵字可以共用：`print` 同時屬於設計系統分頁的列印參考與 Print production 群組，頁面順序中的第一個獲勝。在乎是哪一個時，請使用 id。

深層連結會切換到擁有目標的分頁、開啟它所在的任何摺疊群組，然後捲動到那裡，並在其上方區段完成排版時稍作停頓。已停用的 `#/platform` 與 `#/capabilities` 位址會併入 Settings，其深層連結旗標保持完整。
:::

---

**相關：**[個人資料](/info/profile.html)，了解你的詳細資料與你創作時的情境。[Design System Setup](/info/brand-studio.html)，編輯 Design system 分頁所顯示的內容。[尋找並復原你的作品](/info/find-your-work.html)，了解儲存空間、備份與搬移裝置。
