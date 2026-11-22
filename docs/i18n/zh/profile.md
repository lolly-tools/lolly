# 個人資料

只要設定一次姓名、聯絡資料與頭像，每個支援這些資料的工具就會自動填入，例如電子郵件簽名檔、名牌或講者卡片。這份記錄就是你的**個人資料**，保存在你的裝置上。

你的個人資料也包含已儲存的工作階段、上傳的圖片與本機活動計數。在 **Settings → Preferences** 中管理。工具只會讀取預設要用來預填的欄位。獨立使用不需要帳號。選用的同步、分享與組織服務各有自己的資料流向。

<!--i:eti-user-check-->
## 個人資料包含什麼

| 部分 | 內容 |
|---|---|
| **Name** | 名字與姓氏。 |
| **Contact** | 電子郵件與電話。 |
| **Location** | 城市與國家。 |
| **Headshot** | 選用照片，裁切為正方形並保留為本機圖片，供電子郵件簽名檔、引言卡片與組織圖等工具使用。 |
| **Use my details to create** | 需自行開啟的開關，開啟後顯示 **Using my details**。它決定你的資料是否作為作者署名，隨匯出檔案與 Lolly Batch 執行結果一起傳遞；請見[工具如何使用你的個人資料](#how-tools-use-your-profile)。 |
| **Preferences** | 你的主題、在每個設計系統中的配色方案、無障礙設定，以及在 **Feature flags** 中開啟的應用程式功能。 |
| **Your work** | 附有縮圖、整理在 [Lolly Projects](/info/find-your-work.html) 中的已儲存工作階段、你上傳的圖片與本機活動統計。 |

這些都不是必填，空白的個人資料也能使用。

![Settings 的 Preferences 分頁：設定側欄，以及 Your details 中的 Use my details to create 開關與姓名、聯絡及位置欄位](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly 設定](/info/dashboard.html)說明 Preferences 的其餘內容，從外觀與 emoji 到儲存空間與離線下載。

<!--i:eti-users-->
## 你、團隊或角色

在 Lolly 中，個人資料代表你製作內容時的身分：你自己、團隊或某個角色。Lolly 對這三者的處理方式相同。

::: cols
## 以自己的身分

預設情況：你的姓名、電子郵件與頭像。簽名檔、名牌與會議組合標誌會從中填入資料。

## 以團隊的身分

團隊共用的名稱、例如 `events@…` 的群組信箱、部門與團隊標誌。由一個人設定個人資料並匯出檔案。其他人載入同一份個人資料，團隊的檔案就會帶有相同資料。共用的服務機台或展示用筆記型電腦可以使用一份團隊個人資料。

## 以角色的身分

活動經理一年中有三天需要在名牌與標示上放入活動信箱與子品牌，之後再恢復平常的身分。將該角色儲存為個人資料檔案，活動時載入，結束後收起來。
:::

![頭像控制項在你上傳照片前保持空白，上傳後照片會留在這部裝置上](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details 使用 Lolly Work 的組織中的個人資料
登入[組織的 Lolly](/info/organisation.html) 時，Lolly Work 可以從其身分提供者取得已驗證的個人資料欄位，並依組織政策固定欄位或偏好設定。受管理的欄位會在應用程式中標示。

該登入也控制共用專案與素材的存取。團隊個人資料檔案是本機檔案。它不會授予組織成員資格，也不會取代工作帳號。**Use my details to create** 控制匯出中的署名，不影響組織的登入或稽核記錄。請見[隱私](/info/privacy.html#organisation-services-with-lolly-work)。
:::

<!--i:eti-copy-->
## 保留多份，一次使用一份

一個安裝實例一次只能啟用一份個人資料，應用程式內沒有切換器。每份個人資料都是可攜式檔案，也就是將作品移到新裝置時使用的備份檔案。切換使用情境的方法：

::: timeline
- <!--i:download--> **Settings → Storage → Move to another device** 下的 **Export my data** 會將目前的個人資料儲存為一個 `.zip`。
- <!--i:trash--> **Clear all my data** 清空這個安裝實例。
- <!--i:upload--> **Import data…** 載入接下來要使用的情境所對應的個人資料檔案。
:::

::: note 未先清除就匯入會合併資料
匯入的工作階段與圖片會加入現有資料。如果兩邊都有副本，會保留較近期儲存的版本。資料夾、我的最愛與範本會加入，與你的並存。你自己的資料會保留，只有空白欄位會採用檔案中的值。合併適合將團隊的工作階段納入你的環境，但不適合在角色之間完全分開。
:::

若要同時使用兩種情境，請使用獨立的瀏覽器設定檔、使用者帳號或另外安裝的網頁應用程式副本。每個都有自己的 Lolly 個人資料。

![移轉整個安裝實例的兩個按鈕：Export my data 寫出一個 zip，Import data 將它讀回](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note 每種情境保留一個檔案
依用途命名每個檔案，例如 `LollyTools-events-2026.zip` 與 `LollyTools-me.zip`。檔案就是個人資料。
:::

[將作品移到另一部裝置](/info/find-your-work.html#move-your-work-to-another-device)說明檔案包含什麼、哪些內容會留下，以及同步等其他移轉方式。

<!--i:eti-pen-->
## 工具如何使用你的個人資料

**預填。** 工具作者將輸入標記為取自你的個人資料（`bindToProfile: "firstname"`、`"email"`、`"headshot"` 等）。工具開啟時，該輸入會從你的個人資料填入。除非組織政策鎖定輸入，否則你可以只在某個工作階段覆寫該值，而不更改個人資料。預填在本機進行，無論 **Use my details** 是否開啟都會執行。

**署名。** 匯出時，你的資料可以作為作者署名，隨檔案的中繼資料一起傳遞（PNG、PDF、SVG 等）。**Use my details to create** 控制這項署名，以及 Lolly Batch 執行結果上的作者。開關關閉時，匯出仍會註明以 Lolly 製作，但不會帶有個人作者或聯絡資料。

工具作者：請見 [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) 與 [`host.profile`](/info/host-api.html#host-profile)。

![單一的 Use my details to create 開關，標示為自行選擇啟用，並在你開啟前保持關閉](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## 個人資料、設計系統與功能

Settings 中有三項彼此相鄰、容易混淆的內容：

- <!--i:people--> **Profile** - 你、你的團隊或你擔任的角色：姓名、聯絡資料、頭像與已儲存的作品。屬於個人，保存在裝置上，可作為檔案攜帶。
- <!--i:palette--> **Design system** - 品牌：每個工具渲染時使用的色彩、字型與設定。共用而非個人所有；請見 [Lolly Design System Setup](/info/brand-studio.html)。
- <!--i:sliders--> **Capabilities** - 應用程式能做的事：你可以使用的功能與工具。

profile 這個詞在 Lolly 中還有三種意思。**內容設定檔**是一項建置設定，決定部署時包含哪些工具與目錄；[詞彙表](/info/glossary.html)定義了這個詞。連結參數 `profile` 為匯出選擇色彩描述檔，例如 CMYK 印刷條件；請見[保留的 URL 參數](/info/url-parameters.html#print)。**已驗證身分**是選用的簽署憑證，將你的電子郵件與已簽署的匯出檔案連結。它與這些資料分開，但 **Use my details to create** 決定兩者是否嵌入；請見 [Content Credentials](/info/content-credentials-identity.html)。

![手機寬度的 Verified identity 卡片：憑證有效期選擇器與下方的註冊步驟 - 身分設定檔，與個人資料分開](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## 隱私

你的個人資料儲存在本機。資料可能隨備份或同步副本、你分享或匯出的內容，以及選用的 Content Credentials 註冊過程傳遞。在 Lolly Work 實例中，登入、共用作品、遙測政策與稽核記錄都與這份本機個人資料分開。**Settings → Preferences → Clear all my data** 會清除此裝置；不會刪除儲存服務供應商或組織持有的副本。請見[隱私權政策](/info/privacy.html)。
