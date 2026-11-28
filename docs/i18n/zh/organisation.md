# 在組織中使用 Lolly

組織可以運行自己的 Lolly：相同的應用程式，搭配組織選擇的工具與設計系統。了解如何存取、登入，以及有哪些不同。

規劃組織設定時，[搭配現有的 DAM 使用 Lolly](/info/use-with-dam.html)說明如何保留既有的核准素材庫，同時讓大家在 Lolly 中製作內容。[內容主權](/info/content-sovereignty.html)則說明對創作、治理、儲存與可攜性的更廣泛控制。

::: note 你需要向組織取得的內容
組織的 Lolly 網址，或組織製作的 `.lolly` 設定檔。單獨使用 lolly.tools 不會連線到組織。
:::

<!--i:eti-globe-->
## 在瀏覽器中

開啟組織提供的網址。若頁面要求登入，按下 **Sign in**，並依開啟的登入頁面操作。之後 Lolly 就會照常運作，使用組織的工具與設計系統。

你也可以從 lolly.tools 開始：開啟 **Settings** 檢視，在 **Lolly instance** 卡片上按下 **Open a workspace**，輸入網址，再按下 **Open this instance**。瀏覽器會前往組織自己的網址，因為瀏覽器無法從 lolly.tools 載入另一個 Lolly 的工具。

