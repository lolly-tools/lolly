# 設定

Settings 包含你的個人資料、設計系統、無障礙功能、此裝置上的儲存空間與離線下載。從首頁底部的列或頭像選單開啟 **Settings**，就會進入 **Preferences**。

| 分頁 | 位址 | 內容 |
|---|---|---|
| **Preferences** | `#/settings` | 你的個人資料、設計系統、外觀、emoji、無障礙功能、連線、儲存空間與離線下載 |
| **This device** | `#/settings?tab=device` | 此瀏覽器與電腦的即時資訊，以及音效與唯讀的儲存空間檢視 |
| **Design system** | `#/settings?tab=brand` | 以封面與頁面呈現目前使用的設計系統，並有一列封面可切換系統 |
| **Capabilities** | `#/settings?tab=caps` | 以可搜尋的卡片列出 Lolly 能做的一切 |
| **Activity & stats** | `#/settings?tab=activity` | 目錄、你的本機計數與最近的作品 |

舊的 `#/profile` 與 `#/d` 連結仍會開啟正確位置，甚至能直接到個別設定。

<!--i:eti-sliders-->
## 偏好設定

Preferences 是一個長頁面，側邊有一條**設定側欄**。側欄上方的 **Search settings** 欄位會隨你輸入篩選側欄。每個區段都有 `#/settings?focus=<section-id>` 形式的連結，例如 `#/settings?focus=storage-section`。

