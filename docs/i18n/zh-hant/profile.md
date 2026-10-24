# 個人資料

一次設定你的姓名、聯絡資料與大頭照，每個設計為使用它們的工具都會替你填入：電子郵件簽名檔、名牌、講者卡。這份小小的記錄就是你的**個人資料**，它存在你的裝置上。

你的個人資料也保存你在工作時累積的內容：已儲存的工作階段、上傳的圖片與你本機的活動統計。你在 **Settings → Preferences** 下管理它；工具只會讀取它們設計為預先填入的欄位。單機使用不需要帳號，而選用的同步、分享與組織服務各有自己的資料流，說明如下。

## 個人資料裡有什麼

| 部分 | 是什麼 |
|---|---|
| **Name** | 名與姓。 |
| **Contact** | 電子郵件與電話。 |
| **Location** | 城市與國家。 |
| **Headshot** | 選用的照片，裁切成正方形並保存為本機圖片，供電子郵件簽名檔、引言卡與組織圖等工具使用。 |
| **Use my details to create** | 一個選擇加入的開關（開啟後顯示為 **Using my details**）。它決定你的詳細資料是否作為作者署名隨匯出的檔案與 Batch 執行一起傳遞。它不影響預先填入；請見[工具如何使用你的個人資料](#how-tools-use-your-profile)。 |
| **Preferences** | 你的主題、你的無障礙設定，以及你在 **Feature flags** 中開啟了應用程式的哪些部分。 |
| **Your work** | 附有縮圖的已儲存工作階段（整理在 [Projects](/info/find-your-work.html) 中）、你上傳的圖片，以及你本機的活動統計。 |

其中沒有任何一項是必填的。空白的個人資料也能運作；只填入能讓你少打字的部分就好。

![Settings 的 Preferences 分頁：設定列，以及 Your details，含 Use my details to create 開關與姓名、聯絡、位置欄位](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) 對應 Preferences 之下的其他一切，從外觀與表情符號到儲存空間與離線下載。

## 你、團隊或角色

「個人資料」一詞暗示一個固定的人。在 Lolly 中，它更接近創作的情境：你在製作這件東西時的身分。它可以有三種形式，而 Lolly 以相同的方式處理每一種。

::: cols
## 以你自己

預設值。你的姓名、你的電子郵件、你的大頭照。設定一次，你的簽名檔、名牌與會議標誌組合就會自動填入。

## 以團隊

團隊共用的名稱、`events@…` 這類群組信箱、部門，以及團隊的標誌。一個人設定並匯出，其他人載入同一份個人資料，團隊的檔案就帶有一致的詳細資料。共用的資訊亭或示範用筆電可以執行一份團隊個人資料。

## 以角色

一年有三天擔任活動經理的人，希望在名牌與看板上使用活動信箱與活動子品牌，然後再換回平常的身分。把那個角色保存為一份個人資料檔案，活動期間載入，之後收起來。
:::

![大頭照控制項，在你上傳照片之前是空的，上傳後照片會留在這台裝置上](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details 使用 Lolly Work 的組織中的個人資料
當你登入[組織的 Lolly](/info/organisation.html) 時，Lolly Work 可以從其身分提供者提供已驗證的個人資料欄位，並依組織政策固定欄位或偏好設定。受管理的欄位在應用程式中有標示。

該登入也控制對共用專案與素材的存取。團隊個人資料檔案仍是本機檔案：它不授予組織成員資格，也不取代工作帳號。**Use my details to create** 控制的是你匯出內容中的署名，而不是組織的登入或稽核記錄。請見[隱私](/info/privacy.html#organisation-services-with-lolly-work)。
:::

## 保留多份，使用一份

一個安裝一次只有一份使用中的個人資料，應用程式內也沒有切換器。取而代之的是，每份個人資料都是一個可攜的檔案，就是你用來移到新裝置的同一個備份檔案。要進入另一個情境：

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device** 下的 **Export my data** 會將目前的個人資料儲存為一個 `.zip`。
- <!--i:trash--> **Clear all my data** 會清空這個安裝。
- <!--i:upload--> **Import data…** 載入你要進入的情境的個人資料檔案。
:::

不先清除就匯入，會改為**合併**。匯入的工作階段與圖片會被加入；兩份副本都存在時，保留較近期儲存的那一份。資料夾、最愛與範本會加在你的旁邊，而你自己的詳細資料會保留，空白欄位除外，它們會採用檔案中的值。這適合把某個團隊的工作階段拉進你自己的設置，但不適合在角色之間做乾淨的切割。

若要同時處於兩個情境，請使用獨立的瀏覽器設定檔、獨立的使用者帳號，或第二份已安裝的網頁應用程式副本：每一個都帶有自己獨立的 Lolly 個人資料。

![搬移整個安裝的兩個按鈕：Export my data 寫出一個 zip，Import data 讀回它](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> 每個情境保留一個檔案，並依其用途命名，例如 `LollyTools-events-2026.zip` 與 `LollyTools-me.zip`。檔案就是個人資料。

[將你的作品移到另一部裝置](/info/find-your-work.html#move-your-work-to-another-device)涵蓋檔案裝了什麼、什麼會留下，以及其他移動方式，包括同步。

## 工具如何使用你的個人資料

**預先填入。** 工具作者將輸入標記為取自你的個人資料（`bindToProfile: "firstname"`、`"email"`、`"headshot"` 等）。工具開啟時，該輸入會由你的個人資料填入，你可以在單一工作階段中覆寫它而不更動個人資料，除非組織政策鎖定了該輸入。預先填入是本機的便利功能，無論 **Use my details** 是否開啟都會發生。

**署名。** 匯出時，你的詳細資料可以作為作者署名放在檔案的中繼資料中（PNG、PDF、SVG 等），讓完成的檔案能說明是誰做的。**Use my details to create** 管轄這一點，也管轄 Batch 執行的作者。關閉時，匯出仍會說明它是用 Lolly 製作的，但不帶個人的作者或聯絡行。

工具作者：請見 [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) 與 [`host.profile`](/info/host-api.html#host-profile)。

![單一的 Use my details to create 開關，標示為選擇加入，在你開啟之前保持關閉](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## 個人資料、設計系統與能力

Settings 中有三樣東西彼此靠近，容易混淆：

- <!--i:people--> **Profile** - 你、你的團隊或你所處的角色：姓名、聯絡資料、大頭照與已儲存的作品。屬於個人，保存在裝置上，並可作為檔案攜帶。
- <!--i:palette--> **Design system** - 品牌：每個工具渲染時使用的色彩、字型與設定。共用且一致，而非個人的；請見 [Design System Setup](/info/brand-studio.html)。
- <!--i:sliders--> **Capabilities** - 應用程式能做什麼：提供給你的功能與工具。

個人資料改變檔案來自誰；設計系統改變檔案的外觀；能力則是你能製作什麼。

這個詞在 Lolly 中還有另外三種意思。**內容設定檔**是一項建置設定，選擇部署附帶哪些工具與目錄；[詞彙表](/info/glossary.html)定義了這個詞。`profile` 連結參數為匯出選擇色彩描述檔，例如 CMYK 印刷條件；請見[保留的 URL 參數](/info/url-parameters.html#print)。**已驗證身分**是選用的簽署憑證，將你的電子郵件與你簽署的匯出連結起來，與這些詳細資料是分開的，不過 **Use my details to create** 決定兩者是否嵌入；請見 [Content Credentials](/info/content-credentials-identity.html)。

![已驗證身分卡片,手機寬度版面:憑證有效期選擇器與下方的註冊步驟 - 身分設定檔,與你的個人資料分開](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## 隱私

你的個人資料儲存在本機。你的詳細資料可以隨備份或同步副本、隨你分享或匯出的內容，以及在選用的 Content Credentials 註冊期間傳遞。在 Lolly Work 實例上，登入、共用工作、遙測政策與稽核記錄與這份本機個人資料是分開的。**Settings → Preferences → Clear all my data** 會清除這部裝置；它不會清除你的儲存空間提供者或組織所保存的副本。請見[隱私政策](/info/privacy.html)。