![Settings 中的 Lolly instance 卡片，可在此開啟組織的工作區，或更改應用程式取得工具的位置](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## 在桌面或行動應用程式中

應用程式一開始使用隨附的工具。若要連線，請開啟 **Settings** 檢視，並在 **Lolly instance** 卡片上按下 **Change**。面板會詢問 **Where should Lolly get its tools?**

1. 選擇 **Connect to a Lolly instance**。
2. 輸入組織的網址，並按下 **Check & connect**。
3. 按下 **Use this instance**。下一個畫面 **Import your data (optional)** 可從 Lolly 備份帶入已儲存的作品。若沒有備份，按下 **Skip**。
4. 若應用程式要求，請登入。

已連接實例的工具會以與應用程式自帶工具相同的信任層級執行，因此只連接你信任的實例。組織也可能傳給你一個 `.lolly` 設定檔，替你完成應用程式的連線設定。

之後若要切換，再次使用 **Change**，或同一卡片上的 **Leave**。

### 使用代碼登入

在桌面與行動應用程式中，若組織的 Lolly 支援代碼登入，登入畫面也會提供一組短代碼。按下 **Open sign-in in browser**，在瀏覽器中登入並核准代碼。也可以在已登入的手機或電腦上開啟畫面顯示的網址，再輸入代碼。代碼的有效時間約為十分鐘。

<!--i:eti-sliders-->
## 有哪些不同

- **有些控制項已替你設定好。** 由組織管轄的控制項會顯示 **Managed by** 與組織名稱，或 **Managed by your organisation**。固定的控制項無法更改，選單也可能只提供部分選項。有些控制項會隱藏。組織的主控台會記錄是哪條規則固定了控制項，以及原因。請詢問負責運行組織 Lolly 的人。
- **有些設計系統會鎖定。** 組織提供的設計系統會顯示鎖頭，並維持唯讀。若要嘗試更改，請在 **Settings → Preferences → Design systems** 建立可編輯的副本。
- **只列出組織提供的工具。** 組織未提供的工具不會顯示。
- **共用專案。** 若組織與你共用專案，**Projects** 會顯示 **Team projects** 方塊。這些工作階段存放在組織的伺服器上。開啟其中一個即可編輯，或在有提供時，從 **Share** 開始[工作協作](/info/collaborate.html#collabs-through-lolly-work-optional)。
- **有些匯出可能需要核准。** 當組織要求核准時，**Request approval** 會取代 **Download**，工具提供的格式也可能較少。
- **首頁可能直接顯示範本。** 若組織向你發佈範本，例如提供給合作夥伴公司，首頁會顯示範本，取代初次造訪的歡迎訊息。每個範本是一張卡片，可用 **Your copy** 接續編輯，範本變更時則會顯示 **New version**。請見[合作夥伴範本](/info/work-partner-templates.html)。

### 哪些內容存在哪裡

::: cols
## 在這部裝置上

- 你自己儲存的作品，除非你開啟[同步](/info/sync.html)
- 你自行製作的設計系統
- 你製作並下載的任何內容

## 在組織的伺服器上

- 你的登入身分與裝置資訊
- 團隊專案、共用工作階段，以及工作協作中的即時編輯
- 你上傳到共用資料庫的素材
- 核准請求與經核准的交付
- 你的登入與操作記錄
:::

連接工作區後，應用程式首個畫面上的隱私說明也會表達同樣的內容。Lolly 自己的應用程式不會向工作區傳送使用事件。[隱私](/info/privacy.html#organisation-services-with-lolly-work)列出伺服器儲存的內容，以及誰控制這些資料。

<!--i:eti-building-->
## Lolly Work 增加了什麼

組織的伺服器運行 **Lolly Work**，這是同一個開源專案的組織軟體。個人使用應用程式時，不需要工作帳號，也不需要 Lolly Work。

::: details Lolly Work 可增加的功能
組織在 Lolly 旁託管 [Lolly Work](https://github.com/lolly-tools/lolly-work)，並選擇要開啟哪些功能：

- **登入與存取。** 組織單一登入、依群組設定的權限，以及受管理的個人資料欄位。管理員可透過 SCIM 佈建與停用帳號。
- **共用工作。** 團隊專案、共用工作階段與[工作協作](/info/collaborate.html#collabs-through-lolly-work-optional)，透過組織的伺服器即時編輯。
- **共用素材庫。** 上傳的素材、集合與已連接的資料庫，附有存取規則、版本與審閱功能。
- **審閱與交付。** 核准步驟、可到期或撤銷的受管理連結，以及交付至組織允許的目的地。
- **管理。** 受管轄操作的稽核記錄，以及依實例的遙測政策，針對傳送使用事件的用戶端提供使用報告。Lolly 自己的應用程式目前不傳送任何使用事件。
:::

若要設定服務，請從[部署](/info/deployment.html#organisation-services-with-lolly-work)開始。[lolly.work](https://lolly.work) 上的公開示範是沙箱環境。需要保留的作品，請使用組織自己的網址。

<!--i:eti-palette-->
## 其他組織的品牌

合作夥伴、客戶或贊助商可能以設計系統檔案（`.lolly`）傳送品牌給你，而非提供網址。開啟該檔案不會讓應用程式連線到任何地方。檔案會將對方的設計系統加入這部裝置，與你自己的設計系統並存。來自你所屬組織的設定檔則會讓應用程式連線到組織的 Lolly。在任何變更發生之前，預覽會顯示開啟檔案將執行的動作。[與合作夥伴共事](/info/partners.html)涵蓋使用其他組織品牌時雙方的做法。

<!--i:eti-unlink-->
## 離開

**Settings** 中 **Lolly instance** 卡片上的 **Leave**，會移除組織的設計系統、工具與目錄。你自己的作品會保留。使用組織工具製作的內容，在重新連線之前都無法再次開啟。若組織的 Lolly 提供這項功能，同一卡片上的 **Sign out everywhere** 會結束所有裝置上的工作階段，包括目前這部裝置。

儲存到組織的任何內容都會留在組織，受其存取與保留政策約束。離開或清除此裝置的資料，不會刪除伺服器上的副本。在瀏覽器中使用組織自己的網址時，無須執行離開操作：改為開啟另一個網址即可。

<!--i:eti-help-->
## 該詢問誰

哪些內容會傳到組織的伺服器、誰能查看共用專案，以及哪些設定固定不變，都是組織的決定。請詢問負責運行組織 Lolly 的人。[隱私](/info/privacy.html)說明 Lolly 本身如何處理你的資料。