- <!--i:usercheck--> **Your details** - 你的姓名、聯絡資料與頭像，以及 **Use my details to create** 開關。[個人資料](/info/profile.html)說明工具如何使用它們。
- <!--i:seal--> **Content Credentials** - 選用的已驗證身分，用來簽署匯出檔案。請見 [Content Credentials](/info/content-credentials-identity.html)。
- <!--i:palette--> **Design systems** - 切換、新增、隱藏或移除設計系統。[Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) 說明各項操作。
- <!--i:moon--> **Appearance** - 主題（Light、Dark 或以你的色盤為應用程式上色的 Brand）、設計系統提供多種配色方案時的 **Your colourway**（[使用自己的配色方案](/info/colourways.html#make-a-colourway-your-own)），以及 **Interface follows the design system**。
- <!--i:sparkle--> **Emoji** - 新作品使用的 emoji 圖集及其圖稿授權，以及用你的色盤為 emoji 重新上色的強度（**Off**、**Subtle**、**Strong**、**Full**、**Mono** 或 **Duotone**）。**Keep skin tones and flags** 會保留膚色與旗幟原本的色彩。已製作的作品保留原本的圖集。
- <!--i:eyeoff--> **Accessibility** - 四個提升舒適度的開關，以及 Sound 與 Neurospicy Mode。請見[無障礙功能](#accessibility)。
- <!--i:link--> **Connected services** - 你連接的儲存服務，例如 Dropbox、Google Drive、OneDrive、Nextcloud 或 S3，以及 **Sync across devices**。請見[同步你的裝置](/info/sync.html)。
- <!--i:globe--> **Trusted sites** - Lolly Design 網頁方塊或 Lolly Sandbox 示範可不經詢問就連線的網站，以及伺服器提供時的 **Allow pages from any site**。[隱私權政策](/info/privacy.html)列出每個請求會傳送什麼。
- <!--i:download--> **Your renders** - **Save my renders to my library** 將你下載的每張圖片、每段音訊與影片保留一份副本，放在 Assets 中的 Renders 標籤下。
- <!--i:database--> **Storage** - Lolly 保存在此裝置上的內容，以及清除或攜帶資料的按鈕。請見[儲存空間](#storage)。
- <!--i:cpu--> **Available offline** - 在失去連線前下載需要的內容。請見[離線可用](#available-offline)。
- <!--i:folder--> **Hot folder** - 在桌面應用程式中，Lolly 監看一個資料夾，並透過與拖放相同的選擇器匯入放進去的任何內容。
- <!--i:clock--> **Your activity** - 你在此裝置上製作的內容，在本機計數。
- <!--i:sliders--> **Feature flags** - 開啟或關閉應用程式的部分功能，例如 **Print preflight** 或 **Strip metadata from uploads**。**Performance UI** 為應用程式提供較簡單、繪製負擔較低的外觀。Lolly 可以在較慢的裝置上自行開啟 Performance UI。此時開關下方會說明何時開啟及原因，並提供 **Allow again**（[判斷方式](/info/configuration.html#curating-what-people-see)）。
- <!--i:server--> **Lolly instance** - 這個安裝實例取得工具與目錄的來源。請見 [Lolly 實例](#lolly-instance)。

主題卡片是即時預覽。選取主題後會立即套用，僅限此裝置。

![三張主題卡片，各自預覽其字體與色彩，並標示目前使用的主題](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### 無障礙功能

**Settings → Preferences → Accessibility** 包含四項讓應用程式使用起來更舒適的設定。每項都在你開啟前保持關閉，而且都不會影響工具畫布或匯出，因此更平靜的應用程式不會動到你交付檔案中的任何像素。每項預設都是關閉的。它們都不會更改工具畫布或匯出。

- <!--i:pause--> **Reduce motion** 關閉應用程式的轉場、滑動與裝飾動畫。
- <!--i:photos--> **Hide colourful previews** 將工具庫的預覽圖稿換成圖示與文字卡片，並淡化專案縮圖，但仍能辨識。
- <!--i:sliders--> **High contrast** 加強應用程式的邊框、文字與焦點框。品牌色彩與畫布保持你的設定。
- <!--i:font--> **Large text** 放大應用程式的標籤、選單與按鈕文字。

**Dominant hand**（Right 或 Left）設定 Lolly 在摺疊裝置或接近正方形的平板電腦上顯示兩個窗格時，控制項位於哪一側。窗格標題列中的 **Swap sides** 也能更改這項設定。

這些設定保存在你的個人資料中，因此匯出個人資料時，會連同姓名與工作階段一起帶上。僅限此裝置的副本會在首次繪製畫面前套用設定。

同一張卡片有 **Sound**，為進入工具庫、取得 Content Credentials 結果或關閉面板等動作提供柔和的輔助音效。也有 **Neurospicy Mode**，提供平靜的專注音樂。開啟 Neurospicy 後，角落會出現小型播放器，在應用程式各處都會跟著你。在播放器中，你可以選擇曲目、跳過、設定音量，以及最小化或關閉播放器。曲目包含 Lolly 的生成電台、循環環境音與節拍、你自己的音訊，以及需要連線的網路廣播電台。兩者預設皆關閉，並會記住設定。關閉 Sound 也會將專注音樂靜音。個人資料選單與 **This device** 中都有相同的開關。

Sound 開關下的滑桿設定聲音的質地。往圓潤的 **Bouba** 團塊移動，聲音會變成柔和的水滴、氣泡與少量低音。往尖銳的 **Kiki** 星形移動，則變成乾脆的滴答聲、刮擦聲與金屬聲。中間保留 Lolly 的鈴聲與音符。如果其中一端的聲音讓你難以忍受，就往另一端移動。Sound 關閉時滑桿仍可使用，放開滑桿會播放一小段範例。

::: details 生成電台
生成電台在播放時譜寫音樂，不使用取樣或錄製的人聲。每首曲子都有自己的樂器、律動與播放順序。

- **Lolly Sings** 是一系列電台。原版 Lolly Sings 明亮且富有旋律：大調、每首曲子都有主奏，以及 bossa、shuffle 與 chiptune 的風格。每種曲風也有自己的電台，從 Sugar、K-pop 到 Country、Jazz、Metal 與 D&B。
- **Lofi stations**（Warm、Late night 與 Rainy）提供無盡的 lo-fi 節拍。

在生成電台中，下一首與上一首會在曲子之間切換。每首曲子都來自一個種子，因此無論在哪裡分享或儲存，播放的曲子都相同（請見[生成音樂](/info/generated-music.html)）。播放控制項下方的 **Mood** 可在 Lofi 電台之間切換，**Drums** 可移除鼓組，**Texture** 則從清晰音質調整到帶有老唱片的沙沙聲。接著是一列圖示按鈕。將指標停在按鈕上或長按，即可查看名稱：

- 音符 **Open in the music generator** 在 `#/music` 開啟曲子，你可以逐段更改樂器。
- 連結 **Share this tune or moment** 提供播放同一首曲子的連結，或也會從目前位置開始、並以目前預設與色彩顯示視覺化效果的連結。
- 資料夾 **Save to library** 將曲子保存在你的素材中。
- 閃電 **Light visualiser** 是開關，下文有說明。

已儲存的曲子會列在其電台群組下，按調性與速度標示。選擇已儲存的曲子，就會再次播放同一首曲子，像其他曲目一樣重複播放，或在向前播放模式中接著播放下一首。它只儲存電台與曲目編號，僅幾個位元組，播放時會重新譜寫音樂。你可以在素材中重新命名或刪除已儲存的曲子，並將它用作影片的背景音樂。Lolly Demo 與 Lolly Start 各附有六首已儲存的曲子。

視覺化效果以穩定的電平接收每首曲目，因此無論音量如何，安靜與大聲的曲目都會讓畫面產生相同程度的變化。每種 Lolly Sings 曲風，以及從中儲存的曲子，都提供 **Light visualiser**：簡單的電平條，將所需的處理時間留給音樂。在觸控螢幕，以及核心數為四個以下或記憶體為 4 GB 以下的裝置上，Light visualiser 預設開啟。
:::

你可以用鍵盤操作介面。自訂控制項帶有供螢幕閱讀器使用的標籤。每個工具的即時預覽都是一張帶有標籤的圖片，描述畫面顯示的內容。

### 儲存空間

儲存空間計量表按類別顯示此安裝實例保存的每個位元組，並與瀏覽器回報的數值對照。

![儲存空間計量表，分列已儲存的工作階段、圖片與快取，並與瀏覽器實際回報的數值對照](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

計量表下方：

- **Move to another device** 包含 **Export my data**、**Import data…** 與 **Export my data & render everything**。[將作品移到另一部裝置](/info/find-your-work.html#move-your-work-to-another-device)逐一說明。
- **Clear cache** 刪除已下載的目錄檔案，需要時會再次下載。
- **Remove automatic checkpoints older than 30 days** 釋放 History 空間，並保留已儲存與已命名的版本。
- **Clear all my data** 在你輸入一個詞確認後，移除 Lolly 保存在此瀏覽器中的所有內容。[如果你清除瀏覽器資料](/info/find-your-work.html#if-you-clear-your-browser-data)列出會移除的內容。

### 離線可用

Lolly 只快取你造訪過的畫面。**Available offline** 以單一進度列下載你需要的部分，讓它們在沒有連線時也能繼續運作。

- <!--i:monitor--> **App, catalogue and guides** - **The app**（每個檢視、編輯器與字型，包括你從未開啟的畫面）、**Catalogue**（全部，或 **Choose by tag**）以及 **Guides & docs**（以你的語言顯示的這份文件，包含螢幕截圖）。
- <!--i:cpu--> **AI models** - 每個裝置端模型各佔一列，並顯示大小：語音聲音、放大模型、背景移除、文字辨識、Lolly Verify 深度掃描、持久憑證、改寫模型、Ask 比對模型、AI 文字偵測器與歌唱聲音。超過 50 MB 的模型會標示 **large download**。
- <!--i:wrench--> **Tools** - 每個工具可分別下載，或使用 **Download all** 下載所有工具。勾號代表已可離線使用。

**Download everything** 位於頂端，會下載應用程式、你選擇的目錄範圍、指南與所有工具。勾選 **Include all the AI models** 可加入模型，或從模型各自的列下載。歌唱聲音只能從各自的列下載。組織的政策可以關閉 AI 下載，這些列也會顯示此狀態。

如果你取消下載或連線中斷，下載會從停止的位置接續。重新連線後，它們會更新，並只擷取新版本變更的內容。如果瀏覽器尚未授予持續性儲存空間，**Protect downloads** 會要求該權限。沒有此權限時，瀏覽器可能會在需要騰出空間時刪除下載的內容。

### Lolly 實例

**Lolly instance** 說明此安裝從哪裡取得工具與目錄：顯示實例的位址，或在所有內容都隨建置版本提供時顯示 *Bundled with this app*。

- **Design-system source** 顯示隨附設計系統的來源。
- **Instance console** 會開啟部署環境提供的管理頁面（若有提供）。
- **Change** 讓桌面應用程式指向另一個實例。瀏覽器無法跨來源載入工具與素材，因此網頁版的此區段改為提供 **Open a workspace**。
- **Leave** 會移除實例的設計系統、工具與目錄。你自己的作品會保留。請見[在你的組織使用 Lolly](/info/organisation.html#leaving)。
- 登入組織後，**Sign out** 會結束此工作階段，**Sign out everywhere** 則會結束你在所有裝置上的工作階段，包括這部裝置。

<!--i:eti-monitor-->
## 這部裝置

- <!--i:monitor--> **This Machine** - 從此工作階段即時讀取螢幕、輸入、圖形、記憶體、編解碼器、儲存後端等資訊。不會儲存或傳送任何內容。在寬螢幕上，此面板會自行展開，分頁採用兩欄配置。
- <!--i:neurobeat--> **Sound** - 介面音效與 Neurospicy 專注循環音軌。Sound 是此分頁中唯一會寫入內容的開關。
- <!--i:database--> **Storage** - 儲存空間計量表的唯讀檢視。在[偏好設定](#storage)中清除或攜出你的資料。

<!--i:eti-palette-->
## 設計系統

呈現目前啟用的設計系統，供你查看。當此瀏覽器存有兩個以上的設計系統時，頂端會以一排封面列出它們。選擇其中一個即可啟用。隨後出現的通知中的 **Undo** 會還原先前的設計系統。

![Lolly Demo 的 Design system 分頁：先是一排用來切換系統的封面，再來是封面本身，包含標誌、名稱、備註與可開啟各頁面的數量](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

分頁開啟時會顯示以系統本身色彩繪製的封面，附有標誌、以其展示字型呈現的名稱，以及作者寫的備註。封面上的一列數量可連到各個頁面：

- <!--i:palette--> **Colour** - 淺色與深色外觀的表面、文字、主要與次要色彩；每個命名色彩以色塊呈現，附上名稱與十六進位值；每組淡色階與圖表色譜各佔一條色帶；色彩角色則放在可摺疊區塊中。選取數值即可複製十六進位值。
- <!--i:font--> **Type** - Headings、Text、Emphasis 與 Code，各自使用對應的字型呈現。
- <!--i:photos--> **Logos** - 每個標誌檔案都放在原先設計搭配的底色上。
- <!--i:layers--> **Colourways** - 當系統有多個配色方案時，顯示每個配色方案的淺色與深色配對。
- <!--i:sliders--> **Tokens** - 半徑、間距、效果與漸層。
- <!--i:document--> **Print & CMYK** - 鎖定為精確油墨的色彩，以及 CMYK PDF 可宣告的印刷條件。

切換是此分頁唯一會做的變更。若要編輯設計系統，請前往 `#/start` 的 [Lolly Design System Setup](/info/brand-studio.html)，封面也有連結。唯讀系統會在封面上註明。你建立的本機系統仍可編輯。`/b` 與 `/brand` 是此分頁的短連結。

<!--i:eti-grid-->
## 功能

平台的每個部分都有一張卡片，分成十二組：使用體驗、平台與執行環境、無障礙與語言、匯出格式、匯入格式、印刷製作、自動化與 AI、確定性與可重現性、品牌與設計系統、隱私與資料所有權、安全性與存取控制，以及架構（供建置者參考）。每組皆可摺疊，並顯示卡片數量。卡片會開啟對話框，列出該功能的特點，其中約半數卡片也會顯示這份文件使用的螢幕截圖。

群組上方的搜尋欄位會在你輸入時篩選卡片，並展開含有相符項目的群組。欄位會顯示搜尋涵蓋多少項功能。沒有相符結果時，會以文字明確說明。

此分頁記錄 Lolly 能做的事，與這些指南保持同步。它不會偵測你正在使用的裝置；這由 **This device** 負責。

<!--i:eti-gauge-->
## 活動與統計

首先是建置版本：已載入的工具數量、匯出格式、平台可執行的環境，以及目錄中的品牌素材。**Catalogue** 面板會逐項列出此建置版本隨附的內容。

接著是你自己的作品：**Your activity** 統計你在這部裝置上製作的內容。**Recent creations** 與 **Latest exports** 是可滑動瀏覽的堆疊，有內容後才會顯示。兩者都會以項目當時的狀態開啟。這些計數留在裝置上。選用的 Lolly Work 實例會保留自己的[組織遙測與稽核記錄](/info/privacy.html#organisation-services-with-lolly-work)。

<!--i:eti-link-->
## 深層連結

Settings 的每個分頁與區段都有自己的連結，可加入書籤或貼上。[Lolly Search](/info/search.html) 使用與 Settings 相同的登錄資料建立 **Settings** 結果，因此區段重新命名絕不會讓搜尋結果失效。

::: details 各種連結形式

- **分頁：** `#/settings?tab=brand`、`#/settings?tab=caps`、`#/settings?tab=device`、`#/settings?tab=activity`。
- **Preferences 區段：** `#/settings?focus=<section-id>`，例如 `#/settings?focus=offline-section`。
- **精確指定區段：** 將其 id 作為獨立旗標，例如 `#/settings?dash-storage`、`#/settings?dash-logos`、`#/settings?dash-colourways` 或 `#/settings?cap-formats`。舊版的 `#/settings?dash-lock` 與 `#/settings?dash-palette-wheel` 連結會開啟封面與 Colour 頁面。
- **以關鍵字指定區段：** `#/settings?print`、`#/settings?formats`、`#/settings?palette`（Colour 頁面）或 `#/settings?tokens`。兩個區段可以共用一個關鍵字：`print` 同時屬於品牌分頁的印刷參考資料與印刷製作群組，會以頁面順序中的第一個為準。使用 id 可指定其中一個。

深層連結會切換到包含目標的分頁，並展開目標所在的任何摺疊群組。接著，等上方區段完成版面配置後，就會捲動到目標。已停用的 `#/platform` 與 `#/capabilities` 位址會在 Settings 中開啟，保留原本的深層連結旗標。
:::

---

**相關內容：** [個人資料](/info/profile.html)介紹你的詳細資料與創作情境。[Lolly Design System Setup](/info/brand-studio.html)用來編輯 Design system 分頁顯示的內容。[尋找並復原你的作品](/info/find-your-work.html)介紹儲存、備份與更換裝置。
